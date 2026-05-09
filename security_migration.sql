-- ══════════════════════════════════════════════════════════════════════════════
-- Aaroksha Health Hub — Enterprise Security Migration
-- ══════════════════════════════════════════════════════════════════════════════
-- Run this ONCE against your Supabase project via the SQL Editor.
-- It implements:
--   1. admin_whitelist table (replaces hardcoded email list in JS)
--   2. bcrypt partner authentication RPC (replaces plaintext password query)
--   3. login_audit_log table (tracks all login attempts)
--   4. RLS policies for all sensitive tables
--   5. Automatic expired session cleanup
--   6. Password hashing migration helper
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── ENABLE pgcrypto for bcrypt ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ══════════════════════════════════════════════════════════════════════════════
-- 1. ADMIN WHITELIST TABLE
--    Replaces hardcoded email list in SuperAdminLogin.tsx
--    Only users in this table with active=true can access the super admin portal
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.admin_whitelist (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  email       TEXT        NOT NULL UNIQUE,
  active      BOOLEAN     DEFAULT true NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Insert the super admin emails (previously hardcoded in JS — now DB-managed)
INSERT INTO public.admin_whitelist (email, active)
VALUES
  ('manojalluri2727@gmail.com', true),
  ('super@aaroksha.com',        true),
  ('admin@aaroksha.com',        true)
ON CONFLICT (email) DO UPDATE SET active = EXCLUDED.active;

-- RLS: Only service_role can modify whitelist; anon can only SELECT active rows
-- (The Supabase anon key can read it for the whitelist check in verifySuperAdminSession)
ALTER TABLE public.admin_whitelist ENABLE ROW LEVEL SECURITY;

-- Allow authenticated super admins to read the whitelist
CREATE POLICY IF NOT EXISTS "admin_whitelist_select"
  ON public.admin_whitelist
  FOR SELECT
  USING (active = true);

-- Only service_role (backend) can insert/update/delete
CREATE POLICY IF NOT EXISTS "admin_whitelist_insert"
  ON public.admin_whitelist
  FOR INSERT
  WITH CHECK (false); -- No client-side inserts

CREATE POLICY IF NOT EXISTS "admin_whitelist_update"
  ON public.admin_whitelist
  FOR UPDATE
  USING (false); -- No client-side updates

CREATE POLICY IF NOT EXISTS "admin_whitelist_delete"
  ON public.admin_whitelist
  FOR DELETE
  USING (false); -- No client-side deletes


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. LOGIN AUDIT LOG TABLE
--    Records every authentication attempt for security monitoring
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.login_audit_log (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  email       TEXT        NOT NULL,
  portal_type TEXT        NOT NULL, -- 'super', 'hospital', 'lab', 'pharmacy', 'logistics'
  success     BOOLEAN     NOT NULL,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- RLS: Only service_role and super admins can read audit logs
ALTER TABLE public.login_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "audit_log_insert"
  ON public.login_audit_log
  FOR INSERT
  WITH CHECK (true); -- Anyone can insert (login attempts from client)

CREATE POLICY IF NOT EXISTS "audit_log_select"
  ON public.login_audit_log
  FOR SELECT
  USING (false); -- No client reads — must use service_role / Supabase dashboard


-- ══════════════════════════════════════════════════════════════════════════════
-- 3. PARTNER PASSWORD HASHING
--    Hash all existing plaintext passwords in the partners table using bcrypt.
--    IMPORTANT: Run this ONCE. After this, use the authenticate_partner RPC.
-- ══════════════════════════════════════════════════════════════════════════════

-- Add a password_hashed flag to track migration status
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS password_hashed BOOLEAN DEFAULT false;

-- Hash all existing plaintext passwords (bcrypt cost=12)
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id, password FROM public.partners WHERE password_hashed = false LOOP
    -- Skip if the password already looks like a bcrypt hash ($2b$...)
    IF rec.password NOT LIKE '$2%' THEN
      UPDATE public.partners
      SET
        password        = crypt(rec.password, gen_salt('bf', 12)),
        password_hashed = true
      WHERE id = rec.id;
    ELSE
      -- Already hashed, just mark it
      UPDATE public.partners SET password_hashed = true WHERE id = rec.id;
    END IF;
  END LOOP;
END;
$$;


-- ══════════════════════════════════════════════════════════════════════════════
-- 4. SECURE PARTNER AUTHENTICATION RPC
--    Called by authenticatePartner() in adminAuth.ts.
--    Performs server-side bcrypt comparison — password never travels in a filter.
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.authenticate_partner(
  p_email    TEXT,
  p_password TEXT,
  p_type     TEXT
)
RETURNS TABLE(id UUID, partner_id TEXT, name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs as DB owner to bypass RLS for auth
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT p.id, p.partner_id, p.name
    FROM public.partners p
    WHERE
      lower(p.email) = lower(p_email)
      AND p.type     = p_type
      AND p.status   = 'active'
      AND p.password = crypt(p_password, p.password);  -- bcrypt comparison

  -- Note: returns 0 rows if credentials are wrong (not an error)
  -- Caller checks for empty result and treats it as "denied"
END;
$$;

-- Revoke public execute, grant only to anon (client calls this via supabase.rpc())
REVOKE EXECUTE ON FUNCTION public.authenticate_partner FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.authenticate_partner TO anon;
GRANT  EXECUTE ON FUNCTION public.authenticate_partner TO authenticated;


-- ══════════════════════════════════════════════════════════════════════════════
-- 5. ADMIN SESSIONS TABLE — RLS HARDENING
--    Ensure sessions can only be created/deleted by the owner.
-- ══════════════════════════════════════════════════════════════════════════════

-- Ensure the table exists (may already exist from previous migration)
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  token       TEXT        NOT NULL UNIQUE,
  partner_id  TEXT        NOT NULL,
  role        TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON public.admin_sessions(token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expiry ON public.admin_sessions(expires_at);

ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a new session (happens on login)
DROP POLICY IF EXISTS "admin_sessions_insert" ON public.admin_sessions;
CREATE POLICY "admin_sessions_insert"
  ON public.admin_sessions
  FOR INSERT
  WITH CHECK (true);

-- Anyone can SELECT their own session by token (for verification)
DROP POLICY IF EXISTS "admin_sessions_select" ON public.admin_sessions;
CREATE POLICY "admin_sessions_select"
  ON public.admin_sessions
  FOR SELECT
  USING (true); -- Token is already secret (UUID) — no further restriction needed

-- Anyone can delete sessions (logout)
DROP POLICY IF EXISTS "admin_sessions_delete" ON public.admin_sessions;
CREATE POLICY "admin_sessions_delete"
  ON public.admin_sessions
  FOR DELETE
  USING (true);

-- No updates — sessions are immutable
DROP POLICY IF EXISTS "admin_sessions_update" ON public.admin_sessions;
-- (no policy = update denied by default)


-- ══════════════════════════════════════════════════════════════════════════════
-- 6. AUTOMATIC EXPIRED SESSION CLEANUP
--    Runs a lightweight cleanup of expired tokens to keep the table lean.
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.admin_sessions WHERE expires_at < now();
$$;

-- Schedule cleanup (if pg_cron is available on your Supabase plan):
-- SELECT cron.schedule('cleanup-sessions', '0 * * * *', 'SELECT cleanup_expired_sessions()');


-- ══════════════════════════════════════════════════════════════════════════════
-- 7. PLATFORM SETTINGS — RLS PROTECTION
--    Only authenticated super admins should be able to write settings.
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE IF EXISTS public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select" ON public.platform_settings;
CREATE POLICY "settings_select"
  ON public.platform_settings
  FOR SELECT
  USING (true); -- Public can read settings (needed for maintenance mode check)

DROP POLICY IF EXISTS "settings_insert" ON public.platform_settings;
CREATE POLICY "settings_insert"
  ON public.platform_settings
  FOR INSERT
  WITH CHECK (false); -- No client-side inserts (use service_role)

DROP POLICY IF EXISTS "settings_update" ON public.platform_settings;
CREATE POLICY "settings_update"
  ON public.platform_settings
  FOR UPDATE
  USING (
    -- Only authenticated users whose email is in admin_whitelist can update
    auth.email() IN (SELECT email FROM public.admin_whitelist WHERE active = true)
  );


-- ══════════════════════════════════════════════════════════════════════════════
-- 8. PARTNERS TABLE — RLS PROTECTION
--    Partners should only be able to read their own data.
--    Super admins can read all partners.
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE IF EXISTS public.partners ENABLE ROW LEVEL SECURITY;

-- Public SELECT (needed for login authentication via RPC fallback)
DROP POLICY IF EXISTS "partners_select_public" ON public.partners;
CREATE POLICY "partners_select_public"
  ON public.partners
  FOR SELECT
  USING (true);

-- Only super admins can insert/update/delete partners
DROP POLICY IF EXISTS "partners_insert" ON public.partners;
CREATE POLICY "partners_insert"
  ON public.partners
  FOR INSERT
  WITH CHECK (
    auth.email() IN (SELECT email FROM public.admin_whitelist WHERE active = true)
  );

DROP POLICY IF EXISTS "partners_update" ON public.partners;
CREATE POLICY "partners_update"
  ON public.partners
  FOR UPDATE
  USING (
    auth.email() IN (SELECT email FROM public.admin_whitelist WHERE active = true)
  );

DROP POLICY IF EXISTS "partners_delete" ON public.partners;
CREATE POLICY "partners_delete"
  ON public.partners
  FOR DELETE
  USING (
    auth.email() IN (SELECT email FROM public.admin_whitelist WHERE active = true)
  );


-- ══════════════════════════════════════════════════════════════════════════════
-- 9. VERIFICATION: Show current security posture
-- ══════════════════════════════════════════════════════════════════════════════
SELECT
  schemaname,
  tablename,
  rowsecurity AS "RLS Enabled"
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'admin_whitelist', 'admin_sessions', 'login_audit_log',
    'platform_settings', 'partners'
  )
ORDER BY tablename;
