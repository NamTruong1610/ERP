const { ROLES } = require('../config/RBACConfig')
const { findUserById } = require('../services/userService')

exports.requirePermission = (permission) => async (req, res, next) => {
  try {
    const userRecord = await findUserById(req.user._id)
    if (!userRecord || userRecord.status !== "ACTIVE") {
      return res.status(401).json({ message: "Unauthenticated" })
    }

    const hasPermission = userRecord.roles.some(role => {
      const rolePermissions = ROLES[role] || []
      return rolePermissions.includes(permission)
    })

    if (!hasPermission) {
      return res.status(403).json({ message: "Forbidden" })
    }

    next()
  } catch (error) {
    next(error)
  }

}