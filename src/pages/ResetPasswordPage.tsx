/**
 * ResetPasswordPage
 * ─────────────────────────────────────────────────────────────────
 * Customer-facing password reset page.
 * Supabase redirects here after the user clicks the reset link in their email.
 * Route: /reset-password
 *
 * Flow:
 *  1. User lands here from email link → Supabase exchanges hash token automatically
 *  2. onAuthStateChange fires with event === "PASSWORD_RECOVERY"
 *  3. User sets new password → supabase.auth.updateUser({ password })
 *  4. Auto sign-out + redirect to /auth
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Lock, Eye, EyeOff, Loader2, CheckCircle2,
  AlertTriangle, ShieldCheck, XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// ── Password strength helper ──────────────────────────────────────
type Strength = "weak" | "fair" | "good" | "strong";

function getStrength(pwd: string): Strength {
  if (pwd.length === 0) return "weak";
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return "weak";
  if (score === 2) return "fair";
  if (score === 3) return "good";
  return "strong";
}

const strengthConfig: Record<Strength, { label: string; color: string; bars: number }> = {
  weak:   { label: "Weak",   color: "bg-red-400",    bars: 1 },
  fair:   { label: "Fair",   color: "bg-amber-400",  bars: 2 },
  good:   { label: "Good",   color: "bg-blue-400",   bars: 3 },
  strong: { label: "Strong", color: "bg-emerald-500", bars: 4 },
};

// ─────────────────────────────────────────────────────────────────

type PageState = "verifying" | "ready" | "expired" | "done";

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [pageState,    setPageState]   = useState<PageState>("verifying");
  const [password,     setPassword]    = useState("");
  const [confirm,      setConfirm]     = useState("");
  const [showPass,     setShowPass]    = useState(false);
  const [showConfirm,  setShowConfirm] = useState(false);
  const [loading,      setLoading]     = useState(false);
  const [error,        setError]       = useState<string | null>(null);
  const [countdown,    setCountdown]   = useState(3);

  const strength = getStrength(password);
  const strengthInfo = strengthConfig[strength];
  const passwordsMatch = confirm.length > 0 && password === confirm;
  const passwordsMismatch = confirm.length > 0 && password !== confirm;

  // ── Token exchange: listen for Supabase PASSWORD_RECOVERY event ──
  useEffect(() => {
    // onAuthStateChange auto-exchanges the URL hash token
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setPageState("ready");
      }
    });

    // Safety: if a valid session already exists (e.g. page refresh mid-flow)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setPageState("ready");
    });

    // Timeout: if no recovery event fires in 8 seconds, mark as expired
    const expireTimer = setTimeout(() => {
      setPageState(prev => prev === "verifying" ? "expired" : prev);
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(expireTimer);
    };
  }, []);

  // ── Countdown after success ───────────────────────────────────────
  useEffect(() => {
    if (pageState !== "done") return;
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(interval);
          supabase.auth.signOut().finally(() => navigate("/auth", { replace: true }));
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pageState, navigate]);

  // ── Submit new password ───────────────────────────────────────────
  const handleReset = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) throw updateErr;

      toast.success("Password updated successfully! 🎉");
      setPageState("done");
    } catch (err: any) {
      const msg = err?.message || "Failed to reset password. Please try again.";
      setError(msg);
      toast.error("Password reset failed.");
      console.error("[ResetPasswordPage]", msg);
    } finally {
      setLoading(false);
    }
  }, [password, confirm]);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top accent strip */}
      <div className="h-1.5 bg-gradient-to-r from-blue-600 via-violet-500 to-blue-400" />

      <div className="flex-1 flex flex-col p-6 pt-12 max-w-sm mx-auto w-full">

        {/* Brand */}
        <div className="flex flex-col items-center mb-10 text-center">
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">AAROKSHA</h1>
          <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] mt-1">
            Health Hub · Bhimavaram
          </p>
        </div>

        {/* ── Verifying State ── */}
        {pageState === "verifying" && (
          <div className="flex flex-col items-center text-center gap-5 py-10">
            <div className="relative">
              <div className="h-20 w-20 rounded-full border-4 border-blue-100 flex items-center justify-center">
                <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
              </div>
            </div>
            <div>
              <p className="text-slate-700 font-black text-lg">Verifying reset link…</p>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                Please wait while we validate your secure link.
              </p>
            </div>
            <Link
              to="/auth"
              className="text-blue-500 hover:text-blue-700 text-sm font-bold underline underline-offset-2 transition-colors"
            >
              ← Back to Login
            </Link>
          </div>
        )}

        {/* ── Expired / Invalid Link State ── */}
        {pageState === "expired" && (
          <div className="flex flex-col items-center text-center gap-5 py-6">
            <div className="h-20 w-20 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center">
              <XCircle className="h-10 w-10 text-red-500" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800">Link Expired</h2>
              <p className="text-slate-400 text-sm mt-3 leading-relaxed">
                This password reset link is invalid or has expired.<br />
                Reset links are only valid for <strong>1 hour</strong>.
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 w-full text-left">
              <p className="text-[11px] text-amber-700 font-black mb-1">💡 What to do next?</p>
              <ul className="text-[11px] text-amber-600 space-y-1 leading-relaxed">
                <li>• Go back to login and click <strong>Forgot Password</strong> again</li>
                <li>• Check your inbox for the most recent reset email</li>
                <li>• Make sure to use the link within 1 hour</li>
              </ul>
            </div>
            <Link
              to="/auth"
              className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg shadow-blue-200 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              ← Back to Login
            </Link>
          </div>
        )}

        {/* ── Success State ── */}
        {pageState === "done" && (
          <div className="flex flex-col items-center text-center gap-5 py-6">
            <div className="h-20 w-20 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center animate-[bounceIn_0.5s_ease-out]">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800">Password Updated!</h2>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                Your password has been changed successfully.<br />
                Redirecting you to login in{" "}
                <span className="text-blue-600 font-black">{countdown}s</span>…
              </p>
            </div>
            {/* Progress bar */}
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                style={{ width: `${((3 - countdown) / 3) * 100}%` }}
              />
            </div>
            <Link
              to="/auth"
              className="text-blue-500 hover:text-blue-700 text-sm font-bold underline underline-offset-2 transition-colors"
            >
              Go to Login Now
            </Link>
          </div>
        )}

        {/* ── Reset Form ── */}
        {pageState === "ready" && (
          <>
            <div className="text-center mb-8">
              <div className="h-16 w-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="h-8 w-8 text-blue-500" />
              </div>
              <h2 className="text-2xl font-black text-slate-800">Set New Password</h2>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                Choose a strong new password for your account.
              </p>
            </div>

            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-red-600">{error}</p>
              </div>
            )}

            <form onSubmit={handleReset} className="space-y-4" autoComplete="new-password">

              {/* New Password */}
              <div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
                  <input
                    id="new-password"
                    type={showPass ? "text" : "password"}
                    required
                    placeholder="New Password *"
                    value={password}
                    autoComplete="new-password"
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-14 rounded-2xl bg-slate-50 border border-slate-200 pl-12 pr-12 text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Strength meter */}
                {password.length > 0 && (
                  <div className="mt-2 px-1">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3, 4].map(bar => (
                        <div
                          key={bar}
                          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                            bar <= strengthInfo.bars ? strengthInfo.color : "bg-slate-200"
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-[10px] font-black ${
                      strength === "weak"   ? "text-red-500"    :
                      strength === "fair"   ? "text-amber-500"  :
                      strength === "good"   ? "text-blue-500"   :
                      "text-emerald-600"
                    }`}>
                      {strengthInfo.label} password
                      {strength === "weak" && " — add uppercase, numbers, or symbols"}
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
                  <input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    required
                    placeholder="Confirm New Password *"
                    value={confirm}
                    autoComplete="new-password"
                    onChange={(e) => setConfirm(e.target.value)}
                    className={`w-full h-14 rounded-2xl bg-slate-50 border pl-12 pr-12 text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:bg-white focus:ring-2 transition-all outline-none ${
                      passwordsMismatch
                        ? "border-red-300 focus:border-red-300 focus:ring-red-100"
                        : passwordsMatch
                        ? "border-emerald-300 focus:border-emerald-300 focus:ring-emerald-100"
                        : "border-slate-200 focus:border-blue-300 focus:ring-blue-100"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                    aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Match indicator */}
                {confirm.length > 0 && (
                  <p className={`text-[11px] font-black pl-1 mt-1 ${
                    passwordsMatch ? "text-emerald-500" : "text-red-500"
                  }`}>
                    {passwordsMatch ? "✓ Passwords match" : "✗ Passwords don't match"}
                  </p>
                )}
              </div>

              <p className="text-[10px] text-slate-400 font-bold pl-1">
                Minimum 6 characters. Use a mix of letters, numbers &amp; symbols for a stronger password.
              </p>

              <button
                type="submit"
                disabled={loading || passwordsMismatch}
                id="reset-password-submit"
                className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black shadow-lg shadow-blue-200 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 mt-2"
              >
                {loading
                  ? <Loader2 className="h-5 w-5 animate-spin" />
                  : <><ShieldCheck className="h-5 w-5" /> Update Password</>}
              </button>
            </form>

            <Link
              to="/auth"
              className="block text-center text-slate-400 hover:text-slate-700 text-sm font-bold transition-colors mt-6"
            >
              ← Back to Login
            </Link>
          </>
        )}

      </div>
    </div>
  );
};

export default ResetPasswordPage;
