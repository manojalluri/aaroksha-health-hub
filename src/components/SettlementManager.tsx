import React, { useState } from "react";
import {
  Search, IndianRupee, Download, CheckCircle2,
  Clock, X, RefreshCw, Loader2, ArrowDownLeft, ArrowUpRight,
  Building2, FileText, AlertCircle
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

const STATUS_LABEL: Record<string, string> = {
  PENDING_RECEIVE:     "Pending",
  PARTNER_MARKED_PAID: "Partner Paid (Awaiting Confirm)",
  RECEIVED:            "Received ✓",
  PENDING_PAYOUT:      "Pending",
  ADMIN_MARKED_PAID:   "Admin Paid (Awaiting Confirm)",
  PAID:                "Paid ✓",
};

const STATUS_COLOR: Record<string, string> = {
  PENDING_RECEIVE:     "bg-amber-50 text-amber-700 border-amber-200",
  PARTNER_MARKED_PAID: "bg-purple-50 text-purple-700 border-purple-200",
  RECEIVED:            "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDING_PAYOUT:      "bg-orange-50 text-orange-700 border-orange-200",
  ADMIN_MARKED_PAID:   "bg-purple-50 text-purple-700 border-purple-200",
  PAID:                "bg-blue-50 text-blue-700 border-blue-200",
};

export const SettlementManager: React.FC<SettlementManagerProps> = ({ userType, partnerId }) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"RECEIVABLE" | "PAYABLE">("RECEIVABLE");
  const [dateFilter, setDateFilter] = useState("all");
  const [selected, setSelected] = useState<any>(null);

  const { data: settlements = [], isLoading, refetch } = useQuery({
    queryKey: ["settlements", userType, partnerId, dateFilter],
    queryFn: async () => {
      let q = supabase.from("settlements").select("*").order("created_at", { ascending: false });
      if (userType === "partner" && partnerId) q = q.eq("partner_id", partnerId);
      if (dateFilter === "today") {
        const d = new Date(); d.setHours(0, 0, 0, 0);
        q = q.gte("created_at", d.toISOString());
      } else if (dateFilter === "week") {
        const d = new Date(); d.setDate(d.getDate() - 7);
        q = q.gte("created_at", d.toISOString());
      } else if (dateFilter === "month") {
        const d = new Date(); d.setMonth(d.getMonth() - 1);
        q = q.gte("created_at", d.toISOString());
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });

  const { data: history = [], isLoading: histLoading } = useQuery({
    queryKey: ["settlement_history", selected?.id],
    queryFn: async () => {
      if (!selected) return [];
      const { data, error } = await supabase
        .from("settlement_history").select("*")
        .eq("settlement_id", selected.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selected,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const { error } = await supabase.rpc("update_settlement_status", {
        p_settlement_id: id,
        p_new_status: newStatus,
        p_updated_by: userType === "super_admin" ? "Super Admin" : "Partner",
        p_notes: `Marked as ${newStatus}`,
        p_transaction_ref: `TXN-${Date.now()}`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Settlement updated!");
      queryClient.invalidateQueries({ queryKey: ["settlements"] });
      queryClient.invalidateQueries({ queryKey: ["settlement_history"] });
      setSelected(null);
    },
    onError: (e: any) => toast.error(e.message || "Update failed"),
  });

  const confirm = (s: any, status: string) => {
    if (!window.confirm(`Mark as ${status.replace(/_/g, " ")}?`)) return;
    updateMutation.mutate({ id: s.id, newStatus: status });
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const rec   = settlements.filter(s => s.settlement_direction === "RECEIVABLE");
  const pay   = settlements.filter(s => s.settlement_direction === "PAYABLE");

  const pendingReceive   = rec.filter(s => !["RECEIVED"].includes(s.settlement_status)).reduce((a, s) => a + Number(s.commission_amount), 0);
  const totalReceived    = rec.filter(s => s.settlement_status === "RECEIVED").reduce((a, s) => a + Number(s.commission_amount), 0);
  const pendingPay       = pay.filter(s => !["PAID"].includes(s.settlement_status)).reduce((a, s) => a + Number(s.commission_amount), 0);
  const totalPaid        = pay.filter(s => s.settlement_status === "PAID").reduce((a, s) => a + Number(s.commission_amount), 0);
  const actionCount      = settlements.filter(s => s.settlement_status === "PARTNER_MARKED_PAID" || s.settlement_status === "ADMIN_MARKED_PAID").length;

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = settlements
    .filter(s => s.settlement_direction === activeTab)
    .filter(s => !search || s.order_id?.toLowerCase().includes(search.toLowerCase()) || s.partner_name?.toLowerCase().includes(search.toLowerCase()));

  const downloadCSV = () => {
    const rows = filtered.map(s =>
      `${s.order_id},${s.partner_name},${s.partner_type},${s.settlement_direction},${s.gross_amount},${s.commission_percentage}%,${s.commission_amount},${s.settlement_status},${s.created_at}`
    );
    const blob = new Blob(["Order,Partner,Type,Direction,Gross,Rate,Commission,Status,Date\n" + rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `Settlements_${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Settlement Management</h2>
          <p className="text-slate-400 text-sm">Commission tracking & reconciliation</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> Sync
          </button>
          <button onClick={downloadCSV} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold shadow hover:bg-slate-700">
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Action Alert */}
      {actionCount > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl px-5 py-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-purple-600 shrink-0" />
          <p className="flex-1 text-sm font-bold text-purple-800">
            {actionCount} settlement{actionCount > 1 ? "s" : ""} waiting for your confirmation!
          </p>
          <button onClick={() => setActiveTab("RECEIVABLE")} className="text-xs font-black text-purple-600 underline">View</button>
        </div>
      )}

      {/* Big Stats — 2 clear flows */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* RECEIVABLE block — Partner owes Admin commission */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-amber-100 rounded-2xl flex items-center justify-center">
              {userType === "super_admin" ? <ArrowDownLeft className="h-6 w-6 text-amber-600" /> : <ArrowUpRight className="h-6 w-6 text-amber-600" />}
            </div>
            <div>
              <p className="text-xs font-black text-amber-700 uppercase tracking-widest">
                {userType === "super_admin" ? "Receivables" : "Payables"}
              </p>
              <p className="text-[11px] text-amber-600 font-medium">
                {userType === "super_admin" ? "Partner collected cash → owes commission to you" : "You collected cash → owe commission to platform"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/70 rounded-2xl p-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                {userType === "super_admin" ? "Pending Collection" : "Pending Payment"}
              </p>
              <p className="text-2xl font-black text-amber-700">₹{pendingReceive.toLocaleString("en-IN")}</p>
            </div>
            <div className="bg-white/70 rounded-2xl p-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                {userType === "super_admin" ? "Collected ✓" : "Paid ✓"}
              </p>
              <p className="text-2xl font-black text-emerald-700">₹{totalReceived.toLocaleString("en-IN")}</p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab("RECEIVABLE")}
            className={`w-full py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === "RECEIVABLE" ? "bg-amber-600 text-white shadow-lg shadow-amber-200" : "bg-white/60 text-amber-700 hover:bg-white"}`}
          >
            {activeTab === "RECEIVABLE" ? "▸ Currently Viewing" : (userType === "super_admin" ? "View Receivables →" : "View Payables →")}
          </button>
        </div>

        {/* PAYABLE block — Admin owes Partner net amount */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-blue-100 rounded-2xl flex items-center justify-center">
              {userType === "super_admin" ? <ArrowUpRight className="h-6 w-6 text-blue-600" /> : <ArrowDownLeft className="h-6 w-6 text-blue-600" />}
            </div>
            <div>
              <p className="text-xs font-black text-blue-700 uppercase tracking-widest">
                {userType === "super_admin" ? "Payables" : "Receivables"}
              </p>
              <p className="text-[11px] text-blue-600 font-medium">
                {userType === "super_admin" ? "Platform collected online → owes commission to partner" : "Platform collected online → owes commission to you"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/70 rounded-2xl p-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                {userType === "super_admin" ? "Pending Payout" : "Pending Collection"}
              </p>
              <p className="text-2xl font-black text-blue-700">₹{pendingPay.toLocaleString("en-IN")}</p>
            </div>
            <div className="bg-white/70 rounded-2xl p-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                {userType === "super_admin" ? "Paid Out ✓" : "Received ✓"}
              </p>
              <p className="text-2xl font-black text-emerald-700">₹{totalPaid.toLocaleString("en-IN")}</p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab("PAYABLE")}
            className={`w-full py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === "PAYABLE" ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-white/60 text-blue-700 hover:bg-white"}`}
          >
            {activeTab === "PAYABLE" ? "▸ Currently Viewing" : (userType === "super_admin" ? "View Payables →" : "View Receivables →")}
          </button>
        </div>
      </div>

      {/* Date Filter & Search */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-center shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text" placeholder="Search Order ID or Partner..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400"
          />
        </div>
        <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none">
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="week">Past 7 Days</option>
          <option value="month">Past 30 Days</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-3">
          <div className={`h-2 w-2 rounded-full ${activeTab === "RECEIVABLE" ? "bg-amber-500" : "bg-blue-500"}`} />
          <h3 className="font-black text-slate-800 text-sm">
            {activeTab === "RECEIVABLE" 
              ? (userType === "super_admin" ? "Receivables — Commission to Collect from Partners" : "Payables — Commission to Pay to Platform") 
              : (userType === "super_admin" ? "Payables — Commission to Pay Out to Partners" : "Receivables — Commission to Collect from Platform")}
          </h3>
          <span className="ml-auto text-xs font-black text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{filtered.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="px-6 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Order</th>
                {userType === "super_admin" && <th className="px-6 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Partner</th>}
                <th className="px-6 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Order Gross</th>
                <th className="px-6 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Commission</th>
                <th className="px-6 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr><td colSpan={6} className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400 mx-auto" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-slate-400 text-sm font-medium">No records in this category.</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-800 text-sm">#{s.order_id}</p>
                    <p className="text-[10px] text-slate-400">{format(new Date(s.created_at), "dd MMM yyyy, hh:mm a")}</p>
                  </td>
                  {userType === "super_admin" && (
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 bg-slate-100 rounded-lg flex items-center justify-center"><Building2 className="h-3.5 w-3.5 text-slate-500" /></div>
                        <div>
                          <p className="font-bold text-slate-700 text-sm">{s.partner_name || "—"}</p>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">{s.partner_type}</p>
                        </div>
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4 text-right">
                    <p className="font-bold text-slate-700 text-sm">₹{Number(s.gross_amount).toLocaleString("en-IN")}</p>
                    <p className="text-[10px] text-slate-400">{s.commission_percentage}% rate</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className={`font-black text-base ${s.settlement_direction === "RECEIVABLE" ? "text-amber-600" : "text-blue-600"}`}>
                      ₹{Number(s.commission_amount).toLocaleString("en-IN")}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase ${STATUS_COLOR[s.settlement_status] || "bg-slate-50 text-slate-600 border-slate-200"}`}>
                      {STATUS_LABEL[s.settlement_status] || s.settlement_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setSelected(s)} className="h-8 w-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center transition-all" title="View History">
                        <FileText className="h-4 w-4" />
                      </button>

                      {/* RECEIVABLE flow */}
                      {s.settlement_status === "PENDING_RECEIVE" && userType === "partner" && (
                        <button onClick={() => confirm(s, "PARTNER_MARKED_PAID")} disabled={updateMutation.isPending} className="px-3 py-1.5 bg-amber-500 text-white text-[10px] font-black rounded-lg hover:bg-amber-600 transition-all">
                          Mark Paid →
                        </button>
                      )}
                      {s.settlement_status === "PENDING_RECEIVE" && userType === "super_admin" && (
                        <span className="text-[10px] text-slate-400 font-bold">Awaiting partner</span>
                      )}
                      {s.settlement_status === "PARTNER_MARKED_PAID" && userType === "super_admin" && (
                        <button onClick={() => confirm(s, "RECEIVED")} disabled={updateMutation.isPending} className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-black rounded-lg hover:bg-emerald-700 transition-all shadow shadow-emerald-200">
                          ✓ Confirm Received
                        </button>
                      )}
                      {s.settlement_status === "PARTNER_MARKED_PAID" && userType === "partner" && (
                        <span className="text-[10px] text-purple-600 font-bold">Awaiting admin…</span>
                      )}

                      {/* PAYABLE flow */}
                      {s.settlement_status === "PENDING_PAYOUT" && userType === "super_admin" && (
                        <button onClick={() => confirm(s, "ADMIN_MARKED_PAID")} disabled={updateMutation.isPending} className="px-3 py-1.5 bg-blue-600 text-white text-[10px] font-black rounded-lg hover:bg-blue-700 transition-all shadow shadow-blue-200">
                          Mark Paid →
                        </button>
                      )}
                      {s.settlement_status === "PENDING_PAYOUT" && userType === "partner" && (
                        <span className="text-[10px] text-slate-400 font-bold">Awaiting admin</span>
                      )}
                      {s.settlement_status === "ADMIN_MARKED_PAID" && userType === "partner" && (
                        <button onClick={() => confirm(s, "PAID")} disabled={updateMutation.isPending} className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-black rounded-lg hover:bg-emerald-700 transition-all shadow shadow-emerald-200">
                          ✓ Confirm Received
                        </button>
                      )}
                      {s.settlement_status === "ADMIN_MARKED_PAID" && userType === "super_admin" && (
                        <span className="text-[10px] text-purple-600 font-bold">Awaiting partner…</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* History Drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-black text-slate-800">Settlement Detail</h3>
                <p className="text-xs text-slate-400 font-bold mt-0.5">Order #{selected.order_id}</p>
              </div>
              <button onClick={() => setSelected(null)} className="h-8 w-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Gross Amount", value: `₹${Number(selected.gross_amount).toLocaleString("en-IN")}`, color: "text-slate-700" },
                  { label: "Commission Rate", value: `${selected.commission_percentage}%`, color: "text-slate-700" },
                  { label: "Commission Amt", value: `₹${Number(selected.commission_amount).toLocaleString("en-IN")}`, color: selected.settlement_direction === "RECEIVABLE" ? "text-amber-600" : "text-blue-600" },
                ].map((item, i) => (
                  <div key={i} className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                    <p className={`text-base font-black ${item.color}`}>{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-lg border text-[10px] font-black uppercase ${selected.settlement_direction === "RECEIVABLE" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                  {selected.settlement_direction === "RECEIVABLE" 
                    ? (userType === "super_admin" ? "↓ Receivable" : "↑ Payable") 
                    : (userType === "super_admin" ? "↑ Payable" : "↓ Receivable")}
                </span>
                <span className={`px-3 py-1 rounded-lg border text-[10px] font-black uppercase ${STATUS_COLOR[selected.settlement_status]}`}>
                  {STATUS_LABEL[selected.settlement_status]}
                </span>
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-2"><Clock className="h-4 w-4 text-slate-400" /> Timeline</h4>
                {histLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
                ) : (
                  <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                    {history.map((h: any) => (
                      <div key={h.id} className="flex gap-3">
                        <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 shrink-0" />
                        <div className="bg-slate-50 rounded-xl p-3 flex-1 border border-slate-100">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[10px] font-black text-slate-400">{format(new Date(h.created_at), "dd MMM, hh:mm a")}</p>
                            <p className="text-[9px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">{h.updated_by}</p>
                          </div>
                          <p className="text-xs font-bold text-slate-700">
                            {h.previous_status ? <><span className="text-slate-400">{h.previous_status}</span> → <span className="text-blue-600">{h.new_status}</span></> : <>Created: <span className="text-blue-600">{h.new_status}</span></>}
                          </p>
                          {h.payment_notes && <p className="text-[10px] text-slate-400 mt-1 italic">"{h.payment_notes}"</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
