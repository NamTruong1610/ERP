const { prisma } = require('../config/PrismaConfig')

const procedureInclude = {
  createdBy: {
    select: { id: true, email: true, name: true }
  }
}

exports.findAllProcedures = async ({ take = 20, skip = 0, search, category, active } = {}, client = prisma) => {
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

exports.findProcedureById = async (id, client = prisma) => {
  return await client.procedureCatalog.findFirst({
    where: { id },
    include: procedureInclude
  })
}

exports.findProcedureByCode = async (code, client = prisma) => {
  return await client.procedureCatalog.findFirst({
    where: { code }
  })
}

exports.findProceduresByIds = async (ids, client = prisma) => {
  return await client.procedureCatalog.findMany({
    where: { id: { in: ids } },
    select: { id: true }
  })
}

exports.createProcedure = async (data, client = prisma) => {
  return await client.procedureCatalog.create({
    data,
    include: procedureInclude
  })
}

exports.updateProcedureById = async (id, data, client = prisma) => {
  return await client.procedureCatalog.update({
    where: { id },
    data,
    include: procedureInclude
  })
}