-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SHOP_OWNER';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "aiMatchScore" DOUBLE PRECISION,
ADD COLUMN     "bookingType" "BookingType" NOT NULL DEFAULT 'SCHEDULED',
ADD COLUMN     "declinedByIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "shopId" TEXT;
