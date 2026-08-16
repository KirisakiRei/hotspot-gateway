import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { advertisementApi, voucherApi, type Advertisement, type Voucher, type SessionInfo, handleApiError } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

export type PortalStep = 'video' | 'form' | 'voucher' | 'success' | 'connected';

interface DeviceInfo {
  mac: string;
  ip: string;
  linkLogin: string;
  linkLoginOnly: string;
  linkOrig: string;
  error: string;
}

interface PortalState {
  currentStep: PortalStep;
  phoneNumber: string;
  email: string;
  voucherCode: string;
  agreedToTerms: boolean;
  advertisement: Advertisement | null;
  voucher: Voucher | null;
  session: SessionInfo | null;
  loading: boolean;
  error: string | null;
  deviceInfo: DeviceInfo;
  checkingSession: boolean;
}

interface PortalProgress {
  mac: string;
  phoneNumber: string;
  email: string;
  agreedToTerms: boolean;
  step: PortalStep;
  updatedAt: number;
}

const PORTAL_PROGRESS_KEY = 'portal_progress';
const PROGRESS_TTL_MS = 2 * 60 * 60 * 1000;

const readProgress = (mac: string): PortalProgress | null => {
  try {
    const raw = localStorage.getItem(PORTAL_PROGRESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PortalProgress;
    if (!parsed.mac || parsed.mac !== mac) return null;
    if (Date.now() - parsed.updatedAt > PROGRESS_TTL_MS) return null;
    if (parsed.step !== 'form' && parsed.step !== 'voucher') return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeProgress = (progress: Omit<PortalProgress, 'updatedAt'>) => {
  try {
    localStorage.setItem(PORTAL_PROGRESS_KEY, JSON.stringify({
      ...progress,
      updatedAt: Date.now(),
    }));
  } catch {
    // Safari private / CNA storage may reject writes
  }
};

const clearProgress = () => {
  localStorage.removeItem(PORTAL_PROGRESS_KEY);
};

interface PortalContextType {
  state: PortalState;
  setStep: (step: PortalStep) => void;
  setPhoneNumber: (phone: string) => void;
  setEmail: (email: string) => void;
  setVoucherCode: (code: string) => void;
  setAgreedToTerms: (agreed: boolean) => void;
  loadAdvertisement: () => Promise<void>;
  trackAdView: () => Promise<void>;
  trackAdComplete: () => Promise<void>;
  trackAdSkip: () => Promise<void>;
  requestVoucher: () => Promise<void>;
  resendVoucher: () => Promise<void>;
  redeemVoucher: () => Promise<void>;
  authenticateVoucher: () => Promise<void>;
  checkSession: () => Promise<void>;
  disconnectSession: () => Promise<void>;
  resetPortal: () => void;
}

// Parse Mikrotik URL params
// Mikrotik sends: ?mac=AA:BB:CC:DD:EE:FF&ip=192.168.1.100&link-login=...&link-login-only=...&link-orig=...&error=...
// After successful login: ?status=connected&mac=...&ip=...&username=...
const parseDeviceInfoFromUrl = (): DeviceInfo & { status?: string; username?: string } => {
  const params = new URLSearchParams(window.location.search);
  
  // Development mode: Use mock data ONLY if explicitly testing without Mikrotik
  // Set VITE_USE_MOCK_DEVICE=true in .env to enable
  const useMockDevice = import.meta.env.VITE_USE_MOCK_DEVICE === 'true';
  
  // Get MAC from URL first, then localStorage, then mock
  const macFromUrl = params.get('mac');
  const macFromStorage = localStorage.getItem('device_mac');
  const mac = macFromUrl || macFromStorage || (useMockDevice ? '00:11:22:33:44:55' : '');
  
  // Get IP from URL first, then localStorage, then mock
  const ipFromUrl = params.get('ip');
  const ipFromStorage = localStorage.getItem('device_ip');
  const ip = ipFromUrl || ipFromStorage || (useMockDevice ? '192.168.88.100' : '');
  
  // Store in localStorage for next refresh (if from URL)
  if (macFromUrl) {
    localStorage.setItem('device_mac', macFromUrl);
    console.log('💾 Stored MAC to localStorage:', macFromUrl);
  }
  if (ipFromUrl) {
    localStorage.setItem('device_ip', ipFromUrl);
    console.log('💾 Stored IP to localStorage:', ipFromUrl);
  }
  
  return {
    mac,
    ip,
    linkLogin: params.get('link-login') || params.get('link_login') || '',
    linkLoginOnly: params.get('link-login-only') || params.get('link_login_only') || '',
    linkOrig: params.get('link-orig') || params.get('link_orig') || '',
    error: params.get('error') || '',
    // New: status from Mikrotik status.html redirect
    status: params.get('status') || '',
    username: params.get('username') || '',
  };
};

const initialDeviceInfo = parseDeviceInfoFromUrl();

// Log device info for debugging
console.log('📱 Initial device info:', {
  mac: initialDeviceInfo.mac,
  ip: initialDeviceInfo.ip,
  status: initialDeviceInfo.status,
  hasMAC: !!initialDeviceInfo.mac,
});

const initialState: PortalState = {
  currentStep: 'video',
  phoneNumber: '',
  email: '',
  voucherCode: '',
  agreedToTerms: false,
  advertisement: null,
  voucher: null,
  session: null,
  loading: false,
  error: null,
  deviceInfo: initialDeviceInfo,
  checkingSession: true, // Start with checking session
};

const PortalContext = createContext<PortalContextType | undefined>(undefined);

export function PortalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PortalState>(initialState);
  const { toast } = useToast();
  
  // Check for existing session on mount - THIS MUST RUN FIRST
  useEffect(() => {
    const initializePortal = async () => {
      console.log('🚀 Portal initializing...');
      
      // Parse URL params including status
      const urlInfo = parseDeviceInfoFromUrl();
      const mac = urlInfo.mac || localStorage.getItem('device_mac') || '';
      
      console.log('🔍 Device info:', { 
        mac, 
        hasMAC: !!mac, 
        status: urlInfo.status,
        urlHasMAC: !!urlInfo.mac,
        storageMAC: localStorage.getItem('device_mac'),
      });
      
      // Case 1: Coming from Mikrotik status.html after successful login
      if (urlInfo.status === 'connected') {
        console.log('✅ User redirected from Mikrotik status page - already connected');
        
        // Clean URL (remove query params) but keep on connected page
        window.history.replaceState({}, '', window.location.pathname);
        
        // Set session from URL params
        if (mac) {
          setState(prev => ({ 
            ...prev, 
            currentStep: 'connected',
            checkingSession: false,
            session: {
              mac: mac,
              ip: urlInfo.ip,
              username: urlInfo.username || 'Connected',
            } as SessionInfo,
          }));
          
          // Verify session with backend in background
          try {
            const response = await voucherApi.checkSession({ mac });
            const data = response.data.data as SessionInfo & { active?: boolean; session?: SessionInfo };
            if (response.data.success && data?.active && data?.session) {
              console.log('✅ Session verified with backend:', data.session);
              setState(prev => ({ 
                ...prev, 
                session: data.session,
              }));
            }
          } catch (e) {
            console.log('Session verify skipped:', e);
          }
        }
        return; // Don't load advertisement for connected users
      }
      
      // Case 2: Normal portal access - ALWAYS check session first if we have MAC
      if (mac) {
        console.log('🔍 Checking active session for MAC:', mac);
        try {
          const response = await voucherApi.checkSession({ mac });
          console.log('📡 Check session response:', response.data);
          const data = response.data.data as SessionInfo & { active?: boolean; session?: SessionInfo };
          
          // Backend returns { active: true/false, session: {...} }
          if (response.data.success && data?.active && data?.session) {
            // User has active session - go directly to connected page
            console.log('✅ User already has active session!', data.session);
            
            // Cache session info to localStorage for quick subsequent checks
            localStorage.setItem('portal_session_cache', JSON.stringify({
              active: true,
              mac: mac,
              timestamp: Date.now(),
              session: data.session,
            }));
            
            setState(prev => ({ 
              ...prev, 
              session: data.session,
              currentStep: 'connected',
              checkingSession: false 
            }));
            return; // Don't load advertisement for connected users
          } else {
            console.log('📋 No active session found:', data);
          }
        } catch (error) {
          console.error('❌ Session check failed:', error);
        }

        const saved = readProgress(mac);
        if (saved) {
          setState((prev) => ({
            ...prev,
            currentStep: saved.step,
            phoneNumber: saved.phoneNumber,
            email: saved.email,
            agreedToTerms: saved.agreedToTerms,
            checkingSession: false,
          }));
          if (saved.step === 'video') {
            loadAdvertisement();
          }
          return;
        }

        try {
          const pendingRes = await voucherApi.getPending({ mac });
          const pending = pendingRes.data.data;
          if (pendingRes.data.success && pending?.pending) {
            setState((prev) => ({
              ...prev,
              currentStep: 'voucher',
              phoneNumber: pending.phone || prev.phoneNumber,
              checkingSession: false,
            }));
            return;
          }
        } catch (error) {
          console.log('Pending voucher check skipped:', error);
        }
      } else {
        console.log('⚠️ No MAC address found, cannot check session');
      }
      
      console.log('📺 Loading advertisement for new user...');
      setState(prev => ({ ...prev, checkingSession: false }));
      loadAdvertisement();
    };

    initializePortal();
  }, []);

  useEffect(() => {
    const mac = state.deviceInfo.mac;
    if (!mac || state.checkingSession) return;
    if (state.currentStep === 'form' || state.currentStep === 'voucher') {
      writeProgress({
        mac,
        phoneNumber: state.phoneNumber,
        email: state.email,
        agreedToTerms: state.agreedToTerms,
        step: state.currentStep,
      });
    }
  }, [
    state.currentStep,
    state.phoneNumber,
    state.email,
    state.agreedToTerms,
    state.deviceInfo.mac,
    state.checkingSession,
  ]);

  const setStep = (step: PortalStep) => {
    setState(prev => ({ ...prev, currentStep: step }));
  };

  const setPhoneNumber = (phoneNumber: string) => {
    setState(prev => ({ ...prev, phoneNumber }));
  };

  const setEmail = (email: string) => {
    setState(prev => ({ ...prev, email }));
  };

  const setVoucherCode = (voucherCode: string) => {
    setState(prev => ({ ...prev, voucherCode }));
  };

  const setAgreedToTerms = (agreedToTerms: boolean) => {
    setState(prev => ({ ...prev, agreedToTerms }));
  };

  const loadAdvertisement = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const response = await advertisementApi.getActive();
      
      if (response.data.success && response.data.data) {
        setState(prev => ({ 
          ...prev, 
          advertisement: response.data.data!,
          loading: false 
        }));
      } else {
        throw new Error('Tidak ada iklan aktif saat ini');
      }
    } catch (error) {
      const errorMsg = handleApiError(error);
      setState(prev => ({ ...prev, error: errorMsg, loading: false }));
      toast({
        title: 'Gagal',
        description: errorMsg,
        variant: 'destructive',
      });
    }
  };

  const trackAdView = async () => {
    if (!state.advertisement) return;
    
    try {
      await advertisementApi.trackView(state.advertisement.id, { deviceId: state.deviceInfo.mac });
    } catch (error) {
      console.error('Failed to track ad view:', error);
    }
  };

  const trackAdComplete = async () => {
    if (!state.advertisement) return;
    
    try {
      await advertisementApi.trackComplete(state.advertisement.id, { deviceId: state.deviceInfo.mac });
    } catch (error) {
      console.error('Failed to track ad completion:', error);
    }
  };

  const trackAdSkip = async () => {
    if (!state.advertisement) return;
    
    try {
      await advertisementApi.trackSkip(state.advertisement.id, { deviceId: state.deviceInfo.mac });
    } catch (error) {
      console.error('Failed to track ad skip:', error);
    }
  };

  const requestVoucher = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await voucherApi.request({
        phone: state.phoneNumber,
        mac: state.deviceInfo.mac,
        ip: state.deviceInfo.ip,
      });

      if (response.data.success && response.data.data) {
        setState(prev => ({ 
          ...prev, 
          voucher: response.data.data!.voucher,
          loading: false 
        }));
        writeProgress({
          mac: state.deviceInfo.mac,
          phoneNumber: state.phoneNumber,
          email: state.email,
          agreedToTerms: state.agreedToTerms,
          step: 'voucher',
        });

        toast({
          title: 'Berhasil',
          description: response.data.data.message || 'Kode voucher telah dikirim ke WhatsApp',
        });

        setStep('voucher');
      }
    } catch (error) {
      const errorMsg = handleApiError(error);
      
      // Log detailed error for debugging
      console.error('Request voucher failed');
      
      setState(prev => ({ ...prev, error: errorMsg, loading: false }));
      
      // Provide more specific error messages
      let userMessage = errorMsg;
      if (errorMsg.includes('WhatsApp')) {
        userMessage = 'Gagal mengirim ke WhatsApp. Pastikan nomor sudah terdaftar WhatsApp.';
      } else if (errorMsg.includes('phone') || errorMsg.includes('nomor')) {
        userMessage = 'Nomor telepon tidak valid. Gunakan format 08xxxxxxxxxx.';
      }
      
      toast({
        title: 'Gagal',
        description: userMessage,
        variant: 'destructive',
      });
    }
  };

  // Resend voucher - disables old voucher and generates new one
  const resendVoucher = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await voucherApi.resend({
        phone: state.phoneNumber,
        mac: state.deviceInfo.mac,
        ip: state.deviceInfo.ip,
      });

      if (response.data.success && response.data.data) {
        setState(prev => ({ 
          ...prev, 
          voucher: response.data.data!.voucher,
          voucherCode: '', // Clear old voucher code input
          loading: false 
        }));

        toast({
          title: 'Berhasil',
          description: 'Kode baru telah dikirim ke WhatsApp. Kode lama sudah dinonaktifkan.',
        });
      }
    } catch (error) {
      const errorMsg = handleApiError(error);
      setState(prev => ({ ...prev, error: errorMsg, loading: false }));
      toast({
        title: 'Gagal',
        description: errorMsg,
        variant: 'destructive',
      });
    }
  };

  const redeemVoucher = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await voucherApi.redeem({
        code: state.voucherCode,
        mac: state.deviceInfo.mac,
        ip: state.deviceInfo.ip,
      });

      if (response.data.success) {
        setState(prev => ({ ...prev, loading: false }));

        toast({
          title: 'Berhasil',
          description: response.data.data?.message || 'Voucher berhasil digunakan',
        });

        setStep('success');
      }
    } catch (error) {
      const errorMsg = handleApiError(error);
      setState(prev => ({ ...prev, error: errorMsg, loading: false }));
      toast({
        title: 'Gagal',
        description: errorMsg,
        variant: 'destructive',
      });
    }
  };

  // Phase 3: Authenticate voucher and create Mikrotik session
  const authenticateVoucher = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await voucherApi.authenticate({
        code: state.voucherCode,
        mac: state.deviceInfo.mac,
        ip: state.deviceInfo.ip,
        linkOrig: state.deviceInfo.linkOrig,
      });

      if (response.data.success && response.data.data) {
        const data = response.data.data as { session?: SessionInfo; loginUrl?: string };
        
        setState(prev => ({ 
          ...prev, 
          session: data.session,
          loading: false 
        }));

        toast({
          title: 'Menghubungkan...',
          description: 'Mengarahkan ke halaman login',
        });

        // IMPORTANT: Redirect to Mikrotik login URL for actual session creation
        // This is the CORRECT flow - browser must visit Mikrotik to create session
        if (data.loginUrl) {
          console.log('🔗 Redirecting to Mikrotik login URL');
          // Redirect immediately - Mikrotik will handle the login
          window.location.href = data.loginUrl;
          return;
        }
        
        // Fallback: If no loginUrl, redirect to linkOrig or show connected
        if (state.deviceInfo.linkOrig) {
          setTimeout(() => {
            window.location.href = state.deviceInfo.linkOrig;
          }, 1000);
        } else {
          setStep('connected');
        }
      }
    } catch (error) {
      const errorMsg = handleApiError(error);
      
      // Log detailed error for debugging
      console.error('🔴 Authentication Failed:', {
        error: errorMsg,
        code: state.voucherCode,
        mac: state.deviceInfo.mac,
        ip: state.deviceInfo.ip,
        rawError: error,
      });
      
      setState(prev => ({ ...prev, error: errorMsg, loading: false }));
      
      // Provide more specific error messages
      let userMessage = errorMsg;
      if (errorMsg.includes('Mikrotik')) {
        userMessage = 'Koneksi ke router gagal. Silakan coba beberapa saat lagi.';
      } else if (errorMsg.includes('profile')) {
        userMessage = 'Profile voucher tidak valid. Hubungi admin.';
      } else if (errorMsg.includes('expired') || errorMsg.includes('kadaluarsa')) {
        userMessage = 'Voucher sudah kadaluarsa. Silakan minta voucher baru.';
      } else if (errorMsg.includes('not found') || errorMsg.includes('tidak ditemukan')) {
        userMessage = 'Kode voucher tidak valid. Periksa kembali kode Anda.';
      }
      
      toast({
        title: 'Gagal Terhubung',
        description: userMessage,
        variant: 'destructive',
      });
    }
  };

  // Phase 3: Check if user has active session (used for manual refresh)
  const checkSession = async () => {
    const mac = state.deviceInfo.mac || localStorage.getItem('device_mac') || '';
    
    if (!mac) {
      setState(prev => ({ ...prev, checkingSession: false }));
      return;
    }

    try {
      setState(prev => ({ ...prev, checkingSession: true }));
      
      const response = await voucherApi.checkSession({ mac });
      const data = response.data.data as SessionInfo & { active?: boolean; session?: SessionInfo };

      // Backend returns { active: true/false, session: {...} }
      if (response.data.success && data?.active && data?.session) {
        // User has active session - go to connected page
        console.log('✅ Session check: Active session found', data.session);
        
        // Cache session info
        localStorage.setItem('portal_session_cache', JSON.stringify({
          active: true,
          mac: mac,
          timestamp: Date.now(),
          session: data.session,
        }));
        
        setState(prev => ({ 
          ...prev, 
          session: data.session,
          currentStep: 'connected',
          checkingSession: false 
        }));
      } else {
        // No active session - proceed with normal flow
        console.log('📋 Session check: No active session');
        // Clear stale cache
        localStorage.removeItem('portal_session_cache');
        setState(prev => ({ ...prev, checkingSession: false }));
      }
    } catch (error) {
      // If check fails, proceed with normal flow
      console.error('Session check failed:', error);
      setState(prev => ({ ...prev, checkingSession: false }));
    }
  };

  // Phase 3: Disconnect user session
  const disconnectSession = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await voucherApi.disconnect({
        mac: state.deviceInfo.mac,
      });

      if (response.data.success) {
        localStorage.removeItem('portal_session_cache');
        clearProgress();
        
        setState(prev => ({ 
          ...prev, 
          session: null,
          loading: false 
        }));

        toast({
          title: 'Disconnected',
          description: response.data.data?.message || 'Anda sudah disconnect dari internet',
        });

        // Reset to video screen
        resetPortal();
      }
    } catch (error) {
      const errorMsg = handleApiError(error);
      setState(prev => ({ ...prev, error: errorMsg, loading: false }));
      toast({
        title: 'Gagal',
        description: errorMsg,
        variant: 'destructive',
      });
    }
  };

  const resetPortal = () => {
    localStorage.removeItem('portal_session_cache');
    clearProgress();

    setState({
      ...initialState,
      checkingSession: false,
      deviceInfo: state.deviceInfo,
    });
    loadAdvertisement();
  };

  return (
    <PortalContext.Provider
      value={{
        state,
        setStep,
        setPhoneNumber,
        setEmail,
        setVoucherCode,
        setAgreedToTerms,
        loadAdvertisement,
        trackAdView,
        trackAdComplete,
        trackAdSkip,
        requestVoucher,
        resendVoucher,
        redeemVoucher,
        authenticateVoucher,
        checkSession,
        disconnectSession,
        resetPortal,
      }}
    >
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal() {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error('usePortal must be used within a PortalProvider');
  }
  return context;
}
