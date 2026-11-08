import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('168.144.117.2', port=22, username='root', password='SofasT2026S', timeout=20)

cleanup_cjs = """
const mongoose = require('mongoose');
require('dotenv').config({ path: '/var/www/sofast/backend/.env' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const delManual = await db.collection('manual_items').deleteMany({
    manualCode: { $regex: /^MAN-(TST|AF)/i }
  });
  console.log("Deleted test manual items from manual_items:", delManual.deletedCount);

  const delMaster = await db.collection('items').deleteMany({
    code: { $regex: /^(ITM|MAN)-(TST|AF)/i }
  });
  console.log("Deleted test master items from items:", delMaster.deletedCount);

  const delTxs = await db.collection('manual_stock_transactions').deleteMany({
    $or: [
      { manualCode: { $regex: /^MAN-(TST|AF)/i } },
      { referenceNumber: { $in: ['MAN-0007', 'MAN-0008', 'MAN-0009'] } }
    ]
  });
  console.log("Deleted test transactions from manual_stock_transactions:", delTxs.deletedCount);

  const mItems = await db.collection('manual_items').find().toArray();
  console.log("Remaining manual items count:", mItems.length);
  mItems.forEach(m => {
    console.log(" - " + m.manualCode + ": " + m.description + " (Status: " + m.status + ", Stock: " + m.availableStock + ")");
  });

  const manInvs = await db.collection('invoices').find({ invoiceNumber: { $regex: /^MAN-/i } }).toArray();
  console.log("Remaining MAN invoices count:", manInvs.length);
  manInvs.forEach(i => {
    console.log(" - " + i.invoiceNumber + ": Rs. " + (i.total || i.netTotal || i.grossTotal));
  });

  await mongoose.disconnect();
}

run().catch(console.error);
"""

sftp = ssh.open_sftp()
with sftp.file('/var/www/sofast/backend/cleanup_test.cjs', 'w') as f:
    f.write(cleanup_cjs)
sftp.close()

stdin, stdout, stderr = ssh.exec_command("cd /var/www/sofast/backend && node cleanup_test.cjs && rm cleanup_test.cjs")
print(stdout.read().decode('utf-8', 'replace'))
print(stderr.read().decode('utf-8', 'replace'))
ssh.close()

