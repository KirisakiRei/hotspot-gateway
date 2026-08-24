import { useState, useEffect } from 'react';
import { Plus, Settings, Trash2, Edit, X, AlertTriangle, Send, Loader2, Check } from 'lucide-react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Badge, ActionButton } from '@/components/admin/AdminComponents';
import { toast } from 'sonner';
import { voucherApi, type VoucherProfile, type Voucher, settingApi } from '@/services/api';
import { getErrorMessage } from '@/lib/error';

type ModalType = 'add' | 'edit' | 'delete' | 'generate' | null;

export default function AdminVouchers() {
  const [showGenerator, setShowGenerator] = useState(true);
  const [profiles, setProfiles] = useState<VoucherProfile[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Portal access profile mapping (dikelola dari admin, disimpan di Setting DB)
  const [portalProfileIds, setPortalProfileIds] = useState({ free: '', survey: '' });
  const [isSavingPortalProfiles, setIsSavingPortalProfiles] = useState(false);
  
  // Modal states
  const [modalType, setModalType] = useState<ModalType>(null);
  const [selectedProfile, setSelectedProfile] = useState<VoucherProfile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false); // Prevent double-click

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [profilesRes, vouchersRes, mappingRes] = await Promise.all([
        voucherApi.getProfiles(),
        voucherApi.getAll(),
        settingApi.getPortalProfileMapping(),
      ]);
      setProfiles(profilesRes.data.data!);
      setVouchers(vouchersRes.data.data!);
      setPortalProfileIds({
        free: mappingRes.data.data?.freeProfileId || '',
        survey: mappingRes.data.data?.surveyProfileId || '',
      });
    } catch (error) {
      toast.error('Gagal memuat data voucher');
    } finally {
      setIsLoading(false);
    }
  };

  const savePortalProfileMapping = async () => {
    setIsSavingPortalProfiles(true);
    try {
      await settingApi.updatePortalProfileMapping(portalProfileIds);
      toast.success('Profil akses portal disimpan');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Gagal menyimpan'));
    } finally {
      setIsSavingPortalProfiles(false);
    }
  };
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    duration: 60, // in minutes
    durationUnit: 'min', // for UI conversion
    quotaValue: 500, // numeric value for UI
    quotaUnit: 'MB' as 'MB' | 'GB',
    uploadSpeed: 2048,
    downloadSpeed: 2048,
    sharedUsers: 1,
    validityDays: 1,
    price: 5000,
    isActive: true,
    color: 'blue',
  });

  // Generate voucher settings
  const [generateSettings, setGenerateSettings] = useState({
    profileId: '',
    count: 10,
    prefix: '',
    length: 8,
    batchName: '',
    format: 'number' as 'number' | 'text' | 'mixed' | 'mixed_upper',
  });

  // Helper: Convert quota bytes to display value
  const parseQuotaForDisplay = (quota: number | string | null | undefined): { value: number; unit: 'MB' | 'GB' } => {
    if (!quota) return { value: 0, unit: 'MB' };
    const bytes = typeof quota === 'string' ? parseInt(quota) : quota;
    if (bytes >= 1024 * 1024 * 1024) {
      return { value: Math.round(bytes / (1024 * 1024 * 1024)), unit: 'GB' };
    }
    return { value: Math.round(bytes / (1024 * 1024)), unit: 'MB' };
  };

  // Helper: Convert quota display value to bytes
  const quotaToBytes = (value: number | null, unit: 'MB' | 'GB'): number | null => {
    if (!value || value === 0) return null; // null = unlimited
    if (unit === 'GB') return value * 1024 * 1024 * 1024;
    return value * 1024 * 1024;
  };

  // Helper: Convert duration based on unit
  const convertDurationToMinutes = (value: number, unit: string): number => {
    if (unit === 'hours') return value * 60;
    if (unit === 'days') return value * 60 * 24;
    return value; // already minutes
  };

  const openAddModal = () => {
    setFormData({
      name: '',
      description: '',
      duration: 60,
      durationUnit: 'min',
      quotaValue: 500,
      quotaUnit: 'MB',
      uploadSpeed: 2048,
      downloadSpeed: 2048,
      sharedUsers: 1,
      validityDays: 1,
      price: 5000,
      isActive: true,
      color: 'blue',
    });
    setModalType('add');
  };

  const openEditModal = (profile: VoucherProfile) => {
    setSelectedProfile(profile);
    const quotaDisplay = parseQuotaForDisplay(profile.quota);
    setFormData({
      name: profile.name,
      description: profile.description || '',
      duration: profile.duration,
      durationUnit: 'min',
      quotaValue: quotaDisplay.value,
      quotaUnit: quotaDisplay.unit,
      uploadSpeed: profile.uploadSpeed || 2048,
      downloadSpeed: profile.downloadSpeed || 2048,
      sharedUsers: profile.sharedUsers,
      validityDays: profile.validityDays,
      price: profile.price || 0,
      isActive: profile.isActive,
      color: 'blue',
    });
    setModalType('edit');
  };

  const openDeleteModal = (profile: VoucherProfile) => {
    setSelectedProfile(profile);
    setModalType('delete');
  };

  const openGenerateModal = () => {
    setGenerateSettings({
      profileId: profiles[0]?.id || '',
      count: 10,
      prefix: '',
      length: 8,
      batchName: `Batch ${new Date().toLocaleDateString()}`,
      format: 'number',
    });
    setModalType('generate');
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedProfile(null);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Prepare data for API - convert UI values to backend format
      const apiData: Partial<VoucherProfile> & { duration: number; sharedUsers: number; validityDays: number; price: number; isActive: boolean } = {
        name: formData.name,
        duration: parseInt(convertDurationToMinutes(formData.duration, formData.durationUnit).toString()),
        sharedUsers: parseInt(formData.sharedUsers?.toString() || '1'),
        validityDays: parseInt(formData.validityDays?.toString() || '30'),
        price: parseFloat(formData.price?.toString() || '0'),
        isActive: formData.isActive !== false,
      };

      // Add optional fields only if they have values
      if (formData.description) {
        apiData.description = formData.description;
      }
      
      const quotaBytes = quotaToBytes(formData.quotaValue, formData.quotaUnit);
      if (quotaBytes !== null) {
        apiData.quota = quotaBytes;
      }
      
      if (formData.uploadSpeed) {
        apiData.uploadSpeed = parseInt(formData.uploadSpeed.toString());
      }
      
      if (formData.downloadSpeed) {
        apiData.downloadSpeed = parseInt(formData.downloadSpeed.toString());
      }

      if (selectedProfile) {
        await voucherApi.updateProfile(selectedProfile.id, apiData);
        toast.success('Profil voucher berhasil diupdate');
      } else {
        await voucherApi.createProfile(apiData);
        toast.success('Profil voucher berhasil ditambahkan');
      }
      
      await loadData();
      closeModal();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Gagal menyimpan profil'));
    }
  };

  const handleDeleteProfile = async (forceDelete = false) => {
    if (!selectedProfile) return;
    if (isProcessing) return; // Prevent double-click
    
    setIsProcessing(true);
    try {
      await voucherApi.deleteProfile(selectedProfile.id, forceDelete);
      toast.success('Profil voucher berhasil dihapus');
      await loadData();
      closeModal();
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Gagal menghapus profil');
      
      // Check if error is about vouchers using this profile
      if (errorMessage.includes('vouchers are using')) {
        toast.error(errorMessage);
      } else if (errorMessage.includes('Mikrotik')) {
        toast.error(`Koneksi MikroTik gagal. ${errorMessage}`);
      } else if (errorMessage.includes('not found') || errorMessage.includes('No record')) {
        // Profile already deleted (by another request), just close and reload
        toast.info('Profil sudah terhapus');
        await loadData();
        closeModal();
      } else {
        toast.error(errorMessage);
      }
      console.error('Delete profile error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateVouchers = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!generateSettings.profileId) {
      toast.error('Pilih profil voucher');
      return;
    }
    
    try {
      const response = await voucherApi.generate(generateSettings);
      toast.success(`Berhasil membuat ${response.data.data!.length} voucher`);
      await loadData();
      closeModal();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Gagal membuat voucher'));
    }
  };

  // Generate preview code based on format
  const generateVoucherPreview = (format: string, length: number) => {
    switch (format) {
      case 'number':
        return '0'.repeat(length).split('').map((_, i) => (i + 1) % 10).join('');
      case 'text':
        return 'A'.repeat(length).split('').map((_, i) => String.fromCharCode(65 + (i % 26))).join('');
      case 'mixed':
        return 'a1b2c3d4e5f6'.substring(0, length);
      case 'mixed_upper':
        return 'A1B2C3D4E5F6'.substring(0, length);
      default:
        return 'X'.repeat(length);
    }
  };

  // Save voucher generate settings to database
  const saveVoucherSettings = async () => {
    try {
      // Save to settings API as voucher_generate_settings
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/settings/voucher/generate-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({
          profileId: generateSettings.profileId,
          prefix: generateSettings.prefix,
          length: generateSettings.length,
          format: generateSettings.format,
        }),
      });
      
      if (response.ok) {
        toast.success('Pengaturan voucher berhasil disimpan');
      } else {
        toast.error('Gagal menyimpan settings');
      }
    } catch (error) {
      toast.error('Gagal menyimpan settings');
    }
  };

  // Load saved voucher settings on mount
  const loadVoucherSettings = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/settings/voucher/generate-settings`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.data) {
          setGenerateSettings(prev => ({
            ...prev,
            profileId: result.data.profileId || '',
            prefix: result.data.prefix || '',
            length: result.data.length || 8,
            format: result.data.format || 'number',
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load voucher settings:', error);
    }
  };

  // Load settings when component mounts
  useEffect(() => {
    loadVoucherSettings();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const formatDuration = (duration: number) => {
    const hours = Math.floor(duration / 60);
    const mins = duration % 60;
    if (hours > 0) return `${hours} jam${mins > 0 ? ` ${mins} menit` : ''}`;
    return `${mins} menit`;
  };

  const formatQuota = (quota: number | string | null | undefined) => {
    if (!quota) return 'Unlimited';
    const bytes = typeof quota === 'string' ? parseInt(quota) : quota;
    if (isNaN(bytes)) return 'Unlimited';
    if (bytes >= 1024 * 1024 * 1024) {
      return `${Math.round(bytes / (1024 * 1024 * 1024))} GB`;
    }
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(price);
  };

  const colorOptions = ['bg-primary', 'bg-success', 'bg-warning', 'bg-destructive', 'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500'];

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      
      <main className="admin-content">
        <AdminHeader title="Manajemen Voucher" subtitle="Buat dan atur profil voucher" />
        
        <div className="p-6 space-y-6 animate-fade-in">
          {/* Voucher Profiles */}
          <div className="stat-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Profil Voucher</h2>
              <ActionButton variant="primary" icon={Plus} onClick={openAddModal}>
                Tambah Profil
              </ActionButton>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {profiles.map((profile) => (
                <div key={profile.id} className="bg-secondary rounded-xl p-4 relative group">
                  <div className={`w-3 h-3 rounded-full ${profile.isActive ? 'bg-success' : 'bg-secondary'} absolute top-4 right-4`} />
                  <h3 className="font-semibold text-foreground mb-3 pr-6">{profile.name}</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Durasi</span>
                      <span className="text-foreground">{formatDuration(profile.duration)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Kuota</span>
                      <span className="text-foreground">{formatQuota(profile.quota)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Harga</span>
                      <span className="text-foreground font-medium">{formatPrice(profile.price)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => openEditModal(profile)}
                      className="flex-1 h-8 rounded-lg bg-background text-foreground text-xs font-medium flex items-center justify-center gap-1 hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                      <Edit className="w-3 h-3" />
                      Edit
                    </button>
                    <button 
                      onClick={() => openDeleteModal(profile)}
                      className="w-8 h-8 rounded-lg bg-background flex items-center justify-center hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Portal Access Profile Mapping */}
          <div className="stat-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-foreground">Profil Akses Portal</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Pilih profil voucher yang dipakai saat user memilih akses di portal
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Konek Langsung (1 Jam)
                </label>
                <select
                  value={portalProfileIds.free}
                  onChange={(e) => setPortalProfileIds(prev => ({ ...prev, free: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary"
                >
                  <option value="">-- Pilih Profil --</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Isi Kuesioner (1 Hari)
                </label>
                <select
                  value={portalProfileIds.survey}
                  onChange={(e) => setPortalProfileIds(prev => ({ ...prev, survey: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary"
                >
                  <option value="">-- Pilih Profil --</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={savePortalProfileMapping}
                disabled={isSavingPortalProfiles}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50"
              >
                {isSavingPortalProfiles ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Simpan
              </button>
            </div>
          </div>

          {/* Generator Settings Card */}
          <div className="stat-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-foreground">Pengaturan Pembuatan Voucher</h2>
                <p className="text-sm text-muted-foreground mt-1">Pengaturan pembuatan voucher otomatis untuk akses gratis portal</p>
              </div>
              <button 
                onClick={() => setShowGenerator(!showGenerator)}
                className="text-primary text-sm font-medium hover:underline flex items-center gap-1"
              >
                <Settings className="w-4 h-4" />
                {showGenerator ? 'Sembunyikan' : 'Tampilkan'} opsi
              </button>
            </div>

            {showGenerator && (
              <div className="space-y-6 animate-fade-in">
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Send className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <h4 className="font-medium text-foreground">Pembuatan otomatis akses gratis</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Voucher akan dibuat otomatis setelah pengguna menonton video iklan di portal.
                        Pengaturan di bawah ini menentukan format kode voucher.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Profil default</label>
                    <select 
                      value={generateSettings.profileId}
                      onChange={(e) => setGenerateSettings(prev => ({ ...prev, profileId: e.target.value }))}
                      className="w-full h-10 px-3 rounded-xl bg-secondary border-0 text-sm"
                    >
                      <option value="">-- Pilih profil --</option>
                      {profiles.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Awalan (opsional)</label>
                    <input
                      type="text"
                      maxLength={3}
                      value={generateSettings.prefix}
                      onChange={(e) => setGenerateSettings(prev => ({ ...prev, prefix: e.target.value.toUpperCase() }))}
                      placeholder="contoh: VIP"
                      className="w-full h-10 px-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Format kode</label>
                    <select 
                      value={generateSettings.format}
                      onChange={(e) => setGenerateSettings(prev => ({ ...prev, format: e.target.value as 'number' | 'text' | 'mixed' | 'mixed_upper' }))}
                      className="w-full h-10 px-3 rounded-xl bg-secondary border-0 text-sm"
                    >
                      <option value="number">Angka acak</option>
                      <option value="text">Huruf acak (kapital)</option>
                      <option value="mixed">Angka dan huruf</option>
                      <option value="mixed_upper">Angka dan huruf (kapital)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Panjang kode</label>
                    <select 
                      value={generateSettings.length}
                      onChange={(e) => setGenerateSettings(prev => ({ ...prev, length: Number(e.target.value) }))}
                      className="w-full h-10 px-3 rounded-xl bg-secondary border-0 text-sm"
                    >
                      <option value={4}>4 karakter</option>
                      <option value={6}>6 karakter</option>
                      <option value={8}>8 karakter</option>
                      <option value={10}>10 karakter</option>
                      <option value={12}>12 karakter</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Pratinjau</label>
                    <div className="h-10 px-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <span className="font-mono text-primary font-medium">
                        {generateSettings.prefix}{generateVoucherPreview(generateSettings.format, generateSettings.length)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <ActionButton variant="primary" icon={Settings} onClick={saveVoucherSettings}>
                    Simpan Pengaturan
                  </ActionButton>
                </div>
              </div>
            )}
          </div>

          {/* Voucher Settings Card */}
          <div className="stat-card">
            <h2 className="font-semibold text-foreground mb-4">Pengaturan Voucher</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground">Pengaturan umum</h3>
                
                <div className="flex items-center justify-between bg-secondary rounded-xl p-4">
                  <div>
                    <p className="font-medium text-foreground">Hapus otomatis voucher yang tidak terpakai</p>
                    <p className="text-sm text-muted-foreground">Voucher yang tidak dipakai akan dihapus setelah 30 hari</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between bg-secondary rounded-xl p-4">
                  <div>
                    <p className="font-medium text-foreground">Allow multiple devices</p>
                    <p className="text-sm text-muted-foreground">One voucher can be used on multiple devices</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground">Limits</h3>
                
                <div className="bg-secondary rounded-xl p-4">
                  <label className="block text-sm text-muted-foreground mb-2">Max devices per voucher</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    defaultValue={1}
                    className="w-full h-10 px-3 rounded-xl bg-background border-0 text-sm focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="bg-secondary rounded-xl p-4">
                  <label className="block text-sm text-muted-foreground mb-2">Session timeout (minutes)</label>
                  <input
                    type="number"
                    min="5"
                    max="1440"
                    defaultValue={60}
                    className="w-full h-10 px-3 rounded-xl bg-background border-0 text-sm focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Add/Edit Profile Modal */}
      {(modalType === 'add' || modalType === 'edit') && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-background rounded-2xl max-w-lg w-full shadow-elevated max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-background">
              <h2 className="text-lg font-semibold text-foreground">
                {modalType === 'add' ? 'Tambah Profile Voucher' : 'Edit Profile Voucher'}
              </h2>
              <button 
                onClick={closeModal}
                className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Nama Profile</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="contoh: 1 Jam - 500MB"
                  className="w-full h-10 px-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Durasi</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.duration || 30}
                    onChange={(e) => setFormData(prev => ({ ...prev, duration: Number(e.target.value) }))}
                    className="w-full h-10 px-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Unit</label>
                  <select
                    value={formData.durationUnit || 'min'}
                    onChange={(e) => setFormData(prev => ({ ...prev, durationUnit: e.target.value as 'min' | 'hours' | 'days' }))}
                    className="w-full h-10 px-3 rounded-xl bg-secondary border-0 text-sm"
                  >
                    <option value="min">Menit</option>
                    <option value="hours">Jam</option>
                    <option value="days">Hari</option>
                  </select>
                </div>
              </div>

              {/* Quota */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Quota (kosong = unlimited)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.quotaValue || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, quotaValue: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="Unlimited"
                    className="w-full h-10 px-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Unit</label>
                  <select
                    value={formData.quotaUnit || 'MB'}
                    onChange={(e) => setFormData(prev => ({ ...prev, quotaUnit: e.target.value as 'MB' | 'GB' }))}
                    className="w-full h-10 px-3 rounded-xl bg-secondary border-0 text-sm"
                  >
                    <option value="MB">MB</option>
                    <option value="GB">GB</option>
                  </select>
                </div>
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Harga (Rp)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.price || 0}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: Number(e.target.value) }))}
                  className="w-full h-10 px-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Speed Limits */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Upload Speed (kbps)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.uploadSpeed || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, uploadSpeed: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="Unlimited"
                    className="w-full h-10 px-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Download Speed (kbps)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.downloadSpeed || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, downloadSpeed: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="Unlimited"
                    className="w-full h-10 px-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Shared Users */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Max Devices</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.sharedUsers || 1}
                  onChange={(e) => setFormData(prev => ({ ...prev, sharedUsers: Number(e.target.value) }))}
                  className="w-full h-10 px-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Warna</label>
                <div className="flex gap-2 flex-wrap">
                  {colorOptions.map(color => (
                    <button
                      key={color}
                      onClick={() => setFormData(prev => ({ ...prev, color }))}
                      className={`w-8 h-8 rounded-full ${color} transition-transform ${formData.color === color ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-110'}`}
                    />
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={closeModal}
                  className="flex-1 h-10 rounded-xl bg-secondary text-foreground font-medium text-sm hover:bg-secondary/80 transition-colors"
                >
                  Batal
                </button>
                <button 
                  onClick={handleSaveProfile}
                  className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
                >
                  {modalType === 'add' ? 'Tambah' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {modalType === 'delete' && selectedProfile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-background rounded-2xl max-w-md w-full shadow-elevated">
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-7 h-7 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Hapus Profile Voucher</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Apakah Anda yakin ingin menghapus profile <strong>"{selectedProfile.name}"</strong>?
              </p>
              
              {/* Show voucher count warning */}
              {selectedProfile._count && selectedProfile._count.vouchers > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>⚠️ Perhatian:</strong> Profile ini memiliki{' '}
                    <strong>{selectedProfile._count.vouchers} voucher</strong> yang akan ikut terhapus.
                  </p>
                </div>
              )}
              
              <p className="text-xs text-muted-foreground mb-6">
                Tindakan ini tidak dapat dibatalkan.
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={closeModal}
                  disabled={isProcessing}
                  className="flex-1 h-10 rounded-xl bg-secondary text-foreground font-medium text-sm hover:bg-secondary/80 transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button 
                  onClick={() => handleDeleteProfile(selectedProfile._count?.vouchers ? true : false)}
                  disabled={isProcessing}
                  className="flex-1 h-10 rounded-xl bg-destructive text-destructive-foreground font-medium text-sm hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Menghapus...</span>
                    </>
                  ) : (
                    selectedProfile._count?.vouchers ? 'Hapus Semua' : 'Hapus'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
