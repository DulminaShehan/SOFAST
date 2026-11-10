import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('168.144.117.2', port=22, username='root', password='SofasT2026S', timeout=20)
cmd = """cat << 'EOF' > /tmp/check_items.cjs
const uri = 'mongodb://pramuditha:pramuditha@ac-firyk5f-shard-00-00.ecu9tpg.mongodb.net:27017,ac-firyk5f-shard-00-01.ecu9tpg.mongodb.net:27017,ac-firyk5f-shard-00-02.ecu9tpg.mongodb.net:27017/sofast_pos?ssl=true&replicaSet=atlas-p6vt1h-shard-0&authSource=admin&retryWrites=true&w=majority';
const mongoose = require('/var/www/sofast/backend/node_modules/mongoose');
mongoose.connect(uri).then(async () => {
  const items = await mongoose.connection.collection('items').find({}).limit(15).toArray();
  items.forEach(i => console.log('code:', i.code, '| desc:', i.description || i.name));
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
EOF
node /tmp/check_items.cjs
"""
stdin, stdout, stderr = ssh.exec_command(cmd)
print("STDOUT:\n", stdout.read().decode('utf-8', errors='replace'))
print("STDERR:\n", stderr.read().decode('utf-8', errors='replace'))
ssh.close()
