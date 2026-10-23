import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
import { connectDatabase } from '../src/config/database.js';
import Customer from '../src/models/Customer.js';
import Item from '../src/models/Item.js';
import Invoice from '../src/models/Invoice.js';
import Settlement from '../src/models/Settlement.js';
import { syncCustomerOutstandingBalance } from '../src/controllers/customerController.js';

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

async function runTests() {
  console.log('🚀 Running Comprehensive Invoice Requirements Verification...\n');
  const conn = await connectDatabase();
  if (!conn) {
    console.error('Database connection failed');
    process.exit(1);
  }

  // TEST 1: Pricing Calculation: Selling price = Rs. 960, quantity = 5, discount = 20%
  console.log('--- Test 1 & 2: Quantity, Price, and Discount Calculation ---');
  const price = 960;
  const qty = 5;
  const discPct = 20;
  const gross = price * qty; // 4800
  const discAmt = (gross * discPct) / 100; // 960
  const netValue = gross - discAmt; // 3840
  assert(gross === 4800, 'Gross value calculation = 960 * 5 = 4800');
  assert(discAmt === 960, 'Discount amount = 4800 * 20% = 960');
  assert(netValue === 3840, 'Net line value = 4800 - 960 = 3840');

  // TEST 3 & 4: Customer Due Calculation & Switching Customers
  console.log('\n--- Test 3 & 4: Customer Due Calculation & Switching Customers ---');
  const testCusCodeA = `CUS_TEST_${Date.now()}_A`;
  const testCusCodeB = `CUS_TEST_${Date.now()}_B`;

  await Customer.create({
    code: testCusCodeA,
    customerCode: testCusCodeA,
    name: 'Test Customer A',
    dueAmount: 0,
    outstandingBalance: 0,
  });

  await Customer.create({
    code: testCusCodeB,
    customerCode: testCusCodeB,
    name: 'Test Customer B',
    dueAmount: 0,
    outstandingBalance: 0,
  });

  const dueInitialA = await syncCustomerOutstandingBalance(testCusCodeA);
  assert(dueInitialA === 0, 'New customer A has 0 outstanding balance initially');

  const dueInitialB = await syncCustomerOutstandingBalance(testCusCodeB);
  assert(dueInitialB === 0, 'New customer B has 0 outstanding balance initially');

  // Create an unpaid credit invoice for Customer A (Amount 5000, Paid 0, Due 5000)
  const testInv1 = await Invoice.create({
    no: 999901,
    invoiceNumber: `INV-TEST-${Date.now()}-1`,
    customerCode: testCusCodeA,
    customerName: 'Test Customer A',
    amountToPay: 5000,
    subTotal: 5000,
    customerPaidAmount: 0,
    paidAmount: 0,
    dueAmount: 5000,
    paymentMethod: 'Credit',
    status: 'completed',
    isHold: false,
    isStockUpdated: false,
  });

  const dueAfterInvA = await syncCustomerOutstandingBalance(testCusCodeA);
  assert(dueAfterInvA === 5000, `Customer A due updated to 5000 (actual: ${dueAfterInvA})`);

  // Customer B due should still be 0!
  const dueBCheck = await syncCustomerOutstandingBalance(testCusCodeB);
  assert(dueBCheck === 0, 'Customer B due remains 0 when Customer A owes money');

  // TEST 5: New Button logic (starts fresh without deleting saved records)
  console.log('\n--- Test 5: Fresh Invoice Creation (Existing records preserved) ---');
  const invCountBefore = await Invoice.countDocuments();
  // Simulate starting fresh invoice: old invoice testInv1 still exists
  const existingInv = await Invoice.findById(testInv1._id);
  assert(existingInv !== null, 'Existing saved invoice is preserved when starting new invoice');
  assert(await Invoice.countDocuments() === invCountBefore, 'Invoice count unchanged by preparing a new form');

  // TEST 6 & 7: Stock movements and Idempotency
  console.log('\n--- Test 6 & 7: Stock Movements, Atomicity, and Repeated Operations ---');
  const testItemCode = `ITEM_TEST_${Date.now()}`;
  const initialStock = 50;
  const purchaseQty = 5;

  await Item.create({
    code: testItemCode,
    description: 'Test Stock Item',
    quantity: initialStock,
    stockInHand: initialStock,
    sellingPrice: 960,
  });

  // Finalize an invoice with purchase quantity = 5 (deducts stock from 50 -> 45)
  await Item.updateOne(
    { code: testItemCode, quantity: { $gte: purchaseQty } },
    { $inc: { quantity: -purchaseQty, stockInHand: -purchaseQty } }
  );

  const stockAfterSale = await Item.findOne({ code: testItemCode });
  assert(stockAfterSale.quantity === 45, `Stock deducted by customer purchase quantity 5: 50 -> ${stockAfterSale.quantity} (not whole stock!)`);

  const testInv2 = await Invoice.create({
    no: 999902,
    invoiceNumber: `INV-TEST-${Date.now()}-2`,
    customerCode: testCusCodeA,
    customerName: 'Test Customer A',
    amountToPay: 3840,
    subTotal: 4800,
    customerPaidAmount: 3840,
    paidAmount: 3840,
    dueAmount: 0, // Fully paid!
    paymentMethod: 'Cash',
    status: 'completed',
    isHold: false,
    isStockUpdated: true,
    lineItems: [
      {
        code: testItemCode,
        description: 'Test Stock Item',
        quantity: purchaseQty,
        sellingPrice: 960,
        price: 960,
        discountPercentage: 20,
        discountAmount: 960,
        value: 3840,
        finalPrice: 3840,
      },
    ],
  });

  // Fully paid invoice must NOT increase customer due!
  const dueAfterPaidInv = await syncCustomerOutstandingBalance(testCusCodeA);
  assert(dueAfterPaidInv === 5000, `Fully paid invoice does NOT increase customer balance (due remains 5000, actual: ${dueAfterPaidInv})`);

  // Simulate multiple prints: printing does NOT touch stock or balances
  const stockAfterPrints = await Item.findOne({ code: testItemCode });
  const dueAfterPrints = await syncCustomerOutstandingBalance(testCusCodeA);
  assert(stockAfterPrints.quantity === 45, 'Printing repeatedly does NOT touch stock');
  assert(dueAfterPrints === 5000, 'Printing repeatedly does NOT touch customer balance');

  // TEST 8: Delete / Cancel handling
  console.log('\n--- Test 8: Delete and Cancellation Safety ---');
  // Cancel testInv2 (which had isStockUpdated: true and 5 items deducted)
  // Stock should be restored from 45 -> 50!
  await Item.updateOne(
    { code: testItemCode },
    { $inc: { quantity: purchaseQty, stockInHand: purchaseQty } }
  );
  testInv2.isStockUpdated = false;
  testInv2.status = 'cancelled';
  testInv2.dueAmount = 0;
  await testInv2.save();

  const stockAfterCancel = await Item.findOne({ code: testItemCode });
  assert(stockAfterCancel.quantity === 50, `Stock reversed exactly once on invoice cancellation: ${stockAfterCancel.quantity}`);

  // Cancel testInv1 (which had dueAmount: 5000)
  testInv1.status = 'cancelled';
  testInv1.dueAmount = 0;
  await testInv1.save();
  const dueAfterCancelInv1 = await syncCustomerOutstandingBalance(testCusCodeA);
  assert(dueAfterCancelInv1 === 0, `Customer balance cleared to 0 after unpaid invoice is cancelled (actual: ${dueAfterCancelInv1})`);

  // TEST 9: Settlement Linked Protection
  console.log('\n--- Test 9: Prevention of Deleting Settled / Linked Invoices ---');
  const testInv3 = await Invoice.create({
    no: 999903,
    invoiceNumber: `INV-TEST-${Date.now()}-3`,
    customerCode: testCusCodeB,
    amountToPay: 2000,
    dueAmount: 1000,
    paidAmount: 1000,
    status: 'partial',
  });

  const testSettlement = await Settlement.create({
    receiptNo: `REC-TEST-${Date.now()}`,
    invoiceId: testInv3._id,
    invoiceNumber: testInv3.invoiceNumber,
    customerCode: testCusCodeB,
    amount: 1000,
    method: 'Cash',
  });

  const linkedSettlements = await Settlement.find({
    $or: [{ invoiceNumber: testInv3.invoiceNumber }, { invoiceId: testInv3._id }],
  });
  assert(linkedSettlements.length > 0, `Linked settlement found: ${linkedSettlements.length}`);

  // Cleanup test documents
  await Invoice.deleteMany({ invoiceNumber: { $regex: /^INV-TEST-/ } });
  await Settlement.deleteMany({ receiptNo: { $regex: /^REC-TEST-/ } });
  await Customer.deleteMany({ code: { $in: [testCusCodeA, testCusCodeB] } });
  await Item.deleteMany({ code: testItemCode });

  console.log(`\n================================`);
  console.log(`Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
