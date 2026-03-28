import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, Plus, Minus, Trash2, Search, CheckCircle, MapPin, Clock } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { labTests, type CartItem, type PatientDetails } from "@/data/mockData";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const LabTestsPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [step, setStep] = useState<"browse" | "details" | "checkout" | "confirmed">("browse");
  const [patient, setPatient] = useState<PatientDetails>({ name: "", age: "", gender: "", phone: "", email: "", address: "" });
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");

  const categories = ["All", ...new Set(labTests.map((t) => t.category))];
  const filtered = labTests.filter(
    (t) =>
      (selectedCategory === "All" || t.category === selectedCategory) &&
      t.name.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (test: typeof labTests[0]) => {
    const existing = cart.find((c) => c.test.id === test.id);
    if (existing) {
      toast.info("Already in cart");
      return;
    }
    setCart([...cart, { test, quantity: 1 }]);
    toast.success(`${test.name} added to cart`);
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter((c) => c.test.id !== id));
  };

  const total = cart.reduce((sum, c) => sum + c.test.price * c.quantity, 0);

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d.toISOString().split("T")[0];
  });
  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" });
  const collectionTimes = ["07:00 AM", "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM"];

  const handleProceed = () => {
    if (cart.length === 0) { toast.error("Cart is empty"); return; }
    setStep("details");
    setShowCart(false);
  };

  const handleContinue = () => {
    if (!patient.name || !patient.phone || !patient.address || !selectedDate || !selectedTime) {
      toast.error("Please fill all required fields");
      return;
    }
    setStep("checkout");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        {step === "browse" && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Lab Tests</h1>
              <button
                onClick={() => setShowCart(!showCart)}
                className="relative flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                <ShoppingCart className="h-4 w-4" />
                Cart ({cart.length})
              </button>
            </div>

            {showCart && cart.length > 0 && (
              <div className="glass-card rounded-2xl p-6 mb-6 animate-fade-in-up">
                <h3 className="text-lg font-bold text-foreground mb-4">Your Cart</h3>
                {cart.map((item) => (
                  <div key={item.test.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                    <div>
                      <p className="font-medium text-foreground text-sm">{item.test.name}</p>
                      <p className="text-xs text-muted-foreground">Results in {item.test.turnaround}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-foreground">₹{item.test.price}</span>
                      <button onClick={() => removeFromCart(item.test.id)} className="text-destructive hover:opacity-70">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-border">
                  <span className="text-lg font-bold text-foreground">Total: ₹{total}</span>
                  <button onClick={handleProceed} className="rounded-full bg-primary px-6 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 transition">
                    Book at Home
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col md:flex-row gap-4 mb-8">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search lab tests..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedCategory(c)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      selectedCategory === c ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-primary/10"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((test) => {
                const inCart = cart.some((c) => c.test.id === test.id);
                return (
                  <div key={test.id} className="glass-card rounded-2xl p-5 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-sm font-bold text-foreground flex-1">{test.name}</h3>
                      <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{test.category}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{test.description}</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-bold text-foreground">₹{test.price}</p>
                        <p className="text-xs text-muted-foreground">Results: {test.turnaround}</p>
                      </div>
                      <button
                        onClick={() => addToCart(test)}
                        disabled={inCart}
                        className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                          inCart ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground hover:opacity-90"
                        }`}
                      >
                        {inCart ? "Added" : "Add to Cart"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {cart.length > 0 && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
                <button onClick={handleProceed} className="glass-card rounded-full px-8 py-3 text-sm font-bold text-primary shadow-lg flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" /> {cart.length} tests · ₹{total} — Book at Home
                </button>
              </div>
            )}
          </>
        )}

        {step === "details" && (
          <div className="max-w-2xl mx-auto animate-fade-in-up">
            <button onClick={() => setStep("browse")} className="text-sm text-muted-foreground hover:text-primary mb-6 flex items-center gap-1">
              ← Back to tests
            </button>
            <h2 className="text-2xl font-bold text-foreground mb-6">Schedule Home Collection</h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-foreground mb-3 flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> Patient & Address</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="text-sm font-medium text-foreground mb-1 block">Name *</label><Input value={patient.name} onChange={(e) => setPatient({ ...patient, name: e.target.value })} /></div>
                  <div><label className="text-sm font-medium text-foreground mb-1 block">Phone *</label><Input value={patient.phone} onChange={(e) => setPatient({ ...patient, phone: e.target.value })} /></div>
                  <div className="md:col-span-2"><label className="text-sm font-medium text-foreground mb-1 block">Address *</label><Input value={patient.address} onChange={(e) => setPatient({ ...patient, address: e.target.value })} placeholder="Full address for sample collection" /></div>
                </div>
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground mb-3 flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /> Select Date & Time</h3>
                <div className="flex gap-3 overflow-x-auto pb-2 mb-4">
                  {dates.map((d) => (
                    <button key={d} onClick={() => setSelectedDate(d)} className={`flex-shrink-0 px-4 py-3 rounded-xl text-sm font-medium transition-all ${selectedDate === d ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-primary/10"}`}>
                      {formatDate(d)}
                    </button>
                  ))}
                </div>
                {selectedDate && (
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                    {collectionTimes.map((t) => (
                      <button key={t} onClick={() => setSelectedTime(t)} className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${selectedTime === t ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-primary/10"}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={handleContinue} className="w-full rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition">Continue to Payment</button>
            </div>
          </div>
        )}

        {step === "checkout" && (
          <div className="max-w-2xl mx-auto animate-fade-in-up">
            <button onClick={() => setStep("details")} className="text-sm text-muted-foreground hover:text-primary mb-6 flex items-center gap-1">← Back</button>
            <h2 className="text-2xl font-bold text-foreground mb-6">Order Summary</h2>
            <div className="glass-card rounded-2xl p-6 space-y-3 mb-6">
              {cart.map((item) => (
                <div key={item.test.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{item.test.name}</span>
                  <span className="font-medium text-foreground">₹{item.test.price}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Collection</span><span className="font-medium text-foreground">{formatDate(selectedDate)}, {selectedTime}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Address</span><span className="font-medium text-foreground">{patient.address}</span></div>
              <hr className="border-border" />
              <div className="flex justify-between text-lg font-bold"><span className="text-foreground">Total</span><span className="text-primary">₹{total}</span></div>
            </div>
            <button onClick={() => { toast.success("Payment successful!"); setStep("confirmed"); }} className="w-full rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition">Pay ₹{total}</button>
          </div>
        )}

        {step === "confirmed" && (
          <div className="text-center space-y-4 animate-fade-in-up py-12 max-w-md mx-auto">
            <CheckCircle className="h-20 w-20 text-primary mx-auto" />
            <h3 className="text-2xl font-bold text-foreground">Booking Confirmed!</h3>
            <p className="text-muted-foreground">Our phlebotomist will visit on {formatDate(selectedDate)} at {selectedTime} for sample collection.</p>
            <button onClick={() => navigate("/")} className="rounded-full bg-primary px-8 py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition">Back to Home</button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default LabTestsPage;
