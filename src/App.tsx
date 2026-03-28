import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import DoctorsPage from "./pages/DoctorsPage";
import BookAppointmentPage from "./pages/BookAppointmentPage";
import LabTestsPage from "./pages/LabTestsPage";
import PrescriptionPage from "./pages/PrescriptionPage";
import HospitalDashboard from "./pages/admin/HospitalDashboard";
import PharmacyDashboard from "./pages/admin/PharmacyDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/doctors" element={<DoctorsPage />} />
          <Route path="/book-appointment/:doctorId" element={<BookAppointmentPage />} />
          <Route path="/lab-tests" element={<LabTestsPage />} />
          <Route path="/prescription" element={<PrescriptionPage />} />
          <Route path="/admin/hospital" element={<HospitalDashboard />} />
          <Route path="/admin/pharmacy" element={<PharmacyDashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
