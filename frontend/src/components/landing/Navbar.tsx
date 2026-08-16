import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const navLinks = [
  { label: "Beranda", href: "/", type: "route" as const },
  { label: "Layanan", href: "#layanan", type: "scroll" as const },
  { label: "Tentang Kami", href: "/about", type: "route" as const },
  { label: "Kontak", href: "/contact", type: "route" as const },
];

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-card/95 backdrop-blur-md shadow-sm border-b border-border"
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto flex items-center justify-between h-16 px-4 lg:px-8">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 group">
          <img
            src="/brand/logo.png"
            alt="Hotspot Portal"
            className="h-8 w-8 object-contain"
          />
          <img
            src="/brand/wordmark.png"
            alt="Hotspot Portal"
            className="h-6 object-contain hidden sm:block"
          />
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((l) =>
            l.type === "route" ? (
              <Link
                key={l.href}
                to={l.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {l.label}
              </Link>
            ) : (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {l.label}
              </a>
            )
          )}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" className="text-primary font-medium" asChild>
            <Link to="/login">Masuk</Link>
          </Button>
          <Button asChild>
            <Link to="/register">Daftar</Link>
          </Button>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 rounded-lg text-foreground hover:bg-muted transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden bg-card/98 backdrop-blur-md border-b border-border px-4 py-4 space-y-1">
          {navLinks.map((l) =>
            l.type === "route" ? (
              <Link
                key={l.href}
                to={l.href}
                className="block text-sm font-medium text-muted-foreground hover:text-foreground py-2.5 px-3 rounded-lg hover:bg-muted transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {l.label}
              </Link>
            ) : (
              <a
                key={l.href}
                href={l.href}
                className="block text-sm font-medium text-muted-foreground hover:text-foreground py-2.5 px-3 rounded-lg hover:bg-muted transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {l.label}
              </a>
            )
          )}
          <div className="flex gap-2 pt-3 border-t border-border mt-2">
            <Button variant="ghost" className="flex-1 text-primary" asChild>
              <Link to="/login" onClick={() => setMobileOpen(false)}>Masuk</Link>
            </Button>
            <Button className="flex-1" asChild>
              <Link to="/register" onClick={() => setMobileOpen(false)}>Daftar</Link>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
