import { Users, Eye, MapPin } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ScrollReveal from "@/components/landing/ScrollReveal";

const stats = [
  { icon: Users, value: "1000+", label: "Mitra Aktif" },
  { icon: Eye, value: "5M+", label: "Total Views" },
  { icon: MapPin, value: "50+", label: "Kota" },
];

const team = [
  { name: "Andi Wijaya", role: "CEO & Co-Founder", img: "https://i.pravatar.cc/200?img=11" },
  { name: "Sari Dewi", role: "CTO", img: "https://i.pravatar.cc/200?img=5" },
  { name: "Budi Santoso", role: "VP of Sales", img: "https://i.pravatar.cc/200?img=12" },
  { name: "Rina Putri", role: "Head of Marketing", img: "https://i.pravatar.cc/200?img=9" },
];

const About = () => (
  <div className="min-h-screen bg-background">
    <Navbar />

    {/* Hero */}
    <section className="pt-32 pb-16">
      <div className="container mx-auto px-4 lg:px-8 text-center">
        <ScrollReveal>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground max-w-3xl mx-auto leading-tight">
            Misi Kami: Mendemokratisasi <span className="text-primary">Iklan Digital Lokal</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            Kami percaya setiap bisnis lokal berhak mendapatkan akses ke periklanan digital yang efektif dan terjangkau.
          </p>
        </ScrollReveal>
      </div>
    </section>

    {/* Story */}
    <section className="py-16">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <ScrollReveal direction="left">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-foreground">Cerita Kami</h2>
              <p className="text-muted-foreground leading-relaxed">
                Hotspot Portal lahir dari ide sederhana: bagaimana jika jaringan WiFi gratis yang sudah ada di ribuan cafe, hotel, dan ruang publik bisa menjadi media iklan yang powerful?
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Didirikan pada 2024, kami membangun platform yang menghubungkan pengiklan lokal dengan audiens yang tepat melalui captive portal WiFi. Tanpa aplikasi, tanpa biaya besar — hanya koneksi yang bermakna.
              </p>
            </div>
          </ScrollReveal>
          <ScrollReveal direction="right">
            <img
              src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&q=80"
              alt="Tim Wifi Ads Tech"
              className="rounded-2xl shadow-lg w-full object-cover aspect-video"
              loading="lazy"
            />
          </ScrollReveal>
        </div>
      </div>
    </section>

    {/* Stats */}
    <section className="py-16 bg-muted/50">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto">
          {stats.map((s, i) => (
            <ScrollReveal key={s.label} delay={i * 0.1}>
              <div className="text-center">
                <s.icon className="text-primary mx-auto mb-2" size={28} />
                <p className="text-3xl font-bold text-foreground">{s.value}</p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>

    {/* Team */}
    <section className="py-16">
      <div className="container mx-auto px-4 lg:px-8">
        <ScrollReveal>
          <h2 className="text-3xl font-bold text-foreground text-center mb-12">Tim Kami</h2>
        </ScrollReveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
          {team.map((t, i) => (
            <ScrollReveal key={t.name} delay={i * 0.1}>
              <div className="bg-card rounded-2xl border border-border p-6 text-center">
                <img src={t.img} alt={t.name} className="w-20 h-20 rounded-full mx-auto mb-4 object-cover" loading="lazy" />
                <h3 className="font-bold text-foreground">{t.name}</h3>
                <p className="text-sm text-muted-foreground">{t.role}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>

    <Footer />
  </div>
);

export default About;
