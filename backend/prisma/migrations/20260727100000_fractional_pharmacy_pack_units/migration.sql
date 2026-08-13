ALTER TABLE "pharmacy_items"
  ALTER COLUMN "units_per_pack" TYPE DECIMAL(65,30) USING "units_per_pack"::DECIMAL(65,30),
  ALTER COLUMN "current_stock" TYPE DECIMAL(65,30) USING "current_stock"::DECIMAL(65,30);

ALTER TABLE "drug_batches"
  ALTER COLUMN "quantity_in" TYPE DECIMAL(65,30) USING "quantity_in"::DECIMAL(65,30),
  ALTER COLUMN "quantity_rem" TYPE DECIMAL(65,30) USING "quantity_rem"::DECIMAL(65,30);

ALTER TABLE "dispense_items"
  ALTER COLUMN "quantity" TYPE DECIMAL(65,30) USING "quantity"::DECIMAL(65,30);

ALTER TABLE "bill_items"
  ALTER COLUMN "quantity" TYPE DECIMAL(65,30) USING "quantity"::DECIMAL(65,30);
