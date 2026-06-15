/*
  Warnings:

  - A unique constraint covering the columns `[productId,size]` on the table `Product` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Product_productId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Product_productId_size_key" ON "Product"("productId", "size");
