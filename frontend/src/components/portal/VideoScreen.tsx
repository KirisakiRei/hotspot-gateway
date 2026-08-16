import { useState, useEffect, useRef } from 'react';
import { Play, Volume2, VolumeX, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { usePortal } from '@/contexts/PortalContext';

// Timeout maksimal buffering sebelum tombol lewati darurat dibuka (12 detik)
const BUFFER_STALL_TIMEOUT_MS = 12000;

export function VideoScreen() {
  const { state, setStep, trackAdView, trackAdComplete, trackAdSkip, loadAdvertisement, checkSession } = usePortal();
  const { advertisement, loading, error } = state;
  const [checkingSession, setCheckingSession] = useState(false);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [videoEnded, setVideoEnded] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [stallBypass, setStallBypass] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [progress, setProgress] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stallTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasTrackedView = useRef(false);

  const skipAfter = advertisement?.skipAfter || 5;
  const isSkipable = advertisement?.skipable ?? true;

  // Tombol terbuka bila hitungan selesai (pada skipable) ATAU video tamat ATAU error ATAU buffer stall
  const forceUnlocked = videoEnded || !!videoError || stallBypass;
  const canSkip = (isSkipable && countdown <= 0) || forceUnlocked;

  const clearStallTimeout = () => {
    if (stallTimeoutRef.current) {
      clearTimeout(stallTimeoutRef.current);
      stallTimeoutRef.current = null;
    }
  };

  const startStallTimeout = () => {
    clearStallTimeout();
    stallTimeoutRef.current = setTimeout(() => {
      setStallBypass(true);
      setCountdown(0);
    }, BUFFER_STALL_TIMEOUT_MS);
  };

  // Inisialisasi countdown saat iklan termuat
  useEffect(() => {
    if (advertisement) {
      setCountdown(skipAfter);
      setProgress(0);
      setVideoEnded(false);
      setVideoError(null);
      setStallBypass(false);
      setIsBuffering(false);
      setIsPlaying(false);
      clearStallTimeout();
    }
  }, [advertisement, skipAfter]);

  // Interval timer — HANYA jalan saat video benar-benar memutar dan tidak sedang buffering
  useEffect(() => {
    if (isPlaying && !isBuffering && countdown > 0) {
      intervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          const next = prev - 1;
          const calculatedProgress = skipAfter > 0 ? ((skipAfter - next) / skipAfter) * 100 : 100;
          setProgress(Math.min(100, Math.max(0, calculatedProgress)));
          return next;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, isBuffering, skipAfter]);

  useEffect(() => {
    if (countdown <= 0 && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [countdown]);

  useEffect(() => {
    return () => {
      clearStallTimeout();
    };
  }, []);

  const handlePlaying = () => {
    clearStallTimeout();
    setIsBuffering(false);
    setIsPlaying(true);
  };

  const handleWaiting = () => {
    setIsPlaying(false);
    setIsBuffering(true);
    startStallTimeout();
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleVideoEnded = () => {
    clearStallTimeout();
    setIsPlaying(false);
    setIsBuffering(false);
    setVideoEnded(true);
    setCountdown(0);
  };

  const handleVideoError = () => {
    clearStallTimeout();
    setIsPlaying(false);
    setIsBuffering(false);
    setVideoError('Video gagal diputar. Silakan lanjutkan.');
    setCountdown(0);
  };

  const handlePlay = () => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        setVideoError('Autoplay tidak didukung. Silakan lanjutkan.');
        setCountdown(0);
      });
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleNext = async () => {
    if (canSkip && !checkingSession) {
      if (!hasTrackedView.current) {
        trackAdView();
        hasTrackedView.current = true;
      }

      if (videoRef.current && !videoRef.current.ended && !videoEnded) {
        trackAdSkip();
      } else {
        const watchTime = Math.round(videoRef.current?.currentTime || 0);
        trackAdComplete(watchTime);
      }

      const mac = state.deviceInfo.mac;
      if (mac) {
        try {
          setCheckingSession(true);
          const sessionCache = localStorage.getItem('portal_session_cache');

          if (sessionCache) {
            const cached = JSON.parse(sessionCache);
            const cacheAge = Date.now() - cached.timestamp;
            if (cacheAge < 30000 && cached.active && cached.mac === mac) {
              setStep('connected');
              setCheckingSession(false);
              return;
            }
          }

          await checkSession();

          setTimeout(() => {
            if (state.currentStep !== 'connected') {
              setStep('form');
            }
            setCheckingSession(false);
          }, 500);
        } catch {
          setStep('form');
          setCheckingSession(false);
        }
      } else {
        setStep('form');
      }
    }
  };

  const getVideoUrl = () => advertisement?.videoUrl || '';

  const handleSkipNoAd = () => {
    setStep('form');
  };

  // Loading state dari API
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

  // Tidak ada iklan aktif atau error API
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
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          muted={isMuted}
          playsInline
          autoPlay
          controls={false}
          controlsList="nodownload nofullscreen noremoteplayback"
          disablePictureInPicture
          poster={advertisement.thumbnailUrl || undefined}
          onPlaying={handlePlaying}
          onWaiting={handleWaiting}
          onStalled={handleWaiting}
          onPause={handlePause}
          onEnded={handleVideoEnded}
          onError={handleVideoError}
          onContextMenu={(e) => e.preventDefault()}
        >
          <source src={getVideoUrl()} />
        </video>

        {/* Indikator Buffering */}
        {isBuffering && !videoError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 gap-3">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-white text-sm font-medium">Memuat video...</p>
          </div>
        )}

        {/* Indikator Error Video */}
        {videoError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/75 gap-3 p-6 text-center">
            <AlertCircle className="w-12 h-12 text-yellow-500" />
            <p className="text-white text-sm font-medium">{videoError}</p>
          </div>
        )}

        {/* Tombol Play Manual jika Autoplay Ditolak */}
        {!isPlaying && !isBuffering && !videoError && !videoEnded && (
          <button
            onClick={handlePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity z-20"
            aria-label="Putar video"
          >
            <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center shadow-2xl">
              <Play className="w-9 h-9 text-primary-foreground ml-1" fill="currentColor" />
            </div>
          </button>
        )}

        {/* Header Iklan & Kontrol */}
        {isPlaying && (
          <>
            {countdown > 0 && isSkipable && (
              <div className="absolute top-6 right-6 px-4 py-2 rounded-full bg-black/60 backdrop-blur-sm z-20">
                <span className="text-base font-medium text-white">
                  Skip dalam {countdown} detik
                </span>
              </div>
            )}

            <div className="absolute top-6 left-6 flex items-center gap-3 z-20">
              <span className="text-white/80 text-sm font-medium">Iklan</span>
              <button
                onClick={toggleMute}
                className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center transition-colors hover:bg-black/60"
                aria-label={isMuted ? 'Nyalakan suara' : 'Bisukan suara'}
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

        {isBuffering && !videoError && countdown > 0 && (
          <div className="absolute top-6 right-6 px-4 py-2 rounded-full bg-black/60 backdrop-blur-sm z-20">
            <span className="text-sm font-medium text-white/80">Buffering...</span>
          </div>
        )}
      </div>

      {/* Bagian Bawah */}
      <div className="bg-gradient-to-t from-black via-black/90 to-transparent pt-16 pb-8 px-6">
        <div className="h-1 bg-white/20 rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-primary transition-all duration-1000 ease-linear rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

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
          ) : canSkip ? (
            stallBypass ? 'Lanjutkan (Koneksi Lambat)' : 'Lanjutkan'
          ) : (
            `Tunggu ${countdown} detik`
          )}
        </button>
      </div>
    </div>
  );
}
