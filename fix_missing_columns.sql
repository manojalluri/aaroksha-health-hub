-- ═══════════════════════════════════════════════════════════════════════════════
-- AAROKSHA — COMPREHENSIVE DATABASE SCHEMA FIX
-- Run in: Supabase → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. DOCTORS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.doctors
  DROP CONSTRAINT IF EXISTS doctors_hospital_id_fkey,
  DROP CONSTRAINT IF EXISTS doctors_partner_id_fkey;

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS time_slots   TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS advance_days INTEGER DEFAULT 7,
  ADD COLUMN IF NOT EXISTS holidays     TEXT[]  DEFAULT '{}';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. APPOINTMENTS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check,
  DROP CONSTRAINT IF EXISTS appointments_payment_status_check,
  DROP CONSTRAINT IF EXISTS appointments_payment_method_check,
  DROP CONSTRAINT IF EXISTS appointments_doctor_id_fkey;

ALTER TABLE public.appointments
  ALTER COLUMN doctor_id TYPE TEXT,
  ADD COLUMN IF NOT EXISTS order_id             TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS doctor_name          TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS patient_name         TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS patient_phone        TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS patient_email        TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS patient_age          TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS patient_gender       TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS patient_town         TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS notes                TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS appointment_date     TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS appointment_time     TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS status               TEXT    DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_status       TEXT    DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_method       TEXT    DEFAULT 'cod',
  ADD COLUMN IF NOT EXISTS platform_fee         INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consultation_fee     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee                  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_priority          BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS hospital_partner_id  TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS partner_id           TEXT    DEFAULT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. LAB BOOKINGS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.lab_bookings
  DROP CONSTRAINT IF EXISTS lab_bookings_status_check,
  DROP CONSTRAINT IF EXISTS lab_bookings_payment_status_check;

ALTER TABLE public.lab_bookings
  ADD COLUMN IF NOT EXISTS order_id         TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS patient_name     TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS patient_phone    TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS patient_age      TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS patient_address  TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS patient_gender   TEXT    DEFAULT 'Other',
  ADD COLUMN IF NOT EXISTS tests            JSONB   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS platform_fee     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS collection_date  TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS collection_time  TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS status           TEXT    DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_status   TEXT    DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS technician       TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS partner_id       TEXT    DEFAULT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. PRESCRIPTIONS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.prescriptions
  DROP CONSTRAINT IF EXISTS prescriptions_status_check,
  DROP CONSTRAINT IF EXISTS prescriptions_payment_status_check;

ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS order_id             TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS patient_name         TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS patient_phone        TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS delivery_address     TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS image_url            TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS prescriptions        JSONB   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS medicines            JSONB   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS status               TEXT    DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_status        TEXT    DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS is_auto_confirm      BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_express_delivery  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_code        TEXT    DEFAULT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. PARTNERS & PROFILES
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS logo_url         TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS settlement_cycle TEXT DEFAULT 'monthly';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS town    TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS pincode TEXT DEFAULT '';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. PLATFORM SETTINGS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS upi_id TEXT DEFAULT '';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. REFRESH SCHEMA
-- ─────────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

SELECT 'SUCCESS: All database errors fixed!' as status;
