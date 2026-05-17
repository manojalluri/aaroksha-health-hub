-- ==============================================================================
-- ADD 'confirmed' STATUS TO PRESCRIPTIONS FOR COD FLOW
-- Run this in Supabase SQL Editor
-- ==============================================================================

-- First, let's fix any existing rows that might have invalid statuses like 'cancelled'
UPDATE public.prescriptions 
SET status = 'rejected' 
WHERE status NOT IN ('pending', 'reviewed', 'confirmed', 'dispatched', 'completed', 'rejected');

ALTER TABLE public.prescriptions DROP CONSTRAINT IF EXISTS prescriptions_status_check;
ALTER TABLE public.prescriptions ADD CONSTRAINT prescriptions_status_check CHECK (status IN ('pending', 'reviewed', 'confirmed', 'dispatched', 'completed', 'rejected'));

-- Update the pharmacy settlement trigger to also fire on 'confirmed'
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
