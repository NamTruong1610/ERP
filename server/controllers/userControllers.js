const {
  updateUser,
  findUserById,
  findUserByEmail,
  createUserAddress,
  updateUserAddressByAddressId,
  deleteUserAddressByAddressId,
  findAllDentistUsers
} = require("../services/userService")

const {
  invalidateAllUserSessions
} = require("../services/sessionService")

const {
  comparePasswordHash,
  hashPassword
} = require("../utils/passwordUtils")

const {
  generateActivationToken
} = require("../utils/activationTokenUtils")

const {
  sendEmailChangeVerificationEmail
} = require("../utils/emailUtils")

const {
  verifyMfaOtp
} = require("../utils/mfaUtils")

const { redisClient } = require("../config/RedisConfig")

exports.getProfileController = async (req, res, next) => {
  const { id } = req.user
  try {
    const userRecord = await findUserById(id)
    if (!userRecord || userRecord.status !== "ACTIVE") {
      return res.status(401).json({
        message: "User not found"
      })
    }

    return res.status(200).json({
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      phones: userRecord.phones,
      addresses: userRecord.addresses,
      roles: userRecord.roles,
      mfaEnabled: userRecord.mfaEnabled
    })

  } catch (error) {
    next(error)
  }
}


exports.updateNameController = async (req, res, next) => {
  const { id } = req.user
  const { name } = req.body
  try {
    const userRecord = await findUserById(id)
    if (!userRecord || userRecord.status !== "ACTIVE") {
      return res.status(401).json({
        message: "User not found"
      })
    }

    const updatedUser = await updateUser(userRecord, { name })
    return res.status(200).json({
      name: updatedUser.name
    })

  } catch (error) {
    next(error)
  }
}

exports.updatePhonesController = async (req, res, next) => {
  const { id } = req.user
  const { phone } = req.body
  try {
    const userRecord = await findUserById(id)
    if (!userRecord || userRecord.status !== "ACTIVE") {
      return res.status(401).json({
        message: "User not found"
      })
    }
    const updatedUser = await updateUser(userRecord, {
      phones: [...userRecord.phones, phone]
    })
    return res.status(200).json({ phones: updatedUser.phones })
  } catch (error) {
    next(error)
  }
}

exports.removePhoneController = async (req, res, next) => {
  const { id } = req.user
  const { phone } = req.params
  try {
    const userRecord = await findUserById(id)
    if (!userRecord || userRecord.status !== "ACTIVE") {
      return res.status(404).json({ message: "User not found" })
    }

    const updatedUser = await updateUser(userRecord, {
      phones: userRecord.phones.filter(p => p !== phone)
    })

    return res.status(200).json({ phones: updatedUser.phones })
  } catch (error) {
    next(error)
  }
}

exports.addAddressController = async (req, res, next) => {
  const { id } = req.user
  const { address } = req.body
  try {
    const userRecord = await findUserById(id)
    if (!userRecord || userRecord.status !== "ACTIVE") {
      return res.status(404).json({ message: "User not found" })
    }

    const updatedUser = await createUserAddress(userRecord, address)

    return res.status(200).json({ addresses: updatedUser.addresses })
  } catch (error) {
    next(error)
  }
}

exports.updateAddressController = async (req, res, next) => {
  const { id } = req.user
  const { addressId } = req.params
  const { address } = req.body
  try {
    const userRecord = await findUserById(id)
    if (!userRecord || userRecord.status !== "ACTIVE") {
      return res.status(404).json({ message: "User not found" })
    }

    const updatedUser = await updateUserAddressByAddressId(userRecord, addressId, address)


    return res.status(200).json({ addresses: updatedUser.addresses })
  } catch (error) {
    next(error)
  }
}

exports.removeAddressController = async (req, res, next) => {
  const { id } = req.user
  const { addressId } = req.params
  try {
    const userRecord = await findUserById(id)
    if (!userRecord || userRecord.status !== "ACTIVE") {
      return res.status(404).json({ message: "User not found" })
    }

    const updatedUser = await deleteUserAddressByAddressId(userRecord, addressId)

    return res.status(200).json({ addresses: updatedUser.addresses })
  } catch (error) {
    next(error)
  }
}


exports.changePasswordController = async (req, res, next) => {
  const { currentPassword, newPassword, confirmNewPassword } = req.body
  const { id } = req.user
  try {
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: "Passwords do not match" })
    }

    const userRecord = await findUserById(id)
    if (!userRecord || userRecord.status !== "ACTIVE") {
      return res.status(404).json({ message: "User not found" })
    }

    const passwordsMatched = await comparePasswordHash(currentPassword, userRecord.password)
    if (!passwordsMatched) {
      return res.status(400).json({ message: "Invalid current password" })
    }

    const hashedPassword = await hashPassword(newPassword)
    await updateUser(userRecord, { password: hashedPassword })

    // Invalidate all other sessions so other devices are forced to re-login
    await invalidateAllUserSessions(id)

    res.clearCookie("SESSIONID", { httpOnly: true, secure: true, sameSite: "strict" })
    res.clearCookie("REMEMBER", { httpOnly: true, secure: true, sameSite: "strict" })

    return res.status(200).json({ message: "Password changed successfully" })

  } catch (error) {
    next(error)
  }
}

exports.changeEmailController = async (req, res, next) => {
  const { id } = req.user
  const { email, password } = req.body
  try {
    const userRecord = await findUserById(id)
    if (!userRecord || userRecord.status !== "ACTIVE") {
      return res.status(404).json({ message: "User not found" })
    }

    // Require password confirmation to prevent unauthorized email change
    const passwordsMatched = await comparePasswordHash(password, userRecord.password)
    if (!passwordsMatched) {
      return res.status(400).json({ message: "Invalid password" })
    }

    // Check new email isn't already taken
    const existingUser = await findUserByEmail(email)
    if (existingUser) {
      return res.status(400).json({ message: "Email already in use" })
    }

    // Delete any previously pending email change token
    const existingTokenRaw = await redisClient.get(`user_email_change:${id}`)
    if (existingTokenRaw) {
      const { tokenId } = JSON.parse(existingTokenRaw)
      await redisClient.del(`token:email_change:${tokenId}`)
      await redisClient.del(`user_email_change:${id}`)
    }

    const tokenId = await generateActivationToken()
    await redisClient.set(
      `token:email_change:${tokenId}`,
      JSON.stringify({ id, email }),
      { EX: 15 * 60 } // 15 mins
    )

    await redisClient.set(
      `user_email_change:${id}`,
      JSON.stringify({ tokenId }),
      { EX: 16 * 60 } // 16 mins
    )

    await sendEmailChangeVerificationEmail(email, tokenId)

    return res.status(200).json({ message: "Verification email sent" })
  } catch (error) {
    next(error)
  }
}

exports.verifyEmailChangeController = async (req, res, next) => {
  const { id } = req.user
  const { tokenId } = req.body
  try {
    const tokenRaw = await redisClient.get(`token:email_change:${tokenId}`)
    if (!tokenRaw) {
      return res.status(404).json({ message: "Invalid or expired token" })
    }

    const tokenData = JSON.parse(tokenRaw)

    // Ensure the token belongs to the authenticated user
    if (tokenData.id !== id) {
      return res.status(401).json({ message: "Unauthorized" })
    }

    const userRecord = await findUserById(id)
    if (!userRecord || userRecord.status !== "ACTIVE") {
      return res.status(404).json({ message: "User not found" })
    }

    await updateUser(userRecord, { email: tokenData.email })

    await redisClient.del(`token:email_change:${tokenId}`)
    await redisClient.del(`user_email_change:${id}`)

    return res.status(200).json({ message: "Email changed successfully" })
  } catch (error) {
    next(error)
  }
}

exports.disable2faController = async (req, res, next) => {
  const { id } = req.user
  const { password, otp } = req.body
  try {
    const userRecord = await findUserById(id)
    if (!userRecord || userRecord.status !== "ACTIVE") {
      return res.status(404).json({ message: "User not found" })
    }

    if (!userRecord.mfaEnabled) {
      return res.status(400).json({ message: "2FA is already disabled" })
    }

    const passwordsMatched = await comparePasswordHash(password, userRecord.password)
    if (!passwordsMatched) {
      return res.status(401).json({ message: "Invalid password" })
    }

    const validOtp = await verifyMfaOtp(otp, userRecord.mfaSecret)
    if (!validOtp) {
      return res.status(401).json({ message: "Invalid OTP" })
    }

    await updateUser(userRecord, { mfaEnabled: false })

    // Invalidate all sessions and force re-login
    await invalidateAllUserSessions(id)

    res.clearCookie("SESSIONID", { httpOnly: true, secure: true, sameSite: "strict" })
    res.clearCookie("REMEMBER", { httpOnly: true, secure: true, sameSite: "strict" })

    return res.status(200).json({ message: "2FA disabled successfully" })
  } catch (error) {
    next(error)
  }
}

exports.enable2faController = async (req, res, next) => {
  const { id } = req.user
  const { password, otp } = req.body
  try {
    const userRecord = await findUserById(id)
    if (!userRecord || userRecord.status !== "ACTIVE") {
      return res.status(404).json({ message: "User not found" })
    }

    if (userRecord.mfaEnabled) {
      return res.status(400).json({ message: "2FA is already enabled" })
    }

    // Make sure the user has a secret from the initial setup
    if (!userRecord.mfaSecret) {
      return res.status(400).json({ message: "No 2FA secret found, contact an administrator" })
    }

    const passwordsMatched = await comparePasswordHash(password, userRecord.password)
    if (!passwordsMatched) {
      return res.status(401).json({ message: "Invalid password" })
    }

    // Verify OTP to confirm authenticator app is still working
    const validOtp = await verifyMfaOtp(otp, userRecord.mfaSecret)
    if (!validOtp) {
      return res.status(401).json({ message: "Invalid OTP" })
    }

    await updateUser(userRecord, { mfaEnabled: true })

    return res.status(200).json({ message: "2FA enabled successfully" })
  } catch (error) {
    next(error)
  }
}

exports.getDentistsController = async (req, res, next) => {
  try {
    const dentists = await findAllDentistUsers()
    return res.status(200).json({ dentists })
  } catch (error) {
    next(error)
  }
}