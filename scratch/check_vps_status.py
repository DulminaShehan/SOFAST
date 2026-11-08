import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('168.144.117.2', port=22, username='root', password='SofasT2026S', timeout=20)

commands = [
    'su - sofast -c "pm2 status"',
    'systemctl status nginx --no-pager',
    'su - sofast -c "pm2 logs sofast-backend --lines 50 --nostream"',
]

for cmd in commands:
    print(f"\n>>> Running: {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print(stdout.read().decode('utf-8', errors='replace'))
    err = stderr.read().decode('utf-8', errors='replace')
    if err:
        print("ERR:", err)

ssh.close()

