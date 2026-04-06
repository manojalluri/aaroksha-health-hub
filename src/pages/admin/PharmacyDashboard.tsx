import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { verifyPartnerSession, clearAdminSession, revokePartnerSession } from "@/lib/adminAuth";
import {
  Package, Search, Clock, CheckCircle2, XCircle, Truck,
  Plus, Trash2, ExternalLink, IndianRupee, Image as ImageIcon,
  Calendar, Loader2, AlertCircle, RefreshCcw, Eye, X,
  ChevronRight, Filter, ChevronDown, Pill, LogOut,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Medicine {
  name: string;
  dosage: string;
  qty: number;
  price: number;
  available: boolean;
}

interface PharmacyOrder {
  id: string;
  order_id: string;
  user_id?: string;
  patient_name: string;
  patient_phone: string;
  delivery_address: string;
  image_url: string;
  status: "pending" | "reviewed" | "rejected" | "dispatched" | "completed";
  medicines: Medicine[];
  sub_total?: number;
  platform_fee?: number;
  delivery_fee?: number;
  grand_total?: number;
  admin_note?: string;
  created_at: string;
  is_express_delivery?: boolean;
  is_auto_confirm?: boolean;
  partner_id?: string;
}

const MOCK_ORDERS: PharmacyOrder[] = [];

// ─── Status Config ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; cls: string; dot: string }> = {
  pending:    { label: "Pending Review", cls: "bg-amber-100 text-amber-700",  dot: "bg-amber-400" },
  reviewed:   { label: "Awaiting Payment", cls: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  dispatched: { label: "Dispatched",    cls: "bg-purple-100 text-purple-700", dot: "bg-purple-500" },
  completed:  { label: "Delivered",     cls: "bg-emerald-100 text-emerald-700",dot: "bg-emerald-500" },
  rejected:   { label: "Rejected",      cls: "bg-red-100 text-red-600",       dot: "bg-red-400" },
};

const StatusBadge = ({ status }: { status: string }) => {
  const cfg = STATUS_CFG[status] ?? { label: status, cls: "bg-gray-100 text-gray-600", dot: "bg-gray-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${cfg.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

// ─── Image Zoom Modal ─────────────────────────────────────────────────────────
const ImageModal = ({ url, onClose }: { url: string; onClose: () => void }) => (
  <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
    <div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
      <button onClick={onClose} className="absolute -top-3 -right-3 h-8 w-8 bg-white rounded-full flex items-center justify-center shadow-lg z-10">
        <X className="h-4 w-4 text-gray-700" />
      </button>
      <img src={url} alt="Prescription" className="w-full rounded-2xl shadow-2xl" />
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const PharmacyDashboard = () => {
  const navigate = useNavigate();
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(true);
  const queryClient = useQueryClient();

  // ─── SECURITY GUARD ────────────────────────────────────────────────────────
  useEffect(() => {
    async function checkAuth() {
      const ok = await verifyPartnerSession("pharmacy");
      if (!ok) {
        toast.error("Unauthorized: Session expired or invalid");
        clearAdminSession();
        navigate("/admin/login/pharmacy");
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

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [editMeds, setEditMeds] = useState<Medicine[]>([]);
  const [newMedName, setNewMedName] = useState("");
  const [newMedDosage, setNewMedDosage] = useState("");
  const [newMedQty, setNewMedQty] = useState("1");
  const [newMedPrice, setNewMedPrice] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [imageZoom, setImageZoom] = useState(false);
  const [isExpressDelivery, setIsExpressDelivery] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const { data: orders = [], isLoading } = useQuery<PharmacyOrder[]>({
    queryKey: ["pharmacy-orders", partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      let query = supabase.from("prescriptions").select("*").order("created_at", { ascending: false });
      if (partnerId && !partnerId.includes("SEED")) {
        query = query.or(`partner_id.eq.${partnerId},partner_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PharmacyOrder[];
    },
    enabled: !!partnerId,
    refetchInterval: 15000,
  });

  const selected = orders.find((o) => o.id === selectedId);

  useEffect(() => {
    if (selected) {
      setEditMeds(selected.medicines ? JSON.parse(JSON.stringify(selected.medicines)) : []);
      setAdminNote(selected.admin_note || "");
    }
  }, [selectedId]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<PharmacyOrder> }) => {
      const finalUpdates = { 
        ...updates, 
        partner_id: partnerId,
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from("prescriptions").update(finalUpdates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { updates }) => {
      queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      const statusLabel = updates.status === "completed" ? "delivered" : updates.status;
      toast.success(`Order successfully marked as ${statusLabel}!`);
    },
    onError: (err) => {
      console.error("Pharmacy update failed:", err);
      toast.error("Database update failed. Please try again.");
    },
  });

  // ── Medicine helpers ───────────────────────────────────────────────────────
  const handleAddMed = () => {
    if (!newMedName.trim() || !newMedPrice) { toast.error("Name and price are required"); return; }
    const med: Medicine = {
      name: newMedName.trim(),
      dosage: newMedDosage.trim() || "1 unit",
      qty: parseInt(newMedQty) || 1,
      price: parseFloat(newMedPrice) || 0,
      available: true,
    };
    setEditMeds([...editMeds, med]);
    setNewMedName(""); setNewMedDosage(""); setNewMedQty("1"); setNewMedPrice("");
  };

  const removeMed = (idx: number) => setEditMeds(editMeds.filter((_, i) => i !== idx));

  // ── Totals ─────────────────────────────────────────────────────────────────
  const subTotal = editMeds.filter((m) => m.available).reduce((s, m) => s + m.price * (m.qty || 1), 0);
  const platformFee = 20;
  const deliveryFee = isExpressDelivery ? 149 : 40;
  const grandTotal = subTotal + platformFee + deliveryFee;

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleSendToPatient = async () => {
    if (!selectedId) return;
    if (editMeds.length === 0) { toast.error("Add at least one medicine before sending"); return; }
    const updates: Partial<PharmacyOrder> = {
      medicines: editMeds,
      status: "reviewed",
      sub_total: subTotal,
      platform_fee: platformFee,
      delivery_fee: deliveryFee,
      grand_total: grandTotal,
      admin_note: adminNote,
      is_express_delivery: isExpressDelivery,
    };
    updateMutation.mutate({ id: selectedId, updates });
  };

  const handleReject = () => {
    if (!selectedId) return;
    const updates: Partial<PharmacyOrder> = { status: "rejected", admin_note: adminNote || "Invalid or unclear prescription." };
    updateMutation.mutate({ id: selectedId, updates });
    setSelectedId(null);
  };

  // ── Filtered orders ────────────────────────────────────────────────────────
  const displayOrders = orders.filter((o) => {
    const q = search.toLowerCase();
    const matchSearch = o.patient_name?.toLowerCase().includes(q) || o.id?.toLowerCase().includes(q);
    const matchStatus = statusFilter === "All" || o.status === statusFilter.toLowerCase();
    return matchSearch && matchStatus;
  });

  const counts = {
    all: orders.length,
    pending: orders.filter((o) => o.status === "pending").length,
    reviewed: orders.filter((o) => o.status === "reviewed").length,
    dispatched: orders.filter((o) => o.status === "dispatched").length,
    completed: orders.filter((o) => o.status === "completed").length,
    rejected: orders.filter((o) => o.status === "rejected").length,
  };

  if (isVerifying) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-900">
      <Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-4" />
      <p className="text-white font-black text-sm uppercase tracking-widest">Pharmacy Partner</p>
      <p className="text-slate-500 text-[10px] mt-2 tracking-[0.2em]">Verifying Secure Session...</p>
    </div>
  );

  return (
    <div className="min-h-screen flex font-sans" style={{ background: "#F0F3F8" }}>

      {imageZoom && selected?.image_url && (
        <ImageModal url={selected.image_url} onClose={() => setImageZoom(false)} />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="w-80 bg-white border-r border-gray-200 flex flex-col sticky top-0 h-screen shrink-0">

        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 bg-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
              <Pill className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-gray-900 leading-none">AAROKSHA</h1>
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">Pharmacy Dashboard</p>
            </div>
            <button 
              onClick={async () => {
                await revokePartnerSession();
                navigate("/admin/login");
                toast.success("Logged out successfully");
              }}
              className="ml-auto p-2 rounded-lg bg-gray-50 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient or ID..."
              className="w-full h-9 bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 text-xs focus:outline-none focus:border-emerald-400 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex gap-1 flex-wrap">
            {[
              { key: "All", count: counts.all },
              { key: "pending", count: counts.pending },
              { key: "reviewed", count: counts.reviewed },
              { key: "dispatched", count: counts.dispatched },
              { key: "completed", count: counts.completed },
            ].map(({ key, count }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  statusFilter === key
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {key === "All" ? "All" : key.charAt(0).toUpperCase() + key.slice(1)} {count > 0 && `(${count})`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading ? (
            <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-emerald-500" /></div>
          ) : displayOrders.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-xs font-medium">No orders found</div>
          ) : displayOrders.map((order) => (
            <button
              key={order.id}
              onClick={() => setSelectedId(order.id)}
              className={`w-full text-left p-3.5 rounded-2xl border transition-all ${
                selectedId === order.id
                  ? "bg-emerald-50 border-emerald-200 shadow-sm"
                  : "bg-white border-gray-100 hover:border-emerald-200 hover:shadow-sm"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-bold text-gray-900 text-sm leading-tight">{order.patient_name}</p>
                  <p className="text-[10px] text-gray-400 font-medium mt-0.5">{order.patient_phone}</p>
                </div>
                <StatusBadge status={order.status} />
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Details Panel ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto p-8">
        {!selected ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="h-20 w-20 bg-emerald-50 rounded-3xl flex items-center justify-center mb-4">
              <Package className="h-10 w-10 text-emerald-600 opacity-20" />
            </div>
            <h3 className="text-xl font-black text-gray-900">Select an order</h3>
            <p className="text-sm text-gray-400 max-w-xs mt-2">Pick a prescription from the sidebar to review items and dispatch.</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto w-full space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-gray-900">{selected.patient_name}</h2>
                <div className="flex items-center gap-3 text-sm text-gray-500 font-medium mt-1">
                  <span>{selected.patient_phone}</span>
                  <span className="h-1 w-1 rounded-full bg-gray-300" />
                  <span>{selected.order_id}</span>
                </div>
              </div>
              <StatusBadge status={selected.status} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6">
                {/* Prescription Image */}
                <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Prescription Image</p>
                  <div 
                    className="relative aspect-[3/4] bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 cursor-zoom-in"
                    onClick={() => setImageZoom(true)}
                  >
                    <img src={selected.image_url} className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/5 transition-all flex items-center justify-center group">
                      <Eye className="text-white opacity-0 group-hover:opacity-100 drop-shadow-lg" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Items and Quote */}
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm max-h-[600px] overflow-y-auto">
                   <h3 className="text-lg font-black text-gray-900 mb-4">Itemized Quote</h3>
                   <div className="space-y-4 mb-6">
                     {editMeds.map((med, idx) => (
                       <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <div>
                            <p className="font-bold text-gray-900 text-sm">{med.name}</p>
                            <p className="text-[10px] text-gray-400">{med.dosage} · Qty: {med.qty}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-gray-900 text-sm">₹{med.price * med.qty}</p>
                            <button onClick={() => removeMed(idx)} className="text-[10px] font-bold text-red-500 hover:underline mt-1">Remove</button>
                          </div>
                       </div>
                     ))}
                   </div>

                   {selected.status === "pending" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                         <input value={newMedName} onChange={e => setNewMedName(e.target.value)} placeholder="Med Name" className="h-10 px-3 border border-gray-200 rounded-xl text-sm" />
                         <input value={newMedPrice} onChange={e => setNewMedPrice(e.target.value)} type="number" placeholder="Price" className="h-10 px-3 border border-gray-200 rounded-xl text-sm" />
                      </div>
                      <button onClick={handleAddMed} className="w-full h-10 bg-emerald-50 text-emerald-600 font-bold text-sm rounded-xl">Add Item</button>
                    </div>
                   )}

                   <div className="mt-8 pt-6 border-t border-dashed border-gray-200 space-y-2">
                     <div className="flex justify-between text-sm text-gray-500 font-medium"><span>Subtotal</span><span className="font-bold text-gray-900">₹{subTotal}</span></div>
                     <div className="flex justify-between text-sm text-gray-500 font-medium"><span>Delivery</span><span className="font-bold text-gray-900">₹{deliveryFee}</span></div>
                     <div className="flex justify-between text-sm pt-2 border-t border-gray-100"><span className="font-black text-gray-900">Total</span><span className="text-xl font-black text-emerald-600">₹{grandTotal}</span></div>
                   </div>

                   {selected.status === "pending" && (
                     <div className="flex gap-3 mt-8">
                       <button onClick={handleSendToPatient} className="flex-1 h-12 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 active:scale-95 transition-all">Send Quote</button>
                       <button onClick={handleReject} className="h-12 px-4 bg-red-50 text-red-500 font-bold rounded-xl active:scale-95 transition-all"><XCircle /></button>
                     </div>
                   )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PharmacyDashboard;
