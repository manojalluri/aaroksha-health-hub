import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Truck, Search, CheckCircle, Package,
  Phone, MapPin, BarChart3, Clock,
  LogOut, Loader2, ClipboardList, FlaskConical, Map,
  IndianRupee, Download, Menu, X
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { verifyPartnerSession, clearAdminSession, revokePartnerSession, getPartnerIdFromSession } from "@/lib/adminAuth";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DeliveryOrder {
  id: string;
  order_id?: string;
  patient_name: string;
  patient_phone: string;
  delivery_address: string;
  created_at: string;
  status: string;
  delivery_fee?: number;
  delivery_code?: string;
  type: 'prescription' | 'lab';
}

// ─── Status helpers ────────────────────────────────────────────────────────────
const statusStyle: Record<string, string> = {
  pending:    "bg-amber-100 text-amber-700 border-amber-200",
  confirmed:  "bg-blue-100 text-blue-700 border-blue-200",
  dispatched: "bg-orange-100 text-orange-700 border-orange-200",
  completed:  "bg-emerald-100 text-emerald-700 border-emerald-200",
  collected:  "bg-violet-100 text-violet-700 border-violet-200",
  processing: "bg-sky-100 text-sky-700 border-sky-200",
};

const LogisticsDashboard = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [isVerifying, setIsVerifying] = useState(true);

  // ─── SECURITY GUARD ──────────────────────────────────────────────────────
  useEffect(() => {
    async function checkAuth() {
      const ok = await verifyPartnerSession("logistics");
      if (!ok) {
        toast.error("Unauthorized: Session expired or invalid");
        clearAdminSession();
        navigate("/admin/login/logistics");
        return;
      }
      
      const pid = getPartnerIdFromSession();
      if (pid) {
        const { data: p } = await supabase.from("partners").select("*").eq("partner_id", pid).single();
        if (p) {
          setPartner(p);
          if (p.category === "lab") {
            setActiveTab("labs");
          } else {
            setActiveTab("prescriptions");
          }
        }
      }

      setIsVerifying(false);
    }
    checkAuth();
  }, [navigate]);

  const [partner, setPartner] = useState<any>(null);

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("prescriptions");
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null);
  
  // OTP Verification state
  const [verifyingOrder, setVerifyingOrder] = useState<DeliveryOrder | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [historyFilter, setHistoryFilter] = useState("all");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // ─── Fetch data from Supabase ───────────────────────────────────
  const { data: prescriptions = [], isLoading: loadingRx } = useQuery<DeliveryOrder[]>({
    queryKey: ["logistics-prescriptions", partner?.partner_id],
    enabled: !!partner?.partner_id && (!partner?.category || partner.category === "pharmacy"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prescriptions")
        .select("*")
        .eq("logistics_partner_id", partner.partner_id)
        .in("status", ["reviewed", "dispatched", "completed"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(d => ({ ...d, type: 'prescription' })) as DeliveryOrder[];
    },
    refetchInterval: 30000,
  });

  const { data: labBookings = [], isLoading: loadingLab } = useQuery<DeliveryOrder[]>({
    queryKey: ["logistics-labs", partner?.partner_id],
    enabled: !!partner?.partner_id && (!partner?.category || partner.category === "lab"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lab_bookings")
        .select("*")
        .eq("logistics_partner_id", partner.partner_id)
        .in("status", ["confirmed", "collected", "processing", "completed"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(d => ({
        id: d.id,
        order_id: d.order_id,
        patient_name: d.patient_name,
        patient_phone: d.patient_phone,
        delivery_address: d.patient_address,
        created_at: d.created_at,
        status: d.status,
        delivery_fee: 49,
        delivery_code: d.collection_code,
        type: 'lab'
      })) as DeliveryOrder[];
    },
    refetchInterval: 30000,
  });

  // ─── Earnings Data ──────────────────────────────────────────────────────────
  const earnings = useMemo(() => {
    const completedRx = (partner?.category === 'pharmacy' || !partner?.category) ? prescriptions.filter(p => p.status === 'completed') : [];
    const completedLab = (partner?.category === 'lab' || !partner?.category) ? labBookings.filter(l => l.status === 'completed') : [];
    const rxRev = completedRx.reduce((sum, p) => sum + (p.delivery_fee || 40), 0);
    const labRev = completedLab.reduce((sum, l) => sum + (l.delivery_fee || 49), 0);
    const total = rxRev + labRev;

    // Platform share logic (Logistics often has fixed fee per delivery OR percentage)
    const commRate = partner?.commission_rate || 30; // default 30%
    const commType = partner?.commission_type || "percentage";
    const platformShare = commType === "percentage" ? (total * commRate) / 100 : (completedRx.length + completedLab.length) * commRate;

    const pendingRx = prescriptions.filter(p => p.status !== 'completed').length;
    const pendingLab = labBookings.filter(l => l.status !== 'completed').length;

    return {
      total,
      count: completedRx.length + completedLab.length,
      pendingCount: pendingRx + pendingLab,
      rxCount: completedRx.length,
      labCount: completedLab.length,
      rx: rxRev,
      lab: labRev,
      platformShare,
      netPayable: total - platformShare
    };
  }, [prescriptions, labBookings, partner]);

  // ─── Update order status ──────────────────────────────────────────

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, type }: { id: string; status: string; type: 'prescription' | 'lab' }) => {
      const table = type === 'prescription' ? 'prescriptions' : 'lab_bookings';
      const { error } = await supabase.from(table).update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      const key = variables.type === 'prescription' ? "logistics-prescriptions" : "logistics-labs";
      qc.invalidateQueries({ queryKey: [key] });
      toast.success("Status updated!");
    },
    onError: (err: any) => toast.error("Update failed: " + err.message),
  });

  const handleVerifyOtp = () => {
    if (!verifyingOrder) return;
    
    // Check if OTP matches
    const correctCode = verifyingOrder.delivery_code;
    
    if (!correctCode) {
      // If for some reason the order doesn't have a code in DB (old order), just allow it or handle it.
      // We will allow it but warn.
      toast.warning("No code found for this order, completing directly.");
      updateMutation.mutate({ id: verifyingOrder.id, status: verifyingOrder.type === 'lab' ? 'collected' : 'completed', type: verifyingOrder.type });
      setVerifyingOrder(null);
      setOtpInput("");
      return;
    }

    if (otpInput.trim().toUpperCase() === correctCode.toUpperCase()) {
      updateMutation.mutate({ id: verifyingOrder.id, status: verifyingOrder.type === 'lab' ? 'collected' : 'completed', type: verifyingOrder.type });
      setVerifyingOrder(null);
      setOtpInput("");
    } else {
      toast.error("Invalid verification code. Please check with the patient.");
    }
  };

  const handleLogout = async () => {
    await revokePartnerSession();
    clearAdminSession();
    navigate("/admin/login/logistics");
  };

  const filteredRx = prescriptions.filter(o => 
    (o.patient_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (o.order_id || o.id).toLowerCase().includes(search.toLowerCase())
  );

  const filteredLab = labBookings.filter(o => 
    (o.patient_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (o.order_id || o.id).toLowerCase().includes(search.toLowerCase())
  );

  if (isVerifying) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-sky-600" />
        <p className="font-bold text-slate-400">Verifying Partner Session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-md">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 overflow-hidden">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="font-black text-xs tracking-tight uppercase">Fleet</h1>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-300 hover:text-white">
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {/* Sidebar - Desktop & Mobile Overlay */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <div className="h-12 w-12 overflow-hidden shrink-0">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="font-black text-sm tracking-tight uppercase">Logistics</h1>
            <p className="text-[10px] text-sky-400 font-bold uppercase tracking-widest">Aaroksha Partner</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {[
            { id: 'prescriptions', icon: <Package className="h-4 w-4" />, label: 'Deliveries', show: !partner?.category || partner.category === 'pharmacy' },
            { id: 'labs', icon: <FlaskConical className="h-4 w-4" />, label: 'Collections', show: !partner?.category || partner.category === 'lab' },
            { id: 'stats', icon: <BarChart3 className="h-4 w-4" />, label: 'Performance', show: true },
          ].filter(item => item.show).map(item => (
            <button 
              key={item.id} 
              onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }} 
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all ${activeTab === item.id ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-400 hover:bg-red-400/10 transition-all">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>

      {/* Mobile Overlay Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-4 md:p-8 overflow-x-hidden">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              {activeTab === 'prescriptions' ? 'Medicine Deliveries' : activeTab === 'labs' ? 'Lab Test Collections' : 'Performance Analytics'}
            </h2>
            <p className="text-slate-400 text-xs md:text-sm font-medium">Manage your assignments and track efficiency.</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
             <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search orders..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-11 rounded-xl border-slate-200 bg-white" 
                />
             </div>
          </div>
        </header>

        {(loadingRx || loadingLab) ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
             <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
             <p className="text-slate-400 font-bold text-sm">Loading assignments...</p>
          </div>
        ) : activeTab === 'stats' ? (
          <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             {/* Delivery Stats Row */}
             <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                   { label: "Total Completed", value: earnings.count, icon: <CheckCircle className="h-5 w-5 text-emerald-600" />, accent: "bg-emerald-50" },
                   { label: "Pending Tasks",   value: earnings.pendingCount, icon: <Clock className="h-5 w-5 text-amber-600" />, accent: "bg-amber-50" },
                   { label: "Medicine Deliveries", value: earnings.rxCount, icon: <Package className="h-5 w-5 text-sky-600" />, accent: "bg-sky-50" },
                   { label: "Lab Collections",   value: earnings.labCount, icon: <FlaskConical className="h-5 w-5 text-violet-600" />, accent: "bg-violet-50" },
                ].map(s => (
                   <div key={s.label} className="bg-white rounded-[2rem] border border-slate-100 p-6 flex items-center gap-4 shadow-sm hover:shadow-md transition-all">
                      <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${s.accent} shrink-0`}>{s.icon}</div>
                      <div>
                         <p className="text-2xl font-black text-slate-900 leading-none">{s.value}</p>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">{s.label}</p>
                      </div>
                   </div>
                ))}
             </div>

             {/* History Table */}
             <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                   <div>
                      <h3 className="text-xl font-black text-slate-800 italic">Job History</h3>
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Review your completed deliveries and collections</p>
                   </div>
                   
                   <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100 self-start">
                      {['all', 'today', 'yesterday', 'month'].map(f => (
                        <button key={f} onClick={() => setHistoryFilter(f)}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${historyFilter === f ? "bg-white text-sky-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>
                          {f}
                        </button>
                      ))}
                   </div>
                </div>

                <div className="overflow-x-auto">
                   <Table>
                      <TableHeader className="bg-slate-50/50">
                         <TableRow>
                            <TableHead className="px-8 py-5 font-black text-[10px] uppercase tracking-widest text-slate-400">Order/Booking ID</TableHead>
                            <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Type</TableHead>
                            <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Patient</TableHead>
                            <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Date Completed</TableHead>
                            <TableHead className="text-right px-8 font-black text-[10px] uppercase tracking-widest text-slate-400">Status</TableHead>
                         </TableRow>
                      </TableHeader>
                      <TableBody>
                         {[...prescriptions, ...labBookings]
                           .filter(p => p.status === 'completed')
                           .filter(p => {
                             const date = new Date(p.created_at);
                             const now = new Date();
                             if (historyFilter === 'today') return date.toDateString() === now.toDateString();
                             if (historyFilter === 'yesterday') {
                               const y = new Date(); y.setDate(now.getDate() - 1);
                               return date.toDateString() === y.toDateString();
                             }
                             if (historyFilter === 'month') {
                               const m = new Date(); m.setMonth(now.getMonth() - 1);
                               return date >= m;
                             }
                             return true;
                           })
                           .slice(0, 50)
                           .map(p => (
                            <TableRow key={p.id} className="hover:bg-slate-50/50 transition-colors">
                               <TableCell className="px-8 py-5 font-mono text-xs font-black text-slate-400">
                                 {p.order_id || p.id.slice(0, 8).toUpperCase()}
                               </TableCell>
                               <TableCell>
                                 <span className={`inline-flex px-2 py-1 rounded-lg text-[9px] font-black uppercase ${p.type === 'prescription' ? 'bg-sky-50 text-sky-600' : 'bg-violet-50 text-violet-600'}`}>
                                   {p.type === 'prescription' ? 'Medicine' : 'Lab'}
                                 </span>
                               </TableCell>
                               <TableCell className="font-bold text-slate-700 text-sm">{p.patient_name}</TableCell>
                               <TableCell className="text-xs text-slate-400">{new Date(p.created_at).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })}</TableCell>
                               <TableCell className="text-right px-8">
                                 <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                                   <CheckCircle className="h-3 w-3" /> Delivered
                                 </span>
                               </TableCell>
                            </TableRow>
                         ))}
                         {([...prescriptions, ...labBookings].filter(p => p.status === 'completed').length === 0) && (
                           <TableRow>
                             <TableCell colSpan={5} className="py-20 text-center">
                               <div className="h-16 w-16 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                 <ClipboardList className="h-8 w-8 text-slate-300" />
                               </div>
                               <p className="font-black text-slate-400 text-sm">No delivery history found</p>
                             </TableCell>
                           </TableRow>
                         )}
                      </TableBody>
                   </Table>
                </div>
             </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
               <Table>
                 <TableHeader className="bg-slate-50/50">
                   <TableRow>
                     <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-4">Order ID</TableHead>
                     <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Patient</TableHead>
                     <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Location</TableHead>
                     <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Status</TableHead>
                     <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Time</TableHead>
                     <TableHead className="text-right">Actions</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {(activeTab === 'prescriptions' ? filteredRx : filteredLab).map((order) => (
                     <TableRow key={order.id} className="hover:bg-slate-50/50 transition-colors">
                       <TableCell className="font-bold text-slate-900">{order.order_id || 'ID-'+order.id.slice(0,4)}</TableCell>
                       <TableCell>
                         <div>
                            <p className="font-bold text-sm text-slate-800">{order.patient_name}</p>
                            <p className="text-[11px] text-slate-400 font-medium">{order.patient_phone}</p>
                         </div>
                       </TableCell>
                       <TableCell>
                         <p className="text-sm font-medium text-slate-600 line-clamp-1 max-w-[200px]">{order.delivery_address}</p>
                       </TableCell>
                       <TableCell>
                         <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusStyle[order.status] || "bg-slate-100"}`}>
                           {order.status}
                         </span>
                       </TableCell>
                       <TableCell className="text-xs text-slate-400 font-medium">
                         {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                       </TableCell>
                       <TableCell className="text-right">
                         <div className="flex justify-end gap-2">
                           {order.status !== 'completed' && order.status !== 'collected' && order.status !== 'cancelled' && (
                              <button 
                                onClick={() => {
                                  setVerifyingOrder(order);
                                  setOtpInput("");
                                }}
                                className="h-8 px-3 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 text-xs font-bold transition-all"
                              >
                                Verify & {order.type === 'lab' ? 'Collect' : 'Deliver'}
                              </button>
                           )}
                           <button 
                               onClick={() => setSelectedOrder(order)}
                               className="h-8 w-8 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-all"
                             >
                             <MapPin className="h-4 w-4" />
                           </button>
                         </div>
                       </TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {(activeTab === 'prescriptions' ? filteredRx : filteredLab).map((order) => (
                <div key={order.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-black text-sky-600 uppercase tracking-widest">{order.order_id || 'ID-'+order.id.slice(0,4)}</p>
                      <h4 className="font-black text-slate-800 text-base mt-1">{order.patient_name}</h4>
                      <p className="text-xs text-slate-400 font-bold mt-0.5">{order.patient_phone}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusStyle[order.status] || "bg-slate-100"}`}>
                      {order.status}
                    </span>
                  </div>

                  <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <p className="text-xs font-medium text-slate-600 leading-relaxed">{order.delivery_address}</p>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <p className="text-[10px] font-bold text-slate-400 italic">Assign time: {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setSelectedOrder(order)}
                        className="h-10 w-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center border border-slate-200 shadow-sm"
                      >
                        <MapPin className="h-5 w-5" />
                      </button>
                      {order.status !== 'completed' && order.status !== 'collected' && order.status !== 'cancelled' && (
                        <button 
                          onClick={() => {
                            setVerifyingOrder(order);
                            setOtpInput("");
                          }}
                          className="flex-1 h-10 px-4 rounded-xl bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-100 transition-all active:scale-95"
                        >
                          Verify & {order.type === 'lab' ? 'Collect' : 'Deliver'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {(activeTab === 'prescriptions' ? filteredRx : filteredLab).length === 0 && (
              <div className="h-60 flex flex-col items-center justify-center text-slate-300 gap-2 bg-white rounded-2xl border border-slate-100 md:border-none">
                <ClipboardList className="h-12 w-12" />
                <p className="font-black text-sm">No assignments found</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Details Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-md rounded-3xl overflow-hidden border-none p-0">
          <div className="bg-sky-600 p-6 text-white text-center">
            <div className="h-12 w-12 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MapPin className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-black tracking-tight">Delivery Details</h3>
            <p className="text-sky-100 text-xs font-bold uppercase tracking-widest mt-1">Assignment Info</p>
          </div>
          {selectedOrder && (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                  <p className="text-sm font-black text-slate-900 capitalize">{selectedOrder.status}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fee</p>
                  <p className="text-sm font-black text-emerald-600">₹{selectedOrder.delivery_fee || 40}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                    <Map className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Address</Label>
                    <p className="text-sm font-bold text-slate-700 leading-relaxed">{selectedOrder.delivery_address}</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                    <Phone className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Contact</Label>
                    <p className="text-sm font-bold text-slate-700">{selectedOrder.patient_name}</p>
                    <p className="text-xs font-medium text-slate-500">{selectedOrder.patient_phone}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button className="flex-1 rounded-2xl h-12 font-black shadow-lg shadow-sky-200" onClick={() => setSelectedOrder(null)}>
                  Close
                </Button>
                {selectedOrder.status === 'pending' || selectedOrder.status === 'confirmed' || selectedOrder.status === 'reviewed' ? (
                   <Button 
                    className="flex-1 rounded-2xl h-12 font-black bg-orange-500 hover:bg-orange-600 text-white"
                    onClick={() => {
                        updateMutation.mutate({ id: selectedOrder.id, status: 'dispatched', type: selectedOrder.type });
                        setSelectedOrder(null);
                    }}
                    disabled={updateMutation.isPending}
                   >
                     Dispatch Order
                   </Button>
                ) : null}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* OTP Verification Dialog */}
      <Dialog open={!!verifyingOrder} onOpenChange={(open) => !open && setVerifyingOrder(null)}>
        <DialogContent className="max-w-xs rounded-3xl p-6 text-center">
          <DialogHeader>
            <DialogTitle className="font-black text-xl mb-2">Verify Code</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-500 font-medium">
              Ask the patient for the 6-character {verifyingOrder?.type === 'lab' ? 'collection' : 'delivery'} code shown on their profile.
            </p>
            <Input
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.toUpperCase())}
              placeholder="e.g. A1B2C3"
              className="text-center font-black tracking-widest text-lg h-14"
              maxLength={6}
            />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 rounded-2xl" onClick={() => setVerifyingOrder(null)}>
              Cancel
            </Button>
            <Button 
              className="flex-1 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black"
              onClick={handleVerifyOtp}
              disabled={otpInput.length < 5 || updateMutation.isPending}
            >
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LogisticsDashboard;
