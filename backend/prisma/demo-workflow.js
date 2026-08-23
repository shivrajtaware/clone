require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { v4: uuid } = require('uuid');
const prisma = new PrismaClient();

async function main() {
  const hospital = await prisma.hospital.findUnique({ where: { code: 'CCH-DEMO' } });
  if (!hospital) throw new Error('CCH-DEMO hospital not found. Run the demo seed first.');
  const [admin, doctor, pharmacist] = await Promise.all([
    prisma.user.findFirst({ where: { hospital_id: hospital.id, role: 'HOSPITAL_ADMIN' } }),
    prisma.user.findFirst({ where: { hospital_id: hospital.id, role: 'DOCTOR' }, orderBy: { created_at: 'asc' } }),
    prisma.user.findFirst({ where: { hospital_id: hospital.id, role: 'PHARMACIST' } }),
  ]);
  const patients = await prisma.patient.findMany({ where: { hospital_id: hospital.id }, orderBy: { uhid: 'asc' }, take: 4 });
  const appointments = await prisma.appointment.findMany({ where: { hospital_id: hospital.id }, orderBy: { appointment_date: 'asc' }, take: 4 });
  const admissions = await prisma.admission.findMany({ where: { hospital_id: hospital.id }, orderBy: { admission_date: 'asc' }, take: 4 });
  if (!doctor || !pharmacist || patients.length < 3) throw new Error('Demo staff or patients are missing.');

  const stockedItems = await prisma.pharmacyItem.findMany({ where: { hospital_id: hospital.id, current_stock: { gt: 20 } }, include: { batches: { where: { quantity_rem: { gt: 20 }, expiry_date: { gt: new Date() } }, orderBy: { expiry_date: 'asc' } } }, orderBy: { generic_name: 'asc' }, take: 20 });
  const medicine = stockedItems.find(item => /paracetamol|amlodipine|metformin/i.test(item.generic_name)) || stockedItems[0];
  if (!medicine?.batches[0]) throw new Error('No stocked pharmacy batch available for the workflow.');

  const firstAppointment = appointments.find(a => a.patient_id === patients[0].id) || appointments[0];
  const firstAdmission = admissions.find(a => a.patient_id === patients[0].id) || admissions[0];
  const existingRx = await prisma.prescription.findFirst({ where: { patient_id: patients[0].id }, include: { items: true }, orderBy: { prescribed_at: 'asc' } });
  let prescription;
  if (existingRx) {
    prescription = await prisma.prescription.update({ where: { id: existingRx.id }, data: { appointment_id: firstAppointment?.id || null, admission_id: firstAdmission?.id || null, doctor_id: doctor.id, items: { updateMany: { where: {}, data: { pharmacy_item_id: medicine.id } } } }, include: { items: true } });
  } else {
    prescription = await prisma.prescription.create({ data: { patient_id: patients[0].id, doctor_id: doctor.id, appointment_id: firstAppointment?.id || null, admission_id: firstAdmission?.id || null, encounter_type: firstAdmission ? 'IPD' : 'OPD', notes: 'Continue medication and review after investigations.', items: { create: [{ drug_name: medicine.brand_name || medicine.generic_name, generic_name: medicine.generic_name, strength: medicine.strength, form: medicine.form, dose: '1 tablet', frequency: 'BD', duration: '5 days', route: 'Oral', quantity: 10, quantity_unit: 'LOOSE', pharmacy_item_id: medicine.id }] } } });
  }

  const dispenseNo = 'DSP-CCH-DEMO-001';
  let dispense = await prisma.dispense.findUnique({ where: { dispense_no: dispenseNo }, include: { items: true } });
  if (!dispense) {
    const batch = medicine.batches[0];
    const quantity = Math.min(10, batch.quantity_rem, medicine.current_stock);
    dispense = await prisma.$transaction(async tx => {
      const created = await tx.dispense.create({ data: { id: uuid(), hospital_id: hospital.id, dispense_no: dispenseNo, patient_id: patients[0].id, prescription_id: prescription.id, dispensed_by: pharmacist.id, notes: 'Prescription fulfilled · demo workflow', items: { create: [{ id: uuid(), item_id: medicine.id, quantity, batch_no: batch.batch_no, unit_price: batch.selling_price || batch.mrp }] } }, include: { items: true } });
      await tx.drugBatch.update({ where: { id: batch.id }, data: { quantity_rem: { decrement: quantity } } });
      await tx.pharmacyItem.update({ where: { id: medicine.id }, data: { current_stock: { decrement: quantity } } });
      return created;
    });
  }

  const labOrder = await prisma.labOrder.findFirst({ where: { hospital_id: hospital.id, patient_id: patients[0].id }, include: { items: true, bill: true }, orderBy: { created_at: 'asc' } });
  if (labOrder && !labOrder.bill_id) {
    const labTests = await prisma.labTest.findMany({ where: { hospital_id: hospital.id, code: { in: labOrder.items.map(item => item.test_code).filter(Boolean) } } });
    const prices = new Map(labTests.map(test => [test.code, Number(test.price)]));
    const items = labOrder.items.map(item => ({ category: 'Laboratory', description: item.test_name, quantity: 1, unit_price: prices.get(item.test_code) || 450, total: prices.get(item.test_code) || 450 }));
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const bill = await prisma.bill.create({ data: { id: uuid(), hospital_id: hospital.id, bill_no: 'CCH-LAB-260818-01', patient_id: patients[0].id, type: 'LAB', status: 'PAID', subtotal, total_amt: subtotal, paid_amt: subtotal, due_amt: 0, payment_mode: 'UPI', items: { create: items }, payments: { create: { id: uuid(), amount: subtotal, mode: 'UPI', reference_no: 'UPI-LAB-CCH-01', received_by: admin?.id } } } });
    await prisma.labOrder.update({ where: { id: labOrder.id }, data: { bill_id: bill.id } });
  }

  for (const [index, patient] of patients.slice(1, 3).entries()) {
    const appointment = appointments.find(a => a.patient_id === patient.id);
    const admission = admissions.find(a => a.patient_id === patient.id);
    const hasPrescription = await prisma.prescription.findFirst({ where: { patient_id: patient.id } });
    if (!hasPrescription) await prisma.prescription.create({ data: { patient_id: patient.id, doctor_id: doctor.id, appointment_id: appointment?.id || null, admission_id: admission?.id || null, encounter_type: admission ? 'IPD' : 'OPD', notes: index ? 'Post-procedure analgesia and gastric protection.' : 'Diabetes follow-up prescription.', items: { create: [{ drug_name: index ? 'Paracetamol' : 'Metformin', generic_name: index ? 'Paracetamol' : 'Metformin', strength: index ? '500 mg' : '500 mg', form: 'Tablet', dose: '1 tablet', frequency: index ? 'SOS' : 'BD', duration: index ? '3 days' : '30 days', route: 'Oral', quantity: index ? 6 : 60, quantity_unit: 'LOOSE', pharmacy_item_id: medicine.id }] } } });
  }
  console.log(JSON.stringify({ hospital: hospital.name, pharmacy_items: await prisma.pharmacyItem.count({ where: { hospital_id: hospital.id } }), prescriptions: await prisma.prescription.count({ where: { patient: { hospital_id: hospital.id } } }), dispenses: await prisma.dispense.count({ where: { hospital_id: hospital.id } }), linked_lab_orders: await prisma.labOrder.count({ where: { hospital_id: hospital.id, bill_id: { not: null } } }) }, null, 2));
}
main().catch(error => { console.error('Workflow seed failed:', error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
