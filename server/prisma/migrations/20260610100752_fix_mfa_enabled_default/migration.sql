/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `UserActivation` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `UserMfa` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "UserActivation" DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "UserMfa" DROP COLUMN "deletedAt",
ALTER COLUMN "enabled" SET DEFAULT false;
