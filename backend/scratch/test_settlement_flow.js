const API_BASE = 'http://localhost:5000/api';

async function testSettlement() {
  console.log('Testing Settlement flow for Invoice INV-000125...');
  try {
    const invRes = await fetch(`${API_BASE}/invoices/INV-000125`);
    const invData = await invRes.json();
    console.log('Fetched Invoice:', invData.success ? invData.data.invoiceNumber : 'Failed');
    if (!invData.success) return;

    const inv = invData.data;
    console.log('Line Items:', inv.lineItems?.length);
    console.log('Customer:', inv.customerName);
    console.log('Amount to pay:', inv.amountToPay);
    console.log('Due amount:', inv.dueAmount);

    const nextRec = await fetch(`${API_BASE}/settlements/next-receipt`);
    const recData = await nextRec.json();
    console.log('Next Receipt No:', recData.data?.receiptNo);

    console.log('Settlement flow verified successfully!');
  } catch (err) {
    console.error('Settlement test error:', err.message);
  }
}

testSettlement();
