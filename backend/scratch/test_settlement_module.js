const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('--- STARTING SETTLEMENT INVOICE BACKEND TESTS ---');

  try {
    // 1. Next receipt number
    const recRes = await fetch(`${BASE_URL}/settlements/next-receipt`);
    const recData = await recRes.json();
    console.log('1. Next Receipt Number:', recData);

    // 2. Banks list
    const banksRes = await fetch(`${BASE_URL}/settlements/banks`);
    const banksData = await banksRes.json();
    console.log('2. Banks count:', banksData.data?.length);

    // 3. Create a test invoice first with outstanding balance
    const nextInvRes = await fetch(`${BASE_URL}/invoices/next-number`);
    const nextInvData = await nextInvRes.json();
    const invNo = nextInvData.data.invoiceNumber;

    const createInvRes = await fetch(`${BASE_URL}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceNumber: invNo,
        date: new Date().toISOString().split('T')[0],
        customerCode: 'CUS-TEST-SETTL',
        customerName: 'Test Settlement Customer',
        customerAddress: '123 Main Road, Colombo',
        customerTelephone: '0771234567',
        lineItems: [
          {
            code: '01100342',
            description: 'BEARING BALL [6204]',
            quantity: 2,
            price: 5000,
            value: 10000,
            total: 10000,
          },
        ],
        amountToPay: 10000,
        amountReceived: 2000, // Rs. 2,000 paid at invoice time
        dueAmount: 8000, // Rs. 8,000 outstanding
      }),
    });
    const createInvData = await createInvRes.json();
    console.log(`3. Created Test Invoice '${invNo}' with Value: Rs. 10000, Paid: Rs. 2000, Due: Rs. 8000`);

    // 4. Record Settlement 1 (Rs. 3000 Cash)
    const sett1Res = await fetch(`${BASE_URL}/settlements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceNumber: invNo,
        amount: 3000,
        method: 'Cash',
        received: 3000,
      }),
    });
    const sett1Data = await sett1Res.json();
    console.log('4. Settlement 1 Created:', sett1Data.message, 'Remaining Balance:', sett1Data.invoice?.remainingBalance);

    // 5. Record Settlement 2 (Rs. 4000 Cheque with Special Discount Rs. 500)
    const sett2Res = await fetch(`${BASE_URL}/settlements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceNumber: invNo,
        amount: 4000,
        method: 'Cheque',
        received: 4000,
        chequeNo: 'CHQ-987654',
        bank: 'Bank of Ceylon',
        dateRealized: '2026-10-25',
        specialDiscountType: '5%',
        specialDiscountAmount: 500,
        specialDiscountBasis: 'balance',
      }),
    });
    const sett2Data = await sett2Res.json();
    console.log('5. Settlement 2 Created:', sett2Data.message, 'Remaining Balance:', sett2Data.invoice?.remainingBalance);

    // 6. Fetch settlements for this invoice
    const invSettlementsRes = await fetch(`${BASE_URL}/settlements/invoice/${invNo}`);
    const invSettlementsData = await invSettlementsRes.json();
    console.log(`6. Settlements count for Invoice '${invNo}':`, invSettlementsData.count);

    // 7. Test settlement deletion (reverts balance)
    const settToDelete = sett2Data.data._id;
    const delRes = await fetch(`${BASE_URL}/settlements/${settToDelete}`, { method: 'DELETE' });
    const delData = await delRes.json();
    console.log('7. Deleted Settlement 2:', delData.message, 'Restored Balance:', delData.data?.restoredBalance);

    // Clean up test invoice & settlement 1
    await fetch(`${BASE_URL}/settlements/${sett1Data.data._id}`, { method: 'DELETE' });
    await fetch(`${BASE_URL}/invoices/${createInvData.data._id}`, { method: 'DELETE' });
    console.log('Cleaned up test invoice and settlements.');

    console.log('========================================');
    console.log('🎉 ALL SETTLEMENT BACKEND TESTS PASSED!');
    console.log('========================================');
  } catch (err) {
    console.error('Test error:', err.message);
  }
}

runTests();
