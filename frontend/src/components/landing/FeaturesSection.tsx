import { Eye, MapPin, BarChart3, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import ScrollReveal from "./ScrollReveal";

const features = [
  {
    icon: Eye,
    title: "100% Viewability",
    desc: "Iklan video full-screen yang tidak bisa di-skip. Garansi dilihat 100% oleh audiens.",
  },
  {
    icon: MapPin,
    title: "Hyper-Local Targeting",
    desc: "Target spesifik lokasi fisik — Kampus, Cafe, Mall, Kantor — dengan presisi tinggi.",
  },
  {
    icon: BarChart3,
    title: "Real-Time Dashboard",
    desc: "Data transparan detik itu juga. Monitor impresi, view, dan konversi secara live.",
  },
  {
    icon: ShieldCheck,
    title: "Anti-Fraud AI",
    desc: "Sistem pendeteksi bot otomatis. Pastikan setiap view berasal dari pengguna nyata.",
  },
];

const FeaturesSection = () => (
  <section id="fitur" className="py-20 md:py-28 bg-tech-blue-950 text-white">
    <div className="container mx-auto px-4 lg:px-8">
      <ScrollReveal>
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold">
            Fitur <span className="text-tech-blue-300">Unggulan</span>
          </h2>
          <p className="text-tech-blue-200/70 mt-3 max-w-md mx-auto">
            Teknologi canggih untuk hasil iklan yang maksimal.
          </p>
        </div>
      </ScrollReveal>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
        {features.map((f, i) => (
          <ScrollReveal key={f.title} delay={i * 0.1}>
            <motion.div
              whileHover={{ y: -8, rotateX: 2, rotateY: -2 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 h-full cursor-default hover:bg-white/10 transition-colors"
              style={{ perspective: 800 }}
            >
              <div className="w-12 h-12 rounded-xl bg-tech-blue-500/20 flex items-center justify-center mb-4">
                <f.icon className="text-tech-blue-300" size={24} />
              </div>
              <h3 className="font-bold mb-2 text-white">{f.title}</h3>
              <p className="text-sm text-tech-blue-200/60 leading-relaxed">{f.desc}</p>
            </motion.div>
          </ScrollReveal>
        ))}
      </div>
    </div>
  </section>
);

export default FeaturesSection;
