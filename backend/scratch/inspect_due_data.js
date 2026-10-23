import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
import { connectDatabase } from '../src/config/database.js';
import Customer from '../src/models/Customer.js';
import Invoice from '../src/models/Invoice.js';
import Settlement from '../src/models/Settlement.js';

async function main() {
  const conn = await connectDatabase();
  if (!conn) {
    console.log('DB connection failed');
    process.exit(1);
  }
  const custCount = await Customer.countDocuments();
  const invCount = await Invoice.countDocuments();
  const settCount = await Settlement.countDocuments();
  console.log({ custCount, invCount, settCount });

  const sampleCust = await Customer.findOne({
    $or: [{ dueAmount: { $gt: 0 } }, { outstandingBalance: { $gt: 0 } }],
  }).lean();
  console.log('Sample cust with due:', sampleCust ? {
    code: sampleCust.code || sampleCust.customerCode,
    name: sampleCust.name,
    dueAmount: sampleCust.dueAmount,
    outstandingBalance: sampleCust.outstandingBalance,
  } : 'none');

  const unpaidInvs = await Invoice.find({
    dueAmount: { $gt: 0 },
    status: { $ne: 'cancelled' },
  }).limit(5).lean();

  console.log('Sample unpaid invoices:', unpaidInvs.map(i => ({
    invoiceNumber: i.invoiceNumber,
    customerCode: i.customerCode,
    amountToPay: i.amountToPay,
    paidAmount: i.paidAmount,
    dueAmount: i.dueAmount,
    status: i.status,
  })));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
