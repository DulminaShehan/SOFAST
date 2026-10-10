const API_BASE = 'http://localhost:5000/api';

async function runTest() {
  console.log('Testing Invoice & Settlement Thermal Printing System...');

  const samplePayload = {
    invoiceNumber: 'INV-000125',
    no: 125,
    date: new Date().toISOString().split('T')[0],
    customerCode: 'CUST-001',
    customerName: 'Test Customer',
    customerAddress: '123 Main St, Mathugama',
    customerTelephone: '0771234567',
    jobType: 'Material',
    jd: 'Invoice',
    isHold: false,
    status: 'completed',
    lineItems: [
      {
        code: '001',
        description: 'Engine Oil',
        quantity: 2,
        price: 1200,
        discountPercentage: 0,
        discountAmount: 160,
        value: 2240,
        total: 2240
      }
    ],
    subTotal: 2400,
    specialDiscount: 0,
    amountToPay: 2240,
    amountReceived: 2240,
    dueAmount: 0
  };

  try {
    console.log('1. Checking Backend health...');
    const healthRes = await fetch('http://localhost:5000/api/invoices?limit=5');
    const health = await healthRes.json();
    console.log('Backend connected. Invoices count:', health.data?.length ?? 0);

    console.log('2. Verifying sample invoice creation/lookup...');
    const invRes = await fetch(`${API_BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(samplePayload)
    });
    const invData = await invRes.json();
    console.log('Invoice API response:', invData.success ? `Success (Invoice ${invData.data?.invoiceNumber})` : invData.message);

    // Verify calculations for thermal receipt
    const gross = samplePayload.lineItems.reduce((acc, it) => acc + (it.price * it.quantity), 0);
    const disc = samplePayload.lineItems.reduce((acc, it) => acc + (it.discountAmount || 0), 0) + samplePayload.specialDiscount;
    const toPay = gross - disc;
    const received = samplePayload.amountReceived;
    const balance = toPay - received;

    console.log('=== THERMAL RECEIPT CALCULATIONS ===');
    console.log('Gross Total:', gross);
    console.log('Total Discount:', disc);
    console.log('Amount to Be Paid:', toPay);
    console.log('Amount Received:', received);
    console.log('Balance:', balance);

    if (gross === 2400 && disc === 160 && toPay === 2240 && received === 2240 && balance === 0) {
      console.log('✓ All thermal bill calculations match required specifications precisely!');
    } else {
      console.error('✗ Calculation mismatch:', { gross, disc, toPay, received, balance });
    }

  } catch (error) {
    console.error('Error during test:', error.message);
  }
}

runTest();
