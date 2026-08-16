import { useState, useRef, useEffect } from 'react';
import { AlertCircle, MessageCircle, Check, Loader2 } from 'lucide-react';
import { usePortal } from '@/contexts/PortalContext';
import { PortalHeader } from './PortalHeader';
import { IosResumeHint } from './IosResumeHint';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 59;

export function VoucherScreen() {
  const { state, setVoucherCode, authenticateVoucher, resendVoucher } = usePortal();
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showResendNotif, setShowResendNotif] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // User must input voucher code manually from WhatsApp message
  // No auto-fill - this ensures user has actually received the WhatsApp message

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setInterval(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [resendCooldown]);

  useEffect(() => {
    if (showResendNotif) {
      const timer = setTimeout(() => {
        setShowResendNotif(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showResendNotif]);

  const handleDigitChange = (index: number, value: string) => {
    const digit = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    if (digit.length <= 1) {
      const newDigits = [...digits];
      newDigits[index] = digit;
      setDigits(newDigits);
      setVoucherCode(newDigits.join(''));
      setError(null);

      if (digit && index < CODE_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const newDigits = [...digits];
    
    for (let i = 0; i < Math.min(pasted.length, CODE_LENGTH); i++) {
      newDigits[i] = pasted[i];
    }
    
    setDigits(newDigits);
    setVoucherCode(newDigits.join(''));
    
    const nextEmptyIndex = newDigits.findIndex(d => !d);
    if (nextEmptyIndex !== -1) {
      inputRefs.current[nextEmptyIndex]?.focus();
    } else {
      inputRefs.current[CODE_LENGTH - 1]?.focus();
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;
    
    setIsResending(true);
    try {
      await resendVoucher();
      setShowResendNotif(true);
      setResendCooldown(RESEND_COOLDOWN);
      // Clear digit inputs for new voucher
      setDigits(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } catch (error) {
      console.error('Failed to resend voucher:', error);
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async () => {
    const code = digits.join('');
    
    if (code.length !== CODE_LENGTH) {
      setError('Masukkan kode voucher lengkap');
      return;
    }

    // Phase 3: Use authenticateVoucher instead of redeemVoucher
    // This will create Mikrotik session and authenticate user
    await authenticateVoucher();
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col animate-fade-in">
      <PortalHeader currentStep={3} totalSteps={4} />
      
      <div className="flex-1 px-6 flex flex-col overflow-hidden">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-foreground text-center mb-1">
            Masukkan Kode Voucher
          </h1>
          <p className="text-sm text-muted-foreground text-center">
            Masukkan kode {CODE_LENGTH} digit untuk mengaktifkan internet
          </p>
        </div>

        <div className="mb-4">
          <IosResumeHint context="voucher" />
        </div>

        {/* Code Input */}
        <div className="flex justify-center gap-2 mb-4" onPaste={handlePaste}>
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={el => inputRefs.current[index] = el}
              type="text"
              inputMode="text"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className={`w-12 h-14 text-center text-xl font-semibold rounded-xl bg-secondary border-2 transition-all ${
                error 
                  ? 'border-destructive' 
                  : digit 
                    ? 'border-primary' 
                    : 'border-transparent focus:border-primary'
              }`}
            />
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center justify-center gap-2 text-destructive mb-4 animate-fade-in">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Helper Text */}
        <div className="flex items-center justify-center gap-2 text-muted-foreground mb-4">
          <MessageCircle className="w-4 h-4" />
          <span className="text-sm">Kode terkirim melalui WhatsApp</span>
        </div>

        {/* Resend Option */}
        <div className="text-center mb-6">
          <p className="text-sm text-muted-foreground">
            Tidak menerima kode?{' '}
            {isResending ? (
              <span className="text-primary">
                <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                Mengirim ulang...
              </span>
            ) : resendCooldown > 0 ? (
              <span className="text-muted-foreground">
                Kirim ulang dalam {resendCooldown}s
              </span>
            ) : (
              <button 
                onClick={handleResend}
                className="text-primary font-medium hover:underline"
              >
                Kirim ulang
              </button>
            )}
          </p>
        </div>

        {/* Resend Notification */}
        {showResendNotif && (
          <div className="flex items-center justify-center gap-2 mb-4 animate-fade-in">
            <div className="flex items-center gap-2 bg-success/10 text-success px-4 py-2 rounded-full">
              <Check className="w-4 h-4" />
              <span className="text-sm font-medium">Kode berhasil dikirim ulang</span>
            </div>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1 min-h-4" />

        {/* Submit Button */}
        <div className="pb-8">
          <button
            onClick={handleSubmit}
            disabled={digits.some(d => !d) || state.loading}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state.loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Memverifikasi...
              </>
            ) : (
              'Aktifkan Internet'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
