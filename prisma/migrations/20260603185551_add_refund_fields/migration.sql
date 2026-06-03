-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paypalCaptureId" TEXT,
ADD COLUMN     "refundId" TEXT,
ADD COLUMN     "refundReason" TEXT,
ADD COLUMN     "refunded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripeSessionId" TEXT;
