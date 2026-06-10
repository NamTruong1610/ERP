const { prisma } = require('../config/PrismaConfig')
const { hashPassword } = require('../utils/passwordUtils')

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
      name: {
        create: {
          fName: 'Admin',
          lName: 'User'
        }
      },
      roles: {
        create: [
          { role: 'ADMIN' },
          { role: 'STAFF' }
        ]
      },
      userMfa: {
        create: {
          enabled: false
        }
      }
    }
  })

  console.log('Admin user created')
}