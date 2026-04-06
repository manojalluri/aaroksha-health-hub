import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Lock, Mail, ChevronRight, Stethoscope, Loader2, Eye, EyeOff, ArrowLeft
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { createPartnerSession } from "@/lib/adminAuth";

const HospitalLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Step 1: Verify against partners table
      const { data: partner, error } = await supabase
        .from("partners")
        .select("id, partner_id, name, type")
        .eq("email", email)
        .eq("password", password)
        .eq("type", "hospital")
        .single();

      if (error || !partner) {
        throw new Error("Invalid credentials or unauthorized portal.");
      }

      // Step 2: Create a secure, DB-backed session token (sessionStorage only)
      const token = await createPartnerSession(partner.partner_id, "hospital");
      if (!token) throw new Error("Session could not be created. Try again.");

      toast.success(`Welcome back, ${partner.name}!`);
      navigate("/admin/hospital");
    } catch (err: any) {
      toast.error(err.message || "Invalid credentials");
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
          <div className="relative mb-6">
            <div className="h-20 w-20 bg-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-900/60 border border-blue-400/30">
              <Stethoscope className="h-10 w-10 text-white" />
            </div>
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-emerald-400 rounded-full border-2 border-slate-900 animate-pulse" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Hospital Portal</h1>
          <p className="text-blue-300 text-[11px] font-bold uppercase tracking-[0.2em] mt-2">Aaroksha Health · Hospital Admin</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-8 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-blue-300 uppercase tracking-widest pl-1">Hospital Email</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hospital@aaroksha.com"
                  className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-white text-sm font-medium placeholder:text-slate-600 focus:border-blue-400/60 focus:bg-white/10 outline-none transition-all"
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-12 text-white text-sm font-medium placeholder:text-slate-600 focus:border-blue-400/60 focus:bg-white/10 outline-none transition-all"
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

            <div className="flex justify-end">
              <button type="button" className="text-[11px] font-bold text-blue-400 hover:text-blue-300 transition-colors">
                Forgot Password?
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
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
