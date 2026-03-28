import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Calendar, Clock, ArrowLeft, Star, CheckCircle } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { doctors, timeSlots, type PatientDetails } from "@/data/mockData";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const BookAppointmentPage = () => {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const doctor = doctors.find((d) => d.id === doctorId);

  const [step, setStep] = useState<"slots" | "details" | "checkout" | "confirmed">("slots");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [patient, setPatient] = useState<PatientDetails>({
    name: "", age: "", gender: "", phone: "", email: "", address: "",
  });

  if (!doctor) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Doctor not found</p>
        </div>
      </div>
    );
  }

  // Generate next 7 days
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d.toISOString().split("T")[0];
  });

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" });
  };

  const handleBooking = () => {
    if (!patient.name || !patient.phone || !patient.age || !patient.gender) {
      toast.error("Please fill all required fields");
      return;
    }
    setStep("checkout");
  };

  const handlePayment = () => {
    toast.success("Payment successful!");
    setStep("confirmed");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <button
          onClick={() => step === "slots" ? navigate("/doctors") : setStep(step === "details" ? "slots" : step === "checkout" ? "details" : "slots")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6 transition"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {/* Doctor info card */}
        <div className="glass-card rounded-2xl p-6 mb-8 flex items-center gap-4">
          <div className="text-5xl">{doctor.image}</div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{doctor.name}</h2>
            <p className="text-sm text-primary font-medium">{doctor.specialty}</p>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="h-3.5 w-3.5 text-accent fill-accent" /> {doctor.rating} · {doctor.experience} yrs
            </div>
          </div>
          <div className="ml-auto text-right">
            <p className="text-2xl font-bold text-foreground">₹{doctor.fee}</p>
            <p className="text-xs text-muted-foreground">Consultation Fee</p>
          </div>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-8">
          {["Select Slot", "Patient Details", "Checkout"].map((label, i) => {
            const stepMap = ["slots", "details", "checkout"];
            const isActive = stepMap.indexOf(step) >= i || step === "confirmed";
            return (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                  {i + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:inline ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                {i < 2 && <div className={`flex-1 h-0.5 ${isActive ? "bg-primary" : "bg-border"}`} />}
              </div>
            );
          })}
        </div>

        {step === "slots" && (
          <div className="space-y-6 animate-fade-in-up">
            <div>
              <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" /> Select Date
              </h3>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {dates.map((d) => (
                  <button
                    key={d}
                    onClick={() => setSelectedDate(d)}
                    className={`flex-shrink-0 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      selectedDate === d
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-secondary text-secondary-foreground hover:bg-primary/10"
                    }`}
                  >
                    {formatDate(d)}
                  </button>
                ))}
              </div>
            </div>

            {selectedDate && (
              <div>
                <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" /> Select Time
                </h3>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot.id}
                      disabled={!slot.available}
                      onClick={() => setSelectedSlot(slot.time)}
                      className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        !slot.available
                          ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                          : selectedSlot === slot.time
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "bg-secondary text-secondary-foreground hover:bg-primary/10"
                      }`}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedSlot && (
              <button
                onClick={() => setStep("details")}
                className="w-full rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition"
              >
                Continue
              </button>
            )}
          </div>
        )}

        {step === "details" && (
          <div className="space-y-4 animate-fade-in-up">
            <h3 className="text-lg font-bold text-foreground">Patient Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Full Name *</label>
                <Input value={patient.name} onChange={(e) => setPatient({ ...patient, name: e.target.value })} placeholder="Enter name" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Age *</label>
                <Input type="number" value={patient.age} onChange={(e) => setPatient({ ...patient, age: e.target.value })} placeholder="Age" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Gender *</label>
                <div className="flex gap-2">
                  {["Male", "Female", "Other"].map((g) => (
                    <button
                      key={g}
                      onClick={() => setPatient({ ...patient, gender: g })}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                        patient.gender === g ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Phone *</label>
                <Input value={patient.phone} onChange={(e) => setPatient({ ...patient, phone: e.target.value })} placeholder="+91" />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-foreground mb-1 block">Email</label>
                <Input type="email" value={patient.email} onChange={(e) => setPatient({ ...patient, email: e.target.value })} placeholder="email@example.com" />
              </div>
            </div>
            <button onClick={handleBooking} className="w-full rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition mt-4">
              Continue to Checkout
            </button>
          </div>
        )}

        {step === "checkout" && (
          <div className="space-y-6 animate-fade-in-up">
            <h3 className="text-lg font-bold text-foreground">Booking Summary</h3>
            <div className="glass-card rounded-2xl p-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Doctor</span>
                <span className="font-medium text-foreground">{doctor.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Specialty</span>
                <span className="font-medium text-foreground">{doctor.specialty}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium text-foreground">{formatDate(selectedDate)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Time</span>
                <span className="font-medium text-foreground">{selectedSlot}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Patient</span>
                <span className="font-medium text-foreground">{patient.name}, {patient.age} yrs, {patient.gender}</span>
              </div>
              <hr className="border-border" />
              <div className="flex justify-between text-lg font-bold">
                <span className="text-foreground">Total</span>
                <span className="text-primary">₹{doctor.fee}</span>
              </div>
            </div>
            <button onClick={handlePayment} className="w-full rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition">
              Pay ₹{doctor.fee}
            </button>
          </div>
        )}

        {step === "confirmed" && (
          <div className="text-center space-y-4 animate-fade-in-up py-12">
            <CheckCircle className="h-20 w-20 text-primary mx-auto" />
            <h3 className="text-2xl font-bold text-foreground">Booking Confirmed!</h3>
            <p className="text-muted-foreground">
              Your appointment with {doctor.name} on {formatDate(selectedDate)} at {selectedSlot} has been confirmed.
            </p>
            <button onClick={() => navigate("/")} className="rounded-full bg-primary px-8 py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition">
              Back to Home
            </button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default BookAppointmentPage;
