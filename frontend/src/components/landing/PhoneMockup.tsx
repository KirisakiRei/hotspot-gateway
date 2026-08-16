import { useState, useEffect } from "react";
import { Play, Wifi, CheckCircle2 } from "lucide-react";
import ScrollReveal from "./ScrollReveal";

const features = [
  "Video HD Tanpa Buffer",
  "Tanpa Perlu Aplikasi",
  "Loading Cepat < 2 Detik",
];

const PhoneMockup = () => {
  const [connected, setConnected] = useState(false);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(t);
    } else {
      setConnected(true);
    }
  }, [countdown]);

  return (
    <section className="py-20">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <ScrollReveal direction="left">
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                Pengalaman Login WiFi{" "}
                <span className="text-primary">Tanpa Hambatan.</span>
              </h2>
              <p className="text-muted-foreground">
                Iklan ditampilkan sebelum koneksi internet aktif. Pengguna hanya perlu menonton, lalu langsung terhubung.
              </p>
              <ul className="space-y-3">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-foreground">
                    <CheckCircle2 className="text-primary shrink-0" size={20} />
                    <span className="font-medium">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          <ScrollReveal direction="right" delay={0.15}>
            <div className="flex justify-center">
              {/* Phone Frame */}
              <div className="relative w-[280px] rounded-[2.5rem] border-[6px] border-slate-matte-800 bg-slate-matte-900 shadow-2xl overflow-hidden">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-slate-matte-800 rounded-b-2xl z-10" />

                {/* Screen */}
                <div className="bg-card pt-10 pb-6 px-4 min-h-[520px] flex flex-col">
                  <div className="flex items-center gap-2 mb-6">
                    <Wifi className="text-primary" size={20} />
                    <span className="font-bold text-sm text-foreground">Wifi Login Portal</span>
                  </div>

                  {/* Video placeholder */}
                  <div className="relative bg-muted rounded-xl flex-1 flex items-center justify-center mb-6 min-h-[200px]">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                      <Play className="text-primary ml-1" size={28} fill="currentColor" />
                    </div>
                    <span className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-card/80 px-2 py-0.5 rounded">
                      0:15
                    </span>
                  </div>

                  {/* Connect button */}
                  <button
                    className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                      connected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                    }`}
                    disabled={!connected}
                  >
                    {connected
                      ? "✓ Terhubung ke Internet"
                      : `Menghubungkan... (${countdown}s)`}
                  </button>

                  <p className="text-center text-[10px] text-muted-foreground mt-4">
                    Powered by <span className="font-semibold text-primary">Wifi Ads Tech</span>
                  </p>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
};

export default PhoneMockup;
