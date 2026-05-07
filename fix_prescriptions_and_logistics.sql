-- ─────────────────────────────────────────────────────────────────────────────
-- FIX PRESCRIPTIONS TABLE: Add image_url column
-- ─────────────────────────────────────────────────────────────────────────────
-- This fixes the error: "Could not find the 'image_url' column of 'prescriptions' in the schema cache"

ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS is_auto_confirm BOOLEAN DEFAULT false;

-- Also add a column for quantity/price details if needed for logistics/pharmacy
-- (Existing JSONB medicines column handles this, but let's ensure image_url is there)

-- ─────────────────────────────────────────────────────────────────────────────
-- ENSURE LOGISTICS PARTNERS CAN BE CREATED
-- ─────────────────────────────────────────────────────────────────────────────
-- The check constraint on 'type' needs to include 'logistics' (if not already there).

ALTER TABLE public.partners DROP CONSTRAINT IF EXISTS partners_type_check;
ALTER TABLE public.partners ADD CONSTRAINT partners_type_check 
  CHECK (type IN ('hospital', 'lab', 'pharmacy', 'logistics', 'super'));

-- Also check admin_sessions table for the 'role' constraint
ALTER TABLE public.admin_sessions DROP CONSTRAINT IF EXISTS admin_sessions_role_check;
ALTER TABLE public.admin_sessions ADD CONSTRAINT admin_sessions_role_check
  CHECK (role IN ('hospital', 'lab', 'pharmacy', 'logistics', 'super'));
