const fs = require('fs');
const path = require('path');

const assetLinksPath = path.resolve(__dirname, '..', 'public', '.well-known', 'assetlinks.json');
const EXPECTED_PACKAGE = 'com.goodone.marketplace';
const EXPECTED_RELATION = 'delegate_permission/common.handle_all_urls';
const PLACEHOLDER_PATTERN = /PASTE|REPLACE|TODO|EXAMPLE|PLACEHOLDER/i;

const fail = (message) => {
  console.error(`assetlinks.json validation failed: ${message}`);
  process.exit(1);
};

let data;

try {
  data = JSON.parse(fs.readFileSync(assetLinksPath, 'utf8'));
} catch (error) {
  fail(`unable to read or parse ${assetLinksPath}: ${error.message}`);
}

if (!Array.isArray(data)) {
  fail('top-level value must be an array');
}

if (data.length === 0) {
  fail('top-level array must contain at least one statement');
}

data.forEach((statement, index) => {
  const label = `statement ${index + 1}`;
  const relation = statement?.relation;
  const target = statement?.target;

  if (PLACEHOLDER_PATTERN.test(JSON.stringify(statement))) {
    fail(`${label} contains placeholder text`);
  }

  if (!Array.isArray(relation) || !relation.includes(EXPECTED_RELATION)) {
    fail(`${label} relation must include ${EXPECTED_RELATION}`);
  }

  if (target?.namespace !== 'android_app') {
    fail(`${label} target.namespace must be android_app`);
  }

  if (target?.package_name !== EXPECTED_PACKAGE) {
    fail(`${label} target.package_name must be ${EXPECTED_PACKAGE}`);
  }

  if (
    !Array.isArray(target?.sha256_cert_fingerprints) ||
    target.sha256_cert_fingerprints.length === 0 ||
    target.sha256_cert_fingerprints.some((fingerprint) => typeof fingerprint !== 'string' || !fingerprint.trim())
  ) {
    fail(`${label} target.sha256_cert_fingerprints must be a non-empty array`);
  }
});

console.log('assetlinks.json validation passed');
