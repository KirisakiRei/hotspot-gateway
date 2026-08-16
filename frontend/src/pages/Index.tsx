import { Link } from 'react-router-dom';
import { Smartphone } from 'lucide-react';

const Index = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Geometric Background Ornaments */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Large circle top right */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/5" />
        
        {/* Medium circle bottom left */}
        <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-primary/8" />
        
        {/* Small decorative shapes */}
        <div className="absolute top-1/4 left-10 w-16 h-16 rounded-2xl bg-primary/10 rotate-12" />
        <div className="absolute top-1/3 right-20 w-12 h-12 rounded-xl bg-primary/6 -rotate-6" />
        <div className="absolute bottom-1/4 right-1/4 w-20 h-20 rounded-full bg-primary/5" />
        <div className="absolute bottom-1/3 left-1/4 w-8 h-8 rounded-lg bg-primary/10 rotate-45" />
        
        {/* Lines/bars */}
        <div className="absolute top-20 left-1/3 w-32 h-1 bg-primary/10 rounded-full rotate-12" />
        <div className="absolute bottom-32 right-1/3 w-24 h-1 bg-primary/8 rounded-full -rotate-6" />
        
        {/* Dots */}
        <div className="absolute top-1/2 left-8 w-3 h-3 rounded-full bg-primary/20" />
        <div className="absolute top-40 right-12 w-2 h-2 rounded-full bg-primary/15" />
        <div className="absolute bottom-48 left-20 w-2 h-2 rounded-full bg-primary/20" />
      </div>

      {/* Header */}
      <header className="p-6 flex items-center justify-center relative z-10">
        <img
          src="/brand/logo.png"
          alt="Hotspot Portal"
          className="h-12 w-12 object-contain"
        />
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center p-6 relative z-10">
        <div className="max-w-md text-center animate-fade-in">
          <div className="mx-auto mb-8 relative inline-flex items-center justify-center">
            <img src="/brand/logo.png" alt="" className="h-24 w-24 object-contain" />
            <div className="absolute inset-0 rounded-3xl border-2 border-primary/20 animate-ping" style={{ animationDuration: '2s' }} />
          </div>
          
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Selamat Datang
          </h1>
          <p className="text-lg text-muted-foreground mb-10 max-w-sm mx-auto">
            Nikmati akses internet gratis dengan mudah dan cepat
          </p>

          <Link 
            to="/portal"
            className="btn-primary inline-flex items-center justify-center gap-3 text-lg px-8 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all"
          >
            <Smartphone className="w-6 h-6" />
            Mulai Sekarang
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center relative z-10">
        <p className="text-sm text-muted-foreground">
          © 2026 Hotspot Portal
        </p>
      </footer>
    </div>
  );
};

export default Index;
