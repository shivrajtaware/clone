ALTER TABLE "prescription_items" ADD COLUMN "pharmacy_item_id" TEXT;

CREATE INDEX "prescription_items_pharmacy_item_id_idx" ON "prescription_items"("pharmacy_item_id");
