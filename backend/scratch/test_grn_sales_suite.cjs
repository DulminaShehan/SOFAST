const assert = require('assert');

const BASE_URL = 'http://localhost:5000/api';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runSuite() {
  console.log('================================================================');
  console.log('   SOFAST POS: 10-STEP VERIFICATION SUITE FOR GRN & SALES STOCK  ');
  console.log('================================================================\n');

  // Find a valid supplier
  const suppRes = await request('/suppliers?limit=1');
  assert(suppRes.ok && suppRes.data?.data?.length > 0, 'Could not fetch supplier');
  const testSupplier = suppRes.data.data[0];
  console.log(`Using supplier: ${testSupplier.code} (${testSupplier.name})`);

  const uniqueSuffix = Date.now().toString().slice(-6);
  const testItemCode = `TEST-ITEM-${uniqueSuffix}`;

  // STEP 1: Create an item with zero opening stock
  console.log('\n--- Step 1: Create an item with zero opening stock ---');
  const createItemRes = await request('/items', {
    method: 'POST',
    body: JSON.stringify({
      code: testItemCode,
      description: `Automated Test Part ${uniqueSuffix}`,
      sellingPrice: 1500,
      costPrice: 1000,
      quantity: 0,
      stockInHand: 0,
      location: 'Main Store',
      category: 'Test Category',
    }),
  });
  assert(createItemRes.ok, `Failed to create item: ${createItemRes.data?.message}`);
  const createdItem = createItemRes.data.data;
  console.log(`Created test item '${testItemCode}':`);
  console.log(`  - quantity: ${createdItem.quantity}`);
  console.log(`  - stockInHand: ${createdItem.stockInHand}`);
  console.log(`  - location: ${createdItem.location}`);
  assert.strictEqual(Number(createdItem.quantity), 0, 'Initial quantity must be 0');
  assert.strictEqual(Number(createdItem.stockInHand), 0, 'Initial stockInHand must be 0');

  // STEP 2: Receive 20 units through GRN and post it
  console.log('\n--- Step 2: Receive 20 units through GRN and post it ---');
  const grn1Number = `GRN-TEST-1-${uniqueSuffix}`;
  const grn1Res = await request('/grn', {
    method: 'POST',
    body: JSON.stringify({
      grnNumber: grn1Number,
      supplierCode: testSupplier.code,
      supplierName: testSupplier.name,
      paidBy: 'Cash',
      date: new Date().toISOString(),
      isPosted: true, // Post to stock immediately
      lineItems: [
        {
          code: testItemCode,
          description: createdItem.description,
          unitPrice: 1000,
          sellingPrice: 1500,
          quantity: 20,
          discount: 0,
          value: 20000,
          location: 'Main Store',
        },
      ],
    }),
  });
  assert(grn1Res.ok, `Failed to create/post GRN 1: ${grn1Res.data?.message}`);
  const grn1Data = grn1Res.data.data;
  console.log(`Created & Posted GRN '${grn1Data.grnNumber}' (ID: ${grn1Data._id}):`);
  console.log(`  - isPosted: ${grn1Data.isPosted}`);
  console.log(`  - status: ${grn1Data.status}`);
  assert.strictEqual(grn1Data.isPosted, true, 'GRN 1 must be marked as posted');

  // STEP 3: Verify Item Master and Sales Invoice both show 20
  console.log('\n--- Step 3: Verify Item Master and Sales Invoice both show 20 ---');
  // A. Item Master API check
  const getItemRes1 = await request(`/items/${encodeURIComponent(testItemCode)}`);
  assert(getItemRes1.ok, `Failed to get item: ${getItemRes1.data?.message}`);
  const itemAfterGrn1 = getItemRes1.data.data;
  console.log(`Item Master Stock:`);
  console.log(`  - quantity: ${itemAfterGrn1.quantity}`);
  console.log(`  - stockInHand: ${itemAfterGrn1.stockInHand}`);
  assert.strictEqual(Number(itemAfterGrn1.quantity), 20, 'Item Master quantity must be 20');
  assert.strictEqual(Number(itemAfterGrn1.stockInHand), 20, 'Item Master stockInHand must be 20');

  // B. Sales Invoice stock lookup check (Invoice items search)
  const invoiceSearchRes1 = await request(`/items?search=${encodeURIComponent(testItemCode)}`);
  assert(invoiceSearchRes1.ok, 'Failed to query items for invoice lookup');
  const matchedInvoiceItem1 = invoiceSearchRes1.data.data.find(
    (i) => i.code?.toLowerCase() === testItemCode.toLowerCase()
  );
  assert(matchedInvoiceItem1, 'Item should be found in invoice item search');
  const invoiceAvailableStock1 =
    matchedInvoiceItem1.quantity !== undefined
      ? matchedInvoiceItem1.quantity
      : matchedInvoiceItem1.stockInHand;
  console.log(`Sales Invoice Available Stock: ${invoiceAvailableStock1}`);
  assert.strictEqual(Number(invoiceAvailableStock1), 20, 'Sales Invoice available stock must be 20');

  // STEP 4: Receive another 10 units and verify stock becomes 30
  console.log('\n--- Step 4: Receive another 10 units via GRN and verify stock becomes 30 ---');
  const grn2Number = `GRN-TEST-2-${uniqueSuffix}`;
  const grn2Res = await request('/grn', {
    method: 'POST',
    body: JSON.stringify({
      grnNumber: grn2Number,
      supplierCode: testSupplier.code,
      supplierName: testSupplier.name,
      paidBy: 'Cash',
      date: new Date().toISOString(),
      isPosted: true,
      lineItems: [
        {
          code: testItemCode,
          description: createdItem.description,
          unitPrice: 1050,
          sellingPrice: 1550,
          quantity: 10,
          discount: 0,
          value: 10500,
          location: 'Main Store',
        },
      ],
    }),
  });
  assert(grn2Res.ok, `Failed to post GRN 2: ${grn2Res.data?.message}`);

  const getItemRes2 = await request(`/items/${encodeURIComponent(testItemCode)}`);
  const itemAfterGrn2 = getItemRes2.data.data;
  console.log(`Item Master Stock after receiving 10 more units:`);
  console.log(`  - quantity: ${itemAfterGrn2.quantity}`);
  console.log(`  - stockInHand: ${itemAfterGrn2.stockInHand}`);
  assert.strictEqual(Number(itemAfterGrn2.quantity), 30, 'Item Master quantity must be 30');
  assert.strictEqual(Number(itemAfterGrn2.stockInHand), 30, 'Item Master stockInHand must be 30');

  // STEP 5: Finalize a sale of 3 units and verify stock becomes 27
  console.log('\n--- Step 5: Finalize a sale of 3 units and verify stock becomes 27 ---');
  const invRes = await request('/invoices', {
    method: 'POST',
    body: JSON.stringify({
      customerCode: 'CUST-001',
      customerName: 'Test Walk In',
      date: new Date().toISOString(),
      paymentMethod: 'Cash',
      customerPaidAmount: 5000,
      amountReceived: 5000,
      status: 'completed',
      isHold: false,
      lineItems: [
        {
          code: testItemCode,
          itemCode: testItemCode,
          description: createdItem.description,
          price: 1500,
          sellingPrice: 1500,
          quantity: 3,
          discount: 0,
          discountPercentage: 0,
          value: 4500,
          finalPrice: 4500,
          location: 'Main Store',
        },
      ],
    }),
  });
  assert(invRes.ok, `Failed to create sale invoice: ${invRes.data?.message}`);
  const createdInv = invRes.data.data;
  console.log(`Finalized Invoice '${createdInv.invoiceNumber}':`);
  console.log(`  - isStockUpdated: ${createdInv.isStockUpdated}`);
  assert.strictEqual(createdInv.isStockUpdated, true, 'Invoice must have updated stock');

  const getItemRes3 = await request(`/items/${encodeURIComponent(testItemCode)}`);
  const itemAfterSale = getItemRes3.data.data;
  console.log(`Item Master Stock after sale of 3 units:`);
  console.log(`  - quantity: ${itemAfterSale.quantity}`);
  console.log(`  - stockInHand: ${itemAfterSale.stockInHand}`);
  assert.strictEqual(Number(itemAfterSale.quantity), 27, 'Item Master quantity must be 27');
  assert.strictEqual(Number(itemAfterSale.stockInHand), 27, 'Item Master stockInHand must be 27');

  // STEP 6: Reopen the GRN and invoice (GET) and verify stock does not change
  console.log('\n--- Step 6: Reopen GRN and Invoice (GET) and verify stock does not change ---');
  await request(`/grn/${grn1Data._id}`);
  await request(`/grn/${grn2Res.data.data._id}`);
  await request(`/invoices/${createdInv._id}`);

  const getItemRes4 = await request(`/items/${encodeURIComponent(testItemCode)}`);
  const itemAfterReopen = getItemRes4.data.data;
  console.log(`Item Master Stock after viewing/reopening records: ${itemAfterReopen.quantity}`);
  assert.strictEqual(Number(itemAfterReopen.quantity), 27, 'Stock must stay 27 when reopening');

  // STEP 7: Attempt duplicate GRN posting and verify stock is not duplicated
  console.log('\n--- Step 7: Attempt duplicate GRN posting and verify stock is not duplicated ---');
  const dupPostRes = await request(`/grn/${grn1Data._id}/post`, { method: 'POST' });
  console.log(`Duplicate post response: status=${dupPostRes.status}, message='${dupPostRes.data?.message}'`);
  assert(dupPostRes.status === 400 || dupPostRes.data?.success === false, 'Duplicate posting must be rejected');

  const getItemRes5 = await request(`/items/${encodeURIComponent(testItemCode)}`);
  const itemAfterDupPost = getItemRes5.data.data;
  console.log(`Item Master Stock after rejected duplicate post attempt: ${itemAfterDupPost.quantity}`);
  assert.strictEqual(Number(itemAfterDupPost.quantity), 27, 'Stock must NOT be duplicated');

  // STEP 8: Test a different location and verify location-specific stock
  console.log('\n--- Step 8: Test a different location and verify location-specific stock ---');
  // Check GRN history with selected location vs different location
  const historyMainRes = await request(
    `/grn/item-history/${encodeURIComponent(testItemCode)}?location=Main Store`
  );
  assert(historyMainRes.ok, 'Failed to fetch GRN history for Main Store');
  console.log(`Main Store closing stock from GRN history: ${historyMainRes.data.data.summary.closingStock}`);
  assert.strictEqual(Number(historyMainRes.data.data.summary.closingStock), 27);

  const historyBranchRes = await request(
    `/grn/item-history/${encodeURIComponent(testItemCode)}?location=Kandy Branch`
  );
  assert(historyBranchRes.ok, 'Failed to fetch GRN history for Kandy Branch');
  console.log(`Kandy Branch closing stock: ${historyBranchRes.data.data.summary.closingStock}`);
  assert.strictEqual(Number(historyBranchRes.data.data.summary.closingStock), 0, 'Unstored location must have 0 stock');

  // STEP 9: Verify stock reports and GRN Closing Stock agree with authoritative inventory balance
  console.log('\n--- Step 9: Verify stock reports and GRN Closing Stock agree with authoritative inventory ---');
  const finalItemRes = await request(`/items/${encodeURIComponent(testItemCode)}`);
  const authStock = Number(finalItemRes.data.data.quantity);
  const grnSummaryStock = Number(historyMainRes.data.data.summary.closingStock);
  console.log(`Authoritative Item Master Stock: ${authStock}`);
  console.log(`GRN Closing Stock Summary:       ${grnSummaryStock}`);
  assert.strictEqual(authStock, grnSummaryStock, 'Authoritative stock and GRN closing stock must agree');
  assert.strictEqual(authStock, 27, 'Both must equal 27');

  // STEP 10: Clean up test invoice & GRNs (reversing stock cleanly) or keep audit record
  console.log('\n--- Step 10: Reverse invoice and verify clean stock restoration ---');
  const cancelInvRes = await request(`/invoices/${createdInv._id}/cancel`, { method: 'POST' });
  assert(cancelInvRes.ok, `Failed to cancel test invoice: ${cancelInvRes.data?.message}`);
  const itemAfterCancel = (await request(`/items/${encodeURIComponent(testItemCode)}`)).data.data;
  console.log(`Stock after cancelling invoice of 3 units (27 + 3 = 30): ${itemAfterCancel.quantity}`);
  assert.strictEqual(Number(itemAfterCancel.quantity), 30, 'Cancelling invoice must restore 3 units back to 30');

  console.log('\n================================================================');
  console.log('   ALL 10 VERIFICATION SCENARIOS PASSED SUCCESSFULLY!          ');
  console.log('================================================================\n');
}

runSuite().catch((err) => {
  console.error('\n❌ Test suite failed with error:\n', err);
  process.exit(1);
});
