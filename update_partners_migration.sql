-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION: Update Partners Table Schema
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add missing columns to partners table
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS partner_id TEXT;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT 'percentage';
-- percentage, fixed
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS commission_rate DECIMAL DEFAULT 10;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- 2. Ensure order_id columns exist (repeat just in case)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS order_id text UNIQUE;
ALTER TABLE lab_bookings ADD COLUMN IF NOT EXISTS order_id text UNIQUE;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS order_id text UNIQUE;

-- 3. Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
