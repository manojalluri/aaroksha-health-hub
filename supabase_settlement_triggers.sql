-- ==============================================================================
-- AUTOMATIC SETTLEMENT TRIGGERS (UPDATED FOR 2-STEP & SETTLEMENT FLOW)
-- Run this in Supabase SQL Editor to auto-create settlements when orders complete
-- ==============================================================================

-- 1. Modify create_settlement to accept TEXT partner_id since all order tables use TEXT
CREATE OR REPLACE FUNCTION create_settlement(
    p_order_id TEXT,
    p_partner_id_text TEXT,
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
    -- Look up actual UUID and name
    SELECT id, name INTO v_partner_id, v_partner_name FROM public.partners WHERE partner_id = p_partner_id_text;
    
    IF v_partner_id IS NULL THEN
        RAISE EXCEPTION 'Partner not found for id: %', p_partner_id_text;
    END IF;

    -- Calculate commission
    v_commission_amount := (p_gross_amount * p_commission_percentage) / 100;
    
    -- Determine direction, net amount, and initial status based on mode
    IF p_settlement_mode = 'PARTNER_COLLECTED' THEN
        v_direction := 'RECEIVABLE';
        v_net_amount := v_commission_amount;
        v_status := 'PENDING_RECEIVE';
    ELSIF p_settlement_mode = 'PLATFORM_COLLECTED' THEN
        v_direction := 'PAYABLE';
        v_net_amount := p_gross_amount - v_commission_amount;
        v_status := 'PENDING_PAYOUT';
    ELSE
        RAISE EXCEPTION 'Invalid settlement mode';
    END IF;

    -- Prevent duplicate settlements for the same order
    IF EXISTS (SELECT 1 FROM public.settlements WHERE order_id = p_order_id) THEN
        RETURN (SELECT id FROM public.settlements WHERE order_id = p_order_id LIMIT 1);
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
    
    -- Insert initial history
    INSERT INTO public.settlement_history (
        settlement_id, previous_status, new_status, updated_by, payment_notes
    ) VALUES (
        v_settlement_id, NULL, v_status, 'SYSTEM', 'Initial settlement auto-creation'
    );
    
    RETURN v_settlement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Trigger Function for Appointments (OPD)
CREATE OR REPLACE FUNCTION handle_appointment_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_comm_rate NUMERIC;
    v_comm_type TEXT;
    v_settlement_model TEXT;
    v_mode TEXT;
BEGIN
    IF (NEW.status IN ('confirmed', 'completed') OR NEW.payment_status = 'paid') AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status OR OLD.payment_status IS DISTINCT FROM NEW.payment_status) AND NEW.partner_id IS NOT NULL THEN
        SELECT commission_rate, commission_type, COALESCE(settlement_model, 'DYNAMIC') 
        INTO v_comm_rate, v_comm_type, v_settlement_model
        FROM partners WHERE partner_id = NEW.partner_id;

        IF v_comm_type = 'fixed' THEN
            IF NEW.fee > 0 THEN v_comm_rate := (v_comm_rate / NEW.fee) * 100;
            ELSE v_comm_rate := 0; END IF;
        END IF;

        IF v_settlement_model = 'PLATFORM_PAYS_PARTNER' THEN v_mode := 'PLATFORM_COLLECTED';
        ELSIF v_settlement_model = 'PARTNER_PAYS_PLATFORM' THEN v_mode := 'PARTNER_COLLECTED';
        ELSE v_mode := CASE WHEN NEW.payment_status = 'paid' THEN 'PLATFORM_COLLECTED' ELSE 'PARTNER_COLLECTED' END;
        END IF;

        PERFORM create_settlement(
            NEW.order_id, NEW.partner_id, 'hospital', NEW.fee, COALESCE(v_comm_rate, 10),
            v_mode, NEW.payment_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_appointment_completed ON appointments;
CREATE TRIGGER on_appointment_completed
    AFTER INSERT OR UPDATE OF status, payment_status ON appointments
    FOR EACH ROW EXECUTE PROCEDURE handle_appointment_settlement();


-- 3. Trigger Function for Lab Bookings
CREATE OR REPLACE FUNCTION handle_lab_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_comm_rate NUMERIC;
    v_comm_type TEXT;
    v_settlement_model TEXT;
    v_mode TEXT;
BEGIN
    IF (NEW.status IN ('confirmed', 'completed') OR NEW.payment_status = 'paid') AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status OR OLD.payment_status IS DISTINCT FROM NEW.payment_status) AND NEW.partner_id IS NOT NULL THEN
        SELECT commission_rate, commission_type, COALESCE(settlement_model, 'DYNAMIC') 
        INTO v_comm_rate, v_comm_type, v_settlement_model 
        FROM partners WHERE partner_id = NEW.partner_id;

        IF v_comm_type = 'fixed' THEN
            IF NEW.total_amount > 0 THEN v_comm_rate := (v_comm_rate / NEW.total_amount) * 100;
            ELSE v_comm_rate := 0; END IF;
        END IF;

        IF v_settlement_model = 'PLATFORM_PAYS_PARTNER' THEN v_mode := 'PLATFORM_COLLECTED';
        ELSIF v_settlement_model = 'PARTNER_PAYS_PLATFORM' THEN v_mode := 'PARTNER_COLLECTED';
        ELSE v_mode := CASE WHEN NEW.payment_status = 'paid' THEN 'PLATFORM_COLLECTED' ELSE 'PARTNER_COLLECTED' END;
        END IF;

        PERFORM create_settlement(
            NEW.order_id, NEW.partner_id, 'lab', NEW.total_amount, COALESCE(v_comm_rate, 12),
            v_mode, NEW.payment_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_lab_booking_completed ON lab_bookings;
CREATE TRIGGER on_lab_booking_completed
    AFTER INSERT OR UPDATE OF status, payment_status ON lab_bookings
    FOR EACH ROW EXECUTE PROCEDURE handle_lab_settlement();


-- 4. Trigger Function for Prescriptions (Pharmacy)
CREATE OR REPLACE FUNCTION handle_pharmacy_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_comm_rate NUMERIC;
    v_comm_type TEXT;
    v_settlement_model TEXT;
    v_mode TEXT;
BEGIN
    IF (NEW.status IN ('confirmed', 'dispatched', 'completed') OR (NEW.payment_status = 'paid' AND NEW.status != 'rejected')) AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status OR OLD.payment_status IS DISTINCT FROM NEW.payment_status) AND NEW.partner_id IS NOT NULL THEN
        SELECT commission_rate, commission_type, COALESCE(settlement_model, 'DYNAMIC') 
        INTO v_comm_rate, v_comm_type, v_settlement_model 
        FROM partners WHERE partner_id = NEW.partner_id;

        IF v_comm_type = 'fixed' THEN
            IF NEW.sub_total > 0 THEN v_comm_rate := (v_comm_rate / NEW.sub_total) * 100;
            ELSE v_comm_rate := 0; END IF;
        END IF;

        IF v_settlement_model = 'PLATFORM_PAYS_PARTNER' THEN v_mode := 'PLATFORM_COLLECTED';
        ELSIF v_settlement_model = 'PARTNER_PAYS_PLATFORM' THEN v_mode := 'PARTNER_COLLECTED';
        ELSE v_mode := CASE WHEN NEW.payment_status = 'paid' THEN 'PLATFORM_COLLECTED' ELSE 'PARTNER_COLLECTED' END;
        END IF;

        PERFORM create_settlement(
            NEW.order_id, NEW.partner_id, 'pharmacy', NEW.sub_total, COALESCE(v_comm_rate, 15),
            v_mode, NEW.payment_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_prescription_completed ON prescriptions;
CREATE TRIGGER on_prescription_completed
    AFTER INSERT OR UPDATE OF status, payment_status ON prescriptions
    FOR EACH ROW EXECUTE PROCEDURE handle_pharmacy_settlement();
