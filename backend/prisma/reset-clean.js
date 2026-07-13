// WARNING: Removes every application record from the configured database,
// then creates the configured Super Admin account. It is for a fresh client
// deployment only.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const email = (process.env.SUPER_ADMIN_EMAIL || 'superadmin@medicore.com').trim().toLowerCase();
const password = process.env.SUPER_ADMIN_PASSWORD || 'MediCore@2026';

function quoteIdentifier(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function main() {
  if (password.length < 8) throw new Error('SUPER_ADMIN_PASSWORD must contain at least 8 characters.');

  const tables = await prisma.$queryRaw`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;

  if (tables.length) {
    const names = tables.map(({ tablename }) => quoteIdentifier(tablename)).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      first_name: 'Super',
      last_name: 'Admin',
      email,
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      is_active: true,
    },
  });

  console.log(`Database reset complete. Super admin ready: ${email}`);
}

main()
  .catch((error) => {
    console.error('Clean reset failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
