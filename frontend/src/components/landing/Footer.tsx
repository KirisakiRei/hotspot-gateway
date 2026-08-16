import { Link } from "react-router-dom";
import { Twitter, Linkedin, Instagram } from "lucide-react";

const Footer = () => (
  <footer className="bg-slate-matte-950 text-slate-matte-300 pt-14 pb-8">
    <div className="container mx-auto px-4 lg:px-8">

      {/* Top grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-10">

        {/* Brand col — full width on mobile */}
        <div className="col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 mb-3">
            <img
              src="/brand/logo.png"
              alt="Hotspot Portal"
              className="h-7 w-7 object-contain"
            />
            <img
              src="/brand/wordmark.png"
              alt="Hotspot Portal"
              className="h-5 object-contain"
            />
          </div>
          <p className="text-sm leading-relaxed text-slate-matte-400 max-w-[260px]">
            Platform captive portal WiFi untuk monetisasi jaringan dan iklan digital lokal.
          </p>
          {/* Rekavia credit */}
          <p className="mt-4 text-xs text-slate-matte-500">
            by{" "}
            <a
              href="https://rekavia.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 transition-colors font-medium"
            >
              Rekavia
            </a>
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

      {/* Bottom bar */}
      <div className="border-t border-slate-matte-800 pt-5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-slate-matte-500 text-center sm:text-left">
          © 2026 Hotspot Portal by{" "}
          <a
            href="https://rekavia.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary/80 transition-colors"
          >
            Rekavia
          </a>
          . All rights reserved.
        </p>
        <div className="flex gap-4">
          {[
            { icon: Twitter, label: "Twitter", href: "#" },
            { icon: Linkedin, label: "LinkedIn", href: "#" },
            { icon: Instagram, label: "Instagram", href: "#" },
          ].map((s) => (
            <a
              key={s.label}
              href={s.href}
              className="text-slate-matte-500 hover:text-slate-matte-200 transition-colors"
              aria-label={s.label}
            >
              <s.icon size={17} />
            </a>
          ))}
        </div>
      </div>

    </div>
  </footer>
);

const FooterCol = ({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) => (
  <div>
    <h4 className="font-semibold text-slate-matte-100 mb-3 text-sm">{title}</h4>
    <ul className="space-y-2">
      {links.map((l) => (
        <li key={l.label}>
          {l.href.startsWith("/") ? (
            <Link
              to={l.href}
              className="text-sm text-slate-matte-400 hover:text-slate-matte-100 transition-colors"
            >
              {l.label}
            </Link>
          ) : (
            <a
              href={l.href}
              className="text-sm text-slate-matte-400 hover:text-slate-matte-100 transition-colors"
            >
              {l.label}
            </a>
          )}
        </li>
      ))}
    </ul>
  </div>
);

export default Footer;
