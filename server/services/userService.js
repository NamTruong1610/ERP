const User = require('../models/userSchema');

exports.findUserByEmail = async (email) => {
  return await User.findOne({ email: email });
}

exports.findUserById = async (_id) => {
  return await User.findById({ _id: _id });
}

exports.findUserByActivationToken = async (token) => {
  return await User.findOne({ activationTokenId: token })
}


exports.createUser = async (newUserData) => {
  return await User.insertOne(newUserData);
}

exports.updateUser = async (oldUserData, updatedUserData) => {
  for (const key in updatedUserData) {
    oldUserData[key] = updatedUserData[key]
  }
  return await oldUserData.save()
}

exports.deleteUserExpiresAtById = async (userId) => {
  await User.updateOne(
    { _id: userId },
    { $unset: { expiresAt: "" } }
  );
}

exports.deleteUserById = async (_id) => {
  return await User.findByIdAndDelete(_id);
}
