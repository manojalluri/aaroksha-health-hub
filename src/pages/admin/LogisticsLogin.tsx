import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Lock, Mail, ChevronRight, Truck, Loader2, Eye, EyeOff, ArrowLeft
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { createPartnerSession } from "@/lib/adminAuth";

const LogisticsLogin = () => {
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
        .eq("type", "logistics")
        .single();

      if (error || !partner) throw new Error("Invalid logistics credentials.");

      // ── NEW SECURITY MODEL: Create a server-side session ───────────────
      const sessionToken = await createPartnerSession(partner.partner_id, "logistics");
      if (!sessionToken) throw new Error("Could not initialize secure session. Please check DB connection.");

      // Fallback for UI names (non-security display only)
      localStorage.setItem("aaroksha_partner_session", JSON.stringify({
        id: partner.id, partner_id: partner.partner_id, name: partner.name, role: "logistics"
      }));

      toast.success(`Welcome ${partner.name}!`);
      navigate("/admin/logistics");
    } catch (err: any) {
      toast.error(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #3730a3 100%)" }}>
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #818cf8, transparent)" }} />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #6366f1, transparent)" }} />
        <div className="absolute top-1/4 right-1/3 w-48 h-48 rounded-full opacity-5" style={{ background: "radial-gradient(circle, #c7d2fe, transparent)" }} />
      </div>

      <div className="relative z-10 w-full max-w-md px-6 py-10 mx-auto">
        {/* Back link */}
        <Link to="/" className="inline-flex items-center gap-2 text-indigo-300 hover:text-white text-sm font-medium mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="relative mb-6">
            <div
              className="h-20 w-20 rounded-3xl flex items-center justify-center shadow-2xl border border-indigo-400/20"
              style={{ background: "linear-gradient(135deg, #4f46e5, #4338ca)" }}
            >
              <Truck className="h-10 w-10 text-white" />
            </div>
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-indigo-400 rounded-full border-2 border-slate-900 animate-pulse" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Logistics Portal</h1>
          <p className="text-indigo-300 text-[11px] font-bold uppercase tracking-[0.2em] mt-2">Aaroksha Health · Delivery</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-8 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest pl-1">Partner Email</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="logistics@aaroksha.com"
                  className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-white text-sm font-medium placeholder:text-slate-600 focus:border-indigo-400/60 focus:bg-white/10 outline-none transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest pl-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type={showPass ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-12 text-white text-sm font-medium placeholder:text-slate-600 focus:border-indigo-400/60 focus:bg-white/10 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-400 transition-colors"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="button" className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors">
                Forgot Password?
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 text-white font-black rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 mt-2"
              style={{ background: loading ? "#4338ca" : "linear-gradient(135deg, #4f46e5, #4338ca)", boxShadow: "0 10px 40px rgba(79,70,229,0.4)" }}
            >
              {loading
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : <><span>Sign In to Logistics Portal</span><ChevronRight className="h-5 w-5" /></>}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
          © 2026 Aaroksha Health · All Rights Reserved
        </p>
      </div>
    </div>
  );
};

export default LogisticsLogin;
