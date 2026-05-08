import { Link, useLocation } from "react-router-dom";
import { MapPin, Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { getSettings } from "@/lib/settingsSync";

const Header = () => {
  const [settings, setSettings] = useState(getSettings());

  useEffect(() => {
    const handleUpdate = () => setSettings(getSettings());
    window.addEventListener("settings_updated", handleUpdate);
    return () => window.removeEventListener("settings_updated", handleUpdate);
  }, []);

  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { to: "/", label: "Home" },
    { to: "/doctors", label: "Doctors" },
    { to: "/lab-tests", label: "Lab Tests" },
    { to: "/prescription", label: "Medicines" },
  ];

  return (
    <header className="sticky top-0 z-50 glass-card border-b border-border/40">
      <div className="container mx-auto flex items-center justify-between py-3 px-4">
        <Link to="/" className="flex items-center">
          <img src="/logo.png" alt="Aaroksha Health Hub" className="h-14 w-auto object-contain" />
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`text-sm font-medium transition-colors hover:text-primary ${
                location.pathname === link.to
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-sm text-secondary-foreground">
            <MapPin className="h-3.5 w-3.5" />
            Bhimavaram
          </div>
          <Link
            to="/doctors"
            className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition"
          >
            Book Now
          </Link>
        </div>

        <button
          className="md:hidden p-2"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-border bg-card px-4 py-4 space-y-3">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMenuOpen(false)}
              className="block text-sm font-medium text-foreground hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
};

export default Header;
