const path = require('path');
const fs = require('fs');

// Resolve archiver using module resolution from Client
const archiverPkg = require(path.join(__dirname, '../Client/node_modules/archiver'));
const archiver = typeof archiverPkg === 'function' ? archiverPkg : (archiverPkg.default || archiverPkg);

const zipPath = path.join(__dirname, '../backend_cpanel.zip');

// Delete existing archive if present
if (fs.existsSync(zipPath)) {
  try {
    fs.unlinkSync(zipPath);
  } catch (e) {
    console.log('Replacing existing backend zip archive...');
  }
}

const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', { zlib: { level: 6 } });

output.on('close', () => {
  const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
  console.log(`✅ SUCCESS: backend_cpanel.zip created successfully at root! Total Size: ${sizeMB} MB`);
  process.exit(0);
});

archive.on('error', (err) => {
  console.error('❌ Error during zipping:', err);
  process.exit(1);
});

archive.pipe(output);

// Add dist directory
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  archive.directory(distDir, 'dist');
} else {
  console.error('❌ Error: dist/ directory does not exist! Please run npm run build first.');
  process.exit(1);
}

// Root files required for cPanel Phusion Passenger Node.js environment
const files = [
  'server.js',
  '.env',
  'package.json',
  'package-lock.json',
];

for (const file of files) {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    archive.file(filePath, { name: file });
  }
}

console.log('Finalizing backend archive...');
archive.finalize();
