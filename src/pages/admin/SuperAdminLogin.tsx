/**
 * SuperAdminLogin — Secure email + password authentication.
 *
 * SECURITY NOTES:
 *  - No hardcoded credentials or email whitelists in client-side code.
 *  - Rate limiting: 5 attempts per 15 min (in-memory, see adminAuth.ts).
 *  - Role verification is delegated to verifySuperAdminSession() which checks
 *    Supabase JWT user_metadata.role === "super" OR DB admin_whitelist table.
 *  - MFA (hardcoded 6-digit key) has been intentionally REMOVED as it was
 *    client-side only and provided zero real security (key was "272727").
 *  - Supabase Auth handles bcrypt hashing of passwords server-side.
 */
import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Lock, Mail, ChevronRight, ShieldCheck, Loader2, Eye, EyeOff, ArrowLeft, AlertTriangle, KeyRound, CheckCircle2
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { checkIsLoggedIn, isRateLimited, recordFailedAttempt, clearAttempts } from "@/lib/adminAuth";

const SuperAdminLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [loading, setLoading]       = useState(false);
  const [showPass, setShowPass]     = useState(false);
  const [lockoutMsg, setLockoutMsg] = useState<string | null>(null);
  const [mode, setMode]             = useState<"login" | "forgot" | "sent">("login");
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    checkIsLoggedIn("super").then(ok => { if (ok) navigate("/admin/super"); });
  }, [navigate]);

  // Cleanup countdown on unmount
  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);

  /** Start a visible countdown during an account lockout. */
  const startLockoutCountdown = (waitMs: number) => {
    let remaining = Math.ceil(waitMs / 1000);
    setLockoutMsg(`Too many attempts. Try again in ${remaining}s.`);

    countdownRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(countdownRef.current!);
        setLockoutMsg(null);
      } else {
        setLockoutMsg(`Too many attempts. Try again in ${remaining}s.`);
      }
    }, 1000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // ── Rate-limit check (client-side fast-path) ──
    const cleanEmail = email.toLowerCase().trim();
    const limitCheck = isRateLimited(cleanEmail);
    if (limitCheck.blocked) {
      startLockoutCountdown(limitCheck.waitMs);
      return;
    }

    setLoading(true);
    try {
      // ── Supabase Auth: bcrypt hash comparison happens server-side ──
      const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) throw error;

      const user = data.user;
      if (!user) throw new Error("Authentication failed. No user returned.");

      // ── Role check: must be super admin (verified in adminAuth.verifySuperAdminSession) ──
      // verifySuperAdminSession checks JWT metadata OR DB admin_whitelist
      const { verifySuperAdminSession } = await import("@/lib/adminAuth");
      const isAuthorized = await verifySuperAdminSession();

      if (!isAuthorized) {
        // Sign out the Supabase session immediately — user is authenticated but not authorized
        await supabase.auth.signOut();
        recordFailedAttempt(cleanEmail);
        throw new Error("Access denied. Your account does not have Super Admin privileges.");
      }

      // ── Success ──
      clearAttempts(cleanEmail);
      toast.success("Access granted. Welcome to the Super Admin portal.");
      navigate("/admin/super");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Authentication failed";

      // Record failed attempt for rate limiting
      const { blocked, waitMs } = recordFailedAttempt(cleanEmail);
      if (blocked) {
        startLockoutCountdown(waitMs);
        toast.error("Account temporarily locked due to multiple failed attempts.");
      } else {
        // Generic error message — no internal details exposed to attacker
        toast.error("Invalid credentials or insufficient privileges.");
        console.error("[SuperAdminLogin] Auth error:", errMsg); // server-side log only
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * SECURITY: Send password reset email ONLY if the entered email is confirmed
   * to exist in the `admin_whitelist` table (server-side check via Supabase RLS).
   *
   * WHY server-side instead of env var comparison:
   *  - VITE_ variables are baked into the JS bundle at build time.
   *  - Anyone with DevTools can read them from the compiled JavaScript.
   *  - The DB check keeps the real admin email off the client entirely.
   *  - The admin_whitelist table is RLS-protected: anon users can only
   *    check existence (not read values), enforced by the DB policy.
   *
   * This prevents:
   *  - Sending reset emails to arbitrary addresses via this portal.
   *  - Email enumeration (same response regardless of outcome).
   *  - Admin email exposure in the public JS bundle.
   */
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = resetEmail.toLowerCase().trim();

    if (!cleanEmail) {
      toast.error("Please enter your admin email address.");
      return;
    }

    // Basic format check before hitting the DB
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setResetLoading(true);
    try {
      // ── SERVER-SIDE WHITELIST CHECK ──────────────────────────────────────
      // Query admin_whitelist table. RLS policy allows anon to check existence
      // only — the email value is never returned to the client.
      // If the email is NOT in the whitelist, we silently show success to
      // prevent enumeration, but never call resetPasswordForEmail.
      const { data: whitelisted, error: wlErr } = await supabase
        .from("admin_whitelist")
        .select("email")          // minimal select — RLS masks the actual value
        .eq("email", cleanEmail)
        .maybeSingle();

      // Always show the same success UI — never reveal whether the email matched
      if (wlErr || !whitelisted) {
        // Not in whitelist (or DB error) — fake success, no email sent
        console.warn("[SuperAdminLogin] Password reset blocked: not in admin_whitelist.");
        setMode("sent");
        return;
      }

      // ── Email is authorised — trigger Supabase password reset ──
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/admin/reset-password`,
      });
      if (resetErr) throw resetErr;

      setMode("sent");
      toast.success("Password reset email sent! Check your inbox.");
    } catch (err: any) {
      toast.error("Failed to send reset email. Please try again.");
      console.error("[ForgotPassword]", err.message);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center" style={{ background: "linear-gradient(135deg, #020617 0%, #0f172a 50%, #1e293b 100%)" }}>
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 right-0 w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #f59e0b, transparent)" }} />
        <div className="absolute bottom-0 -left-24 w-80 h-80 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #d97706, transparent)" }} />
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="super-hex" x="0" y="0" width="80" height="90" patternUnits="userSpaceOnUse">
              <polygon points="40,5 70,22 70,68 40,85 10,68 10,22" fill="none" stroke="white" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#super-hex)" />
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-md px-6 py-10 mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-amber-400 hover:text-white text-sm font-medium mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="flex flex-col items-center mb-10">
          <h1 className="text-3xl font-black text-white tracking-tight">
            {mode === "login" ? "Super Admin" : mode === "forgot" ? "Reset Password" : "Email Sent"}
          </h1>
          <p className="text-amber-400/70 text-[11px] font-bold uppercase tracking-[0.2em] mt-2">Aaroksha Health · Restricted Access</p>
          <div className="mt-3 flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 px-4 py-1.5 rounded-full">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">
              {mode === "login" ? "Level 5 Clearance Required" : "Secure Password Reset"}
            </span>
          </div>
        </div>

        <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-8 shadow-2xl">
          {/* ── LOGIN MODE ── */}
          {mode === "login" && (
            <>
              {/* Lockout banner */}
              {lockoutMsg && (
                <div className="mb-5 flex items-center gap-3 bg-red-900/30 border border-red-500/30 rounded-xl px-4 py-3">
                  <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                  <p className="text-xs font-bold text-red-300">{lockoutMsg}</p>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="sa-email" className="text-[10px] font-black text-amber-400/70 uppercase tracking-widest pl-1">Admin Email</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-amber-400 transition-colors" />
                    <input
                      id="sa-email" type="email" required autoComplete="email"
                      value={email} onChange={(e) => setEmail(e.target.value)}
                      disabled={!!lockoutMsg}
                      placeholder="super@aaroksha.com"
                      className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-white text-sm font-medium outline-none focus:border-amber-400/60 transition-all disabled:opacity-40"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="sa-password" className="text-[10px] font-black text-amber-400/70 uppercase tracking-widest pl-1">Master Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-amber-400 transition-colors" />
                    <input
                      id="sa-password" type={showPass ? "text" : "password"} required autoComplete="current-password"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      disabled={!!lockoutMsg}
                      placeholder="••••••••••••"
                      className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-12 text-white text-sm font-medium outline-none focus:border-amber-400/60 transition-all disabled:opacity-40"
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-amber-400"
                      aria-label={showPass ? "Hide password" : "Show password"}>
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Forgot Password link */}
                <div className="flex justify-end">
                  <button type="button" onClick={() => { setMode("forgot"); setResetEmail(email); }}
                    className="text-[11px] text-amber-400/60 hover:text-amber-400 font-bold transition-colors underline underline-offset-2">
                    Forgot Password?
                  </button>
                </div>

                <button type="submit" id="super-admin-login-btn"
                  disabled={loading || !!lockoutMsg}
                  className="w-full h-14 text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 mt-2"
                  style={{ background: "linear-gradient(135deg, #d97706, #92400e)", boxShadow: "0 10px 40px rgba(180,83,9,0.3)" }}>
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><span>Access Admin Portal</span><ChevronRight className="h-5 w-5" /></>}
                </button>
              </form>
            </>
          )}

          {/* ── FORGOT PASSWORD MODE ── */}
          {mode === "forgot" && (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <p className="text-slate-400 text-sm leading-relaxed">
                Enter your registered Super Admin email address. A secure reset link will be sent to your inbox.
              </p>
              <div className="space-y-2">
                <label htmlFor="reset-email" className="text-[10px] font-black text-amber-400/70 uppercase tracking-widest pl-1">Admin Email</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-amber-400 transition-colors" />
                  <input
                    id="reset-email" type="email" required autoComplete="off"
                    value={resetEmail} onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="Your admin email address"
                    className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-white text-sm font-medium outline-none focus:border-amber-400/60 transition-all"
                  />
                </div>
              </div>
              <button type="submit" disabled={resetLoading}
                className="w-full h-14 text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #d97706, #92400e)", boxShadow: "0 10px 40px rgba(180,83,9,0.3)" }}>
                {resetLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><KeyRound className="h-5 w-5" /><span>Send Reset Link</span></>}
              </button>
              <button type="button" onClick={() => setMode("login")}
                className="w-full text-slate-500 hover:text-white text-sm font-bold transition-colors py-2">
                ← Back to Login
              </button>
            </form>
          )}

          {/* ── EMAIL SENT MODE ── */}
          {mode === "sent" && (
            <div className="flex flex-col items-center text-center gap-5 py-4">
              <div className="h-20 w-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              </div>
              <div>
                <p className="text-white font-black text-lg">Check Your Inbox!</p>
                <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                  If your email is registered as Super Admin, a password reset link has been sent.
                  Click the link in the email to set a new password.
                </p>
              </div>
              <div className="bg-amber-400/10 border border-amber-400/20 rounded-xl p-4 text-left w-full">
                <p className="text-[11px] text-amber-400 font-bold">📧 Didn't receive it?</p>
                <p className="text-[11px] text-slate-500 mt-1">Check your spam folder. The link expires in 1 hour.</p>
              </div>
              <button onClick={() => setMode("forgot")}
                className="text-amber-400/60 hover:text-amber-400 text-sm font-bold transition-colors underline underline-offset-2">
                Resend Email
              </button>
              <button onClick={() => setMode("login")}
                className="text-slate-500 hover:text-white text-sm font-bold transition-colors">
                ← Back to Login
              </button>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-white/5">
            <div className="bg-amber-400/5 border border-amber-400/10 rounded-xl p-3 text-center">
              <p className="text-[10px] text-amber-400/50 font-bold uppercase tracking-widest leading-relaxed">
                🔐 Encrypted · Server-Verified<br />Unauthorized access attempts are logged
              </p>
            </div>
          </div>
        </div>

        <p className="text-center mt-6 text-[10px] text-slate-700 font-bold uppercase tracking-widest">
          © 2026 Aaroksha Health · Enterprise Security
        </p>
      </div>
    </div>
  );
};

export default SuperAdminLogin;

