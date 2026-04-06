-- =====================================================================
-- Migration: Delivery columns for prescriptions table
-- Run this in your Supabase SQL Editor → SQL Editor → New Query
-- =====================================================================

-- 1. Add delivery_code column (6-char alphanumeric, generated on payment)
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS delivery_code TEXT DEFAULT NULL;

-- 2. payment_status column
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

-- 3. updated_at column for tracking
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 4. assigned_partner_id: which logistics partner is assigned to this order
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS assigned_partner_id TEXT DEFAULT NULL;

-- 5. Index for fast delivery_code lookup
CREATE INDEX IF NOT EXISTS idx_prescriptions_delivery_code
  ON public.prescriptions (delivery_code)
  WHERE delivery_code IS NOT NULL;

-- 6. Index for payment_status queries
CREATE INDEX IF NOT EXISTS idx_prescriptions_payment_status
  ON public.prescriptions (payment_status);

-- 7. Index for assigned_partner_id queries (logistics dashboard filtering)
CREATE INDEX IF NOT EXISTS idx_prescriptions_assigned_partner
  ON public.prescriptions (assigned_partner_id)
  WHERE assigned_partner_id IS NOT NULL;

-- Verify all new columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'prescriptions'
  AND column_name IN (
    'delivery_code',
    'payment_status',
    'updated_at',
    'assigned_partner_id'
  )
ORDER BY column_name;
