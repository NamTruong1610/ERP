-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'INVOICE_VOIDED';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3);
