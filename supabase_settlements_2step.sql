-- 1. Add settlement_model to partners table
ALTER TABLE public.partners 
ADD COLUMN IF NOT EXISTS settlement_model TEXT DEFAULT 'DYNAMIC'
CHECK (settlement_model IN ('DYNAMIC', 'PLATFORM_PAYS_PARTNER', 'PARTNER_PAYS_PLATFORM'));

-- 2. Update settlement_status constraint to support 2-step verification
ALTER TABLE public.settlements DROP CONSTRAINT IF EXISTS settlements_settlement_status_check;
ALTER TABLE public.settlements ADD CONSTRAINT settlements_settlement_status_check 
CHECK (settlement_status IN (
    'PENDING_RECEIVE', 'PARTNER_MARKED_PAID', 'RECEIVED', 
    'PENDING_PAYOUT', 'ADMIN_MARKED_PAID', 'PAID'
));

-- 3. Update update_settlement_status RPC to allow partners to update
DROP FUNCTION IF EXISTS update_settlement_status;
CREATE OR REPLACE FUNCTION update_settlement_status(
    p_settlement_id UUID,
    p_new_status TEXT,
    p_updated_by TEXT,
    p_notes TEXT,
    p_transaction_ref TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_old_status TEXT;
    v_partner_id UUID;
    v_is_super_admin BOOLEAN;
    v_is_partner BOOLEAN;
BEGIN
    -- Check roles
    v_is_super_admin := EXISTS (SELECT 1 FROM public.admin_whitelist WHERE email = auth.email() AND active = true);
    
    SELECT settlement_status, partner_id INTO v_old_status, v_partner_id FROM public.settlements WHERE id = p_settlement_id;
    
    IF v_old_status IS NULL THEN
        RAISE EXCEPTION 'Settlement not found';
    END IF;

    v_is_partner := (v_partner_id = auth.uid());

    IF NOT v_is_super_admin AND NOT v_is_partner THEN
        RAISE EXCEPTION 'Unauthorized to update this settlement';
    END IF;

    -- Update status and timestamp
    UPDATE public.settlements 
    SET settlement_status = p_new_status,
        updated_at = NOW(),
        settlement_date = CASE WHEN p_new_status IN ('PAID', 'RECEIVED') THEN NOW() ELSE settlement_date END
    WHERE id = p_settlement_id;
    
    -- Add history record
    INSERT INTO public.settlement_history (
        settlement_id, previous_status, new_status, updated_by, payment_notes, transaction_reference
    ) VALUES (
        p_settlement_id, v_old_status, p_new_status, p_updated_by, p_notes, p_transaction_ref
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
