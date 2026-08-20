import { useState, useEffect } from 'react';
import { Users, Shield, Plus, Edit, Trash2, X, AlertTriangle, Check, Wifi, Loader2, RefreshCw } from 'lucide-react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { ActionButton, Badge } from '@/components/admin/AdminComponents';
import { toast } from 'sonner';
import { settingApi, mikrotikApi, adminApi } from '@/services/api';
import { getErrorMessage } from '@/lib/error';
import { getCrudFlag, getPairFlag, togglePermission as toggleRolePermission, type RolePermissions } from '@/lib/permissions';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR';
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
}

interface RolePermission {
  id: string;
  name: string;
  permissions: RolePermissions;
  userCount?: number;
}

const defaultPermissions: RolePermission[] = [
  {
    id: 'SUPER_ADMIN',
    name: 'Super Admin',
    permissions: {
      dashboard: true,
      users: { view: true, create: true, edit: true, delete: true },
      vouchers: { view: true, create: true, edit: true, delete: true },
      ads: { view: true, create: true, edit: true, delete: true },
      router: { view: true, edit: true },
      logs: { view: true },
      settings: { view: true, edit: true },
    },
  },
  {
    id: 'ADMIN',
    name: 'Admin',
    permissions: {
      dashboard: true,
      users: { view: true, create: true, edit: true, delete: false },
      vouchers: { view: true, create: true, edit: true, delete: true },
      ads: { view: true, create: true, edit: true, delete: false },
      router: { view: true, edit: false },
      logs: { view: true },
      settings: { view: true, edit: false },
    },
  },
  {
    id: 'OPERATOR',
    name: 'Operator',
    permissions: {
      dashboard: true,
      users: { view: true, create: false, edit: false, delete: false },
      vouchers: { view: true, create: true, edit: false, delete: false },
      ads: { view: true, create: false, edit: false, delete: false },
      router: { view: false, edit: false },
      logs: { view: false },
      settings: { view: false, edit: false },
    },
  },
];

type ModalType = 'add-user' | 'edit-user' | 'delete-user' | 'add-role' | 'edit-role' | 'delete-role' | null;

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'mikrotik'>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<RolePermission[]>(defaultPermissions);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<RolePermission | null>(null);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [isRolesLoading, setIsRolesLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Mikrotik settings
  const [mikrotikSettings, setMikrotikSettings] = useState({
    host: '',
    port: '8728',
    username: 'admin',
    password: '',
  });
  const [mikrotikStatus, setMikrotikStatus] = useState<{ connected: boolean; message?: string } | null>(null);
  const [isMikrotikLoading, setIsMikrotikLoading] = useState(false);
  const [isMikrotikTesting, setIsMikrotikTesting] = useState(false);

  const [userFormData, setUserFormData] = useState<Partial<AdminUser & { password?: string }>>({
    name: '',
    email: '',
    role: 'OPERATOR',
    isActive: true,
  });

  const [newPassword, setNewPassword] = useState('');

  // Load admin users
  const loadAdminUsers = async () => {
    try {
      setIsUsersLoading(true);
      const response = await adminApi.getAdmins();
      if (response.data.data) {
        setUsers(response.data.data);
      }
    } catch (error) {
      toast.error('Gagal memuat daftar admin');
    } finally {
      setIsUsersLoading(false);
    }
  };

  // Load role permissions
  const loadRolePermissions = async () => {
    try {
      setIsRolesLoading(true);
      const response = await adminApi.getRoles();
      if (response.data.data) {
        setRoles(response.data.data);
      }
    } catch (error) {
      toast.error('Gagal memuat daftar role');
    } finally {
      setIsRolesLoading(false);
    }
  };

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === 'users') {
      loadAdminUsers();
    } else if (activeTab === 'roles') {
      loadRolePermissions();
    } else if (activeTab === 'mikrotik') {
      loadMikrotikSettings();
    }
  }, [activeTab]);

  const loadMikrotikSettings = async () => {
    try {
      setIsMikrotikLoading(true);
      const response = await settingApi.getMikrotik();
      const config = (response.data.data || {}) as { host?: string; port?: string; username?: string; password?: string };
      
      setMikrotikSettings({
        host: config.host || '',
        port: config.port || '8728',
        username: config.username || 'admin',
        password: config.password || '',
      });
      
      // Check actual connection status from backend
      try {
        const statusRes = await mikrotikApi.getStatus();
        const isConnected = statusRes.data.data?.connected || false;
        setMikrotikStatus({ 
          connected: isConnected, 
          message: isConnected ? 'Terhubung' : 'Tidak terhubung' 
        });
      } catch {
        setMikrotikStatus({ connected: false, message: 'Tidak terhubung' });
      }
    } catch (error) {
      toast.error('Gagal memuat pengaturan Mikrotik');
    } finally {
      setIsMikrotikLoading(false);
    }
  };

  const testMikrotikConnection = async () => {
    try {
      setIsMikrotikTesting(true);
      const response = await settingApi.testMikrotik(mikrotikSettings);
      
      console.log('Mikrotik test response:', response.data);
      
      if (response.data.success && response.data.data?.connected) {
        setMikrotikStatus({ connected: true, message: 'Koneksi berhasil!' });
        toast.success('Koneksi Mikrotik berhasil!');
        
        // Auto-connect after successful test
        await mikrotikApi.connect();
      } else {
        const errorMsg = response.data.error || response.data.message || 'Koneksi gagal';
        console.error('Mikrotik connection failed:', errorMsg);
        setMikrotikStatus({ connected: false, message: errorMsg });
        toast.error(`Koneksi Mikrotik gagal: ${errorMsg}`);
      }
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error, 'Gagal terhubung ke server');
      console.error('Mikrotik test error:', error);
      setMikrotikStatus({ connected: false, message: errorMsg });
      toast.error(`Koneksi Mikrotik gagal: ${errorMsg}`);
    } finally {
      setIsMikrotikTesting(false);
    }
  };

  const saveMikrotikSettings = async () => {
    try {
      setIsMikrotikLoading(true);
      await settingApi.bulkUpdate({
        mikrotik_host: mikrotikSettings.host,
        mikrotik_port: mikrotikSettings.port,
        mikrotik_username: mikrotikSettings.username,
        mikrotik_password: mikrotikSettings.password,
      });
      toast.success('Pengaturan Mikrotik berhasil disimpan');
      
      // Auto-connect after save
      try {
        await mikrotikApi.connect();
        setMikrotikStatus({ connected: true, message: 'Terhubung' });
      } catch {
        setMikrotikStatus({ connected: false, message: 'Gagal terhubung' });
      }
      
      // Reload settings to show saved data
      await loadMikrotikSettings();
    } catch (error) {
      toast.error('Gagal menyimpan pengaturan Mikrotik');
    } finally {
      setIsMikrotikLoading(false);
    }
  };

  const openAddUserModal = () => {
    setUserFormData({
      name: '',
      email: '',
      role: 'OPERATOR',
      isActive: true,
    });
    setNewPassword('');
    setModalType('add-user');
  };

  const openEditUserModal = (user: AdminUser) => {
    setSelectedUser(user);
    setUserFormData(user);
    setNewPassword('');
    setModalType('edit-user');
  };

  const openDeleteUserModal = (user: AdminUser) => {
    setSelectedUser(user);
    setModalType('delete-user');
  };

  const openEditRoleModal = (role: RolePermission) => {
    setSelectedRole({ ...role, permissions: JSON.parse(JSON.stringify(role.permissions)) });
    setModalType('edit-role');
  };

  const openAddRoleModal = () => {
    setSelectedRole({
      id: '',
      name: '',
      permissions: {
        dashboard: true,
        users: { view: true, create: false, edit: false, delete: false },
        vouchers: { view: true, create: false, edit: false, delete: false },
        ads: { view: true, create: false, edit: false, delete: false },
        router: { view: false, edit: false },
        logs: { view: false },
        settings: { view: false, edit: false },
      },
    });
    setModalType('add-role');
  };

  const openDeleteRoleModal = (role: RolePermission) => {
    setSelectedRole(role);
    setModalType('delete-role');
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedUser(null);
    setSelectedRole(null);
  };

  const handleSaveUser = async () => {
    if (!userFormData.name || !userFormData.email) {
      toast.error('Nama dan email harus diisi');
      return;
    }

    try {
      setIsSaving(true);
      
      if (modalType === 'add-user') {
        if (!newPassword) {
          toast.error('Password harus diisi');
          return;
        }
        
        await adminApi.createAdmin({
          name: userFormData.name,
          email: userFormData.email,
          password: newPassword,
          role: userFormData.role || 'OPERATOR',
          isActive: userFormData.isActive ?? true,
        });
        
        toast.success('User berhasil ditambahkan');
        loadAdminUsers();
      } else if (modalType === 'edit-user' && selectedUser) {
        const updateData: Partial<{ email: string; password: string; name: string; role: string; isActive: boolean }> = {
          name: userFormData.name,
          email: userFormData.email,
          role: userFormData.role,
          isActive: userFormData.isActive,
        };
        
        if (newPassword) {
          updateData.password = newPassword;
        }
        
        await adminApi.updateAdmin(selectedUser.id, updateData);
        toast.success('User berhasil diupdate');
        loadAdminUsers();
      }
      
      closeModal();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Gagal menyimpan user'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (selectedUser) {
      try {
        setIsSaving(true);
        await adminApi.deleteAdmin(selectedUser.id);
        toast.success('User berhasil dihapus');
        loadAdminUsers();
        closeModal();
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, 'Gagal menghapus user'));
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleSaveRole = async () => {
    if (selectedRole) {
      try {
        setIsSaving(true);
        if (modalType === 'add-role') {
          if (!selectedRole.name) {
            toast.error('Nama role harus diisi');
            return;
          }
          await adminApi.createRole(selectedRole.name, selectedRole.permissions);
          toast.success('Role berhasil ditambahkan');
        } else {
          await adminApi.updateRole(selectedRole.id, selectedRole.permissions);
          toast.success('Permission berhasil diupdate');
        }
        loadRolePermissions();
        closeModal();
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, 'Gagal menyimpan role'));
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleDeleteRole = async () => {
    if (selectedRole) {
      try {
        setIsSaving(true);
        await adminApi.deleteRole(selectedRole.id);
        toast.success('Role berhasil dihapus');
        loadRolePermissions();
        closeModal();
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, 'Gagal menghapus role'));
      } finally {
        setIsSaving(false);
      }
    }
  };

  const togglePermission = (section: string, action?: string) => {
    if (!selectedRole) return;
    setSelectedRole((prev) => {
      if (!prev) return prev;
      return { ...prev, permissions: toggleRolePermission(prev.permissions, section, action) };
    });
  };

  const getRoleBadgeVariant = (role: string): 'default' | 'destructive' | 'success' | 'warning' => {
    switch (role) {
      case 'SUPER_ADMIN': return 'destructive';
      case 'ADMIN': return 'warning';
      case 'OPERATOR': return 'default';
      default: return 'default';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      
      <main className="admin-content">
        <AdminHeader title="Pengaturan" subtitle="Kelola pengguna dan hak akses" />
        
        <div className="p-6 space-y-6 animate-fade-in">
          {/* Tabs */}
          <div className="flex gap-2 border-b border-border pb-4 flex-wrap">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
                activeTab === 'users' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary text-foreground hover:bg-secondary/80'
              }`}
            >
              <Users className="w-4 h-4" />
              Manajemen Pengguna
            </button>
            <button
              onClick={() => setActiveTab('roles')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
                activeTab === 'roles' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary text-foreground hover:bg-secondary/80'
              }`}
            >
              <Shield className="w-4 h-4" />
              Hak Akses Peran
            </button>
            <button
              onClick={() => setActiveTab('mikrotik')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
                activeTab === 'mikrotik' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary text-foreground hover:bg-secondary/80'
              }`}
            >
              <Wifi className="w-4 h-4" />
              Mikrotik
            </button>
          </div>

          {/* User Management Tab */}
          {activeTab === 'users' && (
            <div className="stat-card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-foreground">Pengguna Admin</h2>
                <ActionButton variant="primary" icon={Plus} onClick={openAddUserModal}>
                  Tambah Pengguna
                </ActionButton>
              </div>

              {isUsersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Pengguna</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Peran</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Dibuat</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b border-border/50 hover:bg-secondary/50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-medium">
                              {user.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{user.name}</p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={getRoleBadgeVariant(user.role)}>
                            {user.role.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={user.isActive ? 'success' : 'default'}>
                            {user.isActive ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{new Date(user.createdAt).toLocaleDateString()}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => openEditUserModal(user)}
                              className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center transition-colors"
                            >
                              <Edit className="w-4 h-4 text-muted-foreground" />
                            </button>
                            <button 
                              onClick={() => openDeleteUserModal(user)}
                              className="w-8 h-8 rounded-lg hover:bg-destructive/10 flex items-center justify-center transition-colors"
                              disabled={user.role === 'SUPER_ADMIN' && users.filter(u => u.role === 'SUPER_ADMIN').length <= 1}
                            >
                              <Trash2 className={`w-4 h-4 ${user.role === 'SUPER_ADMIN' && users.filter(u => u.role === 'SUPER_ADMIN').length <= 1 ? 'text-muted-foreground' : 'text-destructive'}`} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          )}

          {/* Role Permissions Tab */}
          {activeTab === 'roles' && (
            <div className="space-y-4">
              {/* Add Role Button */}
              <div className="flex justify-end">
                <ActionButton variant="primary" icon={Plus} onClick={openAddRoleModal}>
                  Tambah Peran
                </ActionButton>
              </div>

              {isRolesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : roles.map((role) => (
                <div key={role.id} className="stat-card">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Badge variant={getRoleBadgeVariant(role.id)}>
                        {role.name}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {role.userCount ?? 0} pengguna
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ActionButton variant="secondary" icon={Edit} onClick={() => openEditRoleModal(role)}>
                        Edit
                      </ActionButton>
                      {!['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(role.id) && (
                        <ActionButton variant="destructive" icon={Trash2} onClick={() => openDeleteRoleModal(role)}>
                          Hapus
                        </ActionButton>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-2">Dasbor</p>
                      <div className={`w-8 h-8 rounded-full mx-auto flex items-center justify-center ${role.permissions.dashboard ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                        {role.permissions.dashboard ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-2">Pengguna</p>
                      <div className="flex justify-center gap-1">
                        {['view', 'create', 'edit', 'delete'].map((action) => (
                          <div 
                            key={action}
                            className={`w-6 h-6 rounded text-[10px] flex items-center justify-center ${getCrudFlag(role.permissions, 'users', action) ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}
                            title={action}
                          >
                            {action.charAt(0).toUpperCase()}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-2">Voucher</p>
                      <div className="flex justify-center gap-1">
                        {['view', 'create', 'edit', 'delete'].map((action) => (
                          <div 
                            key={action}
                            className={`w-6 h-6 rounded text-[10px] flex items-center justify-center ${getCrudFlag(role.permissions, 'vouchers', action) ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}
                            title={action}
                          >
                            {action.charAt(0).toUpperCase()}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-2">Iklan</p>
                      <div className="flex justify-center gap-1">
                        {['view', 'create', 'edit', 'delete'].map((action) => (
                          <div 
                            key={action}
                            className={`w-6 h-6 rounded text-[10px] flex items-center justify-center ${getCrudFlag(role.permissions, 'ads', action) ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}
                            title={action}
                          >
                            {action.charAt(0).toUpperCase()}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-2">Router</p>
                      <div className="flex justify-center gap-1">
                        {['view', 'edit'].map((action) => (
                          <div 
                            key={action}
                            className={`w-6 h-6 rounded text-[10px] flex items-center justify-center ${getPairFlag(role.permissions, 'router', action) ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}
                            title={action}
                          >
                            {action.charAt(0).toUpperCase()}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-2">Logs</p>
                      <div className={`w-8 h-8 rounded-full mx-auto flex items-center justify-center ${role.permissions.logs.view ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                        {role.permissions.logs.view ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-2">Pengaturan</p>
                      <div className="flex justify-center gap-1">
                        {['view', 'edit'].map((action) => (
                          <div 
                            key={action}
                            className={`w-6 h-6 rounded text-[10px] flex items-center justify-center ${getPairFlag(role.permissions, 'settings', action) ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}
                            title={action}
                          >
                            {action.charAt(0).toUpperCase()}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Mikrotik Settings Tab */}
          {activeTab === 'mikrotik' && (
            <div className="stat-card">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${mikrotikStatus?.connected ? 'bg-success/10' : 'bg-destructive/10'}`}>
                    <Wifi className={`w-5 h-5 ${mikrotikStatus?.connected ? 'text-success' : 'text-destructive'}`} />
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground">Pengaturan Router MikroTik</h2>
                    <p className="text-sm text-muted-foreground">
                      {mikrotikStatus?.connected ? 'Terhubung' : 'Tidak terhubung'}
                    </p>
                  </div>
                </div>
                <Badge variant={mikrotikStatus?.connected ? 'success' : 'destructive'}>
                  {mikrotikStatus?.connected ? 'Online' : 'Offline'}
                </Badge>
              </div>

              {isMikrotikLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Host / Alamat IP</label>
                      <input
                        type="text"
                        value={mikrotikSettings.host}
                        onChange={(e) => setMikrotikSettings(prev => ({ ...prev, host: e.target.value }))}
                        placeholder="10.8.0.2"
                        className="w-full h-10 px-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Port</label>
                      <input
                        type="text"
                        value={mikrotikSettings.port}
                        onChange={(e) => setMikrotikSettings(prev => ({ ...prev, port: e.target.value }))}
                        placeholder="8728"
                        className="w-full h-10 px-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Nama Pengguna</label>
                      <input
                        type="text"
                        value={mikrotikSettings.username}
                        onChange={(e) => setMikrotikSettings(prev => ({ ...prev, username: e.target.value }))}
                        placeholder="admin"
                        className="w-full h-10 px-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Kata Sandi</label>
                      <input
                        type="password"
                        value={mikrotikSettings.password}
                        onChange={(e) => setMikrotikSettings(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="••••••••"
                        className="w-full h-10 px-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button 
                      onClick={testMikrotikConnection}
                      disabled={isMikrotikTesting}
                      className="h-10 px-4 rounded-xl bg-secondary text-foreground font-medium text-sm hover:bg-secondary/80 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isMikrotikTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Uji Koneksi
                    </button>
                    <button 
                      onClick={saveMikrotikSettings}
                      disabled={isMikrotikLoading}
                      className="h-10 px-4 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Simpan Pengaturan
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {/* Add/Edit User Modal */}
      {(modalType === 'add-user' || modalType === 'edit-user') && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-background rounded-2xl max-w-md w-full shadow-elevated">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">
                {modalType === 'add-user' ? 'Tambah Pengguna Baru' : 'Ubah Pengguna'}
              </h2>
              <button 
                onClick={closeModal}
                className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Nama</label>
                <input
                  type="text"
                  value={userFormData.name || ''}
                  onChange={(e) => setUserFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Email</label>
                <input
                  type="email"
                  value={userFormData.email || ''}
                  onChange={(e) => setUserFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {modalType === 'add-user' ? 'Password' : 'New Password (kosongkan jika tidak ingin mengubah)'}
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={modalType === 'edit-user' ? '••••••••' : ''}
                  className="w-full h-10 px-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Role</label>
                <select
                  value={userFormData.role || 'OPERATOR'}
                  onChange={(e) => setUserFormData(prev => ({ ...prev, role: e.target.value as AdminUser['role'] }))}
                  className="w-full h-10 px-3 rounded-xl bg-secondary border-0 text-sm"
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between bg-secondary rounded-xl p-4">
                <span className="text-sm text-foreground">Active</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={userFormData.isActive} 
                    onChange={(e) => setUserFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={closeModal}
                  className="flex-1 h-10 rounded-xl bg-secondary text-foreground font-medium text-sm hover:bg-secondary/80 transition-colors"
                >
                  Batal
                </button>
                <button 
                  onClick={handleSaveUser}
                  className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
                >
                  {modalType === 'add-user' ? 'Tambah' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {modalType === 'delete-user' && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-background rounded-2xl max-w-sm w-full shadow-elevated">
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-7 h-7 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Hapus User</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Apakah Anda yakin ingin menghapus user <strong>"{selectedUser.name}"</strong>?
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={closeModal}
                  className="flex-1 h-10 rounded-xl bg-secondary text-foreground font-medium text-sm hover:bg-secondary/80 transition-colors"
                >
                  Batal
                </button>
                <button 
                  onClick={handleDeleteUser}
                  className="flex-1 h-10 rounded-xl bg-destructive text-destructive-foreground font-medium text-sm hover:bg-destructive/90 transition-colors"
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Permissions Modal */}
      {modalType === 'edit-role' && selectedRole && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-background rounded-2xl max-w-lg w-full shadow-elevated max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border bg-background z-10 flex-shrink-0">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-foreground">Edit Permissions</h2>
                <Badge variant={getRoleBadgeVariant(selectedRole.id)}>
                  {selectedRole.name}
                </Badge>
              </div>
              <button 
                onClick={closeModal}
                className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {/* Dashboard */}
              <div className="flex items-center justify-between bg-secondary rounded-xl p-4">
                <span className="text-sm font-medium text-foreground">Dasbor</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={selectedRole.permissions.dashboard} 
                    onChange={() => togglePermission('dashboard')}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-success after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
              </div>

              {/* Users */}
              <div className="bg-secondary rounded-xl p-4">
                <p className="text-sm font-medium text-foreground mb-3">Pengguna</p>
                <div className="grid grid-cols-4 gap-2">
                  {['view', 'create', 'edit', 'delete'].map((action) => (
                    <label key={action} className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={getCrudFlag(selectedRole.permissions, 'users', action)}
                        onChange={() => togglePermission('users', action)}
                        className="w-4 h-4 rounded border-border text-success focus:ring-success"
                      />
                      <span className="text-xs text-muted-foreground capitalize">{action}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Vouchers */}
              <div className="bg-secondary rounded-xl p-4">
                <p className="text-sm font-medium text-foreground mb-3">Vouchers</p>
                <div className="grid grid-cols-4 gap-2">
                  {['view', 'create', 'edit', 'delete'].map((action) => (
                    <label key={action} className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={getCrudFlag(selectedRole.permissions, 'vouchers', action)}
                        onChange={() => togglePermission('vouchers', action)}
                        className="w-4 h-4 rounded border-border text-success focus:ring-success"
                      />
                      <span className="text-xs text-muted-foreground capitalize">{action}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Ads */}
              <div className="bg-secondary rounded-xl p-4">
                <p className="text-sm font-medium text-foreground mb-3">Advertisements</p>
                <div className="grid grid-cols-4 gap-2">
                  {['view', 'create', 'edit', 'delete'].map((action) => (
                    <label key={action} className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={getCrudFlag(selectedRole.permissions, 'ads', action)}
                        onChange={() => togglePermission('ads', action)}
                        className="w-4 h-4 rounded border-border text-success focus:ring-success"
                      />
                      <span className="text-xs text-muted-foreground capitalize">{action}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Router */}
              <div className="bg-secondary rounded-xl p-4">
                <p className="text-sm font-medium text-foreground mb-3">Router</p>
                <div className="grid grid-cols-4 gap-2">
                  {['view', 'edit'].map((action) => (
                    <label key={action} className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={getPairFlag(selectedRole.permissions, 'router', action)}
                        onChange={() => togglePermission('router', action)}
                        className="w-4 h-4 rounded border-border text-success focus:ring-success"
                      />
                      <span className="text-xs text-muted-foreground capitalize">{action}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Logs */}
              <div className="flex items-center justify-between bg-secondary rounded-xl p-4">
                <span className="text-sm font-medium text-foreground">Log Sistem</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={selectedRole.permissions.logs.view} 
                    onChange={() => togglePermission('logs', 'view')}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-success after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
              </div>

              {/* Settings */}
              <div className="bg-secondary rounded-xl p-4">
                <p className="text-sm font-medium text-foreground mb-3">Pengaturan</p>
                <div className="grid grid-cols-4 gap-2">
                  {['view', 'edit'].map((action) => (
                    <label key={action} className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={getPairFlag(selectedRole.permissions, 'settings', action)}
                        onChange={() => togglePermission('settings', action)}
                        className="w-4 h-4 rounded border-border text-success focus:ring-success"
                      />
                      <span className="text-xs text-muted-foreground capitalize">{action}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={closeModal}
                  className="flex-1 h-10 rounded-xl bg-secondary text-foreground font-medium text-sm hover:bg-secondary/80 transition-colors"
                >
                  Batal
                </button>
                <button 
                  onClick={handleSaveRole}
                  disabled={isSaving}
                  className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Role Modal */}
      {modalType === 'add-role' && selectedRole && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-background rounded-2xl max-w-lg w-full shadow-elevated max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-background">
              <h2 className="text-lg font-semibold text-foreground">Tambah Peran Baru</h2>
              <button 
                onClick={closeModal}
                className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Role Name */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Nama Role</label>
                <input 
                  type="text"
                  value={selectedRole.name}
                  onChange={(e) => setSelectedRole(prev => prev ? { ...prev, name: e.target.value, id: e.target.value.toUpperCase().replace(/\s+/g, '_') } : prev)}
                  className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Nama role baru"
                />
              </div>

              {/* Dashboard */}
              <div className="flex items-center justify-between bg-secondary rounded-xl p-4">
                <span className="text-sm font-medium text-foreground">Dasbor</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={selectedRole.permissions.dashboard} 
                    onChange={() => togglePermission('dashboard')}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-success after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
              </div>

              {/* Users */}
              <div className="bg-secondary rounded-xl p-4">
                <p className="text-sm font-medium text-foreground mb-3">Pengguna</p>
                <div className="grid grid-cols-4 gap-2">
                  {['view', 'create', 'edit', 'delete'].map((action) => (
                    <label key={action} className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={getCrudFlag(selectedRole.permissions, 'users', action)}
                        onChange={() => togglePermission('users', action)}
                        className="w-4 h-4 rounded border-border text-success focus:ring-success"
                      />
                      <span className="text-xs text-muted-foreground capitalize">{action}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Vouchers */}
              <div className="bg-secondary rounded-xl p-4">
                <p className="text-sm font-medium text-foreground mb-3">Vouchers</p>
                <div className="grid grid-cols-4 gap-2">
                  {['view', 'create', 'edit', 'delete'].map((action) => (
                    <label key={action} className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={getCrudFlag(selectedRole.permissions, 'vouchers', action)}
                        onChange={() => togglePermission('vouchers', action)}
                        className="w-4 h-4 rounded border-border text-success focus:ring-success"
                      />
                      <span className="text-xs text-muted-foreground capitalize">{action}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Ads */}
              <div className="bg-secondary rounded-xl p-4">
                <p className="text-sm font-medium text-foreground mb-3">Advertisements</p>
                <div className="grid grid-cols-4 gap-2">
                  {['view', 'create', 'edit', 'delete'].map((action) => (
                    <label key={action} className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={getCrudFlag(selectedRole.permissions, 'ads', action)}
                        onChange={() => togglePermission('ads', action)}
                        className="w-4 h-4 rounded border-border text-success focus:ring-success"
                      />
                      <span className="text-xs text-muted-foreground capitalize">{action}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Router */}
              <div className="bg-secondary rounded-xl p-4">
                <p className="text-sm font-medium text-foreground mb-3">Router</p>
                <div className="grid grid-cols-4 gap-2">
                  {['view', 'edit'].map((action) => (
                    <label key={action} className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={getPairFlag(selectedRole.permissions, 'router', action)}
                        onChange={() => togglePermission('router', action)}
                        className="w-4 h-4 rounded border-border text-success focus:ring-success"
                      />
                      <span className="text-xs text-muted-foreground capitalize">{action}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Logs */}
              <div className="flex items-center justify-between bg-secondary rounded-xl p-4">
                <span className="text-sm font-medium text-foreground">Log Sistem</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={selectedRole.permissions.logs.view} 
                    onChange={() => togglePermission('logs', 'view')}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-success after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
              </div>

              {/* Settings */}
              <div className="bg-secondary rounded-xl p-4">
                <p className="text-sm font-medium text-foreground mb-3">Pengaturan</p>
                <div className="grid grid-cols-4 gap-2">
                  {['view', 'edit'].map((action) => (
                    <label key={action} className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={getPairFlag(selectedRole.permissions, 'settings', action)}
                        onChange={() => togglePermission('settings', action)}
                        className="w-4 h-4 rounded border-border text-success focus:ring-success"
                      />
                      <span className="text-xs text-muted-foreground capitalize">{action}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={closeModal}
                  className="flex-1 h-10 rounded-xl bg-secondary text-foreground font-medium text-sm hover:bg-secondary/80 transition-colors"
                >
                  Batal
                </button>
                <button 
                  onClick={handleSaveRole}
                  disabled={isSaving}
                  className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Menyimpan...' : 'Tambah Peran'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Role Confirmation Modal */}
      {modalType === 'delete-role' && selectedRole && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-background rounded-2xl max-w-md w-full shadow-elevated">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Hapus Role</h2>
              <p className="text-muted-foreground mb-6">
                Apakah Anda yakin ingin menghapus role <strong>{selectedRole.name}</strong>?
                {(selectedRole.userCount ?? 0) > 0 && (
                  <span className="block text-destructive mt-2">
                    Role ini digunakan oleh {selectedRole.userCount} user!
                  </span>
                )}
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={closeModal}
                  className="flex-1 h-10 rounded-xl bg-secondary text-foreground font-medium text-sm hover:bg-secondary/80 transition-colors"
                >
                  Batal
                </button>
                <button 
                  onClick={handleDeleteRole}
                  disabled={isSaving}
                  className="flex-1 h-10 rounded-xl bg-destructive text-destructive-foreground font-medium text-sm hover:bg-destructive/90 transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Menghapus...' : 'Hapus'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
