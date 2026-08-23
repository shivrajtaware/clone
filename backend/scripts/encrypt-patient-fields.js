require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { encrypt } = require('../src/utils/fieldEncryption');

const prisma = new PrismaClient();

async function main() {
  let processed = 0;
  let cursor;
  while (true) {
    const patients = await prisma.patient.findMany({
      take: 100,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, phone: true, email: true, address: true, aadhar_no: true },
    });
    if (!patients.length) break;
    for (const patient of patients) {
      await prisma.patient.update({
        where: { id: patient.id },
        data: {
          phone_enc: patient.phone ? encrypt(patient.phone) : null,
          email_enc: patient.email ? encrypt(patient.email) : null,
          address_enc: patient.address ? encrypt(patient.address) : null,
          aadhar_no_enc: patient.aadhar_no ? encrypt(patient.aadhar_no) : null,
        },
      });
      processed += 1;
      cursor = patient.id;
    }
  }
  console.log(`Encrypted patient field copies for ${processed} patient(s); original fields were preserved.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
