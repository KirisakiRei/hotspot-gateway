import { useState } from "react";
import { MapPin, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ScrollReveal from "@/components/landing/ScrollReveal";
import { useToast } from "@/hooks/use-toast";

const Contact = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast({ title: "Pesan terkirim!", description: "Kami akan menghubungi Anda segera." });
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="pt-32 pb-20">
        <div className="container mx-auto px-4 lg:px-8">
          <ScrollReveal>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground text-center mb-4">
              Hubungi <span className="text-primary">Kami</span>
            </h1>
            <p className="text-muted-foreground text-center max-w-lg mx-auto mb-16">
              Punya pertanyaan atau ingin bermitra? Kami siap membantu.
            </p>
          </ScrollReveal>

          <div className="grid lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
            {/* Info */}
            <ScrollReveal direction="left">
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-6">Informasi Kontak</h2>
                  <div className="space-y-5">
                    {[
                      { icon: MapPin, label: "Alamat", value: "Jl. Sudirman No. 123, Jakarta Selatan, Indonesia" },
                       { icon: Mail, label: "Email", value: "hello@wifi.rekavia.com" },
                      { icon: Phone, label: "Telepon", value: "+62 812 3456 7890" },
                    ].map((item) => (
                      <div key={item.label} className="flex gap-4">
                        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
                          <item.icon className="text-primary" size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{item.label}</p>
                          <p className="text-sm text-muted-foreground">{item.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Small map */}
                <div className="rounded-2xl overflow-hidden border border-border h-48">
                  <iframe
                    title="Location"
                    src="https://www.openstreetmap.org/export/embed.html?bbox=106.8%2C-6.22%2C106.85%2C-6.18&layer=mapnik"
                    className="w-full h-full"
                    loading="lazy"
                  />
                </div>
              </div>
            </ScrollReveal>

            {/* Form */}
            <ScrollReveal direction="right">
              <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border p-6 md:p-8 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name">Nama</Label>
                  <Input id="name" placeholder="Nama lengkap" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="email@contoh.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subjek</Label>
                  <Input id="subject" placeholder="Tentang apa?" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Pesan</Label>
                  <Textarea id="message" placeholder="Tuliskan pesan Anda..." rows={5} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Mengirim..." : "Kirim Pesan"}
                </Button>
              </form>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Contact;
