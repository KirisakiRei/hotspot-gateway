import { PortalProvider, usePortal } from '@/contexts/PortalContext';
import { VideoScreen } from '@/components/portal/VideoScreen';
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
    case 'connected':
      return <ConnectedScreen />;
    case 'video':
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