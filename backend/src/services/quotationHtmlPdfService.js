const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const QRCode = require('qrcode');
const { numberToIndianWords, formatINR } = require('../utils/numberToWords');
const { resolveUploadedFile } = require('../utils/storagePaths');
const { formatToDMY } = require('../utils/dateHelper');
const { calculateQuotationFinancials } = require('../utils/quotationEngine');
const { resolveQuotationQrSource } = require('./qrService');

let cachedFontCss = null;
let pdfQueue = Promise.resolve();

function runQueued(task) {
  const next = pdfQueue.then(task, task);
  pdfQueue = next.catch(() => {});
  return next;
}

function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getEmbeddedNotoSansCss() {
  if (cachedFontCss !== null) return cachedFontCss;

  try {
    const pkgDir = path.dirname(require.resolve('@fontsource/noto-sans/package.json'));
    const filesDir = path.join(pkgDir, 'files');

    // Include both latin and devanagari subsets (devanagari contains Rupee glyph U+20B9)
    const specs = [
      { weight: 400, style: 'normal', file: 'noto-sans-latin-400-normal.woff2' },
      { weight: 400, style: 'normal', file: 'noto-sans-devanagari-400-normal.woff2' },
      { weight: 400, style: 'italic', file: 'noto-sans-latin-400-italic.woff2' },
      { weight: 400, style: 'italic', file: 'noto-sans-devanagari-400-italic.woff2' },
      { weight: 600, style: 'normal', file: 'noto-sans-latin-600-normal.woff2' },
      { weight: 600, style: 'normal', file: 'noto-sans-devanagari-600-normal.woff2' },
      { weight: 700, style: 'normal', file: 'noto-sans-latin-700-normal.woff2' },
      { weight: 700, style: 'normal', file: 'noto-sans-devanagari-700-normal.woff2' },
      { weight: 800, style: 'normal', file: 'noto-sans-latin-800-normal.woff2' },
      { weight: 800, style: 'normal', file: 'noto-sans-devanagari-800-normal.woff2' }
    ];

    const rules = [];
    for (const s of specs) {
      const fullPath = path.join(filesDir, s.file);
      if (fs.existsSync(fullPath)) {
        const b64 = fs.readFileSync(fullPath).toString('base64');
        rules.push(`@font-face {
  font-family: 'Noto Sans';
  font-style: ${s.style};
  font-weight: ${s.weight};
  font-display: swap;
  src: url(data:font/woff2;base64,${b64}) format('woff2');
}`);
      }
    }

    cachedFontCss = rules.join('\n');
  } catch (err) {
    console.warn('[PDF Font] Could not load @fontsource/noto-sans:', err.message);
    cachedFontCss = '';
  }

  return cachedFontCss;
}

function getLogoDataUrl(settings = {}) {
  if (
    settings.company_logo_data &&
    typeof settings.company_logo_data === 'string' &&
    settings.company_logo_data.startsWith('data:image')
  ) {
    return settings.company_logo_data;
  }

  const logoPath = resolveUploadedFile('logos', settings.company_logo, 'udhayam_logo.png');
  if (logoPath && fs.existsSync(logoPath)) {
    const ext = path.extname(logoPath).toLowerCase().replace('.', '') || 'png';
    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    const b64 = fs.readFileSync(logoPath).toString('base64');
    return `data:${mime};base64,${b64}`;
  }

  return '';
}

async function generateUpiQrDataUrl({ upiId, payeeName, grandTotal, quoteNo }) {
  const cleanUpi = String(upiId || '').trim();
  if (!cleanUpi) return '';

  const amountStr = Number(grandTotal || 0).toFixed(2);
  const cleanPayee = encodeURIComponent(String(payeeName || 'Udhayam Agencies').trim());
  const cleanQuote = encodeURIComponent(String(quoteNo || '').trim());

  const uri = `upi://pay?pa=${cleanUpi}&pn=${cleanPayee}&am=${amountStr}&tn=${cleanQuote}&cu=INR`;

  try {
    return await QRCode.toDataURL(uri, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 180,
      color: {
        dark: '#0B4A3A',
        light: '#FFFFFF'
      }
    });
  } catch (err) {
    console.warn('[PDF QR] Failed to generate QR code:', err.message);
    return '';
  }
}

async function resolveLaunchOptions() {
  const baseArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu'
  ];

  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH;
  if (envPath && fs.existsSync(envPath)) {
    return { headless: true, executablePath: envPath, args: baseArgs };
  }

  if (process.platform === 'linux') {
    const linuxSystemPaths = [
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable'
    ];
    for (const p of linuxSystemPaths) {
      if (fs.existsSync(p)) {
        return { headless: true, executablePath: p, args: baseArgs };
      }
    }

    try {
      const mod = await import('@sparticuz/chromium');
      const chromium = mod.default || mod;
      const sparticuzPath = await chromium.executablePath();
      if (sparticuzPath && fs.existsSync(sparticuzPath)) {
        return {
          headless: true,
          executablePath: sparticuzPath,
          args: [...chromium.args, '--disable-dev-shm-usage'],
          _sparticuzMod: mod
        };
      }
    } catch (err) {
      console.warn('[PDF Browser] @sparticuz/chromium unavailable:', err.message);
    }
  }

  try {
    const bundled = puppeteer.executablePath();
    if (bundled && typeof bundled === 'string' && fs.existsSync(bundled)) {
      return { headless: true, executablePath: bundled, args: baseArgs };
    }
  } catch (_) {}

  const winMacCandidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ];

  for (const p of winMacCandidates) {
    if (fs.existsSync(p)) {
      return { headless: true, executablePath: p, args: baseArgs };
    }
  }

  return { headless: true, args: baseArgs };
}

function buildQuotationHtml({ quotation, settings, financials, logoDataUrl, qrDataUrl, fontCss }) {
  const isA5 = quotation.paper_format === 'A5';

  const companyName = settings.company_name || 'UDHAYAM AGENCIES';
  const companyDivision = settings.company_division || 'PAINT DIVISION';
  const companyAddress = settings.company_address || '41/10, KMR Complex, Old Bus Stand Road, Perundurai, Erode - 638052';
  const companyPhone = settings.company_phone || '+91 97156 22499';
  const companyGstin = settings.company_gstin || '33AADFU6496M1ZJ';

  const quoteNo = quotation.quotation_number || 'UDQ-2026-0001';
  const quoteDate = formatToDMY(quotation.quotation_date) || formatToDMY(new Date());
  const validDate = formatToDMY(quotation.validity_date, quotation.quotation_date, 15);
  const termsText = (quotation.payment_terms || 'CASH').trim().toUpperCase();
  const isCredit = /credit/i.test(termsText);

  const custName = quotation.customer_name || 'Valued Customer';
  const custPhone = quotation.customer_phone && String(quotation.customer_phone).trim() !== '-'
    ? String(quotation.customer_phone).trim()
    : '';
  const custGstin = quotation.customer_gstin && String(quotation.customer_gstin).trim() !== '-'
    ? String(quotation.customer_gstin).trim()
    : '';
  const custAddress = quotation.customer_address && String(quotation.customer_address).trim() !== '-'
    ? String(quotation.customer_address).trim()
    : '';

  const bankAccName = settings.bank_account_name || 'Udhayam Agencies';
  const bankAccNo = settings.bank_account_no || '6659330152';
  const bankName = settings.bank_name || 'Indian Bank';
  let bankBranch = settings.bank_branch || 'Perundurai Branch';
  if (!bankBranch.toLowerCase().includes('branch')) bankBranch = `${bankBranch} Branch`;
  const bankIfsc = (settings.bank_ifsc || 'IDIB000P155').trim().replace(/^IFSC\s*(Code)?\s*[:\-]\s*/i, '');

  const rawNotes = (quotation.notes || '').trim();
  const useCustomNotes =
    rawNotes.length > 0 &&
    !/auto-generated|test_msg|^Optech Quote\s*#|^Converted from Optech/i.test(rawNotes);
  const defaultTermsLines = [
    '1. Quotation valid for 15 days from date of issue.',
    '2. Goods once sold will not be taken back or exchanged.',
    '3. 100% payment on delivery / as per agreed terms.',
    '4. Subject to Perundurai jurisdiction only.'
  ];
  const termsLines = useCustomNotes
    ? rawNotes.split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, 5)
    : defaultTermsLines;

  const items = financials.items || [];
  const taxSlabs = financials.taxSlabs || [];
  const amountInWords = financials.amountInWords || numberToIndianWords(financials.grandTotal);

  const itemRowsHtml = items.map((item, idx) => {
    const itemTaxRate = item.tax_percent != null && !isNaN(parseFloat(item.tax_percent))
      ? parseFloat(item.tax_percent)
      : (parseFloat(quotation.gst_rate) || 18);
    const specs = (item.details || '').trim();

    return `
      <tr class="${idx % 2 === 0 ? 'row-even' : 'row-odd'}">
        <td class="col-sno">${idx + 1}</td>
        <td class="col-desc">
          <div class="item-name">${escapeHtml(item.item_name || '')}</div>
          ${specs ? `<div class="item-specs">${escapeHtml(specs)}</div>` : ''}
        </td>
        <td class="col-hsn">${escapeHtml(item.hsn_sac || '-')}</td>
        <td class="col-qty">${escapeHtml(item.quantity ?? 1)}</td>
        <td class="col-unit">${escapeHtml(item.unit || 'Nos')}</td>
        <td class="col-rate">${Number(item.sale_rate || 0).toFixed(2)}</td>
        <td class="col-tax">${itemTaxRate}%</td>
        <td class="col-total">${Number(item.line_total || 0).toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  const slabRowsHtml = taxSlabs.length > 1
    ? taxSlabs.map(slab => `
      <tr class="slab-row">
        <td class="t-right">${escapeHtml(formatINR(slab.taxableValue, '₹'))}</td>
        <td class="t-center">${slab.isInterstate ? slab.igstPercent.toFixed(2) : slab.cgstPercent.toFixed(2)}%</td>
        <td class="t-right">${escapeHtml(formatINR(slab.isInterstate ? slab.igstAmount : slab.cgstAmount, '₹'))}</td>
        <td class="t-center">${slab.isInterstate ? 'INTER' : `${slab.sgstPercent.toFixed(2)}%`}</td>
        <td class="t-right">${slab.isInterstate ? 'STATE' : escapeHtml(formatINR(slab.sgstAmount, '₹'))}</td>
        <td class="t-right">${escapeHtml(formatINR(slab.totalTaxAmount, '₹'))}</td>
        <td class="t-right muted">—</td>
        <td class="t-right muted">—</td>
      </tr>
    `).join('')
    : '';

  const cgstPctLabel = taxSlabs.length === 1
    ? `${(financials.isInterstate ? taxSlabs[0].igstPercent : taxSlabs[0].cgstPercent).toFixed(2)}%`
    : 'TOTAL';
  const sgstPctLabel = taxSlabs.length === 1
    ? (financials.isInterstate ? 'INTER' : `${taxSlabs[0].sgstPercent.toFixed(2)}%`)
    : (financials.isInterstate ? 'STATE' : 'TOTAL');

  const pageMinHeight = isA5 ? '197mm' : '276mm';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Quotation ${escapeHtml(quoteNo)}</title>
<style>
${fontCss}

@page {
  size: ${isA5 ? 'A5 portrait' : 'A4 portrait'};
  margin: ${isA5 ? '6mm' : '10mm'};
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  font-family: 'Noto Sans', sans-serif;
  font-variant-numeric: tabular-nums;
  color: #0F172A;
  background: #FFFFFF;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  font-size: ${isA5 ? '8.5px' : '10px'};
  line-height: 1.35;
}

.page-shell {
  display: flex;
  flex-direction: column;
  min-height: ${pageMinHeight};
}

/* HEADER */
.header-wrap {
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
}

.header-main {
  background: #0B4A3A;
  color: #FFFFFF;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: ${isA5 ? '10px 12px' : '14px 16px'};
}

.header-left {
  display: flex;
  align-items: center;
  gap: ${isA5 ? '10px' : '13px'};
  min-width: 0;
  flex: 1;
}

.logo-box {
  width: ${isA5 ? '44px' : '58px'};
  height: ${isA5 ? '44px' : '58px'};
  background: #FFFFFF;
  border-radius: 8px;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.logo-box img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  display: block;
}

.company-info {
  min-width: 0;
}

.company-name {
  font-size: ${isA5 ? '14px' : '18px'};
  font-weight: 800;
  color: #FFFFFF;
  letter-spacing: 0.01em;
  line-height: 1.15;
}

.company-division {
  font-size: ${isA5 ? '8.5px' : '10px'};
  font-weight: 800;
  color: #84CC16;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-top: 2px;
}

.company-line {
  font-size: ${isA5 ? '8px' : '9.5px'};
  color: #E2E8F0;
  margin-top: 3px;
  line-height: 1.3;
}

.header-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
  flex-shrink: 0;
  gap: 2px;
}

.quote-pill {
  background: #7DBA00;
  color: #0B4A3A;
  font-weight: 800;
  font-size: ${isA5 ? '9px' : '11px'};
  letter-spacing: 0.08em;
  padding: ${isA5 ? '2px 10px' : '3px 14px'};
  border-radius: 5px;
  text-transform: uppercase;
  margin-bottom: 2px;
}

.meta-qno {
  font-size: ${isA5 ? '9.5px' : '11.5px'};
  font-weight: 700;
  color: #FFFFFF;
}

.meta-line {
  font-size: ${isA5 ? '8px' : '9.5px'};
  color: #E2E8F0;
}

.terms-badge {
  display: inline-block;
  margin-top: 2px;
  padding: 1.5px 8px;
  border-radius: 4px;
  font-size: ${isA5 ? '7.5px' : '8.5px'};
  font-weight: 800;
  letter-spacing: 0.04em;
  background: ${isCredit ? '#FEF3C7' : '#ECFCCB'};
  color: ${isCredit ? '#92400E' : '#0B4A3A'};
  border: 1px solid ${isCredit ? '#F59E0B' : '#84CC16'};
}

.header-lime-strip {
  height: ${isA5 ? '3px' : '4px'};
  background: #7DBA00;
}

/* CUSTOMER BLOCK */
.customer-box {
  margin-top: ${isA5 ? '6px' : '9px'};
  border: 1px solid #CBD5E1;
  border-radius: 8px;
  background: #F8FAFC;
  padding: ${isA5 ? '7px 10px' : '9px 13px'};
  flex-shrink: 0;
}

.customer-label {
  font-size: ${isA5 ? '7.5px' : '8.5px'};
  font-weight: 800;
  color: #0B4A3A;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.customer-name {
  font-size: ${isA5 ? '10.5px' : '12.5px'};
  font-weight: 800;
  color: #0F172A;
  margin-top: 2px;
}

.customer-meta {
  font-size: ${isA5 ? '8px' : '9.5px'};
  color: #475569;
  margin-top: 2px;
}

/* ITEMS TABLE */
.table-section {
  margin-top: ${isA5 ? '6px' : '9px'};
  flex: 1 0 auto;
  display: flex;
  flex-direction: column;
  border: 1px solid #CBD5E1;
  border-radius: 8px;
  overflow: hidden;
  background: #FFFFFF;
}

table.items-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

table.items-table thead {
  display: table-header-group;
}

table.items-table thead th {
  background: #0B4A3A;
  color: #FFFFFF;
  font-size: ${isA5 ? '7.5px' : '8.8px'};
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: ${isA5 ? '5px 4px' : '7px 6px'};
  border-right: 1px solid rgba(255, 255, 255, 0.16);
}

table.items-table thead th:last-child {
  border-right: none;
}

table.items-table tbody tr {
  break-inside: avoid;
  page-break-inside: avoid;
}

table.items-table tbody tr.row-even {
  background: #FFFFFF;
}

table.items-table tbody tr.row-odd {
  background: #F8FAFC;
}

table.items-table tbody td {
  padding: ${isA5 ? '5px 4px' : '6.5px 6px'};
  border-bottom: 1px solid #E2E8F0;
  border-right: 1px solid #E2E8F0;
  vertical-align: top;
  font-size: ${isA5 ? '8px' : '9.5px'};
}

table.items-table tbody td:last-child {
  border-right: none;
}

.col-sno {
  width: ${isA5 ? '22px' : '28px'};
  text-align: center;
  color: #64748B;
}

.col-desc {
  text-align: left;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.item-name {
  font-weight: 700;
  color: #0F172A;
  font-size: ${isA5 ? '8.2px' : '9.8px'};
  line-height: 1.3;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.item-specs {
  font-style: italic;
  color: #64748B;
  font-size: ${isA5 ? '7px' : '8.2px'};
  margin-top: 1.5px;
  line-height: 1.25;
  white-space: normal;
  word-break: break-word;
}

.col-hsn {
  width: ${isA5 ? '48px' : '62px'};
  text-align: center;
  color: #475569;
}

.col-qty {
  width: ${isA5 ? '30px' : '40px'};
  text-align: center;
  font-weight: 800;
  color: #0F172A;
}

.col-unit {
  width: ${isA5 ? '36px' : '48px'};
  text-align: center;
  color: #475569;
}

.col-rate {
  width: ${isA5 ? '54px' : '72px'};
  text-align: right;
  color: #0F172A;
}

.col-tax {
  width: ${isA5 ? '34px' : '46px'};
  text-align: center;
  font-weight: 700;
  color: #0F172A;
}

.col-total {
  width: ${isA5 ? '58px' : '78px'};
  text-align: right;
  font-weight: 700;
  color: #0F172A;
}

.th-left { text-align: left; }
.th-center { text-align: center; }
.th-right { text-align: right; }

/* BOTTOM SECTION (Totals + Footer anchored on last page) */
.bottom-section {
  margin-top: ${isA5 ? '7px' : '10px'};
  break-inside: avoid;
  page-break-inside: avoid;
  flex-shrink: 0;
}

/* TOTALS BAR */
.totals-card {
  border: 1px solid #CBD5E1;
  border-radius: 8px;
  overflow: hidden;
  background: #FFFFFF;
}

table.totals-table {
  width: 100%;
  border-collapse: collapse;
}

table.totals-table thead th {
  background: #0B4A3A;
  color: #FFFFFF;
  font-size: ${isA5 ? '7px' : '8.2px'};
  font-weight: 700;
  text-transform: uppercase;
  padding: ${isA5 ? '4px 4px' : '6px 6px'};
  border-right: 1px solid rgba(255, 255, 255, 0.16);
}

table.totals-table thead th:last-child {
  border-right: none;
}

table.totals-table thead th.grand-head {
  background: #7DBA00;
  color: #0B4A3A;
  font-weight: 800;
  width: ${isA5 ? '76px' : '104px'};
}

table.totals-table tbody td {
  padding: ${isA5 ? '4.5px 4px' : '6px 6px'};
  border-top: 1px solid #E2E8F0;
  border-right: 1px solid #E2E8F0;
  font-size: ${isA5 ? '7.8px' : '9.5px'};
  font-weight: 700;
  color: #0F172A;
}

table.totals-table tbody td:last-child {
  border-right: none;
}

table.totals-table tbody tr.slab-row td {
  background: #F8FAFC;
  font-weight: 600;
  font-size: ${isA5 ? '7.2px' : '8.5px'};
  padding: ${isA5 ? '3px 4px' : '4px 6px'};
}

table.totals-table tbody td.grand-cell {
  background: #ECFCCB;
  color: #0B4A3A;
  font-size: ${isA5 ? '9.5px' : '12px'};
  font-weight: 800;
}

.t-right { text-align: right; }
.t-center { text-align: center; }
.muted { color: #94A3B8; }

.words-bar {
  background: #F8FAFC;
  border-top: 1px solid #CBD5E1;
  padding: ${isA5 ? '4.5px 8px' : '6px 10px'};
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.words-text {
  font-size: ${isA5 ? '7.5px' : '9px'};
  color: #334155;
}

.words-text strong {
  color: #0F172A;
}

.words-value {
  font-style: italic;
}

.gst-badge {
  background: #DCFCE7;
  color: #166534;
  border: 1px solid #BBF7D0;
  font-size: ${isA5 ? '7px' : '8.2px'};
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
  flex-shrink: 0;
}

/* FOOTER 4 BOXES */
.footer-grid {
  margin-top: ${isA5 ? '6px' : '8px'};
  border: 1px solid #CBD5E1;
  border-radius: 8px;
  background: #F8FAFC;
  display: grid;
  grid-template-columns: 1.15fr 1.3fr 0.85fr 1.15fr;
  align-items: stretch;
}

.footer-box {
  padding: ${isA5 ? '7px 8px' : '10px 11px'};
  border-right: 1px solid #E2E8F0;
  display: flex;
  flex-direction: column;
}

.footer-box:last-child {
  border-right: none;
}

.box-title {
  font-size: ${isA5 ? '7.2px' : '8.5px'};
  font-weight: 800;
  color: #0B4A3A;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

.bank-name-bold {
  font-weight: 800;
  font-size: ${isA5 ? '8px' : '9.5px'};
  color: #0F172A;
}

.bank-acc {
  font-weight: 700;
  font-size: ${isA5 ? '7.8px' : '9.2px'};
  color: #0F172A;
  margin-top: 2px;
}

.bank-branch {
  font-size: ${isA5 ? '7.2px' : '8.5px'};
  color: #475569;
  margin-top: 2px;
}

.bank-ifsc {
  font-weight: 800;
  font-size: ${isA5 ? '7.5px' : '8.8px'};
  color: #0B4A3A;
  margin-top: 2px;
}

.terms-list {
  font-size: ${isA5 ? '6.8px' : '8px'};
  color: #475569;
  line-height: 1.4;
}

.terms-item + .terms-item {
  margin-top: 2px;
}

.qr-box {
  align-items: center;
  justify-content: center;
  text-align: center;
}

.qr-frame {
  background: #FFFFFF;
  border: 1px solid #CBD5E1;
  border-radius: 6px;
  padding: ${isA5 ? '3px' : '4px'};
  display: inline-block;
}

.qr-frame img {
  width: ${isA5 ? '64px' : '88px'};
  height: ${isA5 ? '64px' : '88px'};
  object-fit: contain;
  display: block;
}

.qr-caption {
  font-size: ${isA5 ? '6.5px' : '7.5px'};
  font-weight: 800;
  color: #0B4A3A;
  letter-spacing: 0.05em;
  margin-top: 3px;
}

.sign-box {
  justify-content: space-between;
  text-align: right;
}

.cust-accept-block {
  text-align: left;
  margin-bottom: 6px;
}

.sign-line {
  border-bottom: 1px dashed #94A3B8;
  height: ${isA5 ? '14px' : '18px'};
  width: 100%;
  margin-top: 2px;
}

.sign-sub {
  font-size: ${isA5 ? '6.8px' : '7.8px'};
  color: #64748B;
  font-weight: 600;
  margin-top: 2px;
}

.auth-block {
  margin-top: auto;
  text-align: right;
}

.for-company {
  font-size: ${isA5 ? '7.5px' : '8.8px'};
  font-weight: 800;
  color: #0B4A3A;
}

/* BOTTOM LINE */
.bottom-meta-line {
  margin-top: ${isA5 ? '5px' : '7px'};
  padding-top: 5px;
  border-top: 1px solid #CBD5E1;
  text-align: center;
  font-size: ${isA5 ? '7px' : '8.2px'};
  color: #64748B;
  line-height: 1.4;
}
</style>
</head>
<body>
  <div class="page-shell">
    <!-- HEADER (Page 1 only: Quote No, Date, Valid Till, Terms appear ONCE) -->
    <div class="header-wrap">
      <div class="header-main">
        <div class="header-left">
          ${logoDataUrl ? `<div class="logo-box"><img src="${logoDataUrl}" alt="Logo" /></div>` : ''}
          <div class="company-info">
            <div class="company-name">${escapeHtml(companyName)}</div>
            <div class="company-division">${escapeHtml(companyDivision)}</div>
            <div class="company-line">${escapeHtml(companyAddress)}</div>
            <div class="company-line">Phone: ${escapeHtml(companyPhone)} | GSTIN: ${escapeHtml(companyGstin)}</div>
          </div>
        </div>
        <div class="header-right">
          <div class="quote-pill">QUOTATION</div>
          <div class="meta-qno">Q. No.: ${escapeHtml(quoteNo)}</div>
          <div class="meta-line">Date: ${escapeHtml(quoteDate)}</div>
          <div class="meta-line">Valid Till: ${escapeHtml(validDate)}</div>
          <div class="terms-badge">TERMS: ${escapeHtml(termsText)}</div>
        </div>
      </div>
      <div class="header-lime-strip"></div>
    </div>

    <!-- CUSTOMER BLOCK (Full width, no duplicate Quote Meta) -->
    <div class="customer-box">
      <div class="customer-label">BILLED TO / CUSTOMER DETAILS:</div>
      <div class="customer-name">${escapeHtml(custName)}</div>
      ${(custPhone || custGstin) ? `
      <div class="customer-meta">
        ${custPhone ? `Phone: ${escapeHtml(custPhone)}` : ''}${custPhone && custGstin ? ' &nbsp;|&nbsp; ' : ''}${custGstin ? `GSTIN: ${escapeHtml(custGstin)}` : ''}
      </div>` : ''}
      ${custAddress ? `<div class="customer-meta">Address: ${escapeHtml(custAddress)}</div>` : ''}
    </div>

    <!-- ITEMS TABLE (Repeats thead automatically on Page 2+) -->
    <div class="table-section">
      <table class="items-table">
        <thead>
          <tr>
            <th class="th-center" style="width:${isA5 ? '22px' : '28px'}">#</th>
            <th class="th-left">ITEM DESCRIPTION &amp; SPECIFICATIONS</th>
            <th class="th-center" style="width:${isA5 ? '48px' : '62px'}">HSN</th>
            <th class="th-center" style="width:${isA5 ? '30px' : '40px'}">QTY</th>
            <th class="th-center" style="width:${isA5 ? '36px' : '48px'}">UNIT</th>
            <th class="th-right" style="width:${isA5 ? '54px' : '72px'}">RATE (₹)</th>
            <th class="th-center" style="width:${isA5 ? '34px' : '46px'}">TAX %</th>
            <th class="th-right" style="width:${isA5 ? '58px' : '78px'}">TOTAL (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${itemRowsHtml}
        </tbody>
      </table>
    </div>

    <!-- BOTTOM SECTION: TOTALS BAR + 4-BOX FOOTER + BOTTOM LINE -->
    <div class="bottom-section">
      <div class="totals-card">
        <table class="totals-table">
          <thead>
            <tr>
              <th class="th-right">TAXABLE VALUE</th>
              <th class="th-center">${financials.isInterstate ? 'IGST %' : 'CGST %'}</th>
              <th class="th-right">${financials.isInterstate ? 'IGST AMT' : 'CGST AMT'}</th>
              <th class="th-center">${financials.isInterstate ? 'STATE' : 'SGST %'}</th>
              <th class="th-right">${financials.isInterstate ? 'TYPE' : 'SGST AMT'}</th>
              <th class="th-right">TOTAL TAX</th>
              <th class="th-right">ROUND OFF</th>
              <th class="th-right grand-head">NET GRAND TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${slabRowsHtml}
            <tr>
              <td class="t-right">${escapeHtml(formatINR(financials.taxableValue, '₹'))}</td>
              <td class="t-center">${escapeHtml(cgstPctLabel)}</td>
              <td class="t-right">${escapeHtml(formatINR(financials.isInterstate ? financials.totalIgst : financials.totalCgst, '₹'))}</td>
              <td class="t-center">${escapeHtml(sgstPctLabel)}</td>
              <td class="t-right">${financials.isInterstate ? 'STATE' : escapeHtml(formatINR(financials.totalSgst, '₹'))}</td>
              <td class="t-right">${escapeHtml(formatINR(financials.totalTaxAmount, '₹'))}</td>
              <td class="t-right">${escapeHtml(formatINR(financials.roundedOff || 0, '₹'))}</td>
              <td class="t-right grand-cell">${escapeHtml(formatINR(financials.grandTotal, '₹'))}</td>
            </tr>
          </tbody>
        </table>
        <div class="words-bar">
          <div class="words-text">
            <strong>Amount in Words:</strong> <span class="words-value">${escapeHtml(amountInWords)}</span>
          </div>
          <div class="gst-badge">${financials.isInterstate ? 'IGST Applicable' : 'GST Applicable'}</div>
        </div>
      </div>

      <div class="footer-grid">
        <div class="footer-box">
          <div class="box-title">BANK DETAILS:</div>
          <div class="bank-name-bold">${escapeHtml(bankAccName)}</div>
          <div class="bank-acc">Acc Number: ${escapeHtml(bankAccNo)}</div>
          <div class="bank-branch">${escapeHtml(bankName)} - ${escapeHtml(bankBranch)}</div>
          <div class="bank-ifsc">IFSC: ${escapeHtml(bankIfsc)}</div>
        </div>

        <div class="footer-box">
          <div class="box-title">TERMS &amp; CONDITIONS:</div>
          <div class="terms-list">
            ${termsLines.map(line => `<div class="terms-item">${escapeHtml(line)}</div>`).join('')}
          </div>
        </div>

        <div class="footer-box qr-box">
          ${qrDataUrl ? `
          <div class="qr-frame">
            <img src="${qrDataUrl}" alt="UPI QR" />
          </div>
          <div class="qr-caption">SCAN TO PAY UPI</div>` : ''}
        </div>

        <div class="footer-box sign-box">
          <div class="cust-accept-block">
            <div class="box-title" style="margin-bottom:0;">CUSTOMER ACCEPTANCE</div>
            <div class="sign-line"></div>
            <div class="sign-sub">Signature / Seal</div>
          </div>
          <div class="auth-block">
            <div class="for-company">For ${escapeHtml(companyName)}</div>
            <div class="sign-line"></div>
            <div class="sign-sub">Authorised Signatory</div>
          </div>
        </div>
      </div>

      <div class="bottom-meta-line">
        <div>Computer-generated quotation valid without physical signature.</div>
        <div>${escapeHtml(companyName)} &bull; ${escapeHtml(companyAddress)} &bull; Phone: ${escapeHtml(companyPhone)} &bull; GSTIN: ${escapeHtml(companyGstin)}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function generateQuotationPdf(quotation, settings = {}, res = null) {
  const isTaxInclusive = quotation.is_tax_inclusive === undefined || quotation.is_tax_inclusive === null
    ? true
    : (quotation.is_tax_inclusive === 1 || quotation.is_tax_inclusive === true || quotation.is_tax_inclusive === '1' || quotation.is_tax_inclusive === 'true');

  const financials = calculateQuotationFinancials({
    items: quotation.items || [],
    discount_percent: quotation.discount_percent,
    discount_amount: quotation.discount_amount,
    discount_mode: quotation.discount_mode || 'percent',
    is_tax_inclusive: isTaxInclusive,
    default_gst_rate: quotation.gst_rate || settings.default_gst_rate || 18,
    delivery_charges: quotation.delivery_charges || 0,
    company_state_code: settings.company_state_code || '33',
    customer_gstin: quotation.customer_gstin || '',
    customer_state_code: quotation.customer_state_code || ''
  });

  const upiId = quotation.upi_id || settings.upi_id || process.env.UPI_ID || 'paytmqr6vc6b5@ptys';
  const payeeName = settings.bank_account_name || 'Udhayam Agencies';
  const quoteNo = quotation.quotation_number || 'UDQ-2026-0001';

  let qrDataUrl = '';
  try {
    const officialQrBuffer = await resolveQuotationQrSource(
      { ...quotation, grand_total: financials.grandTotal, upi_id: upiId },
      settings
    );
    if (officialQrBuffer && Buffer.isBuffer(officialQrBuffer) && officialQrBuffer.length > 0) {
      qrDataUrl = `data:image/png;base64,${officialQrBuffer.toString('base64')}`;
    }
  } catch (err) {
    console.warn('[PDF QR] Official QR resolution failed:', err.message);
  }

  if (!qrDataUrl) {
    qrDataUrl = await generateUpiQrDataUrl({
      upiId,
      payeeName,
      grandTotal: financials.grandTotal,
      quoteNo
    });
  }

  const logoDataUrl = getLogoDataUrl(settings);
  const fontCss = getEmbeddedNotoSansCss();
  const html = buildQuotationHtml({
    quotation,
    settings,
    financials,
    logoDataUrl,
    qrDataUrl,
    fontCss
  });

  const isA5 = quotation.paper_format === 'A5';
  const launchOptions = await resolveLaunchOptions();

  const pdfBuffer = await runQueued(async () => {
    let browser;
    try {
      const { _sparticuzMod, ...puppeteerOpts } = launchOptions;
      try {
        browser = await puppeteer.launch({
          ...puppeteerOpts,
          timeout: 30000
        });
      } catch (launchErr) {
        if (
          process.platform === 'linux' &&
          _sparticuzMod &&
          /shared libraries|libnss3|libatk|libgbm|libasound|cannot open shared object/i.test(launchErr.message || '')
        ) {
          const os = require('os');
          const { setupLambdaEnvironment, inflate } = _sparticuzMod;
          const pkgRoot = path.resolve(path.dirname(require.resolve('@sparticuz/chromium')), '..');
          const al2023Archive = path.join(pkgRoot, 'bin', 'al2023.tar.br');
          if (typeof setupLambdaEnvironment === 'function' && typeof inflate === 'function' && fs.existsSync(al2023Archive)) {
            setupLambdaEnvironment(path.join(os.tmpdir(), 'al2023', 'lib'));
            await inflate(al2023Archive);
            browser = await puppeteer.launch({
              ...puppeteerOpts,
              timeout: 30000
            });
          } else {
            throw launchErr;
          }
        } else {
          throw launchErr;
        }
      }

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.evaluate(async () => {
        await document.fonts.ready;
        const imgs = Array.from(document.images || []);
        await Promise.all(imgs.map(img => (
          img.complete
            ? Promise.resolve()
            : new Promise(resolve => {
                img.addEventListener('load', resolve, { once: true });
                img.addEventListener('error', resolve, { once: true });
              })
        )));
      });

      const pdfUint8 = await page.pdf({
        format: isA5 ? 'A5' : 'A4',
        landscape: false,
        printBackground: true,
        preferCSSPageSize: true,
        margin: isA5
          ? { top: '6mm', right: '6mm', bottom: '6mm', left: '6mm' }
          : { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
      });

      return Buffer.from(pdfUint8);
    } finally {
      if (browser) {
        await Promise.race([
          browser.close().catch(() => {}),
          new Promise(resolve => setTimeout(resolve, 3000))
        ]);
      }
    }
  });

  if (res && typeof res.end === 'function') {
    if (typeof res.setHeader === 'function' && !res.headersSent) {
      res.setHeader('Content-Type', 'application/pdf');
    }
    res.end(pdfBuffer);
  }

  return pdfBuffer;
}

module.exports = {
  generateQuotationPdf,
  buildQuotationHtml,
  generateUpiQrDataUrl
};
