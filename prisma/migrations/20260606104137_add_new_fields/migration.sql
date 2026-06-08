-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "address" TEXT,
ADD COLUMN     "isEmergency" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "MechanicProfile" ADD COLUMN     "isAvailable" BOOLEAN NOT NULL DEFAULT true;
