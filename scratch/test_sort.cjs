function getCharCategory(char) {
  if (!char) return 2;
  if (/[a-zA-Z]/.test(char)) return 0;
  if (/[0-9]/.test(char)) return 1;
  return 2;
}

function cleanSortString(str) {
  const trimmed = String(str || '').trim();
  // Strip leading non-alphanumeric characters so punctuation doesn't skew alphabetical sort
  const cleaned = trimmed.replace(/^[^a-zA-Z0-9]+/, '').trim();
  return cleaned || trimmed;
}

function compareStringsAZ09(strA, strB) {
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

function getItemSortString(item) {
  if (!item) return '';
  const isLabour = item.jobType === 'Labour' || item.type === 'Labour' || Boolean(item.isService);
  if (isLabour) {
    return (item.description || 'Delivery Charge').trim();
  }
  const desc = (item.description || item.name || item.itemName || '').trim();
  const code = (item.code || item.itemCode || '').trim();
  return desc || code || '';
}

function compareBillPrintItems(itemA, itemB) {
  const strA = getItemSortString(itemA);
  const strB = getItemSortString(itemB);

  const cmp = compareStringsAZ09(strA, strB);
  if (cmp !== 0) return cmp;

  const codeA = String(itemA?.code || itemA?.itemCode || '').trim();
  const codeB = String(itemB?.code || itemB?.itemCode || '').trim();
  return compareStringsAZ09(codeA, codeB);
}

const testItems = [
  { code: '01100355', description: 'OIL SEAL [ MAGENTO ]' },
  { code: '03100621', description: 'ROLLER BEARING 4TH GROUP' },
  { code: '16151008', description: 'CHAIN LINK (428)' },
  { code: '24116149', description: 'SPARK PLUG' },
  { code: '36DU4212', description: 'CYLINDER BLOCK AND PISTON' },
  { code: 'AA191103', description: 'CABLE CLUTCH' },
  { code: 'AS001', description: 'WHEEL CLUTCH' },
  { code: '9999', description: '10MM BOLT' },
  { code: '8888', description: '2T ENGINE OIL' },
  { code: '7777', description: '4T ENGINE OIL' },
  { code: '6666', description: 'BRAKE SHOE' },
  { code: '5555', description: 'AIR FILTER' },
  { code: '4444', description: 'Z-BRACKET' },
  { code: '3333', description: '[PROMO] DISCOUNT VALVE' },
  { code: '2222', description: '*** CUSTOM PART ***' },
];

const sorted = [...testItems].sort(compareBillPrintItems);
console.log('--- SORTED RESULTS (A-Z , 0-9) ---');
sorted.forEach((item, idx) => {
  console.log(`${idx + 1}. [${item.code}] ${item.description}`);
});
