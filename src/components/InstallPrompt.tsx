import { useState, useEffect } from "react";
import { Download, X, Smartphone, Globe } from "lucide-react";

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Show custom prompt after a short delay
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      console.log("User accepted the install prompt");
    } else {
      console.log("User dismissed the install prompt");
    }
    
    // Reset stashed prompt
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md animate-in slide-in-from-bottom-10 fade-in duration-700">
      <div className="bg-white rounded-3xl p-5 shadow-2xl border border-slate-100 flex items-center gap-5 relative overflow-hidden group">
        
        {/* Background glow */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all duration-700" />
        
        {/* Close button */}
        <button 
          onClick={() => setShowPrompt(false)}
          className="absolute top-3 right-3 h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Brand Icon */}
        <div className="h-14 w-14 rounded-2xl bg-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-200">
          <Smartphone className="h-7 w-7 text-white" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-4">
          <h3 className="font-black text-slate-800 text-sm leading-tight mb-1">Install Aaroksha App</h3>
          <p className="text-[11px] font-medium text-slate-500 leading-tight">Install for a faster experience & easy bookings.</p>
        </div>

        {/* Button */}
        <button
          onClick={handleInstall}
          className="bg-blue-600 hover:bg-blue-700 text-white font-black px-5 py-2.5 rounded-2xl text-xs transition-all shadow-md shadow-blue-100 active:scale-95 flex items-center gap-2 whitespace-nowrap"
        >
          <Download className="h-3.5 w-3.5" /> Install
        </button>
      </div>
    </div>
  );
};

export default InstallPrompt;
