-- ==============================================================================
-- COMPLETE SETTLEMENT SYSTEM - FULL CLEAN MIGRATION
-- Run this ONCE in Supabase SQL Editor. It is idempotent (safe to re-run).
-- ==============================================================================

-- ── Step 1: Drop old constraints that block operations ──────────────────────
ALTER TABLE public.settlements
  DROP CONSTRAINT IF EXISTS settlements_partner_id_fkey;

ALTER TABLE public.settlements
  DROP CONSTRAINT IF EXISTS settlements_settlement_status_check;

-- ── Step 2: Fix FK with CASCADE so partners can be deleted ──────────────────
ALTER TABLE public.settlements
  ADD CONSTRAINT settlements_partner_id_fkey
  FOREIGN KEY (partner_id)
  REFERENCES public.partners(id)
  ON DELETE CASCADE;

-- ── Step 3: Add 2-step statuses to the check constraint ────────────────────
-- Clean up any existing rows with stale statuses before adding constraint
UPDATE public.settlements
  SET settlement_status = 'PENDING_RECEIVE'
  WHERE settlement_status NOT IN ('PENDING_RECEIVE','PARTNER_MARKED_PAID','RECEIVED','PENDING_PAYOUT','ADMIN_MARKED_PAID','PAID');

ALTER TABLE public.settlements
  ADD CONSTRAINT settlements_settlement_status_check
  CHECK (settlement_status IN ('PENDING_RECEIVE','PARTNER_MARKED_PAID','RECEIVED','PENDING_PAYOUT','ADMIN_MARKED_PAID','PAID'));

-- ── Step 4: Add order_id unique constraint so duplicates never happen ───────
ALTER TABLE public.settlements
  DROP CONSTRAINT IF EXISTS settlements_order_id_key;
ALTER TABLE public.settlements
  ADD CONSTRAINT settlements_order_id_key UNIQUE (order_id);

-- ── Step 5: Drop all old RLS policies and create clean ones ─────────────────
DROP POLICY IF EXISTS "Super admin can view all settlements" ON public.settlements;
DROP POLICY IF EXISTS "Super admin can update all settlements" ON public.settlements;
DROP POLICY IF EXISTS "Partners can view their own settlements" ON public.settlements;
DROP POLICY IF EXISTS "Super admin can view all settlement history" ON public.settlement_history;
DROP POLICY IF EXISTS "Super admin can insert settlement history" ON public.settlement_history;
DROP POLICY IF EXISTS "Partners can view their own settlement history" ON public.settlement_history;

-- Disable RLS entirely — all access controlled via SECURITY DEFINER functions
ALTER TABLE public.settlements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_history DISABLE ROW LEVEL SECURITY;

-- ── Step 6: Replace create_settlement to use TEXT partner_id ────────────────
CREATE OR REPLACE FUNCTION create_settlement(
    p_order_id TEXT,
    p_partner_id_text TEXT,   -- TEXT partner_id from order tables
    p_partner_type TEXT,
    p_gross_amount NUMERIC,
    p_commission_percentage NUMERIC,
    p_settlement_mode TEXT,
    p_payment_method TEXT
) RETURNS UUID AS $$
DECLARE
    v_partner_id UUID;
    v_partner_name TEXT;
    v_commission_amount NUMERIC;
    v_net_amount NUMERIC;
    v_direction TEXT;
    v_status TEXT;
    v_settlement_id UUID;
BEGIN
    -- Resolve partner UUID and name from TEXT partner_id
    SELECT id, name INTO v_partner_id, v_partner_name
    FROM public.partners
    WHERE partner_id = p_partner_id_text;

    IF v_partner_id IS NULL THEN
        -- Silently skip if partner not found (prevents trigger errors)
        RETURN NULL;
    END IF;

    -- Skip if settlement for this order already exists (idempotent)
    IF EXISTS (SELECT 1 FROM public.settlements WHERE order_id = p_order_id) THEN
        RETURN (SELECT id FROM public.settlements WHERE order_id = p_order_id LIMIT 1);
    END IF;

    -- Calculate commission
    v_commission_amount := ROUND((p_gross_amount * p_commission_percentage) / 100, 2);

    -- Determine direction and status
    IF p_settlement_mode = 'PARTNER_COLLECTED' THEN
        v_direction := 'RECEIVABLE';
        v_net_amount := v_commission_amount;
        v_status := 'PENDING_RECEIVE';
    ELSIF p_settlement_mode = 'PLATFORM_COLLECTED' THEN
        v_direction := 'PAYABLE';
        v_net_amount := ROUND(p_gross_amount - v_commission_amount, 2);
        v_status := 'PENDING_PAYOUT';
    ELSE
        RETURN NULL;
    END IF;

    -- Insert settlement
    INSERT INTO public.settlements (
        order_id, partner_id, partner_name, partner_type,
        gross_amount, commission_percentage, commission_amount, net_settlement_amount,
        settlement_mode, settlement_direction, settlement_status, payment_method
    ) VALUES (
        p_order_id, v_partner_id, v_partner_name, p_partner_type,
        p_gross_amount, p_commission_percentage, v_commission_amount, v_net_amount,
        p_settlement_mode, v_direction, v_status, p_payment_method
    ) RETURNING id INTO v_settlement_id;

    -- Insert initial history entry
    INSERT INTO public.settlement_history (
        settlement_id, previous_status, new_status, updated_by, payment_notes
    ) VALUES (
        v_settlement_id, NULL, v_status, 'SYSTEM', 'Auto-created when order was confirmed'
    );

    RETURN v_settlement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── Step 7: update_settlement_status — allow BOTH admin and partner to update ─
CREATE OR REPLACE FUNCTION update_settlement_status(
    p_settlement_id UUID,
    p_new_status TEXT,
    p_updated_by TEXT,
    p_notes TEXT,
    p_transaction_ref TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_old_status TEXT;
BEGIN
    SELECT settlement_status INTO v_old_status
    FROM public.settlements WHERE id = p_settlement_id;

    IF v_old_status IS NULL THEN
        RAISE EXCEPTION 'Settlement not found';
    END IF;

    -- Validate allowed transitions
    IF NOT (
        -- Partner marks commission as sent to admin
        (v_old_status = 'PENDING_RECEIVE'     AND p_new_status = 'PARTNER_MARKED_PAID') OR
        -- Admin confirms they received it
        (v_old_status = 'PARTNER_MARKED_PAID' AND p_new_status = 'RECEIVED')            OR
        -- Admin marks payout sent to partner
        (v_old_status = 'PENDING_PAYOUT'      AND p_new_status = 'ADMIN_MARKED_PAID')   OR
        -- Partner confirms they received the payout
        (v_old_status = 'ADMIN_MARKED_PAID'   AND p_new_status = 'PAID')                OR
        -- Admin can force-finalize any record
        (p_updated_by = 'Super Admin'         AND p_new_status IN ('RECEIVED','PAID'))
    ) THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', v_old_status, p_new_status;
    END IF;

    UPDATE public.settlements
    SET settlement_status = p_new_status,
        updated_at = NOW(),
        settlement_date = CASE WHEN p_new_status IN ('PAID', 'RECEIVED') THEN NOW() ELSE settlement_date END
    WHERE id = p_settlement_id;

    INSERT INTO public.settlement_history (
        settlement_id, previous_status, new_status, updated_by, payment_notes, transaction_reference
    ) VALUES (
        p_settlement_id, v_old_status, p_new_status, p_updated_by, p_notes, p_transaction_ref
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── Step 8: Appointment trigger (Hospital) ──────────────────────────────────
CREATE OR REPLACE FUNCTION handle_appointment_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_comm_rate NUMERIC;
    v_comm_type TEXT;
    v_settlement_model TEXT;
    v_mode TEXT;
BEGIN
    -- Fire on confirmed or completed status, and only when status actually changed
    IF NEW.partner_id IS NOT NULL
       AND NEW.status IN ('confirmed', 'completed')
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
    THEN
        SELECT commission_rate, commission_type, COALESCE(settlement_model, 'DYNAMIC')
        INTO v_comm_rate, v_comm_type, v_settlement_model
        FROM partners WHERE partner_id = NEW.partner_id;

        -- Normalize fixed → percentage
        IF v_comm_type = 'fixed' AND NEW.fee > 0 THEN
            v_comm_rate := ROUND((v_comm_rate / NEW.fee) * 100, 2);
        END IF;

        -- Determine collection mode
        IF    v_settlement_model = 'PLATFORM_PAYS_PARTNER' THEN v_mode := 'PLATFORM_COLLECTED';
        ELSIF v_settlement_model = 'PARTNER_PAYS_PLATFORM'  THEN v_mode := 'PARTNER_COLLECTED';
        ELSE  v_mode := CASE WHEN NEW.payment_status = 'paid' THEN 'PLATFORM_COLLECTED' ELSE 'PARTNER_COLLECTED' END;
        END IF;

        PERFORM create_settlement(
            NEW.order_id, NEW.partner_id, 'hospital',
            COALESCE(NEW.fee, 0), COALESCE(v_comm_rate, 10),
            v_mode, NEW.payment_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_appointment_settlement ON appointments;
CREATE TRIGGER on_appointment_settlement
    AFTER INSERT OR UPDATE OF status ON appointments
    FOR EACH ROW EXECUTE PROCEDURE handle_appointment_settlement();


-- ── Step 9: Lab booking trigger ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_lab_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_comm_rate NUMERIC;
    v_comm_type TEXT;
    v_settlement_model TEXT;
    v_mode TEXT;
BEGIN
    IF NEW.partner_id IS NOT NULL
       AND NEW.status IN ('confirmed', 'completed')
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
    THEN
        SELECT commission_rate, commission_type, COALESCE(settlement_model, 'DYNAMIC')
        INTO v_comm_rate, v_comm_type, v_settlement_model
        FROM partners WHERE partner_id = NEW.partner_id;

        IF v_comm_type = 'fixed' AND NEW.total_amount > 0 THEN
            v_comm_rate := ROUND((v_comm_rate / NEW.total_amount) * 100, 2);
        END IF;

        IF    v_settlement_model = 'PLATFORM_PAYS_PARTNER' THEN v_mode := 'PLATFORM_COLLECTED';
        ELSIF v_settlement_model = 'PARTNER_PAYS_PLATFORM'  THEN v_mode := 'PARTNER_COLLECTED';
        ELSE  v_mode := CASE WHEN NEW.payment_status = 'paid' THEN 'PLATFORM_COLLECTED' ELSE 'PARTNER_COLLECTED' END;
        END IF;

        PERFORM create_settlement(
            NEW.order_id, NEW.partner_id, 'lab',
            COALESCE(NEW.total_amount, 0), COALESCE(v_comm_rate, 12),
            v_mode, NEW.payment_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_lab_settlement ON lab_bookings;
CREATE TRIGGER on_lab_settlement
    AFTER INSERT OR UPDATE OF status ON lab_bookings
    FOR EACH ROW EXECUTE PROCEDURE handle_lab_settlement();


-- ── Step 10: Pharmacy/Prescription trigger ──────────────────────────────────
CREATE OR REPLACE FUNCTION handle_pharmacy_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_comm_rate NUMERIC;
    v_comm_type TEXT;
    v_settlement_model TEXT;
    v_mode TEXT;
BEGIN
    -- Fire when customer confirms (COD) or pharmacy dispatches
    IF NEW.partner_id IS NOT NULL
       AND NEW.status IN ('confirmed', 'dispatched', 'completed')
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
    THEN
        SELECT commission_rate, commission_type, COALESCE(settlement_model, 'DYNAMIC')
        INTO v_comm_rate, v_comm_type, v_settlement_model
        FROM partners WHERE partner_id = NEW.partner_id;

        IF v_comm_type = 'fixed' AND COALESCE(NEW.sub_total, 0) > 0 THEN
            v_comm_rate := ROUND((v_comm_rate / NEW.sub_total) * 100, 2);
        END IF;

        IF    v_settlement_model = 'PLATFORM_PAYS_PARTNER' THEN v_mode := 'PLATFORM_COLLECTED';
        ELSIF v_settlement_model = 'PARTNER_PAYS_PLATFORM'  THEN v_mode := 'PARTNER_COLLECTED';
        ELSE  v_mode := 'PARTNER_COLLECTED'; -- Default COD is always partner-collected
        END IF;

        PERFORM create_settlement(
            NEW.order_id, NEW.partner_id, 'pharmacy',
            COALESCE(NEW.sub_total, 0), COALESCE(v_comm_rate, 15),
            v_mode, NULL
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_pharmacy_settlement ON prescriptions;
CREATE TRIGGER on_pharmacy_settlement
    AFTER INSERT OR UPDATE OF status ON prescriptions
    FOR EACH ROW EXECUTE PROCEDURE handle_pharmacy_settlement();


-- ── Step 11: Helpful indexes for performance ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_settlements_partner_id     ON public.settlements(partner_id);
CREATE INDEX IF NOT EXISTS idx_settlements_order_id       ON public.settlements(order_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status         ON public.settlements(settlement_status);
CREATE INDEX IF NOT EXISTS idx_settlements_created_at     ON public.settlements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_settlement_history_sett_id ON public.settlement_history(settlement_id);
