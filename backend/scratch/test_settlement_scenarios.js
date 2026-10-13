import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://localhost:5000/api';

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

function round2(val) {
  return Math.round((Number(val) || 0) * 100) / 100;
}

// Logic mirror from SettlementInvoice.jsx to test frontend calculation formula
function calculateSettlementFrontend(paymentAmount, outstandingBalanceBefore, previousAppliedPayments = 0) {
  const payAmt = round2(parseFloat(paymentAmount));
  if (isNaN(payAmt) || payAmt <= 0) {
    return { error: 'Invalid payment amount' };
  }
  const balanceBefore = round2(outstandingBalanceBefore);
  if (balanceBefore <= 0) {
    return {
      paymentAmount: payAmt,
      amountReceived: payAmt,
      amountApplied: 0,
      change: payAmt,
      balanceAfter: 0,
      totalPaid: previousAppliedPayments,
      status: 'PAID',
      alreadyPaid: true,
    };
  }
  const amountApplied = round2(Math.min(payAmt, balanceBefore));
  const change = round2(Math.max(0, round2(payAmt - amountApplied)));
  const balanceAfter = round2(Math.max(0, round2(balanceBefore - amountApplied)));
  const totalPaid = round2(previousAppliedPayments + amountApplied);
  const status = balanceAfter === 0 ? 'PAID' : (totalPaid > 0 ? 'PARTIALLY PAID' : 'UNPAID');

  return {
    paymentAmount: payAmt,
    amountReceived: payAmt,
    amountApplied,
    change,
    balanceAfter,
    totalPaid,
    status,
  };
}

async function runScenarioTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING SOFAST SETTLEMENT INVOICE PAYMENT CALCULATION TESTS');
  console.log('================================================================\n');

  let passedAll = true;

  try {
    // -------------------------------------------------------------------------
    // TEST A: Invoice Rs. 4,240; payment Rs. 5,000
    // Expected: Applied Rs. 4,240; change Rs. 760; balance Rs. 0; PAID
    // -------------------------------------------------------------------------
    console.log('--- TEST A: Invoice Rs. 4,240; Payment Rs. 5,000 ---');
    // Frontend formula check
    const calcA = calculateSettlementFrontend(5000, 4240, 0);
    console.log('Frontend calculation A:', calcA);
    if (
      calcA.amountApplied === 4240 &&
      calcA.change === 760 &&
      calcA.balanceAfter === 0 &&
      calcA.status === 'PAID'
    ) {
      console.log('✅ Frontend Formula Test A PASSED');
    } else {
      console.error('❌ Frontend Formula Test A FAILED:', calcA);
      passedAll = false;
    }

    // Backend End-to-End API check
    // Create test invoice for Test A
    const nextInvResA = await request(`${BASE_URL}/invoices/next-number`);
    const invNoA = nextInvResA.data.data.invoiceNumber;
    const createInvA = await request(`${BASE_URL}/invoices`, {
      method: 'POST',
      body: JSON.stringify({
        invoiceNumber: invNoA,
        date: new Date().toISOString().split('T')[0],
        customerCode: 'CUS-TEST-A',
        customerName: 'Test Customer A',
        lineItems: [
          {
            code: 'ITM-TEST-A',
            description: 'Item Test A',
            quantity: 1,
            price: 4240,
            value: 4240,
            total: 4240,
          },
        ],
        amountToPay: 4240,
        amountReceived: '', // Unpaid at creation
      }),
    });

    console.log(`Created Invoice A '${invNoA}': Due Amount = Rs. ${createInvA.data.data.dueAmount}`);

    // Post settlement: customer pays Rs. 5,000
    const settleResA = await request(`${BASE_URL}/settlements`, {
      method: 'POST',
      body: JSON.stringify({
        invoiceNumber: invNoA,
        amount: 4240, // applied amount
        received: 5000, // payment received
        method: 'Cash',
      }),
    });

    console.log('Settlement A Response:', settleResA.data.message);
    const settA = settleResA.data.data;
    const invAUpdated = settleResA.data.invoice;
    console.log(`Settlement A: Received = Rs. ${settA.received}, Applied = Rs. ${settA.amount}, Change = Rs. ${settA.change}`);
    console.log(`Invoice A After: Remaining Balance = Rs. ${invAUpdated.remainingBalance}, Total Paid = Rs. ${invAUpdated.totalPaid}, Status = ${invAUpdated.paymentStatus}`);

    if (
      settA.received === 5000 &&
      settA.amount === 4240 &&
      settA.change === 760 &&
      invAUpdated.remainingBalance === 0 &&
      invAUpdated.isSettled === true
    ) {
      console.log('✅ Backend API Scenario A PASSED\n');
    } else {
      console.error('❌ Backend API Scenario A FAILED');
      passedAll = false;
    }

    // Clean up Test A
    await request(`${BASE_URL}/settlements/${settA._id}`, { method: 'DELETE' });
    await request(`${BASE_URL}/invoices/${createInvA.data.data._id}`, { method: 'DELETE' });

    // -------------------------------------------------------------------------
    // TEST B & C: Invoice Rs. 4,500; Payment 1 = Rs. 3,000; Payment 2 = Rs. 1,500
    // Expected B: Applied Rs. 3,000; change Rs. 0; balance Rs. 1,500; PARTIALLY PAID
    // Expected C: Total applied Rs. 4,500; balance Rs. 0; PAID; both payments in history
    // -------------------------------------------------------------------------
    console.log('--- TEST B: Invoice Rs. 4,500; Payment 1 = Rs. 3,000 ---');
    const calcB = calculateSettlementFrontend(3000, 4500, 0);
    console.log('Frontend calculation B:', calcB);
    if (
      calcB.amountApplied === 3000 &&
      calcB.change === 0 &&
      calcB.balanceAfter === 1500 &&
      calcB.status === 'PARTIALLY PAID'
    ) {
      console.log('✅ Frontend Formula Test B PASSED');
    } else {
      console.error('❌ Frontend Formula Test B FAILED:', calcB);
      passedAll = false;
    }

    console.log('\n--- TEST C: Same Invoice Rs. 4,500; Payment 2 = Rs. 1,500 ---');
    const calcC = calculateSettlementFrontend(1500, 1500, 3000);
    console.log('Frontend calculation C:', calcC);
    if (
      calcC.amountApplied === 1500 &&
      calcC.change === 0 &&
      calcC.totalPaid === 4500 &&
      calcC.balanceAfter === 0 &&
      calcC.status === 'PAID'
    ) {
      console.log('✅ Frontend Formula Test C PASSED');
    } else {
      console.error('❌ Frontend Formula Test C FAILED:', calcC);
      passedAll = false;
    }

    // Backend End-to-End API check for B & C
    const nextInvResBC = await request(`${BASE_URL}/invoices/next-number`);
    const invNoBC = nextInvResBC.data.data.invoiceNumber;
    const createInvBC = await request(`${BASE_URL}/invoices`, {
      method: 'POST',
      body: JSON.stringify({
        invoiceNumber: invNoBC,
        date: new Date().toISOString().split('T')[0],
        customerCode: 'CUS-TEST-BC',
        customerName: 'Test Customer BC',
        lineItems: [
          {
            code: 'ITM-TEST-BC',
            description: 'Item Test BC',
            quantity: 1,
            price: 4500,
            value: 4500,
            total: 4500,
          },
        ],
        amountToPay: 4500,
        amountReceived: '',
      }),
    });

    console.log(`Created Invoice BC '${invNoBC}': Due Amount = Rs. ${createInvBC.data.data.dueAmount}`);

    // Payment 1: Rs. 3,000
    const settleResB = await request(`${BASE_URL}/settlements`, {
      method: 'POST',
      body: JSON.stringify({
        invoiceNumber: invNoBC,
        amount: 3000,
        received: 3000,
        method: 'Cash',
      }),
    });

    const settB = settleResB.data.data;
    const invBUpdated = settleResB.data.invoice;
    console.log(`Settlement B: Received = Rs. ${settB.received}, Applied = Rs. ${settB.amount}, Change = Rs. ${settB.change}`);
    console.log(`Invoice BC After Payment 1: Balance = Rs. ${invBUpdated.remainingBalance}, Total Paid = Rs. ${invBUpdated.totalPaid}, Status = ${invBUpdated.paymentStatus}`);

    if (
      settB.received === 3000 &&
      settB.amount === 3000 &&
      settB.change === 0 &&
      invBUpdated.remainingBalance === 1500 &&
      invBUpdated.paymentStatus === 'partial'
    ) {
      console.log('✅ Backend API Scenario B PASSED');
    } else {
      console.error('❌ Backend API Scenario B FAILED');
      passedAll = false;
    }

    // Payment 2: Rs. 1,500
    const settleResC = await request(`${BASE_URL}/settlements`, {
      method: 'POST',
      body: JSON.stringify({
        invoiceNumber: invNoBC,
        amount: 1500,
        received: 1500,
        method: 'Cash',
      }),
    });

    const settC = settleResC.data.data;
    const invCUpdated = settleResC.data.invoice;
    console.log(`Settlement C: Received = Rs. ${settC.received}, Applied = Rs. ${settC.amount}, Change = Rs. ${settC.change}`);
    console.log(`Invoice BC After Payment 2: Balance = Rs. ${invCUpdated.remainingBalance}, Total Paid = Rs. ${invCUpdated.totalPaid}, Status = ${invCUpdated.paymentStatus}`);

    // Verify both settlements exist in Settlement History
    const historyRes = await request(`${BASE_URL}/settlements/invoice/${invNoBC}`);
    console.log(`Settlement History for '${invNoBC}': ${historyRes.data.count} records preserved.`);
    historyRes.data.data.forEach((st, i) => {
      console.log(`  [#${i + 1}] Receipt: ${st.receiptNo} | Received: Rs. ${st.received} | Applied: Rs. ${st.amount} | Change: Rs. ${st.change}`);
    });

    if (
      settC.received === 1500 &&
      settC.amount === 1500 &&
      settC.change === 0 &&
      invCUpdated.remainingBalance === 0 &&
      invCUpdated.isSettled === true &&
      historyRes.data.count === 2
    ) {
      console.log('✅ Backend API Scenario C PASSED\n');
    } else {
      console.error('❌ Backend API Scenario C FAILED');
      passedAll = false;
    }

    // -------------------------------------------------------------------------
    // TEST D: Invoice already fully paid
    // Expected: Do not apply another payment to the invoice or allow negative balance
    // -------------------------------------------------------------------------
    console.log('--- TEST D: Invoice already fully paid (Attempting 3rd payment) ---');
    const calcD = calculateSettlementFrontend(1000, 0, 4500);
    console.log('Frontend calculation D (balance 0, pay 1000):', calcD);
    if (calcD.amountApplied === 0 && calcD.change === 1000 && calcD.balanceAfter === 0) {
      console.log('✅ Frontend Formula Test D PASSED');
    } else {
      console.error('❌ Frontend Formula Test D FAILED');
      passedAll = false;
    }

    // Backend API check: Attempt to pay against already fully paid invoice
    const settleResD = await request(`${BASE_URL}/settlements`, {
      method: 'POST',
      body: JSON.stringify({
        invoiceNumber: invNoBC,
        amount: 1000,
        received: 1000,
        method: 'Cash',
      }),
    });

    console.log('Backend response for payment on fully paid invoice:', settleResD.status, settleResD.data.message);
    if (!settleResD.ok && settleResD.status === 400 && settleResD.data.message.includes('already fully paid')) {
      console.log('✅ Backend API Scenario D PASSED (Properly rejected payment on fully paid invoice)\n');
    } else {
      console.error('❌ Backend API Scenario D FAILED');
      passedAll = false;
    }

    // Clean up Test B & C
    await request(`${BASE_URL}/settlements/${settB._id}`, { method: 'DELETE' });
    await request(`${BASE_URL}/settlements/${settC._id}`, { method: 'DELETE' });
    await request(`${BASE_URL}/invoices/${createInvBC.data.data._id}`, { method: 'DELETE' });

    // -------------------------------------------------------------------------
    // TEST E: Invalid, empty, zero, or negative payment
    // Expected: Show validation feedback and do not save a settlement
    // -------------------------------------------------------------------------
    console.log('--- TEST E: Invalid, empty, zero, or negative payment ---');
    const invalidInputs = ['', '0', '-500', 'abc'];
    for (const inp of invalidInputs) {
      const calcE = calculateSettlementFrontend(inp, 4240, 0);
      if (calcE.error) {
        console.log(`✅ Frontend validation rejected '${inp}' successfully`);
      } else {
        console.error(`❌ Frontend validation failed for '${inp}'`);
        passedAll = false;
      }

      // Backend API validation
      const settleResE = await request(`${BASE_URL}/settlements`, {
        method: 'POST',
        body: JSON.stringify({
          invoiceNumber: '47615',
          amount: inp,
          received: inp,
          method: 'Cash',
        }),
      });

      if (!settleResE.ok && settleResE.status === 400) {
        console.log(`✅ Backend rejected invalid payment '${inp}' with 400: ${settleResE.data.message}`);
      } else {
        console.error(`❌ Backend failed to reject invalid payment '${inp}'`);
        passedAll = false;
      }
    }

    console.log('\n================================================================');
    if (passedAll) {
      console.log('🎉 ALL 5 SCENARIOS (A, B, C, D, E) PASSED 100% SUCCESSFULLY!');
    } else {
      console.log('⚠️ SOME SCENARIOS FAILED!');
    }
    console.log('================================================================');
  } catch (err) {
    console.error('Error during test execution:', err);
  }
}

runScenarioTests();
