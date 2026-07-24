const { prisma } = require('../config/PrismaConfig')
const { hashPassword } = require('../utils/passwordUtils')
const { generateMfaSecret } = require('../utils/mfaUtils')
const { UserStatus } = require('@prisma/client')

exports.seedAdminUser = async () => {
  const existing = await prisma.user.findFirst({
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


exports.seedSuperAdminUser = async () => {
  const email = 'superadmin@dentacore.local'

  const existing = await prisma.user.findFirst({
    where: { email, deletedAt: null }
  })

  if (existing) {
    console.log('Super admin already exists — skipping')
    console.log('  Email:    ', email)
    console.log('  Password: 123456')
    console.log('  MFA secret (paste into any TOTP app):', existing.userMfa?.mfaSecret ?? '(check DB)')
    return
  }

  const hashedPassword = await hashPassword('123456')

  // Generate a real TOTP secret so you can scan it with an authenticator app
  const secret = await generateMfaSecret('DentaCore (superadmin)')

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      status:   UserStatus.ACTIVE,
      name: {
        create: {
          fName: 'Super',
          lName: 'Admin',
        }
      },
      phones: ['0400 000 000'],
      addresses: {
        create: {
          street: '1 Admin Lane',
          suburb: 'Sydney',
          city:   'Sydney',
          post:   '2000',
        }
      },
      roles: {
        create: [
          { role: 'SUPER_ADMIN' },
          { role: 'ADMIN' },
          { role: 'STAFF' },
        ]
      },
      userMfa: {
        create: {
          enabled:   true,
          mfaSecret: secret.base32,
          mfaUri:    secret.otpauth_url,
        }
      }
    }
  })

  console.log('')
  console.log('✓ Super admin created')
  console.log('  ID:        ', user.id)
  console.log('  Email:     ', email)
  console.log('  Password:  123456')
  console.log('  MFA secret:', secret.base32)
  console.log('  OTP URI:   ', secret.otpauth_url)
  console.log('')
  console.log('  To generate a current OTP on the command line:')
  console.log(`  node -e "const s=require('speakeasy');console.log(s.totp({secret:'${secret.base32}',encoding:'base32'}))"`)
  console.log('')
  console.log('  Or scan the OTP URI with Google Authenticator / Authy.')
  console.log('')
}