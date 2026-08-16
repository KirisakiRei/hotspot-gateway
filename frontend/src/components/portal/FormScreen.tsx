import { useState } from 'react';
import { Check, AlertCircle, X, Loader2 } from 'lucide-react';
import { usePortal } from '@/contexts/PortalContext';
import { PortalHeader } from './PortalHeader';
import { IosResumeHint } from './IosResumeHint';

export function FormScreen() {
  const { state, setPhoneNumber, setEmail, setAgreedToTerms, requestVoucher } = usePortal();
  const [errors, setErrors] = useState<{ phone?: string; terms?: string }>({});
  const [touched, setTouched] = useState<{ phone?: boolean; email?: boolean }>({});
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Extract just the number part after +62 for display
  const getPhoneNumberInput = () => {
    const fullPhone = state.phoneNumber;
    if (!fullPhone) return '';
    const digits = fullPhone.replace(/\D/g, '');
    // Remove 62 prefix if exists
    if (digits.startsWith('62')) {
      return digits.slice(2);
    }
    // Remove 0 prefix if exists
    if (digits.startsWith('0')) {
      return digits.slice(1);
    }
    return digits;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Get only digits from input
    const input = e.target.value.replace(/\D/g, '');
    
    // Limit to 13 digits (typical Indonesian mobile: 8xxxxxxxxxx = 11 digits)
    const trimmed = input.slice(0, 13);
    
    // Store with +62 prefix
    const formatted = trimmed ? `+62 ${trimmed}` : '';
    setPhoneNumber(formatted);
    
    if (errors.phone) {
      setErrors(prev => ({ ...prev, phone: undefined }));
    }
  };

  const validatePhone = () => {
    const phoneInput = getPhoneNumberInput();
    // Indonesian mobile numbers: 8xxxxxxxxxx (min 9-13 digits after 62)
    if (phoneInput.length < 9 || phoneInput.length > 13) {
      setErrors(prev => ({ ...prev, phone: 'Nomor telepon tidak valid (min 9 digit)' }));
      return false;
    }
    // Must start with 8 (Indonesian mobile)
    if (!phoneInput.startsWith('8')) {
      setErrors(prev => ({ ...prev, phone: 'Nomor harus diawali dengan 8' }));
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    const isPhoneValid = validatePhone();
    
    if (!state.agreedToTerms) {
      setErrors(prev => ({ ...prev, terms: 'Anda harus menyetujui syarat & ketentuan' }));
      return;
    }

    if (isPhoneValid && state.agreedToTerms) {
      // MAC and IP are automatically extracted from URL params in PortalContext
      await requestVoucher();
    }
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col animate-fade-in">
      <PortalHeader currentStep={2} totalSteps={4} />
      
      <div className="flex-1 flex justify-center overflow-hidden">
        <div className="w-full max-w-md px-6 flex flex-col">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-foreground text-center mb-1">
              Lengkapi Data Anda
            </h1>
              <p className="text-sm text-muted-foreground text-center">
                Kami akan mengirim voucher ke WhatsApp Anda
              </p>
            </div>

            <IosResumeHint context="form" />

          <div className="space-y-4">
            {/* Phone Number Field */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Nomor WhatsApp <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <div className="flex items-center">
                  {/* Locked +62 prefix */}
                  <div className="flex items-center px-3 h-11 bg-secondary border border-r-0 border-border rounded-l-xl text-muted-foreground font-medium">
                    +62
                  </div>
                  {/* Phone input */}
                  <input
                    type="tel"
                    value={getPhoneNumberInput()}
                    onChange={handlePhoneChange}
                    onBlur={() => {
                      setTouched(prev => ({ ...prev, phone: true }));
                      validatePhone();
                    }}
                    placeholder="812345678"
                    className={`input-field rounded-l-none flex-1 ${errors.phone && touched.phone ? 'input-field-error' : ''}`}
                  />
                </div>
                {errors.phone && touched.phone && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <AlertCircle className="w-5 h-5 text-destructive" />
                  </div>
                )}
              </div>
              {errors.phone && touched.phone && (
                <p className="mt-1.5 text-sm text-destructive flex items-center gap-1">
                  {errors.phone}
                </p>
              )}
              <p className="mt-1.5 text-xs text-muted-foreground">
                Contoh: 812345678 (tanpa 0)
              </p>
            </div>

            {/* Email Field (Optional) */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Email <span className="text-muted-foreground text-xs">(opsional)</span>
              </label>
              <input
                type="email"
                value={state.email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="input-field"
              />
            </div>

            {/* Terms Checkbox */}
            <div className="pt-2">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative mt-0.5">
                  <input
                    type="checkbox"
                    checked={state.agreedToTerms}
                    onChange={(e) => {
                      setAgreedToTerms(e.target.checked);
                      if (errors.terms) {
                        setErrors(prev => ({ ...prev, terms: undefined }));
                      }
                    }}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${
                    state.agreedToTerms 
                      ? 'bg-primary border-primary' 
                      : errors.terms 
                        ? 'border-destructive bg-destructive/5' 
                        : 'border-border group-hover:border-primary/50'
                  }`}>
                    {state.agreedToTerms && (
                      <Check className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={3} />
                    )}
                  </div>
                </div>
                <span className="text-sm text-muted-foreground leading-relaxed">
                  Saya menyetujui{' '}
                  <button 
                    type="button" 
                    onClick={(e) => { e.preventDefault(); setShowTermsModal(true); }}
                    className="text-primary font-medium hover:underline"
                  >
                    Syarat & Ketentuan
                  </button>{' '}
                  dan{' '}
                  <button 
                    type="button" 
                    onClick={(e) => { e.preventDefault(); setShowPrivacyModal(true); }}
                    className="text-primary font-medium hover:underline"
                  >
                    Kebijakan Privasi
                  </button>
                </span>
              </label>
              {errors.terms && (
                <p className="mt-2 text-sm text-destructive">{errors.terms}</p>
              )}
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1 min-h-4" />

          {/* Submit Button */}
          <div className="pb-8">
            <button
              onClick={handleSubmit}
              disabled={state.loading}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {state.loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Mengirim...
                </>
              ) : (
                'Kirim & Dapatkan Voucher'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Terms Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6 animate-fade-in">
          <div className="bg-background rounded-2xl max-w-md w-full max-h-[80vh] flex flex-col shadow-elevated">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Syarat & Ketentuan</h2>
              <button 
                onClick={() => setShowTermsModal(false)}
                className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 text-sm text-muted-foreground space-y-3">
              <p><strong>1. Penggunaan Layanan</strong></p>
              <p>Layanan WiFi gratis ini disediakan untuk penggunaan internet yang wajar dan sesuai dengan ketentuan yang berlaku.</p>
              
              <p><strong>2. Batasan Penggunaan</strong></p>
              <p>Pengguna dilarang menggunakan layanan untuk kegiatan ilegal, mengunduh konten terlarang, atau aktivitas yang dapat mengganggu jaringan.</p>
              
              <p><strong>3. Durasi dan Kuota</strong></p>
              <p>Setiap voucher memiliki batas durasi dan kuota data yang ditentukan. Layanan akan berhenti jika salah satu batas tercapai.</p>
              
              <p><strong>4. Keamanan</strong></p>
              <p>Pengguna bertanggung jawab atas keamanan perangkat dan data pribadi mereka saat menggunakan layanan ini.</p>
              
              <p><strong>5. Perubahan Layanan</strong></p>
              <p>Penyedia berhak mengubah, menghentikan, atau membatasi layanan tanpa pemberitahuan sebelumnya.</p>
            </div>
            <div className="p-4 border-t border-border">
              <button 
                onClick={() => setShowTermsModal(false)}
                className="btn-primary w-full"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6 animate-fade-in">
          <div className="bg-background rounded-2xl max-w-md w-full max-h-[80vh] flex flex-col shadow-elevated">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Kebijakan Privasi</h2>
              <button 
                onClick={() => setShowPrivacyModal(false)}
                className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 text-sm text-muted-foreground space-y-3">
              <p><strong>Data yang Dikumpulkan</strong></p>
              <p>Kami mengumpulkan nomor telepon dan email (opsional) untuk mengirimkan voucher dan keperluan komunikasi layanan.</p>
              
              <p><strong>Penggunaan Data</strong></p>
              <p>Data Anda digunakan untuk:</p>
              <ul className="list-disc ml-4 space-y-1">
                <li>Mengirimkan kode voucher via WhatsApp</li>
                <li>Verifikasi pengguna</li>
                <li>Peningkatan layanan</li>
              </ul>
              
              <p><strong>Penyimpanan Data</strong></p>
              <p>Data disimpan dengan aman dan tidak akan dibagikan kepada pihak ketiga tanpa persetujuan Anda.</p>
              
              <p><strong>Hak Pengguna</strong></p>
              <p>Anda berhak meminta penghapusan data pribadi dengan menghubungi tim dukungan kami.</p>
              
              <p><strong>Hubungi Kami</strong></p>
              <p>Jika ada pertanyaan mengenai kebijakan privasi, silakan hubungi tim kami.</p>
            </div>
            <div className="p-4 border-t border-border">
              <button 
                onClick={() => setShowPrivacyModal(false)}
                className="btn-primary w-full"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
