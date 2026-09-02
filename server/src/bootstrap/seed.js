import * as seedUsers from './seedUsers.js';
export const runSeeds = async () => {
  // These create accounts with a known password. Never in production.
  if (process.env.NODE_ENV === 'production') {
    console.log('Skipping seeds in production')
    return
  }

  await seedUsers.seedAdminUser()
  await seedUsers.seedSuperAdminUser()
}