import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('168.144.117.2', port=22, username='root', password='SofasT2026S', timeout=20)

remote_script = """
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '/var/www/sofast/backend/.env' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const invoices = await db.collection('invoices').find({
    $or: [
      { isManualInvoice: true },
      { invoiceType: 'Manual' },
      { invoiceNumber: /^MAN-/i }
    ]
  }).sort({ date: -1, createdAt: -1 }).toArray();

  console.log('TOTAL_INVOICES:' + invoices.length);
  for (const inv of invoices) {
    console.log('INV:' + inv.invoiceNumber + ' | ' + (inv.date || inv.createdAt) + ' | ' + inv.customerName + ' | ' + inv.netTotal);
    if (inv.lineItems) {
      for (const line of inv.lineItems) {
        console.log('  ITEM:' + (line.code || line.itemCode) + ' | ' + line.description + ' | ' + (line.quantity || line.qty) + ' | ' + (line.price || line.unitPrice));
      }
    }
  }

  const txs = await db.collection('manual_stock_transactions').find({ transactionType: 'MANUAL_SALE' }).toArray();
  console.log('TOTAL_TXS:' + txs.length);
  for (const t of txs) {
    console.log('TX:' + t.manualCode + ' | ' + t.description + ' | Ref:' + t.referenceNumber + ' | Qty:' + t.quantity);
  }
  process.exit(0);
}
run();
"""

stdin, stdout, stderr = ssh.exec_command("cat << 'EOF' > /var/www/sofast/backend/check_details.mjs\n" + remote_script + "\nEOF\ncd /var/www/sofast/backend && node check_details.mjs && rm check_details.mjs")
print(stdout.read().decode('utf-8', errors='replace'))
print(stderr.read().decode('utf-8', errors='replace'))
