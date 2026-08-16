interface PortalHeaderProps {
  showProgress?: boolean;
  currentStep?: number;
  totalSteps?: number;
}

export function PortalHeader({ showProgress = true, currentStep = 1, totalSteps = 4 }: PortalHeaderProps) {
  return (
    <header className="px-6 pt-6 pb-4">
      <div className="flex items-center justify-center mb-4">
        <img
          src="/brand/logo.png"
          alt="Hotspot Portal"
          className="h-12 w-12 object-contain"
        />
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
