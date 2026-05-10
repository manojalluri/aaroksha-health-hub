import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Lock, Mail, ChevronRight, Loader2, Eye, EyeOff, ArrowLeft, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { authenticatePartner, createPartnerSession, checkIsLoggedIn, isRateLimited, recordFailedAttempt, clearAttempts } from "@/lib/adminAuth";

const LogisticsLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [lockoutMsg, setLockoutMsg] = useState<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    checkIsLoggedIn("logistics").then(ok => { if (ok) navigate("/admin/logistics"); });
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
      const partner = await authenticatePartner(cleanEmail, password, "logistics");
      if (!partner) throw new Error("Authentication failed");

      const token = await createPartnerSession(partner.partner_id, "logistics");
      if (!token) throw new Error("Session could not be created.");

      clearAttempts(cleanEmail);
      toast.success(`Welcome ${partner.name}!`);
      navigate("/admin/logistics");
    } catch {
      const { blocked, waitMs } = recordFailedAttempt(cleanEmail);
      if (blocked) { startLockoutCountdown(waitMs); toast.error("Account temporarily locked."); }
      else toast.error("Invalid credentials or account inactive.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)" }}>
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #38bdf8, transparent)" }} />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #0ea5e9, transparent)" }} />
        <div className="absolute top-1/4 right-1/3 w-48 h-48 rounded-full opacity-5" style={{ background: "radial-gradient(circle, #7dd3fc, transparent)" }} />
        {/* Truck/road pattern */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="logistics-pattern" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
              <path d="M10 50 L90 50 M30 50 L30 30 L70 30 L70 50" stroke="white" strokeWidth="1" fill="none" />
              <circle cx="40" cy="55" r="5" stroke="white" strokeWidth="1" fill="none" />
              <circle cx="60" cy="55" r="5" stroke="white" strokeWidth="1" fill="none" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#logistics-pattern)" />
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-md px-6 py-10 mx-auto">
        {/* Back link */}
        <Link to="/" className="inline-flex items-center gap-2 text-sky-400 hover:text-white text-sm font-medium mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">

          <h1 className="text-3xl font-black text-white tracking-tight">Logistics Portal</h1>
          <p className="text-sky-300 text-[11px] font-bold uppercase tracking-[0.2em] mt-2">Aaroksha Health · Delivery Partner</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-8 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-sky-300 uppercase tracking-widest pl-1">Partner Email</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-sky-400 transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="logistics@aaroksha.com"
                  className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-white text-sm font-medium placeholder:text-slate-600 focus:border-sky-400/60 focus:bg-white/10 outline-none transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-sky-300 uppercase tracking-widest pl-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-sky-400 transition-colors" />
                <input
                  type={showPass ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-12 text-white text-sm font-medium placeholder:text-slate-600 focus:border-sky-400/60 focus:bg-white/10 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-sky-400 transition-colors"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 text-white font-black rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 mt-2"
              style={{ background: loading ? "#0284c7" : "linear-gradient(135deg, #0ea5e9, #0284c7)", boxShadow: "0 10px 40px rgba(14,165,233,0.4)" }}
            >
              {loading
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : <><span>Sign In to Logistics Portal</span><ChevronRight className="h-5 w-5" /></>}
            </button>
          </form>

          {/* Stats Footer */}
          <div className="mt-8 pt-6 border-t border-white/5 grid grid-cols-3 gap-3 text-center">
            {[
              { val: "24/7", label: "Availability" },
              { val: "FAST", label: "Shipping" },
              { val: "SECURE", label: "Handling" },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-sm font-black text-white">{item.val}</p>
                <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center mt-6 text-[10px] text-slate-600 font-bold uppercase tracking-widest">
          © 2026 Aaroksha Health · Logistics Platform
        </p>
      </div>
    </div>
  );
};

export default LogisticsLogin;
