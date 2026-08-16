-- AlterTable
ALTER TABLE "InspectionFlag" ADD COLUMN     "sourceFlagReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sourceSuspicious" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "VehicleDocument" ADD COLUMN     "sourceFlagReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sourceSuspicious" BOOLEAN NOT NULL DEFAULT false;
