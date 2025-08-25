export const ROLES = {
  ADMIN: 'admin',
  PROCUREMENT_OFFICER: 'procurement_officer',
  VENDOR: 'vendor',
  AUDITOR: 'auditor',
};

export const PERMISSIONS = {
  ALL: 'all',
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
};

export const RESOURCES = {
  DASHBOARD: 'dashboard',
  TENDERS: 'tenders',
  VENDORS: 'vendors',
  BIDS: 'bids',
  INVOICES: 'invoices',
  PAYMENTS: 'payments',
  REPORTS: 'reports',
  USERS: 'users',
  AUDIT_LOGS: 'audit_logs',
};

export const NAVIGATION = [
  {
    name: 'Dashboard',
    path: '/',
    resource: RESOURCES.DASHBOARD,
    action: PERMISSIONS.READ,
  },
  {
    name: 'Procurement',
    path: '/procurement',
    resource: RESOURCES.TENDERS,
    action: PERMISSIONS.READ,
  },
  {
    name: 'Vendors',
    path: '/vendors',
    resource: RESOURCES.VENDORS,
    action: PERMISSIONS.READ,
  },
  {
    name: 'MSE Facilitation',
    path: '/mse-facilitation',
    resource: RESOURCES.VENDORS,
    action: PERMISSIONS.READ,
  },
  {
    name: 'Payments',
    path: '/payments',
    resource: RESOURCES.PAYMENTS,
    action: PERMISSIONS.READ,
  },
  {
    name: 'Reports',
    path: '/reports',
    resource: RESOURCES.REPORTS,
    action: PERMISSIONS.READ,
  },
  {
    name: 'Compliance',
    path: '/compliance',
    resource: RESOURCES.AUDIT_LOGS,
    action: PERMISSIONS.READ,
  },
];