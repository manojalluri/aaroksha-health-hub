import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Lock, Mail, ChevronRight, Pill, Loader2, Eye, EyeOff, ArrowLeft
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

import { createPartnerSession } from "@/lib/adminAuth";

const PharmacyLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: partner, error } = await supabase
        .from("partners")
        .select("*")
        .eq("email", email)
        .eq("password", password)
        .eq("type", "pharmacy")
        .single();

      if (error || !partner) throw new Error("Invalid pharmacy credentials.");

      // ── NEW SECURITY MODEL: Create a server-side session ───────────────
      const sessionToken = await createPartnerSession(partner.partner_id, "pharmacy");
      if (!sessionToken) throw new Error("Could not initialize secure session. Please check DB connection.");

      // Fallback for UI names (non-critical, strictly for display)
      localStorage.setItem("aaroksha_partner_session", JSON.stringify({
        id: partner.id, partner_id: partner.partner_id, name: partner.name, role: "pharmacy"
      }));

      toast.success(`Welcome ${partner.name}!`);
      navigate("/admin/pharmacy");
    } catch (err: any) {
      toast.error(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center" style={{ background: "linear-gradient(135deg, #052e16 0%, #064e3b 50%, #065f46 100%)" }}>
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #34d399, transparent)" }} />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #10b981, transparent)" }} />
        <div className="absolute top-1/4 right-1/3 w-48 h-48 rounded-full opacity-5" style={{ background: "radial-gradient(circle, #6ee7b7, transparent)" }} />
        {/* Pill/capsule pattern */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="pharm-pills" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
              <rect x="15" y="30" width="50" height="20" rx="10" fill="none" stroke="white" strokeWidth="1" />
              <line x1="40" y1="30" x2="40" y2="50" stroke="white" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#pharm-pills)" />
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-md px-6 py-10 mx-auto">
        {/* Back link */}
        <Link to="/" className="inline-flex items-center gap-2 text-emerald-300 hover:text-white text-sm font-medium mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="relative mb-6">
            <div
              className="h-20 w-20 rounded-3xl flex items-center justify-center shadow-2xl border border-emerald-400/20"
              style={{ background: "linear-gradient(135deg, #059669, #047857)" }}
            >
              <Pill className="h-10 w-10 text-white" />
            </div>
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-emerald-400 rounded-full border-2 border-slate-900 animate-pulse" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Pharmacy Portal</h1>
          <p className="text-emerald-300 text-[11px] font-bold uppercase tracking-[0.2em] mt-2">Aaroksha Health · Pharmacy Admin</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-8 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-emerald-300 uppercase tracking-widest pl-1">Pharmacy Email</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="pharmacy@aaroksha.com"
                  className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-white text-sm font-medium placeholder:text-slate-600 focus:border-emerald-400/60 focus:bg-white/10 outline-none transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-emerald-300 uppercase tracking-widest pl-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                <input
                  type={showPass ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-12 text-white text-sm font-medium placeholder:text-slate-600 focus:border-emerald-400/60 focus:bg-white/10 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-emerald-400 transition-colors"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="button" className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors">
                Forgot Password?
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 text-white font-black rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 mt-2"
              style={{ background: loading ? "#047857" : "linear-gradient(135deg, #059669, #047857)", boxShadow: "0 10px 40px rgba(5,150,105,0.4)" }}
            >
              {loading
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : <><span>Sign In to Pharmacy Portal</span><ChevronRight className="h-5 w-5" /></>}
            </button>
          </form>

          {/* Stats Footer */}
          <div className="mt-8 pt-6 border-t border-white/5 grid grid-cols-3 gap-3 text-center">
            {[
              { val: "10,000+", label: "Medicines" },
              { val: "GMP", label: "Certified" },
              { val: "Same Day", label: "Delivery" },
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

export default PharmacyLogin;
