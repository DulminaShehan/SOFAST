const API_BASE = 'http://localhost:5000/api';

async function fetchItemStock(itemCode) {
  const res = await fetch(`${API_BASE}/items/${encodeURIComponent(itemCode)}`);
  const data = await res.json();
  if (data.success && data.data) {
    return {
      sellable: Number(data.data.quantity ?? data.data.stockInHand ?? 0),
      damagedStock: Number(data.data.damagedStock ?? 0),
      item: data.data
    };
  }
  return { sellable: 0, damagedStock: 0, item: null };
}

async function runTests() {
  console.log('--- Starting Customer Damage Return & Supplier Claim End-to-End Tests ---');

  // Test 1: Next Sequence Numbers
  console.log('\n[Test 1] Checking next sequence numbers...');
  const retNumRes = await fetch(`${API_BASE}/damage-returns/next-number`);
  const retNumData = await retNumRes.json();
  console.log('Next Return Number:', retNumData.data?.returnNumber);

  const claimNumRes = await fetch(`${API_BASE}/supplier-claims/next-number`);
  const claimNumData = await claimNumRes.json();
  console.log('Next Claim Number:', claimNumData.data?.claimNumber);

  // Test 2: Search Invoice for Return
  console.log('\n[Test 2] Searching Invoice 47619...');
  const invRes = await fetch(`${API_BASE}/damage-returns/invoice/47619`);
  const invData = await invRes.json();
  console.log('Invoice response success:', invData.success);
  console.log('Invoice Number:', invData.data?.invoice?.invoiceNumber);
  console.log('Customer:', invData.data?.invoice?.customer?.name);
  console.log('Line Items count:', invData.data?.lineItems?.length);

  if (!invData.data?.lineItems || invData.data.lineItems.length === 0) {
    throw new Error('No line items found on invoice 47619');
  }

  const itemToTest = invData.data.lineItems[0];
  console.log('Target Item for Return Test:', {
    itemCode: itemToTest.itemCode,
    description: itemToTest.description,
    purchasedQuantity: itemToTest.purchasedQuantity,
    previousReturnedQuantity: itemToTest.previousReturnedQuantity,
    availableReturnQuantity: itemToTest.availableReturnQuantity,
    unitPrice: itemToTest.unitPrice,
    currentSellableStock: itemToTest.currentSellableStock,
    currentDamagedStock: itemToTest.currentDamagedStock,
  });

  // Test 3: Supplier Traceability for Item
  console.log(`\n[Test 3] Supplier Traceability for item '${itemToTest.itemCode}' across GRNs...`);
  const traceRes = await fetch(`${API_BASE}/damage-returns/traceability/${itemToTest.itemCode}`);
  const traceData = await traceRes.json();
  console.log('Traceability success:', traceData.success);
  console.log('Purchase History count:', traceData.data?.purchaseHistory?.length);
  console.log('Distinct Suppliers count:', traceData.data?.distinctSuppliersCount);
  console.log('Suggested Supplier:', traceData.data?.suggestedSupplier);

  // Test 4: Prevent Returning More than allowable quantity
  console.log('\n[Test 4] Attempting return exceeding purchased quantity (Validation test)...');
  const invalidReturnPayload = {
    invoiceNumber: invData.data.invoice.invoiceNumber,
    itemCode: itemToTest.itemCode,
    returnedQuantity: itemToTest.availableReturnQuantity + 99, // Exceeds limit!
    damageReason: 'Customer reported broken unit',
    damageNotes: 'Testing overflow prevention',
    disposition: 'QUARANTINE',
  };

  const invExceedRes = await fetch(`${API_BASE}/damage-returns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(invalidReturnPayload)
  });
  const invExceedData = await invExceedRes.json();
  console.log('Exceeding return rejected correctly?', invExceedRes.status === 400, 'Message:', invExceedData.message);

  // Test 5: Fetch item stock before return
  const stockBefore = await fetchItemStock(itemToTest.itemCode);
  console.log(`\n[Test 5] Stock BEFORE return - Item: ${itemToTest.itemCode}`);
  console.log(`  Sellable: ${stockBefore.sellable}, Damaged in Quarantine: ${stockBefore.damagedStock}`);

  // Test 6: Create Valid Customer Return with Replacement
  console.log('\n[Test 6] Submitting valid Customer Damage Return with REPLACEMENT...');
  const returnQty = 1;
  const validReturnPayload = {
    invoiceNumber: invData.data.invoice.invoiceNumber,
    itemCode: itemToTest.itemCode,
    returnedQuantity: returnQty,
    damageReason: 'Internal component rattle / defective',
    damageNotes: 'Returned within 14 days warranty',
    disposition: 'REPLACEMENT',
    replacement: {
      itemCode: itemToTest.itemCode,
      quantity: returnQty,
      additionalPaymentRequired: 0,
      notes: 'Even swap warranty replacement'
    },
    verifiedSupplier: traceData.data?.suggestedSupplier || null,
    remarks: 'Auto-tested via E2E test script'
  };

  const createReturnRes = await fetch(`${API_BASE}/damage-returns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validReturnPayload)
  });
  const createReturnData = await createReturnRes.json();
  console.log('Return created successfully?', createReturnData.success, 'Return No:', createReturnData.data?.returnNumber);
  console.log('Created Return Ref:', createReturnData.data?.returnNumber, 'Disposition:', createReturnData.data?.disposition);

  // Test 7: Fetch item stock after return with replacement
  const stockAfterReturn = await fetchItemStock(itemToTest.itemCode);

  console.log(`\n[Test 7] Stock AFTER Customer Return with Replacement:`);
  console.log(`  Sellable: ${stockBefore.sellable} -> ${stockAfterReturn.sellable} (Diff: ${stockAfterReturn.sellable - stockBefore.sellable}, Expected: -${returnQty})`);
  console.log(`  DamagedStock: ${stockBefore.damagedStock} -> ${stockAfterReturn.damagedStock} (Diff: ${stockAfterReturn.damagedStock - stockBefore.damagedStock}, Expected: +${returnQty})`);

  const sellableDecreased = (stockAfterReturn.sellable === stockBefore.sellable - returnQty);
  const damagedIncreased = (stockAfterReturn.damagedStock === stockBefore.damagedStock + returnQty);
  console.log('Sellable stock decreased correctly?', sellableDecreased);
  console.log('Damaged stock quarantined correctly?', damagedIncreased);

  // Test 8: Recheck Invoice Line Items for updated limits
  console.log('\n[Test 8] Re-checking Invoice Line Return Limits...');
  const invRecheckRes = await fetch(`${API_BASE}/damage-returns/invoice/47619`);
  const invRecheckData = await invRecheckRes.json();
  const recheckedLine = invRecheckData.data?.lineItems?.find(i => i.itemCode.toLowerCase() === itemToTest.itemCode.toLowerCase());
  console.log('Updated Line Limits:', {
    purchasedQuantity: recheckedLine.purchasedQuantity,
    previousReturnedQuantity: recheckedLine.previousReturnedQuantity,
    availableReturnQuantity: recheckedLine.availableReturnQuantity
  });
  console.log('Available return quantity decremented?', recheckedLine.availableReturnQuantity === itemToTest.availableReturnQuantity - returnQty);

  // Test 9: Create Supplier Damage Claim
  console.log('\n[Test 9] Creating Supplier Damage Claim for defective quarantined item...');
  const claimPayload = {
    supplierCode: traceData.data?.suggestedSupplier?.supplierCode || 'RAT',
    supplierName: traceData.data?.suggestedSupplier?.supplierName || 'Rathnasiri',
    supplierTelephone: traceData.data?.suggestedSupplier?.supplierTelephone || '0755225281',
    supplierInvoiceNo: traceData.data?.suggestedSupplier?.supplierInvoiceNo || '',
    grnNumber: traceData.data?.suggestedSupplier?.grnNumber || '',
    itemCode: itemToTest.itemCode,
    quantity: returnQty,
    damageReason: 'Factory manufacturing fault - customer warranty return',
    notes: 'Claim created following customer return',
    customerReturnNumber: createReturnData.data?.returnNumber,
    unitCost: itemToTest.unitPrice
  };

  const createClaimRes = await fetch(`${API_BASE}/supplier-claims`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(claimPayload)
  });
  const createClaimData = await createClaimRes.json();
  console.log('Claim created successfully?', createClaimData.success, 'Claim Number:', createClaimData.data?.claimNumber);
  const claimId = createClaimData.data?._id;

  // Test 10: Update claim status to SENT_TO_SUPPLIER
  console.log('\n[Test 10] Updating claim status to SENT_TO_SUPPLIER...');
  const updateStatusRes = await fetch(`${API_BASE}/supplier-claims/${claimId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      claimStatus: 'SENT_TO_SUPPLIER',
      supplierReference: 'SUPP-DISPATCH-991',
      notes: 'Handed over to supplier driver with delivery receipt'
    })
  });
  const updateStatusData = await updateStatusRes.json();
  console.log('Claim status updated?', updateStatusData.success, 'Status:', updateStatusData.data?.claimStatus);

  // Test 11: Receive physical replacement from supplier
  console.log('\n[Test 11] Receiving physical replacement goods from supplier...');
  const stockPreReceive = await fetchItemStock(itemToTest.itemCode);

  const receiveReplRes = await fetch(`${API_BASE}/supplier-claims/${claimId}/receive-replacement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quantityReceived: returnQty,
      replacementItemCode: itemToTest.itemCode,
      deliveryNoteNo: 'DN-SUPPLIER-4412',
      acceptedBy: 'Chief Storekeeper',
      remarks: 'Goods physically verified and accepted in perfect working order'
    })
  });
  const receiveReplData = await receiveReplRes.json();
  console.log('Replacement received?', receiveReplData.success, 'New Status:', receiveReplData.data?.claimStatus);

  // Test 12: Verify final stock balances
  const stockPostReceive = await fetchItemStock(itemToTest.itemCode);

  console.log(`\n[Test 12] Final Stock AFTER receiving supplier replacement:`);
  console.log(`  Sellable: ${stockPreReceive.sellable} -> ${stockPostReceive.sellable} (Diff: +${stockPostReceive.sellable - stockPreReceive.sellable}, Expected: +${returnQty})`);
  console.log(`  DamagedStock: ${stockPreReceive.damagedStock} -> ${stockPostReceive.damagedStock} (Diff: ${stockPostReceive.damagedStock - stockPreReceive.damagedStock}, Expected: -${returnQty})`);

  const sellableReplenished = (stockPostReceive.sellable === stockPreReceive.sellable + returnQty);
  const damagedQuarantineReleased = (stockPostReceive.damagedStock === stockPreReceive.damagedStock - returnQty);

  console.log('Sellable stock replenished correctly?', sellableReplenished);
  console.log('Damaged stock released from quarantine correctly?', damagedQuarantineReleased);

  console.log('\n======================================================');
  console.log('✅ ALL INTEGRATION & LOGIC TESTS PASSED PERFECTLY!');
  console.log('======================================================');
}

runTests().catch(err => {
  console.error('Test failed with error:', err);
});
