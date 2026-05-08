import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const PrivacyPolicyPage = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl font-black text-slate-900 mb-8">Privacy Policy</h1>
        
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 space-y-6 text-slate-600">
          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">1. Information We Collect</h2>
            <p>We collect personal information that you provide to us, including your name, contact details, medical history, prescriptions, and payment information. We also collect usage data to improve our platform's performance and user experience.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">2. How We Use Your Data</h2>
            <p>Your data is used to facilitate healthcare services, including booking appointments, processing lab tests, and delivering medicines. We may use your contact information to send you updates, appointment reminders, and important health notifications.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">3. Data Sharing and Disclosure</h2>
            <p>We share necessary information strictly with authorized healthcare partners (doctors, labs, pharmacies) directly involved in your care. We do not sell your personal data to third parties. Data may be disclosed if required by law or to protect our legal rights.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">4. Data Security</h2>
            <p>We implement robust, industry-standard security measures, including encryption and secure servers, to protect your sensitive health data against unauthorized access, alteration, or disclosure. However, no internet transmission is 100% secure.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">5. Your Rights</h2>
            <p>You have the right to access, update, or request the deletion of your personal data. You can manage your preferences through your account settings or by contacting our support team.</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicyPage;
