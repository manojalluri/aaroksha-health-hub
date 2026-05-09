/**
 * ResetPasswordPage
 * ─────────────────────────────────────────────────────────────────
 * Customer-facing password reset page.
 * Supabase redirects here after the user clicks the reset link in their email.
 * Route: /reset-password
 */
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [password,    setPassword]    = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [done,        setDone]        = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // Supabase embeds the recovery token in the URL hash — auto-exchanges to session
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setSessionReady(true);
      }
    });

    // Also check if a session is already present (e.g. page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
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
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setDone(true);
      toast.success("Password updated successfully! 🎉");

      // Sign out and redirect to login after 3 seconds
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate("/auth", { replace: true });
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Failed to reset password. Please try again.");
      toast.error("Password reset failed.");
    } finally {
      setLoading(false);
    }
  };

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

        {/* ── Success State ── */}
        {done ? (
          <div className="flex flex-col items-center text-center gap-5 py-6">
            <div className="h-20 w-20 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800">Password Updated!</h2>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                Your password has been changed successfully.<br />
                Redirecting you to login in 3 seconds...
              </p>
            </div>
            <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
            <Link to="/auth" className="text-blue-500 hover:text-blue-700 text-sm font-bold underline underline-offset-2">
              Go to Login Now
            </Link>
          </div>

        ) : !sessionReady ? (
          /* Waiting for Supabase to exchange the token */
          <div className="flex flex-col items-center text-center gap-5 py-10">
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
            <div>
              <p className="text-slate-700 font-black text-lg">Verifying reset link...</p>
              <p className="text-slate-400 text-sm mt-2">
                If this takes too long, your link may have expired.
              </p>
            </div>
            <Link
              to="/auth"
              className="text-blue-500 hover:text-blue-700 text-sm font-bold underline underline-offset-2"
            >
              ← Back to Login
            </Link>
          </div>

        ) : (
          /* ── Reset Form ── */
          <>
            <div className="text-center mb-8">
              <div className="h-16 w-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="h-8 w-8 text-blue-500" />
              </div>
              <h2 className="text-2xl font-black text-slate-800">Set New Password</h2>
              <p className="text-slate-400 text-sm mt-2">Choose a strong new password for your account.</p>
            </div>

            {/* Error banner */}
            {error && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                <p className="text-xs font-bold text-red-600">{error}</p>
              </div>
            )}

            <form onSubmit={handleReset} className="space-y-4">
              {/* New Password */}
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
                <input
                  id="new-password"
                  type={showPass ? "text" : "password"}
                  required
                  placeholder="New Password *"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-14 rounded-2xl bg-slate-50 border border-slate-200 pl-12 pr-12 text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Confirm Password */}
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
                <input
                  id="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  required
                  placeholder="Confirm New Password *"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full h-14 rounded-2xl bg-slate-50 border border-slate-200 pl-12 pr-12 text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Password match indicator */}
              {confirm.length > 0 && (
                <p className={`text-[11px] font-bold pl-1 ${password === confirm ? "text-emerald-500" : "text-red-500"}`}>
                  {password === confirm ? "✓ Passwords match" : "✗ Passwords don't match"}
                </p>
              )}

              <p className="text-[10px] text-slate-400 font-bold pl-1">
                Minimum 6 characters
              </p>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg shadow-blue-200 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 mt-2"
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
