/**
 * SuperAdminResetPassword
 * ─────────────────────────────────────────────────────────────────
 * This page is the destination for the Supabase password reset email.
 * When the admin clicks the reset link in their email, Supabase redirects
 * them here with a token in the URL hash. This page lets them set a new password.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Eye, EyeOff, ShieldCheck, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const SuperAdminResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");
  const [showPass, setShowPass]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [done, setDone]             = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Supabase embeds the token in the URL hash — it auto-exchanges to a session.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setSessionReady(true);
      }
    });
    
    // Check if we already have a session (in case user refreshed the page)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
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
      toast.success("Password updated successfully!");
      // Sign out and redirect to login after 3 seconds
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate("/admin/login/super", { replace: true });
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Failed to reset password. Try again.");
      toast.error("Password reset failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden flex items-center justify-center"
      style={{ background: "linear-gradient(135deg, #020617 0%, #0f172a 50%, #1e293b 100%)" }}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 right-0 w-96 h-96 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #f59e0b, transparent)" }} />
        <div className="absolute bottom-0 -left-24 w-80 h-80 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #d97706, transparent)" }} />
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="hex-bg" x="0" y="0" width="80" height="90" patternUnits="userSpaceOnUse">
              <polygon points="40,5 70,22 70,68 40,85 10,68 10,22" fill="none" stroke="white" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hex-bg)" />
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-md px-6 py-10 mx-auto">
        {/* Header */}
        <div className="flex flex-col items-center mb-10">
          <div className="h-16 w-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-5">
            <ShieldCheck className="h-8 w-8 text-amber-400" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            {done ? "Password Updated!" : "Set New Password"}
          </h1>
          <p className="text-amber-400/70 text-[11px] font-bold uppercase tracking-[0.2em] mt-2">
            Aaroksha Health · Super Admin
          </p>
        </div>

        <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-8 shadow-2xl">
          {/* Success state */}
          {done ? (
            <div className="flex flex-col items-center text-center gap-5 py-4">
              <div className="h-20 w-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              </div>
              <div>
                <p className="text-white font-black text-lg">Password Changed!</p>
                <p className="text-slate-400 text-sm mt-2">
                  Your new password is active. Redirecting you to login in 3 seconds...
                </p>
              </div>
              <Loader2 className="h-5 w-5 text-amber-400 animate-spin" />
            </div>
          ) : !sessionReady ? (
            /* Session not yet established */
            <div className="flex flex-col items-center text-center gap-5 py-8">
              <Loader2 className="h-10 w-10 text-amber-400 animate-spin" />
              <p className="text-slate-400 text-sm font-bold">Verifying reset link...</p>
              <p className="text-slate-600 text-xs mt-1">
                If this takes too long, your link may have expired.{" "}
                <button
                  onClick={() => navigate("/admin/login/super")}
                  className="text-amber-400 underline hover:text-amber-300"
                >
                  Go back to login
                </button>
              </p>
            </div>
          ) : (
            /* Password reset form */
            <form onSubmit={handleReset} className="space-y-5">
              <p className="text-slate-400 text-sm">
                Choose a strong new password for your Super Admin account.
              </p>

              {/* Error banner */}
              {error && (
                <div className="flex items-center gap-3 bg-red-900/30 border border-red-500/30 rounded-xl px-4 py-3">
                  <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                  <p className="text-xs font-bold text-red-300">{error}</p>
                </div>
              )}

              {/* New Password */}
              <div className="space-y-2">
                <label htmlFor="new-password" className="text-[10px] font-black text-amber-400/70 uppercase tracking-widest pl-1">
                  New Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-amber-400 transition-colors" />
                  <input
                    id="new-password"
                    type={showPass ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-12 text-white text-sm font-medium outline-none focus:border-amber-400/60 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-amber-400"
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <label htmlFor="confirm-password" className="text-[10px] font-black text-amber-400/70 uppercase tracking-widest pl-1">
                  Confirm New Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-amber-400 transition-colors" />
                  <input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-12 text-white text-sm font-medium outline-none focus:border-amber-400/60 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-amber-400"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {/* Match indicator */}
                {confirm && (
                  <p className={`text-[10px] font-bold pl-1 ${password === confirm ? "text-emerald-400" : "text-red-400"}`}>
                    {password === confirm ? "✓ Passwords match" : "✗ Passwords don't match"}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 mt-2"
                style={{ background: "linear-gradient(135deg, #d97706, #92400e)", boxShadow: "0 10px 40px rgba(180,83,9,0.3)" }}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><ShieldCheck className="h-5 w-5" /><span>Update Password</span></>}
              </button>

              <button
                type="button"
                onClick={() => navigate("/admin/login/super")}
                className="w-full text-slate-500 hover:text-white text-sm font-bold transition-colors py-2 text-center"
              >
                ← Back to Login
              </button>
            </form>
          )}
        </div>

        <p className="text-center mt-6 text-[10px] text-slate-700 font-bold uppercase tracking-widest">
          © 2026 Aaroksha Health · Enterprise Security
        </p>
      </div>
    </div>
  );
};

export default SuperAdminResetPassword;
