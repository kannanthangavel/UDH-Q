const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { resolveUploadedFile } = require('../utils/storagePaths');

const COLOR_TEAL = '#00545C';
const COLOR_TEAL_DARK = '#003B40';
const COLOR_LIME = '#7DBA00';
const COLOR_TEXT = '#1E293B';
const COLOR_MUTED = '#64748B';
const COLOR_BORDER = '#CBD5E1';
const COLOR_LIGHT_BG = '#F8FAFC';

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
    if (n < 100000) return inWords(Math.floor(n / 1000)) + 'Thousand ' + (n % 1000 !== 0 ? inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + 'Lakh ' + (n % 100000 !== 0 ? inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + 'Crore ' + (n % 10000000 !== 0 ? inWords(n % 10000000) : '');
  }

  return 'Rupees ' + inWords(n).trim() + ' Only';
}

function generateReceiptPdf(receipt, settings = {}, res = null) {
  const isA5 = receipt.paper_format === 'A5';

  const doc = new PDFDocument({
    size: isA5 ? 'A5' : 'A4',
    margins: {
      top: isA5 ? 18 : 28,
      bottom: isA5 ? 18 : 26,
      left: isA5 ? 18 : 28,
      right: isA5 ? 18 : 28
    },
    bufferPages: true,
    info: {
      Title: `Receipt ${receipt.receipt_number} - ${settings.company_name || 'Udhayam Agencies'}`,
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

  const margin = isA5 ? 16 : 28;
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const contentWidth = pageWidth - margin * 2;
  const logoSource = getLogoSource(settings);

  const R_CARD = isA5 ? 6 : 8;
  const R_SM = isA5 ? 4 : 5;

  // Header Banner
  const headerHeight = isA5 ? 54 : 76;
  doc.roundedRect(margin, margin, contentWidth, headerHeight, R_CARD).fill(COLOR_TEAL);

  // Lime accent strip
  const accentHeight = isA5 ? 2.5 : 3.5;
  doc.roundedRect(margin, margin + headerHeight - accentHeight, contentWidth, accentHeight, 1).fill(COLOR_LIME);

  // Logo square
  let textLeft = margin + (isA5 ? 6 : 10);
  if (logoSource) {
    try {
      const logoBoxW = isA5 ? 46 : 64;
      const logoBoxH = isA5 ? 46 : 64;
      const pad = isA5 ? 3 : 4;
      const boxX = margin + (isA5 ? 4 : 6);
      const boxY = margin + (isA5 ? 4 : 6);
      doc.roundedRect(boxX, boxY, logoBoxW, logoBoxH, R_SM).fill('#FFFFFF');
      doc.image(logoSource, boxX + pad, boxY + pad, {
        fit: [logoBoxW - pad * 2, logoBoxH - pad * 2],
        align: 'center',
        valign: 'center'
      });
      textLeft = margin + logoBoxW + (isA5 ? 9 : 14);
    } catch (e) {
      console.warn('Logo render error:', e.message);
    }
  }

  // Company Details
  doc.fillColor('#FFFFFF')
     .font('Helvetica-Bold')
     .fontSize(isA5 ? 11 : 15)
     .text(settings.company_name || 'UDHAYAM AGENCIES', textLeft, margin + (isA5 ? 6 : 8));

  doc.font('Helvetica-Bold')
     .fontSize(isA5 ? 6.5 : 8.5)
     .fillColor(COLOR_LIME)
     .text(settings.company_division || 'Paint Division Quotation Management', textLeft, margin + (isA5 ? 18 : 26));

  doc.font('Helvetica')
     .fontSize(isA5 ? 5.5 : 7.5)
     .fillColor('#E2E8F0')
     .text(settings.company_address || '41/10, M.R. Complex, Old Bus Stand Road, Perundurai', textLeft, margin + (isA5 ? 27 : 39), { width: contentWidth - (textLeft - margin) - (isA5 ? 75 : 100) })
     .text(`Phone: ${settings.company_phone || '+91 97156 22499'} | GSTIN: ${settings.company_gstin || '33AADFU6496M1ZJ'}`, textLeft, margin + (isA5 ? 37 : 52));

  // Top-right RECEIPT badge
  const badgeW = isA5 ? 85 : 110;
  const badgeH = isA5 ? 42 : 58;
  const badgeX = margin + contentWidth - badgeW - (isA5 ? 5 : 8);
  const badgeY = margin + (isA5 ? 5 : 8);

  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, R_SM).fill('rgba(255,255,255,0.15)');
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(isA5 ? 8 : 11)
     .text('PAYMENT RECEIPT', badgeX, badgeY + (isA5 ? 4 : 6), { width: badgeW, align: 'center' });

  doc.fillColor('#E2E8F0').font('Helvetica').fontSize(isA5 ? 5.5 : 7.5)
     .text('Receipt No:', badgeX + 5, badgeY + (isA5 ? 17 : 24))
     .text('Date:', badgeX + 5, badgeY + (isA5 ? 28 : 40));

  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(isA5 ? 5.5 : 7.5)
     .text(receipt.receipt_number || 'UDR-2026-000001', badgeX + (isA5 ? 42 : 55), badgeY + (isA5 ? 17 : 24), { width: badgeW - (isA5 ? 45 : 58), align: 'right' })
     .text(receipt.payment_date || new Date().toISOString().split('T')[0], badgeX + (isA5 ? 42 : 55), badgeY + (isA5 ? 28 : 40), { width: badgeW - (isA5 ? 45 : 58), align: 'right' });

  let curY = margin + headerHeight + (isA5 ? 12 : 18);

  // Customer Information Card (Left) & Payment Attributes Card (Right)
  const cardGap = isA5 ? 8 : 12;
  const halfCardW = (contentWidth - cardGap) / 2;
  const infoCardH = isA5 ? 74 : 96;

  // Left: Customer Received From Card
  doc.roundedRect(margin, curY, halfCardW, infoCardH, R_CARD).fillAndStroke(COLOR_LIGHT_BG, COLOR_BORDER);
  doc.roundedRect(margin, curY, halfCardW, isA5 ? 18 : 22, R_CARD).fill(COLOR_TEAL_DARK);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(isA5 ? 7 : 9)
     .text('RECEIVED WITH THANKS FROM', margin + 8, curY + (isA5 ? 4.5 : 6));

  doc.fillColor(COLOR_TEXT).font('Helvetica-Bold').fontSize(isA5 ? 8.5 : 11)
     .text(receipt.customer_name || 'Customer Name', margin + 8, curY + (isA5 ? 24 : 30));

  doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(isA5 ? 6.5 : 8.5)
     .text(`Contact: ${receipt.customer_phone || 'N/A'}`, margin + 8, curY + (isA5 ? 38 : 48))
     .text(`Address: ${receipt.customer_address || 'Local Customer'}`, margin + 8, curY + (isA5 ? 50 : 64), { width: halfCardW - 16, height: isA5 ? 18 : 24 });

  // Right: Payment Details Card
  const rightCardX = margin + halfCardW + cardGap;
  doc.roundedRect(rightCardX, curY, halfCardW, infoCardH, R_CARD).fillAndStroke(COLOR_LIGHT_BG, COLOR_BORDER);
  doc.roundedRect(rightCardX, curY, halfCardW, isA5 ? 18 : 22, R_CARD).fill(COLOR_TEAL_DARK);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(isA5 ? 7 : 9)
     .text('SETTLEMENT DETAILS', rightCardX + 8, curY + (isA5 ? 4.5 : 6));

  const labelW = isA5 ? 65 : 85;
  const valX = rightCardX + labelW + 5;
  const valW = halfCardW - labelW - 13;
  let py = curY + (isA5 ? 24 : 30);
  const rowStep = isA5 ? 12 : 16;

  doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(isA5 ? 6.5 : 8)
     .text('Bill / Invoice No:', rightCardX + 8, py);
  doc.fillColor(COLOR_TEXT).font('Helvetica-Bold').fontSize(isA5 ? 6.5 : 8.5)
     .text(receipt.bill_no || 'UD23056', valX, py, { width: valW });

  py += rowStep;
  doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(isA5 ? 6.5 : 8)
     .text('Payment Mode:', rightCardX + 8, py);
  doc.fillColor(COLOR_TEAL).font('Helvetica-Bold').fontSize(isA5 ? 6.5 : 8.5)
     .text((receipt.payment_mode || 'Cash').toUpperCase(), valX, py, { width: valW });

  py += rowStep;
  doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(isA5 ? 6.5 : 8)
     .text('Ref / Txn ID:', rightCardX + 8, py);
  doc.fillColor(COLOR_TEXT).font('Helvetica').fontSize(isA5 ? 6.5 : 8)
     .text(receipt.reference_no || 'Direct Settlement', valX, py, { width: valW });

  curY += infoCardH + (isA5 ? 12 : 16);

  // Financial Summary Hero Boxes (Amount Paid vs Balance Due)
  const heroCardH = isA5 ? 64 : 80;
  const paidCardW = (contentWidth - cardGap) * 0.58;
  const balanceCardW = contentWidth - cardGap - paidCardW;

  // Emerald Highlight Box for Amount Received
  doc.roundedRect(margin, curY, paidCardW, heroCardH, R_CARD).fillAndStroke('#ECFDF5', '#10B981');
  doc.fillColor('#065F46').font('Helvetica-Bold').fontSize(isA5 ? 7.5 : 9.5)
     .text('AMOUNT RECEIVED', margin + 12, curY + (isA5 ? 8 : 10));

  const amountStr = Number(receipt.amount_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  doc.fillColor('#047857').font('Helvetica-Bold').fontSize(isA5 ? 18 : 24)
     .text(`Rs. ${amountStr}`, margin + 12, curY + (isA5 ? 22 : 28));

  const words = numberToIndianWords(receipt.amount_paid || 0);
  doc.fillColor('#065F46').font('Helvetica-Oblique').fontSize(isA5 ? 6 : 7.5)
     .text(words, margin + 12, curY + (isA5 ? 46 : 58), { width: paidCardW - 24 });

  // Amber/Slate Highlight Box for Balance Due
  const balX = margin + paidCardW + cardGap;
  const hasBalance = Number(receipt.balance_amount || 0) > 0;
  const balBg = hasBalance ? '#FFFBEB' : '#F1F5F9';
  const balBorder = hasBalance ? '#F59E0B' : '#94A3B8';
  const balTitleColor = hasBalance ? '#92400E' : '#475569';
  const balAmountColor = hasBalance ? '#B45309' : '#0F172A';

  doc.roundedRect(balX, curY, balanceCardW, heroCardH, R_CARD).fillAndStroke(balBg, balBorder);
  doc.fillColor(balTitleColor).font('Helvetica-Bold').fontSize(isA5 ? 7.5 : 9.5)
     .text(hasBalance ? 'OUTSTANDING BALANCE' : 'STATUS', balX + 10, curY + (isA5 ? 8 : 10));

  const balanceStr = Number(receipt.balance_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  doc.fillColor(balAmountColor).font('Helvetica-Bold').fontSize(isA5 ? 16 : 22)
     .text(hasBalance ? `Rs. ${balanceStr}` : 'FULLY CLEARED', balX + 10, curY + (isA5 ? 22 : 28));

  doc.fillColor(balTitleColor).font('Helvetica').fontSize(isA5 ? 6 : 7.5)
     .text(hasBalance ? 'Pending bill settlement' : 'No pending balance for this bill', balX + 10, curY + (isA5 ? 46 : 58), { width: balanceCardW - 20 });

  curY += heroCardH + (isA5 ? 12 : 16);

  // Warm Thank You Note Box
  const noteH = isA5 ? 44 : 52;
  doc.roundedRect(margin, curY, contentWidth, noteH, R_CARD).fillAndStroke('#F8FAFC', COLOR_BORDER);
  doc.fillColor(COLOR_TEAL).font('Helvetica-Bold').fontSize(isA5 ? 7 : 8.5)
     .text('WARM MESSAGE FROM UDHAYAM AGENCIES', margin + 10, curY + (isA5 ? 6 : 8));

  const defaultMsg = 'Thank you for your prompt payment! We sincerely appreciate your trust and business. For any further paint and coating requirements, our dedicated team is at your service.';
  doc.fillColor(COLOR_TEXT).font('Helvetica').fontSize(isA5 ? 6.5 : 8)
     .text(receipt.notes || defaultMsg, margin + 10, curY + (isA5 ? 18 : 22), { width: contentWidth - 20, lineGap: 1.5 });

  curY += noteH + (isA5 ? 12 : 16);

  // Bottom Columns: Bank / UPI Card (Left) & Authorised Signatory (Right)
  const bottomCardH = isA5 ? 78 : 96;
  doc.roundedRect(margin, curY, contentWidth, bottomCardH, R_CARD).fillAndStroke(COLOR_LIGHT_BG, COLOR_BORDER);

  // Sub-Col 1: Bank Details
  const bCol1W = (contentWidth - (isA5 ? 60 : 80)) * 0.55;
  const bCol2W = isA5 ? 60 : 80;
  const bCol3W = contentWidth - bCol1W - bCol2W;

  doc.fillColor(COLOR_TEAL_DARK).font('Helvetica-Bold').fontSize(isA5 ? 6.5 : 8.5)
     .text('BANK TRANSFER DETAILS', margin + 8, curY + 6);

  doc.fillColor(COLOR_TEXT).font('Helvetica').fontSize(isA5 ? 5.8 : 7.5)
     .text(`Bank: ${settings.bank_name || 'INDIAN BANK'}`, margin + 8, curY + (isA5 ? 18 : 23))
     .text(`A/C: ${settings.bank_account_number || '6659-3301-52'}`, margin + 8, curY + (isA5 ? 28 : 36))
     .text(`IFSC: ${settings.bank_ifsc || 'IDIB000P155'}`, margin + 8, curY + (isA5 ? 38 : 49))
     .text(`Branch: ${settings.bank_branch || 'PERUNDURAI BRANCH'}`, margin + 8, curY + (isA5 ? 48 : 62))
     .text(`UPI: ${settings.upi_id || '9715622499@okbizaxis'}`, margin + 8, curY + (isA5 ? 58 : 75));

  // Divider 1
  let cx = margin + bCol1W;
  doc.moveTo(cx, curY + 4).lineTo(cx, curY + bottomCardH - 4).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();

  // Sub-Col 2: UPI QR
  const qrSize = isA5 ? 46 : 60;
  const qrSource = getQrSource(settings);
  if (qrSource) {
    try {
      const qrImgX = cx + (bCol2W - qrSize) / 2;
      const qrImgY = curY + (isA5 ? 4 : 6);
      doc.image(qrSource, qrImgX, qrImgY, { fit: [qrSize, qrSize] });
      doc.fillColor(COLOR_TEAL_DARK).font('Helvetica-Bold').fontSize(isA5 ? 4.5 : 5.5)
         .text('SCAN TO PAY UPI', cx, qrImgY + qrSize + (isA5 ? 3 : 4), { width: bCol2W, align: 'center' });
    } catch (e) {
      console.warn('QR render error:', e.message);
    }
  }

  // Divider 2
  cx += bCol2W;
  doc.moveTo(cx, curY + 4).lineTo(cx, curY + bottomCardH - 4).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();

  // Sub-Col 3: Authorised Signatory
  doc.fillColor(COLOR_TEXT).font('Helvetica-Bold').fontSize(isA5 ? 6 : 7.5)
     .text('Customer Signature', cx + 8, curY + 6)
     .text(`For ${settings.company_name || 'UDHAYAM AGENCIES'}`, cx + 8, curY + (isA5 ? 36 : 48), { width: bCol3W - 16, align: 'right' })
     .font('Helvetica-Oblique').fontSize(isA5 ? 5.5 : 6.5)
     .text('Authorised Signatory', cx + 8, curY + (isA5 ? 58 : 76), { width: bCol3W - 16, align: 'right' });

  // Single page guarantee
  doc.end();
  return streamPromise;
}

module.exports = {
  generateReceiptPdf,
  numberToIndianWords
};
