const PERMISSIONS = {
  // Profile (self-service)
  PROFILE_READ:             'profile:read',
  PROFILE_UPDATE:           'profile:update',
  PROFILE_PASSWORD_CHANGE:  'profile:password:change',
  PROFILE_EMAIL_CHANGE:     'profile:email:change',
  PROFILE_PHONES_MANAGE:    'profile:phones:manage',
  PROFILE_ADDRESSES_MANAGE: 'profile:addresses:manage',

  // User management (admin)
  USERS_READ:               'users:read',
  USERS_CREATE:             'users:create',
  USERS_UPDATE:             'users:update',
  USERS_DELETE:             'users:delete',
  USERS_SUSPEND:            'users:suspend',
  USERS_REACTIVATE:         'users:reactivate',
  USERS_FORCE_LOGOUT:       'users:force_logout',
  USERS_RESEND_ACTIVATION:  'users:resend_activation',
  USERS_RESET_2FA:          'users:reset_2fa',
  USERS_ROLES_MANAGE:       'users:roles:manage',

  // Patients
  PATIENTS_READ:            'patients:read',
  PATIENTS_CREATE:          'patients:create',
  PATIENTS_UPDATE:          'patients:update',
  PATIENTS_DELETE:          'patients:delete',

  // Appointments
  APPOINTMENTS_READ:        'appointments:read',
  APPOINTMENTS_READ_ALL:    'appointments:read_all',
  APPOINTMENTS_CREATE:      'appointments:create',
  APPOINTMENTS_UPDATE:      'appointments:update',
  APPOINTMENTS_DELETE:      'appointments:delete',

  // Treatments
  TREATMENTS_READ:          'treatments:read',
  TREATMENTS_READ_ALL:      'treatments:read_all',
  TREATMENTS_CREATE:        'treatments:create',
  TREATMENTS_UPDATE:        'treatments:update',
  TREATMENTS_DELETE:        'treatments:delete',

  // Treatment plans
  TREATMENT_PLANS_READ:        'treatment_plans:read',
  TREATMENT_PLANS_READ_ALL:    'treatment_plans:read_all',
  TREATMENT_PLANS_CREATE:      'treatment_plans:create',
  TREATMENT_PLANS_UPDATE:      'treatment_plans:update',

  // Visits
  VISITS_READ:          'visits:read',
  VISITS_READ_ALL:      'visits:read_all',
  VISITS_CREATE:        'visits:create',
  VISITS_UPDATE:        'visits:update',
  VISITS_DELETE:        'visits:delete',

  // Invoices
  INVOICES_READ:            'invoices:read',
  INVOICES_READ_ALL:        'invoices:read_all',
  INVOICES_CREATE:          'invoices:create',
  INVOICES_UPDATE:          'invoices:update',
  INVOICES_ISSUE:           'invoices:issue',
  INVOICES_VOID:            'invoices:void',
  INVOICES_DELETE:          'invoices:delete',

  // Payments
  INVOICES_RECORD_PAYMENT:  'invoices:record_payment',
  PAYMENTS_REVERSE:         'payments:reverse',
  PAYMENTS_REFUND:          'payments:refund',

  // Files
  FILES_READ:               'files:read',
  FILES_UPLOAD:             'files:upload',
  FILES_DELETE:             'files:delete',
  FILES_PURGE:              'files:purge',

  // Super admin — audit
  AUDIT_READ:               'audit:read',
  AUDIT_EXPORT:             'audit:export',

  // Super admin — sessions
  SESSIONS_READ_ALL:        'sessions:read_all',
  SESSIONS_REVOKE_ALL:      'sessions:revoke_all',

  // Super admin — deleted records
  DELETED_USERS_READ:       'deleted_users:read',
  DELETED_USERS_RESTORE:    'deleted_users:restore',
  DELETED_USERS_PURGE:      'deleted_users:purge',

  // Super admin — system config
  SYSTEM_CONFIG_READ:       'system:config:read',
  SYSTEM_CONFIG_UPDATE:     'system:config:update',
}

const STAFF_PERMISSIONS = [
  PERMISSIONS.PROFILE_READ,
  PERMISSIONS.PROFILE_UPDATE,
  PERMISSIONS.PROFILE_PASSWORD_CHANGE,
  PERMISSIONS.PROFILE_EMAIL_CHANGE,
  PERMISSIONS.PROFILE_PHONES_MANAGE,
  PERMISSIONS.PROFILE_ADDRESSES_MANAGE,
  PERMISSIONS.PATIENTS_READ,
  PERMISSIONS.PATIENTS_CREATE,
  PERMISSIONS.PATIENTS_UPDATE,
  PERMISSIONS.PATIENTS_DELETE,
  PERMISSIONS.APPOINTMENTS_READ,
  PERMISSIONS.APPOINTMENTS_READ_ALL,
  PERMISSIONS.APPOINTMENTS_CREATE,
  PERMISSIONS.APPOINTMENTS_UPDATE,
  PERMISSIONS.APPOINTMENTS_DELETE,
  PERMISSIONS.TREATMENTS_READ,
  PERMISSIONS.TREATMENTS_READ_ALL,
  PERMISSIONS.TREATMENTS_CREATE,
  PERMISSIONS.TREATMENTS_UPDATE,
  PERMISSIONS.TREATMENTS_DELETE,
  PERMISSIONS.TREATMENT_PLANS_READ,
  PERMISSIONS.TREATMENT_PLANS_READ_ALL,
  PERMISSIONS.TREATMENT_PLANS_CREATE,
  PERMISSIONS.TREATMENT_PLANS_UPDATE,
  PERMISSIONS.VISITS_READ,
  PERMISSIONS.VISITS_READ_ALL,
  PERMISSIONS.VISITS_CREATE,
  PERMISSIONS.VISITS_UPDATE,
  PERMISSIONS.VISITS_DELETE,
  PERMISSIONS.FILES_READ,
  PERMISSIONS.FILES_UPLOAD,
  PERMISSIONS.FILES_DELETE,
]

const ADMIN_PERMISSIONS = [
  ...STAFF_PERMISSIONS,
  PERMISSIONS.USERS_READ,
  PERMISSIONS.USERS_CREATE,
  PERMISSIONS.USERS_UPDATE,
  PERMISSIONS.USERS_DELETE,
  PERMISSIONS.USERS_SUSPEND,
  PERMISSIONS.USERS_REACTIVATE,
  PERMISSIONS.USERS_FORCE_LOGOUT,
  PERMISSIONS.USERS_RESEND_ACTIVATION,
  PERMISSIONS.USERS_RESET_2FA,
  PERMISSIONS.USERS_ROLES_MANAGE,
  PERMISSIONS.PAYMENTS_REVERSE,
  PERMISSIONS.PAYMENTS_REFUND,
  PERMISSIONS.INVOICES_READ,
  PERMISSIONS.INVOICES_READ_ALL,
  PERMISSIONS.INVOICES_CREATE,
  PERMISSIONS.INVOICES_UPDATE,
  PERMISSIONS.INVOICES_ISSUE,
  PERMISSIONS.INVOICES_VOID,
  PERMISSIONS.INVOICES_RECORD_PAYMENT,
]

const SUPER_ADMIN_PERMISSIONS = [
  ...ADMIN_PERMISSIONS,
  PERMISSIONS.FILES_PURGE,
  PERMISSIONS.AUDIT_READ,
  PERMISSIONS.AUDIT_EXPORT,
  PERMISSIONS.SESSIONS_READ_ALL,
  PERMISSIONS.SESSIONS_REVOKE_ALL,
  PERMISSIONS.DELETED_USERS_READ,
  PERMISSIONS.DELETED_USERS_RESTORE,
  PERMISSIONS.DELETED_USERS_PURGE,
  PERMISSIONS.SYSTEM_CONFIG_READ,
  PERMISSIONS.SYSTEM_CONFIG_UPDATE,
]

const ROLES = {
  STAFF:       STAFF_PERMISSIONS,
  ADMIN:       ADMIN_PERMISSIONS,
  SUPER_ADMIN: SUPER_ADMIN_PERMISSIONS,
}

module.exports = { PERMISSIONS, ROLES }