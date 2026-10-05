-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "assignedMechanicName" TEXT;

-- CreateTable
CREATE TABLE "MockMechanic" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialization" TEXT NOT NULL,
    "phone" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockMechanic_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MockMechanic" ADD CONSTRAINT "MockMechanic_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "RepairShop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
