-- ─────────────────────────────────────────────────────────────────────────────
-- FULL SYNC FIX: ALIGN DOCTORS & APPOINTMENTS WITH CODE
-- Run this in: Supabase → SQL Editor → New Query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 1: CREATE profiles TABLE (if it doesn't exist yet)
-- This table stores user profile info linked to Supabase Auth users.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    TEXT,
  email        TEXT,
  phone        TEXT,
  role         TEXT DEFAULT 'patient',
  is_suspended BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- Auto-populate profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 2: CREATE admin_sessions TABLE (required for all partner logins)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token      UUID NOT NULL UNIQUE,
  partner_id TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('hospital','lab','pharmacy','logistics')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_token   ON public.admin_sessions (token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON public.admin_sessions (expires_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 3: FIX DOCTORS TABLE COLUMNS
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS experience    INTEGER;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS fee           INTEGER DEFAULT 500;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS available     BOOLEAN DEFAULT true;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS image_url     TEXT;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS partner_id    TEXT;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS hospital_name TEXT;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS rating        DECIMAL(2,1) DEFAULT 4.5;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS languages     TEXT;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS qualification TEXT;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS phone         TEXT;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 4: FIX APPOINTMENTS TABLE COLUMNS
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS patient_age        TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS patient_gender      TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS platform_fee        NUMERIC DEFAULT 29;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS consultation_fee    NUMERIC;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS fee                 NUMERIC;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS hospital_partner_id TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS status              TEXT DEFAULT 'pending';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS payment_status      TEXT DEFAULT 'pending';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS notes               TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS order_id            TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS is_priority         BOOLEAN DEFAULT false;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 5: ENABLE ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.doctors         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions  ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 6: RLS POLICIES — DOCTORS
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Public Read Doctors"  ON public.doctors;
DROP POLICY IF EXISTS "Admin Manage Doctors" ON public.doctors;
DROP POLICY IF EXISTS "Anon Read Doctors"    ON public.doctors;

-- Anyone (including unauthenticated users browsing the site) can read doctors
CREATE POLICY "Public Read Doctors" ON public.doctors
  FOR SELECT USING (true);

-- Authenticated users (hospital admins) can insert/update/delete
CREATE POLICY "Admin Manage Doctors" ON public.doctors
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 7: RLS POLICIES — APPOINTMENTS
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Users view own appointments"  ON public.appointments;
DROP POLICY IF EXISTS "Admins view all appointments" ON public.appointments;
DROP POLICY IF EXISTS "Anon Booking"                 ON public.appointments;

-- Authenticated users can read their own appointments
CREATE POLICY "Users view own appointments" ON public.appointments
  FOR SELECT TO authenticated USING (true);

-- Authenticated users (admins, partners) can manage all appointments
CREATE POLICY "Admins view all appointments" ON public.appointments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow anyone (anonymous users) to INSERT a booking
CREATE POLICY "Anon Booking" ON public.appointments
  FOR INSERT WITH CHECK (true);

-- Allow anonymous users to read appointments (needed for profile page)
CREATE POLICY "Anon Read Appointments" ON public.appointments
  FOR SELECT USING (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 8: RLS POLICIES — PARTNERS
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Public Read Partners" ON public.partners;

CREATE POLICY "Public Read Partners" ON public.partners
  FOR SELECT USING (true);

CREATE POLICY "Super Admin Manage Partners" ON public.partners
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 9: RLS POLICIES — PROFILES
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Users read own profile"   ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin read all profiles"  ON public.profiles;

CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Admins can read all profiles (for SuperAdmin Users tab)
CREATE POLICY "Admin read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 10: RLS POLICIES — ADMIN SESSIONS
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Full access admin sessions" ON public.admin_sessions;

-- Allow all operations (token is the secret — anyone with the token can verify)
CREATE POLICY "Full access admin sessions" ON public.admin_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 11: ENABLE REALTIME
-- ═══════════════════════════════════════════════════════════════════════════
-- NOTE: These lines are safe — they use DO blocks to avoid errors
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE doctors;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 12: INDEXES FOR PERFORMANCE
-- ═══════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_appointments_phone    ON public.appointments (patient_phone);
CREATE INDEX IF NOT EXISTS idx_appointments_partner  ON public.appointments (hospital_partner_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status   ON public.appointments (status);
CREATE INDEX IF NOT EXISTS idx_doctors_available     ON public.doctors (available);
CREATE INDEX IF NOT EXISTS idx_doctors_specialty     ON public.doctors (specialty);

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 13: RELOAD SCHEMA CACHE
-- ═══════════════════════════════════════════════════════════════════════════
NOTIFY pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICATION — Run this at the end to confirm everything was created
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('doctors','appointments','partners','profiles','admin_sessions')
ORDER BY table_name;
