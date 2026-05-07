import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mail, Phone, Lock, User, Loader2, CheckCircle,
  Eye, EyeOff, MapPin,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// ─── Field component MUST be outside AuthPage to avoid focus-loss on re-render
interface FieldProps {
  icon: React.ElementType;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  action?: React.ReactNode;
  required?: boolean;
}

const Field = ({
  icon: Icon, type = "text", placeholder, value, onChange, action, required,
}: FieldProps) => (
  <div className="relative group">
    <Icon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      required={required}
      onChange={e => onChange(e.target.value)}
      className="w-full h-14 rounded-2xl bg-slate-50 border border-slate-200 pl-12 pr-12 text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all outline-none"
    />
    {action && (
      <div className="absolute right-4 top-1/2 -translate-y-1/2">{action}</div>
    )}
  </div>
);
// ─────────────────────────────────────────────────────────────────────────────

const AuthPage = () => {
  const navigate = useNavigate();
  const [mode, setMode]       = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  // Form fields
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [phone,    setPhone]    = useState("");
  const [address,  setAddress]  = useState("");
  const [password, setPassword] = useState("");

  // ── Sync profile to localStorage after auth ────────────────────────────
  const syncProfileToLocal = (userData: any, extraAddress = "") => {
    const existing = (() => {
      try { return JSON.parse(localStorage.getItem("aaroksha_profile") || "{}"); } catch { return {}; }
    })();
    const profile = {
      name:    userData?.user_metadata?.full_name  || existing.name    || "",
      phone:   userData?.user_metadata?.phone_number || existing.phone  || "",
      email:   userData?.email                      || existing.email   || "",
      address: extraAddress || existing.address     || "",
    };
    localStorage.setItem("aaroksha_profile", JSON.stringify(profile));
  };

  // ── Sign Up ───────────────────────────────────────────────────────────
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim() || !password) {
      toast.error("Please fill all required fields");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim(), phone_number: phone.trim() } },
      });
      if (error) throw error;

      if (data.user) {
        // Persist to profiles table
        await supabase.from("profiles").upsert({
          id:        data.user.id,
          full_name: name.trim(),
          email:     email.trim(),
          phone:     phone.trim(),
          address:   address.trim(),
        }, { onConflict: "id" });

        syncProfileToLocal(data.user, address.trim());
      }

      toast.success("Account created! Welcome to Aaroksha 🎉");
      navigate(-1);
    } catch (err: any) {
      if (err.message?.includes("already registered") || err.message?.includes("already exists")) {
        toast.error("Email already registered — please log in");
        setMode("login");
      } else {
        toast.error(err.message || "Signup failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Log In ────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Enter your email and password");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      if (data.user) {
        // Load full profile from DB and sync to localStorage
        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .single();

        if (prof) {
          localStorage.setItem("aaroksha_profile", JSON.stringify({
            name:    prof.full_name || data.user.user_metadata?.full_name || "",
            phone:   prof.phone    || data.user.user_metadata?.phone_number || "",
            email:   prof.email    || data.user.email || "",
            address: prof.address  || "",
            town:    prof.town     || "",
            pincode: prof.pincode  || "",
          }));
        } else {
          syncProfileToLocal(data.user);
        }
      }

      toast.success("Welcome back! 👋");
      navigate(-1);
    } catch (err: any) {
      if (err.message?.includes("Invalid login credentials")) {
        toast.error("Wrong email or password — please try again");
      } else {
        toast.error(err.message || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: "login" | "signup") => {
    setMode(m);
    setName(""); setEmail(""); setPhone("");
    setAddress(""); setPassword(""); setShowPwd(false);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top accent strip */}
      <div className="h-1.5 bg-gradient-to-r from-blue-600 via-violet-500 to-blue-400" />

      <div className="flex-1 flex flex-col p-6 pt-12 max-w-sm mx-auto w-full">

        {/* ── Brand ── */}
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="h-16 w-16 rounded-3xl bg-blue-600 flex items-center justify-center mb-4 shadow-xl shadow-blue-200">
            <span className="text-white font-black text-2xl">A</span>
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">AAROKSHA</h1>
          <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] mt-1">
            Health Hub · Bhimavaram
          </p>
        </div>

        {/* ── Mode Tabs ── */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8">
          {(["login", "signup"] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${
                mode === m ? "bg-white text-blue-600 shadow-sm" : "text-slate-400"
              }`}
            >
              {m === "login" ? "Log In" : "Create Account"}
            </button>
          ))}
        </div>

        {/* ── Form ── */}
        <form
          onSubmit={mode === "signup" ? handleSignup : handleLogin}
          className="space-y-3"
          autoComplete="on"
        >
          {mode === "signup" && (
            <Field
              icon={User}
              placeholder="Your Full Name *"
              value={name}
              onChange={setName}
              required
            />
          )}

          <Field
            icon={Mail}
            type="email"
            placeholder="Email Address *"
            value={email}
            onChange={setEmail}
            required
          />

          {mode === "signup" && (
            <Field
              icon={Phone}
              type="tel"
              placeholder="Phone Number *"
              value={phone}
              onChange={setPhone}
              required
            />
          )}

          {mode === "signup" && (
            <Field
              icon={MapPin}
              placeholder="Delivery Address (optional)"
              value={address}
              onChange={setAddress}
            />
          )}

          <Field
            icon={Lock}
            type={showPwd ? "text" : "password"}
            placeholder="Password *"
            value={password}
            onChange={setPassword}
            required
            action={
              <button
                type="button"
                onClick={() => setShowPwd(p => !p)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />

          {mode === "signup" && (
            <p className="text-[10px] text-slate-400 font-bold pl-1">
              Password must be at least 6 characters
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black shadow-lg shadow-blue-200 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 mt-2"
          >
            {loading
              ? <Loader2 className="h-5 w-5 animate-spin" />
              : mode === "signup" ? "Create Account →" : "Log In →"}
          </button>
        </form>

        {/* ── Switch mode link ── */}
        <p className="text-center text-xs font-bold text-slate-400 mt-5">
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => switchMode(mode === "login" ? "signup" : "login")}
            className="text-blue-600 underline underline-offset-2 font-black"
          >
            {mode === "login" ? "Sign Up" : "Log In"}
          </button>
        </p>

        {/* ── Feature pills ── */}
        <div className="mt-10 grid grid-cols-3 gap-3">
          {[
            { label: "Book Doctor", icon: CheckCircle },
            { label: "Lab Tests",   icon: CheckCircle },
            { label: "Medicines",   icon: CheckCircle },
          ].map((p, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-blue-50 border border-blue-100"
            >
              <p.icon className="h-4 w-4 text-blue-500" />
              <span className="text-[10px] font-black text-blue-700 uppercase tracking-tight text-center">
                {p.label}
              </span>
            </div>
          ))}
        </div>

        <p className="text-center text-[10px] text-slate-400 font-medium mt-8 max-w-[240px] mx-auto leading-relaxed">
          By joining, you agree to our{" "}
          <span className="text-slate-600 font-bold">Terms of Service</span> and{" "}
          <span className="text-slate-600 font-bold">Privacy Policy</span>.
        </p>

      </div>
    </div>
  );
};

export default AuthPage;
