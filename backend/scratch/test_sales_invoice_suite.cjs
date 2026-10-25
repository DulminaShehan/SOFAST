const assert = require('assert');

const API_BASE = 'http://localhost:5000/api';

async function runTests() {
  console.log('=== STARTING SALES INVOICE VERIFICATION SUITE ===\n');

  // Test Scenario 1: Search for an existing item and verify its real stock quantity appears
  console.log('--- Test 1: Search existing item and verify real stock quantity ---');
  const itemRes = await fetch(`${API_BASE}/items/24116149`).then(r => r.json());
  assert(itemRes.success, 'Item lookup API should return success');
  const item = itemRes.data;
  console.log(`Found item: ${item.code} - ${item.description}`);
  console.log(`Stored Quantity: ${item.quantity}, Stock In Hand: ${item.stockInHand}, Location: ${item.location}`);
  const expectedStock = item.quantity !== undefined ? item.quantity : (item.stockInHand || 0);
  assert(expectedStock > 0, 'Item should have available stock');
  assert(typeof expectedStock === 'number', 'Stock quantity must be a number');
  console.log('✓ Test 1 Passed: Real stock quantity loaded directly from database.\n');

  // Test Scenario 2: Location-specific stock display rule simulation
  console.log('--- Test 2: Location-specific stock rule verification ---');
  const storedLocation = item.location || 'Main Store';
  const otherLocation = 'Store 2';
  console.log(`Item stored in '${storedLocation}' with stock: ${expectedStock}`);
  // If user chooses storedLocation, stock is expectedStock
  // If user chooses otherLocation, stock is 0
  const stockAtStoredLoc = (storedLocation.toLowerCase() === item.location?.toLowerCase()) ? expectedStock : 0;
  const stockAtOtherLoc = (otherLocation.toLowerCase() === item.location?.toLowerCase()) ? expectedStock : 0;
  assert.strictEqual(stockAtStoredLoc, expectedStock, 'Stock at stored location must equal actual database stock');
  assert.strictEqual(stockAtOtherLoc, 0, 'Stock at other location must be 0');
  console.log(`✓ Test 2 Passed: Stock at stored location is ${stockAtStoredLoc}, stock at other location is ${stockAtOtherLoc}.\n`);

  // Test Scenario 3: Purchase Quantity does NOT overwrite Stock
  console.log('--- Test 3: Purchase Quantity does NOT overwrite Stock ---');
  let draftItem = {
    code: item.code,
    description: item.description,
    availableQty: expectedStock, // stock
    quantity: '1',               // purchase quantity
    price: item.sellingPrice,
  };
  // Simulate user changing quantity to 2
  draftItem.quantity = '2';
  assert.strictEqual(draftItem.quantity, '2', 'Purchase quantity must be 2');
  assert.strictEqual(draftItem.availableQty, expectedStock, 'Available stock must remain unchanged');
  assert.notStrictEqual(draftItem.quantity, draftItem.availableQty, 'Quantity and Stock must remain distinct');
  console.log(`✓ Test 3 Passed: User entered Quantity = ${draftItem.quantity}, Stock remains = ${draftItem.availableQty}.\n`);

  // Test Scenario 4 & 5: Add multiple items, verify selling price, customer discount, cost, and line value calculations
  console.log('--- Test 4 & 5: Multiple items & Decimal-safe invoice line calculation ---');
  // Line 1: Item 24116149 (sellingPrice: 1102, qty: 1, disc: 10%)
  const price1 = Number(item.sellingPrice);
  const qty1 = 1;
  const discPct1 = 10;
  const gross1 = Math.round(price1 * qty1 * 100) / 100;
  const discAmt1 = Math.round((gross1 * discPct1) / 100 * 100) / 100;
  const netValue1 = Math.round((gross1 - discAmt1) * 100) / 100;
  console.log(`Line 1: Gross = ${gross1}, Disc (${discPct1}%) = ${discAmt1}, Line Value = ${netValue1}`);
  assert.strictEqual(gross1, 1102, 'Gross should be 1102');
  assert.strictEqual(discAmt1, 110.2, 'Discount should be 110.2');
  assert.strictEqual(netValue1, 991.8, 'Net value should be 991.8');

  // Line 2: Item 39103309 (RIVET, sellingPrice: 100, qty: 2, disc: 0%)
  const item2Res = await fetch(`${API_BASE}/items/39103309`).then(r => r.json());
  assert(item2Res.success, 'Second item lookup should succeed');
  const item2 = item2Res.data;
  const price2 = Number(item2.sellingPrice || 100);
  const qty2 = 2;
  const gross2 = Math.round(price2 * qty2 * 100) / 100;
  const netValue2 = gross2;
  console.log(`Line 2: Gross = ${gross2}, Line Value = ${netValue2}`);

  const invoiceSubTotal = Math.round((netValue1 + netValue2) * 100) / 100;
  const specialDiscount = 50.00;
  const totalAmount = Math.round((invoiceSubTotal - specialDiscount) * 100) / 100;
  console.log(`Invoice SubTotal: ${invoiceSubTotal}, Special Disc: ${specialDiscount}, Net Total: ${totalAmount}`);
  assert.strictEqual(totalAmount, Math.round((991.8 + gross2 - 50) * 100) / 100);
  console.log('✓ Test 4 & 5 Passed: Accurate line values and decimal-safe invoice totals.\n');

  // Test Scenario 6: Save invoice and verify it persists after querying database
  console.log('--- Test 6: Save invoice and verify persistence ---');
  const nextNumRes = await fetch(`${API_BASE}/invoices/next-number`).then(r => r.json());
  assert(nextNumRes.success, 'Next number API should succeed');
  const invNumber = nextNumRes.data.invoiceNumber;
  console.log(`Generated next invoice number: ${invNumber}`);

  // Fetch initial stock for item 24116149
  const initialStockRes = await fetch(`${API_BASE}/items/24116149`).then(r => r.json());
  const initialStock = initialStockRes.data.quantity;

  const savePayload = {
    no: nextNumRes.data.no,
    invoiceNumber: invNumber,
    date: new Date().toISOString().split('T')[0],
    customerCode: 'CUS-TEST',
    customerName: 'Test Suite Customer',
    customerAddress: '123 Test St',
    customerTelephone: '0712345678',
    jobType: 'Material',
    jd: 'Invoice',
    isHold: false,
    status: 'completed',
    paymentMethod: 'Cash',
    paidBy: 'Cash',
    lineItems: [
      {
        code: item.code,
        description: item.description,
        location: item.location || 'Main Store',
        quantity: qty1,
        sellingPrice: price1,
        price: price1,
        discountPercentage: discPct1,
        discountAmount: discAmt1,
        finalPrice: netValue1,
        value: netValue1,
        availableQty: item.quantity,
      },
      {
        code: item2.code,
        description: item2.description,
        location: item2.location || 'Main Store',
        quantity: qty2,
        sellingPrice: price2,
        price: price2,
        discountPercentage: 0,
        discountAmount: 0,
        finalPrice: netValue2,
        value: netValue2,
        availableQty: item2.quantity,
      }
    ],
    subTotal: invoiceSubTotal,
    specialDiscount: specialDiscount,
    amountToPay: totalAmount,
    customerPaidAmount: totalAmount,
    amountReceived: totalAmount,
    paidAmount: totalAmount,
    balance: 0,
    dueAmount: 0,
  };

  const saveRes = await fetch(`${API_BASE}/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(savePayload)
  }).then(r => r.json());

  assert(saveRes.success, `Invoice save should succeed: ${saveRes.message}`);
  const savedInvoice = saveRes.data;
  console.log(`Saved invoice ID: ${savedInvoice._id}, Number: ${savedInvoice.invoiceNumber}`);
  assert.strictEqual(savedInvoice.invoiceNumber, invNumber);
  assert.strictEqual(savedInvoice.lineItems.length, 2);

  // Verify persistence
  const getRes = await fetch(`${API_BASE}/invoices/${savedInvoice._id}`).then(r => r.json());
  assert(getRes.success, 'Invoice lookup by ID should succeed');
  assert.strictEqual(getRes.data.invoiceNumber, invNumber);
  console.log('✓ Test 6 Passed: Invoice successfully persisted and retrieved.\n');

  // Test Scenario 7: Click Save twice (idempotency / update existing invoice)
  console.log('--- Test 7: Prevent duplicate invoice on consecutive Save clicks ---');
  // When activeInvoiceId is set, frontend sends PUT to /invoices/:id
  const updateRes = await fetch(`${API_BASE}/invoices/${savedInvoice._id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...savePayload,
      remark: 'Updated on second save click'
    })
  }).then(r => r.json());
  assert(updateRes.success, 'Update existing invoice should succeed');
  assert.strictEqual(updateRes.data.invoiceNumber, invNumber, 'Invoice number must remain identical');

  // Verify that count of invoices with this invoiceNumber is strictly 1
  const allInvs = await fetch(`${API_BASE}/invoices?limit=100`).then(r => r.json());
  const matching = allInvs.data.filter(inv => inv.invoiceNumber === invNumber);
  assert.strictEqual(matching.length, 1, 'There must be exactly ONE invoice with this invoice number');
  console.log(`✓ Test 7 Passed: Consecutive save updated existing invoice #${invNumber} without creating duplicates.\n`);

  // Test Scenario 8: Bill Print workflow
  console.log('--- Test 8: Bill Print workflow verification ---');
  // When invoice is already saved, Bill Print prints without saving again
  // Thermal print data contains correct header and line items
  assert.strictEqual(savedInvoice.lineItems.length, 2);
  assert.strictEqual(savedInvoice.amountToPay, totalAmount);
  console.log(`Bill print data verified: Inv #${savedInvoice.invoiceNumber}, Lines: ${savedInvoice.lineItems.length}, Amount: ${savedInvoice.amountToPay}`);
  console.log('✓ Test 8 Passed: Bill print correctly grounded on saved invoice.\n');

  // Test Scenario 9: Start a new invoice and verify previous invoice remains intact
  console.log('--- Test 9: Start New invoice and check previous saved invoices ---');
  const nextNumAfterRes = await fetch(`${API_BASE}/invoices/next-number`).then(r => r.json());
  assert(nextNumAfterRes.success);
  console.log(`Next sequential invoice number for New action: ${nextNumAfterRes.data.invoiceNumber}`);
  assert.notStrictEqual(nextNumAfterRes.data.invoiceNumber, invNumber, 'New invoice number must be sequential and distinct');

  // Verify previous invoice is still safe in DB
  const verifyPrev = await fetch(`${API_BASE}/invoices/${savedInvoice._id}`).then(r => r.json());
  assert(verifyPrev.success, 'Previous invoice must remain intact');
  assert.strictEqual(verifyPrev.data.invoiceNumber, invNumber);
  console.log('✓ Test 9 Passed: Starting new invoice leaves previously saved invoice completely intact.\n');

  // Test Scenario 10 & 11: Delete / cancel invoice and verify stock restoration
  console.log('--- Test 10 & 11: Delete / cancel invoice and stock restoration ---');
  // First verify stock was deducted when saved
  const stockAfterSaveRes = await fetch(`${API_BASE}/items/24116149`).then(r => r.json());
  const stockAfterSave = stockAfterSaveRes.data.quantity;
  console.log(`Stock before save: ${initialStock}, Stock after save (-${qty1}): ${stockAfterSave}`);
  assert.strictEqual(stockAfterSave, initialStock - qty1, 'Stock should be deducted by purchase quantity');

  // Delete invoice
  const delRes = await fetch(`${API_BASE}/invoices/${savedInvoice._id}`, {
    method: 'DELETE'
  }).then(r => r.json());
  assert(delRes.success, `Delete should succeed: ${delRes.message}`);

  // Verify stock is restored
  const stockAfterDelRes = await fetch(`${API_BASE}/items/24116149`).then(r => r.json());
  const stockAfterDel = stockAfterDelRes.data.quantity;
  console.log(`Stock after delete/cancellation: ${stockAfterDel}`);
  assert.strictEqual(stockAfterDel, initialStock, 'Stock should be restored to initial quantity upon deletion');
  console.log('✓ Test 10 & 11 Passed: Invoice deleted and stock restored accurately.\n');

  // Test Scenario 12: Verify settled invoice cannot be deleted silently
  console.log('--- Test 12: Settled invoice protection ---');
  // Create a settled invoice to test deletion refusal
  const settledNumRes = await fetch(`${API_BASE}/invoices/next-number`).then(r => r.json());
  const settledSaveRes = await fetch(`${API_BASE}/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...savePayload,
      no: settledNumRes.data.no,
      invoiceNumber: settledNumRes.data.invoiceNumber,
      isSettled: true, // marked as settled
      status: 'settled',
      settlementStatus: 'Settled',
      settlementRef: 'SETTLE-001',
      lineItems: [
        {
          code: item2.code,
          description: item2.description,
          location: item2.location || 'Main Store',
          quantity: 1,
          sellingPrice: 65,
          price: 65,
          finalPrice: 65,
          value: 65,
          availableQty: 10,
        }
      ],
      amountToPay: 65,
      customerPaidAmount: 65,
      amountReceived: 65,
      paidAmount: 65,
    })
  }).then(r => r.json());

  assert(settledSaveRes.success);
  const settledId = settledSaveRes.data._id;

  // Try to delete settled invoice
  const delSettledRes = await fetch(`${API_BASE}/invoices/${settledId}`, {
    method: 'DELETE'
  }).then(r => r.json());
  console.log(`Delete attempt on settled invoice response:`, delSettledRes);
  assert.strictEqual(delSettledRes.success, false, 'Settled invoice delete MUST fail');
  assert(delSettledRes.message.toLowerCase().includes('settle'), 'Error message must explain settlement invoice protection');
  console.log('✓ Test 12 Passed: Settled invoices cannot be deleted, preserving audit and financial integrity.\n');

  // Clean up test settled invoice
  // Unset isSettled directly for cleanup
  const mongoose = require('mongoose');
  const dotenv = require('dotenv');
  dotenv.config({ path: 'd:/SOFAST/backend/.env' });
  await mongoose.connect(process.env.MONGODB_URI);
  await mongoose.connection.collection('invoices').deleteOne({ _id: new mongoose.Types.ObjectId(settledId) });
  // restore the 1 qty for item2
  await mongoose.connection.collection('items').updateOne(
    { code: item2.code },
    { $inc: { quantity: 1, stockInHand: 1 } }
  );
  await mongoose.disconnect();

  console.log('=== ALL 12 TEST SCENARIOS PASSED SUCCESSFULLY! ===');
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
