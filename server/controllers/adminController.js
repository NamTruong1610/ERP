const {
  findUserByEmail,
  findUserById,
  createUser,
  deleteUserById
} = require("../services/userService")

const {
  generateActivationTokenId
} = require("../utils/activationTokenUtils")

const {
  sendAccountActivationEmail
} = require("../utils/emailUtils")

exports.createUserController = async (req, res, next) => {
  const { email } = req.body
  try {
    const userRecord = await findUserByEmail(email);
    if (userRecord && userRecord.status == "INACTIVE") {
      return res.status(202).json({
        message: 'User account inactive'
      })
    }

    const activationTokenId = await generateActivationTokenId();
    const newUser = await createUser({
      email: email,
      activationTokenId: activationTokenId
    });

    await sendAccountActivationEmail(email, activationTokenId);

    return res.status(201).json({
      _id: newUser._id,
      email: newUser.email,
      status: newUser.status
    })

  } catch (error) {
    next(error)
  }
}

exports.deleteInactiveUserController = async (req, res, next) => {
  const { _id } = req.params
  try {
    const userRecord = await findUserById(_id);
    if (!userRecord || userRecord && !(userRecord.status == "INACTIVE" || userRecord.status == "PENDING_ACTIVATION")) {
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