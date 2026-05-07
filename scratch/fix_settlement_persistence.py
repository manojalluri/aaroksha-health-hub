import os

file_path = r"c:\Users\manoj\Desktop\aaroksha-health-hub\src\pages\admin\SuperAdminDashboard.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

target = """                               {paidPartners[row.id] ? (
                                 <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl">
                                   <CheckCircle2 className="h-3.5 w-3.5" /> Paid
                                 </span>
                               ) : (
                                 <button onClick={() => { setPaidPartners(p => ({ ...p, [row.id]: true })); toast.success(`Marked ₹${row.netPayable.toLocaleString("en-IN")} as paid to ${row.name}`); }}
                                   className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-xl transition-all">
                                   <IndianRupee className="h-3.5 w-3.5" /> Mark Paid
                                 </button>
                               )}"""

replacement = """                               {(paidPartners[row.id] || (partners.find(p=>p.id===row.id)?.last_payout_date && new Date(partners.find(p=>p.id===row.id).last_payout_date).toDateString() === new Date().toDateString())) ? (
                                 <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                                   <CheckCircle2 className="h-3.5 w-3.5" /> Settled Today
                                 </span>
                               ) : (
                                 <button onClick={() => handleMarkPaid(row.id, row.name, row.netPayable.toLocaleString("en-IN"))}
                                   className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-xl shadow-md shadow-blue-100 transition-all active:scale-95">
                                   <IndianRupee className="h-3.5 w-3.5" /> Mark Paid
                                 </button>
                               )}"""

if target in content:
    new_content = content.replace(target, replacement)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Replacement success")
else:
    print("Target not found")
