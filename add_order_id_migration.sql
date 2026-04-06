-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION: Unified Order ID System (Final Cleanup & Refresh)
-- Run this in the Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Ensure order_id columns exist and are unique
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS order_id text UNIQUE;
ALTER TABLE lab_bookings ADD COLUMN IF NOT EXISTS order_id text UNIQUE;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS order_id text UNIQUE;

-- 2. Clean up any stale 'booking_id' columns that might still be in the schema cache
-- This prevents the "Could not find the 'booking_id' column" error
ALTER TABLE prescriptions DROP COLUMN IF EXISTS booking_id;
ALTER TABLE appointments DROP COLUMN IF EXISTS booking_id;
ALTER TABLE lab_bookings DROP COLUMN IF EXISTS booking_id;

-- 3. Notify PostgREST to reload the schema cache immediately
-- This is CRITICAL to fix the "schema cache" error without waiting
NOTIFY pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────────────
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('appointments', 'lab_bookings', 'prescriptions')
  AND column_name = 'order_id';
