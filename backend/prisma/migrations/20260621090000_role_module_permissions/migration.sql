CREATE TABLE "role_module_permissions" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "modules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_module_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "role_module_permissions_hospital_id_role_key" ON "role_module_permissions"("hospital_id", "role");

ALTER TABLE "role_module_permissions" ADD CONSTRAINT "role_module_permissions_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
