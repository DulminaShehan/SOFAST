const BASE_URL = 'http://localhost:5000/api';

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = data?.message || `HTTP ${res.status}: ${res.statusText}`;
    const err = new Error(errorMsg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function runComprehensiveTests() {
  console.log('========================================================================');
  console.log('SOFAST POS — CUSTOMER RETURN, EXCHANGE & DAMAGE TRACKING VERIFICATION');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      failed++;
      throw new Error(`Assertion failed: ${testName}`);
    }
  }

  try {
    // -------------------------------------------------------------------------
    // Setup: Retrieve Test Customer, Items, and Create a Test Invoice
    // -------------------------------------------------------------------------
    console.log('--- SETUP: Creating Test Invoice with 2 Items ---');
    const custRes = await request(`${BASE_URL}/customers`);
    const testCust = custRes.data?.[0] || { code: 'C0001', name: 'TEST CUSTOMER', telephone: '0771234567' };

    const itemsRes = await request(`${BASE_URL}/items?limit=50`);
    const items = itemsRes.data || [];
    if (items.length < 2) {
      throw new Error('Need at least 2 items in database to perform workflow testing');
    }

    const itemA = items.find((i) => (i.quantity || i.stockInHand || 0) >= 10) || items[0];
    const itemB = items.find((i) => i.code !== itemA.code && (i.quantity || i.stockInHand || 0) >= 5) || items[1];

    console.log(`Item A (To Return): [${itemA.code}] ${itemA.description} | Initial Sellable: ${itemA.quantity || itemA.stockInHand} | Quar: ${itemA.damagedStock || 0}`);
    console.log(`Item B (Replacement): [${itemB.code}] ${itemB.description} | Initial Sellable: ${itemB.quantity || itemB.stockInHand}`);

    const nextInv = await request(`${BASE_URL}/invoices/next-number`);
    const invNo = nextInv.data.no;
    const invNumber = nextInv.data.invoiceNumber;

    const unitPriceA = Number(itemA.finalSellingPrice || itemA.sellingPrice || 1000);
    const unitPriceB = Number(itemB.finalSellingPrice || itemB.sellingPrice || 1500);

    const testInvoicePayload = {
      no: invNo,
      invoiceNumber: invNumber,
      date: new Date().toISOString().split('T')[0],
      customerCode: testCust.code || testCust.customerCode || 'C0001',
      customerName: testCust.name || 'TEST CUSTOMER',
      customerTelephone: testCust.telephone || '0771234567',
      paymentType: 'CASH',
      status: 'COMPLETED',
      subTotal: 5 * unitPriceA + 3 * unitPriceB,
      discount: 0,
      netTotal: 5 * unitPriceA + 3 * unitPriceB,
      lineItems: [
        {
          itemCode: itemA.code,
          code: itemA.code,
          description: itemA.description,
          quantity: 5,
          price: unitPriceA,
          unitPrice: unitPriceA,
          amount: 5 * unitPriceA,
        },
        {
          itemCode: itemB.code,
          code: itemB.code,
          description: itemB.description,
          quantity: 3,
          price: unitPriceB,
          unitPrice: unitPriceB,
          amount: 3 * unitPriceB,
        },
      ],
    };

    const createdInv = await request(`${BASE_URL}/invoices`, {
      method: 'POST',
      body: JSON.stringify(testInvoicePayload),
    });
    console.log(`Test Invoice Created: #${createdInv.data?.invoiceNumber || invNumber}\n`);

    // Fetch baseline stock levels after sale
    const freshA1 = (await request(`${BASE_URL}/items/${itemA.code}`)).data;
    const freshB1 = (await request(`${BASE_URL}/items/${itemB.code}`)).data;
    const baselineSellableA = Number(freshA1.quantity || freshA1.stockInHand || 0);
    const baselineDamagedA = Number(freshA1.damagedStock || 0);
    const baselineSellableB = Number(freshB1.quantity || freshB1.stockInHand || 0);

    // -------------------------------------------------------------------------
    // Scenario 1 & 2: Good item returned for exchange (Workflow A)
    // -------------------------------------------------------------------------
    console.log('--- TEST 1 & 2: Workflow A — Good Item Returned for Exchange ---');
    console.log('Returning 2 units of Item A in good condition, exchanging for 1 unit of Item B.');

    const returnAExchangePayload = {
      invoiceNumber: invNumber,
      itemCode: itemA.code,
      returnedQuantity: 2,
      returnReason: 'Exchange — item is in good condition',
      damageReason: 'Exchange — item is in good condition',
      damageNotes: 'Customer exchanged unopened item for different specification',
      workflowType: 'EXCHANGE',
      itemCondition: 'GOOD',
      disposition: 'REPLACEMENT',
      inspection: {
        conditionResult: 'SELLABLE_STOCK',
        inspectionNotes: 'Verified intact and approved for resale',
        inspectedBy: 'Tester',
      },
      replacement: {
        itemCode: itemB.code,
        quantity: 1,
        notes: 'Issued replacement item B',
      },
    };

    const exchResult = await request(`${BASE_URL}/damage-returns`, {
      method: 'POST',
      body: JSON.stringify(returnAExchangePayload),
    });

    const exchRecord = exchResult.data?.returnRecord;
    assert(exchRecord && exchRecord.returnNumber, 'Workflow A return record created with sequential returnNumber');
    assert(exchRecord.workflowType === 'EXCHANGE', 'Workflow type is EXCHANGE');
    assert(exchRecord.itemCondition === 'GOOD', 'Item condition recorded as GOOD');
    assert(exchRecord.replacement?.issued === true, 'Replacement issued flag is true');

    // Expected value difference: 1 * unitPriceB - 2 * unitPriceA
    const expectedDiff = Math.round((unitPriceB - 2 * unitPriceA) * 100) / 100;
    if (expectedDiff > 0) {
      assert(exchRecord.replacement.additionalPaymentRequired === expectedDiff, 'Customer pays positive difference');
    } else if (expectedDiff < 0) {
      assert(exchRecord.replacement.refundAmount === Math.abs(expectedDiff), 'Customer refund/credit calculated accurately');
    } else {
      assert(exchRecord.replacement.settlementType === 'EVEN', 'Even value exchange handled without double-charging');
    }

    // Verify Stock updates for Workflow A:
    // Item A sellable stock MUST increase by +2. damagedStock must NOT increase.
    // Item B sellable stock MUST decrease by -1.
    const freshA2 = (await request(`${BASE_URL}/items/${itemA.code}`)).data;
    const freshB2 = (await request(`${BASE_URL}/items/${itemB.code}`)).data;
    const sellableA2 = Number(freshA2.quantity || freshA2.stockInHand || 0);
    const damagedA2 = Number(freshA2.damagedStock || 0);
    const sellableB2 = Number(freshB2.quantity || freshB2.stockInHand || 0);

    assert(sellableA2 === baselineSellableA + 2, `Item A sellable stock increased by 2 (Baseline: ${baselineSellableA} -> Now: ${sellableA2})`);
    assert(damagedA2 === baselineDamagedA, `Item A damaged stock remained unchanged at ${damagedA2} (not quarantined)`);
    assert(sellableB2 === baselineSellableB - 1, `Replacement Item B sellable stock reduced by 1 (Baseline: ${baselineSellableB} -> Now: ${sellableB2})`);

    // -------------------------------------------------------------------------
    // Scenario 3: Damaged item returned and moved to Damaged Stock (Workflow B)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Workflow B — Damaged Item Returned into Damaged Stock ---');
    console.log('Returning 1 unit of Item A as damaged/defective into quarantine.');

    const returnDamagedPayload = {
      invoiceNumber: invNumber,
      itemCode: itemA.code,
      returnedQuantity: 1,
      returnReason: 'Damaged item',
      damageReason: 'Damaged item',
      damageNotes: 'Hairline crack on outer casing observed by customer',
      workflowType: 'DAMAGE_RETURN',
      itemCondition: 'DAMAGED',
      damageStatus: 'RECEIVED',
      disposition: 'QUARANTINE',
    };

    const dmgResult = await request(`${BASE_URL}/damage-returns`, {
      method: 'POST',
      body: JSON.stringify(returnDamagedPayload),
    });
    const dmgRecord = dmgResult.data?.returnRecord;
    assert(dmgRecord && dmgRecord.returnNumber, 'Damaged return record created');
    assert(dmgRecord.workflowType === 'DAMAGE_RETURN', 'Workflow type recorded as DAMAGE_RETURN');
    assert(dmgRecord.itemCondition === 'DAMAGED', 'Item condition recorded as DAMAGED');

    // Verify Stock updates for Workflow B:
    // Damaged item MUST increment damagedStock by +1. Sellable stock must NOT increase!
    const freshA3 = (await request(`${BASE_URL}/items/${itemA.code}`)).data;
    const sellableA3 = Number(freshA3.quantity || freshA3.stockInHand || 0);
    const damagedA3 = Number(freshA3.damagedStock || 0);

    assert(sellableA3 === sellableA2, `Item A normal sellable stock did NOT increase (remains ${sellableA3})`);
    assert(damagedA3 === damagedA2 + 1, `Item A damagedStock quarantined by +1 (was: ${damagedA2} -> now: ${damagedA3})`);

    // Verify Damage Stock Movement audit trail exists
    const mvmtRes = await request(`${BASE_URL}/damage-stock/movements?itemCode=${itemA.code}`);
    const movements = mvmtRes.data || [];
    const customerReturnMvmt = movements.find(
      (m) =>
        (m.referenceNumber === dmgRecord.returnNumber || m.referenceNo === dmgRecord.returnNumber) &&
        m.origin === 'CUSTOMER RETURN'
    );
    assert(customerReturnMvmt !== undefined, 'DamageStockMovement audit trail logged with origin: CUSTOMER RETURN');

    // -------------------------------------------------------------------------
    // Scenario 4 & 5: Supplier Traceability Inspection & History
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4 & 5: Supplier Identification & Purchase Traceability ---');
    const traceRes = await request(`${BASE_URL}/damage-returns/traceability/${itemA.code}`);
    assert(traceRes.success === true, 'Traceability endpoint responded successfully');
    console.log(`  Item [${itemA.code}] Purchase History Count: ${traceRes.data.purchaseHistory.length}`);
    console.log(`  Distinct Suppliers: ${traceRes.data.distinctSuppliersCount}, Single Source: ${traceRes.data.isSingleSource}`);

    if (traceRes.data.purchaseHistory.length > 0) {
      assert(traceRes.data.hasPurchaseHistory === true, 'Supplier details traced from purchase/GRN records');
      const firstHist = traceRes.data.purchaseHistory[0];
      console.log(`  Traced GRN: ${firstHist.grnNumber}, Supplier: ${firstHist.supplierName}, Inv: ${firstHist.supplierInvoiceNo}`);
    } else {
      console.log('  Item has no GRN history yet; all available suppliers provided for authorized manual selection');
      assert(Array.isArray(traceRes.data.allSuppliers) && traceRes.data.allSuppliers.length > 0, 'Available suppliers returned for manual verification');
    }

    // -------------------------------------------------------------------------
    // Scenario 6: Partial returns & Multiple returns limit validation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Partial Returns & Returnable Limit Enforcement ---');
    // Originally purchased: 5.
    // Previously returned: 2 (exchange) + 1 (damaged) = 3.
    // Remaining available returnable quantity must be exactly 2!
    const invCheckRes = await request(`${BASE_URL}/damage-returns/invoice/${invNumber}`);
    const lineItemA = invCheckRes.data.lineItems.find((li) => li.itemCode === itemA.code);

    assert(lineItemA.purchasedQuantity === 5, 'Line item originally purchased quantity is 5');
    assert(lineItemA.previousReturnedQuantity === 3, 'Line item previously returned quantity is 3');
    assert(lineItemA.availableReturnQuantity === 2, 'Available returnable quantity is exactly 2');

    // Attempt to return 3 units (which exceeds available 2) -> MUST BE REJECTED
    console.log('Testing prevention of return quantity exceeding available return limit (trying 3 when 2 available)...');
    let rejected = false;
    try {
      await request(`${BASE_URL}/damage-returns`, {
        method: 'POST',
        body: JSON.stringify({
          invoiceNumber: invNumber,
          itemCode: itemA.code,
          returnedQuantity: 3,
          returnReason: 'Damaged item',
          damageReason: 'Damaged item',
        }),
      });
    } catch (err) {
      rejected = true;
      assert(err.status === 400, 'Exceeding returnable quantity rejected with HTTP 400');
    }
    assert(rejected === true, 'Prevented return exceeding remaining allowable return quantity');

    // -------------------------------------------------------------------------
    // Scenario 7: Replacement with Higher Price (Customer Pays Difference)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Replacement with Higher Price (Customer Pays Difference) ---');
    // Return 1 unit of Item A (value: unitPriceA). Exchanging for 1 unit of Item B (value: unitPriceB).
    // If unitPriceB > unitPriceA, customer pays difference.
    const higherDiffPayload = {
      invoiceNumber: invNumber,
      itemCode: itemA.code,
      returnedQuantity: 1,
      returnReason: 'Exchange — item is in good condition',
      damageReason: 'Exchange — item is in good condition',
      workflowType: 'EXCHANGE',
      itemCondition: 'GOOD',
      disposition: 'REPLACEMENT',
      replacement: {
        itemCode: itemB.code,
        quantity: 1,
      },
    };

    const higherResult = await request(`${BASE_URL}/damage-returns`, {
      method: 'POST',
      body: JSON.stringify(higherDiffPayload),
    });
    const higherRec = higherResult.data?.returnRecord;
    assert(higherRec.replacement?.issued === true, 'Replacement issued for higher price exchange');
    console.log(`  Difference calculated: Rs. ${higherRec.replacement.valueDifference} (Settlement: ${higherRec.replacement.settlementType})`);

    // -------------------------------------------------------------------------
    // Scenario 8: Duplicate Submission & Zero/Negative Validation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: Duplicate / Invalid Submission Prevention ---');
    let zeroRejected = false;
    try {
      await request(`${BASE_URL}/damage-returns`, {
        method: 'POST',
        body: JSON.stringify({
          invoiceNumber: invNumber,
          itemCode: itemA.code,
          returnedQuantity: 0,
          returnReason: 'Damaged item',
        }),
      });
    } catch (err) {
      zeroRejected = true;
      assert(err.status === 400, 'Returned quantity of 0 rejected');
    }
    assert(zeroRejected === true, 'Prevented submission with non-positive returned quantity');

    // -------------------------------------------------------------------------
    // Scenario 9: Supplier Damage Claim & Replacement Receipt
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 9: Supplier Damage Claim & Replacement Physical Receipt ---');
    // Return the final remaining 1 unit of Item A as supplier claim
    const claimReturnPayload = {
      invoiceNumber: invNumber,
      itemCode: itemA.code,
      returnedQuantity: 1,
      returnReason: 'Defective item',
      damageReason: 'Defective item',
      damageNotes: 'Internal component short-circuit under factory warranty',
      workflowType: 'DAMAGE_RETURN',
      itemCondition: 'DAMAGED',
      damageStatus: 'CLAIM PENDING',
      disposition: 'SUPPLIER_CLAIM',
      verifiedSupplier: {
        supplierCode: 'SUP001',
        supplierName: 'UNITED MOTORS LANKA',
        supplierTelephone: '0112345678',
        grnNumber: 'GRN-001',
        verificationStatus: 'VERIFIED',
      },
    };

    const claimReturnRes = await request(`${BASE_URL}/damage-returns`, {
      method: 'POST',
      body: JSON.stringify(claimReturnPayload),
    });
    const claimRecord = claimReturnRes.data?.claimRecord;
    assert(claimRecord && claimRecord.claimNumber, `Supplier Claim '${claimRecord?.claimNumber}' created successfully`);

    // Check stock before supplier replacement receipt
    const freshA4 = (await request(`${BASE_URL}/items/${itemA.code}`)).data;
    const sellableBeforeClaim = Number(freshA4.quantity || freshA4.stockInHand || 0);
    const quarBeforeClaim = Number(freshA4.damagedStock || 0);

    // Physically receive replacement from supplier
    console.log(`Receiving replacement for Claim '${claimRecord.claimNumber}'...`);
    const receiveRes = await request(`${BASE_URL}/supplier-claims/${claimRecord._id}/receive-replacement`, {
      method: 'POST',
      body: JSON.stringify({
        replacementQuantity: 1,
        replacementNotes: 'Received brand new replacement unit from supplier with warranty',
        receivedBy: 'StoreManager',
      }),
    });
    assert(receiveRes.success === true, 'Supplier replacement receipt processed');

    // Verify stock updated exactly once: sellable stock increases by 1, quarantine stock decreases by 1
    const freshA5 = (await request(`${BASE_URL}/items/${itemA.code}`)).data;
    const sellableAfterClaim = Number(freshA5.quantity || freshA5.stockInHand || 0);
    const quarAfterClaim = Number(freshA5.damagedStock || 0);

    assert(sellableAfterClaim === sellableBeforeClaim + 1, `Sellable stock increased exactly once by +1 on physical receipt (${sellableBeforeClaim} -> ${sellableAfterClaim})`);
    assert(quarAfterClaim === quarBeforeClaim - 1, `Damaged quarantine stock reduced by -1 (${quarBeforeClaim} -> ${quarAfterClaim})`);

    // Test duplicate receipt prevention: try receiving again on the resolved claim
    let dupClaimRejected = false;
    try {
      await request(`${BASE_URL}/supplier-claims/${claimRecord._id}/receive-replacement`, {
        method: 'POST',
        body: JSON.stringify({ replacementQuantity: 1 }),
      });
    } catch (err) {
      dupClaimRejected = true;
      assert(err.status === 400, 'Duplicate supplier replacement receipt prevented on resolved claim');
    }
    assert(dupClaimRejected === true, 'Claim replacement cannot be accepted more than once');

    // -------------------------------------------------------------------------
    // Scenario 10: Existing System Functions Continuity Check
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 10: Existing Modules Integrity Verification ---');
    const invoicesList = await request(`${BASE_URL}/invoices?limit=5`);
    assert(Array.isArray(invoicesList.data), 'Create Invoice and Invoice List API fully operational');

    const settlementsList = await request(`${BASE_URL}/settlements?limit=5`);
    assert(Array.isArray(settlementsList.data), 'Settlement Invoice API fully operational');

    const grnList = await request(`${BASE_URL}/grn?limit=5`);
    assert(Array.isArray(grnList.data), 'Good Receive Note (GRN) API fully operational');

    const itemsList = await request(`${BASE_URL}/items?limit=5`);
    assert(Array.isArray(itemsList.data), 'Item Master API fully operational');

    const damageSummary = await request(`${BASE_URL}/damage-stock/summary`);
    assert(damageSummary.success === true, 'Damage Stock Quarantine summary API fully operational');

    console.log('\n========================================================================');
    console.log(`ALL 10 SCENARIOS COMPLETED SUCCESSFULLY! (${passed} PASSED, ${failed} FAILED)`);
    console.log('========================================================================\n');
  } catch (err) {
    console.error('\nTEST RUNNER ERROR:', err.message, err.data || '');
    process.exit(1);
  }
}

runComprehensiveTests();
