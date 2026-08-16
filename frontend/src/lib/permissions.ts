export type CrudAction = 'view' | 'create' | 'edit' | 'delete';
export type CrudSection = 'users' | 'vouchers' | 'ads';
export type SimpleSection = 'dashboard' | 'logs';
export type PairSection = 'router' | 'settings';

export interface CrudPermission {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export interface RolePermissions {
  dashboard: boolean;
  users: CrudPermission;
  vouchers: CrudPermission;
  ads: CrudPermission;
  router: { view: boolean; edit: boolean };
  logs: { view: boolean };
  settings: { view: boolean; edit: boolean };
}

export function isCrudSection(section: string): section is CrudSection {
  return section === 'users' || section === 'vouchers' || section === 'ads';
}

export function isPairSection(section: string): section is PairSection {
  return section === 'router' || section === 'settings';
}

export function isSimpleSection(section: string): section is SimpleSection {
  return section === 'dashboard' || section === 'logs';
}

export function getCrudFlag(permissions: RolePermissions, section: CrudSection, action: string): boolean {
  if (action === 'view' || action === 'create' || action === 'edit' || action === 'delete') {
    return permissions[section][action];
  }
  return false;
}

export function getPairFlag(permissions: RolePermissions, section: PairSection, action: string): boolean {
  if (action === 'view' || action === 'edit') {
    return permissions[section][action];
  }
  return false;
}

export function togglePermission(
  permissions: RolePermissions,
  section: string,
  action?: string,
): RolePermissions {
  const next = structuredClone(permissions);
  if (isSimpleSection(section)) {
    if (section === 'dashboard') next.dashboard = !next.dashboard;
    if (section === 'logs') next.logs.view = !next.logs.view;
    return next;
  }
  if (isCrudSection(section) && action && (action === 'view' || action === 'create' || action === 'edit' || action === 'delete')) {
    next[section][action] = !next[section][action];
    return next;
  }
  if (isPairSection(section) && action && (action === 'view' || action === 'edit')) {
    next[section][action] = !next[section][action];
  }
  return next;
}
