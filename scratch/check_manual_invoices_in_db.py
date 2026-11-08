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
  }).toArray();
  console.log('Total manual invoices found:', invoices.length);
  for (const inv of invoices) {
    console.log(inv.invoiceNumber, inv.date, inv.customerName, inv.netTotal, (inv.lineItems || []).length + ' items');
  }
  process.exit(0);
}
run();
"""

stdin, stdout, stderr = ssh.exec_command("cat << 'EOF' > /var/www/sofast/backend/check_manual_invs.mjs\n" + remote_script + "\nEOF\ncd /var/www/sofast/backend && node check_manual_invs.mjs && rm check_manual_invs.mjs")
print(stdout.read().decode('utf-8', errors='replace'))
print(stderr.read().decode('utf-8', errors='replace'))

