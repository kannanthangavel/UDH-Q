const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

/**
 * Normalizes text for comparison and matching
 */
function normalizeText(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s\.\-\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses numeric price from various string formats (₹ 1,500.00, Rs. 290, 290.00)
 */
function parsePrice(value) {
  if (value === null || value === undefined || value === '') {
    return { valid: false, value: null, raw: value };
  }
  if (typeof value === 'number') {
    if (isNaN(value) || value < 0) {
      return { valid: false, value: null, raw: value };
    }
    return { valid: true, value: Math.round(value * 100) / 100, raw: value };
  }

  // Clean string
  let str = String(value).trim();
  // Strip currency prefixes first
  str = str.replace(/₹|rs\.?|inr/gi, '').trim();
  // Strip commas and spaces
  str = str.replace(/[\,\s]/g, '');
  // If multiple dots, keep only the last dot as decimal separator
  const parts = str.split('.');
  if (parts.length > 2) {
    str = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
  }
  const num = parseFloat(str);
  if (isNaN(num) || num < 0) {
    return { valid: false, value: null, raw: value };
  }
  return { valid: true, value: Math.round(num * 100) / 100, raw: value };
}

/**
 * Inspects workbook and lists worksheets with row counts
 */
function inspectWorkbook(filePath) {
  const workbook = xlsx.readFile(filePath, { cellFormula: false, cellHTML: false });
  const sheets = workbook.SheetNames.map(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const range = xlsx.utils.decode_range(sheet['!ref'] || 'A1:A1');
    const rowCount = range.e.r - range.s.r + 1;
    return {
      name: sheetName,
      rowCount: rowCount > 0 ? rowCount : 0
    };
  });

  return {
    sheetNames: workbook.SheetNames,
    sheets,
    defaultSheet: workbook.SheetNames[0] || ''
  };
}

/**
 * Previews rows of a worksheet to allow header selection and preview
 */
function getWorksheetPreview(filePath, sheetName, maxRows = 25) {
  const workbook = xlsx.readFile(filePath, { cellFormula: false, cellHTML: false });
  const selectedSheet = sheetName || workbook.SheetNames[0];
  const sheet = workbook.Sheets[selectedSheet];
  if (!sheet) {
    throw new Error(`Sheet "${selectedSheet}" not found in workbook.`);
  }

  const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const previewRows = rawRows.slice(0, maxRows);

  // Auto-detect best header row candidate
  let detectedHeaderRowIndex = 0;
  let maxKeywordScore = -1;

  const headerKeywords = [
    'product', 'item', 'name', 'details', 'specification', 'description',
    'rate', 'price', 'sales', 'purchase', 'hsn', 'code', 'unit', 'gst', 'tax'
  ];

  previewRows.forEach((row, index) => {
    if (!Array.isArray(row)) return;
    const rowStr = row.map(cell => String(cell).toLowerCase().trim()).join(' ');
    let score = 0;
    headerKeywords.forEach(kw => {
      if (rowStr.includes(kw)) score += 1;
    });
    if (score > maxKeywordScore) {
      maxKeywordScore = score;
      detectedHeaderRowIndex = index;
    }
  });

  // Extract columns at detected header row
  const detectedHeaders = Array.isArray(previewRows[detectedHeaderRowIndex])
    ? previewRows[detectedHeaderRowIndex].map((h, i) => String(h || `Column ${i + 1}`).trim())
    : [];

  // Suggest column mappings based on detected headers
  const suggestedMapping = suggestColumnMapping(detectedHeaders);

  return {
    sheetName: selectedSheet,
    totalRows: rawRows.length,
    previewRows,
    detectedHeaderRowIndex,
    detectedHeaders,
    suggestedMapping
  };
}

/**
 * Suggests standard application field mappings for detected column headers
 */
function suggestColumnMapping(headers) {
  const mapping = {
    product_name: '',
    specification: '',
    hsn_code: '',
    sales_rate: '',
    purchase_rate: '',
    unit: '',
    gst_rate: '',
    item_code: '',
    brand: '',
    category: ''
  };

  const patterns = {
    product_name: [/product\s*name/i, /^product$/i, /^item\s*name$/i, /^item$/i, /^material$/i, /^description$/i],
    specification: [/^details$/i, /^spec/i, /^specification$/i, /^size$/i, /^grade$/i],
    hsn_code: [/hsn/i, /sac/i],
    sales_rate: [/sales?\s*rate/i, /selling\s*price/i, /^rate$/i, /^price$/i, /unit\s*rate/i, /mrp/i],
    purchase_rate: [/purchase\s*rate/i, /purchase\s*price/i, /cost\s*rate/i, /^cost$/i, /buy\s*rate/i],
    unit: [/^unit$/i, /^uom$/i, /unit\s*of\s*measure/i, /main\s*unit/i],
    gst_rate: [/gst\s*%/i, /^gst$/i, /tax\s*%/i, /^tax$/i, /gst\s*percentage/i],
    item_code: [/item\s*code/i, /^code$/i, /^sku$/i, /item\s*no/i, /part\s*no/i],
    brand: [/^brand$/i, /^make$/i, /manufacturer/i],
    category: [/^category$/i, /^group$/i, /^type$/i]
  };

  for (const [field, regexList] of Object.entries(patterns)) {
    for (const header of headers) {
      const cleanHeader = String(header).trim();
      if (!cleanHeader) continue;
      if (regexList.some(r => r.test(cleanHeader))) {
        mapping[field] = cleanHeader;
        break;
      }
    }
  }

  return mapping;
}

/**
 * Parses and validates products from the specified sheet using the column mapping
 */
function parseSheetProducts(filePath, sheetName, headerRowIndex, columnMapping) {
  const workbook = xlsx.readFile(filePath, { cellFormula: false, cellHTML: false });
  const sheet = workbook.Sheets[sheetName || workbook.SheetNames[0]];
  if (!sheet) {
    throw new Error(`Worksheet ${sheetName} could not be loaded.`);
  }

  const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (headerRowIndex >= rawRows.length) {
    throw new Error(`Header row index (${headerRowIndex}) exceeds total rows in sheet.`);
  }

  const headers = rawRows[headerRowIndex].map(h => String(h || '').trim());
  const dataRows = rawRows.slice(headerRowIndex + 1);

  // Map column names to indexes
  const colIndexes = {};
  for (const [field, colName] of Object.entries(columnMapping)) {
    if (colName) {
      const idx = headers.findIndex(h => h.toLowerCase() === colName.toLowerCase());
      if (idx !== -1) {
        colIndexes[field] = idx;
      }
    }
  }

  if (colIndexes.product_name === undefined) {
    throw new Error('Column mapping must include a valid "Product Name" column.');
  }

  const validProducts = [];
  const rowsWithWarnings = [];
  const seenCodes = new Set();
  let duplicateCodesCount = 0;
  let missingPricesCount = 0;
  let missingUnitsCount = 0;

  dataRows.forEach((row, index) => {
    // Skip completely empty rows
    const hasAnyContent = row.some(cell => String(cell).trim() !== '');
    if (!hasAnyContent) return;

    const rowNumber = headerRowIndex + 2 + index; // 1-indexed Excel row
    const productNameRaw = colIndexes.product_name !== undefined ? row[colIndexes.product_name] : '';
    const productName = String(productNameRaw || '').trim();

    if (!productName) {
      // Row has content but missing product name
      rowsWithWarnings.push({
        rowNumber,
        reason: 'Missing product name',
        data: row
      });
      return;
    }

    const itemCode = colIndexes.item_code !== undefined ? String(row[colIndexes.item_code] || '').trim() : '';
    const spec = colIndexes.specification !== undefined ? String(row[colIndexes.specification] || '').trim() : '';
    const brand = colIndexes.brand !== undefined ? String(row[colIndexes.brand] || '').trim() : '';
    const category = colIndexes.category !== undefined ? String(row[colIndexes.category] || '').trim() : '';
    const hsnCode = colIndexes.hsn_code !== undefined ? String(row[colIndexes.hsn_code] || '').trim() : '';
    const unitRaw = colIndexes.unit !== undefined ? String(row[colIndexes.unit] || '').trim() : '';
    const unit = unitRaw || 'Nos';

    if (!unitRaw) {
      missingUnitsCount++;
    }

    // Check duplicate code
    if (itemCode) {
      if (seenCodes.has(itemCode)) {
        duplicateCodesCount++;
      } else {
        seenCodes.add(itemCode);
      }
    }

    // Parse rates
    const salesRateParsed = colIndexes.sales_rate !== undefined ? parsePrice(row[colIndexes.sales_rate]) : { valid: false, value: null };
    const purchaseRateParsed = colIndexes.purchase_rate !== undefined ? parsePrice(row[colIndexes.purchase_rate]) : { valid: false, value: null };

    // Parse GST %
    let gstRate = 18.0;
    if (colIndexes.gst_rate !== undefined) {
      const parsedGst = parsePrice(row[colIndexes.gst_rate]);
      if (parsedGst.valid && parsedGst.value >= 0 && parsedGst.value <= 100) {
        gstRate = parsedGst.value;
      }
    }

    let priceStatus = 'verified';
    const warnings = [];

    if (!salesRateParsed.valid || salesRateParsed.value === null) {
      priceStatus = 'missing_price';
      missingPricesCount++;
      warnings.push('Sales price is missing or invalid.');
    } else if (salesRateParsed.value === 0) {
      priceStatus = 'review_required';
      warnings.push('Sales price is zero.');
    }

    if (!unitRaw) {
      warnings.push('Unit was missing; defaulted to "Nos" for review.');
    }

    const productRecord = {
      rowNumber,
      item_code: itemCode || `ITEM-${rowNumber}`,
      product_name: productName,
      normalized_name: normalizeText(`${productName} ${spec} ${brand}`),
      specification: spec,
      brand,
      category,
      unit,
      sales_rate: salesRateParsed.valid ? salesRateParsed.value : null,
      purchase_rate: purchaseRateParsed.valid ? purchaseRateParsed.value : null,
      is_tax_inclusive: 1, // Default sales rate includes tax as in Udhayam format
      gst_rate: gstRate,
      hsn_code: hsnCode,
      price_status: priceStatus,
      warnings,
      source_data: row
    };

    if (warnings.length > 0 && priceStatus !== 'verified') {
      rowsWithWarnings.push(productRecord);
    }

    validProducts.push(productRecord);
  });

  return {
    totalRowsExamined: dataRows.length,
    validProductsCount: validProducts.length,
    rowsWithWarningsCount: rowsWithWarnings.length,
    duplicateCodesCount,
    missingPricesCount,
    missingUnitsCount,
    products: validProducts,
    warnings: rowsWithWarnings.slice(0, 50) // Return sample warnings for inspect
  };
}

module.exports = {
  normalizeText,
  parsePrice,
  inspectWorkbook,
  getWorksheetPreview,
  suggestColumnMapping,
  parseSheetProducts
};
