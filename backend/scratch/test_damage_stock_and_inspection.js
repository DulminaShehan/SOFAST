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

async function testDamageStockAndInspection() {
  console.log('--- Testing Damage Stock & Inspection API endpoints ---');

  // 1. Pick an item
  const itemsRes = await request(`${BASE_URL}/items?limit=5`);
  const item = itemsRes.data[0];
  const itemCode = item.code;

  const beforeItem = (await request(`${BASE_URL}/items/${itemCode}`)).data;
  const sellableBefore = Number(beforeItem.quantity || beforeItem.stockInHand || 0);
  const quarBefore = Number(beforeItem.damagedStock || 0);

  // 2. Record Shop Floor Damage
  console.log(`Recording 1 unit of shop floor damage for [${itemCode}]...`);
  const shopDmgRes = await request(`${BASE_URL}/damage-stock/shop-damage`, {
    method: 'POST',
    body: JSON.stringify({
      itemCode,
      quantity: 1,
      reason: 'Dropped during stocking',
      notes: 'Cracked plastic bracket',
      location: 'Main Store',
    }),
  });
  console.log('Shop damage logged:', shopDmgRes.message);

  // Verify stock moved from sellable to damaged quarantine
  const afterItem = (await request(`${BASE_URL}/items/${itemCode}`)).data;
  const sellableAfter = Number(afterItem.quantity || afterItem.stockInHand || 0);
  const quarAfter = Number(afterItem.damagedStock || 0);

  if (sellableAfter !== sellableBefore - 1 || quarAfter !== quarBefore + 1) {
    throw new Error(`Shop damage stock transfer failed: Sellable ${sellableBefore}->${sellableAfter}, Quar ${quarBefore}->${quarAfter}`);
  }
  console.log(`[PASS] Shop damage moved 1 unit: Sellable (${sellableBefore} -> ${sellableAfter}), Quar (${quarBefore} -> ${quarAfter})`);

  // 3. Test Inspection Update:
  // Find a return in history
  const returns = (await request(`${BASE_URL}/damage-returns?limit=5`)).data || [];
  const testReturn = returns.find((r) => r.workflowType === 'DAMAGE_RETURN') || returns[0];

  if (testReturn) {
    console.log(`Testing inspection update on Return '${testReturn.returnNumber}'...`);
    const inspectRes = await request(`${BASE_URL}/damage-returns/${testReturn._id}/inspection`, {
      method: 'PATCH',
      body: JSON.stringify({
        damageStatus: 'UNDER INSPECTION',
        inspectionResult: 'DAMAGED_QUARANTINE',
        inspectionNotes: 'Technician verified fault: cannot be repaired in-house',
        inspectedBy: 'QA_Officer',
      }),
    });
    console.log(`[PASS] Inspection updated: ${inspectRes.message}`);
  }

  // 4. Test Damage Stock Summary
  const summaryRes = await request(`${BASE_URL}/damage-stock/summary`);
  console.log(`[PASS] Damage Stock Summary: ${summaryRes.data.metrics.totalDamagedUnits} damaged units, Rs. ${summaryRes.data.metrics.totalDamagedValue}`);

  console.log('\n--- ALL ADDITIONAL DAMAGE STOCK & INSPECTION TESTS PASSED! ---');
}

testDamageStockAndInspection().catch((err) => {
  console.error('Test Failed:', err.message);
  process.exit(1);
});
