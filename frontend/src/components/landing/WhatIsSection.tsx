import { Wifi, Play, Globe, Coins } from "lucide-react";
import { motion } from "framer-motion";
import ScrollReveal from "./ScrollReveal";

const steps = [
  { icon: Wifi, title: "User Connect WiFi", desc: "Pengguna terhubung ke jaringan WiFi gratis di lokasi mitra." },
  { icon: Play, title: "Iklan Muncul (Video)", desc: "Video iklan berdurasi 15 detik ditampilkan secara full-screen." },
  { icon: Globe, title: "Internet Terhubung", desc: "Setelah iklan selesai, internet langsung aktif tanpa hambatan." },
  { icon: Coins, title: "Semua Untung", desc: "Mitra dapat cuan, brand dapat awareness. Win-win solution." },
];

const WhatIsSection = () => (
  <section id="what-is" className="py-20 md:py-28 bg-muted/30">
    <div className="container mx-auto px-4 lg:px-8">
      <ScrollReveal>
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            Apa itu <span className="text-primary">Hotspot Portal</span>?
          </h2>
          <p className="text-muted-foreground mt-3 max-w-lg mx-auto">
            Proses sederhana yang menguntungkan semua pihak.
          </p>
        </div>
      </ScrollReveal>

      <div className="relative max-w-5xl mx-auto">
        {/* Connecting line (desktop) — perfectly centered on icons */}
        <div className="hidden md:block absolute top-[28px] left-[12%] right-[12%] h-1 z-0 -translate-y-1/2 bg-border">
          <motion.div
            className="h-full bg-primary origin-left"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-6 relative">
          {steps.map((s, i) => (
            <ScrollReveal key={s.title} delay={i * 0.15}>
              <div className="flex flex-col items-center text-center">
                <div className="relative z-10 w-14 h-14 rounded-full bg-background border-2 border-primary flex items-center justify-center mb-4">
                  <s.icon className="text-primary" size={24} />
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>
                <h3 className="font-bold text-foreground mb-1 text-sm">{s.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-[200px]">{s.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default WhatIsSection;
