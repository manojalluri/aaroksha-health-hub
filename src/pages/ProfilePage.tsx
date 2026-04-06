import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  User, Phone, MapPin, Edit3, X, Home, Calendar,
  FlaskConical, Pill, Clock, CheckCircle, AlertCircle,
  ChevronRight, Package, Stethoscope, TestTube, Heart,
  RotateCcw, LogOut, CreditCard, ShieldCheck, Truck,
  IndianRupee, KeyRound, Copy, Check,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface Profile {
  name: string;
  phone: string;
  address: string;
  email: string;
}

interface DoctorInfo {
  name: string; 
  specialty: string;
}

interface Appointment {
  id: string;
  patient_name: string;
  patient_phone: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  created_at: string;
  doctors?: DoctorInfo;
}

interface LabTest {
  name: string;
  price: number;
}

interface Medicine {
  name: string;
  price: number;
  dosage: string;
  qty?: number;
  available: boolean;
}

interface LabBooking {
  id: string;
  patient_name: string;
  patient_phone: string;
  tests: LabTest[];
  total_amount: number;
  appointment_date?: string;
  status: string;
  created_at: string;
}

interface Prescription {
  id: string;
  order_id?: string;
  patient_name: string;
  patient_phone: string;
  delivery_address: string;
  status: string;
  medicines: Medicine[];
  sub_total?: number;
  platform_fee?: number;
  delivery_fee?: number;
  grand_total?: number;
  payment_status?: string;
  delivery_code?: string;
  admin_note?: string;
  is_express_delivery?: boolean;
  created_at: string;
}

const statusColors: Record<string, { bg: string; text: string; label: string; emoji: string }> = {
  pending:    { bg: "#fef9c3", text: "#ca8a04",  label: "Pending Review",   emoji: "⏳" },
  confirmed:  { bg: "#dcfce7", text: "#16a34a",  label: "Confirmed",         emoji: "✅" },
  reviewed:   { bg: "#dbeafe", text: "#2563eb",  label: "Awaiting Payment",  emoji: "💬" },
  dispatched: { bg: "#ede9fe", text: "#7c3aed",  label: "Out for Delivery",  emoji: "🚚" },
  completed:  { bg: "#d1fae5", text: "#059669",  label: "Delivered",         emoji: "✅" },
  rejected:   { bg: "#fee2e2", text: "#dc2626",  label: "Rejected",          emoji: "❌" },
  cancelled:  { bg: "#f3f4f6", text: "#6b7280",  label: "Cancelled",         emoji: "🚫" },
};

const StatusBadge = ({ status }: { status: string }) => {
  const s = statusColors[status] || statusColors.pending;
  return (
    <span
      className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      <span>{s.emoji}</span> {s.label}
    </span>
  );
};

// Utility: generate a 6-char alphanumeric delivery code
const generateDeliveryCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

// Copy to clipboard helper hook
const useCopy = () => {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return { copied, copy };
};

const formatDate = (d: string) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

const ProfilePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<"appointments" | "labs" | "prescriptions">("appointments");
  const [editing, setEditing] = useState(false);

  const [profile, setProfile] = useState<Profile>(() => {
    const saved = localStorage.getItem("aaroksha_profile");
    return saved ? JSON.parse(saved) : { name: "", phone: "", address: "", email: "" };
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
    if (user && !profile.name) {
      setProfile({
        name: user.user_metadata?.full_name || "",
        phone: user.user_metadata?.phone_number || "",
        email: user.email || "",
        address: profile.address || ""
      });
    }
  }, [user, authLoading]);
  const [draft, setDraft] = useState<Profile>(profile);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [labBookings, setLabBookings] = useState<LabBooking[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  // Save profile to localStorage
  const saveProfile = () => {
    if (!draft.name || !draft.phone) {
      toast.error("Name and phone are required");
      return;
    }
    setProfile(draft);
    localStorage.setItem("aaroksha_profile", JSON.stringify(draft));
    setEditing(false);
    toast.success("Profile saved!");
    // Fetch bookings after profile is set
    fetchBookings(draft.phone);
  };

  const cancelEdit = () => {
    setDraft(profile);
    setEditing(false);
  };

  const fetchBookings = async (phone: string) => {
    if (!phone) return;
    setLoading(true);
    try {
      const [apptRes, labRes, rxRes] = await Promise.all([
        supabase.from("appointments").select("*, doctors(name, specialty)").eq("patient_phone", phone).order("created_at", { ascending: false }),
        supabase.from("lab_bookings").select("*").eq("patient_phone", phone).order("created_at", { ascending: false }),
        supabase.from("prescriptions").select("*").eq("patient_phone", phone).order("created_at", { ascending: false }),
      ]);
      if (apptRes.data) setAppointments(apptRes.data);
      if (labRes.data) setLabBookings(labRes.data);
      if (rxRes.data) setPrescriptions(rxRes.data);
    } catch {
      toast.error("Could not fetch booking history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile.phone) fetchBookings(profile.phone);
  }, []);

  // Handle Pay Now - generates delivery_code and marks payment_status = paid
  const handlePayNow = async (rx: Prescription) => {
    setPayingId(rx.id);
    try {
      const code = generateDeliveryCode();
      const { error } = await supabase
        .from("prescriptions")
        .update({ payment_status: "paid", delivery_code: code })
        .eq("id", rx.id);
      if (error) throw error;
      // Update local state immediately
      setPrescriptions((prev) =>
        prev.map((p) =>
          p.id === rx.id ? { ...p, payment_status: "paid", delivery_code: code } : p
        )
      );
      toast.success("Payment recorded! Your delivery code is ready.");
    } catch (err: any) {
      toast.error("Payment failed: " + (err?.message || "Unknown error"));
    } finally {
      setPayingId(null);
    }
  };

  // Bottom nav tabs
  const bottomNav = [
    { icon: Home, label: "Home", to: "/" },
    { icon: Calendar, label: "Booking", to: "/doctors" },
    { icon: FlaskConical, label: "Tests", to: "/lab-tests" },
    { icon: Pill, label: "Medicines", to: "/prescription" },
    { icon: User, label: "Profile", to: "/profile" },
  ];

  const initial = profile.name?.charAt(0)?.toUpperCase() || "?";
  const tabData = [
    { key: "appointments", label: "OP Bookings", icon: Stethoscope, count: appointments.length },
    { key: "labs", label: "Lab Tests", icon: TestTube, count: labBookings.length },
    { key: "prescriptions", label: "Medicines", icon: Package, count: prescriptions.length },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="flex items-center gap-3 px-4 pt-10 pb-4">
          <div className="h-9 w-9 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
            <Heart className="h-4 w-4 text-white" fill="white" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aaroksha Health Hub</p>
            <h1 className="text-lg font-black text-slate-800 leading-tight">My Profile</h1>
          </div>
          <button
            onClick={() => { setEditing(!editing); setDraft(profile); }}
            className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center"
          >
            {editing ? <X className="h-4 w-4 text-slate-600" /> : <Edit3 className="h-4 w-4 text-slate-600" />}
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 pt-5 pb-28 space-y-5">

        {/* ── Profile Card ── */}
        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
          {/* Top banner */}
          <div className="h-20 bg-gradient-to-r from-slate-800 to-slate-600 relative">
            <div className="absolute -bottom-8 left-5">
              <div className="h-16 w-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black text-2xl shadow-xl border-4 border-white">
                {initial}
              </div>
            </div>
          </div>
          <div className="pt-10 px-5 pb-5">
            {!editing ? (
              <>
                <h2 className="font-black text-slate-800 text-lg">{profile.name || "Add your name"}</h2>
                <p className="text-sm font-medium text-slate-400">{profile.phone || "Add phone number"}</p>

                <div className="mt-4 space-y-2.5">
                  {[
                    { icon: Phone, value: profile.phone, label: "Phone" },
                    { icon: MapPin, value: profile.address, label: "Address" },
                    { icon: User, value: profile.email, label: "Email" },
                  ].map(({ icon: Icon, value, label }) => (
                    value ? (
                      <div key={label} className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                          <Icon className="h-3.5 w-3.5 text-slate-500" />
                        </div>
                        <p className="text-sm font-medium text-slate-600">{value}</p>
                      </div>
                    ) : null
                  ))}
                </div>

                {!profile.name && (
                  <button
                    onClick={() => setEditing(true)}
                    className="mt-4 w-full rounded-xl bg-blue-600 py-3 text-xs font-black text-white shadow-md shadow-blue-200"
                  >
                    Set Up Profile →
                  </button>
                )}

                <button
                  onClick={async () => {
                    await signOut();
                    navigate("/auth");
                    toast.success("Logged out successfully");
                  }}
                  className="mt-4 w-full rounded-xl bg-red-50 py-3 text-[10px] font-black text-red-600 uppercase tracking-widest flex items-center justify-center gap-2 border border-red-100"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign Out
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Edit Profile</p>
                {[
                  { label: "Full Name *", key: "name", placeholder: "Your full name", icon: User },
                  { label: "Phone Number *", key: "phone", placeholder: "+91 XXXXX XXXXX", icon: Phone },
                  { label: "Delivery Address", key: "address", placeholder: "Home / flat address", icon: MapPin },
                  { label: "Email Address", key: "email", placeholder: "email@example.com", icon: User },
                ].map(({ label, key, placeholder, icon: Icon }) => (
                  <div key={key}>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">{label}</label>
                    <div className="relative">
                      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        value={draft[key as keyof Profile]}
                        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                        placeholder={placeholder}
                        className="w-full h-10 rounded-xl bg-slate-50 border border-slate-200 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-300 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all"
                      />
                    </div>
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button onClick={cancelEdit} className="py-3 rounded-xl border-2 border-slate-200 text-xs font-black text-slate-500">
                    Cancel
                  </button>
                  <button onClick={saveProfile} className="py-3 rounded-xl bg-blue-600 text-xs font-black text-white shadow-md shadow-blue-200">
                    Save Profile
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── No profile set ── */}
        {!profile.phone && !editing && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-black text-amber-700">Profile Not Set Up</p>
              <p className="text-xs font-medium text-amber-600 mt-0.5">
                Set up your profile with your phone number to view all your booking history.
              </p>
            </div>
          </div>
        )}

        {/* ── Booking History Section ── */}
        {profile.phone && (
          <>
            {/* Tab buttons */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-black text-slate-800">Booking History</h2>
                <button onClick={() => fetchBookings(profile.phone)} className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center">
                  <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                </button>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                {tabData.map(({ key, label, icon: Icon, count }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key as any)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-black whitespace-nowrap border transition-all ${
                      activeTab === key
                        ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200"
                        : "bg-white text-slate-500 border-slate-200"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${activeTab === key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-400"}`}>
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Loading */}
            {loading && (
              <div className="flex justify-center py-10">
                <div className="h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {/* ── OP Appointments ── */}
            {!loading && activeTab === "appointments" && (
              <div className="space-y-3">
                {appointments.length === 0 ? (
                  <EmptyState icon={Stethoscope} title="No Appointments Yet" subtitle="Book a doctor to see your history here" action={() => navigate("/doctors")} actionLabel="Book a Doctor" />
                ) : (
                  appointments.map((appt) => (
                    <div key={appt.id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                            <Stethoscope className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-black text-slate-800 text-sm">
                              {appt.doctors?.name || "Doctor Appointment"}
                            </p>
                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                              {appt.doctors?.specialty || "OP Consultation"}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={appt.status} />
                      </div>
                      <div className="flex items-center gap-4 pt-3 border-t border-slate-50">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          <p className="text-[10px] font-bold text-slate-500">{formatDate(appt.appointment_date)}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-slate-400" />
                          <p className="text-[10px] font-bold text-slate-500">{appt.appointment_time}</p>
                        </div>
                        <p className="text-[9px] font-bold text-slate-300 ml-auto">#{appt.id.slice(0, 8).toUpperCase()}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── Lab Bookings ── */}
            {!loading && activeTab === "labs" && (
              <div className="space-y-3">
                {labBookings.length === 0 ? (
                  <EmptyState icon={TestTube} title="No Lab Tests Yet" subtitle="Book a home lab test to see your history here" action={() => navigate("/lab-tests")} actionLabel="Book a Test" />
                ) : (
                  labBookings.map((booking) => {
                    const tests = Array.isArray(booking.tests) ? booking.tests : [];
                    return (
                      <div key={booking.id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                              <TestTube className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                              <p className="font-black text-slate-800 text-sm">
                                {tests.length} Test{tests.length !== 1 ? "s" : ""}
                              </p>
                              <p className="text-[10px] font-bold text-slate-400 max-w-[160px] truncate">
                                {tests.map((t) => t.name).join(", ")}
                              </p>
                            </div>
                          </div>
                          <StatusBadge status={booking.status} />
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            <p className="text-[10px] font-bold text-slate-500">{formatDate(booking.created_at)}</p>
                          </div>
                          <p className="font-black text-purple-600 text-sm">₹{booking.total_amount}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ── Prescriptions ── */}
            {!loading && activeTab === "prescriptions" && (
              <div className="space-y-4">
                {prescriptions.length === 0 ? (
                  <EmptyState icon={Package} title="No Orders Yet" subtitle="Upload a prescription to see your medicine orders here" action={() => navigate("/prescription")} actionLabel="Order Medicines" />
                ) : (
                  prescriptions.map((rx) => (
                    <PrescriptionCard
                      key={rx.id}
                      rx={rx}
                      onPayNow={() => handlePayNow(rx)}
                      paying={payingId === rx.id}
                    />
                  ))
                )}
              </div>
            )}
          </>
        )}



      </main>

      {/* ── Bottom Nav ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-100"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5">
          {bottomNav.map(({ icon: Icon, label, to }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={label}
                to={to}
                className={`flex flex-col items-center gap-1 py-3 transition-colors ${active ? "text-blue-600" : "text-slate-400"}`}
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

// Empty state helper
const EmptyState = ({
  icon: Icon, title, subtitle, action, actionLabel,
}: {
  icon: React.ElementType; title: string; subtitle: string; action: () => void; actionLabel: string;
}) => (
  <div className="bg-white rounded-2xl border border-slate-100 p-8 flex flex-col items-center text-center">
    <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
      <Icon className="h-7 w-7 text-slate-400" />
    </div>
    <p className="font-black text-slate-700 mb-1">{title}</p>
    <p className="text-xs font-medium text-slate-400 mb-5 max-w-xs">{subtitle}</p>
    <button onClick={action} className="px-5 py-2.5 rounded-xl bg-blue-600 text-xs font-black text-white shadow-md shadow-blue-200">
      {actionLabel}
    </button>
  </div>
);

// ── Prescription Order Card ──────────────────────────────────────────────────
const PrescriptionCard = ({
  rx,
  onPayNow,
  paying,
}: {
  rx: Prescription;
  onPayNow: () => void;
  paying: boolean;
}) => {
  const { copied, copy } = useCopy();
  const meds = Array.isArray(rx.medicines) ? rx.medicines : [];
  const availMeds = meds.filter((m) => m.available);
  const unavailMeds = meds.filter((m) => !m.available);
  const isPaid = rx.payment_status === "paid";
  const hasCode = isPaid && rx.delivery_code;
  const needsPay = rx.status === "reviewed" && !isPaid && rx.grand_total && rx.grand_total > 0;
  const isDispatched = rx.status === "dispatched";
  const isCompleted = rx.status === "completed";

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
            Order ID: {rx.order_id || rx.id.slice(0, 8).toUpperCase()}
          </p>
          <p className="text-[10px] font-bold text-slate-400 mt-0.5">
            <Calendar className="h-3 w-3 inline mr-1 text-slate-300" />
            {formatDate(rx.created_at)}
          </p>
        </div>
        <StatusBadge status={rx.status} />
      </div>

      {/* Express badge */}
      {rx.is_express_delivery && (
        <div className="mx-4 mb-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 flex items-center gap-2">
          <span className="text-base">⚡</span>
          <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider">Express Delivery</span>
        </div>
      )}

      {/* Pharmacist Review Stage */}
      {meds.length === 0 && rx.status === "pending" && (
        <div className="mx-4 mb-3 bg-amber-50 border border-amber-100 rounded-2xl p-3 flex items-center gap-2">
          <span className="text-base">⏳</span>
          <p className="text-xs font-bold text-amber-700">Pharmacist is reviewing your prescription</p>
        </div>
      )}

      {/* Rejection note */}
      {rx.status === "rejected" && rx.admin_note && (
        <div className="mx-4 mb-3 bg-red-50 border border-red-100 rounded-2xl p-3">
          <p className="text-[10px] font-black text-red-500 uppercase tracking-wider mb-1">Rejection Reason</p>
          <p className="text-xs font-medium text-red-700">{rx.admin_note}</p>
        </div>
      )}

      {/* Medicines List */}
      {meds.length > 0 && (
        <div className="mx-4 mb-3 rounded-2xl border border-slate-100 overflow-hidden">
          <div className="bg-slate-50 px-4 py-2 border-b border-slate-100">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              Pharmacist Details
            </p>
          </div>
          <div className="divide-y divide-slate-50">
            {availMeds.map((m, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-xs font-bold text-slate-700">{m.name}
                    <span className="text-slate-400 font-normal"> ({m.qty}x)</span>
                  </p>
                  {m.dosage && <p className="text-[10px] text-slate-400">{m.dosage}</p>}
                </div>
                <span className="text-sm font-black text-slate-700">₹{m.price}</span>
              </div>
            ))}
            {unavailMeds.map((m, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 opacity-50">
                <p className="text-xs font-bold text-slate-400 line-through">{m.name}</p>
                <span className="text-[9px] font-bold text-red-400 bg-red-50 px-2 py-0.5 rounded-full">Out of Stock</span>
              </div>
            ))}
          </div>

          {/* Bill summary */}
          {rx.grand_total && rx.grand_total > 0 && (
            <div className="bg-slate-50 border-t border-slate-100 px-4 py-3 space-y-1.5">
              {rx.sub_total != null && (
                <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                  <span>Medicines</span><span>₹{rx.sub_total}</span>
                </div>
              )}
              {rx.platform_fee != null && (
                <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                  <span>Platform Fee</span><span>₹{rx.platform_fee}</span>
                </div>
              )}
              {rx.delivery_fee != null && (
                <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                  <span>{rx.is_express_delivery ? "⚡ Express Delivery" : "Delivery Fee"}</span>
                  <span>₹{rx.delivery_fee}</span>
                </div>
              )}
              <div className="flex justify-between pt-1.5 border-t border-slate-200">
                <span className="text-sm font-black text-slate-800">Total Amount</span>
                <span className="text-base font-black text-emerald-600">₹{rx.grand_total}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delivery address */}
      {rx.delivery_address && (
        <div className="mx-4 mb-3 flex items-start gap-2">
          <MapPin className="h-3.5 w-3.5 text-slate-300 shrink-0 mt-0.5" />
          <p className="text-[10px] font-medium text-slate-400">{rx.delivery_address}</p>
        </div>
      )}

      {/* ── PAY NOW SECTION (shown when reviewed + not paid) ── */}
      {needsPay && (
        <div className="mx-4 mb-4 bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="h-9 w-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <CreditCard className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-black text-blue-800">Payment Required</p>
              <p className="text-[10px] font-medium text-blue-600">
                Pay ₹{rx.grand_total} to confirm your order and receive your delivery code
              </p>
            </div>
          </div>
          <button
            onClick={onPayNow}
            disabled={paying}
            className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm shadow-lg shadow-blue-200 flex items-center justify-center gap-2 transition-all disabled:opacity-70"
          >
            {paying ? (
              <><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing…</>
            ) : (
              <><IndianRupee className="h-4 w-4" /> Pay ₹{rx.grand_total} Now</>
            )}
          </button>
        </div>
      )}

      {/* ── DELIVERY CODE (shown after payment, when dispatched or completed) ── */}
      {hasCode && (isDispatched || isCompleted) && (
        <div className={`mx-4 mb-4 rounded-2xl p-4 border ${isCompleted ? "bg-emerald-50 border-emerald-200" : "bg-violet-50 border-violet-200"}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${isCompleted ? "bg-emerald-100" : "bg-violet-100"}`}>
              <KeyRound className={`h-4 w-4 ${isCompleted ? "text-emerald-600" : "text-violet-600"}`} />
            </div>
            <div>
              <p className={`text-[10px] font-black uppercase tracking-widest ${isCompleted ? "text-emerald-700" : "text-violet-700"}`}>
                {isCompleted ? "Order Delivered ✓" : "Delivery Confirmation Code"}
              </p>
              <p className={`text-[10px] font-medium ${isCompleted ? "text-emerald-600" : "text-violet-600"}`}>
                {isCompleted
                  ? "Your order has been successfully delivered"
                  : "Share this code with the delivery partner"}
              </p>
            </div>
          </div>

          {/* Code display */}
          <div
            className={`relative flex items-center justify-between rounded-2xl px-5 py-4 border-2 border-dashed cursor-pointer ${
              isCompleted ? "bg-emerald-100/50 border-emerald-300" : "bg-white border-violet-300"
            }`}
            onClick={() => copy(rx.delivery_code!)}
          >
            <div>
              <p className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${isCompleted ? "text-emerald-500" : "text-violet-500"}`}>
                Delivery Code
              </p>
              <p className={`text-3xl font-black tracking-[0.3em] ${isCompleted ? "text-emerald-700" : "text-violet-700"}`}>
                {rx.delivery_code}
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); copy(rx.delivery_code!); }}
              className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${
                copied
                  ? "bg-emerald-100 text-emerald-600"
                  : isCompleted ? "bg-emerald-200 text-emerald-700" : "bg-violet-100 text-violet-600"
              }`}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>

          {!isCompleted && (
            <div className="mt-3 flex items-start gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-violet-400 shrink-0 mt-0.5" />
              <p className="text-[10px] font-medium text-violet-600">
                The delivery partner must enter this code to mark your order as delivered.
                Do not share it until you receive your medicines.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Paid but not dispatched yet */}
      {isPaid && rx.status === "reviewed" && (
        <div className="mx-4 mb-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <p className="text-xs font-bold text-emerald-700">
            Payment confirmed! Your order is being prepared for dispatch.
          </p>
        </div>
      )}

      {/* Payment status for dispatched orders */}
      {isPaid && isDispatched && rx.delivery_code && (
        <div className="mx-4 mb-2 flex items-center gap-1.5">
          <Truck className="h-3.5 w-3.5 text-violet-400 shrink-0" />
          <p className="text-[10px] font-bold text-violet-600">Delivery partner is on the way</p>
        </div>
      )}

      <div className="h-4" />
    </div>
  );
};

export default ProfilePage;
