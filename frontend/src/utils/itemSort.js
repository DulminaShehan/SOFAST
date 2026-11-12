/**
 * Item Sorting Utility for SOFAST POS Bill Printing
 *
 * Implements Natural Alphanumeric Sorting for printed bills & receipts:
 * - Sort Item Codes in ascending natural alphanumeric order (0-9, A-Z).
 * - Numbers appear in ascending numerical order (e.g. 1, 2, 10).
 * - Letters appear alphabetically (A through Z).
 * - Mixed item codes are handled naturally (e.g. 01100342, 01100342K, 01100355, 01100610).
 * - Non-coded / Labour / Delivery charges appear at the end, sorted by description.
 * - Primary: Item Code (Natural Alphanumeric).
 * - Secondary (tie-breaker): Description / Product Name (A-Z, 0-9).
 */

export function getCharCategory(char) {
  if (!char) return 3;
  if (/[0-9]/.test(char)) return 1;    // 0-9 first
  if (/[a-zA-Z]/.test(char)) return 2; // A-Z second
  return 3;                            // Symbols last
}

export function cleanSortString(str) {
  const trimmed = String(str || '').trim();
  // Strip leading non-alphanumeric characters so symbols/quotes don't skew sort
  const cleaned = trimmed.replace(/^[^a-zA-Z0-9]+/, '').trim();
  return cleaned || trimmed;
}

/**
 * Natural Alphanumeric Comparator for Item Codes
 * Handles:
 * - Natural ascending numbers (e.g., 2 before 10)
 * - Padded / leading zero codes (e.g. 01100342 before 01100342K before 01100355)
 * - Alphanumeric codes (e.g. BA-1 before BA-2 before BA-10)
 * - Numbers (0-9) before letters (A-Z)
 */
export function compareItemCodes(codeA, codeB) {
  const strA = cleanSortString(codeA);
  const strB = cleanSortString(codeB);

  if (!strA && !strB) return 0;
  if (!strA) return 1;  // Missing code goes after valid code
  if (!strB) return -1;

  // Split into chunks of contiguous digits and non-digits
  const chunksA = strA.match(/(\d+|\D+)/g) || [strA];
  const chunksB = strB.match(/(\d+|\D+)/g) || [strB];
  const minLen = Math.min(chunksA.length, chunksB.length);

  for (let i = 0; i < minLen; i++) {
    const cA = chunksA[i];
    const cB = chunksB[i];

    if (cA === cB) continue;

    const isDigitA = /^\d+$/.test(cA);
    const isDigitB = /^\d+$/.test(cB);

    if (isDigitA && isDigitB) {
      const leadZeroA = cA.length > 1 && cA.startsWith('0');
      const leadZeroB = cB.length > 1 && cB.startsWith('0');

      if (leadZeroA || leadZeroB) {
        // Leading zero padded code (e.g. 01100342 vs 01100355 or 01 vs 36)
        const cmp = cA.localeCompare(cB);
        if (cmp !== 0) return cmp;
      } else {
        // Natural numbers: if lengths differ greatly at root (e.g. 24171014 vs 36),
        // compare lexicographically so prefix groups like 24... come before 36...
        if (i === 0 && Math.abs(cA.length - cB.length) >= 4) {
          const cmp = cA.localeCompare(cB);
          if (cmp !== 0) return cmp;
        }

        try {
          const valA = BigInt(cA);
          const valB = BigInt(cB);
          if (valA !== valB) {
            return valA < valB ? -1 : 1;
          }
          if (cA.length !== cB.length) {
            return cA.length - cB.length;
          }
        } catch {
          const cmp = cA.localeCompare(cB, undefined, { numeric: true });
          if (cmp !== 0) return cmp;
        }
      }
    } else {
      const isCharA = /[a-zA-Z]/.test(cA[0]);
      const isCharB = /[a-zA-Z]/.test(cB[0]);

      // Category order: Digits (0-9) come before letters (A-Z)
      const catA = isDigitA ? 1 : (isCharA ? 2 : 3);
      const catB = isDigitB ? 1 : (isCharB ? 2 : 3);

      if (catA !== catB) {
        return catA - catB;
      }

      const cmp = cA.localeCompare(cB, undefined, { sensitivity: 'base' });
      if (cmp !== 0) return cmp;
    }
  }

  return chunksA.length - chunksB.length;
}

export function compareStringsAZ09(strA, strB) {
  const sA = cleanSortString(strA);
  const sB = cleanSortString(strB);

  if (!sA && !sB) return 0;
  if (!sA) return 1;
  if (!sB) return -1;

  return sA.localeCompare(sB, undefined, { sensitivity: 'base', numeric: true });
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

/**
 * Main comparator for sorting bill print line items:
 * Primary: Item Code in ascending natural alphanumeric order (0-9, A-Z)
 * Non-coded parts / Labour / Delivery charges placed at the end
 * Secondary (tie-breaker): Description in ascending alphabetical order
 */
export function compareBillPrintItems(itemA, itemB) {
  const codeA = String(itemA?.code || itemA?.itemCode || '').trim();
  const codeB = String(itemB?.code || itemB?.itemCode || '').trim();

  const isLabourA = itemA?.jobType === 'Labour' || itemA?.type === 'Labour' || Boolean(itemA?.isService);
  const isLabourB = itemB?.jobType === 'Labour' || itemB?.type === 'Labour' || Boolean(itemB?.isService);

  // Both are material items with item codes -> compare codes naturally
  if (codeA && codeB && !isLabourA && !isLabourB) {
    const codeCmp = compareItemCodes(codeA, codeB);
    if (codeCmp !== 0) return codeCmp;
  } else if ((codeA && !isLabourA) && (!codeB || isLabourB)) {
    // Coded parts come before non-coded / labour / delivery charges
    return -1;
  } else if ((!codeA || isLabourA) && (codeB && !isLabourB)) {
    // Non-coded / labour items come after coded parts
    return 1;
  }

  // Secondary tie-breaker: Description / Name (A-Z, 0-9)
  const descA = String(itemA?.description || itemA?.name || itemA?.itemName || '').trim();
  const descB = String(itemB?.description || itemB?.name || itemB?.itemName || '').trim();

  const descCmp = descA.localeCompare(descB, undefined, { sensitivity: 'base', numeric: true });
  if (descCmp !== 0) return descCmp;

  return 0;
}
