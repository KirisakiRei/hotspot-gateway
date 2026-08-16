import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ScrollReveal from "@/components/landing/ScrollReveal";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Eye, MapPin, BarChart3, Zap, UserPlus, CreditCard, Upload } from "lucide-react";

const benefits = [
  { icon: Eye, title: "100% Viewability", desc: "Iklan full-screen yang tidak bisa di-skip — berbeda dari social media ads yang sering di-scroll." },
  { icon: MapPin, title: "Hyper-Local Targeting", desc: "Jangkau pelanggan yang benar-benar ada di lokasi fisik, bukan hanya estimasi radius GPS." },
  { icon: BarChart3, title: "Transparansi Data", desc: "Dashboard real-time menunjukkan siapa yang menonton, kapan, dan di mana. Tanpa inflasi angka." },
  { icon: Zap, title: "Biaya Efisien", desc: "CPV (Cost Per View) yang jauh lebih rendah dibanding platform iklan konvensional." },
];

const steps = [
  { icon: UserPlus, num: "01", title: "Daftar Akun", desc: "Buat akun pengiklan gratis dalam 2 menit." },
  { icon: CreditCard, num: "02", title: "Top Up Saldo", desc: "Isi saldo iklan mulai dari Rp 500.000." },
  { icon: Upload, num: "03", title: "Upload & Tayang", desc: "Upload video iklan, pilih lokasi target, dan campaign langsung berjalan." },
];

const Advertiser = () => {
  const [budget, setBudget] = useState([5000000]);
  const estViews = Math.round(budget[0] / 500);
  const estReach = Math.round(estViews * 0.7);
  const formatNum = (n: number) => n.toLocaleString("id-ID");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 pb-16 lg:pt-36 lg:pb-24">
        <div className="container mx-auto px-4 lg:px-8 text-center max-w-3xl">
          <ScrollReveal>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight text-foreground">
              Jangkau Pelanggan Real di{" "}
              <span className="text-primary">Lokasi Nyata.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto">
              Iklankan brand Anda langsung ke layar pengguna WiFi di cafe, kampus, mall, dan ratusan lokasi lainnya.
            </p>
            <div className="mt-8">
              <Button size="lg" asChild>
                <Link to="/register">Mulai Beriklan Sekarang</Link>
              </Button>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 lg:px-8">
          <ScrollReveal>
            <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-12">
              Kenapa Lebih Baik dari <span className="text-primary">Social Media Ads</span>?
            </h2>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {benefits.map((b, i) => (
              <ScrollReveal key={b.title} delay={i * 0.1}>
                <div className="bg-card rounded-2xl border border-border p-6 h-full hover:shadow-lg transition-shadow">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <b.icon className="text-primary" size={24} />
                  </div>
                  <h3 className="font-bold text-foreground mb-2">{b.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* How to Start */}
      <section className="py-20">
        <div className="container mx-auto px-4 lg:px-8">
          <ScrollReveal>
            <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-12">
              Mulai dalam <span className="text-primary">3 Langkah</span>
            </h2>
          </ScrollReveal>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {steps.map((s, i) => (
              <ScrollReveal key={s.num} delay={i * 0.15}>
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <s.icon className="text-primary" size={28} />
                  </div>
                  <span className="text-xs font-bold text-primary">{s.num}</span>
                  <h3 className="font-bold text-foreground mt-1 mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Calculator */}
      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4 lg:px-8">
          <ScrollReveal>
            <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-12">
              Simulasi <span className="text-primary">Budget Iklan</span>
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <div className="max-w-lg mx-auto bg-card rounded-2xl shadow-lg border border-border p-6 md:p-8 space-y-6">
              <div>
                <label className="text-sm font-medium text-foreground">
                  Budget Iklan: Rp {formatNum(budget[0])}
                </label>
                <Slider value={budget} onValueChange={setBudget} min={1000000} max={50000000} step={500000} className="mt-3" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-accent rounded-xl p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Estimasi Views</p>
                  <p className="text-2xl font-bold text-accent-foreground">{formatNum(estViews)}</p>
                </div>
                <div className="bg-accent rounded-xl p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Estimasi Reach</p>
                  <p className="text-2xl font-bold text-accent-foreground">{formatNum(estReach)}</p>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary">
        <div className="container mx-auto px-4 lg:px-8 text-center">
          <ScrollReveal>
            <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
              Mulai Iklan Sekarang
            </h2>
            <p className="text-primary-foreground/80 mb-8 max-w-md mx-auto">
              Daftarkan brand Anda dan jangkau ribuan pelanggan nyata di lokasi fisik.
            </p>
            <Button size="lg" variant="secondary" asChild>
              <Link to="/register">Daftar Gratis</Link>
            </Button>
          </ScrollReveal>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Advertiser;
