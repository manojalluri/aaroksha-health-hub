import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const TermsPage = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl font-black text-slate-900 mb-8">Terms and Conditions</h1>
        
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 space-y-6 text-slate-600">
          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">1. Introduction</h2>
            <p>Welcome to Aaroksha Health Hub. By accessing or using our platform, you agree to be bound by these terms and conditions. These terms govern your access to our website, mobile application, and all healthcare services provided through Aaroksha.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">2. Service Description</h2>
            <p>Aaroksha acts as an aggregator connecting patients with healthcare providers, including hospitals, clinics, diagnostic labs, and pharmacies. We facilitate bookings and order processing but do not directly provide medical or pharmaceutical services.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">3. User Responsibilities</h2>
            <p>Users must provide accurate, current, and complete information when registering or booking services. You are responsible for maintaining the confidentiality of your account credentials. Medical emergencies should not be handled through this platform; please contact emergency services immediately.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">4. Payments and Billing</h2>
            <p>Payments for consultations, lab tests, and medicines are processed securely through our authorized payment gateways. All fees are clearly displayed before confirmation. Aaroksha may charge a platform convenience fee, which is non-refundable.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">5. Limitation of Liability</h2>
            <p>Aaroksha is not liable for the medical advice, diagnosis, or treatment provided by independent healthcare professionals or partners accessed through our platform. We make no representations or warranties regarding the quality or outcome of the services.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">6. Amendments</h2>
            <p>We reserve the right to modify these terms at any time. Continued use of the platform following any changes constitutes acceptance of the new terms. Please review this page periodically for updates.</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TermsPage;
