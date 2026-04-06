import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  FlaskConical, Calendar, Pill, Home, User,
  ChevronRight, Heart, MapPin, Search, Bell, Star, Clock, ArrowRight,
} from "lucide-react";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Banner, getBanners, syncBannersFromSupabase } from "@/lib/bannersSync";
import { getLocalDoctors } from "@/lib/doctorsSync";
import { getSettings, syncSettingsFromSupabase } from "@/lib/settingsSync";

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<any[]>([]);
  const [activeBanner, setActiveBanner] = useState(0);
  const [search, setSearch] = useState("");
  const bannerRef = useRef<HTMLDivElement>(null);
  const [banners, setBanners] = useState<Banner[]>(getBanners());
  const [settings, setSettings] = useState(getSettings());

  // ── Data sync ──────────────────────────────────────────────────────────────
  useEffect(() => {
    syncSettingsFromSupabase().then(s => setSettings(s));
    syncBannersFromSupabase().then(b => setBanners(b));

    const handleBannersUpdate = () => setBanners(getBanners());
    const handleSettingsUpdate = () => setSettings(getSettings());
    window.addEventListener("banners_updated", handleBannersUpdate);
    window.addEventListener("settings_updated", handleSettingsUpdate);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "aaroksha_banners") handleBannersUpdate();
      if (e.key === "aaroksha_settings") handleSettingsUpdate();
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("banners_updated", handleBannersUpdate);
      window.removeEventListener("settings_updated", handleSettingsUpdate);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    const handleUpdate = () => {
      supabase.from("doctors").select("*").limit(4).then(({ data }) => {
        const local = getLocalDoctors() || [];
        if (!data || data.length === 0) { setDoctors(local.slice(0, 4)); return; }
        const dbIds = new Set(data.map(d => d.id));
        const missingLocal = local.filter(d => !dbIds.has(d.id) && String(d.id).startsWith("local-"));
        setDoctors([...data, ...missingLocal].slice(0, 4));
      }).catch(() => setDoctors(getLocalDoctors().slice(0, 4)));
    };

    handleUpdate();
    window.addEventListener("doctors_updated", handleUpdate);
    const handleStorage = (e: StorageEvent) => { if (e.key === "aaroksha_doctors") handleUpdate(); };
    window.addEventListener("storage", handleStorage);

    const channel = supabase.channel("public:doctors_index")
      .on("postgres_changes", { event: "*", schema: "public", table: "doctors" }, handleUpdate)
      .subscribe();

    return () => {
      window.removeEventListener("doctors_updated", handleUpdate);
      window.removeEventListener("storage", handleStorage);
      supabase.removeChannel(channel);
    };
  }, []);

  // ── Banner auto-rotate ─────────────────────────────────────────────────────
  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setActiveBanner(p => (p + 1) % banners.length), 4000);
    return () => clearInterval(t);
  }, [banners.length]);

  const goToBanner = (idx: number) => setActiveBanner((idx + banners.length) % banners.length);

  // ── Search ─────────────────────────────────────────────────────────────────
  const handleSearch = (e: React.FormEvent | React.KeyboardEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    if (!search.trim()) return;
    const q = search.toLowerCase();
    if (q.includes("lab") || q.includes("test") || q.includes("blood") || q.includes("profile")) {
      navigate(`/lab-tests?q=${encodeURIComponent(search)}`);
    } else {
      navigate(`/doctors?q=${encodeURIComponent(search)}`);
    }
  };

  // ── Static data ────────────────────────────────────────────────────────────
  const services = [
    {
      icon: Calendar, title: "OP Booking",
      subtitle: "Consult with specialised doctors instantly.",
      to: "/doctors", color: "#2563eb", bg: "#dbeafe",
      visible: settings.opdCheck,
    },
    {
      icon: FlaskConical, title: "Lab Tests",
      subtitle: "Home collection and rapid results.",
      to: "/lab-tests", color: "#0d9488", bg: "#ccfbf1",
      visible: settings.labCheck,
    },
    {
      icon: Pill, title: "Medicines",
      subtitle: "Genuine medicines delivered to door.",
      to: "/prescription", color: "#6366f1", bg: "#e0e7ff",
      visible: settings.pharmCheck,
    },
  ].filter(s => s.visible !== false);

  const bottomNav = [
    { icon: Home, label: "Home", to: "/" },
    { icon: Calendar, label: "Booking", to: "/doctors" },
    { icon: FlaskConical, label: "Tests", to: "/lab-tests" },
    { icon: Pill, label: "Medicines", to: "/prescription" },
    { icon: User, label: "Profile", to: "/profile" },
  ];

  const desktopNav = [
    { label: "Home", to: "/" },
    { label: "Doctors", to: "/doctors" },
    { label: "Lab Tests", to: "/lab-tests" },
    { label: "Medicines", to: "/prescription" },
  ];

  const initial = (name: string) => name?.replace("Dr. ", "").charAt(0) || "D";
  const avatarColors = ["#2563eb", "#7c3aed", "#059669", "#dc2626"];

  return (
    <div className="min-h-screen" style={{ background: "#f4f6fb" }}>

      {/* ═══════════════════════════════════════════
          DESKTOP NAV (md+)
      ═══════════════════════════════════════════ */}
      <nav className="hidden md:flex sticky top-0 z-50 bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto w-full px-8 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="h-10 w-10 flex items-center justify-center">
              <img src="/logo.png" alt="Aaroksha Logo" className="h-full w-full object-contain" />
            </div>
            <span className="text-lg font-black text-slate-800 tracking-tight">
              {settings.platform_name || "AAROKSHA"}
            </span>
          </Link>

          <div className="flex items-center gap-8">
            {desktopNav.map(({ label, to }) => (
              <Link
                key={to} to={to}
                className={`text-sm font-bold transition-colors ${location.pathname === to ? "text-blue-600" : "text-slate-500 hover:text-slate-800"}`}
              >
                {label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleSearch}
                className="h-10 rounded-xl bg-slate-50 border border-slate-200 pl-9 pr-4 text-sm w-48 outline-none focus:border-blue-300 transition-all"
              />
            </div>
            <Link to="/doctors" className="h-10 px-5 rounded-xl bg-blue-600 text-white text-sm font-bold flex items-center gap-1.5 hover:bg-blue-700 transition-colors shadow-md shadow-blue-200">
              Book Now <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════
          DESKTOP HERO (md+)
      ═══════════════════════════════════════════ */}
      <section
        className="hidden md:block relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #38bdf8 100%)" }}
      >
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-10 bg-white" />
        <div className="absolute bottom-0 left-1/4 w-72 h-72 rounded-full opacity-5 bg-white" />
        <div className="max-w-7xl mx-auto px-8 py-16 relative z-10">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 bg-white/15 text-white text-xs font-bold px-4 py-2 rounded-full mb-5 border border-white/20">
              <MapPin className="h-3.5 w-3.5" /> Hyderabad · 50,000+ Happy Patients
            </span>
            <h1 className="text-5xl font-black text-white leading-tight mb-4">
              Your Complete<br /><span className="text-sky-300">Healthcare</span> Platform
            </h1>
            <p className="text-blue-100 text-base font-medium mb-7 leading-relaxed">
              Book doctors, order lab tests at home, and get medicines delivered — all in one place.
            </p>
            <div className="flex items-center gap-4">
              <Link to="/doctors" className="inline-flex items-center gap-2 bg-white text-blue-600 font-black px-7 py-3.5 rounded-2xl hover:bg-blue-50 transition-all shadow-xl shadow-blue-900/30">
                <Calendar className="h-5 w-5" /> Book Appointment
              </Link>
              <Link to="/lab-tests" className="inline-flex items-center gap-2 bg-white/10 border border-white/25 text-white font-bold px-6 py-3.5 rounded-2xl hover:bg-white/20 transition-all">
                <FlaskConical className="h-5 w-5" /> Book Lab Test
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          MOBILE HEADER (below md)
      ═══════════════════════════════════════════ */}
      <header className="md:hidden bg-white sticky top-0 z-40" style={{ boxShadow: "0 1px 0 #e8ecf4" }}>
        <div className="flex items-center justify-between px-4 pt-10 pb-3">

          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 flex items-center justify-center shrink-0">
              <img src="/logo.png" alt="Aaroksha Logo" className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="font-black text-slate-800 leading-none" style={{ fontSize: "17px", letterSpacing: "-0.02em" }}>
                {settings.platform_name || "Aaroksha"}
              </p>
              <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-0.5 mt-0.5">
                <MapPin className="h-2.5 w-2.5 text-blue-500" />
                New Delhi, India
              </p>
            </div>
          </div>

          {/* Bell */}
          <button className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center relative">
            <Bell className="h-4.5 w-4 text-slate-500" />
          </button>
        </div>

        {/* Search bar */}
        <div className="relative px-4 pb-4">
          <Search className="absolute left-7 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            placeholder="Search doctors, tests, medicines..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleSearch}
            className="w-full h-11 rounded-2xl pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 outline-none transition-all"
            style={{
              background: "#f4f6fb",
              border: "1.5px solid #e8ecf4",
            }}
          />
        </div>
      </header>

      {/* ═══════════════════════════════════════════
          MAIN CONTENT
      ═══════════════════════════════════════════ */}
      <main className="max-w-7xl mx-auto">
        <div className="px-4 md:px-8 pt-4 md:pt-10 pb-28 md:pb-12 space-y-5 md:space-y-10">

          {/* ── BANNER CAROUSEL ─────────────────────── */}
          <div className="relative select-none">
            <div
              ref={bannerRef}
              className="relative overflow-hidden rounded-2xl"
              style={{ minHeight: "clamp(170px, 48vw, 300px)" }}
            >
              <div
                className="flex transition-transform duration-500 ease-in-out h-full"
                style={{ transform: `translateX(-${activeBanner * 100}%)` }}
              >
                {banners.map((banner, i) => {
                  const isImageOnly = !!(banner.image && banner.imageOnly);
                  return (
                    <Link
                      key={i}
                      to={banner.to}
                      className="flex-shrink-0 w-full relative overflow-hidden block"
                    >
                      {isImageOnly ? (
                        <img
                          src={banner.image!}
                          alt={banner.title}
                          className="w-full block object-cover select-none"
                          style={{ maxHeight: "clamp(200px, 55vw, 440px)", minHeight: "clamp(160px, 35vw, 280px)" }}
                          draggable={false}
                        />
                      ) : (
                        /* ── BANNER CARD — matches screenshot style ── */
                        <div
                          className="w-full flex items-stretch relative overflow-hidden"
                          style={{
                            background: banner.image
                              ? `url(${banner.image}) center/cover no-repeat`
                              : "linear-gradient(135deg, #1d4ed8 0%, #2563eb 55%, #3b82f6 100%)",
                            minHeight: "clamp(170px, 48vw, 300px)",
                          }}
                        >
                          {/* Decorative circles */}
                          <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full opacity-15 bg-white" />
                          <div className="absolute right-12 -bottom-6 w-20 h-20 rounded-full opacity-10 bg-white" />

                          {/* Left: text content */}
                          <div className="flex-1 relative z-10 flex flex-col justify-center px-5 py-5 md:px-10 md:py-10">
                            {/* Badge */}
                            <span
                              className="inline-block text-[9px] md:text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full mb-2.5 self-start"
                              style={{ background: "#facc15", color: "#1e3a8a" }}
                            >
                              {banner.badge}
                            </span>

                            {/* Title */}
                            <h2
                              className="text-white font-black leading-tight mb-3 md:mb-4 whitespace-pre-line"
                              style={{
                                fontSize: "clamp(20px, 5.5vw, 36px)",
                                textShadow: "0 2px 10px rgba(0,0,0,0.2)",
                              }}
                            >
                              {banner.title.replace("\\n", "\n")}
                            </h2>

                            {/* CTA Button */}
                            <Link
                              to={banner.to}
                              onClick={e => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 self-start font-black text-blue-700 bg-white rounded-xl active:scale-95 transition-transform"
                              style={{
                                fontSize: "clamp(11px, 2.8vw, 14px)",
                                padding: "clamp(7px, 1.8vw, 11px) clamp(14px, 3.5vw, 22px)",
                                boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
                              }}
                            >
                              {banner.cta}
                            </Link>
                          </div>

                          {/* Right: doctor illustration (only when no custom bg image) */}
                          {!banner.image && (
                            <div
                              className="shrink-0 flex items-end justify-center relative z-10 overflow-hidden"
                              style={{
                                width: "clamp(110px, 30vw, 200px)",
                                background: "linear-gradient(180deg, #0f766e 0%, #134e4a 100%)",
                                borderRadius: "0 16px 16px 0",
                              }}
                            >
                              <img
                                src="/doctor-banner.png"
                                alt="Doctor"
                                className="block object-contain select-none"
                                style={{
                                  width: "100%",
                                  maxHeight: "clamp(160px, 44vw, 290px)",
                                  objectPosition: "bottom center",
                                }}
                                draggable={false}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>

              {/* Desktop left/right arrows */}
              {banners.length > 1 && (
                <>
                  <button
                    onClick={e => { e.preventDefault(); goToBanner(activeBanner - 1); }}
                    className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-md items-center justify-center text-white transition-all border border-white/20 shadow-lg"
                    aria-label="Previous banner"
                  >
                    <ChevronRight className="h-4 w-4 rotate-180" />
                  </button>
                  <button
                    onClick={e => { e.preventDefault(); goToBanner(activeBanner + 1); }}
                    className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-md items-center justify-center text-white transition-all border border-white/20 shadow-lg"
                    aria-label="Next banner"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>

            {/* Dot nav */}
            {banners.length > 1 && (
              <div className="flex justify-center gap-2 mt-3">
                {banners.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goToBanner(i)}
                    className={`rounded-full transition-all duration-300 ${i === activeBanner ? "w-6 h-1.5 bg-blue-600" : "w-1.5 h-1.5 bg-slate-300 hover:bg-slate-400"}`}
                    aria-label={`Go to slide ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── OUR SERVICES ───────────────────────── */}
          <div>
            {/* Section header */}
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <div>
                <h2 className="text-base md:text-lg font-black text-slate-800 leading-tight">Our Services</h2>
                <p className="text-[11px] md:text-xs font-semibold mt-0.5" style={{ color: "#f97316" }}>
                  Comprehensive care at your fingertips
                </p>
              </div>
              <Link to="/doctors" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-0.5">
                View All <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Service cards */}
            <div className="grid grid-cols-3 gap-2.5 md:gap-4">
              {services.map(s => (
                <Link
                  key={s.to}
                  to={s.to}
                  className="bg-white rounded-2xl md:rounded-3xl p-3 md:p-5 flex flex-col items-start text-left border active:scale-95 transition-all duration-150 group"
                  style={{ borderColor: "#eef0f7", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
                >
                  {/* Icon box */}
                  <div
                    className="h-11 w-11 md:h-14 md:w-14 rounded-xl md:rounded-2xl flex items-center justify-center mb-2.5 md:mb-3 group-hover:scale-110 transition-transform shrink-0"
                    style={{ backgroundColor: s.bg }}
                  >
                    <s.icon className="h-5 w-5 md:h-7 md:w-7" style={{ color: s.color }} />
                  </div>

                  <p className="text-[11px] md:text-sm font-black text-slate-800 leading-tight mb-1">{s.title}</p>
                  <p className="text-[9px] md:text-[10px] text-slate-400 font-medium leading-snug">{s.subtitle}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* ── TOP DOCTORS ─────────────────────────── */}
          {doctors.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <div>
                  <h2 className="text-base md:text-lg font-black text-slate-800">Top Doctors</h2>
                  <p className="text-[11px] font-semibold mt-0.5" style={{ color: "#f97316" }}>
                    Trusted specialists near you
                  </p>
                </div>
                <Link to="/doctors" className="text-xs font-bold text-blue-600 flex items-center gap-0.5 hover:underline">
                  View All <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {/* Mobile: horizontal scroll */}
              <div className="md:hidden flex gap-3 overflow-x-auto pb-2 -mx-4 px-4" style={{ scrollbarWidth: "none" }}>
                {doctors.map((doc: any, idx) => (
                  <div
                    key={doc.id}
                    onClick={() => navigate(`/book-appointment/${doc.id}`)}
                    className="flex-shrink-0 w-[130px] bg-white rounded-2xl p-3 flex flex-col items-center text-center border active:scale-95 transition-all cursor-pointer"
                    style={{ borderColor: "#eef0f7", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
                  >
                    <div
                      className="h-12 w-12 rounded-full flex items-center justify-center mb-2 text-white font-black text-lg shadow-md overflow-hidden"
                      style={{ backgroundColor: avatarColors[idx % 4] }}
                    >
                      {doc.image_url && doc.image_url.startsWith("http") ? (
                        <img src={doc.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        initial(doc.name)
                      )}
                    </div>
                    <p className="text-[11px] font-black text-slate-800 leading-tight mb-0.5 w-full truncate">{doc.name}</p>
                    <p className="text-[9px] font-bold text-blue-600 mb-1.5 w-full truncate">{doc.specialty}</p>
                    <div className="flex items-center justify-center gap-1.5 mb-2">
                      <span className="flex items-center gap-0.5 text-[9px] font-black text-slate-600">
                        <Star className="h-2.5 w-2.5 text-amber-400 fill-amber-400" />{doc.rating || 4.8}
                      </span>
                      <span className="flex items-center gap-0.5 text-[9px] font-bold text-slate-400">
                        <Clock className="h-2.5 w-2.5" />{doc.experience}y
                      </span>
                    </div>
                    <button
                      className="w-full rounded-lg py-1.5 text-[9px] font-black text-white"
                      style={{ backgroundColor: avatarColors[idx % 4] }}
                    >
                      Book Now
                    </button>
                  </div>
                ))}
              </div>

              {/* Desktop: grid */}
              <div className="hidden md:grid grid-cols-4 gap-4">
                {doctors.map((doc: any, idx) => (
                  <div
                    key={doc.id}
                    className="bg-white rounded-3xl p-5 flex flex-col items-center text-center border hover:shadow-xl hover:-translate-y-1 transition-all group cursor-pointer"
                    style={{ borderColor: "#eef0f7" }}
                    onClick={() => navigate(`/book-appointment/${doc.id}`)}
                  >
                    <div
                      className="h-16 w-16 rounded-full flex items-center justify-center mb-3 text-white font-black text-2xl shadow-lg group-hover:scale-110 transition-transform overflow-hidden"
                      style={{ backgroundColor: avatarColors[idx % 4] }}
                    >
                      {doc.image_url && doc.image_url.startsWith("http") ? (
                        <img src={doc.image_url} alt="" className="h-full w-full object-cover" />
                      ) : initial(doc.name)}
                    </div>
                    <p className="text-sm font-black text-slate-800 leading-tight mb-0.5 line-clamp-1">{doc.name}</p>
                    <p className="text-[11px] font-bold text-blue-600 mb-3 line-clamp-1">{doc.specialty}</p>
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <span className="flex items-center gap-0.5 text-xs font-black text-slate-600">
                        <Star className="h-3 w-3 text-amber-400 fill-amber-400" />{doc.rating || 4.8}
                      </span>
                      <span className="flex items-center gap-0.5 text-xs font-bold text-slate-400">
                        <Clock className="h-3 w-3" />{doc.experience} yrs
                      </span>
                    </div>
                    <button
                      className="w-full rounded-xl py-2.5 text-xs font-black text-white"
                      style={{ backgroundColor: avatarColors[idx % 4] }}
                    >
                      Book Now
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── CTA BANNER ────────────────────────── */}
          <div
            className="rounded-3xl overflow-hidden relative"
            style={{ background: "linear-gradient(135deg, #2563eb 0%, #38bdf8 100%)" }}
          >
            <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full opacity-20 bg-white" />
            <div className="absolute left-1/3 -bottom-8 w-32 h-32 rounded-full opacity-10 bg-white" />
            <div className="relative z-10 p-6 md:p-10 md:flex md:items-center md:justify-between">
              <div className="md:max-w-xl mb-4 md:mb-0">
                <h2 className="text-xl md:text-3xl font-black text-white leading-tight mb-2">
                  Ready to Take Care of Your Health?
                </h2>
                <p className="text-sm text-blue-100 font-medium leading-relaxed">
                  Join thousands of patients who trust Aaroksha. Book your first appointment today.
                </p>
              </div>
              <Link
                to="/doctors"
                className="inline-flex items-center gap-2 bg-white font-black text-sm px-7 py-3.5 rounded-2xl hover:bg-blue-50 active:scale-95 transition-all shadow-xl md:ml-8 whitespace-nowrap"
                style={{ color: "#2563eb" }}
              >
                Get Started Now <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

        </div>
      </main>

      {/* ═══════════════════════════════════════════
          MOBILE BOTTOM NAV
      ═══════════════════════════════════════════ */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white"
        style={{ borderTop: "1.5px solid #eef0f7", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5">
          {bottomNav.map(({ icon: Icon, label, to }) => {
            const active = label === "Home" ? location.pathname === "/" : location.pathname === to;
            return (
              <Link
                key={label}
                to={to}
                className={`flex flex-col items-center gap-1 py-2.5 transition-colors relative ${active ? "text-blue-600" : "text-slate-400"}`}
              >
                {active && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-full" />
                )}
                <Icon className={`h-5 w-5 transition-transform ${active ? "scale-110" : ""}`} />
                <span className={`text-[9px] font-black tracking-tight ${active ? "text-blue-600" : "text-slate-400"}`}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

    </div>
  );
};

export default Index;
