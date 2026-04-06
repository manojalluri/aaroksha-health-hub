import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { verifyPartnerSession, clearAdminSession, revokePartnerSession } from "@/lib/adminAuth";
import { 
  Search, Plus, Edit, Trash2, Eye, CheckCircle2, AlertTriangle, X, Clock, Filter, 
  ChevronDown, Loader2, Users, Calendar, TrendingUp, LogOut, Pill, Building2 
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Types ────────────────────────────────────────────────────────────────────
interface HospitalDoctor {
  id: string;
  name: string;
  specialty: string;
  experience: number;
  rating: number;
  fee: number;
  image_url: string;
  available: boolean;
  hospital_id?: string;
  hospital_name?: string;
  partner_id?: string;
}

interface HospitalAppointment {
  id: string;
  order_id?: string;
  patient_name: string;
  patient_phone: string;
  patient_age?: number;
  patient_gender?: string;
  doctor_name: string;
  doctor_id?: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  payment_status: string;
  consultation_fee: number;
  notes?: string;
  booked_at?: string;
  hospital_partner_id?: string;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const cfg: Record<string, { label: string; cls: string }> = {
    confirmed:  { label: "confirmed",  cls: "bg-blue-500 text-white" },
    completed:  { label: "completed",  cls: "bg-gray-200 text-gray-600" },
    no_show:    { label: "no show",    cls: "bg-red-100 text-red-500" },
    pending:    { label: "pending",    cls: "bg-amber-100 text-amber-700" },
    cancelled:  { label: "cancelled",  cls: "bg-gray-100 text-gray-500" },
  };
  const { label, cls } = cfg[status] ?? { label: status, cls: "bg-gray-100 text-gray-500" };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold capitalize ${cls}`}>
      {label}
    </span>
  );
};

// ─── Time Slots Tab ───────────────────────────────────────────────────────────
const TimeSlotsTab = ({ doctors }: { doctors: HospitalDoctor[] }) => {
  const [selectedDoctor, setSelectedDoctor] = useState<string>(doctors[0]?.id || "");
  const [slots, setSlots] = useState<Record<string, string[]>>({});
  const [newSlot, setNewSlot] = useState("");

  const DEFAULT_TIME_SLOTS = [
    "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM",
    "11:00 AM", "11:30 AM", "12:00 PM", "02:00 PM",
    "02:30 PM", "03:00 PM", "03:30 PM", "04:00 PM",
    "04:30 PM", "05:00 PM",
  ];

  const doctor = doctors.find((d) => d.id === selectedDoctor);
  const docSlots = slots[selectedDoctor] || DEFAULT_TIME_SLOTS;

  const addSlot = () => {
    if (!newSlot.trim()) return;
    setSlots((prev) => ({ ...prev, [selectedDoctor]: [...(prev[selectedDoctor] || DEFAULT_TIME_SLOTS), newSlot.trim()] }));
    setNewSlot("");
    toast.success("Slot added");
  };

  const removeSlot = (slot: string) => {
    setSlots((prev) => ({ ...prev, [selectedDoctor]: (prev[selectedDoctor] || DEFAULT_TIME_SLOTS).filter((s) => s !== slot) }));
    toast.success("Slot removed");
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Clock className="h-5 w-5 text-blue-600" />
        <h2 className="text-lg font-bold text-gray-800">Manage Time Slots</h2>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-64 space-y-2 shrink-0">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Select Doctor</p>
          {doctors.map((doc) => (
            <button
              key={doc.id}
              onClick={() => setSelectedDoctor(doc.id)}
              className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 ${
                selectedDoctor === doc.id
                  ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                  : "bg-white border border-gray-200 text-gray-700 hover:border-blue-300"
              }`}
            >
              <div className="h-8 w-8 rounded-lg bg-gray-50 flex items-center justify-center text-xl">👨‍⚕️</div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold truncate ${selectedDoctor === doc.id ? "text-white" : "text-gray-800"}`}>{doc.name}</p>
                <p className={`text-[11px] truncate ${selectedDoctor === doc.id ? "text-blue-100" : "text-gray-400"}`}>{doc.specialty}</p>
              </div>
            </button>
          ))}
        </div>

        {doctor && (
          <div className="flex-1 bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-800">{doctor.name}</h3>
                <p className="text-xs text-gray-400">{docSlots.length} time slots configured</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={newSlot}
                  onChange={(e) => setNewSlot(e.target.value)}
                  placeholder="e.g. 06:00 AM"
                  className="h-9 w-32 text-sm border border-gray-200 rounded-lg px-3 focus:outline-none focus:border-blue-400"
                  onKeyDown={(e) => { if (e.key === "Enter") addSlot(); }}
                />
                <button
                  onClick={addSlot}
                  className="h-9 px-4 rounded-lg bg-blue-600 text-white text-sm font-bold flex items-center gap-1.5 hover:bg-blue-700 transition-all"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {docSlots.map((slot) => (
                  <div
                    key={slot}
                    className="flex items-center justify-between px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 group hover:border-red-200 hover:bg-red-50 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-sm font-semibold text-gray-700">{slot}</span>
                    </div>
                    <button
                      onClick={() => removeSlot(slot)}
                      className="h-5 w-5 rounded flex items-center justify-center text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const HospitalDashboard = () => {
  const navigate = useNavigate();
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(true);
  const queryClient = useQueryClient();

  // ─── SECURITY GUARD ────────────────────────────────────────────────────────
  useEffect(() => {
    async function checkAuth() {
      const ok = await verifyPartnerSession("hospital");
      if (!ok) {
        toast.error("Unauthorized: Session expired or invalid");
        clearAdminSession();
        navigate("/admin/login/hospital");
      } else {
        const raw = sessionStorage.getItem("aaroksha_admin_token");
        // Get partnerId from admin_sessions if needed, but local fallback for now
        const customSession = localStorage.getItem("aaroksha_partner_session");
        if (customSession) {
          setPartnerId(JSON.parse(customSession).partner_id);
        }
      }
      setIsVerifying(false);
    }
    checkAuth();
  }, [navigate]);

  const [activeTab, setActiveTab] = useState<"appointments" | "doctors" | "timeslots">("appointments");
  const [aptSearch, setAptSearch] = useState("");
  const [docSearch, setDocSearch] = useState("");

  const { data: partnerProfile } = useQuery({
    queryKey: ["partner-profile", partnerId],
    queryFn: async () => {
      if (!partnerId) return null;
      const { data, error } = await supabase.from("partners").select("*").eq("partner_id", partnerId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!partnerId
  });

  const { data: doctors = [], isLoading: isDocsLoading } = useQuery<HospitalDoctor[]>({
    queryKey: ["admin-doctors", partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data } = await supabase.from("doctors").select("*").eq("partner_id", partnerId);
      return (data || []) as HospitalDoctor[];
    },
    enabled: !!partnerId
  });

  const { data: appointments = [], isLoading: isAptsLoading } = useQuery<HospitalAppointment[]>({
    queryKey: ["admin-appointments", partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data } = await supabase.from("appointments").select("*").eq("hospital_partner_id", partnerId).order("appointment_date", { ascending: false });
      return (data || []) as HospitalAppointment[];
    },
    enabled: !!partnerId
  });

  if (isVerifying) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-900">
      <Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-4" />
      <p className="text-white font-black text-sm uppercase tracking-widest">Hospital Partner</p>
      <p className="text-slate-500 text-[10px] mt-2 tracking-[0.2em]">Verifying Secure Session...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-100 flex items-center justify-between px-8 py-4 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-gray-900">{partnerProfile?.name || "Hospital Dashboard"}</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Aaroksha Partner Panel</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <nav className="flex items-center bg-gray-50 p-1 rounded-xl border border-gray-100">
            {[
              { id: "appointments", label: "Appointments", icon: <Calendar className="h-3.5 w-3.5" /> },
              { id: "doctors",      label: "Doctors",      icon: <Users className="h-3.5 w-3.5" /> },
              { id: "timeslots",    label: "Time Slots",   icon: <Clock className="h-3.5 w-3.5" /> }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === t.id ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </nav>

          <button 
            onClick={async () => {
              await revokePartnerSession();
              navigate("/admin/login");
              toast.success("Logged out successfully");
            }}
            className="flex items-center gap-2 text-gray-400 hover:text-red-500 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Logout</span>
          </button>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {activeTab === "appointments" && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
               {/* Appointment List Header */}
               <div className="px-6 py-6 border-b border-gray-50 flex items-center justify-between">
                 <h2 className="text-xl font-black text-gray-900">Today's Appointments</h2>
                 <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input 
                      placeholder="Search patient name..."
                      value={aptSearch}
                      onChange={(e) => setAptSearch(e.target.value)}
                      className="w-full h-10 pl-9 pr-4 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:bg-white transition-all outline-none"
                    />
                 </div>
               </div>

               {/* Table */}
               <div className="overflow-x-auto">
                 <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50/50 text-left border-y border-gray-50">
                        {["Patient", "Doctor", "Schedule", "Amount", "Status", "Actions"].map(h => (
                          <th key={h} className="px-6 py-4 text-[10px] uppercase font-black text-gray-400 tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {isAptsLoading ? (
                        <tr><td colSpan={6} className="py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" /></td></tr>
                      ) : appointments.length === 0 ? (
                        <tr><td colSpan={6} className="py-20 text-center text-gray-400 font-medium">No appointments found</td></tr>
                      ) : appointments.map(apt => (
                        <tr key={apt.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-sm font-bold text-gray-900">{apt.patient_name}</p>
                            <p className="text-[10px] text-gray-400 font-medium">{apt.patient_phone}</p>
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-gray-700">{apt.doctor_name}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {new Date(apt.appointment_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {apt.appointment_time}
                          </td>
                          <td className="px-6 py-4 text-sm font-black text-gray-900">₹{apt.consultation_fee}</td>
                          <td className="px-6 py-4"><StatusBadge status={apt.status} /></td>
                          <td className="px-6 py-4">
                            <button className="h-8 px-3 rounded-lg border border-gray-100 hover:bg-white hover:shadow-sm text-xs font-bold text-gray-500 transition-all">Details</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </div>
            </div>
          )}

          {activeTab === "doctors" && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-6 border-b border-gray-50 flex items-center justify-between">
                 <h2 className="text-xl font-black text-gray-900">Doctor Management</h2>
                 <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-200">
                    <Plus className="h-4 w-4" /> Add Doctor
                 </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                {isDocsLoading ? (
                  <div className="col-span-full py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" /></div>
                ) : doctors.length === 0 ? (
                  <div className="col-span-full py-20 text-center text-gray-400">No doctors added yet</div>
                ) : doctors.map(doc => (
                  <div key={doc.id} className="bg-gray-50 rounded-2xl p-5 border border-gray-100 hover:border-blue-200 transition-all group">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center text-3xl shadow-sm border border-gray-100 shrink-0">
                        {doc.image_url && doc.image_url.startsWith("http") ? <img src={doc.image_url} className="h-full w-full object-cover rounded-2xl" /> : "👨‍⚕️"}
                      </div>
                      <div>
                        <p className="font-black text-gray-900 leading-tight">{doc.name}</p>
                        <p className="text-xs font-bold text-blue-600 mt-1">{doc.specialty}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200/50">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-black">Fee</p>
                        <p className="text-sm font-black text-gray-900">₹{doc.fee}</p>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button className="h-8 w-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-blue-600"><Edit className="h-4 w-4" /></button>
                        <button className="h-8 w-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "timeslots" && (
            <TimeSlotsTab doctors={doctors} />
          )}

        </div>
      </main>
    </div>
  );
};

export default HospitalDashboard;
