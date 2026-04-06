import { BrowserRouter, Route, Routes, Link } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import DoctorsPage from "./pages/DoctorsPage";
import BookAppointmentPage from "./pages/BookAppointmentPage";
import LabTestsPage from "./pages/LabTestsPage";
import PrescriptionPage from "./pages/PrescriptionPage";
import ProfilePage from "./pages/ProfilePage";
import AuthPage from "./pages/AuthPage";
import { AuthProvider } from "./contexts/AuthContext";
import HospitalDashboard from "./pages/admin/HospitalDashboard";
import LabDashboard from "./pages/admin/LabDashboard";
import PharmacyDashboard from "./pages/admin/PharmacyDashboard";
import SuperAdminDashboard from "./pages/admin/SuperAdminDashboard";
import HospitalLogin from "./pages/admin/HospitalLogin";
import LabLogin from "./pages/admin/LabLogin";
import PharmacyLogin from "./pages/admin/PharmacyLogin";
import SuperAdminLogin from "./pages/admin/SuperAdminLogin";

import LogisticsDashboard from "./pages/admin/LogisticsDashboard";
import LogisticsLogin from "./pages/admin/LogisticsLogin";

import { getSettings, syncSettingsFromSupabase } from "./lib/settingsSync";
import { useState, useEffect } from "react";
import { AlertTriangle, Hammer, ArrowLeft } from "lucide-react";

const queryClient = new QueryClient();

const MaintenanceScreen = () => (
  <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
    <div className="h-24 w-24 bg-amber-100 rounded-full flex items-center justify-center mb-6 shadow-lg">
      <Hammer className="h-10 w-10 text-amber-600" />
    </div>
    <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-tight mb-3">
      We're upgrading your <br className="md:hidden" /> experience!
    </h1>
    <p className="text-slate-500 max-w-sm mx-auto font-medium mb-8">
      Aaroksha Health Hub is currently undergoing scheduled maintenance. Our engineers are working hard. Please check back shortly.
    </p>
    <div className="bg-white px-6 py-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
      <p className="text-sm font-bold text-slate-600 text-left">We expect to be back online in about 2 hours.</p>
    </div>
  </div>
);

const AppRoutes = () => {
  const [settings, setSettings] = useState(getSettings());
  const location = window.location.pathname;
  const isCustomerPage = !location.startsWith("/admin");
  
  useEffect(() => {
    // Sync with Supabase on mount
    syncSettingsFromSupabase().then(() => setSettings(getSettings()));

    const handleSettings = () => setSettings(getSettings());
    // Also poll settings periodically just in case it's in another tab
    const interval = setInterval(handleSettings, 5000); // 5s polling
    window.addEventListener("settings_updated", handleSettings);
    
    // Cross-tab sync via storage event
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "aaroksha_settings") handleSettings();
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      clearInterval(interval);
      window.removeEventListener("settings_updated", handleSettings);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);


  return (
    <Routes>
      {settings.is_maintenance && isCustomerPage ? (
        <Route path="*" element={<MaintenanceScreen />} />
      ) : (
        <>
          <Route path="/" element={<Index />} />
          <Route path="/doctors" element={<DoctorsPage />} />
          <Route path="/book-appointment/:doctorId" element={<BookAppointmentPage />} />
          <Route path="/lab-tests" element={<LabTestsPage />} />
          <Route path="/prescription" element={<PrescriptionPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/auth" element={<AuthPage />} />
        </>
      )}

      {/* Admin Routes */}
      <Route path="/admin/hospital" element={<HospitalDashboard />} />
      <Route path="/admin/lab" element={<LabDashboard />} />
      <Route path="/admin/pharmacy" element={<PharmacyDashboard />} />
      <Route path="/admin/super" element={<SuperAdminDashboard />} />
      <Route path="/admin/logistics" element={<LogisticsDashboard />} />
      
      <Route path="/admin/login/hospital" element={<HospitalLogin />} />
      <Route path="/admin/login/lab" element={<LabLogin />} />
      <Route path="/admin/login/pharmacy" element={<PharmacyLogin />} />
      <Route path="/admin/login/super" element={<SuperAdminLogin />} />
      <Route path="/admin/login/logistics" element={<LogisticsLogin />} />
      
      {!settings.is_maintenance && <Route path="*" element={<NotFound />} />}
    </Routes>
  );
};

const App = () => {
  console.log("App component: rendering full application");
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
};

export default App;
