require('../backend/node_modules/dotenv').config({ path: require('path').resolve(__dirname, '../backend/.env') });
const bcrypt = require('../backend/node_modules/bcryptjs');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const email = (process.argv[2] || process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.argv[3] || process.env.SUPER_ADMIN_PASSWORD || '';

  if (!email || !password || password.length < 8) {
    throw new Error('Usage: node installation\\create-super-admin.js admin@example.com StrongPass123!');
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hashed, is_active: true, role: 'SUPER_ADMIN', hospital_id: null },
    create: {
      first_name: 'Super',
      last_name: 'Admin',
      email,
      password: hashed,
      role: 'SUPER_ADMIN',
      is_active: true,
    },
  });

  console.log(`Super admin ready: ${user.email}`);
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
