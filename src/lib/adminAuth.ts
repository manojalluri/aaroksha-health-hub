/**
 * ══════════════════════════════════════════════════════════════════
 * Aaroksha Admin Auth Guard — Enterprise-Grade Session Security
 * ══════════════════════════════════════════════════════════════════
 *
 * SECURITY MODEL:
 *  - Super Admin : Supabase JWT auth (email/password via Supabase Auth).
 *                  Role verified via user_metadata.role === "super" OR
 *                  confirmed admin_whitelist table in Supabase DB.
 *  - Partners    : DB-backed opaque session token (UUID) stored in
 *                  sessionStorage ONLY (cleared on tab/browser close).
 *                  Token validated against `admin_sessions` table on
 *                  EVERY protected route visit — server can revoke anytime.
 *
 * PROTECTIONS:
 *  ✅ Rate limiting      : 5 attempts per 15-min window (per-tab in-memory)
 *  ✅ Account lockout    : exponential back-off after MAX_ATTEMPTS failures
 *  ✅ Session expiry     : 8-hour hard limit validated server-side
 *  ✅ sessionStorage only: no auth tokens in localStorage
 *  ✅ No hardcoded secrets in this file (whitelist is DB-managed)
 *  ✅ Secure random tokens: crypto.randomUUID()
 * ══════════════════════════════════════════════════════════════════
 */

import { supabase } from "./supabase";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
export type AdminRole = "super" | "hospital" | "lab" | "pharmacy" | "logistics";

// ─── Session storage keys (sessionStorage — cleared on tab close) ─────────────
const SESSION_KEY   = "aaroksha_admin_token";
const ROLE_KEY      = "aaroksha_admin_role";
const EXPIRY_KEY    = "aaroksha_admin_expiry";
const SESSION_HOURS = 8;

// ─── Rate limiting (in-memory, per-tab) ───────────────────────────────────────
// For production at scale, move this to a Supabase Edge Function / Redis.
const _attempts: Record<string, { count: number; firstAttempt: number; lockedUntil: number }> = {};
const RATE_WINDOW_MS  = 15 * 60 * 1000; // 15-minute sliding window
const MAX_ATTEMPTS    = 5;
const LOCKOUT_BASE_MS = 30 * 1000;      // 30s base, doubles each extra failure (max 30 min)

/** Record a failed login attempt. Returns lockout info. */
export const recordFailedAttempt = (key: string): { blocked: boolean; waitMs: number } => {
  const now = Date.now();
  const rec = _attempts[key] ?? { count: 0, firstAttempt: now, lockedUntil: 0 };

  // Reset window after 15 minutes of inactivity
  if (now - rec.firstAttempt > RATE_WINDOW_MS) {
    _attempts[key] = { count: 1, firstAttempt: now, lockedUntil: 0 };
    return { blocked: false, waitMs: 0 };
  }

  rec.count++;

  if (rec.count >= MAX_ATTEMPTS) {
    const extra      = rec.count - MAX_ATTEMPTS;
    const lockoutMs  = LOCKOUT_BASE_MS * Math.pow(2, extra);
    rec.lockedUntil  = now + Math.min(lockoutMs, 30 * 60 * 1000);
  }

  _attempts[key] = rec;
  return rec.lockedUntil > now
    ? { blocked: true, waitMs: rec.lockedUntil - now }
    : { blocked: false, waitMs: 0 };
};

/** Check if a key is currently rate-limited (call BEFORE attempting auth). */
export const isRateLimited = (key: string): { blocked: boolean; waitMs: number } => {
  const rec = _attempts[key];
  if (!rec) return { blocked: false, waitMs: 0 };
  const now = Date.now();
  if (now - rec.firstAttempt > RATE_WINDOW_MS && rec.lockedUntil <= now) {
    delete _attempts[key];
    return { blocked: false, waitMs: 0 };
  }
  return rec.lockedUntil > now
    ? { blocked: true, waitMs: rec.lockedUntil - now }
    : { blocked: false, waitMs: 0 };
};

/** Clear attempt record after a successful login. */
export const clearAttempts = (key: string) => { delete _attempts[key]; };

// ─── Session write / read / clear ─────────────────────────────────────────────

/** Persist partner session token in sessionStorage (tab-scoped). */
export const writeAdminSession = (token: string, role: AdminRole): void => {
  const expiry = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  sessionStorage.setItem(SESSION_KEY, token);
  sessionStorage.setItem(ROLE_KEY,    role);
  sessionStorage.setItem(EXPIRY_KEY,  String(expiry));
};

/** Read and validate local session without a network round-trip. */
export const readLocalAdminSession = (): { token: string; role: AdminRole } | null => {
  const token  = sessionStorage.getItem(SESSION_KEY);
  const role   = sessionStorage.getItem(ROLE_KEY) as AdminRole | null;
  const expiry = Number(sessionStorage.getItem(EXPIRY_KEY) ?? 0);

  if (!token || !role) return null;
  if (Date.now() > expiry) { clearAdminSession(); return null; }
  return { token, role };
};

/** Wipe every auth artifact from storage (used on logout & denial). */
export const clearAdminSession = (): void => {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(ROLE_KEY);
  sessionStorage.removeItem(EXPIRY_KEY);
  localStorage.removeItem("aaroksha_partner_session"); // clear legacy key
};

// ─── Super Admin: Supabase JWT validation ─────────────────────────────────────

/**
 * Verify Super Admin session.
 * 1. Valid Supabase session must exist.
 * 2. user_metadata.role === "super"  OR  email is in admin_whitelist (DB).
 *
 * The whitelist table is protected by RLS so only service-role can write it.
 * No emails are hardcoded in client-side code.
 */
export const verifySuperAdminSession = async (): Promise<boolean> => {
  try {
    const { data: { session }, error: sessErr } = await supabase.auth.getSession();
    if (sessErr || !session) return false;

    // Re-fetch user to bypass stale cache
    const { data: { user: freshUser }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !freshUser?.email) return false;

    // Primary check: role in user_metadata
    if (freshUser.user_metadata?.role === "super") return true;

    // Fallback: check DB admin_whitelist
    // Try with 'is_active' column first (newer schema), then fallback to 'active'
    try {
      const { data: row1, error: err1 } = await supabase
        .from("admin_whitelist")
        .select("email")
        .eq("email", freshUser.email)
        .eq("is_active", true)
        .maybeSingle();

      if (!err1) return !!row1;
    } catch { /* column doesn't exist, try next */ }

    try {
      const { data: row2, error: err2 } = await supabase
        .from("admin_whitelist")
        .select("email")
        .eq("email", freshUser.email)
        .eq("active", true)
        .maybeSingle();

      if (!err2) return !!row2;
    } catch { /* column doesn't exist */ }

    // Last resort: just check if email is in the whitelist at all
    const { data: row3 } = await supabase
      .from("admin_whitelist")
      .select("email")
      .eq("email", freshUser.email)
      .maybeSingle();

    return !!row3;
  } catch {
    return false;
  }
};

// ─── Partner: DB-backed token verification ────────────────────────────────────

/**
 * Verify partner session by validating the token against the DB.
 * Server is the authoritative source — local cache is only a fast-path.
 */
export const verifyPartnerSession = async (
  requiredRole: Exclude<AdminRole, "super">
): Promise<boolean> => {
  const local = readLocalAdminSession();
  if (!local || local.role !== requiredRole) return false;

  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("admin_sessions")
      .select("id, role, expires_at")
      .eq("token",      local.token)
      .eq("role",       requiredRole)
      .gt("expires_at", now)
      .maybeSingle();

    if (error || !data) { clearAdminSession(); return false; }
    return true;
  } catch {
    clearAdminSession();
    return false;
  }
};

// ─── Partner Login: create a DB-backed session ────────────────────────────────

/**
 * Authenticate partner credentials against `partners` table,
 * then create a signed session token in `admin_sessions`.
 *
 * ⚠️  IMPORTANT: The partners table passwords SHOULD be bcrypt-hashed.
 *    Use the `authenticate_partner` RPC (provided in security SQL migration)
 *    for server-side hash comparison. The plain-text fallback here is
 *    transitional and should be removed after the migration.
 */
export const authenticatePartner = async (
  email: string,
  password: string,
  type: Exclude<AdminRole, "super">
): Promise<{ id: string; partner_id: string; name: string } | null> => {
  const cleanEmail = email.toLowerCase().trim();
  const cleanPassword = password.trim();

  if (!cleanEmail || !cleanPassword) return null;

  try {
    // ── 1. Attempt Authentication ──
    const { data: rpcData, error: rpcErr } = await supabase.rpc(
      "authenticate_partner",
      { 
        p_email: cleanEmail, 
        p_password: cleanPassword, 
        p_type: type 
      }
    );

    if (rpcErr) {
      console.error(`[adminAuth] RPC Error:`, rpcErr.message);
      return null;
    }

    // ── 2. Handle Success ──
    if (rpcData && rpcData.length > 0) {
      return rpcData[0] as { id: string; partner_id: string; name: string };
    }

    // ── 3. Diagnostic Check: Why did it fail? ──
    // If we reach here, either the password was wrong OR the status is not active.
    const { data: partnerCheck } = await supabase
      .from("partners")
      .select("status, name")
      .eq("email", cleanEmail)
      .eq("type", type)
      .maybeSingle();

    if (partnerCheck) {
      if (partnerCheck.status !== "active") {
        console.warn(`[adminAuth] Login blocked: ${partnerCheck.name} is currently "${partnerCheck.status}".`);
        toast.error(`Your account (${partnerCheck.name}) is currently ${partnerCheck.status}. Please contact the Super Admin.`);
      } else {
        console.warn(`[adminAuth] Invalid password for: ${cleanEmail}`);
        toast.error("Invalid password. Please check and try again.");
      }
    } else {
      console.warn(`[adminAuth] No ${type} partner found with email: ${cleanEmail}`);
      toast.error(`No ${type} account found with that email.`);
    }

    return null;
  } catch (err: any) {
    console.error(`[adminAuth] Critical failure:`, err.message);
    return null;
  }
};


/** Create a DB-backed session token for an authenticated partner. */
export const createPartnerSession = async (
  partnerId: string,
  role: Exclude<AdminRole, "super">
): Promise<string | null> => {
  try {
    const token     = crypto.randomUUID(); // cryptographically secure
    const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from("admin_sessions")
      .insert({ token, partner_id: partnerId, role, expires_at: expiresAt });

    if (error) return null;
    writeAdminSession(token, role);
    return token;
  } catch {
    return null;
  }
};

// ─── Revoke session on logout ─────────────────────────────────────────────────

/** Delete the active token from the DB and clear sessionStorage. */
export const revokePartnerSession = async (): Promise<void> => {
  const local = readLocalAdminSession();
  if (local?.token) {
    await supabase.from("admin_sessions").delete().eq("token", local.token);
  }
  clearAdminSession();
};

// ─── Get partner_id from current session ──────────────────────────────────────

/** Returns the partner_id string for the current session, or null. */
export const getPartnerIdFromSession = async (): Promise<string | null> => {
  const local = readLocalAdminSession();
  if (!local?.token) return null;
  try {
    const { data, error } = await supabase
      .from("admin_sessions")
      .select("partner_id")
      .eq("token", local.token)
      .maybeSingle();
    if (error || !data) return null;
    return data.partner_id as string;
  } catch {
    return null;
  }
};

// ─── Generic "is logged in" check (used by login pages) ──────────────────────

/** Returns true if the user for this role already has a valid session. */
export const checkIsLoggedIn = async (role: AdminRole): Promise<boolean> => {
  if (role === "super") return verifySuperAdminSession();
  return verifyPartnerSession(role);
};
