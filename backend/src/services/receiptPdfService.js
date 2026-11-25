const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { resolveUploadedFile } = require('../utils/storagePaths');
const { formatToDMY } = require('../utils/dateHelper');

// Corporate Executive Color Palette (Strictly Matching Attachment 1)
const COLOR_TEAL = '#004D40';        // Deep Corporate Spruce Teal
const COLOR_TEAL_DARK = '#00332C';   // Rich dark teal for card headers
const COLOR_LIME = '#7DBA00';        // Corporate lime green accent
const COLOR_TEXT = '#0F172A';        // Slate 900
const COLOR_MUTED = '#475569';       // Slate 600
const COLOR_LIGHT_MUTED = '#64748B'; // Slate 500
const COLOR_BORDER = '#CBD5E1';      // Slate 300
const COLOR_BG_LIGHT = '#F8FAFC';    // Slate 50
const COLOR_BG_GREEN = '#ECFDF5';    // Light Emerald Background
const COLOR_BORDER_GREEN = '#10B981';// Emerald Border
const COLOR_BG_AMBER = '#FFFBEB';    // Light Amber Background
const COLOR_BORDER_AMBER = '#F59E0B';// Amber Border

function getLogoSource(settings = {}) {
  if (settings.company_logo_data && typeof settings.company_logo_data === 'string' && settings.company_logo_data.startsWith('data:image')) {
    try {
      const base64Data = settings.company_logo_data.replace(/^data:image\/\w+;base64,/, '');
      return Buffer.from(base64Data, 'base64');
    } catch (e) {
      console.warn('Buffer conversion failed for company_logo_data:', e.message);
    }
  }
  return resolveUploadedFile('logos', settings.company_logo, 'udhayam_logo.png');
}

function getQrSource(settings = {}) {
  if (settings.payment_qr_code_data && typeof settings.payment_qr_code_data === 'string' && settings.payment_qr_code_data.startsWith('data:image')) {
    try {
      const base64Data = settings.payment_qr_code_data.replace(/^data:image\/\w+;base64,/, '');
      return Buffer.from(base64Data, 'base64');
    } catch (e) {
      console.warn('Buffer conversion failed for payment_qr_code_data:', e.message);
    }
  }
  return resolveUploadedFile('qr', settings.payment_qr_code, 'default_upi_qr.png');
}

function numberToIndianWords(num) {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const n = Math.floor(Math.abs(num));
  if (n === 0) return 'Rupees Zero Only';

  function inWords(n) {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : ' ');
    if (n < 1000) return inWords(Math.floor(n / 100)) + 'Hundred ' + (n % 100 !== 0 ? 'and ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + 'Thousand ' + (n % 1000 !== 0 ? 'and ' + inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + 'Lakh ' + (n % 100000 !== 0 ? 'and ' + inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + 'Crore ' + (n % 10000000 !== 0 ? 'and ' + inWords(n % 10000000) : '');
  }

  return 'Rupees ' + inWords(n).trim() + ' Only';
}

/**
 * Generate Customer Payment Receipt PDF in A4 or A5 layout
 * Strictly matching User Attachment 1 corporate design
 */
function generateReceiptPdf(receipt, settings = {}, res = null) {
  const isA5 = receipt.paper_format === 'A5';

  const doc = new PDFDocument({
    size: isA5 ? 'A5' : 'A4',
    margins: {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0
    },
    bufferPages: true,
    info: {
      Title: `Official Payment Receipt ${receipt.receipt_number} - ${settings.company_name || 'Udhayam Agencies'}`,
      Author: settings.company_name || 'UDHAYAM AGENCIES',
      Subject: `Payment Receipt ${receipt.receipt_number}`
    }
  });

  const streamPromise = new Promise((resolve, reject) => {
    if (res) {
      doc.pipe(res);
      doc.on('end', resolve);
      doc.on('error', reject);
    } else {
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    }
  });

  const margin = isA5 ? 16 : 26;
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const contentWidth = pageWidth - margin * 2;
  const logoSource = getLogoSource(settings);
  const qrSource = getQrSource(settings);

  const R_CARD = isA5 ? 5 : 7;
  const R_SM = isA5 ? 4 : 5;

  let curY = margin;

  // ==========================================
  // 1. TOP HEADER BANNER (Matching Attachment 1)
  // ==========================================
  const headerHeight = isA5 ? 52 : 72;
  doc.roundedRect(margin, curY, contentWidth, headerHeight, R_CARD).fill(COLOR_TEAL);

  // Bottom Lime accent strip
  const accentHeight = isA5 ? 2.5 : 3.5;
  doc.roundedRect(margin, curY + headerHeight - accentHeight, contentWidth, accentHeight, 1).fill(COLOR_LIME);

  // Logo in clean rounded white square container
  let textLeft = margin + (isA5 ? 6 : 10);
  if (logoSource) {
    try {
      const logoBoxW = isA5 ? 46 : 60;
      const logoBoxH = isA5 ? 46 : 60;
      const pad = isA5 ? 3 : 4;
      const boxX = margin + (isA5 ? 4 : 5);
      const boxY = curY + (isA5 ? 3 : 5);

      doc.roundedRect(boxX, boxY, logoBoxW, logoBoxH, R_SM).fill('#FFFFFF');
      doc.image(logoSource, boxX + pad, boxY + pad, {
        fit: [logoBoxW - pad * 2, logoBoxH - pad * 2],
        align: 'center',
        valign: 'center'
      });
      textLeft = boxX + logoBoxW + (isA5 ? 8 : 12);
    } catch (e) {
      console.warn('Logo render error:', e.message);
    }
  }

  // Company Details
  doc.fillColor('#FFFFFF')
     .font('Helvetica-Bold')
     .fontSize(isA5 ? 12 : 16)
     .text(settings.company_name || 'UDHAYAM AGENCIES', textLeft, curY + (isA5 ? 6 : 8));

  doc.font('Helvetica-Bold')
     .fontSize(isA5 ? 6.5 : 8.5)
     .fillColor(COLOR_LIME)
     .text((settings.company_division || 'Paint Division').toUpperCase(), textLeft, curY + (isA5 ? 17 : 24));

  doc.font('Helvetica')
     .fontSize(isA5 ? 5.5 : 7.2)
     .fillColor('#E2E8F0')
     .text(settings.company_address || '41/10, KMR Complex, Old Bus Stand Road, Perundurai, Erode - 638052', textLeft, curY + (isA5 ? 25 : 35), { width: contentWidth - (textLeft - margin) - (isA5 ? 85 : 125) })
     .text(`Phone: ${settings.company_phone || '+91 97156 22499'} | GSTIN: ${settings.company_gstin || '33AADFU6496M1ZJ'}`, textLeft, curY + (isA5 ? 35 : 47));

  // Top-Right Header Card: White Box with PAYMENT RECEIPT, Receipt No & Date
  const receiptBoxW = isA5 ? 88 : 120;
  const receiptBoxH = isA5 ? 38 : 50;
  const receiptBoxX = margin + contentWidth - receiptBoxW - (isA5 ? 5 : 7);
  const receiptBoxY = curY + (isA5 ? 5 : 7);

  doc.roundedRect(receiptBoxX, receiptBoxY, receiptBoxW, receiptBoxH, R_SM).fill('#FFFFFF');
  doc.fillColor(COLOR_TEAL)
     .font('Helvetica-Bold')
     .fontSize(isA5 ? 7.5 : 9.5)
     .text('PAYMENT RECEIPT', receiptBoxX, receiptBoxY + (isA5 ? 5 : 7), { width: receiptBoxW, align: 'center' });

  doc.fillColor(COLOR_TEXT)
     .font('Helvetica-Bold')
     .fontSize(isA5 ? 6.8 : 8.5)
     .text(receipt.receipt_number || 'UDR-2026-000001', receiptBoxX, receiptBoxY + (isA5 ? 17 : 22), { width: receiptBoxW, align: 'center' });

  doc.fillColor(COLOR_MUTED)
     .font('Helvetica')
     .fontSize(isA5 ? 6 : 7.5)
     .text(formatToDMY(receipt.payment_date) || formatToDMY(new Date()), receiptBoxX, receiptBoxY + (isA5 ? 26 : 34), { width: receiptBoxW, align: 'center' });

  curY += headerHeight + (isA5 ? 8 : 14);

  // =========================================================================
  // 2. ROW 1: TWO CARDS SIDE BY SIDE (RECEIVED WITH THANKS FROM | SETTLEMENT DETAILS)
  // =========================================================================
  const cardGap = isA5 ? 8 : 14;
  const colW = (contentWidth - cardGap) / 2;
  const r1H = isA5 ? 68 : 86;
  const cardHeadH = isA5 ? 15 : 19;

  // --- Left Card: RECEIVED WITH THANKS FROM ---
  doc.roundedRect(margin, curY, colW, r1H, R_CARD).fillAndStroke('#FFFFFF', COLOR_BORDER);
  // Header bar with dark teal background
  doc.roundedRect(margin, curY, colW, cardHeadH, R_CARD).fill(COLOR_TEAL_DARK);
  // Straighten bottom corners of header bar
  doc.rect(margin, curY + cardHeadH - 4, colW, 4).fill(COLOR_TEAL_DARK);

  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(isA5 ? 6.5 : 7.8)
     .text('RECEIVED WITH THANKS FROM', margin + 10, curY + (isA5 ? 4 : 5));

  // Left Card Body
  const r1BodyY = curY + cardHeadH + (isA5 ? 7 : 9);
  doc.fillColor(COLOR_TEXT).font('Helvetica-Bold').fontSize(isA5 ? 10 : 13)
     .text(receipt.customer_name || 'Customer Name', margin + 10, r1BodyY);

  doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(isA5 ? 6.5 : 8)
     .text(`Contact: ${receipt.customer_phone || 'N/A'}`, margin + 10, r1BodyY + (isA5 ? 14 : 18))
     .text(`Address: ${receipt.customer_address || 'Local Customer'}`, margin + 10, r1BodyY + (isA5 ? 26 : 33), { width: colW - 20, height: isA5 ? 16 : 22 });

  // --- Right Card: SETTLEMENT DETAILS ---
  const col2X = margin + colW + cardGap;
  doc.roundedRect(col2X, curY, colW, r1H, R_CARD).fillAndStroke('#FFFFFF', COLOR_BORDER);
  // Header bar with dark teal background
  doc.roundedRect(col2X, curY, colW, cardHeadH, R_CARD).fill(COLOR_TEAL_DARK);
  doc.rect(col2X, curY + cardHeadH - 4, colW, 4).fill(COLOR_TEAL_DARK);

  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(isA5 ? 6.5 : 7.8)
     .text('SETTLEMENT DETAILS', col2X + 10, curY + (isA5 ? 4 : 5));

  // Right Card Body
  const sLabelW = isA5 ? 65 : 85;
  const sValX = col2X + sLabelW + 10;
  const sValW = colW - sLabelW - 20;
  let sy = curY + cardHeadH + (isA5 ? 7 : 9);
  const sStep = isA5 ? 12 : 16;

  doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(isA5 ? 6.5 : 8)
     .text('Bill / Invoice No:', col2X + 10, sy);
  doc.fillColor(COLOR_TEXT).font('Helvetica-Bold').fontSize(isA5 ? 6.8 : 8.5)
     .text(receipt.bill_no || 'Direct Settlement', sValX, sy, { width: sValW });

  sy += sStep;
  doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(isA5 ? 6.5 : 8)
     .text('Payment Mode:', col2X + 10, sy);
  doc.fillColor(COLOR_TEAL).font('Helvetica-Bold').fontSize(isA5 ? 6.8 : 8.5)
     .text((receipt.payment_mode || 'Cash').toUpperCase(), sValX, sy, { width: sValW });

  sy += sStep;
  doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(isA5 ? 6.5 : 8)
     .text('Ref / Txn ID:', col2X + 10, sy);
  doc.fillColor(COLOR_TEXT).font('Helvetica').fontSize(isA5 ? 6.5 : 8)
     .text(receipt.reference_no || 'Direct Clearance', sValX, sy, { width: sValW });

  curY += r1H + (isA5 ? 8 : 14);

  // =========================================================================
  // 3. ROW 2: TWO PROMINENT CARDS (AMOUNT RECEIVED | OUTSTANDING BALANCE)
  // =========================================================================
  const r2H = isA5 ? 64 : 80;
  const paidVal = parseFloat(receipt.amount_paid) || 0;
  const balVal = parseFloat(receipt.balance_amount) || 0;

  // --- Left Card: AMOUNT RECEIVED ---
  doc.roundedRect(margin, curY, colW, r2H, R_CARD).fillAndStroke(COLOR_BG_GREEN, COLOR_BORDER_GREEN);

  doc.fillColor(COLOR_TEAL).font('Helvetica-Bold').fontSize(isA5 ? 7 : 9)
     .text('AMOUNT RECEIVED', margin + 12, curY + (isA5 ? 8 : 10));

  doc.fillColor(COLOR_TEAL).font('Helvetica-Bold').fontSize(isA5 ? 16 : 22)
     .text(`Rs. ${paidVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, margin + 12, curY + (isA5 ? 20 : 25));

  const words = numberToIndianWords(paidVal);
  doc.fillColor('#059669').font('Helvetica-Oblique').fontSize(isA5 ? 6.5 : 8.2)
     .text(words, margin + 12, curY + (isA5 ? 44 : 56), { width: colW - 24, height: isA5 ? 16 : 20 });

  // --- Right Card: OUTSTANDING BALANCE ---
  doc.roundedRect(col2X, curY, colW, r2H, R_CARD).fillAndStroke(COLOR_BG_AMBER, COLOR_BORDER_AMBER);

  doc.fillColor('#92400E').font('Helvetica-Bold').fontSize(isA5 ? 7 : 9)
     .text('OUTSTANDING BALANCE', col2X + 12, curY + (isA5 ? 8 : 10));

  doc.fillColor('#B45309').font('Helvetica-Bold').fontSize(isA5 ? 16 : 22)
     .text(`Rs. ${balVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, col2X + 12, curY + (isA5 ? 20 : 25));

  const balSubtitle = balVal > 0 ? 'Pending bill settlement' : 'All bill dues fully cleared';
  doc.fillColor('#D97706').font('Helvetica').fontSize(isA5 ? 6.5 : 8.2)
     .text(balSubtitle, col2X + 12, curY + (isA5 ? 44 : 56));

  curY += r2H + (isA5 ? 8 : 14);

  // =========================================================================
  // 4. ROW 3: WARM MESSAGE FROM UDHAYAM AGENCIES (FULL WIDTH CARD)
  // =========================================================================
  const r3H = isA5 ? 36 : 46;
  doc.roundedRect(margin, curY, contentWidth, r3H, R_CARD).fillAndStroke('#FFFFFF', COLOR_BORDER);

  doc.fillColor(COLOR_TEAL).font('Helvetica-Bold').fontSize(isA5 ? 6.8 : 8)
     .text(`WARM MESSAGE FROM ${settings.company_name || 'UDHAYAM AGENCIES'}`, margin + 12, curY + (isA5 ? 6 : 8));

  const warmMsg = (receipt.notes && receipt.notes.trim().length > 0 && !/auto-generated/i.test(receipt.notes))
    ? receipt.notes
    : 'Thank you for your prompt payment! We sincerely appreciate your business.';

  doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(isA5 ? 6.5 : 8)
     .text(warmMsg, margin + 12, curY + (isA5 ? 18 : 23), { width: contentWidth - 24 });

  curY += r3H + (isA5 ? 8 : 14);

  // =========================================================================
  // 5. ROW 4: BOTTOM 3-PART CARD (BANK DETAILS | UPI QR CODE | SIGNATURES)
  // =========================================================================
  const r4H = isA5 ? 84 : 104;
  doc.roundedRect(margin, curY, contentWidth, r4H, R_CARD).fillAndStroke('#FFFFFF', COLOR_BORDER);

  // Left Section: BANK TRANSFER DETAILS (Width: 38%)
  const bCol1W = contentWidth * 0.38;
  doc.fillColor(COLOR_TEAL).font('Helvetica-Bold').fontSize(isA5 ? 6.8 : 8)
     .text('BANK TRANSFER DETAILS', margin + 10, curY + (isA5 ? 7 : 9));

  let by = curY + (isA5 ? 18 : 23);
  const bStep = isA5 ? 10.5 : 13;
  const bankAccountName = settings.bank_account_name || 'Udhayam Agencies';
  const bankAccNo = settings.bank_account_no || '6659-3301-52';
  const bankName = settings.bank_name || 'Indian Bank';
  const bankBranch = settings.bank_branch ? (settings.bank_branch.toLowerCase().includes('branch') ? settings.bank_branch : `${settings.bank_branch} Branch`) : 'Perundurai Branch';
  const bankIfsc = settings.bank_ifsc ? settings.bank_ifsc.replace(/^IFSC\s*-\s*/i, '') : 'IDIB000P034';
  const upiId = settings.upi_id || 'paytmqr6vc6b5@ptys';

  doc.fillColor(COLOR_TEXT).font('Helvetica').fontSize(isA5 ? 6.2 : 7.8)
     .text(`Bank: ${bankName}`, margin + 10, by);
  by += bStep;
  doc.text(`A/C: ${bankAccNo}`, margin + 10, by);
  by += bStep;
  doc.text(`IFSC: ${bankIfsc}`, margin + 10, by);
  by += bStep;
  doc.text(`Branch: ${bankBranch}`, margin + 10, by);
  by += bStep;
  doc.text(`UPI: ${upiId}`, margin + 10, by);

  // Vertical Divider 1
  const vDiv1X = margin + bCol1W;
  doc.moveTo(vDiv1X, curY + 6).lineTo(vDiv1X, curY + r4H - 6).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();

  // Center Section: SCAN TO PAY UPI QR CODE (Width: 26%)
  const bCol2W = contentWidth * 0.26;
  const qrCenterX = vDiv1X + bCol2W / 2;
  const qrSize = isA5 ? 44 : 56;
  const qrX = qrCenterX - qrSize / 2;
  const qrY = curY + (isA5 ? 8 : 10);

  if (qrSource) {
    try {
      doc.image(qrSource, qrX, qrY, { fit: [qrSize, qrSize], align: 'center', valign: 'center' });
    } catch (e) {
      console.warn('Receipt QR render error:', e.message);
    }
  }

  doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(isA5 ? 4.5 : 5.8)
     .text(`UPI ID: ${upiId}`, vDiv1X + 5, qrY + qrSize + (isA5 ? 2 : 3), { width: bCol2W - 10, align: 'center' });

  doc.fillColor(COLOR_TEAL).font('Helvetica-Bold').fontSize(isA5 ? 5.5 : 7)
     .text('SCAN TO PAY UPI', vDiv1X + 5, qrY + qrSize + (isA5 ? 10 : 13), { width: bCol2W - 10, align: 'center' });

  // Vertical Divider 2
  const vDiv2X = vDiv1X + bCol2W;
  doc.moveTo(vDiv2X, curY + 6).lineTo(vDiv2X, curY + r4H - 6).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();

  // Right Section: SIGNATURES (Width: 36%)
  const bCol3W = contentWidth - bCol1W - bCol2W;
  const rightX = vDiv2X + 10;
  const rightW = bCol3W - 20;

  // Top Right: Customer Signature
  doc.fillColor(COLOR_TEXT).font('Helvetica-Bold').fontSize(isA5 ? 6.5 : 7.8)
     .text('Customer Signature', rightX, curY + (isA5 ? 7 : 9));

  // Bottom Right: For UDHAYAM AGENCIES / Authorised Signatory
  doc.fillColor(COLOR_TEAL).font('Helvetica-Bold').fontSize(isA5 ? 7 : 8.5)
     .text(`For ${settings.company_name || 'UDHAYAM AGENCIES'}`, rightX, curY + r4H - (isA5 ? 26 : 32), { width: rightW, align: 'right' });

  doc.fillColor(COLOR_MUTED).font('Helvetica-Oblique').fontSize(isA5 ? 6 : 7.2)
     .text('Authorised Signatory', rightX, curY + r4H - (isA5 ? 12 : 15), { width: rightW, align: 'right' });

  // End Document (Guaranteed single page fit!)
  doc.end();
  return streamPromise;
}

module.exports = {
  generateReceiptPdf,
  numberToIndianWords
};
