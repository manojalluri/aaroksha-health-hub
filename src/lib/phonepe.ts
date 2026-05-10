import { supabase } from "./supabase";

/**
 * PhonePe Payment Service
 * ─────────────────────────────────────────────────────────────────
 * In production, payload signing MUST happen on the backend
 * (Supabase Edge Functions). This module provides the frontend
 * interface to initiate payments and check status.
 *
 * SECURITY: No API keys, secrets, or merchant IDs are stored here.
 *           All sensitive signing happens server-side via Edge Function.
 */

export interface PaymentInitiateResponse {
  success: boolean;
  message: string;
  data?: {
    instrumentResponse: {
      type: string;
      redirectInfo: {
        url: string;
        method: string;
      };
    };
  };
}

export const PhonePeService = {
  /**
   * Initiates a payment request.
   * In LIVE mode, this calls the Supabase Edge Function `phonepe-pay`
   * which handles payload signing server-side with the merchant secret.
   */
  async initiatePayment(params: {
    transactionId: string;
    userId: string;
    amount: number; // in Rupees
    phone: string;
    callbackUrl: string;
    redirectUrl: string;
  }) {
    /*
     * LIVE: Uncomment this block and remove the simulation below.
     * const { data, error } = await supabase.functions.invoke('phonepe-pay', {
     *   body: params
     * });
     * if (error) throw error;
     * return data;
     */

    // Simulate network delay (remove when switching to LIVE)
    await new Promise(r => setTimeout(r, 1500));

    // Simulated success response
    return {
      success: true,
      redirectUrl: `${params.redirectUrl}?txnId=${params.transactionId}&status=success`,
    };
  },

  async verifyStatus(transactionId: string) {
    // Check appointments first
    const { data } = await supabase
      .from("appointments")
      .select("payment_status")
      .eq("payment_id", transactionId)
      .single();

    if (data) return data.payment_status === "paid";

    // Fallback: check lab_bookings
    const { data: labData } = await supabase
      .from("lab_bookings")
      .select("payment_status")
      .eq("id", transactionId)
      .single();

    return labData?.payment_status === "paid";
  },
};
