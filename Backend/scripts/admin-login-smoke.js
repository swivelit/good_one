const assert = require('assert');
const jwt = require('jsonwebtoken');

const prisma = require('../Db/prisma');
const { login } = require('../Controllers/authController');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@goodone.com';
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET;

if (!ADMIN_PASSWORD || !JWT_SECRET) {
  console.error(
    'Missing required env for admin login smoke test: ADMIN_SEED_PASSWORD, JWT_SECRET'
  );
  process.exit(1);
}

const createMockResponse = () => {
  const response = {
    statusCode: 200,
    body: null,

    status(code) {
      response.statusCode = code;
      return response;
    },

    json(payload) {
      response.body = payload;
      return response;
    },
  };

  return response;
};

async function run() {
  try {
    const admin = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL.toLowerCase() },
    });

    assert(admin, `Admin account not found: ${ADMIN_EMAIL}`);
    assert.strictEqual(admin.role, 'admin', 'User is not an admin');
    assert.strictEqual(admin.isActive, true, 'Admin account is inactive');

    const req = {
      body: {
        emailOrPhone: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      },
    };

    const res = createMockResponse();

    await login(req, res);

    assert.strictEqual(res.statusCode, 200, 'Admin login did not return HTTP 200');
    assert(res.body, 'Admin login returned no response body');
    assert.strictEqual(res.body.success, true, 'Admin login was not successful');
    assert(res.body.token, 'Admin login did not return a token');
    assert(res.body.user, 'Admin login did not return a user');
    assert.strictEqual(
      res.body.user.role,
      'admin',
      'Logged-in user does not have admin role'
    );
    assert.strictEqual(
      res.body.user.id,
      admin.id,
      'JWT/login user ID does not match the database admin ID'
    );

    const decoded = jwt.verify(res.body.token, JWT_SECRET);

    assert.strictEqual(
      decoded.id,
      admin.id,
      'JWT does not contain the real database user ID'
    );

    console.log('Admin login smoke passed.');
    console.log(`Admin: ${ADMIN_EMAIL}`);
    console.log(`Database ID: ${admin.id}`);
    console.log('Role: admin');
    console.log('JWT verified successfully.');
  } catch (error) {
    console.error('Admin login smoke failed.');
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

run();