export interface SessionAdmin {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR';
}

export function getSessionAdmin(): SessionAdmin | null {
  try {
    const raw = localStorage.getItem('admin_user');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SessionAdmin>;
    if (!parsed || typeof parsed.name !== 'string') return null;
    return {
      id: String(parsed.id || ''),
      name: parsed.name,
      email: String(parsed.email || ''),
      role: parsed.role || 'ADMIN',
    };
  } catch {
    return null;
  }
}

export function getAdminInitials(name?: string | null): string {
  const value = (name || '').trim();
  if (!value) return 'A';
  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function clearAdminSession(): void {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('admin_user');
}

export function logoutAdmin(): void {
  clearAdminSession();
  window.location.href = '/admin/login';
}
