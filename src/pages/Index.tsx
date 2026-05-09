import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  FlaskConical, Calendar, Pill, Home, User, Clock,
  ChevronRight, MapPin, Search, Bell, Star, ArrowRight, Building2,
} from "lucide-react";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Banner, getBanners, syncBannersFromSupabase } from "@/lib/bannersSync";
import { getLocalDoctors } from "@/lib/doctorsSync";
import { getSettings, syncSettingsFromSupabase } from "@/lib/settingsSync";
import SEO from "@/components/SEO";
import { SEO_CONFIG } from "@/utils/seoConfig";

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [viewDocsFor, setViewDocsFor] = useState<any | null>(null);
  const [activeBanner, setActiveBanner] = useState(0);
  const [search, setSearch] = useState("");
  const bannerRef = useRef<HTMLDivElement>(null);
  const [banners, setBanners] = useState<Banner[]>(getBanners());
  const [settings, setSettings] = useState(getSettings());

  useEffect(() => {
    // Initial sync from database (Source of Truth)
    syncSettingsFromSupabase().then(s => setSettings(s));
    syncBannersFromSupabase().then(b => setBanners(b));

    const handleBannersUpdate = () => setBanners(getBanners());
    const handleSettingsUpdate = () => setSettings(getSettings());
    window.addEventListener("banners_updated", handleBannersUpdate);
    window.addEventListener("settings_updated", handleSettingsUpdate);
    
    // Cross-tab sync for banners and settings
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

  const handleSearch = (e: React.FormEvent | React.KeyboardEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    if (!search.trim()) return;

    const query = search.toLowerCase();
    if (query.includes("lab") || query.includes("test") || query.includes("blood") || query.includes("profile")) {
      navigate(`/lab-tests?q=${encodeURIComponent(search)}`);
    } else {
      navigate(`/doctors?q=${encodeURIComponent(search)}`);
    }
  };

  useEffect(() => {
    const handleUpdate = () => {
      supabase.from("doctors").select("*").limit(4).then(({ data }) => {
        const local = getLocalDoctors() || [];
        if (!data || data.length === 0) {
          setDoctors(local.slice(0, 4));
          return;
        }
        
        // Merge offline local doctors
        const dbIds = new Set(data.map(d => d.id));
        const missingLocal = local.filter(d => !dbIds.has(d.id) && String(d.id).startsWith("local-"));
        
        setDoctors([...data, ...missingLocal].slice(0, 4));
      }).catch(() => setDoctors(getLocalDoctors().slice(0, 4)));
    };
    
    handleUpdate();
    window.addEventListener("doctors_updated", handleUpdate);
    
    // Fetch Partner Hospitals
    supabase.from("partners").select("*").eq("type", "hospital").then(({ data: ps }) => {
      supabase.from("doctors").select("*").then(({ data: docs }) => {
        if (ps && docs) {
          const withCounts = ps.map(h => {
             const docCount = docs.filter(d => d.partner_id === h.partner_id).length;
             return { ...h, docCount };
          }).filter(h => h.docCount > 2);
          setHospitals(withCounts);
        }
      });
    });

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "aaroksha_doctors") handleUpdate();
    };
    window.addEventListener("storage", handleStorage);

    // Supabase Realtime fallback
    const channel = supabase.channel("public:doctors_index")
      .on("postgres_changes", { event: "*", schema: "public", table: "doctors" }, () => {
        handleUpdate();
      })
      .subscribe();

    // Supabase Realtime for Banners
    const bannerChannel = supabase.channel("public:platform_banners")
      .on("postgres_changes", { event: "*", schema: "public", table: "platform_banners" }, () => {
        syncBannersFromSupabase().then(b => setBanners(b));
      })
      .subscribe();

    return () => {
      window.removeEventListener("doctors_updated", handleUpdate);
      window.removeEventListener("storage", handleStorage);
      supabase.removeChannel(channel);
      supabase.removeChannel(bannerChannel);
    };
  }, []);

  // Banners are now synced from localStorage/getBanners

  const services = [
    { icon: Calendar, title: "OP Booking", subtitle: "Book appointments", to: "/doctors", color: "#2563eb", bg: "#dbeafe", visible: settings.opdCheck },
    { icon: FlaskConical, title: "Lab Tests", subtitle: "At your door", to: "/lab-tests", color: "#7c3aed", bg: "#ede9fe", visible: settings.labCheck },
    { icon: Pill, title: "Medicines", subtitle: "Delivered fast", to: "/prescription", color: "#059669", bg: "#d1fae5", visible: settings.pharmCheck },
  ].filter(s => s.visible !== false);

  const desktopNav = [
    { label: "Home", to: "/" },
    { label: "Doctors", to: "/doctors" },
    { label: "Lab Tests", to: "/lab-tests" },
    { label: "Medicines", to: "/prescription" },
  ];

  const bottomNav = [
    { icon: Home, label: "Home", to: "/" },
    { icon: Calendar, label: "Booking", to: "/doctors" },
    { icon: FlaskConical, label: "Tests", to: "/lab-tests" },
    { icon: Pill, label: "Medicines", to: "/prescription" },
    { icon: User, label: "Profile", to: "/profile" },
  ];

  useEffect(() => {
    const t = setInterval(() => setActiveBanner((p) => (p + 1) % banners.length), 4000);
    return () => clearInterval(t);
  }, [banners.length]);

  const goToBanner = (idx: number) => {
    setActiveBanner((idx + banners.length) % banners.length);
  };

  const initial = (name: string) => name?.replace("Dr. ", "").charAt(0) || "D";

  // Avatar background colors cycling
  const avatarColors = ["#2563eb"];

  return (
    <div className="min-h-screen bg-slate-50">
      <SEO 
        title="Bhimavaram's #1 Digital Healthcare Website"
        description="Book doctor appointments, order medicines online, and schedule lab tests in Bhimavaram. Aaroksha is West Godavari's most trusted healthcare platform."
        keywords={["healthcare Bhimavaram", "digital health West Godavari", "medicine delivery", "lab test booking"]}
        schema={{
          "@context": "https://schema.org",
          "@type": "MedicalOrganization",
          "name": SEO_CONFIG.brandName,
          "alternateName": "Aaroksha Health Hub",
          "url": SEO_CONFIG.websiteUrl,
          "logo": `${SEO_CONFIG.websiteUrl}/logo.png`,
          "address": {
            "@type": "PostalAddress",
            "addressLocality": SEO_CONFIG.location.city,
            "addressRegion": SEO_CONFIG.location.state,
            "postalCode": "534201",
            "addressCountry": "IN"
          }
        }}
      />

      {/* ─────────────────────────────────────────
          DESKTOP TOP NAV (md and above)
      ───────────────────────────────────────── */}
      <nav className="hidden md:flex sticky top-0 z-50 bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto w-full px-8 py-4 flex items-center justify-between">
          <Link to="/" className="flex flex-col justify-center gap-0.5">
            <span
              className="font-black tracking-tight leading-none uppercase"
              style={{
                fontSize: "26px",
                background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                letterSpacing: "-0.03em",
              }}
            >
              {settings.platform_name || "AAROKSHA"}
            </span>
            <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
              <MapPin className="h-3 w-3 text-blue-500" /> Bhimavaram, India
            </span>
          </Link>
          <div className="flex items-center gap-8">
            {desktopNav.map(({ label, to }) => (
              <Link key={to} to={to} className={`text-sm font-bold transition-colors ${location.pathname === to ? "text-blue-600" : "text-slate-500 hover:text-slate-800"}`}>
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
                onChange={(e) => setSearch(e.target.value)}
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


      {/* ─────────────────────────────────────────
          MOBILE HEADER (below md)
      ───────────────────────────────────────── */}
      <header className="md:hidden bg-white sticky top-0 z-40 border-b border-slate-100">
        <div className="flex items-center justify-between px-4 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            {/* Brand icon removed */}
            {/* Brand wordmark */}
            <div>
              <h1
                className="font-black tracking-tight leading-none"
                style={{
                  fontSize: "22px",
                  background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  letterSpacing: "-0.03em",
                }}
              >
                {settings.platform_name || "AAROKSHA"}
              </h1>
              <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 mt-0.5">
                <MapPin className="h-2.5 w-2.5 text-blue-500" /> Bhimavaram, India
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center">
              <Bell className="h-4 w-4 text-slate-500" />
            </button>
            <Link to={user ? "/profile" : "/auth"} className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-blue-200">
              <User className="h-4 w-4 text-white" />
            </Link>
          </div>
        </div>
        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              placeholder="Search doctors, tests, medicines..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearch}
              className="w-full h-11 rounded-2xl bg-slate-50 border border-slate-200 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
        </div>
      </header>

      {/* ═════════════════════════════════════════
          MAIN CONTENT (shared, responsive)
      ═════════════════════════════════════════ */}
      <main className="max-w-7xl mx-auto">
        <div className="px-4 md:px-8 pt-2 md:pt-6 pb-28 md:pb-12 space-y-6 md:space-y-10">

          {/* ── BANNER CAROUSEL ── */}
          <div className="relative select-none">
            {/* Slider Track */}
            <div
              ref={bannerRef}
              className="relative overflow-hidden rounded-2xl md:rounded-3xl"
              style={{ minHeight: "clamp(180px, 45vw, 320px)" }}
            >
              {/* Slides */}
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
                        /* ── IMAGE-ONLY MODE: pure image, no text overlay ── */
                        <img
                          src={banner.image!}
                          alt={banner.title}
                          className="w-full block object-cover select-none"
                          style={{ maxHeight: "clamp(200px, 55vw, 440px)", minHeight: "clamp(160px, 35vw, 280px)" }}
                          draggable={false}
                        />
                      ) : (
                        /* ── NORMAL MODE: gradient or image-with-text overlay ── */
                        <div
                          className="w-full relative"
                          style={{
                            background: banner.image
                              ? `url(${banner.image}) center/cover no-repeat`
                              : banner.gradient,
                            minHeight: "clamp(180px, 45vw, 320px)",
                          }}
                        >
                          {/* Gradient overlay for text readability */}
                          <div
                            className="absolute inset-0"
                            style={{
                              background: banner.image
                                ? "linear-gradient(120deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.25) 60%, rgba(0,0,0,0.05) 100%)"
                                : "linear-gradient(120deg, rgba(0,0,0,0.25) 0%, transparent 70%)",
                            }}
                          />
                          {/* Decorative circles (gradient mode only) */}
                          {!banner.image && (
                            <>
                              <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full opacity-20 bg-white" />
                              <div className="absolute right-8 -bottom-8 w-28 h-28 rounded-full opacity-10 bg-white" />
                              <div className="absolute left-1/2 top-0 w-64 h-64 rounded-full opacity-5 bg-white -translate-x-1/2" />
                            </>
                          )}
                          {/* Content */}
                          <div className="relative z-10 flex items-center justify-between h-full px-5 py-6 md:px-10 md:py-10" style={{ minHeight: "inherit" }}>
                            <div className="flex-1 max-w-xs md:max-w-lg">
                              <span className="inline-block bg-white/25 backdrop-blur-md text-white text-[10px] md:text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full mb-3 border border-white/30 shadow-sm">
                                {banner.badge}
                              </span>
                              <h2
                                className="text-white font-black leading-tight mb-2 md:mb-3 whitespace-pre-line"
                                style={{ fontSize: "clamp(18px, 5vw, 36px)", textShadow: "0 2px 16px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.4)" }}
                              >
                                {banner.title.replace("\\n", "\n")}
                              </h2>
                              <p
                                className="font-semibold mb-4 md:mb-6 leading-snug"
                                style={{ fontSize: "clamp(11px, 2.5vw, 15px)", color: "rgba(255,255,255,0.92)", textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}
                              >
                                {banner.subtitle}
                              </p>
                              <span
                                className="inline-flex items-center gap-1.5 bg-white font-black shadow-xl rounded-xl md:rounded-2xl active:scale-95 transition-transform"
                                style={{ color: banner.ctaColor || "#2563eb", padding: "clamp(8px, 2vw, 12px) clamp(16px, 4vw, 28px)", fontSize: "clamp(11px, 2.5vw, 14px)" }}
                              >
                                {banner.cta}
                                <ChevronRight className="h-3.5 w-3.5 md:h-4 md:w-4" />
                              </span>
                            </div>
                            {!banner.image && (
                              <div className="shrink-0 ml-3 md:ml-8 select-none" style={{ fontSize: "clamp(52px, 14vw, 110px)", filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.3))" }}>
                                {banner.emoji}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>

              {/* Left/Right arrows (visible on md+) */}
              {banners.length > 1 && (
                <>
                  <button
                    onClick={(e) => { e.preventDefault(); goToBanner(activeBanner - 1); }}
                    className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-md items-center justify-center text-white transition-all border border-white/20 shadow-lg"
                    aria-label="Previous banner"
                  >
                    <ChevronRight className="h-4 w-4 rotate-180" />
                  </button>
                  <button
                    onClick={(e) => { e.preventDefault(); goToBanner(activeBanner + 1); }}
                    className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-md items-center justify-center text-white transition-all border border-white/20 shadow-lg"
                    aria-label="Next banner"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}


            </div>

            {/* Dot navigation */}
            {banners.length > 1 && (
              <div className="flex justify-center gap-2 mt-3">
                {banners.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goToBanner(i)}
                    className={`rounded-full transition-all duration-300 ${
                      i === activeBanner
                        ? "w-7 h-2 bg-blue-600"
                        : "w-2 h-2 bg-slate-300 hover:bg-slate-400"
                    }`}
                    aria-label={`Go to slide ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── OUR SERVICES ── */}
          <div>
            <h2 className="text-base md:text-lg font-black text-slate-800 mb-3 md:mb-4">Our Services</h2>
            <div className="grid grid-cols-3 gap-2.5 md:gap-4">
              {services.map((s) => (
                <Link
                  key={s.to}
                  to={s.to}
                  className="bg-white rounded-2xl md:rounded-3xl p-3.5 md:p-5 flex flex-col items-center text-center border border-slate-100 hover:shadow-lg active:scale-95 transition-all duration-150 group"
                >
                  <div
                    className="h-12 w-12 md:h-16 md:w-16 rounded-xl md:rounded-2xl flex items-center justify-center mb-2 md:mb-3 group-hover:scale-110 transition-transform"
                    style={{ backgroundColor: s.bg }}
                  >
                    <s.icon className="h-6 w-6 md:h-8 md:w-8" style={{ color: s.color }} />
                  </div>
                  <p className="text-[11px] md:text-sm font-black text-slate-700 leading-tight">{s.title}</p>
                  <p className="text-[9px] md:text-[11px] text-slate-400 font-medium mt-0.5 leading-tight">{s.subtitle}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* ── PARTNER HOSPITALS / DOCTORS ── */}
          <div>
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h2 className="text-base md:text-lg font-black text-slate-800 tracking-tight">
                {viewDocsFor ? `Doctors at ${viewDocsFor.name}` : "Partner Hospitals"}
              </h2>
              {viewDocsFor ? (
                <button onClick={() => setViewDocsFor(null)} className="text-xs md:text-sm font-black text-blue-600 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-full">
                  <ArrowRight className="h-3 w-3 rotate-180" /> Back to Hospitals
                </button>
              ) : (
                <Link to="/doctors" className="text-xs md:text-sm font-bold text-blue-600 flex items-center gap-0.5">
                  See All <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>

            {!viewDocsFor ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
                {hospitals.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => setViewDocsFor(h)}
                    className="bg-white rounded-2xl md:rounded-3xl p-5 flex flex-col items-center text-center border border-slate-100 hover:shadow-xl hover:-translate-y-1 active:scale-95 transition-all group"
                  >
                    <div className="h-14 w-14 md:h-16 md:w-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm overflow-hidden border border-blue-100">
                      {h.logo_url ? (
                        <img src={h.logo_url} alt={h.name} className="h-full w-full object-cover" />
                      ) : (
                        <Building2 className="h-6 w-6 md:h-8 md:w-8 text-blue-600" />
                      )}
                    </div>
                    <p className="text-[11px] md:text-sm font-black text-slate-800 leading-tight truncate w-full mb-1">{h.name}</p>
                    <div className="bg-slate-50 px-2.5 py-1 rounded-lg">
                      <p className="text-[9px] md:text-[10px] text-slate-500 font-black uppercase tracking-[0.1em]">
                        {h.docCount} Specialized Doctors
                      </p>
                    </div>
                  </button>
                ))}
                {hospitals.length === 0 && (
                  <div className="col-span-full py-12 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                    <Building2 className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                    <p className="text-slate-400 text-xs font-bold font-mono uppercase">Connecting with more hospitals...</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                {doctors.filter(d => (d.partner_id === viewDocsFor.partner_id)).map((doc) => (
                  <div
                    key={doc.id}
                    className="bg-white rounded-2xl md:rounded-3xl p-4 flex flex-col items-center text-center border border-slate-100 hover:shadow-lg transition-all"
                  >
                    <div className="h-12 w-12 md:h-14 md:w-14 rounded-2xl bg-blue-600 flex items-center justify-center mb-3 text-white font-black text-xl shadow-lg shadow-blue-100 overflow-hidden">
                      {doc.image_url ? <img src={doc.image_url} alt="" className="h-full w-full object-cover" /> : initial(doc.name)}
                    </div>
                    <p className="text-[11px] md:text-sm font-black text-slate-800 leading-tight truncate w-full mb-0.5">{doc.name}</p>
                    <p className="text-[9px] md:text-[11px] text-blue-600 font-black uppercase tracking-wider mb-4">{doc.specialty}</p>
                    <button
                      onClick={() => navigate(`/book-appointment/${doc.id}`)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-[10px] md:text-xs font-black shadow-md shadow-blue-100 transition-all active:scale-95"
                    >
                      Book Now
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── CTA BANNER ── */}
          <div
            className="rounded-3xl overflow-hidden relative"
            style={{ background: "linear-gradient(135deg, #2563eb 0%, #38bdf8 100%)" }}
          >
            {/* Blob decoration */}
            <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full opacity-20 bg-white" />
            <div className="absolute left-1/3 -bottom-8 w-32 h-32 rounded-full opacity-10 bg-white" />

            <div className="relative z-10 p-6 md:p-10 md:flex md:items-center md:justify-between text-center md:text-left">
              <div className="md:max-w-xl">
                <h2 className="text-xl md:text-3xl font-black text-white leading-tight mb-2 md:mb-3">
                  Ready to Take Care of Your Health?
                </h2>
                <p className="text-sm text-blue-100 font-medium mb-5 md:mb-0 leading-relaxed">
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

      {/* ─────────────────────────────────────────
          MOBILE BOTTOM NAV
      ───────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-100"
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
                <Icon className={`h-5 w-5 transition-transform ${active ? "scale-110" : ""}`} />
                <span className={`text-[9px] font-black tracking-tight ${active ? "text-blue-600" : "text-slate-400"}`}>
                  {label}
                </span>
                {active && <div className="absolute bottom-0 h-0.5 w-8 bg-blue-600 rounded-full" />}
              </Link>
            );
          })}
        </div>
      </nav>

    </div>
  );
};

export default Index;
