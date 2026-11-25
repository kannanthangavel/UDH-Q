const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { numberToIndianWords, formatINR } = require('../utils/numberToWords');
const { resolveUploadedFile } = require('../utils/storagePaths');
const { formatToDMY } = require('../utils/dateHelper');

// Brand Colors & Corporate Executive Palette
const COLOR_TEAL = '#004D40';          // Deep corporate spruce
const COLOR_TEAL_DARK = '#00332C';     // Darkest spruce
const COLOR_TEAL_LIGHT = '#E0F2F1';    // Light spruce tint
const COLOR_LIME = '#7DBA00';          // Brand lime accent
const COLOR_TEXT = '#0F172A';          // Slate 900 high contrast text
const COLOR_MUTED = '#64748B';         // Slate 500 captions
const COLOR_BORDER = '#CBD5E1';        // Slate 300 crisp borders
const COLOR_BG_LIGHT = '#F8FAFC';      // Slate 50 background

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

/**
 * Generate Quotation PDF in A4 or A5 layout
 * Guaranteed 1-page fit for standard quotations (up to 12 items)
 */
function generateQuotationPdf(quotation, settings = {}, res = null) {
  const isA5 = quotation.paper_format === 'A5';

  const doc = new PDFDocument({
    size: isA5 ? 'A5' : 'A4',
    compress: false,
    margins: {
      top: isA5 ? 18 : 28,
      bottom: isA5 ? 15 : 22,
      left: isA5 ? 18 : 28,
      right: isA5 ? 18 : 28
    },
    bufferPages: true,
    info: {
      Title: `Quotation ${quotation.quotation_number}`,
      Author: 'Udhayam Agencies - Paint Division',
      Subject: `Quotation for ${quotation.customer_name}`
    }
  });

  let bufferPromise = null;
  if (res && typeof res.on === 'function') {
    doc.pipe(res);
  } else {
    bufferPromise = new Promise((resolve, reject) => {
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
  }

  const margin = isA5 ? 16 : 28;
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const contentWidth = pageWidth - margin * 2;
  const logoSource = getLogoSource(settings);

  // Card and Pill Corner Radii
  const R_CARD = isA5 ? 6 : 8;
  const R_SM = isA5 ? 4 : 5;

  // Top Header Banner with sleek rounded card corners & Lime bottom accent strip
  const headerHeight = isA5 ? 52 : 74;
  doc.roundedRect(margin, margin, contentWidth, headerHeight, R_CARD).fill(COLOR_TEAL);

  // Sleek Lime accent strip at bottom of header banner
  const accentHeight = isA5 ? 2.5 : 3.5;
  doc.roundedRect(margin, margin + headerHeight - accentHeight, contentWidth, accentHeight, 1).fill(COLOR_LIME);

  // Logo in clean rounded white square container (fills allocated space fully!)
  let textLeft = margin + (isA5 ? 6 : 10);
  if (logoSource) {
    try {
      const logoBoxW = isA5 ? 46 : 64;
      const logoBoxH = isA5 ? 46 : 64;
      const pad = isA5 ? 3 : 4;
      const boxX = margin + (isA5 ? 4 : 5);
      const boxY = margin + (isA5 ? 3 : 5);
      doc.roundedRect(boxX, boxY, logoBoxW, logoBoxH, R_SM).fill('#FFFFFF');
      doc.image(logoSource, boxX + pad, boxY + pad, {
        fit: [logoBoxW - pad * 2, logoBoxH - pad * 2],
        align: 'center',
        valign: 'center'
      });
      textLeft = margin + logoBoxW + (isA5 ? 9 : 14);
    } catch (e) {
      console.warn('Logo load error:', e.message);
    }
  }

  // Company Details in Teal Banner
  doc.fillColor('#FFFFFF')
     .font('Helvetica-Bold')
     .fontSize(isA5 ? 11 : 15)
     .text(settings.company_name || 'UDHAYAM AGENCIES', textLeft, margin + (isA5 ? 5 : 7));

  doc.font('Helvetica-Bold')
     .fontSize(isA5 ? 6.5 : 8.5)
     .fillColor(COLOR_LIME)
     .text(settings.company_division || 'Paint Division Quotation Management', textLeft, margin + (isA5 ? 17 : 24));

  doc.font('Helvetica')
     .fontSize(isA5 ? 5.5 : 7.5)
     .fillColor('#E2E8F0')
     .text(settings.company_address || '', textLeft, margin + (isA5 ? 25 : 36), { width: contentWidth - (textLeft - margin) - (isA5 ? 68 : 95) })
     .text(`Phone: ${settings.company_phone || '+91 97156 22499'} | GSTIN: ${settings.company_gstin || '33AADFU6496M1ZJ'}`, textLeft, margin + (isA5 ? 35 : 49));

  // "QUOTATION" Title Badge at top-right
  const badgeWidth = isA5 ? 64 : 86;
  const badgeHeight = isA5 ? 18 : 22;
  const badgeX = pageWidth - margin - badgeWidth - (isA5 ? 5 : 8);
  const badgeY = margin + (isA5 ? 6 : 8);
  doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, R_SM)
     .fill(COLOR_LIME);
  doc.fillColor(COLOR_TEAL_DARK)
     .font('Helvetica-Bold')
     .fontSize(isA5 ? 7.5 : 10)
     .text('QUOTATION', badgeX, badgeY + (isA5 ? 5 : 6), { width: badgeWidth, align: 'center' });

  let curY = margin + headerHeight + (isA5 ? 4 : 6);

  // Customer & Quotation Meta Box (Rounded Card)
  const infoBoxHeight = isA5 ? 46 : 60;
  doc.roundedRect(margin, curY, contentWidth, infoBoxHeight, R_CARD)
     .fillAndStroke('#F8FAFC', COLOR_BORDER);

  const colWidth = (contentWidth - 16) / 2;

  // Left: Customer Details
  doc.fillColor(COLOR_TEAL)
     .font('Helvetica-Bold')
     .fontSize(isA5 ? 6.5 : 8)
     .text('CUSTOMER DETAILS:', margin + 6, curY + (isA5 ? 4 : 6));

  doc.fillColor(COLOR_TEXT)
     .font('Helvetica-Bold')
     .fontSize(isA5 ? 7.5 : 9.5)
     .text(quotation.customer_name || 'Valued Customer', margin + 6, curY + (isA5 ? 12 : 16));

  let custDetailsY = curY + (isA5 ? 20 : 26);
  if (quotation.customer_address) {
    doc.font('Helvetica')
       .fontSize(isA5 ? 5.5 : 7)
       .fillColor(COLOR_MUTED)
       .text(`Address: ${quotation.customer_address}`, margin + 6, custDetailsY, { width: colWidth, height: 12, ellipsis: true });
    custDetailsY += (isA5 ? 9 : 11);
  }

  const contactParts = [];
  if (quotation.customer_phone && quotation.customer_phone !== '-') {
    contactParts.push(`Phone: ${quotation.customer_phone}`);
  }
  if (quotation.customer_gstin) {
    contactParts.push(`GSTIN: ${quotation.customer_gstin}`);
  }
  if (contactParts.length > 0) {
    doc.font('Helvetica-Bold')
       .fontSize(isA5 ? 5.5 : 7)
       .fillColor(COLOR_TEXT)
       .text(contactParts.join('  |  '), margin + 6, custDetailsY, { width: colWidth, height: 11, ellipsis: true });
  }

  // Vertical subtle divider between Customer & Quote details
  doc.moveTo(margin + colWidth + 4, curY + 6)
     .lineTo(margin + colWidth + 4, curY + infoBoxHeight - 6)
     .strokeColor(COLOR_BORDER)
     .lineWidth(0.5)
     .stroke();

  // Right: Quotation Meta
  const rightX = margin + colWidth + 10;
  doc.fillColor(COLOR_TEAL)
     .font('Helvetica-Bold')
     .fontSize(isA5 ? 6.5 : 8)
     .text('QUOTATION DETAILS:', rightX, curY + (isA5 ? 4 : 6));

  // Strictly use exact quote number without appending reference numbers or extra suffix
  const quoteNoDisplay = quotation.quotation_number || 'UDQ-2026-0001';
  const quoteDateDisplay = formatToDMY(quotation.quotation_date) || formatToDMY(new Date());
  const validDateDisplay = formatToDMY(quotation.validity_date, quotation.quotation_date, 7);

  doc.font('Helvetica')
     .fontSize(isA5 ? 5.8 : 7.5)
     .fillColor(COLOR_TEXT)
     .text(`Quote No: `, rightX, curY + (isA5 ? 12 : 16), { continued: true })
     .font('Helvetica-Bold').text(quoteNoDisplay)
     .font('Helvetica').text(`Date: `, rightX, curY + (isA5 ? 20 : 25), { continued: true })
     .font('Helvetica-Bold').text(quoteDateDisplay)
     .font('Helvetica').text(`Valid Till: `, rightX, curY + (isA5 ? 28 : 34), { continued: true })
     .font('Helvetica-Bold').text(validDateDisplay);

  // Terms badge: CASH vs CREDIT pill
  const pTerms = (quotation.payment_terms || 'Cash').trim();
  const isCredit = /credit/i.test(pTerms);
  const pillBg = isCredit ? '#FEF3C7' : '#DCFCE7';
  const pillFg = isCredit ? '#92400E' : '#166534';
  const pillBorder = isCredit ? '#FCD34D' : '#86EFAC';
  const pillW = isA5 ? 78 : 105;
  const pillH = isA5 ? 11 : 14;
  const pillY = curY + (isA5 ? 35 : 43);

  doc.roundedRect(rightX, pillY, pillW, pillH, 3)
     .fillAndStroke(pillBg, pillBorder);
  doc.fillColor(pillFg)
     .font('Helvetica-Bold')
     .fontSize(isA5 ? 5.2 : 6.8)
     .text(`Terms: ${pTerms}`, rightX + 2, pillY + (isA5 ? 2 : 2.5), { width: pillW - 4, align: 'center', ellipsis: true });

  curY += infoBoxHeight + (isA5 ? 4 : 6);

  // Target bottom coordinates for true Full-Page A4 / A5 printing layout
  const bankCardHeight = isA5 ? 58 : 74;
  const taxTableHeight = isA5 ? 41 : 50;
  const targetBankY = pageHeight - margin - bankCardHeight;
  const targetTaxY = targetBankY - taxTableHeight - (isA5 ? 5 : 8);
  const tableBottomY = targetTaxY - (isA5 ? 4 : 6);
  const tableHeaderHeight = isA5 ? 16 : 20;

  // Line Items Table Columns with clean (Rs.) currency labels in Optech Layout Design
  // Columns: S.No | Item Description & Specifications | HSN/SAC | Qty | Rate (Rs.) | Tax % | Amount (Rs.)
  const colDef = [
    { label: 'S.No', width: isA5 ? 20 : 28, align: 'center' },
    { label: 'Item Description & Specifications', width: isA5 ? 165 : 235, align: 'left' },
    { label: 'HSN/SAC', width: isA5 ? 42 : 56, align: 'center' },
    { label: 'Qty', width: isA5 ? 38 : 50, align: 'center' },
    { label: 'Rate (Rs.)', width: isA5 ? 44 : 58, align: 'right' },
    { label: 'Tax %', width: isA5 ? 30 : 42, align: 'center' },
    { label: 'Amount (Rs.)', width: isA5 ? 48 : 70, align: 'right' }
  ];

  function drawTableHeader(y) {
    doc.roundedRect(margin, y, contentWidth, tableHeaderHeight, R_SM)
       .fill(COLOR_TEAL);
    doc.fillColor('#FFFFFF')
       .font('Helvetica-Bold')
       .fontSize(isA5 ? 6.5 : 8);

    let x = margin;
    for (let i = 0; i < colDef.length; i++) {
      const col = colDef[i];
      doc.text(col.label, x + 2, y + (isA5 ? 4.5 : 5.5), { width: col.width - 4, align: col.align });
      x += col.width;
      // White vertical column divider in the header
      if (i < colDef.length - 1) {
        doc.moveTo(x, y + 2).lineTo(x, y + tableHeaderHeight - 2).strokeColor('#003B40').lineWidth(0.75).stroke();
      }
    }
    doc.strokeColor(COLOR_BORDER).lineWidth(0.5);
    return y + tableHeaderHeight;
  }

  const tableStartY = curY;
  curY = drawTableHeader(curY);
  let currentPageTableStartY = curY;

  // Function to draw vertical column divider lines
  function drawVerticalGridLines(startY, endY) {
    let colX = margin;
    for (let i = 0; i < colDef.length - 1; i++) {
      colX += colDef[i].width;
      doc.moveTo(colX, startY).lineTo(colX, endY).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();
    }
  }

  // Line items
  const items = quotation.items || [];
  let rowIdx = 0;

  for (const item of items) {
    const hasDetails = item.details && item.details.trim().length > 0;
    const rowHeight = hasDetails ? (isA5 ? 20 : 23) : (isA5 ? 15 : 18);

    // Multi-page check: break if next row exceeds tableBottomY
    if (curY + rowHeight > tableBottomY) {
      // Complete table on current page
      drawVerticalGridLines(currentPageTableStartY, curY);
      doc.moveTo(margin, curY).lineTo(margin + contentWidth, curY).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();
      doc.rect(margin, currentPageTableStartY - tableHeaderHeight, contentWidth, curY - (currentPageTableStartY - tableHeaderHeight))
         .strokeColor(COLOR_BORDER).lineWidth(0.75).stroke();

      doc.addPage();
      curY = drawTableHeader(margin);
      currentPageTableStartY = curY;
    }

    const isEven = rowIdx % 2 === 0;
    if (isEven) {
      doc.rect(margin, curY, contentWidth, rowHeight).fill('#F8FAFC');
    }

    // Row horizontal bottom border
    doc.moveTo(margin, curY + rowHeight).lineTo(margin + contentWidth, curY + rowHeight).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();

    doc.fillColor(COLOR_TEXT)
       .font('Helvetica')
       .fontSize(isA5 ? 6 : 7.5);

    let x = margin;
    // S.No
    doc.text(String(rowIdx + 1), x + 2, curY + (isA5 ? 3 : 4.5), { width: colDef[0].width - 4, align: 'center' });
    x += colDef[0].width;

    // Item Name and Details
    doc.font('Helvetica-Bold')
       .text(item.item_name || '', x + 3, curY + (isA5 ? 2.5 : 3.5), { width: colDef[1].width - 6, height: 10, ellipsis: true });
    if (hasDetails) {
      doc.font('Helvetica-Oblique')
         .fontSize(isA5 ? 5.5 : 6.5)
         .fillColor(COLOR_MUTED)
         .text(item.details, x + 3, curY + (isA5 ? 11 : 13.5), { width: colDef[1].width - 6, height: 8, ellipsis: true });
      doc.fillColor(COLOR_TEXT).fontSize(isA5 ? 6 : 7.5);
    }
    x += colDef[1].width;

    // HSN/SAC
    doc.font('Helvetica')
       .text(item.hsn_sac || '-', x + 2, curY + (isA5 ? 3 : 4.5), { width: colDef[2].width - 4, align: 'center' });
    x += colDef[2].width;

    // Qty (combined quantity and unit, matching Optech layout)
    const qtyText = `${item.quantity} ${item.unit || 'Nos'}`;
    doc.font('Helvetica-Bold')
       .text(qtyText, x + 2, curY + (isA5 ? 3 : 4.5), { width: colDef[3].width - 4, align: 'center' });
    x += colDef[3].width;

    // Rate (Rs.)
    doc.font('Helvetica')
       .text(Number(item.sale_rate).toFixed(2), x + 2, curY + (isA5 ? 3 : 4.5), { width: colDef[4].width - 4, align: 'right' });
    x += colDef[4].width;

    // Tax %
    const taxVal = item.tax_percent != null ? item.tax_percent : (quotation.gst_rate || 18);
    doc.font('Helvetica')
       .text(`${taxVal}%`, x + 2, curY + (isA5 ? 3 : 4.5), { width: colDef[5].width - 4, align: 'center' });
    x += colDef[5].width;

    // Amount (Rs.)
    doc.font('Helvetica-Bold')
       .text(Number(item.line_total).toFixed(2), x + 2, curY + (isA5 ? 3 : 4.5), { width: colDef[6].width - 4, align: 'right' });

    curY += rowHeight;
    rowIdx++;
  }

  // Extend table vertical lines down to tableBottomY so page is gracefully filled
  const endTableY = Math.max(curY, tableBottomY);
  drawVerticalGridLines(currentPageTableStartY, endTableY);

  // Bottom table closing line and outer frame
  doc.moveTo(margin, endTableY).lineTo(margin + contentWidth, endTableY).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();
  doc.rect(margin, currentPageTableStartY - tableHeaderHeight, contentWidth, endTableY - (currentPageTableStartY - tableHeaderHeight))
     .strokeColor(COLOR_BORDER).lineWidth(0.75).stroke();

  // ==========================================
  // 1. Horizontal Tax Breakdown Table (Full Width)
  // ==========================================
  curY = targetTaxY;
  const taxHeaderH = isA5 ? 13 : 16;
  const taxRowH = isA5 ? 15 : 18;
  const wordsRowH = isA5 ? 13 : 16;

  // 8 Columns across contentWidth:
  // Taxable Value | CGST Rate | CGST Amt | SGST Rate | SGST Amt | Total Tax | Round Off | Net Grand Total
  const taxCols = [
    { label: 'Taxable Value', w: isA5 ? 56 : 78, align: 'right' },
    { label: 'CGST %', w: isA5 ? 30 : 42, align: 'center' },
    { label: 'CGST Amt', w: isA5 ? 42 : 58, align: 'right' },
    { label: 'SGST %', w: isA5 ? 30 : 42, align: 'center' },
    { label: 'SGST Amt', w: isA5 ? 42 : 58, align: 'right' },
    { label: 'Total Tax', w: isA5 ? 48 : 66, align: 'right' },
    { label: 'Round Off', w: isA5 ? 36 : 50, align: 'right' },
    { label: 'Net Grand Total', w: isA5 ? (contentWidth - 284) : (contentWidth - 394), align: 'right' }
  ];

  // Draw Horizontal Tax Table Header
  doc.roundedRect(margin, curY, contentWidth, taxHeaderH, R_SM).fill(COLOR_TEAL);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(isA5 ? 5.5 : 7.2);
  let txX = margin;
  for (let i = 0; i < taxCols.length; i++) {
    const col = taxCols[i];
    doc.text(col.label, txX + 2, curY + (isA5 ? 3.5 : 4.5), { width: col.w - 4, align: col.align });
    txX += col.w;
    if (i < taxCols.length - 1) {
      doc.moveTo(txX, curY + 2).lineTo(txX, curY + taxHeaderH - 2).strokeColor('#003B40').lineWidth(0.75).stroke();
    }
  }
  curY += taxHeaderH;

  // Calculate tax breakdown values
  const isTaxExclusive = quotation.is_tax_inclusive === 0 || quotation.is_tax_inclusive === false || quotation.is_tax_exclusive === true;
  let taxableVal = Number(quotation.subtotal) || 0;
  let gstRateVal = Number(quotation.gst_rate) || 18;
  let totalTaxVal = Number(quotation.gst_amount) || 0;
  let roundOffVal = Number(quotation.rounded_off) || 0;
  let grandTotalVal = Number(quotation.grand_total) || 0;

  if (!isTaxExclusive) {
    // Tax inclusive reverse calculation
    const netBefore = quotation.subtotal - (quotation.discount_amount || 0);
    taxableVal = gstRateVal > 0 ? Math.round((netBefore / (1 + (gstRateVal / 100))) * 100) / 100 : netBefore;
    totalTaxVal = Math.round((netBefore - taxableVal) * 100) / 100;
  }

  const halfRateStr = (gstRateVal / 2).toFixed(2);
  const halfTaxVal = Math.round((totalTaxVal / 2) * 100) / 100;

  // Draw Horizontal Tax Data Row
  doc.rect(margin, curY, contentWidth, taxRowH).fillAndStroke('#FFFFFF', COLOR_BORDER);

  // Grand Total cell accent highlight
  const lastColW = taxCols[7].w;
  const lastColX = margin + contentWidth - lastColW;
  doc.rect(lastColX, curY, lastColW, taxRowH).fill(COLOR_LIME);

  txX = margin;
  const taxValues = [
    formatINR(taxableVal),
    `${halfRateStr}%`,
    formatINR(halfTaxVal),
    `${halfRateStr}%`,
    formatINR(halfTaxVal),
    formatINR(totalTaxVal),
    roundOffVal !== 0 ? formatINR(roundOffVal) : '0.00',
    formatINR(grandTotalVal)
  ];

  for (let i = 0; i < taxCols.length; i++) {
    const col = taxCols[i];
    if (i === 7) {
      doc.fillColor(COLOR_TEAL_DARK).font('Helvetica-Bold').fontSize(isA5 ? 6.8 : 8.8);
    } else {
      doc.fillColor(COLOR_TEXT).font(i === 0 || i === 5 ? 'Helvetica-Bold' : 'Helvetica').fontSize(isA5 ? 5.8 : 7.2);
    }
    doc.text(taxValues[i], txX + 2, curY + (isA5 ? 3.5 : 4.5), { width: col.w - 4, align: col.align });
    txX += col.w;
    if (i < taxCols.length - 1) {
      doc.moveTo(txX, curY).lineTo(txX, curY + taxRowH).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();
    }
  }
  curY += taxRowH;

  // Full-width Amount in Words strip with left accent border callout
  doc.rect(margin, curY, contentWidth, wordsRowH).fillAndStroke('#F8FAFC', COLOR_BORDER);
  doc.rect(margin, curY, isA5 ? 3.5 : 4.5, wordsRowH).fill(COLOR_TEAL);
  doc.fillColor(COLOR_TEAL).font('Helvetica-Bold').fontSize(isA5 ? 5.2 : 6.8)
     .text('Amount in Words:', margin + 8, curY + (isA5 ? 3.5 : 4.5), { continued: true })
     .fillColor(COLOR_TEXT).font('Helvetica-Oblique')
     .text(`  ${numberToIndianWords(grandTotalVal)}`, { width: contentWidth - 16 });

  // ==========================================
  // 2. Bank Details Last Horizontal Columns (Full Width)
  // ==========================================
  curY = targetBankY;
  doc.roundedRect(margin, curY, contentWidth, bankCardHeight, R_CARD)
     .fillAndStroke('#F8FAFC', COLOR_BORDER);

  // 4 Horizontal Columns:
  // Col 1: Bank & Settlement Details
  // Col 2: Terms & Conditions
  // Col 3: UPI QR Code
  // Col 4: Authorised Signatory

  const bCol1W = isA5 ? 112 : 156;
  const bCol2W = isA5 ? 120 : 166;
  const bCol3W = isA5 ? 56 : 76;
  const bCol4W = contentWidth - bCol1W - bCol2W - bCol3W;

  // Col 1: Bank & Settlement (Executive 5-Line Structure)
  let cx = margin;
  doc.fillColor(COLOR_TEAL).font('Helvetica-Bold').fontSize(isA5 ? 6 : 7.8)
     .text('BANK DETAILS:', cx + 6, curY + (isA5 ? 4 : 5));

  const accName = settings.bank_account_name || 'Udhayam Agencies';
  const accNo = settings.bank_account_no || '6659330152';
  const bName = settings.bank_name || 'Indian Bank';
  let bBranch = settings.bank_branch || 'Perundurai Branch';
  if (!bBranch.toLowerCase().includes('branch')) bBranch = `${bBranch} Branch`;
  const ifscRaw = (settings.bank_ifsc || 'IDIB000P034').trim();
  const ifscLine = ifscRaw.startsWith('IFSC') ? ifscRaw : `IFSC - ${ifscRaw}`;

  // Line 1: Account Name (Udhayam Agencies)
  doc.fillColor(COLOR_TEXT).font('Helvetica-Bold').fontSize(isA5 ? 6.2 : 8.2)
     .text(accName, cx + 6, curY + (isA5 ? 13 : 16), { width: bCol1W - 10 });

  // Line 2: Account Number (6659330152)
  doc.font('Helvetica-Bold').fontSize(isA5 ? 6.2 : 8.2)
     .text(accNo, cx + 6, curY + (isA5 ? 22 : 27), { width: bCol1W - 10 });

  // Line 3: Bank Name (Indian Bank)
  doc.font('Helvetica').fontSize(isA5 ? 5.5 : 7.2)
     .text(bName, cx + 6, curY + (isA5 ? 31 : 38), { width: bCol1W - 10 });

  // Line 4: Branch Name (Perundurai Branch)
  doc.text(bBranch, cx + 6, curY + (isA5 ? 39 : 48), { width: bCol1W - 10 });

  // Line 5: IFSC (IFSC - IDIB000P034)
  doc.font('Helvetica-Bold').fillColor(COLOR_TEAL).fontSize(isA5 ? 5.8 : 7.5)
     .text(ifscLine, cx + 6, curY + (isA5 ? 48 : 59), { width: bCol1W - 10 });

  // Vertical Divider 1
  cx += bCol1W;
  doc.moveTo(cx, curY + 4).lineTo(cx, curY + bankCardHeight - 4).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();

  // Col 2: Terms & Conditions
  doc.fillColor(COLOR_TEAL).font('Helvetica-Bold').fontSize(isA5 ? 5.5 : 7.2)
     .text('TERMS & CONDITIONS:', cx + 6, curY + 5);
  doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(isA5 ? 4.5 : 5.8)
     .text(
       quotation.notes || settings.default_terms || '1. Quotation valid for 7 days.\n2. Goods once sold will not be taken back.\n3. Delivery subject to physical stock.\n4. GST and Transport as applicable.',
       cx + 6, curY + (isA5 ? 14 : 17),
       { width: bCol2W - 12, height: bankCardHeight - 20, lineGap: 1 }
     );

  // Vertical Divider 2
  cx += bCol2W;
  doc.moveTo(cx, curY + 4).lineTo(cx, curY + bankCardHeight - 4).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();

  // Col 3: UPI QR Code Card
  const qrSize = isA5 ? 34 : 46;
  const qrSource = getQrSource(settings);
  if (qrSource) {
    try {
      const qrImgX = cx + (bCol3W - qrSize) / 2;
      const qrImgY = curY + (isA5 ? 4 : 5);
      doc.image(qrSource, qrImgX, qrImgY, { fit: [qrSize, qrSize] });
      doc.fillColor(COLOR_TEAL_DARK).font('Helvetica-Bold').fontSize(isA5 ? 4.2 : 5.2)
         .text('SCAN TO PAY UPI', cx, qrImgY + qrSize + (isA5 ? 2.5 : 3.5), { width: bCol3W, align: 'center' });
    } catch (e) {
      console.warn('QR render error:', e.message);
    }
  }

  // Vertical Divider 3
  cx += bCol3W;
  doc.moveTo(cx, curY + 4).lineTo(cx, curY + bankCardHeight - 4).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();

  // Col 4: Authorised Signatory
  doc.fillColor(COLOR_TEXT).font('Helvetica-Bold').fontSize(isA5 ? 5.2 : 6.8)
     .text('Customer Acceptance', cx + 6, curY + 5)
     .text(`For ${settings.company_name || 'UDHAYAM AGENCIES'}`, cx + 6, curY + (isA5 ? 24 : 30), { width: bCol4W - 10, align: 'right' });

  // Dotted signature lines
  doc.moveTo(cx + 6, curY + (isA5 ? 17 : 21)).lineTo(cx + (isA5 ? 50 : 70), curY + (isA5 ? 17 : 21)).dash(2, { space: 2 }).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();
  doc.moveTo(cx + bCol4W - (isA5 ? 65 : 85), curY + bankCardHeight - (isA5 ? 10 : 13)).lineTo(cx + bCol4W - 6, curY + bankCardHeight - (isA5 ? 10 : 13)).dash(2, { space: 2 }).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();
  doc.undash();

  doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(isA5 ? 4.2 : 5.5)
     .text('Signature / Seal', cx + 6, curY + (isA5 ? 19 : 23))
     .text('Authorised Signatory', cx + 6, curY + bankCardHeight - (isA5 ? 8 : 11), { width: bCol4W - 10, align: 'right' });

  // Footer Page Numbering across all pages (zero bottom margin prevents auto-addPage!)
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // CRITICAL: Prevents PDFKit from creating extra page!
    doc.fillColor(COLOR_MUTED)
       .font('Helvetica')
       .fontSize(6)
       .text(
         `Page ${i + 1} of ${range.count} | Quotation: ${quotation.quotation_number} | Computer-generated quotation`,
         margin,
         pageHeight - 12,
         { width: contentWidth, align: 'center', lineBreak: false }
       );
  }

  doc.end();
  return bufferPromise;
}

/**
 * Generate Product Price List PDF in A4 or A5 layout
 * Required columns exact order:
 * 1. S. No. | 2. Item Name | 3. Details | 4. Sales Rate | 5. Qty (blank) | 6. Unit | 7. HSN
 */
function generatePriceListPdf(products, sectionName, paperFormat, settings, res) {
  const isA5 = paperFormat === 'A5';

  const doc = new PDFDocument({
    size: isA5 ? 'A5' : 'A4',
    compress: false,
    margins: {
      top: isA5 ? 16 : 24,
      bottom: isA5 ? 14 : 20,
      left: isA5 ? 16 : 24,
      right: isA5 ? 16 : 24
    },
    bufferPages: true,
    info: {
      Title: `Price List - ${sectionName}`,
      Author: 'Udhayam Agencies - Paint Division',
      Subject: 'Official Product Price List'
    }
  });

  let bufferPromise = null;
  if (res && typeof res.on === 'function') {
    doc.pipe(res);
  } else {
    bufferPromise = new Promise((resolve, reject) => {
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
  }

  const margin = isA5 ? 16 : 24;
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const contentWidth = pageWidth - margin * 2;
  const logoSource = getLogoSource(settings);

  const colDef = [
    { label: 'S. No.', width: isA5 ? 24 : 30, align: 'center' },
    { label: 'Item Name', width: isA5 ? (contentWidth - 216) : (contentWidth - 275), align: 'left' },
    { label: 'Details', width: isA5 ? 36 : 46, align: 'left' },
    { label: 'Sales Rate (Rs.)', width: isA5 ? 44 : 58, align: 'right' },
    { label: 'Qty', width: isA5 ? 34 : 43, align: 'center' }, // Blank column for manual write-in
    { label: 'Unit', width: isA5 ? 36 : 44, align: 'center' },
    { label: 'HSN', width: isA5 ? 42 : 54, align: 'center' }
  ];

  function drawHeaderBanner(y) {
    doc.roundedRect(margin, y, contentWidth, isA5 ? 42 : 50, isA5 ? 6 : 8).fill(COLOR_TEAL);

    let tX = margin + 6;
    if (logoSource) {
      try {
        doc.image(logoSource, margin + 4, y + (isA5 ? 4 : 6), {
          fit: [isA5 ? 60 : 75, isA5 ? 32 : 38]
        });
        tX = margin + (isA5 ? 70 : 86);
      } catch (e) {}
    }

    doc.fillColor('#FFFFFF')
       .font('Helvetica-Bold')
       .fontSize(isA5 ? 10 : 13)
       .text(settings.company_name || 'UDHAYAM AGENCIES', tX, y + (isA5 ? 6 : 8));

    doc.font('Helvetica-Bold')
       .fontSize(isA5 ? 6.5 : 8)
       .fillColor(COLOR_LIME)
       .text(`Paint Division — Price List [${sectionName}]`, tX, y + (isA5 ? 18 : 22));

    doc.font('Helvetica')
       .fontSize(isA5 ? 5.5 : 7)
       .fillColor('#E2E8F0')
       .text(`Generated: ${new Date().toLocaleDateString('en-IN')} | All Rates Inclusive of GST`, tX, y + (isA5 ? 28 : 33));

    return y + (isA5 ? 46 : 56);
  }

  function drawTableHeaders(y) {
    doc.rect(margin, y, contentWidth, isA5 ? 14 : 17).fill(COLOR_TEAL_DARK);
    doc.fillColor('#FFFFFF')
       .font('Helvetica-Bold')
       .fontSize(isA5 ? 6 : 7.5);

    let x = margin;
    for (const col of colDef) {
      doc.text(col.label, x + 2, y + (isA5 ? 3.5 : 4.5), { width: col.width - 4, align: col.align });
      x += col.width;
    }
    return y + (isA5 ? 15 : 18);
  }

  let curY = drawHeaderBanner(margin);
  curY = drawTableHeaders(curY);

  let rowIdx = 0;
  for (const p of products) {
    const rowHeight = isA5 ? 13 : 16;

    if (curY + rowHeight > pageHeight - 25) {
      doc.addPage();
      curY = drawHeaderBanner(margin);
      curY = drawTableHeaders(curY);
    }

    const isEven = rowIdx % 2 === 0;
    if (isEven) {
      doc.rect(margin, curY, contentWidth, rowHeight).fill('#F8FAFC');
    }
    doc.rect(margin, curY, contentWidth, rowHeight).stroke(COLOR_BORDER);

    let x = margin;
    doc.fillColor(COLOR_TEXT).font('Helvetica').fontSize(isA5 ? 5.5 : 7);

    // 1. S. No.
    doc.text(String(p.s_no || (rowIdx + 1)), x + 2, curY + (isA5 ? 2.5 : 3.5), { width: colDef[0].width - 4, align: 'center' });
    x += colDef[0].width;

    // 2. Item Name
    doc.font('Helvetica-Bold')
       .text(p.item_name || '', x + 3, curY + (isA5 ? 2.5 : 3.5), { width: colDef[1].width - 5, height: rowHeight - 2, ellipsis: true });
    x += colDef[1].width;

    // 3. Details
    doc.font('Helvetica')
       .text(p.details || '', x + 2, curY + (isA5 ? 2.5 : 3.5), { width: colDef[2].width - 4, align: 'left', ellipsis: true });
    x += colDef[2].width;

    // 4. Sales Rate
    doc.font('Helvetica-Bold')
       .text(Number(p.sale_rate || 0).toFixed(2), x + 2, curY + (isA5 ? 2.5 : 3.5), { width: colDef[3].width - 4, align: 'right' });
    x += colDef[3].width;

    // 5. Qty (Blank entry space)
    doc.rect(x + 2, curY + 1.5, colDef[4].width - 4, rowHeight - 3).stroke('#E2E8F0');
    x += colDef[4].width;

    // 6. Unit
    doc.font('Helvetica')
       .text(p.main_unit || 'Nos', x + 2, curY + (isA5 ? 2.5 : 3.5), { width: colDef[5].width - 4, align: 'center' });
    x += colDef[5].width;

    // 7. HSN
    doc.text(p.hsn_sac || '', x + 2, curY + (isA5 ? 2.5 : 3.5), { width: colDef[6].width - 4, align: 'center' });

    curY += rowHeight;
    rowIdx++;
  }

  // Footer page numbering
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0;
    doc.fillColor(COLOR_MUTED)
       .font('Helvetica')
       .fontSize(5.5)
       .text(
         `Page ${i + 1} of ${range.count} | Udhayam Agencies - Paint Division Price List (${sectionName}) | Rates incl. GST`,
         margin,
         pageHeight - 10,
         { width: contentWidth, align: 'center', lineBreak: false }
       );
  }

  doc.end();
  return bufferPromise;
}

module.exports = {
  generateQuotationPdf,
  generatePriceListPdf
};
