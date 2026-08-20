import { useEffect, useState } from 'react';
import { Wifi, Clock, TrendingUp, TrendingDown, LogOut, Loader2, RefreshCw } from 'lucide-react';
import { usePortal } from '@/contexts/PortalContext';
import { PortalHeader } from './PortalHeader';

export function ConnectedScreen() {
  const { state, disconnectSession, checkSession } = usePortal();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-refresh session info every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      handleRefresh();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await checkSession();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleDisconnect = async () => {
    if (confirm('Yakin ingin disconnect dari internet?')) {
      await disconnectSession();
    }
  };

  const formatBytes = (bytes: string) => {
    const value = parseInt(bytes || '0');
    if (value >= 1073741824) return `${(value / 1073741824).toFixed(2)} GB`;
    if (value >= 1048576) return `${(value / 1048576).toFixed(2)} MB`;
    if (value >= 1024) return `${(value / 1024).toFixed(2)} KB`;
    return `${value} B`;
  };

  const formatSpeed = (kbps: number) => {
    if (kbps >= 1024) return `${(kbps / 1024).toFixed(0)} Mbps`;
    return `${kbps} Kbps`;
  };

  const formatDuration = (minutes: number) => {
    if (minutes >= 1440) return `${Math.floor(minutes / 1440)} Hari`;
    if (minutes >= 60) return `${Math.floor(minutes / 60)} Jam`;
    return `${minutes} Menit`;
  };

  const formatUptime = (uptime: string) => {
    // Uptime format from Mikrotik: "1h2m3s" or "2d3h4m"
    return uptime || '0s';
  };

  const calculateTimeRemaining = () => {
    if (!state.session?.expiresAt) return '-';
    
    const now = new Date();
    const expires = new Date(state.session.expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return 'Habis';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // Handle case where session info is minimal (from Mikrotik redirect)
  if (!state.session) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Safe access to profile - may not exist if redirected directly from Mikrotik
  const profile = state.session.voucher?.profile || {
    name: 'WiFi Hotspot',
    duration: 0,
    uploadSpeed: 0,
    downloadSpeed: 0,
  };

  const hasDetailedInfo = !!state.session.voucher?.profile;

  return (
    <div className="fixed inset-0 bg-background flex flex-col animate-fade-in">
      <PortalHeader currentStep={3} totalSteps={3} />
      
      <div className="flex-1 px-6 flex flex-col overflow-y-auto pb-6">
        {/* Success Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-success/10 rounded-full mb-3">
            <Wifi className="w-8 h-8 text-success" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-1">
            Terhubung ke Internet
          </h1>
          <p className="text-sm text-muted-foreground">
            Anda sudah online dan dapat mengakses internet
          </p>
        </div>

        {/* Session Info Cards */}
        <div className="space-y-3 mb-6">
          {/* Profile Info - Only show if we have detailed info */}
          {hasDetailedInfo ? (
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">Paket Internet</span>
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <p className="text-lg font-semibold text-foreground mb-1">{profile.name}</p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatDuration(profile.duration)}
                </span>
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  {formatSpeed(profile.uploadSpeed)}
                </span>
                <span className="flex items-center gap-1">
                  <TrendingDown className="w-4 h-4" />
                  {formatSpeed(profile.downloadSpeed)}
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">Status</span>
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <p className="text-lg font-semibold text-success">✓ Terhubung ke Internet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Klik refresh untuk melihat detail koneksi
              </p>
            </div>
          )}

          {/* Connection Status */}
          <div className="bg-card rounded-xl p-4 border border-border">
            <h3 className="text-sm font-medium text-foreground mb-3">Status Koneksi</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">IP Address</span>
                <span className="font-medium text-foreground">{state.session.ip}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">MAC Address</span>
                <span className="font-mono text-xs font-medium text-foreground">{state.session.mac}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Waktu Online</span>
                <span className="font-medium text-foreground">{formatUptime(state.session.uptime)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sisa Waktu</span>
                <span className="font-medium text-foreground">{calculateTimeRemaining()}</span>
              </div>
            </div>
          </div>

          {/* Usage Stats */}
          <div className="bg-card rounded-xl p-4 border border-border">
            <h3 className="text-sm font-medium text-foreground mb-3">Penggunaan Data</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  Upload
                </span>
                <span className="font-medium text-foreground">{formatBytes(state.session.bytesOut)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <TrendingDown className="w-4 h-4" />
                  Download
                </span>
                <span className="font-medium text-foreground">{formatBytes(state.session.bytesIn)}</span>
              </div>
              <div className="pt-2 border-t border-border">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-foreground">Total</span>
                  <span className="font-semibold text-foreground">
                    {formatBytes((parseInt(state.session.bytesIn) + parseInt(state.session.bytesOut)).toString())}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-muted/30 rounded-xl p-4 mb-6">
          <p className="text-sm text-muted-foreground text-center">
            Halaman ini bisa tetap terbuka selama Anda terhubung ke internet.
            Silakan minimize dan buka tab baru untuk browsing.
          </p>
        </div>

        {/* Spacer */}
        <div className="flex-1 min-h-4" />

        {/* Disconnect Button */}
        <div className="space-y-3">
          <button
            onClick={handleDisconnect}
            disabled={state.loading}
            className="btn-secondary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state.loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Disconnecting...
              </>
            ) : (
              <>
                <LogOut className="w-5 h-5" />
                Disconnect
              </>
            )}
          </button>

          {/* Continue Browsing */}
          {state.deviceInfo.linkOrig && (
            <a
              href={state.deviceInfo.linkOrig}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              Lanjut Browsing
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
