import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('168.144.117.2', port=22, username='root', password='SofasT2026S', timeout=20)

commands = [
    'ps aux | grep node',
    'su - sofast -c "pm2 status"',
    'tail -n 20 /var/log/nginx/sofast_access.log',
    'tail -n 20 /var/log/nginx/sofast_error.log',
]

for cmd in commands:
    print(f"\n>>> Running: {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print(stdout.read().decode('utf-8', errors='replace'))
    err = stderr.read().decode('utf-8', errors='replace')
    if err:
        print("ERR:", err)

ssh.close()

