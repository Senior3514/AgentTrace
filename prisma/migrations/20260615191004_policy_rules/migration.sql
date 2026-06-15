-- AlterTable
ALTER TABLE "policies" ADD COLUMN     "rulesJson" JSONB NOT NULL DEFAULT '{}';
