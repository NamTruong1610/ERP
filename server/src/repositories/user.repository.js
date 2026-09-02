import * as prismaConfig from '../config/prisma.config.js';
import { UserStatus } from '@prisma/client';
// Include name and addresses by default for most queries
const userInclude = {
  name: true,
  addresses: true,
  roles: true,
  userMfa: true,
  userActivation: true
}

export const findUserByEmail = async (email) => {
  return await prismaConfig.prisma.user.findFirst({
    where: {
      email,
      deletedAt: null
    },
    include: userInclude
  })
}

export const findUserById = async (id) => {
  return await prismaConfig.prisma.user.findFirst({
    where: {
      id,
      deletedAt: null
    },
    include: userInclude,
  })
}

export const findAllUsers = async ({ take = 20, skip = 0 } = {}, client = prismaConfig.prisma) => {
  const [users, total] = await Promise.all([
    client.user.findMany({
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
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip
    }),
    client.user.count({ where: { deletedAt: null } })
  ])
  return { users, total, take, skip }
}

export const findAllDentistUsers = async () => {
  return await prismaConfig.prisma.user.findMany({
    where: { status: 'ACTIVE', deletedAt: null },
    select: { id: true, email: true, name: true }
  })
}

export const findAllUsersByString = async (search, { take = 20, skip = 0 } = {}, client = prismaConfig.prisma) => {
  const where = {
    deletedAt: null,
    OR: [
      { email: { contains: search, mode: 'insensitive' } },
      { name: { fName: { contains: search, mode: 'insensitive' } } },
      { name: { lName: { contains: search, mode: 'insensitive' } } }
    ]
  }
  const [users, total] = await Promise.all([
    client.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        roles: true,
        userMfa: { select: { enabled: true } },
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip
    }),
    client.user.count({ where })
  ])
  return { users, total, take, skip }
}

// Find all soft-deleted users — super admin deleted users viewer
export const findAllDeletedUsers = async (client = prismaConfig.prisma) => {
  return await client.user.findMany({
    where: { deletedAt: { not: null } },
    include: userInclude,
    orderBy: { deletedAt: 'desc' }
  })
}

export const findDeletedUserById = async (id, client = prismaConfig.prisma) => {
  return await prismaConfig.prisma.user.findFirst({
    where: { id, deletedAt: { not: null } },
    include: { userActivation: true }
  })
}

// Restore a soft-deleted user — resets to PENDING_ACTIVATION so they
// go through the full activation flow again with a fresh password and MFA
export const restoreUser = async (id, client = prismaConfig.prisma) => {
  return await client.user.update({
    where: { id },
    data: {
      deletedAt: null,
      status: UserStatus.PENDING_ACTIVATION
    },
    include: userInclude
  })
}

export const createUser = async (newUserData, client = prismaConfig.prisma) => {
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

export const updateUser = async (oldUserData, updatedUserData, client = prismaConfig.prisma) => {
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

export const hardDeleteUserById = async (id, client = prismaConfig.prisma) => {
  return await client.user.delete({
    where: { id }
  })
}

export const softDeleteUserById = async (id, client = prismaConfig.prisma) => {
  return await client.user.update({
    where: { id },
    data: { deletedAt: new Date() }
  })
}

export const createUserRole = async (userId, role, client = prismaConfig.prisma) => {
  return await client.userRole.create({
    data: { userId, role }
  })
}

export const deleteUserRole = async (userId, role, client = prismaConfig.prisma) => {
  return await client.userRole.delete({
    where: {
      userId_role: { userId, role }  // composite unique constraint
    }
  })
}

export const createUserAddress = async (userData, address) => {
  await prismaConfig.prisma.address.create({
    data: { ...address, userId: userData.id }
  })
  return await prismaConfig.prisma.user.findFirst({
    where: { id: userData.id, deletedAt: null },
    include: userInclude
  })
}

export const updateUserAddressByAddressId = async (userData, addressId, newAddress) => {
  await prismaConfig.prisma.address.update({
    where: { id: addressId },
    data: newAddress
  })
  return await prismaConfig.prisma.user.findFirst({
    where: { id: userData.id, deletedAt: null },
    include: userInclude
  })
}

export const deleteUserAddressByAddressId = async (userData, addressId) => {
  await prismaConfig.prisma.address.delete({ where: { id: addressId } })
  return await prismaConfig.prisma.user.findFirst({
    where: { id: userData.id, deletedAt: null },
    include: userInclude
  })
}