import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { verifyPartnerSession, clearAdminSession, revokePartnerSession } from "@/lib/adminAuth";
import {
  Package, Search, Clock, CheckCircle2, Truck,
  MapPin, Phone, RefreshCcw, User, ExternalLink,
  ChevronRight, KeyRound, ShieldCheck, XCircle, AlertCircle, Loader2, LogOut
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface DeliveryOrder {
  id: string;
  order_id?: string;
  patient_name: string;
  patient_phone: string;
  delivery_address: string;
  status: string;
  medicines?: Array<{ name: string; dosage: string; qty: number; price: number; available: boolean }>;
  grand_total: number;
  sub_total?: number;
  platform_fee?: number;
  delivery_fee?: number;
  payment_status?: string;
  delivery_code?: string;
  is_express_delivery?: boolean;
  assigned_partner_id?: string;
  created_at: string;
}

const STATUS_CFG: Record<string, { label: string; cls: string; dot: string }> = {
  reviewed:   { label: "Awaiting Dispatch", cls: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  dispatched: { label: "Out for Delivery", cls: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  completed:  { label: "Delivered",        cls: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
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

const LogisticsDashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState<string>("Delivery Partner");
  const [isVerifying, setIsVerifying] = useState(true);

  // ─── SECURITY GUARD ────────────────────────────────────────────────────────
  useEffect(() => {
    async function checkAuth() {
      const ok = await verifyPartnerSession("logistics");
      if (!ok) {
        toast.error("Unauthorized: Session expired or invalid");
        clearAdminSession();
        navigate("/admin/login/logistics");
      } else {
        const raw = localStorage.getItem("aaroksha_partner_session");
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            setPartnerId(parsed.partner_id);
            setPartnerName(parsed.name || "Delivery Partner");
          } catch {}
        }
      }
      setIsVerifying(false);
    }
    checkAuth();
  }, [navigate]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");
  const [verifying, setVerifying] = useState(false);

  // ── Fetch orders ───────────────────────────────────────────────────────────
  const { data: orders = [], isLoading } = useQuery<DeliveryOrder[]>({
    queryKey: ["logistics-orders", partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from("prescriptions")
        .select("*")
        .eq("assigned_partner_id", partnerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as DeliveryOrder[];
    },
    enabled: !!partnerId,
    refetchInterval: 10000,
  });

  const selected = orders.find((o) => o.id === selectedId);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const dispatchMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prescriptions").update({ status: "dispatched", updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logistics-orders"] });
      toast.success("Delivery started. Proceed to customer location.");
    }
  });

  const completeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prescriptions").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logistics-orders"] });
      toast.success("Delivery marked as completed successfully!");
      setSelectedId(null);
      setCodeInput("");
    }
  });

  const handleVerifyDelivery = async () => {
    if (!selected) return;
    setCodeError("");
    const expectedCode = selected.delivery_code?.toUpperCase();
    if (!expectedCode) {
      setCodeError("This order does not have a delivery code yet. Customer may not have paid.");
      return;
    }
    if (codeInput.trim().toUpperCase() !== expectedCode) {
      setCodeError("Invalid delivery code. Please check with the customer.");
      return;
    }
    setVerifying(true);
    await completeMutation.mutateAsync(selected.id);
    setVerifying(false);
  };

  const filteredOrders = orders.filter((o) => {
    const q = search.toLowerCase();
    const matchSearch = o.patient_name?.toLowerCase().includes(q) || o.order_id?.toLowerCase().includes(q);
    const matchStatus = statusFilter === "All" || o.status === statusFilter.toLowerCase();
    return matchSearch && matchStatus;
  });

  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === "reviewed").length,
    active: orders.filter((o) => o.status === "dispatched").length,
    completed: orders.filter((o) => o.status === "completed").length,
  };

  if (isVerifying) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-900 text-white">
      <Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-4" />
      <p className="font-black text-sm uppercase tracking-widest italic">Aaroksha Logistics</p>
      <p className="text-slate-500 text-[10px] mt-2 tracking-[0.2em] font-bold">Encrypted Connection Verified</p>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 flex items-center justify-between px-8 py-4 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <Truck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900">{partnerName}</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Partner Operations Hub</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-black uppercase tracking-wider">
              {stats.active} Active Deliveries
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
        </div>
      </header>

      <main className="flex-1 p-8 space-y-6">
        <div className="max-w-6xl mx-auto space-y-6">
          
          {/* Dashboard Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Assigned Orders", val: stats.total, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Awaiting Dispatch", val: stats.pending, color: "text-amber-600", bg: "bg-amber-50" },
              { label: "Active Drops", val: stats.active, color: "text-indigo-600", bg: "bg-indigo-50" },
              { label: "Completed Today", val: stats.completed, color: "text-emerald-600", bg: "bg-emerald-50" },
            ].map((s, i) => (
              <div key={i} className={`bg-white p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md`}>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">{s.label}</p>
                <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Orders List */}
            <div className="lg:col-span-4 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  placeholder="Order ID or Patient..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-11 bg-white border border-gray-100 rounded-2xl pl-10 pr-4 text-sm focus:outline-none focus:border-indigo-400 transition-all shadow-sm"
                />
              </div>

              <div className="space-y-3">
                {isLoading ? (
                  <div className="py-20 text-center text-gray-400 font-bold italic"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />Syncing with Cloud...</div>
                ) : filteredOrders.length === 0 ? (
                  <div className="py-20 text-center text-gray-400 font-medium bg-white rounded-3xl border border-gray-100 border-dashed">No active deliveries assigned</div>
                ) : filteredOrders.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setSelectedId(o.id)}
                    className={`w-full text-left p-5 rounded-3xl border transition-all relative overflow-hidden group ${
                      selectedId === o.id ? "bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-200" : "bg-white border-gray-100 hover:border-indigo-200 text-gray-900 shadow-sm"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{o.order_id || `#${o.id.slice(0, 8)}`}</p>
                      <StatusBadge status={o.status} />
                    </div>
                    <p className="font-black text-sm">{o.patient_name}</p>
                    <p className={`text-[10px] font-bold mt-1 line-clamp-1 opacity-60`}>{o.delivery_address}</p>
                    {o.is_express_delivery && <div className="absolute top-0 right-0 h-10 w-10 bg-amber-400/20 rounded-bl-3xl flex items-center justify-center text-xs">⚡</div>}
                  </button>
                ))}
              </div>
            </div>

            {/* Order Details & Verification */}
            <div className="lg:col-span-8">
              {!selected ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-[40px] border border-gray-100 border-dashed shadow-sm">
                  <div className="h-20 w-20 bg-indigo-50 rounded-3xl flex items-center justify-center mb-6">
                    <Package className="h-10 w-10 text-indigo-600 opacity-20" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 uppercase">Select delivery task</h3>
                  <p className="text-sm text-slate-400 mt-2 max-w-xs">Pick a task from the sidebar to view details, location, and verify delivery code.</p>
                </div>
              ) : (
                <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl overflow-hidden flex flex-col h-full ring-1 ring-black/[0.02]">
                  <div className="p-8 pb-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                        <User className="h-6 w-6" />
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-slate-900">{selected.patient_name}</h2>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
                          <Phone className="h-3 w-3" /> {selected.patient_phone}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                       <StatusBadge status={selected.status} />
                    </div>
                  </div>

                  <div className="p-8 pt-4 space-y-8 flex-1 overflow-y-auto">
                    {/* Location Section */}
                    <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="h-10 w-10 bg-white rounded-xl border border-slate-200 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                          <MapPin className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Delivery Destination</p>
                          <p className="text-sm font-bold text-slate-700 leading-relaxed">{selected.delivery_address}</p>
                        </div>
                        <button className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-100 active:scale-95 transition-all">
                          Navigate <ExternalLink className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-600 w-2/3 rounded-full animate-pulse transition-all duration-1000" />
                      </div>
                    </div>

                    {/* Workflow Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-4">
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                             <RefreshCcw className="h-4 w-4 text-indigo-600" /> Delivery Workflow
                          </h4>
                          {selected.status === "reviewed" ? (
                            <div className="p-6 bg-blue-50 border border-blue-100 rounded-3xl space-y-4">
                               <p className="text-sm font-bold text-blue-700 leading-relaxed">Confirm that you have picked up the package and are starting the delivery process.</p>
                               <button 
                                 onClick={() => dispatchMutation.mutate(selected.id)}
                                 disabled={dispatchMutation.isPending}
                                 className="w-full h-12 bg-blue-600 text-white font-black text-sm uppercase rounded-2xl shadow-lg shadow-blue-100 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                               >
                                 {dispatchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                                 Start Delivery
                               </button>
                            </div>
                          ) : selected.status === "dispatched" ? (
                             <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl">
                               <div className="flex items-center gap-2 text-indigo-600 mb-3">
                                  <Truck className="h-4 w-4 animate-bounce" />
                                  <span className="text-xs font-black uppercase tracking-widest italic">Out for Delivery</span>
                               </div>
                               <p className="text-sm font-bold text-slate-600">The package is currently in transit. Use the secure verification panel after reaching the customer to complete delivery.</p>
                             </div>
                          ) : (
                             <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-3xl flex items-center justify-center text-center">
                                <div>
                                   <div className="h-12 w-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-200">
                                      <CheckCircle2 className="h-6 w-6" />
                                   </div>
                                   <p className="text-sm font-black text-emerald-700 uppercase italic">Successfully Delivered</p>
                                   <p className="text-[10px] text-emerald-600 mt-1 font-bold">Closed on {new Date(selected.created_at).toLocaleDateString()}</p>
                                </div>
                             </div>
                          )}
                       </div>

                       {/* CODE VERIFICATION */}
                       <div className="space-y-4">
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                             <KeyRound className="h-4 w-4 text-indigo-600" /> Secure Verification
                          </h4>
                          <div className={`p-6 rounded-3xl border-2 transition-all ${selected.status === 'dispatched' ? 'bg-white border-indigo-600 ring-4 ring-indigo-50 border-dashed' : 'bg-slate-50 border-slate-200 grayscale opacity-40 select-none'}`}>
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Enter Customer Code</p>
                             <div className="space-y-4">
                                <div className="relative">
                                   <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-indigo-600" />
                                   <input 
                                     disabled={selected.status !== 'dispatched'}
                                     value={codeInput}
                                     onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                                     placeholder="D-XXXXXX"
                                     className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 text-center text-xl font-black tracking-[0.2em] focus:outline-none focus:bg-white focus:border-indigo-600 transition-all uppercase placeholder:text-slate-300 placeholder:tracking-normal"
                                   />
                                </div>
                                {codeError && <div className="flex items-center gap-2 text-red-500 bg-red-50 p-3 rounded-xl border border-red-100"> <AlertCircle className="h-4 w-4" /> <span className="text-[10px] font-black leading-tight">{codeError}</span> </div>}
                                <button 
                                  onClick={handleVerifyDelivery}
                                  disabled={selected.status !== 'dispatched' || verifying}
                                  className="w-full h-14 bg-indigo-600 text-white font-black text-sm uppercase rounded-2xl shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:shadow-none"
                                >
                                  {verifying ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify & Complete"}
                                </button>
                             </div>
                          </div>
                          <p className="text-[9px] text-slate-400 font-bold leading-relaxed px-2">Secure verification requires the unique 6-character code sent to the customer after payment. Enter this code to finalize the order.</p>
                       </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LogisticsDashboard;
