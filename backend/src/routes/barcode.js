// src/routes/barcode.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const { prisma } = require('../config/db');
const { buildPatientBarcodeData, generatePatientBarcode, parsePatientBarcode } = require('../utils/barcodeGenerator');

router.use(auth);

/**
 * GET /api/barcode/:patientId
 * Retrieve the barcode for a patient
 */
router.get('/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;

    let patient = await prisma.patient.findFirst({
      where: { id: patientId, hospital_id: req.hospitalId },
      select: {
        id: true,
        uhid: true,
        first_name: true,
        last_name: true,
        barcode_data: true,
        barcode_image: true,
        dob: true,
        blood_group: true,
        phone: true,
        email: true,
        admissions: {
          where: { status: 'ADMITTED' },
          select: {
            id: true,
          },
        },
        emr_notes: {
          orderBy: { created_at: 'desc' },
          take: 5,
          select: {
            id: true,
          },
        },
      },
    });

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    if (patient.barcode_data !== buildPatientBarcodeData(patient) || !patient.barcode_image) {
      const barcodeResult = await generatePatientBarcode(patient);
      patient = await prisma.patient.update({
        where: { id: patient.id },
        data: {
          barcode_data: barcodeResult.barcodeData,
          barcode_image: barcodeResult.barcodeImage,
        },
        select: {
          id: true,
          uhid: true,
          first_name: true,
          last_name: true,
          barcode_data: true,
          barcode_image: true,
          dob: true,
          blood_group: true,
          phone: true,
          email: true,
          admissions: {
            where: { status: 'ADMITTED' },
            select: { id: true },
          },
          emr_notes: {
            orderBy: { created_at: 'desc' },
            take: 5,
            select: { id: true },
          },
        },
      });
    }

    res.json({
      success: true,
      data: {
        patient,
        emrSummary: {
          admissions: patient.admissions.length,
          notes: patient.emr_notes.length,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching barcode:', error);
    res.status(500).json({ success: false, message: 'Error fetching barcode' });
  }
});

/**
 * POST /api/barcode/scan
 * Resolve a scanner-entered barcode to a patient profile.
 */
router.post('/scan', async (req, res) => {
  try {
    const parsed = parsePatientBarcode(req.body?.code);
    const where = parsed.patientId
      ? { id: parsed.patientId, hospital_id: req.hospitalId }
      : { uhid: parsed.uhid, hospital_id: req.hospitalId };

    const patient = await prisma.patient.findFirst({
      where,
      select: { id: true, uhid: true, first_name: true, last_name: true },
    });

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found for scanned barcode' });
    }

    res.json({ success: true, data: { patient } });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Invalid patient barcode' });
  }
});

/**
 * POST /api/barcode/:patientId/regenerate
 * Regenerate the barcode for a patient
 */
router.post('/:patientId/regenerate', async (req, res) => {
  try {
    const { patientId } = req.params;

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, hospital_id: req.hospitalId },
      select: { id: true, uhid: true, first_name: true, last_name: true },
    });

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    // Generate new barcode
    const barcodeResult = await generatePatientBarcode(patient);

    // Update patient with new barcode
    const updatedPatient = await prisma.patient.update({
      where: { id: patientId },
      data: {
        barcode_data: barcodeResult.barcodeData,
        barcode_image: barcodeResult.barcodeImage,
      },
      select: {
        id: true,
        uhid: true,
        first_name: true,
        last_name: true,
        barcode_data: true,
        barcode_image: true,
      },
    });

    res.json({
      success: true,
      message: 'Barcode regenerated successfully',
      data: updatedPatient,
    });
  } catch (error) {
    console.error('Error regenerating barcode:', error);
    res.status(500).json({ success: false, message: 'Error regenerating barcode' });
  }
});

module.exports = router;
