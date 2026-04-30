# good_one

GoodOne marketplace.

## Render backend deployment

- Root directory: `Backend`
- Build command: `npm ci && npx prisma generate`
- Pre-deploy command: `npx prisma migrate deploy`
- Start command: `npm start`
- Required environment variables include `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRE`, `CLIENT_URLS`, `EMAIL_USER`, and `EMAIL_PASS`.

## Final Production Checklist

### Backend Render

- Root Directory: `Backend`
- Build Command: `npm ci && npx prisma generate`
- Pre-Deploy Command: `npx prisma migrate deploy`
- Start Command: `npm start`
- Health Check Path: `/api/health`
- Disk mount path: `/var/data`
- `UPLOAD_DIR=/var/data/uploads`

### Frontend Render

- Root Directory: `client`
- Build Command: `npm ci && npm run build`
- Publish Directory: `build`
- Rewrite: `/* -> /index.html`

### Testing

- Use `ENABLE_TEST_OTP=true` and `OTP_BYPASS_CODE=111111` only for temporary testing.
- Production must keep `ENABLE_TEST_OTP=false` and `OTP_BYPASS_CODE` blank/removed.
- Production smoke command:

```sh
CUSTOMER_EMAIL=<email> CUSTOMER_PASSWORD=<password> VENDOR_EMAIL=<email> VENDOR_PASSWORD=<password> API_BASE_URL=https://good-one-api.onrender.com/api FRONTEND_URL=https://good-one-jlcu.onrender.com npm run test:prod-smoke
```
