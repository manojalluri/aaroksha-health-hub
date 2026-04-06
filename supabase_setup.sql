-- ─────────────────────────────────────────────────────────────────────────────
-- AAROKSHA HEALTH HUB: FULLY SYNCED FRONTEND SCHEMA
-- ─────────────────────────────────────────────────────────────────────────────
-- 0. CLEAR PREVIOUS SCHEMA (WARNING: Destructive if you have data!)
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS payouts CASCADE;
DROP TABLE IF EXISTS prescriptions CASCADE;
DROP TABLE IF EXISTS medicines CASCADE;
DROP TABLE IF EXISTS lab_bookings CASCADE;
DROP TABLE IF EXISTS lab_tests CASCADE;
DROP TABLE IF EXISTS lab_technicians CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS doctors CASCADE;
DROP TABLE IF EXISTS partners CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS platform_settings CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ENUMS (Custom Types)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE partner_type AS ENUM ('hospital', 'lab', 'pharmacy');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE commission_type AS ENUM ('percentage', 'fixed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CORE TABLES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_settings (
  id integer PRIMARY KEY DEFAULT 1,
  opd_fee numeric DEFAULT 29,
  lab_fee numeric DEFAULT 49,
  pharmacy_fee numeric DEFAULT 19,
  priority_surcharge numeric DEFAULT 250,
  cgst numeric DEFAULT 9,
  sgst numeric DEFAULT 9,
  upi_active boolean DEFAULT true,
  cod_active boolean DEFAULT true,
  maintenance_mode boolean DEFAULT false,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name text,
  email text UNIQUE,
  phone text,
  role text DEFAULT 'patient',
  is_suspended boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id text UNIQUE NOT NULL,
  name text NOT NULL,
  type partner_type NOT NULL,
  email text NOT NULL,
  phone text,
  address text,
  commission_type commission_type DEFAULT 'percentage',
  commission_rate numeric NOT NULL,
  status text DEFAULT 'active',
  created_at timestamp with time zone DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. HOSPITAL MODULE TABLES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id text REFERENCES partners(partner_id) ON DELETE CASCADE, 
  partner_id text REFERENCES partners(partner_id) ON DELETE CASCADE, 
  name text NOT NULL,
  specialty text NOT NULL,
  experience_years integer,
  consultationFee numeric,       -- Matched exactly to React Mock Data
  consultation_fee numeric,      -- Backup
  imgUrl text,                   -- Matched exactly to Doctor UI
  image_url text,                -- Backup
  slots jsonb DEFAULT '[]'::jsonb, 
  isAvailable boolean DEFAULT true,
  is_available boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text UNIQUE,          -- Short human-readable ID e.g. OPD-A3F7K2
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  hospital_partner_id text REFERENCES partners(partner_id) ON DELETE CASCADE, -- Exact match required by HospitalDashboard
  partner_id text REFERENCES partners(partner_id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES doctors(id) ON DELETE CASCADE,
  doctor_name text,              -- Exact match
  patient_name text NOT NULL,    -- Exact match
  patient_phone text,            -- Exact match
  patient_age integer,           -- Exact match
  patient_gender text,           -- Exact match
  appointment_date text NOT NULL,-- Stored as string to avoid TZ issues
  appointment_time text NOT NULL,-- Exact match
  is_priority boolean DEFAULT false,
  fee numeric,                   -- Exact match required by HospitalDashboard
  consultation_fee numeric,      -- Exact match required by SuperAdminDashboard
  platform_fee numeric NOT NULL DEFAULT 29,
  status text DEFAULT 'pending', 
  payment_status text DEFAULT 'pending',
  payment_mode text,
  booked_at timestamp with time zone DEFAULT now(), -- Exact match required by UI
  created_at timestamp with time zone DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. DIAGNOSTIC LAB MODULE TABLES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lab_technicians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id text REFERENCES partners(partner_id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  specialization text,
  status text DEFAULT 'active',
  slots jsonb DEFAULT '[]'::jsonb,
  is_available boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lab_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id text REFERENCES partners(partner_id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  turnaround text,
  description text,
  price numeric NOT NULL,
  is_available boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lab_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text UNIQUE,          -- Short human-readable ID e.g. LAB-B9MX4P
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  partner_id text REFERENCES partners(partner_id) ON DELETE CASCADE,
  patient_name text NOT NULL,
  patient_phone text,
  patient_address text,
  age integer,
  gender text,
  collection_date text NOT NULL,  -- Text formatted date
  collection_time text NOT NULL,
  tests jsonb NOT NULL,           -- Direct array of {name, price}
  technician text,                -- Exact match
  technician_id uuid REFERENCES lab_technicians(id) ON DELETE SET NULL,
  total_amount numeric NOT NULL,
  platform_fee numeric NOT NULL DEFAULT 49,
  status text DEFAULT 'pending',
  payment_status text DEFAULT 'pending',
  payment_mode text,
  result_document_url text, 
  created_at timestamp with time zone DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. PHARMACY MODULE TABLES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id text REFERENCES partners(partner_id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  manufacturer text,
  price numeric NOT NULL,
  stock_quantity integer DEFAULT 0,
  requires_prescription boolean DEFAULT false,
  is_available boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text UNIQUE,          -- Short human-readable ID e.g. MED-C2ZR8W
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  partner_id text REFERENCES partners(partner_id) ON DELETE CASCADE,
  patient_name text NOT NULL,
  patient_phone text,
  delivery_address text NOT NULL,
  image_url text,                 -- Prescription image upload URL
  medicines jsonb DEFAULT '[]'::jsonb, -- Array of {name, dosage, qty, price, available}
  sub_total numeric DEFAULT 0,
  platform_fee numeric NOT NULL DEFAULT 19,
  delivery_fee numeric DEFAULT 40,
  grand_total numeric DEFAULT 0,
  admin_note text,
  is_express_delivery boolean DEFAULT false,
  status text DEFAULT 'pending', 
  payment_status text DEFAULT 'pending',
  payment_mode text,
  created_at timestamp with time zone DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. FINANCE & METRICS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id text REFERENCES partners(partner_id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  reference_no text,
  payout_date date DEFAULT CURRENT_DATE,
  status text DEFAULT 'completed',
  created_at timestamp with time zone DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. STORAGE BUCKETS (PRESCRIPTIONS & IMAGES)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES ('prescriptions', 'prescriptions', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('doctor_profiles', 'doctor_profiles', true) ON CONFLICT DO NOTHING;

-- Storage RLS Rules
DROP POLICY IF EXISTS "Public Access To Prescription Image" ON storage.objects;
CREATE POLICY "Public Access To Prescription Image" ON storage.objects FOR SELECT USING (bucket_id = 'prescriptions');

DROP POLICY IF EXISTS "Users Can Upload Prescriptions" ON storage.objects;
CREATE POLICY "Users Can Upload Prescriptions" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'prescriptions' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public Access To Doctor Profile Image" ON storage.objects;
CREATE POLICY "Public Access To Doctor Profile Image" ON storage.objects FOR SELECT USING (bucket_id = 'doctor_profiles');

DROP POLICY IF EXISTS "Admins Can Upload Doctor Profiles" ON storage.objects;
CREATE POLICY "Admins Can Upload Doctor Profiles" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'doctor_profiles' AND auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. TRIGGERS (Auto-sync auth.users to profiles)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, role)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'Unknown User'),
    COALESCE(new.raw_user_meta_data->>'phone_number', ''),
    COALESCE(new.raw_user_meta_data->>'role', 'patient')
  );
  RETURN new;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Postgres trigger exception: %', SQLERRM;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Default Row
INSERT INTO platform_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
