import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Camera, CheckCircle, Clock, Package, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Medicine {
  name: string;
  dosage: string;
  price: number;
  available: boolean;
}

const PrescriptionPage = () => {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [step, setStep] = useState<"upload" | "processing" | "review" | "address" | "confirmed">("upload");
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImage(reader.result as string);
        setStep("processing");
        // Simulate admin processing
        setTimeout(() => {
          setMedicines([
            { name: "Amoxicillin 500mg", dosage: "1 tablet x 3 times/day", price: 85, available: true },
            { name: "Paracetamol 650mg", dosage: "1 tablet x 2 times/day", price: 25, available: true },
            { name: "Cetirizine 10mg", dosage: "1 tablet at night", price: 35, available: true },
            { name: "Omeprazole 20mg", dosage: "1 capsule before breakfast", price: 65, available: false },
            { name: "Multivitamin Tablets", dosage: "1 tablet daily", price: 120, available: true },
          ]);
          setStep("review");
        }, 2500);
      };
      reader.readAsDataURL(file);
    }
  };

  const availableMeds = medicines.filter((m) => m.available);
  const total = availableMeds.reduce((s, m) => s + m.price, 0);
  const deliveryFee = 40;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-6">Order Medicines</h1>

        {step === "upload" && (
          <div className="animate-fade-in-up">
            <div
              onClick={() => fileRef.current?.click()}
              className="glass-card rounded-2xl p-12 text-center cursor-pointer hover:shadow-lg transition-all border-2 border-dashed border-primary/30 hover:border-primary/60"
            >
              <Upload className="h-16 w-16 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-bold text-foreground mb-2">Upload Prescription</h3>
              <p className="text-sm text-muted-foreground mb-4">Take a photo or upload from your device</p>
              <div className="flex items-center justify-center gap-4">
                <span className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">
                  <Camera className="h-4 w-4" /> Take Photo
                </span>
                <span className="flex items-center gap-2 rounded-full bg-secondary px-5 py-2 text-sm font-medium text-secondary-foreground">
                  <Upload className="h-4 w-4" /> Upload
                </span>
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="mt-8 glass-card rounded-2xl p-6">
              <h3 className="text-base font-bold text-foreground mb-3">How it works</h3>
              <div className="space-y-4">
                {[
                  { icon: Upload, text: "Upload your prescription photo" },
                  { icon: Clock, text: "Our pharmacist reviews & verifies medicines" },
                  { icon: CheckCircle, text: "Get price confirmation & availability" },
                  { icon: Package, text: "Medicines delivered to your doorstep" },
                ].map(({ icon: Icon, text }, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-sm text-foreground">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === "processing" && (
          <div className="text-center py-16 animate-fade-in-up">
            {image && <img src={image} alt="Prescription" className="w-48 h-48 object-cover rounded-2xl mx-auto mb-6 shadow-lg" />}
            <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
            <h3 className="text-xl font-bold text-foreground mb-2">Processing Prescription</h3>
            <p className="text-sm text-muted-foreground">Our pharmacist is reviewing your prescription...</p>
          </div>
        )}

        {step === "review" && (
          <div className="animate-fade-in-up">
            <div className="glass-card rounded-2xl p-6 mb-6">
              <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" /> Medicine Availability
              </h3>
              {medicines.map((med, i) => (
                <div key={i} className={`flex items-center justify-between py-3 border-b border-border last:border-0 ${!med.available ? "opacity-50" : ""}`}>
                  <div>
                    <p className="font-medium text-foreground text-sm">{med.name}</p>
                    <p className="text-xs text-muted-foreground">{med.dosage}</p>
                  </div>
                  <div className="text-right">
                    {med.available ? (
                      <>
                        <p className="font-bold text-foreground">₹{med.price}</p>
                        <p className="text-xs text-primary">In Stock</p>
                      </>
                    ) : (
                      <p className="text-xs text-destructive font-medium">Out of Stock</p>
                    )}
                  </div>
                </div>
              ))}
              <div className="mt-4 pt-4 border-t border-border space-y-1">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal ({availableMeds.length} items)</span><span className="text-foreground">₹{total}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Delivery</span><span className="text-foreground">₹{deliveryFee}</span></div>
                <div className="flex justify-between text-lg font-bold"><span className="text-foreground">Total</span><span className="text-primary">₹{total + deliveryFee}</span></div>
              </div>
            </div>
            <button onClick={() => setStep("address")} className="w-full rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition">
              Order Available Medicines
            </button>
          </div>
        )}

        {step === "address" && (
          <div className="animate-fade-in-up space-y-6">
            <button onClick={() => setStep("review")} className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1">← Back</button>
            <h3 className="text-lg font-bold text-foreground">Delivery Details</h3>
            <div className="space-y-4">
              <div><label className="text-sm font-medium text-foreground mb-1 block">Phone *</label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91" /></div>
              <div><label className="text-sm font-medium text-foreground mb-1 block">Delivery Address *</label><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full delivery address" /></div>
            </div>
            <div className="glass-card rounded-2xl p-4">
              <div className="flex justify-between text-lg font-bold"><span className="text-foreground">Total</span><span className="text-primary">₹{total + deliveryFee}</span></div>
            </div>
            <button
              onClick={() => {
                if (!address || !phone) { toast.error("Please fill all fields"); return; }
                toast.success("Order placed successfully!");
                setStep("confirmed");
              }}
              className="w-full rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition"
            >
              Pay ₹{total + deliveryFee}
            </button>
          </div>
        )}

        {step === "confirmed" && (
          <div className="text-center space-y-4 animate-fade-in-up py-12">
            <CheckCircle className="h-20 w-20 text-primary mx-auto" />
            <h3 className="text-2xl font-bold text-foreground">Order Confirmed!</h3>
            <p className="text-muted-foreground">Your medicines will be delivered within 2-4 hours.</p>
            <button onClick={() => navigate("/")} className="rounded-full bg-primary px-8 py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition">Back to Home</button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default PrescriptionPage;
