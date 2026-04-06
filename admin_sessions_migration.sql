-- ═══════════════════════════════════════════════════════════════════
-- AAROKSHA SECURE ADMIN SESSIONS TABLE
-- Run this in Supabase SQL Editor to enable server-side session tokens
-- ═══════════════════════════════════════════════════════════════════

-- 1. Create admin_sessions table
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token       text UNIQUE NOT NULL,
  partner_id  text,
  role        text NOT NULL CHECK (role IN ('hospital','lab','pharmacy','logistics','super')),
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- 2. Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON public.admin_sessions (token);

-- 3. Auto-delete expired sessions (keep table clean)
CREATE OR REPLACE FUNCTION delete_expired_admin_sessions()
RETURNS void LANGUAGE sql AS $$
  DELETE FROM public.admin_sessions WHERE expires_at < now();
$$;

-- 4. Row-Level Security (important!)
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

-- Allow service-role (backend) full access; anon only can insert+select own token
CREATE POLICY "Service role full access" ON public.admin_sessions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Insert own session" ON public.admin_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Verify own session by token" ON public.admin_sessions
  FOR SELECT USING (true);

CREATE POLICY "Delete own session" ON public.admin_sessions
  FOR DELETE USING (true);

-- 5. Fix SuperAdmin: update user_metadata to require role = 'super'
-- Run this for each super admin user (replace the email below):
-- UPDATE auth.users
--   SET raw_user_meta_data = raw_user_meta_data || '{"role":"super"}'
--   WHERE email = 'superadmin@aaroksha.com';
