import * as prismaConfig from '../config/prisma.config.js';
const procedureInclude = {
  createdBy: {
    select: { id: true, email: true, name: true }
  }
}

export const findAllProcedures = async ({ take = 20, skip = 0, search, category, active } = {}, client = prismaConfig.prisma) => {
  const where = {
    ...(active !== undefined && { active }),
    ...(category && { category }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } }
      ]
    })
  }
  const [procedures, total] = await Promise.all([
    client.procedureCatalog.findMany({
      where,
      include: procedureInclude,
      orderBy: { name: 'asc' },
      take,
      skip
    }),
    client.procedureCatalog.count({ where })
  ])
  return { procedures, total, take, skip }
}

export const findProcedureById = async (id, client = prismaConfig.prisma) => {
  return await client.procedureCatalog.findFirst({
    where: { id },
    include: procedureInclude
  })
}

export const findProcedureByCode = async (code, client = prismaConfig.prisma) => {
  return await client.procedureCatalog.findFirst({
    where: { code }
  })
}

export const findProceduresByIds = async (ids, client = prismaConfig.prisma) => {
  return await client.procedureCatalog.findMany({
    where: { id: { in: ids } },
    select: { id: true }
  })
}

export const createProcedure = async (data, client = prismaConfig.prisma) => {
  return await client.procedureCatalog.create({
    data,
    include: procedureInclude
  })
}

export const updateProcedureById = async (id, data, client = prismaConfig.prisma) => {
  return await client.procedureCatalog.update({
    where: { id },
    data,
    include: procedureInclude
  })
}