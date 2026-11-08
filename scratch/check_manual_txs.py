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
  const txs = await db.collection('manual_stock_transactions').find({}).toArray();
  console.log('Total manual transactions found:', txs.length);
  for (const t of txs) {
    console.log(t.transactionType, t.manualCode, t.description, t.referenceNumber, t.quantity, t.date);
  }
  process.exit(0);
}
run();
"""

stdin, stdout, stderr = ssh.exec_command("cat << 'EOF' > /var/www/sofast/backend/check_manual_txs.mjs\n" + remote_script + "\nEOF\ncd /var/www/sofast/backend && node check_manual_txs.mjs && rm check_manual_txs.mjs")
print(stdout.read().decode('utf-8', errors='replace'))

