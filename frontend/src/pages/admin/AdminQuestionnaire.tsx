import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, Check, X, Loader2, ClipboardList, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
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

/** Ubah label menjadi slug (key) otomatis: "Nama Lengkap" → "nama_lengkap" */
const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
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

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

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
    setFormData({ key: '', label: '', type: 'TEXT', options: '', placeholder: '', required: false, isActive: true });
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
      isActive: field.isActive,
    });
    setEditId(field.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.label.trim()) {
      toast.error('Label wajib diisi');
      return;
    }

    // Auto-generate key dari label saat tambah baru; saat edit, pakai key yang sudah ada
    const key = editId ? formData.key : slugify(formData.label);
    if (!key) {
      toast.error('Gagal membuat kunci dari label');
      return;
    }

    setIsProcessing(true);
    try {
      const payload = {
        key,
        label: formData.label.trim(),
        type: formData.type,
        ...(formData.type === 'SELECT' && formData.options.trim() ? { options: formData.options.split('\n').filter(s => s.trim()) } : {}),
        placeholder: formData.placeholder || undefined,
        required: formData.required,
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

  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= fields.length) return;

    const newFields = [...fields];
    const [movedItem] = newFields.splice(index, 1);
    newFields.splice(targetIndex, 0, movedItem);

    // Update state dulu agar UI responsif seketika
    setFields(newFields);

    try {
      const orderedIds = newFields.map(f => f.id);
      await questionnaireApi.reorderFields(orderedIds);
      toast.success('Urutan pertanyaan diperbarui');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Gagal memperbarui urutan'));
      loadData(); // rollback jika gagal
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      return;
    }

    const newFields = [...fields];
    const [movedItem] = newFields.splice(draggedIndex, 1);
    newFields.splice(targetIndex, 0, movedItem);

    setDraggedIndex(null);
    setFields(newFields);

    try {
      const orderedIds = newFields.map(f => f.id);
      await questionnaireApi.reorderFields(orderedIds);
      toast.success('Urutan pertanyaan diperbarui');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Gagal memperbarui urutan'));
      loadData();
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
      <div className="min-h-screen bg-background">
        <AdminSidebar />
        <main className="admin-content flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <main className="admin-content">
        <AdminHeader title="Kuesioner" subtitle="Kelola pertanyaan dan jawaban kuesioner" />

        <div className="p-6">
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
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-foreground mb-1">Pertanyaan</label>
                      <input
                        type="text"
                        value={formData.label}
                        onChange={e => setFormData(p => ({ ...p, label: e.target.value }))}
                        placeholder="contoh: Nama Lengkap"
                        className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                      {!editId && formData.label.trim() && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Kunci: <span className="font-mono">{slugify(formData.label)}</span>
                        </p>
                      )}
                    </div>
                    <div className="col-span-2 sm:col-span-1">
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
                <DataTable headers={['Urutan', 'Key', 'Label', 'Tipe', 'Wajib', 'Status', 'Aksi']}>
                  {fields.map((field, index) => (
                    <tr
                      key={field.id}
                      draggable
                      onDragStart={e => handleDragStart(e, index)}
                      onDragOver={handleDragOver}
                      onDrop={e => handleDrop(e, index)}
                      className={`transition-colors cursor-grab active:cursor-grabbing ${
                        draggedIndex === index ? 'opacity-40 bg-primary/10 border-dashed border-primary' : 'hover:bg-muted/40'
                      }`}
                    >
                      <td className="w-24">
                        <div className="flex items-center gap-1.5">
                          <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab active:cursor-grabbing shrink-0" />
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-secondary text-xs font-semibold">
                            {index + 1}
                          </span>
                          <div className="flex flex-col gap-0.5 ml-1">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={(e) => { e.stopPropagation(); handleMoveOrder(index, 'up'); }}
                              className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:hover:text-muted-foreground transition-colors"
                              title="Pindah ke atas"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={index === fields.length - 1}
                              onClick={(e) => { e.stopPropagation(); handleMoveOrder(index, 'down'); }}
                              className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:hover:text-muted-foreground transition-colors"
                              title="Pindah ke bawah"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </td>
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
      </main>
    </div>
  );
}