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
  for (const collName of ['invoices', 'items', 'manual_items', 'manual_stock_transactions', 'users']) {
    console.log('--- INDEXES FOR ' + collName + ' ---');
    try {
      const idx = await db.collection(collName).indexes();
      console.log(JSON.stringify(idx, null, 2));
    } catch (e) {
      console.log('Error getting indexes for ' + collName + ': ' + e.message);
    }
  }
  process.exit(0);
}
run();
"""

stdin, stdout, stderr = ssh.exec_command("cat << 'EOF' > /var/www/sofast/backend/check_indexes.mjs\n" + remote_script + "\nEOF\ncd /var/www/sofast/backend && node check_indexes.mjs && rm check_indexes.mjs")
print(stdout.read().decode('utf-8', errors='replace'))
print(stderr.read().decode('utf-8', errors='replace'))
