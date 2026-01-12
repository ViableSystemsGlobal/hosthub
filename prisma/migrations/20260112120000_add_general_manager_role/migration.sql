-- AlterEnum: Add GENERAL_MANAGER to UserRole enum
DO $$ BEGIN
    ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'GENERAL_MANAGER';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
