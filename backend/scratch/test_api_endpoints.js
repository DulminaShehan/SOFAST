import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
import express from 'express';
import { connectDatabase } from '../src/config/database.js';
import Customer from '../src/models/Customer.js';
import Item from '../src/models/Item.js';
import Invoice from '../src/models/Invoice.js';
import Settlement from '../src/models/Settlement.js';
import routes from '../src/routes/index.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runApiTests() {
  console.log('🚀 Running API Endpoint Integration Tests...\n');
  await connectDatabase();

  const app = express();
  app.use(express.json());
  app.use('/api', routes);

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;

  const testCusCode = `CUS_API_${Date.now()}`;
  const testItemCode = `ITEM_API_${Date.now()}`;

  await Customer.create({
    code: testCusCode,
    customerCode: testCusCode,
    name: 'API Test Customer',
    dueAmount: 0,
    outstandingBalance: 0,
  });

  await Item.create({
    code: testItemCode,
    description: 'API Test Item',
    quantity: 100,
    stockInHand: 100,
    sellingPrice: 500,
  });

  // 1. Fetch customer by code via API
  const cusRes = await fetch(`${baseUrl}/customers/${testCusCode}`).then(r => r.json());
  assert(cusRes.success === true, 'GET /api/customers/:code succeeds');
  assert(Number(cusRes.data.dueAmount) === 0, 'Initial customer due is 0');

  // 2. Create invoice with purchase quantity = 3 (not 100!)
  const invRes = await fetch(`${baseUrl}/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      invoiceNumber: `INV-API-${Date.now()}`,
      customerCode: testCusCode,
      customerName: 'API Test Customer',
      amountToPay: 1500,
      customerPaidAmount: 500, // Partial payment of 500 -> Due: 1000
      paymentMethod: 'Cash',
      status: 'partial',
      isHold: false,
      lineItems: [
        {
          code: testItemCode,
          description: 'API Test Item',
          quantity: 3,
          sellingPrice: 500,
          price: 500,
          discountPercentage: 0,
          discountAmount: 0,
          value: 1500,
          finalPrice: 1500,
        },
      ],
    }),
  }).then(r => r.json());

  assert(invRes.success === true, 'POST /api/invoices creates invoice successfully');
  const createdInv = invRes.data;
  assert(createdInv.dueAmount === 1000, `Invoice dueAmount = 1000 (actual: ${createdInv.dueAmount})`);

  // 3. Verify stock was deducted by 3, NOT 100!
  const itemAfter = await Item.findOne({ code: testItemCode });
  assert(itemAfter.quantity === 97, `Stock deducted by purchase quantity 3: 100 -> ${itemAfter.quantity}`);

  // 4. Verify customer outstanding balance synced to 1000
  const cusAfter = await fetch(`${baseUrl}/customers/${testCusCode}`).then(r => r.json());
  assert(Number(cusAfter.data.dueAmount) === 1000, `Customer due updated to 1000 (actual: ${cusAfter.data.dueAmount})`);

  // 5. Test Settlement Linked Protection on Delete
  const settRes = await fetch(`${baseUrl}/settlements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      invoiceNumber: createdInv.invoiceNumber,
      amount: 500,
      received: 500,
      method: 'Cash',
    }),
  }).then(r => r.json());

  assert(settRes.success === true, 'Settlement recorded successfully');

  // Attempt to delete invoice while settlement exists: MUST be rejected!
  const delBlockedRes = await fetch(`${baseUrl}/invoices/${createdInv._id}`, {
    method: 'DELETE',
  }).then(r => r.json());

  assert(delBlockedRes.success === false, 'DELETE /api/invoices/:id blocked when settlement is linked');

  // Delete the settlement first
  const delSettRes = await fetch(`${baseUrl}/settlements/${settRes.data._id}`, {
    method: 'DELETE',
  }).then(r => r.json());
  assert(delSettRes.success === true, 'Settlement deleted and balance restored');

  // Now delete the invoice
  const delInvRes = await fetch(`${baseUrl}/invoices/${createdInv._id}`, {
    method: 'DELETE',
  }).then(r => r.json());

  assert(delInvRes.success === true, 'DELETE /api/invoices/:id succeeds after settlements are cleared');

  // 6. Verify stock restored to 100
  const itemRestored = await Item.findOne({ code: testItemCode });
  assert(itemRestored.quantity === 100, `Stock restored to 100 after invoice cancelled/deleted (actual: ${itemRestored.quantity})`);

  // 7. Verify customer balance restored to 0
  const cusFinal = await fetch(`${baseUrl}/customers/${testCusCode}`).then(r => r.json());
  assert(Number(cusFinal.data.dueAmount) === 0, `Customer due restored to 0 (actual: ${cusFinal.data.dueAmount})`);

  // Clean up
  await Invoice.deleteMany({ invoiceNumber: createdInv.invoiceNumber });
  await Customer.deleteMany({ code: testCusCode });
  await Item.deleteMany({ code: testItemCode });
  server.close();

  console.log(`\n================================`);
  console.log(`API Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runApiTests().catch(err => {
  console.error(err);
  process.exit(1);
});
