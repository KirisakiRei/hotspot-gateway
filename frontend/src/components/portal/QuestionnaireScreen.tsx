import { useState, useEffect } from 'react';
import { ChevronRight, Loader2, ClipboardList } from 'lucide-react';
import { usePortal } from '@/contexts/PortalContext';
import { PortalHeader } from './PortalHeader';
import { questionnaireApi, type QuestionnaireField, type QuestionnaireAnswer } from '@/services/api';
import { handleApiError } from '@/services/api';

export function QuestionnaireScreen() {
  const { state, setStep, claimFreeAccess } = usePortal();
  const [fields, setFields] = useState<QuestionnaireField[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loadingFields, setLoadingFields] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    questionnaireApi.getActiveFields()
      .then(res => setFields(res.data.data || []))
      .catch(() => setError('Gagal memuat kuesioner.'))
      .finally(() => setLoadingFields(false));
  }, []);

  const handleChange = (key: string, value: string) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    // Validasi required
    const missing = fields.filter(f => f.required && !answers[f.key]?.trim());
    if (missing.length > 0) {
      setError(`Mohon lengkapi: ${missing.map(f => f.label).join(', ')}`);
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const payload: QuestionnaireAnswer[] = fields
        .filter(f => answers[f.key] !== undefined && answers[f.key] !== '')
        .map(f => ({ key: f.key, label: f.label, value: answers[f.key] }));

      await questionnaireApi.submit({
        mac: state.deviceInfo.mac,
        answers: payload,
      });

      // Setelah submit kuesioner → claim dengan profil survey (1 hari)
      await claimFreeAccess('survey');
    } catch (err) {
      setError(handleApiError(err));
      setSubmitting(false);
    }
  };

  if (loadingFields) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      <PortalHeader currentStep={2} totalSteps={3} />

      <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 mb-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-semibold text-foreground">Kuesioner</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Isi kuesioner berikut untuk mendapatkan akses internet selama 1 hari.
          </p>
        </div>

        {fields.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            Tidak ada pertanyaan saat ini.
          </div>
        ) : (
          <div className="space-y-4">
            {fields.map(field => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>

                {field.type === 'SELECT' ? (
                  <select
                    value={answers[field.key] || ''}
                    onChange={e => handleChange(field.key, e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  >
                    <option value="">-- Pilih --</option>
                    {(field.options || []).map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : field.type === 'TEXTAREA' ? (
                  <textarea
                    rows={3}
                    value={answers[field.key] || ''}
                    onChange={e => handleChange(field.key, e.target.value)}
                    placeholder={field.placeholder || ''}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                ) : (
                  <input
                    type={
                      field.type === 'EMAIL' ? 'email' :
                      field.type === 'PHONE' ? 'tel' :
                      field.type === 'NUMBER' ? 'number' : 'text'
                    }
                    value={answers[field.key] || ''}
                    onChange={e => handleChange(field.key, e.target.value)}
                    placeholder={field.placeholder || ''}
                    className="w-full h-11 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-500 text-center">{error}</p>
        )}
      </div>

      <div className="px-6 pb-8 pt-2 border-t border-border bg-background">
        <div className="flex gap-3">
          <button
            onClick={() => setStep('choice')}
            disabled={submitting}
            className="h-13 px-5 rounded-2xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-all disabled:opacity-50"
          >
            Kembali
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || fields.length === 0}
            className="flex-1 h-13 rounded-2xl bg-primary text-primary-foreground text-base font-semibold transition-all flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Menghubungkan...
              </>
            ) : (
              <>
                Kirim & Konek
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
