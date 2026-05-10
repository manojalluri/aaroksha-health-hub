import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns the absolute site URL for redirects (Auth, Payments, etc.)
 * Priority: 
 * 1. Environment variable (VITE_SITE_URL)
 * 2. Current window origin (if in browser)
 * 3. Default production URL
 */
export function getURL() {
  let url =
    import.meta.env.VITE_SITE_URL ?? // Set this in production (e.g. https://www.aaroksha.in)
    window?.location?.origin ??
    "https://www.aaroksha.in";
    
  // Make sure to include `https://` when not localhost
  url = url.includes("localhost") ? url : url.replace("http://", "https://");
  // Remove trailing slash
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
