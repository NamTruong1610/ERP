const { prisma } = require('../config/PrismaConfig')

// Include name and addresses by default for most queries
const userInclude = {
  name: true,
  addresses: true,
  roles: true,
  userMfa: true,
  userActivation: true
}

exports.findUserByEmail = async (email) => {
  return await prisma.user.findFirst({
    where: { 
      email,
      deletedAt: null
    },
    include: userInclude
  })
}

exports.findUserById = async (id) => {
  return await prisma.user.findFirst({
    where: { 
      id,
      deletedAt: null
    },
    include: userInclude,
  })
}

exports.findAllUsers = async () => {
  return await prisma.user.findMany({
    where: {
      deletedAt: null
    },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      roles: true,
      userMfa: {
        select: {
          enabled: true
        }
      },
      createdAt: true,
      updatedAt: true
    }
  })
}

exports.findAllDentistUsers = async() => {
  return await prisma.user.findMany({
    where: { status: 'ACTIVE', deletedAt: null },
    select: { id: true, email: true, name: true }
  })
}

exports.findAllUsersByString = async(query) => {
  return await prisma.user.findMany({
    where: {
      deletedAt: null,
      OR: [
        { email: { contains: query, mode: 'insensitive' } },
        { name: { is: { fName: { contains: query, mode: 'insensitive' } } } },
        { name: { is: { lName: { contains: query, mode: 'insensitive' } } } }
      ]
    },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      roles: true,
      userMfa: { select: { enabled: true } },
      createdAt: true,
      updatedAt: true
    }
  })
}

exports.createUser = async (newUserData, client = prisma) => {
  return await client.user.create({
    data: {
      ...newUserData,
      roles: {
        create: [{ role: 'STAFF' }]
      }
    },
    include: userInclude
  })
}

exports.updateUser = async (oldUserData, updatedUserData, client = prisma) => {
  const { name, addresses, ...rest } = updatedUserData

  const nameData = name ? Object.fromEntries(
    Object.entries({ fName: name.fName, mName: name.mName, lName: name.lName })
      .filter(([_, v]) => v !== undefined && v !== '')
  ) : undefined

  return await client.user.update({
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

exports.hardDeleteUserById = async (id, client = prisma) => {
  return await client.user.delete({
    where: { id }
  })
}

exports.softDeleteUserById = async (id, client = prisma) => {
  return await client.user.update({
    where: { id },
    data: { deletedAt: new Date() }
  })
}

exports.createUserRole = async (userId, role, client = prisma) => {
  return await client.userRole.create({
    data: { userId, role }
  })
}

exports.deleteUserRole = async (userId, role, client = prisma) => {
  return await client.userRole.delete({
    where: {
      userId_role: { userId, role }  // composite unique constraint
    }
  })
}

exports.createUserAddress = async (userData, address) => {
  await prisma.address.create({
    data: { ...address, userId: userData.id }
  })
  return await prisma.user.findFirst({
    where: { id: userData.id, deletedAt: null },
    include: userInclude
  })
}

exports.updateUserAddressByAddressId = async (userData, addressId, newAddress) => {
  await prisma.address.update({
    where: { id: addressId },
    data: newAddress
  })
  return await prisma.user.findFirst({
    where: { id: userData.id, deletedAt: null },
    include: userInclude
  })
}

exports.deleteUserAddressByAddressId = async (userData, addressId) => {
  await prisma.address.delete({ where: { id: addressId } })
  return await prisma.user.findFirst({
    where: { id: userData.id, deletedAt: null },
    include: userInclude
  })
}