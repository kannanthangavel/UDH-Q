/**
 * Date Formatting & Normalization Helper for UD-QM
 * Strictly formats all dates to Indian Standard DD/MM/YYYY
 */

function parseDateAny(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const str = String(val).trim();

  // Match DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    return new Date(year, month, day);
  }

  // Match YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    return new Date(year, month, day);
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function toDMYString(dateObj) {
  if (!dateObj || isNaN(dateObj.getTime())) return '';
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatToDMY(dateInput, fallbackBaseDate = null, defaultDaysOffset = 7) {
  if (!dateInput) {
    if (fallbackBaseDate) {
      const base = parseDateAny(fallbackBaseDate) || new Date();
      base.setDate(base.getDate() + defaultDaysOffset);
      return toDMYString(base);
    }
    return toDMYString(new Date());
  }

  const str = String(dateInput).trim();

  // If already DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const parts = str.split('/');
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    return `${d}/${m}/${y}`;
  }

  // If DD-MM-YYYY
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(str)) {
    const parts = str.split('-');
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    return `${d}/${m}/${y}`;
  }

  // If numeric days e.g. "7", "15", "7 Days", "30 Days", "+8"
  const daysMatch = str.match(/^(\d+)\s*(?:days?|d)?$/i);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    const base = parseDateAny(fallbackBaseDate) || new Date();
    base.setDate(base.getDate() + days);
    return toDMYString(base);
  }

  // If YYYY-MM-DD or parseable ISO date
  const parsed = parseDateAny(str);
  if (parsed && !isNaN(parsed.getTime())) {
    return toDMYString(parsed);
  }

  return str;
}

module.exports = {
  parseDateAny,
  toDMYString,
  formatToDMY
};
