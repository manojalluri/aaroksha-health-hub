-- Add patient_town column to appointments table
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS patient_town TEXT DEFAULT '';

-- Comments to describe purpose
COMMENT ON COLUMN public.appointments.patient_town IS 'Store the patient town or village name';
COMMENT ON COLUMN public.appointments.notes IS 'Used for storing patient symptoms/disease information';
