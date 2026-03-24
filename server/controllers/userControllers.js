const {
  findUserById,
  updateUserByName,
  updateUserByPhones,
  deleteUserPhoneByPhone,
  createUserAddress,
  updateUserAddressByAddressId,
  deleteUserAddressByAddressId
} = require("../services/userService")

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
      roles: userRecord.roles
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
