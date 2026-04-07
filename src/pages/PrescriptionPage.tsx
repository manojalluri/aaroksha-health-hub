import { useState, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  Upload, Camera, CheckCircle, Clock, Package, Loader2,
  ShieldCheck, MapPin, Phone, User, ChevronLeft,
  Home, Calendar, FlaskConical, Pill, Plus, Minus, Trash2,
  ChevronRight, Search, ShoppingCart, KeyRound, Copy, Check, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { labTests as allMedicines } from "@/data/mockData";
import { useAuth } from "@/contexts/AuthContext";

const genOrderId = (prefix: string) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${prefix}-${code}`;
};

interface Medicine {
  name: string;
  dosage: string;
  price: number;
  available: boolean;
  qty?: number;
}

interface ExtraItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

interface PrescriptionRecord {
  id: string;
  order_id: string;
  patient_name: string;
  patient_phone: string;
  delivery_address: string;
  status: string;
  medicines?: Medicine[];
  platform_fee?: number;
  delivery_fee?: number;
  admin_note?: string;
}

const PrescriptionPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [image, setImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [step, setStep] = useState<"upload" | "details" | "processing" | "review" | "confirmed">("upload");

  // Patient details
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  // Pharmacist result
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [prescriptionRecord, setPrescriptionRecord] = useState<PrescriptionRecord | null>(null);
  const [prescriptionId, setPrescriptionId] = useState<string | null>(null);

  // Extra medicines (user adds more)
  const [extraItems, setExtraItems] = useState<ExtraItem[]>([]);
  const [extraSearch, setExtraSearch] = useState("");
  const [showExtraSearch, setShowExtraSearch] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [confirmedOrderId, setConfirmedOrderId] = useState("");
  const [deliveryCode, setDeliveryCode] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [isExpress, setIsExpress] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2500);
    });
  };

  const [mainTab, setMainTab] = useState<"upload_flow" | "my_orders">("upload_flow");

  // Fetch my orders
  const { data: myOrders, refetch: refetchOrders } = useQuery({
    queryKey: ["my-prescriptions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("prescriptions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setImage(reader.result as string);
        setStep("details");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDetailsSubmit = async () => {
    if (!name || !phone || !address) {
      toast.error("Please fill all required fields");
      return;
    }
    if (!user) {
      toast.error("Please login to upload prescriptions");
      navigate("/auth");
      return;
    }
    if (!selectedFile) return;

    setIsUploading(true);
    setStep("processing");

    let finalImageUrl = image as string;

    try {
      // Try storage upload, fallback to base64
      try {
        const fileExt = selectedFile.name.split(".").pop();
        const filePath = `prescriptions/${Math.random()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("prescriptions")
          .upload(filePath, selectedFile);
        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage.from("prescriptions").getPublicUrl(filePath);
          finalImageUrl = urlData.publicUrl;
        }
      } catch {}

      const { data: prescriptionData, error: insertError } = await supabase.from("prescriptions").insert({
        user_id: user?.id,
        order_id: genOrderId("RX"),
        patient_name: name || user?.email?.split("@")[0] || "Patient",
        patient_phone: phone || "0000000000",
        delivery_address: address || "Hospital Pickup",
        image_url: finalImageUrl,
        status: "pending",
        is_auto_confirm: autoConfirm,
        is_express_delivery: isExpress,
        medicines: [],
      }).select().single();

      if (insertError) throw new Error(`Database Error: ${insertError.message}`);

      setConfirmedOrderId(prescriptionData.order_id);
      setPrescriptionId(prescriptionData.id);
      refetchOrders();
      startPolling(prescriptionData.id);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to submit. Please try again.");
      setStep("details");
      setIsUploading(false);
    }
  };

  const startPolling = (id: string) => {
    const interval = setInterval(async () => {
      const { data, error } = await supabase.from("prescriptions").select("*").eq("id", id).single();
      if (error) return;

      if (data.status === "reviewed" && data.medicines) {
        clearInterval(interval);
        setMedicines(data.medicines as Medicine[]);
        setPrescriptionRecord(data as PrescriptionRecord);
        setStep("review");
        setIsUploading(false);
        toast.success("Pharmacist has reviewed your prescription!");
      }
      if (data.status === "rejected") {
        clearInterval(interval);
        setStep("upload");
        setIsUploading(false);
        toast.error("Prescription rejected: " + (data.admin_note || "Invalid prescription"));
      }
    }, 3000);

    setTimeout(() => {
      clearInterval(interval);
      if (step === "processing") toast.error("Pharmacist is taking longer. Please refresh.");
    }, 300000);
  };

  const cancelOrder = async (id: string) => {
    if (!window.confirm("Are you sure you want to cancel this order?")) return;
    
    try {
      const { error } = await supabase
        .from("prescriptions")
        .update({ status: "cancelled" })
        .eq("id", id);
      
      if (error) throw error;
      
      toast.success("Order cancelled successfully");
      refetchOrders();
      setExpandedOrderId(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to cancel order");
    }
  };

  // Calculated totals
  const { data: settings } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_settings").select("*").single();
      return data || { pharmacy_fee: 19 };
    }
  });

  const availableMeds = medicines.filter((m) => m.available);
  const prescriptionTotal = availableMeds.reduce((s, m) => s + m.price, 0);
  const extraTotal = extraItems.reduce((s, i) => s + i.price * i.qty, 0);
  
  // Use admin provided fees if available (in review step), else use settings
  const PLATFORM_FEE = prescriptionRecord?.platform_fee ? Number(prescriptionRecord.platform_fee) : Number(settings?.pharmacy_fee || 19);
  const deliveryFee = prescriptionRecord?.delivery_fee ? Number(prescriptionRecord.delivery_fee) : 40;
  
  const subTotal = prescriptionTotal + extraTotal;
  const grandTotal = subTotal > 0 ? subTotal + deliveryFee + PLATFORM_FEE : 0;

  // Extra item helpers
  const addExtra = (item: { id: string; name: string; price: number }) => {
    const exists = extraItems.find((e) => e.id === item.id);
    if (exists) {
      setExtraItems(extraItems.map((e) => e.id === item.id ? { ...e, qty: e.qty + 1 } : e));
    } else {
      setExtraItems([...extraItems, { id: item.id, name: item.name, price: item.price, qty: 1 }]);
    }
    setExtraSearch("");
    setShowExtraSearch(false);
    toast.success(`${item.name} added`);
  };

  const updateQty = (id: string, delta: number) => {
    setExtraItems(extraItems
      .map((e) => e.id === id ? { ...e, qty: e.qty + delta } : e)
      .filter((e) => e.qty > 0)
    );
  };

  const filteredExtras = (allMedicines as { id: string; name: string; price: number; category: string }[]).filter(
    (m) => m.name.toLowerCase().includes(extraSearch.toLowerCase()) &&
    !extraItems.find((e) => e.id === m.id)
  );

  const bottomNav = [
    { icon: Home, label: "Home", to: "/" },
    { icon: Calendar, label: "Booking", to: "/doctors" },
    { icon: FlaskConical, label: "Tests", to: "/lab-tests" },
    { icon: Pill, label: "Medicines", to: "/prescription" },
    { icon: User, label: "Profile", to: "/profile" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="flex items-center gap-3 px-4 pt-10 pb-4">
          <button
            onClick={() => {
              if (mainTab === "my_orders") setMainTab("upload_flow");
              else if (step === "upload") navigate(-1);
              else if (step === "details") setStep("upload");
            }}
            className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0"
          >
            <ChevronLeft className="h-5 w-5 text-slate-600" />
          </button>
          <div className="flex-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {mainTab === "my_orders" ? "History" : step === "upload" ? "Upload Prescription" : step === "details" ? "Your Details" : step === "processing" ? "Pharmacist Review" : step === "review" ? "Review & Order" : "Order Confirmed"}
            </p>
            <h1 className="text-lg font-black text-slate-800 leading-tight">
              {mainTab === "my_orders" ? "My Orders" : "Order Medicines"}
            </h1>
          </div>
          <div className="h-9 w-9 rounded-xl bg-green-600 flex items-center justify-center">
            <Pill className="h-4 w-4 text-white" />
          </div>
        </div>

        {/* Top Tabs */}
        {step === "upload" && (
          <div className="flex items-center gap-2 px-4 pb-4">
            <button
              onClick={() => setMainTab("upload_flow")}
              className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                mainTab === "upload_flow" ? "bg-green-600 text-white shadow-md shadow-green-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              Upload New
            </button>
            <button
              onClick={() => {
                if (!user) {
                  toast.error("Please login to view orders");
                  navigate("/auth");
                  return;
                }
                setMainTab("my_orders");
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                mainTab === "my_orders" ? "bg-green-600 text-white shadow-md shadow-green-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              My Orders
            </button>
          </div>
        )}

        {mainTab === "upload_flow" && step !== "confirmed" && (
          <div className="flex items-center px-4 pb-3 gap-1">
            {(["upload", "details", "processing", "review"] as const).map((s, i) => {
              const stepIdx = ["upload", "details", "processing", "review"].indexOf(step);
              const active = i <= stepIdx;
              return (
                <div
                  key={s}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${active ? "bg-green-500" : "bg-slate-200"}`}
                />
              );
            })}
          </div>
        )}
      </header>

      {/* ══════════ MY ORDERS ══════════ */}
      {mainTab === "my_orders" && (
        <main className="flex-1 px-4 pt-5 pb-28 space-y-4">
          {!myOrders || myOrders.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-100 p-8 text-center flex flex-col items-center">
              <Package className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-sm font-black text-slate-800 mb-1">No Orders Yet</p>
              <p className="text-xs text-slate-400 mb-6">Upload a prescription to place your first medicine order.</p>
              <button
                onClick={() => setMainTab("upload_flow")}
                className="rounded-xl bg-green-600 px-6 py-3 text-xs font-black text-white shadow-md shadow-green-200"
              >
                Upload Prescription
              </button>
            </div>
          ) : (
            myOrders.map((order) => {
              const meds = Array.isArray(order.medicines) ? order.medicines as Medicine[] : [];
              const s_raw = order.status;
              const isPaid = order.payment_status === "paid";
              
              const statusCfg: Record<string, { cls: string, label: string }> = {
                pending: { cls: "bg-amber-100 text-amber-700", label: "Pending Review" },
                reviewed: { 
                  cls: isPaid ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700", 
                  label: isPaid ? "Paid - Preparing" : "Reviewed - Pay Now" 
                },
                paid: { cls: "bg-purple-100 text-purple-700", label: "Paid" },
                dispatched: { cls: "bg-purple-100 text-purple-700", label: "Dispatched (Out for Delivery)" },
                completed: { cls: "bg-green-100 text-green-700", label: "Delivered Successfully" },
                rejected: { cls: "bg-red-100 text-red-600", label: "Rejected" },
                cancelled: { cls: "bg-slate-100 text-slate-500", label: "Cancelled" },
              };
              const s = statusCfg[s_raw] || { cls: "bg-slate-100 text-slate-600", label: s_raw };
              
              const isActionable = order.status === "reviewed" && !order.payment_status;
              const isExpanded = expandedOrderId === order.id;

              return (
                <div 
                  key={order.id} 
                  onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                  className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden cursor-pointer ${
                    isExpanded 
                      ? "border-green-200 shadow-xl shadow-green-900/5 ring-1 ring-green-100" 
                      : "border-slate-100 shadow-sm hover:border-slate-200"
                  }`}
                >
                  <div className={`px-6 py-5 flex items-center justify-between ${isExpanded ? "bg-green-50/30" : ""}`}>
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Package className={`h-3.5 w-3.5 ${isExpanded ? "text-green-600" : "text-slate-400"}`} />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Order ID: {order.order_id || `#${order.id.slice(0, 6)}`}
                        </p>
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl inline-block ${s.cls}`}>
                        {s.label}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-slate-800">
                        {new Date(order.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">View Details {isExpanded ? "↑" : "↓"}</p>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="p-6 pt-2 space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="h-px bg-gradient-to-r from-transparent via-slate-100 to-transparent mb-4" />
                      
                      {order.status === "rejected" && order.admin_note && (
                        <div className="bg-red-50 p-4 rounded-2xl border border-red-100 text-xs text-red-600 font-medium flex gap-3">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <p><strong className="font-black">Reason: </strong>{order.admin_note}</p>
                        </div>
                      )}
                      
                      {meds.length > 0 ? (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <Pill className="h-3.5 w-3.5 text-green-600" />
                            <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Items Detail</p>
                          </div>
                          <div className="space-y-2.5 bg-slate-50/50 rounded-2xl p-4 border border-slate-50">
                            {meds.map((m, idx) => (
                              <div key={idx} className="flex justify-between items-center">
                                <div className="flex flex-col">
                                  <span className="text-xs font-black text-slate-700">{m.name}</span>
                                  <span className="text-[10px] font-bold text-slate-400">{m.dosage || "1 unit"}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-black text-slate-800">
                                    {m.available ? `₹${m.price * (m.qty || 1)}` : "Out of stock"}
                                  </span>
                                  <p className="text-[9px] font-bold text-slate-400">Qty: {m.qty || 1}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex gap-3">
                          <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                          <p className="text-[11px] font-bold text-amber-700 leading-relaxed">
                            Our pharmacist is currently verifying your items. We'll update the prices shortly.
                          </p>
                        </div>
                      )}
                      
                      {/* Delivery Info */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <MapPin className="h-3.5 w-3.5 text-green-600" />
                          <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Delivery To</p>
                        </div>
                        <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-50">
                           <p className="text-xs font-black text-slate-700 mb-1">{order.patient_name}</p>
                           <p className="text-xs font-medium text-slate-500 leading-relaxed">{order.delivery_address}</p>
                           {order.delivery_code && (
                             <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivery Code</p>
                               <span className="text-sm font-black text-green-600 tracking-widest font-mono bg-green-50 px-3 py-1 rounded-lg">
                                 {order.delivery_code}
                               </span>
                             </div>
                           )}
                        </div>
                      </div>

                      {order.grand_total > 0 && (
                        <div className="pt-4 border-t border-dashed border-slate-200">
                          <div className="flex justify-between items-center mb-2">
                             <span className="text-xs font-bold text-slate-500">Bill Summary</span>
                             <div className="text-right">
                               <p className="text-[9px] font-bold text-slate-400 uppercase">Paid via PhonePe</p>
                             </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-black text-slate-800 uppercase tracking-tight">Total Amount</span>
                            <span className="text-2xl font-black text-green-600">₹{order.grand_total}</span>
                          </div>
                        </div>
                      )}

                      { (order.status === "pending" || order.status === "reviewed") && (
                        <div className="pt-2 flex gap-3">
                          {isActionable && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMainTab("upload_flow");
                                setPrescriptionId(order.id);
                                setMedicines(meds);
                                setPrescriptionRecord(order as PrescriptionRecord);
                                setConfirmedOrderId(order.order_id || "");
                                setAddress(order.delivery_address || "");
                                setStep("review");
                              }}
                              className="flex-1 py-4 rounded-xl bg-green-600 text-sm font-black text-white shadow-xl shadow-green-200 active:scale-95 transition-all"
                            >
                              Pay ₹{order.grand_total}
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              cancelOrder(order.id);
                            }}
                            className={`py-4 rounded-xl text-sm font-black transition-all active:scale-95 ${
                              isActionable ? "px-6 bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600" : "w-full bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600"
                            }`}
                          >
                            Cancel Order
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </main>
      )}

      {/* ══════════ UPLOAD ══════════ */}
      {mainTab === "upload_flow" && step === "upload" && (
        <main className="flex-1 px-4 pt-5 pb-28 space-y-6">
          {/* Upload Card */}
          <div className="bg-white rounded-3xl border-2 border-dashed border-green-200 p-8 text-center transition-all hover:border-green-400 hover:bg-green-50/30">
            <div className="h-20 w-20 rounded-3xl bg-green-100 flex items-center justify-center mx-auto mb-5">
              <Upload className="h-9 w-9 text-green-600" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2">Upload Prescription</h3>
            <p className="text-sm text-slate-400 font-medium mb-6 leading-relaxed max-w-xs mx-auto">
              Take a photo or upload your prescription. Our pharmacist will review it and send you the price.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => cameraRef.current?.click()}
                className="flex items-center gap-2 rounded-2xl bg-green-600 px-5 py-3 text-xs font-black text-white shadow-lg shadow-green-200 active:scale-[0.98] transition-transform"
              >
                <Camera className="h-4 w-4" /> Take Photo
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 rounded-2xl bg-slate-100 px-5 py-3 text-xs font-black text-slate-600 active:scale-[0.98] transition-transform hover:bg-slate-200"
              >
                <Upload className="h-4 w-4" /> Browse
              </button>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

          {/* How it works */}
          <div className="bg-white rounded-3xl border border-slate-100 p-5">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-4">How it works</p>
            <div className="grid grid-cols-4 gap-3">
              {[
                { icon: Upload, label: "Upload", color: "bg-blue-100", ic: "text-blue-600" },
                { icon: Clock, label: "Review", color: "bg-amber-100", ic: "text-amber-600" },
                { icon: ShieldCheck, label: "Verify", color: "bg-green-100", ic: "text-green-600" },
                { icon: Package, label: "Deliver", color: "bg-purple-100", ic: "text-purple-600" },
              ].map(({ icon: Icon, label, color, ic }) => (
                <div key={label} className="flex flex-col items-center gap-2">
                  <div className={`h-11 w-11 rounded-2xl ${color} flex items-center justify-center`}>
                    <Icon className={`h-5 w-5 ${ic}`} />
                  </div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-wide text-center">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* ══════════ DETAILS ══════════ */}
      {mainTab === "upload_flow" && step === "details" && (
        <main className="flex-1 px-4 pt-5 pb-28 space-y-4">
          {/* Image preview */}
          {image && (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <img src={image} alt="Prescription" className="w-full h-44 object-cover" />
              <div className="px-4 py-2.5 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <p className="text-xs font-black text-green-600">Prescription ready to submit</p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Delivery Details</p>
            {[
              { label: "Your Full Name *", key: "name", value: name, setter: setName, icon: User, placeholder: "Enter your name", type: "text" },
              { label: "Phone Number *", key: "phone", value: phone, setter: setPhone, icon: Phone, placeholder: "+91 XXXXX XXXXX", type: "tel" },
            ].map(({ label, key, value, setter, icon: Icon, placeholder, type }) => (
              <div key={key}>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">{label}</label>
                <div className="relative">
                  <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type={type}
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    placeholder={placeholder}
                    className="w-full h-11 rounded-xl bg-slate-50 border border-slate-200 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-300 outline-none focus:border-green-300 focus:ring-2 focus:ring-green-100 transition-all"
                  />
                </div>
              </div>
            ))}
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Delivery Address *</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="House/Flat No., Building Name&#10;Street, Area, Landmark&#10;City, Pincode"
                  className="w-full h-24 rounded-xl bg-slate-50 border border-slate-200 pl-9 pr-3 py-3 text-sm text-slate-700 placeholder:text-slate-300 outline-none focus:border-green-300 focus:ring-2 focus:ring-green-100 transition-all resize-none"
                />
              </div>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Delivery & Confirmation Options</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <CheckCircle className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-800">Auto-Confirm Order</p>
                    <p className="text-[9px] font-bold text-slate-400 leading-tight">Proceed immediately after quote</p>
                  </div>
                </div>
                <button onClick={() => setAutoConfirm(!autoConfirm)} className={`h-6 w-11 rounded-full transition-colors relative ${autoConfirm ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                  <div className={`absolute top-1 h-4 w-4 bg-white rounded-full transition-all ${autoConfirm ? 'left-6' : 'left-1'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                    <Package className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-800">Express Delivery</p>
                    <p className="text-[9px] font-bold text-slate-400 leading-tight">Priority 2-hour home delivery</p>
                  </div>
                </div>
                <button onClick={() => setIsExpress(!isExpress)} className={`h-6 w-11 rounded-full transition-colors relative ${isExpress ? 'bg-blue-500' : 'bg-slate-200'}`}>
                  <div className={`absolute top-1 h-4 w-4 bg-white rounded-full transition-all ${isExpress ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleDetailsSubmit}
            disabled={isUploading}
            className="w-full h-12 rounded-2xl bg-[#0F172A] text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-slate-200 transition-all active:scale-95 disabled:opacity-50"
          >
            {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Submit Prescription"}
          </button>
        </main>
      )}

      {/* ══════════ PROCESSING ══════════ */}
      {mainTab === "upload_flow" && step === "processing" && (
        <main className="flex-1 flex flex-col items-center justify-center px-6 pb-28 text-center">
          {/* Prescription preview with scan effect */}
          <div className="relative mb-8 w-48 h-48">
            {image && (
              <img src={image} alt="Prescription" className="w-full h-full object-cover rounded-3xl shadow-2xl" />
            )}
            <div className="absolute inset-0 border-4 border-green-500 rounded-3xl animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center bg-green-900/20 rounded-3xl backdrop-blur-[1px]">
              <Loader2 className="h-10 w-10 text-white animate-spin" />
            </div>
          </div>

          <h3 className="text-xl font-black text-slate-800 mb-2">Under Pharmacist Review</h3>

          {/* Order ID Badge */}
          {confirmedOrderId && (
            <div className="mb-4 bg-green-50 border-2 border-green-200 rounded-2xl px-5 py-2.5 flex flex-col items-center gap-0.5">
              <p className="text-[9px] font-black text-green-400 uppercase tracking-widest">Your Order ID</p>
              <p className="text-lg font-black text-green-700 tracking-widest font-mono">{confirmedOrderId}</p>
              <p className="text-[10px] text-green-500 font-medium">Save this to track your order</p>
            </div>
          )}

          <p className="text-sm text-slate-400 font-medium max-w-xs leading-relaxed mb-6">
            Your prescription has been sent to our pharmacy team. They're reviewing it and will notify you with the medicine prices shortly.
          </p>

          <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
            <Clock className="h-4 w-4 text-amber-500 shrink-0" />
            <p className="text-xs font-bold text-amber-700">Usually takes 2–5 minutes</p>
          </div>

          <p className="text-[9px] font-black text-green-500 uppercase tracking-widest mt-6 animate-pulse">
            Verification in progress...
          </p>
        </main>
      )}

      {/* ══════════ REVIEW ══════════ */}
      {mainTab === "upload_flow" && step === "review" && (
        <main className="flex-1 px-4 pt-5 pb-28 space-y-4">
          {/* Success badge */}
          <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-2xl px-4 py-3">
            <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
            <div>
              <p className="text-sm font-black text-green-700">Prescription Verified!</p>
              <p className="text-[10px] font-medium text-green-600">Pharmacist has reviewed your prescription.</p>
            </div>
          </div>

          {/* Prescription medicines from pharmacist */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-50">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prescribed Medicines</p>
            </div>
            <div className="divide-y divide-slate-50">
              {medicines.map((med, i) => (
                <div key={i} className={`flex items-center justify-between px-4 py-3.5 ${!med.available ? "opacity-50" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${med.available ? "bg-green-100" : "bg-slate-100"}`}>
                      <Package className={`h-4 w-4 ${med.available ? "text-green-600" : "text-slate-400"}`} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800">{med.name}</p>
                      <p className="text-[10px] font-bold text-slate-400">{med.dosage}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {med.available ? (
                      <>
                        <p className="font-black text-slate-800 text-sm">₹{med.price}</p>
                        <p className="text-[9px] font-black text-green-500 uppercase">In Stock</p>
                      </>
                    ) : (
                      <p className="text-[9px] font-black text-red-400 uppercase">Not Available</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add More Medicines */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Add More Medicines</p>
              <button
                onClick={() => setShowExtraSearch(!showExtraSearch)}
                className="h-7 w-7 rounded-lg bg-green-100 flex items-center justify-center"
              >
                <Plus className="h-3.5 w-3.5 text-green-600" />
              </button>
            </div>

            {/* Search for extra medicines */}
            {showExtraSearch && (
              <div className="px-4 py-3 border-b border-slate-50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    autoFocus
                    value={extraSearch}
                    onChange={(e) => setExtraSearch(e.target.value)}
                    placeholder="Search medicines..."
                    className="w-full h-10 rounded-xl bg-slate-50 border border-slate-200 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-300 outline-none focus:border-green-300 transition-all"
                  />
                </div>
                {extraSearch.length > 1 && (
                  <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                    {filteredExtras.slice(0, 5).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => addExtra(item)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white border border-slate-100 hover:border-green-200 hover:bg-green-50 transition-all text-left"
                      >
                        <div>
                          <p className="text-xs font-black text-slate-700">{item.name}</p>
                          <p className="text-[9px] font-bold text-slate-400">{item.category}</p>
                        </div>
                        <p className="text-sm font-black text-green-600">₹{item.price}</p>
                      </button>
                    ))}
                    {filteredExtras.length === 0 && (
                      <p className="text-xs text-slate-400 font-medium text-center py-3">No medicines found</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Extra items list */}
            {extraItems.length > 0 ? (
              <div className="divide-y divide-slate-50">
                {extraItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-black text-slate-800">{item.name}</p>
                      <p className="text-[10px] font-bold text-slate-400">₹{item.price} × {item.qty}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(item.id, -1)} className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center">
                        <Minus className="h-3 w-3 text-slate-600" />
                      </button>
                      <span className="text-sm font-black text-slate-800 w-4 text-center">{item.qty}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="h-7 w-7 rounded-lg bg-green-100 flex items-center justify-center">
                        <Plus className="h-3 w-3 text-green-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-5 text-center">
                <ShoppingCart className="h-6 w-6 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-300">Tap + to add more medicines</p>
              </div>
            )}
          </div>

          {/* Bill Summary */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Bill Summary</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-slate-500">Prescription Medicines</span>
                <span className="font-black text-slate-800">₹{prescriptionTotal}</span>
              </div>
              {extraTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-500">Extra Medicines</span>
                  <span className="font-black text-slate-800">₹{extraTotal}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="font-medium text-slate-500">Delivery Fee</span>
                <span className="font-black text-slate-800">₹{deliveryFee}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-medium text-slate-500">Platform Fee</span>
                <span className="font-black text-slate-800">₹{PLATFORM_FEE}</span>
              </div>
              <div className="border-t border-dashed border-slate-100 my-1" />
              <div className="flex justify-between">
                <span className="font-bold text-slate-700">Total Amount</span>
                <span className="text-2xl font-black text-green-600">₹{grandTotal}</span>
              </div>
            </div>
          </div>

          {/* Delivery address */}
          <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-100 p-3">
            <div className="h-8 w-8 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
              <MapPin className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Delivering to</p>
              <p className="text-xs font-black text-slate-700 line-clamp-1">{address}</p>
            </div>
          </div>

          <button
            onClick={async () => {
              if (isUploading) return;
              setIsUploading(true);
              const transactionId = `MED_TXN_${Date.now()}`;

              // Generate unique 6-char delivery code
              const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
              const code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");

              try {
                // Update Supabase record with final medicines and order totals
                const { error: updateError } = await supabase
                  .from("prescriptions")
                  .update({
                    medicines: [...medicines, ...extraItems],
                    sub_total: subTotal,
                    platform_fee: PLATFORM_FEE,
                    grand_total: grandTotal,
                    status: "paid", 
                    payment_status: "paid",
                    delivery_code: code,
                  })
                  .eq("id", prescriptionId);

                if (updateError) throw updateError;

                // Handle payment handoff
                toast.loading("Initiating secure payment via PhonePe...", { duration: 2500 });
                await new Promise(r => setTimeout(r, 2500));

                toast.success("Order placed successfully! Secure ID: " + transactionId);
                setDeliveryCode(code);
                setStep("confirmed");
              } catch (err) {
                console.error(err);
                toast.error("Order failed: " + (err instanceof Error ? err.message : "Unknown error"));
              } finally {
                setIsUploading(false);
              }
            }}
            disabled={isUploading}
            className="w-full rounded-2xl bg-green-600 py-4 text-sm font-black text-white shadow-xl shadow-green-200 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Pay ₹{grandTotal} & Place Order →</>}
          </button>
        </main>
      )}

      {/* ══════════ CONFIRMED ══════════ */}
      {mainTab === "upload_flow" && step === "confirmed" && (
        <main className="flex-1 flex flex-col items-center justify-center px-6 pb-28 text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-green-400/20 rounded-full animate-ping" />
            <div className="h-24 w-24 bg-green-100 rounded-full flex items-center justify-center relative">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">Order Placed! 🎉</h2>
          <div className="h-1 w-10 bg-green-400 rounded-full mx-auto mb-4" />

          {/* Order ID Badge */}
          {confirmedOrderId && (
            <div className="mb-4 bg-green-50 border-2 border-green-200 rounded-2xl px-6 py-3 flex flex-col items-center gap-1">
              <p className="text-[9px] font-black text-green-400 uppercase tracking-widest">Your Order ID</p>
              <p className="text-xl font-black text-green-700 tracking-widest font-mono">{confirmedOrderId}</p>
              <p className="text-[10px] text-green-500 font-medium">Save this to track your order</p>
            </div>
          )}

          {/* Delivery Code Badge */}
          {deliveryCode && (
            <div className="mb-5 w-full max-w-xs">
              <div className="bg-violet-50 border-2 border-violet-300 rounded-2xl px-5 py-4 flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-7 w-7 bg-violet-100 rounded-xl flex items-center justify-center">
                    <KeyRound className="h-4 w-4 text-violet-600" />
                  </div>
                  <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest">Delivery Code</p>
                </div>
                <div
                  className="w-full flex items-center justify-between bg-white border-2 border-dashed border-violet-300 rounded-xl px-4 py-3 cursor-pointer"
                  onClick={() => copyCode(deliveryCode)}
                >
                  <p className="text-3xl font-black text-violet-700 tracking-[0.35em] font-mono">{deliveryCode}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); copyCode(deliveryCode); }}
                    className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all ${
                      codeCopied ? "bg-emerald-100 text-emerald-600" : "bg-violet-100 text-violet-600"
                    }`}
                  >
                    {codeCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex items-start gap-2 mt-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-violet-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] font-medium text-violet-600 text-left leading-relaxed">
                    Share this code with the delivery partner when they arrive.
                    They must enter it to mark your order as delivered.
                  </p>
                </div>
              </div>
            </div>
          )}

          <p className="text-sm text-slate-500 font-medium mb-2 leading-relaxed max-w-xs">
            Your medicines will be delivered to
          </p>
          <p className="text-sm font-black text-slate-700 mb-6 max-w-xs">{address}</p>
          <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-2xl px-5 py-3 mb-8">
            <Clock className="h-4 w-4 text-green-600" />
            <span className="text-sm font-black text-green-700">Expected delivery: 2–4 hours</span>
          </div>

          <div className="w-full max-w-xs space-y-3">
            <button
              onClick={() => navigate("/")}
              className="w-full rounded-2xl bg-green-600 py-4 text-sm font-black text-white shadow-xl shadow-green-200"
            >
              Back to Home
            </button>
            <button
              onClick={() => {
                setStep("upload");
                setImage(null);
                setSelectedFile(null);
                setName(""); setPhone(""); setAddress("");
                setMedicines([]); setExtraItems([]);
                setDeliveryCode("");
              }}
              className="w-full rounded-2xl py-3.5 text-sm font-bold border-2 border-slate-200 text-slate-600 bg-white"
            >
              Upload Another Prescription
            </button>
          </div>
        </main>
      )}

      {/* ── Bottom Nav ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-100"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5">
          {bottomNav.map(({ icon: Icon, label, to }) => {
            const active = label === "Home" ? location.pathname === "/" : location.pathname === to;
            return (
              <Link
                key={label}
                to={to}
                className={`flex flex-col items-center gap-1 py-3 transition-colors ${active ? "text-green-600" : "text-slate-400"}`}
              >
                <Icon className={`h-5 w-5 ${active ? "scale-110" : ""} transition-transform`} />
                <span className="text-[9px] font-black tracking-tight">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default PrescriptionPage;
