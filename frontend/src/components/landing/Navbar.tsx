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
        <Link to="/" className="text-xl font-extrabold tracking-tight text-foreground">
          Hotspot <span className="text-primary">Portal</span>
        </Link>

        {/* Desktop */}
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

        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" className="text-primary font-medium" asChild>
            <Link to="/login">Masuk</Link>
          </Button>
          <Button asChild>
            <Link to="/register">Daftar</Link>
          </Button>
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-card border-b border-border px-4 pb-4 space-y-3">
          {navLinks.map((l) =>
            l.type === "route" ? (
              <Link
                key={l.href}
                to={l.href}
                className="block text-sm font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setMobileOpen(false)}
              >
                {l.label}
              </Link>
            ) : (
              <a
                key={l.href}
                href={l.href}
                className="block text-sm font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setMobileOpen(false)}
              >
                {l.label}
              </a>
            )
          )}
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" className="text-primary" asChild>
              <Link to="/login">Masuk</Link>
            </Button>
            <Button asChild>
              <Link to="/register">Daftar</Link>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
