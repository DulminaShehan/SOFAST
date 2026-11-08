import os
import sys
import time
import urllib.request
import json
import paramiko

sys.stdout.reconfigure(encoding='utf-8')

SERVER_IP = '168.144.117.2'
SERVER_PORT = 22
SERVER_USER = 'root'
SERVER_PASS = 'SofasT2026S'

print(f"==================================================")
print(f"Connecting to {SERVER_IP} as {SERVER_USER}...")
print(f"==================================================")

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(SERVER_IP, port=SERVER_PORT, username=SERVER_USER, password=SERVER_PASS, timeout=20)

def run_cmd(cmd, check=True):
    print(f"\n>>> Running: {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    exit_status = stdout.channel.recv_exit_status()
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    if out:
        print(out)
    if err:
        print("STDERR:", err)
    if check and exit_status != 0:
        raise RuntimeError(f"Command failed with exit code {exit_status}: {cmd}")
    return out

# Step 1: Configure safe directory
run_cmd('git config --global --add safe.directory /var/www/sofast/repo')
run_cmd('su - sofast -c "git config --global --add safe.directory /var/www/sofast/repo"')

# Step 2: Fetch and reset to latest origin/main
run_cmd('cd /var/www/sofast/repo && git fetch origin')
run_cmd('cd /var/www/sofast/repo && git reset --hard origin/main')
latest_commit = run_cmd('cd /var/www/sofast/repo && git log -n 1 --oneline')
print(f"\n--> Active Repo Commit: {latest_commit}")

# Step 3: Backup .env
run_cmd('cp /var/www/sofast/backend/.env /var/www/sofast/backend_env.bak')

# Step 4: Rsync backend from repo to live backend directory
run_cmd("rsync -av --exclude='.env' --exclude='node_modules' /var/www/sofast/repo/backend/ /var/www/sofast/backend/")

# Step 5: Restore .env and set ownership
run_cmd('cp /var/www/sofast/backend_env.bak /var/www/sofast/backend/.env')
run_cmd('chown -R sofast:sofast /var/www/sofast')

# Step 6: Install dependencies (if any)
run_cmd('cd /var/www/sofast/backend && su - sofast -c "cd /var/www/sofast/backend && npm install --omit=dev"')

# Step 7: Restart / reload PM2 backend service
run_cmd('su - sofast -c "cd /var/www/sofast/backend && pm2 reload ecosystem.config.cjs --update-env"')
run_cmd('su - sofast -c "pm2 save"')

# Step 8: Verify PM2 status
print("\n--> Checking PM2 status:")
run_cmd('su - sofast -c "pm2 status"')

# Step 9: Check recent logs for errors
time.sleep(2)
print("\n--> Checking recent PM2 logs (last 30 lines):")
run_cmd('su - sofast -c "pm2 logs sofast-backend --lines 30 --nostream"')

ssh.close()
print("\n==================================================")
print("SSH deployment completed successfully!")
print("==================================================")

# Step 10: Test public API endpoints
print("\n--> Testing public backend API endpoints via HTTPS:")
endpoints = [
    'https://168.144.117.2.sslip.io/api/health',
    'https://168.144.117.2.sslip.io/api/items?limit=5',
    'https://168.144.117.2.sslip.io/api/manual-items/lookup?limit=5',
    'https://168.144.117.2.sslip.io/api/invoices/next-manual-number',
]

for url in endpoints:
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.status
            body = resp.read().decode('utf-8')
            data = json.loads(body)
            success = data.get('success', False)
            print(f"✓ {url} -> Status {status}, success={success}")
    except Exception as e:
        print(f"✗ {url} -> Error: {e}")

print("\nDeployment and live verification complete!")

