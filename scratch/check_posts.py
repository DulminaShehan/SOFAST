import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('168.144.117.2', port=22, username='root', password='SofasT2026S', timeout=20)
stdin, stdout, stderr = ssh.exec_command('grep -E "(POST|PUT)" /var/log/nginx/sofast_access.log | tail -n 25')
print(stdout.read().decode('utf-8', errors='replace'))
ssh.close()

