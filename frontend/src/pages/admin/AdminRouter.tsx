import { useState, useEffect } from 'react';
import { AlertTriangle, Wifi, WifiOff, Settings, RefreshCw, Users, Loader2, CheckCircle, XCircle, Server, Activity, BarChart3 } from 'lucide-react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { ActionButton, Badge } from '@/components/admin/AdminComponents';
import { MonitoringDashboardSection } from '@/components/admin/MonitoringDashboard';
import { toast } from 'sonner';
import { mikrotikApi, settingApi } from '@/services/api';

interface HotspotUser {
  '.id': string;
  name: string;
  password?: string;
  profile: string;
  'mac-address'?: string;
  comment?: string;
  disabled: string;
}

interface ActiveSession {
  '.id': string;
  user: string;
  address: string;
  'mac-address': string;
  uptime: string;
  'bytes-in'?: string;
  'bytes-out'?: string;
}

interface HotspotProfile {
  '.id': string;
  name: string;
  'shared-users': string;
  'rate-limit'?: string;
}

interface RouterStatus {
  connected: boolean;
  host: string;
  port: string;
  username: string;
}

type ModalType = 'disconnect' | null;

export default function AdminRouter() {
  // Real data from Mikrotik API
  const [routerStatus, setRouterStatus] = useState<RouterStatus | null>(null);
  const [hotspotUsers, setHotspotUsers] = useState<HotspotUser[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [hotspotProfiles, setHotspotProfiles] = useState<HotspotProfile[]>([]);
  
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState<string | null>(null);
  
  const [modalType, setModalType] = useState<ModalType>(null);
  const [selectedSession, setSelectedSession] = useState<ActiveSession | null>(null);
  const [activeTab, setActiveTab] = useState<'monitoring' | 'sessions' | 'users' | 'profiles'>('monitoring');

  // Load initial data
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      // Load Mikrotik settings
      const settingsRes = await settingApi.getMikrotik();
      const config = (settingsRes.data.data || {}) as { host?: string; port?: string; username?: string };
      
      const host = config.host || '';
      const port = config.port || '8728';
      const username = config.username || 'admin';

      // Check connection status
      const statusRes = await mikrotikApi.getStatus();
      const connected = statusRes.data.data?.connected || false;
      
      setRouterStatus({ connected, host, port, username });

      if (connected) {
        await loadMikrotikData();
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setRouterStatus({ connected: false, host: '', port: '8728', username: 'admin' });
    } finally {
      setIsLoading(false);
    }
  };

  const loadMikrotikData = async () => {
    try {
      const [usersRes, sessionsRes, profilesRes] = await Promise.all([
        mikrotikApi.getUsers(),
        mikrotikApi.getActiveSessions(),
        mikrotikApi.getProfiles(),
      ]);

      setHotspotUsers(usersRes.data.data || []);
      setActiveSessions(sessionsRes.data.data || []);
      setHotspotProfiles(profilesRes.data.data || []);
    } catch (error) {
      console.error('Error loading Mikrotik data:', error);
      toast.error('Gagal memuat data dari Mikrotik');
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const res = await mikrotikApi.connect();
      if (res.data.data?.connected) {
        toast.success('Berhasil terhubung ke Mikrotik');
        setRouterStatus(prev => prev ? { ...prev, connected: true } : null);
        await loadMikrotikData();
      } else {
        toast.error('Gagal terhubung ke Mikrotik');
      }
    } catch (error) {
      toast.error('Gagal terhubung ke Mikrotik');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadMikrotikData();
      toast.success('Data berhasil diperbarui');
    } catch (error) {
      toast.error('Gagal memperbarui data');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDisconnectUser = async (username: string) => {
    setIsDisconnecting(username);
    try {
      await mikrotikApi.disconnect(username);
      toast.success(`User ${username} berhasil diputuskan`);
      await loadMikrotikData();
    } catch (error) {
      toast.error('Gagal memutuskan user');
    } finally {
      setIsDisconnecting(null);
      setModalType(null);
      setSelectedSession(null);
    }
  };

  const openDisconnectModal = (session: ActiveSession) => {
    setSelectedSession(session);
    setModalType('disconnect');
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedSession(null);
  };

  const formatBytes = (bytes: string | undefined) => {
    if (!bytes) return '0 B';
    const num = parseInt(bytes, 10);
    if (num < 1024) return `${num} B`;
    if (num < 1048576) return `${(num / 1024).toFixed(1)} KB`;
    if (num < 1073741824) return `${(num / 1048576).toFixed(1)} MB`;
    return `${(num / 1073741824).toFixed(2)} GB`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AdminSidebar />
        <main className="admin-content">
          <AdminHeader title="Router Management" subtitle="Mikrotik Hotspot Monitoring" />
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      
      <main className="admin-content">
        <AdminHeader title="Router Management" subtitle="Mikrotik Hotspot Monitoring" />
        
        <div className="p-6 space-y-6 animate-fade-in">
          {/* Connection Status */}
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${routerStatus?.connected ? 'bg-success/10' : 'bg-destructive/10'}`}>
                  {routerStatus?.connected ? (
                    <CheckCircle className="w-6 h-6 text-success" />
                  ) : (
                    <XCircle className="w-6 h-6 text-destructive" />
                  )}
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">
                    {routerStatus?.connected ? 'Terhubung ke Mikrotik' : 'Tidak Terhubung'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {routerStatus?.host ? `${routerStatus.host}:${routerStatus.port}` : 'Belum dikonfigurasi'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {routerStatus?.connected ? (
                  <ActionButton 
                    icon={RefreshCw} 
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                  >
                    {isRefreshing ? 'Memuat...' : 'Refresh'}
                  </ActionButton>
                ) : (
                  <ActionButton 
                    variant="primary" 
                    icon={Wifi} 
                    onClick={handleConnect}
                    disabled={isConnecting}
                  >
                    {isConnecting ? 'Menghubungkan...' : 'Hubungkan'}
                  </ActionButton>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          {routerStatus?.connected && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="stat-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                    <Wifi className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{activeSessions.length}</p>
                    <p className="text-sm text-muted-foreground">Active Sessions</p>
                  </div>
                </div>
              </div>
              <div className="stat-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{hotspotUsers.length}</p>
                    <p className="text-sm text-muted-foreground">Hotspot Users</p>
                  </div>
                </div>
              </div>
              <div className="stat-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                    <Server className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{hotspotProfiles.length}</p>
                    <p className="text-sm text-muted-foreground">Profiles</p>
                  </div>
                </div>
              </div>
              <div className="stat-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {hotspotUsers.filter(u => u.disabled === 'false').length}
                    </p>
                    <p className="text-sm text-muted-foreground">Enabled Users</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          {routerStatus?.connected && (
            <>
              <div className="flex gap-2 border-b border-border overflow-x-auto">
                <button
                  onClick={() => setActiveTab('monitoring')}
                  className={`px-4 py-2 font-medium text-sm transition-colors whitespace-nowrap flex items-center gap-2 ${
                    activeTab === 'monitoring'
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Monitoring
                </button>
                <button
                  onClick={() => setActiveTab('sessions')}
                  className={`px-4 py-2 font-medium text-sm transition-colors whitespace-nowrap ${
                    activeTab === 'sessions'
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Active Sessions ({activeSessions.length})
                </button>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`px-4 py-2 font-medium text-sm transition-colors whitespace-nowrap ${
                    activeTab === 'users'
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Hotspot Users ({hotspotUsers.length})
                </button>
                <button
                  onClick={() => setActiveTab('profiles')}
                  className={`px-4 py-2 font-medium text-sm transition-colors whitespace-nowrap ${
                    activeTab === 'profiles'
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Profiles ({hotspotProfiles.length})
                </button>
              </div>

              {/* Monitoring Tab */}
              {activeTab === 'monitoring' && (
                <MonitoringDashboardSection isConnected={routerStatus?.connected || false} />
              )}

              {/* Active Sessions Tab */}
              {activeTab === 'sessions' && (
                <div className="stat-card">
                  <h3 className="font-semibold text-foreground mb-4">Active Sessions</h3>
                  {activeSessions.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">Tidak ada sesi aktif</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">User</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">IP Address</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">MAC Address</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Uptime</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Download</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Upload</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeSessions.map((session) => (
                            <tr key={session['.id']} className="border-b border-border/50 hover:bg-secondary/50">
                              <td className="py-3 px-4 font-medium">{session.user}</td>
                              <td className="py-3 px-4 font-mono text-sm">{session.address}</td>
                              <td className="py-3 px-4 font-mono text-sm">{session['mac-address']}</td>
                              <td className="py-3 px-4 text-sm">{session.uptime}</td>
                              <td className="py-3 px-4 text-sm text-success">{formatBytes(session['bytes-in'])}</td>
                              <td className="py-3 px-4 text-sm text-primary">{formatBytes(session['bytes-out'])}</td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  onClick={() => openDisconnectModal(session)}
                                  disabled={isDisconnecting === session.user}
                                  className="px-3 py-1 text-sm bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 disabled:opacity-50"
                                >
                                  {isDisconnecting === session.user ? 'Disconnecting...' : 'Disconnect'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Hotspot Users Tab */}
              {activeTab === 'users' && (
                <div className="stat-card">
                  <h3 className="font-semibold text-foreground mb-4">Hotspot Users</h3>
                  {hotspotUsers.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">Tidak ada user</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Username</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Profile</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">MAC Address</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Comment</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hotspotUsers.map((user) => (
                            <tr key={user['.id']} className="border-b border-border/50 hover:bg-secondary/50">
                              <td className="py-3 px-4 font-medium">{user.name}</td>
                              <td className="py-3 px-4">
                                <Badge variant="default">{user.profile}</Badge>
                              </td>
                              <td className="py-3 px-4 font-mono text-sm">{user['mac-address'] || '-'}</td>
                              <td className="py-3 px-4 text-sm text-muted-foreground">{user.comment || '-'}</td>
                              <td className="py-3 px-4">
                                <Badge variant={user.disabled === 'false' ? 'success' : 'destructive'}>
                                  {user.disabled === 'false' ? 'Enabled' : 'Disabled'}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Profiles Tab */}
              {activeTab === 'profiles' && (
                <div className="stat-card">
                  <h3 className="font-semibold text-foreground mb-4">Hotspot Profiles</h3>
                  {hotspotProfiles.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">Tidak ada profile</p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {hotspotProfiles.map((profile) => (
                        <div key={profile['.id']} className="bg-secondary rounded-xl p-4">
                          <h4 className="font-semibold text-foreground mb-2">{profile.name}</h4>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            <p>Shared Users: {profile['shared-users']}</p>
                            {profile['rate-limit'] && <p>Rate Limit: {profile['rate-limit']}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Not Connected Message */}
          {!routerStatus?.connected && (
            <div className="stat-card text-center py-12">
              <WifiOff className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Tidak Terhubung ke Mikrotik</h3>
              <p className="text-muted-foreground mb-4">
                Konfigurasi koneksi Mikrotik di halaman Settings terlebih dahulu.
              </p>
              <ActionButton variant="primary" icon={Settings} onClick={() => window.location.href = '/admin/settings'}>
                Ke Pengaturan
              </ActionButton>
            </div>
          )}
        </div>
      </main>

      {/* Disconnect Confirmation Modal */}
      {modalType === 'disconnect' && selectedSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-2xl w-full max-w-md p-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Putuskan Koneksi User?</h2>
            </div>
            <p className="text-muted-foreground mb-6">
              User <strong>{selectedSession.user}</strong> dengan IP <strong>{selectedSession.address}</strong> akan diputuskan dari jaringan.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Batal
              </button>
              <button
                onClick={() => handleDisconnectUser(selectedSession.user)}
                disabled={isDisconnecting !== null}
                className="px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50"
              >
                {isDisconnecting ? 'Memutuskan...' : 'Ya, Putuskan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
