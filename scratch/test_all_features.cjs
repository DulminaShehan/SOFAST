const assert = require('assert');
const { compareBillPrintItems, getItemPriority } = require('../backend/src/utils/itemSort.js');
const { calculateCeilingRoundOff, computeItemPricing } = require('../backend/src/controllers/itemController.js');

console.log('====================================================');
console.log('SOFAST POS - Verification Tests for 3 New Features');
console.log('====================================================\n');

// ------------------------------------------------------------------
// Feature 2: Custom Line-Item Sorting Logic on Print
// ------------------------------------------------------------------
console.log('--- TEST 1: Custom Line-Item Sorting (A-Z -> 0-9 -> SF*) ---');

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

const sorted = [...testItems].sort(compareBillPrintItems);
const sortedCodes = sorted.map(i => i.code);

console.log('Sorted Order:', sortedCodes);

// Validate Priority 1 (A-Z excl SF) come first
assert.strictEqual(sortedCodes[0], 'AF121612');
assert.strictEqual(sortedCodes[1], 'BGO20W50C');
assert.strictEqual(sortedCodes[2], 'CZ001');

// Validate Priority 2 (0-9) come second
assert.strictEqual(sortedCodes[3], '00129');
assert.strictEqual(sortedCodes[4], '1092');
assert.strictEqual(sortedCodes[5], '91200');

// Validate Priority 3 (SF* case-insensitive) come last at very bottom
assert.strictEqual(sortedCodes[6], 'SF-BRACKET');
assert.strictEqual(sortedCodes[7], 'sf001');
assert.strictEqual(sortedCodes[8], 'SF102');

console.log('✅ TEST 1 PASSED: Strict Priority Order (A-Z -> 0-9 -> SF*) verified!\n');


// ------------------------------------------------------------------
// Feature 3: Item Master Upward Ceiling Round-Off Logic
// ------------------------------------------------------------------
console.log('--- TEST 2: Upward Ceiling Round-Off Formula ---');
// Test Cases from specification:
// 657 -> 660
// 651 -> 660
// 650 -> 650
const test1 = calculateCeilingRoundOff(657);
const test2 = calculateCeilingRoundOff(651);
const test3 = calculateCeilingRoundOff(650);

console.log(`657 -> ${test1} (expected: 660)`);
console.log(`651 -> ${test2} (expected: 660)`);
console.log(`650 -> ${test3} (expected: 650)`);

assert.strictEqual(test1, 660, '657 must round up to 660');
assert.strictEqual(test2, 660, '651 must round up to 660 (ceiling, not half-down)');
assert.strictEqual(test3, 650, '650 must remain 650');

console.log('✅ TEST 2 PASSED: Specification test cases verified!\n');


// ------------------------------------------------------------------
// Feature 3: computeItemPricing with is_round_off
// ------------------------------------------------------------------
console.log('--- TEST 3: computeItemPricing with is_round_off flag ---');

// Case A: Selling Price 1000, 34.3% discount -> Net 657 -> should round up to 660 when is_round_off = true
const priceA = computeItemPricing(1000, 34.3, 'Round Up', 10, true);
console.log('Price with is_round_off: true ->', priceA.finalSellingPrice);
assert.strictEqual(priceA.finalSellingPrice, 660);
assert.strictEqual(priceA.is_round_off, true);

// Case B: Same item when is_round_off = false -> Net 657 -> remains 657
const priceB = computeItemPricing(1000, 34.3, 'No Round Off', 10, false);
console.log('Price with is_round_off: false ->', priceB.finalSellingPrice);
assert.strictEqual(priceB.finalSellingPrice, 657);
assert.strictEqual(priceB.is_round_off, false);

console.log('✅ TEST 3 PASSED: computeItemPricing accurately respects is_round_off!\n');

console.log('====================================================');
console.log('ALL TESTS PASSED SUCCESSFULLY! 🚀');
console.log('====================================================');

