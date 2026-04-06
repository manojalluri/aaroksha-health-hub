import { supabase } from "./supabase";

export interface PlatformSettings {
  id?: number;
  platform_name: string;
  support_email: string;
  support_phone: string;
  currency: string;
  
  cgst: number;
  sgst: number;
  opd_fee: number;
  lab_fee: number;
  pharm_fee: number;
  priority_surcharge: number;
  
  delivery_fee: number;
  express_fee: number;
  free_threshold: number;
  delivery_radius: number;
  delivery_time: number;

  is_maintenance: boolean;
  opdCheck: boolean;
  labCheck: boolean;
  pharmCheck: boolean;
  upi: boolean;
  cod: boolean;
}

export const DEFAULT_SETTINGS: PlatformSettings = {
  platform_name: "AAROKSHA",
  support_email: "support@aaroksha.com",
  support_phone: "+91 1800-XXX-XXXX",
  currency: "INR (₹)",
  
  cgst: 9,
  sgst: 9,
  opd_fee: 49,
  lab_fee: 39,
  pharm_fee: 19,
  priority_surcharge: 250,
  
  delivery_fee: 40,
  express_fee: 99,
  free_threshold: 999,
  delivery_radius: 15,
  delivery_time: 4,

  is_maintenance: false,
  opdCheck: true,
  labCheck: true,
  pharmCheck: true,
  upi: true,
  cod: true,
};

export const getSettings = (): PlatformSettings => {
  try {
    const saved = localStorage.getItem("aaroksha_settings");
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error("Error loading settings from cache", e);
  }
  return DEFAULT_SETTINGS;
};

export const saveSettingsLocally = (settings: PlatformSettings) => {
  localStorage.setItem("aaroksha_settings", JSON.stringify(settings));
  window.dispatchEvent(new Event("settings_updated"));
  window.dispatchEvent(new StorageEvent('storage', { key: 'aaroksha_settings', newValue: JSON.stringify(settings) }));
};

export const saveSettingsToSupabase = async (settings: PlatformSettings) => {
  const { error } = await supabase
    .from("platform_settings")
    .upsert({ 
      id: 1, 
      platform_name: settings.platform_name,
      support_email: settings.support_email,
      support_phone: settings.support_phone,
      currency: settings.currency,
      cgst: settings.cgst,
      sgst: settings.sgst,
      opd_fee: settings.opd_fee,
      lab_fee: settings.lab_fee,
      pharm_fee: settings.pharm_fee,
      priority_surcharge: settings.priority_surcharge,
      delivery_fee: settings.delivery_fee,
      express_fee: settings.express_fee,
      free_threshold: settings.free_threshold,
      delivery_radius: settings.delivery_radius,
      delivery_time: settings.delivery_time,
      is_maintenance: settings.is_maintenance,
      opd_check: settings.opdCheck,
      lab_check: settings.labCheck,
      pharm_check: settings.pharmCheck,
      upi: settings.upi,
      cod: settings.cod
    });
  
  if (!error) {
    saveSettingsLocally(settings);
  }
  return { error };
};

export const syncSettingsFromSupabase = async () => {
  try {
    const { data, error } = await supabase
      .from("platform_settings")
      .select("*")
      .eq("id", 1)
      .single();
    
    if (data && !error) {
      const mapped: PlatformSettings = {
        ...DEFAULT_SETTINGS,
        platform_name: data.platform_name,
        support_email: data.support_email || DEFAULT_SETTINGS.support_email,
        support_phone: data.support_phone || DEFAULT_SETTINGS.support_phone,
        currency: data.currency || DEFAULT_SETTINGS.currency,
        cgst: data.cgst || DEFAULT_SETTINGS.cgst,
        sgst: data.sgst || DEFAULT_SETTINGS.sgst,
        opd_fee: data.opd_fee,
        lab_fee: data.lab_fee,
        pharm_fee: data.pharm_fee,
        priority_surcharge: data.priority_surcharge || DEFAULT_SETTINGS.priority_surcharge,
        delivery_fee: data.delivery_fee || DEFAULT_SETTINGS.delivery_fee,
        express_fee: data.express_fee,
        free_threshold: data.free_threshold || DEFAULT_SETTINGS.free_threshold,
        delivery_radius: data.delivery_radius || DEFAULT_SETTINGS.delivery_radius,
        delivery_time: data.delivery_time || DEFAULT_SETTINGS.delivery_time,
        is_maintenance: data.is_maintenance,
        opdCheck: data.opd_check,
        labCheck: data.lab_check,
        pharmCheck: data.pharm_check,
        upi: data.upi ?? DEFAULT_SETTINGS.upi,
        cod: data.cod ?? DEFAULT_SETTINGS.cod
      };
      saveSettingsLocally(mapped);
      return mapped;
    }
  } catch (err) {
    console.error("Sync Settings Failed:", err);
  }
  return getSettings();
};
