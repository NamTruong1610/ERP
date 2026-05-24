const PERMISSIONS = {
  PROFILE_READ:             'profile:read',
  PROFILE_UPDATE:           'profile:update',
  PROFILE_PASSWORD_CHANGE:  'profile:password:change',
  PROFILE_EMAIL_CHANGE:     'profile:email:change',
  PROFILE_PHONES_MANAGE:    'profile:phones:manage',
  PROFILE_ADDRESSES_MANAGE: 'profile:addresses:manage',

  USERS_READ:               'users:read',
  USERS_CREATE:             'users:create',
  USERS_UPDATE:             'users:update',
  USERS_DELETE:             'users:delete',
  USERS_SUSPEND:            'users:suspend',
  USERS_REACTIVATE:         'users:reactivate',
  USERS_FORCE_LOGOUT:       'users:force:logout',
  USERS_RESEND_ACTIVATION:  'users:resend:activation',
  USERS_RESET_2FA:          'users:2fa:reset',
  USERS_ROLES_MANAGE:       'users:roles:manage',

  PATIENTS_READ:   'patients:read',
  PATIENTS_CREATE: 'patients:create',
  PATIENTS_UPDATE: 'patients:update',
  PATIENTS_DELETE: 'patients:delete',

  APPOINTMENTS_READ:      'appointments:read',
  APPOINTMENTS_READ_ALL:  'appointments:read:all',
  APPOINTMENTS_CREATE:    'appointments:create',
  APPOINTMENTS_UPDATE:    'appointments:update',
  APPOINTMENTS_DELETE:    'appointments:delete',

  TREATMENTS_READ:      'treatments:read',
  TREATMENTS_READ_ALL:  'treatments:read:all',
  TREATMENTS_CREATE:    'treatments:create',
  TREATMENTS_UPDATE:    'treatments:update',
  TREATMENTS_DELETE:    'treatments:delete'
}

const ROLES = {
  STAFF: [
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

    PERMISSIONS.TREATMENTS_READ,
    PERMISSIONS.TREATMENTS_CREATE,
    PERMISSIONS.TREATMENTS_UPDATE,
  ],
  ADMIN: [
    ...Object.values(PERMISSIONS)
  ]
}

module.exports = { PERMISSIONS, ROLES }