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
 */
function generateQuotationPDF(quotation, items, settings) {
  return new Promise((resolve, reject) => {
    try {
      const isA5 = (quotation.paper_size || 'A5').toUpperCase() === 'A5';
      const pageSize = isA5 ? 'A5' : 'A4';
      const margin = isA5 ? 20 : 28;

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

      // Design System Colors (Udhayam Brand Palette)
      const primaryColor = '#044E54';      // Deep Udhayam Teal
      const primaryDark = '#023035';       // Dark Teal
      const accentGreen = '#72B01D';       // Udhayam Lime Green
      const darkColor = '#0F172A';         // Slate 900
      const mutedColor = '#475569';        // Slate 600
      const lightBg = '#F8FAFC';           // Slate 50
      const borderColor = '#CBD5E1';       // Slate 300
      const lightBorder = '#E2E8F0';       // Slate 200

      // 1. --- TOP HEADER BOX ---
      const headerTop = margin;
      const headerHeight = isA5 ? 54 : 64;
      doc.rect(margin, headerTop, contentWidth, headerHeight).fill(lightBg).stroke(borderColor);

      // Top colored accent bar
      doc.rect(margin, headerTop, contentWidth, 3).fill(primaryColor);

      // Document Type Badge (Right) - calculate dimensions first for text bounds
      const isGst = quotation.document_type === 'gst_quotation';
      const docTypeTitle = isGst ? 'GST QUOTATION' : 'ESTIMATION';
      const badgeWidth = isA5 ? 105 : 130;
      const badgeHeight = isA5 ? 20 : 24;
      const badgeX = pageWidth - margin - badgeWidth - 8;
      const badgeY = headerTop + 8;

      // Resolve Logo File
      let targetLogoPath = null;
      if (quotation.status === 'finalized' && quotation.logo_snapshot_path) {
        targetLogoPath = path.isAbsolute(quotation.logo_snapshot_path) 
          ? quotation.logo_snapshot_path 
          : path.join(snapshotsDir, quotation.logo_snapshot_path);
      } else if (quotation.logo_source === 'custom' && quotation.custom_logo_path) {
        targetLogoPath = path.isAbsolute(quotation.custom_logo_path)
          ? quotation.custom_logo_path
          : path.join(logosDir, quotation.custom_logo_path);
      } else if (quotation.logo_source !== 'none' && settings.company_logo) {
        targetLogoPath = path.isAbsolute(settings.company_logo)
          ? settings.company_logo
          : path.join(logosDir, settings.company_logo);
      }

      let hasRenderedLogo = false;
      const logoBoxWidth = isA5 ? 52 : 68;
      const logoBoxHeight = isA5 ? 38 : 48;

      if (targetLogoPath && fs.existsSync(targetLogoPath)) {
        try {
          doc.image(targetLogoPath, margin + 6, headerTop + 7, {
            fit: [logoBoxWidth, logoBoxHeight],
            align: 'center',
            valign: 'center'
          });
          hasRenderedLogo = true;
        } catch (err) {
          console.warn('[PDF] Could not embed company logo:', err.message);
        }
      }

      // Dynamic text horizontal start based on whether logo was rendered
      const companyTextX = hasRenderedLogo ? margin + logoBoxWidth + 12 : margin + 8;
      const maxTextWidth = badgeX - companyTextX - 6;

      // Company Info (Left)
      doc.fillColor(primaryDark)
        .font('Helvetica-Bold')
        .fontSize(isA5 ? (hasRenderedLogo ? 11 : 13) : (hasRenderedLogo ? 14 : 16))
        .text(settings.company_name || 'UDHAYAM AGENCIES', companyTextX, headerTop + 8, { width: maxTextWidth, ellipsis: true, lineBreak: false });

      doc.fillColor(mutedColor)
        .font('Helvetica')
        .fontSize(isA5 ? 6.8 : 8)
        .text(settings.company_tagline || 'Building Materials & Hardware Supplies', companyTextX, headerTop + (isA5 ? 20 : 25), { width: maxTextWidth, ellipsis: true, lineBreak: false });

      doc.text(settings.company_address || '41/10, KMR Complex, Old Bus Stand Road, Perundurai - 638052', companyTextX, headerTop + (isA5 ? 29 : 36), { width: maxTextWidth, ellipsis: true, lineBreak: false });

      doc.font('Helvetica-Bold').fillColor(darkColor)
        .text(`GSTIN: ${settings.company_gstin || '33AADFU6496M1ZJ'}  |  Phone: ${settings.company_phone || '+91 97156 22499'}`, companyTextX, headerTop + (isA5 ? 38 : 47), { width: maxTextWidth, ellipsis: true, lineBreak: false });

      doc.rect(badgeX, badgeY, badgeWidth, badgeHeight).fill(primaryColor);
      doc.fillColor('#FFFFFF')
        .font('Helvetica-Bold')
        .fontSize(isA5 ? 8.5 : 10)
        .text(docTypeTitle, badgeX, badgeY + (isA5 ? 5.5 : 6.5), { width: badgeWidth, align: 'center', lineBreak: false });

      doc.fillColor(mutedColor)
        .font('Helvetica')
        .fontSize(isA5 ? 6.5 : 7.5)
        .text(`Size: ${pageSize}  |  Single Sheet Slip`, badgeX, badgeY + badgeHeight + 4, { width: badgeWidth, align: 'center', lineBreak: false });

      // 2. --- CUSTOMER & QUOTATION DETAILS (2-Column Cards) ---
      const metaTop = headerTop + headerHeight + 5;
      const metaHeight = isA5 ? 48 : 58;
      const colWidth = (contentWidth - 6) / 2;

      // Left: Customer Box
      doc.rect(margin, metaTop, colWidth, metaHeight).fill('#FFFFFF').stroke(borderColor);
      // Small Header Ribbon for Customer
      doc.rect(margin, metaTop, colWidth, 14).fill('#F1F5F9');
      doc.fillColor(primaryDark).font('Helvetica-Bold').fontSize(isA5 ? 7 : 8)
        .text('QUOTATION TO / CUSTOMER DETAILS:', margin + 6, metaTop + 3.5, { lineBreak: false });

      doc.font('Helvetica').fontSize(isA5 ? 7 : 8).fillColor(darkColor);
      let custY = metaTop + 17;
      const customerDisplay = quotation.customer_name || 'Valued Customer';
      doc.font('Helvetica-Bold').text(customerDisplay, margin + 6, custY, { width: colWidth - 12, ellipsis: true, lineBreak: false });
      custY += isA5 ? 9 : 11;

      if (quotation.customer_company) {
        doc.font('Helvetica').fillColor(mutedColor).text(quotation.customer_company, margin + 6, custY, { width: colWidth - 12, ellipsis: true, lineBreak: false });
        custY += isA5 ? 8.5 : 10.5;
      }
      if (quotation.customer_phone) {
        doc.font('Helvetica').fillColor(darkColor).text(`Phone: ${quotation.customer_phone}`, margin + 6, custY, { width: colWidth - 12, ellipsis: true, lineBreak: false });
        custY += isA5 ? 8.5 : 10.5;
      } else if (quotation.customer_address) {
        doc.font('Helvetica').fillColor(mutedColor).text(quotation.customer_address, margin + 6, custY, { width: colWidth - 12, ellipsis: true, lineBreak: false });
      }

      // Right: Quotation Metadata Box
      const rightColX = margin + colWidth + 6;
      doc.rect(rightColX, metaTop, colWidth, metaHeight).fill('#FFFFFF').stroke(borderColor);
      doc.rect(rightColX, metaTop, colWidth, 14).fill('#F1F5F9');
      doc.fillColor(primaryDark).font('Helvetica-Bold').fontSize(isA5 ? 7 : 8)
        .text('QUOTATION REFERENCE:', rightColX + 6, metaTop + 3.5, { lineBreak: false });

      const quoteDate = quotation.created_at ? new Date(quotation.created_at).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN');
      const validityDays = quotation.validity_days || 7;

      doc.font('Helvetica').fontSize(isA5 ? 7 : 8).fillColor(darkColor);
      let metaY = metaTop + 17;
      doc.font('Helvetica-Bold').text(`Quote No: ${quotation.quotation_number}`, rightColX + 6, metaY, { width: colWidth - 12, lineBreak: false });
      metaY += isA5 ? 9 : 11;
      doc.font('Helvetica').text(`Date: ${quoteDate}   |   Valid For: ${validityDays} Days`, rightColX + 6, metaY, { width: colWidth - 12, lineBreak: false });
      metaY += isA5 ? 8.5 : 10.5;
      doc.text(`Payment: ${quotation.payment_terms || 'Immediate / Against Delivery'}`, rightColX + 6, metaY, { width: colWidth - 12, ellipsis: true, lineBreak: false });

      // 3. --- PRODUCT ITEMS TABLE DEFINITIONS ---
      // Perfectly calibrated column widths summing exactly to contentWidth
      const colDefs = isA5 ? [
        { key: 'sno', label: 'S.No', width: 20, align: 'center' },
        { key: 'name', label: 'Item Name / Description', width: 105, align: 'left' },
        { key: 'details', label: 'Details / Remarks', width: 62, align: 'left' },
        { key: 'hsn', label: 'HSN', width: 36, align: 'center' },
        { key: 'qty', label: 'Qty', width: 24, align: 'right' },
        { key: 'unit', label: 'Unit', width: 24, align: 'center' },
        { key: 'rate', label: 'Rate (₹)', width: 38, align: 'right' },
        { key: 'gst', label: 'GST%', width: 24, align: 'center' },
        { key: 'total', label: 'Total (₹)', width: 46.53, align: 'right' }
      ] : [
        { key: 'sno', label: 'S.No', width: 26, align: 'center' },
        { key: 'name', label: 'Product Name & Description', width: 154, align: 'left' },
        { key: 'details', label: 'Details / Specifications', width: 92, align: 'left' },
        { key: 'hsn', label: 'HSN Code', width: 48, align: 'center' },
        { key: 'qty', label: 'Qty', width: 30, align: 'right' },
        { key: 'unit', label: 'Unit', width: 30, align: 'center' },
        { key: 'rate', label: 'Rate (Incl Tax)', width: 50, align: 'right' },
        { key: 'gst', label: 'GST %', width: 36, align: 'center' },
        { key: 'total', label: 'Total (INR)', width: 73.28, align: 'right' }
      ];

      const tableTop = metaTop + metaHeight + 6;
      const tableHeaderHeight = isA5 ? 17 : 20;

      function drawTableHeader(yPos) {
        doc.rect(margin, yPos, contentWidth, tableHeaderHeight).fill(primaryColor);
        let curX = margin;
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(isA5 ? 7 : 8);

        colDefs.forEach(col => {
          const textX = col.align === 'left' ? curX + 4 : curX;
          const textW = col.align === 'left' ? col.width - 6 : col.width;
          doc.text(col.label, textX, yPos + (isA5 ? 4.5 : 5.5), {
            width: textW,
            align: col.align,
            lineBreak: false
          });
          curX += col.width;
        });
      }

      drawTableHeader(tableTop);

      // 4. --- PRODUCT ROWS & GRID LINES ---
      let curY = tableTop + tableHeaderHeight;
      const rowHeight = isA5 ? 16 : 19;
      const bottomBudget = isA5 ? 142 : 160; // Space needed for totals, bank details, and footer

      // Draw item rows
      items.forEach((item, index) => {
        // Page break check if items overflow available page space
        if (curY + rowHeight + bottomBudget > pageHeight - margin) {
          doc.addPage({ size: pageSize, margin: margin });
          curY = margin;
          drawTableHeader(curY);
          curY += tableHeaderHeight;
        }

        const isEven = index % 2 === 0;
        const rowBg = isEven ? '#FFFFFF' : '#F8FAFC';

        // Row background
        doc.rect(margin, curY, contentWidth, rowHeight).fill(rowBg).stroke(lightBorder);

        // Vertical column dividers
        let divX = margin;
        doc.strokeColor(lightBorder).lineWidth(0.5);
        for (let i = 0; i < colDefs.length - 1; i++) {
          divX += colDefs[i].width;
          doc.moveTo(divX, curY).lineTo(divX, curY + rowHeight).stroke();
        }

        // Row text content
        let colX = margin;
        const textY = curY + (isA5 ? 4 : 5);
        doc.font('Helvetica').fontSize(isA5 ? 6.8 : 7.8).fillColor(darkColor);

        // 1. S.No
        doc.text(String(index + 1), colX, textY, { width: colDefs[0].width, align: 'center', lineBreak: false });
        colX += colDefs[0].width;

        // 2. Product Name
        doc.font('Helvetica-Bold').text(item.product_name, colX + 3, textY, {
          width: colDefs[1].width - 6,
          height: rowHeight - 2,
          ellipsis: true,
          lineBreak: false
        });
        colX += colDefs[1].width;

        // 3. Details / Remarks (New Column)
        doc.font('Helvetica').fillColor(mutedColor).text(item.specification || '-', colX + 3, textY, {
          width: colDefs[2].width - 6,
          height: rowHeight - 2,
          ellipsis: true,
          lineBreak: false
        });
        doc.fillColor(darkColor);
        colX += colDefs[2].width;

        // 4. HSN
        doc.font('Helvetica').text(item.hsn_code || '-', colX, textY, { width: colDefs[3].width, align: 'center', lineBreak: false });
        colX += colDefs[3].width;

        // 5. Qty
        doc.text(String(item.quantity), colX, textY, { width: colDefs[4].width - 3, align: 'right', lineBreak: false });
        colX += colDefs[4].width;

        // 6. Unit
        doc.text(item.unit || 'Nos', colX, textY, { width: colDefs[5].width, align: 'center', lineBreak: false });
        colX += colDefs[5].width;

        // 7. Rate
        doc.text(pdfCurrency(item.unit_price).replace('Rs. ', ''), colX, textY, { width: colDefs[6].width - 3, align: 'right', lineBreak: false });
        colX += colDefs[6].width;

        // 8. GST%
        doc.text(`${item.gst_rate !== undefined ? item.gst_rate : 18}%`, colX, textY, { width: colDefs[7].width, align: 'center', lineBreak: false });
        colX += colDefs[7].width;

        // 9. Total Rate
        doc.font('Helvetica-Bold').text(pdfCurrency(item.line_total).replace('Rs. ', ''), colX, textY, { width: colDefs[8].width - 3, align: 'right', lineBreak: false });

        curY += rowHeight;
      });

      // Fill remaining space with clean blank ledger rows up to a minimum for visual balance (avoids gaping void)
      const minRows = isA5 ? 5 : 6;
      if (items.length < minRows) {
        const extraRows = minRows - items.length;
        for (let e = 0; e < extraRows; e++) {
          const rowBg = (items.length + e) % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
          doc.rect(margin, curY, contentWidth, rowHeight).fill(rowBg).stroke(lightBorder);

          // Vertical column dividers
          let divX = margin;
          doc.strokeColor(lightBorder).lineWidth(0.5);
          for (let i = 0; i < colDefs.length - 1; i++) {
            divX += colDefs[i].width;
            doc.moveTo(divX, curY).lineTo(divX, curY + rowHeight).stroke();
          }
          curY += rowHeight;
        }
      }

      // Outer table border
      doc.rect(margin, tableTop, contentWidth, curY - tableTop).stroke(borderColor);

      // 5. --- TOTALS & SUMMARY SECTION ---
      curY += 5;
      const summaryTop = curY;
      const summaryLeftWidth = isA5 ? contentWidth * 0.54 : contentWidth * 0.56;
      const summaryRightWidth = contentWidth - summaryLeftWidth - 6;
      const summaryHeight = isA5 ? 54 : 64;

      // Left Box: Amount in words & Notes
      doc.rect(margin, summaryTop, summaryLeftWidth, summaryHeight).fill('#FFFFFF').stroke(borderColor);
      doc.fillColor(primaryDark).font('Helvetica-Bold').fontSize(isA5 ? 6.8 : 7.8)
        .text('AMOUNT IN WORDS (INR):', margin + 6, summaryTop + 4, { lineBreak: false });

      doc.font('Helvetica-Oblique').fontSize(isA5 ? 6.5 : 7.5).fillColor(darkColor)
        .text(quotation.amount_in_words || 'Rupees Zero Only', margin + 6, summaryTop + 14, { width: summaryLeftWidth - 12 });

      if (quotation.notes) {
        doc.font('Helvetica-Bold').fontSize(isA5 ? 6 : 7).fillColor(mutedColor)
          .text('Terms / Remarks:', margin + 6, summaryTop + (isA5 ? 28 : 34), { lineBreak: false });
        doc.font('Helvetica').fontSize(isA5 ? 5.8 : 6.8).fillColor(mutedColor)
          .text(quotation.notes.replace(/\n+/g, ' | '), margin + 6, summaryTop + (isA5 ? 36 : 44), { width: summaryLeftWidth - 12, height: 16, ellipsis: true });
      }

      // Right Box: Totals breakdown
      const rightX = margin + summaryLeftWidth + 6;
      doc.rect(rightX, summaryTop, summaryRightWidth, summaryHeight).fill(lightBg).stroke(borderColor);

      let totRowY = summaryTop + 4;
      const rowStep = isA5 ? 10.5 : 12;
      const drawTotRow = (label, val, isBold = false) => {
        doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(isA5 ? 6.8 : 7.8)
          .fillColor(isBold ? primaryDark : darkColor);
        doc.text(label, rightX + 6, totRowY, { width: summaryRightWidth * 0.5, lineBreak: false });
        doc.text(val, rightX + summaryRightWidth * 0.5, totRowY, { width: summaryRightWidth * 0.5 - 6, align: 'right', lineBreak: false });
        totRowY += rowStep;
      };

      drawTotRow('Subtotal (Gross):', pdfCurrency(quotation.subtotal));
      if (quotation.discount_total > 0) {
        drawTotRow('Discount:', `-${pdfCurrency(quotation.discount_total)}`);
      }
      if (quotation.document_type === 'gst_quotation' && quotation.tax_total > 0) {
        drawTotRow('Total GST Tax:', pdfCurrency(quotation.tax_total));
      }
      if (quotation.delivery_charges > 0) {
        drawTotRow('Delivery Charges:', pdfCurrency(quotation.delivery_charges));
      }

      // Grand Total Highlight Bar
      const grandTotalHeight = isA5 ? 17 : 20;
      const grandTotalY = summaryTop + summaryHeight - grandTotalHeight;
      doc.rect(rightX, grandTotalY, summaryRightWidth, grandTotalHeight).fill(primaryColor);
      doc.font('Helvetica-Bold').fontSize(isA5 ? 8 : 9.5).fillColor('#FFFFFF');
      doc.text('GRAND TOTAL:', rightX + 6, grandTotalY + (isA5 ? 4 : 5), { width: summaryRightWidth * 0.45, lineBreak: false });
      doc.text(pdfCurrency(quotation.grand_total), rightX + summaryRightWidth * 0.45, grandTotalY + (isA5 ? 4 : 5), { width: summaryRightWidth * 0.55 - 6, align: 'right', lineBreak: false });

      // 6. --- BANK & PAYMENT DETAILS (Ground-anchored to avoid floating gap) ---
      const bankTop = summaryTop + summaryHeight + 5;
      const bankHeight = isA5 ? 40 : 48;
      doc.rect(margin, bankTop, contentWidth, bankHeight).fill('#F8FAFC').stroke(borderColor);

      // Subtle brand accent top border for payment section
      doc.rect(margin, bankTop, contentWidth, 2).fill(accentGreen);

      doc.font('Helvetica-Bold').fontSize(isA5 ? 6.8 : 7.8).fillColor(primaryDark)
        .text('BANK & GPAY DETAILS FOR DIRECT PAYMENT / ADVANCE TRANSFER:', margin + 8, bankTop + 4, { lineBreak: false });

      const bColW = (contentWidth - 16) / 2;
      const bY1 = bankTop + (isA5 ? 14 : 17);
      const bY2 = bankTop + (isA5 ? 24 : 29);

      // Left Bank Column
      doc.font('Helvetica').fontSize(isA5 ? 6.5 : 7.5).fillColor(darkColor);
      doc.text(`Account Name: `, margin + 8, bY1, { lineBreak: false });
      doc.font('Helvetica-Bold').text(`${settings.bank_account_name || 'Udhayam Agencies'}`, margin + 65, bY1, { lineBreak: false });

      doc.font('Helvetica').text(`Bank: `, margin + 8, bY2, { lineBreak: false });
      doc.font('Helvetica-Bold').text(`${settings.bank_name || 'Indian Bank'}  |  Acc: ${settings.bank_account_no || '6659330152'}`, margin + 35, bY2, { lineBreak: false });

      // Right Bank Column
      const rightBankX = margin + bColW + 8;
      doc.font('Helvetica').text(`IFSC: `, rightBankX, bY1, { lineBreak: false });
      doc.font('Helvetica-Bold').text(`${settings.bank_ifsc || 'Perundurai'}`, rightBankX + 26, bY1, { lineBreak: false });

      doc.fillColor('#059669').font('Helvetica-Bold');
      doc.text(`GPay: ${settings.gpay_number || '+91 97156 22499 (MS Udhayam Agencies)'}`, rightBankX, bY2, { lineBreak: false });

      // 7. --- SIGNATURE & COMPLIANCE FOOTER ---
      const footerTop = bankTop + bankHeight + 5;
      doc.font('Helvetica').fontSize(isA5 ? 5.8 : 6.8).fillColor(mutedColor);
      doc.text('Standard terms apply. Computer generated quotation.', margin, footerTop + 2, { width: contentWidth * 0.6, lineBreak: false });

      doc.font('Helvetica-Bold').fontSize(isA5 ? 6.5 : 7.5).fillColor(darkColor);
      doc.text(`For ${settings.company_name || 'UDHAYAM AGENCIES'}`, pageWidth - margin - 140, footerTop + 2, { width: 140, align: 'right', lineBreak: false });
      doc.font('Helvetica').fontSize(isA5 ? 5.8 : 6.8).fillColor(mutedColor);
      doc.text('Authorized Signatory', pageWidth - margin - 140, footerTop + (isA5 ? 14 : 17), { width: 140, align: 'right', lineBreak: false });

      // 8. --- PAGE NUMBERING ---
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc.font('Helvetica').fontSize(isA5 ? 5.5 : 6.5).fillColor(mutedColor);
        doc.text(
          `Page ${i + 1} of ${totalPages}  •  Udhayam Quotation Automation System`,
          margin,
          pageHeight - (isA5 ? 12 : 16),
          { width: contentWidth, align: 'center', lineBreak: false }
        );
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
