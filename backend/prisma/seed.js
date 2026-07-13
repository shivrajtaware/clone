// Creates only the platform owner account. Hospital data is created from the
// Super Admin panel after the customer deployment is ready.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const email = (process.env.SUPER_ADMIN_EMAIL || 'superadmin@medicore.com').trim().toLowerCase();
const password = process.env.SUPER_ADMIN_PASSWORD || 'MediCore@2026';

async function main() {
  if (password.length < 8) throw new Error('SUPER_ADMIN_PASSWORD must contain at least 8 characters.');

  const hashedPassword = await bcrypt.hash(password, 12);
  const superAdmin = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      hospital_id: null,
      is_active: true,
      refresh_token: null,
    },
    create: {
      first_name: 'Super',
      last_name: 'Admin',
      email,
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      is_active: true,
    },
  });

  console.log(`Super admin ready: ${superAdmin.email}`);
  console.log('No hospitals, staff, patients, or demo records were created.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
