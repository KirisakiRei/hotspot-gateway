import { Button } from "@/components/ui/button";
import ImageAccordion from "./ImageAccordion";
import ScrollReveal from "./ScrollReveal";
import { Link } from "react-router-dom";

const HeroSection = () => (
  <section id="beranda" className="pt-28 pb-16 lg:pt-36 lg:pb-24">
    <div className="container mx-auto px-4 lg:px-8">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        <ScrollReveal direction="left">
          <div className="space-y-6">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight text-foreground text-balance">
              Ubah WiFi Gratis Menjadi{" "}
              <span className="text-primary">Mesin Pendapatan Pasif.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg">
              Platform periklanan WiFi #1. Jangkau pelanggan lokal dengan presisi tinggi.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button size="lg" asChild>
                <Link to="/register">Mulai Beriklan</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#fitur">Gabung Mitra</a>
              </Button>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal direction="right" delay={0.15}>
          <ImageAccordion />
        </ScrollReveal>
      </div>
    </div>
  </section>
);

export default HeroSection;
