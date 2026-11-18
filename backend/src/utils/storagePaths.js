const path = require('path');
const fs = require('fs');

const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === true || Boolean(process.env.VERCEL);
const storageDirEnv = process.env.STORAGE_DIR;

const bundledUploadsDir = path.join(__dirname, '../../storage/uploads');
const activeUploadsDir = storageDirEnv
  ? path.join(storageDirEnv, 'uploads')
  : (isVercel ? '/tmp/uploads' : bundledUploadsDir);

function ensureDir(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch (err) {
    console.warn(`[Storage] Could not create directory ${dirPath}:`, err.message);
  }
  return dirPath;
}

function getUploadsSubdir(sub) {
  return ensureDir(path.join(activeUploadsDir, sub));
}

function resolveUploadedFile(sub, filename, fallbackFilename = null) {
  if (filename) {
    const activeCandidate = path.join(activeUploadsDir, sub, filename);
    if (fs.existsSync(activeCandidate)) return activeCandidate;

    const bundledCandidate = path.join(bundledUploadsDir, sub, filename);
    if (fs.existsSync(bundledCandidate)) return bundledCandidate;
  }

  if (fallbackFilename) {
    const activeFallback = path.join(activeUploadsDir, sub, fallbackFilename);
    if (fs.existsSync(activeFallback)) return activeFallback;

    const bundledFallback = path.join(bundledUploadsDir, sub, fallbackFilename);
    if (fs.existsSync(bundledFallback)) return bundledFallback;
  }

  return null;
}

module.exports = {
  isVercel,
  bundledUploadsDir,
  activeUploadsDir,
  ensureDir,
  getUploadsSubdir,
  resolveUploadedFile
};
