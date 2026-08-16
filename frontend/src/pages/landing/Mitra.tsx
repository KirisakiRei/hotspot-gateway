import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ScrollReveal from "@/components/landing/ScrollReveal";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Wallet, Cpu, ArrowRightLeft, UserPlus, Router, TrendingUp } from "lucide-react";

const benefits = [
  { icon: Wallet, title: "Pendapatan Pasif", desc: "Dapatkan penghasilan tambahan hanya dengan menyediakan WiFi gratis untuk pengunjung." },
  { icon: Cpu, title: "Sistem Gratis", desc: "Kami sediakan perangkat dan software tanpa biaya — Anda hanya perlu koneksi internet." },
  { icon: ArrowRightLeft, title: "Transfer Otomatis", desc: "Pembayaran masuk otomatis ke rekening Anda setiap bulan, transparan dan tepat waktu." },
];

const steps = [
  { icon: UserPlus, num: "01", title: "Daftar Mitra", desc: "Isi formulir pendaftaran mitra, gratis dan mudah." },
  { icon: Router, num: "02", title: "Pasang Perangkat", desc: "Tim kami akan bantu setup perangkat Hotspot Portal di lokasi Anda." },
  { icon: TrendingUp, num: "03", title: "Mulai Cuan", desc: "Pendapatan langsung mengalir setiap ada pengguna yang terhubung." },
];

const Mitra = () => {
  const [visitors, setVisitors] = useState([200]);
  const estIncome = Math.round(visitors[0] * 30 * 150);
  const formatNum = (n: number) => n.toLocaleString("id-ID");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 pb-16 lg:pt-36 lg:pb-24">
        <div className="container mx-auto px-4 lg:px-8 text-center max-w-3xl">
          <ScrollReveal>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight text-foreground">
              Ubah WiFi Cost Menjadi{" "}
              <span className="text-primary">Profit Center.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto">
              Jadikan jaringan WiFi di venue Anda sebagai sumber pendapatan pasif tanpa modal tambahan.
            </p>
            <div className="mt-8">
              <Button size="lg" asChild>
                <Link to="/register">Gabung Menjadi Mitra</Link>
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
              Keuntungan Menjadi <span className="text-primary">Mitra</span>
            </h2>
          </ScrollReveal>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
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

      {/* Steps */}
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
              Simulasi <span className="text-primary">Pendapatan Mitra</span>
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <div className="max-w-lg mx-auto bg-card rounded-2xl shadow-lg border border-border p-6 md:p-8 space-y-6">
              <div>
                <label className="text-sm font-medium text-foreground">
                  Pengunjung Harian: {visitors[0]}
                </label>
                <Slider value={visitors} onValueChange={setVisitors} min={50} max={2000} step={10} className="mt-3" />
              </div>
              <div className="bg-accent rounded-xl p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Potensi Income Bulanan</p>
                <p className="text-2xl font-bold text-accent-foreground">Rp {formatNum(estIncome)}</p>
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
              Gabung Menjadi Mitra
            </h2>
            <p className="text-primary-foreground/80 mb-8 max-w-md mx-auto">
              Daftarkan venue Anda dan mulai hasilkan pendapatan pasif dari WiFi.
            </p>
            <Button size="lg" variant="secondary" asChild>
              <Link to="/register">Daftar Mitra Gratis</Link>
            </Button>
          </ScrollReveal>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Mitra;
