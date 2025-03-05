-- AlterTable
ALTER TABLE "Workshop" ADD COLUMN     "cancellationPolicy" TEXT NOT NULL DEFAULT 'Can''t make it? Email info@makerspaceyk.com. Full refunds are only available if canceled within 48 hours of registration.';
