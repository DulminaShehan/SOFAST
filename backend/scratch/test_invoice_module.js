const BASE_URL = 'http://localhost:5000/api';

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || `HTTP ${res.status}`);
  }
  return data;
}

async function runInvoiceTests() {
  console.log('--- STARTING SALES INVOICE MODULE AUTOMATED TESTS ---');
  let testInvoiceId = null;
  let holdInvoiceId = null;

  try {
    // 1. Next Invoice Number Test
    console.log('\n1. Testing GET /api/invoices/next-number...');
    const nextNumRes = await request(`${BASE_URL}/invoices/next-number`);
    console.log('Next Invoice Number Response:', nextNumRes);
    const generatedNo = nextNumRes.data.no;
    const generatedInvoiceNumber = nextNumRes.data.invoiceNumber;
    if (!generatedNo || !generatedInvoiceNumber) {
      throw new Error('Failed to retrieve valid sequential invoice number');
    }

    // 2. Customer Lookup Test
    console.log('\n2. Testing GET /api/customers & search...');
    const custRes = await request(`${BASE_URL}/customers`);
    console.log(`Found ${custRes.data?.length || 0} customers in database`);
    const testCustomer = custRes.data?.[0];
    console.log('Using customer for test:', testCustomer?.code || testCustomer?.customerCode, testCustomer?.name);

    // 3. Item Master Lookup Test
    console.log('\n3. Testing GET /api/items & stock status...');
    const itemsRes = await request(`${BASE_URL}/items?limit=10`);
    const availableItems = itemsRes.data || [];
    if (availableItems.length < 2) {
      throw new Error('Need at least 2 items in database to test multi-item invoice');
    }
    const item1 = availableItems[0];
    const item2 = availableItems[1];
    console.log(`Item 1: ${item1.code} (${item1.description}) - Stock: ${item1.quantity ?? item1.stockInHand}`);
    console.log(`Item 2: ${item2.code} (${item2.description}) - Stock: ${item2.quantity ?? item2.stockInHand}`);

    const item1InitialStock = item1.quantity ?? item1.stockInHand ?? 0;
    const item2InitialStock = item2.quantity ?? item2.stockInHand ?? 0;

    // 4. Create Completed Invoice (Stock should deduct)
    console.log('\n4. Testing POST /api/invoices (Completed Invoice with multiple items)...');
    const invoicePayload = {
      no: generatedNo,
      invoiceNumber: generatedInvoiceNumber,
      date: new Date().toISOString().split('T')[0],
      customerCode: testCustomer?.code || testCustomer?.customerCode || 'C0001',
      customerName: testCustomer?.name || 'TEST MOTORS LTD',
      customerAddress: testCustomer?.address || '123 Main Street',
      jobType: 'Material',
      jd: 'Invoice',
      isHold: false,
      status: 'completed',
      remark: 'Automated Test Completed Invoice',
      lineItems: [
        {
          code: item1.code,
          description: item1.description,
          location: item1.location || 'Main Store',
          quantity: 2,
          masterPack: item1.masterPack || '1',
          rateType: 'Retail',
          price: item1.finalSellingPrice || item1.sellingPrice || 1000,
          itemCost: item1.lastGrnPrice || 500,
          mpCost: item1.averageCost || 500,
          discountPercentage: 10,
          discountAmount: ((item1.finalSellingPrice || item1.sellingPrice || 1000) * 2 * 0.1),
          value: ((item1.finalSellingPrice || item1.sellingPrice || 1000) * 2 * 0.9),
          total: ((item1.finalSellingPrice || item1.sellingPrice || 1000) * 2 * 0.9),
        },
        {
          code: item2.code,
          description: item2.description,
          location: item2.location || 'Main Store',
          quantity: 1,
          masterPack: item2.masterPack || '1',
          rateType: 'Retail',
          price: item2.finalSellingPrice || item2.sellingPrice || 500,
          itemCost: item2.lastGrnPrice || 250,
          mpCost: item2.averageCost || 250,
          discountPercentage: 0,
          discountAmount: 0,
          value: (item2.finalSellingPrice || item2.sellingPrice || 500),
          total: (item2.finalSellingPrice || item2.sellingPrice || 500),
        }
      ],
      specialDiscount: 0,
      amountToPay: ((item1.finalSellingPrice || item1.sellingPrice || 1000) * 2 * 0.9) + (item2.finalSellingPrice || item2.sellingPrice || 500),
      amountReceived: ((item1.finalSellingPrice || item1.sellingPrice || 1000) * 2 * 0.9) + (item2.finalSellingPrice || item2.sellingPrice || 500),
      dueAmount: 0
    };

    const createRes = await request(`${BASE_URL}/invoices`, {
      method: 'POST',
      body: JSON.stringify(invoicePayload)
    });
    console.log('Create Invoice Response:', createRes.message);
    testInvoiceId = createRes.data?._id;

    // Verify stock deduction
    console.log('\n5. Verifying stock deduction in database...');
    const item1Check = await request(`${BASE_URL}/items/${item1._id}`);
    const item2Check = await request(`${BASE_URL}/items/${item2._id}`);
    const item1NewStock = item1Check.data?.quantity ?? item1Check.data?.stockInHand ?? 0;
    const item2NewStock = item2Check.data?.quantity ?? item2Check.data?.stockInHand ?? 0;

    console.log(`Item 1 Stock: Before=${item1InitialStock}, After=${item1NewStock}, Expected=${item1InitialStock - 2}`);
    console.log(`Item 2 Stock: Before=${item2InitialStock}, After=${item2NewStock}, Expected=${item2InitialStock - 1}`);

    if (item1NewStock !== item1InitialStock - 2 || item2NewStock !== item2InitialStock - 1) {
      throw new Error(`Stock deduction mismatch! Expected ${item1InitialStock - 2} and ${item2InitialStock - 1}`);
    }
    console.log('✓ Stock deduction verified successfully!');

    // 6. Test Hold Invoice (Stock should NOT deduct)
    console.log('\n6. Testing POST /api/invoices (HOLD Invoice - Stock should NOT deduct)...');
    const nextHoldNumRes = await request(`${BASE_URL}/invoices/next-number`);
    const holdPayload = {
      ...invoicePayload,
      no: nextHoldNumRes.data.no,
      invoiceNumber: nextHoldNumRes.data.invoiceNumber,
      isHold: true,
      status: 'hold',
      remark: 'Automated Test Hold Invoice'
    };
    const holdRes = await request(`${BASE_URL}/invoices`, {
      method: 'POST',
      body: JSON.stringify(holdPayload)
    });
    holdInvoiceId = holdRes.data?._id;
    console.log('Hold Invoice Response:', holdRes.message);

    const item1HoldCheck = await request(`${BASE_URL}/items/${item1._id}`);
    const item1StockAfterHold = item1HoldCheck.data?.quantity ?? item1HoldCheck.data?.stockInHand ?? 0;
    console.log(`Item 1 Stock after Hold invoice: ${item1StockAfterHold} (Must remain unchanged = ${item1NewStock})`);
    if (item1StockAfterHold !== item1NewStock) {
      throw new Error('Stock was incorrectly deducted for a Hold invoice!');
    }
    console.log('✓ Hold invoice stock non-deduction verified successfully!');

    // 7. Test Delete Invoice (Stock should be restored)
    console.log('\n7. Testing DELETE /api/invoices/:id (Stock restoration)...');
    await request(`${BASE_URL}/invoices/${testInvoiceId}`, { method: 'DELETE' });
    await request(`${BASE_URL}/invoices/${holdInvoiceId}`, { method: 'DELETE' });
    console.log('Deleted test invoices.');

    const item1RestoredCheck = await request(`${BASE_URL}/items/${item1._id}`);
    const item1StockRestored = item1RestoredCheck.data?.quantity ?? item1RestoredCheck.data?.stockInHand ?? 0;
    console.log(`Item 1 Stock after deletion: ${item1StockRestored} (Must match initial = ${item1InitialStock})`);
    if (item1StockRestored !== item1InitialStock) {
      throw new Error(`Stock restoration failed! Expected ${item1InitialStock}, got ${item1StockRestored}`);
    }
    console.log('✓ Stock restoration verified successfully!');

    console.log('\n========================================');
    console.log('🎉 ALL SALES INVOICE BACKEND TESTS PASSED!');
    console.log('========================================');
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    process.exit(1);
  }
}

runInvoiceTests();
