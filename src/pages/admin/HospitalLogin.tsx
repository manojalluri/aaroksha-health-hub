import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Lock, Mail, ChevronRight, Loader2, Eye, EyeOff, ArrowLeft, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { authenticatePartner, createPartnerSession, checkIsLoggedIn, isRateLimited, recordFailedAttempt, clearAttempts } from "@/lib/adminAuth";

const HospitalLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [lockoutMsg, setLockoutMsg] = useState<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    checkIsLoggedIn("hospital").then(ok => { if (ok) navigate("/admin/hospital"); });
  }, [navigate]);
  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);

  const startLockoutCountdown = (waitMs: number) => {
    let remaining = Math.ceil(waitMs / 1000);
    setLockoutMsg(`Too many attempts. Try again in ${remaining}s.`);
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) { clearInterval(countdownRef.current!); setLockoutMsg(null); }
      else setLockoutMsg(`Too many attempts. Try again in ${remaining}s.`);
    }, 1000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.toLowerCase().trim();
    const limitCheck = isRateLimited(cleanEmail);
    if (limitCheck.blocked) { startLockoutCountdown(limitCheck.waitMs); return; }

    setLoading(true);
    try {
      // Authenticate via RPC (bcrypt) with plaintext fallback
      const partner = await authenticatePartner(cleanEmail, password, "hospital");
      if (!partner) throw new Error("Authentication failed");

      const token = await createPartnerSession(partner.partner_id, "hospital");
      if (!token) throw new Error("Session could not be created.");

      clearAttempts(cleanEmail);
      toast.success(`Welcome back, ${partner.name}!`);
      navigate("/admin/hospital");
    } catch {
      const { blocked, waitMs } = recordFailedAttempt(cleanEmail);
      if (blocked) { startLockoutCountdown(waitMs); toast.error("Account temporarily locked."); }
      else toast.error("Invalid credentials or account inactive.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1d4ed8 100%)" }}>
      {/* Animated background circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #60a5fa, transparent)" }} />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #3b82f6, transparent)" }} />
        <div className="absolute top-1/2 left-1/4 w-64 h-64 rounded-full opacity-5" style={{ background: "radial-gradient(circle, #93c5fd, transparent)" }} />
        {/* Medical cross grid */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="hosp-grid" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
              <rect x="32" y="20" width="16" height="40" fill="white" rx="3" />
              <rect x="20" y="32" width="40" height="16" fill="white" rx="3" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hosp-grid)" />
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-md px-6 py-10 mx-auto">
        {/* Back link */}
        <Link to="/" className="inline-flex items-center gap-2 text-blue-300 hover:text-white text-sm font-medium mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">

          <h1 className="text-3xl font-black text-white tracking-tight">Hospital Portal</h1>
          <p className="text-blue-300 text-[11px] font-bold uppercase tracking-[0.2em] mt-2">Aaroksha Health · Hospital Admin</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-8 shadow-2xl">
          {/* Lockout banner */}
          {lockoutMsg && (
            <div className="mb-5 flex items-center gap-3 bg-red-900/30 border border-red-500/30 rounded-xl px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
              <p className="text-xs font-bold text-red-300">{lockoutMsg}</p>
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-blue-300 uppercase tracking-widest pl-1">Hospital Email</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!!lockoutMsg}
                  placeholder="hospital@aaroksha.com"
                  className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-white text-sm font-medium placeholder:text-slate-600 focus:border-blue-400/60 focus:bg-white/10 outline-none transition-all disabled:opacity-40"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-blue-300 uppercase tracking-widest pl-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                <input
                  type={showPass ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={!!lockoutMsg}
                  placeholder="••••••••"
                  className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-12 text-white text-sm font-medium placeholder:text-slate-600 focus:border-blue-400/60 focus:bg-white/10 outline-none transition-all disabled:opacity-40"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-400 transition-colors"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !!lockoutMsg}
              className="w-full h-14 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl shadow-xl shadow-blue-900/50 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 mt-2"
              style={{ background: loading ? undefined : "linear-gradient(135deg, #2563eb, #1d4ed8)" }}
            >
              {loading
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : <><span>Sign In to Hospital Portal</span><ChevronRight className="h-5 w-5" /></>}
            </button>
          </form>

          {/* Stats Footer */}
          <div className="mt-8 pt-6 border-t border-white/5 grid grid-cols-3 gap-3 text-center">
            {[
              { val: "24/7", label: "Uptime" },
              { val: "256-bit", label: "Encrypted" },
              { val: "ISO 27001", label: "Certified" },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-sm font-black text-white">{item.val}</p>
                <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center mt-6 text-[10px] text-slate-600 font-bold uppercase tracking-widest">
          © 2026 Aaroksha Health · All Rights Reserved
        </p>
      </div>
    </div>
  );
};

export default HospitalLogin;
