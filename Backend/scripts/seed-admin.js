const bcrypt = require('bcryptjs');
const prisma = require('../Db/prisma');

const ADMIN_EMAIL = 'admin@goodone.com';
const ADMIN_NAME = 'GoodOne Admin';

async function main() {
  const password = process.env.ADMIN_SEED_PASSWORD;

  if (!password) {
    throw new Error('ADMIN_SEED_PASSWORD is required.');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const existingAdmin = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  if (existingAdmin) {
    const admin = await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        name: ADMIN_NAME,
        password: passwordHash,
        role: 'admin',
        isActive: true,
      },
    });

    console.log(`Admin account updated: ${admin.email}`);
    return;
  }

  const admin = await prisma.user.create({
    data: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: passwordHash,
      role: 'admin',
      isActive: true,
    },
  });

  console.log(`Admin account created: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });