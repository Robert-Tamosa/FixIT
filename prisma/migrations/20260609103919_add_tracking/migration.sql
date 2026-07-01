/*
  Warnings:

  - You are about to drop the column `latitude` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `longitude` on the `Booking` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "latitude",
DROP COLUMN "longitude",
ADD COLUMN     "ownerLat" DOUBLE PRECISION,
ADD COLUMN     "ownerLng" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "MechanicProfile" ADD COLUMN     "locationUpdatedAt" TIMESTAMP(3);
