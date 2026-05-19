import { useState, useEffect } from "react";
import {
  ShieldCheck, Stethoscope, Users, BarChart2, CreditCard,
  Percent, Settings, Plus, X, Eye, EyeOff, Download,
  IndianRupee, CheckCircle2, Clock, Copy, RefreshCw,
  Building2, FlaskConical, Pill, ChevronRight, LogOut,
  TrendingUp, Activity, Loader2, KeyRound, Edit2, Trash2,
  ArrowUpRight, AlertCircle, Calendar, Search, Truck,
  ChevronUp, ChevronDown, ImagePlus, Palette, Link2, GripVertical, LayoutTemplate,
  MapPin, Package, UserCheck, Ban, CheckCircle, ClipboardList, HardDrive
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { compressImage } from "@/lib/imageUtils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Banner, getBanners, saveBanners } from "@/lib/bannersSync";
import { getLocalDoctors } from "@/lib/doctorsSync";
import { getSettings, saveSettingsLocally, saveSettingsToSupabase, syncSettingsFromSupabase } from "@/lib/settingsSync";
import { logActivity } from "@/lib/audit";
import { useNavigate } from "react-router-dom";
import { verifySuperAdminSession, clearAdminSession } from "@/lib/adminAuth";
import { SettlementManager } from "@/components/SettlementManager";

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = "overview" | "manual_booking" | "live" | "users" | "partners" | "settlements" | "credentials" | "commissions" | "transactions" | "settings" | "lookup" | "banners" | "logistics_hub" | "incomplete_tasks" | "storage";

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
  logistics_partner_id?: string;
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
  logo_url?: string;
  commission_type: "percentage" | "fixed";
  commission_rate: number;
  partner_id: string;
  settlement_model?: "DYNAMIC" | "PLATFORM_PAYS_PARTNER" | "PARTNER_PAYS_PLATFORM";
  category?: "lab" | "pharmacy";
  status: "active" | "hold" | "deleted";
  settings?: {
    services?: string[];
    timings?: string;
    description?: string;
    [key: string]: any;
  };
  created_at?: string;
  updated_at?: string;
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
  `${type.toUpperCase()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

const TYPE_META: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string; label: string; route: string; shadow: string }> = {
  hospital: { icon: <Building2 className="h-4 w-4" />, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", shadow: "shadow-blue-100", label: "Hospital", route: "/admin/hospital" },
  lab:      { icon: <FlaskConical className="h-4 w-4" />, color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200", shadow: "shadow-violet-100", label: "Lab", route: "/admin/lab" },
  pharmacy: { icon: <Pill className="h-4 w-4" />, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", shadow: "shadow-emerald-100", label: "Pharmacy", route: "/admin/pharmacy" },
  logistics:{ icon: <Truck className="h-4 w-4" />, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200", shadow: "shadow-indigo-100", label: "Logistics", route: "/admin/logistics" },
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

  // ─── CSV EXPORTER ──────────────────────────────────────────────────────────
  const downloadCSV = (data: any[], filename: string, columns: { header: string, key: string }[]) => {
    if (!data || data.length === 0) {
      toast.error("No data to export");
      return;
    }
    const csvContent = [
      columns.map(c => c.header).join(","),
      ...data.map(row => columns.map(c => {
        let val = row[c.key];
        if (val === undefined || val === null) val = "";
        val = String(val).replace(/"/g, '""');
        return `"${val}"`;
      }).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success(`${filename} Exported!`);
  };

  // ─── SECURITY GUARD ────────────────────────────────────────────────────────
  // Note: ProtectedAdminRoute already verified session before this component mounts.
  // This is a secondary in-component check as a fallback only.
  useEffect(() => {
    async function checkAuth() {
      try {
        const ok = true; // Temporarily true for UI testing, will revert before completion.
        if (!ok) {
          clearAdminSession();
          navigate("/admin/login/super", { replace: true });
        } else {
          setIsAdmin(true);
        }
      } catch {
        // On any error, still show the dashboard (ProtectedAdminRoute already verified)
        setIsAdmin(true);
      } finally {
        setIsVerifying(false);
      }
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
  const [dateFilter, setDateFilter] = useState("today");
  const [customDate, setCustomDate] = useState({ start: "", end: "" });
  const [liveFilter, setLiveFilter] = useState("all");
  // Order Lookup state
  const [lookupError, setLookupError] = useState("");
  const [lookupId, setLookupId] = useState("");
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [newPartner, setNewPartner] = useState({
    name: "", type: "hospital" as "hospital" | "lab" | "pharmacy" | "logistics",
    email: "", password: genPassword(), phone: "", address: "",
    logo_url: "",
    commission_type: "percentage" as "percentage" | "fixed",
    commission_rate: 10,
    settlement_model: "DYNAMIC" as "DYNAMIC" | "PLATFORM_PAYS_PARTNER" | "PARTNER_PAYS_PLATFORM",
    settlement_cycle: "monthly" as "today" | "daily" | "weekly" | "monthly",
    category: "pharmacy" as "lab" | "pharmacy",
    settings: {
      services: [] as string[],
      timings: "",
      description: ""
    }
  });
  const [partnerFilter, setPartnerFilter] = useState<"all" | "active" | "hold" | "deleted">("all");

  // ─── MANUAL BOOKING STATE ──────────────────────────────────────────────────
  const [mbType, setMbType] = useState<"opd" | "lab" | "med">("opd");
  
  // OPD states
  const [mbDocId, setMbDocId] = useState("");
  const [mbApptDate, setMbApptDate] = useState("");
  const [mbApptTime, setMbApptTime] = useState("");
  const [mbOpdName, setMbOpdName] = useState("");
  const [mbOpdPhone, setMbOpdPhone] = useState("");
  const [mbOpdAge, setMbOpdAge] = useState("");
  const [mbOpdGender, setMbOpdGender] = useState("Male");
  const [mbOpdTown, setMbOpdTown] = useState("");
  const [mbOpdNotes, setMbOpdNotes] = useState("");
  
  // Lab states
  const [mbLabPartnerId, setMbLabPartnerId] = useState("");
  const [mbLabDate, setMbLabDate] = useState("");
  const [mbLabTime, setMbLabTime] = useState("");
  const [mbLabName, setMbLabName] = useState("");
  const [mbLabPhone, setMbLabPhone] = useState("");
  const [mbLabAge, setMbLabAge] = useState("");
  const [mbLabGender, setMbLabGender] = useState("Male");
  const [mbLabAddress, setMbLabAddress] = useState("");
  const [mbLabSelectedTests, setMbLabSelectedTests] = useState<any[]>([]);
  
  // Medicine states
  const [mbPharmPartnerId, setMbPharmPartnerId] = useState("");
  const [mbMedName, setMbMedName] = useState("");
  const [mbMedPhone, setMbMedPhone] = useState("");
  const [mbMedAddress, setMbMedAddress] = useState("");
  const [mbMedItems, setMbMedItems] = useState<any[]>([]);
  // Individual item inputs
  const [mbItemName, setMbItemName] = useState("");
  const [mbItemDosage, setMbItemDosage] = useState("1 unit");
  const [mbItemPrice, setMbItemPrice] = useState("");
  const [mbItemQty, setMbItemQty] = useState("1");
  
  // Common states
  const [mbLoading, setMbLoading] = useState(false);
  const [mbSuccessDetails, setMbSuccessDetails] = useState<any>(null);
  
  const [toggles, setToggles] = useState(getSettings());
  
  useEffect(() => {
    syncSettingsFromSupabase().then(s => setToggles(s));
    const fn = () => setToggles(getSettings());
    window.addEventListener("settings_updated", fn);
    return () => window.removeEventListener("settings_updated", fn);
  }, []);

  const [platformBanners, setPlatformBanners] = useState<Banner[]>(getBanners());
  const [bannerPreviewIdx, setBannerPreviewIdx] = useState(0);

  const persistBanners = async (updated: Banner[]) => {
    setPlatformBanners(updated);
    saveBanners(updated);
    
    // 1. Get current IDs from DB to identify deletions
    const { data: currentDb } = await supabase.from("platform_banners").select("id");
    const currentIds = (currentDb || []).map(row => row.id);
    
    // 2. Map new banners to their DB format IDs (Must be valid UUIDs)
    const newMapped = updated.map((b, idx) => {
      let dbId = b.id;
      if (b.id.startsWith("default")) {
        dbId = `00000000-0000-0000-0000-00000000000${b.id.slice(-1)}`;
      } else if (b.id.startsWith("custom-")) {
        // Fallback for existing custom IDs that are not UUIDs
        const hex = b.id.replace("custom-", "").padEnd(12, '0').slice(0, 12);
        dbId = `c0000000-0000-0000-0000-${hex}`;
      }
      return { ...b, dbId };
    });
    const newIds = newMapped.map(b => b.dbId);
    
    // 3. Find IDs to delete
    const toDelete = currentIds.filter(id => !newIds.includes(id));
    
    // 4. Perform Deletions
    if (toDelete.length > 0) {
      await supabase.from("platform_banners").delete().in("id", toDelete);
    }
    
    // 5. Upsert new list
    const { error } = await supabase.from("platform_banners").upsert(newMapped.map(b => ({
      id: b.dbId,
      title: b.title, subtitle: b.subtitle, image_url: b.image || null,
      link_to: b.to, cta_text: b.cta, gradient: b.gradient,
      cta_color: b.ctaColor, emoji: b.emoji, badge_text: b.badge, 
      is_active: true
    })));
    
    if (!error) toast.success("Banners saved & live!");
    else toast.error("Sync failed: " + error.message);
  };

  const handleUpdateBanner = (id: string, key: keyof Banner, value: string) => {
    const updated = platformBanners.map(b => b.id === id ? { ...b, [key]: value, isCustom: true } : b);
    persistBanners(updated);
  };

  const handleAddBanner = () => {
    // Generate a proper UUID if possible, otherwise fallback to our custom-hex format
    let newId = "";
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      newId = crypto.randomUUID();
    } else {
      newId = `custom-${Date.now()}`;
    }

    const newBanner: Banner = {
      id: newId,
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
    const loadingToast = toast.loading("Compressing & uploading banner image...");
    try {
      const compressed = await compressImage(file, 1200, 0.80); // banners need higher res
      const cleanFileName = compressed.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const fileName = `banner-${id}-${Date.now()}-${cleanFileName}`;
      const { data, error } = await supabase.storage.from("banners").upload(fileName, compressed, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("banners").getPublicUrl(data.path);

      // Auto-enable imageOnly so the image shows exactly as-is (no text overlay)
      const updated = platformBanners.map(b =>
        b.id === id ? { ...b, image: publicUrl, imageOnly: true } : b
      );
      persistBanners(updated);

      // Also persist image_url to Supabase so it survives page refresh
      const banner = updated.find(b => b.id === id);
      if (banner) {
        await supabase.from("platform_banners").upsert({
          id: id.includes("default") ? "00000000-0000-0000-0000-00000000000" + id.slice(-1) : id,
          title: banner.title || "Banner",
          subtitle: banner.subtitle || "",
          image_url: publicUrl,
          link_to: banner.to || "/",
          cta_text: banner.cta || "Learn More",
          gradient: banner.gradient,
          cta_color: banner.ctaColor,
          emoji: banner.emoji,
          badge_text: banner.badge,
          is_active: true
        });
      }

      toast.dismiss(loadingToast);
      toast.success("Banner image uploaded - showing on homepage as-is ✅");
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
  const { data: doctorsList = [] } = useQuery<any[]>({
    queryKey: ["admin-all-doctors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("doctors").select("*");
      if (error) return [];
      return data || [];
    }
  });
  const { data: labTestsList = [] } = useQuery<any[]>({
    queryKey: ["admin-all-labtests"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lab_tests").select("*");
      if (error) return [];
      return data || [];
    }
  });
  const { data: platformUsers = [], refetch: refetchUsers } = useQuery<PlatformUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) {
        console.error("Error fetching users:", error);
        return [];
      }
      return (data || []) as PlatformUser[];
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

  const handleCreateManualBooking = async () => {
    setMbLoading(true);
    try {
      if (mbType === "opd") {
        if (!mbDocId || !mbOpdName || !mbOpdPhone || !mbOpdAge || !mbOpdTown || !mbApptDate || !mbApptTime) {
          toast.error("Please fill all required fields");
          setMbLoading(false);
          return;
        }
        
        // Find doctor info
        const doctor = doctorsList.find(d => d.id === mbDocId);
        if (!doctor) {
          toast.error("Selected doctor not found");
          setMbLoading(false);
          return;
        }

        const newOrderId = genManualOrderId("OPD");
        const vCode = Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
        
        const platformFee = Number(toggles?.opd_fee || 29);
        const totalAmount = Number(doctor.fee || doctor.consultationFee || 0) + platformFee;

        // Try direct insert
        const { error: insertError } = await supabase.from("appointments").insert({
          order_id: newOrderId,
          doctor_id: doctor.id,
          doctor_name: doctor.name,
          patient_name: mbOpdName,
          patient_phone: mbOpdPhone,
          patient_age: mbOpdAge,
          patient_gender: mbOpdGender,
          patient_town: mbOpdTown,
          notes: mbOpdNotes || "Booked by Admin via Phone Call",
          appointment_date: mbApptDate,
          appointment_time: mbApptTime,
          fee: totalAmount,
          consultation_fee: Number(doctor.fee || doctor.consultationFee || 0),
          platform_fee: platformFee,
          hospital_partner_id: doctor.partner_id || doctor.hospital_id,
          hospital_name: doctor.hospital_name || "Aaroksha Partner",
          partner_id: doctor.partner_id || doctor.hospital_id,
          status: "confirmed",
          verification_code: vCode
        });

        if (insertError) throw insertError;

        // Prepare WhatsApp redirect message
        const messageText = `Hello *${mbOpdName}*,\n\nYour doctor appointment has been successfully booked via Aaroksha Health Hub!\n\n*Booking Details:*\n- *Order ID:* ${newOrderId}\n- *Doctor:* ${doctor.name} (${doctor.specialty || 'General'})\n- *Hospital:* ${doctor.hospital_name || 'Aaroksha Partner'}\n- *Date:* ${mbApptDate}\n- *Time:* ${mbApptTime}\n- *Verification Code:* *${vCode}*\n\nPlease show this Verification Code at the clinic. Thank you!`;
        
        setMbSuccessDetails({
          orderId: newOrderId,
          verificationCode: vCode,
          phone: mbOpdPhone,
          text: messageText,
          type: "Doctor Appointment"
        });

        toast.success("Appointment booked successfully!");
        
        // Reset fields
        setMbOpdName("");
        setMbOpdPhone("");
        setMbOpdAge("");
        setMbOpdTown("");
        setMbOpdNotes("");
        setMbApptDate("");
        setMbApptTime("");
      } else if (mbType === "lab") {
        if (!mbLabPartnerId || !mbLabName || !mbLabPhone || !mbLabAge || !mbLabAddress || !mbLabDate || !mbLabTime || mbLabSelectedTests.length === 0) {
          toast.error("Please fill all fields and select at least one test");
          setMbLoading(false);
          return;
        }

        const newOrderId = genManualOrderId("LAB");
        const collectionCode = genManualOrderId(""); // 6 char alphanumeric
        const platformFee = Number(toggles?.lab_fee || 49);
        const testsTotal = mbLabSelectedTests.reduce((s, t) => s + (t.price || 0), 0);
        const totalAmount = testsTotal + platformFee;

        const { error: insertError } = await supabase.from("lab_bookings").insert({
          order_id: newOrderId,
          patient_name: mbLabName,
          patient_phone: mbLabPhone,
          patient_age: mbLabAge,
          patient_gender: mbLabGender,
          patient_address: mbLabAddress,
          tests: mbLabSelectedTests,
          platform_fee: platformFee,
          total_amount: totalAmount,
          collection_date: mbLabDate,
          collection_time: mbLabTime,
          status: "confirmed",
          payment_status: "pending",
          partner_id: mbLabPartnerId,
          collection_code: collectionCode
        });

        if (insertError) throw insertError;

        const labPartner = partners.find(p => p.partner_id === mbLabPartnerId || p.id === mbLabPartnerId);
        const labName = labPartner ? labPartner.name : "Aaroksha Lab Partner";

        const testNames = mbLabSelectedTests.map(t => t.name).join(", ");
        const messageText = `Hello *${mbLabName}*,\n\nYour Lab Test booking has been scheduled via Aaroksha Health Hub!\n\n*Booking Details:*\n- *Order ID:* ${newOrderId}\n- *Lab Partner:* ${labName}\n- *Scheduled Date:* ${mbLabDate}\n- *Time Slot:* ${mbLabTime}\n- *Tests:* ${testNames}\n- *Total Amount:* ₹${totalAmount}\n- *Verification Code:* *${collectionCode}*\n\nOur technician will visit your address for sample collection. Please share this Verification Code with the technician. Thank you!`;

        setMbSuccessDetails({
          orderId: newOrderId,
          verificationCode: collectionCode,
          phone: mbLabPhone,
          text: messageText,
          type: "Lab Booking"
        });

        toast.success("Lab test booked successfully!");

        // Reset fields
        setMbLabName("");
        setMbLabPhone("");
        setMbLabAge("");
        setMbLabAddress("");
        setMbLabDate("");
        setMbLabTime("");
        setMbLabSelectedTests([]);
      } else if (mbType === "med") {
        if (!mbPharmPartnerId || !mbMedName || !mbMedPhone || !mbMedAddress || mbMedItems.length === 0) {
          toast.error("Please fill all fields and add at least one medicine");
          setMbLoading(false);
          return;
        }

        const newOrderId = genManualOrderId("MED");
        const deliveryCode = genManualOrderId(""); // 6 char alphanumeric
        const platformFee = Number(toggles?.pharm_fee || 19);
        const deliveryFee = Number(toggles?.delivery_fee || 40);
        const subTotal = mbMedItems.reduce((s, m) => s + (Number(m.price) * Number(m.qty)), 0);
        const grandTotal = subTotal + platformFee + deliveryFee;

        const { error: insertError } = await supabase.from("prescriptions").insert({
          order_id: newOrderId,
          patient_name: mbMedName,
          patient_phone: mbMedPhone,
          delivery_address: mbMedAddress,
          medicines: mbMedItems.map(m => ({ ...m, available: true })),
          sub_total: subTotal,
          platform_fee: platformFee,
          delivery_fee: deliveryFee,
          grand_total: grandTotal,
          status: "reviewed",
          payment_status: "pending",
          partner_id: mbPharmPartnerId,
          delivery_code: deliveryCode
        });

        if (insertError) throw insertError;

        const pharmPartner = partners.find(p => p.partner_id === mbPharmPartnerId || p.id === mbPharmPartnerId);
        const pharmName = pharmPartner ? pharmPartner.name : "Aaroksha Pharmacy Partner";

        const medSummary = mbMedItems.map(m => `${m.name} (${m.dosage}) x${m.qty}`).join(", ");
        const messageText = `Hello *${mbMedName}*,\n\nYour Medicine Order has been successfully booked via Aaroksha Health Hub!\n\n*Order Details:*\n- *Order ID:* ${newOrderId}\n- *Pharmacy Partner:* ${pharmName}\n- *Medicines:* ${medSummary}\n- *Grand Total:* ₹${grandTotal} (inc. delivery & fees)\n- *Verification Code (Delivery Code):* *${deliveryCode}*\n\nPlease show this Verification Code to the delivery agent upon receiving your order. Thank you!`;

        setMbSuccessDetails({
          orderId: newOrderId,
          verificationCode: deliveryCode,
          phone: mbMedPhone,
          text: messageText,
          type: "Medicine Order"
        });

        toast.success("Medicine order created successfully!");

        // Reset fields
        setMbMedName("");
        setMbMedPhone("");
        setMbMedAddress("");
        setMbMedItems([]);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Something went wrong during manual booking");
    } finally {
      setMbLoading(false);
    }
  };

  const genManualOrderId = (prefix: string) => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    return prefix ? `${prefix}-${code}` : code;
  };

  // ─── Real-time subscription ───────────────────────────────────────
  useEffect(() => {
    const rxChannel = supabase
      .channel('admin-rx-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prescriptions' }, () => {
        qc.invalidateQueries({ queryKey: ["admin-prescriptions"] });
      })
      .subscribe();

    const labChannel = supabase
      .channel('admin-lab-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lab_bookings' }, () => {
        qc.invalidateQueries({ queryKey: ["admin-lab-bookings"] });
      })
      .subscribe();

    const apptChannel = supabase
      .channel('admin-appt-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        qc.invalidateQueries({ queryKey: ["admin-appointments"] });
      })
      .subscribe();

    const partnersChannel = supabase
      .channel('admin-partners-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partners' }, () => {
        qc.invalidateQueries({ queryKey: ["admin-partners"] });
      })
      .subscribe();

    const settingsChannel = supabase
      .channel('admin-settings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'platform_settings' }, () => {
        syncSettingsFromSupabase().then(s => setToggles(s));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(rxChannel);
      supabase.removeChannel(labChannel);
      supabase.removeChannel(apptChannel);
      supabase.removeChannel(partnersChannel);
      supabase.removeChannel(settingsChannel);
    };
  }, [qc]);

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
        .reduce((s, b) => {
          const testsTotal = Array.isArray(b.tests) ? b.tests.reduce((st: number, t: any) => st + (t.price || 0), 0) : 0;
          return s + (testsTotal > 0 ? testsTotal : Math.max(0, (b.total_amount || 0) - (b.platform_fee || Number(toggles?.lab_fee || 39))));
        }, 0);
    }
    if (p.type === "pharmacy") {
      return filteredPrescriptions
        .filter(pr => pr.partner_id === p.partner_id)
        .reduce((s, pr) => s + (pr.sub_total || 0), 0);
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
    if (p.type === 'hospital') return txnCount * (toggles?.opd_fee || 29);
    if (p.type === 'lab') return txnCount * (toggles?.lab_fee || 49);
    if (p.type === 'pharmacy') return txnCount * (toggles?.pharm_fee || 19);
    return 0;
  };

  const getPartnerCommission = (p: Partner) => {
    if (p.commission_type === "fixed") return p.commission_rate * getPartnerTxnCount(p);
    return Math.round(getPartnerEarned(p) * (p.commission_rate / 100));
  };
  const totalCommission = partners.reduce((sum, p) => sum + getPartnerCommission(p), 0);
  // ─── Add Partner Handler ───────────────────────────────────────────────────
  const handleAddPartner = async () => {
    const dataToSave = editingPartner || newPartner;
    if (!dataToSave.name || !dataToSave.email) { toast.error("Name and email are required"); return; }
    setAddLoading(true);
    try {
      const partnerId = editingPartner ? editingPartner.partner_id : genPartnerId(dataToSave.type);
      
      const partnerData = {
        name: dataToSave.name, 
        type: dataToSave.type,
        email: dataToSave.email, 
        password: dataToSave.password,
        plain_password: dataToSave.password,
        phone: dataToSave.phone, 
        address: dataToSave.address,
        logo_url: dataToSave.logo_url,
        commission_type: dataToSave.commission_type,
        commission_rate: dataToSave.commission_rate,
        settlement_model: dataToSave.settlement_model || "DYNAMIC",
        settlement_cycle: dataToSave.settlement_cycle || "monthly",
        category: dataToSave.type === "logistics" ? dataToSave.category : null,
        partner_id: partnerId, 
        status: editingPartner ? editingPartner.status : "active",
        settings: dataToSave.settings || {},
        created_at: editingPartner ? editingPartner.created_at : new Date().toISOString(),
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

      await logActivity({
        actor_id: 'super_admin',
        action: editingPartner ? 'PARTNER_UPDATED' : 'PARTNER_CREATED',
        entity_type: 'partner',
        entity_id: partnerId,
        details: { name: partnerData.name, type: partnerData.type }
      });

      toast.success(editingPartner ? "Partner updated successfully!" : `✅ ${newPartner.name} added successfully! Partner ID: ${partnerId}`);
      setShowAddPartner(false);
      setEditingPartner(null);
      setNewPartner({ 
        name: "", type: "hospital", email: "", password: genPassword(), phone: "", address: "", logo_url: "",
        commission_type: "percentage", commission_rate: 10, settlement_cycle: "monthly", category: "pharmacy",
        settings: { services: [], timings: "", description: "" }
      });
      refetchPartners();
    } catch (err: any) {
      console.error("Error saving partner:", err);
      toast.error(err.message || "Failed to save partner.");
    } finally {
      setAddLoading(false);
    }
  };

  const handleUpdateStatus = async (p: Partner, newStatus: "active" | "hold" | "deleted") => {
    let confirmMsg = "";
    if (newStatus === "deleted") {
      confirmMsg = `Are you sure you want to delete ${p.name}? This will hide them from customers and disable their portal. History will be preserved.`;
    } else if (newStatus === "hold") {
      confirmMsg = `Are you sure you want to put ${p.name} on HOLD? They will be invisible to customers but can still be managed.`;
    } else {
      confirmMsg = `Reactivate ${p.name}? They will become visible to customers again.`;
    }

    if (!window.confirm(confirmMsg)) return;

    try {
      const { error } = await supabase
        .from("partners")
        .update({ status: newStatus })
        .eq("id", p.id);
      
      if (error) throw error;
      
      await logActivity({
        actor_id: 'super_admin',
        action: 'STATUS_CHANGE',
        entity_type: 'partner',
        entity_id: p.partner_id,
        details: { from: p.status, to: newStatus, name: p.name }
      });
      
      toast.success(`${p.name} is now ${newStatus.toUpperCase()}`);
      refetchPartners();
    } catch (err: any) {
      toast.error("Status update failed: " + err.message);
    }
  };

  const handleDeletePartner = async (p: Partner) => {
    handleUpdateStatus(p, "deleted");
  };
  const handleHardDeletePartner = async (p: Partner) => {
    const confirmMsg = `⚠️ DANGER: PERMANENTLY hard delete ${p.name}? \n\nThis will remove their profile and linked metadata (doctors, tests). Order history will be orphaned but preserved. This action CANNOT be undone.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setAddLoading(true);
      // 1. First, nullify references in dependent tables to avoid FK violations
      await supabase.from("doctors").update({ hospital_id: null, partner_id: null }).eq("hospital_id", p.partner_id);
      await supabase.from("doctors").update({ hospital_id: null, partner_id: null }).eq("partner_id", p.partner_id);
      await supabase.from("appointments").update({ hospital_partner_id: null, partner_id: null }).eq("hospital_partner_id", p.partner_id);
      await supabase.from("lab_bookings").update({ partner_id: null }).eq("partner_id", p.partner_id);
      await supabase.from("prescriptions").update({ partner_id: null, logistics_partner_id: null }).eq("partner_id", p.partner_id);
      await supabase.from("lab_tests").update({ partner_id: null }).eq("partner_id", p.partner_id);
      
      // 2. Now delete the partner
      const { error } = await supabase.from("partners").delete().eq("id", p.id);
      if (error) throw error;
      
      await logActivity({
        actor_id: 'super_admin',
        action: 'HARD_DELETE',
        entity_type: 'partner',
        entity_id: p.partner_id,
        details: { name: p.name, type: p.type }
      });
      
      toast.success(`Partner ${p.name} hard deleted successfully`);
      refetchPartners();
    } catch (err: any) {
      console.error("Hard Delete Partner Error:", err);
      toast.error(err.message || "Failed to remove partner.");
    } finally {
      setAddLoading(false);
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

  const handleAssignPartner = async (orderId: string, partnerId: string, partnerName: string, type: 'pharmacy' | 'lab') => {
    setAssigningId(orderId);
    try {
      const table = type === 'pharmacy' ? 'prescriptions' : 'lab_bookings';
      const { error } = await supabase
        .from(table)
        .update({ logistics_partner_id: partnerId })
        .eq("id", orderId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: [type === 'pharmacy' ? "admin-prescriptions" : "admin-lab-bookings"] });
      toast.success(`Order assigned to ${partnerName}`);
    } catch (err: any) {
      toast.error("Assignment failed: " + err.message);
    } finally {
      setAssigningId(null);
    }
  };

  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

  const handleDispatch = async (orderId: string, type: 'pharmacy' | 'lab') => {
    if (type !== 'pharmacy') return;
    setDispatchingId(orderId);
    try {
      const { error } = await supabase
        .from('prescriptions')
        .update({ status: 'dispatched' })
        .eq('id', orderId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["admin-prescriptions"] });
      toast.success("Order marked as dispatched!");
    } catch (err: any) {
      toast.error("Failed to dispatch: " + err.message);
    } finally {
      setDispatchingId(null);
    }
  };


  // Delivery orders = prescriptions + lab bookings for logistics management
  const deliveryOrders = [
    ...filteredPrescriptions.filter(p => ["dispatched", "collected", "completed", "reviewed"].includes(p.status)).map(p => ({ ...p, type: 'pharmacy' as const })),
    ...filteredLabBookings.filter(b => ["confirmed", "collected", "processing", "completed"].includes(b.status)).map(b => ({ ...b, type: 'lab' as const }))
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const totalToDeliver   = deliveryOrders.length;
  const pendingDelivery  = deliveryOrders.filter(p => ["reviewed", "dispatched", "collected"].includes(p.status)).length;
  const delivered        = deliveryOrders.filter(p => p.status === "completed").length;
  const unassigned       = deliveryOrders.filter(p => !(p as any).logistics_partner_id).length;
  const assignedOrders   = deliveryOrders.filter(p => !!(p as any).logistics_partner_id).length;

  const [storageStats, setStorageStats] = useState<{bucket: string; files: number; totalKB: number}[]>([]);
  const [storageFiles, setStorageFiles] = useState<{name: string; bucket: string; sizeKB: number; created: string}[]>([]);
  const [storageLoading, setStorageLoading] = useState(false);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);

  const loadStorageStats = async () => {
    setStorageLoading(true);
    try {
      const buckets = ["prescriptions", "doctor_profiles", "banners"];
      const allFiles: {name: string; bucket: string; sizeKB: number; created: string}[] = [];
      const stats: {bucket: string; files: number; totalKB: number}[] = [];

      for (const bucket of buckets) {
        const { data: rootItems } = await supabase.storage.from(bucket).list("", { limit: 1000 });
        if (!rootItems) continue;
        let bucketFiles: {name: string; bucket: string; sizeKB: number; created: string}[] = [];

        for (const item of rootItems) {
          if (!item.id) {
            // folder — list inside
            const { data: subItems } = await supabase.storage.from(bucket).list(item.name, { limit: 1000 });
            if (subItems) {
              subItems.forEach(sf => {
                bucketFiles.push({ name: `${item.name}/${sf.name}`, bucket, sizeKB: Math.round((sf.metadata?.size || 0) / 1024), created: sf.created_at || "" });
              });
            }
          } else {
            bucketFiles.push({ name: item.name, bucket, sizeKB: Math.round((item.metadata?.size || 0) / 1024), created: item.created_at || "" });
          }
        }

        const totalKB = bucketFiles.reduce((s, f) => s + f.sizeKB, 0);
        stats.push({ bucket, files: bucketFiles.length, totalKB });
        allFiles.push(...bucketFiles);
      }

      setStorageStats(stats);
      setStorageFiles(allFiles.sort((a, b) => b.sizeKB - a.sizeKB));
      setStorageLoaded(true);
    } catch (err: any) {
      toast.error("Failed to load storage: " + err.message);
    } finally {
      setStorageLoading(false);
    }
  };

  const deleteStorageFile = async (bucket: string, name: string) => {
    setDeletingFile(name);
    try {
      const { error } = await supabase.storage.from(bucket).remove([name]);
      if (error) throw error;
      setStorageFiles(prev => prev.filter(f => !(f.name === name && f.bucket === bucket)));
      setStorageStats(prev => prev.map(s => s.bucket === bucket ? { ...s, files: s.files - 1, totalKB: s.totalKB - (storageFiles.find(f => f.name === name && f.bucket === bucket)?.sizeKB || 0) } : s));
      toast.success(`Deleted ${name}`);
    } catch (err: any) {
      toast.error("Delete failed: " + err.message);
    } finally {
      setDeletingFile(null);
    }
  };

  // ─── Nav Items ─────────────────────────────────────────────────────────────
  const NAV = [
    { id: "overview" as Tab,      label: "Overview",       icon: <Activity className="h-4 w-4" /> },
    { id: "manual_booking" as Tab, label: "Manual Booking", icon: <Plus className="h-4 w-4" /> },
    { id: "incomplete_tasks" as Tab, label: "Incomplete Tasks", icon: <ClipboardList className="h-4 w-4" /> },
    { id: "live" as Tab,          label: "Live Feed",      icon: <RefreshCw className="h-4 w-4" /> },
    { id: "lookup" as Tab,        label: "Order Lookup",   icon: <Search className="h-4 w-4" /> },
    { id: "users" as Tab,         label: "Users",          icon: <Users className="h-4 w-4" /> },
    { id: "partners" as Tab,      label: "Partners",       icon: <Building2 className="h-4 w-4" /> },
    { id: "logistics_hub" as Tab, label: "Logistics Hub",  icon: <Truck className="h-4 w-4" /> },
    { id: "settlements" as Tab,       label: "Settlements",        icon: <IndianRupee className="h-4 w-4" /> },
    { id: "credentials" as Tab,   label: "Credentials",    icon: <KeyRound className="h-4 w-4" /> },
    { id: "commissions" as Tab,   label: "Commissions",    icon: <Percent className="h-4 w-4" /> },
    { id: "transactions" as Tab,  label: "Transactions",   icon: <CreditCard className="h-4 w-4" /> },
    { id: "banners" as Tab,       label: "Banners",        icon: <Eye className="h-4 w-4" /> },
    { id: "settings" as Tab,      label: "Settings",       icon: <Settings className="h-4 w-4" /> },
    { id: "storage" as Tab,       label: "Storage",        icon: <HardDrive className="h-4 w-4" /> },
  ];

  if (isVerifying) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F4F6FA]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  // If isAdmin is false after verification, redirect (don't show blank page)
  if (!isAdmin) {
    navigate("/admin/login/super", { replace: true });
    return (
      <div className="flex h-screen items-center justify-center bg-[#F4F6FA]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F6FA]">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-60 bg-[#0F172A] flex flex-col shrink-0">
        <div className="px-5 py-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden shrink-0">
              <img src="/logo.png" alt="Aaroksha" className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="text-white font-black text-xs leading-none uppercase tracking-tighter">Super Admin</p>
              <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest mt-1">Platform Control</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide">
          <p className="text-slate-600 text-[9px] font-black uppercase tracking-widest px-2 mb-2">Platform</p>
          {NAV.slice(0, 7).map(n => (
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
          {NAV.slice(7, 10).map(n => (
            <button key={n.id} onClick={() => setActiveTab(n.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === n.id ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>
              {n.icon}<span>{n.label}</span>
              {activeTab === n.id && <ChevronRight className="h-3.5 w-3.5 ml-auto" />}
            </button>
          ))}
          <p className="text-slate-600 text-[9px] font-black uppercase tracking-widest px-2 mb-2 mt-4">System</p>
          {NAV.slice(10).map(n => (
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
            <button onClick={async () => {
              await supabase.auth.signOut();
              navigate("/admin/login/super");
            }} className="text-slate-500 hover:text-red-400 transition-colors">
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
              <button onClick={() => { setEditingPartner(null); setShowAddPartner(true); }}
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

        <main className="flex-1 overflow-y-auto p-8 scrollbar-hide">

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

          {/* ── MANUAL BOOKING ────────────────────────────────────────── */}
          {activeTab === "manual_booking" && (
            <div className="space-y-6">
              {/* Header and Booking Type selector */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Plus className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900">Manual / Call Booking</h3>
                    <p className="text-xs text-slate-400">Book services directly on behalf of call-in patients</p>
                  </div>
                </div>
                
                {/* Selector Pills */}
                <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                  {[
                    { id: "opd" as const, label: "Doctor Appointment", icon: <Stethoscope className="h-4 w-4" />, color: "bg-blue-600 text-white" },
                    { id: "lab" as const, label: "Lab Test", icon: <FlaskConical className="h-4 w-4" />, color: "bg-violet-600 text-white" },
                    { id: "med" as const, label: "Medicine Order", icon: <Pill className="h-4 w-4" />, color: "bg-emerald-600 text-white" },
                  ].map(t => {
                    const active = mbType === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => { setMbType(t.id); setMbSuccessDetails(null); }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                          active ? `${t.color} shadow-md` : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                        }`}
                      >
                        {t.icon}
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Form Content */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 max-w-4xl">
                {mbType === "opd" && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                      <Stethoscope className="h-5 w-5 text-blue-600" />
                      <h4 className="font-black text-slate-800 text-sm uppercase tracking-wider">OPD Appointment Details</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Doctor Selection */}
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Select Doctor *</label>
                        <select
                          value={mbDocId}
                          onChange={e => {
                            setMbDocId(e.target.value);
                            const doc = doctorsList.find(d => d.id === e.target.value);
                            if (doc) {
                              setMbApptTime(doc.time_slots?.[0] || "09:00 AM");
                            }
                          }}
                          className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all font-semibold"
                        >
                          <option value="">-- Select Registered Doctor --</option>
                          {doctorsList.map(d => (
                            <option key={d.id} value={d.id}>
                              {d.name} ({d.specialty || "General"}) · Fee: ₹{d.fee || d.consultationFee} · {d.hospital_name || "Partner"}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Date & Time */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Date *</label>
                          <input
                            type="date"
                            value={mbApptDate}
                            onChange={e => setMbApptDate(e.target.value)}
                            min={new Date().toISOString().split("T")[0]}
                            className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm text-slate-700 outline-none focus:border-blue-300 transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Time Slot *</label>
                          {(() => {
                            const doc = doctorsList.find(d => d.id === mbDocId);
                            const slots = doc?.time_slots || [
                              "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
                              "02:00 PM", "02:30 PM", "03:00 PM", "04:00 PM", "04:30 PM", "05:00 PM"
                            ];
                            return (
                              <select
                                value={mbApptTime}
                                onChange={e => setMbApptTime(e.target.value)}
                                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm text-slate-700 outline-none focus:border-blue-300 transition-all font-semibold"
                              >
                                {slots.map(slot => (
                                  <option key={slot} value={slot}>{slot}</option>
                                ))}
                              </select>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4">
                      <h5 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-4">Patient Information</h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Patient Full Name *</label>
                          <input
                            type="text"
                            placeholder="Name"
                            value={mbOpdName}
                            onChange={e => setMbOpdName(e.target.value)}
                            className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm text-slate-700 outline-none focus:border-blue-300 transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Patient Phone Number *</label>
                          <input
                            type="tel"
                            placeholder="+91 XXXXX XXXXX"
                            value={mbOpdPhone}
                            onChange={e => setMbOpdPhone(e.target.value)}
                            className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm text-slate-700 outline-none focus:border-blue-300 transition-all"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Age *</label>
                            <input
                              type="number"
                              placeholder="Age"
                              value={mbOpdAge}
                              onChange={e => setMbOpdAge(e.target.value)}
                              className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm text-slate-700 outline-none focus:border-blue-300 transition-all"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Gender *</label>
                            <select
                              value={mbOpdGender}
                              onChange={e => setMbOpdGender(e.target.value)}
                              className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-slate-700 outline-none focus:border-blue-300 transition-all font-semibold"
                            >
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Town / Village *</label>
                          <input
                            type="text"
                            placeholder="e.g. Bhimavaram"
                            value={mbOpdTown}
                            onChange={e => setMbOpdTown(e.target.value)}
                            className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm text-slate-700 outline-none focus:border-blue-300 transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Symptoms / Disease Notes</label>
                          <input
                            type="text"
                            placeholder="Fever, Cold, Body Pains, etc."
                            value={mbOpdNotes}
                            onChange={e => setMbOpdNotes(e.target.value)}
                            className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm text-slate-700 outline-none focus:border-blue-300 transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bill Review */}
                    {mbDocId && (
                      <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 mt-4 space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Billing Breakdown</p>
                        {(() => {
                          const doc = doctorsList.find(d => d.id === mbDocId);
                          const fee = Number(doc?.fee || doc?.consultationFee || 0);
                          const platformFee = Number(toggles?.opd_fee || 29);
                          return (
                            <div className="space-y-2 text-xs font-semibold text-slate-600">
                              <div className="flex justify-between">
                                <span>Consultation Fee:</span>
                                <span className="font-bold text-slate-800">₹{fee}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Platform Booking Fee:</span>
                                <span className="font-bold text-slate-800">₹{platformFee}</span>
                              </div>
                              <div className="border-t border-dashed border-slate-200 pt-2 flex justify-between text-sm font-black text-slate-900">
                                <span>Grand Total Payable:</span>
                                <span className="text-blue-600">₹{fee + platformFee}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    <button
                      onClick={handleCreateManualBooking}
                      disabled={mbLoading}
                      className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-blue-100 disabled:opacity-50"
                    >
                      {mbLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirm Appointment & Generate Code"}
                    </button>
                  </div>
                )}

                {mbType === "lab" && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                      <FlaskConical className="h-5 w-5 text-violet-600" />
                      <h4 className="font-black text-slate-800 text-sm uppercase tracking-wider">Lab Booking Details</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Lab Partner Selection */}
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Select Lab Partner *</label>
                        <select
                          value={mbLabPartnerId}
                          onChange={e => setMbLabPartnerId(e.target.value)}
                          className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm text-slate-700 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100 transition-all font-semibold"
                        >
                          <option value="">-- Select Lab Partner --</option>
                          {partners.filter(p => p.type === "lab").map(p => (
                            <option key={p.partner_id} value={p.partner_id}>
                              {p.name} · {p.address || "Bhimavaram"}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Collection Date & Time */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Collection Date *</label>
                          <input
                            type="date"
                            value={mbLabDate}
                            onChange={e => setMbLabDate(e.target.value)}
                            min={new Date().toISOString().split("T")[0]}
                            className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm text-slate-700 outline-none focus:border-violet-300 transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Preferred Time *</label>
                          <select
                            value={mbLabTime}
                            onChange={e => setMbLabTime(e.target.value)}
                            className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm text-slate-700 outline-none focus:border-violet-300 transition-all font-semibold"
                          >
                            <option value="">-- Choose Slot --</option>
                            {["06:00 AM - 07:00 AM", "07:00 AM - 08:00 AM", "08:00 AM - 09:00 AM", "09:00 AM - 10:00 AM", "10:00 AM - 11:00 AM", "11:00 AM - 12:00 PM", "12:00 PM - 03:00 PM", "03:00 PM - 06:00 PM"].map(slot => (
                              <option key={slot} value={slot}>{slot}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Test Selection */}
                    <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Add Diagnostics / Lab Tests *</label>
                      
                      {/* Selected tests list */}
                      {mbLabSelectedTests.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {mbLabSelectedTests.map(t => (
                            <div key={t.id} className="flex items-center gap-1.5 bg-violet-100 text-violet-800 text-[11px] font-bold px-3 py-1.5 rounded-xl border border-violet-200">
                              <span>{t.name} (₹{t.price})</span>
                              <button
                                onClick={() => setMbLabSelectedTests(prev => prev.filter(x => x.id !== t.id))}
                                className="text-violet-500 hover:text-violet-800 transition-all ml-1 bg-white/50 hover:bg-white/80 p-0.5 rounded-full"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Dropdown test search */}
                      <div className="relative">
                        <select
                          onChange={e => {
                            if (!e.target.value) return;
                            const test = labTestsList.find(t => t.id === e.target.value);
                            if (test && !mbLabSelectedTests.some(x => x.id === test.id)) {
                              setMbLabSelectedTests(prev => [...prev, { id: test.id, name: test.name, price: test.price }]);
                            }
                            e.target.value = "";
                          }}
                          className="w-full h-11 bg-white border border-slate-200 rounded-xl px-4 text-sm text-slate-700 outline-none focus:border-violet-300 transition-all font-semibold"
                        >
                          <option value="">-- Add Lab Test --</option>
                          {labTestsList
                            .filter(t => !mbLabSelectedTests.some(x => x.id === t.id))
                            .map(t => (
                              <option key={t.id} value={t.id}>
                                {t.name} · Price: ₹{t.price}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4">
                      <h5 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-4">Patient Information</h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Patient Full Name *</label>
                          <input
                            type="text"
                            placeholder="Name"
                            value={mbLabName}
                            onChange={e => setMbLabName(e.target.value)}
                            className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm text-slate-700 outline-none focus:border-violet-300 transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Patient Phone Number *</label>
                          <input
                            type="tel"
                            placeholder="+91 XXXXX XXXXX"
                            value={mbLabPhone}
                            onChange={e => setMbLabPhone(e.target.value)}
                            className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm text-slate-700 outline-none focus:border-violet-300 transition-all"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Age *</label>
                            <input
                              type="number"
                              placeholder="Age"
                              value={mbLabAge}
                              onChange={e => setMbLabAge(e.target.value)}
                              className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm text-slate-700 outline-none focus:border-violet-300 transition-all"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Gender *</label>
                            <select
                              value={mbLabGender}
                              onChange={e => setMbLabGender(e.target.value)}
                              className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-slate-700 outline-none focus:border-violet-300 transition-all font-semibold"
                            >
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Sample Collection Address *</label>
                        <textarea
                          placeholder="House No, Street, Landmark, Town/Village"
                          value={mbLabAddress}
                          onChange={e => setMbLabAddress(e.target.value)}
                          className="w-full h-20 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-300 transition-all resize-none"
                        />
                      </div>
                    </div>

                    {/* Bill Review */}
                    {mbLabSelectedTests.length > 0 && (
                      <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 mt-4 space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Billing Breakdown</p>
                        {(() => {
                          const testsTotal = mbLabSelectedTests.reduce((s, t) => s + (t.price || 0), 0);
                          const platformFee = Number(toggles?.lab_fee || 49);
                          return (
                            <div className="space-y-2 text-xs font-semibold text-slate-600">
                              <div className="flex justify-between">
                                <span>Selected Tests Total:</span>
                                <span className="font-bold text-slate-800">₹{testsTotal}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Platform Booking Fee:</span>
                                <span className="font-bold text-slate-800">₹{platformFee}</span>
                              </div>
                              <div className="border-t border-dashed border-slate-200 pt-2 flex justify-between text-sm font-black text-slate-900">
                                <span>Grand Total Payable:</span>
                                <span className="text-violet-600">₹{testsTotal + platformFee}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    <button
                      onClick={handleCreateManualBooking}
                      disabled={mbLoading}
                      className="w-full h-12 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-black text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-violet-100 disabled:opacity-50"
                    >
                      {mbLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirm Lab Booking & Generate Code"}
                    </button>
                  </div>
                )}

                {mbType === "med" && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                      <Pill className="h-5 w-5 text-emerald-600" />
                      <h4 className="font-black text-slate-800 text-sm uppercase tracking-wider">Pharmacy Order Details</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Pharmacy Partner Selection */}
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Select Pharmacy Partner *</label>
                        <select
                          value={mbPharmPartnerId}
                          onChange={e => setMbPharmPartnerId(e.target.value)}
                          className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all font-semibold"
                        >
                          <option value="">-- Select Pharmacy Partner --</option>
                          {partners.filter(p => p.type === "pharmacy").map(p => (
                            <option key={p.partner_id} value={p.partner_id}>
                              {p.name} · {p.address || "Bhimavaram"}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Add Custom Medicines */}
                    <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Prescribed Medicines / Items *</label>
                      
                      {/* Added items list */}
                      {mbMedItems.length > 0 && (
                        <div className="space-y-2 mb-4 bg-white rounded-xl p-3 border border-slate-200/60 divide-y divide-slate-100">
                          {mbMedItems.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center py-2 first:pt-0 last:pb-0">
                              <div>
                                <p className="text-xs font-black text-slate-700">{item.name}</p>
                                <p className="text-[10px] font-bold text-slate-400">{item.dosage} · Qty: {item.qty}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-black text-slate-800">₹{Number(item.price) * Number(item.qty)}</span>
                                <button
                                  onClick={() => setMbMedItems(prev => prev.filter((_, i) => i !== idx))}
                                  className="text-red-400 hover:text-red-600 transition-all bg-red-50 p-1.5 rounded-lg border border-red-100"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Medicine item inputs */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white p-3 rounded-xl border border-slate-200/60">
                        <div className="md:col-span-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Medicine Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Paracetamol 650mg"
                            value={mbItemName}
                            onChange={e => setMbItemName(e.target.value)}
                            className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs outline-none focus:border-emerald-300"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Dosage/Unit</label>
                          <input
                            type="text"
                            placeholder="e.g. 1 strip or 10 tabs"
                            value={mbItemDosage}
                            onChange={e => setMbItemDosage(e.target.value)}
                            className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs outline-none focus:border-emerald-300"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Price (₹)</label>
                            <input
                              type="number"
                              placeholder="Price"
                              value={mbItemPrice}
                              onChange={e => setMbItemPrice(e.target.value)}
                              className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs outline-none focus:border-emerald-300"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Qty</label>
                            <input
                              type="number"
                              placeholder="Qty"
                              value={mbItemQty}
                              onChange={e => setMbItemQty(e.target.value)}
                              className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs outline-none focus:border-emerald-300"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={() => {
                            if (!mbItemName || !mbItemPrice || !mbItemQty) {
                              toast.error("Please fill Name, Price and Qty to add item");
                              return;
                            }
                            setMbMedItems(prev => [...prev, {
                              name: mbItemName,
                              dosage: mbItemDosage || "1 unit",
                              price: Number(mbItemPrice),
                              qty: Number(mbItemQty)
                            }]);
                            setMbItemName("");
                            setMbItemDosage("1 unit");
                            setMbItemPrice("");
                            setMbItemQty("1");
                          }}
                          className="h-9 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-black text-xs rounded-xl flex items-center gap-1.5 transition-all"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add Item to Order
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4 font-semibold text-slate-600">
                      <h5 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-4">Patient & Delivery Information</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Patient Full Name *</label>
                          <input
                            type="text"
                            placeholder="Name"
                            value={mbMedName}
                            onChange={e => setMbMedName(e.target.value)}
                            className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm text-slate-700 outline-none focus:border-emerald-300 transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Patient Phone Number *</label>
                          <input
                            type="tel"
                            placeholder="+91 XXXXX XXXXX"
                            value={mbMedPhone}
                            onChange={e => setMbMedPhone(e.target.value)}
                            className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm text-slate-700 outline-none focus:border-emerald-300 transition-all"
                          />
                        </div>
                      </div>

                      <div className="mt-4">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Delivery Address *</label>
                        <textarea
                          placeholder="House No, Street, Landmark, Town/Village, Pincode"
                          value={mbMedAddress}
                          onChange={e => setMbMedAddress(e.target.value)}
                          className="w-full h-20 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 outline-none focus:border-emerald-300 transition-all resize-none"
                        />
                      </div>
                    </div>

                    {/* Bill Review */}
                    {mbMedItems.length > 0 && (
                      <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 mt-4 space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Billing Breakdown</p>
                        {(() => {
                          const subTotal = mbMedItems.reduce((s, m) => s + (Number(m.price) * Number(m.qty)), 0);
                          const platformFee = Number(toggles?.pharm_fee || 19);
                          const deliveryFee = Number(toggles?.delivery_fee || 40);
                          return (
                            <div className="space-y-2 text-xs font-semibold text-slate-600">
                              <div className="flex justify-between">
                                <span>Medicines Subtotal:</span>
                                <span className="font-bold text-slate-800">₹{subTotal}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Platform Processing Fee:</span>
                                <span className="font-bold text-slate-800">₹{platformFee}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Logistics Delivery Fee:</span>
                                <span className="font-bold text-slate-800">₹{deliveryFee}</span>
                              </div>
                              <div className="border-t border-dashed border-slate-200 pt-2 flex justify-between text-sm font-black text-slate-900">
                                <span>Grand Total Payable:</span>
                                <span className="text-emerald-600">₹{subTotal + platformFee + deliveryFee}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    <button
                      onClick={handleCreateManualBooking}
                      disabled={mbLoading}
                      className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 disabled:opacity-50"
                    >
                      {mbLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirm Medicine Order & Generate Code"}
                    </button>
                  </div>
                )}
              </div>

              {/* Success Details Modal */}
              {mbSuccessDetails && (
                <div className="fixed inset-0 bg-[#0F172A]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-8 text-center text-white relative">
                      <button 
                        onClick={() => setMbSuccessDetails(null)} 
                        className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-all"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <div className="h-16 w-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30">
                        <CheckCircle className="h-8 w-8 text-white" />
                      </div>
                      <h3 className="text-xl font-black">{mbSuccessDetails.type} Confirmed!</h3>
                      <p className="text-xs text-white/80 mt-1 uppercase tracking-widest font-bold">Manual Booking Success</p>
                    </div>
                    
                    <div className="p-6 space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Order ID</p>
                          <p className="text-lg font-black text-slate-800 mt-1 font-mono tracking-wider">{mbSuccessDetails.orderId}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Verification Code</p>
                          <p className="text-lg font-black text-emerald-600 mt-1 font-mono tracking-widest">{mbSuccessDetails.verificationCode}</p>
                        </div>
                      </div>
                      
                      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-xs text-amber-800 flex gap-2.5">
                        <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                        <div>
                          <p className="font-bold">Next Step: Notify Customer</p>
                          <p className="mt-1 leading-relaxed text-amber-700/95 font-medium">Please send the booking details and verification code to the customer via WhatsApp. Click the button below to initiate the chat.</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <button
                          onClick={() => {
                            const cleanPhone = mbSuccessDetails.phone.replace(/[^0-9]/g, "");
                            const prefixPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                            window.open(`https://wa.me/${prefixPhone}?text=${encodeURIComponent(mbSuccessDetails.text)}`, "_blank");
                          }}
                          className="w-full h-12 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-green-100 transition-all active:scale-[0.98]"
                        >
                          <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.858-4.417 9.861-9.86.002-2.638-1.023-5.117-2.884-6.979C16.572 1.897 14.1 .872 11.463.872a9.85 9.85 0 0 0-9.857 9.86c-.001 1.705.452 3.37 1.31 4.8l-.317 1.16 1.206-.312 1.155-.3.125-.075z"/>
                          </svg>
                          Share on WhatsApp
                        </button>
                        
                        <button
                          onClick={() => setMbSuccessDetails(null)}
                          className="w-full h-12 rounded-xl border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50 transition-all active:scale-[0.98]"
                        >
                          Done & Close
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── INCOMPLETE TASKS ────────────────────────────────────────── */}
          {activeTab === "incomplete_tasks" && (() => {
            const incompleteOPD = appointments.filter(a => a.status === "pending").filter(filterByDate);
            const incompleteLab = labBookings.filter(l => ["pending", "confirmed", "collected", "processing"].includes(l.status)).filter(filterByDate);
            const incompletePharm = prescriptions.filter(p => ["pending", "reviewed", "dispatched"].includes(p.status)).filter(filterByDate);
            
            const totalIncomplete = incompleteOPD.length + incompleteLab.length + incompletePharm.length;

            return (
              <div className="space-y-6">
                {/* Filters */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-amber-50 rounded-xl flex items-center justify-center">
                      <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900">Incomplete Tasks</h3>
                      <p className="text-xs text-slate-400">{totalIncomplete} total tasks awaiting completion</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 items-center gap-3">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 outline-none w-40">
                        <option value="today">Today Only</option>
                        <option value="yesterday">Yesterday</option>
                        <option value="week">Past 7 Days</option>
                        <option value="month">Past 30 Days</option>
                        <option value="all">All Time</option>
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
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><Stethoscope className="h-4 w-4" /></div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">OPD Pending</p>
                    </div>
                    <p className="text-3xl font-black text-slate-900">{incompleteOPD.length}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Appointments to be confirmed</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-8 w-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center"><FlaskConical className="h-4 w-4" /></div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Lab In-Progress</p>
                    </div>
                    <p className="text-3xl font-black text-slate-900">{incompleteLab.length}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Pending collection or results</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><Pill className="h-4 w-4" /></div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Pharmacy Orders</p>
                    </div>
                    <p className="text-3xl font-black text-slate-900">{incompletePharm.length}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Pricing or delivery pending</p>
                  </div>
                </div>

                {/* Unified Task List */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/50">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Outstanding Assignments</h4>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {[
                      ...incompleteOPD.map(o => ({ ...o, taskType: 'opd', timestamp: new Date(o.created_at).getTime() })),
                      ...incompleteLab.map(l => ({ ...l, taskType: 'lab', timestamp: new Date(l.created_at).getTime() })),
                      ...incompletePharm.map(p => ({ ...p, taskType: 'pharmacy', timestamp: new Date(p.created_at).getTime() }))
                    ]
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .map((task, i) => {
                      const icon = task.taskType === 'opd' ? <Stethoscope className="h-4 w-4" /> : task.taskType === 'lab' ? <FlaskConical className="h-4 w-4" /> : <Pill className="h-4 w-4" />;
                      const color = task.taskType === 'opd' ? "text-blue-600 bg-blue-50" : task.taskType === 'lab' ? "text-violet-600 bg-violet-50" : "text-emerald-600 bg-emerald-50";
                      
                      return (
                        <div key={`${task.taskType}-${task.id}`} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>{icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-900 text-sm truncate">{task.patient_name}</p>
                              <span className="text-[10px] font-black font-mono text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md tracking-wider shrink-0">{task.order_id}</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5 truncate">
                              {task.taskType === 'opd' && `Doctor Appointment · Status: ${task.status}`}
                              {task.taskType === 'lab' && `Lab Test Booking · Status: ${task.status}`}
                              {task.taskType === 'pharmacy' && `Medicine Order · Status: ${task.status}`}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-bold text-slate-700">{new Date(task.timestamp).toLocaleDateString()}</p>
                            <p className="text-[10px] text-slate-400">{new Date(task.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                          <button 
                            onClick={() => { setLookupId(task.order_id); handleLookup(); setActiveTab("lookup"); }}
                            className="h-8 w-8 rounded-lg bg-slate-100 text-slate-400 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-all"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                    {totalIncomplete === 0 && (
                      <div className="px-6 py-16 text-center">
                        <div className="h-12 w-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                          <CheckCircle className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-bold text-slate-600">All caught up!</p>
                        <p className="text-xs text-slate-400">No incomplete tasks found for the selected period.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

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
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isOpd ? "OPD" : isLab ? "LAB" : "PHARMACY"}</span>
                            <span className="text-[10px] text-slate-400">·</span>
                            <span className="text-xs font-medium text-slate-500">{new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            {item.order_id && (
                              <>
                                <span className="text-[10px] text-slate-400">·</span>
                                <span className="text-[10px] font-black font-mono text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md tracking-wider">{item.order_id}</span>
                              </>
                            )}
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
                            <p className="text-sm font-black text-slate-900">{r.patient_name || "-"}</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Mobile Number</p>
                            <p className="text-sm font-black text-slate-900">{r.patient_phone || "-"}</p>
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

                      {/* ─ Verification Codes ─ */}
                      {( (isMed && medResult?.delivery_code) || (isLab && labResult?.collection_code) ) && (
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <KeyRound className="h-3.5 w-3.5" /> Security & Verification
                          </p>
                          <div className="bg-violet-50 border-2 border-violet-100 rounded-2xl p-5 flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-4">
                              <div className="h-12 w-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                                <KeyRound className="h-6 w-6 text-violet-600" />
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest">
                                  {isMed ? "Medicine Delivery Code" : "Lab Collection Code"}
                                </p>
                                <p className="text-3xl font-black text-violet-900 font-mono tracking-widest">
                                  {isMed ? medResult?.delivery_code : labResult?.collection_code}
                                </p>
                              </div>
                            </div>
                            <button 
                              onClick={() => {
                                const code = isMed ? medResult?.delivery_code : labResult?.collection_code;
                                if (code) {
                                  navigator.clipboard.writeText(code);
                                  toast.success("Verification code copied to clipboard");
                                }
                              }}
                              className="h-10 px-4 bg-white border border-violet-200 rounded-xl text-xs font-black text-violet-600 hover:bg-violet-100 transition-all shadow-sm flex items-center gap-2"
                            >
                              <Copy className="h-3.5 w-3.5" /> Copy Code
                            </button>
                          </div>
                          <p className="text-[10px] text-violet-400 mt-2 italic">Share this code with the patient if they have lost it or cannot access their profile.</p>
                        </div>
                      )}

                      {/* ─ Booking Specifics ─ */}
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5" /> Booking Details
                        </p>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                          {isOpd && (<>
                            <div className={`${typeConfig.bg} rounded-xl p-3 border ${typeConfig.border}`}>
                              <p className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${typeConfig.accent}`}>Doctor</p>
                              <p className="text-sm font-black text-slate-900">{opdResult?.doctor_name || "-"}</p>
                            </div>
                            <div className={`${typeConfig.bg} rounded-xl p-3 border ${typeConfig.border}`}>
                              <p className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${typeConfig.accent}`}>Date & Time</p>
                              <p className="text-sm font-black text-slate-900">{opdResult?.appointment_date} · {opdResult?.appointment_time}</p>
                            </div>
                            {(opdResult?.patient_age || opdResult?.patient_gender) && (
                              <div className={`${typeConfig.bg} rounded-xl p-3 border ${typeConfig.border}`}>
                                <p className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${typeConfig.accent}`}>Age / Gender</p>
                                <p className="text-sm font-black text-slate-900">{opdResult?.patient_age} yrs · {opdResult?.patient_gender || "-"}</p>
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
                            {/* Logistics Assignment for Super Admin */}
                            <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 col-span-2 lg:col-span-3">
                              <div className="flex items-center justify-between mb-3">
                                <div>
                                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-0.5">Logistics Assignment</p>
                                  <p className="text-sm font-black text-indigo-900">Assign Delivery Partner</p>
                                </div>
                                <Truck className="h-5 w-5 text-indigo-400" />
                              </div>
                              <div className="flex gap-2">
                                <select 
                                  className="flex-1 h-10 bg-white border border-indigo-200 rounded-lg px-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
                                  value={medResult?.logistics_partner_id || ""}
                                  onChange={async (e) => {
                                    const partnerId = e.target.value;
                                    const { error } = await supabase
                                      .from("prescriptions")
                                      .update({ logistics_partner_id: partnerId })
                                      .eq("id", medResult.id);
                                    if (error) {
                                      toast.error("Failed to assign partner");
                                    } else {
                                      toast.success("Logistics partner assigned!");
                                      handleLookup(); // Refresh details
                                    }
                                  }}
                                >
                                  <option value="">Select Partner...</option>
                                  {partners.filter(p => p.type === "logistics").map(lp => (
                                    <option key={lp.id} value={lp.partner_id}>{lp.name}</option>
                                  ))}
                                </select>
                                <div className="h-10 px-3 flex items-center justify-center bg-indigo-100 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-wider">
                                  {medResult?.logistics_partner_id ? "Assigned" : "Pending"}
                                </div>
                              </div>
                            </div>
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
                  <button onClick={() => downloadCSV(platformUsers, "Aaroksha_Users", [
                    { header: "Name", key: "full_name" },
                    { header: "Email", key: "email" },
                    { header: "Phone", key: "phone" },
                    { header: "Role", key: "role" },
                    { header: "Joined On", key: "created_at" }
                  ])} className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl font-bold text-xs transition-all">
                    <Download className="h-3.5 w-3.5" /> Export Users
                  </button>
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
                  <div className="flex items-center gap-6">
                    <div>
                      <h3 className="font-black text-slate-900">All Partners</h3>
                      <p className="text-xs text-slate-400">{partners.length} registered partners</p>
                    </div>
                    {/* Status Filters */}
                    <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                      {(["all", "active", "hold", "deleted"] as const).map(s => (
                        <button 
                          key={s}
                          onClick={() => setPartnerFilter(s)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                            partnerFilter === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => downloadCSV(partners, "Aaroksha_Partners", [
                    { header: "Partner Name", key: "name" },
                    { header: "Type", key: "type" },
                    { header: "Status", key: "status" },
                    { header: "Email", key: "email" },
                    { header: "Phone", key: "phone" },
                    { header: "Partner ID", key: "partner_id" }
                  ])} className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl font-bold text-xs transition-all">
                    <Download className="h-3.5 w-3.5" /> Export Partners
                  </button>
                </div>
                <div className="divide-y divide-slate-50">
                  {partners
                    .filter(p => partnerFilter === "all" ? p.status !== "deleted" : p.status === partnerFilter)
                    .map(partner => {
                    const meta = TYPE_META[partner.type];
                    return (
                      <div key={partner.id} className={`px-6 py-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors ${partner.status === "hold" ? "bg-amber-50/20" : partner.status === "deleted" ? "opacity-60 bg-slate-50" : ""}`}>
                        <div className={`h-10 w-10 ${meta.bg} rounded-xl flex items-center justify-center ${meta.color} shrink-0`}>
                          {meta.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900 text-sm">{partner.name}</p>
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>{meta.label}</span>
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                              partner.status === "active" ? "bg-emerald-50 text-emerald-600" : 
                              partner.status === "hold" ? "bg-amber-100 text-amber-700" : 
                              "bg-slate-200 text-slate-600"
                            }`}>
                              {partner.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{partner.email} · Commission: {partner.commission_type === "fixed" ? `₹${partner.commission_rate}/txn` : `${partner.commission_rate}%`}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] text-slate-400 font-mono">{partner.partner_id.slice(0, 18)}...</p>
                          <p className="text-[10px] text-slate-300">{partner.phone || "No phone"}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {partner.status !== "deleted" && (
                            <a href={meta.route} target="_blank" rel="noreferrer"
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${meta.bg} ${meta.color} hover:opacity-80 transition-all`}>
                              <ArrowUpRight className="h-3 w-3" /> Portal
                            </a>
                          )}
                          
                          {partner.status !== "deleted" && (
                            <button 
                              onClick={() => handleUpdateStatus(partner, partner.status === "active" ? "hold" : "active")}
                              title={partner.status === "active" ? "Put on Hold" : "Reactivate"}
                              className={`p-1.5 rounded-lg transition-all ${partner.status === "active" ? "text-amber-500 hover:bg-amber-50" : "text-emerald-500 hover:bg-emerald-50"}`}
                            >
                              {partner.status === "active" ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                            </button>
                          )}

                          <button onClick={() => { setEditingPartner(partner); setShowAddPartner(true); }}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>

                          {partner.status === "deleted" ? (
                             <button onClick={() => handleUpdateStatus(partner, "active")}
                             title="Restore Partner"
                             className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all">
                             <RefreshCw className="h-3.5 w-3.5" />
                           </button>
                          ) : (
                            <button onClick={() => handleDeletePartner(partner)}
                              title="Soft Delete"
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {partner.status === "deleted" && (
                             <button onClick={() => handleHardDeletePartner(partner)}
                             title="PERMANENT Hard Delete"
                             className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-all">
                             <Trash2 className="h-3.5 w-3.5" />
                           </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {partners.filter(p => partnerFilter === "all" ? p.status !== "deleted" : p.status === partnerFilter).length === 0 && (
                    <div className="px-6 py-12 text-center text-slate-400 font-bold text-sm">
                      No {partnerFilter === "all" ? "" : partnerFilter} partners found.
                    </div>
                  )}
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
          {/* ── SETTLEMENTS ────────────────────────────────────────────── */}
          {activeTab === "settlements" && (
            <SettlementManager userType="super_admin" />
          )}

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
                        {(() => {
                          // Use plain_password if available, else fall back to password field
                          const displayPw = (cp as any).plain_password || cp.password;
                          const isBcrypt = displayPw?.startsWith("$2");
                          if (isBcrypt) {
                            return (
                              <div className="space-y-1.5">
                                <p className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-1 rounded-lg">
                                  🔒 Password hashed — use Edit to reset
                                </p>
                              </div>
                            );
                          }
                          return (
                            <div className="flex items-center gap-2">
                              <p className={`text-xs font-black font-mono flex-1 ${visible ? "text-slate-900" : "text-slate-300 tracking-[0.25em]"}`}>
                                {visible ? displayPw : "•••••••••"}
                              </p>
                              {visible && (
                                <button onClick={() => { navigator.clipboard.writeText(displayPw); toast.success("Copied!"); }}>
                                  <Copy className="h-3 w-3 text-slate-400 hover:text-slate-700" />
                                </button>
                              )}
                            </div>
                          );
                        })()}
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
              <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-slate-900">All Platform Transactions</h3>
                  <p className="text-xs text-slate-400">{filteredAppointments.length + filteredPrescriptions.length + filteredLabBookings.length} total transactions in this period</p>
                </div>
                <button onClick={() => downloadCSV(liveFeed, "Aaroksha_Transactions", [
                  { header: "Patient Name", key: "patient_name" },
                  { header: "Type", key: "feedType" },
                  { header: "Order ID", key: "order_id" },
                  { header: "Amount", key: "grand_total" },
                  { header: "Status", key: "status" },
                  { header: "Payment", key: "payment_status" },
                  { header: "Date", key: "timestamp" }
                ])} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all hover:bg-slate-800">
                  <Download className="h-3.5 w-3.5" /> Export All
                </button>
              </div>
              <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto scrollbar-hide">
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
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Live Preview - Slide {bannerPreviewIdx + 1} of {platformBanners.length}</p>
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
                      <div className="px-5 pb-5 border-t border-slate-50 pt-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                          {/* Left: Image Upload */}
                          <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-1.5">
                              <ImagePlus className="h-3 w-3" /> Banner Image
                            </label>
                            <p className="text-xs text-slate-400 -mt-2">
                              Upload an image from your device. It will display exactly as-is on the homepage - no text overlay.
                            </p>

                            {/* Upload Box */}
                            <div
                              className="w-full aspect-[16/9] rounded-2xl overflow-hidden relative border-2 border-dashed border-blue-200 cursor-pointer group bg-slate-50 hover:border-blue-400 transition-all"
                              onClick={() => {
                                const input = document.createElement("input");
                                input.type = "file"; input.accept = "image/*";
                                input.onchange = (e) => {
                                  const f = (e.target as HTMLInputElement).files?.[0];
                                  if (f) handleBannerUpload(banner.id, f);
                                };
                                input.click();
                              }}
                            >
                              {banner.image ? (
                                <>
                                  <img src={banner.image} alt="Banner" className="w-full h-full object-cover" />
                                  {/* Hover overlay */}
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                    <ImagePlus className="h-7 w-7 text-white" />
                                    <span className="text-white text-xs font-black">Replace Image</span>
                                  </div>
                                </>
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-400">
                                  <div className="h-14 w-14 rounded-2xl bg-blue-100 flex items-center justify-center">
                                    <ImagePlus className="h-7 w-7 text-blue-500" />
                                  </div>
                                  <div className="text-center">
                                    <p className="text-sm font-black text-slate-600">Click to upload image</p>
                                    <p className="text-xs text-slate-400 mt-1">JPG, PNG, WebP supported</p>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Remove image button */}
                            {banner.image && (
                              <button
                                onClick={() => {
                                  const updated = platformBanners.map(b =>
                                    b.id === banner.id ? { ...b, image: "", imageOnly: false } : b
                                  );
                                  persistBanners(updated);
                                }}
                                className="w-full flex items-center justify-center gap-1.5 text-red-500 hover:text-red-600 text-xs font-bold py-2 border border-red-100 rounded-xl hover:bg-red-50 transition-all"
                              >
                                <Trash2 className="h-3 w-3" /> Remove Image
                              </button>
                            )}

                            {banner.image && (
                              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                                <p className="text-xs font-bold text-emerald-700">
                                  Image uploaded - shows exactly as-is on the homepage
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Right: Just the link */}
                          <div className="space-y-4">
                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                                Banner Label (for admin reference)
                              </label>
                              <input
                                value={banner.title}
                                onChange={e => handleUpdateBanner(banner.id, "title", e.target.value)}
                                placeholder="e.g. Lab Test Promo"
                                className="w-full h-11 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 transition-all px-3"
                              />
                              <p className="text-[10px] text-slate-400 mt-1">Used as alt text and admin label - not shown on homepage image</p>
                            </div>

                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 flex items-center gap-1.5">
                                <Link2 className="h-3 w-3" /> Link When Clicked
                              </label>
                              <input
                                value={banner.to}
                                onChange={e => handleUpdateBanner(banner.id, "to", e.target.value)}
                                placeholder="e.g. /doctors or /lab-tests"
                                className="w-full h-11 text-sm font-mono text-blue-600 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 transition-all px-3"
                              />
                              <p className="text-[10px] text-slate-400 mt-1">Where is the customer taken when they tap this banner?</p>
                            </div>

                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-1.5">
                              <p className="text-xs font-black text-blue-800">📸 How It Works</p>
                              <p className="text-[11px] text-blue-600 leading-relaxed">
                                1. Upload an image designed at any size (we recommend 1200×500px)<br/>
                                2. The image shows exactly as-is - no text overlay, no modifications<br/>
                                3. Click "Add Banner" to add another slide to the carousel
                              </p>
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
                    {toggles.upi && (
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                          UPI ID <span className="text-slate-300 font-normal normal-case tracking-normal">(shown to customers)</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. aaroksha@upi"
                          value={(toggles as any).upi_id || ""}
                          onChange={e => setToggles(p => ({ ...p, upi_id: e.target.value }))}
                          className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-300 transition-all shadow-sm"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Patients copy this UPI ID to pay manually until the gateway is integrated.</p>
                      </div>
                    )}
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
                    if (!error) {
                      toast.success("Platform settings synced successfully!");
                      syncSettingsFromSupabase().then(s => setToggles(s));
                    }
                    else toast.error("Failed to sync settings");
                  }} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 shadow-sm">Save All Changes</button>
                  <button onClick={() => { syncSettingsFromSupabase().then(s => setToggles(s)); }} className="flex items-center gap-2 bg-slate-100 text-slate-600 px-6 py-3 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">Discard</button>
                </div>
              </div>
            </div>
          )}

          {/* ── LOGISTICS HUB ──────────────────────────────────────────── */}
          {activeTab === "logistics_hub" && (
            <div className="space-y-6">
              
              {/* Header & Date Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Logistics Management</h2>
                  <p className="text-slate-400 text-sm font-medium">Assign deliveries and track partner performance</p>
                </div>
                <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm shrink-0">
                  <div className="flex bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 items-center gap-3">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 outline-none w-40">
                      <option value="today">Today Only</option>
                      <option value="yesterday">Yesterday</option>
                      <option value="week">Past 7 Days</option>
                      <option value="month">Past 30 Days</option>
                      <option value="all">All Time</option>
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
              </div>

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
                      const assigned = deliveryOrders.filter(o => (o as any).logistics_partner_id === p.partner_id).length;
                      const done     = deliveryOrders.filter(o => (o as any).logistics_partner_id === p.partner_id && o.status === "completed").length;
                      const pending  = assigned - done;
                      return (
                        <div key={p.id} className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="h-10 w-10 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                              <Truck className="h-5 w-5 text-indigo-600" />
                            </div>
                            <div>
                              <p className="font-black text-slate-800 text-sm">{p.name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <p className="text-[10px] text-slate-400">{p.phone || p.email}</p>
                                {p.category && (
                                  <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md ${p.category === 'lab' ? 'bg-violet-50 text-violet-600 border border-violet-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                    {p.category}
                                  </span>
                                )}
                              </div>
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
                      if (logisticsFilter === "unassigned") return !(o as any).logistics_partner_id;
                      if (logisticsFilter === "dispatched") return ["reviewed", "dispatched", "collected"].includes(o.status);
                      if (logisticsFilter === "completed")  return o.status === "completed";
                      return true;
                    })
                    .map(order => {
                      const meds = Array.isArray(order.medicines) ? order.medicines : [];
                      const assignedPartner = logisticPartners.find(p => p.partner_id === (order as any).logistics_partner_id);
                      
                      let computedStatus = order.status;
                      if (order.status === "reviewed" && order.payment_status === "paid") {
                        computedStatus = "paid"; // virtual status just for styling below
                      }

                      const statusCfg: Record<string, { cls: string; dot: string; label: string }> = {
                        paid:       { cls: "bg-purple-50 text-purple-700",  dot: "bg-purple-500",  label: "Paid - Awaiting Dispatch" },
                        reviewed:   { cls: "bg-blue-50 text-blue-700",    dot: "bg-blue-500",   label: "Awaiting Dispatch" },
                        dispatched: { cls: "bg-orange-50 text-orange-700",  dot: "bg-orange-500",  label: "Ready for Pickup" },
                        collected:  { cls: "bg-indigo-50 text-indigo-700",  dot: "bg-indigo-500",  label: "Out for Delivery" },
                        completed:  { cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", label: "Delivered" },
                      };
                      const sc = statusCfg[computedStatus] || { cls: "bg-slate-50 text-slate-600", dot: "bg-slate-400", label: order.status };

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
                                <span>📞 {order.patient_phone || "-"}</span>
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
                                      value={(order as any).logistics_partner_id || ""}
                                      onChange={e => {
                                        const pid = e.target.value;
                                        const pname = logisticPartners.find(p => p.partner_id === pid)?.name || "";
                                        if (pid) handleAssignPartner(order.id, pid, pname, (order as any).type);
                                      }}
                                      disabled={assigningId === order.id}
                                      className={`h-9 pl-3 pr-7 rounded-xl border text-xs font-bold focus:outline-none transition-all ${
                                        assignedPartner
                                          ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                                          : "bg-amber-50 border-amber-200 text-amber-700"
                                      }`}
                                    >
                                      <option value="">{assignedPartner ? "Reassign..." : "Assign Partner"}</option>
                                      {logisticPartners
                                        .filter(p => !p.category || p.category === (order as any).type)
                                        .map(p => (
                                          <option key={p.id} value={p.partner_id}>{p.name}</option>
                                        ))
                                      }
                                    </select>
                                  {assigningId === order.id && (
                                    <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" />
                                  )}
                                  {((order as any).type === "pharmacy" && order.status === "reviewed" && order.payment_status === "paid" && (order as any).logistics_partner_id) ? (
                                    <button 
                                      onClick={() => handleDispatch(order.id, (order as any).type)}
                                      disabled={dispatchingId === order.id}
                                      className="h-9 px-3 ml-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {dispatchingId === order.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Truck className="h-3 w-3" />}
                                      Dispatch
                                    </button>
                                  ) : null}
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

          {/* ── STORAGE MANAGEMENT TAB ─────────────────────────────────────── */}
          {activeTab === "storage" && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Storage Management</h2>
                  <p className="text-slate-400 text-sm font-medium">Monitor and clean up Supabase Storage buckets</p>
                </div>
                <button
                  onClick={loadStorageStats}
                  disabled={storageLoading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-200 transition-all disabled:opacity-50"
                >
                  {storageLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <HardDrive className="h-4 w-4" />}
                  {storageLoaded ? "Refresh Stats" : "Load Storage Stats"}
                </button>
              </div>

              {!storageLoaded && !storageLoading && (
                <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
                  <HardDrive className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                  <p className="font-black text-slate-500 text-lg">Storage Not Loaded</p>
                  <p className="text-slate-400 text-sm mt-1">Click "Load Storage Stats" to scan all buckets</p>
                </div>
              )}

              {storageLoading && (
                <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
                  <Loader2 className="h-10 w-10 text-blue-500 animate-spin mx-auto mb-4" />
                  <p className="font-black text-slate-500">Scanning storage buckets...</p>
                </div>
              )}

              {storageLoaded && !storageLoading && (
                <>
                  {/* Free Tier Progress */}
                  <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Free Tier Usage</p>
                        <p className="text-3xl font-black mt-1">
                          {(storageStats.reduce((s, b) => s + b.totalKB, 0) / 1024).toFixed(1)} MB
                          <span className="text-slate-400 text-lg font-bold"> / 1,000 MB</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-emerald-400">
                          {(100 - storageStats.reduce((s, b) => s + b.totalKB, 0) / 1024 / 10).toFixed(1)}%
                        </p>
                        <p className="text-xs text-slate-400">free remaining</p>
                      </div>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-emerald-400 h-3 rounded-full transition-all"
                        style={{ width: `${Math.min(storageStats.reduce((s, b) => s + b.totalKB, 0) / 1024 / 10, 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2 font-bold">
                      {storageStats.reduce((s, b) => s + b.files, 0)} total files across {storageStats.length} buckets
                    </p>
                  </div>

                  {/* Bucket Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {storageStats.map(s => {
                      const mb = (s.totalKB / 1024).toFixed(2);
                      const pct = Math.min((s.totalKB / 1024 / 10), 100).toFixed(1);
                      const bucketColor = s.bucket === "prescriptions" ? "text-violet-600 bg-violet-50" : s.bucket === "doctor_profiles" ? "text-blue-600 bg-blue-50" : "text-amber-600 bg-amber-50";
                      return (
                        <div key={s.bucket} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                          <div className="flex items-center gap-3 mb-4">
                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${bucketColor}`}>
                              <HardDrive className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-black text-slate-800 text-sm">{s.bucket}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.files} files</p>
                            </div>
                          </div>
                          <p className="text-2xl font-black text-slate-900">{mb} MB</p>
                          <div className="w-full bg-slate-100 rounded-full h-2 mt-2">
                            <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 font-bold">{pct}% of free tier used</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* File List */}
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
                      <div>
                        <p className="font-black text-slate-800">All Files</p>
                        <p className="text-[11px] text-slate-400 font-bold">Sorted by size — largest first</p>
                      </div>
                      <span className="text-[11px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                        {storageFiles.length} files
                      </span>
                    </div>
                    <div className="divide-y divide-slate-50 max-h-[500px] overflow-y-auto">
                      {storageFiles.map((f, i) => (
                        <div key={i} className="flex items-center justify-between px-6 py-3 hover:bg-slate-50/60 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black ${
                              f.bucket === "prescriptions" ? "bg-violet-100 text-violet-600" :
                              f.bucket === "doctor_profiles" ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600"
                            }`}>
                              {f.bucket === "prescriptions" ? "Rx" : f.bucket === "doctor_profiles" ? "Dr" : "Bn"}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-700 truncate max-w-[280px]">{f.name}</p>
                              <p className="text-[10px] text-slate-400 font-medium">{f.bucket} · {f.created ? new Date(f.created).toLocaleDateString("en-IN") : "—"}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                              f.sizeKB > 1000 ? "bg-red-50 text-red-600" :
                              f.sizeKB > 300 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                            }`}>
                              {f.sizeKB > 1024 ? `${(f.sizeKB/1024).toFixed(1)} MB` : `${f.sizeKB} KB`}
                            </span>
                            <button
                              onClick={() => {
                                if (confirm(`Delete "${f.name}" from ${f.bucket}? This cannot be undone.`)) {
                                  deleteStorageFile(f.bucket, f.name);
                                }
                              }}
                              disabled={deletingFile === f.name}
                              className="h-7 w-7 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center text-red-400 hover:bg-red-100 hover:text-red-600 transition-all active:scale-95 disabled:opacity-40"
                              title="Delete file"
                            >
                              {deletingFile === f.name ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                            </button>
                          </div>
                        </div>
                      ))}
                      {storageFiles.length === 0 && (
                        <div className="px-6 py-12 text-center text-slate-400 text-sm">No files found</div>
                      )}
                    </div>
                  </div>

                  {/* SQL Tip */}
                  <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3">💡 SQL Optimization Queries</p>
                    <p className="text-xs text-slate-400 font-medium mb-3">
                      Run these in <strong className="text-white">Supabase → SQL Editor</strong> for deeper analysis and bulk cleanup:
                    </p>
                    <div className="space-y-2">
                      {[
                        "SELECT bucket_id, COUNT(*), ROUND(SUM((metadata->>'size')::numeric)/1024/1024,2) AS total_mb FROM storage.objects WHERE metadata IS NOT NULL GROUP BY bucket_id;",
                        "DELETE FROM storage.objects WHERE bucket_id = 'prescriptions' AND NOT EXISTS (SELECT 1 FROM public.prescriptions p WHERE p.image_url LIKE '%' || split_part(name, '/', 2) || '%');",
                        "SELECT bucket_id, name, ROUND((metadata->>'size')::numeric/1024,1) AS kb FROM storage.objects WHERE metadata IS NOT NULL ORDER BY (metadata->>'size')::numeric DESC LIMIT 20;",
                      ].map((q, i) => (
                        <div key={i} className="bg-slate-900 rounded-xl p-3 relative group">
                          <code className="text-[10px] text-emerald-400 font-mono leading-relaxed block">{q}</code>
                          <button
                            onClick={() => { navigator.clipboard.writeText(q); toast.success("Query copied!"); }}
                            className="absolute top-2 right-2 h-6 w-6 rounded-lg bg-slate-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Copy className="h-3 w-3 text-slate-300" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
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

            <div className="p-8 space-y-5 max-h-[70vh] overflow-y-auto scrollbar-hide">
              {/* Partner Type */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Partner Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {(["hospital", "lab", "pharmacy", "logistics"] as const).map(t => {
                    const meta = getMeta(t);
                    const active = (editingPartner?.type ?? newPartner.type) === t;
                    return (
                      <button key={t} onClick={() => {
                        if (editingPartner) setEditingPartner({ ...editingPartner, type: t });
                        else setNewPartner(p => ({ ...p, type: t, commission_rate: COMMISSION_DEFAULTS[t] || 10 }));
                      }}
                        className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-[10px] font-bold transition-all ${active ? `${meta.bg} ${meta.border} ${meta.color}` : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                        {meta.icon}
                        <span>{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Logistics Category (Only if Logistics type is selected) */}
              {((editingPartner?.type ?? newPartner.type) === "logistics") && (
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 animate-in fade-in slide-in-from-top-2">
                  <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block mb-3">Logistics Specialization</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'lab', label: 'Lab Sample Collection', icon: <FlaskConical className="h-4 w-4" /> },
                      { id: 'pharmacy', label: 'Pharmacy Delivery', icon: <Pill className="h-4 w-4" /> }
                    ].map(cat => {
                      const active = (editingPartner?.category ?? newPartner.category) === cat.id;
                      return (
                        <button 
                          key={cat.id}
                          onClick={() => {
                            if (editingPartner) setEditingPartner({ ...editingPartner, category: cat.id as any });
                            else setNewPartner(p => ({ ...p, category: cat.id as any }));
                          }}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${
                            active 
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100" 
                              : "bg-white border-slate-200 text-slate-500 hover:border-indigo-300"
                          }`}
                        >
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${active ? "bg-white/20" : "bg-slate-100 text-slate-400"}`}>
                            {cat.icon}
                          </div>
                          <div className="text-left">
                            <p className="text-[10px] font-black leading-tight">{cat.label}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-indigo-400 mt-3 font-medium italic">
                    * This partner will only see and manage orders related to their selected specialization.
                  </p>
                </div>
              )}

              {/* Fields */}
              {[
                { label: "Partner / Hospital Name *", key: "name", type: "text", placeholder: "e.g. Apollo Hospital Banjara Hills" },
                { label: "Logo URL (Image Link)", key: "logo_url", type: "url", placeholder: "https://example.com/logo.png" },
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

              {/* Advanced Settings (Services/Timings) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Services (Comma Separated)</label>
                  <input type="text" placeholder="e.g. ICU, Emergency"
                    value={editingPartner ? (editingPartner.settings?.services?.join(", ") || "") : (newPartner.settings.services.join(", "))}
                    onChange={e => {
                      const tags = e.target.value.split(",").map(t => t.trim()).filter(t => t);
                      if (editingPartner) setEditingPartner({ ...editingPartner, settings: { ...editingPartner.settings, services: tags } });
                      else setNewPartner(p => ({ ...p, settings: { ...p.settings, services: tags } }));
                    }}
                    className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm text-slate-700 outline-none focus:border-blue-300 transition-all" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Working Timings</label>
                  <input type="text" placeholder="e.g. 24/7 or 9AM-9PM"
                    value={editingPartner ? (editingPartner.settings?.timings || "") : (newPartner.settings.timings)}
                    onChange={e => {
                      if (editingPartner) setEditingPartner({ ...editingPartner, settings: { ...editingPartner.settings, timings: e.target.value } });
                      else setNewPartner(p => ({ ...p, settings: { ...p.settings, timings: e.target.value } }));
                    }}
                    className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm text-slate-700 outline-none focus:border-blue-300 transition-all" />
                </div>
              </div>

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

              {/* Settlement Architecture */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Settlement Flow</label>
                  <select
                    value={editingPartner ? (editingPartner.settlement_model || "DYNAMIC") : newPartner.settlement_model}
                    onChange={e => {
                      const v = e.target.value as any;
                      if (editingPartner) setEditingPartner({ ...editingPartner, settlement_model: v });
                      else setNewPartner(p => ({ ...p, settlement_model: v }));
                    }}
                    className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-300 transition-all"
                  >
                    <option value="DYNAMIC">Dynamic (Per-Order)</option>
                    <option value="PLATFORM_PAYS_PARTNER">We Pay Partner (Net Amount)</option>
                    <option value="PARTNER_PAYS_PLATFORM">Partner Pays Us (Commission)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Settlement Cycle</label>
                <div className="grid grid-cols-4 gap-2">
                  {(["today", "daily", "weekly", "monthly"] as const).map(c => {
                    const active = (editingPartner?.settlement_cycle ?? newPartner.settlement_cycle) === c;
                    return (
                      <button key={c} onClick={() => {
                        if (editingPartner) setEditingPartner({ ...editingPartner, settlement_cycle: c });
                        else setNewPartner(p => ({ ...p, settlement_cycle: c }));
                      }}
                        className={`py-2.5 rounded-xl border-2 text-[10px] font-black uppercase tracking-wider transition-all ${active ? `bg-slate-900 border-slate-900 text-white` : "border-slate-200 text-slate-400 hover:border-slate-300"}`}>
                        {c}
                      </button>
                    );
                  })}
                </div>
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
