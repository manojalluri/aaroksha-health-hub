import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Lock, Mail, ChevronRight, ShieldCheck, Loader2, Eye, EyeOff, ArrowLeft
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { checkIsLoggedIn } from "@/lib/adminAuth";

const SuperAdminLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    checkIsLoggedIn("super").then(ok => ok && navigate("/admin/super"));
  }, [navigate]);

  const ALLOWED_EMAILS = ["manojalluri2727@gmail.com", "super@aaroksha.com", "admin@aaroksha.com"];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!ALLOWED_EMAILS.includes(email.toLowerCase())) {
      toast.error("Unauthorized: This email is not on the administrative whitelist.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      
      const role = data.user?.user_metadata?.role;
      const userEmail = data.user?.email;

      // Allow access if specified as 'super' role OR if it's the primary administrative email
      const isSuper = role === "super" || userEmail === "manojalluri2727@gmail.com" || userEmail === "super@aaroksha.com" || userEmail === "admin@aaroksha.com";

      if (isSuper) {
        navigate("/admin/super");
      } else {
        toast.error("Access denied. This portal is for Super Admins only.");
      }
    } catch (err: any) {
      toast.error(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center" style={{ background: "linear-gradient(135deg, #020617 0%, #0f172a 50%, #1e293b 100%)" }}>
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 right-0 w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #f59e0b, transparent)" }} />
        <div className="absolute bottom-0 -left-24 w-80 h-80 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #d97706, transparent)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full opacity-[0.03]" style={{ background: "radial-gradient(circle, #fff, transparent)" }} />
        {/* Shield/hexagon pattern */}
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
        {/* Back link */}
        <Link to="/" className="inline-flex items-center gap-2 text-amber-400 hover:text-white text-sm font-medium mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">

          <h1 className="text-3xl font-black text-white tracking-tight">Super Admin</h1>
          <p className="text-amber-400/70 text-[11px] font-bold uppercase tracking-[0.2em] mt-2">Aaroksha Health · Platform Control</p>
          {/* Security badge */}
          <div className="mt-3 flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 px-4 py-1.5 rounded-full">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Level 5 Clearance Required</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-8 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-amber-400/70 uppercase tracking-widest pl-1">Admin Email</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-amber-400 transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="super@aaroksha.com"
                  className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-white text-sm font-medium placeholder:text-slate-600 focus:border-amber-400/60 focus:bg-white/10 outline-none transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-amber-400/70 uppercase tracking-widest pl-1">Master Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-amber-400 transition-colors" />
                <input
                  type={showPass ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-12 text-white text-sm font-medium placeholder:text-slate-600 focus:border-amber-400/60 focus:bg-white/10 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-amber-400 transition-colors"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="button" className="text-[11px] font-bold text-amber-400/70 hover:text-amber-300 transition-colors">
                Reset Access
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 mt-2"
              style={{
                background: loading ? "#b45309" : "linear-gradient(135deg, #d97706, #92400e)",
                boxShadow: "0 10px 40px rgba(180,83,9,0.4)"
              }}
            >
              {loading
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : <><span>Access Control Panel</span><ChevronRight className="h-5 w-5" /></>}
            </button>
          </form>

          {/* Stats Footer */}
          <div className="mt-8 pt-6 border-t border-white/5">
            <div className="grid grid-cols-3 gap-3 text-center mb-5">
              {[
                { val: "Zero Trust", label: "Architecture" },
                { val: "MFA", label: "Ready" },
                { val: "SOC 2", label: "Type II" },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-sm font-black text-amber-400">{item.val}</p>
                  <p className="text-[9px] uppercase tracking-widest text-slate-600 font-bold mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>
            <div className="bg-amber-400/5 border border-amber-400/10 rounded-xl p-3 text-center">
              <p className="text-[10px] text-amber-400/50 font-bold uppercase tracking-widest">
                ⚠️ All access attempts are logged and audited
              </p>
            </div>
          </div>
        </div>

        <p className="text-center mt-6 text-[10px] text-slate-700 font-bold uppercase tracking-widest">
          © 2026 Aaroksha Health · Restricted Access
        </p>
      </div>
    </div>
  );
};

export default SuperAdminLogin;
