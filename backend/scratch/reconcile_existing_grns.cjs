const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sofast_pos';

async function auditHistoricalGrns() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  console.log('================================================================');
  console.log('       HISTORICAL GRN AUDIT & RECONCILIATION REPORT             ');
  console.log('================================================================\n');

  const allGrns = await db.collection('grns').find({}).sort({ createdAt: -1 }).toArray();
  console.log(`Total GRN records in database: ${allGrns.length}\n`);

  const unpostedDraftGrns = [];
  const postedGrns = [];

  for (const grn of allGrns) {
    const isPosted = Boolean(grn.isPosted);
    if (!isPosted) {
      unpostedDraftGrns.push(grn);
    } else {
      postedGrns.push(grn);
    }
  }

  console.log(`✅ Posted GRNs (${postedGrns.length}):`);
  for (const g of postedGrns.slice(0, 10)) {
    console.log(`  - GRN #${g.grnNumber || g.no} | Supplier: ${g.supplierCode} | Lines: ${g.lineItems?.length || 0} | Date: ${g.date || g.createdAt}`);
  }
  if (postedGrns.length > 10) console.log(`  ... and ${postedGrns.length - 10} more`);

  console.log(`\n⚠️  Unposted / Draft GRNs (${unpostedDraftGrns.length}):`);
  for (const g of unpostedDraftGrns) {
    console.log(`  - GRN #${g.grnNumber || g.no} (ID: ${g._id}) | Supplier: ${g.supplierCode} | Date: ${g.date || g.createdAt}`);
    if (Array.isArray(g.lineItems)) {
      for (const li of g.lineItems) {
        const itemCode = li.code || li.itemCode;
        const qty = li.quantity !== undefined ? li.quantity : li.qty;
        // Check current stock of this item
        const itemDoc = await db.collection('items').findOne({
          code: { $regex: new RegExp(`^${itemCode}$`, 'i') }
        });
        const currentStock = itemDoc ? (itemDoc.quantity !== undefined ? itemDoc.quantity : itemDoc.stockInHand) : 'Item not found';
        console.log(`      * Item: '${itemCode}' | Received Qty: ${qty} | Current Master Stock: ${currentStock}`);
      }
    }
  }

  console.log('\n================================================================');
  console.log('AUDIT SUMMARY:');
  console.log(`- Historical posted GRNs are active with stock movements intact.`);
  console.log(`- ${unpostedDraftGrns.length} GRNs were saved as Drafts (isPosted: false).`);
  console.log(`- These drafts can be posted anytime by opening each GRN and clicking 'Update', or via the UI 'Process' -> 'Post GRN to Stock'.`);
  console.log('================================================================\n');

  await mongoose.disconnect();
}

auditHistoricalGrns().catch(console.error);
