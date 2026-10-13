import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sofast_pos');
  const db = mongoose.connection.db;

  const inv47615 = await db.collection('invoices').findOne({
    $or: [{ invoiceNumber: '47615' }, { no: 47615 }]
  });
  console.log('Before update, inv47615:', {
    invoiceNumber: inv47615?.invoiceNumber,
    subTotal: inv47615?.subTotal,
    amountToPay: inv47615?.amountToPay,
    dueAmount: inv47615?.dueAmount,
    amountReceived: inv47615?.amountReceived,
    paidAmount: inv47615?.paidAmount,
  });

  // Update 47615 to correct outstanding balance
  await db.collection('invoices').updateOne(
    { _id: inv47615._id },
    {
      $set: {
        dueAmount: 4240,
        amountReceived: 0,
        cashReceived: 0,
        paidAmount: 0,
        isSettled: false,
        paymentStatus: 'unpaid',
      }
    }
  );

  const updated = await db.collection('invoices').findOne({ _id: inv47615._id });
  console.log('After update, inv47615:', {
    invoiceNumber: updated.invoiceNumber,
    subTotal: updated.subTotal,
    amountToPay: updated.amountToPay,
    dueAmount: updated.dueAmount,
    amountReceived: updated.amountReceived,
    paidAmount: updated.paidAmount,
    paymentStatus: updated.paymentStatus,
    isSettled: updated.isSettled,
  });

  await mongoose.disconnect();
}
run();
