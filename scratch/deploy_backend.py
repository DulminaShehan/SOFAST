import paramiko
import os

files_to_upload = [
    (r"d:\SOFAST\backend\src\controllers\grnController.js", "/var/www/sofast/backend/src/controllers/grnController.js"),
    (r"d:\SOFAST\backend\src\controllers\manualItemController.js", "/var/www/sofast/backend/src/controllers/manualItemController.js"),
]

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
print("Connecting to VPS 168.144.117.2...")
ssh.connect('168.144.117.2', port=22, username='root', password='SofasT2026S', timeout=20)
print("Connected!")

sftp = ssh.open_sftp()
for local_path, remote_path in files_to_upload:
    print(f"Uploading {local_path} -> {remote_path}...")
    sftp.put(local_path, remote_path)
    print("Done!")
sftp.close()

# Fix ownership
stdin, stdout, stderr = ssh.exec_command("chown -R sofast:sofast /var/www/sofast/backend/src/controllers")
print("chown:", stdout.read().decode('utf-8', 'replace'), stderr.read().decode('utf-8', 'replace'))

# Reload PM2
cmd = 'su - sofast -c "cd /var/www/sofast/backend && pm2 reload ecosystem.config.cjs --update-env"'
print("Running PM2 reload...")
stdin, stdout, stderr = ssh.exec_command(cmd)
print("PM2 output:\n", stdout.read().decode('utf-8', 'replace'))
print("PM2 err:\n", stderr.read().decode('utf-8', 'replace'))

# Check status
stdin, stdout, stderr = ssh.exec_command('su - sofast -c "pm2 status"')
print("PM2 status:\n", stdout.read().decode('utf-8', 'replace'))

ssh.close()
print("Backend deployment complete!")
