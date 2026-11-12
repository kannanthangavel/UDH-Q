const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { pdfsDir, logosDir, snapshotsDir } = require('../db/database');

/**
 * Formats currency safely for standard PDFKit fonts (using "Rs." to avoid Unicode symbol missing issues)
 */
function pdfCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return 'Rs. 0.00';
  const num = Number(amount);
  const isNeg = num < 0;
  const abs = Math.abs(num);
  const parts = abs.toFixed(2).split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1];

  if (integerPart.length > 3) {
    const lastThree = integerPart.substring(integerPart.length - 3);
    const otherNumbers = integerPart.substring(0, integerPart.length - 3);
    integerPart = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
  }

  return `${isNeg ? '-' : ''}Rs. ${integerPart}.${decimalPart}`;
}

/**
 * Generates Quotation PDF in A5 (default) or A4 with exact pixel-perfect layout
 * Inspired by executive agency design with compulsory Udhayam logo, corner ribbon, and zero text overlap
 */
function generateQuotationPDF(quotation, items, settings) {
  return new Promise((resolve, reject) => {
    try {
      const isA5 = (quotation.paper_size || 'A5').toUpperCase() === 'A5';
      const pageSize = isA5 ? 'A5' : 'A4';
      const margin = isA5 ? 18 : 28;

      const filename = `${(quotation.quotation_number || 'QUOTE').replace(/[^\w\-]/g, '_')}_${Date.now()}.pdf`;
      const filePath = path.join(pdfsDir, filename);

      const doc = new PDFDocument({
        size: pageSize,
        margin: margin,
        bufferPages: true,
        info: {
          Title: `Quotation ${quotation.quotation_number}`,
          Author: settings.company_name || 'Udhayam Agencies',
          Subject: 'Product Quotation'
        }
      });

      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const contentWidth = pageWidth - (margin * 2);

      // Design System Colors (Official Udhayam Brand Palette)
      const primaryColor = '#044E54';      // Deep Udhayam Teal
      const primaryDark = '#023035';       // Dark Teal
      const accentGreen = '#72B01D';       // Udhayam Lime Green
      const accentGold = '#F59E0B';        // Warm Gold / Amber Accent
      const darkColor = '#0F172A';         // Slate 900
      const mutedColor = '#475569';        // Slate 600
      const lightBg = '#F8FAFC';           // Slate 50
      const borderColor = '#CBD5E1';       // Slate 300
      const lightBorder = '#E2E8F0';       // Slate 200

      // Compulsory Logo Resolution
      let targetLogoPath = null;
      const candidateLogoPaths = [
        quotation.logo_snapshot_path ? (path.isAbsolute(quotation.logo_snapshot_path) ? quotation.logo_snapshot_path : path.join(snapshotsDir, quotation.logo_snapshot_path)) : null,
        quotation.custom_logo_path ? (path.isAbsolute(quotation.custom_logo_path) ? quotation.custom_logo_path : path.join(logosDir, quotation.custom_logo_path)) : null,
        settings.company_logo ? (path.isAbsolute(settings.company_logo) ? settings.company_logo : path.join(logosDir, settings.company_logo)) : null,
        path.join(logosDir, 'udhayam_logo.png'),
        path.join(__dirname, '../../../client/src/assets/udhayam_logo.png'),
        path.join(__dirname, '../../storage/uploads/logos/udhayam_logo.png')
      ].filter(Boolean);

      for (const p of candidateLogoPaths) {
        if (fs.existsSync(p)) {
          targetLogoPath = p;
          break;
        }
      }

      // 1. --- TOP RIGHT CORNER BRAND ACCENT RIBBON ---
      function drawCornerRibbon() {
        doc.save();
        const ribbonWidth = isA5 ? 80 : 110;
        const ribbonHeight = isA5 ? 14 : 18;
        const startX = pageWidth - ribbonWidth;
        const sliceWidth = ribbonWidth / 3;

        // 3 curved/modern geometric slices: Gold, Lime Green, Deep Teal
        doc.rect(startX, 0, sliceWidth, ribbonHeight).fill(accentGold);
        doc.rect(startX + sliceWidth, 0, sliceWidth, ribbonHeight).fill(accentGreen);
        doc.rect(startX + (sliceWidth * 2), 0, sliceWidth, ribbonHeight).fill(primaryColor);
        doc.restore();
      }

      // 2. --- BACKGROUND WATERMARK ---
      function drawWatermark() {
        if (targetLogoPath && fs.existsSync(targetLogoPath)) {
          doc.save();
          doc.opacity(0.04);
          const wmSize = isA5 ? 160 : 230;
          const wmX = (pageWidth - wmSize) / 2;
          const wmY = (pageHeight - wmSize) / 2;
          try {
            doc.image(targetLogoPath, wmX, wmY, {
              fit: [wmSize, wmSize],
              align: 'center',
              valign: 'center'
            });
          } catch (_) {}
          doc.restore();
        }
      }

      // Draw initial decorations
      drawCornerRibbon();
      drawWatermark();

      // 3. --- HEADER: COMPULSORY LOGO & BRAND TITLE ---
      let curY = margin;
      const logoW = isA5 ? 115 : 145;
      const logoH = isA5 ? 40 : 50;

      if (targetLogoPath && fs.existsSync(targetLogoPath)) {
        try {
          doc.image(targetLogoPath, margin, curY, {
            fit: [logoW, logoH],
            align: 'left',
            valign: 'top'
          });
        } catch (err) {
          console.warn('[PDF] Logo render warning:', err.message);
        }
      }

      curY += logoH + (isA5 ? 6 : 10);

      // Document Main Title: QUOTATION (or GST QUOTATION / ESTIMATION)
      const docTypeTitle = quotation.document_type === 'estimation'
        ? 'COMMERCIAL ESTIMATION'
        : (quotation.document_type === 'gst_quotation' ? 'GST QUOTATION' : 'QUOTATION');

      doc.fillColor(primaryDark)
        .font('Helvetica-Bold')
        .fontSize(isA5 ? 14 : 19)
        .text(docTypeTitle, margin, curY, { lineBreak: false });

      curY += isA5 ? 15 : 20;

      // 4. --- 2-COLUMN METADATA & RECIPIENT ("TO") BLOCK ---
      const metaBlockY = curY;
      const leftColW = contentWidth * 0.46;
      const rightColX = margin + leftColW + 10;
      const rightColW = contentWidth - leftColW - 10;

      // Left Column: Quotation Meta Details
      let lY = metaBlockY;
      const labelW = isA5 ? 68 : 84;

      const drawMetaRow = (label, val, isValBold = true) => {
        doc.font('Helvetica-Bold').fontSize(isA5 ? 6.8 : 8.2).fillColor(darkColor)
          .text(label, margin, lY, { width: labelW, lineBreak: false });
        doc.font('Helvetica').text(':', margin + labelW, lY, { width: 8, lineBreak: false });
        doc.font(isValBold ? 'Helvetica-Bold' : 'Helvetica')
          .fillColor(isValBold ? primaryDark : darkColor)
          .text(val, margin + labelW + 8, lY, { width: leftColW - labelW - 10, lineBreak: false });
        lY += isA5 ? 9.5 : 12;
      };

      const quoteDate = quotation.created_at ? new Date(quotation.created_at).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN');
      const validTillDate = new Date(Date.now() + ((quotation.validity_days || 7) * 86400000)).toLocaleDateString('en-IN');

      drawMetaRow('Quotation No', quotation.quotation_number || 'UD-DRAFT');
      drawMetaRow('Quotation Date', quoteDate, false);
      drawMetaRow('Valid Till', validTillDate, false);
      if (quotation.reference_no) {
        drawMetaRow('Reference PO', quotation.reference_no, false);
      }

      // Right Column: Recipient / Customer "To" Block
      let rY = metaBlockY;
      doc.font('Helvetica-Bold').fontSize(isA5 ? 7.5 : 9).fillColor(darkColor)
        .text('To', rightColX, rY, { lineBreak: false });
      rY += isA5 ? 10 : 12.5;

      doc.font('Helvetica-Bold').fontSize(isA5 ? 7.2 : 8.8).fillColor(primaryDark)
        .text(quotation.customer_name || 'Valued Customer', rightColX, rY, { width: rightColW, ellipsis: true, lineBreak: false });
      rY += isA5 ? 9.5 : 11.5;

      if (quotation.customer_company) {
        doc.font('Helvetica').fontSize(isA5 ? 6.8 : 8).fillColor(darkColor)
          .text(quotation.customer_company, rightColX, rY, { width: rightColW, ellipsis: true, lineBreak: false });
        rY += isA5 ? 8.5 : 10.5;
      }

      if (quotation.customer_address) {
        const cleanAddr = quotation.customer_address.replace(/\r?\n+/g, ', ');
        doc.font('Helvetica').fontSize(isA5 ? 6.2 : 7.5).fillColor(mutedColor)
          .text(cleanAddr, rightColX, rY, { width: rightColW, height: isA5 ? 16 : 20, ellipsis: true });
        rY += isA5 ? 9 : 11;
      }

      if (quotation.customer_phone) {
        doc.font('Helvetica').fontSize(isA5 ? 6.2 : 7.5).fillColor(mutedColor)
          .text(`Phone: ${quotation.customer_phone}`, rightColX, rY, { width: rightColW, lineBreak: false });
        rY += isA5 ? 8.5 : 10.5;
      }

      if (quotation.customer_gstin) {
        doc.font('Helvetica-Bold').fontSize(isA5 ? 6.2 : 7.5).fillColor(primaryDark)
          .text(`GSTIN: ${quotation.customer_gstin}`, rightColX, rY, { width: rightColW, lineBreak: false });
        rY += isA5 ? 8.5 : 10.5;
      }

      curY = Math.max(lY, rY) + (isA5 ? 6 : 8);

      // 5. --- SALUTATION & INTRODUCTION ---
      doc.font('Helvetica-Bold').fontSize(isA5 ? 6.8 : 8).fillColor(darkColor)
        .text('Dear Sir / Madam,', margin, curY, { lineBreak: false });
      curY += isA5 ? 8.5 : 10.5;

      doc.font('Helvetica').fontSize(isA5 ? 6.2 : 7.5).fillColor(mutedColor)
        .text('Thank you for considering Udhayam Agencies. We are pleased to provide the following quotation for your requirement.', margin, curY, { width: contentWidth, lineBreak: false });
      curY += isA5 ? 11 : 14;

      // 6. --- LINE ITEMS TABLE WITH ZERO OVERLAPPING ---
      // Calibrated column definitions summing exactly to contentWidth
      const colDefs = isA5 ? [
        { key: 'sno', label: '#', width: 16, align: 'center' },
        { key: 'name', label: 'Product Name / Description', width: 118, align: 'left' },
        { key: 'details', label: 'Details / Remarks', width: 66, align: 'left' },
        { key: 'hsn', label: 'HSN', width: 34, align: 'center' },
        { key: 'qty', label: 'Qty', width: 23, align: 'right' },
        { key: 'unit', label: 'Unit', width: 23, align: 'center' },
        { key: 'rate', label: 'Rate (₹)', width: 36, align: 'right' },
        { key: 'gst', label: 'GST%', width: 22, align: 'center' },
        { key: 'total', label: 'Total (₹)', width: 41.53, align: 'right' }
      ] : [
        { key: 'sno', label: '#', width: 22, align: 'center' },
        { key: 'name', label: 'Product Description & Specification', width: 168, align: 'left' },
        { key: 'details', label: 'Details / Specifications', width: 94, align: 'left' },
        { key: 'hsn', label: 'HSN Code', width: 46, align: 'center' },
        { key: 'qty', label: 'Qty', width: 30, align: 'right' },
        { key: 'unit', label: 'Unit', width: 30, align: 'center' },
        { key: 'rate', label: 'Rate (₹)', width: 48, align: 'right' },
        { key: 'gst', label: 'GST %', width: 32, align: 'center' },
        { key: 'total', label: 'Total (INR)', width: 69.28, align: 'right' }
      ];

      const tableTop = curY;
      const tableHeaderHeight = isA5 ? 16 : 19;
      const footerBudget = isA5 ? 140 : 160;

      function drawTableHeader(yPos) {
        doc.rect(margin, yPos, contentWidth, tableHeaderHeight).fill(primaryColor);
        let cX = margin;
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(isA5 ? 6.5 : 7.8);

        colDefs.forEach(col => {
          const tX = col.align === 'left' ? cX + 4 : cX;
          const tW = col.align === 'left' ? col.width - 6 : col.width;
          doc.text(col.label, tX, yPos + (isA5 ? 4 : 5), {
            width: tW,
            align: col.align,
            lineBreak: false
          });
          cX += col.width;
        });
      }

      drawTableHeader(tableTop);
      curY = tableTop + tableHeaderHeight;

      // Render Dynamic Line Items
      items.forEach((item, index) => {
        // Measure dynamic heights for multi-line safety
        const fontSize = isA5 ? 6.2 : 7.5;
        doc.fontSize(fontSize);

        const nameHeight = doc.heightOfString(item.product_name, { width: colDefs[1].width - 6 });
        const specHeight = item.specification ? doc.heightOfString(item.specification, { width: colDefs[2].width - 6 }) : 0;
        const textH = Math.max(nameHeight, specHeight, isA5 ? 9 : 11);
        const rowHeight = textH + (isA5 ? 6 : 7.5);

        // Check if row exceeds printable budget
        if (curY + rowHeight + footerBudget > pageHeight - margin) {
          doc.addPage({ size: pageSize, margin: margin });
          drawCornerRibbon();
          drawWatermark();
          curY = margin;
          drawTableHeader(curY);
          curY += tableHeaderHeight;
        }

        const isEven = index % 2 === 0;
        const rowBg = isEven ? '#FFFFFF' : '#F8FAFC';

        // Row background & bottom border
        doc.rect(margin, curY, contentWidth, rowHeight).fill(rowBg).stroke(lightBorder);

        // Vertical dividers
        let divX = margin;
        doc.strokeColor(lightBorder).lineWidth(0.5);
        for (let i = 0; i < colDefs.length - 1; i++) {
          divX += colDefs[i].width;
          doc.moveTo(divX, curY).lineTo(divX, curY + rowHeight).stroke();
        }

        // Draw Row Text Content
        let colX = margin;
        const textY = curY + ((rowHeight - textH) / 2);
        doc.fillColor(darkColor).fontSize(fontSize);

        // 1. S.No
        doc.font('Helvetica').text(String(index + 1), colX, textY, { width: colDefs[0].width, align: 'center', lineBreak: false });
        colX += colDefs[0].width;

        // 2. Product Name (Clean word-wrap)
        doc.font('Helvetica-Bold').text(item.product_name, colX + 3, textY, { width: colDefs[1].width - 6 });
        colX += colDefs[1].width;

        // 3. Details / Remarks
        doc.font('Helvetica').fillColor(mutedColor).text(item.specification || '-', colX + 3, textY, { width: colDefs[2].width - 6 });
        doc.fillColor(darkColor);
        colX += colDefs[2].width;

        // 4. HSN
        doc.font('Helvetica').text(item.hsn_code || '-', colX, textY, { width: colDefs[3].width, align: 'center', lineBreak: false });
        colX += colDefs[3].width;

        // 5. Qty
        doc.font('Helvetica-Bold').text(String(item.quantity), colX, textY, { width: colDefs[4].width - 3, align: 'right', lineBreak: false });
        colX += colDefs[4].width;

        // 6. Unit
        doc.font('Helvetica').text(item.unit || 'Nos', colX, textY, { width: colDefs[5].width, align: 'center', lineBreak: false });
        colX += colDefs[5].width;

        // 7. Rate
        doc.text(pdfCurrency(item.unit_price).replace('Rs. ', ''), colX, textY, { width: colDefs[6].width - 3, align: 'right', lineBreak: false });
        colX += colDefs[6].width;

        // 8. GST%
        doc.text(`${item.gst_rate !== undefined ? item.gst_rate : 18}%`, colX, textY, { width: colDefs[7].width, align: 'center', lineBreak: false });
        colX += colDefs[7].width;

        // 9. Total Line Amount
        doc.font('Helvetica-Bold').text(pdfCurrency(item.line_total).replace('Rs. ', ''), colX, textY, { width: colDefs[8].width - 3, align: 'right', lineBreak: false });

        curY += rowHeight;
      });

      // Fill remaining space with clean blank ledger rows up to a minimum for balanced aesthetics
      const minRows = isA5 ? 4 : 5;
      if (items.length < minRows) {
        const extraRows = minRows - items.length;
        const fillerH = isA5 ? 14 : 17;
        for (let e = 0; e < extraRows; e++) {
          const rowBg = (items.length + e) % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
          doc.rect(margin, curY, contentWidth, fillerH).fill(rowBg).stroke(lightBorder);

          let divX = margin;
          doc.strokeColor(lightBorder).lineWidth(0.5);
          for (let i = 0; i < colDefs.length - 1; i++) {
            divX += colDefs[i].width;
            doc.moveTo(divX, curY).lineTo(divX, curY + fillerH).stroke();
          }
          curY += fillerH;
        }
      }

      // Outer table border
      doc.rect(margin, tableTop, contentWidth, curY - tableTop).stroke(borderColor);

      // 7. --- TOTALS & SUMMARY SECTION ---
      curY += 5;
      const sumTop = curY;
      const sumLeftW = isA5 ? contentWidth * 0.52 : contentWidth * 0.55;
      const sumRightW = contentWidth - sumLeftW - 8;
      const sumH = isA5 ? 50 : 60;

      // Left Box: Amount in words
      doc.rect(margin, sumTop, sumLeftW, sumH).fill('#FFFFFF').stroke(borderColor);
      doc.fillColor(primaryDark).font('Helvetica-Bold').fontSize(isA5 ? 6.2 : 7.5)
        .text('AMOUNT IN WORDS (INR):', margin + 6, sumTop + 4.5, { lineBreak: false });

      doc.font('Helvetica-Oblique').fontSize(isA5 ? 6.2 : 7.2).fillColor(darkColor)
        .text(quotation.amount_in_words || 'Rupees Zero Only', margin + 6, sumTop + 15, { width: sumLeftW - 12 });

      // Right Box: Totals breakdown
      const rBoxX = margin + sumLeftW + 8;
      doc.rect(rBoxX, sumTop, sumRightW, sumH).fill(lightBg).stroke(borderColor);

      let tY = sumTop + 3.5;
      const tStep = isA5 ? 9.5 : 11.5;
      const drawTotalLine = (label, val, isBold = false) => {
        doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(isA5 ? 6.2 : 7.2)
          .fillColor(isBold ? primaryDark : darkColor);
        doc.text(label, rBoxX + 6, tY, { width: sumRightW * 0.52, lineBreak: false });
        doc.text(val, rBoxX + sumRightW * 0.52, tY, { width: sumRightW * 0.48 - 6, align: 'right', lineBreak: false });
        tY += tStep;
      };

      drawTotalLine('Subtotal (Gross):', pdfCurrency(quotation.subtotal));
      if (quotation.discount_total > 0) {
        drawTotalLine('Discount:', `-${pdfCurrency(quotation.discount_total)}`);
      }
      if (quotation.document_type === 'gst_quotation' && quotation.tax_total > 0) {
        drawTotalLine('Total GST Tax:', pdfCurrency(quotation.tax_total));
      }
      if (quotation.delivery_charges > 0) {
        drawTotalLine('Delivery Charges:', pdfCurrency(quotation.delivery_charges));
      }

      // Grand Total Highlight Bar
      const gtH = isA5 ? 16 : 19;
      const gtY = sumTop + sumH - gtH;
      doc.rect(rBoxX, gtY, sumRightW, gtH).fill(primaryColor);
      doc.font('Helvetica-Bold').fontSize(isA5 ? 7.8 : 9).fillColor('#FFFFFF');
      doc.text('GRAND TOTAL:', rBoxX + 6, gtY + (isA5 ? 4 : 5), { width: sumRightW * 0.45, lineBreak: false });
      doc.text(pdfCurrency(quotation.grand_total), rBoxX + sumRightW * 0.45, gtY + (isA5 ? 4 : 5), { width: sumRightW * 0.55 - 6, align: 'right', lineBreak: false });

      curY = sumTop + sumH + (isA5 ? 5 : 7);

      // 8. --- THANK YOU & TERMS & CONDITIONS ---
      doc.font('Helvetica-Bold').fontSize(isA5 ? 6.8 : 8).fillColor(primaryDark);
      doc.text('Thank you for considering UDHAYAM AGENCIES.', margin, curY, { lineBreak: false });
      curY += isA5 ? 9 : 11;

      doc.font('Helvetica-Bold').fontSize(isA5 ? 6.2 : 7.5).fillColor(darkColor);
      doc.text('Terms & Conditions', margin, curY, { lineBreak: false });
      curY += isA5 ? 7.5 : 9.5;

      const termsList = [
        `This quotation is valid for ${quotation.validity_days || 7} days from the date of issue.`,
        'Goods once sold or dispatched cannot be taken back.',
        `Payment terms: ${quotation.payment_terms || 'Immediate / Against Delivery'}.`,
        'Subject to Perundurai jurisdiction only.'
      ];

      doc.font('Helvetica').fontSize(isA5 ? 5.6 : 6.8).fillColor(mutedColor);
      termsList.forEach(t => {
        doc.text(`•  ${t}`, margin + 3, curY, { width: contentWidth - 6, lineBreak: false });
        curY += isA5 ? 6.8 : 8.5;
      });

      curY += isA5 ? 3 : 5;

      // 9. --- BANK & GPAY REMITTANCE CARD ---
      const bH = isA5 ? 30 : 36;
      doc.rect(margin, curY, contentWidth, bH).fill('#F8FAFC').stroke(borderColor);
      doc.rect(margin, curY, contentWidth, 2).fill(accentGreen);

      doc.font('Helvetica-Bold').fontSize(isA5 ? 6 : 7).fillColor(primaryDark)
        .text('BANK & GPAY DETAILS FOR DIRECT PAYMENT / ADVANCE TRANSFER:', margin + 6, curY + 3.5, { lineBreak: false });

      const halfW = (contentWidth - 12) / 2;
      const bY = curY + (isA5 ? 12 : 15);

      doc.font('Helvetica').fontSize(isA5 ? 5.8 : 6.8).fillColor(darkColor);
      doc.text(`Bank: `, margin + 6, bY, { lineBreak: false });
      doc.font('Helvetica-Bold').text(`${settings.bank_name || 'Indian Bank'} (${settings.bank_branch || 'Perundurai'})  |  A/c: ${settings.bank_account_no || '6659330152'}`, margin + 28, bY, { lineBreak: false });

      const rightBx = margin + halfW + 6;
      doc.font('Helvetica').text(`IFSC: `, rightBx, bY, { lineBreak: false });
      doc.font('Helvetica-Bold').text(`${settings.bank_ifsc || 'IDIB000P034'}`, rightBx + 22, bY, { lineBreak: false });

      doc.fillColor(accentGreen).font('Helvetica-Bold');
      doc.text(`GPay: ${settings.gpay_number || '+91 97156 22499 (MS Udhayam Agencies)'}`, rightBx, bY + (isA5 ? 8 : 10), { lineBreak: false });

      // 10. --- AUTHORIZED SIGNATORY ---
      const signY = pageHeight - margin - (isA5 ? 34 : 42);
      doc.font('Helvetica-Bold').fontSize(isA5 ? 6.2 : 7.5).fillColor(darkColor);
      doc.text(`For ${settings.company_name || 'UDHAYAM AGENCIES'}`, pageWidth - margin - 150, signY, { width: 150, align: 'right', lineBreak: false });
      doc.font('Helvetica').fontSize(isA5 ? 5.6 : 6.8).fillColor(mutedColor);
      doc.text('Authorized Signatory', pageWidth - margin - 150, signY + (isA5 ? 11 : 14), { width: 150, align: 'right', lineBreak: false });

      // 11. --- MODERN BOTTOM FOOTER BAR (Pinned across all pages) ---
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);

        const footY = pageHeight - margin - 10;
        // Subtle divider rule
        doc.strokeColor(borderColor).lineWidth(0.5);
        doc.moveTo(margin, footY - 4).lineTo(pageWidth - margin, footY - 4).stroke();

        doc.font('Helvetica').fontSize(isA5 ? 5.2 : 6.2).fillColor(mutedColor);

        // 3 Contact Columns (as in uploaded image)
        const thirdW = contentWidth / 3;
        doc.text(`Phone: ${settings.company_phone || '+91 97156 22499'}`, margin, footY, { width: thirdW, align: 'left', lineBreak: false });
        doc.text(settings.company_address ? settings.company_address.replace(/\r?\n+/g, ', ') : 'Perundurai - 638052', margin + thirdW, footY, { width: thirdW, align: 'center', lineBreak: false, ellipsis: true });
        doc.text(`GST: ${settings.company_gstin || '33AADFU6496M1ZJ'} | Page ${i + 1}/${totalPages}`, margin + (thirdW * 2), footY, { width: thirdW, align: 'right', lineBreak: false });
      }

      doc.end();

      writeStream.on('finish', () => {
        resolve({
          filename,
          filePath,
          fileSize: fs.statSync(filePath).size
        });
      });

      writeStream.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateQuotationPDF,
  pdfCurrency
};
