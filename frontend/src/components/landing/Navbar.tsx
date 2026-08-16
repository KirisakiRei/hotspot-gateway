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

const Logo = ({ className = "" }: { className?: string }) => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Outer arc */}
    <path
      d="M4 16C4 9.373 9.373 4 16 4s12 5.373 12 12"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className="text-primary"
    />
    {/* Mid arc */}
    <path
      d="M8 16c0-4.418 3.582-8 8-8s8 3.582 8 8"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className="text-primary"
      opacity="0.7"
    />
    {/* Inner arc */}
    <path
      d="M12 16c0-2.21 1.79-4 4-4s4 1.79 4 4"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className="text-primary"
      opacity="0.4"
    />
    {/* Center dot */}
    <circle cx="16" cy="24" r="2.5" fill="currentColor" className="text-primary" />
  </svg>
);

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
          <Logo />
          <span className="text-lg font-extrabold tracking-tight text-foreground">
            Hotspot <span className="text-primary">Portal</span>
          </span>
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
