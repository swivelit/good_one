ALTER TABLE "Product" ADD COLUMN "renewalCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "ProductView" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "productId" UUID NOT NULL,
  "viewerUserId" UUID,
  "viewerKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductView_productId_viewerKey_key" ON "ProductView"("productId", "viewerKey");
CREATE INDEX "ProductView_productId_idx" ON "ProductView"("productId");
CREATE INDEX "ProductView_viewerUserId_idx" ON "ProductView"("viewerUserId");

ALTER TABLE "ProductView" ADD CONSTRAINT "ProductView_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductView" ADD CONSTRAINT "ProductView_viewerUserId_fkey"
  FOREIGN KEY ("viewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
