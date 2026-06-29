require('dotenv').config();
const express = require('express');
var cors = require('cors');
// const { dbConnect } = require('./config/Database')
const { prismaConnect, prisma } = require('./config/PrismaConfig')
const { redisConnect } = require('./config/RedisConfig');
const { appConfig } = require('./config/AppConfig')
const { validateEnv } = require('./config/validateEnv')
const cron = require('node-cron')
const { cleanupExpiredUsers } = require('./utils/cleanupUtils')
const { cleanupPendingUploads } = require('./services/fileServices')
const { seedAdminUser } = require('./utils/seedUtils')

const { hashPassword } = require('./utils/passwordUtils')


const startServer = async () => {
  // Redis Sessions Database Connection
  const app = express();

  // Trust exactly one reverse proxy hop so req.ip is the real client IP
  // rather than the proxy's IP — required for rate limiting and audit
  // logging to work correctly in production
  app.set('trust proxy', 1)

  // CORS configuration (example using Express)
  const corsOptions = {
    origin: 'http://localhost:5173', // Your frontend URL
    credentials: true, // Allow credentials (cookies)
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
  app.use(cors(corsOptions));

  // Prisma Connection
  await prismaConnect();
  // Redis Connection
  await redisConnect();
  // Seed testing admin user
  await seedAdminUser()

  // App Default Config
  await appConfig(app);
    app.listen(process.env.PORT || 5500, () => {
    console.log(`App listening on port ${process.env.PORT || 5500}`)
  })

  // Run immediately on startup
  await cleanupExpiredUsers()
  await cleanupPendingUploads()

  // Run every hour
  // cron.schedule('0 * * * *', async () => {
  //   await cleanupExpiredUsers()
  // })


};
validateEnv();
startServer();