import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sofast_pos';

async function check() {
  await mongoose.connect(uri);
  const db = mongoose.connection;
  const invCount = await db.collection('invoices').countDocuments();
  const grnCount = await db.collection('grns').countDocuments();
  const itemCount = await db.collection('items').countDocuments();
  const suppCount = await db.collection('suppliers').countDocuments();
  console.log('Counts:', { invCount, grnCount, itemCount, suppCount });

  const sampleInv = await db.collection('invoices').findOne({ 'lineItems.0': { $exists: true } });
  if (sampleInv) {
    console.log('Sample Invoice:', {
      invoiceNumber: sampleInv.invoiceNumber,
      no: sampleInv.no,
      date: sampleInv.date,
      customerName: sampleInv.customerName,
      customerTelephone: sampleInv.customerTelephone,
      items: sampleInv.lineItems.map(l => ({ code: l.code, itemCode: l.itemCode, desc: l.description, qty: l.quantity, price: l.price }))
    });
  }

  const sampleGrn = await db.collection('grns').findOne({ 'lineItems.0': { $exists: true } });
  if (sampleGrn) {
    console.log('Sample GRN:', {
      grnNumber: sampleGrn.grnNumber,
      no: sampleGrn.no,
      date: sampleGrn.date,
      supplierCode: sampleGrn.supplierCode,
      supplierName: sampleGrn.supplierName,
      supplierInvoiceNo: sampleGrn.supplierInvoiceNo,
      items: sampleGrn.lineItems.map(l => ({ code: l.code, itemCode: l.itemCode, desc: l.description, qty: l.quantity, price: l.unitPrice }))
    });
  }

  await mongoose.disconnect();
}

check().catch(console.error);
