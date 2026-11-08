import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('168.144.117.2', port=22, username='root', password='SofasT2026S', timeout=20)

stdin, stdout, stderr = ssh.exec_command('grep "175.157.183.8" /var/log/nginx/sofast_access.log')
lines = stdout.read().decode('utf-8', errors='replace').strip().split('\n')
for line in lines[-50:]:
    print(line)

