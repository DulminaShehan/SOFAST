import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sofast_pos');
  const db = mongoose.connection.db;

  const invoices = await db.collection('invoices').find({}).toArray();
  console.log(`Total invoices: ${invoices.length}`);

  let withSettlements = 0;
  let withoutSettlements = 0;

  for (const inv of invoices) {
    const invNum = inv.invoiceNumber || String(inv.no);
    const setts = await db.collection('invoicesettlements').find({
      $or: [{ invoiceNumber: invNum }, { invoiceNo: invNum }]
    }).toArray();

    if (setts.length > 0) {
      withSettlements++;
    } else {
      withoutSettlements++;
    }
  }

  console.log(`Invoices with settlements: ${withSettlements}`);
  console.log(`Invoices without settlements: ${withoutSettlements}`);

  // Let's inspect invoice 47615 specifically
  const inv47615 = await db.collection('invoices').findOne({
    $or: [{ invoiceNumber: '47615' }, { no: 47615 }]
  });
  console.log('Invoice 47615 details:', inv47615);

  await mongoose.disconnect();
}
run();
