-- AlterTable
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "guestEmail" TEXT,
ADD COLUMN IF NOT EXISTS "guestPhoneNumber" TEXT,
ADD COLUMN IF NOT EXISTS "guestContactId" TEXT;

-- CreateEnum
DO $$ BEGIN
 CREATE TYPE "GuestContactType" AS ENUM ('LEAD', 'INQUIRY', 'GUEST');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
 CREATE TYPE "GuestContactStatus" AS ENUM ('NEW', 'CONTACTED', 'FOLLOW_UP', 'CONVERTED', 'LOST');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "GuestContact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phoneNumber" TEXT,
    "type" "GuestContactType" NOT NULL DEFAULT 'LEAD',
    "status" "GuestContactStatus" NOT NULL DEFAULT 'NEW',
    "source" TEXT,
    "propertyId" TEXT,
    "notes" TEXT,
    "lastContactedAt" TIMESTAMP(3),
    "followUpDate" TIMESTAMP(3),
    "convertedToBookingId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GuestContact_email_idx" ON "GuestContact"("email");
CREATE INDEX IF NOT EXISTS "GuestContact_phoneNumber_idx" ON "GuestContact"("phoneNumber");
CREATE INDEX IF NOT EXISTS "GuestContact_type_idx" ON "GuestContact"("type");
CREATE INDEX IF NOT EXISTS "GuestContact_status_idx" ON "GuestContact"("status");
CREATE INDEX IF NOT EXISTS "GuestContact_propertyId_idx" ON "GuestContact"("propertyId");
CREATE INDEX IF NOT EXISTS "GuestContact_followUpDate_idx" ON "GuestContact"("followUpDate");
CREATE INDEX IF NOT EXISTS "GuestContact_createdById_idx" ON "GuestContact"("createdById");
CREATE INDEX IF NOT EXISTS "Booking_guestContactId_idx" ON "Booking"("guestContactId");
CREATE INDEX IF NOT EXISTS "Booking_guestEmail_idx" ON "Booking"("guestEmail");

-- AddForeignKey
DO $$ BEGIN
 ALTER TABLE "Booking" ADD CONSTRAINT "Booking_guestContactId_fkey" FOREIGN KEY ("guestContactId") REFERENCES "GuestContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "GuestContact" ADD CONSTRAINT "GuestContact_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "GuestContact" ADD CONSTRAINT "GuestContact_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- AlterEnum: Add GENERAL_MANAGER to UserRole enum
DO $$ BEGIN
    ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'GENERAL_MANAGER';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
