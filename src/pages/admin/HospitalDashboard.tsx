import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Calendar, Clock, Edit, Plus, Search, Stethoscope, Trash2, Users, Activity,
  Eye, CheckCircle, XCircle, Phone, IndianRupee, TrendingUp, Download,
  UserCheck, Star, BarChart3, LogOut, ArrowUpRight, Building2, Camera, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  verifyPartnerSession, clearAdminSession, revokePartnerSession,
  getPartnerIdFromSession,
} from "@/lib/adminAuth";

// --- Constants -----------------------------------------------------------
const SPECIALTIES = [
  "General Physician", "Cardiologist", "Orthopedic Surgeon", "Dermatologist",
  "Pediatrician", "Gynecologist", "ENT Specialist", "Neurologist",
  "Oncologist", "Ophthalmologist", "Urologist", "Pulmonologist",
  "Gastroenterologist", "Endocrinologist", "Psychiatrist", "Dentist",
  "Radiologist", "Anesthesiologist", "Rheumatologist", "Nephrology",
];

const ALL_TIME_SLOTS = [
  "08:00 AM","08:30 AM","09:00 AM","09:30 AM","10:00 AM","10:30 AM",
  "11:00 AM","11:30 AM","12:00 PM","12:30 PM","01:00 PM","01:30 PM",
  "02:00 PM","02:30 PM","03:00 PM","03:30 PM","04:00 PM","04:30 PM",
  "05:00 PM","05:30 PM","06:00 PM","06:30 PM","07:00 PM","07:30 PM",
];


// --- Types --------------------------------------------------------------
interface Doctor {
  id: string;
  name: string;
  specialty: string;
  qualification: string;
  experience: number;
  rating: number;
  fee: number;
  image: string;
  image_url?: string;
  available: boolean;
  phone: string;
  hospital_name: string;
  partner_id: string;
  hospital_id: string;
  languages: string;
  time_slots: string[];   // times visible to patients when booking
  advance_days: number;   // how many days ahead patient can book
  holidays: string[];     // dates blocked as holidays (YYYY-MM-DD)
}

interface Appointment {
  id: string;
  order_id?: string;
  patient_name: string;
  patient_phone: string;
  patient_age?: string;
  patient_gender?: string;
  patient_town?: string;
  patient_symptoms?: string;
  doctor_name: string;
  doctor_id?: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  payment_status: string;
  fee?: number;
  consultation_fee?: number;
  platform_fee?: number;
  notes?: string;
  is_priority?: boolean;
  verification_code?: string;
  created_at: string;
}

// --- Status colours ------------------------------------------------------
const statusColor: Record<string, string> = {
  confirmed: "bg-blue-100 text-blue-700 border-blue-200",
  completed:  "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled:  "bg-red-100 text-red-600 border-red-200",
  no_show:    "bg-amber-100 text-amber-700 border-amber-200",
  pending:    "bg-slate-100 text-slate-600 border-slate-200",
};

// --- Component -----------------------------------------------------------
const HospitalDashboard = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // â”€â”€â”€ Auth guard + partner ID â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [isVerifying, setIsVerifying] = useState(true);
  const [partnerId, setPartnerId]     = useState<string | null>(null);
  const [partner, setPartner]         = useState<any>(null);
  const [hospitalName, setHospitalName] = useState("Aaroksha Hospital");

  useEffect(() => {
    (async () => {
      const ok = await verifyPartnerSession("hospital");
      if (!ok) {
        toast.error("Session expired - please log in again.");
        clearAdminSession();
        navigate("/admin/login/hospital");
        return;
      }
      const pid = await getPartnerIdFromSession();
      setPartnerId(pid);

      // Also fetch the hospital name from partners table
      if (pid) {
        const { data } = await supabase
          .from("partners")
          .select("*")
          .eq("partner_id", pid)
          .single();
        if (data) {
          setPartner(data);
          setHospitalName(data.name);
        }
      }
      setIsVerifying(false);
    })();
  }, [navigate]);

  // â”€â”€â”€ UI state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [searchDoctor, setSearchDoctor]       = useState("");
  const [searchAppt, setSearchAppt]           = useState("");
  const [dateFilter, setDateFilter]           = useState("all");
  const [statusFilter, setStatusFilter]       = useState("all");
  const [doctorFilter, setDoctorFilter]       = useState("all");
  const [addDialogOpen, setAddDialogOpen]     = useState(false);
  const [editDialogOpen, setEditDialogOpen]   = useState(false);
  const [viewAppt, setViewAppt]               = useState<Appointment | null>(null);
  const [apptNotes, setApptNotes]             = useState("");
  const [verificationCodeInput, setVerificationCodeInput] = useState("");
  const [editingDoctor, setEditingDoctor]     = useState<Doctor | null>(null);
  const [slotDoctor, setSlotDoctor]           = useState<Doctor | null>(null); // for slot settings
  const [revenueFilter, setRevenueFilter]     = useState<"today"|"7days"|"30days"|"custom">("30days");
  const [customFrom, setCustomFrom]           = useState("");
  const [customTo, setCustomTo]               = useState("");
  const imageRef     = useRef<HTMLInputElement>(null);
  const editImageRef = useRef<HTMLInputElement>(null);
  const logoRef      = useRef<HTMLInputElement>(null);
  const todayDate = new Date().toISOString().split("T")[0];
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [settlementFilter, setSettlementFilter] = useState<"all" | "today" | "yesterday">("all");
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [editPartner, setEditPartner] = useState<any>(null);

  const [newDoctor, setNewDoctor] = useState<Partial<Doctor>>({
    name: "", specialty: "", qualification: "MBBS", experience: 0,
    rating: 4.8, fee: 500, image: "👨‍⚕️", available: true,
    phone: "", languages: "Telugu, English",
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  // ——— Fetch doctors (only this hospital's doctors) ————————————————————————
  const { data: doctors = [], isLoading: loadingDocs } = useQuery<Doctor[]>({
    queryKey: ["hospital-doctors", partnerId],
    enabled: !!partnerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctors")
        .select("*")
        .eq("partner_id", partnerId!)
        .order("name");
      if (error) throw error;
      return (data || []) as Doctor[];
    },
  });

  // ─── Fetch appointments (only this hospital's appointments) ──────────────────
  const { data: appointments = [], isLoading: loadingAppts } = useQuery<Appointment[]>({
    queryKey: ["hospital-appointments", partnerId, partner?.created_at],
    enabled: !!partnerId,
    queryFn: async () => {
      const since = partner?.created_at || new Date(0).toISOString();
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("hospital_partner_id", partnerId!)
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Appointment[];
    },
    refetchInterval: 30000,
  });

  // â”€â”€â”€ Add doctor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const addMutation = useMutation({
    mutationFn: async (doc: Partial<Doctor>) => {
      const { error } = await supabase.from("doctors").insert({
        name:          doc.name,
        specialty:     doc.specialty,
        qualification: doc.qualification || "MBBS",
        experience:    doc.experience || 0,
        rating:        doc.rating || 4.8,
        fee:           doc.fee || 500,
        image:         doc.image || "ðŸ‘¨â€âš•ï¸",
        image_url:     doc.image_url || null,
        available:     doc.available ?? true,
        phone:         doc.phone || "",
        hospital_name: hospitalName,
        languages:     doc.languages || "Telugu, English",
        partner_id:    partnerId,
        hospital_id:   partnerId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospital-doctors", partnerId] });
      qc.invalidateQueries({ queryKey: ["doctors"] }); // refreshes customer DoctorsPage
      setAddDialogOpen(false);
      setNewDoctor({ name: "", specialty: "", qualification: "MBBS", experience: 0, rating: 4.8, fee: 500, image: "", available: true, phone: "", languages: "Telugu, English" });
      toast.success("Doctor added - visible on customer page immediately");
    },
    onError: (e: any) => toast.error("Failed to add doctor: " + e.message),
  });

  // Update doctor
  const updateMutation = useMutation({
    mutationFn: async (doc: Doctor) => {
      const { error } = await supabase.from("doctors").update({
        name:          doc.name,
        specialty:     doc.specialty,
        qualification: doc.qualification,
        experience:    doc.experience,
        rating:        doc.rating,
        fee:           doc.fee,
        image:         doc.image,
        image_url:     doc.image_url,
        available:     doc.available,
        phone:         doc.phone,
        languages:     doc.languages,
        hospital_name: hospitalName,
      }).eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospital-doctors", partnerId] });
      qc.invalidateQueries({ queryKey: ["doctors"] }); // refreshes customer DoctorsPage
      setEditDialogOpen(false);
      setEditingDoctor(null);
      toast.success("Doctor updated - changes live on customer page");
    },
    onError: (e: any) => toast.error("Failed to update: " + e.message),
  });

  // Update slot settings
  const slotMutation = useMutation({
    mutationFn: async ({ id, time_slots, advance_days, holidays }: { id: string; time_slots: string[]; advance_days: number; holidays: string[] }) => {
      const { error } = await supabase.from("doctors").update({ time_slots, advance_days, holidays }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospital-doctors", partnerId] });
      qc.invalidateQueries({ queryKey: ["doctors"] });
      setSlotDoctor(null);
      toast.success("Slot settings saved - patients will see updated schedule");
    },
    onError: (e: any) => toast.error("Failed to save slots: " + e.message),
  });

  // Delete doctor
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("doctors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospital-doctors", partnerId] });
      qc.invalidateQueries({ queryKey: ["doctors"] });
      toast.success("Doctor removed");
    },
    onError: (e: any) => toast.error("Failed to delete: " + e.message),
  });

  // Update appointment status
  const updateApptMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const { error } = await supabase.from("appointments").update({ status, notes }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospital-appointments", partnerId] });
      setViewAppt(null);
      setApptNotes("");
      toast.success("Appointment updated");
    },
    onError: (e: any) => toast.error("Failed: " + e.message),
  });

  // Update Partner Profile
  const updatePartnerMutation = useMutation({
    mutationFn: async (updated: any) => {
      const { error } = await supabase.from("partners").update({
        name: updated.name,
        phone: updated.phone,
        address: updated.address
      }).eq("partner_id", partnerId);
      if (error) throw error;
    },
    onSuccess: () => {
      setPartner((prev: any) => ({ ...prev, ...editPartner }));
      setHospitalName(editPartner.name);
      setProfileDialogOpen(false);
      toast.success("Hospital profile updated!");
    },
    onError: (e: any) => toast.error("Update failed: " + e.message),
  });

  // Image upload
  const uploadImage = async (file: File, isEdit = false) => {
    setUploadingImage(true);
    try {
      const path = `doctors/${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("doctor_profiles").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("doctor_profiles").getPublicUrl(path);
      if (isEdit && editingDoctor) setEditingDoctor({ ...editingDoctor, image_url: publicUrl });
      else setNewDoctor(p => ({ ...p, image_url: publicUrl }));
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error("Upload failed: " + e.message);
    } finally {
      setUploadingImage(false);
    }
  };

  // Filtered appointments
  const filteredAppts = useMemo(() => appointments.filter(a => {
    const q = searchAppt.toLowerCase();
    const matchSearch = (a.patient_name || "").toLowerCase().includes(q) ||
      (a.doctor_name || "").toLowerCase().includes(q) ||
      (a.order_id || "").toLowerCase().includes(q);
    const matchDate   = dateFilter   === "all" || a.appointment_date === dateFilter;
    const matchStatus = statusFilter === "all" || (a.status || "").toLowerCase() === (statusFilter || "").toLowerCase();
    const matchDoctor = doctorFilter === "all" || a.doctor_name === doctorFilter;
    return matchSearch && matchDate && matchStatus && matchDoctor;
  }), [appointments, searchAppt, dateFilter, statusFilter, doctorFilter]);

  // Revenue analytics
  const revenueData = useMemo(() => {
    const billable = appointments.filter(a => a.status === "completed");
    const inRange = (d: string) => {
      const dt = new Date(d);
      if (revenueFilter === "today")  return d === todayDate;
      if (revenueFilter === "7days")  { const s = new Date(todayDate); s.setDate(s.getDate()-6);  return dt >= s; }
      if (revenueFilter === "30days") { const s = new Date(todayDate); s.setDate(s.getDate()-29); return dt >= s; }
      if (revenueFilter === "custom" && customFrom && customTo)
        return dt >= new Date(customFrom) && dt <= new Date(customTo);
      return true;
    };
    const ranged = billable.filter(a => inRange(a.appointment_date));
    // Only count the partner's consultation fee - NOT the platform fee / priority surcharge added by super admin
    const total  = ranged.reduce((s, a) => s + (a.consultation_fee || 0), 0);
    const byDoc: Record<string, number> = {};
    ranged.forEach(a => { byDoc[a.doctor_name] = (byDoc[a.doctor_name] || 0) + (a.consultation_fee || 0); });

    // Settlement calc (based on consultation fee only)
    const commRate = partner?.commission_rate || 10;
    const commType = partner?.commission_type || "percentage";
    const platformCommission = commType === "percentage" 
      ? (total * commRate) / 100 
      : ranged.length * commRate;
    
    return { total, count: ranged.length, byDoc, platformCommission, netEarnings: total - platformCommission };
  }, [appointments, revenueFilter, customFrom, customTo, todayDate, partner]);

  // Stats
  const stats = [
    { label: "Total Doctors",  value: doctors.length,                                          color: "text-blue-600",    bg: "bg-blue-50"   },
    { label: "Today's OP",     value: appointments.filter(a => a.appointment_date === todayDate).length, color:"text-violet-600", bg:"bg-violet-50"},
    { label: "Confirmed",      value: appointments.filter(a => a.status === "confirmed").length, color: "text-emerald-600", bg: "bg-emerald-50"},
    { label: "Completed",      value: appointments.filter(a => a.status === "completed").length, color: "text-green-600",   bg: "bg-green-50"  },
    // Only shows the hospital's consultation fee - platform fees excluded
    { label: "Revenue (30d)",  value: `₹${appointments.filter(a=>a.status==="completed").reduce((s,a)=>s+(a.consultation_fee||0),0).toLocaleString("en-IN")}`, color:"text-amber-600", bg:"bg-amber-50"},
  ];

  const exportCSV = () => {
    const rows = [
      ["Order ID", "Patient", "Phone", "Doctor", "Date", "Time", "Status", "Fee"],
      ...filteredAppts.map(a => [a.order_id||a.id, a.patient_name, a.patient_phone, a.doctor_name, a.appointment_date, a.appointment_time, a.status, a.fee||0]),
    ];
    const blob = new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "appointments.csv"; a.click();
    toast.success("Exported!");
  };

  const fmt = (d: string) => d ? new Date(d).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" }) : "-";

  // --- Loading -------------------------------------------------------------
  if (isVerifying) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-900">
      <Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-4" />
      <p className="text-white font-black text-sm uppercase tracking-widest">Hospital Portal</p>
      <p className="text-slate-500 text-[10px] mt-2 tracking-[0.2em]">Verifying Secure Session...</p>
    </div>
  );

  const uploadLogo = async (file: File) => {
    try {
      setUploadingLogo(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `logos/${partnerId}_logo.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('doctor_profiles')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('doctor_profiles')
        .getPublicUrl(fileName);

      const bustedUrl = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("partners")
        .update({ logo_url: bustedUrl })
        .eq("partner_id", partnerId);

      if (updateError) throw updateError;
      
      setPartner((prev: any) => ({ ...prev, logo_url: bustedUrl }));
      toast.success("Hospital logo updated!");
    } catch (err: any) {
      console.error(err);
      toast.error("Logo upload failed: " + err.message);
    } finally {
      setUploadingLogo(false);
    }
  };


  return (
    <div className="min-h-screen" style={{ background: "#F0F4F8" }}>

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl overflow-hidden shadow-md">
            <img src={partner?.logo_url || "/logo.png"} alt="Logo" className="h-full w-full object-cover" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 truncate max-w-[240px] uppercase tracking-tight">{hospitalName}</h1>
            <p className="text-xs text-slate-400 font-medium">Hospital Dashboard · Partner ID: {partnerId}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-red-500 gap-2"
          onClick={async () => { await revokePartnerSession(); navigate("/admin/login/hospital"); toast.success("Logged out"); }}>
          <LogOut className="h-4 w-4" /> Logout
        </Button>
      </header>

      <div className="p-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {stats.map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-4 border border-white shadow-sm flex items-center gap-3 hover:shadow-md transition-shadow">
              <div className={`h-9 w-9 ${s.bg} rounded-xl flex items-center justify-center shrink-0`}>
                <Activity className={`h-4 w-4 ${s.color}`} />
              </div>
              <div>
                <p className="text-lg font-extrabold text-slate-800 leading-none">{s.value}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-white shadow-sm overflow-hidden">
          <Tabs defaultValue="doctors">
            <div className="border-b border-slate-100 px-2 pt-2">
              <TabsList className="bg-transparent gap-1 h-auto p-0">
                {["doctors","appointments","revenue","payouts", "settings"].map(tab => (
                  <TabsTrigger key={tab} value={tab}
                    className="px-5 py-2.5 text-sm font-semibold capitalize rounded-t-xl data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:border data-[state=active]:border-b-white data-[state=active]:border-slate-200 text-slate-400">
                    {tab === "doctors" ? "Doctors" : tab === "appointments" ? "Appointments" : tab === "revenue" ? "Revenue" : tab === "settings" ? "Hospital Profile" : "Settlements & Payouts"}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* DOCTORS TAB */}
            <TabsContent value="doctors" className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input placeholder="Search doctors..." value={searchDoctor} onChange={e => setSearchDoctor(e.target.value)} className="pl-9" />
                </div>
                <Button className="bg-blue-600 hover:bg-blue-700 gap-2" onClick={() => setAddDialogOpen(true)}>
                  <Plus className="h-4 w-4" /> Add Doctor
                </Button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/70">
                      {["Doctor", "Specialty", "Exp", "Fee", "Rating", "Status", "Actions"].map(h => (
                        <TableHead key={h} className="text-[11px] font-bold text-slate-400 uppercase">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingDocs ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" /></TableCell></TableRow>
                    ) : doctors.filter(d => d.name.toLowerCase().includes(searchDoctor.toLowerCase()) || d.specialty.toLowerCase().includes(searchDoctor.toLowerCase())).map(doc => (
                      <TableRow key={doc.id} className="hover:bg-slate-50/60">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {doc.image_url
                              ? <img src={doc.image_url} alt={doc.name} className="h-9 w-9 rounded-xl object-cover border border-slate-200" />
                              : <div className="h-9 w-9 rounded-xl bg-blue-100 flex items-center justify-center text-lg">{doc.image || ""}</div>
                            }
                            <div>
                              <p className="font-semibold text-slate-800 text-sm">{doc.name}</p>
                              <p className="text-[10px] text-slate-400">{doc.qualification}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">{doc.specialty}</TableCell>
                        <TableCell className="text-sm text-slate-600">{doc.experience} yrs</TableCell>
                        <TableCell className="font-bold text-slate-800">₹{doc.fee}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-sm font-bold text-amber-500">
                            <Star className="h-3 w-3 fill-amber-400" /> {doc.rating}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Switch checked={doc.available} onCheckedChange={async (val) => {
                            await supabase.from("doctors").update({ available: val }).eq("id", doc.id);
                            qc.invalidateQueries({ queryKey: ["hospital-doctors", partnerId] });
                            qc.invalidateQueries({ queryKey: ["doctors"] });
                          }} />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" title="Slot Settings"
                              onClick={() => setSlotDoctor({ ...doc, time_slots: doc.time_slots ?? [], advance_days: doc.advance_days ?? 7 })}>
                              <Clock className="h-4 w-4 text-violet-500" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => { setEditingDoctor({ ...doc }); setEditDialogOpen(true); }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600"
                              onClick={() => { if (confirm(`Remove ${doc.name}?`)) deleteMutation.mutate(doc.id); }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!loadingDocs && doctors.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center py-12 text-slate-400">No doctors added yet. Click "Add Doctor" to start.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* APPOINTMENTS TAB */}
            <TabsContent value="appointments" className="p-6 space-y-4">
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input placeholder="Search..." value={searchAppt} onChange={e => setSearchAppt(e.target.value)} className="pl-9 w-52" />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      {["all","pending","confirmed","completed","cancelled","no_show"].map(s => (
                        <SelectItem key={s} value={s}>{s === "all" ? "All Status" : s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={doctorFilter} onValueChange={setDoctorFilter}>
                    <SelectTrigger className="w-44"><SelectValue placeholder="Doctor" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Doctors</SelectItem>
                      {[...new Set(appointments.map(a => a.doctor_name))].filter(Boolean).map(n => (
                        <SelectItem key={n} value={n}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-1" /> Export</Button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/70">
                      {["Order ID","Patient","Doctor","Date & Time","Status","Fee","Action"].map(h => (
                        <TableHead key={h} className="text-[11px] font-bold text-slate-400 uppercase">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingAppts ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" /></TableCell></TableRow>
                    ) : filteredAppts.map(appt => (
                      <TableRow key={appt.id} className="hover:bg-slate-50/60">
                        <TableCell className="font-mono text-xs font-bold text-blue-700">
                          {appt.order_id || appt.id.slice(0,8).toUpperCase()}
                          {appt.is_priority && <span className="ml-1 text-orange-500 font-black">!</span>}
                        </TableCell>
                        <TableCell>
                          <p className="font-semibold text-slate-800 text-sm">{appt.patient_name}</p>
                          <p className="text-[11px] text-slate-400">{appt.patient_phone}</p>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">{appt.doctor_name}</TableCell>
                        <TableCell>
                          <p className="text-xs font-semibold text-slate-800">{fmt(appt.appointment_date)}</p>
                          <p className="text-[11px] text-slate-400">{appt.appointment_time}</p>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusColor[(appt.status || "pending").toLowerCase()] || "bg-slate-100 text-slate-500 border-slate-200"}`}>
                            {appt.status || "Pending"}
                          </span>
                        </TableCell>
                        {/* Show only consultation_fee - platform fee is hidden from hospital partner */}
                        <TableCell className="font-bold text-slate-800">₹{appt.consultation_fee || "-"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => { setViewAppt(appt); setApptNotes(appt.notes || ""); setVerificationCodeInput(""); }}>
                            <Eye className="h-4 w-4 mr-1" /> View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!loadingAppts && filteredAppts.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center py-12 text-slate-400">No appointments found</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* REVENUE TAB */}
            <TabsContent value="revenue" className="p-6 space-y-6">
              <div className="flex flex-wrap gap-2">
                {(["today","7days","30days","custom"] as const).map(f => (
                  <button key={f} onClick={() => setRevenueFilter(f)}
                    className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${revenueFilter===f ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100" : "bg-white text-slate-500 border-slate-200"}`}>
                    {f==="today"?"Today":f==="7days"?"Last 7 Days":f==="30days"?"Last 30 Days":"Custom"}
                  </button>
                ))}
                {revenueFilter === "custom" && (
                  <div className="flex gap-2 items-center">
                    <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-9 text-xs w-36" />
                    <span className="text-slate-400 text-xs">to</span>
                    <Input type="date" value={customTo}   onChange={e => setCustomTo(e.target.value)}   className="h-9 text-xs w-36" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-5 text-white shadow-lg">
                  <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">Total Revenue</p>
                  <p className="text-3xl font-black mt-1">₹{revenueData.total.toLocaleString("en-IN")}</p>
                  <p className="text-xs opacity-70 mt-2 flex items-center gap-1"><ArrowUpRight className="h-3 w-3" /> from {revenueData.count} appointments</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Avg per Appointment</p>
                  <p className="text-2xl font-black text-slate-800 mt-1">
                    ₹{revenueData.count > 0 ? Math.round(revenueData.total / revenueData.count).toLocaleString("en-IN") : 0}
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Doctors</p>
                  <p className="text-2xl font-black text-slate-800 mt-1">{doctors.length}</p>
                  <p className="text-xs text-slate-400 mt-2">{doctors.filter(d=>d.available).length} currently available</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 mb-4"><BarChart3 className="h-5 w-5 text-blue-600" /><h3 className="font-bold text-slate-800">Revenue by Doctor</h3></div>
                <div className="space-y-3">
                  {Object.entries(revenueData.byDoc).map(([doc, amount]) => {
                    const max = Math.max(...Object.values(revenueData.byDoc), 1);
                    return (
                      <div key={doc} className="flex items-center gap-3">
                        <p className="text-sm font-medium text-slate-600 w-44 truncate">{doc}</p>
                        <div className="flex-1 bg-slate-100 rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(amount/max)*100}%` }} />
                        </div>
                        <p className="text-sm font-bold text-slate-800 w-20 text-right">₹{amount.toLocaleString("en-IN")}</p>
                      </div>
                    );
                  })}
                  {Object.keys(revenueData.byDoc).length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-4">No completed appointments in this period</p>
                  )}
                </div>
              </div>
                     <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                    <h3 className="font-black text-slate-900 flex items-center gap-2 mb-4">
                      <TrendingUp className="h-5 w-5 text-emerald-500" /> Payout Policy
                    </h3>
                    <ul className="space-y-3">
                      {[
                        { l: "Payout Cycle", v: partner?.settlement_cycle ? partner.settlement_cycle.charAt(0).toUpperCase() + partner.settlement_cycle.slice(1) : "Monthly" },
                        { l: "Commission", v: `${partner?.commission_rate || 10}% on Consultation` },
                        { l: "Payment Mode", v: "Direct Bank Transfer" },
                        { l: "Next Settlement", v: (() => {
                          const now = new Date();
                          const cycle = partner?.settlement_cycle || 'monthly';
                          if (cycle === 'today') return "By EOD today";
                          if (cycle === 'daily') return "Tomorrow Morning";
                          if (cycle === 'weekly') {
                            const d = new Date();
                            d.setDate(d.getDate() + (7 - d.getDay()) % 7 || 7);
                            return d.toLocaleDateString();
                          }
                          return "1st of " + new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleString('en-IN', { month: 'short' });
                        })() }
                      ].map(item => (
                        <li key={item.l} className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-bold uppercase tracking-wider">{item.l}</span>
                          <span className="font-black text-slate-700">{item.v}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
            </TabsContent>

            {/* PAYOUTS TAB */}
            <TabsContent value="payouts" className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Statement Summary */}
                <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                    <IndianRupee className="h-32 w-32" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-2">Hospital Net Settlement</p>
                    <h2 className="text-5xl font-black mb-6">₹{(() => {
                      const billable = appointments.filter(a => {
                        if (a.status !== "completed") return false;
                        if (settlementFilter === "today") return new Date(a.appointment_date).toDateString() === new Date().toDateString();
                        if (settlementFilter === "yesterday") {
                          const y = new Date(); y.setDate(y.getDate() - 1);
                          return new Date(a.appointment_date).toDateString() === y.toDateString();
                        }
                        return true;
                      });
                      // Use consultation_fee only - excludes platform fee added by super admin
                      const total = billable.reduce((s, a) => s + (a.consultation_fee || 0), 0);
                      const comm = partner?.commission_type === "percentage" ? (total * (partner?.commission_rate || 10)) / 100 : (billable.length * (partner?.commission_rate || 0));
                      return (total - comm).toLocaleString("en-IN");
                    })()}</h2>
                  </div>
                  <div className="space-y-4 pt-6 border-t border-white/10">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Commission Model</span>
                      <span className="font-bold">{partner?.commission_type === "fixed" ? `Fixed ₹${partner?.commission_rate}` : `${partner?.commission_rate}% Percentage`}</span>
                    </div>
                  </div>
                </div>

                {/* Info Card */}
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                    <h3 className="font-black text-slate-900 flex items-center gap-2 mb-4">
                      <TrendingUp className="h-5 w-5 text-emerald-500" /> Settlement Policy
                    </h3>
                    <ul className="space-y-3">
                      {[
                        { l: "Payout Cycle", v: partner?.settlement_cycle ? partner.settlement_cycle.charAt(0).toUpperCase() + partner.settlement_cycle.slice(1) : "Monthly" },
                        { l: "Platform Rate", v: partner?.commission_type === "fixed" ? `₹${partner?.commission_rate} per appt` : `${partner?.commission_rate}% of billing` },
                        { l: "Payment Mode", v: "Direct Bank Transfer" },
                        { l: "Next Settlement", v: (() => {
                          const cycle = partner?.settlement_cycle || 'monthly';
                          const d = new Date();
                          if (cycle === 'today') return "By EOD Today";
                          if (cycle === 'daily') return "Tomorrow Morning";
                          if (cycle === 'weekly') {
                            d.setDate(d.getDate() + (7 - d.getDay()) % 7 || 7);
                            return d.toLocaleDateString();
                          }
                          return "1st of " + new Date(d.getFullYear(), d.getMonth() + 1, 1).toLocaleString('en-IN', { month: 'short' });
                        })() }
                      ].map(item => (
                        <li key={item.l} className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-bold uppercase tracking-wider">{item.l}</span>
                          <span className="font-black text-slate-700">{item.v}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex gap-3">
                    <Activity className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-blue-700 leading-relaxed font-medium">
                      Live data synchronized with Super Admin configuration. Settlements are based on <strong>completed</strong> appointments.
                    </p>
                  </div>
                </div>
              </div>

              {/* Commission Table */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <h3 className="font-black text-slate-900 text-sm italic underline decoration-blue-500 underline-offset-4">Settlement Breakdown</h3>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      {(["all", "today", "yesterday"] as const).map(f => (
                        <button key={f} onClick={() => setSettlementFilter(f)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${settlementFilter === f ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-[10px] font-black uppercase">Appt ID</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-center">Consult. Fee</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-center text-red-500">Commission</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-right text-emerald-600">Your Net</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const filtered = appointments.filter(a => {
                          if (a.status !== "completed") return false;
                          if (settlementFilter === "today") return new Date(a.appointment_date).toDateString() === new Date().toDateString();
                          if (settlementFilter === "yesterday") {
                            const y = new Date(); y.setDate(y.getDate() - 1);
                            return new Date(a.appointment_date).toDateString() === y.toDateString();
                          }
                          return true;
                        });
                        if (filtered.length === 0) return (
                          <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-400 text-xs font-bold">
                            No completed transactions for {settlementFilter === "all" ? "any period" : `"${settlementFilter}"`}
                          </TableCell></TableRow>
                        );
                        return filtered.slice(0, 15).map(a => {
                          // Show only consultation_fee to partner - platform_fee is Aaroksha's revenue
                          const fee = a.consultation_fee || 0;
                          const cAmt = partner?.commission_type === "percentage"
                            ? (fee * (partner?.commission_rate || 10)) / 100
                            : (partner?.commission_rate || 0);
                          return (
                            <TableRow key={a.id}>
                              <TableCell className="font-mono text-[10px] font-bold text-slate-400">{a.order_id || a.id.slice(0,8).toUpperCase()}</TableCell>
                              <TableCell className="text-center font-bold text-slate-700 text-xs">₹{fee}</TableCell>
                              <TableCell className="text-center font-bold text-red-500 text-xs">₹{cAmt.toFixed(2)}</TableCell>
                              <TableCell className="text-right font-black text-slate-800 text-xs">₹{(fee - cAmt).toFixed(2)}</TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            {/* SETTINGS TAB */}
            <TabsContent value="settings" className="p-6 space-y-6">
              <div className="max-w-3xl">
                <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-12 opacity-[0.03]">
                    <Building2 className="h-48 w-48 rotate-12" />
                  </div>
                  
                  <div className="flex flex-col md:flex-row gap-10 items-center md:items-start text-center md:text-left">
                    <div className="relative group cursor-pointer" onClick={() => logoRef.current?.click()}>
                      <div className="h-32 w-32 rounded-3xl bg-slate-50 border-4 border-white shadow-2xl overflow-hidden flex items-center justify-center transition-all hover:scale-105 group-active:scale-95 hover:border-blue-200">
                        {partner?.logo_url ? (
                          <img src={partner.logo_url} alt="Logo" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-slate-300 group-hover:text-blue-400 transition-colors">
                            <Camera className="h-8 w-8" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Add Logo</span>
                          </div>
                        )}
                        {uploadingLogo && (
                          <div className="absolute inset-0 bg-white/80 flex items-center justify-center backdrop-blur-sm">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); logoRef.current?.click(); }}
                        className="absolute -bottom-2 -right-2 h-10 w-10 bg-blue-600 rounded-2xl shadow-xl shadow-blue-200 border-4 border-white flex items-center justify-center text-white hover:bg-blue-700 transition-all z-10">
                        <Camera className="h-4 w-4" />
                      </button>
                      <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
                    </div>

                    <div className="flex-1 space-y-6 w-full">
                      <div className="space-y-1">
                        <h2 className="text-2xl font-black text-slate-900">{partner?.name}</h2>
                        <div className="flex flex-wrap justify-center md:justify-start gap-2">
                          <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">Hospital Partner</span>
                          <span className="px-3 py-1 bg-slate-50 text-slate-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-100">ID: {partner?.partner_id}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                          { l: "Login Email",      v: partner?.email || "Not set" },
                          { l: "Contact Phone",    v: partner?.phone || "Not set" },
                          { l: "Address",          v: partner?.address || "Not set" },
                          { l: "Settlement Cycle", v: partner?.settlement_cycle ? partner.settlement_cycle.charAt(0).toUpperCase() + partner.settlement_cycle.slice(1) : "Monthly" },
                        ].map(f => (
                          <div key={f.l} className="bg-slate-50/50 rounded-2xl p-4 border border-slate-50">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{f.l}</p>
                            <p className="text-sm font-bold text-slate-800 truncate">{f.v}</p>
                          </div>
                        ))}
                      </div>

                      <div className="pt-4 flex justify-center md:justify-start">
                        <Button 
                          onClick={() => { setEditPartner({ ...partner }); setProfileDialogOpen(true); }}
                          className="bg-blue-600 hover:bg-blue-700 font-bold px-8 rounded-xl shadow-lg shadow-blue-100"
                        >
                          <Edit className="h-4 w-4 mr-2" /> Edit Profile
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ADD DOCTOR DIALOG */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-blue-600" /> Add New Doctor</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Photo upload */}
            <div className="flex flex-col items-center gap-2">
              <div className="h-20 w-20 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-500 transition"
                onClick={() => imageRef.current?.click()}>
                {newDoctor.image_url
                  ? <img src={newDoctor.image_url} alt="Doctor" className="h-full w-full object-cover" />
                  : uploadingImage ? <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  : <Camera className="h-6 w-6 text-blue-400" />}
              </div>
              <p className="text-xs text-slate-400">Click to upload photo (optional)</p>
              <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0])} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Full Name *</Label>
                <Input placeholder="Dr. Firstname Lastname" value={newDoctor.name || ""} onChange={e => setNewDoctor(p => ({...p, name: e.target.value}))} />
              </div>
              <div className="space-y-1">
                <Label>Specialty *</Label>
                <Select value={newDoctor.specialty || ""} onValueChange={v => setNewDoctor(p => ({...p, specialty: v}))}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{SPECIALTIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Qualification</Label>
                <Input placeholder="MBBS, MD" value={newDoctor.qualification || ""} onChange={e => setNewDoctor(p => ({...p, qualification: e.target.value}))} />
              </div>
              <div className="space-y-1">
                <Label>Experience (years)</Label>
                <Input type="number" min={0} value={newDoctor.experience || 0} onChange={e => setNewDoctor(p => ({...p, experience: +e.target.value}))} />
              </div>
              <div className="space-y-1">
                <Label>Consultation Fee (₹)</Label>
                <Input type="number" min={0} value={newDoctor.fee || 0} onChange={e => setNewDoctor(p => ({...p, fee: +e.target.value}))} />
              </div>
              <div className="space-y-1">
                <Label>Rating</Label>
                <Input type="number" min={1} max={5} step={0.1} value={newDoctor.rating || 4.8} onChange={e => setNewDoctor(p => ({...p, rating: +e.target.value}))} />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input placeholder="+91 XXXXX XXXXX" value={newDoctor.phone || ""} onChange={e => setNewDoctor(p => ({...p, phone: e.target.value}))} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Languages Spoken</Label>
                <Input placeholder="Telugu, English" value={newDoctor.languages || ""} onChange={e => setNewDoctor(p => ({...p, languages: e.target.value}))} />
              </div>
              <div className="col-span-2 flex items-center gap-3">
                <Switch checked={newDoctor.available ?? true} onCheckedChange={v => setNewDoctor(p => ({...p, available: v}))} />
                <Label>Available for appointments</Label>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={addMutation.isPending || !newDoctor.name || !newDoctor.specialty}
                onClick={() => addMutation.mutate(newDoctor)}>
                {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Add Doctor
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* EDIT DOCTOR DIALOG */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Edit className="h-5 w-5 text-blue-600" /> Edit Doctor</DialogTitle></DialogHeader>
          {editingDoctor && (
            <div className="space-y-4 mt-2">
              <div className="flex flex-col items-center gap-2">
                <div className="h-20 w-20 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-500 transition"
                  onClick={() => editImageRef.current?.click()}>
                  {editingDoctor.image_url
                    ? <img src={editingDoctor.image_url} alt="Doctor" className="h-full w-full object-cover" />
                    : uploadingImage ? <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                    : <Camera className="h-6 w-6 text-blue-400" />}
                </div>
                <p className="text-xs text-slate-400">Click to update photo</p>
                <input ref={editImageRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0], true)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label>Full Name *</Label>
                  <Input value={editingDoctor.name} onChange={e => setEditingDoctor({...editingDoctor, name: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <Label>Specialty</Label>
                  <Select value={editingDoctor.specialty} onValueChange={v => setEditingDoctor({...editingDoctor, specialty: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SPECIALTIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Qualification</Label>
                  <Input value={editingDoctor.qualification} onChange={e => setEditingDoctor({...editingDoctor, qualification: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <Label>Experience (yrs)</Label>
                  <Input type="number" value={editingDoctor.experience} onChange={e => setEditingDoctor({...editingDoctor, experience: +e.target.value})} />
                </div>
                <div className="space-y-1">
                  <Label>Fee (₹)</Label>
                  <Input type="number" value={editingDoctor.fee} onChange={e => setEditingDoctor({...editingDoctor, fee: +e.target.value})} />
                </div>
                <div className="space-y-1">
                  <Label>Rating</Label>
                  <Input type="number" step={0.1} min={1} max={5} value={editingDoctor.rating} onChange={e => setEditingDoctor({...editingDoctor, rating: +e.target.value})} />
                </div>
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input value={editingDoctor.phone} onChange={e => setEditingDoctor({...editingDoctor, phone: e.target.value})} />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>Languages</Label>
                  <Input value={editingDoctor.languages} onChange={e => setEditingDoctor({...editingDoctor, languages: e.target.value})} />
                </div>
                <div className="col-span-2 flex items-center gap-3">
                  <Switch checked={editingDoctor.available} onCheckedChange={v => setEditingDoctor({...editingDoctor, available: v})} />
                  <Label>Available for appointments</Label>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate(editingDoctor)}>
                  {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Save Changes
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* VIEW APPOINTMENT DIALOG */}
      <Dialog open={!!viewAppt} onOpenChange={() => setViewAppt(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              {viewAppt?.order_id || viewAppt?.id?.slice(0,8).toUpperCase()}
              {viewAppt && <span className={`ml-2 inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColor[viewAppt.status]||""}`}>{viewAppt.status}</span>}
            </DialogTitle>
          </DialogHeader>
          {viewAppt && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div><p className="text-[10px] text-slate-400 font-bold uppercase">Patient</p><p className="font-semibold text-sm">{viewAppt.patient_name}</p></div>
                <div><p className="text-[10px] text-slate-400 font-bold uppercase">Phone</p><p className="text-sm">{viewAppt.patient_phone}</p></div>
                <div><p className="text-[10px] text-slate-400 font-bold uppercase">Doctor</p><p className="text-sm font-semibold">{viewAppt.doctor_name}</p></div>
                <div><p className="text-[10px] text-slate-400 font-bold uppercase">Date & Time</p><p className="text-sm">{fmt(viewAppt.appointment_date)} · {viewAppt.appointment_time}</p></div>
                <div><p className="text-[10px] text-slate-400 font-bold uppercase">Age / Gender</p><p className="text-sm">{viewAppt.patient_age} · {viewAppt.patient_gender}</p></div>
                <div><p className="text-[10px] text-slate-400 font-bold uppercase">Town / Village</p><p className="text-sm font-semibold text-blue-700">{viewAppt.patient_town || "-"}</p></div>
                {/* Show only the consultation fee - the platform fee is not the hospital's concern */}
                <div className="col-span-2"><p className="text-[10px] text-slate-400 font-bold uppercase">Consultation Fee</p><p className="text-sm font-bold">₹{viewAppt.consultation_fee || "-"}</p></div>
              </div>
              
              {viewAppt.notes && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 mb-2">
                  <p className="text-[10px] text-blue-500 font-black uppercase tracking-widest mb-1">Patient Symptoms / Disease</p>
                  <p className="text-sm text-blue-900 font-medium">{viewAppt.notes}</p>
                </div>
              )}

              <div className="space-y-1">
                <Label>Doctor's Internal Notes</Label>
                <Textarea value={apptNotes} onChange={e => setApptNotes(e.target.value)} rows={2} placeholder="Add follow-up notes..." />
              </div>

              {viewAppt.status === "confirmed" && (
                <div className="pt-2 pb-2">
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                    Verify Patient Code
                  </Label>
                  <Input 
                    placeholder="Enter 6-digit code" 
                    value={verificationCodeInput}
                    onChange={(e) => setVerificationCodeInput(e.target.value.toUpperCase())}
                    className="h-11 border-2 border-emerald-200 bg-emerald-50 text-center font-black tracking-widest uppercase text-emerald-800"
                    maxLength={6}
                  />
                </div>
              )}

              {viewAppt.status !== "completed" && viewAppt.status !== "cancelled" && (
                <div className="flex gap-2">
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={updateApptMutation.isPending}
                    onClick={() => {
                      if (viewAppt.status === "confirmed" && verificationCodeInput !== (viewAppt.verification_code || "")) {
                        toast.error("Invalid verification code. Please ask the patient for the correct code.");
                        return;
                      }
                      updateApptMutation.mutate({ id: viewAppt.id, status: "completed", notes: apptNotes });
                    }}>
                    <CheckCircle className="h-4 w-4 mr-2" /> Mark Completed
                  </Button>
                  <Button variant="destructive" className="flex-1" disabled={updateApptMutation.isPending}
                    onClick={() => updateApptMutation.mutate({ id: viewAppt.id, status: "cancelled", notes: apptNotes })}>
                    <XCircle className="h-4 w-4 mr-2" /> Cancel
                  </Button>
                </div>
              )}
              {viewAppt.status === "pending" && (
                <Button className="w-full bg-blue-600 hover:bg-blue-700" disabled={updateApptMutation.isPending}
                  onClick={() => updateApptMutation.mutate({ id: viewAppt.id, status: "confirmed", notes: apptNotes })}>
                  <UserCheck className="h-4 w-4 mr-2" /> Confirm Appointment
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>


      {/* EDIT PROFILE DIALOG */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" /> Edit Hospital Profile
            </DialogTitle>
          </DialogHeader>
          {editPartner && (
            <div className="space-y-4 mt-2">
              <div className="space-y-1">
                <Label>Hospital Name</Label>
                <Input value={editPartner.name || ""} onChange={e => setEditPartner({ ...editPartner, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Contact Phone</Label>
                <Input value={editPartner.phone || ""} onChange={e => setEditPartner({ ...editPartner, phone: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Address</Label>
                <Input value={editPartner.address || ""} onChange={e => setEditPartner({ ...editPartner, address: e.target.value })} />
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700" 
                  disabled={updatePartnerMutation.isPending} 
                  onClick={() => updatePartnerMutation.mutate(editPartner)}>
                  {updatePartnerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Save Profile
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setProfileDialogOpen(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* SLOT SETTINGS DIALOG */}
      <Dialog open={!!slotDoctor} onOpenChange={() => setSlotDoctor(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-violet-600" />
              Slot Settings - {slotDoctor?.name}
            </DialogTitle>
          </DialogHeader>
          {slotDoctor && (
            <div className="space-y-5 mt-2">

              <div className="p-4 rounded-xl bg-violet-50 border border-violet-100">
                <Label className="text-sm font-bold text-violet-800 mb-2 block">
                  Advance Booking Window
                </Label>
                <p className="text-xs text-violet-500 mb-3">
                  How many days ahead patients can book this doctor
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1} max={30}
                    value={slotDoctor.advance_days ?? 7}
                    onChange={e => setSlotDoctor({ ...slotDoctor, advance_days: +e.target.value })}
                    className="flex-1 accent-violet-600"
                  />
                  <span className="w-20 text-center bg-white border border-violet-200 rounded-xl py-1.5 text-sm font-black text-violet-700">
                    {slotDoctor.advance_days ?? 7} days
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-violet-400 mt-1 font-bold">
                  <span>1 day (same-day booking)</span>
                  <span>30 days (1 month ahead)</span>
                </div>
              </div>

              <div>
                <Label className="text-sm font-bold text-slate-800 mb-2 block">
                  Available Time Slots
                </Label>
                <p className="text-xs text-slate-400 mb-3">
                  Select which time slots patients can see when booking
                  ({slotDoctor.time_slots?.length ?? 0} selected)
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {ALL_TIME_SLOTS.map(slot => {
                    const active = (slotDoctor.time_slots ?? []).includes(slot);
                    return (
                      <button
                        key={slot}
                        onClick={() => {
                          const current = slotDoctor.time_slots ?? [];
                          const updated = active
                            ? current.filter(s => s !== slot)
                            : [...current, slot].sort();
                          setSlotDoctor({ ...slotDoctor, time_slots: updated });
                        }}
                        className={`py-2 px-1 rounded-xl text-[11px] font-bold border-2 transition-all ${
                          active
                            ? "bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-200"
                            : "bg-white text-slate-400 border-slate-200 hover:border-violet-300"
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>

                {/* Select all / Clear shortcuts */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setSlotDoctor({ ...slotDoctor, time_slots: [...ALL_TIME_SLOTS] })}
                    className="text-[11px] font-bold text-violet-600 hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={() => setSlotDoctor({ ...slotDoctor, time_slots: [] })}
                    className="text-[11px] font-bold text-slate-400 hover:underline"
                  >
                  Clear All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={() => setSlotDoctor({ ...slotDoctor, time_slots: ["09:00 AM","09:30 AM","10:00 AM","10:30 AM","11:00 AM","11:30 AM","02:00 PM","02:30 PM","03:00 PM","04:00 PM"] })}
                    className="text-[11px] font-bold text-blue-500 hover:underline"
                  >
                    Morning + Afternoon
                  </button>
                </div>
              </div>

              {/* --- Holiday Calendar --- */}
              <div className="p-4 rounded-xl bg-red-50 border border-red-100">
                <Label className="text-sm font-bold text-red-800 mb-1 block">Holiday / Leave Dates</Label>
                <p className="text-xs text-red-400 mb-3">Mark dates when this doctor is <strong>not available</strong>. Patients won't see slots on these days.</p>

                {/* Date picker to add a holiday */}
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    className="flex-1 h-9 rounded-xl border border-red-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-red-400"
                    onChange={e => {
                      const d = e.target.value;
                      if (!d) return;
                      const current = slotDoctor.holidays ?? [];
                      if (!current.includes(d)) {
                        setSlotDoctor({ ...slotDoctor, holidays: [...current, d].sort() });
                      }
                      e.target.value = "";
                    }}
                  />
                  <span className="text-xs text-red-400 font-bold whitespace-nowrap">Pick a date â†’</span>
                </div>

                {/* List of added holidays */}
                {(slotDoctor.holidays ?? []).length === 0 ? (
                  <p className="text-[11px] text-red-300 font-bold text-center py-2">No holidays set - doctor is available every day</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(slotDoctor.holidays ?? []).map(d => (
                      <span
                        key={d}
                        className="inline-flex items-center gap-1.5 bg-red-100 text-red-700 border border-red-200 rounded-xl px-3 py-1 text-[11px] font-black"
                      >
                        {new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        <button
                          onClick={() => setSlotDoctor({ ...slotDoctor, holidays: (slotDoctor.holidays ?? []).filter(x => x !== d) })}
                          className="text-red-400 hover:text-red-700 font-black text-base leading-none"
                        >x</button>
                      </span>
                    ))}
                    <button
                      onClick={() => setSlotDoctor({ ...slotDoctor, holidays: [] })}
                      className="text-[11px] text-red-400 font-bold hover:underline"
                    >Clear all</button>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <Button
                  className="flex-1 bg-violet-600 hover:bg-violet-700"
                  disabled={slotMutation.isPending || (slotDoctor.time_slots?.length ?? 0) === 0}
                  onClick={() => slotMutation.mutate({
                    id: slotDoctor.id,
                    time_slots: slotDoctor.time_slots ?? [],
                    advance_days: slotDoctor.advance_days ?? 7,
                    holidays: slotDoctor.holidays ?? [],
                  })}
                >
                  {slotMutation.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    : <CheckCircle className="h-4 w-4 mr-2" />}
                  Save Slot Settings
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setSlotDoctor(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HospitalDashboard;
