import { Heart, Mail, Phone } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="gradient-footer pt-16 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-12">
          <div>
            <h3 className="text-base font-bold text-foreground mb-4">Popular Searches</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {["Dentists", "Orthopedics", "Cardiologists", "General Physicians", "Blood Test", "Thyroid Test", "Full Body Checkup"].map((item) => (
                <li key={item}>
                  <Link to="/doctors" className="hover:text-primary transition-colors">{item}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground mb-4">Company</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {["About Us", "Careers", "Press", "FAQ", "Privacy Policy"].map((item) => (
                <li key={item}>
                  <a href="#" className="hover:text-primary transition-colors">{item}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground mb-4">Contact Us</h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                support@aaroksha.com
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                +91 98765 43210
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-border pt-6 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Heart className="h-4 w-4 text-primary" fill="currentColor" />
            © 2024 Aaroksha. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
