const User = require('../models/userSchema');

exports.findUserByEmail = async (email) => {
  return await User.findOne({email: email});
}

exports.findUserById = async (_id) => {
  return await User.findById({_id: _id});
}

exports.createUser = async (newUserData) => {
  return await User.insertOne(newUserData);
}

exports.updateUser = async (oldUserData, updatedUserData) => {
  for (const key in updatedUserData) {
    oldUserData[key] = updatedUserData[key]
  }
  return await User.save(oldUserData)
}

exports.deleteUserById = async(_id) => {
  return await User.findByIdAndDelete(_id);
}
