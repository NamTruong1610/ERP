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

exports.findAllDentistUsers = async() => {
  return await prisma.user.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, email: true, name: true }
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

  const nameData = name ? Object.fromEntries(
    Object.entries({ fName: name.fName, mName: name.mName, lName: name.lName })
      .filter(([_, v]) => v !== undefined && v !== '')
  ) : undefined

  return await prisma.user.update({
    where: { id: oldUserData.id },
    data: {
      ...rest,
      ...(nameData && {
        name: {
          upsert: {
            create: nameData,
            update: nameData
          }
        }
      })
    },
    include: userInclude
  })
}

exports.createUserAddress = async (userData, address) => {
  await prisma.address.create({
    data: { ...address, userId: userData.id }
  })
  return await prisma.user.findUnique({
    where: { id: userData.id },
    include: userInclude
  })
}

exports.updateUserAddressByAddressId = async (userData, addressId, newAddress) => {
  await prisma.address.update({
    where: { id: addressId },
    data: newAddress
  })
  return await prisma.user.findUnique({
    where: { id: userData.id },
    include: userInclude
  })
}

exports.deleteUserAddressByAddressId = async (userData, addressId) => {
  await prisma.address.delete({ where: { id: addressId } })
  return await prisma.user.findUnique({
    where: { id: userData.id },
    include: userInclude
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
