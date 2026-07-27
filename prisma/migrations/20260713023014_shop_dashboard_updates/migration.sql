-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_mechanicId_fkey";

-- AlterTable
ALTER TABLE "Booking" ALTER COLUMN "mechanicId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_mechanicId_fkey" FOREIGN KEY ("mechanicId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
