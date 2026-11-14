/**
 * Custom Line-Item Sorting Utility for SOFAST POS Bill Printing (Backend)
 *
 * Strict Priority Order for Print Output:
 * 1. Priority 1 (A–Z): Items starting with alphabetic characters 'A' through 'Z'
 *    (strictly excluding 'SF' prefix), sorted ascending (A to Z).
 * 2. Priority 2 (0–9): Items starting with numeric digits '0' through '9',
 *    sorted ascending (0 to 9).
 * 3. Priority 3 ('SF' Prefix): Any items starting with 'SF' (case-insensitive, e.g. SF, sf, Sf)
 *    must be isolated and appended at the VERY BOTTOM/END of the bill's item list,
 *    sorted ascending.
 */

export function cleanSortString(str) {
  const trimmed = String(str || '').trim();
  const cleaned = trimmed.replace(/^[^a-zA-Z0-9]+/, '').trim();
  return cleaned || trimmed;
}

export function getItemPriority(sortKey) {
  const cleaned = cleanSortString(sortKey);
  if (!cleaned) return 4;

  if (/^sf/i.test(cleaned)) {
    return 3;
  }

  const firstChar = cleaned.charAt(0);
  if (/[a-zA-Z]/.test(firstChar)) {
    return 1;
  }
  if (/[0-9]/.test(firstChar)) {
    return 2;
  }
  return 4;
}

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

export function compareStringsNatural(strA, strB) {
  const sA = cleanSortString(strA);
  const sB = cleanSortString(strB);

  if (!sA && !sB) return 0;
  if (!sA) return 1;
  if (!sB) return -1;

  return sA.localeCompare(sB, undefined, { sensitivity: 'base', numeric: true });
}

export function compareBillPrintItems(itemA, itemB) {
  const strA = getItemSortString(itemA);
  const strB = getItemSortString(itemB);

  const prioA = getItemPriority(strA);
  const prioB = getItemPriority(strB);

  if (prioA !== prioB) {
    return prioA - prioB;
  }

  const cmp = compareStringsNatural(strA, strB);
  if (cmp !== 0) return cmp;

  const descA = String(itemA?.description || '').trim();
  const descB = String(itemB?.description || '').trim();
  return compareStringsNatural(descA, descB);
}

export default compareBillPrintItems;

