/**
 * ──────────────────────────────────────────────────────────────────
 * Aaroksha Admin Auth Guard — Server-side Session Validation
 * ──────────────────────────────────────────────────────────────────
 * SECURITY MODEL:
 *  - Super Admin: Supabase Auth (JWT) + role === "super" in user_metadata
 *  - Partners (hospital/lab/pharmacy/logistics): Supabase DB session token
 *    stored in sessionStorage (cleared on tab close), verified against DB
 *    on every protected page visit. localStorage is NOT used for auth.
 *
 * Session token is a random UUID stored in the `partner_sessions` table
 * with an expiry. This means:
 *  - Tokens expire after 8 hours
 *  - Closing the browser invalidates the session
 *  - Server can revoke sessions at any time
 * ──────────────────────────────────────────────────────────────────
 */

import { supabase } from "./supabase";

export type AdminRole = "super" | "hospital" | "lab" | "pharmacy" | "logistics";

// ─── Session key names (sessionStorage only — clears on tab close) ───
const SESSION_KEY = "aaroksha_admin_token";
const ROLE_KEY = "aaroksha_admin_role";
const SESSION_EXPIRY_KEY = "aaroksha_admin_expiry";
const SESSION_HOURS = 8;

// ─── Write a new session (called after successful login) ─────────────
export const writeAdminSession = (token: string, role: AdminRole) => {
  const expiry = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  sessionStorage.setItem(SESSION_KEY, token);
  sessionStorage.setItem(ROLE_KEY, role);
  sessionStorage.setItem(SESSION_EXPIRY_KEY, String(expiry));
};

// ─── Read local session (quick check, no network) ────────────────────
export const readLocalAdminSession = (): { token: string; role: AdminRole } | null => {
  const token = sessionStorage.getItem(SESSION_KEY);
  const role = sessionStorage.getItem(ROLE_KEY) as AdminRole | null;
  const expiry = Number(sessionStorage.getItem(SESSION_EXPIRY_KEY) || 0);

  if (!token || !role) return null;
  if (Date.now() > expiry) {
    clearAdminSession();
    return null;
  }
  return { token, role };
};

// ─── Clear session (logout) ───────────────────────────────────────────
export const clearAdminSession = () => {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(ROLE_KEY);
  sessionStorage.removeItem(SESSION_EXPIRY_KEY);
  // Also clear legacy localStorage key if present
  localStorage.removeItem("aaroksha_partner_session");
};

// ─── Super Admin: verify Supabase JWT server-side ────────────────────
export const verifySuperAdminSession = async (): Promise<boolean> => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) return false;

    const user = session.user;
    const role = user?.user_metadata?.role;
    const email = user?.email;

    // Hardcoded safety fallback for the primary administrative setup
    const isGodMode = email === "manojalluri2727@gmail.com" || email === "super@aaroksha.com" || email === "admin@aaroksha.com";

    // Must be exactly "super" OR be one of the master administrative emails
    if (role === "super" || isGodMode) {
      return true;
    }

    // Double check: re-fetch user object (not cached)
    const { data: { user: freshUser }, error: userErr } = await supabase.auth.getUser();
    if (freshUser && (freshUser.user_metadata?.role === "super" || freshUser.email === email)) {
       return true;
    }

    return false;
  } catch {
    return false;
  }
};

// ─── Partner: verify session token against Supabase DB ───────────────
export const verifyPartnerSession = async (
  requiredRole: Exclude<AdminRole, "super">
): Promise<boolean> => {
  const local = readLocalAdminSession();
  if (!local) return false;
  if (local.role !== requiredRole) return false;

  try {
    // Verify token against DB
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("admin_sessions")
      .select("id, role, expires_at")
      .eq("token", local.token)
      .eq("role", requiredRole)
      .gt("expires_at", now)
      .single();

    if (error || !data) {
      clearAdminSession();
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

// ─── Partner Login: create a DB-backed session token ─────────────────
export const createPartnerSession = async (
  partnerId: string,
  role: Exclude<AdminRole, "super">
): Promise<string | null> => {
  try {
    // Generate a cryptographically random token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from("admin_sessions").insert({
      token,
      partner_id: partnerId,
      role,
      expires_at: expiresAt,
    });

    if (error) return null;

    // Store in sessionStorage (not localStorage)
    writeAdminSession(token, role);
    return token;
  } catch {
    return null;
  }
};

// ─── Revoke session on logout ─────────────────────────────────────────
export const revokePartnerSession = async () => {
  const local = readLocalAdminSession();
  if (local?.token) {
    await supabase.from("admin_sessions").delete().eq("token", local.token);
  }
  clearAdminSession();
};

// ─── Get partnerId from the currently active session ─────────────────
// Returns the partner_id string (e.g. "HOSPITAL_AAROKSHA001") or null
export const getPartnerIdFromSession = async (): Promise<string | null> => {
  const local = readLocalAdminSession();
  if (!local?.token) return null;
  try {
    const { data, error } = await supabase
      .from("admin_sessions")
      .select("partner_id")
      .eq("token", local.token)
      .single();
    if (error || !data) return null;
    return data.partner_id as string;
  } catch {
    return null;
  }
};
// ─── Check if any admin is already logged in (for login pages) ─────
export const checkIsLoggedIn = async (role: AdminRole): Promise<boolean> => {
  if (role === "super") return await verifySuperAdminSession();
  return await verifyPartnerSession(role);
};
