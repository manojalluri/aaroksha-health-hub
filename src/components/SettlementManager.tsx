import React, { useState, useEffect } from "react";
import { 
  CreditCard, Search, Calendar, Filter, 
  IndianRupee, Download, CheckCircle2, 
  Clock, X, RefreshCw, Loader2, ArrowUpRight, ArrowDownLeft, Building2, ChevronRight, FileText
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

interface SettlementManagerProps {
  userType: "super_admin" | "partner";
  partnerId?: string;
  partnerType?: string;
}

export const SettlementManager: React.FC<SettlementManagerProps> = ({ userType, partnerId, partnerType }) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [directionFilter, setDirectionFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedSettlement, setSelectedSettlement] = useState<any>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Fetch Settlements
  const { data: settlements = [], isLoading, refetch } = useQuery({
    queryKey: ["settlements", userType, partnerId, dateFilter, statusFilter, directionFilter],
    queryFn: async () => {
      let q = supabase.from("settlements").select("*").order("created_at", { ascending: false });
      
      if (userType === "partner" && partnerId) {
        q = q.eq("partner_id", partnerId);
      }
      
      if (statusFilter !== "ALL") {
        q = q.eq("settlement_status", statusFilter);
      }

      if (directionFilter !== "ALL") {
        q = q.eq("settlement_direction", directionFilter);
      }

      // Handle dates
      if (dateFilter !== "all") {
        const today = new Date();
        if (dateFilter === "today") {
          q = q.gte("created_at", new Date(today.setHours(0,0,0,0)).toISOString());
        } else if (dateFilter === "week") {
          const lastWeek = new Date(today.setDate(today.getDate() - 7));
          q = q.gte("created_at", lastWeek.toISOString());
        } else if (dateFilter === "month") {
          const lastMonth = new Date(today.setMonth(today.getMonth() - 1));
          q = q.gte("created_at", lastMonth.toISOString());
        }
      }

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 10000, // Sync every 10 seconds
  });

  // Fetch History for selected settlement
  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ["settlement_history", selectedSettlement?.id],
    queryFn: async () => {
      if (!selectedSettlement) return [];
      const { data, error } = await supabase
        .from("settlement_history")
        .select("*")
        .eq("settlement_id", selectedSettlement.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedSettlement && isHistoryModalOpen,
  });

  // Update Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus, notes }: { id: string, newStatus: string, notes: string }) => {
      const { data, error } = await supabase.rpc("update_settlement_status", {
        p_settlement_id: id,
        p_new_status: newStatus,
        p_updated_by: userType === "super_admin" ? "Super Admin" : "Partner",
        p_notes: notes,
        p_transaction_ref: `TXN-${Date.now()}`
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Settlement status updated successfully");
      queryClient.invalidateQueries({ queryKey: ["settlements"] });
      if (selectedSettlement) {
        queryClient.invalidateQueries({ queryKey: ["settlement_history"] });
      }
      setIsHistoryModalOpen(false);
      setSelectedSettlement(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update status");
    }
  });

  // Calculate stats
  const pendingReceivables = settlements.filter(s => s.settlement_status === "PENDING_RECEIVE").reduce((sum, s) => sum + Number(s.net_settlement_amount), 0);
  const receivedAmount = settlements.filter(s => s.settlement_status === "RECEIVED").reduce((sum, s) => sum + Number(s.net_settlement_amount), 0);
  const pendingPayouts = settlements.filter(s => s.settlement_status === "PENDING_PAYOUT").reduce((sum, s) => sum + Number(s.net_settlement_amount), 0);
  const paidAmount = settlements.filter(s => s.settlement_status === "PAID").reduce((sum, s) => sum + Number(s.net_settlement_amount), 0);

  const handleUpdateStatus = (settlement: any, newStatus: string) => {
    if (!confirm(`Are you sure you want to mark this settlement as ${newStatus.replace('_', ' ')}?`)) return;
    
    updateStatusMutation.mutate({
      id: settlement.id,
      newStatus,
      notes: `Manually marked as ${newStatus} by ${userType === "super_admin" ? "Super Admin" : "Partner"}`
    });
  };

  const filteredSettlements = settlements.filter(s => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (s.order_id?.toLowerCase().includes(term) || 
            s.partner_name?.toLowerCase().includes(term) ||
            s.transaction_id?.toLowerCase().includes(term));
  });

  const downloadCSV = () => {
    const headers = "Order ID,Transaction ID,Partner Name,Type,Mode,Direction,Gross,Commission %,Commission Amt,Net Amt,Status,Date\n";
    const rows = filteredSettlements.map(s => 
      `${s.order_id},${s.transaction_id || ''},${s.partner_name || ''},${s.partner_type},${s.settlement_mode},${s.settlement_direction},${s.gross_amount},${s.commission_percentage},${s.commission_amount},${s.net_settlement_amount},${s.settlement_status},${s.created_at}`
    ).join("\n");
    
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Settlements_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Settlement Management</h2>
          <p className="text-slate-500 text-sm">Enterprise accounting & reconciliations</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> Sync
          </button>
          <button onClick={downloadCSV} className="flex items-center gap-2 px-4 py-2 bg-[#0F172A] text-white rounded-xl text-sm font-bold shadow-lg shadow-slate-200 hover:bg-slate-800">
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Pending Receivables", value: pendingReceivables, icon: <ArrowDownLeft className="h-5 w-5" />, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Received Amount", value: receivedAmount, icon: <CheckCircle2 className="h-5 w-5" />, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Pending Payouts", value: pendingPayouts, icon: <ArrowUpRight className="h-5 w-5" />, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Paid Amount", value: paidAmount, icon: <IndianRupee className="h-5 w-5" />, color: "text-blue-600", bg: "bg-blue-50" },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${stat.bg} ${stat.color}`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <p className="text-2xl font-black text-slate-800">₹{stat.value.toLocaleString("en-IN")}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search Order ID, Partner..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-blue-400 focus:bg-white transition-all"
          />
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none w-full md:w-auto">
            <option value="ALL">All Statuses</option>
            <option value="PENDING_RECEIVE">Pending Receive</option>
            <option value="RECEIVED">Received</option>
            <option value="PENDING_PAYOUT">Pending Payout</option>
            <option value="PAID">Paid</option>
          </select>
          <select value={directionFilter} onChange={e => setDirectionFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none w-full md:w-auto">
            <option value="ALL">All Types</option>
            <option value="RECEIVABLE">Receivable (To Us)</option>
            <option value="PAYABLE">Payable (To Partner)</option>
          </select>
          <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none w-full md:w-auto">
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Past 7 Days</option>
            <option value="month">Past 30 Days</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Order Info</th>
                {userType === "super_admin" && (
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Partner</th>
                )}
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Financials</th>
                <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Status</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredSettlements.length === 0 ? (
                <tr>
                  <td colSpan={userType === "super_admin" ? 5 : 4} className="px-6 py-12 text-center text-slate-400 text-sm font-medium">
                    No settlement records found.
                  </td>
                </tr>
              ) : (
                filteredSettlements.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900 text-sm">#{s.order_id}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{format(new Date(s.created_at), 'dd MMM yyyy, hh:mm a')}</p>
                    </td>
                    
                    {userType === "super_admin" && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">{s.partner_name || "Unknown"}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.partner_type}</p>
                          </div>
                        </div>
                      </td>
                    )}

                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <p className="text-xs text-slate-500"><span className="font-medium">Gross:</span> ₹{s.gross_amount}</p>
                        <p className="text-[10px] text-slate-400"><span className="font-medium">Comm ({s.commission_percentage}%):</span> <span className="text-red-500 font-bold">₹{s.commission_amount}</span></p>
                        <div className="h-px w-16 bg-slate-100 my-0.5" />
                        <p className={`text-sm font-black ${s.settlement_direction === "RECEIVABLE" ? "text-emerald-600" : "text-blue-600"}`}>
                          {s.settlement_direction === "RECEIVABLE" ? "+₹" : "-₹"}{s.net_settlement_amount}
                        </p>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                          s.settlement_status === "RECEIVED" ? "bg-emerald-50 text-emerald-600" :
                          s.settlement_status === "PAID" ? "bg-blue-50 text-blue-600" :
                          "bg-amber-50 text-amber-600"
                        }`}>
                          {s.settlement_status.replace("_", " ")}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400">
                          {s.settlement_mode.replace("_", " ")}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => { setSelectedSettlement(s); setIsHistoryModalOpen(true); }}
                          className="h-8 w-8 rounded-lg bg-slate-50 text-slate-400 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition-all"
                          title="View Details"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                        
                        {userType === "super_admin" && s.settlement_status === "PENDING_RECEIVE" && (
                          <button 
                            onClick={() => handleUpdateStatus(s, "RECEIVED")}
                            disabled={updateStatusMutation.isPending}
                            className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200"
                          >
                            Mark Received
                          </button>
                        )}
                        
                        {userType === "super_admin" && s.settlement_status === "PENDING_PAYOUT" && (
                          <button 
                            onClick={() => handleUpdateStatus(s, "PAID")}
                            disabled={updateStatusMutation.isPending}
                            className="px-3 py-1.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
                          >
                            Mark Paid
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* History Modal */}
      {isHistoryModalOpen && selectedSettlement && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-black text-slate-800">Settlement Details</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Order #{selectedSettlement.order_id}</p>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="h-8 w-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Financial Breakdown</p>
                  <div className="space-y-1.5 mt-3">
                    <div className="flex justify-between text-sm"><span className="text-slate-500">Gross Amount</span><span className="font-bold text-slate-700">₹{selectedSettlement.gross_amount}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-500">Commission ({selectedSettlement.commission_percentage}%)</span><span className="font-bold text-red-500">-₹{selectedSettlement.commission_amount}</span></div>
                    <div className="h-px bg-slate-200 my-2" />
                    <div className="flex justify-between text-base"><span className="font-black text-slate-800">Net {selectedSettlement.settlement_direction === 'RECEIVABLE' ? 'Receivable' : 'Payable'}</span><span className="font-black text-blue-600">₹{selectedSettlement.net_settlement_amount}</span></div>
                  </div>
                </div>
                
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Meta Information</p>
                  <div className="space-y-2 mt-3">
                    <div><span className="text-[10px] text-slate-400 block uppercase font-bold">Partner</span><span className="text-sm font-bold text-slate-700">{selectedSettlement.partner_name} ({selectedSettlement.partner_type})</span></div>
                    <div><span className="text-[10px] text-slate-400 block uppercase font-bold">Mode</span><span className="text-sm font-bold text-slate-700">{selectedSettlement.settlement_mode.replace('_', ' ')}</span></div>
                    <div><span className="text-[10px] text-slate-400 block uppercase font-bold">Status</span>
                      <span className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        selectedSettlement.settlement_status.includes('PENDING') ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                      }`}>{selectedSettlement.settlement_status.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>
              </div>

              <h4 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2"><Clock className="h-4 w-4 text-slate-400" /> Timeline & History</h4>
              
              {historyLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
              ) : (
                <div className="relative pl-4 space-y-6 before:absolute before:inset-y-0 before:left-[11px] before:w-0.5 before:bg-slate-100">
                  {history.map((h: any, i: number) => (
                    <div key={h.id} className="relative">
                      <div className="absolute -left-[25px] top-1 h-3 w-3 rounded-full bg-blue-500 ring-4 ring-white" />
                      <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm ml-2">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{format(new Date(h.created_at), 'dd MMM yyyy, hh:mm a')}</p>
                          <p className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">By: {h.updated_by}</p>
                        </div>
                        <p className="text-sm font-bold text-slate-700">
                          {h.previous_status ? (
                            <>Status changed from <span className="text-slate-400">{h.previous_status}</span> to <span className="text-blue-600">{h.new_status}</span></>
                          ) : (
                            <>Settlement created with status <span className="text-blue-600">{h.new_status}</span></>
                          )}
                        </p>
                        {h.payment_notes && (
                          <p className="text-xs text-slate-500 mt-2 bg-slate-50 p-2 rounded-lg italic">"{h.payment_notes}"</p>
                        )}
                        {h.transaction_reference && (
                          <p className="text-xs font-mono text-slate-400 mt-1">Ref: {h.transaction_reference}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button onClick={() => setIsHistoryModalOpen(false)} className="px-5 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-100 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
