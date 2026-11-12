const xlsx = require('xlsx');
const { computeFileHash } = require('../utils/security');
const { db, logAudit } = require('../db/database');

const REQUIRED_HEADERS = ['item name', 'sale rate'];
const EXPECTED_COLUMNS = ['S.No', 'Item Name', 'Sale Rate', 'DPL', 'Purc Rate', 'HSN/SAC', 'Main Unit', 'Cost'];

function parseWorkbook(fileBuffer, originalFilename) {
  const fileHash = computeFileHash(fileBuffer);
  const wb = xlsx.read(fileBuffer, { type: 'buffer' });

  const result = {
    filename: originalFilename,
    fileHash,
    sheetsFound: wb.SheetNames,
    sections: {},
    errors: [],
    warnings: [],
    totalRows: 0,
    validRows: 0
  };

  // Check for PAINTS and ACCESS worksheets
  let hasPaintSheet = false;
  let hasAccessSheet = false;

  for (const sheetName of wb.SheetNames) {
    const upper = sheetName.toUpperCase();
    let sectionType = null;
    if (upper.includes('PAINT')) {
      sectionType = 'PAINTS';
      hasPaintSheet = true;
    } else if (upper.includes('ACCESS')) {
      sectionType = 'ACCESS';
      hasAccessSheet = true;
    }

    if (!sectionType) continue;

    const sheet = wb.Sheets[sheetName];
    const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    result.totalRows += rawRows.length;

    // Detect header row dynamically
    let headerRowIdx = -1;
    let headerCols = [];

    for (let i = 0; i < Math.min(15, rawRows.length); i++) {
      const row = rawRows[i] || [];
      const rowText = row.map(c => String(c || '').trim().toLowerCase()).join(' | ');
      if (REQUIRED_HEADERS.every(h => rowText.includes(h))) {
        headerRowIdx = i;
        headerCols = row.map(c => String(c || '').trim());
        break;
      }
    }

    if (headerRowIdx === -1) {
      result.errors.push(`Worksheet "${sheetName}" is missing required header row containing "Item Name" and "Sale Rate".`);
      continue;
    }

    // Map column indices
    const colMap = {};
    headerCols.forEach((col, idx) => {
      const lower = col.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (lower.includes('sno') || lower === 's' || lower === 'no') colMap.s_no = idx;
      else if (lower.includes('itemname') || lower.includes('product') || lower.includes('description')) colMap.item_name = idx;
      else if (lower.includes('salerate') || lower.includes('salesrate') || lower.includes('mrp')) colMap.sale_rate = idx;
      else if (lower.includes('dpl')) colMap.dpl = idx;
      else if (lower.includes('purcrate') || lower.includes('purchaserate') || lower.includes('buyrate')) colMap.purc_rate = idx;
      else if (lower.includes('hsn') || lower.includes('sac')) colMap.hsn_sac = idx;
      else if (lower.includes('mainunit') || lower.includes('unit') || lower.includes('uom')) colMap.main_unit = idx;
      else if (lower.includes('cost')) colMap.cost = idx;
    });

    if (colMap.item_name === undefined || colMap.sale_rate === undefined) {
      result.errors.push(`Worksheet "${sheetName}" could not map Item Name or Sale Rate column indices.`);
      continue;
    }

    // Extract items
    const validItems = [];
    let skippedCount = 0;

    for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || !row.length) continue;

      const itemName = String(row[colMap.item_name] || '').trim();
      if (!itemName) {
        skippedCount++;
        continue;
      }

      const saleRate = parseFloat(row[colMap.sale_rate]) || 0;
      const sNo = colMap.s_no !== undefined ? (parseInt(row[colMap.s_no], 10) || (validItems.length + 1)) : (validItems.length + 1);
      const dpl = colMap.dpl !== undefined ? (parseFloat(row[colMap.dpl]) || 0) : 0;
      const purcRate = colMap.purc_rate !== undefined ? (parseFloat(row[colMap.purc_rate]) || 0) : 0;
      const hsnSac = colMap.hsn_sac !== undefined ? String(row[colMap.hsn_sac] || '').trim() : '';
      const mainUnit = colMap.main_unit !== undefined ? String(row[colMap.main_unit] || 'Nos').trim() : 'Nos';
      const cost = colMap.cost !== undefined ? (parseFloat(row[colMap.cost]) || 0) : 0;

      validItems.push({
        s_no: sNo,
        item_name: itemName,
        details: '',
        sale_rate: saleRate,
        dpl,
        purc_rate: purcRate,
        hsn_sac: hsnSac,
        main_unit: mainUnit,
        cost,
        section: sectionType
      });
    }

    result.sections[sectionType] = {
      sheetName,
      headerRowIndex: headerRowIdx + 1,
      headers: headerCols,
      itemCount: validItems.length,
      skippedCount,
      preview: validItems.slice(0, 10),
      items: validItems
    };

    result.validRows += validItems.length;
  }

  if (!hasPaintSheet && !hasAccessSheet) {
    result.errors.push('No "PAINTS" or "ACCESS" worksheets found in the workbook. Please ensure the Excel file contains these sheets.');
  }

  // Check if file hash was already imported
  const existingImport = db.prepare('SELECT id, filename, import_timestamp FROM import_history WHERE file_hash = ?').get(fileHash);
  if (existingImport) {
    result.warnings.push(`Notice: This exact rate sheet file was previously imported on ${existingImport.import_timestamp} as "${existingImport.filename}". Re-importing will update product records.`);
    result.isDuplicate = true;
    result.previousImport = existingImport;
  } else {
    result.isDuplicate = false;
  }

  return result;
}

function commitImport(parsedData, user) {
  if (!parsedData || parsedData.errors.length > 0) {
    throw new Error('Cannot commit invalid rate sheet: ' + parsedData.errors.join(', '));
  }

  let totalImported = 0;
  let totalUpdated = 0;
  const sectionSummary = {};

  const findExisting = db.prepare('SELECT id FROM products WHERE item_name = ? AND section = ?');
  const updateProduct = db.prepare(`
    UPDATE products
    SET s_no = ?, sale_rate = ?, dpl = ?, purc_rate = ?, hsn_sac = ?, main_unit = ?, cost = ?,
        source_filename = ?, import_timestamp = datetime('now'), is_active = 1
    WHERE id = ?
  `);
  const insertProduct = db.prepare(`
    INSERT INTO products (s_no, item_name, details, sale_rate, dpl, purc_rate, hsn_sac, main_unit, cost, section, source_filename, import_timestamp, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 1)
  `);

  const transaction = db.transaction(() => {
    for (const [section, data] of Object.entries(parsedData.sections)) {
      let count = 0;
      for (const item of data.items) {
        const existing = findExisting.get(item.item_name, item.section);
        if (existing) {
          updateProduct.run(
            item.s_no,
            item.sale_rate,
            item.dpl,
            item.purc_rate,
            item.hsn_sac,
            item.main_unit,
            item.cost,
            parsedData.filename,
            existing.id
          );
          totalUpdated++;
        } else {
          insertProduct.run(
            item.s_no,
            item.item_name,
            item.details || '',
            item.sale_rate,
            item.dpl,
            item.purc_rate,
            item.hsn_sac,
            item.main_unit,
            item.cost,
            item.section,
            parsedData.filename
          );
          totalImported++;
        }
        count++;
      }
      sectionSummary[section] = count;
    }

    // Insert into import_history
    const historyResult = db.prepare(`
      INSERT INTO import_history (filename, file_hash, imported_by, rows_processed, rows_imported, rows_skipped, section_summary)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      parsedData.filename,
      parsedData.fileHash,
      user?.name || 'Administrator',
      parsedData.validRows,
      totalImported + totalUpdated,
      0,
      JSON.stringify(sectionSummary)
    );

    // Record in audit_logs
    logAudit(
      user?.id || 1,
      user?.email || 'admin@udhayam.com',
      user?.role || 'admin',
      'IMPORT_RATE_SHEET',
      'IMPORT',
      historyResult.lastInsertRowid,
      `Imported rate sheet "${parsedData.filename}": ${totalImported} new, ${totalUpdated} updated. Summary: ${JSON.stringify(sectionSummary)}`
    );
  });

  transaction();

  return {
    success: true,
    filename: parsedData.filename,
    totalProcessed: parsedData.validRows,
    totalImported,
    totalUpdated,
    sectionSummary
  };
}

module.exports = {
  parseWorkbook,
  commitImport
};
