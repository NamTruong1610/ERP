/*
  Warnings:

  - Added the required column `updatedAt` to the `UserActivation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UserActivation" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
