-- CreateEnum
CREATE TYPE "LicenseType" AS ENUM ('BASIC', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'LAB_TECHNICIAN', 'PHARMACIST', 'PATIENT_PORTAL', 'HR_MANAGER', 'ACCOUNTANT');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "BloodGroup" AS ENUM ('A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'O_POS', 'O_NEG', 'AB_POS', 'AB_NEG');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED');

-- CreateEnum
CREATE TYPE "AllergyType" AS ENUM ('DRUG', 'FOOD', 'ENVIRONMENTAL', 'OTHER');

-- CreateEnum
CREATE TYPE "AllergySeverity" AS ENUM ('MILD', 'MODERATE', 'SEVERE', 'ANAPHYLAXIS');

-- CreateEnum
CREATE TYPE "AppointmentType" AS ENUM ('REGULAR', 'FOLLOW_UP', 'EMERGENCY', 'TELECONSULT', 'HOME_VISIT');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('BOOKED', 'CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION', 'COMPLETED', 'NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('NORMAL', 'URGENT', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "BedType" AS ENUM ('GENERAL', 'SEMI_PRIVATE', 'PRIVATE', 'DELUXE', 'ICU', 'HDU', 'NICU', 'PICU', 'LABOUR');

-- CreateEnum
CREATE TYPE "BedStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'CLEANING', 'RESERVED', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "AdmissionType" AS ENUM ('ELECTIVE', 'EMERGENCY', 'TRANSFER');

-- CreateEnum
CREATE TYPE "AdmissionStatus" AS ENUM ('ADMITTED', 'DISCHARGED', 'AMA', 'TRANSFERRED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OTStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'CLEANING', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "SurgeryType" AS ENUM ('ELECTIVE', 'EMERGENCY', 'SEMI_ELECTIVE');

-- CreateEnum
CREATE TYPE "OTRecordStatus" AS ENUM ('SCHEDULED', 'PREP', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TriageLevel" AS ENUM ('RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE');

-- CreateEnum
CREATE TYPE "EmergencyStatus" AS ENUM ('ACTIVE', 'ADMITTED', 'TRANSFERRED', 'DISCHARGED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LabStatus" AS ENUM ('ORDERED', 'COLLECTED', 'IN_TRANSIT', 'RECEIVED', 'PROCESSING', 'RESULTED', 'VERIFIED', 'REPORTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RadioModality" AS ENUM ('XRAY', 'USG', 'CT', 'MRI', 'ECHO', 'ECG', 'MAMMOGRAPHY', 'FLUOROSCOPY', 'PET_CT');

-- CreateEnum
CREATE TYPE "RadiologyStatus" AS ENUM ('ORDERED', 'SCHEDULED', 'IN_PROGRESS', 'PERFORMED', 'REPORTED', 'REVIEWED');

-- CreateEnum
CREATE TYPE "DrugCategory" AS ENUM ('ANALGESIC', 'ANTIBIOTIC', 'ANTIHYPERTENSIVE', 'ANTIDIABETIC', 'DIURETIC', 'CARDIAC', 'NEUROLOGICAL', 'RESPIRATORY', 'ANTICOAGULANT', 'STEROID', 'ANTIEMETIC', 'ANTACID', 'VITAMIN', 'VACCINE', 'SURGICAL', 'CONSUMABLE', 'OTHER');

-- CreateEnum
CREATE TYPE "POStatus" AS ENUM ('DRAFT', 'APPROVED', 'ORDERED', 'PARTIAL_RECEIVED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillType" AS ENUM ('OPD', 'IPD_INTERIM', 'IPD_FINAL', 'PHARMACY', 'LAB', 'RADIOLOGY', 'AMBULANCE', 'PACKAGE');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('DRAFT', 'GENERATED', 'PARTIAL_PAID', 'PAID', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'CARD', 'UPI', 'NET_BANKING', 'INSURANCE_CASHLESS', 'CORPORATE_CREDIT', 'CHEQUE', 'ONLINE');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('SUBMITTED', 'UNDER_PROCESS', 'PARTIALLY_APPROVED', 'APPROVED', 'REJECTED', 'APPEALED');

-- CreateEnum
CREATE TYPE "InvTxType" AS ENUM ('RECEIPT', 'ISSUE', 'RETURN', 'ADJUSTMENT', 'TRANSFER');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'UNDER_MAINTENANCE', 'DISPOSED', 'LOST');

-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('MORNING', 'EVENING', 'NIGHT', 'ON_CALL');

-- CreateEnum
CREATE TYPE "RosterStatus" AS ENUM ('SCHEDULED', 'PRESENT', 'ABSENT', 'LEAVE', 'SWAPPED');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('CASUAL', 'SICK', 'EARNED', 'MATERNITY', 'PATERNITY', 'COMP_OFF');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AmbulanceType" AS ENUM ('BLS', 'ALS', 'NEONATAL', 'MORTUARY');

-- CreateEnum
CREATE TYPE "AmbulanceStatus" AS ENUM ('AVAILABLE', 'ON_CALL', 'RETURNING', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('DISPATCHED', 'EN_ROUTE', 'PICKED_UP', 'ARRIVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('PATIENT_FALL', 'MEDICATION_ERROR', 'EQUIPMENT_FAILURE', 'NEAR_MISS', 'SENTINEL', 'ADVERSE_EVENT', 'COMPLAINT', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('MINOR', 'MODERATE', 'MAJOR', 'CATASTROPHIC');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'CAPA_PENDING', 'CLOSED');

-- CreateEnum
CREATE TYPE "MsgType" AS ENUM ('TEXT', 'IMAGE', 'FILE', 'ALERT');

-- CreateTable
CREATE TABLE "hospitals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'India',
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "logo" TEXT,
    "nabh_number" TEXT,
    "gstin" TEXT,
    "bed_capacity" INTEGER NOT NULL DEFAULT 100,
    "license_type" "LicenseType" NOT NULL DEFAULT 'BASIC',
    "license_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "license_end" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "modules_enabled" TEXT[] DEFAULT ARRAY['PATIENTS', 'APPOINTMENTS', 'EMR', 'BILLING', 'PHARMACY', 'LAB']::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospital_invoices" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "period_from" TIMESTAMP(3) NOT NULL,
    "period_to" TIMESTAMP(3) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hospital_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT,
    "employee_id" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "department_id" TEXT,
    "designation" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "avatar" TEXT,
    "last_login" TIMESTAMP(3),
    "refresh_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "specialization" TEXT,
    "sub_specialization" TEXT,
    "qualification" TEXT,
    "registration_no" TEXT,
    "experience_years" INTEGER,
    "consultation_fee" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "follow_up_fee" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "teleconsult_fee" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "signature" TEXT,
    "bio" TEXT,
    "available_days" TEXT[] DEFAULT ARRAY['MON', 'TUE', 'WED', 'THU', 'FRI']::TEXT[],
    "slot_duration_mins" INTEGER NOT NULL DEFAULT 15,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "head_id" TEXT,
    "floor" TEXT,
    "phone_ext" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "uhid" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "dob" TIMESTAMP(3),
    "gender" "Gender" NOT NULL,
    "blood_group" "BloodGroup",
    "phone" TEXT,
    "alternate_phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "nationality" TEXT NOT NULL DEFAULT 'Indian',
    "religion" TEXT,
    "occupation" TEXT,
    "marital_status" "MaritalStatus",
    "aadhar_no" TEXT,
    "photo" TEXT,
    "language" TEXT NOT NULL DEFAULT 'English',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_contacts" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_allergies" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "allergen" TEXT NOT NULL,
    "type" "AllergyType" NOT NULL,
    "severity" "AllergySeverity" NOT NULL,
    "reaction" TEXT,
    "noted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_allergies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_details" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "provider_name" TEXT NOT NULL,
    "policy_no" TEXT NOT NULL,
    "tpa_name" TEXT,
    "member_id" TEXT,
    "group_no" TEXT,
    "valid_from" TIMESTAMP(3),
    "valid_to" TIMESTAMP(3),
    "sum_insured" DECIMAL(65,30),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "insurance_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_links" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "relation" TEXT NOT NULL,

    CONSTRAINT "family_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "department_id" TEXT,
    "token_no" TEXT,
    "appointment_date" TIMESTAMP(3) NOT NULL,
    "slot_time" TEXT NOT NULL,
    "type" "AppointmentType" NOT NULL DEFAULT 'REGULAR',
    "status" "AppointmentStatus" NOT NULL DEFAULT 'BOOKED',
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "chief_complaint" TEXT,
    "notes" TEXT,
    "fee" DECIMAL(65,30),
    "is_follow_up" BOOLEAN NOT NULL DEFAULT false,
    "parent_appt_id" TEXT,
    "booked_by" TEXT,
    "checked_in_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beds" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "ward" TEXT NOT NULL,
    "room_no" TEXT,
    "bed_no" TEXT NOT NULL,
    "floor" TEXT,
    "bed_type" "BedType" NOT NULL DEFAULT 'GENERAL',
    "status" "BedStatus" NOT NULL DEFAULT 'AVAILABLE',
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rate_per_day" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "department_id" TEXT,

    CONSTRAINT "beds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admissions" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "bed_id" TEXT NOT NULL,
    "admitting_doctor_id" TEXT NOT NULL,
    "admission_type" "AdmissionType" NOT NULL DEFAULT 'ELECTIVE',
    "admission_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discharge_date" TIMESTAMP(3),
    "provisional_diagnosis" TEXT,
    "final_diagnosis" TEXT,
    "status" "AdmissionStatus" NOT NULL DEFAULT 'ADMITTED',
    "is_mlc" BOOLEAN NOT NULL DEFAULT false,
    "mlc_no" TEXT,
    "insurance_id" TEXT,
    "estimated_los" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discharge_summaries" (
    "id" TEXT NOT NULL,
    "admission_id" TEXT NOT NULL,
    "final_diagnosis" TEXT,
    "procedures_done" TEXT,
    "condition_at_discharge" TEXT,
    "follow_up_date" TIMESTAMP(3),
    "follow_up_instructions" TEXT,
    "diet_advice" TEXT,
    "activity_advice" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discharge_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emr_notes" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "visit_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subjective" TEXT,
    "objective" TEXT,
    "assessment" TEXT,
    "plan" TEXT,
    "icd10_codes" TEXT[],
    "is_admission_note" BOOLEAN NOT NULL DEFAULT false,
    "admission_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emr_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vitals" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "recorded_by" TEXT NOT NULL,
    "temperature" DECIMAL(65,30),
    "pulse" INTEGER,
    "bp_systolic" INTEGER,
    "bp_diastolic" INTEGER,
    "spo2" INTEGER,
    "respiratory_rate" INTEGER,
    "weight" DECIMAL(65,30),
    "height" DECIMAL(65,30),
    "bmi" DECIMAL(65,30),
    "blood_glucose" DECIMAL(65,30),
    "pain_score" INTEGER,
    "gcs" INTEGER,
    "notes" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "prescribed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_till" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_items" (
    "id" TEXT NOT NULL,
    "prescription_id" TEXT NOT NULL,
    "drug_name" TEXT NOT NULL,
    "generic_name" TEXT,
    "strength" TEXT,
    "form" TEXT,
    "dose" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "instructions" TEXT,
    "quantity" INTEGER,

    CONSTRAINT "prescription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_forms" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT,
    "signed_at" TIMESTAMP(3),
    "signed_by" TEXT,
    "signature" TEXT,
    "witness" TEXT,
    "is_signed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "icu_records" (
    "id" TEXT NOT NULL,
    "admission_id" TEXT NOT NULL,
    "apache2" INTEGER,
    "sofa" INTEGER,
    "gcs" INTEGER,
    "rass" INTEGER,
    "vent_mode" TEXT,
    "fio2" DECIMAL(65,30),
    "peep" DECIMAL(65,30),
    "tidal_vol" DECIMAL(65,30),
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by" TEXT,
    "notes" TEXT,

    CONSTRAINT "icu_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "icu_flowsheets" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "time_slot" TIMESTAMP(3) NOT NULL,
    "bp_sys" INTEGER,
    "bp_dia" INTEGER,
    "hr" INTEGER,
    "spo2" INTEGER,
    "temp" DECIMAL(65,30),
    "rr" INTEGER,
    "urine_out" INTEGER,
    "iv_in" INTEGER,
    "oral_in" INTEGER,
    "drain_out" INTEGER,
    "nurse_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "icu_flowsheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ot_rooms" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "OTStatus" NOT NULL DEFAULT 'AVAILABLE',
    "features" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ot_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ot_records" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "ot_room_id" TEXT NOT NULL,
    "admission_id" TEXT NOT NULL,
    "procedure" TEXT NOT NULL,
    "surgery_type" "SurgeryType" NOT NULL DEFAULT 'ELECTIVE',
    "scheduled_start" TIMESTAMP(3) NOT NULL,
    "scheduled_end" TIMESTAMP(3) NOT NULL,
    "actual_start" TIMESTAMP(3),
    "actual_end" TIMESTAMP(3),
    "surgeon_id" TEXT,
    "anesthetist_id" TEXT,
    "status" "OTRecordStatus" NOT NULL DEFAULT 'SCHEDULED',
    "anesthesia_type" TEXT,
    "operative_notes" TEXT,
    "complications" TEXT,
    "implants_used" TEXT,
    "specimens_sent" BOOLEAN NOT NULL DEFAULT false,
    "blood_loss_ml" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ot_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ot_checklists" (
    "id" TEXT NOT NULL,
    "ot_record_id" TEXT NOT NULL,
    "consent_done" BOOLEAN NOT NULL DEFAULT false,
    "pre_anaesthesia" BOOLEAN NOT NULL DEFAULT false,
    "blood_group_done" BOOLEAN NOT NULL DEFAULT false,
    "fasting_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "iv_access_done" BOOLEAN NOT NULL DEFAULT false,
    "pre_meds_given" BOOLEAN NOT NULL DEFAULT false,
    "site_marked" BOOLEAN NOT NULL DEFAULT false,
    "implant_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "who_timeout" BOOLEAN NOT NULL DEFAULT false,
    "swab_count_pre" BOOLEAN NOT NULL DEFAULT false,
    "swab_count_post" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ot_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ot_team_members" (
    "id" TEXT NOT NULL,
    "ot_record_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_in_ot" TEXT NOT NULL,

    CONSTRAINT "ot_team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_cases" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "case_no" TEXT NOT NULL,
    "patient_id" TEXT,
    "unknown_patient" BOOLEAN NOT NULL DEFAULT false,
    "patient_name" TEXT,
    "age_approx" TEXT,
    "gender" "Gender",
    "chief_complaint" TEXT NOT NULL,
    "triage_level" "TriageLevel" NOT NULL,
    "arrival_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triage_time" TIMESTAMP(3),
    "doctor_time" TIMESTAMP(3),
    "doctor_id" TEXT,
    "is_mlc" BOOLEAN NOT NULL DEFAULT false,
    "mlc_no" TEXT,
    "disposition" TEXT,
    "status" "EmergencyStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emergency_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_orders" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "order_no" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "ordered_by" TEXT NOT NULL,
    "is_stat" BOOLEAN NOT NULL DEFAULT false,
    "status" "LabStatus" NOT NULL DEFAULT 'ORDERED',
    "sample_type" TEXT,
    "collected_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "reported_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "test_name" TEXT NOT NULL,
    "test_code" TEXT,
    "category" TEXT,
    "result" TEXT,
    "unit" TEXT,
    "ref_range" TEXT,
    "is_abnormal" BOOLEAN,
    "is_critical" BOOLEAN NOT NULL DEFAULT false,
    "method" TEXT,
    "notes" TEXT,

    CONSTRAINT "lab_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radiology_orders" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "study_no" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "ordered_by" TEXT,
    "modality" "RadioModality" NOT NULL,
    "body_part" TEXT NOT NULL,
    "clinical_info" TEXT,
    "contrast_required" BOOLEAN NOT NULL DEFAULT false,
    "is_stat" BOOLEAN NOT NULL DEFAULT false,
    "status" "RadiologyStatus" NOT NULL DEFAULT 'ORDERED',
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "scheduled_at" TIMESTAMP(3),
    "performed_at" TIMESTAMP(3),
    "report" TEXT,
    "impression" TEXT,
    "reported_by" TEXT,
    "images_path" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "radiology_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_items" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "generic_name" TEXT NOT NULL,
    "brand_name" TEXT,
    "category" "DrugCategory" NOT NULL,
    "form" TEXT NOT NULL,
    "strength" TEXT,
    "unit" TEXT NOT NULL,
    "current_stock" INTEGER NOT NULL DEFAULT 0,
    "min_stock_level" INTEGER NOT NULL DEFAULT 10,
    "max_stock_level" INTEGER NOT NULL DEFAULT 1000,
    "reorder_quantity" INTEGER NOT NULL DEFAULT 100,
    "is_controlled" BOOLEAN NOT NULL DEFAULT false,
    "is_cold_chain" BOOLEAN NOT NULL DEFAULT false,
    "rack_location" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pharmacy_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drug_batches" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "batch_no" TEXT NOT NULL,
    "mfg_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3) NOT NULL,
    "quantity_in" INTEGER NOT NULL,
    "quantity_rem" INTEGER NOT NULL,
    "mrp" DECIMAL(65,30) NOT NULL,
    "cost_price" DECIMAL(65,30),
    "supplier" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drug_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispenses" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "dispense_no" TEXT NOT NULL,
    "patient_id" TEXT,
    "prescription_id" TEXT,
    "dispensed_by" TEXT NOT NULL,
    "dispensed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "dispenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispense_items" (
    "id" TEXT NOT NULL,
    "dispense_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "batch_no" TEXT,
    "unit_price" DECIMAL(65,30),

    CONSTRAINT "dispense_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "po_no" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "status" "POStatus" NOT NULL DEFAULT 'DRAFT',
    "total_amount" DECIMAL(65,30),
    "ordered_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "po_items" (
    "id" TEXT NOT NULL,
    "po_id" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(65,30),

    CONSTRAINT "po_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "gstin" TEXT,
    "drug_license" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bills" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "bill_no" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "admission_id" TEXT,
    "type" "BillType" NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discount_pct" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discount_amt" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tax_amt" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total_amt" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paid_amt" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "due_amt" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "payment_mode" TEXT,
    "insurance_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_items" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(65,30) NOT NULL,
    "total" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "bill_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "reference_no" TEXT,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_by" TEXT,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_claims" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "insurance_id" TEXT NOT NULL,
    "claim_no" TEXT,
    "pre_auth_no" TEXT,
    "claimed_amt" DECIMAL(65,30) NOT NULL,
    "approved_amt" DECIMAL(65,30),
    "status" "ClaimStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "insurance_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "category" TEXT NOT NULL,
    "sub_category" TEXT,
    "unit" TEXT NOT NULL,
    "current_stock" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "min_level" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "location" TEXT,
    "is_consumable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "type" "InvTxType" NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "from_dept" TEXT,
    "to_dept" TEXT,
    "reference" TEXT,
    "done_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "asset_tag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "serial_no" TEXT,
    "location" TEXT,
    "department_id" TEXT,
    "purchase_date" TIMESTAMP(3),
    "purchase_cost" DECIMAL(65,30),
    "warranty_end" TIMESTAMP(3),
    "amc_end" TIMESTAMP(3),
    "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_service" TIMESTAMP(3),
    "next_service" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_maintenance" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "done_by" TEXT,
    "cost" DECIMAL(65,30),
    "done_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "next_due" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "asset_maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_rosters" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "shift" "ShiftType" NOT NULL,
    "ward" TEXT,
    "status" "RosterStatus" NOT NULL DEFAULT 'SCHEDULED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_rosters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL,
    "from_date" TIMESTAMP(3) NOT NULL,
    "to_date" TIMESTAMP(3) NOT NULL,
    "days" INTEGER NOT NULL,
    "reason" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ambulances" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "vehicle_no" TEXT NOT NULL,
    "type" "AmbulanceType" NOT NULL,
    "driver_id" TEXT,
    "status" "AmbulanceStatus" NOT NULL DEFAULT 'AVAILABLE',
    "last_location" TEXT,
    "fuel_level" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ambulances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ambulance_trips" (
    "id" TEXT NOT NULL,
    "ambulance_id" TEXT NOT NULL,
    "patient_name" TEXT,
    "patient_id" TEXT,
    "pickup_address" TEXT NOT NULL,
    "call_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatch_time" TIMESTAMP(3),
    "pickup_time" TIMESTAMP(3),
    "arrive_time" TIMESTAMP(3),
    "status" "TripStatus" NOT NULL DEFAULT 'DISPATCHED',
    "paramedic_notes" TEXT,
    "km_covered" DECIMAL(65,30),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ambulance_trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diet_orders" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "admission_id" TEXT,
    "diet_type" TEXT NOT NULL,
    "restrictions" TEXT[],
    "allergies" TEXT[],
    "calories" INTEGER,
    "notes" TEXT,
    "is_tube_feed" BOOLEAN NOT NULL DEFAULT false,
    "ordered_by" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_date" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diet_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mortuary_records" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "body_tag" TEXT NOT NULL,
    "patient_id" TEXT,
    "patient_name" TEXT NOT NULL,
    "age" TEXT,
    "gender" "Gender",
    "dod" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cause_of_death" TEXT,
    "is_pm_required" BOOLEAN NOT NULL DEFAULT false,
    "storage_slot" TEXT,
    "nok_name" TEXT,
    "nok_phone" TEXT,
    "nok_relation" TEXT,
    "is_released" BOOLEAN NOT NULL DEFAULT false,
    "released_to" TEXT,
    "released_at" TIMESTAMP(3),
    "is_unclaimed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mortuary_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "incident_no" TEXT NOT NULL,
    "type" "IncidentType" NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "patient_id" TEXT,
    "reported_by" TEXT NOT NULL,
    "reported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "rca" TEXT,
    "capa" TEXT,
    "capa_due" TIMESTAMP(3),
    "capa_owner" TEXT,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "record_id" TEXT,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "from_user_id" TEXT NOT NULL,
    "to_user_id" TEXT,
    "group_id" TEXT,
    "content" TEXT NOT NULL,
    "type" "MsgType" NOT NULL DEFAULT 'TEXT',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "target_roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expires_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hospitals_code_key" ON "hospitals"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_profiles_user_id_key" ON "doctor_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_hospital_id_code_key" ON "departments"("hospital_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "patients_uhid_key" ON "patients"("uhid");

-- CreateIndex
CREATE UNIQUE INDEX "beds_hospital_id_ward_bed_no_key" ON "beds"("hospital_id", "ward", "bed_no");

-- CreateIndex
CREATE UNIQUE INDEX "discharge_summaries_admission_id_key" ON "discharge_summaries"("admission_id");

-- CreateIndex
CREATE UNIQUE INDEX "ot_checklists_ot_record_id_key" ON "ot_checklists"("ot_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "emergency_cases_case_no_key" ON "emergency_cases"("case_no");

-- CreateIndex
CREATE UNIQUE INDEX "lab_orders_order_no_key" ON "lab_orders"("order_no");

-- CreateIndex
CREATE UNIQUE INDEX "radiology_orders_study_no_key" ON "radiology_orders"("study_no");

-- CreateIndex
CREATE UNIQUE INDEX "dispenses_dispense_no_key" ON "dispenses"("dispense_no");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_po_no_key" ON "purchase_orders"("po_no");

-- CreateIndex
CREATE UNIQUE INDEX "bills_bill_no_key" ON "bills"("bill_no");

-- CreateIndex
CREATE UNIQUE INDEX "assets_asset_tag_key" ON "assets"("asset_tag");

-- CreateIndex
CREATE UNIQUE INDEX "mortuary_records_body_tag_key" ON "mortuary_records"("body_tag");

-- CreateIndex
CREATE UNIQUE INDEX "incidents_incident_no_key" ON "incidents"("incident_no");

-- AddForeignKey
ALTER TABLE "hospital_invoices" ADD CONSTRAINT "hospital_invoices_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_profiles" ADD CONSTRAINT "doctor_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_allergies" ADD CONSTRAINT "patient_allergies_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_details" ADD CONSTRAINT "insurance_details_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_links" ADD CONSTRAINT "family_links_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_links" ADD CONSTRAINT "family_links_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beds" ADD CONSTRAINT "beds_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beds" ADD CONSTRAINT "beds_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_bed_id_fkey" FOREIGN KEY ("bed_id") REFERENCES "beds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discharge_summaries" ADD CONSTRAINT "discharge_summaries_admission_id_fkey" FOREIGN KEY ("admission_id") REFERENCES "admissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emr_notes" ADD CONSTRAINT "emr_notes_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emr_notes" ADD CONSTRAINT "emr_notes_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vitals" ADD CONSTRAINT "vitals_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vitals" ADD CONSTRAINT "vitals_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_forms" ADD CONSTRAINT "consent_forms_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "icu_records" ADD CONSTRAINT "icu_records_admission_id_fkey" FOREIGN KEY ("admission_id") REFERENCES "admissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "icu_flowsheets" ADD CONSTRAINT "icu_flowsheets_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ot_records" ADD CONSTRAINT "ot_records_ot_room_id_fkey" FOREIGN KEY ("ot_room_id") REFERENCES "ot_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ot_records" ADD CONSTRAINT "ot_records_admission_id_fkey" FOREIGN KEY ("admission_id") REFERENCES "admissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ot_checklists" ADD CONSTRAINT "ot_checklists_ot_record_id_fkey" FOREIGN KEY ("ot_record_id") REFERENCES "ot_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ot_team_members" ADD CONSTRAINT "ot_team_members_ot_record_id_fkey" FOREIGN KEY ("ot_record_id") REFERENCES "ot_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_ordered_by_fkey" FOREIGN KEY ("ordered_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_order_items" ADD CONSTRAINT "lab_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "lab_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiology_orders" ADD CONSTRAINT "radiology_orders_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_items" ADD CONSTRAINT "pharmacy_items_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drug_batches" ADD CONSTRAINT "drug_batches_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "pharmacy_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispenses" ADD CONSTRAINT "dispenses_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispense_items" ADD CONSTRAINT "dispense_items_dispense_id_fkey" FOREIGN KEY ("dispense_id") REFERENCES "dispenses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispense_items" ADD CONSTRAINT "dispense_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "pharmacy_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_items" ADD CONSTRAINT "po_items_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_maintenance" ADD CONSTRAINT "asset_maintenance_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambulances" ADD CONSTRAINT "ambulances_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambulance_trips" ADD CONSTRAINT "ambulance_trips_ambulance_id_fkey" FOREIGN KEY ("ambulance_id") REFERENCES "ambulances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet_orders" ADD CONSTRAINT "diet_orders_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet_orders" ADD CONSTRAINT "diet_orders_admission_id_fkey" FOREIGN KEY ("admission_id") REFERENCES "admissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
