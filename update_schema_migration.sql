-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION: Update Tables Schema for Full Dashboard Support (Comprehensive)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Updates to partners table
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS partner_id TEXT;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT 'percentage';
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS commission_rate DECIMAL DEFAULT 10;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- 2. Updates to appointments table
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS patient_age INTEGER;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS patient_gender TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS consultation_fee INTEGER;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS hospital_partner_id TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS order_id TEXT UNIQUE;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

-- 3. Updates to lab_bookings table
ALTER TABLE public.lab_bookings ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE public.lab_bookings ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.lab_bookings ADD COLUMN IF NOT EXISTS technician TEXT;
ALTER TABLE public.lab_bookings ADD COLUMN IF NOT EXISTS order_id TEXT UNIQUE;
ALTER TABLE public.lab_bookings ADD COLUMN IF NOT EXISTS patient_phone TEXT;
ALTER TABLE public.lab_bookings ADD COLUMN IF NOT EXISTS patient_address TEXT;
ALTER TABLE public.lab_bookings ADD COLUMN IF NOT EXISTS total_amount INTEGER;

-- 4. Updates to prescriptions table
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS is_express_delivery BOOLEAN DEFAULT false;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS order_id TEXT UNIQUE;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS sub_total INTEGER DEFAULT 0;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS platform_fee INTEGER DEFAULT 0;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS delivery_fee INTEGER DEFAULT 40;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS grand_total INTEGER DEFAULT 0;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS admin_note TEXT;

-- 5. Updates to doctors table
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS hospital_id TEXT;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS available BOOLEAN DEFAULT true;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS rating DECIMAL DEFAULT 4.5;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS fee INTEGER DEFAULT 500;

-- 6. Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
