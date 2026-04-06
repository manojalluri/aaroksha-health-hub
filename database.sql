-- Doctors Table
CREATE TABLE public.doctors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  experience INTEGER,
  hospital_name TEXT,
  languages TEXT,
  rating DECIMAL(2,1),
  fee INTEGER,
  image_url TEXT,
  available BOOLEAN DEFAULT true,
  partner_id UUID, -- For multi-partner support
  time_slots JSONB DEFAULT '["09:00 AM", "10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM", "04:00 PM"]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Lab Tests Table
CREATE TABLE public.lab_tests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,
  category TEXT,
  turnaround TEXT,
  partner_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Appointments Table
CREATE TABLE public.appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID REFERENCES public.doctors(id),
  patient_name TEXT NOT NULL,
  patient_phone TEXT NOT NULL,
  patient_email TEXT,
  appointment_date DATE NOT NULL,
  appointment_time TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, confirmed, cancelled, completed
  payment_status TEXT DEFAULT 'pending', -- pending, paid, failed
  payment_id TEXT,
  consultation_fee INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Lab Test Bookings Table
CREATE TABLE public.lab_bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_name TEXT NOT NULL,
  patient_phone TEXT NOT NULL,
  patient_email TEXT,
  patient_address TEXT,
  tests JSONB NOT NULL, -- Array of test items
  total_amount INTEGER NOT NULL,
  collection_date DATE NOT NULL,
  collection_time TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, in_transit, completed, cancelled
  payment_status TEXT DEFAULT 'pending',
  partner_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Prescription Uploads Table
CREATE TABLE public.prescriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_name TEXT,
  patient_phone TEXT NOT NULL,
  delivery_address TEXT,
  image_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, reviewed, dispatched, completed, rejected
  admin_note TEXT,
  medicines JSONB, -- Array of medicine objects [{name, dosage, price, available: boolean}]
  sub_total INTEGER DEFAULT 0,
  platform_fee INTEGER DEFAULT 0,
  delivery_fee INTEGER DEFAULT 40,
  grand_total INTEGER DEFAULT 0,
  payment_status TEXT DEFAULT 'pending',
  partner_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Global Settings Table
CREATE TABLE public.settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  platform_charge INTEGER DEFAULT 40, -- fixed fee in INR
  lab_commission INTEGER DEFAULT 10,  -- percentage
  doctor_commission INTEGER DEFAULT 15, -- percentage
  website_active BOOLEAN DEFAULT true,
  maintenance_message TEXT DEFAULT 'The website is undergoing scheduled maintenance.',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Partners Table (Optional but tracked in dashbaords)
CREATE TABLE public.partners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- hospital, lab, pharmacy
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Initial Data - Settings
INSERT INTO public.settings (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;

-- Initial Data - Doctors
INSERT INTO public.doctors (name, specialty, experience, hospital_name, languages, rating, fee, image_url, available) VALUES
('Dr. Rajesh Kumar', 'General Physician', 15, 'Aaroksha Health Center', 'English, Hindi', 4.8, 500, '👨‍⚕️', true),
('Dr. Priya Sharma', 'Cardiologist', 12, 'Heart Institute', 'English, Hindi', 4.9, 800, '👩‍⚕️', true),
('Dr. Anil Reddy', 'Orthopedic', 20, 'Bone & Joint Clinic', 'English, Telugu', 4.7, 700, '👨‍⚕️', true),
('Dr. Sunitha Rao', 'Dermatologist', 8, 'Skin & Hair Clinic', 'English, Hindi, Telugu', 4.6, 600, '👩‍⚕️', true),
('Dr. Venkat Rao', 'Dentist', 10, 'Dental Care Center', 'English, Hindi', 4.5, 400, '👨‍⚕️', true),
('Dr. Meena Kumari', 'Pediatrician', 14, 'Children Hospital', 'English, Hindi', 4.8, 550, '👩‍⚕️', true),
('Dr. Srinivas Gupta', 'ENT Specialist', 18, 'ENT & Allergy Center', 'English, Hindi', 4.7, 650, '👨‍⚕️', true),
('Dr. Kavitha Nair', 'Gynecologist', 16, 'Womens Care Hospital', 'English, Hindi, Malayalam', 4.9, 750, '👩‍⚕️', true);

-- Initial Data - Lab Tests
INSERT INTO public.lab_tests (name, description, price, category, turnaround) VALUES
('Complete Blood Count (CBC)', 'Measures red/white blood cells, hemoglobin, and platelets', 350, 'Blood', '6 hours'),
('Thyroid Profile (T3, T4, TSH)', 'Evaluates thyroid gland function', 650, 'Hormone', '12 hours'),
('Lipid Profile', 'Checks cholesterol and triglyceride levels', 500, 'Blood', '8 hours'),
('Blood Sugar Fasting', 'Measures glucose levels after fasting', 150, 'Diabetes', '4 hours'),
('Liver Function Test (LFT)', 'Evaluates liver enzyme levels', 600, 'Organ', '10 hours'),
('Kidney Function Test (KFT)', 'Checks kidney health markers', 550, 'Organ', '10 hours'),
('Vitamin D Test', 'Measures Vitamin D levels in blood', 800, 'Vitamin', '24 hours'),
('HbA1c', '3-month average blood sugar level', 450, 'Diabetes', '6 hours'),
('Full Body Checkup', 'Comprehensive health screening package', 2500, 'Package', '48 hours'),
('Urine Routine', 'Checks for infections and kidney issues', 200, 'Urine', '4 hours');
