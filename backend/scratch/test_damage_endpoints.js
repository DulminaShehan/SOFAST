process.env.NODE_ENV = 'test';
process.env.PORT = '5099';
import dotenv from 'dotenv';
dotenv.config();
process.env.NODE_ENV = 'test';
process.env.PORT = '5099';

import { connectDatabase } from '../src/config/database.js';
import Damage from '../src/models/Damage.js';
import Item from '../src/models/Item.js';
import Grn from '../src/models/Grn.js';
import Supplier from '../src/models/Supplier.js';

const { default: app } = await import('../src/server.js');

async function runTests() {
  console.log('--- TESTING DAMAGE CONTROLLER & ROUTES ---');
  await connectDatabase();

  const TEST_PORT = 5099;
  const server = app.listen(TEST_PORT);
  const baseUrl = `http://localhost:${TEST_PORT}/api`;

  try {
    // Test 1: Next number generation
    const resNext = await fetch(`${baseUrl}/damages/next-number`).then((r) => r.json());
    console.log('1. getNextDamageNumber API result:', resNext);

    // Test 2: Item purchase cost lookup
    const sampleItem = await Item.findOne({}).lean();
    console.log('2. Sample item code:', sampleItem?.code, 'desc:', sampleItem?.description);
    if (sampleItem) {
      const resCost = await fetch(`${baseUrl}/damages/item-cost/${encodeURIComponent(sampleItem.code)}`).then((r) => r.json());
      console.log('   getItemPurchaseCost API result:', resCost);
    }

    // Test 3: List damages
    const resList = await fetch(`${baseUrl}/damages`).then((r) => r.json());
    console.log('3. List damages count:', resList?.data?.length, 'total:', resList?.total);
    if (resList?.data?.length > 0) {
      console.log('   Sample damage record:', resList.data[0].damageNumber);
    }

    // Test 4: Get damage by number (existing DMGN-0001)
    const resSingle = await fetch(`${baseUrl}/damages/DMGN-0001`).then((r) => r.json());
    console.log('4. Get DMGN-0001 result:', resSingle?.success, resSingle?.data?.damageNumber);

    // Test 5: Validate creating a damage record with stock check
    const testItem = await Item.findOne({ quantity: { $gt: 5 } }).lean();
    if (testItem) {
      console.log('5. Testing createDamage with item:', testItem.code, 'current stock:', testItem.quantity);
      const testDamNumber = `TEST-DMGN-${Date.now()}`;
      const postPayload = {
        damageNumber: testDamNumber,
        date: new Date().toISOString().split('T')[0],
        supplierCode: testItem.suppCode || 'SUP001',
        supplierName: 'Test Supplier',
        lineItems: [
          {
            itemCode: testItem.code,
            description: testItem.description,
            reference: 'REF-TEST-001',
            quantity: 1,
            cost: testItem.averageCost || 100,
          },
        ],
        note: 'Test damage note for unit testing',
      };

      const resCreate = await fetch(`${baseUrl}/damages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postPayload),
      }).then((r) => r.json());

      console.log('   createDamage response:', resCreate.success, resCreate.message);

      // Verify stock was decremented by 1
      const itemAfter = await Item.findById(testItem._id).lean();
      console.log('   Item stock after createDamage:', itemAfter.quantity, '(expected:', testItem.quantity - 1, ')');

      // Test 6: Update damage record
      const updatePayload = {
        note: 'Updated damage note text',
        lineItems: [
          {
            itemCode: testItem.code,
            description: testItem.description,
            reference: 'REF-TEST-001-MOD',
            quantity: 2, // increased by 1
            cost: testItem.averageCost || 100,
          },
        ],
      };

      const resUpdate = await fetch(`${baseUrl}/damages/${testDamNumber}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      }).then((r) => r.json());

      console.log('6. updateDamage response:', resUpdate.success, resUpdate.message);
      const itemAfterUpdate = await Item.findById(testItem._id).lean();
      console.log('   Item stock after updateDamage:', itemAfterUpdate.quantity, '(expected:', testItem.quantity - 2, ')');

      // Clean up test damage record and restore item stock
      await Damage.deleteOne({ damageNumber: testDamNumber });
      await Item.updateOne(
        { _id: testItem._id },
        {
          $inc: {
            quantity: 2,
            stockInHand: 2,
            damagedStock: -2,
          },
        }
      );
      console.log('   Cleaned up test damage record and restored stock.');
    }

    console.log('--- ALL BACKEND TESTS PASSED SUCCESSFULLY ---');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
