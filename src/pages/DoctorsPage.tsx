import { useState, useEffect } from "react";
import SEO from "@/components/SEO";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Star, Search, Loader2, Clock, ChevronLeft, Home, Calendar, FlaskConical, Pill, User, Languages, Building2 } from "lucide-react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getLocalDoctors } from "@/lib/doctorsSync";
import { useSettings } from "@/lib/settingsSync";

const avatarColors = ["#2563eb", "#7c3aed", "#059669", "#dc2626", "#d97706", "#0891b2"];

const DoctorsPage = () => {
  const [search, setSearch] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("All");
  const [hospitalFilter, setHospitalFilter] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const queryClient = useQueryClient();
  const { settings } = useSettings();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get("q");
    const h = params.get("hospital");
    if (q) setSearch(q);
    if (h) setHospitalFilter(h);
    else setHospitalFilter(null);
  }, [location.search]);

  useEffect(() => {
    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
    };
    window.addEventListener("doctors_updated", handleUpdate);
    
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "aaroksha_doctors") handleUpdate();
    };
    window.addEventListener("storage", handleStorage);

    const channel = supabase.channel("public:doctors")
      .on("postgres_changes", { event: "*", schema: "public", table: "doctors" }, () => {
        handleUpdate();
      })
      .subscribe();

    return () => {
      window.removeEventListener("doctors_updated", handleUpdate);
      window.removeEventListener("storage", handleStorage);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: doctors = getLocalDoctors(), isLoading } = useQuery({
    queryKey: ["doctors"],
    queryFn: async () => {
      try {
        // 1. Get all active partners of type hospital
        const { data: activePartners, error: pError } = await supabase
          .from("partners")
          .select("partner_id")
          .eq("type", "hospital")
          .eq("status", "active");
        
        if (pError) throw pError;
        const activeIds = (activePartners || []).map(p => p.partner_id);

        // 2. Fetch doctors for these active partners
        const { data, error } = await supabase
          .from("doctors")
          .select("*")
          .in("partner_id", activeIds);

        if (error) throw error;
        
        const local = getLocalDoctors() || [];
        if (!data || data.length === 0) return local;

        // Merge offline local doctors that aren't in Supabase yet
        const dbIds = new Set(data.map(d => d.id));
        const missingLocal = local.filter(d => 
          !dbIds.has(d.id) && String(d.id).startsWith("local-")
        );
        
        return [...data, ...missingLocal];
      } catch (err) {
        console.error("Doctors fetch error:", err);
        return getLocalDoctors();
      }
    },
  });

  const specialties = ["All", ...Array.from(new Set(doctors.map((d: any) => d.specialty)))];

  const filtered = doctors.filter(
    (d: any) =>
      (selectedSpecialty === "All" || d.specialty === selectedSpecialty) &&
      (!hospitalFilter || d.hospitalId === hospitalFilter || d.hospital_id === hospitalFilter) &&
      (d.name.toLowerCase().includes(search.toLowerCase()) || 
       d.specialty.toLowerCase().includes(search.toLowerCase()) ||
       ((d.hospital_name || d.hospitalName) && (d.hospital_name || d.hospitalName).toLowerCase().includes(search.toLowerCase())))
  );

  const bottomNav = [
    { icon: Home, label: "Home", to: "/" },
    { icon: Calendar, label: "Booking", to: "/doctors" },
    { icon: FlaskConical, label: "Tests", to: "/lab-tests" },
    { icon: Pill, label: "Medicines", to: "/prescription" },
    { icon: User, label: "Profile", to: "/profile" },
  ];

  if (settings && !settings.opdCheck) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <SEO title="OP Booking - Coming Soon" description="OP Booking is coming soon to Aaroksha." />
        <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-6">
          <Calendar className="h-10 w-10 text-blue-600" />
        </div>
        <h1 className="text-2xl font-black text-slate-800 mb-2">Coming Soon!</h1>
        <p className="text-sm text-slate-500 max-w-xs mb-8">
          OPD Appointments are currently being upgraded. We will be back with this service shortly!
        </p>
        <button onClick={() => navigate("/")} className="px-6 py-3 bg-blue-600 text-white font-black rounded-xl text-sm shadow-lg shadow-blue-200">
          Return to Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <SEO 
        title="Best Doctors in Bhimavaram - Online OP Booking"
        description="Book appointments with the best specialists and doctors in Bhimavaram and West Godavari. Skip the queue and consult top healthcare professionals online."
        keywords={["doctor booking Bhimavaram", "OP appointment online", "best doctors West Godavari", "specialist consultation AP"]}
      />

      {/* ── Mobile Header ── */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="flex items-center gap-3 px-4 pt-5 pb-3">
          <button
            onClick={() => navigate("/")}
            className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0"
          >
            <ChevronLeft className="h-5 w-5 text-slate-600" />
          </button>
          <div className="flex-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Find a Specialist</p>
            <h1 className="text-lg font-black text-slate-800 leading-tight">OP Booking</h1>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              placeholder="Search doctors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 rounded-2xl bg-slate-50 border border-slate-200 pl-11 pr-4 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
        </div>

        {/* Specialty filter chips */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {specialties.map((s: any) => (
            <button
              key={s}
              onClick={() => setSelectedSpecialty(s)}
              className={`px-3.5 py-1.5 rounded-xl text-[11px] font-black whitespace-nowrap transition-all border ${
                selectedSpecialty === s
                  ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200"
                  : "bg-white text-slate-500 border-slate-200 hover:border-blue-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </header>

      {/* ── Doctor List ── */}
      <main className="flex-1 px-4 py-4 pb-28 space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading doctors...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-black text-slate-700">No doctors found</p>
            <p className="text-sm text-slate-400 mt-1">Try a different specialty or name</p>
          </div>
        ) : (
          filtered.map((doctor: any) => {
            const color = "#2563eb";
            const initial = doctor.name?.replace("Dr. ", "").charAt(0) || "D";
            return (
              <div
                key={doctor.id}
                className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm active:scale-[0.99] transition-all"
              >
                <div className="flex gap-4">
                  <div className="h-16 w-16 rounded-2xl overflow-hidden shrink-0 shadow-lg">
                    {doctor.image_url ? (
                      <img src={doctor.image_url} alt={doctor.name} className="h-full w-full object-cover" />
                    ) : (
                      <div
                        className="h-full w-full flex items-center justify-center text-white font-black text-2xl"
                        style={{ backgroundColor: color }}
                      >
                        {initial}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-slate-800 text-sm leading-tight truncate">{doctor.name}</h3>
                    <p className="text-[11px] font-bold uppercase tracking-widest mt-0.5" style={{ color }}>
                      {doctor.specialty}
                    </p>

                    {/* hospital */}
                    {(doctor.hospital_name || doctor.hospitalName) && (
                      <div className="flex items-center gap-1 mt-1">
                        <Building2 className="h-2.5 w-2.5 text-slate-400" />
                        <p className="text-[10px] font-medium text-slate-400 truncate">{doctor.hospital_name || doctor.hospitalName}</p>
                      </div>
                    )}

                    {/* Stats row */}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-0.5 text-[10px] font-black text-slate-600">
                        <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                        {doctor.rating || 4.8}
                      </span>
                      <span className="flex items-center gap-0.5 text-[10px] font-bold text-slate-400">
                        <Clock className="h-3 w-3" />
                        {doctor.experience} yrs
                      </span>
                      {doctor.languages && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-slate-400 truncate">
                          <Languages className="h-3 w-3 shrink-0" />
                          <span className="truncate">{doctor.languages}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom: Fee + Book */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Consult Fee</p>
                    <p className="text-lg font-black text-slate-800">₹{doctor.fee}</p>
                  </div>
                  <button
                    onClick={() => {
                      if (!doctor.available) {
                        toast.error("This doctor is currently unavailable for bookings");
                        return;
                      }
                      if (!user) {
                        toast.error("Please login to book appointments");
                        navigate("/auth");
                        return;
                      }
                      navigate(`/book-appointment/${doctor.id}`);
                    }}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black text-white transition-all active:scale-95 shadow-md ${!doctor.available ? "opacity-50 cursor-not-allowed" : ""}`}
                    style={{ backgroundColor: doctor.available ? color : "#94a3b8", boxShadow: doctor.available ? `0 4px 12px ${color}40` : "none" }}
                  >
                    {doctor.available ? "Book Now →" : "Unavailable"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </main>

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
                className={`flex flex-col items-center gap-1 py-3 transition-colors ${active ? "text-blue-600" : "text-slate-400"}`}
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

export default DoctorsPage;
