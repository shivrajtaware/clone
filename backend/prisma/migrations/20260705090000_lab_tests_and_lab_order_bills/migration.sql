-- Lab test catalogue with hospital-specific pricing.
CREATE TABLE "lab_tests" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "category" TEXT,
    "sample_type" TEXT,
    "unit" TEXT,
    "ref_range" TEXT,
    "price" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_tests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lab_tests_hospital_id_name_key" ON "lab_tests"("hospital_id", "name");

ALTER TABLE "lab_tests"
ADD CONSTRAINT "lab_tests_hospital_id_fkey"
FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Each OPD lab order can be tied to one LAB bill generated from Laboratory.
ALTER TABLE "lab_orders" ADD COLUMN "bill_id" TEXT;

CREATE UNIQUE INDEX "lab_orders_bill_id_key" ON "lab_orders"("bill_id");

ALTER TABLE "lab_orders"
ADD CONSTRAINT "lab_orders_bill_id_fkey"
FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;
