import React from 'react';
import SEOLandingTemplate, { SEOPageProps } from './SEOLandingTemplate';

const seoData: Record<string, SEOPageProps> = {
  "lab-tests": {
    title: "Best Lab Tests in Bhimavaram | Aaroksha Diagnostics",
    description: "Book affordable and accurate lab tests in Bhimavaram. Get blood tests and full body checkups done with certified diagnostic centers on Aaroksha.",
    h1: "Trusted Lab Tests in Bhimavaram",
    subtitle: "Accurate diagnostics with digital reports and affordable pricing. Book blood tests, lipid profiles, and health packages at top NABL certified labs.",
    schemaType: "DiagnosticCenter",
    slug: "lab-tests-bhimavaram",
    heroImage: "https://images.unsplash.com/photo-1579154204601-01588f351e67?q=80&w=1000&auto=format&fit=crop",
    features: [
      "NABL Certified Labs: Partnered with the most trusted diagnostic centers in Bhimavaram.",
      "Digital Reports: Access your lab reports online anytime through our app.",
      "Affordable Pricing: Transparent costs with no hidden fees."
    ],
    contentSections: [
      {
        title: "Comprehensive Lab Testing Services",
        body: "<p>When it comes to your health, accuracy is everything. Aaroksha connects you with Bhimavaram's top-rated pathology labs to ensure you get the most precise lab test results. From routine blood work to advanced diagnostic panels, we offer a seamless booking experience.</p><h3>Why Book With Us?</h3><ul><li>Fast processing times.</li><li>High hygiene standards.</li><li>Direct consultation options with doctors post-results.</li></ul>"
      }
    ],
    faqs: [
      { question: "Do you offer home sample collection?", answer: "Yes, we offer home sample collection for lab tests across Bhimavaram." },
      { question: "How long does it take to get reports?", answer: "Most routine blood test reports are available within 12-24 hours digitally on our platform." }
    ],
    ctaText: "Book a Lab Test",
    ctaLink: "/lab-tests"
  },
  "home-sample-collection": {
    title: "Home Sample Collection in Bhimavaram | Aaroksha",
    description: "Get blood tests done from the comfort of your home. Fast, safe, and hygienic home sample collection in Bhimavaram by expert phlebotomists.",
    h1: "Safe Home Sample Collection in Bhimavaram",
    subtitle: "Skip the queue. Our expert phlebotomists come to your doorstep for blood tests and diagnostics anywhere in Bhimavaram.",
    schemaType: "MedicalBusiness",
    slug: "home-sample-collection-bhimavaram",
    heroImage: "https://images.unsplash.com/photo-1631549916768-4119b2e5f926?q=80&w=1000&auto=format&fit=crop",
    features: [
      "Expert Phlebotomists: Highly trained professionals ensure painless collection.",
      "Strict Hygiene: 100% sterile equipment and sanitized procedures.",
      "On-time Arrival: We value your time with punctual home visits."
    ],
    contentSections: [
      {
        title: "Convenient Blood Tests at Home",
        body: "<p>Aaroksha brings world-class diagnostic services directly to your home in Bhimavaram. Our home sample collection service is designed for the elderly, busy professionals, and anyone who prefers privacy and convenience.</p><p>We maintain cold-chain logistics to ensure your sample's integrity from your home to the laboratory.</p>"
      }
    ],
    faqs: [
      { question: "Is there an extra charge for home collection?", answer: "We offer free or nominally priced home collection depending on the package selected." },
      { question: "Are the phlebotomists certified?", answer: "Yes, all our sample collectors are certified, experienced, and follow strict COVID-19 safety protocols." }
    ],
    ctaText: "Schedule Collection",
    ctaLink: "/lab-tests"
  },
  "medicine-delivery": {
    title: "Fastest Medicine Delivery in Bhimavaram | Aaroksha",
    description: "Order 100% genuine medicines online and get superfast delivery in Bhimavaram. Upload your prescription and get medicines at your doorstep.",
    h1: "Trusted Medicine Delivery in Bhimavaram",
    subtitle: "Get your prescribed medicines delivered fast. We partner with top local pharmacies to ensure you never miss a dose.",
    schemaType: "Pharmacy",
    slug: "medicine-delivery-bhimavaram",
    heroImage: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?q=80&w=1000&auto=format&fit=crop",
    features: [
      "100% Genuine Medicines: Sourced only from verified and licensed pharmacies.",
      "Superfast Delivery: Get your medicines delivered within hours in Bhimavaram.",
      "Easy Prescription Upload: Snap a photo and order instantly."
    ],
    contentSections: [
      {
        title: "Your Online Pharmacy Partner",
        body: "<p>Aaroksha makes ordering medicines in Bhimavaram easier than ever. Whether it's monthly refills for chronic conditions or urgent medication, our fast delivery network ensures you receive genuine medicines safely.</p><p>We verify every prescription to guarantee patient safety and correct dispensing.</p>"
      }
    ],
    faqs: [
      { question: "How fast is the delivery?", answer: "We aim to deliver all medicines within 2 to 4 hours across Bhimavaram." },
      { question: "Do I need a prescription?", answer: "Yes, a valid prescription from a registered medical practitioner is required for scheduled drugs." }
    ],
    ctaText: "Order Medicines",
    ctaLink: "/prescription"
  },
  "full-body-checkup": {
    title: "Full Body Checkup in Bhimavaram | Master Health Packages",
    description: "Preventive health checkups and full body test packages in Bhimavaram. Book comprehensive health screening for your family on Aaroksha.",
    h1: "Comprehensive Full Body Checkup in Bhimavaram",
    subtitle: "Stay ahead of health issues with our preventive full body health checkup packages. Affordable, accurate, and completely hassle-free.",
    schemaType: "DiagnosticCenter",
    slug: "full-body-checkup-bhimavaram",
    heroImage: "https://images.unsplash.com/photo-1516549655169-df83a0774514?q=80&w=1000&auto=format&fit=crop",
    features: [
      "Complete Screening: Tests covering liver, kidney, heart, thyroid, and blood health.",
      "Family Packages: Specialized checkups for men, women, and senior citizens.",
      "Doctor Consultation: Free review of your reports by top physicians."
    ],
    contentSections: [
      {
        title: "Preventive Healthcare Saves Lives",
        body: "<p>Aaroksha offers the most detailed full body checkups in Bhimavaram. Regular health screening can help detect diseases early when they are most treatable. Our packages are designed by medical experts to give you a complete picture of your health.</p>"
      }
    ],
    faqs: [
      { question: "Do I need to fast before a full body checkup?", answer: "Yes, most full body checkups require 10-12 hours of overnight fasting." },
      { question: "Can the sample be collected at home?", answer: "Absolutely! We provide free home sample collection for all master health checkup packages." }
    ],
    ctaText: "View Packages",
    ctaLink: "/lab-tests"
  },
  "diagnostic-center": {
    title: "Best Diagnostic Center in Bhimavaram | Aaroksha",
    description: "Find the top-rated diagnostic centers in Bhimavaram. Book X-rays, Ultrasounds, Blood tests, and MRI scans easily with Aaroksha.",
    h1: "Aaroksha Diagnostic Services in Bhimavaram",
    subtitle: "Partnering with the finest diagnostic labs in West Godavari to provide you with state-of-the-art testing facilities.",
    schemaType: "DiagnosticCenter",
    slug: "diagnostic-center-bhimavaram",
    heroImage: "https://images.unsplash.com/photo-1581594693702-fbdc51b2763b?q=80&w=1000&auto=format&fit=crop",
    features: [
      "Advanced Technology: Access to modern diagnostic equipment.",
      "Certified Pathologists: Reports verified by experienced medical professionals.",
      "Zero Wait Time: Book your slot online and walk in without delays."
    ],
    contentSections: [
      {
        title: "Premier Diagnostics in Your City",
        body: "<p>We have integrated the best diagnostic centers in Bhimavaram onto a single platform. Whether you need a simple blood test or advanced imaging, Aaroksha ensures you get premium service and accurate results.</p>"
      }
    ],
    faqs: [
      { question: "Which labs are partnered with Aaroksha?", recurse: false, answer: "We partner with NABL and ISO certified diagnostic centers across Bhimavaram." },
      { question: "How do I get my reports?", answer: "Reports are securely uploaded to your Aaroksha profile and can be downloaded anytime." }
    ],
    ctaText: "Find a Center",
    ctaLink: "/lab-tests"
  },
  "blood-test-at-home": {
    title: "Fast Blood Tests at Home in Bhimavaram | Aaroksha",
    description: "Book blood tests at home in Bhimavaram. Accurate results, hygienic collection, and fast reports with Aaroksha.",
    h1: "Fast Blood Tests at Home in Bhimavaram",
    subtitle: "Don't step out when you are sick. Get your blood tests done at home safely and quickly.",
    schemaType: "MedicalBusiness",
    slug: "blood-test-at-home-bhimavaram",
    heroImage: "https://images.unsplash.com/photo-1579154204601-01588f351e67?q=80&w=1000&auto=format&fit=crop",
    features: [
      "Painless Collection: Experienced staff trained for minimum discomfort.",
      "All Major Tests: CBC, Thyroid, Sugar, Lipid, and hundreds more.",
      "Digital Tracking: Track your sample status right from the app."
    ],
    contentSections: [
      {
        title: "Hassle-Free Blood Testing",
        body: "<p>Routine blood testing is vital for monitoring health. With Aaroksha's at-home blood test service in Bhimavaram, you get hospital-grade diagnostic services in your living room.</p>"
      }
    ],
    faqs: [
      { question: "Is the home collection process safe?", answer: "Yes, we use single-use sterile needles and follow strict sanitation guidelines." },
      { question: "Can I book a test for my parents?", answer: "Yes, you can easily book tests for family members by adding their details during checkout." }
    ],
    ctaText: "Book Blood Test",
    ctaLink: "/lab-tests"
  },
  "pharmacy-delivery": {
    title: "24/7 Pharmacy Delivery in Bhimavaram | Aaroksha",
    description: "Get pharmacy items and prescription medicines delivered fast in Bhimavaram. Trusted by thousands for reliable healthcare.",
    h1: "Reliable Pharmacy Delivery in Bhimavaram",
    subtitle: "Your trusted local pharmacy is now online. Get all your medical essentials delivered right to your door.",
    schemaType: "Pharmacy",
    slug: "pharmacy-delivery-bhimavaram",
    heroImage: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?q=80&w=1000&auto=format&fit=crop",
    features: [
      "Wide Inventory: From chronic meds to OTC healthcare products.",
      "Cold Storage Transport: Insulin and vaccines are transported safely.",
      "Automated Refills: Never run out of your regular medicines."
    ],
    contentSections: [
      {
        title: "Healthcare at Your Fingertips",
        body: "<p>Our pharmacy delivery service in Bhimavaram is built for speed and reliability. We bridge the gap between local pharmacies and patients, ensuring genuine medicines are accessible to everyone, everywhere in the city.</p>"
      }
    ],
    faqs: [
      { question: "Can I return medicines?", answer: "We accept returns for sealed, untampered medicines within 3 days as per our return policy." },
      { question: "Are OTC medicines available?", answer: "Yes, a wide range of over-the-counter products are available for delivery." }
    ],
    ctaText: "Explore Pharmacy",
    ctaLink: "/prescription"
  },
  "healthcare-services": {
    title: "Best Healthcare Services in Bhimavaram | Aaroksha",
    description: "Aaroksha is Bhimavaram's complete healthcare platform. OP booking, Lab tests, and Medicine delivery all in one place.",
    h1: "Complete Healthcare Services in Bhimavaram",
    subtitle: "Aaroksha is revolutionizing digital health in West Godavari. Experience premium medical services from booking doctors to getting medicines.",
    schemaType: "MedicalOrganization",
    slug: "healthcare-services-bhimavaram",
    heroImage: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?q=80&w=1000&auto=format&fit=crop",
    features: [
      "Integrated Platform: Everything health-related in one seamless app.",
      "Top Doctors: Consult with the best specialists in Bhimavaram.",
      "Premium Support: Dedicated customer service for your medical needs."
    ],
    contentSections: [
      {
        title: "Your Health, Our Priority",
        body: "<p>Aaroksha is built with the vision to make quality healthcare accessible in Bhimavaram. We bring together hospitals, diagnostic centers, and pharmacies into one unified ecosystem, ensuring patients receive the highest standard of care without the usual hassle.</p>"
      }
    ],
    faqs: [
      { question: "How do I book a doctor's appointment?", answer: "Simply go to our Doctors section, choose your specialist, pick a time slot, and confirm your booking instantly." },
      { question: "Is my medical data secure?", answer: "Yes, Aaroksha uses enterprise-grade encryption to ensure your health records remain private and secure." }
    ],
    ctaText: "Discover Services",
    ctaLink: "/"
  }
};

export const LabTestsBhimavaram = () => <SEOLandingTemplate {...seoData["lab-tests"]} />;
export const HomeSampleCollectionBhimavaram = () => <SEOLandingTemplate {...seoData["home-sample-collection"]} />;
export const MedicineDeliveryBhimavaram = () => <SEOLandingTemplate {...seoData["medicine-delivery"]} />;
export const FullBodyCheckupBhimavaram = () => <SEOLandingTemplate {...seoData["full-body-checkup"]} />;
export const DiagnosticCenterBhimavaram = () => <SEOLandingTemplate {...seoData["diagnostic-center"]} />;
export const BloodTestAtHomeBhimavaram = () => <SEOLandingTemplate {...seoData["blood-test-at-home"]} />;
export const PharmacyDeliveryBhimavaram = () => <SEOLandingTemplate {...seoData["pharmacy-delivery"]} />;
export const HealthcareServicesBhimavaram = () => <SEOLandingTemplate {...seoData["healthcare-services"]} />;
