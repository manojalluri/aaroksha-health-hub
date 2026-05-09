-- Fix RLS for partners table
DROP POLICY IF EXISTS "partners_update" ON public.partners;
CREATE POLICY "partners_update"
  ON public.partners FOR UPDATE
  USING (true);

-- Fix RLS for doctors table
DROP POLICY IF EXISTS "Admin Manage Doctors" ON public.doctors;
CREATE POLICY "Admin Manage Doctors" 
  ON public.doctors FOR ALL USING (true) WITH CHECK (true);

-- Fix RLS for appointments table
DROP POLICY IF EXISTS "Admins view all appointments" ON public.appointments;
CREATE POLICY "Admins view all appointments"
  ON public.appointments FOR ALL USING (true) WITH CHECK (true);

-- Fix Storage Policies
DROP POLICY IF EXISTS "Admins Can Upload Doctor Profiles" ON storage.objects;
CREATE POLICY "Admins Can Upload Doctor Profiles" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'doctor_profiles');

DROP POLICY IF EXISTS "Admins Can Update Doctor Profiles" ON storage.objects;
CREATE POLICY "Admins Can Update Doctor Profiles" ON storage.objects
  FOR UPDATE USING (bucket_id = 'doctor_profiles');

DROP POLICY IF EXISTS "Admins Can Delete Doctor Profiles" ON storage.objects;
CREATE POLICY "Admins Can Delete Doctor Profiles" ON storage.objects
  FOR DELETE USING (bucket_id = 'doctor_profiles');
