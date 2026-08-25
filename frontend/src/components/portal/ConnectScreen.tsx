import { Wifi, Loader2, ShieldCheck } from 'lucide-react';
import { usePortal } from '@/contexts/PortalContext';
import { PortalHeader } from './PortalHeader';

export function ConnectScreen() {
  const { state, claimFreeAccess } = usePortal();

  const handleConnect = async () => {
    if (state.loading) return;
    await claimFreeAccess();
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      <PortalHeader currentStep={2} totalSteps={3} />

      <div className="flex-1 px-6 flex flex-col justify-center pb-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-full mb-4">
            <Wifi className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            Siap Terhubung!
          </h1>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Pilihan akses Anda siap diaktifkan. Klik tombol di bawah untuk terhubung ke internet.
          </p>
          {state.error && (
            <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Login router ditolak: {state.error}
            </p>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-4 mb-8 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Perangkat</span>
            <span className="font-mono text-xs font-medium text-foreground truncate max-w-[160px]">
              {state.deviceInfo.mac || '-'}
            </span>
          </div>
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">IP Address</span>
            <span className="font-medium text-foreground">
              {state.deviceInfo.ip || '-'}
            </span>
          </div>
        </div>

        <button
          onClick={handleConnect}
          disabled={state.loading}
          className={`w-full h-14 rounded-2xl text-base font-semibold transition-all flex items-center justify-center gap-2 ${
            state.loading
              ? 'bg-primary/60 text-primary-foreground cursor-not-allowed'
              : 'bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]'
          }`}
        >
          {state.loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Menghubungkan...
            </>
          ) : (
            <>
              <Wifi className="w-5 h-5" />
              Hubungkan ke Internet
            </>
          )}
        </button>

        <div className="flex items-center justify-center gap-1.5 mt-4">
          <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground text-center">
            Koneksi aman &amp; terenkripsi
          </p>
        </div>
      </div>
    </div>
  );
}
