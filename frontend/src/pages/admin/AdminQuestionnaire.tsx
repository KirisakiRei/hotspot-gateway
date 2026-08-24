import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, Check, X, Loader2, ClipboardList } from 'lucide-react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Badge, ActionButton, DataTable } from '@/components/admin/AdminComponents';
import { toast } from 'sonner';
import { questionnaireApi, type QuestionnaireField, type QuestionnaireAnswer } from '@/services/api';
import { getErrorMessage } from '@/lib/error';

type FieldType = 'TEXT' | 'EMAIL' | 'PHONE' | 'NUMBER' | 'SELECT' | 'TEXTAREA';

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  TEXT: 'Teks',
  EMAIL: 'Email',
  PHONE: 'Telepon',
  NUMBER: 'Angka',
  SELECT: 'Pilihan',
  TEXTAREA: 'Teks Panjang',
};

interface SubmissionRow {
  id: string;
  macAddress: string;
  voucherId?: string;
  answers: QuestionnaireAnswer[];
  createdAt: string;
}

export default function AdminQuestionnaire() {
  const [activeTab, setActiveTab] = useState<'fields' | 'submissions'>('fields');
  const [fields, setFields] = useState<QuestionnaireField[]>([]);
  const [submissions, setSubmissions] = useState<{ total: number; items: SubmissionRow[] }>({ total: 0, items: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    key: '',
    label: '',
    type: 'TEXT' as FieldType,
    options: '',
    placeholder: '',
    required: false,
    order: 0,
    isActive: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fieldsRes, submissionsRes] = await Promise.all([
        questionnaireApi.getAllFields(true),
        questionnaireApi.getSubmissions(1, 50),
      ]);
      setFields(fieldsRes.data.data || []);
      setSubmissions(submissionsRes.data.data || { total: 0, items: [] });
    } catch (error) {
      toast.error('Gagal memuat data kuesioner');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ key: '', label: '', type: 'TEXT', options: '', placeholder: '', required: false, order: 0, isActive: true });
    setEditId(null);
    setShowForm(false);
  };

  const handleEdit = (field: QuestionnaireField) => {
    setFormData({
      key: field.key,
      label: field.label,
      type: field.type as FieldType,
      options: (field.options as string[])?.join('\n') || '',
      placeholder: field.placeholder || '',
      required: field.required,
      order: field.order,
      isActive: field.isActive,
    });
    setEditId(field.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.key.trim() || !formData.label.trim()) {
      toast.error('Key dan Label wajib diisi');
      return;
    }

    setIsProcessing(true);
    try {
      const payload = {
        key: formData.key.trim().toLowerCase().replace(/\s+/g, '_'),
        label: formData.label.trim(),
        type: formData.type,
        ...(formData.type === 'SELECT' && formData.options.trim() ? { options: formData.options.split('\n').filter(s => s.trim()) } : {}),
        placeholder: formData.placeholder || undefined,
        required: formData.required,
        order: formData.order,
        isActive: formData.isActive,
      };

      if (editId) {
        await questionnaireApi.updateField(editId, payload as any);
        toast.success('Field berhasil diupdate');
      } else {
        await questionnaireApi.createField(payload as any);
        toast.success('Field berhasil dibuat');
      }
      resetForm();
      loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Gagal menyimpan field'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus field ini?')) return;
    try {
      await questionnaireApi.deleteField(id);
      toast.success('Field berhasil dihapus');
      loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Gagal menghapus field'));
    }
  };

  const handleToggleActive = async (field: QuestionnaireField) => {
    try {
      await questionnaireApi.updateField(field.id, { isActive: !field.isActive } as any);
      toast.success(field.isActive ? 'Field dinonaktifkan' : 'Field diaktifkan');
      loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Gagal mengubah status'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminHeader title="Kuesioner" />

        <div className="flex-1 overflow-y-auto p-6">
          {/* Tab navigation */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setActiveTab('fields')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === 'fields'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              Daftar Pertanyaan
            </button>
            <button
              onClick={() => setActiveTab('submissions')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === 'submissions'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              Jawaban ({submissions.total})
            </button>
          </div>

          {/* FIELDS TAB */}
          {activeTab === 'fields' && (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  {fields.length} pertanyaan • Admin bisa menambah, mengedit, dan mengelola field kuesioner yang ditampilkan ke user.
                </p>
                <ActionButton icon={Plus} onClick={() => { resetForm(); setShowForm(true); }} size="sm">
                  Tambah
                </ActionButton>
              </div>

              {/* Add/Edit Form */}
              {showForm && (
                <div className="bg-card border border-border rounded-2xl p-6 mb-6 space-y-4">
                  <h3 className="font-semibold text-foreground">
                    {editId ? 'Edit Field' : 'Tambah Field Baru'}
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Key (slug)</label>
                      <input
                        type="text"
                        value={formData.key}
                        onChange={e => setFormData(p => ({ ...p, key: e.target.value }))}
                        disabled={!!editId}
                        placeholder="nama_lengkap"
                        className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Label</label>
                      <input
                        type="text"
                        value={formData.label}
                        onChange={e => setFormData(p => ({ ...p, label: e.target.value }))}
                        placeholder="Nama Lengkap"
                        className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Tipe</label>
                      <select
                        value={formData.type}
                        onChange={e => setFormData(p => ({ ...p, type: e.target.value as FieldType }))}
                        className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      >
                        {Object.entries(FIELD_TYPE_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Urutan</label>
                      <input
                        type="number"
                        value={formData.order}
                        onChange={e => setFormData(p => ({ ...p, order: parseInt(e.target.value) || 0 }))}
                        className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                  </div>

                  {formData.type === 'SELECT' && (
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Opsi (satu per baris)
                      </label>
                      <textarea
                        rows={4}
                        value={formData.options}
                        onChange={e => setFormData(p => ({ ...p, options: e.target.value }))}
                        placeholder="Pria\nWanita"
                        className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={formData.required}
                        onChange={e => setFormData(p => ({ ...p, required: e.target.checked }))}
                      />
                      Wajib diisi
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={e => setFormData(p => ({ ...p, isActive: e.target.checked }))}
                      />
                      Aktif
                    </label>
                  </div>

                  <div className="flex gap-2">
                    <ActionButton variant="primary" size="sm" onClick={handleSave} disabled={isProcessing}>
                      {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Simpan
                    </ActionButton>
                    <ActionButton variant="ghost" size="sm" onClick={resetForm}>
                      <X className="w-4 h-4" /> Batal
                    </ActionButton>
                  </div>
                </div>
              )}

              {/* Fields Table */}
              {fields.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Belum ada pertanyaan. Klik "Tambah" untuk membuat.
                </div>
              ) : (
                <DataTable headers={['Key', 'Label', 'Tipe', 'Wajib', 'Status', 'Aksi']}>
                  {fields.map(field => (
                    <tr key={field.id}>
                      <td className="font-mono text-xs">{field.key}</td>
                      <td className="font-medium">{field.label}</td>
                      <td><Badge variant="default">{FIELD_TYPE_LABELS[field.type as FieldType] || field.type}</Badge></td>
                      <td>{field.required ? <Badge variant="warning">Wajib</Badge> : '-'}</td>
                      <td>
                        <button onClick={() => handleToggleActive(field)}>
                          <Badge variant={field.isActive ? 'success' : 'destructive'}>
                            {field.isActive ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </button>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <ActionButton variant="ghost" size="sm" icon={Edit} onClick={() => handleEdit(field)} />
                          <ActionButton variant="ghost" size="sm" icon={Trash2} onClick={() => handleDelete(field.id)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </>
          )}

          {/* SUBMISSIONS TAB */}
          {activeTab === 'submissions' && (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                {submissions.total} jawaban terkumpul.
              </p>
              {submissions.items.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  Belum ada jawaban yang masuk.
                </div>
              ) : (
                <DataTable headers={['MAC', 'Tgl Submit', 'Jawaban']}>
                  {submissions.items.map(sub => (
                    <tr key={sub.id}>
                      <td className="font-mono text-xs">{sub.macAddress}</td>
                      <td className="text-xs">{new Date(sub.createdAt).toLocaleString('id-ID')}</td>
                      <td className="text-xs max-w-[300px]">
                        <div className="space-y-0.5">
                          {sub.answers.map((a, i) => (
                            <span key={i} className="inline-block mr-2">
                              <span className="text-muted-foreground">{a.label}: </span>
                              <span className="font-medium">{a.value}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}