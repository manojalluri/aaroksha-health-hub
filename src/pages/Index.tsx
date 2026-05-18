import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  FlaskConical, Calendar, Pill, Home, User, Clock,
  ChevronRight, MapPin, Search, Bell, Star, ArrowRight, Building2, Phone, Mail, LifeBuoy,
  Shield, Zap, HeartPulse, Users, CheckCircle2, Stethoscope, Microscope, Truck, Activity,
  Droplets, Apple, BedDouble, Dumbbell, Wind
} from "lucide-react";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Banner, getBanners, syncBannersFromSupabase } from "@/lib/bannersSync";
import { getLocalDoctors } from "@/lib/doctorsSync";
import { getSettings, syncSettingsFromSupabase } from "@/lib/settingsSync";
import SEO from "@/components/SEO";
import { SEO_CONFIG } from "@/utils/seoConfig";

// ─── How It Works — tabbed per service ────────────────────────────────────────
const HOW_IT_WORKS = [
  {
    id: "doctors",
    label: "Doctor Booking",
    icon: Calendar,
    accentColor: "#2563eb",
    accentBg: "#dbeafe",
    tabBg: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
    steps: [
      {
        icon: Search,
        title: "Find Your Doctor",
        desc: "Browse specialist doctors by specialty — cardiologist, dermatologist, general physician & more. Read profiles and choose the right fit.",
      },
      {
        icon: Calendar,
        title: "Pick a Time Slot",
        desc: "See real-time availability and select a date & time that suits you. Instant confirmation — no phone calls, no waiting.",
      },
      {
        icon: CheckCircle2,
        title: "Visit & Get Treated",
        desc: "Arrive at your booked slot. Consult with confidence, skip the queue, and get your prescription or referral on the spot.",
      },
    ],
    cta: "Book a Doctor",
    to: "/doctors",
  },
  {
    id: "labtests",
    label: "Lab Tests",
    icon: FlaskConical,
    accentColor: "#7c3aed",
    accentBg: "#ede9fe",
    tabBg: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
    steps: [
      {
        icon: Search,
        title: "Search Your Test",
        desc: "Find from 200+ tests — blood sugar, thyroid, CBC, lipid profile, vitamin panels & more. View price, report time, and fasting requirements.",
      },
      {
        icon: Microscope,
        title: "Book Home Collection",
        desc: "Choose home sample collection or walk-in at the lab. Select a convenient time slot. A certified phlebotomist comes to your door.",
      },
      {
        icon: Activity,
        title: "Get Digital Reports",
        desc: "Reports are processed in certified labs and delivered digitally. Track results online and share with your doctor instantly.",
      },
    ],
    cta: "Book a Lab Test",
    to: "/lab-tests",
  },
  {
    id: "medicines",
    label: "Medicines",
    icon: Pill,
    accentColor: "#059669",
    accentBg: "#d1fae5",
    tabBg: "linear-gradient(135deg, #f0fdf4 0%, #d1fae5 100%)",
    steps: [
      {
        icon: Pill,
        title: "Upload Prescription",
        desc: "Upload your doctor's prescription directly from your phone. Our pharmacists verify it for accuracy and safety before dispensing.",
      },
      {
        icon: CheckCircle2,
        title: "Order Confirmed",
        desc: "We source 100% genuine medicines from certified distributors. You get a detailed bill with exact quantities and expiry info.",
      },
      {
        icon: Truck,
        title: "Delivered in 2 Hours",
        desc: "Our delivery partner brings medicines to your doorstep within 2 hours. Cold-chain maintained for temperature-sensitive drugs.",
      },
    ],
    cta: "Order Medicines",
    to: "/prescription",
  },
];

function HowItWorksSection() {
  const [activeTab, setActiveTab] = useState(0);
  const service = HOW_IT_WORKS[activeTab];

  return (
    <div>
      {/* Header */}
      <div className="mb-3 md:mb-5">
        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-0.5">Simple Steps</p>
        <h2 className="text-base md:text-lg font-black text-slate-800">How It Works</h2>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {HOW_IT_WORKS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === activeTab;
          return (
            <button
              key={s.id}
              onClick={() => setActiveTab(i)}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl font-black text-xs transition-all duration-200"
              style={{
                background: isActive ? s.accentColor : "#f1f5f9",
                color: isActive ? "#fff" : "#64748b",
                boxShadow: isActive ? `0 4px 14px ${s.accentColor}40` : "none",
                transform: isActive ? "scale(1.03)" : "scale(1)",
              }}
            >
              <Icon className="h-3.5 w-3.5" />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Steps Grid */}
      <div
        key={service.id}
        className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4"
        style={{ animation: "fadeInUp 0.3s ease forwards" }}
      >
        <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        {service.steps.map(({ icon: Icon, title, desc }, idx) => (
          <div
            key={title}
            className="relative rounded-2xl md:rounded-3xl p-5 md:p-6 border border-slate-100 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
            style={{ background: service.tabBg }}
          >
            {/* Step watermark */}
            <span
              className="absolute top-3 right-4 font-black text-5xl select-none"
              style={{ color: service.accentColor, opacity: 0.07 }}
            >
              {String(idx + 1).padStart(2, "0")}
            </span>

            {/* Step badge */}
            <span
              className="absolute top-3 left-4 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full text-white"
              style={{ background: service.accentColor }}
            >
              Step {idx + 1}
            </span>

            {/* Icon */}
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center mt-5 mb-3 bg-white shadow-sm"
            >
              <Icon className="h-5 w-5" style={{ color: service.accentColor }} />
            </div>

            <p className="text-sm md:text-base font-black text-slate-800 mb-1.5">{title}</p>
            <p className="text-[11px] md:text-xs text-slate-500 font-medium leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-4 flex justify-end">
        <Link
          to={service.to}
          className="inline-flex items-center gap-1.5 text-xs font-black px-4 py-2 rounded-xl text-white transition-all hover:opacity-90 active:scale-95"
          style={{ background: service.accentColor, boxShadow: `0 4px 14px ${service.accentColor}40` }}
        >
          {service.cta}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}


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
      // 1. Get active partners first
      supabase.from("partners").select("partner_id").eq("status", "active").then(({ data: activePs }) => {
        const activeIds = (activePs || []).map(p => p.partner_id);
        
        // 2. Fetch doctors for active partners
        supabase.from("doctors").select("*").in("partner_id", activeIds).then(({ data }) => {
          const local = getLocalDoctors() || [];
          if (!data || data.length === 0) {
            setDoctors(local);
            return;
          }
          
          // Merge offline local doctors
          const dbIds = new Set(data.map(d => d.id));
          const missingLocal = local.filter(d => !dbIds.has(d.id) && String(d.id).startsWith("local-"));
          
          setDoctors([...data, ...missingLocal]);
        }).catch(() => setDoctors(getLocalDoctors()));
      });
    };
    
    handleUpdate();
    window.addEventListener("doctors_updated", handleUpdate);
    
    // Fetch Active Partner Hospitals
    supabase.from("partners").select("*").eq("type", "hospital").eq("status", "active").then(({ data: ps }) => {
      const activeIds = (ps || []).map(p => p.partner_id);
      supabase.from("doctors").select("*").in("partner_id", activeIds).then(({ data: docs }) => {
        if (ps && docs) {
          const withCounts = ps.map(h => {
             const docCount = docs.filter(d => d.partner_id === h.partner_id).length;
             return { ...h, docCount };
          }).filter(h => h.docCount > 0); // Show hospitals with at least 1 doc
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
  ];

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
            <h2 className="text-base md:text-lg font-black text-slate-800 mb-3 md:mb-4">Our Healthcare Services in Bhimavaram</h2>
            <div className="grid grid-cols-3 gap-2.5 md:gap-4">
              {services.map((s) => (
                s.visible !== false ? (
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
                ) : (
                  <div
                    key={s.to}
                    className="bg-slate-50 opacity-70 rounded-2xl md:rounded-3xl p-3.5 md:p-5 flex flex-col items-center text-center border border-slate-100 relative overflow-hidden"
                  >
                    <div className="absolute top-2 right-[-20px] bg-red-500 text-white text-[8px] font-black uppercase tracking-widest px-6 py-0.5 rotate-45 shadow-sm">
                      Soon
                    </div>
                    <div
                      className="h-12 w-12 md:h-16 md:w-16 rounded-xl md:rounded-2xl flex items-center justify-center mb-2 md:mb-3 grayscale"
                      style={{ backgroundColor: s.bg }}
                    >
                      <s.icon className="h-6 w-6 md:h-8 md:w-8" style={{ color: s.color }} />
                    </div>
                    <p className="text-[11px] md:text-sm font-black text-slate-400 leading-tight">{s.title}</p>
                    <p className="text-[9px] md:text-[11px] text-slate-400 font-medium mt-0.5 leading-tight">Coming Soon</p>
                  </div>
                )
              ))}
            </div>
          </div>

          {/* ── WHY CHOOSE US ── */}
          <div>
            <div className="flex items-center justify-between mb-3 md:mb-5">
              <div>
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-0.5">Why Aaroksha</p>
                <h2 className="text-base md:text-lg font-black text-slate-800">Bhimavaram Trusts Us</h2>
              </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4">
              {[
                { icon: Users, value: "500+", label: "Happy Patients", color: "#2563eb", bg: "#dbeafe" },
                { icon: Stethoscope, value: "50+", label: "Specialist Doctors", color: "#7c3aed", bg: "#ede9fe" },
                { icon: Microscope, value: "100+", label: "Lab Tests", color: "#059669", bg: "#d1fae5" },
                { icon: Truck, value: "30 Min", label: "Medicine Delivery", color: "#d97706", bg: "#fef3c7" },
              ].map(({ icon: Icon, value, label, color, bg }) => (
                <div
                  key={label}
                  className="bg-white border border-slate-100 rounded-2xl md:rounded-3xl p-4 md:p-5 flex flex-col items-center text-center hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl md:rounded-2xl flex items-center justify-center mb-2 md:mb-3" style={{ backgroundColor: bg }}>
                    <Icon className="h-5 w-5 md:h-6 md:w-6" style={{ color }} />
                  </div>
                  <p className="text-lg md:text-2xl font-black text-slate-800 leading-none mb-1" style={{ color }}>{value}</p>
                  <p className="text-[9px] md:text-[11px] text-slate-500 font-bold uppercase tracking-wider leading-tight">{label}</p>
                </div>
              ))}
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-2.5 md:gap-4">
              {[
                { icon: Shield, text: "100% Genuine Medicines", color: "#2563eb", bg: "#eff6ff" },
                { icon: Zap, text: "Fast Delivery & Booking", color: "#d97706", bg: "#fffbeb" },
                { icon: HeartPulse, text: "Trusted by Families", color: "#dc2626", bg: "#fff1f2" },
              ].map(({ icon: Icon, text, color, bg }) => (
                <div
                  key={text}
                  className="rounded-2xl p-3 md:p-4 flex flex-col items-center text-center border border-slate-100 hover:shadow-md transition-all"
                  style={{ background: bg }}
                >
                  <Icon className="h-5 w-5 md:h-6 md:w-6 mb-2" style={{ color }} />
                  <p className="text-[9px] md:text-[11px] font-black text-slate-700 leading-tight">{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── HOW IT WORKS ── */}
          <HowItWorksSection />

          {/* ── HEALTH TIPS HORIZONTAL SCROLL ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-0.5">Stay Healthy</p>
                <h2 className="text-base md:text-lg font-black text-slate-800">Daily Health Tips for Bhimavaram</h2>
              </div>
              <span className="text-[10px] text-slate-400 font-bold hidden md:block">Scroll →</span>
            </div>
            <div
              className="flex gap-3 overflow-x-auto pb-2"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {[
                { icon: Droplets, tip: "Drink 8 glasses of water daily", detail: "Hydration boosts energy & skin health", color: "#0ea5e9", bg: "linear-gradient(135deg, #f0f9ff, #e0f2fe)" },
                { icon: Apple, tip: "Eat more fruits & vegetables", detail: "5 servings a day keeps illness away", color: "#16a34a", bg: "linear-gradient(135deg, #f0fdf4, #dcfce7)" },
                { icon: Dumbbell, tip: "Exercise 30 min every day", detail: "Walk, yoga, or any activity you enjoy", color: "#7c3aed", bg: "linear-gradient(135deg, #f5f3ff, #ede9fe)" },
                { icon: BedDouble, tip: "Sleep 7–8 hours nightly", detail: "Good sleep heals and restores the body", color: "#2563eb", bg: "linear-gradient(135deg, #eff6ff, #dbeafe)" },
                { icon: Wind, tip: "Breathe deep, stress less", detail: "5-min breathing reduces anxiety fast", color: "#0891b2", bg: "linear-gradient(135deg, #ecfeff, #cffafe)" },
                { icon: Activity, tip: "Get regular health check-ups", detail: "Early detection saves lives", color: "#dc2626", bg: "linear-gradient(135deg, #fff1f2, #ffe4e6)" },
              ].map(({ icon: Icon, tip, detail, color, bg }) => (
                <div
                  key={tip}
                  className="flex-shrink-0 w-44 md:w-52 rounded-2xl p-4 border border-slate-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                  style={{ background: bg }}
                >
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center mb-3"
                    style={{ background: "rgba(255,255,255,0.8)" }}
                  >
                    <Icon className="h-4.5 w-4.5 h-5 w-5" style={{ color }} />
                  </div>
                  <p className="text-[11px] md:text-xs font-black text-slate-800 leading-snug mb-1">{tip}</p>
                  <p className="text-[9px] md:text-[10px] text-slate-500 font-medium leading-snug">{detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── PARTNER HOSPITALS / DOCTORS ── */}
          {settings.opdCheck !== false && (
          <div>
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h2 className="text-base md:text-lg font-black text-slate-800 tracking-tight">
                {viewDocsFor ? `Doctors at ${viewDocsFor.name}` : "Top Hospitals in Bhimavaram"}
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
          )}

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
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="inline-flex items-center gap-2 bg-white font-black text-sm px-7 py-3.5 rounded-2xl hover:bg-blue-50 active:scale-95 transition-all shadow-xl md:ml-8 whitespace-nowrap"
                style={{ color: "#2563eb" }}
              >
                Get Started Now <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ── Help & Support (Accessible to Everyone) ── */}
          <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm relative overflow-hidden mt-6 md:mt-10">
            <div className="absolute -top-4 -right-4 p-4 opacity-[0.03]">
              <LifeBuoy className="w-32 h-32 text-blue-600" />
            </div>
            <div className="relative z-10">
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Need Help?</p>
              <h3 className="text-base font-black text-slate-800 mb-4">Customer Support</h3>
              
              <div className="space-y-3 md:space-y-0 md:flex md:gap-4">
                <a href="tel:+918886363636" className="flex-1 flex items-center gap-3 bg-slate-50 border border-slate-100 p-3 rounded-2xl hover:bg-slate-100 active:scale-95 transition-all">
                  <div className="h-10 w-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                    <Phone className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Call Us</p>
                    <p className="text-sm font-black text-slate-700">+91 8886363636</p>
                  </div>
                </a>
                
                <a href="mailto:support@aaroksha.in" className="flex-1 flex items-center gap-3 bg-slate-50 border border-slate-100 p-3 rounded-2xl hover:bg-slate-100 active:scale-95 transition-all">
                  <div className="h-10 w-10 bg-purple-100 rounded-xl flex items-center justify-center shrink-0">
                    <Mail className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email Us</p>
                    <p className="text-sm font-black text-slate-700">support@aaroksha.in</p>
                  </div>
                </a>

                <a href="https://wa.me/919999999999?text=Hi%20Aaroksha,%20I%20need%20assistance." target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center gap-3 bg-slate-50 border border-slate-100 p-3 rounded-2xl hover:bg-slate-100 active:scale-95 transition-all">
                  <div className="h-10 w-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-green-600 fill-current" viewBox="0 0 448 512">
                      <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-23.1-115-65.1-157zM223.9 411.5c-33.1 0-65.5-8.9-94-25.7l-6.7-4-69.8 18.3L72 331.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">WhatsApp Us</p>
                    <p className="text-sm font-black text-slate-700">Chat Now</p>
                  </div>
                </a>
              </div>
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
