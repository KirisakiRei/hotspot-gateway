import { Wifi } from 'lucide-react';

interface PortalHeaderProps {
  showProgress?: boolean;
  currentStep?: number;
  totalSteps?: number;
}

export function PortalHeader({ showProgress = true, currentStep = 1, totalSteps = 4 }: PortalHeaderProps) {
  return (
    <header className="px-6 pt-6 pb-4">
      <div className="flex items-center justify-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <Wifi className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="text-lg font-semibold text-foreground">HotSpot</span>
      </div>
      
      {showProgress && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalSteps }).map((_, index) => (
            <div
              key={index}
              className={`h-1 rounded-full transition-all duration-300 ${
                index < currentStep
                  ? 'w-8 bg-primary'
                  : 'w-4 bg-border'
              }`}
            />
          ))}
        </div>
      )}
    </header>
  );
}
