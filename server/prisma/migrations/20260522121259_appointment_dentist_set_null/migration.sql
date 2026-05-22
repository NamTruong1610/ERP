-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_dentistId_fkey";

-- AlterTable
ALTER TABLE "Appointment" ALTER COLUMN "dentistId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_dentistId_fkey" FOREIGN KEY ("dentistId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
