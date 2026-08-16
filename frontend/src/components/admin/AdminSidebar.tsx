import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Ticket,
  Video,
  FileText,
  Settings,
  Wifi,
  LogOut,
  Router,
} from 'lucide-react';
import { logoutAdmin } from '@/lib/session';

const navItems = [
  { icon: LayoutDashboard, label: 'Dasbor', path: '/admin' },
  { icon: Users, label: 'Pengguna', path: '/admin/users' },
  { icon: Ticket, label: 'Voucher', path: '/admin/vouchers' },
  { icon: Video, label: 'Iklan', path: '/admin/ads' },
  { icon: Router, label: 'Router', path: '/admin/router' },
  { icon: FileText, label: 'Log Sistem', path: '/admin/logs' },
];

export function AdminSidebar() {
  return (
    <aside className="admin-sidebar">
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Wifi className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-sidebar-foreground">Hotspot</h1>
            <p className="text-xs text-muted-foreground">Panel Admin</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/admin'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-1">
        <NavLink
          to="/admin/settings"
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          <Settings className="w-5 h-5" />
          Pengaturan
        </NavLink>
        <button
          type="button"
          onClick={logoutAdmin}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Keluar
        </button>
      </div>
    </aside>
  );
}
