/**
 * ProtectedAdminRoute
 * ──────────────────────────────────────────────────────────────────
 * Multi-layer route guard for all admin dashboards.
 *
 * Checks (in order):
 *  1. Local session exists + not expired (instant, no network)
 *  2. Role matches the required role for this route
 *  3. Server-side validation against Supabase (DB token or JWT)
 *
 * If ANY check fails → redirect to the appropriate login page.
 * Shows a full-screen loading state while verifying (prevents flash).
 * ──────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { ShieldCheck, Loader2, ShieldX } from "lucide-react";
import {
  AdminRole,
  verifySuperAdminSession,
  verifyPartnerSession,
  readLocalAdminSession,
  clearAdminSession,
} from "@/lib/adminAuth";

interface Props {
  role: AdminRole;
  loginPath: string;
  children: React.ReactNode;
}

type Status = "checking" | "authorized" | "denied";

const loginPathForRole: Record<AdminRole, string> = {
  super: "/admin/login/super",
  hospital: "/admin/login/hospital",
  lab: "/admin/login/lab",
  pharmacy: "/admin/login/pharmacy",
  logistics: "/admin/login/logistics",
};

const ProtectedAdminRoute = ({ role, children }: Props) => {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      try {
        // ── Step 1: Quick local check (no network) ──
        if (role !== "super") {
          const local = readLocalAdminSession();
          if (!local || local.role !== role) {
            if (!cancelled) setStatus("denied");
            return;
          }
        }

        // ── Step 2: Server-side verification ──
        let ok = false;
        if (role === "super") {
          ok = await verifySuperAdminSession();
        } else {
          ok = await verifyPartnerSession(role);
        }

        if (!cancelled) setStatus(ok ? "authorized" : "denied");
      } catch {
        if (!cancelled) setStatus("denied");
      }
    };

    verify();
    return () => { cancelled = true; };
  }, [role]);

  // ── Deny: clear session and redirect ──
  if (status === "denied") {
    clearAdminSession();
    return <Navigate to={loginPathForRole[role]} replace />;
  }

  // ── Checking: show secure loading screen (prevents content flash) ──
  if (status === "checking") {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center"
        style={{ background: "linear-gradient(135deg, #020617 0%, #0f172a 100%)" }}
      >
        {/* Animated shield */}
        <div className="relative mb-8">
          <div
            className="h-24 w-24 rounded-3xl flex items-center justify-center shadow-2xl border border-white/10"
            style={{ background: "linear-gradient(135deg, #1d4ed8, #2563eb)" }}
          >
            <ShieldCheck className="h-12 w-12 text-white" />
          </div>
          <div
            className="absolute inset-0 rounded-3xl border border-blue-500/30 scale-110 animate-ping opacity-40"
            style={{ animationDuration: "2s" }}
          />
        </div>

        {/* Spinner + message */}
        <div className="flex items-center gap-3 mb-3">
          <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
          <p className="text-white font-black text-lg tracking-tight">Verifying Session</p>
        </div>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
          Authenticating with secure server…
        </p>

        {/* Progress bar */}
        <div className="mt-8 w-48 h-1 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full animate-pulse w-3/4" />
        </div>
      </div>
    );
  }

  // ── Authorized: render children ──
  return <>{children}</>;
};

// ─── Denied splash (standalone component for edge cases) ─────────────
export const AccessDeniedScreen = ({ role }: { role: AdminRole }) => (
  <div
    className="min-h-screen flex flex-col items-center justify-center p-6"
    style={{ background: "linear-gradient(135deg, #020617 0%, #0f172a 100%)" }}
  >
    <div className="h-24 w-24 bg-red-900/40 rounded-3xl flex items-center justify-center mb-6 border border-red-500/20">
      <ShieldX className="h-12 w-12 text-red-400" />
    </div>
    <h1 className="text-white font-black text-2xl mb-2">Access Denied</h1>
    <p className="text-slate-400 text-sm text-center max-w-xs mb-8">
      You do not have permission to access this portal. Please log in with authorized credentials.
    </p>
    <a
      href={loginPathForRole[role]}
      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-3 rounded-xl transition-all"
    >
      Go to Login
    </a>
  </div>
);

export default ProtectedAdminRoute;
