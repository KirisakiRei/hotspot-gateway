import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Ticket,
  Video,
  FileText,
  Settings,
  LogOut,
  Router,
  ClipboardList,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { logoutAdmin } from '@/lib/session';

const navItems = [
  { icon: LayoutDashboard, label: 'Dasbor', path: '/admin' },
  { icon: Users, label: 'Pengguna', path: '/admin/users' },
  { icon: Ticket, label: 'Voucher', path: '/admin/vouchers' },
  { icon: Video, label: 'Iklan', path: '/admin/ads' },
  { icon: ClipboardList, label: 'Kuesioner', path: '/admin/questionnaire' },
  { icon: Router, label: 'Router', path: '/admin/router' },
  { icon: FileText, label: 'Log Sistem', path: '/admin/logs' },
];

export function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });

  useEffect(() => {
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    localStorage.setItem('sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  const toggle = () => setCollapsed((c) => !c);

  return (
    <aside className="admin-sidebar">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border flex items-center gap-3 overflow-hidden">
        <img
          src="/brand/logo.png"
          alt="Logo"
          className="h-9 w-9 object-contain shrink-0"
        />
        {!collapsed && (
          <div className="whitespace-nowrap">
            <h1 className="font-semibold text-sidebar-foreground text-sm">Hotspot</h1>
            <p className="text-xs text-muted-foreground">Panel Admin</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/admin'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                collapsed ? 'justify-center px-2' : ''
              } ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
              }`
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        <NavLink
          to="/admin/settings"
          className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors ${
            collapsed ? 'justify-center px-2' : ''
          }`}
          title={collapsed ? 'Pengaturan' : undefined}
        >
          <Settings className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Pengaturan</span>}
        </NavLink>

        <button
          type="button"
          onClick={logoutAdmin}
          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors ${
            collapsed ? 'justify-center px-2' : ''
          }`}
          title={collapsed ? 'Keluar' : undefined}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Keluar</span>}
        </button>

        {/* Toggle */}
        <button
          type="button"
          onClick={toggle}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors ${
            collapsed ? 'justify-center px-2' : ''
          }`}
          title={collapsed ? 'Buka sidebar' : 'Tutup sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="w-5 h-5 shrink-0" />
          ) : (
            <PanelLeftClose className="w-5 h-5 shrink-0" />
          )}
          {!collapsed && <span>Ciutkan</span>}
        </button>
      </div>
    </aside>
  );
}