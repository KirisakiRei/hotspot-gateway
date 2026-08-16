import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense, Component, type ReactNode } from "react";
import ScrollToTop from "./components/ScrollToTop";

// ── Error Boundary — mencegah blank screen jika ada runtime error ─────────────
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center bg-background">
          <p className="text-lg font-semibold text-foreground">Terjadi kesalahan</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            {(this.state.error as Error).message}
          </p>
          <button
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg"
            onClick={() => window.location.reload()}
          >
            Muat Ulang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Landing index: eager — route utama, harus langsung render ─────────────────
import LandingIndex from "./pages/landing/Index";

// ── Landing sub-pages (lazy) ──────────────────────────────────────────────────
const LandingAbout      = lazy(() => import("./pages/landing/About"));
const LandingAdvertiser = lazy(() => import("./pages/landing/Advertiser"));
const LandingAuth       = lazy(() => import("./pages/landing/Auth"));
const LandingContact    = lazy(() => import("./pages/landing/Contact"));
const LandingMitra      = lazy(() => import("./pages/landing/Mitra"));
const LandingOnboarding = lazy(() => import("./pages/landing/Onboarding"));

// ── Hotspot portal (lazy) ─────────────────────────────────────────────────────
const Portal = lazy(() => import("./pages/Portal"));

// ── Admin pages (lazy) ────────────────────────────────────────────────────────
const AdminLogin    = lazy(() => import("./pages/admin/AdminLogin"));
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const AdminUsers    = lazy(() => import("./pages/admin/AdminUsers"));
const AdminVouchers = lazy(() => import("./pages/admin/AdminVouchers"));
const AdminAds      = lazy(() => import("./pages/admin/AdminAds"));
const AdminLogs     = lazy(() => import("./pages/admin/AdminLogs"));
const AdminRouter   = lazy(() => import("./pages/admin/AdminRouter"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const RequireAuth = ({ children }: { children: ReactNode }) => {
  const token = localStorage.getItem("access_token");
  if (!token) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
};

// Fallback minimal — cukup untuk mencegah blank screen tanpa layout shift
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
  </div>
);

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Landing */}
            <Route path="/"            element={<LandingIndex />} />
            <Route path="/about"       element={<LandingAbout />} />
            <Route path="/advertiser"  element={<LandingAdvertiser />} />
            <Route path="/login"       element={<LandingAuth />} />
            <Route path="/register"    element={<LandingAuth />} />
            <Route path="/contact"     element={<LandingContact />} />
            <Route path="/mitra"       element={<LandingMitra />} />
            <Route path="/onboarding"  element={<LandingOnboarding />} />

            {/* Hotspot portal */}
            <Route path="/portal" element={<Portal />} />

            {/* Admin */}
            <Route path="/admin/login"     element={<AdminLogin />} />
            <Route path="/admin"           element={<RequireAuth><AdminOverview /></RequireAuth>} />
            <Route path="/admin/users"     element={<RequireAuth><AdminUsers /></RequireAuth>} />
            <Route path="/admin/vouchers"  element={<RequireAuth><AdminVouchers /></RequireAuth>} />
            <Route path="/admin/ads"       element={<RequireAuth><AdminAds /></RequireAuth>} />
            <Route path="/admin/logs"      element={<RequireAuth><AdminLogs /></RequireAuth>} />
            <Route path="/admin/router"    element={<RequireAuth><AdminRouter /></RequireAuth>} />
            <Route path="/admin/settings"  element={<RequireAuth><AdminSettings /></RequireAuth>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;

