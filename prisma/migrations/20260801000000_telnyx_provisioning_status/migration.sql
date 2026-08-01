-- AlterTable
ALTER TABLE "users" ADD COLUMN "telnyxProvisioningStatus" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN "telnyxProvisioningError" TEXT;
