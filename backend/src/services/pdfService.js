const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { numberToIndianWords, formatINR } = require('../utils/numberToWords');

// Brand Colors
const COLOR_TEAL = '#00545C';
const COLOR_TEAL_DARK = '#003B40';
const COLOR_LIME = '#7DBA00';
const COLOR_TEXT = '#1E293B';
const COLOR_MUTED = '#64748B';
const COLOR_BORDER = '#CBD5E1';

function getLogoPath(companyLogoSetting) {
  if (companyLogoSetting) {
    const fullPath = path.join(__dirname, '../../storage/uploads/logos', companyLogoSetting);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  const defaultPath = path.join(__dirname, '../../storage/uploads/logos/udhayam_logo.png');
  if (fs.existsSync(defaultPath)) return defaultPath;
  return null;
}

function getQrCodePath(paymentQrSetting) {
  if (paymentQrSetting) {
    const customPath = path.join(__dirname, '../../storage/uploads/qr', paymentQrSetting);
    if (fs.existsSync(customPath)) return customPath;
  }
  const defaultPath = path.join(__dirname, '../../storage/uploads/qr/default_upi_qr.png');
  if (fs.existsSync(defaultPath)) return defaultPath;
  return null;
}

/**
 * Generate Quotation PDF in A4 or A5 layout
 * Guaranteed 1-page fit for standard quotations (up to 12 items)
 */
function generateQuotationPdf(quotation, settings, res) {
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

  doc.pipe(res);

  const margin = isA5 ? 16 : 28;
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const contentWidth = pageWidth - margin * 2;
  const logoPath = getLogoPath(settings.company_logo);

  // Card and Pill Corner Radii
  const R_CARD = isA5 ? 6 : 8;
  const R_SM = isA5 ? 4 : 5;

  // Top Header Banner with sleek rounded card corners & Lime bottom accent strip
  const headerHeight = isA5 ? 46 : 68;
  doc.roundedRect(margin, margin, contentWidth, headerHeight, R_CARD).fill(COLOR_TEAL);

  // Sleek Lime accent strip at bottom of header banner
  const accentHeight = isA5 ? 2.5 : 3.5;
  doc.roundedRect(margin, margin + headerHeight - accentHeight, contentWidth, accentHeight, 1).fill(COLOR_LIME);

  // Logo in clean rounded white container
  let textLeft = margin + (isA5 ? 6 : 10);
  if (logoPath) {
    try {
      const logoBoxW = isA5 ? 65 : 95;
      const logoBoxH = isA5 ? 36 : 52;
      doc.roundedRect(margin + (isA5 ? 4 : 6), margin + (isA5 ? 4 : 6), logoBoxW, logoBoxH, R_SM).fill('#FFFFFF');
      doc.image(logoPath, margin + (isA5 ? 5 : 8), margin + (isA5 ? 5 : 8), {
        fit: [logoBoxW - (isA5 ? 2 : 4), logoBoxH - (isA5 ? 2 : 4)]
      });
      textLeft = margin + logoBoxW + (isA5 ? 8 : 14);
    } catch (e) {
      console.warn('Logo load error:', e.message);
    }
  }

  // Company Details in Teal Banner
  doc.fillColor('#FFFFFF')
     .font('Helvetica-Bold')
     .fontSize(isA5 ? 11.5 : 15)
     .text(settings.company_name || 'UDHAYAM AGENCIES', textLeft, margin + (isA5 ? 6 : 10));

  doc.font('Helvetica-Bold')
     .fontSize(isA5 ? 7 : 8.5)
     .fillColor(COLOR_LIME)
     .text(settings.company_division || 'Paint Division Quotation Management', textLeft, margin + (isA5 ? 19 : 28));

  doc.font('Helvetica')
     .fontSize(isA5 ? 5.5 : 7.5)
     .fillColor('#E2E8F0')
     .text(settings.company_address || '', textLeft, margin + (isA5 ? 27 : 40), { width: contentWidth - (textLeft - margin) - (isA5 ? 64 : 75) })
     .text(`Phone: ${settings.company_phone || '+91 97156 22499'} | GSTIN: ${settings.company_gstin || '33AADFU6496M1ZJ'}`, textLeft, margin + (isA5 ? 36 : 52));

  // "QUOTATION" Title Badge at top-right
  const badgeWidth = isA5 ? 66 : 86;
  const badgeHeight = isA5 ? 18 : 22;
  const badgeX = pageWidth - margin - badgeWidth - (isA5 ? 5 : 8);
  const badgeY = margin + (isA5 ? 6 : 8);
  doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, R_SM)
     .fill(COLOR_LIME);
  doc.fillColor(COLOR_TEAL_DARK)
     .font('Helvetica-Bold')
     .fontSize(isA5 ? 8 : 10)
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
     .text(quotation.customer_name || 'Valued Customer', margin + 6, curY + (isA5 ? 13 : 17));

  doc.font('Helvetica')
     .fontSize(isA5 ? 6 : 7.5)
     .fillColor(COLOR_MUTED)
     .text(`Phone: ${quotation.customer_phone || '-'}`, margin + 6, curY + (isA5 ? 23 : 29))
     .text(`Address: ${quotation.customer_address || '-'}`, margin + 6, curY + (isA5 ? 32 : 39), { width: colWidth, height: 14, ellipsis: true });

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

  doc.font('Helvetica')
     .fontSize(isA5 ? 6 : 7.5)
     .fillColor(COLOR_TEXT)
     .text(`Quote No: `, rightX, curY + (isA5 ? 13 : 17), { continued: true })
     .font('Helvetica-Bold').text(quotation.quotation_number)
     .font('Helvetica').text(`Date: `, rightX, curY + (isA5 ? 23 : 28), { continued: true })
     .font('Helvetica-Bold').text(quotation.quotation_date)
     .font('Helvetica').text(`Valid Until: `, rightX, curY + (isA5 ? 32 : 39), { continued: true })
     .font('Helvetica-Bold').text(quotation.validity_date || '7 days from issue');

  curY += infoBoxHeight + (isA5 ? 4 : 6);

  // Target bottom coordinates for true Full-Page A4 / A5 printing layout
  const sigHeight = isA5 ? 32 : 42;
  const summaryHeight = isA5 ? 104 : 126;
  const targetSigY = pageHeight - margin - sigHeight; // e.g. 547.28 pt for A5, 771.89 pt for A4
  const targetSummaryY = targetSigY - summaryHeight - (isA5 ? 6 : 8); // e.g. 437.28 pt for A5, 637.89 pt for A4
  const tableBottomY = targetSummaryY - (isA5 ? 4 : 6);
  const tableHeaderHeight = isA5 ? 16 : 20;

  // Line Items Table Columns with clean (Rs.) currency labels
  const colDef = [
    { label: 'S.No', width: isA5 ? 22 : 30, align: 'center' },
    { label: 'Item Description & Specifications', width: isA5 ? (contentWidth - 212) : (contentWidth - 280), align: 'left' },
    { label: 'HSN/SAC', width: isA5 ? 38 : 52, align: 'center' },
    { label: 'Unit', width: isA5 ? 26 : 36, align: 'center' },
    { label: 'Qty', width: isA5 ? 28 : 38, align: 'center' },
    { label: 'Rate (Rs.)', width: isA5 ? 48 : 56, align: 'right' },
    { label: 'Total (Rs.)', width: isA5 ? 50 : 68, align: 'right' }
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

    // HSN
    doc.font('Helvetica')
       .text(item.hsn_sac || '-', x + 2, curY + (isA5 ? 3 : 4.5), { width: colDef[2].width - 4, align: 'center' });
    x += colDef[2].width;

    // Unit
    doc.text(item.unit || 'Nos', x + 2, curY + (isA5 ? 3 : 4.5), { width: colDef[3].width - 4, align: 'center' });
    x += colDef[3].width;

    // Qty
    doc.font('Helvetica-Bold')
       .text(String(item.quantity), x + 2, curY + (isA5 ? 3 : 4.5), { width: colDef[4].width - 4, align: 'center' });
    x += colDef[4].width;

    // Rate
    doc.font('Helvetica')
       .text(Number(item.sale_rate).toFixed(2), x + 2, curY + (isA5 ? 3 : 4.5), { width: colDef[5].width - 4, align: 'right' });
    x += colDef[5].width;

    // Total
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

  // Summary and Bank Details: Anchored at the Bottom of the Page
  curY = targetSummaryY;

  const leftBoxWidth = isA5 ? 210 : 285;
  const rightBoxWidth = contentWidth - leftBoxWidth - (isA5 ? 6 : 8);

  // Left Box: Bank Details & UPI QR Code & Terms (Rounded Card)
  doc.roundedRect(margin, curY, leftBoxWidth, summaryHeight, R_CARD)
     .fillAndStroke('#F8FAFC', COLOR_BORDER);

  doc.fillColor(COLOR_TEAL)
     .font('Helvetica-Bold')
     .fontSize(isA5 ? 6.5 : 8)
     .text('BANK & UPI PAYMENT DETAILS:', margin + (isA5 ? 6 : 8), curY + (isA5 ? 5 : 6));

  const qrSize = isA5 ? 38 : 52;
  const qrCardW = qrSize + (isA5 ? 8 : 12);
  const qrCardH = qrSize + (isA5 ? 12 : 16);
  const bankTextWidth = leftBoxWidth - qrCardW - (isA5 ? 14 : 18);

  doc.font('Helvetica')
     .fontSize(isA5 ? 5.5 : 7)
     .fillColor(COLOR_TEXT)
     .text(`Bank: ${settings.bank_name || 'Indian Bank'} (${settings.bank_branch || 'Perundurai'})`, margin + (isA5 ? 6 : 8), curY + (isA5 ? 14 : 17), { width: bankTextWidth })
     .text(`A/c Name: ${settings.bank_account_name || 'Udhayam Agencies'}`, margin + (isA5 ? 6 : 8), curY + (isA5 ? 23 : 27), { width: bankTextWidth })
     .font('Helvetica-Bold')
     .text(`A/c No: ${settings.bank_account_no || '6659330152'}`, margin + (isA5 ? 6 : 8), curY + (isA5 ? 32 : 37), { width: bankTextWidth })
     .font('Helvetica')
     .text(`IFSC: ${settings.bank_ifsc || 'IDIB000P034'}`, margin + (isA5 ? 6 : 8), curY + (isA5 ? 41 : 47), { width: bankTextWidth })
     .font('Helvetica-Bold')
     .fillColor(COLOR_TEAL)
     .text(`GPay: ${settings.gpay_number || '+91 97156 22499'} (MS Udhayam)`, margin + (isA5 ? 6 : 8), curY + (isA5 ? 50 : 57), { width: bankTextWidth });

  // Draw UPI Payment QR Code inside its own perfectly aligned rounded white card
  const qrPath = getQrCodePath(settings.payment_qr_code);
  const qrX = margin + leftBoxWidth - qrCardW - (isA5 ? 6 : 8);
  const qrY = curY + (isA5 ? 5 : 6);

  if (qrPath) {
    try {
      doc.roundedRect(qrX, qrY, qrCardW, qrCardH, R_SM)
         .fillAndStroke('#FFFFFF', COLOR_BORDER);
      doc.image(qrPath, qrX + (qrCardW - qrSize) / 2, qrY + (isA5 ? 2.5 : 3.5), { fit: [qrSize, qrSize] });
      doc.fillColor(COLOR_TEAL_DARK)
         .font('Helvetica-Bold')
         .fontSize(isA5 ? 4.5 : 5.5)
         .text('SCAN TO PAY UPI', qrX, qrY + qrSize + (isA5 ? 3.5 : 4.5), { width: qrCardW, align: 'center' });
    } catch (e) {
      console.warn('QR code render warning:', e.message);
    }
  }

  // Divider above Terms & Conditions inside Left Box (Guaranteed clear of QR card!)
  const termsDividerY = curY + Math.max(isA5 ? 58 : 74, qrCardH + (isA5 ? 8 : 10));
  doc.moveTo(margin + (isA5 ? 6 : 8), termsDividerY)
     .lineTo(margin + leftBoxWidth - (isA5 ? 6 : 8), termsDividerY)
     .strokeColor(COLOR_BORDER)
     .lineWidth(0.5)
     .stroke();

  // Terms & Conditions below Bank and QR
  doc.fillColor(COLOR_TEAL)
     .font('Helvetica-Bold')
     .fontSize(isA5 ? 5 : 6.5)
     .text('Terms & Conditions:', margin + (isA5 ? 6 : 8), termsDividerY + (isA5 ? 2.5 : 3.5));

  doc.font('Helvetica')
     .fillColor(COLOR_MUTED)
     .fontSize(isA5 ? 4.5 : 5.8)
     .text(
       quotation.notes || settings.default_terms || '1. Quotation is valid for 7 days from the date of issue.\n2. Goods once sold/dispatched will not be taken back.\n3. Delivery subject to physical stock availability.\n4. GST and Transport charges applicable as mentioned.',
       margin + (isA5 ? 6 : 8),
       termsDividerY + (isA5 ? 9 : 11),
       { width: leftBoxWidth - (isA5 ? 12 : 16), height: isA5 ? 28 : 34, lineGap: 1 }
     );

  // Right Box: Totals & Tax Inclusive Calculation (Rounded Card)
  const totalsX = margin + leftBoxWidth + (isA5 ? 6 : 8);
  doc.roundedRect(totalsX, curY, rightBoxWidth, summaryHeight, R_CARD)
     .fillAndStroke('#FFFFFF', COLOR_BORDER);

  let ty = curY + (isA5 ? 4 : 6);

  function drawSummaryRow(label, value, isBold = false, isAccent = false) {
    doc.fillColor(isAccent ? COLOR_TEAL : COLOR_TEXT)
       .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
       .fontSize(isA5 ? 6 : 7.5)
       .text(label, totalsX + (isA5 ? 6 : 8), ty);
    doc.text(value, totalsX + (isA5 ? 6 : 8), ty, { width: rightBoxWidth - (isA5 ? 12 : 16), align: 'right' });
    ty += isA5 ? 9.5 : 13;
  }

  drawSummaryRow('Subtotal (MRP/Rates):', formatINR(quotation.subtotal));

  if (quotation.discount_percent > 0 || quotation.discount_amount > 0) {
    drawSummaryRow(`Discount (${quotation.discount_percent}%):`, `- ${formatINR(quotation.discount_amount)}`);
  }

  // Tax Inclusive breakdown
  const gstRateVal = Number(quotation.gst_rate) || 18;
  const netBeforeTax = quotation.subtotal - (quotation.discount_amount || 0);
  const taxableAmt = gstRateVal > 0 ? Math.round((netBeforeTax / (1 + (gstRateVal / 100))) * 100) / 100 : netBeforeTax;
  const gstAmt = Math.round((netBeforeTax - taxableAmt) * 100) / 100;

  drawSummaryRow('Taxable Amount (Base):', formatINR(taxableAmt));
  drawSummaryRow(`Total GST Included (${gstRateVal}%):`, formatINR(gstAmt));

  if (quotation.delivery_charges > 0) {
    drawSummaryRow('Delivery / Freight:', `+ ${formatINR(quotation.delivery_charges)}`);
  }

  // Divider
  doc.moveTo(totalsX + (isA5 ? 6 : 8), ty).lineTo(totalsX + rightBoxWidth - (isA5 ? 6 : 8), ty).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();
  ty += (isA5 ? 2 : 3);

  // Grand Total Highlight: Crisp Rounded Banner with High-Contrast Pure White on Dark Teal
  const gtHeight = isA5 ? 20 : 26;
  doc.roundedRect(totalsX + (isA5 ? 3 : 4), ty, rightBoxWidth - (isA5 ? 6 : 8), gtHeight, R_SM).fill(COLOR_TEAL);
  doc.fillColor('#FFFFFF')
     .font('Helvetica-Bold')
     .fontSize(isA5 ? 7.5 : 9.5)
     .text(isA5 ? 'GRAND TOTAL:' : 'GRAND TOTAL (Incl. GST):', totalsX + (isA5 ? 6 : 8), ty + (isA5 ? 5.5 : 7.5));
  doc.fillColor('#FFFFFF')
     .font('Helvetica-Bold')
     .fontSize(isA5 ? 10.5 : 13)
     .text(formatINR(quotation.grand_total), totalsX + (isA5 ? 6 : 8), ty + (isA5 ? 4.5 : 6), { width: rightBoxWidth - (isA5 ? 12 : 16), align: 'right' });

  ty += gtHeight + (isA5 ? 2 : 3);

  // Amount in Words
  doc.fillColor(COLOR_TEXT)
     .font('Helvetica-Bold')
     .fontSize(isA5 ? 4.5 : 6)
     .text('Amount in Words:', totalsX + (isA5 ? 6 : 8), ty);
  doc.font('Helvetica-Oblique')
     .fillColor(COLOR_MUTED)
     .fontSize(isA5 ? 4.5 : 6)
     .text(numberToIndianWords(quotation.grand_total), totalsX + (isA5 ? 6 : 8), ty + (isA5 ? 6 : 8), { width: rightBoxWidth - (isA5 ? 12 : 16), height: isA5 ? 15 : 18 });

  // Bottom Signature Area: Anchored at targetSigY
  const sigY = targetSigY;
  doc.fillColor(COLOR_TEXT)
     .font('Helvetica-Bold')
     .fontSize(isA5 ? 6 : 7.5)
     .text('Customer Acceptance', margin + (isA5 ? 6 : 8), sigY)
     .text(`For ${settings.company_name || 'UDHAYAM AGENCIES'}`, pageWidth - margin - (isA5 ? 140 : 170), sigY, { width: isA5 ? 132 : 162, align: 'right' });

  doc.moveTo(margin + (isA5 ? 6 : 8), sigY + (isA5 ? 15 : 20)).lineTo(margin + (isA5 ? 90 : 130), sigY + (isA5 ? 15 : 20)).dash(2, { space: 2 }).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();
  doc.moveTo(pageWidth - margin - (isA5 ? 110 : 150), sigY + (isA5 ? 15 : 20)).lineTo(pageWidth - margin - (isA5 ? 6 : 8), sigY + (isA5 ? 15 : 20)).dash(2, { space: 2 }).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();
  doc.undash();

  doc.fillColor(COLOR_MUTED)
     .font('Helvetica')
     .fontSize(isA5 ? 4.5 : 6)
     .text('Signature / Seal & Date', margin + (isA5 ? 6 : 8), sigY + (isA5 ? 17 : 23))
     .text('Authorised Signatory', pageWidth - margin - (isA5 ? 140 : 170), sigY + (isA5 ? 17 : 23), { width: isA5 ? 132 : 162, align: 'right' });

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

  doc.pipe(res);

  const margin = isA5 ? 16 : 24;
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const contentWidth = pageWidth - margin * 2;
  const logoPath = getLogoPath(settings.company_logo);

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
    if (logoPath) {
      try {
        doc.image(logoPath, margin + 4, y + (isA5 ? 4 : 6), {
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
}

module.exports = {
  generateQuotationPdf,
  generatePriceListPdf
};
