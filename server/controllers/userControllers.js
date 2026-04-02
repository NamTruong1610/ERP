const {
  updateUser,
  findUserById,
  findUserByEmail,
  updateUserByName,
  updateUserByPhones,
  deleteUserPhoneByPhone,
  createUserAddress,
  updateUserAddressByAddressId,
  deleteUserAddressByAddressId
} = require("../services/userService")

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
  const { _id } = req.user
  try {
    const userRecord = await findUserById(_id)
    if (!userRecord || userRecord.status !== "ACTIVE") {
      return res.status(401).json({
        message: "User not found"
      })
    }

    return res.status(200).json({
      id: userRecord._id,
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
  const { _id } = req.user
  const { name } = req.body
  try {
    const userRecord = await findUserById(_id)
    if (!userRecord || userRecord.status !== "ACTIVE") {
      return res.status(401).json({
        message: "User not found"
      })
    }

    await updateUserByName(userRecord, {
      name: name,
    })
    return res.status(200).json({
      message: "User's name updated successfully"
    })

  } catch (error) {
    next(error)
  }
}

exports.updatePhonesController = async (req, res, next) => {
  const { _id } = req.user
  const { phone } = req.body
  try {
    const userRecord = await findUserById(_id)
    if (!userRecord || userRecord.status !== "ACTIVE") {
      return res.status(401).json({
        message: "User not found"
      })
    }
    await updateUserByPhones(userRecord, phone)
    return res.status(200).json({ phones: userRecord.phones })
  } catch (error) {
    next(error)
  }
}

exports.removePhoneController = async (req, res, next) => {
  const { _id } = req.user
  const { phone } = req.params
  try {
    const userRecord = await findUserById(_id)
    if (!userRecord || userRecord.status !== "ACTIVE") {
      return res.status(404).json({ message: "User not found" })
    }

    await deleteUserPhoneByPhone(userRecord, phone)

    return res.status(200).json({ phones: userRecord.phones })
  } catch (error) {
    next(error)
  }
}

exports.addAddressController = async (req, res, next) => {
  const { _id } = req.user
  const { address } = req.body
  try {
    const userRecord = await findUserById(_id)
    if (!userRecord || userRecord.status !== "ACTIVE") {
      return res.status(404).json({ message: "User not found" })
    }

    await createUserAddress(userRecord, address)

    return res.status(200).json({ addresses: userRecord.addresses })
  } catch (error) {
    next(error)
  }
}

exports.updateAddressController = async (req, res, next) => {
  const { _id } = req.user
  const { addressId } = req.params
  const { address } = req.body
  try {
    const userRecord = await findUserById(_id)
    if (!userRecord || userRecord.status !== "ACTIVE") {
      return res.status(404).json({ message: "User not found" })
    }

    await updateUserAddressByAddressId(userRecord, addressId, address)

    return res.status(200).json({ addresses: userRecord.addresses })
  } catch (error) {
    next(error)
  }
}

exports.removeAddressController = async (req, res, next) => {
  const { _id } = req.user
  const { addressId } = req.params
  try {
    const userRecord = await findUserById(_id)
    if (!userRecord || userRecord.status !== "ACTIVE") {
      return res.status(404).json({ message: "User not found" })
    }

    await deleteUserAddressByAddressId(userRecord, addressId)

    return res.status(200).json({ addresses: userRecord.addresses })
  } catch (error) {
    next(error)
  }
}


exports.changePasswordController = async (req, res, next) => {
  const { currentPassword, newPassword, confirmNewPassword } = req.body
  const { _id } = req.user
  try {
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: "Passwords do not match" })
    }

    const userRecord = await findUserById(_id)
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
    const sessionIds = await redisClient.zRange(`user_sessions:${_id}`, 0, -1)
    for (const sessionId of sessionIds) {
      await redisClient.del(`session:${sessionId}`)
    }
    await redisClient.del(`user_sessions:${_id}`)

    const rememberTokens = await redisClient.zRange(`user_remember:${_id}`, 0, -1)
    for (const tokenId of rememberTokens) {
      await redisClient.del(`token:remember:${tokenId}`)
    }
    await redisClient.del(`user_remember:${_id}`)

    res.clearCookie("SESSIONID", { httpOnly: true, secure: true, sameSite: "strict" })
    res.clearCookie("REMEMBER", { httpOnly: true, secure: true, sameSite: "strict" })

    return res.status(200).json({ message: "Password changed successfully" })

  } catch (error) {
    next(error)
  }
}

exports.changeEmailController = async (req, res, next) => {
  const { _id } = req.user
  const { email, password } = req.body
  try {
    const userRecord = await findUserById(_id)
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
    const existingTokenRaw = await redisClient.get(`user_email_change:${_id}`)
    if (existingTokenRaw) {
      const { tokenId } = JSON.parse(existingTokenRaw)
      await redisClient.del(`token:email_change:${tokenId}`)
      await redisClient.del(`user_email_change:${_id}`)
    }

    const tokenId = await generateActivationToken()
    await redisClient.set(
      `token:email_change:${tokenId}`,
      JSON.stringify({ _id, email }),
      { EX: 15 * 60 } // 15 mins
    )

    await redisClient.set(
      `user_email_change:${_id}`,
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
  const { _id } = req.user
  const { tokenId } = req.body
  try {
    const tokenRaw = await redisClient.get(`token:email_change:${tokenId}`)
    if (!tokenRaw) {
      return res.status(404).json({ message: "Invalid or expired token" })
    }

    const tokenData = JSON.parse(tokenRaw)

    // Ensure the token belongs to the authenticated user
    if (tokenData._id !== _id) {
      return res.status(401).json({ message: "Unauthorized" })
    }

    const userRecord = await findUserById(_id)
    if (!userRecord || userRecord.status !== "ACTIVE") {
      return res.status(404).json({ message: "User not found" })
    }

    await updateUser(userRecord, { email: tokenData.email })

    await redisClient.del(`token:email_change:${tokenId}`)
    await redisClient.del(`user_email_change:${_id}`)

    return res.status(200).json({ message: "Email changed successfully" })
  } catch (error) {
    next(error)
  }
}

exports.disable2faController = async (req, res, next) => {
  const { _id } = req.user
  const { password, otp } = req.body
  try {
    const userRecord = await findUserById(_id)
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
    const sessionIds = await redisClient.zRange(`user_sessions:${_id}`, 0, -1)
    for (const sessionId of sessionIds) {
      await redisClient.del(`session:${sessionId}`)
    }
    await redisClient.del(`user_sessions:${_id}`)

    const rememberTokens = await redisClient.zRange(`user_remember:${_id}`, 0, -1)
    for (const tokenId of rememberTokens) {
      await redisClient.del(`token:remember:${tokenId}`)
    }
    await redisClient.del(`user_remember:${_id}`)

    res.clearCookie("SESSIONID", { httpOnly: true, secure: true, sameSite: "strict" })
    res.clearCookie("REMEMBER", { httpOnly: true, secure: true, sameSite: "strict" })

    return res.status(200).json({ message: "2FA disabled successfully" })
  } catch (error) {
    next(error)
  }
}

exports.enable2faController = async (req, res, next) => {
  const { _id } = req.user
  const { password, otp } = req.body
  try {
    const userRecord = await findUserById(_id)
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

