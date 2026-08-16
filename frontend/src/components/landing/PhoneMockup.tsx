import { useState, useEffect, useRef } from "react";
import { Wifi, CheckCircle2, Play, Volume2, Clock } from "lucide-react";
import ScrollReveal from "./ScrollReveal";

// 3 state: voucher → video_ad → connected
type PortalState = "voucher" | "video_ad" | "connected";

const AD_DURATION = 15;

const PhoneMockup = () => {
  const [state, setState] = useState<PortalState>("voucher");
  const [voucher, setVoucher] = useState("");
  const [adTimer, setAdTimer] = useState(AD_DURATION);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-demo: restart loop setiap selesai
  useEffect(() => {
    if (state !== "connected") return;
    const t = setTimeout(() => {
      setState("voucher");
      setVoucher("");
      setAdTimer(AD_DURATION);
    }, 3000);
    return () => clearTimeout(t);
  }, [state]);

  // Countdown saat video_ad
  useEffect(() => {
    if (state !== "video_ad") return;
    intervalRef.current = setInterval(() => {
      setAdTimer((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setState("connected");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, [state]);

  const handleLogin = () => {
    if (voucher.trim().length < 3) return;
    setState("video_ad");
    setAdTimer(AD_DURATION);
  };

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* Left: copy — tidak pernah tertimpa phone */}
          <ScrollReveal direction="left">
            <div className="space-y-6 order-2 lg:order-1">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
                Pengalaman Login WiFi{" "}
                <span className="text-primary">Tanpa Hambatan.</span>
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Iklan ditampilkan sebelum koneksi internet aktif. Pengguna hanya perlu menonton, lalu langsung terhubung.
              </p>

              {/* Flow steps */}
              <div className="space-y-3 pt-2">
                {[
                  { step: "1", text: "User connect ke WiFi" },
                  { step: "2", text: "Nonton Iklan Video (15s)" },
                  { step: "3", text: "Internet Terhubung" },
                ].map((item) => (
                  <div key={item.step} className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                      {item.step}
                    </span>
                    <span className="text-foreground font-medium">{item.text}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                {["Video HD Tanpa Buffer", "Tanpa Perlu Aplikasi", "Loading Cepat < 2 Detik"].map((f) => (
                  <span
                    key={f}
                    className="inline-flex items-center gap-1.5 text-sm bg-accent text-accent-foreground px-3 py-1.5 rounded-full font-medium"
                  >
                    <CheckCircle2 size={14} className="text-primary" />
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </ScrollReveal>

          {/* Right: phone mockup */}
          <ScrollReveal direction="right" delay={0.15}>
            <div className="flex justify-center order-1 lg:order-2">
              <div className="relative w-[260px] sm:w-[280px] rounded-[2.5rem] border-[6px] border-slate-matte-800 bg-slate-matte-900 shadow-2xl overflow-hidden select-none">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-slate-matte-800 rounded-b-xl z-10" />

                {/* ── STATE: VOUCHER ── */}
                {state === "voucher" && (
                  <div className="bg-background pt-9 pb-6 px-4 min-h-[520px] flex flex-col">
                    {/* Header bar */}
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-1.5">
                        <Wifi className="text-primary" size={16} />
                        <span className="text-xs font-bold text-foreground">Hotspot Portal</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">wifi.rekavia.com</span>
                    </div>

                    {/* Card */}
                    <div className="flex-1 flex flex-col justify-center gap-4">
                      <div className="text-center space-y-1">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                          <Wifi className="text-primary" size={22} />
                        </div>
                        <p className="text-sm font-bold text-foreground">Selamat Datang</p>
                        <p className="text-[11px] text-muted-foreground">Masukkan kode voucher untuk terhubung</p>
                      </div>

                      <div className="space-y-2">
                        <input
                          type="text"
                          value={voucher}
                          onChange={(e) => setVoucher(e.target.value.toUpperCase())}
                          placeholder="Kode Voucher"
                          maxLength={12}
                          className="w-full text-center text-sm font-mono bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                        <button
                          onClick={handleLogin}
                          disabled={voucher.trim().length < 3}
                          className="w-full py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                        >
                          Sambungkan
                        </button>
                      </div>

                      <p className="text-center text-[9px] text-muted-foreground">
                        Dengan melanjutkan, Anda menyetujui{" "}
                        <span className="text-primary">Syarat & Ketentuan</span>
                      </p>
                    </div>

                    <p className="text-center text-[9px] text-muted-foreground mt-4">
                      Powered by{" "}
                      <span className="font-semibold text-primary">Hotspot Portal</span>
                    </p>
                  </div>
                )}

                {/* ── STATE: VIDEO AD ── */}
                {state === "video_ad" && (
                  <div className="bg-slate-matte-950 pt-9 min-h-[520px] flex flex-col relative overflow-hidden">
                    {/* Fake video background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-tech-blue-900 via-slate-matte-900 to-tech-blue-950" />

                    {/* Ad content */}
                    <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 gap-3">
                      {/* Play indicator */}
                      <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                        <Play className="text-white fill-white" size={22} />
                      </div>

                      {/* Ad label */}
                      <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 text-center">
                        <p className="text-[10px] text-white/60 uppercase tracking-wider">Iklan</p>
                        <p className="text-xs font-bold text-white">Brand Lokal Anda</p>
                        <p className="text-[10px] text-white/70">Jangkau ribuan pelanggan nyata</p>
                      </div>
                    </div>

                    {/* Bottom bar */}
                    <div className="relative z-10 bg-black/40 backdrop-blur-sm px-4 py-3">
                      {/* Progress bar */}
                      <div className="w-full h-1 bg-white/20 rounded-full mb-2 overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-1000"
                          style={{ width: `${((AD_DURATION - adTimer) / AD_DURATION) * 100}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Volume2 size={12} className="text-white/60" />
                          <span className="text-[10px] text-white/60">Iklan sedang diputar</span>
                        </div>
                        <div className="flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1">
                          <Clock size={10} className="text-primary" />
                          <span className="text-[11px] font-bold text-white">{adTimer}s</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── STATE: CONNECTED ── */}
                {state === "connected" && (
                  <div className="bg-background pt-9 pb-6 px-4 min-h-[520px] flex flex-col items-center justify-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle2 className="text-green-500" size={32} />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-sm font-bold text-foreground">Terhubung!</p>
                      <p className="text-[11px] text-muted-foreground">
                        Internet aktif. Nikmati browsing Anda.
                      </p>
                    </div>
                    <div className="w-full bg-muted rounded-xl px-4 py-3 text-center">
                      <p className="text-[10px] text-muted-foreground">Sesi aktif selama</p>
                      <p className="text-lg font-bold text-primary">2 jam</p>
                    </div>
                    <p className="text-[9px] text-muted-foreground text-center">
                      Mengulang simulasi...
                    </p>
                  </div>
                )}
              </div>
            </div>
          </ScrollReveal>

        </div>
      </div>
    </section>
  );
};

export default PhoneMockup;
