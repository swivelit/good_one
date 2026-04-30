# good_one

GoodOne marketplace.

## Render backend deployment

- Root directory: `Backend`
- Build command: `npm ci && npx prisma generate && npx prisma migrate deploy`
- Start command: `npm start`
- Required environment variables include `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRE`, `CLIENT_URLS`, `EMAIL_USER`, and `EMAIL_PASS`.
