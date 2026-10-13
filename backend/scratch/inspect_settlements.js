import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sofast_pos');
  const db = mongoose.connection.db;

  const settCount = await db.collection('invoicesettlements').countDocuments();
  console.log('Total settlements:', settCount);
  const setts = await db.collection('invoicesettlements').find({}).limit(10).toArray();
  console.log('Sample settlements:');
  setts.forEach(s => console.log({ receiptNo: s.receiptNo, invoiceNumber: s.invoiceNumber, invoiceNo: s.invoiceNo, amount: s.amount, received: s.received, balanceBefore: s.balanceBefore, balanceAfter: s.balanceAfter }));

  const inv47615Setts = await db.collection('invoicesettlements').find({
    $or: [{ invoiceNumber: '47615' }, { invoiceNo: '47615' }]
  }).toArray();
  console.log('Settlements for 47615:', inv47615Setts);

  const invs = await db.collection('invoices').find({}).sort({ createdAt: -1 }).limit(10).toArray();
  console.log('Latest 10 invoices:');
  invs.forEach(inv => console.log({
    invoiceNumber: inv.invoiceNumber,
    subTotal: inv.subTotal,
    amountToPay: inv.amountToPay,
    dueAmount: inv.dueAmount,
    amountReceived: inv.amountReceived,
    paidAmount: inv.paidAmount,
    status: inv.status,
    isSettled: inv.isSettled,
    paymentStatus: inv.paymentStatus
  }));

  await mongoose.disconnect();
}
run();
