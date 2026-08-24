import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { advertisementApi, voucherApi, type Advertisement, type SessionInfo, type TrackAdRequest, type ClaimFreeVoucherResponse, handleApiError } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

export type PortalStep = 'video' | 'choice' | 'questionnaire' | 'connect' | 'connected';

/** accessType: 'free' = 1 jam langsung, 'survey' = 1 hari setelah kuesioner */
export type AccessType = 'free' | 'survey';

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
  accessType: AccessType;
  advertisement: Advertisement | null;
  session: SessionInfo | null;
  loading: boolean;
  error: string | null;
  deviceInfo: DeviceInfo;
  checkingSession: boolean;
}

interface PortalContextType {
  state: PortalState;
  setStep: (step: PortalStep, opts?: { accessType?: AccessType }) => void;
  loadAdvertisement: () => Promise<void>;
  trackAdView: () => Promise<void>;
  trackAdComplete: (watchTime?: number) => Promise<void>;
  claimFreeAccess: (accessType?: AccessType) => Promise<void>;
  checkSession: () => Promise<void>;
  disconnectSession: () => Promise<void>;
  resetPortal: () => void;
}

// Parse Mikrotik URL params
// Mikrotik sends: ?mac=AA:BB:CC:DD:EE:FF&ip=192.168.10.100&link-login=...&link-login-only=...&link-orig=...&error=...
// After successful login: ?status=connected&mac=...&ip=...&username=...
const parseDeviceInfoFromUrl = (): DeviceInfo & { status?: string; username?: string } => {
  const params = new URLSearchParams(window.location.search);

  // Development mode: Use mock data ONLY if explicitly testing without Mikrotik
  const useMockDevice = import.meta.env.VITE_USE_MOCK_DEVICE === 'true';

  const macFromUrl = params.get('mac');
  const macFromStorage = localStorage.getItem('device_mac');
  const mac = macFromUrl || macFromStorage || (useMockDevice ? '00:11:22:33:44:55' : '');

  const ipFromUrl = params.get('ip');
  const ipFromStorage = localStorage.getItem('device_ip');
  const ip = ipFromUrl || ipFromStorage || (useMockDevice ? '192.168.10.100' : '');

  if (macFromUrl) localStorage.setItem('device_mac', macFromUrl);
  if (ipFromUrl) localStorage.setItem('device_ip', ipFromUrl);

  return {
    mac,
    ip,
    linkLogin: params.get('link-login') || params.get('link_login') || '',
    linkLoginOnly: params.get('link-login-only') || params.get('link_login_only') || '',
    linkOrig: params.get('link-orig') || params.get('link_orig') || '',
    error: params.get('error') || '',
    status: params.get('status') || '',
    username: params.get('username') || '',
  };
};

const initialDeviceInfo = parseDeviceInfoFromUrl();

const initialState: PortalState = {
  currentStep: 'video',
  accessType: 'free',
  advertisement: null,
  session: null,
  loading: false,
  error: null,
  deviceInfo: initialDeviceInfo,
  checkingSession: true,
};

const PortalContext = createContext<PortalContextType | undefined>(undefined);

/**
 * Submit form native (PAP) ke endpoint login MikroTik.
 * MikroTik memvalidasi username/password, membuat cookie sesi,
 * lalu meredirect browser ke `dst` (link-orig).
 */
const submitNativeLoginForm = (
  action: string,
  dst: string,
  username: string,
  password: string,
) => {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = action;
  form.style.display = 'none';

  const appendField = (name: string, value: string) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  };

  if (dst) appendField('dst', dst);
  appendField('username', username);
  appendField('password', password);

  document.body.appendChild(form);
  form.submit();
};

export function PortalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PortalState>(initialState);
  const { toast } = useToast();

  const loadAdvertisement = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await advertisementApi.getActive();
      const data = response.data.data;

      if (data) {
        setState(prev => ({
          ...prev,
          advertisement: data,
          loading: false,
          currentStep: 'video',
        }));
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'Tidak ada iklan aktif saat ini',
        }));
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

  const trackAdComplete = async (watchTime?: number) => {
    if (!state.advertisement) return;
    try {
      const payload: TrackAdRequest = { deviceId: state.deviceInfo.mac };
      if (typeof watchTime === 'number' && Number.isFinite(watchTime)) {
        payload.watchTime = Math.max(0, Math.round(watchTime));
      } else {
        payload.watchTime = 0;
      }
      await advertisementApi.trackComplete(state.advertisement.id, payload);
    } catch (error) {
      console.error('Failed to track ad completion:', error);
    }
  };

  const setStep = (step: PortalStep, opts?: { accessType?: AccessType }) => {
    setState(prev => ({
      ...prev,
      currentStep: step,
      ...(opts?.accessType !== undefined && { accessType: opts.accessType }),
    }));
  };

  // Klaim akses gratis. accessType: 'free' = 1 jam, 'survey' = 1 hari (setelah kuesioner)
  const claimFreeAccess = async (accessType?: AccessType) => {
    const mac = state.deviceInfo.mac || localStorage.getItem('device_mac') || '';
    const effectiveAccessType = accessType ?? state.accessType;

    if (!mac) {
      toast({
        title: 'Tidak dapat terhubung',
        description: 'Alamat perangkat tidak terdeteksi.',
        variant: 'destructive',
      });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Kirim accessType — backend resolve profil dari Settings DB
      const response = await voucherApi.claimFree({
        mac,
        ip: state.deviceInfo.ip,
        linkOrig: state.deviceInfo.linkOrig,
        accessType: effectiveAccessType,
      });

      const data = response.data.data as ClaimFreeVoucherResponse;

      // Sudah punya sesi aktif
      if (data.alreadyConnected) {
        setState(prev => ({ ...prev, loading: false }));
        setStep('connected');
        checkSession();
        return;
      }

      // Ada kredensial -> submit form native ke MikroTik (A-PAP)
      if (data.credentials) {
        const loginAction = state.deviceInfo.linkLoginOnly || state.deviceInfo.linkLogin;

        if (loginAction) {
          toast({
            title: 'Menghubungkan...',
            description: 'Mengalihkan ke router',
          });
          // Setelah PAP login berhasil, MikroTik redirect ke dst.
          // Kita arahkan ke halaman portal status=connected agar user langsung
          // melihat halaman "Terhubung" dengan sertifikat HTTPS yang valid
          // (menghindari SSL warning dari sertifikat self-signed MikroTik).
          const connectedUrl = `${window.location.origin}/portal?status=connected&mac=${encodeURIComponent(mac)}&ip=${encodeURIComponent(state.deviceInfo.ip || '')}`;
          submitNativeLoginForm(
            loginAction,
            connectedUrl,
            data.credentials.username,
            data.credentials.password,
          );
          return;
        }

        // Fallback (mode dev/mock tanpa parameter MikroTik)
        setState(prev => ({ ...prev, loading: false }));
        toast({
          title: 'Berhasil',
          description: 'Terhubung ke internet',
        });
        setStep('connected');
        return;
      }

      setState(prev => ({ ...prev, loading: false }));
      toast({
        title: 'Gagal terhubung',
        description: 'Tidak ada kredensial yang diterima.',
        variant: 'destructive',
      });
    } catch (error) {
      const errorMsg = handleApiError(error);
      setState(prev => ({ ...prev, error: errorMsg, loading: false }));
      toast({
        title: 'Gagal Terhubung',
        description: errorMsg,
        variant: 'destructive',
      });
    }
  };

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

      if (response.data.success && data?.active && data?.session) {
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
          checkingSession: false,
        }));
      } else {
        localStorage.removeItem('portal_session_cache');
        setState(prev => ({ ...prev, checkingSession: false }));
      }
    } catch (error) {
      console.error('Session check failed:', error);
      setState(prev => ({ ...prev, checkingSession: false }));
    }
  };

  const disconnectSession = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const response = await voucherApi.disconnect({
        mac: state.deviceInfo.mac,
      });

      if (response.data.success) {
        localStorage.removeItem('portal_session_cache');

        setState(prev => ({
          ...prev,
          session: null,
          loading: false,
        }));

        toast({
          title: 'Disconnected',
          description: response.data.data?.message || 'Anda sudah disconnect dari internet',
        });

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

    setState({
      ...initialState,
      checkingSession: false,
      deviceInfo: state.deviceInfo,
    });
    loadAdvertisement();
  };

  // Init: cek status connected dari query param, lalu cek sesi / muat iklan
  useEffect(() => {
    const initializePortal = async () => {
      const urlInfo = parseDeviceInfoFromUrl();
      const mac = urlInfo.mac || localStorage.getItem('device_mac') || '';

      // Case 1: redirect dari status.html MikroTik setelah login sukses
      if (urlInfo.status === 'connected') {
        window.history.replaceState({}, '', window.location.pathname);

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
        }
        checkSession();
        return;
      }

      // Case 2: cek sesi aktif
      if (mac) {
        try {
          const response = await voucherApi.checkSession({ mac });
          const data = response.data.data as SessionInfo & { active?: boolean; session?: SessionInfo };

          if (response.data.success && data?.active && data?.session) {
            localStorage.setItem('portal_session_cache', JSON.stringify({
              active: true,
              mac,
              timestamp: Date.now(),
              session: data.session,
            }));

            setState(prev => ({
              ...prev,
              session: data.session,
              currentStep: 'connected',
              checkingSession: false,
            }));
            return;
          }
        } catch (error) {
          console.log('Session check skipped:', error);
        }
      }

      // Case 3: user baru — muat iklan
      setState(prev => ({ ...prev, checkingSession: false }));
      loadAdvertisement();
    };

    initializePortal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PortalContext.Provider
      value={{
        state,
        setStep,
        loadAdvertisement,
        trackAdView,
        trackAdComplete,
        claimFreeAccess,
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