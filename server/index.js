require('dotenv').config();
const express = require('express');
var cors = require('cors');
// const { dbConnect } = require('./config/Database')
const { prismaConnect, prisma } = require('./config/PrismaConfig')
const { redisConnect } = require('./config/RedisConfig');
const { appConfig } = require('./config/AppConfig')
const cron = require('node-cron')
const { cleanupExpiredUsers } = require('./utils/cleanupUtils')

const { hashPassword } = require('./utils/passwordUtils')

const seedAdminUser = async () => {
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

const startServer = async () => {
  // Redis Sessions Database Connection
  const app = express();

  // CORS configuration (example using Express)
  const corsOptions = {
    origin: 'http://localhost:5173', // Your frontend URL
    credentials: true, // Allow credentials (cookies)
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
  app.use(cors(corsOptions));

  // Database Connection
  // await dbConnect();
  // Redis Connection
  await prismaConnect();
  await redisConnect();
  await seedAdminUser()
  // App Default Config
  await appConfig(app);

  // Run immediately on startup
  await cleanupExpiredUsers()

  // Run every hour
  cron.schedule('0 * * * *', async () => {
    await cleanupExpiredUsers()
  })
};
startServer();