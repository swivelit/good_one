const path = require('path');

process.env.UPLOAD_DIR = process.env.ADMIN_LOGIN_SMOKE_UPLOAD_DIR ||
  path.join(__dirname, '..', 'uploads');

const prisma = require('../Db/prisma');
const { login } = require('../Controllers/authController');

const requiredEnv = ['ADMIN_USERNAME', 'ADMIN_PASSWORD', 'JWT_SECRET'];
const missingEnv = requiredEnv.filter((name) => !String(process.env[name] || '').trim());

if (missingEnv.length) {
  console.error(`Missing required env for admin login smoke test: ${missingEnv.join(', ')}`);
  process.exit(1);
}

let prismaUserLookupCalled = false;
const originalFindFirst = prisma.user.findFirst;

prisma.user.findFirst = async () => {
  prismaUserLookupCalled = true;
  throw new Error('Admin login should not query Prisma user.findFirst');
};

const response = {
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
};

const run = async () => {
  await login({
    body: {
      emailOrPhone: process.env.ADMIN_USERNAME,
      password: process.env.ADMIN_PASSWORD,
    },
  }, response);

  prisma.user.findFirst = originalFindFirst;

  if (prismaUserLookupCalled) {
    throw new Error('Admin login queried Prisma before returning');
  }

  if (
    response.statusCode !== 200 ||
    response.body?.success !== true ||
    response.body?.user?.role !== 'admin' ||
    !response.body?.token
  ) {
    throw new Error(`Admin login smoke failed with status ${response.statusCode}`);
  }

  console.log('Admin login smoke passed with ADMIN_USERNAME/ADMIN_PASSWORD.');
};

run()
  .catch((error) => {
    prisma.user.findFirst = originalFindFirst;
    console.error(error.message);
    process.exit(1);
  });
