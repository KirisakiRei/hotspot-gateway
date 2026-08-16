import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone, Store, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Role = "advertiser" | "partner" | null;

const industries = ["F&B", "Retail", "Tech", "Edukasi", "Lainnya"];
const venueTypes = ["Cafe/Resto", "Kampus", "Kantor", "Hotel", "Publik"];

const Onboarding = () => {
  const [selectedRole, setSelectedRole] = useState<Role>(null);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRole === "advertiser") {
      navigate("/advertiser");
    } else {
      navigate("/mitra");
    }
  };

  return (
    <div className="min-h-screen bg-muted/50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-card rounded-3xl shadow-xl border border-border p-8 md:p-12">
          {/* Header */}
          <div className="text-center mb-8">
            <Link to="/" className="text-xl font-extrabold text-foreground">
              Hotspot <span className="text-primary">Portal</span>
            </Link>
            <h1 className="mt-6 text-2xl md:text-3xl font-bold text-foreground">
              Selamat Datang di Hotspot Portal!
            </h1>
            <p className="mt-2 text-muted-foreground max-w-md mx-auto">
              Satu langkah lagi. Beritahu kami tujuan Anda bergabung agar kami bisa menyiapkan dashboard yang tepat.
            </p>
          </div>

          {/* Role Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <RoleCard
              icon={<Megaphone className="text-primary" size={32} />}
              title="Saya Ingin Beriklan"
              desc="Promosikan brand atau produk Anda di jaringan WiFi kami."
              selected={selectedRole === "advertiser"}
              onClick={() => setSelectedRole("advertiser")}
              accentClass="border-primary bg-accent/50"
            />
            <RoleCard
              icon={<Store className="text-emerald-500" size={32} />}
              title="Saya Pemilik Lokasi"
              desc="Monetisasi WiFi di cafe, kantor, atau area publik Anda."
              selected={selectedRole === "partner"}
              onClick={() => setSelectedRole("partner")}
              accentClass="border-emerald-500 bg-emerald-50"
            />
          </div>

          {/* Conditional Form */}
          <AnimatePresence mode="wait">
            {selectedRole && (
              <motion.form
                key={selectedRole}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="overflow-hidden"
                onSubmit={handleSubmit}
              >
                <div className="border-t border-border pt-6 space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    {selectedRole === "advertiser"
                      ? "Lengkapi Profil Pengiklan"
                      : "Lengkapi Profil Mitra"}
                  </h3>

                  {selectedRole === "advertiser" ? (
                    <>
                      <div className="space-y-1.5">
                        <Label>Nama Perusahaan / Brand</Label>
                        <Input placeholder="PT Contoh Nusantara" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Industri</Label>
                        <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          <option value="">Pilih industri</option>
                          {industries.map((i) => (
                            <option key={i} value={i}>{i}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>No. WhatsApp Bisnis</Label>
                        <Input type="tel" placeholder="08123456789" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <Label>Nama Lokasi / Cafe</Label>
                        <Input placeholder="Kopi Kenangan Sudirman" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Jenis Lokasi</Label>
                        <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          <option value="">Pilih jenis lokasi</option>
                          {venueTypes.map((v) => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Alamat Lengkap</Label>
                        <textarea
                          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          placeholder="Jl. Sudirman No. 1, Jakarta Pusat"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Estimasi Pengunjung Harian</Label>
                        <Input type="number" placeholder="100" />
                      </div>
                    </>
                  )}

                  <Button className="w-full mt-2" size="lg">
                    {selectedRole === "advertiser"
                      ? "Masuk ke Dashboard Pengiklan"
                      : "Masuk ke Dashboard Mitra"}
                    <ArrowRight className="ml-2" size={18} />
                  </Button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

const RoleCard = ({
  icon,
  title,
  desc,
  selected,
  onClick,
  accentClass,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  selected: boolean;
  onClick: () => void;
  accentClass: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`text-left p-6 rounded-2xl border-2 transition-all duration-300 ${
      selected
        ? `${accentClass} shadow-md scale-[1.02]`
        : "border-border bg-card hover:border-muted-foreground/30 hover:shadow-sm"
    }`}
  >
    <div className="mb-3">{icon}</div>
    <h3 className="font-semibold text-foreground mb-1">{title}</h3>
    <p className="text-sm text-muted-foreground">{desc}</p>
  </button>
);

export default Onboarding;
