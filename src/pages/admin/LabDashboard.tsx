import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { verifyPartnerSession, clearAdminSession, revokePartnerSession } from "@/lib/adminAuth";
import {
  FlaskConical, Search, Plus, Edit, Trash2,
  Clock, MapPin, Loader2, Activity, TrendingUp,
  Eye, X, UserCheck, ClipboardList, Beaker,
  CheckCircle, Users, Phone, ChevronDown, XCircle,
  Upload, FileText, MessageCircle, Send, AlertCircle,
  Calendar, ToggleLeft, ToggleRight, Save, UserCog, Stethoscope,
  Download, FileSpreadsheet, Briefcase
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────
interface LabTest {
  id: string;
  name: string;
  category: string;
  price: number;
  turnaround: string;
  description?: string;
}

interface LabTestItem {
  id?: string;
  name: string;
  price: number;
}

interface LabBooking {
  id: string;
  order_id?: string;
  patient_name: string;
  patient_phone: string;
  patient_address: string;
  age: number;
  gender: string;
  collection_date: string;
  collection_time: string;
  technician?: string | null;
  total_amount: number;
  status: string;
  tests: LabTestItem[];
}

interface TechnicianSlot {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  maxBookings: number;
  available: boolean;
}

interface LabTechnician {
  id: string;
  name: string;
  phone: string;
  specialization: string;
  status: string;
  slots: TechnicianSlot[];
}

// ─── Mock data (shown when Supabase not configured) ───────────────────────────
const MOCK_BOOKINGS = [
  {
    id: "lb001", patient_name: "Rahul Verma", patient_phone: "9876543210",
    patient_address: "12, MG Road, Bhimavaram", age: 32, gender: "Male",
    collection_date: "2026-03-29", collection_time: "09:00 AM",
    technician: null, total_amount: 1000, status: "pending",
    tests: [
      { name: "Complete Blood Count (CBC)", price: 350 },
      { name: "Thyroid Profile (T3, T4, TSH)", price: 650 }
    ]
  },
  {
    id: "lb002", patient_name: "Sneha Patil", patient_phone: "9123456780",
    patient_address: "45, Jubilee Hills, Bhimavaram", age: 28, gender: "Female",
    collection_date: "2026-03-29", collection_time: "08:00 AM",
    technician: "Technician Ravi", total_amount: 2500, status: "confirmed",
    tests: [{ name: "Comprehensive Metabolic Panel", price: 2500 }]
  },
  {
    id: "lb003", patient_name: "Amit Sharma", patient_phone: "9988776655",
    patient_address: "8, Banjara Hills, Bhimavaram", age: 45, gender: "Male",
    collection_date: "2026-03-28", collection_time: "07:00 AM",
    technician: "Technician Priya", total_amount: 1100, status: "collected",
    tests: [
      { name: "Lipid Profile", price: 500 },
      { name: "Blood Sugar Fasting", price: 150 },
      { name: "Vitamin B12", price: 450 }
    ]
  },
  {
    id: "lb004", patient_name: "Priya Reddy", patient_phone: "9876001234",
    patient_address: "23, Madhapur, Bhimavaram", age: 35, gender: "Female",
    collection_date: "2026-03-28", collection_time: "10:00 AM",
    technician: "Technician Ravi", total_amount: 800, status: "processing",
    tests: [{ name: "Vitamin D Test", price: 800 }]
  },
  {
    id: "lb005", patient_name: "Kiran Kumar", patient_phone: "9000112233",
    patient_address: "56, Gachibowli, Bhimavaram", age: 52, gender: "Male",
    collection_date: "2026-03-27", collection_time: "06:30 AM",
    technician: "Technician Anil", total_amount: 450, status: "cancelled",
    tests: [{ name: "Urine Routine", price: 150 }, { name: "Kidney Function Test", price: 300 }]
  },
  {
    id: "lb006", patient_name: "Deepa Nair", patient_phone: "9870001122",
    patient_address: "11, Kondapur, Bhimavaram", age: 38, gender: "Female",
    collection_date: "2026-03-27", collection_time: "08:30 AM",
    technician: "Technician Priya", total_amount: 600, status: "completed",
    tests: [{ name: "Urine Routine", price: 150 }, { name: "Blood Sugar PP", price: 450 }]
  },
];

const MOCK_TESTS = [
  { id: "t1", name: "Complete Blood Count (CBC)", category: "Blood", price: 350, turnaround: "6 hours", description: "Measures red/white blood cells, hemoglobin, and platelets" },
  { id: "t2", name: "Thyroid Profile (T3, T4, TSH)", category: "Hormone", price: 650, turnaround: "12 hours", description: "Evaluates thyroid gland function" },
  { id: "t3", name: "Lipid Profile", category: "Blood", price: 500, turnaround: "8 hours", description: "Checks cholesterol and triglycerides" },
  { id: "t4", name: "Blood Sugar Fasting", category: "Diabetes", price: 150, turnaround: "4 hours", description: "Measures glucose levels after fasting" },
  { id: "t5", name: "Vitamin D Test", category: "Vitamin", price: 800, turnaround: "24 hours", description: "Checks Vitamin D3 levels in blood" },
  { id: "t6", name: "Urine Routine", category: "Urine", price: 150, turnaround: "3 hours", description: "Comprehensive urine analysis" },
];

// ─── Mock Technician Data ──────────────────────────────────────────────────────
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MOCK_TECHNICIANS = [
  {
    id: "tech1",
    name: "Ravi Kumar",
    phone: "9876100001",
    specialization: "Phlebotomy",
    status: "active",
    slots: [
      { id: "s1", day: "Mon", startTime: "07:00", endTime: "11:00", maxBookings: 6, available: true },
      { id: "s2", day: "Mon", startTime: "14:00", endTime: "17:00", maxBookings: 4, available: true },
      { id: "s3", day: "Wed", startTime: "07:00", endTime: "12:00", maxBookings: 8, available: true },
      { id: "s4", day: "Fri", startTime: "08:00", endTime: "13:00", maxBookings: 6, available: false },
    ],
  },
  {
    id: "tech2",
    name: "Priya Sharma",
    phone: "9876100002",
    specialization: "Biochemistry",
    status: "active",
    slots: [
      { id: "s5", day: "Tue", startTime: "06:30", endTime: "10:30", maxBookings: 5, available: true },
      { id: "s6", day: "Thu", startTime: "08:00", endTime: "12:00", maxBookings: 6, available: true },
      { id: "s7", day: "Sat", startTime: "07:00", endTime: "11:00", maxBookings: 8, available: true },
    ],
  },
  {
    id: "tech3",
    name: "Anil Reddy",
    phone: "9876100003",
    specialization: "Haematology",
    status: "inactive",
    slots: [
      { id: "s8", day: "Mon", startTime: "09:00", endTime: "13:00", maxBookings: 4, available: false },
      { id: "s9", day: "Fri", startTime: "07:00", endTime: "10:00", maxBookings: 3, available: false },
    ],
  },
];

// ─── Status badge helper ───────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const cfg: Record<string, string> = {
    pending:    "bg-amber-100 text-amber-700 border-amber-200",
    confirmed:  "bg-blue-100 text-blue-700 border-blue-200",
    collected:  "bg-violet-100 text-violet-700 border-violet-200",
    processing: "bg-purple-100 text-purple-700 border-purple-200",
    completed:  "bg-emerald-100 text-emerald-700 border-emerald-200",
    cancelled:  "bg-red-100 text-red-500 border-red-200",
  };
  const cls = cfg[status] ?? "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold border capitalize ${cls}`}>
      {status}
    </span>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const LabDashboard = () => {
  const navigate = useNavigate();
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(true);

  // ─── SECURITY GUARD ────────────────────────────────────────────────────────
  useEffect(() => {
    async function checkAuth() {
      const ok = await verifyPartnerSession("lab");
      if (!ok) {
        toast.error("Unauthorized: Session expired or invalid");
        clearAdminSession();
        navigate("/admin/login/lab");
      } else {
        const customSession = localStorage.getItem("aaroksha_partner_session");
        if (customSession) {
          setPartnerId(JSON.parse(customSession).partner_id);
        }
      }
      setIsVerifying(false);
    }
    checkAuth();
  }, [navigate]);

  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"bookings" | "results" | "manage" | "technicians">("bookings");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedBooking, setSelectedBooking] = useState<LabBooking | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditTestOpen, setIsEditTestOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<LabTest | null>(null);
  const [selectedTechnician, setSelectedTechnician] = useState("");

  // ── Results Upload / WhatsApp State ─────────────────────────────────────────
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [resultsBooking, setResultsBooking] = useState<LabBooking | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Technician Slot Management State ────────────────────────────────────────
  const [technicians, setTechnicians] = useState<LabTechnician[]>(MOCK_TECHNICIANS as LabTechnician[]);
  const [editingSlot, setEditingSlot] = useState<{ techId: string; slot: TechnicianSlot } | null>(null);
  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
  const [slotForm, setSlotForm] = useState({ day: "Mon", startTime: "07:00", endTime: "11:00", maxBookings: 6 });
  const [addSlotTechId, setAddSlotTechId] = useState<string | null>(null);
  const [techSearch, setTechSearch] = useState("");

  const [isTechWorkOpen, setIsTechWorkOpen] = useState(false);
  const [selectedTechForWork, setSelectedTechForWork] = useState<LabTechnician | null>(null);

  const openTechWork = (tech: LabTechnician) => {
    setSelectedTechForWork(tech);
    setIsTechWorkOpen(true);
  };

  const downloadTechWork = (tech: LabTechnician, assignedTasks: LabBooking[]) => {
    if (!assignedTasks.length) {
      toast.error("No assigned work to download");
      return;
    }

    const headers = ["Booking ID", "Patient Name", "Phone", "Date", "Slot", "Tests", "Total Amount", "Address"];
    const rows = assignedTasks.map(b => [
      formatBookingId(b),
      b.patient_name,
      b.patient_phone || "N/A",
      b.collection_date,
      b.collection_time,
      Array.isArray(b.tests) ? b.tests.map((t: LabTestItem) => t.name).join("/") : "Panel",
      b.total_amount,
      `"${(b.patient_address || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Work_Schedule_${tech.name}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Work schedule downloaded");
  };

  const openEditSlot = (techId: string, slot: TechnicianSlot) => {
    setAddSlotTechId(null);
    setEditingSlot({ techId, slot });
    setSlotForm({ day: slot.day, startTime: slot.startTime, endTime: slot.endTime, maxBookings: slot.maxBookings });
    setIsSlotModalOpen(true);
  };

  const openAddSlot = (techId: string) => {
    setEditingSlot(null);
    setAddSlotTechId(techId);
    setSlotForm({ day: "Mon", startTime: "07:00", endTime: "11:00", maxBookings: 6 });
    setIsSlotModalOpen(true);
  };

  const saveSlot = () => {
    if (editingSlot) {
      setTechnicians(prev => prev.map(t => {
        if (t.id !== editingSlot.techId) return t;
        return { ...t, slots: t.slots.map(s => s.id === editingSlot.slot.id ? { ...s, ...slotForm } : s) };
      }));
      toast.success("Slot updated successfully");
    } else if (addSlotTechId) {
      const newId = `s_${Date.now()}`;
      setTechnicians(prev => prev.map(t => {
        if (t.id !== addSlotTechId) return t;
        return { ...t, slots: [...t.slots, { id: newId, ...slotForm, available: true }] };
      }));
      toast.success("Slot added successfully");
    }
    setIsSlotModalOpen(false);
  };

  const deleteSlot = (techId: string, slotId: string) => {
    setTechnicians(prev => prev.map(t =>
      t.id !== techId ? t : { ...t, slots: t.slots.filter(s => s.id !== slotId) }
    ));
    toast.success("Slot removed");
  };

  const toggleSlotAvailability = (techId: string, slotId: string) => {
    setTechnicians(prev => prev.map(t =>
      t.id !== techId ? t : {
        ...t,
        slots: t.slots.map(s => s.id === slotId ? { ...s, available: !s.available } : s)
      }
    ));
  };

  const toggleTechStatus = (techId: string) => {
    setTechnicians(prev => prev.map(t =>
      t.id !== techId ? t : { ...t, status: t.status === "active" ? "inactive" : "active" }
    ));
  };

  const filteredTechs = technicians.filter(t =>
    t.name.toLowerCase().includes(techSearch.toLowerCase()) ||
    t.specialization.toLowerCase().includes(techSearch.toLowerCase())
  );

  // ── Fetch bookings ──────────────────────────────────────────────────────────
  const { data: bookings_raw, isLoading: isBookingsLoading } = useQuery<LabBooking[]>({
    queryKey: ["admin-lab-bookings"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      let pId = user?.user_metadata?.partner_id;

      if (!pId) {
        const customSession = localStorage.getItem("aaroksha_partner_session");
        if (customSession) pId = JSON.parse(customSession).partner_id;
      }
      
      let query = supabase.from("lab_bookings").select("*").order("created_at", { ascending: false });
      if (pId && !pId.includes("SEED")) {
        // Show bookings assigned to this partner OR unassigned ones that need review
        query = query.or(`partner_id.eq.${pId},partner_id.is.null`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as LabBooking[];
    },
    retry: false,
  });
  const bookings = (bookings_raw || []) as LabBooking[];

  // ── Fetch tests ─────────────────────────────────────────────────────────────
  const { data: testsList_raw, isLoading: isTestsLoading } = useQuery<LabTest[]>({
    queryKey: ["admin-tests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lab_tests")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as LabTest[];
    },
    retry: false,
  });
  const testsList = (testsList_raw || []) as LabTest[];

  // ── Mutations ───────────────────────────────────────────────────────────────
  const updateBookingMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<any> }) => {
      // Auto-assign this booking to the current lab admin if it was unassigned
      const pId = user?.user_metadata?.partner_id;
      const finalUpdates = { ...updates, partner_id: pId };
      const { error } = await supabase.from("lab_bookings").update(finalUpdates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-lab-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["lab-tests"] });
      toast.success("Booking updated successfully");
      setIsDetailsOpen(false);
    },
    onError: () => toast.error("Failed to update booking"),
  });

  const saveTestMutation = useMutation({
    mutationFn: async (test: LabTest) => {
      // If it's a new test, we omit the 'id' to let Supabase generate one
      // or we handle the null id safely by doing an upsert.
      const { id, ...data } = test;
      if (!id) {
        const { error } = await supabase.from("lab_tests").insert(data);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lab_tests").update(data).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tests"] });
      queryClient.invalidateQueries({ queryKey: ["lab-tests"] }); // Invalidate customer side too
      toast.success("Test saved successfully");
      setIsEditTestOpen(false);
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to save test");
    },
  });

  const deleteTestMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lab_tests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tests"] });
      queryClient.invalidateQueries({ queryKey: ["lab-tests"] });
      toast.success("Test deleted successfully from database");
    },
    onError: (err) => {
      console.error("Delete Test Error:", err);
      toast.error("Failed to delete test from database");
    }
  });

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = [
    {
      label: "Total Bookings",
      val: bookings.length,
      icon: Activity,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      label: "Pending",
      val: bookings.filter((b) => b.status === "pending").length,
      icon: Clock,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-500",
    },
    {
      label: "Processing",
      val: bookings.filter((b) => b.status === "processing").length,
      icon: Beaker,
      iconBg: "bg-purple-50",
      iconColor: "text-purple-600",
    },
    {
      label: "Completed",
      val: bookings.filter((b) => b.status === "completed").length,
      icon: CheckCircle,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
    {
      label: "Today's Collections",
      val: bookings.filter((b) => b.status === "confirmed" || b.status === "collected").length,
      icon: Users,
      iconBg: "bg-sky-50",
      iconColor: "text-sky-600",
    },
    {
      label: "Revenue",
      val: "₹" + bookings
        .filter((b) => b.status !== "cancelled")
        .reduce((sum, b) => sum + (b.total_amount || 0), 0)
        .toLocaleString("en-IN"),
      icon: TrendingUp,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
  ];

  // ── Filtered bookings ───────────────────────────────────────────────────────
  const filteredBookings = bookings.filter((b) => {
    const q = search.toLowerCase();
    const matchesSearch =
      b.patient_name.toLowerCase().includes(q) ||
      b.id.toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === "All" ||
      b.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const filteredTests = testsList.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateStr: string, timeStr?: string) => {
    try {
      const d = new Date(dateStr);
      const formatted = d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      });
      return timeStr ? `${formatted}, ${timeStr}` : formatted;
    } catch {
      return dateStr;
    }
  };

  const formatBookingId = (b: LabBooking) => {
    if (b.order_id) return b.order_id;
    const clean = (b.id || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return `LB${clean.slice(0, 3).padEnd(3, "0")}`;
  };

  if (isVerifying) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-900">
      <Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-4" />
      <p className="text-white font-black text-sm uppercase tracking-widest">Lab Partner</p>
      <p className="text-slate-500 text-[10px] mt-2 tracking-[0.2em]">Verifying Secure Session...</p>
    </div>
  );

  return (
    <div
      className="min-h-screen flex flex-col font-sans"
      style={{ background: "#F0F3F8" }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-blue-50 rounded-xl flex items-center justify-center border border-blue-100 shadow-sm">
            <FlaskConical className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 leading-none">
              Lab Admin Dashboard
            </h1>
            <p className="text-xs font-medium text-slate-400 mt-0.5">
              Aaroksha Diagnostics
            </p>
          </div>
        </div>
        <button 
          onClick={async () => {
            await revokePartnerSession();
            navigate("/admin/login");
            toast.success("Logged out successfully");
          }}
          className="flex items-center gap-2 text-slate-400 hover:text-red-500 transition-colors group"
        >
          <LogOut className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-widest">Logout</span>
        </button>
      </header>

      <main className="flex-1 px-8 py-6 space-y-6">
        {/* ── Stats Grid ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {stats.map((s, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-4 border border-white shadow-sm flex items-center gap-3 hover:shadow-md transition-shadow"
            >
              <div
                className={`h-10 w-10 ${s.iconBg} rounded-xl flex items-center justify-center shrink-0`}
              >
                <s.icon className={`h-5 w-5 ${s.iconColor}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1.5 whitespace-nowrap">
                  {s.label}
                </p>
                <p className="text-lg font-extrabold text-slate-800 leading-none">
                  {s.val}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Tab Bar ──────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-white shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center border-b border-slate-100 px-2 pt-2">
            {(["bookings", "results", "manage", "technicians"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab as "bookings" | "results" | "manage" | "technicians"); setSearch(""); setStatusFilter("All"); }}
                className={`px-5 py-2.5 text-sm font-semibold rounded-t-xl transition-all relative ${
                  activeTab === tab
                    ? "text-slate-800 bg-white border border-b-white border-slate-200 -mb-px z-10"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {tab === "bookings" ? "Bookings"
                  : tab === "results" ? "Results Entry"
                  : tab === "manage" ? "Manage Tests"
                  : "Technicians"}
              </button>
            ))}
          </div>

          {/* ── Bookings Tab ──────────────────────────────────────────────── */}
          {activeTab === "bookings" && (
            <>
              {/* Toolbar */}
              <div className="px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    placeholder="Search by patient or booking ID..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 text-sm focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
                  />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {["All", "Pending", "Confirmed", "Collected", "Processing", "Completed", "Cancelled"].map(
                    (s) => (
                      <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                          statusFilter === s
                            ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                      >
                        {s}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-y border-slate-100 bg-slate-50/50">
                      {["Booking ID", "Patient", "Tests", "Collection", "Technician", "Total", "Status", "Actions"].map(
                        (h) => (
                          <th
                            key={h}
                            className={`py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider ${
                              h === "Booking ID" ? "pl-6" : h === "Actions" ? "pr-6 text-right" : ""
                            }`}
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {isBookingsLoading ? (
                      <tr>
                        <td colSpan={8} className="py-20 text-center">
                          <Loader2 className="h-7 w-7 animate-spin mx-auto text-blue-500" />
                        </td>
                      </tr>
                    ) : filteredBookings.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-16 text-center text-slate-400 text-sm font-medium">
                          No bookings found
                        </td>
                      </tr>
                    ) : (
                      filteredBookings.map((b) => (
                        <tr
                          key={b.id}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="pl-6 py-4 text-sm font-bold text-blue-600">
                            {formatBookingId(b)}
                          </td>
                          <td className="py-4">
                            <p className="text-sm font-bold text-slate-800 leading-none mb-1">
                              {b.patient_name}
                            </p>
                            <p className="text-[11px] text-slate-400 font-medium">
                              {b.age}y / {b.gender}
                            </p>
                          </td>
                          <td className="py-4 text-sm text-slate-500 font-medium">
                            {Array.isArray(b.tests) ? b.tests.length : 1} test(s)
                          </td>
                          <td className="py-4 text-sm text-slate-500 font-medium whitespace-nowrap">
                            {formatDate(b.collection_date, b.collection_time)}
                          </td>
                          <td className="py-4 text-sm font-medium text-slate-500">
                            {b.technician || (
                              <span className="text-slate-300 italic">Unassigned</span>
                            )}
                          </td>
                          <td className="py-4 text-sm font-bold text-slate-800">
                            ₹{b.total_amount?.toLocaleString("en-IN")}
                          </td>
                          <td className="py-4">
                            <StatusBadge status={b.status} />
                          </td>
                          <td className="py-4 pr-6 text-right">
                            <button
                              onClick={() => {
                                setSelectedBooking(b);
                                setSelectedTechnician(b.technician || "");
                                setIsDetailsOpen(true);
                              }}
                              className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all ml-auto"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── Results Entry Tab ─────────────────────────────────────────── */}
          {activeTab === "results" && (
            <div className="p-6">
              <div className="flex items-center gap-2.5 mb-6">
                <ClipboardList className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-800">Results Entry</h2>
              </div>
              <div className="space-y-3">
                {bookings
                  .filter((b) => b.status === "processing" || b.status === "completed")
                  .map((b) => (
                    <div
                      key={b.id}
                      className="border border-slate-200 rounded-2xl p-5 flex items-center justify-between hover:border-blue-200 hover:shadow-sm transition-all bg-white"
                    >
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-0.5">
                            {formatBookingId(b)}
                          </p>
                          <h4 className="text-base font-bold text-slate-800 leading-none mb-0.5">
                            {b.patient_name}
                          </h4>
                          <p className="text-xs text-slate-400 font-medium">
                            {Array.isArray(b.tests) && b.tests.length > 0
                              ? b.tests[0].name
                              : "Diagnostic Panel"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
                          SMP-2026-{b.collection_date?.slice(5, 7)}{b.collection_date?.slice(8, 10)}-{b.id.slice(0, 3).toUpperCase().padStart(3, "0")}
                        </span>
                        <StatusBadge status={b.status} />
                        {b.status === "completed" ? (
                          <button
                            onClick={() => {
                              setResultsBooking(b);
                              setWhatsappNumber(b.patient_phone || "");
                              setPdfFile(null);
                              setIsResultsOpen(true);
                            }}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold hover:bg-emerald-100 transition-all"
                          >
                            <MessageCircle className="h-3.5 w-3.5" /> Send Report
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setResultsBooking(b);
                              setWhatsappNumber(b.patient_phone || "");
                              setPdfFile(null);
                              setIsResultsOpen(true);
                            }}
                            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            Upload & Send
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                {bookings.filter(
                  (b) => b.status === "processing" || b.status === "completed"
                ).length === 0 && (
                  <div className="py-16 text-center text-slate-400 text-sm font-medium">
                    No samples in processing or completed state
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Manage Tests Tab ──────────────────────────────────────────── */}
          {activeTab === "manage" && (
            <>
              <div className="px-6 py-4 flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    placeholder="Search tests..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 text-sm focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
                  />
                </div>
                <button
                  onClick={() => {
                    setEditingTest({
                      id: null,
                      name: "",
                      description: "",
                      price: 0,
                      category: "Blood",
                      turnaround: "6 hours",
                    });
                    setIsEditTestOpen(true);
                  }}
                  className="h-10 px-5 rounded-xl bg-blue-600 text-white text-sm font-bold flex items-center gap-2 shadow-md shadow-blue-200 hover:bg-blue-700 transition-all"
                >
                  <Plus className="h-4 w-4" /> Add Test
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-y border-slate-100 bg-slate-50/50">
                      {["Test Name", "Category", "Price", "Turnaround", "Description", "Actions"].map(
                        (h) => (
                          <th
                            key={h}
                            className={`py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider ${
                              h === "Test Name" ? "pl-6" : h === "Actions" ? "pr-6 text-right" : ""
                            }`}
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {isTestsLoading ? (
                      <tr>
                        <td colSpan={6} className="py-20 text-center">
                          <Loader2 className="h-7 w-7 animate-spin mx-auto text-blue-500" />
                        </td>
                      </tr>
                    ) : filteredTests.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-16 text-center text-slate-400 text-sm font-medium">
                          No tests found
                        </td>
                      </tr>
                    ) : (
                      filteredTests.map((test) => (
                        <tr key={test.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="pl-6 py-4 text-sm font-bold text-slate-800">
                            {test.name}
                          </td>
                          <td className="py-4">
                            <Badge
                              variant="secondary"
                              className="bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold border-0 uppercase tracking-wide"
                            >
                              {test.category}
                            </Badge>
                          </td>
                          <td className="py-4 text-sm font-bold text-slate-800">
                            ₹{test.price}
                          </td>
                          <td className="py-4 text-sm text-slate-500 font-medium">
                            {test.turnaround}
                          </td>
                          <td className="py-4 text-sm text-slate-400 font-medium max-w-xs truncate">
                            {test.description}
                          </td>
                          <td className="py-4 pr-6 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  setEditingTest(test);
                                  setIsEditTestOpen(true);
                                }}
                                className="h-8 w-8 rounded-lg hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center text-slate-400 transition-all"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Permanently delete "${test.name}"?`)) {
                                    deleteTestMutation.mutate(test.id);
                                  }
                                }}
                                disabled={deleteTestMutation.isPending}
                                className="h-8 w-8 rounded-lg hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-slate-400 transition-all disabled:opacity-50"
                              >
                                {deleteTestMutation.isPending && deleteTestMutation.variables === test.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {/* ── Technicians Tab ───────────────────────────────────────────── */}
          {activeTab === "technicians" && (
            <div className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-2.5">
                  <UserCog className="h-5 w-5 text-blue-600" />
                  <h2 className="text-lg font-bold text-slate-800">Technician Management</h2>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    placeholder="Search technicians..."
                    value={techSearch}
                    onChange={(e) => setTechSearch(e.target.value)}
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 text-sm focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredTechs.map((tech) => (
                  <div key={tech.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                    {/* Tech Header */}
                    <div className="px-5 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${tech.status === 'active' ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-400'}`}>
                          <Users className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-800 leading-none">{tech.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">{tech.specialization}</p>
                            <span className="h-1 w-1 rounded-full bg-slate-300"></span>
                            <button 
                              onClick={() => openTechWork(tech)}
                              className="text-[11px] font-bold text-blue-600 hover:text-blue-700 underline underline-offset-2 flex items-center gap-1"
                            >
                              <Briefcase className="h-3 w-3" /> View Work
                            </button>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleTechStatus(tech.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                          tech.status === 'active' 
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                          : 'bg-slate-100 text-slate-400 border border-slate-200'
                        }`}
                      >
                        {tech.status === 'active' ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                        {tech.status.toUpperCase()}
                      </button>
                    </div>

                    {/* Slots List */}
                    <div className="p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Availability Slots</span>
                        <button 
                          onClick={() => openAddSlot(tech.id)}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" /> Add Slot
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {tech.slots.map((slot) => (
                          <div 
                            key={slot.id} 
                            className={`group border rounded-xl p-3 relative transition-all ${
                              slot.available ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Calendar className="h-3.5 w-3.5 text-blue-500" />
                              <span className="text-xs font-extrabold text-slate-700">{slot.day}</span>
                              <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openEditSlot(tech.id, slot)} className="h-6 w-6 rounded-md bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-blue-50 hover:text-blue-600">
                                  <Edit className="h-3 w-3" />
                                </button>
                                <button onClick={() => deleteSlot(tech.id, slot.id)} className="h-6 w-6 rounded-md bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-500">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 mb-2">
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-slate-400" /> {slot.startTime} - {slot.endTime}</span>
                              <span className="flex items-center gap-1"><Stethoscope className="h-3 w-3 text-slate-400" /> Max: {slot.maxBookings}</span>
                            </div>
                            <button 
                              onClick={() => toggleSlotAvailability(tech.id, slot.id)}
                              className={`w-full py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                                slot.available 
                                ? 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100' 
                                : 'bg-slate-200 text-slate-500 border-slate-300'
                              }`}
                            >
                              {slot.available ? 'Enabled' : 'Disabled'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ─── Booking Details Modal ──────────────────────────────────────────── */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-md p-0 rounded-2xl overflow-hidden border-0 shadow-2xl">
          <div className="bg-white">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-2">
              <h2 className="text-xl font-extrabold text-slate-900">
                Booking {selectedBooking ? formatBookingId(selectedBooking) : ""}
              </h2>
              <button
                onClick={() => setIsDetailsOpen(false)}
                className="h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-5">
              {/* Patient info card */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Patient</p>
                    <p className="text-base font-extrabold text-slate-900 leading-none">
                      {selectedBooking?.patient_name}
                    </p>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {selectedBooking?.age}y, {selectedBooking?.gender}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Phone</p>
                    <div className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      {selectedBooking?.patient_phone || "9876543210"}
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Address</p>
                  <div className="flex items-start gap-1.5 text-sm font-medium text-slate-600">
                    <MapPin className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                    {selectedBooking?.patient_address || "12, MG Road, Hyderabad"}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Collection</p>
                    <p className="text-sm font-bold text-slate-800">
                      {selectedBooking
                        ? formatDate(selectedBooking.collection_date, selectedBooking.collection_time)
                        : "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Status</p>
                    {selectedBooking && <StatusBadge status={selectedBooking.status} />}
                  </div>
                </div>
              </div>

              {/* Tests ordered */}
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Tests Ordered</p>
                <div className="space-y-2">
                  {(selectedBooking?.tests && selectedBooking.tests.length > 0
                    ? selectedBooking.tests
                    : [{ name: "Diagnostic Panel", price: selectedBooking?.total_amount || 0 }]
                  ).map((t: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl border border-slate-100"
                    >
                      <span className="text-sm font-medium text-slate-700">{t.name}</span>
                      <span className="text-sm font-bold text-slate-800">₹{t.price}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 mt-2">
                  <span className="text-base font-extrabold text-slate-900">Total</span>
                  <span className="text-base font-extrabold text-blue-600">
                    ₹{selectedBooking?.total_amount?.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              {/* Assign technician */}
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">
                  Assign Technician
                </p>
                <div className="relative">
                  <select
                    value={selectedTechnician}
                    onChange={(e) => setSelectedTechnician(e.target.value)}
                    className="w-full h-11 bg-white border-2 border-blue-500 rounded-xl px-4 pr-10 text-sm font-medium text-slate-700 outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-blue-200 transition-all"
                  >
                    <option value="">Select technician</option>
                    <option>Technician Ravi</option>
                    <option>Technician Priya</option>
                    <option>Technician Anil</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3 pt-1 pb-2">
                <button
                  onClick={() => setIsDetailsOpen(false)}
                  className="h-11 rounded-xl bg-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-600 transition-all active:scale-95"
                >
                  <XCircle className="h-4 w-4" /> Cancel
                </button>
                <button
                  onClick={() =>
                    updateBookingMutation.mutate({
                      id: selectedBooking.id,
                      updates: {
                        status: "confirmed",
                        technician: selectedTechnician || selectedBooking.technician,
                      },
                    })
                  }
                  disabled={updateBookingMutation.isPending}
                  className="h-11 rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-60"
                >
                  {updateBookingMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserCheck className="h-4 w-4" />
                  )}
                  Assign & Confirm
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Upload Results & WhatsApp Modal ────────────────────────────────── */}
      <Dialog open={isResultsOpen} onOpenChange={(open) => { setIsResultsOpen(open); if (!open) setPdfFile(null); }}>
        <DialogContent className="max-w-md p-0 rounded-2xl overflow-hidden border-0 shadow-2xl">
          <div className="bg-white">
            {/* Modal Header */}
            <div
              className="px-6 pt-6 pb-4"
              style={{ background: "linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 100%)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 bg-white/20 rounded-xl flex items-center justify-center">
                    <FileText className="h-4.5 w-4.5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-white leading-none">Upload Lab Report</h2>
                    <p className="text-[11px] text-blue-100 font-medium mt-0.5">Send result PDF via WhatsApp</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsResultsOpen(false)}
                  className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {resultsBooking && (
                <div className="bg-white/15 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-blue-100 uppercase tracking-wider">Patient</p>
                    <p className="text-sm font-extrabold text-white">{resultsBooking.patient_name}</p>
                    <p className="text-[11px] text-blue-100 font-medium">
                      {Array.isArray(resultsBooking.tests) && resultsBooking.tests.length > 0
                        ? resultsBooking.tests[0].name
                        : "Diagnostic Panel"}
                    </p>
                  </div>
                  <StatusBadge status={resultsBooking.status} />
                </div>
              )}
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* PDF Upload Zone */}
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Lab Report PDF</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setPdfFile(f);
                  }}
                />
                {pdfFile ? (
                  <div className="border-2 border-emerald-400 bg-emerald-50 rounded-xl p-4 flex items-center gap-3">
                    <div className="h-10 w-10 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-emerald-800 truncate">{pdfFile.name}</p>
                      <p className="text-[11px] text-emerald-600 font-medium">
                        {(pdfFile.size / 1024).toFixed(1)} KB · PDF
                      </p>
                    </div>
                    <button
                      onClick={() => { setPdfFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      className="h-7 w-7 rounded-lg hover:bg-emerald-100 flex items-center justify-center text-emerald-500 transition-all"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50 rounded-xl p-6 flex flex-col items-center gap-2 transition-all group"
                  >
                    <div className="h-12 w-12 bg-slate-100 group-hover:bg-blue-100 rounded-xl flex items-center justify-center transition-colors">
                      <Upload className="h-5 w-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                    </div>
                    <p className="text-sm font-bold text-slate-500 group-hover:text-blue-600 transition-colors">Click to upload PDF</p>
                    <p className="text-[11px] text-slate-400">PDF files only · Max 25 MB</p>
                  </button>
                )}
              </div>

              {/* WhatsApp Number */}
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Send to WhatsApp</p>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    <MessageCircle className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm font-bold text-slate-500">+91</span>
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="Patient WhatsApp number"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="w-full h-12 border-2 border-slate-200 focus:border-emerald-400 bg-slate-50 focus:bg-white rounded-xl pl-20 pr-4 text-sm font-bold text-slate-800 outline-none transition-all"
                  />
                </div>
                {resultsBooking?.patient_phone && whatsappNumber !== resultsBooking.patient_phone && (
                  <button
                    onClick={() => setWhatsappNumber(resultsBooking.patient_phone)}
                    className="mt-1.5 text-[11px] font-bold text-blue-500 hover:underline"
                  >
                    ↩ Use booking number ({resultsBooking.patient_phone})
                  </button>
                )}
                <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Pre-filled from booking. You can change it to any patient number.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={() => setIsResultsOpen(false)}
                  className="h-11 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  disabled={!pdfFile || whatsappNumber.length < 10 || isSending}
                  onClick={async () => {
                    if (!pdfFile || whatsappNumber.length < 10) return;
                    setIsSending(true);
                    // Mark booking as completed
                    if (resultsBooking?.status !== "completed") {
                      await updateBookingMutation.mutateAsync({
                        id: resultsBooking.id,
                        updates: { status: "completed" },
                      }).catch(() => {});
                    }
                    // Build WhatsApp message
                    const patientName = resultsBooking?.patient_name || "Patient";
                    const testName = Array.isArray(resultsBooking?.tests) && resultsBooking.tests.length > 0
                      ? resultsBooking.tests[0].name
                      : "Diagnostic Panel";
                    const msg = encodeURIComponent(
                      `Hello ${patientName},\n\nYour lab report for *${testName}* from *Aaroksha Diagnostics* is ready.\n\nPlease find the attached PDF report.\n\nFor queries, contact us at our lab.\n\nThank you for choosing Aaroksha! 🏥`
                    );
                    const phone = `91${whatsappNumber}`;
                    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
                    setIsSending(false);
                    setIsResultsOpen(false);
                    toast.success(`Report details sent to +91 ${whatsappNumber} via WhatsApp`);
                    setTimeout(() => {
                      toast.info("Please attach the PDF manually in the WhatsApp chat that just opened.", { duration: 6000 });
                    }, 1000);
                  }}
                  className="h-11 rounded-xl bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-200 hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Send via WhatsApp
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Edit / Add Test Modal ──────────────────────────────────────────── */}
      <Dialog open={isEditTestOpen} onOpenChange={setIsEditTestOpen}>
        <DialogContent className="max-w-sm p-0 rounded-2xl overflow-hidden border-0 shadow-2xl">
          <div className="bg-white px-6 py-6 space-y-5">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-extrabold text-slate-900">
                {editingTest?.id ? "Edit Test" : "Add Test"}
              </DialogTitle>
              <button
                onClick={() => setIsEditTestOpen(false)}
                className="h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Name</Label>
                <Input
                  value={editingTest?.name ?? ""}
                  onChange={(e) => setEditingTest({ ...editingTest, name: e.target.value })}
                  className="h-11 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:border-blue-400"
                  placeholder="Test name"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Description</Label>
                <Input
                  value={editingTest?.description ?? ""}
                  onChange={(e) => setEditingTest({ ...editingTest, description: e.target.value })}
                  className="h-11 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:border-blue-400"
                  placeholder="Brief description"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Price (₹)</Label>
                  <Input
                    type="number"
                    value={editingTest?.price ?? ""}
                    onChange={(e) =>
                      setEditingTest({ ...editingTest, price: parseInt(e.target.value) || 0 })
                    }
                    className="h-11 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:border-blue-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Category</Label>
                  <select
                    value={editingTest?.category ?? "Blood"}
                    onChange={(e) => setEditingTest({ ...editingTest, category: e.target.value })}
                    className="w-full h-11 bg-blue-50 border-2 border-blue-500 rounded-xl px-3 text-sm font-medium text-blue-700 outline-none focus:ring-2 focus:ring-blue-200 transition-all cursor-pointer"
                  >
                    {["Blood", "Hormone", "Diabetes", "Urine", "Vitamin", "Cardiac", "Liver", "Kidney"].map(
                      (c) => <option key={c}>{c}</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Turnaround Time</Label>
                <Input
                  value={editingTest?.turnaround ?? ""}
                  onChange={(e) => setEditingTest({ ...editingTest, turnaround: e.target.value })}
                  className="h-11 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:border-blue-400"
                  placeholder="e.g. 6 hours"
                />
              </div>

              <button
                onClick={() => saveTestMutation.mutate(editingTest!)}
                disabled={saveTestMutation.isPending}
                className="w-full h-12 bg-blue-600 text-white rounded-xl font-bold shadow-md shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-60 mt-2"
              >
                {saveTestMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Technician Slot Edit Modal ─────────────────────────────────────── */}
      <Dialog open={isSlotModalOpen} onOpenChange={setIsSlotModalOpen}>
        <DialogContent className="max-w-sm p-0 rounded-2xl overflow-hidden border-0 shadow-2xl">
          <div className="bg-white">
            <div className="px-6 py-5 border-b border-slate-100" style={{ background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 bg-white/20 rounded-xl flex items-center justify-center">
                    <Calendar className="h-4.5 w-4.5 text-white" />
                  </div>
                  <h2 className="text-base font-extrabold text-white leading-none">
                    {editingSlot ? "Edit Availability Slot" : "Add Availability Slot"}
                  </h2>
                </div>
                <button
                  onClick={() => setIsSlotModalOpen(false)}
                  className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Day of Week</Label>
                <select
                  value={slotForm.day}
                  onChange={(e) => setSlotForm({ ...slotForm, day: e.target.value })}
                  className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-medium text-slate-800 outline-none focus:border-blue-400 transition-all appearance-none"
                >
                  {DAYS.map(day => <option key={day} value={day}>{day}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Start Time</Label>
                  <Input
                    type="time"
                    value={slotForm.startTime}
                    onChange={(e) => setSlotForm({ ...slotForm, startTime: e.target.value })}
                    className="h-11 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">End Time</Label>
                  <Input
                    type="time"
                    value={slotForm.endTime}
                    onChange={(e) => setSlotForm({ ...slotForm, endTime: e.target.value })}
                    className="h-11 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Max Patients per Slot</Label>
                <Input
                  type="number"
                  min={1}
                  value={slotForm.maxBookings}
                  onChange={(e) => setSlotForm({ ...slotForm, maxBookings: parseInt(e.target.value) || 1 })}
                  className="h-11 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <button
                onClick={saveSlot}
                className="w-full h-12 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 mt-2"
              >
                <Save className="h-4 w-4" />
                {editingSlot ? "Update Slot" : "Create Slot"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Technician Assigned Work Modal ─────────────────────────────────── */}
      <Dialog open={isTechWorkOpen} onOpenChange={setIsTechWorkOpen}>
        <DialogContent className="max-w-2xl p-0 rounded-2xl overflow-hidden border-0 shadow-2xl">
          <div className="bg-white">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center">
                  <Briefcase className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 leading-none">
                    Assigned Work: {selectedTechForWork?.name}
                  </h2>
                  <p className="text-[11px] text-slate-400 font-medium mt-1 uppercase tracking-wider">
                    {selectedTechForWork?.specialization} · Schedule List
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const tasks = bookings.filter(b => b.technician === selectedTechForWork?.name);
                    downloadTechWork(selectedTechForWork, tasks);
                  }}
                  className="h-9 px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100"
                >
                  <Download className="h-3.5 w-3.5" /> Download Schedule
                </button>
                <button
                  onClick={() => setIsTechWorkOpen(false)}
                  className="h-9 w-9 rounded-xl hover:bg-slate-200 flex items-center justify-center text-slate-400 transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="overflow-y-auto max-h-[60vh] pr-2 space-y-4">
                {bookings.filter(b => b.technician === selectedTechForWork?.name).length === 0 ? (
                  <div className="py-20 text-center">
                    <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Briefcase className="h-8 w-8 text-slate-200" />
                    </div>
                    <p className="text-sm font-bold text-slate-400">No work assigned to this technician yet</p>
                  </div>
                ) : (
                  bookings
                    .filter(b => b.technician === selectedTechForWork?.name)
                    .map((b) => (
                      <div key={b.id} className="border border-slate-100 rounded-2xl p-5 bg-white hover:border-blue-200 transition-all">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md uppercase">
                                {formatBookingId(b)}
                              </span>
                              <StatusBadge status={b.status} />
                            </div>
                            <h4 className="text-base font-extrabold text-slate-900">{b.patient_name}</h4>
                            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 mt-0.5">
                              <Phone className="h-3 w-3" /> {b.patient_phone || "9876543210"}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Time Slot</p>
                            <div className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
                              <Clock className="h-3.5 w-3.5 text-blue-500" />
                              {formatDate(b.collection_date, b.collection_time)}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Tests & Price</p>
                            <div className="space-y-1.5">
                              {(Array.isArray(b.tests) ? b.tests : [{ name: "Diagnostic Panel" }]).map((t: LabTestItem | { name: string }, idx: number) => (
                                <div key={idx} className="flex items-center justify-between text-xs font-bold text-slate-600">
                                  <span>{t.name}</span>
                                </div>
                              ))}
                              <div className="text-sm font-black text-blue-600 pt-1">
                                Total: ₹{b.total_amount?.toLocaleString("en-IN")}
                              </div>
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Collection Address</p>
                            <div className="flex items-start gap-2 text-xs font-medium text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                              <MapPin className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                              {b.patient_address || "12, MG Road, Hyderabad"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LabDashboard;
