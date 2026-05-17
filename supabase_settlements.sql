-- ==============================================================================
-- SETTLEMENT MANAGEMENT SYSTEM SCHEMA
-- ==============================================================================

-- 1. Create settlements table
CREATE TABLE IF NOT EXISTS public.settlements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id TEXT NOT NULL,
    transaction_id TEXT,
    partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE,
    partner_name TEXT,
    partner_type TEXT NOT NULL, -- 'hospital', 'lab', 'pharmacy', 'logistics'
    gross_amount NUMERIC NOT NULL DEFAULT 0,
    commission_percentage NUMERIC NOT NULL DEFAULT 0,
    commission_amount NUMERIC NOT NULL DEFAULT 0,
    net_settlement_amount NUMERIC NOT NULL DEFAULT 0,
    settlement_mode TEXT NOT NULL CHECK (settlement_mode IN ('PARTNER_COLLECTED', 'PLATFORM_COLLECTED')),
    settlement_direction TEXT NOT NULL CHECK (settlement_direction IN ('RECEIVABLE', 'PAYABLE')),
    settlement_status TEXT NOT NULL CHECK (settlement_status IN ('PENDING_RECEIVE', 'RECEIVED', 'PENDING_PAYOUT', 'PAID')),
    payment_method TEXT,
    settlement_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create settlement history table
CREATE TABLE IF NOT EXISTS public.settlement_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    settlement_id UUID REFERENCES public.settlements(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    payment_notes TEXT,
    transaction_reference TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS Policies
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_history ENABLE ROW LEVEL SECURITY;

-- Super Admin can see all
CREATE POLICY "Super admin can view all settlements" 
ON public.settlements FOR SELECT 
TO authenticated 
USING (auth.email() IN (SELECT email FROM public.admin_whitelist WHERE active = true));

CREATE POLICY "Super admin can update all settlements" 
ON public.settlements FOR UPDATE 
TO authenticated 
USING (auth.email() IN (SELECT email FROM public.admin_whitelist WHERE active = true));

-- Partners can see their own
CREATE POLICY "Partners can view their own settlements" 
ON public.settlements FOR SELECT 
TO authenticated 
USING (partner_id = auth.uid());

-- Same for history
CREATE POLICY "Super admin can view all settlement history" 
ON public.settlement_history FOR SELECT 
TO authenticated 
USING (auth.email() IN (SELECT email FROM public.admin_whitelist WHERE active = true));

CREATE POLICY "Super admin can insert settlement history" 
ON public.settlement_history FOR INSERT 
TO authenticated 
WITH CHECK (auth.email() IN (SELECT email FROM public.admin_whitelist WHERE active = true));

CREATE POLICY "Partners can view their own settlement history" 
ON public.settlement_history FOR SELECT 
TO authenticated 
USING (EXISTS (
    SELECT 1 FROM public.settlements s 
    WHERE s.id = settlement_history.settlement_id AND s.partner_id = auth.uid()
));

-- 4. Function to auto-calculate and create settlement
CREATE OR REPLACE FUNCTION create_settlement(
    p_order_id TEXT,
    p_partner_id UUID,
    p_partner_type TEXT,
    p_gross_amount NUMERIC,
    p_commission_percentage NUMERIC,
    p_settlement_mode TEXT,
    p_payment_method TEXT
) RETURNS UUID AS $$
DECLARE
    v_partner_name TEXT;
    v_commission_amount NUMERIC;
    v_net_amount NUMERIC;
    v_direction TEXT;
    v_status TEXT;
    v_settlement_id UUID;
BEGIN
    -- Get partner name
    SELECT name INTO v_partner_name FROM public.partners WHERE id = p_partner_id;
    
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

    -- Insert settlement
    INSERT INTO public.settlements (
        order_id, partner_id, partner_name, partner_type, 
        gross_amount, commission_percentage, commission_amount, net_settlement_amount,
        settlement_mode, settlement_direction, settlement_status, payment_method
    ) VALUES (
        p_order_id, p_partner_id, v_partner_name, p_partner_type,
        p_gross_amount, p_commission_percentage, v_commission_amount, v_net_amount,
        p_settlement_mode, v_direction, v_status, p_payment_method
    ) RETURNING id INTO v_settlement_id;
    
    -- Insert initial history
    INSERT INTO public.settlement_history (
        settlement_id, previous_status, new_status, updated_by, payment_notes
    ) VALUES (
        v_settlement_id, NULL, v_status, 'SYSTEM', 'Initial settlement creation'
    );
    
    RETURN v_settlement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Function to update settlement status (callable via RPC by Super Admin)
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
    -- Check if user is super admin
    IF auth.email() NOT IN (SELECT email FROM public.admin_whitelist WHERE active = true) THEN
        RAISE EXCEPTION 'Unauthorized: Only Super Admin can update settlement status';
    END IF;

    SELECT settlement_status INTO v_old_status FROM public.settlements WHERE id = p_settlement_id;
    
    IF v_old_status IS NULL THEN
        RAISE EXCEPTION 'Settlement not found';
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
