/**
 * Custom Line-Item Sorting Utility for SOFAST POS Bill Printing
 *
 * Strict Priority Order for Print Output:
 * 1. Priority 1 (A–Z): Items starting with alphabetic characters 'A' through 'Z'
 *    (strictly excluding 'SF' prefix), sorted ascending (A to Z).
 * 2. Priority 2 (0–9): Items starting with numeric digits '0' through '9',
 *    sorted ascending (0 to 9).
 * 3. Priority 3 ('SF' Prefix): Any items starting with 'SF' (case-insensitive, e.g. SF, sf, Sf)
 *    must be isolated and appended at the VERY BOTTOM/END of the bill's item list,
 *    sorted ascending.
 *
 * Applies exclusively to print preview and physical print layout without altering
 * chronological database or scan order.
 */

export function cleanSortString(str) {
  const trimmed = String(str || '').trim();
  // Strip leading non-alphanumeric characters so quotes/symbols don't skew alphabetical sort
  const cleaned = trimmed.replace(/^[^a-zA-Z0-9]+/, '').trim();
  return cleaned || trimmed;
}

/**
 * Determine item priority based on sorting key:
 * Priority 1: A-Z (excluding SF)
 * Priority 2: 0-9
 * Priority 3: SF prefix (isolated at very bottom)
 * Priority 4: Other / Symbols
 */
export function getItemPriority(sortKey) {
  const cleaned = cleanSortString(sortKey);
  if (!cleaned) return 4;

  // Priority 3: Items starting with 'SF' (case-insensitive) placed at very bottom
  if (/^sf/i.test(cleaned)) {
    return 3;
  }

  const firstChar = cleaned.charAt(0);

  // Priority 1: Alphabetic characters A-Z (excluding SF)
  if (/[a-zA-Z]/.test(firstChar)) {
    return 1;
  }

  // Priority 2: Numeric digits 0-9
  if (/[0-9]/.test(firstChar)) {
    return 2;
  }

  return 4;
}

/**
 * Extract primary sorting string for an item
 * Prioritizes item code, falling back to description
 */
export function getItemSortString(item) {
  if (!item) return '';
  const isLabour = item.jobType === 'Labour' || item.type === 'Labour' || Boolean(item.isService);
  if (isLabour) {
    return (item.description || 'Delivery Charge').trim();
  }
  const code = (item.code || item.itemCode || '').trim();
  const desc = (item.description || item.name || item.itemName || '').trim();
  return code || desc || '';
}

/**
 * Natural alphanumeric comparator for strings within the same priority bucket
 */
export function compareStringsNatural(strA, strB) {
  const sA = cleanSortString(strA);
  const sB = cleanSortString(strB);

  if (!sA && !sB) return 0;
  if (!sA) return 1;
  if (!sB) return -1;

  return sA.localeCompare(sB, undefined, { sensitivity: 'base', numeric: true });
}

/**
 * Main comparator for sorting bill print line items:
 * Strict Priority Order: A-Z (excl. SF) -> 0-9 -> SF* (bottom)
 */
export function compareBillPrintItems(itemA, itemB) {
  const strA = getItemSortString(itemA);
  const strB = getItemSortString(itemB);

  const prioA = getItemPriority(strA);
  const prioB = getItemPriority(strB);

  // Different priority buckets: order by priority (1 -> 2 -> 3 -> 4)
  if (prioA !== prioB) {
    return prioA - prioB;
  }

  // Same priority bucket: sort ascending naturally (A-Z, 0-9, etc.)
  const cmp = compareStringsNatural(strA, strB);
  if (cmp !== 0) return cmp;

  // Secondary tie-breaker by description
  const descA = String(itemA?.description || '').trim();
  const descB = String(itemB?.description || '').trim();
  return compareStringsNatural(descA, descB);
}

export default compareBillPrintItems;
