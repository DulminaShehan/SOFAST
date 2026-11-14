// Test script for custom print sorting
const { compareBillPrintItems, getItemPriority } = require('../backend/src/utils/itemSort.js');

const testItems = [
  { code: 'SF102', description: 'Side Flap 102' },
  { code: '00129', description: 'Nut Bolt 00129' },
  { code: 'BGO20W50C', description: 'BAJAJ GENUINE OIL 20W 50' },
  { code: '91200', description: 'Washer 91200' },
  { code: 'AF121612', description: 'OIL FILTER ASSY BSIV' },
  { code: 'sf001', description: 'Side Fairing Left' },
  { code: 'CZ001', description: 'Chain Drive' },
  { code: 'SF-BRACKET', description: 'SF Support Bracket' },
  { code: '1092', description: 'Gasket 1092' },
];

console.log('--- Testing getItemPriority ---');
console.log('AF121612 priority:', getItemPriority('AF121612'), '(expected: 1)');
console.log('00129 priority:', getItemPriority('00129'), '(expected: 2)');
console.log('SF102 priority:', getItemPriority('SF102'), '(expected: 3)');
console.log('sf001 priority:', getItemPriority('sf001'), '(expected: 3)');

const sorted = [...testItems].sort(compareBillPrintItems);

console.log('\n--- Sorted Result ---');
sorted.forEach((item, idx) => {
  console.log(`${idx + 1}. [Priority ${getItemPriority(item.code)}] ${item.code} - ${item.description}`);
});

