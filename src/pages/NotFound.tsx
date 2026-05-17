import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { HomeIcon, AlertTriangle } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      {/* Animated badge */}
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-blue-400/20 rounded-full animate-ping" style={{ animationDuration: "3s" }} />
        <div className="h-24 w-24 bg-blue-100 rounded-full flex items-center justify-center relative">
          <AlertTriangle className="h-10 w-10 text-blue-600" />
        </div>
      </div>

      {/* Error code */}
      <p className="text-[11px] font-black text-blue-600 uppercase tracking-widest mb-1">Error 404</p>
      <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2">Page Not Found</h1>
      <div className="h-1 w-10 bg-blue-500 rounded-full mx-auto mb-4" />
      <p className="text-sm text-slate-500 max-w-xs font-medium mb-8">
        The page you're looking for doesn't exist or may have been moved.
      </p>

      <Link
        to="/"
        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-3 rounded-2xl transition-all active:scale-95 shadow-lg shadow-blue-200"
      >
        <HomeIcon className="h-4 w-4" />
        Back to Home
      </Link>
    </div>
  );
};

export default NotFound;
