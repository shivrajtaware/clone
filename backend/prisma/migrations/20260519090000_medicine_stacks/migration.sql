-- CreateTable
CREATE TABLE "medicine_stacks" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "condition" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medicine_stacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicine_stack_items" (
    "id" TEXT NOT NULL,
    "stack_id" TEXT NOT NULL,
    "drug_name" TEXT NOT NULL,
    "generic_name" TEXT,
    "strength" TEXT,
    "form" TEXT,
    "dose" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "route" TEXT NOT NULL DEFAULT 'Oral',
    "instructions" TEXT,
    "quantity" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "medicine_stack_items_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN "medicine_stack_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "medicine_stacks_hospital_id_name_key" ON "medicine_stacks"("hospital_id", "name");

-- CreateIndex
CREATE INDEX "medicine_stack_items_stack_id_sort_order_idx" ON "medicine_stack_items"("stack_id", "sort_order");

-- AddForeignKey
ALTER TABLE "medicine_stacks" ADD CONSTRAINT "medicine_stacks_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_stack_items" ADD CONSTRAINT "medicine_stack_items_stack_id_fkey" FOREIGN KEY ("stack_id") REFERENCES "medicine_stacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_medicine_stack_id_fkey" FOREIGN KEY ("medicine_stack_id") REFERENCES "medicine_stacks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
