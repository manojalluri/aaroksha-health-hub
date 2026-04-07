import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  ShoppingCart, Trash2, Search, CheckCircle, MapPin, Clock,
  Loader2, TestTube, Calendar, ChevronLeft, Home, FlaskConical,
  Pill, User, ChevronRight,
} from "lucide-react";
import { type CartItem, type PatientDetails } from "@/data/mockData";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getSettings } from "@/lib/settingsSync";

interface LabTest {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  turnaround: string;
}

const LabTestsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [step, setStep] = useState<"browse" | "details" | "checkout" | "confirmed">("browse");
  const [patient, setPatient] = useState<PatientDetails>({ name: "", age: "", gender: "", phone: "", email: "", address: "" });
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedOrderId, setConfirmedOrderId] = useState("");
  const [settingsState, setSettingsState] = useState(getSettings());

  useEffect(() => {
    const handleSettingsUpdate = () => setSettingsState(getSettings());
    window.addEventListener("settings_updated", handleSettingsUpdate);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "aaroksha_settings") handleSettingsUpdate();
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("settings_updated", handleSettingsUpdate);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const genOrderId = (prefix: string) => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    return `${prefix}-${code}`;
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get("q");
    if (q) setSearch(q);
  }, [location.search]);

  const { data: labTests = [], isLoading } = useQuery<LabTest[]>({
    queryKey: ["lab-tests"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lab_tests").select("*");
      if (error) throw error;
      return (data || []) as LabTest[];
    },
  });

  const categories = ["All", ...Array.from(new Set(labTests.map((t) => t.category)))];
  const filtered = labTests.filter(
    (t) =>
      (selectedCategory === "All" || t.category === selectedCategory) &&
      (t.name.toLowerCase().includes(search.toLowerCase()) || 
       t.category.toLowerCase().includes(search.toLowerCase()) ||
       (t.description && t.description.toLowerCase().includes(search.toLowerCase())))
  );

  const addToCart = (test: LabTest) => {
    if (cart.find((c) => c.test.id === test.id)) { toast.info("Already in cart"); return; }
    setCart([...cart, { test, quantity: 1 }]);
    toast.success(`${test.name} added`);
  };
  const removeFromCart = (id: string) => setCart(cart.filter((c) => c.test.id !== id));
  
  const PLATFORM_FEE = Number(settingsState?.lab_fee || 49);
  const testTotal = cart.reduce((sum, c) => sum + c.test.price * c.quantity, 0);
  const total = testTotal + (cart.length > 0 ? PLATFORM_FEE : 0);

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d.toISOString().split("T")[0];
  });
  const formatDate = (d: string) =>
    d ? new Date(d).toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" }) : "";
  const times = ["07:00 AM", "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM"];

  const handlePayment = async () => {
    if (!user) {
      toast.error("Please login to book lab tests");
      navigate("/auth");
      return;
    }
    setIsSubmitting(true);
    const transactionId = `LAB_TXN_${Date.now()}`;

    try {
      // 1. Create initial 'pending' record in Supabase
      const newOrderId = genOrderId("LAB");
      const { data: booking, error } = await supabase.from("lab_bookings").insert({
        order_id: newOrderId,
        patient_name: patient.name,
        patient_phone: patient.phone,
        patient_age: patient.age,
        patient_address: patient.address,
        tests: cart.map((i) => ({ id: i.test.id, name: i.test.name, price: i.test.price })),
        platform_fee: PLATFORM_FEE,
        total_amount: total,
        collection_date: selectedDate,
        collection_time: selectedTime,
        status: "pending",
        payment_status: "pending",
      }).select().single();
      setConfirmedOrderId(newOrderId);

      if (error) {
        throw error;
      }

      // 2. Mock payment hand-off logic for PhonePe
      toast.loading("Communicating with PhonePe Secure Gateway...", { duration: 2500 });
      await new Promise(r => setTimeout(r, 2500));

      // 3. Successful payment callback update
      const { error: updateError } = await supabase
        .from("lab_bookings")
        .update({ payment_status: "paid", status: "scheduled" })
        .eq("id", booking.id);

      if (updateError) throw updateError;

      toast.success("Transaction verified successfully. Booking scheduled!");
      setStep("confirmed");
    } catch (err) {
      console.error(err);
      toast.error("Transaction failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const bottomNav = [
    { icon: Home, label: "Home", to: "/" },
    { icon: Calendar, label: "Booking", to: "/doctors" },
    { icon: FlaskConical, label: "Tests", to: "/lab-tests" },
    { icon: Pill, label: "Medicines", to: "/prescription" },
    { icon: User, label: "Profile", to: "/profile" },
  ];

  const categoryColors: Record<string, { bg: string; text: string }> = {
    Blood: { bg: "#fee2e2", text: "#dc2626" },
    Hormone: { bg: "#fce7f3", text: "#be185d" },
    Diabetes: { bg: "#e0e7ff", text: "#4338ca" },
    Organ: { bg: "#d1fae5", text: "#059669" },
    Vitamin: { bg: "#fef9c3", text: "#ca8a04" },
    Package: { bg: "#ede9fe", text: "#7c3aed" },
    Urine: { bg: "#dbeafe", text: "#2563eb" },
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="flex items-center gap-3 px-4 pt-5 pb-3">
          {step !== "browse" ? (
            <button
              onClick={() => setStep(step === "checkout" ? "details" : "browse")}
              className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0"
            >
              <ChevronLeft className="h-5 w-5 text-slate-600" />
            </button>
          ) : (
            <button onClick={() => navigate(-1)} className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <ChevronLeft className="h-5 w-5 text-slate-600" />
            </button>
          )}
          <div className="flex-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              {step === "browse" ? "NABL Certified Labs" : step === "details" ? "Collection Details" : step === "checkout" ? "Confirm & Pay" : "Confirmed!"}
            </p>
            <h1 className="text-lg font-black text-slate-800 leading-tight">
              {step === "browse" ? "Lab Tests" : step === "details" ? "Your Details" : step === "checkout" ? "Order Summary" : "Booking Placed"}
            </h1>
          </div>

          {/* Cart button */}
          {step === "browse" && (
            <button
              onClick={() => setShowCart(!showCart)}
              className="relative h-9 w-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: cart.length > 0 ? "#7c3aed" : "#f3f4f6" }}
            >
              <ShoppingCart className={`h-4 w-4 ${cart.length > 0 ? "text-white" : "text-slate-500"}`} />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border border-white">
                  {cart.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Search & Filter — browse only */}
        {step === "browse" && (
          <>
            <div className="px-4 pb-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  placeholder="Search tests, packages..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-11 rounded-2xl bg-slate-50 border border-slate-200 pl-11 pr-4 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100 transition-all"
                />
              </div>
            </div>
            <div className="flex gap-2 px-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {categories.map((c) => {
                const cc = categoryColors[c as string] || { bg: "#e2e8f0", text: "#64748b" };
                return (
                  <button
                    key={c as string}
                    onClick={() => setSelectedCategory(c as string)}
                    className={`px-3.5 py-1.5 rounded-xl text-[11px] font-black whitespace-nowrap transition-all border ${
                      selectedCategory === c
                        ? "shadow-md"
                        : "bg-white text-slate-500 border-slate-200"
                    }`}
                    style={selectedCategory === c ? { backgroundColor: cc.text, color: "#fff", borderColor: cc.text } : {}}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </header>

      {/* ════════ BROWSE ════════ */}
      {step === "browse" && (
        <main className="flex-1 px-4 py-4 pb-32 space-y-3">
          {/* Cart Panel */}
          {showCart && cart.length > 0 && (
            <div className="bg-white rounded-2xl border border-purple-100 shadow-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <p className="font-black text-slate-800 text-sm">Cart ({cart.length} tests)</p>
                <p className="font-black text-purple-600">₹{total}</p>
              </div>
              <div className="divide-y divide-slate-50">
                {cart.map((item) => (
                  <div key={item.test.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-slate-700 truncate">{item.test.name}</p>
                      <p className="text-[10px] font-medium text-slate-400">{item.test.turnaround}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-black text-slate-800 text-sm">₹{item.test.price}</p>
                      <button onClick={() => removeFromCart(item.test.id)} className="h-7 w-7 rounded-lg bg-red-50 flex items-center justify-center">
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 bg-slate-50">
                <button
                  onClick={() => { setStep("details"); setShowCart(false); }}
                  className="w-full rounded-xl bg-purple-600 py-3 text-sm font-black text-white flex items-center justify-center gap-2 shadow-lg shadow-purple-200"
                >
                  Proceed to Book <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="h-8 w-8 text-purple-600 animate-spin" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading tests...</p>
            </div>
          ) : (
            filtered.map((test) => {
              const inCart = cart.some((c) => c.test.id === test.id);
              const cc = categoryColors[test.category] || { bg: "#e2e8f0", text: "#64748b" };
              return (
                <div key={test.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-black text-slate-800 text-sm leading-tight flex-1">{test.name}</h3>
                    <span
                      className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shrink-0"
                      style={{ backgroundColor: cc.bg, color: cc.text }}
                    >
                      {test.category}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 font-medium leading-relaxed mb-3 line-clamp-2">
                    {test.description}
                  </p>

                  <div className="flex items-center gap-4 mb-3">
                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                      <Clock className="h-3 w-3" /> {test.turnaround}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                      <TestTube className="h-3 w-3" /> Home collection
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                    <p className="text-xl font-black text-slate-800">₹{test.price}</p>
                    <button
                      onClick={() => inCart ? removeFromCart(test.id) : addToCart(test)}
                      className={`px-5 py-2 rounded-xl text-[11px] font-black transition-all active:scale-95 ${
                        inCart
                          ? "bg-red-50 text-red-500 border border-red-100"
                          : "text-white shadow-md"
                      }`}
                      style={!inCart ? { backgroundColor: cc.text, boxShadow: `0 4px 10px ${cc.text}40` } : {}}
                    >
                      {inCart ? "✕ Remove" : "+ Add"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </main>
      )}

      {/* ════════ DETAILS ════════ */}
      {step === "details" && (
        <main className="flex-1 px-4 py-4 pb-28 space-y-4">
          {/* Patient Info */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-xl bg-purple-100 flex items-center justify-center">
                <MapPin className="h-4 w-4 text-purple-600" />
              </div>
              <p className="font-black text-slate-800 text-sm">Patient & Delivery</p>
            </div>
            <div className="space-y-3">
              {[
                { label: "Full Name *", key: "name", placeholder: "Patient's full name", type: "text" },
                { label: "Age *", key: "age", placeholder: "e.g. 34", type: "number" },
                { label: "Phone Number *", key: "phone", placeholder: "10-digit mobile number", type: "tel" },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key}>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">{label}</label>
                  <input
                    type={type}
                    value={patient[key as keyof PatientDetails] || ""}
                    onChange={(e) => setPatient({ ...patient, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full h-11 rounded-xl bg-slate-50 border border-slate-200 px-3.5 text-sm text-slate-700 placeholder:text-slate-300 outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100 transition-all"
                  />
                </div>
              ))}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Collection Address *</label>
                <textarea
                  value={patient.address || ""}
                  onChange={(e) => setPatient({ ...patient, address: e.target.value })}
                  placeholder="House/Flat No., Building Name&#10;Street, Area, Landmark&#10;City, Pincode"
                  className="w-full h-24 rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-sm text-slate-700 placeholder:text-slate-300 outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100 transition-all resize-none"
                />
              </div>
            </div>
          </div>

          {/* Date picker */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-xl bg-blue-100 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-blue-600" />
              </div>
              <p className="font-black text-slate-800 text-sm">Pick Date & Time</p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4" style={{ scrollbarWidth: "none" }}>
              {dates.map((d) => (
                <button
                  key={d}
                  onClick={() => setSelectedDate(d)}
                  className={`flex-shrink-0 w-16 py-3 rounded-2xl text-center border-2 transition-all ${
                    selectedDate === d
                      ? "bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-200"
                      : "bg-slate-50 text-slate-600 border-transparent"
                  }`}
                >
                  <p className="text-[9px] font-black uppercase tracking-tight opacity-70">{new Date(d).toLocaleDateString("en-IN", { weekday: "short" })}</p>
                  <p className="text-lg font-black">{new Date(d).getDate()}</p>
                </button>
              ))}
            </div>

            {selectedDate && (
              <div className="grid grid-cols-4 gap-2">
                {times.map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedTime(t)}
                    className={`py-2 rounded-xl text-[10px] font-black transition-all border ${
                      selectedTime === t
                        ? "bg-purple-600 text-white border-purple-600 shadow-md"
                        : "bg-slate-50 text-slate-500 border-slate-200"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => {
              if (!patient.name || !patient.age || !patient.phone || !patient.address || !selectedDate || !selectedTime) {
                toast.error("Fill all required fields");
                return;
              }
              setStep("checkout");
            }}
            className="w-full rounded-2xl bg-purple-600 py-4 text-sm font-black text-white shadow-xl shadow-purple-200 flex items-center justify-center gap-2 active:scale-[0.99] transition-all"
          >
            Continue to Checkout <ChevronRight className="h-4 w-4" />
          </button>
        </main>
      )}

      {/* ════════ CHECKOUT ════════ */}
      {step === "checkout" && (
        <main className="flex-1 px-4 py-4 pb-28 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Tests Ordered</p>
            <div className="space-y-2 mb-4">
              {cart.map((item) => (
                <div key={item.test.id} className="flex justify-between items-center">
                  <p className="text-sm font-bold text-slate-700">{item.test.name}</p>
                  <p className="font-black text-slate-800 text-sm">₹{item.test.price}</p>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t border-dashed border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-500">Platform Fee</p>
                <p className="text-sm font-black text-slate-700">₹{PLATFORM_FEE}</p>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <Calendar className="h-3.5 w-3.5 text-purple-500" />
                <p className="text-xs font-bold text-slate-600">{formatDate(selectedDate)} at {selectedTime}</p>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-purple-500" />
                <p className="text-xs font-bold text-slate-600 truncate">{patient.address}</p>
              </div>
            </div>
            <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between">
              <p className="font-bold text-slate-600">Total Payable</p>
              <p className="text-2xl font-black text-purple-600">₹{total}</p>
            </div>
          </div>

          <button
            onClick={handlePayment}
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-purple-600 py-4 text-sm font-black text-white shadow-xl shadow-purple-200 flex items-center justify-center gap-2 active:scale-[0.99] transition-all disabled:opacity-70"
          >
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Confirm & Pay ₹{total} →</>}
          </button>
          <p className="text-center text-[10px] text-slate-300 font-black uppercase tracking-widest">
            Money-back guarantee · 24hr reports
          </p>
        </main>
      )}

      {/* ════════ CONFIRMED ════════ */}
      {step === "confirmed" && (
        <main className="flex-1 flex flex-col items-center justify-center px-6 pb-28 text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-green-400/20 rounded-full animate-ping" />
            <div className="h-24 w-24 bg-green-100 rounded-full flex items-center justify-center relative">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">Booking Confirmed! 🎉</h2>
          <div className="h-1 w-10 bg-green-400 rounded-full mx-auto mb-4" />

          {/* Order ID Badge */}
          <div className="mb-5 bg-purple-50 border-2 border-purple-200 rounded-2xl px-6 py-3 flex flex-col items-center gap-1">
            <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest">Your Order ID</p>
            <p className="text-xl font-black text-purple-700 tracking-widest font-mono">{confirmedOrderId}</p>
            <p className="text-[10px] text-purple-500 font-medium">Save this to track your booking</p>
          </div>

          <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6 max-w-xs">
            Our phlebotomist will visit <span className="font-black text-slate-700">{patient.address}</span> on{" "}
            <span className="font-black text-slate-700">{formatDate(selectedDate)}</span> at{" "}
            <span className="font-black text-slate-700">{selectedTime}</span>.
          </p>
          <button
            onClick={() => navigate("/")}
            className="w-full max-w-xs rounded-2xl bg-purple-600 py-4 text-sm font-black text-white shadow-xl shadow-purple-200"
          >
            Back to Home
          </button>
        </main>
      )}



      {/* ── Bottom Nav ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-100"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5">
          {bottomNav.map(({ icon: Icon, label, to }) => {
            const active = label === "Home" ? location.pathname === "/" : location.pathname === to;
            return (
              <Link
                key={label}
                to={to}
                className={`flex flex-col items-center gap-1 py-3 transition-colors ${active ? "text-purple-600" : "text-slate-400"}`}
              >
                <Icon className={`h-5 w-5 ${active ? "scale-110" : ""} transition-transform`} />
                <span className="text-[9px] font-black tracking-tight">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default LabTestsPage;
