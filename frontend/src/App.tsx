import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import Index from "./pages/Index";
import Portal from "./pages/Portal";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminVouchers from "./pages/admin/AdminVouchers";
import AdminAds from "./pages/admin/AdminAds";
import AdminLogs from "./pages/admin/AdminLogs";
import AdminRouter from "./pages/admin/AdminRouter";
import AdminSettings from "./pages/admin/AdminSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Route guard: tanpa token → redirect ke login admin
const RequireAuth = ({ children }: { children: ReactNode }) => {
  const token = localStorage.getItem("access_token");
  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/portal" replace />} />
            <Route path="/home" element={<Index />} />
            <Route path="/portal" element={<Portal />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<RequireAuth><AdminOverview /></RequireAuth>} />
            <Route path="/admin/users" element={<RequireAuth><AdminUsers /></RequireAuth>} />
            <Route path="/admin/vouchers" element={<RequireAuth><AdminVouchers /></RequireAuth>} />
            <Route path="/admin/ads" element={<RequireAuth><AdminAds /></RequireAuth>} />
            <Route path="/admin/logs" element={<RequireAuth><AdminLogs /></RequireAuth>} />
            <Route path="/admin/router" element={<RequireAuth><AdminRouter /></RequireAuth>} />
            <Route path="/admin/settings" element={<RequireAuth><AdminSettings /></RequireAuth>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
