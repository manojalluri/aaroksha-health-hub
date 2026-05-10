import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Calendar, Clock, Star, CheckCircle, Loader2,
  ChevronLeft, Building2, Zap, Smartphone, Banknote, User,
} from "lucide-react";
import { type PatientDetails } from "@/data/mockData";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { getLocalDoctors } from "@/lib/doctorsSync";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/lib/settingsSync";

const avatarColors = ["#2563eb", "#7c3aed", "#059669", "#dc2626", "#d97706", "#0891b2"];

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  experience: number;
  fee: number;
  image_url?: string;
  consultationFee?: number;
  hospital_name?: string;
  hospital_id?: string;
  partner_id?: string;
  available?: boolean;
  time_slots?: string[];   // e.g. ["09:00 AM", "10:30 AM"]
  advance_days?: number;   // how many days ahead patients can book
  holidays?: string[];     // blocked dates in YYYY-MM-DD format
}

const genOrderId = (prefix: string) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${prefix}-${code}`;
};

const BookAppointmentPage = () => {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: doctor, isLoading: isDoctorLoading } = useQuery<Doctor | undefined>({
    queryKey: ["doctor", doctorId],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from("doctors").select("*").eq("id", doctorId).single();
        if (error) throw error;
        if (!data) return getLocalDoctors().find(d => d.id === doctorId) as unknown as Doctor;
        return data as Doctor;
      } catch (err) {
        return getLocalDoctors().find(d => d.id === doctorId) as unknown as Doctor;
      }
    },
    enabled: !!doctorId,
  });

  const [step, setStep] = useState<"slots" | "details" | "checkout" | "confirmed">("slots");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [isPriority, setIsPriority] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedOrderId, setConfirmedOrderId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "cod">("cod");

  // Load saved profile from localStorage
  const savedProfile = (() => {
    try { return JSON.parse(localStorage.getItem("aaroksha_profile") || "{}"); } catch { return {}; }
  })();
  const hasSavedProfile = !!(savedProfile.name && savedProfile.phone);

  const [patient, setPatient] = useState<any>({
    name: "", age: "", gender: "", phone: "", email: "", address: "", town: "", symptoms: "",
  });

  // How many days ahead can patients book (set by hospital admin, default 7)
  const advanceDays = doctor?.advance_days ?? 7;
  const holidays: string[] = doctor?.holidays ?? [];
  const dates = Array.from({ length: advanceDays }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d.toISOString().split("T")[0];
  });
  // Separate available and holiday dates
  const availableDates = dates.filter(d => !holidays.includes(d));
  const holidayDates   = dates.filter(d => holidays.includes(d));

  // Doctor's configured time slots (from Supabase)
  const doctorSlots: string[] = doctor?.time_slots ?? [
    "09:00 AM","09:30 AM","10:00 AM","10:30 AM","11:00 AM","11:30 AM",
    "02:00 PM","02:30 PM","03:00 PM","04:00 PM","04:30 PM","05:00 PM",
  ];

  const formatDate = (d: string) =>
    d ? new Date(d).toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" }) : "";

  const { settings } = useSettings();

  // Fetch already-booked slots for the selected date
  const { data: bookedAppointments = [], refetch: refetchBookings } = useQuery<any[]>({
    queryKey: ["booked-slots", doctor?.id, selectedDate],
    enabled: !!doctor?.id && !!selectedDate,
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("appointment_time, user_id")
        .eq("doctor_id", doctor!.id)
        .eq("appointment_date", selectedDate)
        .in("status", ["pending", "confirmed"]);
      return data || [];
    },
    refetchInterval: 10000, // Refresh every 10s for real-time occupancy
  });

  const PRIORITY_FEE = Number(settings?.priority_surcharge);
  const PLATFORM_FEE = Number(settings?.opd_fee);
  const totalAmount = Number(doctor?.fee || doctor?.consultationFee || 0) + PLATFORM_FEE + (isPriority ? PRIORITY_FEE : 0);

  const handleBooking = () => {
    if (!patient.name || !patient.phone || !patient.age || !patient.gender || !patient.town || !patient.symptoms) {
      toast.error("Please fill all required fields");
      return;
    }
    setStep("checkout");
  };

  const handlePayment = async () => {
    setIsSubmitting(true);
    const transactionId = `TXN_${Date.now()}`;
    const amount = totalAmount;

    try {
      const newOrderId = genOrderId("OPD");
      const vCode = Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
      
      const uId = user?.id ? String(user.id) : null;
      const dId = doctor?.id ? String(doctor.id) : null;

      // STRATEGY 1: Attempt Atomic RPC Booking (Preferred)
      const { data, error: rpcError } = await supabase.rpc("book_op_appointment", {
        p_order_id: newOrderId,
        p_user_id: uId,
        p_doctor_id: dId,
        p_doctor_name: doctor?.name,
        p_patient_name: patient.name,
        p_patient_phone: patient.phone,
        p_patient_email: patient.email || null,
        p_patient_age: patient.age ? String(patient.age) : null,
        p_patient_gender: patient.gender,
        p_patient_town: patient.town,
        p_notes: patient.symptoms,
        p_appointment_date: selectedDate,
        p_appointment_time: selectedSlot,
        p_fee: totalAmount,
        p_consultation_fee: Number(doctor?.fee || doctor?.consultationFee || 0),
        p_platform_fee: PLATFORM_FEE,
        p_is_priority: isPriority,
        p_hospital_partner_id: doctor?.partner_id || doctor?.hospital_id,
        p_verification_code: vCode
      });

      // Handle specific missing RPC or schema mismatch errors by falling back
      const isRpcMissing = rpcError && (rpcError.code === "PGRST202" || rpcError.message.includes("not found"));
      const isTypeMismatch = rpcError && (rpcError.message.includes("operator does not exist") || rpcError.message.includes("uuid"));

      if (isRpcMissing || isTypeMismatch) {
        console.warn("RPC Booking unavailable. Using fallback strategy...", rpcError);
        
        // STRATEGY 2: Fallback Manual Booking
        // 1. Verify capacity manually to prevent overbooking
        const { data: currentBookings } = await supabase
          .from("appointments")
          .select("id")
          .eq("doctor_id", dId)
          .eq("appointment_date", selectedDate)
          .eq("appointment_time", selectedSlot)
          .in("status", ["pending", "confirmed"]);
          
        const capacity = doctor?.slot_capacity || 10;
        if ((currentBookings?.length || 0) >= capacity) {
          toast.error("This slot is now full. Please select another time.");
          setStep("slots");
          refetchBookings();
          return;
        }

        // 2. Direct insertion with explicit partner mapping
        const { error: insertError } = await supabase.from("appointments").insert({
          order_id: newOrderId,
          user_id: uId,
          doctor_id: dId,
          doctor_name: doctor?.name,
          patient_name: patient.name,
          patient_phone: patient.phone,
          patient_email: patient.email || null,
          patient_age: patient.age ? String(patient.age) : null,
          patient_gender: patient.gender,
          patient_town: patient.town,
          notes: patient.symptoms,
          appointment_date: selectedDate,
          appointment_time: selectedSlot,
          fee: totalAmount,
          consultation_fee: Number(doctor?.fee || doctor?.consultationFee || 0),
          platform_fee: PLATFORM_FEE,
          is_priority: isPriority,
          hospital_partner_id: doctor?.partner_id || doctor?.hospital_id,
          partner_id: doctor?.partner_id || doctor?.hospital_id,
          status: "pending",
          verification_code: vCode
        });

        if (insertError) throw insertError;
      } else if (rpcError) {
        throw rpcError;
      } else if (data && !data.success) {
        if (data.message === "SLOT_FULL") {
          toast.error("Slot is full. Please choose another.");
          setStep("slots");
          refetchBookings();
          return;
        }
        if (data.message === "ALREADY_BOOKED") {
          toast.info("You already have a booking for this slot.");
          setStep("slots");
          return;
        }
        throw new Error(data.message || "Booking failed");
      }

      setConfirmedOrderId(newOrderId);
      setStep("confirmed");
      toast.success("Appointment booked successfully!");
    } catch (err: any) {
      console.error("Critical Booking Failure:", err);
      toast.error(err?.message || "Failed to process booking. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const goBack = () => {
    if (step === "slots") navigate("/doctors");
    else if (step === "details") setStep("slots");
    else if (step === "checkout") setStep("details");
  };

  // Step labels
  const steps = ["slots", "details", "checkout"];
  const stepLabels = ["Slot", "Details", "Pay"];
  const currentStepIdx = steps.indexOf(step);

  const accentColor = "#2563eb";
  const initial = doctor?.name?.replace("Dr. ", "").charAt(0) || "D";

  if (isDoctorLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <p className="text-4xl">😕</p>
        <p className="font-black text-slate-700">Doctor not found</p>
        <button onClick={() => navigate("/doctors")} className="text-blue-600 font-bold text-sm">← Back</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="flex items-center gap-3 px-4 pt-10 pb-4">
          <button
            onClick={goBack}
            className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0"
          >
            <ChevronLeft className="h-5 w-5 text-slate-600" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {step === "slots" ? "Choose Slot" : step === "details" ? "Patient Info" : step === "checkout" ? "Confirm & Pay" : "Confirmed!"}
            </p>
            <h1 className="text-base font-black text-slate-800 truncate">{doctor.name}</h1>
          </div>
          {/* Step dots */}
          <div className="flex items-center gap-1.5 shrink-0">
            {steps.map((s, i) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i <= currentStepIdx || step === "confirmed"
                    ? "w-5 bg-blue-600"
                    : "w-2 bg-slate-200"
                }`}
                style={i <= currentStepIdx || step === "confirmed" ? { backgroundColor: accentColor } : {}}
              />
            ))}
          </div>
        </div>
      </header>

      {/* ── Doctor Card (always visible) ── */}
      {step !== "confirmed" && (
        <div className="bg-white mx-4 mt-4 rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shrink-0 shadow-md overflow-hidden"
            style={{ backgroundColor: accentColor, boxShadow: `0 4px 12px ${accentColor}40` }}
          >
            {doctor.image_url ? (
              <img src={doctor.image_url} alt={doctor.name} className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-black text-slate-800 text-sm truncate">{doctor.name}</h2>
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: accentColor }}>
              {doctor.specialty}
            </p>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex items-center gap-0.5 text-[10px] font-black text-slate-600">
                <Star className="h-2.5 w-2.5 text-amber-400 fill-amber-400" />
                {doctor.rating || 4.8}
              </span>
              <span className="flex items-center gap-0.5 text-[10px] font-bold text-slate-400">
                <Clock className="h-2.5 w-2.5" />{doctor.experience} yrs
              </span>
              {doctor.hospital_name && (
                <span className="flex items-center gap-0.5 text-[10px] font-bold text-slate-400 truncate">
                  <Building2 className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{doctor.hospital_name}</span>
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fee</p>
            <p className="text-lg font-black text-slate-800">₹{doctor.fee}</p>
          </div>
        </div>
      )}

      {/* ══════════ STEP 1: SLOTS ══════════ */}
      {step === "slots" && (
        <main className="flex-1 px-4 pt-5 pb-10 space-y-6">
          {/* Date Picker */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${accentColor}15` }}>
                <Calendar className="h-4 w-4" style={{ color: accentColor }} />
              </div>
              <h3 className="font-black text-slate-800 text-sm">Select Date</h3>
            </div>

            <div className="flex gap-2.5 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
              {dates.map((d) => {
                const dateObj   = new Date(d + "T00:00:00");
                const isSelected = selectedDate === d;
                const isHoliday  = holidays.includes(d);
                return (
                  <button
                    key={d}
                    disabled={isHoliday}
                    onClick={() => { if (!isHoliday) { setSelectedDate(d); setSelectedSlot(""); } }}
                    className={`flex-shrink-0 w-[68px] py-3 rounded-2xl flex flex-col items-center gap-0.5 border-2 transition-all duration-200 active:scale-95 ${
                      isHoliday ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                    }`}
                    style={
                      isHoliday
                        ? { backgroundColor: "#fff1f2", borderColor: "#fecdd3" }
                        : isSelected
                          ? { backgroundColor: accentColor, borderColor: accentColor, boxShadow: `0 4px 14px ${accentColor}40` }
                          : { backgroundColor: "white", borderColor: "#e2e8f0" }
                    }
                  >
                    <p className={`text-[9px] font-black uppercase tracking-widest ${
                      isHoliday ? "text-red-400" : isSelected ? "text-white/70" : "text-slate-400"
                    }`}>
                      {dateObj.toLocaleDateString("en-IN", { weekday: "short" })}
                    </p>
                    <p className={`text-xl font-black leading-none ${
                      isHoliday ? "text-red-400" : isSelected ? "text-white" : "text-slate-800"
                    }`}>
                      {dateObj.getDate()}
                    </p>
                    <p className={`text-[9px] font-black uppercase ${
                      isHoliday ? "text-red-300" : isSelected ? "text-white/70" : "text-slate-400"
                    }`}>
                      {isHoliday ? "Holiday" : dateObj.toLocaleDateString("en-IN", { month: "short" })}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Slots */}
          {selectedDate && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${accentColor}15` }}>
                  <Clock className="h-4 w-4" style={{ color: accentColor }} />
                </div>
                <h3 className="font-black text-slate-800 text-sm">Select Time</h3>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {doctorSlots.map((slotTime) => {
                  const bookingsForSlot = bookedAppointments.filter(b => b.appointment_time === slotTime);
                  const isAlreadyBookedByMe = bookedAppointments.some(b => b.appointment_time === slotTime && b.user_id === user?.id);
                  const maxCapacity = doctor?.slot_capacity || 10;
                  const currentCount = bookingsForSlot.length;
                  const isFull = currentCount >= maxCapacity;
                  const isSelected = selectedSlot === slotTime;
                  
                  // Priority check: Show "Already Booked" even if not full
                  const isDisabled = isFull || isAlreadyBookedByMe;

                  return (
                    <button
                      key={slotTime}
                      disabled={isDisabled}
                      onClick={() => setSelectedSlot(slotTime)}
                      className={`relative py-3 rounded-xl text-xs font-black tracking-tight border-2 transition-all duration-200 active:scale-95 flex flex-col items-center justify-center min-h-[56px] ${
                        isDisabled
                          ? isAlreadyBookedByMe 
                            ? "bg-blue-50 text-blue-400 border-blue-100 cursor-not-allowed"
                            : "bg-slate-50 text-slate-300 border-transparent cursor-not-allowed"
                          : ""
                      }`}
                      style={
                        !isDisabled
                          ? isSelected
                            ? { backgroundColor: accentColor, borderColor: accentColor, color: "white", boxShadow: `0 4px 12px ${accentColor}40` }
                            : { backgroundColor: "white", borderColor: "#e2e8f0", color: "#475569" }
                          : {}
                      }
                    >
                      {slotTime}
                      {isAlreadyBookedByMe ? (
                        <span className="text-[7px] font-bold mt-0.5 text-blue-600 uppercase">You Booked</span>
                      ) : isFull ? (
                        <span className="text-[8px] font-bold mt-0.5 text-red-400 uppercase">Slot Full</span>
                      ) : (
                        <div className="flex items-center gap-1 mt-0.5 opacity-60">
                           <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                           <span className="text-[8px] font-bold">{maxCapacity - currentCount} left</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Priority option */}
          {selectedSlot && (
            <div
              onClick={() => setIsPriority(!isPriority)}
              className={`cursor-pointer rounded-2xl border-2 p-4 transition-all ${
                isPriority ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white hover:border-amber-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isPriority ? "bg-amber-400" : "bg-slate-100"}`}>
                    <Zap className={`h-5 w-5 ${isPriority ? "text-white" : "text-slate-400"}`} />
                  </div>
                  <div>
                    <p className={`font-black text-sm ${isPriority ? "text-amber-800" : "text-slate-700"}`}>⚡ Priority Appointment</p>
                    <p className={`text-xs font-medium ${isPriority ? "text-amber-600" : "text-slate-400"}`}>Skip the queue · Immediate attention · +₹{250}</p>
                  </div>
                </div>
                <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  isPriority ? "bg-amber-400 border-amber-400" : "border-slate-300"
                }`}>
                  {isPriority && <div className="h-2.5 w-2.5 rounded-full bg-white" />}
                </div>
              </div>
            </div>
          )}

          {/* Continue Button */}
          {selectedSlot && (
            <button
              onClick={() => setStep("details")}
              className="w-full rounded-2xl py-4 text-sm font-black text-white shadow-xl active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              style={{ backgroundColor: accentColor, boxShadow: `0 6px 20px ${accentColor}40` }}
            >
              Continue to Patient Details →
            </button>
          )}
        </main>
      )}

      {/* ══════════ STEP 2: DETAILS ══════════ */}
      {step === "details" && (
        <main className="flex-1 px-4 pt-5 pb-28 space-y-4">
          {/* Saved Profile Banner */}
          {hasSavedProfile && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-black text-blue-800">{savedProfile.name}</p>
                  <p className="text-[10px] font-bold text-blue-500">{savedProfile.phone}{savedProfile.town ? ` · ${savedProfile.town}` : ""}</p>
                </div>
              </div>
              <button
                onClick={() => setPatient((p: any) => ({
                  ...p,
                  name:  savedProfile.name  || p.name,
                  phone: savedProfile.phone || p.phone,
                  email: savedProfile.email || p.email,
                  town:  savedProfile.town  || p.town,
                }))}
                className="shrink-0 text-[10px] font-black text-blue-600 bg-white border border-blue-200 px-3 py-1.5 rounded-xl hover:bg-blue-50 transition-all"
              >
                Use Saved ✓
              </button>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Patient Information</p>

            {/* Name & Phone */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Full Name *", key: "name", placeholder: "Full name", type: "text" },
                { label: "Phone *", key: "phone", placeholder: "+91", type: "tel" },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key}>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">{label}</label>
                  <input
                    type={type}
                    value={patient[key as keyof PatientDetails] || ""}
                    onChange={(e) => setPatient({ ...patient, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full h-11 rounded-xl bg-slate-50 border border-slate-200 px-3 text-sm text-slate-700 placeholder:text-slate-300 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all"
                    style={{ '--tw-ring-color': `${accentColor}30` } as React.CSSProperties}
                  />
                </div>
              ))}
            </div>

            {/* Age */}
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Age *</label>
              <input
                type="number"
                value={patient.age}
                onChange={(e) => setPatient({ ...patient, age: e.target.value })}
                placeholder="Age in years"
                className="w-full h-11 rounded-xl bg-slate-50 border border-slate-200 px-3 text-sm text-slate-700 placeholder:text-slate-300 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>

            {/* Gender */}
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Gender *</label>
              <div className="grid grid-cols-3 gap-2">
                {["Male", "Female", "Other"].map((g) => (
                  <button
                    key={g}
                    onClick={() => setPatient({ ...patient, gender: g })}
                    className="py-2.5 rounded-xl text-xs font-black border-2 transition-all active:scale-95"
                    style={
                      patient.gender === g
                        ? { backgroundColor: accentColor, borderColor: accentColor, color: "white" }
                        : { backgroundColor: "#f8fafc", borderColor: "#e2e8f0", color: "#64748b" }
                    }
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Town & Symptoms */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Town / Village *</label>
                <input
                  type="text"
                  value={patient.town}
                  onChange={(e) => setPatient({ ...patient, town: e.target.value })}
                  placeholder="e.g. Bhimavaram"
                  className="w-full h-11 rounded-xl bg-slate-50 border border-slate-200 px-3 text-sm text-slate-700 placeholder:text-slate-300 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Disease / Symptoms *</label>
                <input
                  type="text"
                  value={patient.symptoms}
                  onChange={(e) => setPatient({ ...patient, symptoms: e.target.value })}
                  placeholder="e.g. Fever, Headache"
                  className="w-full h-11 rounded-xl bg-slate-50 border border-slate-200 px-3 text-sm text-slate-700 placeholder:text-slate-300 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Email (optional)</label>
              <input
                type="email"
                value={patient.email}
                onChange={(e) => setPatient({ ...patient, email: e.target.value })}
                placeholder="email@example.com"
                className="w-full h-11 rounded-xl bg-slate-50 border border-slate-200 px-3 text-sm text-slate-700 placeholder:text-slate-300 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>

          {/* Selected slot reminder */}
          <div className="bg-white rounded-2xl border border-slate-100 p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${accentColor}15` }}>
              <Calendar className="h-4 w-4" style={{ color: accentColor }} />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Appointment</p>
              <p className="text-xs font-black text-slate-700">{formatDate(selectedDate)} · {selectedSlot}</p>
            </div>
          </div>

          <button
            onClick={handleBooking}
            className="w-full rounded-2xl py-4 text-sm font-black text-white shadow-xl active:scale-[0.99] transition-all"
            style={{ backgroundColor: accentColor, boxShadow: `0 6px 20px ${accentColor}40` }}
          >
            Continue to Payment →
          </button>
        </main>
      )}

      {/* ══════════ STEP 3: CHECKOUT ══════════ */}
      {step === "checkout" && (
        <main className="flex-1 px-4 pt-5 pb-10 space-y-4">
          {/* Order summary */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Order Summary</p>

            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-50">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${accentColor}15` }}>
                <Calendar className="h-4 w-4" style={{ color: accentColor }} />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Appointment</p>
                <p className="text-xs font-black text-slate-700">{formatDate(selectedDate)} · {selectedSlot}</p>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-slate-500">Doctor Consultation Fee</span>
                <span className="font-black text-slate-800">₹{doctor.fee}</span>
              </div>
              {isPriority && (
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-amber-600 flex items-center gap-1"><Zap className="h-3.5 w-3.5" />Priority Surcharge</span>
                  <span className="font-black text-amber-700">+₹{250}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="font-medium text-slate-500">Platform Fee</span>
                <span className="font-black text-green-600">FREE</span>
              </div>
              <div className="border-t border-dashed border-slate-100 my-2" />
              <div className="flex justify-between">
                <span className="font-bold text-slate-700">Total Payable</span>
                <span className="text-2xl font-black" style={{ color: accentColor }}>₹{totalAmount}</span>
              </div>
            </div>
          </div>

          {/* Payment Method Picker */}
          {(settings?.cod || settings?.upi) && (
            <div className="bg-white rounded-2xl border border-slate-100 p-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Payment Method</p>
              <div className="grid grid-cols-2 gap-3">
                {settings?.cod && (
                  <button
                    onClick={() => setPaymentMethod("cod")}
                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${
                      paymentMethod === "cod"
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                      paymentMethod === "cod" ? "bg-emerald-100" : "bg-slate-100"
                    }`}>
                      <Banknote className={`h-5 w-5 ${paymentMethod === "cod" ? "text-emerald-600" : "text-slate-400"}`} />
                    </div>
                    <div className="text-center">
                      <p className={`text-xs font-black ${paymentMethod === "cod" ? "text-emerald-700" : "text-slate-600"}`}>Cash at Clinic</p>
                      <p className={`text-[9px] font-medium ${paymentMethod === "cod" ? "text-emerald-500" : "text-slate-400"}`}>Pay when you visit</p>
                    </div>
                    {paymentMethod === "cod" && (
                      <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center">
                        <CheckCircle className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </button>
                )}
                {settings?.upi && (
                  <button
                    onClick={() => setPaymentMethod("upi")}
                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${
                      paymentMethod === "upi"
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                      paymentMethod === "upi" ? "bg-blue-100" : "bg-slate-100"
                    }`}>
                      <Smartphone className={`h-5 w-5 ${paymentMethod === "upi" ? "text-blue-600" : "text-slate-400"}`} />
                    </div>
                    <div className="text-center">
                      <p className={`text-xs font-black ${paymentMethod === "upi" ? "text-blue-700" : "text-slate-600"}`}>UPI Payment</p>
                      <p className={`text-[9px] font-medium ${paymentMethod === "upi" ? "text-blue-500" : "text-slate-400"}`}>Pay via any UPI app</p>
                    </div>
                    {paymentMethod === "upi" && (
                      <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
                        <CheckCircle className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </button>
                )}
              </div>

              {/* UPI ID display */}
              {paymentMethod === "upi" && settings?.upi_id && (
                <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Pay to UPI ID</p>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black text-blue-800 font-mono">{settings?.upi_id}</p>
                    <button
                      onClick={() => { navigator.clipboard.writeText(settings?.upi_id); toast.success("UPI ID copied!"); }}
                      className="text-[10px] font-black text-blue-600 bg-white border border-blue-200 px-2 py-1 rounded-lg"
                    >Copy</button>
                  </div>
                  <p className="text-[9px] text-blue-400 font-medium mt-1">⚠️ Complete the UPI payment then click confirm below</p>
                </div>
              )}

              {/* COD info */}
              {paymentMethod === "cod" && (
                <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2">
                  <Banknote className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] font-medium text-emerald-700 leading-relaxed">
                    Please bring the exact amount of <span className="font-black">₹{totalAmount}</span> when you visit the clinic.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Patient info summary */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Patient</p>
            <p className="font-black text-slate-800 text-sm">{patient.name}</p>
            <p className="text-xs text-slate-400 font-medium">{patient.phone} · {patient.age}yr · {patient.gender}</p>
          </div>

          <button
            onClick={handlePayment}
            disabled={isSubmitting}
            className="w-full rounded-2xl py-4 text-sm font-black text-white shadow-xl active:scale-[0.99] transition-all disabled:opacity-70 flex items-center justify-center gap-2"
            style={{ backgroundColor: accentColor, boxShadow: `0 6px 20px ${accentColor}40` }}
          >
            {isSubmitting
              ? <Loader2 className="h-5 w-5 animate-spin" />
              : paymentMethod === "cod"
                ? <>Confirm Booking (Pay at Clinic) →</>
                : <>Confirm & Mark UPI Paid {isPriority && "⚡"} →</>}
          </button>


        </main>
      )}

      {/* ══════════ CONFIRMED ══════════ */}
      {step === "confirmed" && (
        <main className="flex-1 flex flex-col items-center justify-center px-6 pb-10 text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-green-400/20 rounded-full animate-ping" />
            <div className="h-24 w-24 bg-green-100 rounded-full flex items-center justify-center relative">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">Booking Confirmed! 🎉</h2>
          <div className="h-1 w-10 bg-green-400 rounded-full mx-auto mb-4" />

          {/* Order ID Badge */}
          <div className="mb-5 bg-blue-50 border-2 border-blue-200 rounded-2xl px-6 py-3 flex flex-col items-center gap-1">
            <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Your Order ID</p>
            <p className="text-xl font-black text-blue-700 tracking-widest font-mono">{confirmedOrderId}</p>
            <p className="text-[10px] text-blue-500 font-medium">Save this to track your booking</p>
          </div>

          <p className="text-sm text-slate-500 font-medium leading-relaxed mb-2 max-w-xs">
            Your appointment with <span className="font-black text-slate-700">{doctor.name}</span>
          </p>
          <p className="text-sm text-slate-500 font-medium leading-relaxed mb-8 max-w-xs">
            is confirmed for <span className="font-black text-slate-700">{formatDate(selectedDate)}</span> at{" "}
            <span className="font-black text-slate-700">{selectedSlot}</span>.
          </p>

          <div className="w-full max-w-xs space-y-3">
            <button
              onClick={() => navigate("/")}
              className="w-full rounded-2xl py-4 text-sm font-black text-white shadow-xl"
              style={{ backgroundColor: accentColor }}
            >
              Back to Home
            </button>
            <button
              onClick={() => navigate("/doctors")}
              className="w-full rounded-2xl py-3.5 text-sm font-bold border-2 border-slate-200 text-slate-600 bg-white"
            >
              Book Another Doctor
            </button>
          </div>
        </main>
      )}
    </div>
  );
};

export default BookAppointmentPage;
