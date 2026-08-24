import { Clock, ClipboardList, Wifi } from 'lucide-react';
import { usePortal } from '@/contexts/PortalContext';
import { PortalHeader } from './PortalHeader';

export function ChoiceScreen() {
  const { setStep, state } = usePortal();

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      <PortalHeader currentStep={2} totalSteps={3} />

      <div className="flex-1 px-6 flex flex-col justify-center pb-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-full mb-4">
            <Wifi className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            Pilih Akses Internet
          </h1>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Pilih salah satu cara untuk mendapatkan akses internet gratis.
          </p>
        </div>

        <div className="space-y-3">
          {/* Opsi 1: Konek 1 Jam */}
          <button
            onClick={() => setStep('connect', { accessType: 'free' })}
            disabled={state.loading}
            className="w-full rounded-2xl border border-border bg-card p-5 text-left hover:border-primary hover:bg-primary/5 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-base">Langsung Konek</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Akses internet selama 1 jam, langsung aktif tanpa isian tambahan.
                </p>
              </div>
            </div>
          </button>

          {/* Opsi 2: Isi Kuesioner → 1 Hari */}
          <button
            onClick={() => setStep('questionnaire')}
            disabled={state.loading}
            className="w-full rounded-2xl border border-border bg-card p-5 text-left hover:border-primary hover:bg-primary/5 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                <ClipboardList className="w-6 h-6 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground text-base">Isi Kuesioner</p>
                  <span className="text-xs font-medium bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full">
                    1 Hari
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Isi kuesioner singkat, dapatkan akses penuh selama 1 hari.
                </p>
              </div>
            </div>
          </button>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6">
          Perangkat: <span className="font-mono">{state.deviceInfo.mac || '-'}</span>
        </p>
      </div>
    </div>
  );
}
