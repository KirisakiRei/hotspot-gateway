import { CheckCircle2, Wifi } from 'lucide-react';

export function SuccessScreen() {
  const handleBrowse = () => {
    const params = new URLSearchParams(window.location.search);
    const origin = params.get('link-orig') || params.get('dst') || '/';
    window.location.href = origin;
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col animate-fade-in">
      <div className="flex-1 px-6 flex flex-col items-center justify-center">
        {/* Success Animation */}
        <div className="relative mb-8">
          <div className="w-28 h-28 rounded-full bg-success/10 flex items-center justify-center animate-success-pulse">
            <div className="w-20 h-20 rounded-full bg-success flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-success-foreground" />
            </div>
          </div>
          
          {/* Decorative circles */}
          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary/20 animate-ping" style={{ animationDelay: '0.2s' }} />
          <div className="absolute -bottom-1 -left-3 w-4 h-4 rounded-full bg-success/30 animate-ping" style={{ animationDelay: '0.4s' }} />
        </div>

        {/* Success Message */}
        <h1 className="text-2xl font-bold text-foreground text-center mb-3">
          Internet Aktif
        </h1>
        <p className="text-muted-foreground text-center mb-4 max-w-xs">
          Selamat! Anda sekarang terhubung ke jaringan WiFi gratis
        </p>

        {/* Wifi Icon */}
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-8">
          <Wifi className="w-8 h-8 text-primary" />
        </div>
      </div>

      {/* Bottom Section */}
      <div className="px-6 pb-8">
        <button
          onClick={handleBrowse}
          className="btn-primary w-full"
        >
          Mulai Browsing
        </button>
      </div>
    </div>
  );
}
