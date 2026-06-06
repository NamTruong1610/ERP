const { prisma } = require('../config/PrismaConfig')

exports.seedAdminUser = async () => {
  const existing = await prisma.user.findUnique({
    where: { email: 'test1@gmail.com' }
  })

  if (existing) {
    console.log('Admin user already exists')
    return
  }

  const hashedPassword = await hashPassword('123456')

  await prisma.user.create({
    data: {
      email: 'test1@gmail.com',
      password: hashedPassword,
      status: 'ACTIVE',
      roles: ['ADMIN', 'STAFF'],
      mfaEnabled: false,
      name: {
        create: {
          fName: 'Admin',
          lName: 'User'
        }
      }
    }
  })

  console.log('Admin user created')
}