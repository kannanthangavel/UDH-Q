const { join } = require('path');

/**
 * Configure Puppeteer cache inside backend/.cache/puppeteer so Render builds
 * preserve the downloaded Chromium binary between build and runtime.
 */
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
