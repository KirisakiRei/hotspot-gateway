import { Wifi, Twitter, Linkedin, Instagram } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => (
  <footer className="bg-slate-matte-950 text-slate-matte-300 pt-16 pb-8">
    <div className="container mx-auto px-4 lg:px-8">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
        <div className="lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <Wifi className="text-primary" size={22} />
            <span className="text-lg font-bold text-slate-matte-50">Hotspot Portal</span>
          </div>
          <p className="text-sm leading-relaxed">
            Platform periklanan WiFi #1 di Indonesia. Monetisasi jaringan hotspot, jangkau audiens lokal.
          </p>
        </div>

        <FooterCol title="Produk" links={[
          { label: "Fitur", href: "/#fitur" },
          { label: "Pengiklan", href: "/advertiser" },
          { label: "Mitra", href: "/mitra" },
        ]} />
        <FooterCol title="Perusahaan" links={[
          { label: "Tentang Kami", href: "/about" },
          { label: "Kontak", href: "/contact" },
        ]} />
        <FooterCol title="Legal" links={[
          { label: "Privasi", href: "#" },
          { label: "Ketentuan Layanan", href: "#" },
        ]} />
      </div>

      <div className="border-t border-slate-matte-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs text-slate-matte-500">
          © 2026 Hotspot Portal. All rights reserved.
        </p>
        <div className="flex gap-4">
          {[
            { icon: Twitter, label: "Twitter" },
            { icon: Linkedin, label: "LinkedIn" },
            { icon: Instagram, label: "Instagram" },
          ].map((s) => (
            <a key={s.label} href="#" className="text-slate-matte-500 hover:text-slate-matte-200 transition-colors" aria-label={s.label}>
              <s.icon size={18} />
            </a>
          ))}
        </div>
      </div>
    </div>
  </footer>
);

const FooterCol = ({ title, links }: { title: string; links: { label: string; href: string }[] }) => (
  <div>
    <h4 className="font-semibold text-slate-matte-50 mb-4">{title}</h4>
    <ul className="space-y-2">
      {links.map((l) => (
        <li key={l.label}>
          {l.href.startsWith("/") ? (
            <Link to={l.href} className="text-sm hover:text-slate-matte-100 transition-colors">
              {l.label}
            </Link>
          ) : (
            <a href={l.href} className="text-sm hover:text-slate-matte-100 transition-colors">
              {l.label}
            </a>
          )}
        </li>
      ))}
    </ul>
  </div>
);

export default Footer;
