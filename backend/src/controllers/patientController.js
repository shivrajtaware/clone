// src/controllers/patientController.js
const { prisma } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const {
  normalizeAllergies,
  normalizeEmergencyContacts,
  normalizeInsuranceDetails,
  requireFields,
  sanitizeModelInput,
} = require('../utils/prismaInput');
const { generatePatientBarcode } = require('../utils/barcodeGenerator');
const { emitToPatients } = require('../config/socket');

// Generate UHID: HC-XXXXXX
const generateUHID = async (hospitalId) => {
  const count = await prisma.patient.count({ where: { hospital_id: hospitalId } });
  const hospital = await prisma.hospital.findUnique({ where: { id: hospitalId }, select: { code: true } });
  const prefix = hospital?.code?.substring(0, 3).toUpperCase() || 'HC';
  let next = count + 1;

  while (true) {
    const uhid = `${prefix}-${String(next).padStart(6, '0')}`;
    const exists = await prisma.patient.findUnique({ where: { uhid }, select: { id: true } });
    if (!exists) return uhid;
    next += 1;
  }
};

exports.getAll = async (req, res) => {
  const { search, status, department, gender, page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = {
    hospital_id: req.hospitalId,
    ...(search && {
      OR: [
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { uhid: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { aadhar_no: { contains: search } },
      ],
    }),
    ...(gender && { gender }),
  };

  const [patients, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { created_at: 'desc' },
      include: {
        allergies: true,
        insurance_details: { where: { is_active: true }, take: 1 },
        admissions: {
          where: { status: 'ADMITTED' },
          take: 1,
          include: { bed: { select: { ward: true, bed_no: true } } },
        },
        appointments: {
          where: { status: { in: ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION'] } },
          take: 1,
          orderBy: { appointment_date: 'asc' },
        },
      },
    }),
    prisma.patient.count({ where }),
  ]);

  res.json({ success: true, data: patients, meta: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) } });
};

exports.getOne = async (req, res) => {
  const patient = await prisma.patient.findFirst({
    where: { id: req.params.id, hospital_id: req.hospitalId },
    include: {
      emergency_contacts: true,
      allergies: true,
      insurance_details: true,
      admissions: {
        orderBy: { admission_date: 'desc' },
        take: 5,
        include: { bed: true, discharge_summary: true },
      },
      appointments: { orderBy: { appointment_date: 'desc' }, take: 10 },
      vitals: { orderBy: { recorded_at: 'desc' }, take: 10 },
      prescriptions: { include: { items: true }, orderBy: { prescribed_at: 'desc' }, take: 5 },
    },
  });
  if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });
  res.json({ success: true, data: patient });
};

exports.create = async (req, res) => {
  const { emergency_contacts, allergies, insurance_details, _allergies_note, ...patientData } = req.body;

  const uhid = await generateUHID(req.hospitalId);

  const processedData = sanitizeModelInput('Patient', patientData, {
    exclude: ['id', 'hospital_id', 'uhid'],
  });
  requireFields(processedData, ['first_name', 'last_name', 'gender']);

  const contactRows = normalizeEmergencyContacts(emergency_contacts);
  const allergyRows = normalizeAllergies(allergies, _allergies_note);
  const insuranceRows = normalizeInsuranceDetails(insurance_details);
  const patientId = uuidv4();

  // Generate barcode data
  let barcodeData = null;
  let barcodeImage = null;
  try {
    const barcodeResult = await generatePatientBarcode({
      id: patientId,
      uhid,
      first_name: processedData.first_name,
      last_name: processedData.last_name,
    });
    barcodeData = barcodeResult.barcodeData;
    barcodeImage = barcodeResult.barcodeImage;
  } catch (error) {
    logger.warn('Failed to generate barcode:', { error: error.message });
  }

  const patient = await prisma.patient.create({
    data: {
      id: patientId,
      hospital_id: req.hospitalId,
      uhid,
      ...processedData,
      barcode_data: barcodeData,
      barcode_image: barcodeImage,
      emergency_contacts: contactRows.length
        ? { create: contactRows.map(c => ({ id: uuidv4(), ...c })) } : undefined,
      allergies: allergyRows.length
        ? { create: allergyRows.map(a => ({ id: uuidv4(), ...a })) } : undefined,
      insurance_details: insuranceRows.length
        ? { create: insuranceRows.map(i => ({ id: uuidv4(), ...i })) } : undefined,
    },
    include: { emergency_contacts: true, allergies: true, insurance_details: true },
  });

  // Audit log - wrap separately to not break patient creation
  try {
    await prisma.auditLog.create({
      data: {
        id: uuidv4(),
        hospital_id: req.hospitalId,
        user_id: req.user.id,
        action: 'CREATE',
        module: 'PATIENTS',
        record_id: patient.id,
        ip_address: req.ip,
      },
    });
  } catch (e) {
    logger.warn('Audit log failed (non-critical)', { error: e.message });
  }
  emitToPatients(req.hospitalId, 'patients:updated', { type: 'CREATED' });
  res.status(201).json({ success: true, message: 'Patient registered successfully', data: patient });
};

exports.update = async (req, res) => {
  const updateData = { ...req.body };
  delete updateData.emergency_contacts;
  delete updateData.allergies;
  delete updateData.insurance_details;
  delete updateData._allergies_note;

  const processedData = sanitizeModelInput('Patient', updateData, {
    exclude: ['id', 'hospital_id', 'uhid'],
  });

  const patient = await prisma.patient.update({
    where: { id: req.params.id },
    data: processedData,
  });

  await prisma.auditLog.create({ data: { id: uuidv4(), hospital_id: req.hospitalId, user_id: req.user.id, action: 'UPDATE', module: 'PATIENTS', record_id: patient.id, ip_address: req.ip } });

  res.json({ success: true, message: 'Patient updated', data: patient });
};

exports.getTimeline = async (req, res) => {
  const { id } = req.params;
  const [admissions, appointments, labOrders, prescriptions, vitals] = await Promise.all([
    prisma.admission.findMany({ where: { patient_id: id }, orderBy: { admission_date: 'desc' }, include: { bed: true } }),
    prisma.appointment.findMany({ where: { patient_id: id }, orderBy: { appointment_date: 'desc' }, take: 20 }),
    prisma.labOrder.findMany({ where: { patient_id: id }, orderBy: { created_at: 'desc' }, take: 10 }),
    prisma.prescription.findMany({ where: { patient_id: id }, include: { items: true }, orderBy: { prescribed_at: 'desc' }, take: 10 }),
    prisma.vitals.findMany({ where: { patient_id: id }, orderBy: { recorded_at: 'desc' }, take: 20 }),
  ]);
  res.json({ success: true, data: { admissions, appointments, labOrders, prescriptions, vitals } });
};

exports.search = async (req, res) => {
  const { q } = req.query;
  const query = typeof q === 'string' ? q.trim() : '';
  if (!query || query.length < 2) return res.json({ success: true, data: [] });
  const nameParts = query.split(/\s+/).filter(Boolean);
  const patients = await prisma.patient.findMany({
    where: {
      hospital_id: req.hospitalId,
      OR: [
        { first_name: { contains: query, mode: 'insensitive' } },
        { last_name: { contains: query, mode: 'insensitive' } },
        { uhid: { contains: query, mode: 'insensitive' } },
        { phone: { contains: query } },
        ...(nameParts.length >= 2 ? [{
          AND: [
            { first_name: { contains: nameParts[0], mode: 'insensitive' } },
            { last_name: { contains: nameParts.slice(1).join(' '), mode: 'insensitive' } },
          ],
        }] : []),
      ],
    },
    take: 10,
    orderBy: [{ first_name: 'asc' }, { last_name: 'asc' }],
    select: { id: true, uhid: true, first_name: true, last_name: true, phone: true, gender: true, dob: true },
  });
  res.json({ success: true, data: patients });
};
