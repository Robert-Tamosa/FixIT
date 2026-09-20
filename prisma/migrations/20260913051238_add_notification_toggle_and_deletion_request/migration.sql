-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true;
