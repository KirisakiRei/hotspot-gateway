import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Eye, Ban, Trash2, Power, X, AlertTriangle, Loader2, UserX, UserCheck, RefreshCw, ChevronLeft, ChevronRight, Users, Wifi, WifiOff, ShieldX } from 'lucide-react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { ActionButton, DataTable, Badge } from '@/components/admin/AdminComponents';
import { userApi, type User } from '@/services/api';
import { getErrorMessage } from '@/lib/error';
import { toast } from 'sonner';

type ConfirmAction = {
  type: 'block' | 'unblock' | 'delete' | 'kick';
  userId: string;
  userName: string;
} | null;

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface UserStats {
  total: number;
  online: number;
  offline: number;
  blocked: number;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('online'); // Default to online for performance
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  
  // Stats state for summary cards
  const [stats, setStats] = useState<UserStats>({ total: 0, online: 0, offline: 0, blocked: 0 });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  });

  // Load user stats for summary cards
  const loadStats = useCallback(async () => {
    try {
      const response = await userApi.getStats();
      if (response.data.data) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load user stats:', error);
    }
  }, []);

  const loadUsers = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setIsLoading(true);
      else setIsRefreshing(true);
      
      const params: Record<string, string | number | boolean | undefined> = {
        page: currentPage,
        limit: 20,
      };
      
      if (statusFilter !== 'all') {
        params.status = statusFilter.toUpperCase();
      }
      if (searchQuery) {
        params.search = searchQuery;
      }
      
      // Load users and stats in parallel
      const [usersResponse] = await Promise.all([
        userApi.getAll(params),
        loadStats(),
      ]);
      
      if (usersResponse.data.data) {
        setUsers(usersResponse.data.data);
      }
      if (usersResponse.data.meta) {
        setPagination(usersResponse.data.meta as PaginationMeta);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
      toast.error('Gagal memuat data user');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentPage, statusFilter, searchQuery, loadStats]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadUsers(false);
    }, 30000);
    return () => clearInterval(interval);
  }, [loadUsers]);

  const handleRefresh = () => {
    loadUsers(false);
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleKick = (userId: string, userName: string) => {
    setConfirmAction({ type: 'kick', userId, userName });
  };

  const handleBlock = (userId: string, userName: string) => {
    setConfirmAction({ type: 'block', userId, userName });
  };

  const handleUnblock = (userId: string, userName: string) => {
    setConfirmAction({ type: 'unblock', userId, userName });
  };

  const handleDelete = (userId: string, userName: string) => {
    setConfirmAction({ type: 'delete', userId, userName });
  };

  const getUserDisplayName = (user: User) => user.name || user.phone || 'Unknown';

  const executeAction = async () => {
    if (!confirmAction) return;
    
    setIsExecuting(true);
    try {
      switch (confirmAction.type) {
        case 'kick':
          await userApi.kick(confirmAction.userId);
          toast.success(`User ${confirmAction.userName} berhasil di-kick`);
          break;
        case 'block':
          await userApi.block(confirmAction.userId);
          toast.success(`User ${confirmAction.userName} berhasil diblokir`);
          break;
        case 'unblock':
          await userApi.unblock(confirmAction.userId);
          toast.success(`User ${confirmAction.userName} berhasil di-unblock`);
          break;
        case 'delete':
          await userApi.delete(confirmAction.userId);
          toast.success(`User ${confirmAction.userName} berhasil dihapus`);
          break;
      }
      
      // Reload data after action
      await loadUsers(false);
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Gagal melakukan aksi');
      toast.error(message);
    } finally {
      setIsExecuting(false);
      setConfirmAction(null);
      setSelectedUser(null);
    }
  };

  const getActionTitle = () => {
    switch (confirmAction?.type) {
      case 'kick': return 'Kick User';
      case 'block': return 'Block User';
      case 'unblock': return 'Unblock User';
      case 'delete': return 'Hapus User';
      default: return '';
    }
  };

  const getActionMessage = () => {
    switch (confirmAction?.type) {
      case 'kick': return `Apakah Anda yakin ingin memutus koneksi ${confirmAction.userName}?`;
      case 'block': return `Apakah Anda yakin ingin memblokir ${confirmAction.userName}? User tidak akan bisa login lagi.`;
      case 'unblock': return `Apakah Anda yakin ingin membuka blokir ${confirmAction.userName}?`;
      case 'delete': return `Apakah Anda yakin ingin menghapus ${confirmAction.userName}? Tindakan ini tidak dapat dibatalkan.`;
      default: return '';
    }
  };

  const formatBytes = (bytes: number | string | undefined): string => {
    if (!bytes) return '-';
    const num = typeof bytes === 'string' ? parseInt(bytes) : bytes;
    if (isNaN(num) || num === 0) return '-';
    
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    if (num < 1024 * 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(1)} MB`;
    return `${(num / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      
      <main className="admin-content">
        <AdminHeader title="User Management" subtitle="Active sessions and connected devices" />
        
        <div className="p-6 space-y-6 animate-fade-in">
          {/* Stats Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div 
              className={`stat-card cursor-pointer transition-all ${statusFilter === 'online' ? 'ring-2 ring-success' : 'hover:bg-secondary/50'}`}
              onClick={() => { setStatusFilter('online'); setCurrentPage(1); }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                  <Wifi className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-success">{stats.online}</p>
                  <p className="text-xs text-muted-foreground">Online</p>
                </div>
              </div>
            </div>
            
            <div 
              className={`stat-card cursor-pointer transition-all ${statusFilter === 'offline' ? 'ring-2 ring-muted-foreground' : 'hover:bg-secondary/50'}`}
              onClick={() => { setStatusFilter('offline'); setCurrentPage(1); }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center">
                  <WifiOff className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.offline}</p>
                  <p className="text-xs text-muted-foreground">Offline</p>
                </div>
              </div>
            </div>
            
            <div 
              className={`stat-card cursor-pointer transition-all ${statusFilter === 'blocked' ? 'ring-2 ring-destructive' : 'hover:bg-secondary/50'}`}
              onClick={() => { setStatusFilter('blocked'); setCurrentPage(1); }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <ShieldX className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-destructive">{stats.blocked}</p>
                  <p className="text-xs text-muted-foreground">Blocked</p>
                </div>
              </div>
            </div>
            
            <div 
              className={`stat-card cursor-pointer transition-all ${statusFilter === 'all' ? 'ring-2 ring-primary' : 'hover:bg-secondary/50'}`}
              onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Users</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Cari nama, IP, MAC, HP..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="h-10 pl-9 pr-4 rounded-xl bg-secondary border-0 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary w-full sm:w-80"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <select 
                  value={statusFilter}
                  onChange={(e) => handleStatusFilter(e.target.value)}
                  className="h-10 px-3 rounded-xl bg-secondary border-0 text-sm"
                >
                  <option value="all">Semua Status</option>
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-10 px-4 rounded-xl bg-secondary text-foreground font-medium text-sm hover:bg-secondary/80 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="stat-card overflow-x-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Memuat data...</span>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12">
                <UserX className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Tidak ada user ditemukan</p>
              </div>
            ) : (
              <>
                <DataTable headers={['User', 'IP Address', 'Voucher', 'Data Usage', 'Uptime', 'Status', 'Actions']}>
                  {users.map((user) => {
                    const mac = user.macAddress || user.mac || '-';
                    const ip = user.ipAddress || user.ip || '-';
                    const isOnline = user.status === 'ONLINE';
                    const isBlocked = user.status === 'BLOCKED';
                    const voucherCode = user.voucher?.code || '-';
                    const bytesIn = user.bytesIn || 0;
                    const bytesOut = user.bytesOut || 0;
                    const totalBytes = bytesIn + bytesOut;
                    const uptime = user.uptime || user.sessionTime || '-';
                    const displayName = user.name || user.phone || 'Unknown';
                    const displayPhone = user.phone || '-';
                    
                    return (
                      <tr key={user.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                              isOnline ? 'bg-success/10 text-success' : 
                              isBlocked ? 'bg-destructive/10 text-destructive' : 
                              'bg-secondary text-muted-foreground'
                            }`}>
                              {displayName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-medium text-foreground block">{displayName}</span>
                              <span className="text-xs text-muted-foreground">{displayPhone}</span>
                            </div>
                          </div>
                        </td>
                        <td className="font-mono text-sm text-foreground">{ip}</td>
                        <td>
                          {voucherCode !== '-' ? (
                            <div>
                              <span className="font-mono text-sm text-primary font-medium">{voucherCode}</span>
                              {user.voucher?.profile?.name && (
                                <span className="block text-xs text-muted-foreground">{user.voucher.profile.name}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="text-sm text-foreground">
                          {totalBytes > 0 ? (
                            <div>
                              <span className="font-medium">{formatBytes(totalBytes)}</span>
                              <span className="block text-xs text-muted-foreground">
                                ↓{formatBytes(bytesIn)} ↑{formatBytes(bytesOut)}
                              </span>
                            </div>
                          ) : '-'}
                        </td>
                        <td className="text-sm text-foreground">{uptime}</td>
                        <td>
                          <Badge 
                            variant={
                              isBlocked ? 'destructive' : 
                              isOnline ? 'success' : 
                              'default'
                            }
                          >
                            {isBlocked ? 'Blocked' : isOnline ? 'Online' : 'Offline'}
                          </Badge>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => setSelectedUser(user)}
                              className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center transition-colors"
                              title="View Detail"
                            >
                              <Eye className="w-4 h-4 text-muted-foreground" />
                            </button>
                            <button 
                              onClick={() => handleKick(user.id, getUserDisplayName(user))}
                              className="w-8 h-8 rounded-lg hover:bg-warning/10 flex items-center justify-center transition-colors disabled:opacity-30"
                              title="Kick"
                              disabled={!isOnline}
                            >
                              <Power className={`w-4 h-4 ${isOnline ? 'text-warning' : 'text-muted-foreground'}`} />
                            </button>
                            {isBlocked ? (
                              <button 
                                onClick={() => handleUnblock(user.id, getUserDisplayName(user))}
                                className="w-8 h-8 rounded-lg hover:bg-success/10 flex items-center justify-center transition-colors"
                                title="Unblock"
                              >
                                <UserCheck className="w-4 h-4 text-success" />
                              </button>
                            ) : (
                              <button 
                                onClick={() => handleBlock(user.id, getUserDisplayName(user))}
                                className="w-8 h-8 rounded-lg hover:bg-destructive/10 flex items-center justify-center transition-colors"
                                title="Block"
                              >
                                <Ban className="w-4 h-4 text-destructive" />
                              </button>
                            )}
                            <button 
                              onClick={() => handleDelete(user.id, getUserDisplayName(user))}
                              className="w-8 h-8 rounded-lg hover:bg-destructive/10 flex items-center justify-center transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </DataTable>

                {/* Pagination - Simplified */}
                <div className="flex items-center justify-between gap-4 mt-4 pt-4 border-t border-border">
                  <span className="text-sm text-muted-foreground">
                    Menampilkan {users.length} dari {pagination.total} user
                  </span>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Halaman {pagination.page} dari {pagination.totalPages}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                        disabled={currentPage >= pagination.totalPages}
                        className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-background rounded-2xl max-w-lg w-full shadow-elevated max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-background">
              <h2 className="text-lg font-semibold text-foreground">Detail User</h2>
              <button 
                onClick={() => setSelectedUser(null)}
                className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-4 space-y-6">
              {/* User Header */}
              <div className="flex items-center gap-4 pb-4 border-b border-border">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-semibold ${
                  selectedUser.status === 'ONLINE' ? 'bg-success/10 text-success' : 
                  selectedUser.status === 'BLOCKED' ? 'bg-destructive/10 text-destructive' : 
                  'bg-secondary text-muted-foreground'
                }`}>
                  {(selectedUser.name || selectedUser.phone || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground text-lg">{selectedUser.name || selectedUser.phone || 'Unknown'}</h3>
                  <p className="text-sm text-muted-foreground">{selectedUser.phone || '-'}</p>
                  <Badge 
                    variant={
                      selectedUser.status === 'BLOCKED' ? 'destructive' : 
                      selectedUser.status === 'ONLINE' ? 'success' : 
                      'default'
                    }
                  >
                    {selectedUser.status === 'BLOCKED' ? 'Blocked' : selectedUser.status === 'ONLINE' ? 'Online' : 'Offline'}
                  </Badge>
                </div>
              </div>

              {/* Connection Info */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Informasi Koneksi</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-secondary rounded-xl p-3">
                    <p className="text-xs text-muted-foreground mb-1">IP Address</p>
                    <p className="font-mono text-sm text-foreground">{selectedUser.ipAddress || selectedUser.ip || '-'}</p>
                  </div>
                  <div className="bg-secondary rounded-xl p-3">
                    <p className="text-xs text-muted-foreground mb-1">MAC Address</p>
                    <p className="font-mono text-sm text-foreground break-all">{selectedUser.macAddress || selectedUser.mac || '-'}</p>
                  </div>
                  <div className="bg-secondary rounded-xl p-3">
                    <p className="text-xs text-muted-foreground mb-1">Uptime</p>
                    <p className="text-sm text-foreground">{selectedUser.uptime || selectedUser.sessionTime || '-'}</p>
                  </div>
                  <div className="bg-secondary rounded-xl p-3">
                    <p className="text-xs text-muted-foreground mb-1">Login Time</p>
                    <p className="text-sm text-foreground">{selectedUser.loginAt ? new Date(selectedUser.loginAt).toLocaleString('id-ID') : '-'}</p>
                  </div>
                </div>
              </div>

              {/* Voucher Info */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Informasi Voucher</h4>
                <div className="grid grid-cols-1 gap-3">
                  <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted-foreground">Kode Voucher</p>
                      <p className="font-mono text-lg text-primary font-bold">{selectedUser.voucher?.code || '-'}</p>
                    </div>
                    {selectedUser.voucher?.profile && (
                      <p className="text-xs text-muted-foreground">Profile: {selectedUser.voucher.profile.name}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-secondary rounded-xl p-3">
                      <p className="text-xs text-muted-foreground mb-1">Download</p>
                      <p className="text-sm text-foreground font-medium">{formatBytes(selectedUser.bytesIn)}</p>
                    </div>
                    <div className="bg-secondary rounded-xl p-3">
                      <p className="text-xs text-muted-foreground mb-1">Upload</p>
                      <p className="text-sm text-foreground font-medium">{formatBytes(selectedUser.bytesOut)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-border">
                <button 
                  onClick={() => handleKick(selectedUser.id, getUserDisplayName(selectedUser))}
                  disabled={selectedUser.status !== 'ONLINE'}
                  className="flex-1 h-10 rounded-xl bg-warning/10 text-warning font-medium text-sm hover:bg-warning/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Power className="w-4 h-4" />
                  Kick
                </button>
                {selectedUser.status === 'BLOCKED' ? (
                  <button 
                    onClick={() => handleUnblock(selectedUser.id, getUserDisplayName(selectedUser))}
                    className="flex-1 h-10 rounded-xl bg-success/10 text-success font-medium text-sm hover:bg-success/20 transition-colors flex items-center justify-center gap-2"
                  >
                    <UserCheck className="w-4 h-4" />
                    Unblock
                  </button>
                ) : (
                  <button 
                    onClick={() => handleBlock(selectedUser.id, getUserDisplayName(selectedUser))}
                    className="flex-1 h-10 rounded-xl bg-destructive/10 text-destructive font-medium text-sm hover:bg-destructive/20 transition-colors flex items-center justify-center gap-2"
                  >
                    <Ban className="w-4 h-4" />
                    Block
                  </button>
                )}
                <button 
                  onClick={() => handleDelete(selectedUser.id, getUserDisplayName(selectedUser))}
                  className="flex-1 h-10 rounded-xl bg-destructive/10 text-destructive font-medium text-sm hover:bg-destructive/20 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 animate-fade-in">
          <div className="bg-background rounded-2xl max-w-sm w-full shadow-elevated">
            <div className="p-6 text-center">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
                confirmAction.type === 'unblock' ? 'bg-success/10' :
                confirmAction.type === 'kick' ? 'bg-warning/10' : 
                'bg-destructive/10'
              }`}>
                {confirmAction.type === 'unblock' ? (
                  <UserCheck className="w-7 h-7 text-success" />
                ) : (
                  <AlertTriangle className={`w-7 h-7 ${
                    confirmAction.type === 'kick' ? 'text-warning' : 'text-destructive'
                  }`} />
                )}
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{getActionTitle()}</h3>
              <p className="text-sm text-muted-foreground mb-6">{getActionMessage()}</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmAction(null)}
                  disabled={isExecuting}
                  className="flex-1 h-10 rounded-xl bg-secondary text-foreground font-medium text-sm hover:bg-secondary/80 transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button 
                  onClick={executeAction}
                  disabled={isExecuting}
                  className={`flex-1 h-10 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                    confirmAction.type === 'unblock'
                      ? 'bg-success text-success-foreground hover:bg-success/90'
                      : confirmAction.type === 'kick' 
                        ? 'bg-warning text-warning-foreground hover:bg-warning/90' 
                        : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  }`}
                >
                  {isExecuting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {confirmAction.type === 'kick' ? 'Kick' : 
                   confirmAction.type === 'block' ? 'Block' : 
                   confirmAction.type === 'unblock' ? 'Unblock' : 'Hapus'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
