const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })

const prisma = new PrismaClient({ adapter })

const prismaConnect = async () => {
  await prisma.$connect()
  console.log('Connected to PostgreSQL')
}

module.exports = { prisma, prismaConnect }