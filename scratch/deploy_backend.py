import os
import sys
import paramiko

sys.stdout.reconfigure(encoding='utf-8')

SERVER_IP = '168.144.117.2'
SERVER_PORT = 22
SERVER_USER = 'root'
SERVER_PASS = 'SofasT2026S'

REMOTE_BASE = '/var/www/sofast/backend'

FILES_TO_SYNC = [
    ('backend/src/controllers/invoiceController.js', f'{REMOTE_BASE}/src/controllers/invoiceController.js'),
    ('backend/src/controllers/damageReturnController.js', f'{REMOTE_BASE}/src/controllers/damageReturnController.js'),
    ('backend/src/controllers/itemController.js', f'{REMOTE_BASE}/src/controllers/itemController.js'),
    ('backend/src/controllers/manualItemController.js', f'{REMOTE_BASE}/src/controllers/manualItemController.js'),
    ('backend/src/models/ManualItem.js', f'{REMOTE_BASE}/src/models/ManualItem.js'),
    ('backend/src/models/ManualStockTransaction.js', f'{REMOTE_BASE}/src/models/ManualStockTransaction.js'),
    ('backend/src/routes/manualItem.routes.js', f'{REMOTE_BASE}/src/routes/manualItem.routes.js'),
    ('backend/src/routes/report.routes.js', f'{REMOTE_BASE}/src/routes/report.routes.js'),
    ('backend/src/routes/index.js', f'{REMOTE_BASE}/src/routes/index.js'),
]

print(f'Connecting to {SERVER_IP}...')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(SERVER_IP, port=SERVER_PORT, username=SERVER_USER, password=SERVER_PASS, timeout=15)
sftp = ssh.open_sftp()

for local_path, remote_path in FILES_TO_SYNC:
    if not os.path.exists(local_path):
        print(f'Warning: local file {local_path} not found')
        continue
    remote_dir = os.path.dirname(remote_path)
    # Ensure remote dir exists
    try:
        sftp.stat(remote_dir)
    except IOError:
        print(f'Creating remote directory: {remote_dir}')
        ssh.exec_command(f'mkdir -p {remote_dir}')
    
    print(f'Uploading {local_path} -> {remote_path}...')
    sftp.put(local_path, remote_path)

sftp.close()

print('Setting ownership to sofast:sofast and reloading PM2...')
commands = [
    'chown -R sofast:sofast /var/www/sofast/backend',
    'su - sofast -c "pm2 reload sofast-backend"',
    'su - sofast -c "pm2 status"',
]

for cmd in commands:
    print(f'=== {cmd} ===')
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    if out:
        print(out)
    if err:
        print('STDERR:', err)

ssh.close()
print('Backend deployed successfully!')

