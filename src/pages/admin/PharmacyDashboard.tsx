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
  Loader2, TrendingUp, Clock
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSettings } from "@/lib/settingsSync";
import { verifyPartnerSession, clearAdminSession, revokePartnerSession, getPartnerIdFromSession } from "@/lib/adminAuth";
import { SettlementManager } from "@/components/SettlementManager";

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
  paid:       "bg-violet-100 text-violet-700 border-violet-200",
  confirmed:  "bg-violet-100 text-violet-700 border-violet-200",
  dispatched: "bg-orange-100 text-orange-700 border-orange-200",
  collected:  "bg-indigo-100 text-indigo-700 border-indigo-200",
  completed:  "bg-emerald-100 text-emerald-700 border-emerald-200",
  rejected:   "bg-red-100 text-red-600 border-red-200",
  cancelled:  "bg-slate-100 text-slate-500 border-slate-200",
};
const statusLabel: Record<string, string> = {
  pending:    "Review Pending",
  reviewed:   "Pricing Sent",
  paid:       "Confirmed — Ready to Dispatch",
  confirmed:  "Confirmed — Ready to Dispatch",
  dispatched: "Dispatched",
  collected:  "Out for Delivery",
  completed:  "Delivered",
  rejected:   "Rejected",
  cancelled:  "Cancelled",
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
  const { settings } = useSettings();

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
    queryKey: ["pharmacy-prescriptions", partner?.partner_id, partner?.created_at],
    enabled: !!partner?.partner_id,
    queryFn: async () => {
      const pid = partner?.partner_id;
      // Security: Only show orders created AFTER this partner was added to the platform
      // to ensure fresh account state if a partner is recreated.
      const since = partner?.created_at || new Date(0).toISOString();

      const { data, error } = await supabase
        .from("prescriptions")
        .select("*")
        .or(`partner_id.eq.${pid},status.eq.pending`)
        .gte("created_at", since)
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
    // 'confirmed' filter: show orders with payment_status=paid OR status=paid or confirmed
    const isPaidReady = o.payment_status === "paid" || o.status === "paid" || o.status === "confirmed";
    const matchStatus = statusFilter === "all"
      ? true
      : statusFilter === "confirmed"
      ? isPaidReady && o.status !== "dispatched" && o.status !== "collected" && o.status !== "completed"
      : o.status === statusFilter;
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
    { label: "New Requests", value: orders.filter(o => o.status === "pending" && !o.partner_id).length, color: "text-amber-600", bg: "bg-amber-50", icon: FileText },
    { label: "Pricing Sent", value: orders.filter(o => o.partner_id === partner?.partner_id && o.status === "reviewed").length, color: "text-blue-600", bg: "bg-blue-50", icon: Clock },
    { label: "Confirmed — Dispatch Now", value: orders.filter(o => o.partner_id === partner?.partner_id && (o.status === "paid" || o.status === "confirmed" || (o.status === "reviewed" && o.payment_status === "paid"))).length, color: "text-violet-600", bg: "bg-violet-50", icon: Truck },
    { label: "Dispatched", value: orders.filter(o => o.partner_id === partner?.partner_id && ["dispatched","collected"].includes(o.status)).length, color: "text-orange-600", bg: "bg-orange-50", icon: Package },
    { label: "Delivered", value: orders.filter(o => (o.partner_id === partner?.partner_id || (!o.partner_id && o.status === 'completed')) && o.status === "completed").length, color: "text-emerald-600", bg: "bg-emerald-50", icon: CheckCircle },
  ];

  // ─── Open review modal ────────────────────────────────────────────────────
  const openReview = (order: PrescriptionOrder) => {
    setSelectedOrder(order);
    const meds = Array.isArray(order.medicines) ? order.medicines : [];
    setEditMedicines(meds.map(m => ({ ...m })));
    setAdminNote(order.admin_note || "");
    setSubTotal(order.sub_total || 0);
    
    // Use dynamic fees from super admin settings
    const baseDelivery = Number(settings?.delivery_fee);
    setDeliveryFee(baseDelivery);
    setPlatformFee(Number(settings?.pharm_fee));
    
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
    toast.success(`Pricing sent. Order claimed.`);
  };

  const handleDispatch = (id: string) => {
    const updates: any = { status: "dispatched" };
    if (selectedLogisticsPartnerId) {
      updates.logistics_partner_id = selectedLogisticsPartnerId;
    }
    updateMutation.mutate({ id, updates });
    toast.success(`Order dispatched${selectedLogisticsPartnerId ? ' & assigned to delivery partner' : ''}`);
  };

  const handleMarkDelivered = (id: string) => {
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
                <s.icon className={`h-4 w-4 ${s.color}`} />
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
                {["prescriptions", "revenue", "settlements"].map(tab => (
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
                    {["all", "pending", "reviewed", "confirmed", "dispatched", "collected", "completed", "rejected"].map(s => (
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
                            <div className="flex gap-1 flex-wrap">
                              <Button variant="ghost" size="sm" onClick={() => openReview(order)}>
                                <Eye className="h-4 w-4 mr-1" /> View
                              </Button>
                              
                              {/* Pending: no dispatch, just review */}
                              {order.status === "pending" && (
                                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                  Awaiting Pricing
                                </span>
                              )}

                              {/* Reviewed but not paid: waiting for customer payment */}
                              {order.status === "reviewed" && order.payment_status !== "paid" && (
                                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                  Awaiting Payment
                                </span>
                              )}

                              {/* Confirmed (via reviewed+paid or status=paid/confirmed): Show dispatch button */}
                              {(order.status === "paid" || order.status === "confirmed" || (order.status === "reviewed" && order.payment_status === "paid")) && (
                                <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white h-8 text-xs" onClick={() => openReview(order)}>
                                  <Truck className="h-3 w-3 mr-1" /> Dispatch
                                </Button>
                              )}

                              {/* Dispatched: show status badge */}
                              {order.status === "dispatched" && (
                                <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-1 rounded">
                                  Out for Delivery
                                </span>
                              )}

                              {/* Collected: delivery partner will mark as delivered via code */}
                              {order.status === "collected" && (
                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 border border-indigo-200 rounded">
                                  Out For Delivery
                                </span>
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

            {/* ════ SETTLEMENTS TAB ════ */}
            <TabsContent value="settlements" className="p-6 space-y-6">
              <SettlementManager userType="partner" partnerId={partner?.id || undefined} partnerType="pharmacy" />
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

              {/* Action buttons */}
              <div className="space-y-2">
                {/* Step 1: Review Pending — show send pricing button */}
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

                {/* Step 2: Pricing sent — waiting for payment */}
                {selectedOrder.status === "reviewed" && selectedOrder.payment_status !== "paid" && (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                    <Clock className="h-5 w-5 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-sm font-black text-amber-800">Waiting for Customer Confirmation</p>
                      <p className="text-xs text-amber-600">Total ₹{selectedOrder.grand_total} sent. Order will unlock for dispatch after confirmation.</p>
                    </div>
                  </div>
                )}

                {/* Step 3: CONFIRMED — Show dispatch + delivery partner assignment */}
                {(selectedOrder.status === "paid" || selectedOrder.status === "confirmed" || (selectedOrder.status === "reviewed" && selectedOrder.payment_status === "paid")) && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                      <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-sm font-black text-emerald-800">✅ Order Confirmed — Ready to Dispatch</p>
                        <p className="text-xs text-emerald-600">Amount: ₹{selectedOrder.grand_total} (COD) · Assign a delivery partner below</p>
                      </div>
                    </div>

                    {/* Delivery Partner Assignment */}
                    <div className="p-4 rounded-xl bg-violet-50 border border-violet-100 space-y-3">
                      <p className="text-[10px] font-black text-violet-600 uppercase tracking-widest">Assign Delivery Partner</p>
                      <select
                        value={selectedLogisticsPartnerId}
                        onChange={(e) => setSelectedLogisticsPartnerId(e.target.value)}
                        className="w-full h-10 bg-white border border-violet-200 rounded-xl px-3 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer focus:border-violet-400 transition-all"
                      >
                        <option value="">-- No delivery partner (self-dispatch) --</option>
                        {logisticsPartners.map((lp: any) => (
                          <option key={lp.id} value={lp.partner_id}>{lp.name}</option>
                        ))}
                      </select>
                      {logisticsPartners.length === 0 && (
                        <p className="text-[9px] text-slate-400">No active pharmacy logistics partners configured in Super Admin.</p>
                      )}
                      {selectedLogisticsPartnerId && (
                        <div className="flex items-center gap-2 text-[10px] font-bold text-violet-600">
                          <CheckCircle className="h-3 w-3" />
                          Partner assigned — they will see this order in their Logistics Dashboard
                        </div>
                      )}
                    </div>

                    <Button
                      className="w-full bg-violet-600 hover:bg-violet-700 font-black text-white h-12"
                      onClick={() => handleDispatch(selectedOrder.id)}
                      disabled={updateMutation.isPending}
                    >
                      <Truck className="h-4 w-4 mr-2" />
                      {selectedLogisticsPartnerId ? "Dispatch & Assign Delivery Partner" : "Mark as Dispatched"}
                    </Button>
                  </div>
                )}

                {/* Step 4: Dispatched — show tracking info */}
                {selectedOrder.status === "dispatched" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-orange-50 border border-orange-200">
                      <Truck className="h-5 w-5 text-orange-600 shrink-0" />
                      <div>
                        <p className="text-sm font-black text-orange-800">Order Dispatched</p>
                        <p className="text-xs text-orange-600">
                          {selectedOrder.logistics_partner_id
                            ? `Assigned to: ${logisticsPartners.find(lp => lp.partner_id === selectedOrder.logistics_partner_id)?.name || selectedOrder.logistics_partner_id}`
                            : "Self-dispatch (no partner assigned)"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 5: Completed */}
                {selectedOrder.status === "completed" && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                    <p className="text-sm font-black text-emerald-800">✅ Order Delivered Successfully</p>
                  </div>
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
