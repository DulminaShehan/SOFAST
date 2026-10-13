import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Invoice from '../src/models/Invoice.js';
import Item from '../src/models/Item.js';
import CustomerDamageReturn from '../src/models/CustomerDamageReturn.js';
import Grn from '../src/models/Grn.js';
import Supplier from '../src/models/Supplier.js';
import Customer from '../src/models/Customer.js';

dotenv.config();

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('================================================================');
  console.log('🧪 SOFAST DAMAGE CLAIM COMPREHENSIVE VERIFICATION SUITE');
  console.log('================================================================');

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sofast_pos');
  console.log('Connected to MongoDB');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // Setup test items
    const testItemA_Code = 'DC-TEST-ITEM-01';
    const testItemB_Code = 'DC-TEST-ITEM-02';
    const testSupplierCode = 'DC-SUPP-01';

    await Item.deleteMany({ code: { $in: [testItemA_Code, testItemB_Code] } });
    await Supplier.deleteMany({ code: testSupplierCode });

    const supp = await Supplier.create({
      code: testSupplierCode,
      name: 'ABC Auto Parts (Pvt) Ltd',
      telephone: '011 234 5678',
      address: '123 High Street, Colombo',
    });

    const itemA = await Item.create({
      code: testItemA_Code,
      description: 'Brake Pad Front',
      quantity: 50,
      stockInHand: 50,
      damagedStock: 0,
      sellingPrice: 1250.00,
      finalSellingPrice: 1250.00,
      itemCost: 1000.00,
      suppCode: testSupplierCode,
    });

    const itemB = await Item.create({
      code: testItemB_Code,
      description: 'Brake Pad Front Ceramic High-Performance',
      quantity: 30,
      stockInHand: 30,
      damagedStock: 0,
      sellingPrice: 1800.00,
      finalSellingPrice: 1800.00,
      itemCost: 1400.00,
      suppCode: testSupplierCode,
    });

    // Create a GRN for Item A to verify traceability
    const testGrnNo = 'GRN-2025-0087';
    await Grn.deleteMany({ grnNumber: testGrnNo });
    await Grn.create({
      grnNumber: testGrnNo,
      no: 87,
      date: new Date('2025-09-15'),
      supplierCode: testSupplierCode,
      supplierName: supp.name,
      supplierInvoiceNo: 'SUP-2025-0045',
      lineItems: [
        {
          code: testItemA_Code,
          itemCode: testItemA_Code,
          description: itemA.description,
          quantity: 20,
          qty: 20,
          unitPrice: 1000.00,
          rate: 1000.00,
        },
      ],
    });

    // Setup a Test Invoice
    const testInvNo = 'INV-2025-00125';
    await Invoice.deleteMany({ invoiceNumber: testInvNo });
    await CustomerDamageReturn.deleteMany({ invoiceNumber: testInvNo });

    const invoice = await Invoice.create({
      invoiceNumber: testInvNo,
      no: 125,
      date: new Date('2025-10-12'),
      customerCode: 'CUS-001',
      customerName: 'Saman Perera',
      customerTelephone: '077 123 4567',
      customerAddress: 'Kandy Road, Kadawatha',
      paymentMethod: 'CASH',
      status: 'PAID',
      netTotal: 5000.00,
      lineItems: [
        {
          code: testItemA_Code,
          itemCode: testItemA_Code,
          description: itemA.description,
          quantity: 4,
          price: 1250.00,
          total: 5000.00,
        },
      ],
    });

    console.log('\n--- TEST 1: Invoice Search Loads Real Invoice, Customer & Items ---');
    const invRes = await fetch(`${BASE_URL}/damage-claims/invoice/${testInvNo}`).then(r => r.json());
    assert(invRes.success === true, 'Invoice search endpoint returned success');
    assert(invRes.data?.invoice?.invoiceNumber === testInvNo, `Loaded invoice #${testInvNo}`);
    assert(invRes.data?.invoice?.customer?.name === 'Saman Perera', 'Customer name is Saman Perera');
    assert(invRes.data?.invoice?.customer?.telephone === '077 123 4567', 'Customer phone is 077 123 4567');
    assert(invRes.data?.lineItems?.length === 1, 'Found 1 line item on invoice');
    assert(invRes.data?.lineItems[0]?.availableReturnQuantity === 4, 'Initial returnable quantity is 4');

    console.log('\n--- TEST 2: Supplier Traceability from GRN & Purchase History ---');
    const traceRes = await fetch(`${BASE_URL}/damage-claims/traceability/${testItemA_Code}`).then(r => r.json());
    assert(traceRes.success === true, 'Traceability endpoint returned success');
    assert(traceRes.data?.suggestedSupplier?.supplierName === 'ABC Auto Parts (Pvt) Ltd', 'Traced correct supplier name');
    assert(traceRes.data?.suggestedSupplier?.grnNumber === testGrnNo, 'Traced correct GRN #');
    assert(traceRes.data?.suggestedSupplier?.supplierInvoiceNo === 'SUP-2025-0045', 'Traced correct Supplier Invoice #');
    assert(traceRes.data?.purchaseHistory?.length >= 1, 'Found matching purchase history records');

    console.log('\n--- TEST 3: Next Damage Claim Number (DC-YYYY-XXXX) ---');
    const claimNoRes = await fetch(`${BASE_URL}/damage-claims/next-claim-number`).then(r => r.json());
    assert(claimNoRes.success === true, 'Claim number endpoint returned success');
    assert(/^DC-\d{4}-\d{4}$/.test(claimNoRes.data?.claimNumber), `Generated sequential claim number: ${claimNoRes.data?.claimNumber}`);

    const generatedClaimNo = claimNoRes.data?.claimNumber;

    console.log('\n--- TEST 4: Stock Rules — Damage (Defective Item) ---');
    // Pre-claim stock check
    const preItemA = await Item.findOne({ code: testItemA_Code }).lean();
    assert(preItemA.quantity === 50 && preItemA.damagedStock === 0, 'Pre-claim: Sellable 50, Damaged 0');

    // Create a Damage Claim for 1 defective item
    const damageClaimPayload = {
      claimNumber: generatedClaimNo,
      claimDate: '2025-10-12',
      invoiceNumber: testInvNo,
      itemCode: testItemA_Code,
      returnedQuantity: 1,
      returnType: 'DAMAGE',
      damageReason: 'Broken',
      notes: 'Customer returned with broken part.',
      supplierDetails: {
        supplierName: 'ABC Auto Parts (Pvt) Ltd',
        supplierTelephone: '011 234 5678',
        supplierInvoiceNo: 'SUP-2025-0045',
        grnNumber: testGrnNo,
        purchaseDate: '2025-09-15',
        purchaseQuantity: 20,
        claimStatus: 'Claim to Supplier',
        supplierNotes: 'Will send replacement.',
      },
    };

    const damageRes = await fetch(`${BASE_URL}/damage-claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(damageClaimPayload),
    }).then(r => r.json());

    assert(damageRes.success === true, 'Damage claim saved successfully');

    // Post-claim stock check
    const postDamageItemA = await Item.findOne({ code: testItemA_Code }).lean();
    assert(postDamageItemA.quantity === 50, 'Sellable stock UNCHANGED (never added to sellable stock)');
    assert(postDamageItemA.damagedStock === 1, 'Damaged quarantined stock incremented to 1 exactly once');

    console.log('\n--- TEST 5: Return Limits Enforced (Cannot exceed returnable qty) ---');
    // Original was 4, 1 returned. Remaining returnable is 3.
    const excessPayload = {
      claimNumber: 'DC-2025-9999',
      invoiceNumber: testInvNo,
      itemCode: testItemA_Code,
      returnedQuantity: 5, // Exceeds remaining 3
      returnType: 'DAMAGE',
      damageReason: 'Defective',
    };

    const excessRes = await fetch(`${BASE_URL}/damage-claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(excessPayload),
    }).then(r => r.json());

    assert(excessRes.success === false, 'Blocked return quantity exceeding allowable returnable qty');

    console.log('\n--- TEST 6: Duplicate Save Prevention ---');
    // Submitting the identical claim number again must fail and NOT alter stock
    const dupRes = await fetch(`${BASE_URL}/damage-claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(damageClaimPayload),
    }).then(r => r.json());

    assert(dupRes.success === false, 'Duplicate claim number rejected with error');
    const dupCheckItemA = await Item.findOne({ code: testItemA_Code }).lean();
    assert(dupCheckItemA.damagedStock === 1, 'Damaged stock remained 1 (no duplicate stock movements)');

    console.log('\n--- TEST 7: Stock Rules — Exchange (Good Item) ---');
    // For exchange: return 1 of Item A (good condition), take 1 of Item B as replacement.
    // Item A sellable should increase by 1 (50 -> 51)
    // Item B sellable should decrease by 1 (30 -> 29)
    const exchClaimNo = 'DC-2025-0009';
    const exchPayload = {
      claimNumber: exchClaimNo,
      claimDate: '2025-10-12',
      invoiceNumber: testInvNo,
      itemCode: testItemA_Code,
      returnedQuantity: 1,
      returnType: 'EXCHANGE',
      damageReason: 'Exchange — item is in good condition',
      notes: 'Customer exchanged for ceramic brake pad',
      replacement: {
        itemCode: testItemB_Code,
        quantity: 1,
        unitPrice: 1800.00,
      },
    };

    const exchRes = await fetch(`${BASE_URL}/damage-claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(exchPayload),
    }).then(r => r.json());

    assert(exchRes.success === true, 'Exchange claim saved successfully');

    const postExchItemA = await Item.findOne({ code: testItemA_Code }).lean();
    const postExchItemB = await Item.findOne({ code: testItemB_Code }).lean();

    assert(postExchItemA.quantity === 51, 'Returned good item added back to sellable stock (50 -> 51)');
    assert(postExchItemB.quantity === 29, 'Replacement item deducted from sellable stock (30 -> 29)');
    assert(postExchItemA.damagedStock === 1, 'Damaged stock remains unchanged');

    console.log('\n--- TEST 8: Update Claim Details & Notes ---');
    const updateRes = await fetch(`${BASE_URL}/damage-claims/${encodeURIComponent(generatedClaimNo)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claimStatus: 'Replacement Approved',
        supplierNotes: 'Supplier approved replacement via credit note CN-402',
      }),
    }).then(r => r.json());

    assert(updateRes.success === true, 'Updated existing claim successfully');
    const updatedClaimDoc = await CustomerDamageReturn.findOne({ claimNumber: generatedClaimNo }).lean();
    assert(updatedClaimDoc.supplierClaim?.claimStatus === 'Replacement Approved', 'Claim status updated');
    assert(updatedClaimDoc.supplierClaim?.notes === 'Supplier approved replacement via credit note CN-402', 'Supplier notes updated');

    console.log('\n--- TEST 9: Receiving Physical Replacement from Supplier ---');
    // When replacement arrives from supplier, accept it into sellable stock and release quarantine
    const replaceRecRes = await fetch(`${BASE_URL}/damage-claims/${encodeURIComponent(generatedClaimNo)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claimStatus: 'Replaced',
        replacementReceived: {
          received: true,
          quantityReceived: 1,
          replacementItemCode: testItemA_Code,
          deliveryNoteNo: 'DO-9921',
        },
      }),
    }).then(r => r.json());

    assert(replaceRecRes.success === true, 'Supplier replacement processed successfully');
    const finalItemA = await Item.findOne({ code: testItemA_Code }).lean();
    assert(finalItemA.quantity === 52, 'Replacement physically received added to sellable stock (51 -> 52)');
    assert(finalItemA.damagedStock === 0, 'Quarantined damaged stock released (1 -> 0)');

    console.log('\n--- TEST 10: Existing POS Modules Continue to Function ---');
    const getItemsRes = await fetch(`${BASE_URL}/items?limit=5`).then(r => r.json());
    assert(getItemsRes.success === true, 'Item Master API operational');

    const getSuppsRes = await fetch(`${BASE_URL}/suppliers?limit=5`).then(r => r.json());
    assert(getSuppsRes.success === true, 'Supplier Master API operational');

    const getGrnRes = await fetch(`${BASE_URL}/grn?limit=5`).then(r => r.json());
    assert(getGrnRes.success === true, 'GRN API operational');

    const getInvoicesRes = await fetch(`${BASE_URL}/invoices?limit=5`).then(r => r.json());
    assert(getInvoicesRes.success === true, 'Invoice API operational');

    const getSettlementsRes = await fetch(`${BASE_URL}/settlements?limit=5`).then(r => r.json());
    assert(getSettlementsRes.success === true, 'Settlement API operational');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    await mongoose.disconnect();
    console.log('\n================================================================');
    console.log(`🏁 RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('================================================================\n');
  }
}

runTests();
