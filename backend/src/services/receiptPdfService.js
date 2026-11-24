const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { resolveUploadedFile } = require('../utils/storagePaths');

// Corporate Executive Color Palette
const COLOR_PRIMARY = '#004D40';      // Deep Corporate Spruce Teal
const COLOR_PRIMARY_DARK = '#00332C'; // Rich dark teal
const COLOR_ACCENT = '#059669';       // Emerald Green
const COLOR_TEXT = '#0F172A';         // Slate 900
const COLOR_MUTED = '#475569';        // Slate 600
const COLOR_LIGHT_MUTED = '#64748B';  // Slate 500
const COLOR_BORDER = '#CBD5E1';       // Slate 300
const COLOR_BG_LIGHT = '#F8FAFC';     // Slate 50
const COLOR_BG_SUBTLE = '#F1F5F9';    // Slate 100

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

function generateReceiptPdf(receipt, settings = {}, res = null) {
  const isA5 = receipt.paper_format === 'A5';

  const doc = new PDFDocument({
    size: isA5 ? 'A5' : 'A4',
    margins: {
      top: isA5 ? 18 : 28,
      bottom: isA5 ? 18 : 28,
      left: isA5 ? 18 : 28,
      right: isA5 ? 18 : 28
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

  const margin = isA5 ? 16 : 28;
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const contentWidth = pageWidth - margin * 2;
  const logoSource = getLogoSource(settings);

  const R_CARD = isA5 ? 4 : 6;
  const R_PILL = isA5 ? 8 : 10;

  // 1. TOP CORPORATE EXECUTIVE HEADER (Clean, high-contrast, professional)
  let curY = margin;

  // Subtle top accent line (deep corporate spruce teal)
  doc.rect(margin, curY, contentWidth, isA5 ? 3 : 4).fill(COLOR_PRIMARY);
  curY += isA5 ? 8 : 12;

  // Logo square on left
  const logoSize = isA5 ? 46 : 58;
  let textLeft = margin;
  if (logoSource) {
    try {
      doc.roundedRect(margin, curY, logoSize, logoSize, R_CARD).fillAndStroke('#FFFFFF', COLOR_BORDER);
      doc.image(logoSource, margin + 3, curY + 3, {
        fit: [logoSize - 6, logoSize - 6],
        align: 'center',
        valign: 'center'
      });
      textLeft = margin + logoSize + (isA5 ? 10 : 14);
    } catch (e) {
      console.warn('Logo render error:', e.message);
    }
  }

  // Company Name and Business Meta
  doc.fillColor(COLOR_TEXT)
     .font('Helvetica-Bold')
     .fontSize(isA5 ? 13 : 17)
     .text(settings.company_name || 'UDHAYAM AGENCIES', textLeft, curY);

  doc.font('Helvetica-Bold')
     .fontSize(isA5 ? 7 : 8.5)
     .fillColor(COLOR_PRIMARY)
     .text((settings.company_division || 'Paint Division Quotation Management').toUpperCase(), textLeft, curY + (isA5 ? 16 : 21));

  doc.font('Helvetica')
     .fontSize(isA5 ? 6 : 7.5)
     .fillColor(COLOR_MUTED)
     .text(settings.company_address || '41/10, M.R. Complex, Old Bus Stand Road, Perundurai, Erode - 638052', textLeft, curY + (isA5 ? 27 : 34), { width: contentWidth - (textLeft - margin) - (isA5 ? 120 : 160) })
     .text(`GSTIN: ${settings.company_gstin || '33AADFU6496M1ZJ'} | Phone: ${settings.company_phone || '+91 97156 22499, +91 88700 22499'}`, textLeft, curY + (isA5 ? 37 : 46));

  // Top-Right: Clean Corporate Document Title & Meta Block (Generous width to NEVER wrap numbers!)
  const metaBlockW = isA5 ? 120 : 160;
  const metaX = margin + contentWidth - metaBlockW;

  doc.fillColor(COLOR_PRIMARY)
     .font('Helvetica-Bold')
     .fontSize(isA5 ? 12 : 16)
     .text('PAYMENT RECEIPT', metaX, curY, { width: metaBlockW, align: 'right' });

  // Status Pill: [ ✓ FULLY PAID ] or [ PARTIALLY PAID ]
  const isFullyPaid = !Number(receipt.balance_amount) || Number(receipt.balance_amount) <= 0;
  const statusLabel = isFullyPaid ? 'PAID' : 'PARTIALLY PAID';
  const pillW = isA5 ? 68 : 88;
  const pillH = isA5 ? 14 : 17;
  const pillX = margin + contentWidth - pillW;
  const pillY = curY + (isA5 ? 16 : 21);

  if (isFullyPaid) {
    doc.roundedRect(pillX, pillY, pillW, pillH, R_PILL).fillAndStroke('#ECFDF5', '#10B981');
    doc.fillColor('#065F46').font('Helvetica-Bold').fontSize(isA5 ? 6.5 : 8)
       .text('✓ FULLY PAID', pillX, pillY + (isA5 ? 3 : 4), { width: pillW, align: 'center' });
  } else {
    doc.roundedRect(pillX, pillY, pillW, pillH, R_PILL).fillAndStroke('#FFFBEB', '#F59E0B');
    doc.fillColor('#92400E').font('Helvetica-Bold').fontSize(isA5 ? 6.5 : 8)
       .text('PARTIALLY PAID', pillX, pillY + (isA5 ? 3 : 4), { width: pillW, align: 'center' });
  }

  // Receipt Number & Date (Formatted cleanly without text wrapping)
  doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(isA5 ? 6.5 : 8)
     .text('Receipt No:', metaX, curY + (isA5 ? 34 : 42), { width: isA5 ? 48 : 62, align: 'right' })
     .text('Date:', metaX, curY + (isA5 ? 44 : 54), { width: isA5 ? 48 : 62, align: 'right' });

  doc.fillColor(COLOR_TEXT).font('Helvetica-Bold').fontSize(isA5 ? 6.5 : 8)
     .text(receipt.receipt_number || 'UDR-2026-000001', metaX + (isA5 ? 52 : 66), curY + (isA5 ? 34 : 42), { width: metaBlockW - (isA5 ? 52 : 66), align: 'right' })
     .text(receipt.payment_date || new Date().toISOString().split('T')[0], metaX + (isA5 ? 52 : 66), curY + (isA5 ? 44 : 54), { width: metaBlockW - (isA5 ? 52 : 66), align: 'right' });

  curY += Math.max(logoSize, isA5 ? 54 : 68) + (isA5 ? 10 : 14);

  // Subtle divider line
  doc.moveTo(margin, curY).lineTo(margin + contentWidth, curY).strokeColor(COLOR_BORDER).lineWidth(0.75).stroke();
  curY += isA5 ? 10 : 14;

  // 2. TWO-COLUMN CORPORATE CONTEXT (CUSTOMER DETAILS & SETTLEMENT INFO)
  const cardGap = isA5 ? 8 : 12;
  const colW = (contentWidth - cardGap) / 2;
  const colH = isA5 ? 68 : 82;

  // Left Column: Received From Card
  doc.roundedRect(margin, curY, colW, colH, R_CARD).fillAndStroke(COLOR_BG_LIGHT, COLOR_BORDER);
  doc.fillColor(COLOR_PRIMARY_DARK).font('Helvetica-Bold').fontSize(isA5 ? 6.8 : 8)
     .text('RECEIVED WITH THANKS FROM', margin + 10, curY + (isA5 ? 7 : 9));

  doc.fillColor(COLOR_TEXT).font('Helvetica-Bold').fontSize(isA5 ? 9.5 : 12)
     .text(receipt.customer_name || 'Customer Name', margin + 10, curY + (isA5 ? 20 : 25));

  doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(isA5 ? 6.5 : 8)
     .text(`Contact: ${receipt.customer_phone || 'N/A'}`, margin + 10, curY + (isA5 ? 35 : 44))
     .text(`Address: ${receipt.customer_address || 'Local Customer, Perundurai'}`, margin + 10, curY + (isA5 ? 47 : 58), { width: colW - 20, height: isA5 ? 16 : 20 });

  // Right Column: Settlement Reference Card
  const col2X = margin + colW + cardGap;
  doc.roundedRect(col2X, curY, colW, colH, R_CARD).fillAndStroke(COLOR_BG_LIGHT, COLOR_BORDER);
  doc.fillColor(COLOR_PRIMARY_DARK).font('Helvetica-Bold').fontSize(isA5 ? 6.8 : 8)
     .text('SETTLEMENT PARTICULARS', col2X + 10, curY + (isA5 ? 7 : 9));

  const lW = isA5 ? 75 : 95;
  const vX = col2X + lW;
  const vW = colW - lW - 10;
  let py = curY + (isA5 ? 21 : 26);
  const pStep = isA5 ? 12 : 15;

  doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(isA5 ? 6.5 : 8).text('Bill / Invoice Reference:', col2X + 10, py);
  doc.fillColor(COLOR_TEXT).font('Helvetica-Bold').fontSize(isA5 ? 6.8 : 8.5).text(receipt.bill_no || 'Direct Settlement', vX, py, { width: vW });

  py += pStep;
  doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(isA5 ? 6.5 : 8).text('Payment Mode:', col2X + 10, py);
  doc.fillColor(COLOR_PRIMARY).font('Helvetica-Bold').fontSize(isA5 ? 6.8 : 8.5).text((receipt.payment_mode || 'Cash').toUpperCase(), vX, py, { width: vW });

  py += pStep;
  doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(isA5 ? 6.5 : 8).text('Transaction / Cheque Ref:', col2X + 10, py);
  doc.fillColor(COLOR_TEXT).font('Helvetica').fontSize(isA5 ? 6.5 : 8).text(receipt.reference_no || 'Direct Clearance', vX, py, { width: vW });

  curY += colH + (isA5 ? 12 : 16);

  // 3. CORPORATE FINANCIAL BREAKDOWN TABLE (Clean, structured, executive)
  const tblW = contentWidth;
  const thHeight = isA5 ? 18 : 22;

  // Table Columns
  const c0W = isA5 ? 26 : 32;                                // S.No
  const c2W = isA5 ? 70 : 90;                                // Bill Amount
  const c3W = isA5 ? 85 : 105;                               // Amount Received
  const c4W = isA5 ? 75 : 95;                                // Balance Due
  const c1W = tblW - c0W - c2W - c3W - c4W;                  // Description

  // Header Bar
  doc.rect(margin, curY, tblW, thHeight).fill(COLOR_PRIMARY);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(isA5 ? 6.5 : 8);

  const thY = curY + (isA5 ? 5 : 6);
  doc.text('S.No', margin, thY, { width: c0W, align: 'center' });
  doc.text('Description / Settlement Particulars', margin + c0W + 6, thY, { width: c1W - 12 });
  doc.text('Bill Total (Rs.)', margin + c0W + c1W, thY, { width: c2W - 8, align: 'right' });
  doc.text('Amount Received (Rs.)', margin + c0W + c1W + c2W, thY, { width: c3W - 8, align: 'right' });
  doc.text('Balance Due (Rs.)', margin + c0W + c1W + c2W + c3W, thY, { width: c4W - 8, align: 'right' });

  curY += thHeight;

  // Row 1: The Transaction Line Item
  const rowH = isA5 ? 34 : 42;
  doc.rect(margin, curY, tblW, rowH).fillAndStroke('#FFFFFF', COLOR_BORDER);

  const rY = curY + (isA5 ? 7 : 9);
  doc.fillColor(COLOR_TEXT).font('Helvetica').fontSize(isA5 ? 7 : 8.5);
  doc.text('1', margin, rY, { width: c0W, align: 'center' });

  // Description
  doc.font('Helvetica-Bold').text(`Payment Settlement - Bill No: ${receipt.bill_no || 'Direct'}`, margin + c0W + 6, rY, { width: c1W - 12 });
  doc.font('Helvetica').fillColor(COLOR_MUTED).fontSize(isA5 ? 6 : 7.5)
     .text(`Settlement via ${receipt.payment_mode || 'Cash'} ${receipt.reference_no ? `(Ref: ${receipt.reference_no})` : ''}`, margin + c0W + 6, rY + (isA5 ? 12 : 15), { width: c1W - 12 });

  // Numbers
  const paidVal = parseFloat(receipt.amount_paid) || 0;
  const balVal = parseFloat(receipt.balance_amount) || 0;
  const totalBillVal = paidVal + balVal;

  doc.font('Helvetica').fillColor(COLOR_TEXT).fontSize(isA5 ? 7 : 8.5);
  doc.text(totalBillVal > 0 ? totalBillVal.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—', margin + c0W + c1W, rY, { width: c2W - 8, align: 'right' });

  doc.font('Helvetica-Bold').fillColor(COLOR_PRIMARY);
  doc.text(paidVal.toLocaleString('en-IN', { minimumFractionDigits: 2 }), margin + c0W + c1W + c2W, rY, { width: c3W - 8, align: 'right' });

  doc.font('Helvetica').fillColor(balVal > 0 ? '#B45309' : '#059669');
  doc.text(balVal > 0 ? balVal.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00 (Cleared)', margin + c0W + c1W + c2W + c3W, rY, { width: c4W - 8, align: 'right' });

  curY += rowH;

  // Table Summary Total Row
  const totalRowH = isA5 ? 24 : 30;
  doc.rect(margin, curY, tblW, totalRowH).fillAndStroke(COLOR_BG_SUBTLE, COLOR_BORDER);

  const trY = curY + (isA5 ? 6 : 8);
  doc.fillColor(COLOR_TEXT).font('Helvetica-Bold').fontSize(isA5 ? 7 : 8.5)
     .text('TOTAL AMOUNT RECEIVED', margin + 10, trY);

  doc.fillColor(COLOR_PRIMARY).font('Helvetica-Bold').fontSize(isA5 ? 10 : 13)
     .text(`Rs. ${paidVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, margin + c0W + c1W + c2W, trY - 1, { width: c3W - 8, align: 'right' });

  if (balVal > 0) {
    doc.fillColor('#B45309').font('Helvetica-Bold').fontSize(isA5 ? 7.5 : 9)
       .text(`Due: Rs. ${balVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, margin + c0W + c1W + c2W + c3W, trY, { width: c4W - 8, align: 'right' });
  } else {
    doc.fillColor('#059669').font('Helvetica-Bold').fontSize(isA5 ? 7.5 : 9)
       .text('All Dues Cleared', margin + c0W + c1W + c2W + c3W, trY, { width: c4W - 8, align: 'right' });
  }

  curY += totalRowH + (isA5 ? 12 : 16);

  // 4. AMOUNT IN WORDS & OFFICIAL ACKNOWLEDGMENT CALLOUT
  const ackH = isA5 ? 46 : 56;
  doc.roundedRect(margin, curY, contentWidth, ackH, R_CARD).fillAndStroke(COLOR_BG_LIGHT, COLOR_BORDER);
  // Elegant Spruce left border strip
  doc.rect(margin, curY, isA5 ? 3.5 : 4.5, ackH).fill(COLOR_PRIMARY);

  doc.fillColor(COLOR_PRIMARY_DARK).font('Helvetica-Bold').fontSize(isA5 ? 6.8 : 8)
     .text('AMOUNT IN WORDS', margin + 12, curY + (isA5 ? 6 : 8));

  const words = numberToIndianWords(paidVal);
  doc.fillColor(COLOR_TEXT).font('Helvetica-Bold').fontSize(isA5 ? 8 : 9.5)
     .text(words, margin + 12, curY + (isA5 ? 16 : 20));

  doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(isA5 ? 6 : 7.5)
     .text(`Received with thanks the sum of Rs. ${paidVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} from M/s. ${receipt.customer_name} towards settlement of Bill No: ${receipt.bill_no || 'Direct'} via ${receipt.payment_mode}.`, margin + 12, curY + (isA5 ? 29 : 36), { width: contentWidth - 24 });

  curY += ackH + (isA5 ? 14 : 20);

  // 5. CORPORATE FOOTER & SIGNATORY BLOCK (Clean, uncluttered, no bank details)
  const footerH = isA5 ? 64 : 80;
  doc.roundedRect(margin, curY, contentWidth, footerH, R_CARD).fillAndStroke('#FFFFFF', COLOR_BORDER);

  // Left Side: Legal Declaration & General Terms
  const leftFootW = contentWidth * 0.58;
  doc.fillColor(COLOR_PRIMARY_DARK).font('Helvetica-Bold').fontSize(isA5 ? 6.5 : 7.5)
     .text('DECLARATION & TERMS', margin + 10, curY + (isA5 ? 7 : 9));

  doc.fillColor(COLOR_LIGHT_MUTED).font('Helvetica').fontSize(isA5 ? 5.5 : 6.8)
     .text('1. This official computer-generated receipt serves as valid acknowledgment of payment.', margin + 10, curY + (isA5 ? 19 : 23), { width: leftFootW - 14 })
     .text('2. Payments made by Cheque, DD, or Online Transfer are subject to realization.', margin + 10, curY + (isA5 ? 29 : 35), { width: leftFootW - 14 })
     .text('3. Any discrepancies should be notified within 7 business days of issue.', margin + 10, curY + (isA5 ? 39 : 47), { width: leftFootW - 14 })
     .text('Thank you for choosing Udhayam Agencies. We value your partnership.', margin + 10, curY + (isA5 ? 49 : 59), { width: leftFootW - 14 });

  // Vertical subtle divider
  const divX = margin + leftFootW;
  doc.moveTo(divX, curY + 6).lineTo(divX, curY + footerH - 6).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();

  // Right Side: Official Authorised Signatory with Stamp Space
  const rightFootW = contentWidth - leftFootW;
  doc.fillColor(COLOR_TEXT).font('Helvetica-Bold').fontSize(isA5 ? 6.8 : 8)
     .text(`For ${settings.company_name || 'UDHAYAM AGENCIES'}`, divX + 10, curY + (isA5 ? 7 : 9), { width: rightFootW - 20, align: 'right' });

  // Signature line
  const sigLineY = curY + footerH - (isA5 ? 18 : 22);
  doc.moveTo(divX + (isA5 ? 30 : 40), sigLineY).lineTo(margin + contentWidth - 10, sigLineY).strokeColor(COLOR_BORDER).lineWidth(0.75).stroke();

  doc.fillColor(COLOR_LIGHT_MUTED).font('Helvetica-Bold').fontSize(isA5 ? 5.8 : 7)
     .text('Authorised Signatory', divX + 10, sigLineY + (isA5 ? 4 : 5), { width: rightFootW - 20, align: 'right' });

  // End Document (Guaranteed single page)
  doc.end();
  return streamPromise;
}

module.exports = {
  generateReceiptPdf,
  numberToIndianWords
};
