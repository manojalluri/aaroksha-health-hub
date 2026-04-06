import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Phone, Lock, User, Heart, ArrowRight, Loader2, CheckCircle, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const AuthPage = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [loading, setLoading] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !phone || !password) {
      toast.error("Please fill all fields");
      return;
    }
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name, phone_number: phone }
        }
      });

      if (error) throw error;

      toast.success("Account created successfully!");
      navigate(-1); // Go back to whatever they were trying to book
    } catch (err: any) {
      toast.error(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Enter email and password");
      return;
    }
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Welcome back!");
      navigate(-1); // Back to previous page (likely the booking page)
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col p-6 pt-20">
      {/* ── Brand ── */}
      <div className="flex flex-col items-center mb-10 text-center">
        <div className="h-24 w-24 flex items-center justify-center mb-5 animate-bounce-slow">
          <img src="/logo.png" alt="Aaroksha Logo" className="h-full w-full object-contain drop-shadow-lg" />
        </div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">AAROKSHA</h1>
        <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] mt-1">Health Hub · Hyderabad</p>
      </div>

        <div className="max-w-sm mx-auto w-full flex-1 flex flex-col">
          {/* Tabs */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8">
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${mode === "signup" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400"}`}
            >
              Create Account
            </button>
            <button
              onClick={() => setMode("login")}
              className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${mode === "login" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400"}`}
            >
              Log In
            </button>
          </div>

          {/* Form */}
          <form onSubmit={mode === "signup" ? handleSignup : handleLogin} className="space-y-4">
            {mode === "signup" && (
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  placeholder="Your Full Name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-14 rounded-2xl bg-slate-50 border border-slate-200 pl-12 pr-4 text-sm font-bold text-slate-700 focus:border-blue-300 focus:bg-white transition-all outline-none"
                />
              </div>
            )}

            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="email"
                placeholder="Email Address"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-14 rounded-2xl bg-slate-50 border border-slate-200 pl-12 pr-4 text-sm font-bold text-slate-700 focus:border-blue-300 focus:bg-white transition-all outline-none"
              />
            </div>

            {mode === "signup" && (
              <div className="relative group">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  placeholder="Mobile Phone Number"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-14 rounded-2xl bg-slate-50 border border-slate-200 pl-12 pr-4 text-sm font-bold text-slate-700 focus:border-blue-300 focus:bg-white transition-all outline-none"
                />
              </div>
            )}

            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="password"
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-14 rounded-2xl bg-slate-50 border border-slate-200 pl-12 pr-4 text-sm font-bold text-slate-700 focus:border-blue-300 focus:bg-white transition-all outline-none"
              />
            </div>

            <button
              disabled={loading}
              className="w-full h-14 rounded-2xl bg-blue-600 text-white font-black shadow-lg shadow-blue-200 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 mt-4"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : mode === "signup" ? "Create Account" : "Log In"}
            </button>
          </form>

          {/* Perks */}
          <div className="mt-10 grid grid-cols-3 gap-3">
            {[
              { label: "Book OP", icon: CheckCircle },
              { label: "Labs", icon: CheckCircle },
              { label: "Medics", icon: CheckCircle },
            ].map((p, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <p.icon className="h-4 w-4 text-blue-600" />
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-tight">{p.label}</p>
              </div>
            ))}
          </div>

          <p className="text-center text-[10px] text-slate-400 font-bold mt-10 max-w-[240px] mx-auto leading-relaxed">
            By joining AAROKSHA, you agree to our <span className="text-slate-800">Terms of Service</span> and <span className="text-slate-800">Privacy Policy</span>.
          </p>
        </div>
    </div>
  );
};

export default AuthPage;
