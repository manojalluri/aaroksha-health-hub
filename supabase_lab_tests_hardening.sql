
-- LAB TESTS & COMBOS HARDENING
-- This script ensures tests have status management and correct partner mapping.

-- 1. Hardening lab_tests table
ALTER TABLE lab_tests 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'hold', 'deleted')),
  ALTER COLUMN partner_id SET NOT NULL;

-- 2. Hardening lab_combos table
ALTER TABLE lab_combos
  ADD COLUMN IF NOT EXISTS partner_id TEXT REFERENCES partners(partner_id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'hold', 'deleted'));

-- 3. Data Migration (Optional: Assign orphans if needed, though we already did lab_tests)
UPDATE lab_tests SET status = 'active' WHERE status IS NULL;
UPDATE lab_combos SET status = 'active' WHERE status IS NULL;

-- 4. Audit Log
INSERT INTO audit_logs (action, entity_type, details)
VALUES ('SCHEMA_UPGRADE', 'lab_tests', '{"msg": "Status management and partner isolation added to tests and combos."}');
