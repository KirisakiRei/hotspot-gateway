import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Ticket, Wifi, Eye, Loader2, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { StatCard, Badge } from '@/components/admin/AdminComponents';
import { dashboardApi, type DashboardStats } from '@/services/api';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';

interface RecentUser {
  id: string;
  name: string;
  phone: string;
  mac: string;
  isOnline: boolean;
  createdAt: string;
}

interface RecentVoucher {
  id: string;
  code: string;
  status: 'UNUSED' | 'ACTIVE' | 'USED' | 'EXPIRED';
  profile?: { name: string };
  users?: { name: string }[];
  createdAt: string;
}

interface RecentLog {
  id: string;
  type: string;
  action: string;
  admin?: { name: string };
  createdAt: string;
}

export default function AdminOverview() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [recentVouchers, setRecentVouchers] = useState<RecentVoucher[]>([]);
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [statsRes, usersRes, vouchersRes, logsRes] = await Promise.all([
        dashboardApi.getStats(),
        dashboardApi.getRecentUsers(5),
        dashboardApi.getRecentVouchers(5),
        dashboardApi.getRecentLogs(5),
      ]);

      setStats(statsRes.data.data!);
      setRecentUsers((usersRes.data.data || []).map((user) => ({
        id: user.id,
        name: user.name || user.phone,
        phone: user.phone,
        mac: user.mac || user.macAddress || '-',
        isOnline: Boolean(user.isOnline),
        createdAt: user.createdAt,
      })));
      setRecentVouchers((vouchersRes.data.data || []).map((voucher) => ({
        id: voucher.id,
        code: voucher.code,
        status: voucher.status as RecentVoucher['status'],
        profile: voucher.profile,
        users: voucher.users,
        createdAt: voucher.createdAt || voucher.generatedAt || new Date().toISOString(),
      })));
      setRecentLogs(logsRes.data.data || []);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const userColumns = [
    { key: 'name', label: 'Nama' },
    { key: 'phone', label: 'Telepon' },
    { key: 'mac', label: 'MAC Address' },
    { key: 'createdAt', label: 'Terdaftar', render: (user: RecentUser) => formatDistanceToNow(new Date(user.createdAt), { addSuffix: true, locale: id }) },
    { key: 'isOnline', label: 'Status', render: (user: RecentUser) => user.isOnline ? <Badge variant="success">Online</Badge> : <Badge>Offline</Badge> },
  ];

  const voucherColumns = [
    { key: 'code', label: 'Kode Voucher' },
    { key: 'profile', label: 'Profil', render: (v: RecentVoucher) => v.profile?.name || '-' },
    { key: 'status', label: 'Status', render: (v: RecentVoucher) => {
      const colors = {
        UNUSED: 'default',
        ACTIVE: 'success',
        USED: 'secondary',
        EXPIRED: 'destructive'
      };
      const variantMap: Record<RecentVoucher['status'], 'default' | 'success' | 'destructive' | 'warning'> = {
        UNUSED: 'default',
        ACTIVE: 'success',
        USED: 'warning',
        EXPIRED: 'destructive',
      };
      return <Badge variant={variantMap[v.status]}>{v.status}</Badge>;
    }},
    { key: 'user', label: 'User', render: (v: RecentVoucher) => v.users?.[0]?.name || '-' },
    { key: 'createdAt', label: 'Dibuat', render: (v: RecentVoucher) => formatDistanceToNow(new Date(v.createdAt), { addSuffix: true, locale: id }) },
  ];

  const logColumns = [
    { key: 'type', label: 'Tipe', render: (log: RecentLog) => <Badge variant="default">{log.type}</Badge> },
    { key: 'action', label: 'Aksi' },
    { key: 'admin', label: 'Admin', render: (log: RecentLog) => log.admin?.name || 'System' },
    { key: 'createdAt', label: 'Waktu', render: (log: RecentLog) => formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: id }) },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      
      <main className="admin-content">
        <AdminHeader title="Dashboard" subtitle="Selamat datang kembali, Admin" />
        
        <div className="p-6 space-y-6 animate-fade-in">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard 
              icon={Users} 
              label="Total Users" 
              value={stats?.users.total.toString() || '0'}
            />
            <StatCard 
              icon={Wifi} 
              label="Sesi Aktif" 
              value={stats?.sessions.active.toString() || '0'}
              iconBg="bg-success/10"
            />
            <StatCard 
              icon={Ticket} 
              label="Total Vouchers" 
              value={stats?.vouchers.total.toString() || '0'}
              iconBg="bg-warning/10"
            />
            <StatCard 
              icon={Eye} 
              label="Views Iklan" 
              value={stats?.advertisements.totalViews.toString() || '0'}
              iconBg="bg-info/10"
            />
          </div>

          {/* Detailed Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* User Stats */}
            <div className="stat-card">
              <h3 className="text-sm font-medium text-foreground mb-4">Statistik User</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" />
                    <span className="text-sm text-muted-foreground">Online</span>
                  </div>
                  <span className="font-medium text-foreground">{stats?.users.online || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Offline</span>
                  </div>
                  <span className="font-medium text-foreground">{stats?.users.offline || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-destructive" />
                    <span className="text-sm text-muted-foreground">Diblokir</span>
                  </div>
                  <span className="font-medium text-foreground">{stats?.users.blocked || 0}</span>
                </div>
              </div>
            </div>

            {/* Voucher Stats */}
            <div className="stat-card">
              <h3 className="text-sm font-medium text-foreground mb-4">Statistik Voucher</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Belum Digunakan</span>
                  <span className="font-medium text-foreground">{stats?.vouchers.unused || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Aktif</span>
                  <span className="font-medium text-success">{stats?.vouchers.active || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Sudah Digunakan</span>
                  <span className="font-medium text-muted-foreground">{stats?.vouchers.used || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Kadaluarsa</span>
                  <span className="font-medium text-destructive">{stats?.vouchers.expired || 0}</span>
                </div>
              </div>
            </div>

            {/* Session Stats */}
            <div className="stat-card">
              <h3 className="text-sm font-medium text-foreground mb-4">Statistik Sesi</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-success" />
                    <span className="text-sm text-muted-foreground">Aktif</span>
                  </div>
                  <span className="font-medium text-success">{stats?.sessions.active || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Hari Ini</span>
                  <span className="font-medium text-foreground">{stats?.sessions.today || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Bulan Ini</span>
                  <span className="font-medium text-foreground">{stats?.sessions.month || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Users */}
            <div className="stat-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-foreground">User Terbaru</h3>
                <button 
                  onClick={() => navigate('/admin/users')}
                  className="text-sm text-primary hover:underline"
                >
                  Lihat Semua
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      {userColumns.map((col) => (
                        <th key={col.key} className="text-left p-3 text-sm font-medium text-muted-foreground">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentUsers.length === 0 ? (
                      <tr>
                        <td colSpan={userColumns.length} className="text-center p-8 text-muted-foreground">
                          Belum ada user
                        </td>
                      </tr>
                    ) : (
                      recentUsers.map((user) => (
                        <tr key={user.id} className="border-b border-border hover:bg-secondary/50">
                          {userColumns.map((col) => (
                            <td key={col.key} className="p-3">
                              {col.render ? col.render(user) : String(user[col.key as keyof RecentUser] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Vouchers */}
            <div className="stat-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-foreground">Voucher Terbaru</h3>
                <button 
                  onClick={() => navigate('/admin/vouchers')}
                  className="text-sm text-primary hover:underline"
                >
                  Lihat Semua
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      {voucherColumns.map((col) => (
                        <th key={col.key} className="text-left p-3 text-sm font-medium text-muted-foreground">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentVouchers.length === 0 ? (
                      <tr>
                        <td colSpan={voucherColumns.length} className="text-center p-8 text-muted-foreground">
                          Belum ada voucher
                        </td>
                      </tr>
                    ) : (
                      recentVouchers.map((voucher) => (
                        <tr key={voucher.id} className="border-b border-border hover:bg-secondary/50">
                          {voucherColumns.map((col) => (
                            <td key={col.key} className="p-3">
                              {col.render ? col.render(voucher) : String(voucher[col.key as keyof RecentVoucher] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Recent Logs */}
          <div className="stat-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-foreground">Log Aktivitas Terbaru</h3>
              <button 
                onClick={() => navigate('/admin/logs')}
                className="text-sm text-primary hover:underline"
              >
                Lihat Semua
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {logColumns.map((col) => (
                      <th key={col.key} className="text-left p-3 text-sm font-medium text-muted-foreground">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.length === 0 ? (
                    <tr>
                      <td colSpan={logColumns.length} className="text-center p-8 text-muted-foreground">
                        Belum ada log
                      </td>
                    </tr>
                  ) : (
                    recentLogs.map((log) => (
                      <tr key={log.id} className="border-b border-border hover:bg-secondary/50">
                        {logColumns.map((col) => (
                          <td key={col.key} className="p-3">
                            {col.render ? col.render(log) : String(log[col.key as keyof RecentLog] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
