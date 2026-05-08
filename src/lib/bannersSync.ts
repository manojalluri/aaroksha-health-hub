import { supabase } from "./supabase";

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  to: string;
  gradient: string;
  ctaColor: string;
  emoji: string;
  badge: string;
  image?: string;
  imageOnly?: boolean; // When true + image exists: show ONLY the image, no text overlay
  isCustom?: boolean;
}

export const DEFAULT_BANNERS: Banner[] = [
  {
    id: "default-1",
    title: "Book a Doctor\nin 60 Seconds",
    subtitle: "Consult top specialists from home",
    cta: "Book Now",
    to: "/doctors",
    gradient: "linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)",
    ctaColor: "#2563eb",
    emoji: "👨‍⚕️",
    badge: "500+ Doctors",
    isCustom: false,
  },
  {
    id: "default-2",
    title: "Home Lab Tests\nAt Your Door",
    subtitle: "NABL certified labs, reports in 6 hrs",
    cta: "Book Test",
    to: "/lab-tests",
    gradient: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
    ctaColor: "#7c3aed",
    emoji: "🔬",
    badge: "50+ Tests",
    isCustom: false,
  },
];

export const getBanners = (): Banner[] => {
  try {
    const saved = localStorage.getItem("aaroksha_banners");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error("Error loading banners", e);
  }
  return DEFAULT_BANNERS;
};

export const saveBanners = (banners: Banner[]) => {
  localStorage.setItem("aaroksha_banners", JSON.stringify(banners));
  window.dispatchEvent(new Event("banners_updated"));
};

export const saveBannersToSupabase = async (banners: Banner[]) => {
  const { error } = await supabase
    .from("platform_banners")
    .upsert(banners.map(b => ({
      id: b.id.includes("default") ? "00000000-0000-0000-0000-00000000000" + b.id.slice(-1) : b.id,
      title: b.title,
      subtitle: b.subtitle,
      image_url: b.image,
      link_to: b.to,
      cta_text: b.cta,
      gradient: b.gradient,
      cta_color: b.ctaColor,
      emoji: b.emoji,
      badge_text: b.badge,
      is_active: true
    })));
  
  if (!error) saveBanners(banners);
  return { error };
};

export const syncBannersFromSupabase = async () => {
  try {
    const { data, error } = await supabase.from("platform_banners").select("*").order("id", { ascending: true });
    if (data && !error && data.length > 0) {
      const mapped = data.map(b => ({
        id: b.id,
        title: b.title || "",
        subtitle: b.subtitle || "",
        image: b.image_url || "",
        to: b.link_to || "/",
        cta: b.cta_text || "Action",
        gradient: b.gradient || "linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)",
        ctaColor: b.cta_color || "#2563eb",
        emoji: b.emoji || "✨",
        badge: b.badge_text || "Special",
        // Fallback: If there's an image_url, treat it as imageOnly
        imageOnly: !!(b.image_url),
        isCustom: true
      }));

      saveBanners(mapped);
      return mapped;
    }
  } catch (err) {
    console.error("Sync Banners Failed:", err);
  }
  return getBanners();
};
