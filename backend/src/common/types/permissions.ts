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
