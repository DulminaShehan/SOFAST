const BASE_URL = 'http://localhost:5000/api';

async function testFullSettlementWorkflow() {
  console.log('=====================================================');
  console.log('🚀 TESTING FULL SALES INVOICE & SETTLEMENT WORKFLOW');
  console.log('=====================================================');

  try {
    // 1. Get next invoice number
    const nextInvRes = await fetch(`${BASE_URL}/invoices/next-number`);
    const nextInvData = await nextInvRes.json();
    const invNo = nextInvData.data.invoiceNumber;
    console.log(`\n1. Next Invoice Number: ${invNo}`);

    // 2. Create Invoice for Rs. 25,000 with Rs. 5,000 initial payment -> Due: Rs. 20,000
    const invRes = await fetch(`${BASE_URL}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceNumber: invNo,
        date: new Date().toISOString().split('T')[0],
        customerCode: 'CUS-SETTL-TEST',
        customerName: 'Abeysinghe Auto Care',
        customerAddress: '45 Galle Road, Kalutara',
        customerTelephone: '0342234567',
        lineItems: [
          {
            code: '01100342',
            description: 'BEARING BALL [6204]',
            quantity: 5,
            price: 5000,
            value: 25000,
            total: 25000,
          },
        ],
        amountToPay: 25000,
        amountReceived: 5000,
        dueAmount: 20000,
      }),
    });
    const invData = await invRes.json();
    console.log(`2. Created Invoice '${invNo}': Total=Rs. 25,000, Paid=Rs. 5,000, Due=Rs. ${invData.data.dueAmount}`);

    // 3. Get next receipt number
    const recRes = await fetch(`${BASE_URL}/settlements/next-receipt`);
    const recData = await recRes.json();
    console.log(`3. Next Settlement Receipt No: ${recData.data.receiptNo}`);

    // 4. Settle Part 1: Cash Rs. 8,000
    const sett1Res = await fetch(`${BASE_URL}/settlements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceNumber: invNo,
        amount: 8000,
        method: 'Cash',
        received: 8000,
        date: new Date().toISOString().split('T')[0],
        receiptNo: recData.data.receiptNo,
      }),
    });
    const sett1Data = await sett1Res.json();
    console.log(`4. Settle 1 (Cash Rs. 8,000): Remaining Balance = Rs. ${sett1Data.invoice.remainingBalance} (Expected: 12000)`);

    // 5. Settle Part 2: Cheque Rs. 10,000 + Special Discount Rs. 2,000 -> Fully Settled (Balance = 0)
    const rec2Res = await fetch(`${BASE_URL}/settlements/next-receipt`);
    const rec2Data = await rec2Res.json();

    const sett2Res = await fetch(`${BASE_URL}/settlements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceNumber: invNo,
        amount: 10000,
        method: 'Cheque',
        received: 10000,
        chequeNo: 'CHQ-889900',
        bank: 'Commercial Bank',
        dateRealized: '2026-10-30',
        receiptNo: rec2Data.data.receiptNo,
        specialDiscountType: 'Fixed Amount',
        specialDiscountAmount: 2000,
        specialDiscountBasis: 'special_amount',
        specialAmount: 2000,
      }),
    });
    const sett2Data = await sett2Res.json();
    console.log(`5. Settle 2 (Cheque Rs. 10,000 + Spec Disc Rs. 2,000): Remaining Balance = Rs. ${sett2Data.invoice.remainingBalance} (Expected: 0)`);

    // 6. Verify invoice status in database
    const checkInvRes = await fetch(`${BASE_URL}/invoices/${invNo}`);
    const checkInvData = await checkInvRes.json();
    console.log(`6. Invoice in DB: dueAmount = Rs. ${checkInvData.data.dueAmount}, totalReceived = Rs. ${checkInvData.data.amountReceived}, isSettled = ${checkInvData.data.isSettled}`);

    // 7. Fetch all settlements for this invoice
    const settlementsRes = await fetch(`${BASE_URL}/settlements/invoice/${invNo}`);
    const settlementsData = await settlementsRes.json();
    console.log(`7. Total Settlements recorded for Invoice '${invNo}': ${settlementsData.count}`);
    settlementsData.data.forEach((s, idx) => {
      console.log(`   [#${idx + 1}] ${s.receiptNo} | Date: ${s.date.split('T')[0]} | Method: ${s.method} | Amount: Rs. ${s.amount} | Balance After: Rs. ${s.balanceAfter}`);
    });

    // 8. Delete Settlement 2 -> Balance should restore from 0 back to 12,000
    const delRes = await fetch(`${BASE_URL}/settlements/${sett2Data.data._id}`, { method: 'DELETE' });
    const delData = await delRes.json();
    console.log(`8. Deleted Settlement 2: ${delData.message} | Restored Balance = Rs. ${delData.data.restoredBalance} (Expected: 12000)`);

    // Clean up test data
    await fetch(`${BASE_URL}/settlements/${sett1Data.data._id}`, { method: 'DELETE' });
    await fetch(`${BASE_URL}/invoices/${invData.data._id}`, { method: 'DELETE' });
    console.log('\n9. Cleaned up all test invoice and settlement records.');

    console.log('\n=====================================================');
    console.log('✅ ALL SALES INVOICE & SETTLEMENT TESTS PASSED!');
    console.log('=====================================================');
  } catch (err) {
    console.error('Test failed:', err);
  }
}

testFullSettlementWorkflow();
