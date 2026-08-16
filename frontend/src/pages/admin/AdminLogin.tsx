import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wifi, Eye, EyeOff, Lock, User, Loader2 } from 'lucide-react';
import { authApi } from '@/services/api';
import { getErrorMessage } from '@/lib/error';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await authApi.login({ email, password });
      
      // Store tokens
      localStorage.setItem('access_token', response.data.data!.accessToken);
      localStorage.setItem('refresh_token', response.data.data!.refreshToken);
      localStorage.setItem('admin_user', JSON.stringify(response.data.data!.admin));
      
      // Navigate to admin panel
      navigate('/admin');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Login gagal. Periksa email dan password Anda.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 relative overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-primary/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-1/4 w-32 h-32 bg-primary/8 rounded-2xl rotate-12" />
        <div className="absolute top-1/4 right-8 w-16 h-16 bg-primary/10 rounded-xl -rotate-6" />

        <div className="w-full max-w-md relative z-10 animate-fade-in">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <Wifi className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Admin Panel</h1>
              <p className="text-sm text-muted-foreground">HotSpot Portal</p>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-3xl shadow-elevated p-8 relative overflow-hidden">
            {/* Geometric accent */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full" />
            <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-primary/5 rounded-2xl rotate-12" />

            <div className="relative z-10">
              <h2 className="text-2xl font-bold text-foreground mb-2">Selamat Datang</h2>
              <p className="text-muted-foreground mb-6">Masuk ke dashboard admin</p>

              {error && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-xl mb-4 animate-fade-in">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <User className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@hotspot.local"
                      className="w-full h-12 pl-12 pr-4 rounded-xl bg-secondary border-0 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan password"
                      className="w-full h-12 pl-12 pr-12 rounded-xl bg-secondary border-0 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />
                    <span className="text-muted-foreground">Ingat saya</span>
                  </label>
                  <button type="button" className="text-primary font-medium hover:underline">
                    Lupa password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    'Masuk'
                  )}
                </button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Demo: <span className="font-mono text-primary">admin@hotspot.local</span> / <span className="font-mono text-primary">admin123</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Branding */}
      <div className="hidden lg:flex flex-1 bg-primary relative overflow-hidden items-center justify-center">
        {/* Geometric patterns */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-40 h-40 border-2 border-white/20 rounded-3xl rotate-12" />
          <div className="absolute top-40 right-32 w-24 h-24 border-2 border-white/15 rounded-2xl -rotate-6" />
          <div className="absolute bottom-32 left-32 w-32 h-32 border-2 border-white/10 rounded-full" />
          <div className="absolute bottom-20 right-20 w-48 h-48 border-2 border-white/20 rounded-3xl rotate-45" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-white/10 rounded-full" />
          
          {/* Solid shapes */}
          <div className="absolute top-32 right-16 w-16 h-16 bg-white/10 rounded-2xl rotate-12" />
          <div className="absolute bottom-40 left-16 w-12 h-12 bg-white/10 rounded-xl -rotate-12" />
          <div className="absolute top-1/4 left-1/4 w-8 h-8 bg-white/15 rounded-lg" />
          <div className="absolute bottom-1/4 right-1/4 w-10 h-10 bg-white/10 rounded-full" />
          
          {/* Dots */}
          <div className="absolute top-16 left-1/2 w-3 h-3 bg-white/20 rounded-full" />
          <div className="absolute bottom-16 right-1/2 w-2 h-2 bg-white/30 rounded-full" />
          <div className="absolute top-1/2 right-16 w-2 h-2 bg-white/25 rounded-full" />
        </div>

        {/* Content */}
        <div className="relative z-10 text-center px-12 animate-fade-in">
          <div className="w-24 h-24 rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-8">
            <Wifi className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-4xl font-bold text-white mb-4">
            HotSpot Portal
          </h2>
          <p className="text-xl text-white/80 max-w-md mx-auto">
            Kelola WiFi publik dengan mudah, pantau pengguna, dan generate voucher dalam satu dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
