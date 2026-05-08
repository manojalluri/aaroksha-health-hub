import { Mail, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { getSettings } from "@/lib/settingsSync";

const Footer = () => {
  const [settings, setSettings] = useState(getSettings());

  useEffect(() => {
    const handleUpdate = () => setSettings(getSettings());
    window.addEventListener("settings_updated", handleUpdate);
    return () => window.removeEventListener("settings_updated", handleUpdate);
  }, []);

  return (
    <footer className="gradient-footer pt-16 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          <div className="md:col-span-1">
            <div className="flex items-center mb-4">
              <img src="/logo.png" alt={settings.platform_name} className="h-16 w-auto object-contain" />
            </div>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              Premium Healthcare Platform – Book doctors, lab tests & medicines at your convenience.
            </p>
          </div>
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
            <h3 className="text-base font-bold text-foreground mb-4">Legal & Policies</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/terms-and-conditions" className="hover:text-primary transition-colors">Terms & Conditions</Link></li>
              <li><Link to="/privacy-policy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
              <li><Link to="/refund-policy" className="hover:text-primary transition-colors">Refund Policy</Link></li>
              <li><Link to="/return-policy" className="hover:text-primary transition-colors">Return Policy</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground mb-4">Contact Us</h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                {settings.support_email}
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                {settings.support_phone}
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-border pt-6 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            {/* Heart icon removed */}
            © 2024 {settings.platform_name}. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
