import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('168.144.117.2', port=22, username='root', password='SofasT2026S', timeout=20)

cmd = "tail -n 100 /var/log/nginx/sofast_access.log"
stdin, stdout, stderr = ssh.exec_command(cmd)
lines = stdout.read().decode('utf-8', errors='replace').strip().split('\n')
for line in lines[-50:]:
    print(line)

