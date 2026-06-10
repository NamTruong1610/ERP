-- DropForeignKey
ALTER TABLE "UserMfa" DROP CONSTRAINT "UserMfa_userId_fkey";

-- AddForeignKey
ALTER TABLE "UserMfa" ADD CONSTRAINT "UserMfa_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
