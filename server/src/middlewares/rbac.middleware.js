import * as rbacConfig from '../config/rbac.config.js';
import * as userRepository from '../repositories/user.repository.js';
import { UserStatus } from '@prisma/client';
export const requirePermission = (permission) => async (req, res, next) => {
  try {
    const userRecord = await userRepository.findUserById(req.user.id)
    if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
      return res.status(401).json({ message: 'Unauthenticated' })
    }

    const hasPermission = userRecord.roles.some(userRole => {
      const rolePermissions = rbacConfig.ROLES[userRole.role] || []
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