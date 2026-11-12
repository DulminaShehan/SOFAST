/**
 * Item Sorting Utility for SOFAST POS Bill Printing
 *
 * Sorts bill line items in "A-Z, 0-9" order:
 * 1. Items starting with letters (A through Z) come FIRST in ascending alphabetical order.
 * 2. Items starting with numbers (0 through 9) come SECOND in ascending numerical/alphanumerical order.
 * 3. Special characters / symbols are stripped or placed last.
 */

export function getCharCategory(char) {
  if (!char) return 2;
  if (/[a-zA-Z]/.test(char)) return 0; // A-Z first
  if (/[0-9]/.test(char)) return 1;    // 0-9 second
  return 2;                            // Symbols last
}

export function cleanSortString(str) {
  const trimmed = String(str || '').trim();
  // Strip leading non-alphanumeric characters so symbols/quotes don't skew alphabetical sort
  const cleaned = trimmed.replace(/^[^a-zA-Z0-9]+/, '').trim();
  return cleaned || trimmed;
}

export function compareStringsAZ09(strA, strB) {
  const sA = cleanSortString(strA);
  const sB = cleanSortString(strB);

  if (!sA && !sB) return 0;
  if (!sA) return 1;
  if (!sB) return -1;

  const charA = sA.charAt(0);
  const charB = sB.charAt(0);

  const catA = getCharCategory(charA);
  const catB = getCharCategory(charB);

  if (catA !== catB) {
    return catA - catB;
  }

  return sA.localeCompare(sB, undefined, { sensitivity: 'base', numeric: true });
}

export function getItemSortString(item) {
  if (!item) return '';
  const isLabour = item.jobType === 'Labour' || item.type === 'Labour' || Boolean(item.isService);
  if (isLabour) {
    return (item.description || 'Delivery Charge').trim();
  }
  const desc = (item.description || item.name || item.itemName || '').trim();
  const code = (item.code || item.itemCode || '').trim();
  return desc || code || '';
}

/**
 * Main comparator for sorting bill print line items:
 * Primary: Description / Product Name (A-Z, 0-9)
 * Secondary (tie-breaker): Code (A-Z, 0-9)
 */
export function compareBillPrintItems(itemA, itemB) {
  const strA = getItemSortString(itemA);
  const strB = getItemSortString(itemB);

  const cmp = compareStringsAZ09(strA, strB);
  if (cmp !== 0) return cmp;

  const codeA = String(itemA?.code || itemA?.itemCode || '').trim();
  const codeB = String(itemB?.code || itemB?.itemCode || '').trim();
  return compareStringsAZ09(codeA, codeB);
}

