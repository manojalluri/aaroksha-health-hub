-- ─────────────────────────────────────────────────────────────────────────────
-- FIX PLATFORM SETTINGS: Add missing columns and harmonize schema
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Ensure columns exist for all settings used in the UI
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS currency           TEXT    DEFAULT 'INR (₹)';
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS cgst               NUMERIC DEFAULT 9;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS sgst               NUMERIC DEFAULT 9;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS delivery_fee       NUMERIC DEFAULT 40;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS express_fee        NUMERIC DEFAULT 99;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS free_threshold     NUMERIC DEFAULT 999;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS delivery_radius    NUMERIC DEFAULT 15;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS delivery_time      NUMERIC DEFAULT 4;

-- Modules toggle
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS opd_check          BOOLEAN DEFAULT true;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS lab_check          BOOLEAN DEFAULT true;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS pharm_check        BOOLEAN DEFAULT true;

-- Payment methods
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS upi                BOOLEAN DEFAULT true;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS cod                BOOLEAN DEFAULT true;

-- 2. Rename pharmacy_fee to pharm_fee to match the code if it exists with old name
-- Or just add pharm_fee as an alias/new column
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='platform_settings' AND column_name='pharmacy_fee') THEN
    ALTER TABLE public.platform_settings RENAME COLUMN pharmacy_fee TO pharm_fee;
  ELSE
    ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS pharm_fee NUMERIC DEFAULT 19;
  END IF;
END $$;

-- 3. Ensure a global settings record exists with id 'global'
INSERT INTO public.platform_settings (id) 
VALUES ('global')
ON CONFLICT (id) DO NOTHING;
