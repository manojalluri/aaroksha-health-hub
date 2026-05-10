import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Pill, Search, CheckCircle, XCircle, Eye, Package,
  Plus, Trash2, Truck, Phone, MapPin, BarChart3,
  FileText, ImageIcon, IndianRupee, MessageCircle, LogOut, ArrowUpRight, Download,
  Loader2, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { verifyPartnerSession, clearAdminSession, revokePartnerSession, getPartnerIdFromSession } from "@/lib/adminAuth";

// --- Types --------------------------------------------------------------
interface MedicineItem {
  name: string;
  quantity?: number;
  qty?: number;
  price: number;
  dosage?: string;
  available: boolean;
}

interface PrescriptionOrder {
  id: string;
  order_id?: string;
  patient_name: string;
  patient_phone: string;
  delivery_address: string;
  created_at: string;
  prescriptions?: string[];
  status: string;
  medicines: MedicineItem[];
  sub_total?: number;
  platform_fee?: number;
  delivery_fee?: number;
  grand_total?: number;
  admin_note?: string;
  payment_status?: string;
  is_express_delivery?: boolean;
  delivery_code?: string;
  logistics_partner_id?: string;
}

// --- Status helpers ------------------------------------------------------
const statusStyle: Record<string, string> = {
  pending:    "bg-amber-100 text-amber-700 border-amber-200",
  reviewed:   "bg-blue-100 text-blue-700 border-blue-200",
  dispatched: "bg-orange-100 text-orange-700 border-orange-200",
  completed:  "bg-emerald-100 text-emerald-700 border-emerald-200",
  rejected:   "bg-red-100 text-red-600 border-red-200",
};
const statusLabel: Record<string, string> = {
  pending:    "Pending Review",
  reviewed:   "Pricing Sent",
  dispatched: "Dispatched",
  completed:  "Delivered",
  rejected:   "Rejected",
};

const PharmacyDashboard = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [isVerifying, setIsVerifying] = useState(true);

  // --- SECURITY GUARD ------------------------------------------------------
  useEffect(() => {
    async function checkAuth() {
      const ok = await verifyPartnerSession("pharmacy");
      if (!ok) {
        toast.error("Unauthorized: Session expired or invalid");
        clearAdminSession();
        navigate("/admin/login/pharmacy");
      }
      
      const realPartnerId = await getPartnerIdFromSession();
      if (realPartnerId) {
        const { data: p } = await supabase.from("partners").select("*").eq("partner_id", realPartnerId).single();
        if (p) setPartner(p);
      }

      setIsVerifying(false);
    }
    checkAuth();
  }, [navigate]);

  const [partner, setPartner] = useState<any>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<PrescriptionOrder | null>(null);
  const [deliveryCodeInput, setDeliveryCodeInput] = useState("");
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedLogisticsPartnerId, setSelectedLogisticsPartnerId] = useState("");

  const [settlementFilter, setSettlementFilter] = useState<"all" | "today" | "yesterday">("all");
  const [editMedicines, setEditMedicines] = useState<MedicineItem[]>([]);
  const [adminNote, setAdminNote] = useState("");
  const [subTotal, setSubTotal] = useState(0);
  const [platformFee, setPlatformFee] = useState(19);
  const [deliveryFee, setDeliveryFee] = useState(40);
  const [revenueFilter, setRevenueFilter] = useState<"today" | "7days" | "30days" | "custom">("30days");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // ─── Fetch Platform Settings ─────────────────────────────────────────────
  const { data: settings } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_settings").select("*").eq("id", "global").single();
      return data;
    }
  });

  // ─── Fetch Logistics Partners (pharmacy category) ────────────────────────
  const { data: logisticsPartners = [] } = useQuery<any[]>({
    queryKey: ["pharmacy-logistics-partners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners")
        .select("*")
        .eq("type", "logistics")
        .in("category", ["pharmacy", "both"])
        .eq("status", "active");
      if (error) throw error;
      return data || [];
    },
  });

  // ─── Fetch prescriptions from Supabase ───────────────────────────────────
  const { data: orders = [], isLoading } = useQuery<PrescriptionOrder[]>({
    queryKey: ["pharmacy-prescriptions", partner?.partner_id],
    enabled: !!partner?.partner_id,
    queryFn: async () => {
      const pid = partner?.partner_id;
      // Fetch all to ensure sync, then filter in JS to avoid complex .or() syntax issues
      const { data, error } = await supabase
        .from("prescriptions")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("Prescription fetch error:", error);
        throw error;
      }

      // Show orders that are either unassigned OR assigned to this specific partner
      const allOrders = (data || []) as PrescriptionOrder[];
      return allOrders.filter(o => !o.partner_id || o.partner_id === pid);
    },
    refetchInterval: 30000, 
  });

  // ─── Update prescription status ──────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<PrescriptionOrder> }) => {
      const { error } = await supabase.from("prescriptions").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pharmacy-prescriptions"] });
      setReviewDialogOpen(false);
    },
    onError: (err: any) => toast.error("Update failed: " + err.message),
  });

  // ─── Filtered lists ───────────────────────────────────────────────────────
  const filtered = orders.filter(o => {
    const matchSearch =
      (o.patient_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (o.order_id || o.id).toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // ─── Revenue analytics ────────────────────────────────────────────────────
  const revenueData = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const billable = orders.filter(o => 
      (o.partner_id === partner?.partner_id || (!o.partner_id && o.status === "completed")) && 
      ["reviewed", "dispatched", "completed"].includes(o.status)
    );
    const inRange = (dateStr: string) => {
      const d = new Date(dateStr);
      if (revenueFilter === "today") return dateStr.startsWith(today);
      if (revenueFilter === "7days") { const s = new Date(today); s.setDate(s.getDate() - 6); return d >= s; }
      if (revenueFilter === "30days") { const s = new Date(today); s.setDate(s.getDate() - 29); return d >= s; }
      if (revenueFilter === "custom" && customFrom && customTo) return d >= new Date(customFrom) && d <= new Date(customTo);
      return true;
    };
    const rangeOrders = billable.filter(o => inRange(o.created_at));
    // Use sub_total (medicines only) - excludes platform fee and delivery fee
    const total = rangeOrders.reduce((s, o) => s + (o.sub_total || 0), 0);
    const byStatus: Record<string, number> = {};
    rangeOrders.forEach(o => { byStatus[o.status] = (byStatus[o.status] || 0) + (o.sub_total || 0); });
    
    // Settlement calc
    const commRate = partner?.commission_rate || 15;
    const platformCommission = (total * commRate) / 100;

    return { total, count: rangeOrders.length, byStatus, platformCommission, netEarnings: total - platformCommission };
  }, [orders, revenueFilter, customFrom, customTo, partner]);

  // ─── Stats ──────────────────────────────────────────────────────────────
  const stats = [
    { label: "New Requests", value: orders.filter(o => o.status === "pending" && !o.partner_id).length, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Our Queue", value: orders.filter(o => o.partner_id === partner?.partner_id && ["reviewed", "dispatched"].includes(o.status)).length, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Delivered", value: orders.filter(o => (o.partner_id === partner?.partner_id || (!o.partner_id && o.status === 'completed')) && o.status === "completed").length, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Revenue", value: `₹${(revenueData?.total || 0).toLocaleString("en-IN")}`, color: "text-emerald-600", bg: "bg-emerald-50" },
  ];

  // ─── Open review modal ────────────────────────────────────────────────────
  const openReview = (order: PrescriptionOrder) => {
    setSelectedOrder(order);
    const meds = Array.isArray(order.medicines) ? order.medicines : [];
    setEditMedicines(meds.map(m => ({ ...m })));
    setAdminNote(order.admin_note || "");
    setSubTotal(order.sub_total || 0);
    
    // Use dynamic fees from super admin settings
    const baseDelivery = Number(settings?.delivery_fee || 40);
    const expressFee = Number(settings?.express_fee || 99);
    
    setDeliveryFee(order.is_express_delivery ? expressFee : baseDelivery);
    setPlatformFee(Number(settings?.pharm_fee || 19));
    
    setDeliveryCodeInput("");
    // Pre-fill logistics partner if already assigned
    setSelectedLogisticsPartnerId(order.logistics_partner_id || "");
    setReviewDialogOpen(true);
  };

  const computedSubTotal = editMedicines
    .filter(m => m.available)
    .reduce((s, m) => s + m.price * (m.qty || m.quantity || 1), 0);
  const computedGrandTotal = computedSubTotal + platformFee + deliveryFee;

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleSendPricing = () => {
    if (!selectedOrder) return;
    if (computedSubTotal <= 0) { toast.error("Set prices for at least one medicine"); return; }
    updateMutation.mutate({
      id: selectedOrder.id,
      updates: {
        status: "reviewed",
        partner_id: partner?.partner_id, // Claim the order
        medicines: editMedicines,
        sub_total: computedSubTotal,
        platform_fee: platformFee,
        delivery_fee: deliveryFee,
        grand_total: computedGrandTotal,
        admin_note: adminNote,
      },
    });
    toast.success(`Pricing sent — Medicines: ₹${computedSubTotal.toLocaleString("en-IN")}. Order claimed.`);
  };

  const handleDispatch = (id: string) => {
    const updates: any = { status: "dispatched" };
    if (selectedLogisticsPartnerId) {
      updates.logistics_partner_id = selectedLogisticsPartnerId;
    }
    updateMutation.mutate({ id, updates });
    toast.success(`Order dispatched${selectedLogisticsPartnerId ? ' & assigned to logistics partner' : ''}`);
  };

  const handleMarkDelivered = (id: string, correctCode?: string) => {
    if (correctCode && deliveryCodeInput !== correctCode) {
      toast.error("Invalid delivery code. Ask the patient for the code shown in their profile.");
      return;
    }
    updateMutation.mutate({ id, updates: { status: "completed" } });
    toast.success(`Order marked as delivered`);
  };

  const handleReject = () => {
    if (!selectedOrder) return;
    if (!adminNote.trim()) { toast.error("Add a rejection reason"); return; }
    updateMutation.mutate({ id: selectedOrder.id, updates: { status: "rejected", admin_note: adminNote } });
    toast.error(`Prescription rejected`);
  };

  const addMedicineRow = () =>
    setEditMedicines(prev => [...prev, { name: "", qty: 1, quantity: 1, price: 0, dosage: "", available: true }]);

  const removeMedicineRow = (idx: number) =>
    setEditMedicines(prev => prev.filter((_, i) => i !== idx));

  const updateMedicineField = (idx: number, field: keyof MedicineItem, value: string | number | boolean) =>
    setEditMedicines(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));

  const exportCSV = () => {
    const rows = [
      ["Order ID", "Patient", "Phone", "Status", "Total", "Created"],
      ...orders.map(o => [o.order_id || o.id, o.patient_name, o.patient_phone, o.status, o.sub_total || 0, o.created_at])
    ];
    const blob = new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "pharmacy_orders.csv"; a.click();
    toast.success("Exported!");
  };

  const formatDate = (d: string) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (isVerifying) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-900">
      <Loader2 className="h-10 w-10 text-emerald-500 animate-spin mb-4" />
      <p className="text-white font-black text-sm uppercase tracking-widest">Pharmacy Portal</p>
      <p className="text-slate-500 text-[10px] mt-2 tracking-[0.2em]">Verifying Secure Session...</p>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "#F0F4F8" }}>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 overflow-hidden shrink-0">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Pharmacy Dashboard</h1>
            <p className="text-xs text-slate-400 font-medium">Aaroksha Health Hub · Live Data</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />}
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-red-500 gap-2" onClick={async () => {
            await revokePartnerSession();
            navigate("/admin/login/pharmacy");
            toast.success("Logged out successfully");
          }}>
            <LogOut className="h-4 w-4" /> Logout
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {stats.map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-4 border border-white shadow-sm flex items-center gap-3 hover:shadow-md transition-shadow">
              <div className={`h-9 w-9 ${s.bg} rounded-xl flex items-center justify-center shrink-0`}>
                <IndianRupee className={`h-4 w-4 ${s.color}`} />
              </div>
              <div>
                <p className="text-lg font-extrabold text-slate-800 leading-none">{s.value}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-white shadow-sm overflow-hidden">
          <Tabs defaultValue="prescriptions">
            <div className="border-b border-slate-100 px-2 pt-2">
              <TabsList className="bg-transparent gap-1 h-auto p-0">
                {["prescriptions", "revenue", "payouts"].map(tab => (
                  <TabsTrigger key={tab} value={tab} className="px-5 py-2.5 text-sm font-semibold capitalize rounded-t-xl data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:border data-[state=active]:border-b-white data-[state=active]:border-slate-200 text-slate-400">
                    {tab === "prescriptions" ? "Prescription Orders" : tab === "revenue" ? "Revenue" : "Settlements & Payouts"}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* ── Prescriptions Tab ─────────────────────────────────────── */}
            <TabsContent value="prescriptions" className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="flex gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-56" />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {["all", "pending", "reviewed", "dispatched", "completed", "rejected"].map(s => (
                      <button key={s} onClick={() => setStatusFilter(s)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all capitalize border ${statusFilter === s ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-500 border-slate-200 hover:border-emerald-300"}`}>
                        {s === "all" ? "All" : statusLabel[s] || s}
                      </button>
                    ))}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-1" /> Export</Button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/70">
                      {["Order ID", "Patient", "Uploaded", "Medicines", "Total", "Status", "Actions"].map(h => (
                        <TableHead key={h} className="text-[11px] font-bold text-slate-400 uppercase">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-emerald-500" />
                      </TableCell></TableRow>
                    ) : filtered.map(order => {
                      const meds = Array.isArray(order.medicines) ? order.medicines : [];
                      return (
                        <TableRow key={order.id} className="hover:bg-slate-50/60">
                          <TableCell className="font-mono font-bold text-emerald-700 text-xs">
                            {order.order_id || order.id.slice(0, 8).toUpperCase()}
                          </TableCell>
                          <TableCell>
                            <p className="font-semibold text-slate-800 text-sm">{order.patient_name}</p>
                            <p className="text-[11px] text-slate-400">{order.patient_phone}</p>
                          </TableCell>
                          <TableCell className="text-xs text-slate-500">{formatDate(order.created_at)}</TableCell>
                          <TableCell className="text-sm text-slate-600">{meds.length} items</TableCell>
                          {/* Show medicines subtotal only to partner */}
                          <TableCell className="font-bold text-slate-800">
                            {order.sub_total && order.sub_total > 0 ? `₹${order.sub_total}` : "-"}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusStyle[order.status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                              {statusLabel[order.status] || order.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openReview(order)}>
                                <Eye className="h-4 w-4 mr-1" /> Review
                              </Button>
                              {order.status === "reviewed" && (
                                <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white h-8 text-xs" onClick={() => handleDispatch(order.id)}>
                                  <Truck className="h-3 w-3 mr-1" /> Dispatch
                                </Button>
                              )}
                              {order.status === "dispatched" && (
                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs" onClick={() => {
                                  setSelectedOrder(order);
                                  setDeliveryCodeInput("");
                                  setReviewDialogOpen(true);
                                }}>
                                  <Package className="h-3 w-3 mr-1" /> Delivered
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!isLoading && filtered.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center py-12 text-slate-400">No orders found</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* ── Revenue Tab ───────────────────────────────────────────── */}
            <TabsContent value="revenue" className="p-6 space-y-6">
              <div className="flex flex-wrap gap-2 items-center">
                {(["today", "7days", "30days", "custom"] as const).map(f => (
                  <button key={f} onClick={() => setRevenueFilter(f)}
                    className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${revenueFilter === f ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-100" : "bg-white text-slate-500 border-slate-200"}`}>
                    {f === "today" ? "Today" : f === "7days" ? "Last 7 Days" : f === "30days" ? "Last 30 Days" : "Custom"}
                  </button>
                ))}
                {revenueFilter === "custom" && (
                  <div className="flex gap-2 items-center">
                    <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="w-36 h-9 text-xs" />
                    <span className="text-slate-400 text-xs">to</span>
                    <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="w-36 h-9 text-xs" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-5 text-white shadow-lg shadow-emerald-200">
                  <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">Total Revenue</p>
                  <p className="text-3xl font-black mt-1">₹{revenueData.total.toLocaleString("en-IN")}</p>
                  <p className="text-xs opacity-70 mt-2 flex items-center gap-1"><ArrowUpRight className="h-3 w-3" /> from {revenueData.count} orders</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Avg Order Value</p>
                  <p className="text-2xl font-black text-slate-800 mt-1">₹{revenueData.count > 0 ? Math.round(revenueData.total / revenueData.count).toLocaleString("en-IN") : 0}</p>
                  <p className="text-xs text-slate-400 mt-2">Per prescription order</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Orders</p>
                  <p className="text-2xl font-black text-slate-800 mt-1">{revenueData.count}</p>
                  <p className="text-xs text-slate-400 mt-2">In selected period</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 mb-4"><BarChart3 className="h-5 w-5 text-emerald-600" /><h3 className="font-bold text-slate-800">Revenue by Stage</h3></div>
                <div className="space-y-3">
                  {Object.entries(revenueData.byStatus).map(([status, amount]) => {
                    const maxAmt = Math.max(...Object.values(revenueData.byStatus), 1);
                    return (
                      <div key={status} className="flex items-center gap-3">
                        <p className="text-sm font-medium text-slate-600 w-36">{statusLabel[status] || status}</p>
                        <div className="flex-1 bg-slate-100 rounded-full h-2">
                          <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${(amount / maxAmt) * 100}%` }} />
                        </div>
                        <p className="text-sm font-bold text-slate-800 w-20 text-right">₹{amount.toLocaleString("en-IN")}</p>
                      </div>
                    );
                  })}
                  {Object.keys(revenueData.byStatus).length === 0 && <p className="text-sm text-slate-400 text-center py-4">No revenue data in selected period</p>}
                </div>
              </div>
            </TabsContent>

            {/* ════ PAYOUTS TAB ════ */}
            <TabsContent value="payouts" className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Statement Summary */}
                <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                    <IndianRupee className="h-32 w-32 font-black" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-2">Pharmacy Net Settlement</p>
                    <h2 className="text-5xl font-black mb-6">₹{(() => {
                      const billable = orders.filter(o => {
                        if (o.partner_id !== partner?.partner_id && (o.partner_id || o.status !== 'completed')) return false;
                        if (o.status !== "completed") return false;
                        if (settlementFilter === "today") return new Date(o.created_at).toDateString() === new Date().toDateString();
                        if (settlementFilter === "yesterday") {
                          const y = new Date(); y.setDate(y.getDate() - 1);
                          return new Date(o.created_at).toDateString() === y.toDateString();
                        }
                        return true;
                      });
                      // Base settlement on medicines subtotal only
                      const total = billable.reduce((s, o) => s + (o.sub_total || 0), 0);
                      const rate = partner?.commission_rate || 15;
                      const comm = partner?.commission_type === "fixed"
                        ? billable.length * rate
                        : (total * rate) / 100;
                      return (total - comm).toLocaleString("en-IN");
                    })()}</h2>
                  </div>
                  <div className="space-y-4 pt-6 border-t border-white/10">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Commission Rate</span>
                      <span className="font-bold">{partner?.commission_rate || 15}% platform fee</span>
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
                        { l: "Platform Rate", v: `${partner?.commission_rate || 15}% on Order Value` },
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
                </div>
              </div>

              {/* Commission Table */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <h3 className="font-black text-slate-900 text-sm italic underline decoration-emerald-500 underline-offset-4">Settlement Breakdown</h3>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      {(["all", "today", "yesterday"] as const).map(f => (
                        <button key={f} onClick={() => setSettlementFilter(f)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${settlementFilter === f ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>
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
                          <TableHead className="text-[10px] font-black uppercase">Order ID</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-center">Meds Total</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-center text-red-500">Commission</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-right text-emerald-600">Your Net</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const filtered = orders.filter(o => {
                            if (o.partner_id !== partner?.partner_id && (o.partner_id || o.status !== 'completed')) return false;
                            if (o.status !== "completed") return false;
                            if (settlementFilter === "today") return new Date(o.created_at).toDateString() === new Date().toDateString();
                            if (settlementFilter === "yesterday") {
                              const y = new Date(); y.setDate(y.getDate() - 1);
                              return new Date(o.created_at).toDateString() === y.toDateString();
                            }
                            return true;
                          });
                          if (filtered.length === 0) return (
                            <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-400 text-xs font-bold">
                              No completed orders for {settlementFilter === "all" ? "any period" : `"${settlementFilter}"`}
                            </TableCell></TableRow>
                          );
                          return filtered.slice(0, 15).map(o => {
                            // Show only medicines sub_total to partner
                            const gt = o.sub_total || 0;
                            const rate = partner?.commission_rate || 15;
                            const comm = partner?.commission_type === "fixed"
                              ? rate
                              : (gt * rate) / 100;
                            return (
                              <TableRow key={o.id}>
                                <TableCell className="font-mono text-[10px] font-bold text-slate-400">{o.order_id || o.id.slice(0,8).toUpperCase()}</TableCell>
                                <TableCell className="text-center font-bold text-slate-700 text-xs">₹{gt}</TableCell>
                                <TableCell className="text-center font-bold text-red-500 text-xs">₹{comm.toFixed(2)}</TableCell>
                                <TableCell className="text-right font-black text-slate-800 text-xs">₹{(gt - comm).toFixed(2)}</TableCell>
                              </TableRow>
                            );
                          });
                        })()}
                      </TableBody>
                    </Table>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ── Review / Action Dialog ─────────────────────────────────── */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-600" />
              Review Prescription - {selectedOrder?.order_id || selectedOrder?.id?.slice(0, 8).toUpperCase()}
              {selectedOrder && <span className={`ml-2 inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusStyle[selectedOrder.status] || ""}`}>{statusLabel[selectedOrder.status] || selectedOrder.status}</span>}
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-5 mt-2">
              {/* Patient info */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div><p className="text-[10px] text-slate-400 uppercase font-bold">Patient</p><p className="font-semibold text-slate-800">{selectedOrder.patient_name}</p></div>
                <div><p className="text-[10px] text-slate-400 uppercase font-bold">Phone</p><p className="text-sm flex items-center gap-1"><Phone className="h-3 w-3" /> {selectedOrder.patient_phone}</p></div>
                <div className="col-span-2"><p className="text-[10px] text-slate-400 uppercase font-bold">Delivery Address</p><p className="text-sm flex items-center gap-1"><MapPin className="h-3 w-3" /> {selectedOrder.delivery_address}</p></div>
                {selectedOrder.is_express_delivery && (
                  <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-center gap-2">
                    <span className="text-base">⚡</span>
                    <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider">Express Delivery Requested (+₹40)</span>
                  </div>
                )}
              </div>

              {/* Prescription images */}
              {selectedOrder.prescriptions && selectedOrder.prescriptions.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prescription Images</p>
                  <div className="flex gap-2 flex-wrap">
                    {selectedOrder.prescriptions.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={`Prescription ${i + 1}`} className="h-32 w-auto rounded-xl border border-slate-200 object-contain hover:opacity-80 transition-opacity" />
                      </a>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                  <ImageIcon className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-500">No prescription image uploaded</p>
                </div>
              )}

              {/* Medicine Entry */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Pill className="h-4 w-4 text-emerald-600" /> Medicines & Pricing
                  </h3>
                  {["pending", "reviewed"].includes(selectedOrder.status) && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addMedicineRow}>
                      <Plus className="h-3 w-3 mr-1" /> Add Medicine
                    </Button>
                  )}
                </div>

                {editMedicines.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-xl">
                    No medicines added yet. Click "Add Medicine" to enter.
                  </p>
                )}

                {editMedicines.map((med, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-white">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <Input
                          placeholder="Medicine name (e.g. Amoxicillin 500mg)"
                          value={med.name}
                          onChange={e => updateMedicineField(idx, "name", e.target.value)}
                          className="h-8 text-sm"
                          disabled={!["pending", "reviewed"].includes(selectedOrder.status)}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number" min={1} placeholder="Qty"
                          value={med.qty || med.quantity || 1}
                          onChange={e => updateMedicineField(idx, "qty", Math.max(1, +e.target.value))}
                          className="h-8 text-sm"
                          disabled={!["pending", "reviewed"].includes(selectedOrder.status)}
                        />
                      </div>
                      <div className="col-span-2">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">₹</span>
                          <Input
                            type="number" min={0} placeholder="Price"
                            value={med.price || ""}
                            onChange={e => updateMedicineField(idx, "price", +e.target.value)}
                            className="h-8 text-sm pl-5"
                            disabled={!["pending", "reviewed"].includes(selectedOrder.status)}
                          />
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-sm font-bold text-emerald-700">
                          {med.price > 0 ? `₹${(med.price * (med.qty || med.quantity || 1)).toLocaleString("en-IN")}` : "-"}
                        </span>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        {["pending", "reviewed"].includes(selectedOrder.status) && (
                          <button onClick={() => removeMedicineRow(idx)}
                            className="h-7 w-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-slate-400 hover:text-red-500 transition">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {editMedicines.length > 0 && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                    <div className="flex justify-between items-center pt-2 border-slate-200">
                      <span className="font-bold text-slate-800">Medicines Total</span>
                      <span className="text-2xl font-black text-emerald-700">₹{computedSubTotal.toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Note */}
              <div className="space-y-2">
                <Label>Note to Patient</Label>
                <Textarea value={adminNote} onChange={e => setAdminNote(e.target.value)}
                  placeholder="Add notes about availability, alternatives, instructions..."
                  rows={2} disabled={!["pending"].includes(selectedOrder.status)} />
              </div>

              {/* Payment status notice */}
              {selectedOrder.status === "reviewed" && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-violet-50 border border-violet-200">
                  <MessageCircle className="h-5 w-5 text-violet-600 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-violet-800">Waiting for Patient Payment</p>
                    <p className="text-xs text-violet-600">
                      Total ₹{selectedOrder.grand_total} has been communicated. Patient must pay to proceed.
                      {selectedOrder.payment_status === "paid" && " ✅ Payment received!"}
                    </p>
                  </div>
                </div>
              )}

              {selectedOrder.status === "dispatched" && selectedOrder.delivery_code && (
                <div className="pt-2">
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                    Verify Delivery Code
                  </Label>
                  <Input 
                    placeholder="Enter 6-digit code from patient" 
                    value={deliveryCodeInput}
                    onChange={(e) => setDeliveryCodeInput(e.target.value.toUpperCase())}
                    className="h-11 border-2 border-emerald-200 bg-emerald-50 text-center font-black tracking-widest uppercase text-emerald-800"
                    maxLength={6}
                  />
                </div>
              )}

              {/* Action buttons */}
              <div className="space-y-2">
                {selectedOrder.status === "pending" && (
                  <div className="flex gap-2">
                    <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleSendPricing} disabled={updateMutation.isPending}>
                      <MessageCircle className="h-4 w-4 mr-2" /> Send Pricing to Patient
                    </Button>
                    <Button variant="destructive" className="flex-1" onClick={handleReject} disabled={updateMutation.isPending}>
                      <XCircle className="h-4 w-4 mr-2" /> Reject
                    </Button>
                  </div>
                )}
                {selectedOrder.status === "reviewed" && selectedOrder.payment_status === "paid" && (
                  <div className="space-y-2">
                    {/* Logistics Partner Assignment */}
                    <div className="p-3 rounded-xl bg-orange-50 border border-orange-100">
                      <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-2">
                        Assign Logistics Partner (optional)
                      </p>
                      <select
                        value={selectedLogisticsPartnerId}
                        onChange={(e) => setSelectedLogisticsPartnerId(e.target.value)}
                        className="w-full h-10 bg-white border border-orange-200 rounded-xl px-3 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer focus:border-orange-400 transition-all"
                      >
                        <option value="">-- No logistics partner --</option>
                        {logisticsPartners.map((lp: any) => (
                          <option key={lp.id} value={lp.partner_id}>{lp.name}</option>
                        ))}
                      </select>
                      {logisticsPartners.length === 0 && (
                        <p className="text-[9px] text-slate-400 mt-1">No active pharmacy logistics partners found.</p>
                      )}
                    </div>
                    <Button
                      className="w-full bg-orange-500 hover:bg-orange-600"
                      onClick={() => handleDispatch(selectedOrder.id)}
                      disabled={updateMutation.isPending}
                    >
                      <Truck className="h-4 w-4 mr-2" />
                      {selectedLogisticsPartnerId ? "Dispatch & Assign Logistics" : "Mark as Dispatched"}
                    </Button>
                  </div>
                )}
                {selectedOrder.status === "dispatched" && (
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700 font-bold" onClick={() => handleMarkDelivered(selectedOrder.id, selectedOrder.delivery_code)} disabled={updateMutation.isPending}>
                    <Package className="h-4 w-4 mr-2" /> {selectedOrder.delivery_code ? "Verify & Mark Delivered" : "Mark as Delivered"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PharmacyDashboard;
