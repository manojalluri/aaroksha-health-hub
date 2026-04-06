import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Calendar, Clock, Star, CheckCircle, Loader2,
  ChevronLeft, Building2, Languages, Heart, Zap,
} from "lucide-react";
import { timeSlots, type PatientDetails } from "@/data/mockData";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { getLocalDoctors } from "@/lib/doctorsSync";

const avatarColors = ["#2563eb", "#7c3aed", "#059669", "#dc2626", "#d97706", "#0891b2"];

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  experience: number;
  fee: number;
  consultationFee?: number;
  hospital_name?: string;
  hospital_id?: string;
  partner_id?: string;
}

const genOrderId = (prefix: string) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${prefix}-${code}`;
};

const BookAppointmentPage = () => {
  const { doctorId } = useParams();
  const navigate = useNavigate();

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
  const [patient, setPatient] = useState<PatientDetails>({
    name: "", age: "", gender: "", phone: "", email: "", address: "",
  });

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d.toISOString().split("T")[0];
  });

  const formatDate = (d: string) =>
    d ? new Date(d).toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" }) : "";

  const { data: settings } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_settings").select("*").single();
      return data || { opd_fee: 29, priority_surcharge: 250 };
    }
  });

  const PRIORITY_FEE = Number(settings?.priority_surcharge || 250);
  const PLATFORM_FEE = Number(settings?.opd_fee || 29);
  const totalAmount = Number(doctor?.fee || doctor?.consultationFee || 0) + PLATFORM_FEE + (isPriority ? PRIORITY_FEE : 0);

  const handleBooking = () => {
    if (!patient.name || !patient.phone || !patient.age || !patient.gender) {
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
      // 1. First, create the appointment in Supabase with 'pending' status
      const newOrderId = genOrderId("OPD");
      const { data: appointment, error } = await supabase.from("appointments").insert({
        order_id: newOrderId,
        doctor_id: doctor?.id,
        doctor_name: doctor?.name,
        patient_name: patient.name,
        patient_phone: patient.phone,
        patient_email: patient.email || null,
        patient_age: patient.age ? String(patient.age) : null,
        patient_gender: patient.gender,
        appointment_date: selectedDate,
        appointment_time: selectedSlot,
        status: "pending",
        payment_status: "pending",
        platform_fee: PLATFORM_FEE,
        consultation_fee: Number(doctor?.fee || doctor?.consultationFee || 0),
        fee: Number(doctor?.fee || doctor?.consultationFee || 0),
        is_priority: isPriority,
        hospital_partner_id: doctor?.hospital_id || doctor?.partner_id,
        partner_id: doctor?.partner_id || doctor?.hospital_id,
      }).select().single();
      setConfirmedOrderId(newOrderId);

      if (error) {
        throw error;
      }

      // 2. Clear progress and start payment gateway
      toast.loading("Handing off to PhonePe Secure Gateway...", { duration: 2000 });

      // 3. Simulated PhonePe Hand-off
      // In a real environment, this redirects to PhonePe.
      // We implement a 'simulated' delay to reflect the premium experience.
      await new Promise(r => setTimeout(r, 2000));

      // 4. Update the record as 'paid' on successful simulated callback
      const { error: updateError } = await supabase
        .from("appointments")
        .update({ payment_status: "paid", status: "confirmed" })
        .eq("id", appointment.id);

      if (updateError) throw updateError;

      toast.success("Payment successful! Secure transaction ID: " + transactionId);
      setStep("confirmed");
    } catch (err) {
      console.error(err);
      toast.error("Transaction failed: " + (err instanceof Error ? err.message : "Unknown error"));
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

  const colorIdx = parseInt(doctorId || "0") % avatarColors.length;
  const accentColor = doctor ? avatarColors[colorIdx] : "#2563eb";
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
            className="h-14 w-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shrink-0 shadow-md"
            style={{ backgroundColor: accentColor, boxShadow: `0 4px 12px ${accentColor}40` }}
          >
            {initial}
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
                const dateObj = new Date(d);
                const isSelected = selectedDate === d;
                return (
                  <button
                    key={d}
                    onClick={() => { setSelectedDate(d); setSelectedSlot(""); }}
                    className="flex-shrink-0 w-[68px] py-3 rounded-2xl flex flex-col items-center gap-0.5 border-2 transition-all duration-200 active:scale-95"
                    style={
                      isSelected
                        ? { backgroundColor: accentColor, borderColor: accentColor, boxShadow: `0 4px 14px ${accentColor}40` }
                        : { backgroundColor: "white", borderColor: "#e2e8f0" }
                    }
                  >
                    <p className={`text-[9px] font-black uppercase tracking-widest ${isSelected ? "text-white/70" : "text-slate-400"}`}>
                      {dateObj.toLocaleDateString("en-IN", { weekday: "short" })}
                    </p>
                    <p className={`text-xl font-black leading-none ${isSelected ? "text-white" : "text-slate-800"}`}>
                      {dateObj.getDate()}
                    </p>
                    <p className={`text-[9px] font-black uppercase ${isSelected ? "text-white/70" : "text-slate-400"}`}>
                      {dateObj.toLocaleDateString("en-IN", { month: "short" })}
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
                {timeSlots.map((slot) => {
                  const isSelected = selectedSlot === slot.time;
                  return (
                    <button
                      key={slot.id}
                      disabled={!slot.available}
                      onClick={() => setSelectedSlot(slot.time)}
                      className={`py-3 rounded-xl text-xs font-black tracking-tight border-2 transition-all duration-200 active:scale-95 ${
                        !slot.available
                          ? "bg-slate-50 text-slate-300 border-transparent cursor-not-allowed"
                          : ""
                      }`}
                      style={
                        slot.available
                          ? isSelected
                            ? { backgroundColor: accentColor, borderColor: accentColor, color: "white", boxShadow: `0 4px 12px ${accentColor}40` }
                            : { backgroundColor: "white", borderColor: "#e2e8f0", color: "#475569" }
                          : {}
                      }
                    >
                      {slot.time}
                      {!slot.available && <span className="block text-[8px] font-bold mt-0.5 opacity-60">Booked</span>}
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
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Pay ₹{totalAmount} Now {isPriority && "⚡"} →</>}
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
