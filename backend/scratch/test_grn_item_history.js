const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('=== SOFAST POS - GRN Item History Verification Tests ===\n');
  let passedCount = 0;
  let totalCount = 0;

  const assert = (condition, description) => {
    totalCount++;
    if (condition) {
      console.log(`✅ PASS [Test ${totalCount}]: ${description}`);
      passedCount++;
    } else {
      console.error(`❌ FAIL [Test ${totalCount}]: ${description}`);
    }
  };

  try {
    // 1. Selecting an item loads its previous GRN history
    console.log('--- Test 1: Selecting an item loads its previous GRN history ---');
    const res1 = await fetch(`${BASE_URL}/grn/item-history/01100342`);
    const data1 = await res1.json();
    assert(res1.status === 200 && data1.success === true, 'GET /api/grn/item-history/01100342 returns 200 OK');
    assert(Array.isArray(data1.data?.history) && data1.data.history.length > 0, 'Item 01100342 returns real historical records');

    const firstRecord = data1.data.history[0];
    const requiredFields = [
      'grnNumber', 'date', 'supplier', 'supplierInvoiceNo', 'code',
      'description', 'price', 'sellPrice', 'quantity', 'discount',
      'value', 'location', 'status'
    ];
    const missingFields = requiredFields.filter((f) => firstRecord[f] === undefined);
    assert(missingFields.length === 0, `History contains all 13 required fields (missing: ${missingFields.join(', ') || 'none'})`);

    // 2. History is sorted newest first
    console.log('\n--- Test 2: History is sorted newest first ---');
    let isSorted = true;
    for (let i = 0; i < data1.data.history.length - 1; i++) {
      const curDate = new Date(data1.data.history[i].date).getTime();
      const nextDate = new Date(data1.data.history[i + 1].date).getTime();
      if (curDate < nextDate) {
        isSorted = false;
        break;
      }
    }
    assert(isSorted, 'History records are strictly ordered with newest first');

    // 3. Items without history show an appropriate empty state
    console.log('\n--- Test 3: Items without history show appropriate empty state ---');
    const resEmpty = await fetch(`${BASE_URL}/grn/item-history/NO_SUCH_ITEM_12345`);
    const dataEmpty = await resEmpty.json();
    assert(resEmpty.status === 200 && dataEmpty.success === true, 'Empty item returns 200 OK');
    assert(Array.isArray(dataEmpty.data?.history) && dataEmpty.data.history.length === 0, 'Returns empty history array without throwing errors');
    assert(dataEmpty.data?.totalReceipts === 0, 'Total receipts is 0');
    assert(dataEmpty.data?.summary?.lastGrn === '-', 'Summary lastGrn defaults safely to "-"');
    assert(dataEmpty.data?.summary?.lpc === '0.00', 'Summary LPC defaults safely to "0.00"');

    // 4. Closing Stock reflects the correct location
    console.log('\n--- Test 4: Closing Stock reflects the correct location ---');
    const resItem = await fetch(`${BASE_URL}/items?search=01100342&limit=1`);
    const itemMasterData = await resItem.json();
    const dbItem = itemMasterData.data?.[0];
    const expectedStock = dbItem ? (dbItem.quantity !== undefined ? dbItem.quantity : (dbItem.stockInHand || 0)) : 0;
    const expectedLoc = dbItem?.location || 'Main Store';

    assert(data1.data?.summary?.closingStock === expectedStock, `Closing stock matches Item Master balance (${expectedStock})`);
    assert(data1.data?.summary?.location === expectedLoc, `Location matches Item Master location (${expectedLoc})`);

    // 5. Opening history does not change the current GRN form or stock
    console.log('\n--- Test 5: Opening history does not change stock or mutate database ---');
    const stockBefore = expectedStock;
    // Call history endpoint 3 times in a row
    await fetch(`${BASE_URL}/grn/item-history/01100342`);
    await fetch(`${BASE_URL}/grn/item-history/01100342`);
    const resItemAfter = await fetch(`${BASE_URL}/items?search=01100342&limit=1`);
    const itemMasterDataAfter = await resItemAfter.json();
    const stockAfter = itemMasterDataAfter.data?.[0]?.quantity ?? itemMasterDataAfter.data?.[0]?.stockInHand ?? 0;
    assert(stockAfter === stockBefore, `Stock remains exactly ${stockBefore} after querying history multiple times`);

    // 6. Saving and posting a new GRN updates the history correctly
    console.log('\n--- Test 6: Saving and posting a new GRN updates the history correctly ---');
    // We will create a test GRN for item SFHONDAAIR
    const nextNumRes = await fetch(`${BASE_URL}/grn/next-number`);
    const nextNumData = await nextNumRes.json();
    const testGrnNo = nextNumData.data.no;
    const testGrnNumber = nextNumData.data.grnNumber;

    // Create Draft GRN
    const draftRes = await fetch(`${BASE_URL}/grn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        no: testGrnNo,
        grnNumber: `HIST-TEST-${Date.now()}`,
        supplierCode: 'RAT',
        supplierName: 'RATHNASIRI',
        supplierInvoiceNo: 'INV-TEST-HIST',
        paidBy: 'Cash',
        isPosted: false,
        lineItems: [
          {
            code: '01100342',
            description: 'BEARING BALL [6204]',
            quantity: 5,
            unitPrice: 1650,
            sellingPrice: 2000,
            discount: 5,
            value: 7837.5,
            locationCode: 'Main Store',
          },
        ],
      }),
    });
    const draftJson = await draftRes.json();
    assert(draftRes.status === 201 && draftJson.success === true, 'Created draft GRN successfully');

    const createdGrnId = draftJson.data._id;
    const createdGrnNum = draftJson.data.grnNumber;

    // Query history for 01100342 - draft should be at the top with status 'Draft'
    const histDraftRes = await fetch(`${BASE_URL}/grn/item-history/01100342`);
    const histDraftData = await histDraftRes.json();
    const topDraft = histDraftData.data.history.find((h) => h.grnNumber === createdGrnNum);
    assert(Boolean(topDraft), `New draft GRN '${createdGrnNum}' appears in item history`);
    assert(topDraft?.status === 'Draft' && topDraft?.isPosted === false, `Draft GRN status is 'Draft'`);

    // Post the GRN
    const postRes = await fetch(`${BASE_URL}/grn/${createdGrnId}/post`, {
      method: 'POST',
    });
    const postJson = await postRes.json();
    assert(postRes.status === 200 && postJson.success === true, 'Posted GRN successfully');

    // Query history again - should now show status 'Posted'
    const histPostedRes = await fetch(`${BASE_URL}/grn/item-history/01100342`);
    const histPostedData = await histPostedRes.json();
    const topPosted = histPostedData.data.history.find((h) => h.grnNumber === createdGrnNum);
    assert(topPosted?.status === 'Posted' && topPosted?.isPosted === true, `Posted GRN status is 'Posted'`);
    assert(topPosted?.price === 1650, `Purchase price is correctly recorded as 1650`);

    // Clean up test GRN
    const delRes = await fetch(`${BASE_URL}/grn/${createdGrnId}`, { method: 'DELETE' });
    const delJson = await delRes.json();
    assert(delRes.status === 200 && delJson.success === true, 'Cleaned up test GRN and reverted test stock');

    // 7. Location filtering
    console.log('\n--- Test 7: Location filtering ---');
    const resLoc = await fetch(`${BASE_URL}/grn/item-history/01100342?location=Main Store`);
    const dataLoc = await resLoc.json();
    const allMainStore = dataLoc.data.history.every((h) => h.location.toLowerCase() === 'main store');
    assert(allMainStore, 'Filtered history strictly returns records for "Main Store"');

    console.log(`\n========================================`);
    console.log(`TEST SUMMARY: ${passedCount} / ${totalCount} TESTS PASSED`);
    console.log(`========================================`);
  } catch (err) {
    console.error('Test execution failed with error:', err);
  }
}

runTests();
