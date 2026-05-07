-- Add collection_code to lab_bookings for verifying home sample collection
ALTER TABLE public.lab_bookings
  ADD COLUMN IF NOT EXISTS collection_code TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_lab_bookings_collection_code
  ON public.lab_bookings (collection_code)
  WHERE collection_code IS NOT NULL;
