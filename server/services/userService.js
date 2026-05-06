const { prisma } = require('../config/PrismaConfig')

// Include name and addresses by default for most queries
const userInclude = {
  name: true,
  addresses: true
}

exports.findUserByEmail = async (email) => {
  return await prisma.user.findUnique({
    where: { email },
    include: userInclude
  })
}

exports.findUserById = async (id) => {
  return await prisma.user.findUnique({
    where: { id },
    include: userInclude
  })
}

exports.findUserByActivationToken = async (token) => {
  return await prisma.user.findUnique({
    where: { activationTokenId: token },
    include: userInclude
  })
}

exports.findAllUsers = async () => {
  return await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      roles: true,
      mfaEnabled: true,
      createdAt: true,
      updatedAt: true
    }
  })
}

exports.createUser = async (newUserData) => {
  return await prisma.user.create({
    data: newUserData
  })
}

exports.createUserRole = async (userData, role) => {
  return await prisma.user.update({
    where: { id: userData.id },
    data: {
      roles: { push: role }
    },
    include: userInclude
  })
}

exports.deleteUserRole = async (userData, role) => {
  return await prisma.user.update({
    where: { id: userData.id },
    data: {
      roles: userData.roles.filter(r => r !== role)
    },
    include: userInclude
  })
}

exports.updateUser = async (oldUserData, updatedUserData) => {
  const { name, addresses, ...rest } = updatedUserData

  return await prisma.user.update({
    where: { id: oldUserData.id },
    data: {
      ...rest,
      ...(name && {
        name: {
          upsert: {
            create: name,
            update: name
          }
        }
      })
    },
    include: userInclude
  })
}

exports.updateUserByName = async (oldUserData, updatedUserData) => {
  return await prisma.user.update({
    where: { id: oldUserData.id },
    data: {
      name: {
        upsert: {
          create: updatedUserData.name,
          update: updatedUserData.name
        }
      }
    },
    include: userInclude
  })
}

exports.updateUserByPhones = async (oldUserData, phone) => {
  if (!oldUserData.phones.includes(phone)) {
    return await prisma.user.update({
      where: { id: oldUserData.id },
      data: {
        phones: { push: phone }
      },
      include: userInclude
    })
  }
}

exports.deleteUserPhoneByPhone = async (oldUserData, phone) => {
  return await prisma.user.update({
    where: { id: oldUserData.id },
    data: {
      phones: oldUserData.phones.filter(p => p !== phone)
    },
    include: userInclude
  })
}

exports.createUserAddress = async (oldUserData, address) => {
  return await prisma.address.create({
    data: {
      ...address,
      userId: oldUserData.id
    }
  })
}

exports.updateUserAddressByAddressId = async (oldUserData, addressId, newAddress) => {
  return await prisma.address.update({
    where: { id: addressId },
    data: newAddress
  })
}

exports.deleteUserAddressByAddressId = async (oldUserData, addressId) => {
  return await prisma.address.delete({
    where: { id: addressId }
  })
}

exports.deleteUserExpiresAtById = async (userId) => {
  return await prisma.user.update({
    where: { id: userId },
    data: { expiresAt: null }
  })
}

exports.deleteUserById = async (id) => {
  return await prisma.user.delete({
    where: { id }
  })
}
