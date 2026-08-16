import { Megaphone, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import ScrollReveal from "./ScrollReveal";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const ServicesSection = () => (
  <section id="layanan" className="py-20 md:py-28">
    <div className="container mx-auto px-4 lg:px-8">
      <ScrollReveal>
        <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-4">
          Layanan <span className="text-primary">Kami</span>
        </h2>
        <p className="text-center text-muted-foreground max-w-2xl mx-auto mb-12">
          Solusi lengkap untuk pengiklan dan pemilik venue.
        </p>
      </ScrollReveal>

      <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        {/* Card A: Pengiklan */}
        <ScrollReveal delay={0.05}>
          <motion.div
            whileHover={{ y: -6 }}
            transition={{ duration: 0.25 }}
            className="relative overflow-hidden rounded-3xl p-8 md:p-10 min-h-[360px] flex flex-col justify-between bg-white/60 backdrop-blur-md border-2 border-tech-blue-200 shadow-lg"
          >
            <Megaphone
              className="absolute -top-4 -right-4 text-tech-blue-100"
              size={180}
              strokeWidth={1}
            />
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                <Megaphone className="text-primary" size={22} />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-3">Solusi Pengiklan</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-2">
                Maksimalkan brand awareness dengan iklan video yang tayang di 500+ lokasi strategis dalam format HD.
              </p>
            </div>
            <Button className="relative z-10 mt-6 w-fit rounded-xl" asChild>
              <Link to="/advertiser">Pelajari Selengkapnya</Link>
            </Button>
          </motion.div>
        </ScrollReveal>

        {/* Card B: Mitra Venue */}
        <ScrollReveal delay={0.1}>
          <motion.div
            whileHover={{ y: -6 }}
            transition={{ duration: 0.25 }}
            className="relative overflow-hidden rounded-3xl p-8 md:p-10 min-h-[360px] flex flex-col justify-between bg-white/60 backdrop-blur-md border-2 border-tech-blue-200 shadow-lg"
          >
            <Store
              className="absolute -top-4 -right-4 text-tech-blue-100"
              size={180}
              strokeWidth={1}
            />
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                <Store className="text-primary" size={22} />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-3">Solusi Mitra Venue</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-2">
                Monetisasi WiFi gratis Anda. Pendapatan pasif tanpa modal alat tambahan.
              </p>
            </div>
            <Button variant="outline" className="relative z-10 mt-6 w-fit rounded-xl border-primary text-primary hover:bg-primary hover:text-primary-foreground" asChild>
              <Link to="/mitra">Pelajari Selengkapnya</Link>
            </Button>
          </motion.div>
        </ScrollReveal>
      </div>
    </div>
  </section>
);

export default ServicesSection;
