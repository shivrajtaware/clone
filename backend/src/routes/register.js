// backend/src/routes/register.js
const router = require('express').Router();
const auth   = require('../middleware/auth');
const { prisma } = require('../config/db');
router.use(auth);

// ── GET OPD History (Only COMPLETED & CANCELLED appointments) ───────────────────
router.get('/opd/history', async (req, res) => {
  const { search } = req.query;

  const where = {
    hospital_id: req.hospitalId,
    status: { in: ['COMPLETED', 'CANCELLED'] }, 
    ...(search && {
      OR: [
        { patient: { first_name:  { contains: search, mode: 'insensitive' } } },
        { patient: { last_name:   { contains: search, mode: 'insensitive' } } },
        { patient: { uhid:        { contains: search, mode: 'insensitive' } } },
        { patient: { phone:       { contains: search } } },
      ],
    }),
  };

  const appointments = await prisma.appointment.findMany({
    where,
    orderBy: { appointment_date: 'desc' },
    include: {
      patient: {
        select: {
          id:         true,
          uhid:       true,
          first_name: true,
          last_name:  true,
          phone:      true,
          dob:        true,
          gender:     true,
          address:    true,
        },
      },
      doctor: {
        select: { id: true, first_name: true, last_name: true },
      },
    },
  });

  res.json({ success: true, data: appointments });
});

// ── GET IPD History (Both Admitted and Discharged Patients) ───────────────
router.get('/ipd/history', async (req, res) => {
  const { search } = req.query;

  const where = {
    hospital_id: req.hospitalId,
    status: 'DISCHARGED',
    ...(search && {
      OR: [
        { patient: { first_name:  { contains: search, mode: 'insensitive' } } },
        { patient: { last_name:   { contains: search, mode: 'insensitive' } } },
        { patient: { uhid:        { contains: search, mode: 'insensitive' } } },
        { patient: { phone:       { contains: search } } },
      ],
    }),
  };

  const admissions = await prisma.admission.findMany({
    where,
    orderBy: { admission_date: 'desc' },
    include: {
      patient: {
        select: {
          id:         true,
          uhid:       true,
          first_name: true,
          last_name:  true,
          phone:      true,
          dob:        true,
          gender:     true,
        },
      },
      bed: {
        select: { ward: true, bed_no: true },
      },
    },
  });

  const patientIds = admissions.map(a => a.patient_id);
  const bills = await prisma.bill.findMany({
    where: {
      hospital_id: req.hospitalId,
      patient_id:  { in: patientIds },
      type:        { in: ['IPD_FINAL', 'IPD_INTERIM'] },
    },
    select: {
      id:           true,
      bill_no:      true,
      patient_id:   true,
      admission_id: true,
      type:         true,
      status:       true,
      total_amt:    true,
    },
  });

  const billsByPatient = {};
  for (const bill of bills) {
    if (!billsByPatient[bill.patient_id]) {
      billsByPatient[bill.patient_id] = [];
    }
    billsByPatient[bill.patient_id].push(bill);
  }

  const result = admissions.map(a => ({
    ...a,
    bills: billsByPatient[a.patient_id] || [],
  }));

  res.json({ success: true, data: result });
});

module.exports = router;