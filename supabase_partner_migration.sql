-- SQL Migration for Partner Management System
-- Run this in the Supabase SQL Editor

-- 1. Add missing columns to partners table
ALTER TABLE partners ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Update status column to support hold and deleted
-- This fixes the "violates check constraint partners_status_check" error
ALTER TABLE partners DROP CONSTRAINT IF EXISTS partners_status_check;
ALTER TABLE partners ADD CONSTRAINT partners_status_check CHECK (status IN ('active', 'hold', 'deleted', 'inactive'));

-- 3. Audit Logs Table for Enterprise Tracking
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id TEXT, -- partner_id or 'super_admin'
    action TEXT NOT NULL, -- e.g., 'PARTNER_CREATED', 'STATUS_CHANGE', 'HARD_DELETE'
    entity_type TEXT NOT NULL, -- e.g., 'partner', 'order', 'doctor'
    entity_id TEXT, -- The ID of the affected entity
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only authenticated admins can read/write logs (via service role or specific policies)
-- For now, allow Super Admin (via user_metadata) or Partner Auth
CREATE POLICY "Super Admins can see all logs" ON audit_logs 
    FOR SELECT USING (auth.jwt() -> 'user_metadata' ->> 'role' = 'super');

-- 4. Ensure foreign keys for better data integrity
ALTER TABLE doctors DROP CONSTRAINT IF EXISTS doctors_partner_id_fkey;
ALTER TABLE doctors ADD CONSTRAINT doctors_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES partners(partner_id) ON DELETE SET NULL;

ALTER TABLE lab_tests DROP CONSTRAINT IF EXISTS lab_tests_partner_id_fkey;
ALTER TABLE lab_tests ADD CONSTRAINT lab_tests_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES partners(partner_id) ON DELETE SET NULL;
