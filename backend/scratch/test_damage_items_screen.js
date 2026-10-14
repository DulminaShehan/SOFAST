import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const API_BASE = 'http://localhost:5000/api';

async function runTests() {
  console.log('--- STARTING DAMAGE ITEMS SCREEN VERIFICATION ---');

  // Connect to DB directly to check stock baseline
  const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://admin:admin123@cluster0.ecu9tpg.mongodb.net/sofast_pos?retryWrites=true&w=majority';
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB directly for baseline audit');

  const itemsColl = mongoose.connection.db.collection('items');
  const initialItemsSnapshot = await itemsColl.find({}, { projection: { code: 1, quantity: 1, stockInHand: 1, damagedStock: 1 } }).toArray();
  console.log(`Found ${initialItemsSnapshot.length} inventory items in baseline snapshot.`);

  // 1. Test GET /api/damage-items
  console.log('\n[1] Testing GET /api/damage-items...');
  const resAll = await fetch(`${API_BASE}/damage-items`).then(r => r.json());
  if (!resAll.success || !Array.isArray(resAll.data)) {
    throw new Error('Failed to fetch /api/damage-items: ' + JSON.stringify(resAll));
  }
  console.log(`✅ Success! Retrieved ${resAll.data.length} damaged item records. Total in DB: ${resAll.pagination.total}`);

  if (resAll.data.length > 0) {
    const first = resAll.data[0];
    console.log('Record Sample:');
    console.log(`  - Claim Number: ${first.claimNumber}`);
    console.log(`  - Claim Date: ${first.claimDate}`);
    console.log(`  - Invoice Number: ${first.invoiceNumber}`);
    console.log(`  - Item Code: ${first.itemCode}`);
    console.log(`  - Item Description: ${first.itemDescription}`);
    console.log(`  - Damaged Qty: ${first.damagedQuantity}`);
    console.log(`  - Damage Reason: ${first.damageReason}`);
    console.log(`  - Supplier Name: ${first.supplierName}`);
    console.log(`  - Supplier Inv No: ${first.supplierInvoiceNo}`);
    console.log(`  - GRN Number: ${first.grnNumber}`);
    console.log(`  - Claim Status: ${first.claimStatus}`);

    // Verify all 11 required fields exist on the object
    const requiredFields = [
      'claimNumber', 'claimDate', 'invoiceNumber', 'itemCode',
      'itemDescription', 'damagedQuantity', 'damageReason',
      'supplierName', 'supplierInvoiceNo', 'grnNumber', 'claimStatus'
    ];
    for (const f of requiredFields) {
      if (first[f] === undefined) {
        throw new Error(`Field '${f}' is missing from damage item record!`);
      }
    }
    console.log('✅ All 11 required fields verified present on records.');

    // 2. Test Claim Number Filter
    console.log('\n[2] Testing Claim Number filter...');
    const claimNum = first.claimNumber;
    const resClaimFilter = await fetch(`${API_BASE}/damage-items?claimNumber=${encodeURIComponent(claimNum)}`).then(r => r.json());
    console.log(`✅ Filtered by claimNumber '${claimNum}': found ${resClaimFilter.data.length} records.`);
    if (!resClaimFilter.data.some(r => r.claimNumber === claimNum)) {
      throw new Error(`Expected record with claimNumber ${claimNum} in filtered results!`);
    }

    // 3. Test Invoice Number Filter
    if (first.invoiceNumber) {
      console.log('\n[3] Testing Invoice Number filter...');
      const invNum = first.invoiceNumber;
      const resInvFilter = await fetch(`${API_BASE}/damage-items?invoiceNumber=${encodeURIComponent(invNum)}`).then(r => r.json());
      console.log(`✅ Filtered by invoiceNumber '${invNum}': found ${resInvFilter.data.length} records.`);
      if (!resInvFilter.data.every(r => r.invoiceNumber.toLowerCase().includes(invNum.toLowerCase()))) {
        throw new Error(`Invoice filter returned mismatched record!`);
      }
    }

    // 4. Test Item Code Filter
    if (first.itemCode) {
      console.log('\n[4] Testing Item Code filter...');
      const itemCode = first.itemCode;
      const resItemFilter = await fetch(`${API_BASE}/damage-items?itemCode=${encodeURIComponent(itemCode)}`).then(r => r.json());
      console.log(`✅ Filtered by itemCode '${itemCode}': found ${resItemFilter.data.length} records.`);
      if (!resItemFilter.data.every(r => r.itemCode.toLowerCase().includes(itemCode.toLowerCase()) || r.itemDescription.toLowerCase().includes(itemCode.toLowerCase()))) {
        throw new Error(`Item filter returned mismatched record!`);
      }
    }

    // 5. Test Supplier Filter
    if (first.supplierName && first.supplierName !== 'N/A') {
      console.log('\n[5] Testing Supplier filter...');
      const supp = first.supplierName.split(' ')[0];
      const resSuppFilter = await fetch(`${API_BASE}/damage-items?supplier=${encodeURIComponent(supp)}`).then(r => r.json());
      console.log(`✅ Filtered by supplier '${supp}': found ${resSuppFilter.data.length} records.`);
    }

    // 6. Test Status Filter
    console.log('\n[6] Testing Claim Status filter...');
    const resStatusFilter = await fetch(`${API_BASE}/damage-items?claimStatus=${encodeURIComponent(first.claimStatus)}`).then(r => r.json());
    console.log(`✅ Filtered by status '${first.claimStatus}': found ${resStatusFilter.data.length} records.`);
  }

  // 7. Verify Read-Only Stock Integrity
  console.log('\n[7] Verifying Stock Read-Only Integrity...');
  const afterItemsSnapshot = await itemsColl.find({}, { projection: { code: 1, quantity: 1, stockInHand: 1, damagedStock: 1 } }).toArray();
  if (initialItemsSnapshot.length !== afterItemsSnapshot.length) {
    throw new Error('Item count changed during read-only operation!');
  }

  for (let i = 0; i < initialItemsSnapshot.length; i++) {
    const b = initialItemsSnapshot[i];
    const a = afterItemsSnapshot[i];
    if (b.quantity !== a.quantity || b.stockInHand !== a.stockInHand || b.damagedStock !== a.damagedStock) {
      throw new Error(`Item ${b.code} stock balance was modified! Before: qty=${b.quantity}, After: qty=${a.quantity}`);
    }
  }
  console.log('✅ Stock integrity confirmed: 0 stock items or balances were modified.');

  await mongoose.disconnect();
  console.log('\n🎉 ALL DAMAGE ITEMS VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
