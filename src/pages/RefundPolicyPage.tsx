import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const RefundPolicyPage = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl font-black text-slate-900 mb-8">Refund Policy</h1>
        
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 space-y-6 text-slate-600">
          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">1. Consultation Refunds</h2>
            <p>If a doctor cancels an appointment or is unavailable, a full refund will be initiated automatically. If you cancel an appointment at least 24 hours in advance, a full refund (excluding platform convenience fees) will be provided.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">2. Lab Test Refunds</h2>
            <p>Cancellations made before the sample collection or before visiting the diagnostic center are eligible for a full refund. No refunds are possible once the sample has been collected or testing has commenced.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">3. Pharmacy Refunds</h2>
            <p>Refunds for medicine orders will be processed if the order is canceled prior to dispatch. For dispatched orders, refunds are subject to our Return Policy (e.g., damaged items or incorrect delivery).</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">4. Processing Time</h2>
            <p>Approved refunds are processed within 5-7 business days and credited back to the original method of payment. Delays may occur depending on your bank's processing times.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">5. Non-Refundable Items</h2>
            <p>Platform convenience fees and priority service charges are strictly non-refundable once the service has been initiated.</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default RefundPolicyPage;
