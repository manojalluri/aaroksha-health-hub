
-- HARDENING PARTNER DELETION & DATA ISOLATION
-- This script ensures that when a partner is deleted or recreated, 
-- their operational data is properly isolated.

-- 1. Ensure foreign key constraints are robust
ALTER TABLE doctors 
  DROP CONSTRAINT IF EXISTS doctors_partner_id_fkey,
  ADD CONSTRAINT doctors_partner_id_fkey 
  FOREIGN KEY (partner_id) REFERENCES partners(partner_id) 
  ON DELETE CASCADE;

ALTER TABLE lab_tests 
  DROP CONSTRAINT IF EXISTS lab_tests_partner_id_fkey,
  ADD CONSTRAINT lab_tests_partner_id_fkey 
  FOREIGN KEY (partner_id) REFERENCES partners(partner_id) 
  ON DELETE CASCADE;

-- 2. Create a function to handle partner status transitions
CREATE OR REPLACE FUNCTION handle_partner_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If partner is DELETED, we should invalidate their active sessions
  IF NEW.status = 'deleted' THEN
    DELETE FROM admin_sessions WHERE partner_id = NEW.partner_id;
    
    -- Also mark their operational listings as inactive/deleted
    UPDATE doctors SET status = 'inactive' WHERE partner_id = NEW.partner_id;
    -- Note: lab_tests don't have a status, they are filtered by partner status in queries
  END IF;

  -- If partner is HOLD, we block their visibility but keep data
  IF NEW.status = 'hold' THEN
    DELETE FROM admin_sessions WHERE partner_id = NEW.partner_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach the trigger to partners table
DROP TRIGGER IF EXISTS on_partner_status_change ON partners;
CREATE TRIGGER on_partner_status_change
  AFTER UPDATE OF status ON partners
  FOR EACH ROW
  EXECUTE FUNCTION handle_partner_status_change();

-- 4. Audit Log for Deletion/Recreation
INSERT INTO audit_logs (action, entity_type, details)
VALUES ('SYSTEM_INIT', 'partners', '{"msg": "Data isolation and soft-delete hardening initialized."}');

-- 5. Helper view for ACTIVE orders (for reference)
CREATE OR REPLACE VIEW active_partner_orders AS
SELECT p.*, pt.status as partner_status
FROM prescriptions p
JOIN partners pt ON p.partner_id = pt.partner_id
WHERE pt.status = 'active';
