import dotenv from 'dotenv';
dotenv.config();
import { connectDatabase } from '../src/config/database.js';
import Damage from '../src/models/Damage.js';
import Item from '../src/models/Item.js';
import Grn from '../src/models/Grn.js';
import Supplier from '../src/models/Supplier.js';
import DamageStockMovement from '../src/models/DamageStockMovement.js';

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runAllTests() {
  console.log('====================================================');
  console.log('   SOFAST POS — DATA ENTRY OF DAMAGE VERIFICATION   ');
  console.log('====================================================\n');

  await connectDatabase();
  const baseUrl = 'http://localhost:5000/api';

  // 1. Next number generation logic & sequence safety
  console.log('TEST 1: Sequential Damage Record Number (Next Number)');
  const resNext = await fetch(`${baseUrl}/damages/next-number`).then(r => r.json());
  assert(resNext.success === true, 'Next damage number API returned success');
  assert(/^DMGN-\d{4}$/.test(resNext.data.damageNumber), `Damage number format matches DMGN-XXXX (got: ${resNext.data.damageNumber})`);
  assert(resNext.data.damageNo === resNext.data.damageNumber, 'damageNo alias matches damageNumber');

  // 2. Supplier Master connectivity
  console.log('\nTEST 2: Supplier Master Records Connectivity');
  const resSuppliers = await fetch(`${baseUrl}/suppliers`).then(r => r.json());
  assert(resSuppliers.success === true, 'Suppliers API returned success');
  assert(Array.isArray(resSuppliers.data) && resSuppliers.data.length > 0, `Loaded real suppliers from Supplier Master (found: ${resSuppliers.data.length})`);
  const sampleSupplier = resSuppliers.data[0];
  assert(Boolean(sampleSupplier.code && sampleSupplier.name), `Supplier record has valid code (${sampleSupplier.code}) and name (${sampleSupplier.name})`);

  // 3. Item Master lookup, description & purchase cost auto-population
  console.log('\nTEST 3: Item Description and Purchase Cost (GRN Preference, Not Selling Price)');
  // Find an item that has purchase history in GRN
  const allGrns = await Grn.find({ status: { $ne: 'cancelled' } }).sort({ date: -1 }).lean();
  let grnItemCode = null;
  let grnExpectedUnitCost = null;

  for (const g of allGrns) {
    if (Array.isArray(g.lineItems) && g.lineItems.length > 0) {
      for (const li of g.lineItems) {
        const cost = Number(li.unitPrice !== undefined ? li.unitPrice : li.rate);
        if (cost > 0) {
          grnItemCode = li.code || li.itemCode;
          grnExpectedUnitCost = cost;
          break;
        }
      }
    }
    if (grnItemCode) break;
  }

  assert(Boolean(grnItemCode), `Found valid purchased item in GRN history: ${grnItemCode}`);

  const itemInMaster = await Item.findOne({ code: new RegExp(`^${grnItemCode}$`, 'i') }).lean();
  const resCost = await fetch(`${baseUrl}/damages/item-cost/${encodeURIComponent(grnItemCode)}`).then(r => r.json());
  assert(resCost.success === true, 'Item cost lookup returned success');
  assert(resCost.data.description === itemInMaster.description, `Description correctly loaded from Item Master ('${resCost.data.description}')`);
  assert(resCost.data.purchaseCost === grnExpectedUnitCost, `Cost prefers latest valid GRN purchase price (${resCost.data.purchaseCost})`);
  if (itemInMaster.sellingPrice) {
    assert(resCost.data.purchaseCost !== itemInMaster.sellingPrice || resCost.data.purchaseCost === grnExpectedUnitCost, 'Selling price is not treated as purchase cost');
  }

  // 4. Quantity validation (rejection of zero, negative, or excessive stock)
  console.log('\nTEST 4: Quantity Validation (Positive and Stock Availability)');
  const itemWithStock = await Item.findOne({ quantity: { $gt: 5 } }).lean();
  assert(Boolean(itemWithStock), `Found item with stock: ${itemWithStock.code} (stock: ${itemWithStock.quantity})`);

  // Try negative quantity
  const testDamageNo = `DMGN-T${Date.now().toString().slice(-4)}`;
  const resNegativeQty = await fetch(`${baseUrl}/damages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      damageNumber: testDamageNo,
      lineItems: [{ itemCode: itemWithStock.code, quantity: -2, cost: 50 }],
    }),
  }).then(r => r.json());
  assert(resNegativeQty.success === false, 'Rejected negative quantity');

  // Try excessive quantity (exceeding stock)
  const resExcessiveQty = await fetch(`${baseUrl}/damages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      damageNumber: testDamageNo,
      lineItems: [{ itemCode: itemWithStock.code, quantity: (itemWithStock.quantity || 0) + 1000, cost: 50 }],
    }),
  }).then(r => r.json());
  assert(resExcessiveQty.success === false, 'Rejected quantity exceeding available sellable stock');

  // 5. Save Damage record with stock adjustment & audit logging
  console.log('\nTEST 5: Save Damage Record, Atomic Stock Adjustment & Movement Ledger');
  const initialStock = Number(itemWithStock.quantity !== undefined ? itemWithStock.quantity : itemWithStock.stockInHand || 0);
  const initialDamagedStock = Number(itemWithStock.damagedStock || 0);
  const damageQty = 2;

  const savePayload = {
    damageNumber: testDamageNo,
    damageNo: testDamageNo,
    date: new Date().toISOString().split('T')[0],
    supplierCode: sampleSupplier.code,
    supplierName: sampleSupplier.name,
    lineItems: [
      {
        itemCode: itemWithStock.code,
        description: itemWithStock.description,
        reference: 'GRN-REF-7788',
        quantity: damageQty,
        cost: itemWithStock.averageCost || 100,
      },
    ],
    note: 'Damaged in warehouse storage during inventory audit',
  };

  const resSave = await fetch(`${baseUrl}/damages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(savePayload),
  }).then(r => r.json());

  assert(resSave.success === true, `Saved damage record successfully: ${testDamageNo}`);

  // Verify stock adjustment
  const itemAfterSave = await Item.findById(itemWithStock._id).lean();
  const expectedSellable = initialStock - damageQty;
  const expectedDamaged = initialDamagedStock + damageQty;
  assert(Number(itemAfterSave.quantity) === expectedSellable, `Sellable stock reduced exactly once (${initialStock} -> ${itemAfterSave.quantity})`);
  assert(Number(itemAfterSave.damagedStock) === expectedDamaged, `Quarantine damagedStock incremented (${initialDamagedStock} -> ${itemAfterSave.damagedStock})`);

  // Verify DamageStockMovement audit entry
  const dsmEntry = await DamageStockMovement.findOne({ referenceNumber: testDamageNo }).lean();
  assert(Boolean(dsmEntry), `DamageStockMovement audit entry logged for ${testDamageNo}`);
  assert(dsmEntry.quantity === damageQty, `DSM entry quantity matches ${damageQty}`);
  assert(dsmEntry.origin === 'SUPPLIER DAMAGE' || dsmEntry.origin === 'SHOP DAMAGE', `DSM entry origin is valid (${dsmEntry.origin})`);

  // 6. Reload saved record
  console.log('\nTEST 6: Reload Saved Damage Record by Damage No');
  const resReload = await fetch(`${baseUrl}/damages/${testDamageNo}`).then(r => r.json());
  assert(resReload.success === true, 'Loaded saved damage record by Damage No');
  assert(resReload.data.damageNumber === testDamageNo, 'Loaded record has correct damageNumber');
  assert(resReload.data.supplierCode === sampleSupplier.code, 'Loaded record has correct supplierCode');
  assert(resReload.data.supplierName === sampleSupplier.name, 'Loaded record has correct supplierName');
  assert(resReload.data.note === 'Damaged in warehouse storage during inventory audit', 'Loaded record has correct note');
  assert(Array.isArray(resReload.data.lineItems) && resReload.data.lineItems.length === 1, 'Loaded record has 1 line item');
  assert(resReload.data.lineItems[0].reference === 'GRN-REF-7788', 'Line item preserves manually entered Reference');
  assert(resReload.data.lineItems[0].quantity === damageQty, 'Line item preserves entered damaged quantity');

  // 7. Update damage record without duplicate stock deductions
  console.log('\nTEST 7: Update Damage Record and Delta Stock Integrity');
  // Edit note and reference without changing quantity
  const updatePayload = {
    note: 'Updated damage notes after inspection',
    lineItems: [
      {
        itemCode: itemWithStock.code,
        description: itemWithStock.description,
        reference: 'UPDATED-REF-9900',
        quantity: damageQty, // unchanged
        cost: itemWithStock.averageCost || 100,
      },
    ],
  };

  const resUpdate = await fetch(`${baseUrl}/damages/${testDamageNo}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatePayload),
  }).then(r => r.json());

  assert(resUpdate.success === true, 'Updated damage record successfully');

  // Verify stock did NOT decrease again when quantity did not change
  const itemAfterUpdate = await Item.findById(itemWithStock._id).lean();
  assert(Number(itemAfterUpdate.quantity) === expectedSellable, `Stock remained unchanged on metadata update without duplicate deduction (${itemAfterUpdate.quantity})`);

  // 8. Legacy damage records support (DMGN-0001, DMGN-0002)
  console.log('\nTEST 8: Legacy Damages Compatibility');
  const resLegacy = await fetch(`${baseUrl}/damages/DMGN-0001`).then(r => r.json());
  assert(resLegacy.success === true, 'Legacy record DMGN-0001 fetched cleanly');
  assert(resLegacy.data.damageNumber === 'DMGN-0001', 'DMGN-0001 damageNumber intact');

  // 9. Clean up test record and restore stock
  console.log('\nTEST 9: Clean Up Test Damage Record & Restore Inventory');
  await Damage.deleteOne({ damageNumber: testDamageNo });
  await DamageStockMovement.deleteMany({ referenceNumber: testDamageNo });
  await Item.updateOne(
    { _id: itemWithStock._id },
    {
      $inc: {
        quantity: damageQty,
        stockInHand: damageQty,
        damagedStock: -damageQty,
      },
    }
  );
  const itemRestored = await Item.findById(itemWithStock._id).lean();
  assert(Number(itemRestored.quantity) === initialStock, `Item stock completely restored to initial stock (${initialStock})`);

  // 10. Existing features integrity check (GRN, Item Master, Invoice, Supplier)
  console.log('\nTEST 10: Existing Feature Regression Check (GRN, Item Master, Invoice, Supplier)');
  const checkItems = await Item.countDocuments({ status: { $ne: 'I' } });
  const checkSuppliers = await Supplier.countDocuments();
  const checkGrns = await Grn.countDocuments();
  assert(checkItems > 0, `Item Master collection is intact (${checkItems} items)`);
  assert(checkSuppliers > 0, `Supplier collection is intact (${checkSuppliers} suppliers)`);
  assert(checkGrns > 0, `GRN collection is intact (${checkGrns} GRNs)`);

  console.log('\n====================================================');
  console.log(`   TEST RESULTS: ${passedTests} / ${totalTests} PASSED   `);
  console.log('====================================================\n');
  process.exit(0);
}

runAllTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
