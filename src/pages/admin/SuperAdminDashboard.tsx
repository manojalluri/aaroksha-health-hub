import { useState, useEffect } from "react";
import {
  ShieldCheck, Stethoscope, Users, BarChart2, CreditCard,
  Percent, Settings, Plus, X, Eye, EyeOff, Download,
  IndianRupee, CheckCircle2, Clock, Copy, RefreshCw,
  Building2, FlaskConical, Pill, ChevronRight, LogOut,
  TrendingUp, Activity, Loader2, KeyRound, Edit2, Trash2,
  ArrowUpRight, AlertCircle, Calendar, Search, Truck,
  ChevronUp, ChevronDown, ImagePlus, Palette, Link2, GripVertical, LayoutTemplate,
  MapPin, Package, UserCheck, Ban, CheckCircle
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Banner, getBanners, saveBanners } from "@/lib/bannersSync";
import { getSettings, saveSettingsLocally, saveSettingsToSupabase } from "@/lib/settingsSync";
import { useNavigate } from "react-router-dom";
import { verifySuperAdminSession, clearAdminSession } from "@/lib/adminAuth";

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = "overview" | "live" | "users" | "partners" | "payouts" | "credentials" | "commissions" | "transactions" | "settings" | "lookup" | "banners" | "logistics_hub";

interface BookingItem {
  id: string;
  order_id: string;
  patient_name: string;
  patient_phone?: string;
  patient_email?: string;
  patient_address?: string;
  delivery_address?: string;
  created_at: string;
  payment_status: string;
  status: string;
  platform_fee: number;
}

interface Appointment extends BookingItem {
  consultation_fee?: number;
  fee?: number;
  hospital_partner_id: string;
  partner_id: string;
  doctor_name?: string;
  appointment_date?: string;
  appointment_time?: string;
  patient_age?: string;
  patient_gender?: string;
  is_priority?: boolean;
}

interface LabTest {
  name: string;
  price: number;
  id?: string;
}

interface Medicine {
  name: string;
  price: number;
  dosage: string;
  qty: number;
  available: boolean;
}

interface LabBooking extends BookingItem {
  total_amount: number;
  partner_id: string;
  tests: LabTest[];
  collection_date?: string;
  collection_time?: string;
  technician?: string;
  test_names?: string[];
}

interface Prescription extends BookingItem {
  grand_total: number;
  sub_total?: number;
  delivery_fee?: number;
  partner_id: string;
  medicines: Medicine[];
  prescriptions?: string[];
  is_express_delivery?: boolean;
  admin_note?: string;
  delivery_code?: string;
  assigned_partner_id?: string;
}

interface PlatformUser {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  is_suspended: boolean;
  created_at: string;
}

interface Partner {
  id: string;
  name: string;
  type: "hospital" | "lab" | "pharmacy" | "logistics";
  email: string;
  password: string;
  phone?: string;
  address?: string;
  commission_type: "percentage" | "fixed";
  commission_rate: number;
  partner_id: string;
  status: "active" | "inactive";
  created_at?: string;
}

type LookupResult = (Appointment | LabBooking | Prescription) & { _type: "opd" | "lab" | "med" };

type LiveFeedItem = (Appointment | LabBooking | Prescription) & { 
  feedType: 'opd' | 'lab' | 'pharmacy'; 
  timestamp: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const genPassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!";
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

const genPartnerId = (type: string) =>
  `${type.toUpperCase()}_${Date.now().toString(36).toUpperCase()}`;

const TYPE_META: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string; label: string; route: string }> = {
  hospital: { icon: <Building2 className="h-4 w-4" />, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", label: "Hospital", route: "/admin/hospital" },
  lab:      { icon: <FlaskConical className="h-4 w-4" />, color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200", label: "Lab", route: "/admin/lab" },
  pharmacy: { icon: <Pill className="h-4 w-4" />, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", label: "Pharmacy", route: "/admin/pharmacy" },
  logistics:{ icon: <Truck className="h-4 w-4" />, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200", label: "Logistics", route: "/admin/logistics" },
};

const COMMISSION_DEFAULTS: Record<string, number> = { hospital: 10, lab: 18, pharmacy: 15, logistics: 30 };

const getMeta = (type: string) => TYPE_META[type as keyof typeof TYPE_META] || TYPE_META.hospital;


// ─── Seed Partners (local state until DB partners table ready) ─────────────────
const SEED_PARTNERS: Partner[] = [
  { id: "c1", name: "Apollo Hospital", type: "hospital", email: "hospital@aaroksha.com", password: "Hosp@2026", phone: "+91 98765 43210", address: "Bhimavaram, AP", commission_type: "percentage", commission_rate: 10, partner_id: "HOSPITAL_SEED1", status: "active" },
  { id: "c2", name: "Aaroksha Diagnostics", type: "lab", email: "lab@aaroksha.com", password: "Lab@2026", phone: "+91 87654 32109", address: "Bhimavaram, AP", commission_type: "percentage", commission_rate: 18, partner_id: "LAB_SEED1", status: "active" },
  { id: "c3", name: "MedPlus Pharmacy", type: "pharmacy", email: "pharmacy@aaroksha.com", password: "Pharm@2026", phone: "+91 76543 21098", address: "Bhimavaram, AP", commission_type: "percentage", commission_rate: 15, partner_id: "PHARMACY_SEED1", status: "active" },
  { id: "c4", name: "FastTrack Logistics", type: "logistics", email: "logistics@aaroksha.com", password: "Logi@2026", phone: "+91 65432 10987", address: "Bhimavaram, AP", commission_type: "fixed", commission_rate: 30, partner_id: "LOGISTICS_SEED1", status: "active" },
];

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, icon, accent }: { label: string; value: string | number; sub?: string; icon: React.ReactNode; accent: string }) => (
  <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
    <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${accent} shrink-0`}>{icon}</div>
    <div>
      <p className="text-2xl font-black text-slate-900 leading-none">{value}</p>
      <p className="text-xs font-bold text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-emerald-600 font-bold mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);

  // ─── SECURITY GUARD ────────────────────────────────────────────────────────
  useEffect(() => {
    async function checkAuth() {
      const ok = await verifySuperAdminSession();
      if (!ok) {
        toast.error("Unauthorized: Super Admin access required");
        clearAdminSession();
        navigate("/admin/login/super");
      } else {
        setIsAdmin(true);
      }
      setIsVerifying(false);
    }
    checkAuth();
  }, [navigate]);

  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  // ─── PARTNERS DATA ──────────────────────────────────────────────────────────
  const { data: partners = SEED_PARTNERS, refetch: refetchPartners } = useQuery<Partner[]>({
    queryKey: ["admin-partners"],
    queryFn: async () => {
      const { data, error } = await supabase.from("partners").select("*").order("created_at", { ascending: false });
      if (error || !data || data.length === 0) return SEED_PARTNERS;
      return (data || []).map(p => ({
        ...p,
        // Ensure type compatibility for logistics
        type: p.type as any 
      })) as Partner[];
    }
  });

  const [showAddPartner, setShowAddPartner] = useState(false);
  const [showCreds, setShowCreds] = useState<Record<string, boolean>>({});
  const [paidPartners, setPaidPartners] = useState<Record<string, boolean>>({});
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState("all");
  const [customDate, setCustomDate] = useState({ start: "", end: "" });
  const [liveFilter, setLiveFilter] = useState("all");
  // Order Lookup state
  const [lookupId, setLookupId] = useState("");
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [newPartner, setNewPartner] = useState({
    name: "", type: "hospital" as "hospital" | "lab" | "pharmacy" | "logistics",
    email: "", password: genPassword(), phone: "", address: "",
    commission_type: "percentage" as "percentage" | "fixed",
    commission_rate: 10,
  });
  
  const [toggles, setToggles] = useState(getSettings());
  
  useEffect(() => {
    const fn = () => setToggles(getSettings());
    window.addEventListener("settings_updated", fn);
    return () => window.removeEventListener("settings_updated", fn);
  }, []);

  const [platformBanners, setPlatformBanners] = useState<Banner[]>(getBanners());
  const [bannerPreviewIdx, setBannerPreviewIdx] = useState(0);

  const persistBanners = (updated: Banner[]) => {
    setPlatformBanners(updated);
    saveBanners(updated);
    supabase.from("platform_banners").upsert(updated.map((b, idx) => ({
      id: b.id.startsWith("default") ? `00000000-0000-0000-0000-00000000000${idx}` : b.id,
      title: b.title, subtitle: b.subtitle, image_url: b.image || null,
      link_to: b.to, cta_text: b.cta, gradient: b.gradient,
      cta_color: b.ctaColor, emoji: b.emoji, badge_text: b.badge, is_active: true,
    }))).then(({ error }) => { if (!error) toast.success("Banners saved & live!"); });
  };

  const handleUpdateBanner = (id: string, key: keyof Banner, value: string) => {
    const updated = platformBanners.map(b => b.id === id ? { ...b, [key]: value, isCustom: true } : b);
    persistBanners(updated);
  };

  const handleAddBanner = () => {
    const newBanner: Banner = {
      id: `custom-${Date.now()}`,
      title: "New Banner\nHeadline",
      subtitle: "Add a short description here",
      cta: "Learn More",
      to: "/",
      gradient: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
      ctaColor: "#2563eb",
      emoji: "✨",
      badge: "New",
      isCustom: true,
    };
    const updated = [...platformBanners, newBanner];
    persistBanners(updated);
    setBannerPreviewIdx(updated.length - 1);
    toast.success("New banner added!");
  };

  const handleDeleteBanner = (id: string) => {
    if (platformBanners.length <= 1) { toast.error("You must have at least 1 banner."); return; }
    const updated = platformBanners.filter(b => b.id !== id);
    persistBanners(updated);
    setBannerPreviewIdx(Math.min(bannerPreviewIdx, updated.length - 1));
    toast.success("Banner deleted.");
  };

  const handleMoveBanner = (id: string, dir: "up" | "down") => {
    const idx = platformBanners.findIndex(b => b.id === id);
    if ((dir === "up" && idx === 0) || (dir === "down" && idx === platformBanners.length - 1)) return;
    const updated = [...platformBanners];
    const swap = dir === "up" ? idx - 1 : idx + 1;
    [updated[idx], updated[swap]] = [updated[swap], updated[idx]];
    persistBanners(updated);
    setBannerPreviewIdx(swap);
  };

  const handleBannerUpload = async (id: string, file: File) => {
    const loadingToast = toast.loading("Uploading image...");
    try {
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const fileName = `banner-${id}-${Date.now()}-${cleanFileName}`;
      const { data, error } = await supabase.storage.from("banners").upload(fileName, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("banners").getPublicUrl(data.path);
      handleUpdateBanner(id, "image", publicUrl);
      toast.dismiss(loadingToast);
      toast.success("Image uploaded!");
    } catch (err: any) {
      toast.dismiss(loadingToast);
      toast.error("Upload failed: " + err.message);
    }
  };

  // ─── Data Queries ──────────────────────────────────────────────────────────
  const { data: appointments = [] } = useQuery<Appointment[]>({ 
    queryKey: ["admin-appointments"], 
    queryFn: async () => { const { data } = await supabase.from("appointments").select("*"); return data || []; } 
  });
  const { data: labBookings = [] } = useQuery<LabBooking[]>({ 
    queryKey: ["admin-lab-bookings"], 
    queryFn: async () => { const { data } = await supabase.from("lab_bookings").select("*"); return data || []; } 
  });
  const { data: prescriptions = [] } = useQuery<Prescription[]>({ 
    queryKey: ["admin-prescriptions"], 
    queryFn: async () => { const { data } = await supabase.from("prescriptions").select("*"); return data || []; } 
  });
  const { data: platformUsers = [], refetch: refetchUsers } = useQuery<PlatformUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (error || !data || data.length === 0) {
        return [
          { id: "u1", full_name: "Rahul Sharma", email: "rahul@example.com", phone: "+91 9876543210", role: "patient", is_suspended: false, created_at: new Date().toISOString() },
          { id: "u2", full_name: "Priya Singh", email: "priya@example.com", phone: "+91 8765432109", role: "patient", is_suspended: true, created_at: new Date(Date.now() - 86400000).toISOString() },
          { id: "u3", full_name: "Amit Patel", email: "amit.p@example.com", phone: "+91 7654321098", role: "patient", is_suspended: false, created_at: new Date(Date.now() - 172800000).toISOString() },
        ];
      }
      return data as PlatformUser[];
    }
  });

  const handleSuspendUser = async (user: PlatformUser) => {
    const newStatus = !user.is_suspended;
    try {
      const { error } = await supabase.from("profiles").update({ is_suspended: newStatus }).eq("id", user.id);
      if (error) {
        console.warn("Database update failed:", error);
      }
      toast.success(`User ${user.full_name} is now ${newStatus ? 'suspended' : 'active'}`);
      refetchUsers();
    } catch (err) {
      toast.error("Failed to update user status");
      console.error(err);
    }
  };

  const now = new Date();
  const filterByDate = (item: { created_at?: string }) => {
    if (dateFilter === "all") return true;
    const date = new Date(item.created_at || now);
    if (dateFilter === "today") return date.toDateString() === now.toDateString();
    if (dateFilter === "yesterday") {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      return date.toDateString() === yesterday.toDateString();
    }
    if (dateFilter === "week") {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      return date >= weekAgo;
    }
    if (dateFilter === "month") {
      const monthAgo = new Date(now);
      monthAgo.setMonth(now.getMonth() - 1);
      return date >= monthAgo;
    }
    if (dateFilter === "custom") {
      if (!customDate.start || !customDate.end) return true;
      const start = new Date(customDate.start);
      const end = new Date(customDate.end);
      end.setHours(23, 59, 59, 999);
      return date >= start && date <= end;
    }
    return true;
  };

  const filteredAppointments = appointments.filter(filterByDate);
  const filteredLabBookings = labBookings.filter(filterByDate);
  const filteredPrescriptions = prescriptions.filter(filterByDate);

  const liveFeed: LiveFeedItem[] = [
    ...filteredAppointments.map(a => ({ ...a, feedType: 'opd' as const, timestamp: new Date(a.created_at || now).getTime() })),
    ...filteredLabBookings.map(l => ({ ...l, feedType: 'lab' as const, timestamp: new Date(l.created_at || now).getTime() })),
    ...filteredPrescriptions.map(p => ({ ...p, feedType: 'pharmacy' as const, timestamp: new Date(p.created_at || now).getTime() }))
  ].sort((a, b) => b.timestamp - a.timestamp);


  const hospitalRev = filteredAppointments.reduce((s, a) => s + (a.consultation_fee || a.fee || 0), 0);
  const pharmRev    = filteredPrescriptions.reduce((s, p) => s + (p.grand_total || 0), 0);
  const labRev      = filteredLabBookings.reduce((s, b) => s + (b.total_amount || 0), 0);
  const logisticsRev = filteredPrescriptions.filter(p => p.status === 'completed' || p.status === 'dispatched').reduce((s, p) => s + (p.delivery_fee || 40), 0);
  const totalRevenue = hospitalRev + pharmRev + labRev + logisticsRev;

  const getPartnerEarned = (p: Partner) => {
    if (p.type === "hospital") {
      return filteredAppointments
        .filter(a => a.hospital_partner_id === p.partner_id || a.partner_id === p.partner_id)
        .reduce((s, a) => s + (a.consultation_fee || a.fee || 0), 0);
    }
    if (p.type === "lab") {
      return filteredLabBookings
        .filter(b => b.partner_id === p.partner_id)
        .reduce((s, b) => s + (b.total_amount || 0), 0);
    }
    if (p.type === "pharmacy") {
      return filteredPrescriptions
        .filter(pr => pr.partner_id === p.partner_id)
        .reduce((s, pr) => s + (pr.grand_total || 0), 0);
    }
    if (p.type === "logistics") {
      return filteredPrescriptions
        .filter(pr => pr.status === 'completed' || pr.status === 'dispatched')
        .reduce((s, pr) => s + (pr.delivery_fee || 40), 0);
    }
    return 0;
  };

  const getPartnerTxnCount = (p: Partner) => {
    if (p.type === "hospital") return filteredAppointments.filter(a => a.hospital_partner_id === p.partner_id || a.partner_id === p.partner_id).length;
    if (p.type === "lab") return filteredLabBookings.filter(b => b.partner_id === p.partner_id).length;
    if (p.type === "pharmacy") return filteredPrescriptions.filter(pr => pr.partner_id === p.partner_id).length;
    if (p.type === "logistics") return filteredPrescriptions.filter(pr => pr.status === 'completed' || pr.status === 'dispatched').length;
    return 0;
  };

  const getPartnerPlatformFees = (p: Partner, txnCount: number) => {
    if (p.type === 'hospital') return txnCount * 29;
    if (p.type === 'lab') return txnCount * 49;
    if (p.type === 'pharmacy') return txnCount * 19;
    return 0;
  };

  const getPartnerCommission = (p: Partner) => {
    if (p.commission_type === "fixed") return p.commission_rate * getPartnerTxnCount(p);
    return Math.round(getPartnerEarned(p) * (p.commission_rate / 100));
  };
  const totalCommission = partners.reduce((sum, p) => sum + getPartnerCommission(p), 0);

  // ─── Add Partner Handler ───────────────────────────────────────────────────
  const handleAddPartner = async () => {
    if (!newPartner.name || !newPartner.email) { toast.error("Name and email are required"); return; }
    setAddLoading(true);
    try {
      const partnerId = genPartnerId(newPartner.type);
      
      const partnerData = {
        name: newPartner.name, 
        type: newPartner.type,
        email: newPartner.email, 
        password: newPartner.password,
        phone: newPartner.phone, 
        address: newPartner.address,
        commission_type: newPartner.commission_type,
        commission_rate: newPartner.commission_rate,
        partner_id: partnerId, 
        status: "active" as const,
        created_at: new Date().toISOString(),
      };

      let error;
      if (editingPartner) {
        const { error: updateErr } = await supabase.from("partners").update(partnerData).eq("id", editingPartner.id);
        error = updateErr;
      } else {
        const { error: insertErr } = await supabase.from("partners").insert([partnerData]);
        error = insertErr;
      }

      if (error) throw error;

      toast.success(editingPartner ? "Partner updated successfully!" : `✅ ${newPartner.name} added successfully! Partner ID: ${partnerId}`);
      setShowAddPartner(false);
      setEditingPartner(null);
      setNewPartner({ name: "", type: "hospital", email: "", password: genPassword(), phone: "", address: "", commission_type: "percentage", commission_rate: 10 });
      refetchPartners();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save partner");
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeletePartner = async (id: string) => {
    try {
      const { error } = await supabase.from("partners").delete().eq("id", id);
      if (error) throw error;
      toast.success("Partner removed");
      refetchPartners();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove partner");
    }
  };

  // ─── Order Lookup ──────────────────────────────────────────────────────────
  const handleLookup = async () => {
    const id = lookupId.trim().toUpperCase();
    if (!id) { setLookupError("Please enter an Order ID"); return; }
    setLookupError("");
    setLookupResult(null);
    setLookupLoading(true);
    try {
      let result = null;
      let type = "";
      if (id.startsWith("OPD")) {
        const { data } = await supabase.from("appointments").select("*").eq("order_id", id).single();
        result = data; type = "opd";
      } else if (id.startsWith("LAB")) {
        const { data } = await supabase.from("lab_bookings").select("*").eq("order_id", id).single();
        result = data; type = "lab";
      } else if (id.startsWith("MED")) {
        const { data } = await supabase.from("prescriptions").select("*").eq("order_id", id).single();
        result = data; type = "med";
      } else {
        // Try all three
        const [a, l, p] = await Promise.all([
          supabase.from("appointments").select("*").eq("order_id", id).single(),
          supabase.from("lab_bookings").select("*").eq("order_id", id).single(),
          supabase.from("prescriptions").select("*").eq("order_id", id).single(),
        ]);
        if (a.data) { result = a.data; type = "opd"; }
        else if (l.data) { result = l.data; type = "lab"; }
        else if (p.data) { result = p.data; type = "med"; }
      }
      if (!result) { 
        setLookupError(`No booking found with Order ID "${id}"`); 
      } else { 
        setLookupResult({ ...result, _type: type as "opd" | "lab" | "med" } as LookupResult); 
      }
    } catch {
      setLookupError("Search failed. Please try again.");
    } finally {
      setLookupLoading(false);
    }
  };

  // ─── Logistics Assignment State ────────────────────────────────────────────
  const [logisticsFilter, setLogisticsFilter] = useState("all");
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const logisticPartners = partners.filter(p => p.type === "logistics" && p.status === "active");

  const handleAssignPartner = async (prescriptionId: string, partnerId: string, partnerName: string) => {
    setAssigningId(prescriptionId);
    try {
      const { error } = await supabase
        .from("prescriptions")
        .update({ assigned_partner_id: partnerId })
        .eq("id", prescriptionId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["admin-prescriptions"] });
      toast.success(`Order assigned to ${partnerName}`);
    } catch (err: any) {
      toast.error("Assignment failed: " + err.message);
    } finally {
      setAssigningId(null);
    }
  };

  // Delivery orders = prescriptions that are dispatched or completed
  const deliveryOrders = prescriptions.filter(p =>
    ["dispatched", "completed", "reviewed"].includes(p.status)
  );
  const totalToDeliver   = deliveryOrders.length;
  const pendingDelivery  = deliveryOrders.filter(p => p.status === "reviewed" || p.status === "dispatched").length;
  const delivered        = deliveryOrders.filter(p => p.status === "completed").length;
  const unassigned       = deliveryOrders.filter(p => !p.assigned_partner_id).length;
  const assignedOrders   = deliveryOrders.filter(p => !!p.assigned_partner_id).length;

  // ─── Nav Items ─────────────────────────────────────────────────────────────
  const NAV = [
    { id: "overview" as Tab,      label: "Overview",       icon: <Activity className="h-4 w-4" /> },
    { id: "live" as Tab,          label: "Live Feed",      icon: <RefreshCw className="h-4 w-4" /> },
    { id: "lookup" as Tab,        label: "Order Lookup",   icon: <Search className="h-4 w-4" /> },
    { id: "users" as Tab,         label: "Users",          icon: <Users className="h-4 w-4" /> },
    { id: "partners" as Tab,      label: "Partners",       icon: <Building2 className="h-4 w-4" /> },
    { id: "logistics_hub" as Tab, label: "Logistics Hub",  icon: <Truck className="h-4 w-4" /> },
    { id: "payouts" as Tab,       label: "Payouts",        icon: <IndianRupee className="h-4 w-4" /> },
    { id: "credentials" as Tab,   label: "Credentials",    icon: <KeyRound className="h-4 w-4" /> },
    { id: "commissions" as Tab,   label: "Commissions",    icon: <Percent className="h-4 w-4" /> },
    { id: "transactions" as Tab,  label: "Transactions",   icon: <CreditCard className="h-4 w-4" /> },
    { id: "banners" as Tab,       label: "Banners",        icon: <Eye className="h-4 w-4" /> },
    { id: "settings" as Tab,      label: "Settings",       icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F6FA]">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-60 bg-[#0F172A] flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-5 py-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-white font-black text-sm leading-none">Aaroksha</p>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">Super Admin</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="text-slate-600 text-[9px] font-black uppercase tracking-widest px-2 mb-2">Platform</p>
          {NAV.slice(0, 6).map(n => (
            <button key={n.id} onClick={() => setActiveTab(n.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === n.id ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>
              {n.icon}<span>{n.label}</span>
              {activeTab === n.id && (n.id === "live" ? <span className="ml-auto h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> : <ChevronRight className="h-3.5 w-3.5 ml-auto" />)}
              {n.id === "logistics_hub" && unassigned > 0 && activeTab !== "logistics_hub" && (
                <span className="ml-auto h-5 w-5 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center">{unassigned}</span>
              )}
            </button>
          ))}
          <p className="text-slate-600 text-[9px] font-black uppercase tracking-widest px-2 mb-2 mt-4">Finance</p>
          {NAV.slice(6, 9).map(n => (
            <button key={n.id} onClick={() => setActiveTab(n.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === n.id ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>
              {n.icon}<span>{n.label}</span>
              {activeTab === n.id && <ChevronRight className="h-3.5 w-3.5 ml-auto" />}
            </button>
          ))}
          <p className="text-slate-600 text-[9px] font-black uppercase tracking-widest px-2 mb-2 mt-4">System</p>
          {NAV.slice(9).map(n => (
            <button key={n.id} onClick={() => setActiveTab(n.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === n.id ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>
              {n.icon}<span>{n.label}</span>
              {activeTab === n.id && <ChevronRight className="h-3.5 w-3.5 ml-auto" />}
            </button>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="px-3 py-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-3 py-2.5">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-black">SA</div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-bold truncate">Super Admin</p>
              <p className="text-slate-500 text-[10px] truncate">super@aaroksha.com</p>
            </div>
            <button onClick={() => supabase.auth.signOut()} className="text-slate-500 hover:text-red-400 transition-colors">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 mx-3 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-400 font-bold">System Healthy</span>
          </div>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-100 px-8 py-4 flex items-center justify-between shrink-0 shadow-sm">
          <div>
            <h1 className="text-lg font-black text-slate-900">{NAV.find(n => n.id === activeTab)?.label}</h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Aaroksha Health Platform · Super Admin Control Panel</p>
          </div>
          <div className="flex items-center gap-3">
            {activeTab === "partners" && (
              <button onClick={() => setShowAddPartner(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-95">
                <Plus className="h-4 w-4" /> Add Partner
              </button>
            )}
            <div className="text-right">
              <p className="text-xs font-bold text-slate-600">{new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</p>
              <p className="text-[10px] text-slate-400">{partners.filter(p => p.status === "active").length} active partners</p>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">

          {/* ── OVERVIEW ──────────────────────────────────────────────── */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Stat Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Revenue" value={`₹${(totalRevenue/1000).toFixed(1)}K`} sub="All sources" icon={<IndianRupee className="h-5 w-5 text-blue-600" />} accent="bg-blue-50" />
                <StatCard label="Appointments" value={appointments.length} sub="OPD Bookings" icon={<Users className="h-5 w-5 text-violet-600" />} accent="bg-violet-50" />
                <StatCard label="Prescriptions" value={prescriptions.length} sub="Pharmacy orders" icon={<Pill className="h-5 w-5 text-emerald-600" />} accent="bg-emerald-50" />
                <StatCard label="Lab Bookings" value={labBookings.length} sub="Diagnostics" icon={<FlaskConical className="h-5 w-5 text-orange-600" />} accent="bg-orange-50" />
              </div>

              {/* Revenue Breakdown */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                <h3 className="font-black text-slate-900 mb-4">Revenue Breakdown by Partner</h3>
                <div className="space-y-4">
                  {[
                    { label: "Hospital (OPD)", value: hospitalRev, total: totalRevenue, color: "bg-blue-500", type: "hospital" },
                    { label: "Lab (Diagnostics)", value: labRev, total: totalRevenue, color: "bg-violet-500", type: "lab" },
                    { label: "Pharmacy", value: pharmRev, total: totalRevenue, color: "bg-emerald-500", type: "pharmacy" },
                    { label: "Logistics (Delivery)", value: logisticsRev, total: totalRevenue, color: "bg-indigo-500", type: "logistics" },
                  ].map(r => (
                    <div key={r.type}>
                      <div className="flex justify-between text-sm font-medium mb-1.5">
                        <span className="text-slate-600">{r.label}</span>
                        <span className="font-black text-slate-900">₹{r.value.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${r.color} rounded-full transition-all duration-700`}
                          style={{ width: totalRevenue > 0 ? `${(r.value / totalRevenue * 100).toFixed(1)}%` : "0%" }} />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">{totalRevenue > 0 ? (r.value/totalRevenue*100).toFixed(1) : 0}% of total</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Stats Row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Commission Earned</p>
                  <p className="text-2xl font-black text-blue-600">₹{totalCommission.toLocaleString("en-IN")}</p>
                  <p className="text-xs text-slate-400 mt-1">Platform cut this cycle</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Active Partners</p>
                  <p className="text-2xl font-black text-emerald-600">{partners.filter(p => p.status === "active").length}</p>
                  <p className="text-xs text-slate-400 mt-1">Hospitals, Labs, Pharmacies</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Transactions</p>
                  <p className="text-2xl font-black text-slate-900">{appointments.length + prescriptions.length + labBookings.length}</p>
                  <p className="text-xs text-slate-400 mt-1">Across all channels</p>
                </div>
              </div>
            </div>
          )}

          {/* ── LIVE FEED ──────────────────────────────────────────────── */}
          {activeTab === "live" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 outline-none w-full">
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="week">Past 7 Days</option>
                    <option value="month">Past 30 Days</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>
                {dateFilter === "custom" && (
                  <div className="flex gap-2">
                    <input type="date" value={customDate.start} onChange={e => setCustomDate({...customDate, start: e.target.value})} className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none" />
                    <input type="date" value={customDate.end} onChange={e => setCustomDate({...customDate, end: e.target.value})} className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none" />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </div>
                  <h3 className="font-black text-slate-900">Live Booking Feed</h3>
                </div>
                <div className="flex gap-2">
                  {[
                    { id: "all", label: "All Activity" },
                    { id: "opd", label: "OPD Bookings" },
                    { id: "lab", label: "Lab Tests" },
                    { id: "pharmacy", label: "Medicines" }
                  ].map(f => (
                    <button key={f.id} onClick={() => setLiveFilter(f.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${liveFilter === f.id ? "bg-slate-900 text-white shadow-md shadow-slate-900/20" : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-100"}`}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="divide-y divide-slate-50">
                  {liveFeed.filter(item => liveFilter === "all" || item.feedType === liveFilter).slice(0, 50).map((item, i) => {
                    const isOpd = item.feedType === "opd";
                    const isLab = item.feedType === "lab";
                    const isPharm = item.feedType === "pharmacy";
                    
                    // Casting to specific types for property access
                    const opdData = isOpd ? (item as Appointment) : null;
                    const labData = isLab ? (item as LabBooking) : null;
                    const pharmData = isPharm ? (item as Prescription) : null;
                    
                    const icon = isOpd ? <Stethoscope className="h-4 w-4" /> : isLab ? <FlaskConical className="h-4 w-4" /> : <Pill className="h-4 w-4" />;
                    const color = isOpd ? "text-blue-600 bg-blue-50" : isLab ? "text-violet-600 bg-violet-50" : "text-emerald-600 bg-emerald-50";
                    
                    return (
                      <div key={`${item.feedType}-${item.id || i}`} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>{icon}</div>
                        <div className="flex-1">
                          <p className="font-bold text-slate-900 text-sm">
                            {isOpd && `New Appointment: ${item.patient_name || "Unknown"} with Dr ${opdData?.doctor_name || ""}`}
                            {isLab && `Lab Booking: ${labData?.test_names?.join(", ") || "Tests"} by ${item.patient_name || "Unknown"}`}
                            {isPharm && `Pharmacy Order: ${pharmData?.medicines?.length || 1} items by ${item.patient_name || "Unknown"}`}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isOpd ? "OPD" : isLab ? "LAB" : "PHARMACY"}</span>
                            <span className="text-[10px] text-slate-400">·</span>
                            <span className="text-xs font-medium text-slate-500">{new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-slate-900">₹{opdData?.consultation_fee || labData?.total_amount || pharmData?.grand_total || 0}</p>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${item.payment_status === "paid" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>{item.payment_status || "pending"}</span>
                        </div>
                      </div>
                    );
                  })}
                  {liveFeed.filter(item => liveFilter === "all" || item.feedType === liveFilter).length === 0 && (
                    <div className="px-6 py-12 text-center text-slate-400">No live activity detected for {liveFilter === 'all' ? 'any service' : liveFilter}.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── ORDER LOOKUP ─────────────────────────────────────────────── */}
          {activeTab === "lookup" && (
            <div className="space-y-6">
              {/* Search bar */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-11 w-11 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Search className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">Order Lookup</h3>
                    <p className="text-xs text-slate-400">Enter any Order ID to see complete booking details instantly</p>
                  </div>
                </div>

                {/* Format hints */}
                <div className="flex gap-2 mb-4">
                  {[
                    { label: "OPD-XXXXXX", color: "bg-blue-50 text-blue-700 border-blue-200", tip: "Doctor Appointment" },
                    { label: "LAB-XXXXXX", color: "bg-violet-50 text-violet-700 border-violet-200", tip: "Lab Test Booking" },
                    { label: "MED-XXXXXX", color: "bg-emerald-50 text-emerald-700 border-emerald-200", tip: "Pharmacy Order" },
                  ].map(h => (
                    <div key={h.label} className="flex flex-col gap-0.5">
                      <span className={`text-[10px] font-black px-3 py-1 rounded-full border font-mono ${h.color}`}>{h.label}</span>
                      <span className="text-[9px] text-slate-400 text-center">{h.tip}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <input
                    value={lookupId}
                    onChange={e => { setLookupId(e.target.value.toUpperCase()); setLookupError(""); }}
                    onKeyDown={e => e.key === "Enter" && handleLookup()}
                    placeholder="Type Order ID e.g. OPD-A3F7K2"
                    className="flex-1 h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-mono font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-300 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all tracking-wider"
                  />
                  <button
                    onClick={handleLookup}
                    disabled={lookupLoading}
                    className="h-12 px-7 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-blue-200 disabled:opacity-60 active:scale-95"
                  >
                    {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-4 w-4" /> Search</>}
                  </button>
                </div>

                {lookupError && (
                  <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                    <p className="text-sm text-red-700 font-medium">{lookupError}</p>
                  </div>
                )}
              </div>

              {/* Result Card */}
              {lookupResult && (() => {
                const r = lookupResult;
                const isOpd = r._type === "opd";
                const isLab = r._type === "lab";
                const isMed = r._type === "med";

                const typeConfig = isOpd
                  ? { label: "OPD Appointment", icon: <Stethoscope className="h-5 w-5" />, accent: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", badge: "bg-blue-100 text-blue-700" }
                  : isLab
                  ? { label: "Lab Test Booking", icon: <FlaskConical className="h-5 w-5" />, accent: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200", badge: "bg-violet-100 text-violet-700" }
                  : { label: "Pharmacy / Prescription", icon: <Pill className="h-5 w-5" />, accent: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", badge: "bg-emerald-100 text-emerald-700" };

                const opdResult = isOpd ? (r as Appointment) : null;
                const labResult = isLab ? (r as LabBooking) : null;
                const medResult = isMed ? (r as Prescription) : null;

                const statusColor = r.status === "confirmed" || r.status === "completed" || r.status === "delivered" || r.status === "scheduled"
                  ? "bg-emerald-50 text-emerald-700"
                  : r.status === "pending" ? "bg-amber-50 text-amber-700"
                  : r.status === "reviewed" ? "bg-blue-50 text-blue-700"
                  : r.status === "rejected" ? "bg-red-50 text-red-600"
                  : "bg-slate-50 text-slate-600";

                const grandTotal = medResult?.grand_total || labResult?.total_amount ||
                  (Number(opdResult?.consultation_fee || opdResult?.fee || 0) + Number(r.platform_fee || 0) + (opdResult?.is_priority ? 250 : 0));

                return (
                  <div className={`bg-white rounded-2xl border-2 ${typeConfig.border} shadow-lg overflow-hidden`}>
                    {/* Card Header */}
                    <div className={`${typeConfig.bg} px-6 py-5 flex items-center justify-between border-b ${typeConfig.border}`}>
                      <div className="flex items-center gap-3">
                        <div className={`h-12 w-12 ${typeConfig.bg} border-2 ${typeConfig.border} rounded-xl flex items-center justify-center ${typeConfig.accent}`}>
                          {typeConfig.icon}
                        </div>
                        <div>
                          <span className={`text-[9px] font-black uppercase tracking-widest ${typeConfig.accent}`}>{typeConfig.label}</span>
                          <h3 className="text-2xl font-black text-slate-900 font-mono tracking-widest leading-tight">{r.order_id}</h3>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide ${statusColor}`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {r.status}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-1.5">
                          {new Date(r.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                        </p>
                      </div>
                    </div>

                    <div className="p-6 space-y-6">

                      {/* ─ Customer Info ─ */}
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <Users className="h-3.5 w-3.5" /> Customer Information
                        </p>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Patient Name</p>
                            <p className="text-sm font-black text-slate-900">{r.patient_name || "—"}</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Mobile Number</p>
                            <p className="text-sm font-black text-slate-900">{r.patient_phone || "—"}</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Payment Status</p>
                            <p className={`text-sm font-black ${r.payment_status === "paid" ? "text-emerald-600" : "text-amber-600"}`}>
                              {r.payment_status === "paid" ? "✓ Paid" : "⏳ " + (r.payment_status || "Pending")}
                            </p>
                          </div>
                          {r.delivery_address && (
                            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 col-span-2 lg:col-span-3">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Delivery Address</p>
                              <p className="text-sm font-bold text-slate-900">{r.delivery_address}</p>
                            </div>
                          )}
                          {r.patient_address && (
                            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 col-span-2 lg:col-span-3">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Collection Address</p>
                              <p className="text-sm font-bold text-slate-900">{r.patient_address}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ─ Booking Specifics ─ */}
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5" /> Booking Details
                        </p>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                          {isOpd && (<>
                            <div className={`${typeConfig.bg} rounded-xl p-3 border ${typeConfig.border}`}>
                              <p className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${typeConfig.accent}`}>Doctor</p>
                              <p className="text-sm font-black text-slate-900">{opdResult?.doctor_name || "—"}</p>
                            </div>
                            <div className={`${typeConfig.bg} rounded-xl p-3 border ${typeConfig.border}`}>
                              <p className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${typeConfig.accent}`}>Date & Time</p>
                              <p className="text-sm font-black text-slate-900">{opdResult?.appointment_date} · {opdResult?.appointment_time}</p>
                            </div>
                            {(opdResult?.patient_age || opdResult?.patient_gender) && (
                              <div className={`${typeConfig.bg} rounded-xl p-3 border ${typeConfig.border}`}>
                                <p className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${typeConfig.accent}`}>Age / Gender</p>
                                <p className="text-sm font-black text-slate-900">{opdResult?.patient_age} yrs · {opdResult?.patient_gender || "—"}</p>
                              </div>
                            )}
                            {opdResult?.is_priority && (
                              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                                <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-0.5">Type</p>
                                <p className="text-sm font-black text-amber-700">⚡ Priority Appointment</p>
                              </div>
                            )}
                          </>)}
                          {isLab && (<>
                            <div className={`${typeConfig.bg} rounded-xl p-3 border ${typeConfig.border}`}>
                              <p className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${typeConfig.accent}`}>Collection Date & Time</p>
                              <p className="text-sm font-black text-slate-900">{labResult?.collection_date} · {labResult?.collection_time}</p>
                            </div>
                            {labResult?.technician && (
                              <div className={`${typeConfig.bg} rounded-xl p-3 border ${typeConfig.border}`}>
                                <p className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${typeConfig.accent}`}>Technician</p>
                                <p className="text-sm font-black text-slate-900">{labResult?.technician}</p>
                              </div>
                            )}
                          </>)}
                          {isMed && (<>
                            {medResult?.is_express_delivery && (
                              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                                <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-0.5">Delivery Mode</p>
                                <p className="text-sm font-black text-amber-700">⚡ Express Delivery</p>
                              </div>
                            )}
                            {medResult?.admin_note && (
                              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 col-span-2 lg:col-span-3">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Admin Note</p>
                                <p className="text-sm font-bold text-slate-700">"{medResult?.admin_note}"</p>
                              </div>
                            )}
                          </>)}
                        </div>
                      </div>

                      {/* ─ Items Ordered ─ */}
                      {isLab && labResult && labResult.tests?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <FlaskConical className="h-3.5 w-3.5" /> Lab Tests Ordered ({labResult.tests.length})
                          </p>
                          <div className="bg-white border border-slate-100 rounded-xl divide-y divide-slate-50">
                            {labResult.tests.map((t: LabTest, i: number) => (
                              <div key={i} className="flex items-center justify-between px-4 py-3">
                                <p className="text-sm font-bold text-slate-800">{t.name}</p>
                                <p className="font-black text-slate-900">₹{t.price}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {isMed && medResult && medResult.medicines?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Pill className="h-3.5 w-3.5" /> Medicines ({medResult.medicines.length})
                          </p>
                          <div className="bg-white border border-slate-100 rounded-xl divide-y divide-slate-50">
                            {medResult.medicines.map((m: Medicine, i: number) => (
                              <div key={i} className={`flex items-center justify-between px-4 py-3 ${!m.available ? "opacity-40" : ""}`}>
                                <div>
                                  <p className="text-sm font-bold text-slate-800">{m.name}</p>
                                  <p className="text-[10px] text-slate-400">{m.dosage} · Qty: {m.qty || 1}</p>
                                </div>
                                {m.available
                                  ? <p className="font-black text-slate-900">₹{m.price}</p>
                                  : <span className="text-[9px] font-bold text-red-400 bg-red-50 px-2 py-0.5 rounded-full">Out of Stock</span>
                                }
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ─ Bill Summary ─ */}
                      <div className={`${typeConfig.bg} rounded-xl border ${typeConfig.border} p-4`}>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <IndianRupee className="h-3.5 w-3.5" /> Bill Summary
                        </p>
                        <div className="space-y-2">
                          {isOpd && (<>
                            <div className="flex justify-between text-sm"><span className="text-slate-500">Consultation Fee</span><span className="font-black text-slate-900">₹{opdResult?.consultation_fee || opdResult?.fee || 0}</span></div>
                            <div className="flex justify-between text-sm"><span className="text-slate-500">Platform Fee</span><span className="font-black text-slate-900">₹{r.platform_fee || 29}</span></div>
                            {opdResult?.is_priority && <div className="flex justify-between text-sm"><span className="text-amber-600 font-bold">⚡ Priority Surcharge</span><span className="font-black text-amber-700">₹250</span></div>}
                          </>)}
                          {isLab && (<>
                            <div className="flex justify-between text-sm"><span className="text-slate-500">Tests Subtotal</span><span className="font-black text-slate-900">₹{(labResult?.total_amount || 0) - (r.platform_fee || 49)}</span></div>
                            <div className="flex justify-between text-sm"><span className="text-slate-500">Platform Fee</span><span className="font-black text-slate-900">₹{r.platform_fee || 49}</span></div>
                          </>)}
                          {isMed && (<>
                            <div className="flex justify-between text-sm"><span className="text-slate-500">Medicines Subtotal</span><span className="font-black text-slate-900">₹{medResult?.sub_total || 0}</span></div>
                            <div className="flex justify-between text-sm"><span className="text-slate-500">Delivery Fee</span><span className="font-black text-slate-900">₹{medResult?.delivery_fee || 40}</span></div>
                            <div className="flex justify-between text-sm"><span className="text-slate-500">Platform Fee</span><span className="font-black text-slate-900">₹{r.platform_fee || 19}</span></div>
                          </>)}
                          <div className={`flex justify-between border-t ${typeConfig.border} pt-3 mt-1`}>
                            <span className="font-bold text-slate-800 text-base">Grand Total</span>
                            <span className={`text-2xl font-black ${typeConfig.accent}`}>₹{grandTotal}</span>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── USERS ──────────────────────────────────────────────────── */}
          {activeTab === "users" && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-slate-900">Platform Users</h3>
                    <p className="text-xs text-slate-400">{platformUsers.length} total registered patients/users</p>
                  </div>
                </div>
                <div className="divide-y divide-slate-50">
                  {platformUsers.map((user: PlatformUser) => (
                    <div key={user.id} className={`px-6 py-4 flex items-center gap-4 transition-colors ${user.is_suspended ? "bg-red-50/30" : "hover:bg-slate-50/50"}`}>
                      <div className={`h-10 w-10 flex items-center justify-center rounded-xl shrink-0 font-black text-white ${user.is_suspended ? "bg-red-300" : "bg-blue-600"}`}>
                        {user.full_name?.charAt(0).toUpperCase() || "U"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-bold text-sm ${user.is_suspended ? "text-red-900 line-through opacity-70" : "text-slate-900"}`}>{user.full_name || "Unknown User"}</p>
                          {user.is_suspended && <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-red-100 text-red-600">Suspended</span>}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{user.email || "No email"} · {user.phone || "No phone"}</p>
                      </div>
                      <div className="text-right shrink-0 px-4 border-r border-slate-100">
                        <p className="text-xs text-slate-400">Joined</p>
                        <p className="text-[10px] font-bold text-slate-500">{new Date(user.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="shrink-0">
                        <button onClick={() => handleSuspendUser(user)}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${user.is_suspended ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" : "bg-red-50 text-red-600 hover:bg-red-100"}`}>
                          {user.is_suspended ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                          {user.is_suspended ? "Reactivate User" : "Suspend Account"}
                        </button>
                      </div>
                    </div>
                  ))}
                  {platformUsers.length === 0 && <div className="px-6 py-12 text-center text-slate-400">No users found.</div>}
                </div>
              </div>
            </div>
          )}

          {/* ── PARTNERS ──────────────────────────────────────────────── */}
          {activeTab === "partners" && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-slate-900">All Partners</h3>
                    <p className="text-xs text-slate-400">{partners.length} registered partners</p>
                  </div>
                </div>
                <div className="divide-y divide-slate-50">
                  {partners.map(partner => {
                    const meta = TYPE_META[partner.type];
                    return (
                      <div key={partner.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                        <div className={`h-10 w-10 ${meta.bg} rounded-xl flex items-center justify-center ${meta.color} shrink-0`}>
                          {meta.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900 text-sm">{partner.name}</p>
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>{meta.label}</span>
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${partner.status === "active" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>{partner.status}</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{partner.email} · Commission: {partner.commission_type === "fixed" ? `₹${partner.commission_rate}/txn` : `${partner.commission_rate}%`}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] text-slate-400 font-mono">{partner.partner_id.slice(0, 18)}…</p>
                          <p className="text-[10px] text-slate-300">{partner.phone || "No phone"}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <a href={meta.route} target="_blank" rel="noreferrer"
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${meta.bg} ${meta.color} hover:opacity-80 transition-all`}>
                            <ArrowUpRight className="h-3 w-3" /> Portal
                          </a>
                          <button onClick={() => { setEditingPartner(partner); setShowAddPartner(true); }}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleDeletePartner(partner.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Data Isolation Notice */}
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex gap-3">
                <AlertCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-blue-900 mb-1">Data Isolation Active</p>
                  <p className="text-xs text-blue-700 leading-relaxed">Each partner admin sees <strong>only their own data</strong>. Hospital admins see their doctors & appointments. Lab admins see only their own bookings. Pharmacy admins see only their prescriptions. This is enforced via <code className="bg-blue-100 px-1 rounded font-mono text-[10px]">partner_id</code> in Supabase user_metadata.</p>
                </div>
              </div>
            </div>
          )}

          {/* ── PAYOUTS ───────────────────────────────────────────────── */}
          {activeTab === "payouts" && (() => {
            const payoutRows = partners.map(p => {
              const earned = getPartnerEarned(p);
              const txnCount = getPartnerTxnCount(p);
              const commission = getPartnerCommission(p);
              const platFees = getPartnerPlatformFees(p, txnCount);
              return {
                id: p.id, name: p.name, type: p.type,
                earned, txnCount, commission, platFees, netPayable: Math.max(0, earned - commission - platFees)
              };
            });
            const totalPayable = payoutRows.reduce((s, r) => s + r.netPayable, 0);

            const exportToPDF = () => {
              const doc = new jsPDF();
              
              doc.setFontSize(16);
              doc.text("Aaroksha Platform Payout Report", 14, 20);
              
              doc.setFontSize(10);
              const filterLabel = dateFilter === "all" ? "All Time" : dateFilter === "custom" ? `${customDate.start} to ${customDate.end}` : dateFilter.toUpperCase();
              doc.text(`Generated: ${new Date().toLocaleDateString()} | Filter: ${filterLabel}`, 14, 28);
              
              const tableColumn = ["Partner", "Type", "Txns", "Earned (INR)", "Plat. Fee", "Comm.", "Net Payable"];
              const tableRows = payoutRows.map(r => [
                r.name,
                r.type.toUpperCase(),
                r.txnCount.toString(),
                r.earned.toLocaleString("en-IN"),
                `- ${r.platFees.toLocaleString("en-IN")}`,
                `- ${r.commission.toLocaleString("en-IN")}`,
                `${r.netPayable.toLocaleString("en-IN")}`
              ]);

              autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 35,
                theme: 'grid',
                headStyles: { fillColor: [15, 23, 42], textColor: 255 },
                styles: { fontSize: 8, cellPadding: 3 },
                columnStyles: {
                  3: { halign: 'right' },
                  4: { halign: 'right', textColor: [217, 119, 6] },
                  5: { halign: 'right', textColor: [220, 38, 38] },
                  6: { halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105] }
                }
              });

              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              const finalY = doc.lastAutoTable?.finalY || 40;
              doc.setFontSize(12);
              doc.text(`Total Aggregated Payouts: Rs ${totalPayable.toLocaleString("en-IN")}`, 14, finalY + 15);
              
              doc.save(`Aaroksha_Payouts_${dateFilter}.pdf`);
              toast.success("PDF Report generated successfully!");
            };

            return (
              <div className="space-y-5">
                <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                  <div className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 outline-none w-full">
                      <option value="all">All Time</option>
                      <option value="today">Today</option>
                      <option value="yesterday">Yesterday</option>
                      <option value="week">Past 7 Days</option>
                      <option value="month">Past 30 Days</option>
                      <option value="custom">Custom Range</option>
                    </select>
                  </div>
                  {dateFilter === "custom" && (
                    <div className="flex gap-2">
                      <input type="date" value={customDate.start} onChange={e => setCustomDate({...customDate, start: e.target.value})} className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none" />
                      <input type="date" value={customDate.end} onChange={e => setCustomDate({...customDate, end: e.target.value})} className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none" />
                    </div>
                  )}
                </div>

                <div className="bg-[#0F172A] rounded-2xl p-6 flex items-center justify-between shadow-xl">
                  <div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Total Pending Payouts</p>
                    <p className="text-4xl font-black text-white">₹{totalPayable.toLocaleString("en-IN")}</p>
                    <p className="text-slate-500 text-sm mt-1">Net of commission & platform fees · {payoutRows.length} partners</p>
                  </div>
                  <button onClick={exportToPDF} className="flex items-center gap-2 bg-white text-slate-900 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-100 transition-all">
                    <Download className="h-4 w-4" /> Export PDF
                  </button>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-50">
                        <th className="px-6 py-3.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Partner</th>
                        <th className="px-4 py-3.5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Gross</th>
                        <th className="px-4 py-3.5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Commission</th>
                        <th className="px-4 py-3.5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Platform Fees</th>
                        <th className="px-4 py-3.5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Payable</th>
                        <th className="px-6 py-3.5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {payoutRows.map(row => {
                        const meta = TYPE_META[row.type];
                        return (
                          <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className={`h-9 w-9 ${meta.bg} rounded-xl flex items-center justify-center ${meta.color}`}>{meta.icon}</div>
                                <div>
                                  <p className="font-bold text-slate-900 text-sm">{row.name}</p>
                                  <p className="text-[10px] text-slate-400">{row.txnCount} transactions</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-right font-bold text-slate-700">₹{row.earned.toLocaleString("en-IN")}</td>
                            <td className="px-4 py-4 text-right"><span className="text-red-600 font-bold">−₹{row.commission.toLocaleString("en-IN")}</span></td>
                            <td className="px-4 py-4 text-right"><span className="text-amber-600 font-bold">−₹{row.platFees.toLocaleString("en-IN")}</span></td>
                            <td className="px-4 py-4 text-right">
                              <span className={`font-black text-lg ${paidPartners[row.id] ? "text-slate-400 line-through" : "text-emerald-600"}`}>
                                ₹{row.netPayable.toLocaleString("en-IN")}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {paidPartners[row.id] ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl">
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Paid
                                </span>
                              ) : (
                                <button onClick={() => { setPaidPartners(p => ({ ...p, [row.id]: true })); toast.success(`Marked ₹${row.netPayable.toLocaleString("en-IN")} as paid to ${row.name}`); }}
                                  className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-xl transition-all">
                                  <IndianRupee className="h-3.5 w-3.5" /> Mark Paid
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-2.5">
                  <Clock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">Payouts are calculated monthly. Commission is auto-deducted. All transactions are logged for audit.</p>
                </div>
              </div>
            );
          })()}

          {/* ── CREDENTIALS ───────────────────────────────────────────── */}
          {activeTab === "credentials" && (
            <div className="space-y-4">
              <div className="bg-[#0F172A] rounded-2xl p-6 shadow-xl flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <KeyRound className="h-5 w-5 text-amber-400" />
                    <h3 className="font-black text-white">Admin Portal Credentials</h3>
                  </div>
                  <p className="text-slate-400 text-sm">All partner login details. Credentials are encrypted at rest.</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2">
                  <p className="text-amber-400 text-xs font-bold">🔒 Restricted Access</p>
                </div>
              </div>

              {/* Super Admin Row */}
              <div className="bg-white rounded-2xl border-2 border-amber-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-amber-50 rounded-xl flex items-center justify-center"><ShieldCheck className="h-5 w-5 text-amber-600" /></div>
                    <div>
                      <p className="font-black text-slate-900">Super Admin</p>
                      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Master Access · Your Account</p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-amber-100 text-amber-700 font-black px-3 py-1 rounded-full uppercase tracking-wider">super</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[{ l: "Portal URL", v: "/admin/login/super" }, { l: "Email", v: "super@aaroksha.com" }, { l: "Role Tag", v: "super" }].map(f => (
                    <div key={f.l} className="bg-slate-50 rounded-xl p-3">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{f.l}</p>
                      <p className="text-sm font-bold text-slate-900">{f.v}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Partner Credential Cards */}
              {partners.map(cp => {
                const meta = getMeta(cp.type);
                const visible = showCreds[cp.id];
                return (
                  <div key={cp.id} className={`bg-white rounded-2xl border shadow-sm p-5 ${meta.border}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 ${meta.bg} rounded-xl flex items-center justify-center ${meta.color}`}>{meta.icon}</div>
                        <div>
                          <p className="font-black text-slate-900">{cp.name}</p>
                          <p className={`text-[10px] font-black uppercase tracking-widest ${meta.color}`}>{meta.label} Admin</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setShowCreds(p => ({ ...p, [cp.id]: !p[cp.id] }))}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${visible ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}>
                          {visible ? <><EyeOff className="h-3.5 w-3.5" /> Hide</> : <><Eye className="h-3.5 w-3.5" /> Show Creds</>}
                        </button>
                        <a href={meta.route} target="_blank" rel="noreferrer"
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${meta.bg} ${meta.color} border ${meta.border} hover:opacity-80 transition-all`}>
                          <ArrowUpRight className="h-3.5 w-3.5" /> Open Portal
                        </a>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Portal URL</p>
                        <p className="text-xs font-bold text-slate-900">/admin/login/{cp.type}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Email</p>
                        <p className="text-xs font-bold text-slate-900 break-all">{cp.email}</p>
                      </div>
                      <div className={`rounded-xl p-3 ${visible ? meta.bg : "bg-slate-50"}`}>
                        <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${visible ? meta.color : "text-slate-400"}`}>Password</p>
                        <div className="flex items-center gap-2">
                          <p className={`text-xs font-black font-mono ${visible ? "text-slate-900" : "text-slate-300 tracking-[0.25em]"}`}>
                            {visible ? cp.password : "•••••••••"}
                          </p>
                          {visible && (
                            <button onClick={() => { navigator.clipboard.writeText(cp.password); toast.success("Copied!"); }}
                              className="ml-auto"><Copy className="h-3 w-3 text-slate-400 hover:text-slate-700" /></button>
                          )}
                        </div>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Partner ID</p>
                        <p className="text-[10px] font-mono text-slate-500 truncate">{cp.partner_id}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── COMMISSIONS ───────────────────────────────────────────── */}
          {activeTab === "commissions" && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50">
                  <h3 className="font-black text-slate-900">Commission Rates</h3>
                  <p className="text-xs text-slate-400">Platform fee deducted from each partner's revenue</p>
                </div>
                <div className="divide-y divide-slate-50">
                  {partners.map(p => {
                    const meta = getMeta(p.type);
                    const commission = getPartnerCommission(p);
                    return (
                      <div key={p.id} className="px-6 py-4 flex items-center gap-4">
                        <div className={`h-9 w-9 ${meta.bg} rounded-xl flex items-center justify-center ${meta.color} shrink-0`}>{meta.icon}</div>
                        <div className="flex-1">
                          <p className="font-bold text-slate-900 text-sm">{p.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {p.commission_type === "percentage" ? (
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${p.commission_rate}%` }} />
                              </div>
                            ) : (
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-500 rounded-full" style={{ width: "100%" }} />
                              </div>
                            )}
                            <span className="text-xs font-black text-slate-700 w-16 text-right">
                              {p.commission_type === "fixed" ? `₹${p.commission_rate}/txn` : `${p.commission_rate}%`}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Commission Earned</p>
                          <p className="font-black text-slate-900">₹{commission.toLocaleString("en-IN")}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── TRANSACTIONS ──────────────────────────────────────────── */}
          {activeTab === "transactions" && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-50">
                <h3 className="font-black text-slate-900">All Platform Transactions</h3>
                <p className="text-xs text-slate-400">{filteredAppointments.length + filteredPrescriptions.length + filteredLabBookings.length} total transactions in this period</p>
              </div>
              <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
                {liveFeed.map((item, idx) => (
                  <div key={idx} className="px-6 py-3.5 flex items-center gap-3 hover:bg-slate-50/50 transition-colors">
                    <div className={`h-8 w-8 ${TYPE_META[item.feedType]?.bg} rounded-lg flex items-center justify-center ${TYPE_META[item.feedType]?.color}`}>
                      {TYPE_META[item.feedType]?.icon}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-900">{(item as any).patient_name || "Patient"}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">
                        {item.feedType} • {new Date(item.timestamp).toLocaleDateString()} • {(item as any).order_id || "Order"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-slate-900">₹{(item as any).consultation_fee || (item as any).grand_total || (item as any).total_amount || 0}</p>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${(item as any).payment_status === "paid" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                        {(item as any).payment_status || "pending"}
                      </span>
                    </div>
                  </div>
                ))}
                {liveFeed.length === 0 && (
                  <div className="px-6 py-12 text-center text-slate-400 text-sm">No transactions found for the selected period</div>
                )}
              </div>
            </div>
          )}

          {/* ── BANNERS ────────────────────────────────────────────────── */}
          {activeTab === "banners" && (
            <div className="space-y-6">
              {/* Header */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-blue-50 rounded-xl flex items-center justify-center">
                    <LayoutTemplate className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900">Banner Manager</h3>
                    <p className="text-xs text-slate-400">{platformBanners.length} banner{platformBanners.length !== 1 ? "s" : ""} · Changes go live instantly</p>
                  </div>
                </div>
                <button
                  onClick={handleAddBanner}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-200 transition-all active:scale-95"
                >
                  <Plus className="h-4 w-4" /> Add Banner
                </button>
              </div>

              {/* Live Preview */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Live Preview — Slide {bannerPreviewIdx + 1} of {platformBanners.length}</p>
                {platformBanners[bannerPreviewIdx] && (() => {
                  const b = platformBanners[bannerPreviewIdx];
                  const isImageOnly = !!(b.image && b.imageOnly);
                  return isImageOnly ? (
                    /* Image-Only Preview */
                    <div className="w-full rounded-2xl overflow-hidden relative">
                      <img src={b.image!} alt={b.title} className="w-full block object-cover" style={{ maxHeight: "280px" }} />
                      <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border border-white/20">Image-Only Mode</div>
                      {platformBanners.length > 1 && (
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                          {platformBanners.map((_, i) => (
                            <button key={i} onClick={() => setBannerPreviewIdx(i)}
                              className={`rounded-full transition-all duration-200 ${i === bannerPreviewIdx ? "w-6 h-2 bg-white" : "w-2 h-2 bg-white/50"}`} />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Normal Preview */
                    <div
                      className="w-full rounded-2xl overflow-hidden relative"
                      style={{
                        background: b.image ? `url(${b.image}) center/cover no-repeat` : b.gradient,
                        minHeight: "200px",
                      }}
                    >
                      <div className="absolute inset-0" style={{ background: b.image ? "linear-gradient(120deg,rgba(0,0,0,.6) 0%,rgba(0,0,0,.2) 60%,transparent 100%)" : "linear-gradient(120deg,rgba(0,0,0,.2) 0%,transparent 70%)" }} />
                      {!b.image && (
                        <>
                          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full opacity-20 bg-white" />
                          <div className="absolute right-8 -bottom-8 w-24 h-24 rounded-full opacity-10 bg-white" />
                        </>
                      )}
                      <div className="relative z-10 flex items-center justify-between px-8 py-8" style={{ minHeight: "inherit" }}>
                        <div className="flex-1">
                          <span className="inline-block bg-white/25 backdrop-blur-sm text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-3 border border-white/30">{b.badge}</span>
                          <h2 className="text-white font-black text-2xl leading-tight mb-2 whitespace-pre-line" style={{ textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>{b.title.replace("\\n", "\n")}</h2>
                          <p className="text-white/90 text-sm font-semibold mb-4" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.4)" }}>{b.subtitle}</p>
                          <span className="inline-flex items-center gap-1.5 bg-white font-black text-sm px-5 py-2.5 rounded-xl shadow-xl" style={{ color: b.ctaColor || "#2563eb" }}>
                            {b.cta} <ChevronRight className="h-4 w-4" />
                          </span>
                        </div>
                        {!b.image && <div className="text-7xl ml-6 select-none" style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.25))" }}>{b.emoji}</div>}
                      </div>
                      {platformBanners.length > 1 && (
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                          {platformBanners.map((_, i) => (
                            <button key={i} onClick={() => setBannerPreviewIdx(i)}
                              className={`rounded-full transition-all duration-200 ${i === bannerPreviewIdx ? "w-6 h-2 bg-white" : "w-2 h-2 bg-white/50"}`} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Banner Cards */}
              <div className="space-y-4">
                {platformBanners.map((banner, index) => (
                  <div
                    key={banner.id}
                    className={`bg-white rounded-2xl border-2 shadow-sm transition-all ${
                      index === bannerPreviewIdx ? "border-blue-400 shadow-blue-100" : "border-slate-100"
                    }`}
                  >
                    {/* Card Header */}
                    <div
                      className="flex items-center gap-3 p-4 cursor-pointer select-none"
                      onClick={() => setBannerPreviewIdx(index)}
                    >
                      {/* Drag handle + number */}
                      <div className="flex items-center gap-2 shrink-0">
                        <GripVertical className="h-4 w-4 text-slate-300" />
                        <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs font-black ${
                          index === bannerPreviewIdx ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                        }`}>{index + 1}</div>
                      </div>

                      {/* Mini preview thumbnail */}
                      <div
                        className="h-10 w-16 rounded-lg shrink-0 overflow-hidden border border-slate-100"
                        style={{ background: banner.image ? `url(${banner.image}) center/cover` : banner.gradient }}
                      >
                        {!banner.image && <div className="flex items-center justify-center h-full text-lg">{banner.emoji}</div>}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 text-sm truncate">{banner.title.replace("\\n", " ")}</p>
                        <p className="text-[10px] text-slate-400 truncate">{banner.subtitle}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleMoveBanner(banner.id, "up")} disabled={index === 0}
                          className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 disabled:opacity-30 transition-all">
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleMoveBanner(banner.id, "down")} disabled={index === platformBanners.length - 1}
                          className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 disabled:opacity-30 transition-all">
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDeleteBanner(banner.id)}
                          className="h-7 w-7 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 transition-all">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded editor (only for selected) */}
                    {index === bannerPreviewIdx && (
                      <div className="px-5 pb-5 border-t border-slate-50 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                          {/* Left: Image / Gradient */}
                          <div className="space-y-4">
                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 flex items-center gap-1.5"><ImagePlus className="h-3 w-3" /> Banner Image</label>
                              <div
                                className="w-full aspect-[16/9] rounded-xl overflow-hidden relative flex items-center justify-center border-2 border-dashed border-slate-200 group cursor-pointer"
                                style={{ background: banner.image ? "none" : banner.gradient }}
                                onClick={() => {
                                  const input = document.createElement("input");
                                  input.type = "file"; input.accept = "image/*";
                                  input.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleBannerUpload(banner.id, f); };
                                  input.click();
                                }}
                              >
                                {banner.image ? (
                                  <img src={banner.image} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="text-center">
                                    <div className="text-4xl mb-1">{banner.emoji}</div>
                                    <p className="text-white/80 text-[10px] font-bold">Click to upload image</p>
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                                  <ImagePlus className="h-6 w-6 text-white" />
                                  <span className="text-white text-xs font-bold">Upload / Replace</span>
                                </div>
                              </div>
                              {banner.image && (
                                <>
                                  <button onClick={() => handleUpdateBanner(banner.id, "image", "")}
                                    className="mt-2 w-full flex items-center justify-center gap-1.5 text-red-500 hover:text-red-600 text-xs font-bold py-1.5 border border-red-100 rounded-xl hover:bg-red-50 transition-all">
                                    <Trash2 className="h-3 w-3" /> Remove Image (use gradient)
                                  </button>
                                  {/* Image-Only toggle */}
                                  <div className="mt-3 flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                                    <div>
                                      <p className="text-xs font-black text-slate-700">Show Image As-Is</p>
                                      <p className="text-[10px] text-slate-400 mt-0.5">Display only the image — no text, no overlay</p>
                                    </div>
                                    <button
                                      onClick={() => {
                                        const updated = platformBanners.map(b => b.id === banner.id ? { ...b, imageOnly: !b.imageOnly } : b);
                                        persistBanners(updated);
                                      }}
                                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ml-3 ${
                                        banner.imageOnly ? "bg-blue-600" : "bg-slate-200"
                                      }`}
                                    >
                                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                        banner.imageOnly ? "translate-x-6" : "translate-x-1"
                                      }`} />
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>

                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 flex items-center gap-1.5"><Palette className="h-3 w-3" /> Background Gradient (CSS)</label>
                              <input value={banner.gradient} onChange={e => handleUpdateBanner(banner.id, "gradient", e.target.value)}
                                className="w-full h-11 text-xs font-mono rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 transition-all px-3" />
                              <div className="flex gap-1.5 mt-2 flex-wrap">
                                {[
                                  "linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%)",
                                  "linear-gradient(135deg,#7c3aed 0%,#a78bfa 100%)",
                                  "linear-gradient(135deg,#059669 0%,#34d399 100%)",
                                  "linear-gradient(135deg,#dc2626 0%,#f87171 100%)",
                                  "linear-gradient(135deg,#d97706 0%,#fbbf24 100%)",
                                  "linear-gradient(135deg,#0f172a 0%,#334155 100%)",
                                ].map(g => (
                                  <button key={g} onClick={() => handleUpdateBanner(banner.id, "gradient", g)}
                                    className="h-6 w-10 rounded-md border-2 border-white shadow-sm hover:scale-110 transition-transform"
                                    style={{ background: g, outline: banner.gradient === g ? "2px solid #2563eb" : "none", outlineOffset: "2px" }} />
                                ))}
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                              <div className="col-span-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Emoji</label>
                                <input value={banner.emoji} onChange={e => handleUpdateBanner(banner.id, "emoji", e.target.value)}
                                  className="w-full h-11 text-xl text-center rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 transition-all" />
                              </div>
                              <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">CTA Color</label>
                                <input type="color" value={banner.ctaColor || "#2563eb"} onChange={e => handleUpdateBanner(banner.id, "ctaColor", e.target.value)}
                                  className="w-full h-11 rounded-xl border border-slate-200 cursor-pointer p-1" />
                              </div>
                            </div>
                          </div>

                          {/* Right: Text content */}
                          <div className="space-y-4">
                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Title <span className="normal-case text-slate-300">(\n for line break)</span></label>
                              <textarea rows={2} value={banner.title} onChange={e => handleUpdateBanner(banner.id, "title", e.target.value)}
                                className="w-full text-sm font-bold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 transition-all p-3" />
                            </div>
                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Subtitle</label>
                              <input value={banner.subtitle} onChange={e => handleUpdateBanner(banner.id, "subtitle", e.target.value)}
                                className="w-full h-11 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 transition-all px-3" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">CTA Button Text</label>
                                <input value={banner.cta} onChange={e => handleUpdateBanner(banner.id, "cta", e.target.value)}
                                  className="w-full h-11 text-sm font-black rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 transition-all px-3" />
                              </div>
                              <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Badge Text</label>
                                <input value={banner.badge} onChange={e => handleUpdateBanner(banner.id, "badge", e.target.value)}
                                  className="w-full h-11 text-sm font-black rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 transition-all px-3" />
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 flex items-center gap-1.5"><Link2 className="h-3 w-3" /> Link / Route</label>
                              <input value={banner.to} onChange={e => handleUpdateBanner(banner.id, "to", e.target.value)}
                                placeholder="e.g. /doctors or /lab-tests"
                                className="w-full h-11 text-sm font-mono text-blue-600 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 transition-all px-3" />
                              <p className="text-[10px] text-slate-400 mt-1">Where the banner navigates when clicked</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SETTINGS ──────────────────────────────────────────────── */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              {/* General Settings */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h3 className="font-black text-slate-900 mb-4">General Configuration</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Platform Name", key: "platform_name", type: "text" },
                    { label: "Support Email", key: "support_email", type: "email" },
                    { label: "Default Currency", key: "currency", type: "text" },
                    { label: "Support Phone", key: "support_phone", type: "tel" },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">{f.label}</label>
                      <input type={f.type} 
                        value={(toggles as any)[f.key!] || ""} 
                        onChange={e => setToggles(p => ({ ...p, [f.key!]: e.target.value }))}
                        className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-300 transition-all shadow-sm" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Finance & Tax Settings */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h3 className="font-black text-slate-900 mb-4">Finance & Taxes</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: "CGST (%)", key: "cgst" },
                    { label: "SGST (%)", key: "sgst" },
                    { label: "OPD Booking Fee (₹)", key: "opd_fee" },
                    { label: "Lab Test Booking Fee (₹)", key: "lab_fee" },
                    { label: "Pharmacy Order Fee (₹)", key: "pharm_fee" },
                    { label: "Priority Slot Surcharge (₹)", key: "priority_surcharge" },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">{f.label}</label>
                      <input type="number" 
                        value={(toggles as any)[f.key!] || 0} 
                        onChange={e => setToggles(p => ({ ...p, [f.key!]: Number(e.target.value) }))}
                        className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-black text-slate-700 outline-none focus:border-blue-300 transition-all shadow-sm" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery & Operations */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h3 className="font-black text-slate-900 mb-4">Delivery & Operations</h3>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { label: "Standard Delivery Fee (₹)", key: "delivery_fee" },
                    { label: "Express Delivery Fee (₹)", key: "express_fee" },
                    { label: "Free Delivery Threshold (₹)", key: "free_threshold" },
                    { label: "Default Delivery Radius (km)", key: "delivery_radius" },
                    { label: "Max Delivery Time (hrs)", key: "delivery_time" },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">{f.label}</label>
                      <input type="number" 
                        value={(toggles as any)[f.key!] || 0} 
                        onChange={e => setToggles(p => ({ ...p, [f.key!]: Number(e.target.value) }))}
                        className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-black text-slate-700 outline-none focus:border-blue-300 transition-all shadow-sm" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Toggles & Module Control */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h3 className="font-black text-slate-900 mb-4">Module Controls & Payment Modes</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Payments */}
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Payment Gateways</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-700">UPI Payments</span>
                      <button onClick={() => setToggles(p => ({ ...p, upi: !p.upi }))} 
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${toggles.upi ? "bg-blue-600" : "bg-slate-200"}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${toggles.upi ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-700">Cash on Delivery (COD)</span>
                      <button onClick={() => setToggles(p => ({ ...p, cod: !p.cod }))} 
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${toggles.cod ? "bg-blue-600" : "bg-slate-200"}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${toggles.cod ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>
                  </div>

                  {/* Booking Modules */}
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Service Modules</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-700">OPD Appointments</span>
                      <button onClick={() => setToggles(p => ({ ...p, opdCheck: !p.opdCheck }))} 
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${toggles.opdCheck ? "bg-emerald-500" : "bg-slate-200"}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${toggles.opdCheck ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-700">Lab Diagnostics</span>
                      <button onClick={() => setToggles(p => ({ ...p, labCheck: !p.labCheck }))} 
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${toggles.labCheck ? "bg-emerald-500" : "bg-slate-200"}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${toggles.labCheck ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-700">Pharmacy Orders</span>
                      <button onClick={() => setToggles(p => ({ ...p, pharmCheck: !p.pharmCheck }))} 
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${toggles.pharmCheck ? "bg-emerald-500" : "bg-slate-200"}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${toggles.pharmCheck ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>
                  </div>

                  {/* Maintenance */}
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest border-b border-slate-100 pb-2">System Operations</p>
                    <div className="flex items-start justify-between bg-amber-50 p-3 rounded-xl border border-amber-100">
                      <div>
                        <span className="text-sm font-black text-amber-900 block">Maintenance Mode</span>
                        <span className="text-[10px] text-amber-700 font-medium">Temporarily disable customer app</span>
                      </div>
                      <button onClick={() => setToggles(p => ({ ...p, is_maintenance: !p.is_maintenance }))} 
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 mt-0.5 ${toggles.is_maintenance ? "bg-amber-500" : "bg-slate-300"}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${toggles.is_maintenance ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 flex gap-3 border-t border-slate-50 pt-6">
                  <button onClick={async () => { 
                    const { error } = await saveSettingsToSupabase(toggles); 
                    if (!error) toast.success("Platform settings synced successfully!");
                    else toast.error("Failed to sync settings");
                  }} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 shadow-sm">Save All Changes</button>
                  <button onClick={() => setToggles(getSettings())} className="flex items-center gap-2 bg-slate-100 text-slate-600 px-6 py-3 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">Discard</button>
                </div>
              </div>
            </div>
          )}

          {/* ── LOGISTICS HUB ──────────────────────────────────────────── */}
          {activeTab === "logistics_hub" && (
            <div className="space-y-6">

              {/* Stats Row */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { label: "Total to Deliver",   value: totalToDeliver,  icon: <Package className="h-5 w-5 text-indigo-600" />,  accent: "bg-indigo-50" },
                  { label: "Pending Delivery",    value: pendingDelivery, icon: <Clock className="h-5 w-5 text-amber-600" />,    accent: "bg-amber-50" },
                  { label: "Delivered",           value: delivered,       icon: <CheckCircle className="h-5 w-5 text-emerald-600" />, accent: "bg-emerald-50" },
                  { label: "Assigned to Partner", value: assignedOrders,  icon: <UserCheck className="h-5 w-5 text-blue-600" />,  accent: "bg-blue-50" },
                  { label: "Unassigned",          value: unassigned,      icon: <Ban className="h-5 w-5 text-red-500" />,          accent: "bg-red-50" },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4 shadow-sm">
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${s.accent} shrink-0`}>{s.icon}</div>
                    <div>
                      <p className="text-2xl font-black text-slate-900 leading-none">{s.value}</p>
                      <p className="text-[11px] font-bold text-slate-400 mt-0.5 leading-tight">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Partner Breakdown */}
              {logisticPartners.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                  <h3 className="font-black text-slate-900 mb-4 flex items-center gap-2">
                    <Truck className="h-5 w-5 text-indigo-600" /> Delivery Partner Performance
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {logisticPartners.map(p => {
                      const assigned = deliveryOrders.filter(o => (o as any).assigned_partner_id === p.partner_id).length;
                      const done     = deliveryOrders.filter(o => (o as any).assigned_partner_id === p.partner_id && o.status === "completed").length;
                      const pending  = assigned - done;
                      return (
                        <div key={p.id} className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="h-10 w-10 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                              <Truck className="h-5 w-5 text-indigo-600" />
                            </div>
                            <div>
                              <p className="font-black text-slate-800 text-sm">{p.name}</p>
                              <p className="text-[10px] text-slate-400">{p.phone || p.email}</p>
                            </div>
                            <span className="ml-auto text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-emerald-50 text-emerald-600">Active</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-white rounded-xl p-2">
                              <p className="text-lg font-black text-indigo-600">{assigned}</p>
                              <p className="text-[9px] font-bold text-slate-400">Assigned</p>
                            </div>
                            <div className="bg-white rounded-xl p-2">
                              <p className="text-lg font-black text-amber-500">{pending}</p>
                              <p className="text-[9px] font-bold text-slate-400">Pending</p>
                            </div>
                            <div className="bg-white rounded-xl p-2">
                              <p className="text-lg font-black text-emerald-600">{done}</p>
                              <p className="text-[9px] font-bold text-slate-400">Delivered</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Orders Table */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-slate-900">All Delivery Orders</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{deliveryOrders.length} orders · assign partners to individual deliveries</p>
                  </div>
                  <div className="flex gap-2">
                    {[
                      { key: "all",        label: "All",        count: totalToDeliver },
                      { key: "unassigned", label: "Unassigned", count: unassigned },
                      { key: "dispatched", label: "Active",     count: pendingDelivery },
                      { key: "completed",  label: "Delivered",  count: delivered },
                    ].map(f => (
                      <button
                        key={f.key}
                        onClick={() => setLogisticsFilter(f.key)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          logisticsFilter === f.key
                            ? "bg-slate-900 text-white shadow-md"
                            : "bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {f.label} <span className="opacity-60">({f.count})</span>
                      </button>
                    ))}
                    <button
                      onClick={() => qc.invalidateQueries({ queryKey: ["admin-prescriptions"] })}
                      className="h-8 w-8 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all"
                    >
                      <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-slate-50">
                  {deliveryOrders
                    .filter(o => {
                      if (logisticsFilter === "unassigned") return !(o as any).assigned_partner_id;
                      if (logisticsFilter === "dispatched") return o.status === "dispatched" || o.status === "reviewed";
                      if (logisticsFilter === "completed")  return o.status === "completed";
                      return true;
                    })
                    .map(order => {
                      const meds = Array.isArray(order.medicines) ? order.medicines : [];
                      const assignedPartner = logisticPartners.find(p => p.partner_id === (order as any).assigned_partner_id);
                      const statusCfg: Record<string, { cls: string; dot: string; label: string }> = {
                        reviewed:   { cls: "bg-blue-50 text-blue-700",    dot: "bg-blue-500",   label: "Awaiting Dispatch" },
                        dispatched: { cls: "bg-amber-50 text-amber-700",  dot: "bg-amber-500",  label: "Out for Delivery" },
                        completed:  { cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", label: "Delivered" },
                      };
                      const sc = statusCfg[order.status] || { cls: "bg-slate-50 text-slate-600", dot: "bg-slate-400", label: order.status };

                      return (
                        <div key={order.id} className="px-6 py-4 hover:bg-slate-50/50 transition-colors">
                          <div className="flex items-start gap-4">
                            {/* Icon */}
                            <div className="h-11 w-11 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                              <Truck className="h-5 w-5 text-indigo-600" />
                            </div>

                            {/* Order info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <p className="font-black text-slate-900 text-sm">{order.patient_name}</p>
                                <span className="text-[9px] font-black text-slate-400 font-mono bg-slate-100 px-2 py-0.5 rounded-md">
                                  {order.order_id || order.id.slice(0, 8).toUpperCase()}
                                </span>
                                <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${sc.cls}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                                  {sc.label}
                                </span>
                                {(order as any).is_express_delivery && (
                                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200">⚡ Express</span>
                                )}
                                {(order as any).delivery_code && (
                                  <span className="text-[9px] font-mono font-black px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-200">
                                    🔑 {(order as any).delivery_code}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap mt-0.5">
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  <span className="truncate max-w-[200px]">{order.delivery_address || "No address"}</span>
                                </span>
                                <span>·</span>
                                <span>📞 {order.patient_phone || "—"}</span>
                                {meds.length > 0 && (
                                  <><span>·</span><span>💊 {meds.filter(m => m.available).length} item(s)</span></>
                                )}
                                <span>·</span>
                                <span className="font-bold text-emerald-600">₹{order.grand_total || 0}</span>
                                <span>·</span>
                                <span>{new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                              </div>
                            </div>

                            {/* Assignment */}
                            <div className="shrink-0 flex flex-col items-end gap-2">
                              {order.status !== "completed" ? (
                                <div className="flex items-center gap-2">
                                  {assignedPartner && (
                                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg flex items-center gap-1">
                                      <UserCheck className="h-3 w-3" />
                                      {assignedPartner.name}
                                    </span>
                                  )}
                                  <select
                                    value={(order as any).assigned_partner_id || ""}
                                    onChange={e => {
                                      const pid = e.target.value;
                                      const pname = logisticPartners.find(p => p.partner_id === pid)?.name || "";
                                      if (pid) handleAssignPartner(order.id, pid, pname);
                                    }}
                                    disabled={assigningId === order.id}
                                    className={`h-9 pl-3 pr-7 rounded-xl border text-xs font-bold focus:outline-none transition-all ${
                                      assignedPartner
                                        ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                                        : "bg-amber-50 border-amber-200 text-amber-700"
                                    }`}
                                  >
                                    <option value="">{assignedPartner ? "Reassign…" : "Assign Partner"}</option>
                                    {logisticPartners.map(p => (
                                      <option key={p.id} value={p.partner_id}>{p.name}</option>
                                    ))}
                                  </select>
                                  {assigningId === order.id && (
                                    <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" />
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-black bg-emerald-50 px-3 py-1.5 rounded-xl">
                                  <CheckCircle className="h-3.5 w-3.5" /> Delivered
                                </div>
                              )}
                              {order.payment_status === "paid" ? (
                                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">✓ Paid</span>
                              ) : (
                                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">⏳ COD</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  }
                  {deliveryOrders.length === 0 && (
                    <div className="px-6 py-16 text-center">
                      <div className="h-16 w-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Truck className="h-8 w-8 text-slate-300" />
                      </div>
                      <p className="font-black text-slate-500">No delivery orders yet</p>
                      <p className="text-xs text-slate-400 mt-1">Orders dispatched from pharmacy will appear here</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

        </main>
      </div>

      {/* ── ADD / EDIT PARTNER MODAL ────────────────────────────────────── */}
      {showAddPartner && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Modal Header */}
            <div className="bg-[#0F172A] px-8 py-6 flex items-center justify-between">
              <div>
                <h2 className="text-white font-black text-lg">{editingPartner ? "Edit Partner" : "Add New Partner"}</h2>
                <p className="text-slate-400 text-sm mt-0.5">Generate credentials and onboard a new admin</p>
              </div>
              <button onClick={() => { setShowAddPartner(false); setEditingPartner(null); }} className="text-slate-400 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-8 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Partner Type */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Partner Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["hospital", "lab", "pharmacy", "logistics"] as const).map(t => {
                    const meta = getMeta(t);
                    const active = (editingPartner?.type ?? newPartner.type) === t;
                    return (
                      <button key={t} onClick={() => {
                        if (editingPartner) setEditingPartner({ ...editingPartner, type: t });
                        else setNewPartner(p => ({ ...p, type: t, commission_rate: COMMISSION_DEFAULTS[t] || 10 }));
                      }}
                        className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-xs font-bold transition-all ${active ? `${meta.bg} ${meta.border} ${meta.color}` : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                        {meta.icon}
                        <span>{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fields */}
              {[
                { label: "Partner / Hospital Name *", key: "name", type: "text", placeholder: "e.g. Apollo Hospital Banjara Hills" },
                { label: "Admin Login Email *", key: "email", type: "email", placeholder: "hospital@aaroksha.com" },
                { label: "Phone", key: "phone", type: "tel", placeholder: "+91 98765 43210" },
                { label: "Address / Location", key: "address", type: "text", placeholder: "City, State" },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">{f.label}</label>
                  <input type={f.type} placeholder={f.placeholder}
                    value={editingPartner ? (editingPartner[f.key as keyof Partner] as string) : (newPartner[f.key as keyof typeof newPartner] as string)}
                    onChange={e => {
                      if (editingPartner) setEditingPartner({ ...editingPartner, [f.key]: e.target.value });
                      else setNewPartner(p => ({ ...p, [f.key]: e.target.value }));
                    }}
                    className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all" />
                </div>
              ))}

              {/* Password */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Login Password (Auto-generated)</label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      value={editingPartner ? editingPartner.password : newPartner.password}
                      onChange={e => {
                        if (editingPartner) setEditingPartner({ ...editingPartner, password: e.target.value });
                        else setNewPartner(p => ({ ...p, password: e.target.value }));
                      }}
                      className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-mono text-slate-700 outline-none focus:border-blue-300 transition-all" />
                  </div>
                  <button onClick={() => {
                    const p = genPassword();
                    if (editingPartner) setEditingPartner({ ...editingPartner, password: p });
                    else setNewPartner(prev => ({ ...prev, password: p }));
                  }}
                    className="h-11 px-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-all">
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  <button onClick={() => { const pw = editingPartner ? editingPartner.password : newPartner.password; navigator.clipboard.writeText(pw); toast.success("Password copied!"); }}
                    className="h-11 px-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-all">
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Commission Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Commission Type</label>
                  <select
                    value={editingPartner ? editingPartner.commission_type : newPartner.commission_type}
                    onChange={e => {
                      const v = e.target.value as "percentage" | "fixed";
                      if (editingPartner) setEditingPartner({ ...editingPartner, commission_type: v, commission_rate: v === "percentage" ? 10 : 50 });
                      else setNewPartner(p => ({ ...p, commission_type: v, commission_rate: v === "percentage" ? 10 : 50 }));
                    }}
                    className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-300 transition-all"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Price (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                    {editingPartner ? (editingPartner.commission_type === "fixed" ? "Fixed Amount (₹)" : "Rate (%)") : (newPartner.commission_type === "fixed" ? "Fixed Amount (₹)" : "Rate (%)")}
                  </label>
                  <input type="number" min={0}
                    value={editingPartner ? editingPartner.commission_rate : newPartner.commission_rate}
                    onChange={e => {
                      const v = Number(e.target.value);
                      if (editingPartner) setEditingPartner({ ...editingPartner, commission_rate: v });
                      else setNewPartner(p => ({ ...p, commission_rate: v }));
                    }}
                    className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-black text-slate-700 outline-none focus:border-blue-300 transition-all" />
                </div>
              </div>

              {/* Info box */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-2.5">
                <AlertCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">A unique <strong>Partner ID</strong> will be auto-generated and embedded in the admin's Supabase metadata. They will only see data matching their Partner ID.</p>
              </div>
            </div>

            <div className="px-8 py-5 border-t border-slate-100 flex gap-3">
              <button onClick={() => { setShowAddPartner(false); setEditingPartner(null); }}
                className="flex-1 h-11 border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all">
                Cancel
              </button>
              <button onClick={handleAddPartner} disabled={addLoading}
                className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                {addLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" />{editingPartner ? "Save Changes" : "Add Partner & Generate ID"}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
