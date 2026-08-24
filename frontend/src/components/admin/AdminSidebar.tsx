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
  ChevronLeft,
  ChevronRight,
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
      {/* Floating Toggle Button di tepi kanan sidebar */}
      <button
        type="button"
        onClick={toggle}
        className="absolute -right-3.5 top-6 z-30 w-7 h-7 rounded-full bg-card border border-border text-foreground shadow-sm flex items-center justify-center hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
        title={collapsed ? 'Perluas menu' : 'Sembunyikan menu'}
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>

      {/* Header */}
      <div className="h-16 px-4 border-b border-sidebar-border flex items-center gap-3 overflow-hidden">
        <img
          src="/brand/logo.png"
          alt="Logo"
          className="h-8 w-8 object-contain shrink-0"
        />
        {!collapsed && (
          <div className="whitespace-nowrap">
            <h1 className="font-semibold text-sidebar-foreground text-sm leading-tight">Hotspot</h1>
            <p className="text-[11px] text-muted-foreground leading-tight">Panel Admin</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2.5 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/admin'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                collapsed ? 'justify-center px-2' : ''
              } ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
              }`
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-2.5 border-t border-sidebar-border space-y-1">
        <NavLink
          to="/admin/settings"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors ${
            collapsed ? 'justify-center px-2' : ''
          }`}
          title={collapsed ? 'Pengaturan' : undefined}
        >
          <Settings className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="truncate">Pengaturan</span>}
        </NavLink>

        <button
          type="button"
          onClick={logoutAdmin}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors ${
            collapsed ? 'justify-center px-2' : ''
          }`}
          title={collapsed ? 'Keluar' : undefined}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="truncate">Keluar</span>}
        </button>
      </div>
    </aside>
  );
}
