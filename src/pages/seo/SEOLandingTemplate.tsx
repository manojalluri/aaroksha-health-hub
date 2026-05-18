import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronRight, Star, Shield, PhoneCall, MapPin } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SEO from '@/components/SEO';

export interface SEOPageProps {
  title: string;
  description: string;
  h1: string;
  subtitle: string;
  schemaType: string;
  slug: string;
  heroImage: string;
  features: string[];
  contentSections: { title: string; body: string }[];
  faqs: { question: string; answer: string }[];
  ctaText: string;
  ctaLink: string;
}

const SEOLandingTemplate: React.FC<SEOPageProps> = (props) => {
  const schema = {
    "@context": "https://schema.org",
    "@type": props.schemaType,
    "name": `Aaroksha - ${props.h1}`,
    "url": `https://www.aaroksha.in/${props.slug}`,
    "logo": "https://www.aaroksha.in/favicon.png",
    "image": props.heroImage,
    "description": props.description,
    "telephone": "+91-9999999999",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Bhimavaram",
      "addressRegion": "Andhra Pradesh",
      "postalCode": "534201",
      "addressCountry": "IN"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": "16.5449",
      "longitude": "81.5212"
    },
    "areaServed": "Bhimavaram"
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": props.faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.aaroksha.in" },
      { "@type": "ListItem", "position": 2, "name": props.h1, "item": `https://www.aaroksha.in/${props.slug}` }
    ]
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <SEO 
        title={props.title} 
        description={props.description} 
        canonical={`/${props.slug}`}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      
      <Header />

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative pt-12 pb-20 lg:pt-20 lg:pb-28 overflow-hidden bg-white">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/80 to-transparent" />
          <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 text-center lg:text-left pt-10 lg:pt-0">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold mb-6 border border-blue-200 shadow-sm">
                <MapPin className="w-3.5 h-3.5" /> Bhimavaram, AP
              </div>
              <h1 className="text-4xl lg:text-5xl xl:text-6xl font-black text-slate-900 leading-[1.15] mb-6 tracking-tight">
                {props.h1}
              </h1>
              <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto lg:mx-0 font-medium">
                {props.subtitle}
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                <Link to={props.ctaLink} className="w-full sm:w-auto px-8 py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 hover:-translate-y-1 transition-all flex items-center justify-center gap-2">
                  {props.ctaText} <ChevronRight className="w-5 h-5" />
                </Link>
                <a href="tel:+919999999999" className="w-full sm:w-auto px-8 py-4 bg-white text-slate-800 font-bold border-2 border-slate-200 rounded-2xl shadow-sm hover:border-blue-300 hover:bg-blue-50 transition-all flex items-center justify-center gap-2">
                  <PhoneCall className="w-5 h-5 text-blue-600" /> Call Now
                </a>
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-3 text-sm font-bold text-slate-500">
                <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-green-500"/> Verified Partners</span>
                <span className="flex items-center gap-1.5"><Star className="w-4 h-4 text-amber-400 fill-amber-400"/> 4.9/5 Ratings</span>
              </div>
            </div>
            <div className="flex-1 w-full max-w-lg">
              <div className="relative rounded-[2rem] overflow-hidden shadow-2xl border-4 border-white transform lg:-rotate-2 transition-transform hover:rotate-0 duration-500">
                <img src={props.heroImage} alt={props.h1} className="w-full h-auto object-cover aspect-video lg:aspect-square" loading="lazy" />
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="py-16 bg-slate-50 border-y border-slate-100">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="text-2xl font-black text-center text-slate-800 mb-10">Why Choose Aaroksha in Bhimavaram?</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {props.features.map((feature, idx) => (
                <div key={idx} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-start gap-4 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
                    <CheckCircle2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg mb-1.5">{feature.split(':')[0]}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed font-medium">{feature.split(':')[1] || feature}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CONTENT SECTIONS */}
        <section className="py-20 lg:py-28 bg-white">
          <div className="max-w-4xl mx-auto px-6">
            {props.contentSections.map((sec, idx) => (
              <div key={idx} className="mb-14 last:mb-0">
                <h2 className="text-2xl lg:text-3xl font-black text-slate-900 mb-6 tracking-tight">{sec.title}</h2>
                <div className="prose prose-lg prose-slate max-w-none prose-headings:font-black prose-a:text-blue-600 hover:prose-a:text-blue-700" dangerouslySetInnerHTML={{ __html: sec.body }} />
              </div>
            ))}
          </div>
        </section>

        {/* FAQs */}
        <section className="py-20 bg-slate-50 border-t border-slate-200">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="text-3xl font-black text-center text-slate-900 mb-10 tracking-tight">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {props.faqs.map((faq, idx) => (
                <details key={idx} className="group bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden [&_summary::-webkit-details-marker]:hidden transition-all duration-300">
                  <summary className="flex items-center justify-between p-6 cursor-pointer font-bold text-slate-800 hover:bg-slate-50">
                    {faq.question}
                    <span className="transition-transform duration-300 group-open:rotate-180 bg-slate-100 rounded-full p-1 text-slate-500">
                      <ChevronRight className="w-5 h-5 rotate-90" />
                    </span>
                  </summary>
                  <div className="px-6 pb-6 text-slate-600 leading-relaxed font-medium">
                    {faq.answer}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
        
        {/* BOTTOM CTA */}
        <section className="py-20 bg-blue-600 text-center px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-black text-white mb-6 tracking-tight">Ready for Better Healthcare?</h2>
            <p className="text-blue-100 font-medium text-lg mb-8">Join thousands of families in Bhimavaram who trust Aaroksha for their medical needs.</p>
            <Link to={props.ctaLink} className="inline-flex items-center justify-center px-8 py-4 bg-white text-blue-700 font-black rounded-2xl shadow-xl hover:scale-105 transition-transform gap-2 text-lg">
              {props.ctaText} <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default SEOLandingTemplate;
