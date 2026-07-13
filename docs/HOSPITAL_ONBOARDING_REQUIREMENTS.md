# Hospital Software Setup Information Checklist

Use this document to collect complete hospital information before configuring MediCore HMS. Fill every section before go-live.

## 1. Hospital Identity

- Legal hospital name
- Display/brand name
- Hospital registration number
- GSTIN / tax ID
- Drug license number, if pharmacy is used
- Clinical establishment license number
- NABH/JCI/other accreditation details
- Address, city, state, country, PIN
- Main phone, emergency phone, email, website
- Logo file
- Letterhead format
- Authorized signatory names and designations
- Financial year start/end
- Default timezone and date/time format
- Currency

## 2. Branches, Departments, and Locations

- Branch list, if multi-branch
- Department list:
  - OPD
  - IPD
  - Emergency
  - ICU
  - OT
  - Laboratory
  - Radiology
  - Pharmacy
  - Billing
  - Inventory
  - Ambulance
  - Dietary
  - Mortuary
  - Administration
- Floor/wing/block names
- Room numbers
- Nurse station names
- Counters/reception desks
- Store locations
- Pharmacy counters
- Lab collection counters
- Radiology rooms
- OT rooms
- ICU units

## 3. User Roles and Staff

Collect for every staff member:

- Full name
- Role/designation
- Department
- Email
- Phone
- Employee ID
- Qualification
- Medical registration number, for doctors
- Specialization
- Joining date
- Active/inactive status
- Login access required: yes/no
- Permission level:
  - Super admin
  - Hospital admin
  - Doctor
  - Nurse
  - Reception
  - Billing
  - Lab
  - Radiology
  - Pharmacy
  - Inventory
  - OT
  - ICU
  - Ambulance
  - Patient portal
- Signature image, if reports/prescriptions need signing

## 4. Patient Registration Rules

- UHID format required
- Manual or automatic UHID
- Required patient fields
- Optional patient fields
- ID proof types accepted
- Age/DOB policy
- Guardian details policy
- Emergency contact policy
- Consent forms required
- Patient photo required: yes/no
- Barcode/QR required: yes/no
- Duplicate patient matching rules:
  - phone
  - name + DOB
  - Aadhaar/passport/ID

## 5. OPD and Appointment Setup

- OPD departments
- Doctor-wise consultation timings
- Slot duration
- Walk-in allowed: yes/no
- Online appointment allowed: yes/no
- Appointment statuses used
- Token system required: yes/no
- Consultation fee by doctor/department
- Follow-up fee and validity period
- Free follow-up rules
- Cancellation/no-show rules
- OPD prescription format
- OPD clinical note format
- Common complaint templates
- Diagnosis coding requirement, if any

## 6. IPD, Beds, Wards, and Rooms

- Ward list
- Room categories:
  - General
  - Semi-private
  - Private
  - Deluxe
  - ICU
  - NICU
  - PICU
  - Isolation
- Bed numbers
- Bed category-wise charges
- Nursing charges
- Doctor visit charges
- ICU monitoring charges
- Oxygen charges
- Admission deposit rules
- Discharge workflow
- Discharge summary format
- Transfer rules between wards
- Bed reservation policy
- Billing per day or per night
- Minimum charge rule, if admitted for partial day

## 7. Emergency Department

- Triage levels used
- Emergency registration charge
- MLC workflow
- Emergency doctor assignment
- Emergency package charges
- Ambulance linkage
- Emergency consent forms
- Critical alert escalation contacts
- Emergency case numbering format

## 8. Laboratory Setup

- Lab test list
- Test code
- Test name
- Category:
  - Hematology
  - Biochemistry
  - Microbiology
  - Serology
  - Pathology
  - Urine
  - Stool
  - Other
- Sample type
- Container type
- Normal/reference range
- Unit
- Method
- Turnaround time
- STAT allowed: yes/no
- Price
- Outsourced/in-house
- Department performing test
- Report template
- Critical value rules
- Approval/verification workflow
- Lab report footer/signature
- Lab report upload requirement
- Barcode label requirement

## 9. Radiology Setup

- Modality list:
  - X-Ray
  - USG
  - CT
  - MRI
  - ECG
  - Echo
  - Mammography
  - Fluoroscopy
  - PET CT
- Study/procedure list
- Body part/protocol
- Contrast required rules
- Price
- Scheduling rules
- Radiologist assignment
- Technician workflow
- Report templates
- Image upload/PACS link requirement
- Report approval workflow
- Radiation safety notes
- Consent requirement for contrast

## 10. Pharmacy Setup

For every medicine/item:

- Generic name
- Brand name
- Category
- Form
- Strength
- Unit
- Pack unit
- Units per pack
- Batch number
- Expiry date
- MRP
- Purchase price
- Selling price
- GST/tax %
- Current stock
- Minimum stock
- Reorder level
- Supplier
- Rack/location
- Prescription required: yes/no
- Controlled drug: yes/no
- Substitution allowed: yes/no

Also collect:

- Pharmacy counters
- Purchase order workflow
- Goods receipt workflow
- Return policy
- Expiry alert period
- Stock adjustment approval rules
- Billing integration rules

## 11. Operation Theatre Setup

- OT room list
- Surgery/procedure list
- Surgery category
- Surgeon list
- Anesthetist list
- OT assistants
- OT package charges
- Surgeon charges
- Anesthesia charges
- OT consumables charge
- Pre-op checklist
- Post-op checklist
- Consent forms
- Implant tracking requirement
- OT notes template
- Sterilization workflow

## 12. ICU Setup

- ICU unit names
- ICU bed list
- Monitoring charge
- Ventilator charge
- Oxygen charge
- Nursing charge
- Intensivist visit charge
- Vital chart format
- Critical alert rules
- Shift handover format
- Device/equipment list

## 13. Billing Configuration

Collect all charge masters:

- Registration fee
- OPD consultation fee
- Follow-up fee
- Emergency fee
- Bed/room charges
- Nursing charges
- ICU charges
- Doctor visit charges
- Procedure charges
- OT charges
- Anesthesia charges
- Lab test charges
- Radiology charges
- Pharmacy item prices
- Consumable charges
- Oxygen charges
- Monitoring charges
- Ambulance charges
- Diet charges
- Documentation/certificate charges
- Package charges
- Insurance/corporate tariffs

For every charge:

- Charge name
- Category
- Amount
- Tax %
- Auto-apply trigger
- Active/inactive
- Department
- Applies to OPD/IPD/Emergency
- Discount allowed: yes/no
- Approval required for discount: yes/no

Billing policies:

- GST/tax rules
- Rounding rules
- Discount rules
- Advance deposit rules
- Refund rules
- Credit bill rules
- Corporate billing rules
- Insurance billing rules
- Payment modes accepted
- Receipt format
- Printable bill format
- Invoice numbering format

## 14. Insurance and Corporate Billing

- TPA list
- Insurance companies
- Corporate clients
- Cashless workflow
- Pre-authorization forms
- Claim submission workflow
- Package/tariff rates
- Exclusions
- Co-pay rules
- Credit limit
- Required documents
- Claim status stages

## 15. Inventory and Assets

- Store locations
- Item categories
- Consumables list
- Asset list
- Supplier list
- Purchase workflow
- Approval levels
- Stock issue workflow
- Department-wise consumption tracking
- Maintenance schedule
- Warranty details
- AMC details
- Asset tag format

## 16. Ambulance

- Ambulance list
- Vehicle number
- Type
- Driver details
- Equipment available
- Base location
- Per km charge
- Fixed trip charge
- Waiting charge
- Emergency trip workflow
- Dispatch contact

## 17. Dietary

- Diet types
- Meal plans
- Charges
- Allergy tracking
- Kitchen workflow
- Ward delivery workflow
- Dietician approval required: yes/no

## 18. Mortuary

- Mortuary slots
- Body tag format
- Storage charge
- Release workflow
- Police/MLC documentation
- Next of kin details required

## 19. Communication

- SMS provider
- WhatsApp provider
- Email SMTP
- Notification templates:
  - appointment confirmation
  - bill generated
  - payment received
  - lab report ready
  - admission
  - discharge
  - low stock
- Internal announcement rules

## 20. Reports and Dashboards

Required reports:

- Daily collection
- Outstanding dues
- OPD register
- IPD census
- Bed occupancy
- Lab register
- Radiology register
- Pharmacy sales
- Stock valuation
- Doctor revenue
- Department revenue
- Insurance claims
- Discharge report
- Emergency register
- Audit log

For each report:

- Required columns
- Filters
- Export format
- Print format
- Access roles

## 21. Documents and Templates

Collect final approved templates for:

- Prescription
- OPD slip
- Admission form
- Consent forms
- Discharge summary
- Lab report
- Radiology report
- Pharmacy invoice
- Final bill
- Payment receipt
- Refund receipt
- Medical certificate
- MLC form
- Death certificate

## 22. Compliance and Security

- Data retention policy
- Backup policy
- User password policy
- Role-based access matrix
- Audit log requirements
- Patient data privacy rules
- Consent requirements
- Regulatory reporting requirements
- Local legal requirements

## 23. Data Migration

Existing data to import:

- Patients
- Staff
- Doctors
- Departments
- Beds
- Pharmacy stock
- Lab tests
- Radiology services
- Billing charges
- Suppliers
- Corporate/insurance masters
- Opening balances

For each import file:

- Excel/CSV format
- Required columns
- Data owner
- Validation date
- Approved by

## 24. Go-Live Checklist

- Hospital profile configured
- Users created
- Roles tested
- Departments configured
- Charges configured
- Billing tested
- Printable bill approved
- Lab reports tested
- Radiology reports tested
- Pharmacy stock tested
- Payment workflow tested
- Backup tested
- Training completed
- Admin sign-off received

## 25. Sign-Off

- Hospital representative name
- Designation
- Phone/email
- Date
- Signature
- Implementation lead
- Final remarks
