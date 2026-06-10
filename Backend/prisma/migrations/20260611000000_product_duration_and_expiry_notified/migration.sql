-- Vendor-selectable listing duration + pre-expiry push tracking.
ALTER TABLE "Product" ADD COLUMN "durationHours" INTEGER NOT NULL DEFAULT 24;
ALTER TABLE "Product" ADD COLUMN "expiryNotifiedAt" TIMESTAMP(3);
