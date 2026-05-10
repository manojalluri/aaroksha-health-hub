import { supabase } from "./supabase";
import { useState, useEffect } from "react";

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
  upi_id: string;
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
  upi_id: "",
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
  try {
    const { data, error } = await supabase
      .from("platform_settings")
      .upsert({ 
        id: 'global', 
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
        cod: settings.cod,
        upi_id: settings.upi_id || ""
      })
      .select();
    
    if (error) {
      console.error("Supabase Settings Sync Error:", error);
      return { error };
    }
    
    if (!data || data.length === 0) {
      console.error("Supabase Settings Sync Warning: No rows were updated. Check RLS policies.");
      return { error: new Error("Permission denied or record not found. Please check database RLS policies.") };
    }
    
    saveSettingsLocally(settings);
    return { error: null };
  } catch (err: any) {
    console.error("Settings Save Failed:", err);
    return { error: err };
  }
};

export const syncSettingsFromSupabase = async () => {
  try {
    const { data, error } = await supabase
      .from("platform_settings")
      .select("*")
      .eq("id", "global")
      .maybeSingle();
    
    if (data && !error) {
      console.log('[Aaroksha Sync] Raw data from Supabase:', data);
      const local = getSettings();
      const mapped: PlatformSettings = {
        ...local,
        platform_name: data.platform_name || local.platform_name,
        support_email: data.support_email || local.support_email,
        support_phone: data.support_phone || local.support_phone,
        currency: data.currency || local.currency,
        cgst: data.cgst ?? local.cgst,
        sgst: data.sgst ?? local.sgst,
        opd_fee: data.opd_fee ?? local.opd_fee,
        lab_fee: data.lab_fee ?? local.lab_fee,
        pharm_fee: data.pharm_fee ?? local.pharm_fee,
        priority_surcharge: data.priority_surcharge ?? local.priority_surcharge,
        delivery_fee: data.delivery_fee ?? local.delivery_fee,
        express_fee: data.express_fee ?? local.express_fee,
        free_threshold: data.free_threshold ?? local.free_threshold,
        delivery_radius: data.delivery_radius ?? local.delivery_radius,
        delivery_time: data.delivery_time ?? local.delivery_time,
        is_maintenance: data.is_maintenance ?? local.is_maintenance,
        opdCheck: data.opd_check ?? local.opdCheck,
        labCheck: data.lab_check ?? local.labCheck,
        pharmCheck: data.pharm_check ?? local.pharmCheck,
        upi: data.upi ?? local.upi,
        cod: data.cod ?? local.cod,
        upi_id: data.upi_id ?? local.upi_id,
      };
      saveSettingsLocally(mapped);
      return mapped;
    }
  } catch (err) {
    console.error("Sync Settings Failed:", err);
  }
  return getSettings();
};

export const useSettings = () => {
  const [settings, setSettings] = useState<PlatformSettings>(getSettings());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[Aaroksha Sync] Initializing settings sync...');
    const fetchSettings = async () => {
      try {
        const data = await syncSettingsFromSupabase();
        if (data) {
          console.log('[Aaroksha Sync] Settings synced successfully:', data);
          setSettings(data);
        } else {
          console.warn('[Aaroksha Sync] No data returned from Supabase, using defaults.');
        }
      } catch (err) {
        console.error('[Aaroksha Sync] Sync failed:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();

    // Fallback Polling (every 30s) in case realtime fails
    const pollInterval = setInterval(fetchSettings, 30000);

    // Subscribe to realtime changes
    console.log('[Aaroksha Sync] Subscribing to realtime platform_settings...');
    const subscription = supabase
      .channel('platform_settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'platform_settings'
        },
        async (payload) => {
          console.log('[Aaroksha Sync] Realtime change detected:', payload);
          const data = await syncSettingsFromSupabase();
          if (data) {
            console.log('[Aaroksha Sync] Realtime data applied:', data);
            setSettings(data);
          }
        }
      )
      .subscribe((status) => {
        console.log('[Aaroksha Sync] Realtime status:', status);
      });

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(subscription);
    };
  }, []);

  return { settings, loading };
};
