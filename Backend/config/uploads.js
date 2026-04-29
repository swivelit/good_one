const fs = require('fs');
const path = require('path');

const uploadsDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

fs.mkdirSync(uploadsDir, { recursive: true });

module.exports = { uploadsDir };
