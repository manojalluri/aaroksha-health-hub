import { Stethoscope, FlaskConical, Pill, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "@/assets/hero-medical.jpg";

const ServiceCard = ({
  icon: Icon,
  title,
  buttonText,
  to,
}: {
  icon: React.ElementType;
  title: string;
  buttonText: string;
  to: string;
}) => (
  <Link
    to={to}
    className="glass-card rounded-2xl p-8 flex flex-col items-center text-center hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
  >
    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
      <Icon className="h-8 w-8 text-primary" />
    </div>
    <h3 className="text-lg font-bold text-foreground mb-4">{title}</h3>
    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground group-hover:gap-2 transition-all">
      {buttonText}
      <ChevronRight className="h-4 w-4" />
    </span>
  </Link>
);

const HeroSection = () => {
  return (
    <div className="relative overflow-hidden">
      {/* Hero gradient background */}
      <div className="gradient-hero min-h-[500px] flex flex-col items-center justify-center text-center px-4 pt-12 pb-0 relative">
        {/* Decorative dots */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(circle, hsl(0 0% 100% / 0.3) 1px, transparent 1px)',
          backgroundSize: '30px 30px'
        }} />
        
        <h1 className="text-3xl md:text-5xl font-bold text-primary-foreground mb-2 relative z-10 animate-fade-in-up">
          Book Hospitals, Lab Tests
        </h1>
        <h2 className="text-3xl md:text-5xl font-bold text-primary-foreground relative z-10 animate-fade-in-up">
          & Medicines <span className="font-script text-accent">from Home!</span>
        </h2>

        <div className="relative z-10 mt-8 w-full max-w-4xl">
          <img
            src={heroImage}
            alt="Aaroksha Healthcare Platform"
            className="w-full h-auto rounded-t-2xl"
            width={1920}
            height={800}
          />
        </div>
      </div>

      {/* Service cards */}
      <div className="container mx-auto px-4 -mt-8 relative z-20 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <ServiceCard
            icon={Stethoscope}
            title="Book OP Appointment"
            buttonText="Book Now"
            to="/doctors"
          />
          <ServiceCard
            icon={FlaskConical}
            title="Book Lab Test"
            buttonText="Try Now"
            to="/lab-tests"
          />
          <ServiceCard
            icon={Pill}
            title="Order Medicines"
            buttonText="Easy Delivery"
            to="/prescription"
          />
        </div>
      </div>
    </div>
  );
};

export default HeroSection;
