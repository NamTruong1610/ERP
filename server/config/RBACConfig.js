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
}

const ROLES = {
  STAFF: [
    PERMISSIONS.PROFILE_READ,
    PERMISSIONS.PROFILE_UPDATE,
    PERMISSIONS.PROFILE_PASSWORD_CHANGE,
    PERMISSIONS.PROFILE_EMAIL_CHANGE,
    PERMISSIONS.PROFILE_PHONES_MANAGE,
    PERMISSIONS.PROFILE_ADDRESSES_MANAGE,
  ],
  ADMIN: [
    ...Object.values(PERMISSIONS)
  ]
}

module.exports = { PERMISSIONS, ROLES }