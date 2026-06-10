const { ROLES } = require('../config/RBACConfig')
const { findUserById } = require('../services/userService')
const { UserStatus } = require('@prisma/client')

exports.requirePermission = (permission) => async (req, res, next) => {
  try {
    const userRecord = await findUserById(req.user.id)
    if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
      return res.status(401).json({ message: 'Unauthenticated' })
    }

    const hasPermission = userRecord.roles.some(userRole => {
      const rolePermissions = ROLES[userRole.role] || []
      return rolePermissions.includes(permission)
    })

    if (!hasPermission) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    next()
  } catch (error) {
    next(error)
  }
}