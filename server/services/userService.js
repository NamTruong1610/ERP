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

exports.findAllUsers = async () => {
  return await User.find().select('email name status roles mfaEnabled createdAt updatedAt')
}

exports.createUser = async (newUserData) => {
  return await User.insertOne(newUserData);
}

exports.createUserRole = async (userData, role) => {
  userData.roles.push(role)
  return await userData.save()
}

exports.deleteUserRole = async (userData, role) => {
  userData.roles = userData.roles.filter(r => r !== role)
  return await userData.save()
}

exports.updateUser = async (oldUserData, updatedUserData) => {
  for (const key in updatedUserData) {
    oldUserData[key] = updatedUserData[key]
  }
  return await oldUserData.save()
}

exports.updateUserByName = async (oldUserData, updatedUserData) => {
  if (updatedUserData.name) {
    oldUserData.name.fName = updatedUserData.name.fName
    oldUserData.name.mName = updatedUserData.name.mName
    oldUserData.name.lName = updatedUserData.name.lName
  }

  return await oldUserData.save()
}

exports.updateUserByPhones = async (oldUserData, phone) => {
  if (!oldUserData.phones.includes(phone)) {
    oldUserData.phones.push(phone)
    await oldUserData.save()
  }
}

exports.deleteUserPhoneByPhone = async (oldUserData, phone) => {
  oldUserData.phones = oldUserData.phones.filter(p => p !== phone)
  await oldUserData.save()
}

exports.createUserAddress = async (oldUserData, address) => {
  oldUserData.addresses.push(address)
  await oldUserData.save()
}

exports.updateUserAddressByAddressId = async (oldUserData, addressId, newAddress) => {
  const oldAddress = await oldUserData.addresses.id(addressId)
  Object.assign(oldAddress, newAddress) // only updates fields provided
  await oldUserData.save()
}

exports.deleteUserAddressByAddressId = async (oldUserData, addressId) => {
  oldUserData.addresses.pull(addressId) // Mongoose subdocument removal by id
  await oldUserData.save()
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
