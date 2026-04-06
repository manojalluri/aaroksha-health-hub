-- ─────────────────────────────────────────────────────────────────────────────
-- AAROKSHA HEALTH HUB: MASTER RESTORATION & SYNC FIX (Idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
-- This script safely repairs the database, ensures all columns exist,
-- and configures triggers for full cross-dashboard synchronization.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. SAFE TYPE CREATION
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'partner_type') THEN
        CREATE TYPE public.partner_type AS ENUM ('hospital', 'lab', 'pharmacy', 'logistics');
    ELSE
        BEGIN ALTER TYPE public.partner_type ADD VALUE 'logistics'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'commission_type') THEN
        CREATE TYPE public.commission_type AS ENUM ('percentage', 'fixed');
    END IF;
END $$;

-- 2. REPAIR & RESTORE TABLES
-- Partners
CREATE TABLE IF NOT EXISTS public.partners (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), partner_id text UNIQUE NOT NULL, name text NOT NULL, type public.partner_type NOT NULL, email text NOT NULL);
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS commission_type public.commission_type DEFAULT 'percentage';
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS commission_rate numeric NOT NULL DEFAULT 10;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

-- Doctors
CREATE TABLE IF NOT EXISTS public.doctors (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, specialty text NOT NULL);
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS hospital_id text REFERENCES public.partners(partner_id) ON DELETE CASCADE;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS partner_id text REFERENCES public.partners(partner_id) ON DELETE CASCADE;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS experience integer DEFAULT 0;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS fee numeric DEFAULT 500;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS rating numeric DEFAULT 4.8;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS available boolean DEFAULT true;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

-- Appointments
CREATE TABLE IF NOT EXISTS public.appointments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), patient_name text NOT NULL, patient_phone text NOT NULL);
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS order_id text UNIQUE;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS hospital_partner_id text REFERENCES public.partners(partner_id);
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS partner_id text REFERENCES public.partners(partner_id);
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS patient_age text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS patient_gender text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS fee numeric;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS consultation_fee numeric;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS platform_fee numeric DEFAULT 29;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS is_priority boolean DEFAULT false;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

-- Lab Tests
CREATE TABLE IF NOT EXISTS public.lab_tests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, category text NOT NULL, price numeric NOT NULL);
ALTER TABLE public.lab_tests ADD COLUMN IF NOT EXISTS partner_id text REFERENCES public.partners(partner_id);
ALTER TABLE public.lab_tests ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.lab_tests ADD COLUMN IF NOT EXISTS turnaround text;
ALTER TABLE public.lab_tests ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

-- Lab Bookings
CREATE TABLE IF NOT EXISTS public.lab_bookings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), patient_name text NOT NULL);
ALTER TABLE public.lab_bookings ADD COLUMN IF NOT EXISTS order_id text UNIQUE;
ALTER TABLE public.lab_bookings ADD COLUMN IF NOT EXISTS partner_id text REFERENCES public.partners(partner_id);
ALTER TABLE public.lab_bookings ADD COLUMN IF NOT EXISTS tests jsonb;
ALTER TABLE public.lab_bookings ADD COLUMN IF NOT EXISTS age integer;
ALTER TABLE public.lab_bookings ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE public.lab_bookings ADD COLUMN IF NOT EXISTS total_amount numeric;
ALTER TABLE public.lab_bookings ADD COLUMN IF NOT EXISTS platform_fee numeric DEFAULT 49;
ALTER TABLE public.lab_bookings ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE public.lab_bookings ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending';
ALTER TABLE public.lab_bookings ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

-- Prescriptions
CREATE TABLE IF NOT EXISTS public.prescriptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), patient_name text NOT NULL, patient_phone text NOT NULL);
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS order_id text UNIQUE;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS partner_id text REFERENCES public.partners(partner_id);
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS medicines jsonb;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS grand_total numeric DEFAULT 0;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS platform_fee numeric DEFAULT 19;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS delivery_fee numeric DEFAULT 40;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

-- Platform Settings
CREATE TABLE IF NOT EXISTS public.platform_settings (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS opd_fee numeric DEFAULT 29;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS lab_fee numeric DEFAULT 49;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS pharmacy_fee numeric DEFAULT 19;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS priority_surcharge numeric DEFAULT 250;

-- 3. PERMISSIVE SECURITY (Ensures all dashboards can sync)
ALTER TABLE public.partners DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_tests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings DISABLE ROW LEVEL SECURITY;

-- 4. SYNC TRIGGERS
DROP TRIGGER IF EXISTS trg_sync_doctor_ids ON public.doctors;
DROP TRIGGER IF EXISTS trg_sync_apt_ids ON public.appointments;

CREATE OR REPLACE FUNCTION public.sync_partner_ids() RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'doctors' THEN
        IF NEW.hospital_id IS NULL THEN NEW.hospital_id := NEW.partner_id; END IF;
        IF NEW.partner_id IS NULL THEN NEW.partner_id := NEW.hospital_id; END IF;
    ELSIF TG_TABLE_NAME = 'appointments' THEN
        IF NEW.hospital_partner_id IS NULL THEN NEW.hospital_partner_id := NEW.partner_id; END IF;
        IF NEW.partner_id IS NULL THEN NEW.partner_id := NEW.hospital_partner_id; END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_doctor_ids BEFORE INSERT OR UPDATE ON public.doctors FOR EACH ROW EXECUTE PROCEDURE public.sync_partner_ids();
CREATE TRIGGER trg_sync_apt_ids BEFORE INSERT OR UPDATE ON public.appointments FOR EACH ROW EXECUTE PROCEDURE public.sync_partner_ids();

-- 5. STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public) VALUES ('prescriptions', 'prescriptions', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('doctor_profiles', 'doctor_profiles', true) ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR ALL USING (bucket_id IN ('prescriptions', 'doctor_profiles')) WITH CHECK (bucket_id IN ('prescriptions', 'doctor_profiles'));

-- 6. SEED SETTINGS
INSERT INTO public.platform_settings (opd_fee, lab_fee, pharmacy_fee, priority_surcharge) 
SELECT 29, 49, 19, 250 WHERE NOT EXISTS (SELECT 1 FROM public.platform_settings);

NOTIFY pgrst, 'reload schema';
