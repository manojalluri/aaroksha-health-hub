-- ═══════════════════════════════════════════════════════════════════════════════
-- AAROKSHA HEALTH HUB — COMPLETE MASTER DATABASE SETUP (CLEAN INSTALL)
-- Run this in: Supabase → SQL Editor → New Query → Run All
-- This drops all existing tables and recreates everything from scratch.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: DROP ALL EXISTING TABLES (clean slate)
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.admin_sessions    CASCADE;
DROP TABLE IF EXISTS public.prescriptions     CASCADE;
DROP TABLE IF EXISTS public.lab_bookings      CASCADE;
DROP TABLE IF EXISTS public.lab_tests         CASCADE;
DROP TABLE IF EXISTS public.appointments      CASCADE;
DROP TABLE IF EXISTS public.doctors           CASCADE;
DROP TABLE IF EXISTS public.profiles          CASCADE;
DROP TABLE IF EXISTS public.platform_banners  CASCADE;
DROP TABLE IF EXISTS public.platform_settings CASCADE;
DROP TABLE IF EXISTS public.partners          CASCADE;

-- Drop old functions / triggers
DROP FUNCTION IF EXISTS public.handle_new_user()  CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at()   CASCADE;
DROP FUNCTION IF EXISTS public.sync_partner_ids() CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: PARTNERS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.partners (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id       TEXT        UNIQUE NOT NULL,
  name             TEXT        NOT NULL,
  type             TEXT        NOT NULL
                     CHECK (type IN ('hospital','lab','pharmacy','logistics')),
  email            TEXT        NOT NULL UNIQUE,
  password         TEXT,
  phone            TEXT,
  address          TEXT,
  logo_url         TEXT        DEFAULT NULL,
  commission_type  TEXT        DEFAULT 'percentage'
                     CHECK (commission_type IN ('percentage','fixed')),
  commission_rate  NUMERIC     DEFAULT 10,
  settlement_cycle TEXT        DEFAULT 'monthly'
                     CHECK (settlement_cycle IN ('today','daily','weekly','monthly')),
  status           TEXT        DEFAULT 'active'
                     CHECK (status IN ('active','inactive','suspended')),
  created_at       TIMESTAMPTZ DEFAULT now()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: ADMIN SESSIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.admin_sessions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token      UUID        NOT NULL UNIQUE,
  partner_id TEXT        NOT NULL,
  role       TEXT        NOT NULL
               CHECK (role IN ('hospital','lab','pharmacy','logistics')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: PROFILES (auto-populated on signup)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    TEXT        DEFAULT '',
  email        TEXT        DEFAULT '',
  phone        TEXT        DEFAULT '',
  role         TEXT        DEFAULT 'patient',
  is_suspended BOOLEAN     DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
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


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: DOCTORS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.doctors (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  specialty     TEXT        NOT NULL,
  qualification TEXT        DEFAULT '',
  experience    INTEGER     DEFAULT 0,
  rating        NUMERIC     DEFAULT 4.8,
  fee           NUMERIC     DEFAULT 500,
  image         TEXT        DEFAULT '👨‍⚕️',
  image_url     TEXT,
  available     BOOLEAN     DEFAULT true,
  phone         TEXT        DEFAULT '',
  hospital_name TEXT        DEFAULT '',
  languages     TEXT        DEFAULT 'Telugu, English',
  time_slots    TEXT[]      DEFAULT '{}',
  advance_days  INTEGER     DEFAULT 7,
  holidays      TEXT[]      DEFAULT '{}',
  hospital_id   TEXT,
  partner_id    TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6: APPOINTMENTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.appointments (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            TEXT        UNIQUE,
  user_id             UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  patient_name        TEXT        NOT NULL,
  patient_phone       TEXT        NOT NULL,
  patient_email       TEXT        DEFAULT '',
  patient_address     TEXT        DEFAULT '',
  patient_age         TEXT        DEFAULT '',
  patient_gender      TEXT        DEFAULT '',
  patient_town        TEXT        DEFAULT '',
  doctor_id           UUID        REFERENCES public.doctors(id) ON DELETE SET NULL,
  doctor_name         TEXT        DEFAULT '',
  doctor_specialty    TEXT        DEFAULT '',
  appointment_date    TEXT        DEFAULT '',
  appointment_time    TEXT        DEFAULT '',
  status              TEXT        DEFAULT 'pending'
                        CHECK (status IN ('pending','confirmed','completed','cancelled','no_show')),
  payment_status      TEXT        DEFAULT 'pending'
                        CHECK (payment_status IN ('pending','paid','failed','refunded')),
  payment_id          TEXT,
  fee                 NUMERIC     DEFAULT 0,
  consultation_fee    NUMERIC     DEFAULT 0,
  platform_fee        NUMERIC     DEFAULT 29,
  is_priority         BOOLEAN     DEFAULT false,
  notes               TEXT        DEFAULT '',
  hospital_partner_id TEXT        REFERENCES public.partners(partner_id) ON DELETE SET NULL,
  partner_id          TEXT        REFERENCES public.partners(partner_id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT now()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 7: LAB TESTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.lab_tests (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  category    TEXT        NOT NULL,
  price       NUMERIC     NOT NULL DEFAULT 0,
  description TEXT        DEFAULT '',
  turnaround  TEXT        DEFAULT '24 hours',
  partner_id  TEXT        REFERENCES public.partners(partner_id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 8: LAB BOOKINGS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.lab_bookings (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        TEXT        UNIQUE,
  user_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  patient_name    TEXT        NOT NULL,
  patient_phone   TEXT        NOT NULL,
  patient_email   TEXT        DEFAULT '',
  patient_address TEXT        NOT NULL DEFAULT '',
  age             TEXT        DEFAULT '',
  gender          TEXT        DEFAULT '',
  collection_date TEXT        DEFAULT '',
  collection_time TEXT        DEFAULT '',
  tests           JSONB       DEFAULT '[]',
  total_amount    NUMERIC     DEFAULT 0,
  platform_fee    NUMERIC     DEFAULT 49,
  status          TEXT        DEFAULT 'pending'
                    CHECK (status IN ('pending','confirmed','collected','processing','completed','cancelled')),
  payment_status  TEXT        DEFAULT 'pending'
                    CHECK (payment_status IN ('pending','paid','failed','refunded')),
  payment_id      TEXT,
  technician      TEXT        DEFAULT '',
  partner_id      TEXT        REFERENCES public.partners(partner_id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 9: PRESCRIPTIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.prescriptions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            TEXT        UNIQUE,
  user_id             UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  patient_name        TEXT        NOT NULL,
  patient_phone       TEXT        NOT NULL,
  patient_email       TEXT        DEFAULT '',
  delivery_address    TEXT        NOT NULL DEFAULT '',
  prescriptions       TEXT[]      DEFAULT '{}',
  medicines           JSONB       DEFAULT '[]',
  status              TEXT        DEFAULT 'pending'
                        CHECK (status IN ('pending','reviewed','dispatched','completed','rejected')),
  sub_total           NUMERIC     DEFAULT 0,
  platform_fee        NUMERIC     DEFAULT 19,
  delivery_fee        NUMERIC     DEFAULT 40,
  grand_total         NUMERIC     DEFAULT 0,
  admin_note          TEXT        DEFAULT '',
  payment_status      TEXT        DEFAULT 'pending'
                        CHECK (payment_status IN ('pending','paid','failed','refunded')),
  payment_id          TEXT,
  delivery_code       TEXT,
  is_express_delivery BOOLEAN     DEFAULT false,
  assigned_partner_id TEXT        REFERENCES public.partners(partner_id) ON DELETE SET NULL,
  partner_id          TEXT        REFERENCES public.partners(partner_id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prescriptions_updated_at
  BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 10: PLATFORM SETTINGS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.platform_settings (
  id                 TEXT        PRIMARY KEY DEFAULT 'global',
  platform_name      TEXT        DEFAULT 'Aaroksha Health Hub',
  support_phone      TEXT        DEFAULT '+91 9000000000',
  support_email      TEXT        DEFAULT 'support@aaroksha.com',
  opd_fee            NUMERIC     DEFAULT 29,
  lab_fee            NUMERIC     DEFAULT 49,
  pharmacy_fee       NUMERIC     DEFAULT 19,
  priority_surcharge NUMERIC     DEFAULT 250,
  is_maintenance     BOOLEAN     DEFAULT false,
  updated_at         TIMESTAMPTZ DEFAULT now()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 11: PLATFORM BANNERS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.platform_banners (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT        NOT NULL,
  subtitle   TEXT        DEFAULT '',
  image_url  TEXT,
  link_to    TEXT        DEFAULT '/',
  cta_text   TEXT        DEFAULT 'Learn More',
  gradient   TEXT        DEFAULT 'linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)',
  cta_color  TEXT        DEFAULT '#2563eb',
  emoji      TEXT        DEFAULT '✨',
  badge_text TEXT        DEFAULT 'New',
  is_active  BOOLEAN     DEFAULT true,
  sort_order INTEGER     DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 12: SYNC TRIGGER (keeps hospital_id ↔ partner_id in sync)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_partner_ids()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'doctors' THEN
    IF NEW.hospital_id IS NULL THEN NEW.hospital_id := NEW.partner_id; END IF;
    IF NEW.partner_id  IS NULL THEN NEW.partner_id  := NEW.hospital_id; END IF;
  ELSIF TG_TABLE_NAME = 'appointments' THEN
    IF NEW.hospital_partner_id IS NULL THEN NEW.hospital_partner_id := NEW.partner_id; END IF;
    IF NEW.partner_id IS NULL THEN NEW.partner_id := NEW.hospital_partner_id; END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_doctor_ids
  BEFORE INSERT OR UPDATE ON public.doctors
  FOR EACH ROW EXECUTE PROCEDURE public.sync_partner_ids();

CREATE TRIGGER trg_sync_apt_ids
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE PROCEDURE public.sync_partner_ids();


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 13: DISABLE RLS (app-layer auth handles security)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.partners          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_tests         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_bookings      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_banners  DISABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 14: INDEXES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX idx_partners_type            ON public.partners (type);
CREATE INDEX idx_partners_status          ON public.partners (status);
CREATE INDEX idx_admin_sessions_token     ON public.admin_sessions (token);
CREATE INDEX idx_admin_sessions_expires   ON public.admin_sessions (expires_at);
CREATE INDEX idx_doctors_available        ON public.doctors (available);
CREATE INDEX idx_doctors_specialty        ON public.doctors (specialty);
CREATE INDEX idx_doctors_partner          ON public.doctors (partner_id);
CREATE INDEX idx_appointments_phone       ON public.appointments (patient_phone);
CREATE INDEX idx_appointments_status      ON public.appointments (status);
CREATE INDEX idx_appointments_partner     ON public.appointments (hospital_partner_id);
CREATE INDEX idx_appointments_user        ON public.appointments (user_id);
CREATE INDEX idx_lab_bookings_phone       ON public.lab_bookings (patient_phone);
CREATE INDEX idx_lab_bookings_status      ON public.lab_bookings (status);
CREATE INDEX idx_lab_bookings_partner     ON public.lab_bookings (partner_id);
CREATE INDEX idx_lab_bookings_user        ON public.lab_bookings (user_id);
CREATE INDEX idx_prescriptions_phone      ON public.prescriptions (patient_phone);
CREATE INDEX idx_prescriptions_status     ON public.prescriptions (status);
CREATE INDEX idx_prescriptions_partner    ON public.prescriptions (partner_id);
CREATE INDEX idx_prescriptions_delcode    ON public.prescriptions (delivery_code);
CREATE INDEX idx_prescriptions_payment    ON public.prescriptions (payment_status);


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 15: REALTIME
-- Skipped — your supabase_realtime publication is already set to FOR ALL TABLES,
-- which means every table is automatically included in realtime. No action needed.
-- ─────────────────────────────────────────────────────────────────────────────



-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 16: STORAGE BUCKETS (policies set via Dashboard — not SQL)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('prescriptions',   'prescriptions',   true),
  ('doctor_profiles', 'doctor_profiles', true),
  ('banners',         'banners',         true)
ON CONFLICT (id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 17: SEED — PLATFORM SETTINGS
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.platform_settings
  (id, platform_name, support_phone, support_email, opd_fee, lab_fee, pharmacy_fee, priority_surcharge, is_maintenance)
VALUES
  ('global', 'Aaroksha Health Hub', '+91 9000000000', 'support@aaroksha.com', 29, 49, 19, 250, false);


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 18: SEED — BANNERS
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.platform_banners (id, title, subtitle, link_to, cta_text, gradient, cta_color, emoji, badge_text, is_active, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Book a Doctor in 60 Seconds',      'Consult top specialists from home',         '/doctors',      'Book Now',  'linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)', '#2563eb', '👨‍⚕️', '500+ Doctors',     true, 1),
  ('00000000-0000-0000-0000-000000000002', 'Home Lab Tests At Your Door',       'NABL certified labs, reports in 6 hrs',     '/lab-tests',    'Book Test', 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)', '#7c3aed', '🔬',    '50+ Tests',        true, 2),
  ('00000000-0000-0000-0000-000000000003', 'Medicine From Your Prescription',   'Upload & get delivered same day',           '/prescription', 'Order Now', 'linear-gradient(135deg, #059669 0%, #34d399 100%)', '#059669', '💊',    'Express Available',true, 3);


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 19: SEED — PARTNERS (demo login accounts)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.partners (partner_id, name, type, email, password, phone, address, commission_type, commission_rate, status)
VALUES
  ('HOSPITAL_AAROKSHA001', 'Aaroksha Multi-Specialty Hospital', 'hospital',  'hospital@aaroksha.com',  'Hospital@123',  '+91 9000000001', 'Bhimavaram, Andhra Pradesh', 'percentage', 15, 'active'),
  ('LAB_AAROKSHA001',      'Aaroksha Diagnostics Center',       'lab',       'lab@aaroksha.com',       'Lab@123',       '+91 9000000002', 'Bhimavaram, Andhra Pradesh', 'percentage', 12, 'active'),
  ('PHARMA_AAROKSHA001',   'Aaroksha Pharmacy',                 'pharmacy',  'pharmacy@aaroksha.com',  'Pharmacy@123',  '+91 9000000003', 'Bhimavaram, Andhra Pradesh', 'fixed',       50, 'active'),
  ('LOGISTICS_AAROK001',   'Aaroksha Logistics',                'logistics', 'logistics@aaroksha.com', 'Logistics@123', '+91 9000000004', 'Bhimavaram, Andhra Pradesh', 'fixed',       30, 'active');


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 20: SEED — LAB TESTS
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.lab_tests (name, category, price, description, turnaround)
VALUES
  ('Complete Blood Count (CBC)',      'Blood',     350,   'Measures RBCs, WBCs, hemoglobin, and platelets',              '6 hours'),
  ('Thyroid Profile (T3, T4, TSH)',  'Hormone',   650,   'Evaluates thyroid gland function',                            '12 hours'),
  ('Lipid Profile',                  'Blood',     500,   'Checks cholesterol, HDL, LDL, and triglycerides',             '8 hours'),
  ('Blood Sugar Fasting',            'Diabetes',  150,   'Measures glucose after 8+ hours fasting',                     '4 hours'),
  ('Blood Sugar PP',                 'Diabetes',  150,   'Measures glucose 2 hours after a meal',                       '4 hours'),
  ('HbA1c',                          'Diabetes',  550,   '3-month average blood sugar indicator',                       '12 hours'),
  ('Vitamin D (25-OH)',               'Vitamin',   800,   'Checks Vitamin D3 levels in blood',                           '24 hours'),
  ('Vitamin B12',                    'Vitamin',   450,   'Checks B12 deficiency for nerve health',                      '24 hours'),
  ('Iron Studies',                   'Blood',     650,   'Serum iron, TIBC and ferritin',                               '12 hours'),
  ('Kidney Function Test (KFT)',     'Organ',     600,   'Checks creatinine, urea, uric acid',                          '8 hours'),
  ('Liver Function Test (LFT)',      'Organ',     700,   'Checks bilirubin, SGPT, SGOT, ALP',                           '8 hours'),
  ('Urine Routine & Microscopy',     'Urine',     150,   'Complete urine analysis',                                     '3 hours'),
  ('Comprehensive Metabolic Panel',  'Blood',     2500,  'Full metabolic screen',                                       '24 hours'),
  ('Dengue NS1 Antigen',             'Infection', 700,   'Early detection of dengue fever',                             '6 hours'),
  ('Malaria Antigen (RDT)',          'Infection', 350,   'Rapid detection of Plasmodium parasites',                     '2 hours'),
  ('COVID-19 Antigen (RAT)',         'Infection', 500,   'Rapid antigen test for SARS-CoV-2',                           '1 hour'),
  ('Calcium (Serum)',                'Mineral',   250,   'Checks calcium levels',                                       '6 hours'),
  ('Electrolytes (Na, K, Cl)',       'Mineral',   400,   'Sodium, potassium, chloride panel',                           '6 hours');


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 21: SEED — DOCTORS
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.doctors (name, specialty, qualification, experience, rating, fee, image, available, hospital_name, partner_id, hospital_id, languages)
VALUES
  ('Dr. Ramesh Babu',    'Cardiologist',       'MBBS, DM (Cardiology)',      18, 4.9, 800, '❤️', true, 'Aaroksha Hospital', 'HOSPITAL_AAROKSHA001', 'HOSPITAL_AAROKSHA001', 'Telugu, English'),
  ('Dr. Priya Sharma',   'Gynecologist',       'MBBS, MS (Obs & Gynae)',     12, 4.8, 700, '👩‍⚕️', true, 'Aaroksha Hospital', 'HOSPITAL_AAROKSHA001', 'HOSPITAL_AAROKSHA001', 'Telugu, Hindi, English'),
  ('Dr. Suresh Kumar',   'Orthopedic Surgeon', 'MBBS, MS (Ortho)',           15, 4.7, 750, '🦴', true, 'Aaroksha Hospital', 'HOSPITAL_AAROKSHA001', 'HOSPITAL_AAROKSHA001', 'Telugu, English'),
  ('Dr. Ananya Reddy',   'Dermatologist',      'MBBS, DVD',                   8, 4.8, 600, '✨', true, 'Aaroksha Hospital', 'HOSPITAL_AAROKSHA001', 'HOSPITAL_AAROKSHA001', 'Telugu, English'),
  ('Dr. Vikram Nair',    'Neurologist',        'MBBS, DM (Neurology)',       20, 4.9, 900, '🧠', true, 'Aaroksha Hospital', 'HOSPITAL_AAROKSHA001', 'HOSPITAL_AAROKSHA001', 'Telugu, Malayalam, English'),
  ('Dr. Meena Devi',     'Pediatrician',       'MBBS, DCH',                  10, 4.8, 550, '👶', true, 'Aaroksha Hospital', 'HOSPITAL_AAROKSHA001', 'HOSPITAL_AAROKSHA001', 'Telugu, Hindi'),
  ('Dr. Arun Srinivas',  'General Physician',  'MBBS, MD (General Medicine)', 7, 4.6, 400, '🩺', true, 'Aaroksha Hospital', 'HOSPITAL_AAROKSHA001', 'HOSPITAL_AAROKSHA001', 'Telugu, English'),
  ('Dr. Lakshmi Patel',  'Endocrinologist',    'MBBS, DM (Endocrinology)',   14, 4.7, 700, '🩸', true, 'Aaroksha Hospital', 'HOSPITAL_AAROKSHA001', 'HOSPITAL_AAROKSHA001', 'Telugu, English'),
  ('Dr. Ravi Shankar',   'Ophthalmologist',    'MBBS, MS (Ophthalmology)',   11, 4.8, 600, '👁', true, 'Aaroksha Hospital', 'HOSPITAL_AAROKSHA001', 'HOSPITAL_AAROKSHA001', 'Telugu, English'),
  ('Dr. Divya Krishnan', 'ENT Specialist',     'MBBS, MS (ENT)',               9, 4.7, 550, '👂', true, 'Aaroksha Hospital', 'HOSPITAL_AAROKSHA001', 'HOSPITAL_AAROKSHA001', 'Telugu, Tamil, English');


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 22: RELOAD SCHEMA
-- ─────────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';


-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICATION — you should see 10 rows, all with column counts > 0
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  table_name,
  COUNT(column_name) AS columns
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'partners','admin_sessions','profiles',
    'doctors','appointments',
    'lab_tests','lab_bookings','prescriptions',
    'platform_settings','platform_banners'
  )
GROUP BY table_name
ORDER BY table_name;
