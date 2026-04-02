const {
  findAllUsers,
  findUserByEmail,
  findUserById,
  createUser,
  updateUser,
  deleteUserById,
  createUserRole,
  deleteUserRole
} = require("../services/userService")

const {
  generateActivationToken,
  hashToken
} = require("../utils/activationTokenUtils")

const {
  sendAccountActivationEmail
} = require("../utils/emailUtils")

const { redisClient } = require("../config/RedisConfig")
const { ROLES } = require('../config/RBACConfig')

exports.createUserController = async (req, res, next) => {
  const { email } = req.body
  try {
    const userRecord = await findUserByEmail(email);

    // To inform the admin this account was created but not activated yet
    if (userRecord && userRecord.status == "PENDING_ACTIVATION") {
      return res.status(403).json({
        message: 'User account awaiting activation'
      })
    }

    if (userRecord && userRecord.status == "ACTIVE") {
      return res.status(403).json({
        message: 'User account already exists'
      })
    }

    const rawActivationTokenId = await generateActivationToken();
    const hashedActivationTokenId = await hashToken(rawActivationTokenId);
    const TTL = 48 * 60 * 60 * 1000 // 48 hours
    const newUser = await createUser({
      email: email,
      activationTokenId: hashedActivationTokenId,
      expiresAt: new Date(Date.now() + TTL)
    });

    await sendAccountActivationEmail(email, rawActivationTokenId);

    return res.status(201).json({
      _id: newUser._id,
      email: newUser.email,
      status: newUser.status
    })

  } catch (error) {
    next(error)
  }
}

exports.deleteUserController = async (req, res, next) => {
  const { id } = req.params
  try {
    const userRecord = await findUserById(id);
    if (!userRecord) {
      return res.status(404).json({
        message: 'No user found'
      })
    }

    await deleteUserById(id);

    return res.status(200).json({
      message: 'User deleted successfully'
    })
  } catch (error) {
    next(error);
  }

}

exports.getAllUsersController = async (req, res, next) => {
  try {
    const users = await findAllUsers();
    return res.status(200).json({ users })
  } catch (error) {
    next(error)
  }
}

exports.getUserController = async (req, res, next) => {
  const { id } = req.params
  try {
    const userRecord = await findUserById(id)
    if (!userRecord) {
      return res.status(404).json({
        message: "User not found"
      })
    }

    return res.status(200).json({
      _id: userRecord._id,
      email: userRecord.email,
      name: userRecord.name,
      phones: userRecord.phones,
      addresses: userRecord.addresses,
      roles: userRecord.roles,
      status: userRecord.status,
      mfaEnabled: userRecord.mfaEnabled,
      createdAt: userRecord.createdAt,
      updatedAt: userRecord.updatedAt
    })

  } catch (error) {
    next(error)
  }
}

exports.suspendUserController = async (req, res, next) => {
  const { id } = req.params
  try {
    const userRecord = await findUserById(id)
    if (!userRecord) {
      return res.status(404).json({ message: "User not found" })
    }

    if (userRecord.status === "SUSPENDED") {
      return res.status(400).json({ message: "User is already suspended" })
    }

    // Invalidate all sessions and remember tokens
    const sessionIds = await redisClient.zRange(`user_sessions:${id}`, 0, -1)
    for (const sessionId of sessionIds) {
      await redisClient.del(`session:${sessionId}`)
    }
    await redisClient.del(`user_sessions:${id}`)

    const rememberTokens = await redisClient.zRange(`user_remember:${id}`, 0, -1)
    for (const tokenId of rememberTokens) {
      await redisClient.del(`token:remember:${tokenId}`)
    }
    await redisClient.del(`user_remember:${id}`)

    await updateUser(userRecord, { status: "SUSPENDED" })

    return res.status(200).json({ message: "User suspended successfully" })
  } catch (error) {
    next(error)
  }
}

// For users stuck in PENDING_ACTIVATION whose 48hr token expired
exports.reset2faController = async (req, res, next) => {
  const { id } = req.params
  try {
    const userRecord = await findUserById(id)
    if (!userRecord) {
      return res.status(404).json({ message: "User not found" })
    }

    if (!userRecord.mfaEnabled) {
      return res.status(400).json({ message: "User does not have 2FA enabled" })
    }

    await updateUser(userRecord, {
      mfaSecret: null,
      mfaUri: null,
      mfaEnabled: false,
      status: "PENDING_MFA_SETUP"
    })

    // Invalidate all sessions so the user is forced to log in and set up 2FA again
    const sessionIds = await redisClient.zRange(`user_sessions:${id}`, 0, -1)
    for (const sessionId of sessionIds) {
      await redisClient.del(`session:${sessionId}`)
    }
    await redisClient.del(`user_sessions:${id}`)

    const rememberTokens = await redisClient.zRange(`user_remember:${id}`, 0, -1)
    for (const tokenId of rememberTokens) {
      await redisClient.del(`token:remember:${tokenId}`)
    }
    await redisClient.del(`user_remember:${id}`)

    return res.status(200).json({ message: "2FA reset successfully" })
  } catch (error) {
    next(error)
  }
}

exports.resendActivationEmailController = async (req, res, next) => {
  const { id } = req.params
  try {
    const userRecord = await findUserById(id)
    if (!userRecord) {
      return res.status(404).json({ message: "User not found" })
    }

    if (userRecord.status !== "PENDING_ACTIVATION") {
      return res.status(400).json({ message: "User account is already activated" })
    }

    // Generate a new activation token and reset the TTL
    const rawActivationTokenId = await generateActivationToken()
    const hashedActivationTokenId = await hashToken(rawActivationTokenId)
    const TTL = 48 * 60 * 60 * 1000 // 48 hours

    await updateUser(userRecord, {
      activationTokenId: hashedActivationTokenId,
      expiresAt: new Date(Date.now() + TTL)
    })

    await sendAccountActivationEmail(userRecord.email, rawActivationTokenId)

    return res.status(200).json({ message: "Activation email resent successfully" })
  } catch (error) {
    next(error)
  }
}

exports.assignRoleController = async (req, res, next) => {
  const { id } = req.params
  const { role } = req.body
  try {
    const userRecord = await findUserById(id)
    if (!userRecord) {
      return res.status(404).json({ message: "User not found" })
    }

    if (!ROLES[role]) {
      return res.status(400).json({ message: "Invalid role" })
    }

    if (userRecord.roles.includes(role)) {
      return res.status(400).json({ message: "User already has this role" })
    }

    await createUserRole(userRecord, role)

    return res.status(200).json({ roles: userRecord.roles })
  } catch (error) {
    next(error)
  }
}

exports.removeRoleController = async (req, res, next) => {
  const { id } = req.params
  const { role } = req.body
  try {
    const userRecord = await findUserById(id)
    if (!userRecord) {
      return res.status(404).json({ message: "User not found" })
    }

    if (!userRecord.roles.includes(role)) {
      return res.status(400).json({ message: "User does not have this role" })
    }
    await deleteUserRole(userRecord, role)

    return res.status(200).json({ roles: userRecord.roles })
  } catch (error) {
    next(error)
  }
}

exports.forceLogoutUserController = async (req, res, next) => {
  const { id } = req.params
  try {
    const userRecord = await findUserById(id)
    if (!userRecord) {
      return res.status(404).json({ message: "User not found" })
    }

    const sessionIds = await redisClient.zRange(`user_sessions:${id}`, 0, -1)
    for (const sessionId of sessionIds) {
      await redisClient.del(`session:${sessionId}`)
    }
    await redisClient.del(`user_sessions:${id}`)

    const rememberTokens = await redisClient.zRange(`user_remember:${id}`, 0, -1)
    for (const tokenId of rememberTokens) {
      await redisClient.del(`token:remember:${tokenId}`)
    }
    await redisClient.del(`user_remember:${id}`)

    return res.status(200).json({ message: "User forcefully logged out successfully" })
  } catch (error) {
    next(error)
  }
}

exports.updateUserController = async (req, res, next) => {
  const { id } = req.params
  try {
    const userRecord = await findUserById(id)
    if (!userRecord) {
      return res.status(404).json({ message: "User not found" })
    }

    const allowedFields = ["name", "email", "phones", "addresses", "status"]
    const updates = {}

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields provided" })
    }

    if (updates.email) {
      const existingUser = await findUserByEmail(updates.email)
      if (existingUser && existingUser._id.toString() !== id) {
        return res.status(400).json({ message: "Email already in use" })
      }
    }

    const validStatuses = ["PENDING_ACTIVATION", "PENDING_MFA_SETUP", "PENDING_MFA_VERIFICATION", "ACTIVE", "SUSPENDED"]
    if (updates.status && !validStatuses.includes(updates.status)) {
      return res.status(400).json({ message: "Invalid status" })
    }

    const updatedUser = await updateUser(userRecord, updates)

    return res.status(200).json({
      _id: updatedUser._id,
      email: updatedUser.email,
      name: updatedUser.name,
      phones: updatedUser.phones,
      addresses: updatedUser.addresses,
      roles: updatedUser.roles,
      status: updatedUser.status,
      mfaEnabled: updatedUser.mfaEnabled,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt
    })
  } catch (error) {
    next(error)
  }
}

exports.reactivateUserController = async (req, res, next) => {
  const { id } = req.params
  try {
    const userRecord = await findUserById(id)
    if (!userRecord) {
      return res.status(404).json({ message: "User not found" })
    }

    if (userRecord.status !== "SUSPENDED") {
      return res.status(400).json({ message: "User is not suspended" })
    }

    await updateUser(userRecord, { status: "ACTIVE" })

    return res.status(200).json({ message: "User reactivated successfully" })
  } catch (error) {
    next(error)
  }
}


