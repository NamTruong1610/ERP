-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'LOGIN_MFA_PENDING';

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "actorType" SET DEFAULT 'USER';
