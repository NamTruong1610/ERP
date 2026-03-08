const User = require('../models/userSchema');

exports.findUserByEmail = async (email) => {
  return await User.findOne(email);
}

exports.createUser = async (newUserData) => {
  return await User.insertOne(newUserData)
}
