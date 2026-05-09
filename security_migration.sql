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
--
-- FIX NOTE: PostgreSQL does NOT support CREATE POLICY IF NOT EXISTS.
--           All policies use DROP POLICY IF EXISTS then CREATE POLICY.
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── ENABLE pgcrypto for bcrypt ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ══════════════════════════════════════════════════════════════════════════════
-- 1. ADMIN WHITELIST TABLE
--    Replaces hardcoded email list in SuperAdminLogin.tsx
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.admin_whitelist (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  email       TEXT        NOT NULL UNIQUE,
  active      BOOLEAN     DEFAULT true NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.admin_whitelist (email, active)
VALUES
  ('manojalluri2727@gmail.com', true),
  ('super@aaroksha.com',        true),
  ('admin@aaroksha.com',        true)
ON CONFLICT (email) DO UPDATE SET active = EXCLUDED.active;

ALTER TABLE public.admin_whitelist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_whitelist_select" ON public.admin_whitelist;
CREATE POLICY "admin_whitelist_select"
  ON public.admin_whitelist FOR SELECT
  USING (active = true);

DROP POLICY IF EXISTS "admin_whitelist_insert" ON public.admin_whitelist;
CREATE POLICY "admin_whitelist_insert"
  ON public.admin_whitelist FOR INSERT
  WITH CHECK (false);

DROP POLICY IF EXISTS "admin_whitelist_update" ON public.admin_whitelist;
CREATE POLICY "admin_whitelist_update"
  ON public.admin_whitelist FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS "admin_whitelist_delete" ON public.admin_whitelist;
CREATE POLICY "admin_whitelist_delete"
  ON public.admin_whitelist FOR DELETE
  USING (false);


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. LOGIN AUDIT LOG TABLE
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.login_audit_log (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  email       TEXT        NOT NULL,
  portal_type TEXT        NOT NULL,
  success     BOOLEAN     NOT NULL,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.login_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_insert" ON public.login_audit_log;
CREATE POLICY "audit_log_insert"
  ON public.login_audit_log FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "audit_log_select" ON public.login_audit_log;
CREATE POLICY "audit_log_select"
  ON public.login_audit_log FOR SELECT
  USING (false);


-- ══════════════════════════════════════════════════════════════════════════════
-- 3. PARTNER PASSWORD HASHING
--    IMPORTANT: Run this ONCE. After this, use the authenticate_partner RPC.
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS password_hashed BOOLEAN DEFAULT false;

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id, password FROM public.partners WHERE password_hashed = false LOOP
    IF rec.password NOT LIKE '$2%' THEN
      UPDATE public.partners
      SET
        password        = crypt(rec.password, gen_salt('bf', 12)),
        password_hashed = true
      WHERE id = rec.id;
    ELSE
      UPDATE public.partners SET password_hashed = true WHERE id = rec.id;
    END IF;
  END LOOP;
END;
$$;


-- ══════════════════════════════════════════════════════════════════════════════
-- 4. SECURE PARTNER AUTHENTICATION RPC
--    Called by authenticatePartner() in adminAuth.ts.
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.authenticate_partner(
  p_email    TEXT,
  p_password TEXT,
  p_type     TEXT
)
RETURNS TABLE(id UUID, partner_id TEXT, name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
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
      AND p.password = crypt(p_password, p.password);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.authenticate_partner FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.authenticate_partner TO anon;
GRANT  EXECUTE ON FUNCTION public.authenticate_partner TO authenticated;


-- ══════════════════════════════════════════════════════════════════════════════
-- 5. ADMIN SESSIONS TABLE — RLS HARDENING
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  token       TEXT        NOT NULL UNIQUE,
  partner_id  TEXT        NOT NULL,
  role        TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_token  ON public.admin_sessions(token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expiry ON public.admin_sessions(expires_at);

ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_sessions_insert" ON public.admin_sessions;
CREATE POLICY "admin_sessions_insert"
  ON public.admin_sessions FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "admin_sessions_select" ON public.admin_sessions;
CREATE POLICY "admin_sessions_select"
  ON public.admin_sessions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "admin_sessions_delete" ON public.admin_sessions;
CREATE POLICY "admin_sessions_delete"
  ON public.admin_sessions FOR DELETE
  USING (true);

DROP POLICY IF EXISTS "admin_sessions_update" ON public.admin_sessions;
-- (no CREATE = updates blocked by default)


-- ══════════════════════════════════════════════════════════════════════════════
-- 6. AUTOMATIC EXPIRED SESSION CLEANUP
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.admin_sessions WHERE expires_at < now();
$$;

-- To schedule hourly (requires pg_cron extension on your Supabase plan):
-- SELECT cron.schedule('cleanup-sessions', '0 * * * *', 'SELECT cleanup_expired_sessions()');


-- ══════════════════════════════════════════════════════════════════════════════
-- 7. PLATFORM SETTINGS — RLS PROTECTION
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE IF EXISTS public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select" ON public.platform_settings;
CREATE POLICY "settings_select"
  ON public.platform_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "settings_insert" ON public.platform_settings;
CREATE POLICY "settings_insert"
  ON public.platform_settings FOR INSERT
  WITH CHECK (false);

DROP POLICY IF EXISTS "settings_update" ON public.platform_settings;
CREATE POLICY "settings_update"
  ON public.platform_settings FOR UPDATE
  USING (
    auth.email() IN (SELECT email FROM public.admin_whitelist WHERE active = true)
  );


-- ══════════════════════════════════════════════════════════════════════════════
-- 8. PARTNERS TABLE — RLS PROTECTION
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE IF EXISTS public.partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partners_select_public" ON public.partners;
CREATE POLICY "partners_select_public"
  ON public.partners FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "partners_insert" ON public.partners;
CREATE POLICY "partners_insert"
  ON public.partners FOR INSERT
  WITH CHECK (
    auth.email() IN (SELECT email FROM public.admin_whitelist WHERE active = true)
  );

DROP POLICY IF EXISTS "partners_update" ON public.partners;
CREATE POLICY "partners_update"
  ON public.partners FOR UPDATE
  USING (
    auth.email() IN (SELECT email FROM public.admin_whitelist WHERE active = true)
  );

DROP POLICY IF EXISTS "partners_delete" ON public.partners;
CREATE POLICY "partners_delete"
  ON public.partners FOR DELETE
  USING (
    auth.email() IN (SELECT email FROM public.admin_whitelist WHERE active = true)
  );


-- ══════════════════════════════════════════════════════════════════════════════
-- 9. VERIFICATION: Show RLS status for all secured tables
-- ══════════════════════════════════════════════════════════════════════════════
SELECT
  tablename,
  rowsecurity AS "RLS Enabled"
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'admin_whitelist', 'admin_sessions', 'login_audit_log',
    'platform_settings', 'partners'
  )
ORDER BY tablename;
