import { useMemo } from 'react';
import { Smartphone } from 'lucide-react';

function isAppleDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function IosResumeHint({ context }: { context: 'form' | 'voucher' }) {
  const visible = useMemo(isAppleDevice, []);
  if (!visible) return null;

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-left">
      <div className="flex items-start gap-2">
        <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-100">
          {context === 'form' ? (
            <>
              iPhone: setelah menekan kirim, buka WhatsApp untuk menerima kode.
              Kembali ke halaman WiFi ini — progres Anda tersimpan, tidak perlu isi ulang.
            </>
          ) : (
            <>
              iPhone: buka WhatsApp, salin kode 6 digit, lalu kembali ke halaman ini
              dan tempel kodenya. Jangan matikan WiFi.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
