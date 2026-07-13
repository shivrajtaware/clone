# Database Error Fixes & Solutions

This document outlines common database errors in MediCore HMS and their solutions.

## 1. Date Format Errors

### Error: `Invalid value for argument dob: premature end of input. Expected ISO-8601 DateTime`

**Cause**: Prisma expects ISO-8601 DateTime format (e.g., `2001-02-04T00:00:00Z`), but received date-only format (e.g., `2001-02-04`).

**Solution**: Convert date strings before sending to Prisma:
```javascript
// ❌ Wrong:
const patient = await prisma.patient.create({
  data: {
    dob: "2001-02-04"  // String only
  }
});

// ✅ Correct:
const patient = await prisma.patient.create({
  data: {
    dob: new Date("2001-02-04T00:00:00Z")  // Date object
  }
});
```

**Frontend Fix** (in API calls):
```javascript
// Before sending to backend, convert dates:
const formData = {
  ...data,
  dob: data.dob ? new Date(data.dob + 'T00:00:00Z').toISOString() : null
};
```

**Backend Fix** (in controllers/routes):
```javascript
// Use the dateHelper utility:
const { processPatientData } = require('../utils/dateHelper');

const processedData = processPatientData(req.body);
const patient = await prisma.patient.create({
  data: {
    id: uuidv4(),
    hospital_id: req.hospitalId,
    ...processedData
  }
});
```

## 2. Permission Errors

### Error: `User medicore_user was denied access on the database medicore_db.public`

**Cause**: PostgreSQL user doesn't have proper schema permissions.

**Solution**: Run these SQL commands as PostgreSQL superuser:
```sql
-- Connect to the database
\c medicore_db

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO medicore_user;

-- Grant table creation
GRANT CREATE ON SCHEMA public TO medicore_user;

-- Grant all table privileges
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO medicore_user;

-- Grant all sequence privileges
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO medicore_user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO medicore_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO medicore_user;
```

## 3. Unique Constraint Violations

### Error: `Unique constraint failed on the fields: (hospital_id,code)`

**Cause**: Trying to create a record with a duplicate unique field value.

**Solution**: 
- Check if the record already exists before creating
- Use upsert instead of create for idempotency

```javascript
// Use upsert to avoid duplicate errors:
const item = await prisma.model.upsert({
  where: { unique_field: value },
  update: { /* ... */ },
  create: { /* ... */ }
});
```

## 4. Foreign Key Constraint Failures

### Error: `Foreign key constraint failed on the field: hospital_id`

**Cause**: Referencing a hospital/user/department that doesn't exist.

**Solution**: Always validate references exist before creating:
```javascript
// Check hospital exists
const hospital = await prisma.hospital.findUnique({
  where: { id: req.hospitalId }
});
if (!hospital) return res.status(400).json({ error: 'Hospital not found' });

// Check user/doctor exists
const doctor = await prisma.user.findUnique({
  where: { id: doctor_id }
});
if (!doctor) return res.status(400).json({ error: 'Doctor not found' });

// Then create the appointment
const appt = await prisma.appointment.create({ data: { /* ... */ } });
```

## 5. Null Value in Non-Nullable Field

### Error: `Not-null constraint failed on the field: email`

**Cause**: Sending `null` or `undefined` for a required field.

**Solution**: Use the `filterUndefined` helper or validate required fields:
```javascript
// Use filterUndefined to remove undefined values:
const { filterUndefined } = require('../utils/dateHelper');

const data = filterUndefined({
  first_name: req.body.first_name,
  email: req.body.email,  // Must be present
  phone: req.body.phone   // Can be undefined, won't be set
});

const user = await prisma.user.create({ data });
```

## 6. Type Conversion Errors

### Error: `Argument quantity must not be empty.`

**Cause**: Passing string instead of number for numeric fields.

**Solution**: Convert to proper types:
```javascript
// ❌ Wrong:
const item = await prisma.inventoryItem.create({
  data: {
    quantity: "100"  // String
  }
});

// ✅ Correct:
const item = await prisma.inventoryItem.create({
  data: {
    quantity: parseInt("100")  // Number
  }
});
```

## 7. Invalid Enum Values

### Error: `Invalid value. Expected enum GenderEnum, received 'INVALID'`

**Cause**: Sending invalid enum value that's not defined in schema.

**Solution**: Validate enum values before sending:
```javascript
// Valid values: MALE, FEMALE, OTHER
const validGenders = ['MALE', 'FEMALE', 'OTHER'];
if (!validGenders.includes(req.body.gender)) {
  return res.status(400).json({ error: 'Invalid gender value' });
}

const patient = await prisma.patient.create({
  data: { gender: req.body.gender }
});
```

## 8. Transaction Rollback Issues

### Error: `Client error: Transaction aborted. Retry transaction.`

**Cause**: Concurrent modifications during transaction or deadlock.

**Solution**: Implement retry logic:
```javascript
const retryTransaction = async (callback, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await callback();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
    }
  }
};

// Usage:
await retryTransaction(async () => {
  return await prisma.$transaction([
    // Transaction operations...
  ]);
});
```

## 9. Debugging Tips

### Enable Prisma Logging
Add to `.env`:
```env
DATABASE_LOG=query,info,warn,error
```

Or in code:
```javascript
const { prisma } = require('../config/db');
prisma.$on('query', (e) => {
  console.log('Query:', e.query);
  console.log('Duration:', e.duration + 'ms');
});
```

### Common Checks Before Creating Records
```javascript
// Always validate:
1. Required fields are present (not null/undefined)
2. Types are correct (string/number/date/enum)
3. Foreign key references exist
4. Unique values don't already exist
5. Date formats are proper DateTime objects
6. Email addresses are lowercase and trimmed
7. Phone numbers are in valid format
```

## 10. Quick Reference: Date Handling in Different Modules

### Patients
- `dob` → Date only → `new Date(dob + 'T00:00:00Z')`

### Appointments  
- `appointment_date` → DateTime → `new Date(appointment_date)`

### Admissions
- `admission_date` → DateTime → `new Date(admission_date)`
- `discharge_date` → DateTime → `new Date(discharge_date)`
- `follow_up_date` → Date only → `new Date(follow_up_date + 'T00:00:00Z')`

### Pharmacy
- `expiry_date` → Date only → `new Date(expiry_date + 'T00:00:00Z')`

### Prescriptions
- `valid_till` → Date only → `new Date(valid_till + 'T00:00:00Z')`

### Lab Orders
- `target_collection_date` → Date → `new Date(target_collection_date + 'T00:00:00Z')`

### EMR Notes & Vitals
- `recorded_at` → DateTime → Automatically set to `new Date()`
- `visit_date` → DateTime → `new Date(visit_date)`

## Prevention: Use DateHelper Utility

```javascript
const {
  parseDate,
  parseDateTime,
  processPatientData,
  filterUndefined
} = require('../utils/dateHelper');

// In your controller:
const processedData = processPatientData(req.body);
const filtered = filterUndefined(processedData);
const patient = await prisma.patient.create({
  data: { ...filtered, hospital_id: req.hospitalId }
});
```

This ensures all dates are properly converted and undefined values are excluded.
