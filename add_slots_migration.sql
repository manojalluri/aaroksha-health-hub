-- Run this in Supabase → SQL Editor to add slot config columns to doctors table
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS time_slots    JSONB DEFAULT '["09:00 AM","09:30 AM","10:00 AM","10:30 AM","11:00 AM","11:30 AM","02:00 PM","02:30 PM","03:00 PM","04:00 PM","04:30 PM","05:00 PM"]',
  ADD COLUMN IF NOT EXISTS advance_days  INTEGER DEFAULT 7;

-- Update existing doctors to have default values
UPDATE public.doctors
SET
  time_slots   = '["09:00 AM","09:30 AM","10:00 AM","10:30 AM","11:00 AM","11:30 AM","02:00 PM","02:30 PM","03:00 PM","04:00 PM","04:30 PM","05:00 PM"]',
  advance_days = 7
WHERE time_slots IS NULL;

NOTIFY pgrst, 'reload schema';

SELECT id, name, advance_days, jsonb_array_length(time_slots) AS slot_count FROM public.doctors;
