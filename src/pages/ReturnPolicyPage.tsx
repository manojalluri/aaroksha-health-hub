import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const ReturnPolicyPage = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl font-black text-slate-900 mb-8">Return Policy</h1>
        
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 space-y-6 text-slate-600">
          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">1. Eligibility for Returns</h2>
            <p>Returns are only applicable to physical products such as medicines and healthcare devices purchased through our pharmacy partners. Returns must be initiated within 48 hours of delivery.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">2. Valid Conditions for Return</h2>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>The product delivered is past its expiry date.</li>
              <li>The product is damaged during transit.</li>
              <li>The wrong product was delivered compared to the prescription or order.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">3. Non-Returnable Items</h2>
            <p>For hygiene and safety reasons, certain items cannot be returned. These include injectables, opened bottles/strips, temperature-sensitive medicines, and personal care products.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">4. Return Process</h2>
            <p>To initiate a return, contact our support team with your order ID and a photograph of the received item. Once verified, a pickup will be arranged. The product must be returned in its original packaging with all seals intact (unless the return is due to internal damage).</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">5. Exchanges</h2>
            <p>In cases of incorrect or damaged delivery, we offer an expedited exchange to ensure your healthcare needs are met without delay. If an exchange is not possible, a full refund will be issued per our Refund Policy.</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ReturnPolicyPage;
