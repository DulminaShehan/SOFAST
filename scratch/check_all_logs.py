import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('168.144.117.2', port=22, username='root', password='SofasT2026S', timeout=20)

def cmd(c):
    print(f"\n--- {c} ---")
    stdin, stdout, stderr = ssh.exec_command(c)
    print(stdout.read().decode('utf-8', errors='replace'))

cmd('zgrep " 409 " /var/log/nginx/*.gz 2>/dev/null')
cmd('grep " 409 " /var/log/nginx/*.log 2>/dev/null')
cmd('grep -i "conflict" /home/sofast/.pm2/logs/* 2>/dev/null')
cmd('grep -i "conflict" /var/log/nginx/* 2>/dev/null')

