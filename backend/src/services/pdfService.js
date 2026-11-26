const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { numberToIndianWords, formatINR } = require('../utils/numberToWords');
const { resolveUploadedFile } = require('../utils/storagePaths');
const { formatToDMY } = require('../utils/dateHelper');
const { calculateQuotationFinancials, validateQuotationIntegrity } = require('../utils/quotationEngine');
const { resolveQuotationQrSource } = require('./qrService');

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

/**
 * Generate Dynamic Quotation PDF in A4 or A5 layout
 * Complete Single-Page & Multi-Page Pagination Standard
 * Consumes Canonical Quotation Engine & Dynamic QR Service
 */
async function generateQuotationPdf(quotation, settings = {}, res = null) {
  // 1. Run Pre-Generation Quality Control & Financial Engine
  const isTaxInclusive = quotation.is_tax_inclusive === 1 || quotation.is_tax_inclusive === true;
  const financials = calculateQuotationFinancials({
    items: quotation.items || [],
    discount_percent: quotation.discount_percent,
    discount_amount: quotation.discount_amount,
    is_tax_inclusive: isTaxInclusive,
    default_gst_rate: quotation.gst_rate || settings.default_gst_rate || 18,
    delivery_charges: quotation.delivery_charges || 0,
    company_state_code: settings.company_state_code || '33',
    customer_gstin: quotation.customer_gstin || '',
    customer_state_code: quotation.customer_state_code || ''
  });

  const isA5 = quotation.paper_format === 'A5';

  const doc = new PDFDocument({
    size: isA5 ? 'A5' : 'A4',
    compress: false,
    margins: {
      top: isA5 ? 16 : 24,
      bottom: isA5 ? 6 : 8,
      left: isA5 ? 16 : 24,
      right: isA5 ? 16 : 24
    },
    bufferPages: true,
    info: {
      Title: `Quotation ${quotation.quotation_number}`,
      Author: `${settings.company_name || 'Udhayam Agencies'} - ${settings.company_division || 'Paint Division'}`,
      Subject: `Quotation for ${quotation.customer_name || 'Valued Customer'}`
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

  // Dynamic QR code generated directly from live UPI data
  const qrBuffer = await resolveQuotationQrSource(quotation, settings);

  // Corner radii
  const R_CARD = isA5 ? 6 : 8;
  const R_SM = isA5 ? 4 : 5;

  const quoteNoDisplay = quotation.quotation_number || 'UDQ-2026-0001';
  const quoteDateDisplay = formatToDMY(quotation.quotation_date) || formatToDMY(new Date());
  const validDateDisplay = formatToDMY(quotation.validity_date, quotation.quotation_date, 15);

  // Pre-calculate heights
  const headerHeight = isA5 ? 52 : 72;
  const accentHeight = isA5 ? 2.5 : 3.5;
  const infoBoxHeight = isA5 ? 56 : 72;
  const tableHeaderHeight = isA5 ? 15 : 19;
  const footerBarHeight = isA5 ? 16 : 20;
  const bankCardHeight = isA5 ? 56 : 70;

  const taxSlabs = financials.taxSlabs || [];
  const taxHeaderH = isA5 ? 12 : 15;
  const taxRowH = isA5 ? 13 : 16;
  const wordsRowH = isA5 ? 12 : 15;
  const numTaxRows = taxSlabs.length > 1 ? (taxSlabs.length + 1) : 1;
  const taxTableHeight = taxHeaderH + (numTaxRows * taxRowH) + wordsRowH;
  const bottomBlocksHeight = taxTableHeight + (isA5 ? 4 : 6) + bankCardHeight + (isA5 ? 4 : 6) + footerBarHeight;

  // Exact 8 Columns matching corporate standard
  // # | ITEM DESCRIPTION & SPECIFICATIONS | HSN | QTY | UNIT | RATE (Rs.) | TAX % | TOTAL (Rs.)
  const colDef = [
    { label: '#', width: isA5 ? 16 : 22, align: 'center' },
    { label: 'ITEM DESCRIPTION & SPECIFICATIONS', width: isA5 ? (contentWidth - 16 - 40 - 24 - 26 - 48 - 32 - 58) : (contentWidth - 22 - 52 - 32 - 34 - 64 - 42 - 76), align: 'left' },
    { label: 'HSN', width: isA5 ? 40 : 52, align: 'center' },
    { label: 'QTY', width: isA5 ? 24 : 32, align: 'center' },
    { label: 'UNIT', width: isA5 ? 26 : 34, align: 'center' },
    { label: 'RATE (Rs.)', width: isA5 ? 48 : 64, align: 'right' },
    { label: 'TAX %', width: isA5 ? 32 : 42, align: 'center' },
    { label: 'TOTAL (Rs.)', width: isA5 ? 58 : 76, align: 'right' }
  ];

  function drawTableHeader(y) {
    doc.roundedRect(margin, y, contentWidth, tableHeaderHeight, R_SM).fill(COLOR_TEAL);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(isA5 ? 6 : 7.8);

    let x = margin;
    for (let i = 0; i < colDef.length; i++) {
      const col = colDef[i];
      doc.text(col.label, x + 2, y + (isA5 ? 4 : 5), { width: col.width - 4, align: col.align });
      x += col.width;
      if (i < colDef.length - 1) {
        doc.moveTo(x, y + 2).lineTo(x, y + tableHeaderHeight - 2).strokeColor('#003B40').lineWidth(0.75).stroke();
      }
    }
    doc.strokeColor(COLOR_BORDER).lineWidth(0.5);
    return y + tableHeaderHeight;
  }

  function drawVerticalGridLines(startY, endY) {
    let colX = margin;
    for (let i = 0; i < colDef.length - 1; i++) {
      colX += colDef[i].width;
      doc.moveTo(colX, startY).lineTo(colX, endY).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();
    }
  }

  function drawExecutiveHeader(topY) {
    doc.roundedRect(margin, topY, contentWidth, headerHeight, R_CARD).fill(COLOR_TEAL);
    doc.roundedRect(margin, topY + headerHeight - accentHeight, contentWidth, accentHeight, 1).fill(COLOR_LIME);

    let textLeft = margin + (isA5 ? 6 : 10);
    if (logoSource) {
      try {
        const logoBoxW = isA5 ? 46 : 60;
        const logoBoxH = isA5 ? 46 : 60;
        const pad = isA5 ? 3 : 4;
        const boxX = margin + (isA5 ? 4 : 5);
        const boxY = topY + (isA5 ? 3 : 5);
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

    // Company Details
    doc.fillColor('#FFFFFF')
       .font('Helvetica-Bold')
       .fontSize(isA5 ? 11 : 15)
       .text(settings.company_name || 'UDHAYAM AGENCIES', textLeft, topY + (isA5 ? 5 : 7));

    doc.font('Helvetica-Bold')
       .fontSize(isA5 ? 6.5 : 8.5)
       .fillColor(COLOR_LIME)
       .text(settings.company_division || 'PAINT DIVISION', textLeft, topY + (isA5 ? 17 : 24));

    doc.font('Helvetica')
       .fontSize(isA5 ? 5.5 : 7.2)
       .fillColor('#E2E8F0')
       .text(settings.company_address || '41/10, KMR Complex, Old Bus Stand Road, Perundurai, Erode - 638052', textLeft, topY + (isA5 ? 25 : 35), { width: contentWidth - (textLeft - margin) - (isA5 ? 75 : 110) });

    doc.font('Helvetica')
       .fontSize(isA5 ? 5.5 : 7.2)
       .fillColor('#E2E8F0')
       .text(`Phone: ${settings.company_phone || '+91 97156 22499'} | GSTIN: ${settings.company_gstin || '33AADFU6496M1ZJ'}`, textLeft, topY + (isA5 ? 35 : 47));

    // Top-Right Header Elements (QUOTATION pill + Quote No + Date + Valid Till at page top)
    const badgeWidth = isA5 ? 64 : 86;
    const badgeHeight = isA5 ? 15 : 18;
    const badgeX = pageWidth - margin - badgeWidth - (isA5 ? 5 : 8);
    const badgeY = topY + (isA5 ? 4 : 6);

    doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, R_SM).fill(COLOR_LIME);
    doc.fillColor(COLOR_TEAL_DARK)
       .font('Helvetica-Bold')
       .fontSize(isA5 ? 7 : 9)
       .text('QUOTATION', badgeX, badgeY + (isA5 ? 3.5 : 4.5), { width: badgeWidth, align: 'center' });

    const metaRightW = isA5 ? 100 : 135;
    const metaRightX = pageWidth - margin - metaRightW - (isA5 ? 5 : 8);
    const metaTopY = badgeY + badgeHeight + (isA5 ? 2.5 : 3.5);

    doc.fillColor('#FFFFFF')
       .font('Helvetica-Bold')
       .fontSize(isA5 ? 7.5 : 9.5)
       .text(quoteNoDisplay, metaRightX, metaTopY, { width: metaRightW, align: 'right' });

    doc.font('Helvetica')
       .fontSize(isA5 ? 5.8 : 7.2)
       .fillColor('#E2E8F0')
       .text(`Date: ${quoteDateDisplay}`, metaRightX, metaTopY + (isA5 ? 10 : 13), { width: metaRightW, align: 'right' });

    doc.font('Helvetica')
       .fontSize(isA5 ? 5.8 : 7.2)
       .fillColor('#E2E8F0')
       .text(`Valid Till: ${validDateDisplay}`, metaRightX, metaTopY + (isA5 ? 19 : 24), { width: metaRightW, align: 'right' });

    return topY + headerHeight + (isA5 ? 4 : 6);
  }

  function drawCustomerSubheader(y, isContinuation = false) {
    if (isContinuation) {
      const contH = isA5 ? 20 : 25;
      doc.roundedRect(margin, y, contentWidth, contH, R_SM).fillAndStroke('#F8FAFC', COLOR_BORDER);

      const pTerms = (quotation.payment_terms || 'Cash').trim();
      const leftParts = [`BILLED TO: ${quotation.customer_name || 'Customer'}`];
      if (quotation.customer_phone && quotation.customer_phone !== '-') leftParts.push(`Ph: ${quotation.customer_phone}`);
      if (quotation.customer_gstin) leftParts.push(`GSTIN: ${quotation.customer_gstin}`);

      doc.fillColor(COLOR_TEAL).font('Helvetica-Bold').fontSize(isA5 ? 5.5 : 7.2)
         .text(leftParts.join('  |  '), margin + 6, y + (isA5 ? 4.5 : 6), { width: contentWidth * 0.52, height: contH - 8, ellipsis: true });

      const rightText = `Quote: ${quoteNoDisplay}  •  Valid Till: ${validDateDisplay}  •  TERMS: ${pTerms.toUpperCase()}`;
      doc.font('Helvetica-Bold').fontSize(isA5 ? 5.5 : 7.2).fillColor(COLOR_TEXT)
         .text(rightText, margin + contentWidth * 0.52, y + (isA5 ? 4.5 : 6), { width: contentWidth * 0.46, align: 'right', ellipsis: true });

      return y + contH + (isA5 ? 3 : 5);
    }

    const boxH = isA5 ? 68 : 82;
    doc.roundedRect(margin, y, contentWidth, boxH, R_CARD).fillAndStroke('#FFFFFF', COLOR_BORDER);
    const colWidth = (contentWidth - 16) / 2;

    // Left: BILLED TO / CUSTOMER DETAILS
    doc.fillColor(COLOR_TEAL)
       .font('Helvetica-Bold')
       .fontSize(isA5 ? 6.5 : 8)
       .text('BILLED TO / CUSTOMER DETAILS:', margin + 8, y + (isA5 ? 4 : 6));

    doc.fillColor(COLOR_TEXT)
       .font('Helvetica-Bold')
       .fontSize(isA5 ? 8 : 10.5)
       .text(quotation.customer_name || 'Valued Customer', margin + 8, y + (isA5 ? 13 : 18), { width: colWidth, height: 12, ellipsis: true });

    let custDetailsY = y + (isA5 ? 24 : 32);
    const contactParts = [];
    if (quotation.customer_phone && quotation.customer_phone !== '-') {
      contactParts.push(`Phone: ${quotation.customer_phone}`);
    }
    if (quotation.customer_gstin) {
      contactParts.push(`GSTIN: ${quotation.customer_gstin}`);
    }
    if (contactParts.length > 0) {
      doc.font('Helvetica')
         .fontSize(isA5 ? 5.8 : 7.5)
         .fillColor(COLOR_MUTED)
         .text(contactParts.join('  |  '), margin + 8, custDetailsY, { width: colWidth, height: 10, ellipsis: true });
      custDetailsY += (isA5 ? 8 : 11);
    }

    if (quotation.customer_address) {
      doc.font('Helvetica')
         .fontSize(isA5 ? 5.5 : 7)
         .fillColor(COLOR_MUTED)
         .text(`Address: ${quotation.customer_address}`, margin + 8, custDetailsY, { width: colWidth, height: boxH - (custDetailsY - y) - 6, ellipsis: true });
    }

    // Vertical divider between Customer & Quote details
    doc.moveTo(margin + colWidth + 4, y + 6)
       .lineTo(margin + colWidth + 4, y + boxH - 6)
       .strokeColor(COLOR_BORDER)
       .lineWidth(0.5)
       .stroke();

    // Right: QUOTATION META
    const rightX = margin + colWidth + 10;
    const rightInnerW = colWidth - 10;

    doc.fillColor(COLOR_TEAL)
       .font('Helvetica-Bold')
       .fontSize(isA5 ? 6.5 : 8)
       .text('QUOTATION META:', rightX, y + (isA5 ? 4 : 6), { width: rightInnerW, align: 'right' });

    const metaLineY = y + (isA5 ? 14 : 18);
    const stepY = isA5 ? 10.5 : 13;

    // Line 1: Quote No
    doc.font('Helvetica').fontSize(isA5 ? 5.8 : 7.5).fillColor(COLOR_MUTED)
       .text(`Quote No: `, rightX, metaLineY, { width: rightInnerW - 75, align: 'right' });
    doc.font('Helvetica-Bold').fillColor(COLOR_TEXT)
       .text(quoteNoDisplay, rightX + rightInnerW - 72, metaLineY, { width: 72, align: 'right' });

    // Line 2: Date
    doc.font('Helvetica').fontSize(isA5 ? 5.8 : 7.5).fillColor(COLOR_MUTED)
       .text(`Date: `, rightX, metaLineY + stepY, { width: rightInnerW - 75, align: 'right' });
    doc.font('Helvetica-Bold').fillColor(COLOR_TEXT)
       .text(quoteDateDisplay, rightX + rightInnerW - 72, metaLineY + stepY, { width: 72, align: 'right' });

    // Line 3: Valid Till (Cleanly isolated on its own row, zero overlap!)
    doc.font('Helvetica').fontSize(isA5 ? 5.8 : 7.5).fillColor(COLOR_MUTED)
       .text(`Valid Till: `, rightX, metaLineY + stepY * 2, { width: rightInnerW - 75, align: 'right' });
    doc.font('Helvetica-Bold').fillColor(COLOR_TEXT)
       .text(validDateDisplay, rightX + rightInnerW - 72, metaLineY + stepY * 2, { width: 72, align: 'right' });

    // Line 4: Payment Terms Badge (Dedicated row 4, guaranteed gap below Valid Till)
    const pTerms = (quotation.payment_terms || 'Cash').trim();
    const isCredit = /credit/i.test(pTerms);
    const pillBg = isCredit ? '#FEF3C7' : '#DCFCE7';
    const pillFg = isCredit ? '#92400E' : '#166534';
    const pillBorder = isCredit ? '#FCD34D' : '#86EFAC';
    const pillW = isA5 ? 64 : 78;
    const pillH = isA5 ? 10 : 12;
    const pillX = rightX + rightInnerW - pillW;
    const pillY = metaLineY + stepY * 3 - (isA5 ? 1 : 1.5);

    doc.font('Helvetica').fontSize(isA5 ? 5.8 : 7.5).fillColor(COLOR_MUTED)
       .text('Payment Terms: ', rightX, metaLineY + stepY * 3, { width: rightInnerW - pillW - 6, align: 'right' });

    doc.roundedRect(pillX, pillY, pillW, pillH, 3).fillAndStroke(pillBg, pillBorder);
    doc.fillColor(pillFg)
       .font('Helvetica-Bold')
       .fontSize(isA5 ? 5 : 6.8)
       .text(`TERMS: ${pTerms.toUpperCase()}`, pillX, pillY + (isA5 ? 2 : 2.5), { width: pillW, align: 'center' });

    return y + boxH + (isA5 ? 4 : 6);
  }

  // Dynamic row height calculator supporting long multi-line names and specifications
  function getItemRowHeight(item) {
    const descColW = colDef[1].width - 6;
    doc.font('Helvetica-Bold').fontSize(isA5 ? 6.5 : 8);
    const nameH = doc.heightOfString(item.item_name || '', { width: descColW });
    let detailsH = 0;
    if (item.details && item.details.trim().length > 0) {
      doc.font('Helvetica-Oblique').fontSize(isA5 ? 5 : 6.5);
      detailsH = doc.heightOfString(item.details.trim(), { width: descColW }) + (isA5 ? 1 : 1.5);
    }
    const totalContentH = nameH + detailsH + (isA5 ? 5 : 7);
    const minH = (item.details && item.details.trim().length > 0) ? (isA5 ? 20 : 23) : (isA5 ? 15 : 18);
    return Math.max(minH, Math.ceil(totalContentH));
  }

  // Check if everything fits on a single page
  const items = financials.items || [];
  let estimatedTableHeight = 0;
  for (const it of items) {
    estimatedTableHeight += getItemRowHeight(it);
  }

  const spaceOnFirstPage = pageHeight - margin - headerHeight - (isA5 ? 4 : 6) - (isA5 ? 68 : 82) - (isA5 ? 4 : 6) - tableHeaderHeight - bottomBlocksHeight;
  const isSinglePageFit = estimatedTableHeight <= spaceOnFirstPage;

  let currentPageNum = 1;
  let curY = drawExecutiveHeader(margin);
  curY = drawCustomerSubheader(curY, false);

  // Table bottom limit
  const maxTableBottomY = isSinglePageFit
    ? (pageHeight - margin - bottomBlocksHeight)
    : (pageHeight - margin - footerBarHeight - 10);

  curY = drawTableHeader(curY);
  let currentPageTableStartY = curY;
  let rowIdx = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const rowHeight = getItemRowHeight(item);

    if (curY + rowHeight > maxTableBottomY) {
      // Close current page table
      drawVerticalGridLines(currentPageTableStartY, curY);
      doc.moveTo(margin, curY).lineTo(margin + contentWidth, curY).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();
      doc.rect(margin, currentPageTableStartY - tableHeaderHeight, contentWidth, curY - (currentPageTableStartY - tableHeaderHeight))
         .strokeColor(COLOR_BORDER).lineWidth(0.75).stroke();

      // Add new page with the same executive header & compact continuation customer subheader
      doc.addPage();
      currentPageNum++;
      curY = drawExecutiveHeader(margin);
      curY = drawCustomerSubheader(curY, true);
      curY = drawTableHeader(curY);
      currentPageTableStartY = curY;
    }

    const isEven = rowIdx % 2 === 0;
    doc.rect(margin, curY, contentWidth, rowHeight).fill(isEven ? '#FFFFFF' : '#F8FAFC');
    doc.moveTo(margin, curY + rowHeight).lineTo(margin + contentWidth, curY + rowHeight).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();

    let x = margin;
    // 1. #
    doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(isA5 ? 6 : 7.5);
    doc.text(String(rowIdx + 1), x + 2, curY + (isA5 ? 3 : 4.5), { width: colDef[0].width - 4, align: 'center' });
    x += colDef[0].width;

    // 2. ITEM DESCRIPTION & SPECIFICATIONS (Naturally wrapped multi-line text)
    doc.fillColor(COLOR_TEXT).font('Helvetica-Bold').fontSize(isA5 ? 6.5 : 8);
    const nameY = curY + (isA5 ? 2.5 : 3.5);
    doc.text(item.item_name || '', x + 3, nameY, { width: colDef[1].width - 6 });
    const nameTextH = doc.heightOfString(item.item_name || '', { width: colDef[1].width - 6 });

    if (item.details && item.details.trim().length > 0) {
      doc.font('Helvetica-Oblique')
         .fontSize(isA5 ? 5 : 6.5)
         .fillColor(COLOR_MUTED)
         .text(item.details.trim(), x + 3, nameY + nameTextH + (isA5 ? 1 : 1.5), { width: colDef[1].width - 6 });
    }
    x += colDef[1].width;

    // 3. HSN
    doc.font('Helvetica').fontSize(isA5 ? 6 : 7.5).fillColor(COLOR_MUTED);
    doc.text(item.hsn_sac || '-', x + 2, curY + (isA5 ? 3 : 4.5), { width: colDef[2].width - 4, align: 'center' });
    x += colDef[2].width;

    // 4. QTY
    doc.font('Helvetica-Bold').fillColor(COLOR_TEXT);
    doc.text(String(item.quantity || 1), x + 2, curY + (isA5 ? 3 : 4.5), { width: colDef[3].width - 4, align: 'center' });
    x += colDef[3].width;

    // 5. UNIT
    doc.font('Helvetica').fontSize(isA5 ? 6 : 7.5).fillColor(COLOR_MUTED);
    doc.text(item.unit || 'Nos', x + 2, curY + (isA5 ? 3 : 4.5), { width: colDef[4].width - 4, align: 'center' });
    x += colDef[4].width;

    // 6. RATE (Rs.)
    doc.font('Helvetica').fillColor(COLOR_TEXT);
    doc.text(Number(item.sale_rate || 0).toFixed(2), x + 2, curY + (isA5 ? 3 : 4.5), { width: colDef[5].width - 4, align: 'right' });
    x += colDef[5].width;

    // 7. TAX % (5%, 12%, 18%, 28%, 0%)
    const itemTaxRate = item.tax_percent != null ? parseFloat(item.tax_percent) : (parseFloat(quotation.gst_rate) || 18);
    doc.font('Helvetica-Bold').fillColor(COLOR_TEXT);
    doc.text(`${itemTaxRate}%`, x + 2, curY + (isA5 ? 3 : 4.5), { width: colDef[6].width - 4, align: 'center' });
    x += colDef[6].width;

    // 8. TOTAL (Rs.)
    doc.font('Helvetica-Bold').fillColor(COLOR_TEXT);
    doc.text(Number(item.line_total || 0).toFixed(2), x + 2, curY + (isA5 ? 3 : 4.5), { width: colDef[7].width - 4, align: 'right' });

    curY += rowHeight;
    rowIdx++;
  }

  // Gracefully extend vertical lines down
  const endTableY = isSinglePageFit ? Math.max(curY, maxTableBottomY) : curY;
  drawVerticalGridLines(currentPageTableStartY, endTableY);
  doc.moveTo(margin, endTableY).lineTo(margin + contentWidth, endTableY).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();
  doc.rect(margin, currentPageTableStartY - tableHeaderHeight, contentWidth, endTableY - (currentPageTableStartY - tableHeaderHeight))
     .strokeColor(COLOR_BORDER).lineWidth(0.75).stroke();

  // If multi-page and not enough room for bottom cards on current page, wrap to final summary page with same header/subheader
  const remainingVertical = pageHeight - margin - footerBarHeight - endTableY;
  if (!isSinglePageFit && remainingVertical < (bottomBlocksHeight - footerBarHeight)) {
    doc.addPage();
    currentPageNum++;
    curY = drawExecutiveHeader(margin);
    curY = drawCustomerSubheader(curY, true);
  } else if (!isSinglePageFit) {
    curY = endTableY + (isA5 ? 6 : 8);
  } else {
    curY = endTableY + (isA5 ? 4 : 6);
  }

  // -------------------------------------------------------------
  // 1. HORIZONTAL TAX BREAKDOWN TABLE (FULL WIDTH)
  // Multi-Rate GST Support (5%, 12%, 18%, 28%)
  // -------------------------------------------------------------
  const taxCols = [
    { label: 'TAXABLE VALUE', w: isA5 ? 56 : 78, align: 'right' },
    { label: financials.isInterstate ? 'IGST %' : 'CGST %', w: isA5 ? 30 : 42, align: 'center' },
    { label: financials.isInterstate ? 'IGST AMT' : 'CGST AMT', w: isA5 ? 42 : 58, align: 'right' },
    { label: financials.isInterstate ? 'STATE' : 'SGST %', w: isA5 ? 30 : 42, align: 'center' },
    { label: financials.isInterstate ? 'TYPE' : 'SGST AMT', w: isA5 ? 42 : 58, align: 'right' },
    { label: 'TOTAL TAX', w: isA5 ? 48 : 66, align: 'right' },
    { label: 'ROUND OFF', w: isA5 ? 42 : 58, align: 'right' },
    { label: 'NET GRAND TOTAL', w: contentWidth - (isA5 ? (56 + 30 + 42 + 30 + 42 + 48 + 42) : (78 + 42 + 58 + 42 + 58 + 66 + 58)), align: 'right' }
  ];

  // Draw Tax Header
  doc.roundedRect(margin, curY, contentWidth, taxHeaderH, R_SM).fill(COLOR_TEAL);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(isA5 ? 5.5 : 7.2);

  let txX = margin;
  for (let i = 0; i < taxCols.length; i++) {
    const col = taxCols[i];
    doc.text(col.label, txX + 2, curY + (isA5 ? 3 : 4), { width: col.w - 4, align: col.align });
    txX += col.w;
    if (i < taxCols.length - 1) {
      doc.moveTo(txX, curY + 2).lineTo(txX, curY + taxHeaderH - 2).strokeColor('#003B40').lineWidth(0.75).stroke();
    }
  }
  curY += taxHeaderH;

  const lastColW = taxCols[7].w;
  const lastColX = margin + contentWidth - lastColW;

  // Draw individual rate slab rows if multi-rate
  if (taxSlabs.length > 1) {
    for (const slab of taxSlabs) {
      doc.rect(margin, curY, contentWidth, taxRowH).fillAndStroke('#F8FAFC', COLOR_BORDER);
      txX = margin;
      const slabValues = [
        formatINR(slab.taxableValue),
        slab.isInterstate ? `${slab.igstPercent.toFixed(2)}%` : `${slab.cgstPercent.toFixed(2)}%`,
        formatINR(slab.isInterstate ? slab.igstAmount : slab.cgstAmount),
        slab.isInterstate ? 'INTER' : `${slab.sgstPercent.toFixed(2)}%`,
        slab.isInterstate ? 'STATE' : formatINR(slab.sgstAmount),
        formatINR(slab.totalTaxAmount),
        '—',
        '—'
      ];

      for (let i = 0; i < taxCols.length; i++) {
        const col = taxCols[i];
        doc.fillColor(COLOR_TEXT).font(i === 0 || i === 5 ? 'Helvetica-Bold' : 'Helvetica').fontSize(isA5 ? 5.5 : 6.8);
        doc.text(slabValues[i], txX + 2, curY + (isA5 ? 2.5 : 3.5), { width: col.w - 4, align: col.align });
        txX += col.w;
        if (i < taxCols.length - 1) {
          doc.moveTo(txX, curY + 2).lineTo(txX, curY + taxRowH).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();
        }
      }
      curY += taxRowH;
    }
  }

  // Summary / Net Grand Total Row
  doc.rect(margin, curY, contentWidth, taxRowH).fillAndStroke('#FFFFFF', COLOR_BORDER);
  doc.rect(lastColX, curY, lastColW, taxRowH).fill(COLOR_LIME);

  const singleCgstPct = taxSlabs.length === 1 ? (financials.isInterstate ? `${taxSlabs[0].igstPercent.toFixed(2)}%` : `${taxSlabs[0].cgstPercent.toFixed(2)}%`) : 'TOTAL';
  const singleSgstPct = taxSlabs.length === 1 ? (financials.isInterstate ? 'INTER' : `${taxSlabs[0].sgstPercent.toFixed(2)}%`) : (financials.isInterstate ? 'STATE' : 'TOTAL');

  txX = margin;
  const taxValues = [
    formatINR(financials.taxableValue),
    singleCgstPct,
    formatINR(financials.isInterstate ? financials.totalIgst : financials.totalCgst),
    singleSgstPct,
    financials.isInterstate ? 'STATE' : formatINR(financials.totalSgst),
    formatINR(financials.totalTaxAmount),
    financials.roundedOff !== 0 ? formatINR(financials.roundedOff) : '0.00',
    formatINR(financials.grandTotal)
  ];

  for (let i = 0; i < taxCols.length; i++) {
    const col = taxCols[i];
    if (i === 7) {
      doc.fillColor(COLOR_TEAL_DARK).font('Helvetica-Bold').fontSize(isA5 ? 6.8 : 8.8);
    } else {
      doc.fillColor(COLOR_TEXT).font('Helvetica-Bold').fontSize(isA5 ? 5.8 : 7.2);
    }
    doc.text(taxValues[i], txX + 2, curY + (isA5 ? 3 : 4), { width: col.w - 4, align: col.align });
    txX += col.w;
    if (i < taxCols.length - 1) {
      doc.moveTo(txX, curY + 2).lineTo(txX, curY + taxRowH).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();
    }
  }
  curY += taxRowH;

  // Words & GST Pill Bar
  doc.rect(margin, curY, contentWidth, wordsRowH).fillAndStroke('#F8FAFC', COLOR_BORDER);
  const wordsText = `Amount in Words: ${financials.amountInWords}`;
  doc.fillColor(COLOR_TEXT).font('Helvetica-Oblique').fontSize(isA5 ? 5.5 : 7.2)
     .text(wordsText, margin + 6, curY + (isA5 ? 2.5 : 3.5), { width: contentWidth - (isA5 ? 90 : 120), height: wordsRowH - 2, ellipsis: true });

  const gstPillW = isA5 ? 75 : 100;
  const gstPillH = wordsRowH - 4;
  const gstPillX = margin + contentWidth - gstPillW - 3;
  const gstPillY = curY + 2;
  doc.roundedRect(gstPillX, gstPillY, gstPillW, gstPillH, 2).fill('#DCFCE7');
  doc.fillColor('#166534').font('Helvetica-Bold').fontSize(isA5 ? 5 : 6.8)
     .text(financials.isInterstate ? 'IGST Applicable' : 'GST Invoice Applicable', gstPillX, gstPillY + (isA5 ? 1.5 : 2), { width: gstPillW, align: 'center' });

  curY += wordsRowH + (isA5 ? 4 : 6);

  // -------------------------------------------------------------
  // 2. BANK DETAILS & TERMS HORIZONTAL COLUMNS (FULL WIDTH CARD)
  // Exact Structure Requested:
  // Bank Details:
  // Udhayam Agencies
  // ACC No: 6659330152
  // IFSC Code: IDIB000P155
  // Indian Bank - Perundurai Branch
  // -------------------------------------------------------------
  doc.roundedRect(margin, curY, contentWidth, bankCardHeight, R_CARD)
     .fillAndStroke('#F8FAFC', COLOR_BORDER);

  const bCol1W = isA5 ? 116 : 160;
  const bCol2W = isA5 ? 116 : 162;
  const bCol3W = isA5 ? 54 : 74;
  const bCol4W = contentWidth - bCol1W - bCol2W - bCol3W;

  // Col 1: Bank & Settlement (Executive Structure with IDIB000P155)
  let cx = margin;
  doc.fillColor(COLOR_TEAL).font('Helvetica-Bold').fontSize(isA5 ? 6 : 7.8)
     .text('BANK DETAILS:', cx + 6, curY + (isA5 ? 4 : 5));

  const accName = settings.bank_account_name || 'Udhayam Agencies';
  const accNo = settings.bank_account_no || '6659330152';
  const bName = settings.bank_name || 'Indian Bank';
  let bBranch = settings.bank_branch || 'Perundurai Branch';
  if (!bBranch.toLowerCase().includes('branch')) bBranch = `${bBranch} Branch`;
  const ifscRaw = (settings.bank_ifsc || 'IDIB000P155').trim();
  const ifscClean = ifscRaw.replace(/^IFSC\s*(Code)?\s*[:\-]\s*/i, '');

  doc.fillColor(COLOR_TEXT).font('Helvetica-Bold').fontSize(isA5 ? 6 : 8)
     .text(accName, cx + 6, curY + (isA5 ? 12 : 15), { width: bCol1W - 10 });
  doc.font('Helvetica-Bold').fontSize(isA5 ? 6 : 8)
     .text(`ACC No: ${accNo}`, cx + 6, curY + (isA5 ? 20 : 25), { width: bCol1W - 10 });
  doc.font('Helvetica').fontSize(isA5 ? 5.2 : 7)
     .text(`${bName} - ${bBranch}`, cx + 6, curY + (isA5 ? 28 : 35), { width: bCol1W - 10 });
  doc.font('Helvetica-Bold').fillColor(COLOR_TEAL).fontSize(isA5 ? 5.5 : 7.2)
     .text(`IFSC Code: ${ifscClean}`, cx + 6, curY + (isA5 ? 36 : 45), { width: bCol1W - 10 });

  // Vertical Divider 1
  cx += bCol1W;
  doc.moveTo(cx, curY + 4).lineTo(cx, curY + bankCardHeight - 4).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();

  // Col 2: Terms & Conditions
  doc.fillColor(COLOR_TEAL).font('Helvetica-Bold').fontSize(isA5 ? 5.5 : 7.2)
     .text('TERMS & CONDITIONS:', cx + 6, curY + (isA5 ? 4 : 5));

  const officialTerms = '1. Quotation valid for 15 days from date of issue.\n2. Goods once sold will not be taken back or exchanged.\n3. 100% payment on delivery / as per agreed terms.\n4. Subject to Perundurai jurisdiction only.';

  doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(isA5 ? 4.5 : 5.8)
     .text(officialTerms, cx + 6, curY + (isA5 ? 13 : 16), { width: bCol2W - 12, height: bankCardHeight - 18, lineGap: 1.2 });

  // Vertical Divider 2
  cx += bCol2W;
  doc.moveTo(cx, curY + 4).lineTo(cx, curY + bankCardHeight - 4).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();

  // Col 3: Dynamic UPI QR Code Card (Guaranteed latest UPI ID)
  const qrSize = isA5 ? 32 : 44;
  if (qrBuffer) {
    try {
      const qrImgX = cx + (bCol3W - qrSize) / 2;
      const qrImgY = curY + (isA5 ? 4 : 5);
      doc.image(qrBuffer, qrImgX, qrImgY, { fit: [qrSize, qrSize] });
      doc.fillColor(COLOR_TEAL_DARK).font('Helvetica-Bold').fontSize(isA5 ? 4 : 5)
         .text('SCAN TO PAY UPI', cx, qrImgY + qrSize + (isA5 ? 2 : 3), { width: bCol3W, align: 'center' });
    } catch (e) {
      console.warn('QR render error:', e.message);
    }
  }

  // Vertical Divider 3
  cx += bCol3W;
  doc.moveTo(cx, curY + 4).lineTo(cx, curY + bankCardHeight - 4).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();

  // Col 4: Customer Acceptance & Authorised Signatory inside card
  doc.fillColor(COLOR_MUTED).font('Helvetica-Bold').fontSize(isA5 ? 4.8 : 6.2)
     .text('CUSTOMER ACCEPTANCE', cx + 6, curY + 5);
  doc.moveTo(cx + 6, curY + (isA5 ? 15 : 19)).lineTo(cx + (isA5 ? 48 : 68), curY + (isA5 ? 15 : 19)).dash(2, { space: 2 }).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();
  doc.undash();
  doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(isA5 ? 4 : 5.2)
     .text('Signature / Seal', cx + 6, curY + (isA5 ? 17 : 21));

  doc.fillColor(COLOR_TEAL).font('Helvetica-Bold').fontSize(isA5 ? 5.2 : 6.8)
     .text(`For ${settings.company_name || 'UDHAYAM AGENCIES'}`, cx + 6, curY + (isA5 ? 28 : 36), { width: bCol4W - 10, align: 'right' });
  doc.moveTo(cx + bCol4W - (isA5 ? 58 : 78), curY + bankCardHeight - (isA5 ? 11 : 14)).lineTo(cx + bCol4W - 6, curY + bankCardHeight - (isA5 ? 11 : 14)).dash(2, { space: 2 }).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();
  doc.undash();
  doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(isA5 ? 4 : 5.2)
     .text('Authorised Signatory', cx + 6, curY + bankCardHeight - (isA5 ? 9 : 12), { width: bCol4W - 10, align: 'right' });

  curY += bankCardHeight + (isA5 ? 4 : 6);

  // -------------------------------------------------------------
  // 3. MULTI-PAGE PAGE NUMBERING & CORPORATE FOOTER (ALL PAGES)
  // -------------------------------------------------------------
  const range = doc.bufferedPageRange();
  const totalPages = range.count;

  for (let p = 0; p < totalPages; p++) {
    doc.switchToPage(p);
    const footY = pageHeight - margin - footerBarHeight + (isA5 ? 2 : 4);

    doc.moveTo(margin, footY).lineTo(margin + contentWidth, footY).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();

    doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(isA5 ? 4.5 : 5.8)
       .text('Computer-generated quotation valid without physical signature.', margin, footY + (isA5 ? 3 : 4), { width: contentWidth - 65, height: 8, ellipsis: true, lineBreak: false, align: 'left' });

    const pageNumStr = totalPages > 1 ? `Page ${p + 1} of ${totalPages}` : `Page 1 of 1`;
    doc.fillColor(COLOR_MUTED).font('Helvetica-Bold').fontSize(isA5 ? 4.8 : 6)
       .text(pageNumStr, pageWidth - margin - 65, footY + (isA5 ? 3 : 4), { width: 65, height: 8, lineBreak: false, align: 'right' });
  }

  // End Document
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
      bottom: isA5 ? 6 : 8,
      left: isA5 ? 16 : 24,
      right: isA5 ? 16 : 24
    },
    bufferPages: true,
    info: {
      Title: `Price List - ${sectionName || 'All Reputed Brands'}`,
      Author: 'Udhayam Agencies - Paint Division',
      Subject: 'Official Dealer Price List'
    }
  });

  if (res && typeof res.on === 'function') {
    doc.pipe(res);
  }

  const margin = isA5 ? 16 : 24;
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const contentWidth = pageWidth - margin * 2;
  const logoSource = getLogoSource(settings);

  // Exact 7 Columns for Price List
  const colDef = [
    { label: 'S. No.', width: isA5 ? 24 : 32, align: 'center' },
    { label: 'Item Name', width: isA5 ? (contentWidth - 24 - 70 - 45 - 30 - 32 - 40) : (contentWidth - 32 - 110 - 65 - 40 - 44 - 55), align: 'left' },
    { label: 'Details', width: isA5 ? 70 : 110, align: 'left' },
    { label: 'Sales Rate', width: isA5 ? 45 : 65, align: 'right' },
    { label: 'Qty', width: isA5 ? 30 : 40, align: 'center' },
    { label: 'Unit', width: isA5 ? 32 : 44, align: 'center' },
    { label: 'HSN', width: isA5 ? 40 : 55, align: 'center' }
  ];

  function drawHeaderBanner(y) {
    const bannerHeight = isA5 ? 42 : 54;
    doc.roundedRect(margin, y, contentWidth, bannerHeight, 4).fill(COLOR_TEAL);
    doc.roundedRect(margin, y + bannerHeight - 2, contentWidth, 2, 1).fill(COLOR_LIME);

    let textX = margin + 8;
    if (logoSource) {
      try {
        const logoSize = isA5 ? 34 : 44;
        doc.roundedRect(margin + 4, y + 4, logoSize, logoSize, 3).fill('#FFFFFF');
        doc.image(logoSource, margin + 6, y + 6, { fit: [logoSize - 4, logoSize - 4], align: 'center', valign: 'center' });
        textX = margin + logoSize + 10;
      } catch (e) {}
    }

    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(isA5 ? 10 : 13)
       .text(settings.company_name || 'UDHAYAM AGENCIES', textX, y + 4);
    doc.fillColor(COLOR_LIME).font('Helvetica-Bold').fontSize(isA5 ? 6 : 7.5)
       .text((settings.company_division || 'PAINT DIVISION').toUpperCase(), textX, y + (isA5 ? 15 : 19));
    doc.fillColor('#E2E8F0').font('Helvetica').fontSize(isA5 ? 5 : 6.5)
       .text(`PRICE LIST: ${(sectionName || 'ALL PRODUCTS').toUpperCase()} | As on ${formatToDMY(new Date())}`, textX, y + (isA5 ? 24 : 30));

    return y + bannerHeight + 6;
  }

  function drawTableHeaders(y) {
    const hHeight = isA5 ? 14 : 18;
    doc.roundedRect(margin, y, contentWidth, hHeight, 3).fill(COLOR_TEAL);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(isA5 ? 6 : 7.5);

    let x = margin;
    for (let i = 0; i < colDef.length; i++) {
      const col = colDef[i];
      doc.text(col.label, x + 2, y + (isA5 ? 3.5 : 4.5), { width: col.width - 4, align: col.align });
      x += col.width;
      if (i < colDef.length - 1) {
        doc.moveTo(x, y + 2).lineTo(x, y + hHeight - 2).strokeColor('#003B40').lineWidth(0.5).stroke();
      }
    }
    return y + hHeight;
  }

  let curY = drawHeaderBanner(margin);
  curY = drawTableHeaders(curY);

  let idx = 0;
  for (const p of products) {
    const rowHeight = isA5 ? 13 : 16;
    if (curY + rowHeight > pageHeight - 25) {
      doc.addPage();
      curY = drawHeaderBanner(margin);
      curY = drawTableHeaders(curY);
    }

    const isEven = idx % 2 === 0;
    doc.rect(margin, curY, contentWidth, rowHeight).fill(isEven ? '#FFFFFF' : '#F8FAFC');
    doc.rect(margin, curY, contentWidth, rowHeight).stroke(COLOR_BORDER);

    let x = margin;
    doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(isA5 ? 5.5 : 7)
       .text(String(idx + 1), x + 2, curY + (isA5 ? 3 : 4), { width: colDef[0].width - 4, align: 'center' });
    x += colDef[0].width;

    doc.fillColor(COLOR_TEXT).font('Helvetica-Bold').fontSize(isA5 ? 6 : 7.5)
       .text(p.item_name || '', x + 3, curY + (isA5 ? 2.5 : 3.5), { width: colDef[1].width - 5, height: rowHeight - 2, ellipsis: true });
    x += colDef[1].width;

    doc.font('Helvetica').fillColor(COLOR_MUTED).fontSize(isA5 ? 5 : 6.5)
       .text(p.details || '-', x + 3, curY + (isA5 ? 2.5 : 3.5), { width: colDef[2].width - 5, height: rowHeight - 2, ellipsis: true });
    x += colDef[2].width;

    doc.font('Helvetica-Bold').fillColor(COLOR_TEXT).fontSize(isA5 ? 6 : 7.5)
       .text(p.sale_rate != null ? Number(p.sale_rate).toFixed(2) : '0.00', x + 2, curY + (isA5 ? 3 : 4), { width: colDef[3].width - 4, align: 'right' });
    x += colDef[3].width;

    // Blank Qty box for manual order taking
    doc.rect(x + 2, curY + 1.5, colDef[4].width - 4, rowHeight - 3).stroke('#CBD5E1');
    x += colDef[4].width;

    doc.font('Helvetica').fillColor(COLOR_MUTED).fontSize(isA5 ? 5.5 : 7)
       .text(p.main_unit || 'Nos', x + 2, curY + (isA5 ? 3 : 4), { width: colDef[5].width - 4, align: 'center' });
    x += colDef[5].width;

    doc.font('Helvetica').fillColor(COLOR_MUTED).fontSize(isA5 ? 5.5 : 7)
       .text(p.hsn_sac || '-', x + 2, curY + (isA5 ? 3 : 4), { width: colDef[6].width - 4, align: 'center' });

    curY += rowHeight;
    idx++;
  }

  const range = doc.bufferedPageRange();
  for (let p = 0; p < range.count; p++) {
    doc.switchToPage(p);
    doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(isA5 ? 5 : 6.5)
       .text(`UDHAYAM AGENCIES • Page ${p + 1} of ${range.count}`, margin, pageHeight - (isA5 ? 12 : 16), { width: contentWidth, align: 'center' });
  }

  doc.end();
}

module.exports = {
  generateQuotationPdf,
  generatePriceListPdf,
  numberToIndianWords
};
