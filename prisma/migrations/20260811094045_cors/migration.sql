-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'EXTRACTED', 'CONFIRMED', 'FAILED');

-- CreateTable
CREATE TABLE "VehicleDocument" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "plateNumber" TEXT,
    "mvFileNumber" TEXT,
    "engineNumber" TEXT,
    "chassisNumber" TEXT,
    "make" TEXT,
    "series" TEXT,
    "bodyType" TEXT,
    "color" TEXT,
    "yearModel" TEXT,
    "grossWeight" TEXT,
    "ownerName" TEXT,
    "confidence" DOUBLE PRECISION,
    "rawResponse" JSONB,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "failReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionFlag" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT,
    "ownerId" TEXT NOT NULL,
    "bookingId" TEXT,
    "image" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "severity" TEXT,
    "rawResponse" JSONB,
    "mechanicReviewed" BOOLEAN NOT NULL DEFAULT false,
    "mechanicConfirmed" BOOLEAN,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleDocument_vehicleId_createdAt_idx" ON "VehicleDocument"("vehicleId", "createdAt");

-- CreateIndex
CREATE INDEX "InspectionFlag_vehicleId_createdAt_idx" ON "InspectionFlag"("vehicleId", "createdAt");

-- CreateIndex
CREATE INDEX "InspectionFlag_ownerId_createdAt_idx" ON "InspectionFlag"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "InspectionFlag_mechanicReviewed_idx" ON "InspectionFlag"("mechanicReviewed");

-- AddForeignKey
ALTER TABLE "VehicleDocument" ADD CONSTRAINT "VehicleDocument_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDocument" ADD CONSTRAINT "VehicleDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionFlag" ADD CONSTRAINT "InspectionFlag_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionFlag" ADD CONSTRAINT "InspectionFlag_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionFlag" ADD CONSTRAINT "InspectionFlag_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionFlag" ADD CONSTRAINT "InspectionFlag_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
