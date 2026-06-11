const fs = require('fs');
const path = require('path');

const EXPECTED_APP_ADS = 'google.com, pub-9859771616835832, DIRECT, f08c47fec0942fa0\n';
const files = [
  path.resolve(__dirname, '..', 'public', 'app-ads.txt'),
  path.resolve(__dirname, '..', 'build', 'app-ads.txt'),
];

const fail = (message) => {
  console.error(`app-ads.txt verification failed: ${message}`);
  process.exit(1);
};

files.forEach((filePath) => {
  if (!fs.existsSync(filePath)) {
    fail(`${filePath} does not exist. Run npm run build before verifying the built file.`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  if (content !== EXPECTED_APP_ADS) {
    fail(`${filePath} must contain exactly ${JSON.stringify(EXPECTED_APP_ADS)}`);
  }
});

console.log('app-ads.txt verification passed');
