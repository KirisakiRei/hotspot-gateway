import { useState, useEffect, useRef } from 'react';
import { Play, Volume2, VolumeX, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { usePortal } from '@/contexts/PortalContext';

export function VideoScreen() {
  const { state, setStep, trackAdView, trackAdComplete, trackAdSkip, loadAdvertisement, checkSession } = usePortal();
  const { advertisement, loading, error } = state;
  const [checkingSession, setCheckingSession] = useState(false);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasTrackedView = useRef(false);

  const skipAfter = advertisement?.skipAfter || 5;
  const isSkipable = advertisement?.skipable || false;
  const canSkip = isSkipable && countdown <= 0;

  // Initialize countdown when advertisement loads
  useEffect(() => {
    if (advertisement) {
      setCountdown(skipAfter);
    }
  }, [advertisement, skipAfter]);

  useEffect(() => {
    if (isPlaying && countdown > 0) {
      intervalRef.current = setInterval(() => {
        setCountdown(prev => {
          const newValue = prev - 1;
          setProgress(((skipAfter - newValue) / skipAfter) * 100);
          return newValue;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, skipAfter]);

  useEffect(() => {
    if (countdown <= 0 && intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  }, [countdown]);

  const handlePlay = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVideoEnded = () => {
    setCountdown(0);
    // Don't track completion here, it will be tracked on handleNext
  };

  const handleNext = async () => {
    if (canSkip && !checkingSession) {
      // Track view when user clicks "Lanjutkan" - this means they saw the ad
      if (!hasTrackedView.current) {
        trackAdView();
        hasTrackedView.current = true;
      }
      
      // Track completion or skip based on video state
      if (videoRef.current && !videoRef.current.ended) {
        // Video didn't finish - track as skip
        trackAdSkip();
      } else {
        // Video finished or YouTube - track as completion
        trackAdComplete();
      }

      // Check if user already has active session (returning user)
      const mac = state.deviceInfo.mac;
      if (mac) {
        try {
          setCheckingSession(true);
          const sessionCache = localStorage.getItem('portal_session_cache');
          
          // Quick check from cache first
          if (sessionCache) {
            const cached = JSON.parse(sessionCache);
            const cacheAge = Date.now() - cached.timestamp;
            // Cache valid for 30 seconds
            if (cacheAge < 30000 && cached.active && cached.mac === mac) {
              console.log('✅ User has cached active session - skip to connected');
              setStep('connected');
              setCheckingSession(false);
              return;
            }
          }

          // Check with backend via Mikrotik active users
          await checkSession();
          
          // If checkSession updates state to 'connected', component will re-render
          // Otherwise continue to form
          setTimeout(() => {
            if (state.currentStep !== 'connected') {
              setStep('form');
            }
            setCheckingSession(false);
          }, 500);
        } catch (error) {
          console.error('Session check failed, continue to form:', error);
          setStep('form');
          setCheckingSession(false);
        }
      } else {
        // No MAC - proceed to form
        setStep('form');
      }
    }
  };

  const getVideoUrl = () => advertisement?.videoUrl || '';

  // Handle skip when no ad or error - go directly to form
  const handleSkipNoAd = () => {
    setStep('form');
  };

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Memuat iklan...</p>
        </div>
      </div>
    );
  }

  // No advertisement or error - show skip screen
  if (!advertisement || error) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900 to-black flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">
            {error ? 'Gagal memuat iklan' : 'Tidak ada iklan tersedia'}
          </h2>
          <p className="text-gray-400 mb-6">
            {error || 'Silakan lanjut untuk mendapatkan voucher WiFi gratis.'}
          </p>
          <div className="space-y-3">
            <button
              onClick={handleSkipNoAd}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-all"
            >
              Lanjutkan
            </button>
            {error && (
              <button
                onClick={loadAdvertisement}
                className="w-full h-12 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Coba Lagi
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col animate-fade-in">
      <div className="flex-1 relative overflow-hidden">
        <>
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              muted={isMuted}
              playsInline
              autoPlay
              controls={false}
              controlsList="nodownload nofullscreen noremoteplayback"
              disablePictureInPicture
              onEnded={handleVideoEnded}
              onContextMenu={(e) => e.preventDefault()}
              onLoadedData={(e) => {
                const video = e.currentTarget;
                video.play().then(() => {
                  setIsPlaying(true);
                }).catch(() => {
                  setIsPlaying(false);
                });
              }}
            >
              <source src={getVideoUrl()} type="video/mp4" />
            </video>
            {isPlaying && (
              <div 
                className="absolute inset-0 z-10" 
                style={{ backgroundColor: 'transparent' }}
                onClick={(e) => e.preventDefault()}
                onContextMenu={(e) => e.preventDefault()}
              />
            )}
            {!isPlaying && (
              <button
                onClick={handlePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity z-20"
              >
                <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center shadow-2xl">
                  <Play className="w-9 h-9 text-primary-foreground ml-1" fill="currentColor" />
                </div>
              </button>
            )}
          </>

        {isPlaying && (
          <>
            {/* Countdown Badge */}
            {countdown > 0 && isSkipable && (
              <div className="absolute top-6 right-6 px-4 py-2 rounded-full bg-black/60 backdrop-blur-sm z-20">
                <span className="text-base font-medium text-white">
                  Skip in {countdown}s
                </span>
              </div>
            )}

            {/* Title & Mute */}
            <div className="absolute top-6 left-6 flex items-center gap-3 z-20">
              <span className="text-white/80 text-sm font-medium">Iklan</span>
              <button
                onClick={toggleMute}
                className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center transition-colors hover:bg-black/60"
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5 text-white" />
                ) : (
                  <Volume2 className="w-5 h-5 text-white" />
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Bottom Section - Fixed */}
      <div className="bg-gradient-to-t from-black via-black/90 to-transparent pt-16 pb-8 px-6">
        {/* Progress Bar */}
        <div className="h-1 bg-white/20 rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-primary transition-all duration-1000 ease-linear rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Action Button */}
        <button
          onClick={handleNext}
          disabled={!canSkip || checkingSession}
          className={`w-full h-14 rounded-2xl text-base font-semibold transition-all flex items-center justify-center gap-2 ${
            canSkip && !checkingSession
              ? 'bg-primary text-primary-foreground hover:opacity-90'
              : 'bg-white/20 text-white/60'
          }`}
        >
          {checkingSession ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Memeriksa...
            </>
          ) : canSkip ? 'Lanjutkan' : `Tunggu ${countdown} detik`}
        </button>
      </div>
    </div>
  );
}
