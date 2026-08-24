import { useState, useEffect } from 'react';
import {
  Router as RouterIcon,
  Wifi,
  WifiOff,
  Plus,
  RefreshCw,
  Edit,
  Trash2,
  FileCode,
  Users,
  Copy,
  Check,
  X,
  Loader2,
  ShieldCheck,
  Activity,
  MapPin,
  Globe,
  Radio,
  Clock,
} from 'lucide-react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { ActionButton, Badge, DataTable } from '@/components/admin/AdminComponents';
import { toast } from 'sonner';
import { routerApi, type RouterGateway, type RouterActiveSession, userApi } from '@/services/api';
import { getErrorMessage } from '@/lib/error';

export default function AdminRouter() {
  const [activeTab, setActiveTab] = useState<'routers' | 'sessions'>('routers');
  const [routers, setRouters] = useState<RouterGateway[]>([]);
  const [sessions, setSessions] = useState<RouterActiveSession[]>([]);
  const [selectedRouterId, setSelectedRouterId] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Form State (Add / Edit)
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    host: '127.0.0.1',
    port: 8728,
    status: 'ACTIVE' as 'ACTIVE' | 'DISABLED',
  });
  const [isSaving, setIsSaving] = useState(false);

  // Script Modal State
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [scriptData, setScriptData] = useState<{ routerName: string; script: string } | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isLoadingScript, setIsLoadingScript] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [routersRes, sessionsRes] = await Promise.all([
        routerApi.getAll(),
        routerApi.getActiveSessions(),
      ]);
      setRouters(routersRes.data.data || []);
      setSessions(sessionsRes.data.data || []);
    } catch (error) {
      toast.error('Gagal memuat data router');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    await loadAllData(true);
    toast.success('Data router diperbarui');
  };

  const resetForm = () => {
    setFormData({
      name: '',
      location: '',
      host: '127.0.0.1',
      port: 8728,
      status: 'ACTIVE',
    });
    setEditId(null);
    setShowForm(false);
  };

  const handleEdit = (router: RouterGateway) => {
    setFormData({
      name: router.name,
      location: router.location || '',
      host: router.host,
      port: router.port,
      status: router.status,
    });
    setEditId(router.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Nama router / NAS-Identifier wajib diisi');
      return;
    }
    if (!formData.host.trim()) {
      toast.error('Host / IP router wajib diisi');
      return;
    }

    setIsSaving(true);
    try {
      if (editId) {
        await routerApi.update(editId, formData);
        toast.success('Router berhasil diupdate');
      } else {
        await routerApi.create(formData);
        toast.success('Router baru berhasil didaftarkan');
      }
      resetForm();
      loadAllData(true);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Gagal menyimpan router'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus router "${name}"? Seluruh sesi yang terhubung akan ditutup.`)) return;
    try {
      await routerApi.delete(id);
      toast.success('Router berhasil dihapus');
      loadAllData(true);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Gagal menghapus router'));
    }
  };

  const handleViewScript = async (routerId: string) => {
    setIsLoadingScript(true);
    try {
      const res = await routerApi.getScript(routerId);
      if (res.data.data) {
        setScriptData({
          routerName: res.data.data.routerName,
          script: res.data.data.script,
        });
        setShowScriptModal(true);
        setIsCopied(false);
      }
    } catch (error) {
      toast.error('Gagal mengambil script konfigurasi router');
    } finally {
      setIsLoadingScript(false);
    }
  };

  const handleCopyScript = () => {
    if (!scriptData) return;
    navigator.clipboard.writeText(scriptData.script);
    setIsCopied(true);
    toast.success('Script MikroTik berhasil disalin ke clipboard');
    setTimeout(() => setIsCopied(false), 2500);
  };

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${bytes} B`;
  };

  const formatUptime = (seconds: number): string => {
    if (!seconds || seconds <= 0) return '0 dtk';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}j ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}d`;
    return `${secs} dtk`;
  };

  const filteredSessions = selectedRouterId === 'all'
    ? sessions
    : sessions.filter(s => s.router === selectedRouterId);

  const totalOnlineRouters = routers.filter(r => r.isOnline).length;
  const totalActiveSessions = sessions.length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AdminSidebar />
        <main className="admin-content flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />

      <main className="admin-content">
        <AdminHeader title="Gateway Router" subtitle="Pusat monitoring Router & Direct RADIUS" />

        <div className="p-6 space-y-6 animate-fade-in">
          {/* Top Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="stat-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <RouterIcon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {totalOnlineRouters} <span className="text-sm font-normal text-muted-foreground">/ {routers.length}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">Router Terhubung</p>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalActiveSessions}</p>
                  <p className="text-xs text-muted-foreground">Klien Aktif (RADIUS)</p>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-base font-bold text-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-success inline-block animate-pulse" />
                    Direct RADIUS
                  </p>
                  <p className="text-xs text-muted-foreground">UDP 1812/1813 Aktif (Tanpa API/VPN)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('routers')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  activeTab === 'routers'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                Daftar Router ({routers.length})
              </button>
              <button
                onClick={() => setActiveTab('sessions')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  activeTab === 'sessions'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                Sesi Aktif ({sessions.length})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <ActionButton
                icon={RefreshCw}
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? 'Memuat...' : 'Refresh'}
              </ActionButton>
              {activeTab === 'routers' && (
                <ActionButton
                  variant="primary"
                  icon={Plus}
                  size="sm"
                  onClick={() => { resetForm(); setShowForm(true); }}
                >
                  Tambah Router
                </ActionButton>
              )}
            </div>
          </div>

          {/* ADD / EDIT FORM MODAL / CARD */}
          {showForm && (
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4 animate-scale-in shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <RouterIcon className="w-5 h-5 text-primary" />
                  {editId ? 'Edit Identitas Router' : 'Daftarkan Router Baru'}
                </h3>
                <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    NAS-Identifier (Nama Unik Router MikroTik) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(p => ({ ...p, name: e.target.value.toUpperCase() }))}
                    placeholder="contoh: ROUTER-001"
                    className="w-full h-10 px-3 font-mono rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 uppercase"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Harus sama dengan <code>/system identity</code> di MikroTik.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Lokasi / Penempatan
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={e => setFormData(p => ({ ...p, location: e.target.value }))}
                    placeholder="contoh: Lobby Utama / Kafe Lantai 2"
                    className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Host / IP Publik Router
                  </label>
                  <input
                    type="text"
                    value={formData.host}
                    onChange={e => setFormData(p => ({ ...p, host: e.target.value }))}
                    placeholder="127.0.0.1 / dynamic"
                    className="w-full h-10 px-3 font-mono rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Status Gateway
                  </label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData(p => ({ ...p, status: e.target.value as 'ACTIVE' | 'DISABLED' }))}
                    className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="ACTIVE">Aktif (Menerima Klien)</option>
                    <option value="DISABLED">Nonaktif (Blokir Sesi)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <ActionButton variant="ghost" size="sm" onClick={resetForm}>
                  Batal
                </ActionButton>
                <ActionButton variant="primary" size="sm" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Simpan Router
                </ActionButton>
              </div>
            </div>
          )}

          {/* TAB 1: DAFTAR ROUTER */}
          {activeTab === 'routers' && (
            <div className="space-y-4">
              {routers.length === 0 ? (
                <div className="stat-card text-center py-12 text-muted-foreground text-sm">
                  Belum ada router terdaftar.
                </div>
              ) : (
                <DataTable headers={['Status', 'Router (NAS-ID)', 'Lokasi', 'IP Host', 'Klien Online', 'Aktivitas Terakhir', 'Aksi']}>
                  {routers.map((router) => (
                    <tr key={router.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              router.isOnline ? 'bg-success animate-pulse' : 'bg-muted-foreground/40'
                            }`}
                          />
                          <span className={`text-xs font-medium ${router.isOnline ? 'text-success' : 'text-muted-foreground'}`}>
                            {router.isOnline ? 'Online' : 'Idle / Offline'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <RouterIcon className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-mono font-semibold text-foreground text-xs">
                            {router.name}
                          </span>
                        </div>
                      </td>
                      <td className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {router.location || '-'}
                        </div>
                      </td>
                      <td className="font-mono text-xs text-muted-foreground">
                        {router.host}
                      </td>
                      <td>
                        <Badge variant="default">
                          <Users className="w-3 h-3 mr-1 inline" />
                          {router.activeSessionsCount} Klien
                        </Badge>
                      </td>
                      <td className="text-xs text-muted-foreground">
                        {router.lastSeenAt
                          ? new Date(router.lastSeenAt).toLocaleString('id-ID', {
                              dateStyle: 'short',
                              timeStyle: 'medium',
                            })
                          : 'Belum pernah'}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <ActionButton
                            variant="ghost"
                            size="sm"
                            icon={FileCode}
                            title="Lihat Script MikroTik"
                            onClick={() => handleViewScript(router.id)}
                          />
                          <ActionButton
                            variant="ghost"
                            size="sm"
                            icon={Edit}
                            title="Edit"
                            onClick={() => handleEdit(router)}
                          />
                          <ActionButton
                            variant="ghost"
                            size="sm"
                            icon={Trash2}
                            title="Hapus"
                            onClick={() => handleDelete(router.id, router.name)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </div>
          )}

          {/* TAB 2: SESI AKTIF */}
          {activeTab === 'sessions' && (
            <div className="space-y-4">
              {/* Filter Router */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-muted-foreground">Filter Router:</span>
                <select
                  value={selectedRouterId}
                  onChange={e => setSelectedRouterId(e.target.value)}
                  className="h-9 px-3 rounded-xl border border-border bg-card text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="all">Semua Router ({sessions.length})</option>
                  {routers.map(r => (
                    <option key={r.name} value={r.name}>
                      {r.name} ({r.location || 'Utama'})
                    </option>
                  ))}
                </select>
              </div>

              {filteredSessions.length === 0 ? (
                <div className="stat-card text-center py-12 text-muted-foreground text-sm">
                  Tidak ada sesi hotspot aktif saat ini.
                </div>
              ) : (
                <DataTable headers={['Router', 'Pengguna / MAC', 'IP Address', 'Paket / Profil', 'Durasi', 'Unduhan / Unggahan', 'Mulai']}>
                  {filteredSessions.map((session) => (
                    <tr key={session.id}>
                      <td>
                        <Badge variant="default" className="font-mono text-[11px]">
                          {session.router}
                        </Badge>
                      </td>
                      <td>
                        <div>
                          <p className="font-mono text-xs font-semibold text-foreground">
                            {session.macAddress}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {session.userName} {session.voucherCode !== '-' && `(${session.voucherCode})`}
                          </p>
                        </div>
                      </td>
                      <td className="font-mono text-xs text-muted-foreground">
                        {session.ipAddress}
                      </td>
                      <td>
                        <Badge variant="outline" className="text-xs">
                          {session.profileName}
                        </Badge>
                      </td>
                      <td className="text-xs text-foreground font-medium">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          {formatUptime(session.uptimeSec)}
                        </div>
                      </td>
                      <td className="text-xs">
                        <span className="text-success font-mono font-medium">{formatBytes(session.bytesIn)}</span>
                        <span className="text-muted-foreground mx-1">/</span>
                        <span className="text-primary font-mono font-medium">{formatBytes(session.bytesOut)}</span>
                      </td>
                      <td className="text-xs text-muted-foreground">
                        {new Date(session.startedAt).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </div>
          )}
        </div>
      </main>

      {/* SCRIPT GENERATOR MODAL */}
      {showScriptModal && scriptData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-primary" />
                  Script Setup MikroTik — {scriptData.routerName}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Salin dan paste script ini ke Terminal MikroTik untuk mengaktifkan Direct RADIUS.
                </p>
              </div>
              <button
                onClick={() => setShowScriptModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative">
              <pre className="bg-muted p-4 rounded-xl font-mono text-xs text-foreground overflow-x-auto max-h-80 border border-border/80">
                {scriptData.script}
              </pre>
            </div>

            <div className="flex justify-between items-center pt-2">
              <p className="text-xs text-muted-foreground">
                Arsitektur Direct RADIUS (UDP 1812/1813) — CPU Ringan & Aman.
              </p>
              <div className="flex gap-2">
                <ActionButton
                  variant="primary"
                  size="sm"
                  icon={isCopied ? Check : Copy}
                  onClick={handleCopyScript}
                >
                  {isCopied ? 'Tersalin!' : 'Salin Script'}
                </ActionButton>
                <ActionButton variant="ghost" size="sm" onClick={() => setShowScriptModal(false)}>
                  Tutup
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
