const {
  findUserByEmail,
  findUserById,
  createUser,
  deleteUserById
} = require("../services/userService")

const {
  generateActivationToken,
  hashToken
} = require("../utils/activationTokenUtils")

const {
  sendAccountActivationEmail
} = require("../utils/emailUtils")

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
  const { _id } = req.params
  try {
    const userRecord = await findUserById(_id);
    if (!userRecord) {
      return res.status(404).json({
        message: 'No user found'
      })
    }

    await deleteUserById(_id);

    return res.status(200).json({
      message: 'User deleted successfully'
    })
  } catch (error) {
    next(error);
  }

}