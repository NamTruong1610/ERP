-- Treatment.cost was renamed to Treatment.amount in schema.prisma without a
-- matching migration; reconcile the DB now (rename preserves existing data).
ALTER TABLE "Treatment" RENAME COLUMN "cost" TO "amount";

-- Invoice gained fields (discount, abn, billedTo*) and invoiceNumber became
-- nullable (assigned at issue time) after the initial add_invoicing migration.
ALTER TABLE "Invoice" ADD COLUMN "discount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ALTER COLUMN "discount" DROP DEFAULT;
ALTER TABLE "Invoice" ADD COLUMN "abn" TEXT NOT NULL DEFAULT '00000000000';
ALTER TABLE "Invoice" ADD COLUMN "billedToName" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "billedToEmail" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "billedToPhone" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "billedToAddress" TEXT;
ALTER TABLE "Invoice" ALTER COLUMN "invoiceNumber" DROP NOT NULL;

-- New audit target/action types for the invoicing flow
ALTER TYPE "TargetType" ADD VALUE 'INVOICE';
ALTER TYPE "AuditAction" ADD VALUE 'INVOICE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'INVOICE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'INVOICE_ISSUED';
ALTER TYPE "AuditAction" ADD VALUE 'INVOICE_ITEM_ADDED';
ALTER TYPE "AuditAction" ADD VALUE 'INVOICE_ITEM_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'INVOICE_ITEM_REMOVED';
