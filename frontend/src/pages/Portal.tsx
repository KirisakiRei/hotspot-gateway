import { PortalProvider, usePortal } from '@/contexts/PortalContext';
import { VideoScreen } from '@/components/portal/VideoScreen';
import { FormScreen } from '@/components/portal/FormScreen';
import { VoucherScreen } from '@/components/portal/VoucherScreen';
import { SuccessScreen } from '@/components/portal/SuccessScreen';
import { ConnectedScreen } from '@/components/portal/ConnectedScreen';
import { Loader2 } from 'lucide-react';

function PortalFlow() {
  const { state } = usePortal();

  // Show loading screen while checking session
  if (state.checkingSession) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-sm text-muted-foreground">Memeriksa koneksi...</p>
      </div>
    );
  }

  switch (state.currentStep) {
    case 'video':
      return <VideoScreen />;
    case 'form':
      return <FormScreen />;
    case 'voucher':
      return <VoucherScreen />;
    case 'success':
      return <SuccessScreen />;
    case 'connected':
      return <ConnectedScreen />;
    default:
      return <VideoScreen />;
  }
}

export default function Portal() {
  return (
    <PortalProvider>
      <div className="min-h-screen bg-background">
        <PortalFlow />
      </div>
    </PortalProvider>
  );
}
