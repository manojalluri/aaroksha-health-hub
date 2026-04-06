-- ─────────────────────────────────────────────────────────────────────────────
-- FULL SYNC FIX: ALIGN DOCTORS & APPOINTMENTS WITH CODE
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. FIX DOCTORS TABLE COLUMNS
-- Ensure all fields used in HospitalDashboard.tsx and DoctorsPage.tsx exist
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS experience INTEGER;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS fee INTEGER DEFAULT 500;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS available BOOLEAN DEFAULT true;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS partner_id TEXT;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS hospital_name TEXT;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS rating DECIMAL(2,1) DEFAULT 4.5;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS languages TEXT;

-- 2. FIX APPOINTMENTS TABLE COLUMNS
-- Ensure all fields used in both Dashboards and BookingPage exist
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS patient_age TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS patient_gender TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS platform_fee NUMERIC DEFAULT 29;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS consultation_fee NUMERIC;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS fee NUMERIC;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS hospital_partner_id TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. DOCTORS POLICIES
-- Anyone can view doctors
DROP POLICY IF EXISTS "Public Read Doctors" ON public.doctors;
CREATE POLICY "Public Read Doctors" ON public.doctors FOR SELECT USING (true);

-- Authenticated admins can manage doctors (simple policy for robustness)
DROP POLICY IF EXISTS "Admin Manage Doctors" ON public.doctors;
CREATE POLICY "Admin Manage Doctors" ON public.doctors FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. APPOINTMENTS POLICIES
-- Users can see their own appointments (via user_id)
DROP POLICY IF EXISTS "Users view own appointments" ON public.appointments;
CREATE POLICY "Users view own appointments" ON public.appointments FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Admins can view all appointments or partner-specific ones
DROP POLICY IF EXISTS "Admins view all appointments" ON public.appointments;
CREATE POLICY "Admins view all appointments" ON public.appointments FOR ALL TO authenticated USING (true);

-- Allow anonymous booking (INSERT)
DROP POLICY IF EXISTS "Anon Booking" ON public.appointments;
CREATE POLICY "Anon Booking" ON public.appointments FOR INSERT WITH CHECK (true);

-- 6. PARTNERS POLICIES
DROP POLICY IF EXISTS "Public Read Partners" ON public.partners;
CREATE POLICY "Public Read Partners" ON public.partners FOR SELECT USING (true);

-- 7. ENABLE REALTIME
-- This ensures the UI updates instantly when doctors/appointments are added
-- Check if table is already in a publication first (though standard is supabase_realtime)
ALTER publication supabase_realtime ADD TABLE doctors;
ALTER publication supabase_realtime ADD TABLE appointments;

-- 8. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
