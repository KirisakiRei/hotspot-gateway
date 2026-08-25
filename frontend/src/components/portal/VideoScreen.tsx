import { useState, useEffect, useRef } from 'react';
import { Play, Volume2, VolumeX, Loader2, AlertCircle, RefreshCw, Wifi } from 'lucide-react';
import { usePortal } from '@/contexts/PortalContext';

// Timeout maksimal buffering sebelum tombol darurat dibuka (5 detik)
const BUFFER_STALL_TIMEOUT_MS = 5000;
// Captive Network Assistant (browser popup WiFi Android/iOS) kadang tidak
// mengirim event `ended` walau video sudah selesai. Fallback ini mencegah
// portal terkunci selamanya pada perangkat tersebut.
const DEFAULT_AD_DURATION_SECONDS = 15;

export function VideoScreen() {
  const { state, trackAdView, trackAdComplete, loadAdvertisement, setStep } = usePortal();
  const { advertisement, loading, error } = state;

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [videoEnded, setVideoEnded] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [stallBypass, setStallBypass] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const stallTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasTrackedView = useRef(false);

  // Iklan TIDAK BISA di-skip: tombol hanya aktif ketika video selesai / error / stall
  const isUnlocked = videoEnded || !!videoError || stallBypass;
  const remaining = Math.max(0, Math.ceil(videoDuration - currentTime));
  const progress = videoDuration > 0 ? Math.min(100, (currentTime / videoDuration) * 100) : 0;

  const clearStallTimeout = () => {
    if (stallTimeoutRef.current) {
      clearTimeout(stallTimeoutRef.current);
      stallTimeoutRef.current = null;
    }
  };

  const clearCompletionFallback = () => {
    if (completionFallbackRef.current) {
      clearTimeout(completionFallbackRef.current);
      completionFallbackRef.current = null;
    }
  };

  const startStallTimeout = () => {
    clearStallTimeout();
    stallTimeoutRef.current = setTimeout(() => {
      setStallBypass(true);
    }, BUFFER_STALL_TIMEOUT_MS);
  };

  // Reset saat iklan berganti
  useEffect(() => {
    if (advertisement) {
      setVideoEnded(false);
      setVideoError(null);
      setStallBypass(false);
      setVideoDuration(advertisement.duration || 0);
      setCurrentTime(0);
      setIsBuffering(false);
      setIsPlaying(false);
      hasTrackedView.current = false;
      clearStallTimeout();

      // Jangan bergantung mutlak pada event video browser captive portal.
      const expectedDuration = Math.max(
        advertisement.duration || 0,
        DEFAULT_AD_DURATION_SECONDS,
      );
      completionFallbackRef.current = setTimeout(() => {
        setStallBypass(true);
      }, expectedDuration * 1000);
    }

    return clearCompletionFallback;
  }, [advertisement]);

  useEffect(() => {
    return () => {
      clearStallTimeout();
      clearCompletionFallback();
    };
  }, []);

  const handleLoadedMetadata = () => {
    const dur = videoRef.current?.duration;
    if (dur && Number.isFinite(dur) && dur > 0) {
      setVideoDuration(dur);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handlePlaying = () => {
    clearStallTimeout();
    setIsBuffering(false);
    setIsPlaying(true);
  };

  const handleWaiting = () => {
    if (videoEnded) return;
    setIsPlaying(false);
    setIsBuffering(true);
    startStallTimeout();
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleVideoEnded = () => {
    clearStallTimeout();
    clearCompletionFallback();
    setIsPlaying(false);
    setIsBuffering(false);
    setVideoEnded(true);
    setCurrentTime(videoDuration);
  };

  const handleVideoError = () => {
    clearStallTimeout();
    clearCompletionFallback();
    setIsPlaying(false);
    setIsBuffering(false);
    setVideoError('Video gagal diputar. Anda tetap dapat melanjutkan.');
  };

  const handlePlay = () => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        setVideoError('Autoplay tidak didukung. Anda tetap dapat melanjutkan.');
      });
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleContinue = () => {
    if (!isUnlocked) return;

    if (!hasTrackedView.current) {
      trackAdView();
      hasTrackedView.current = true;
    }

    if (videoEnded) {
      const watchTime = Math.round(videoRef.current?.currentTime || 0);
      trackAdComplete(watchTime);
    }

    // Flow baru: setelah iklan user harus memilih akses 1 jam atau kuesioner.
    setStep('choice');
  };

  const getVideoUrl = () => advertisement?.videoUrl || '';

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

  // Tidak ada iklan aktif / error API — tetap bisa lanjut
  if (!advertisement || error) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900 to-black flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">
            {error ? 'Gagal memuat iklan' : 'Tidak ada iklan tersedia'}
          </h2>
          <p className="text-gray-400 mb-6">
            {error || 'Anda tetap dapat terhubung ke internet gratis.'}
          </p>
          <button
            onClick={() => setStep('choice')}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2"
          >
            <Wifi className="w-5 h-5" />
            Pilih Akses Internet
          </button>
          {error && (
            <button
              onClick={loadAdvertisement}
              className="mt-3 w-full h-12 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Coba Lagi
            </button>
          )}
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
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
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

        {/* Kontrol atas: label iklan + countdown + Mute */}
        <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-20 gap-3">
          <div className="flex items-center gap-3">
            <span className="text-white/80 text-sm font-medium">Iklan</span>
            <span className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm">
              <span className="text-sm font-semibold text-white">
                {isUnlocked ? 'Selesai' : `Sisa ${remaining} dtk`}
              </span>
            </span>
          </div>
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
      </div>

      {/* Bagian Bawah: progress + tombol hubungkan */}
      <div className="bg-gradient-to-t from-black via-black/90 to-transparent pt-16 pb-8 px-6">
        <div className="h-1 bg-white/20 rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-primary transition-all duration-500 ease-linear rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        <button
          onClick={handleContinue}
          disabled={!isUnlocked}
          className={`w-full h-14 rounded-2xl text-base font-semibold transition-all flex items-center justify-center gap-2 ${
            isUnlocked
              ? 'bg-primary text-primary-foreground hover:opacity-90'
              : 'bg-white/20 text-white/60'
          }`}
        >
          {isUnlocked ? (
            <>
              <Wifi className="w-5 h-5" />
              Lanjutkan
            </>
          ) : (
            `Tonton video sampai selesai (${remaining} detik)`
          )}
        </button>
      </div>
    </div>
  );
}
