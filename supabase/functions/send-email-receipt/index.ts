import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Supabase uses Resend as its official email partner
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

serve(async (req) => {
  try {
    // Check for correct Auth if you are making direct POST requests.
    // If called via Supabase Webhook, you can verify a Webhook Secret if set.

    // Get the payload from the Supabase Webhook
    const payload = await req.json();
    const record = payload.record;

    // Only process if the payment status is 'paid' or status is 'confirmed'
    if (record.payment_status !== "paid" && record.status !== "confirmed") {
      return new Response(JSON.stringify({ message: "Not paid, skipping email." }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Ensure we have an email to send to
    const patientEmail = record.patient_email;
    if (!patientEmail) {
      return new Response(JSON.stringify({ message: "No patient email provided, skipping." }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Format the email content
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Booking Confirmed! 🎉</h2>
        <p>Hello <strong>${record.patient_name}</strong>,</p>
        <p>Your booking with Aaroksha Health Hub is confirmed.</p>
        
        <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0;">
          <p><strong>Order ID:</strong> ${record.order_id}</p>
          <p><strong>Doctor:</strong> ${record.doctor_name || "N/A"}</p>
          <p><strong>Date:</strong> ${record.appointment_date || "N/A"}</p>
          <p><strong>Time:</strong> ${record.appointment_time || "N/A"}</p>
          <p><strong>Fee Paid:</strong> ₹${record.fee || "0"}</p>
        </div>

        <p>Please keep your Order ID safe for tracking your appointment.</p>
        <br/>
        <p>Stay Healthy,</p>
        <p><strong>The Aaroksha Health Hub Team</strong></p>
      </div>
    `;

    // Make the API call to Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Aaroksha Health Hub <bookings@your-domain.com>", // Update this when you have a domain, or use Resend's default testing domain setup
        to: [patientEmail],
        subject: `Your Booking is Confirmed - ${record.order_id}`,
        html: htmlContent,
      }),
    });

    const data = await res.json();

    return new Response(JSON.stringify({ success: true, resendResponse: data }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
});
