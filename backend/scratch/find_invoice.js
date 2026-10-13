import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sofast_pos');
  const db = mongoose.connection.db;
  const inv4240 = await db.collection('invoices').findOne({
    $or: [{ subTotal: 4240 }, { netTotal: 4240 }, { amountToPay: 4240 }]
  });
  console.log('Invoice with 4240:', inv4240);

  const sampleInvoices = await db.collection('invoices').find({}).limit(10).toArray();
  for (const inv of sampleInvoices) {
    console.log(`Invoice ${inv.invoiceNumber}: subTotal=${inv.subTotal}, netTotal=${inv.netTotal}, amountToPay=${inv.amountToPay}, paidAmount=${inv.paidAmount}, amountReceived=${inv.amountReceived}, dueAmount=${inv.dueAmount}, status=${inv.status}, paidStatus=${inv.paidStatus}`);
  }
  await mongoose.disconnect();
}
run();
