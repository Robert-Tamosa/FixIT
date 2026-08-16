-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentMethod" ADD VALUE 'GCASH_DIRECT';
ALTER TYPE "PaymentMethod" ADD VALUE 'MAYA_DIRECT';

-- AlterTable
ALTER TABLE "MechanicProfile" ADD COLUMN     "gcashAccountName" TEXT,
ADD COLUMN     "gcashIsBusiness" BOOLEAN,
ADD COLUMN     "gcashQrImage" TEXT,
ADD COLUMN     "mayaAccountName" TEXT,
ADD COLUMN     "mayaIsBusiness" BOOLEAN,
ADD COLUMN     "mayaQrImage" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "directAccountName" TEXT,
ADD COLUMN     "directIsBusiness" BOOLEAN,
ADD COLUMN     "directQrImage" TEXT,
ADD COLUMN     "ownerMarkedSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RepairShop" ADD COLUMN     "gcashAccountName" TEXT,
ADD COLUMN     "gcashIsBusiness" BOOLEAN,
ADD COLUMN     "gcashQrImage" TEXT,
ADD COLUMN     "mayaAccountName" TEXT,
ADD COLUMN     "mayaIsBusiness" BOOLEAN,
ADD COLUMN     "mayaQrImage" TEXT;
