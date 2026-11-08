import requests

try:
    r = requests.get('https://168.144.117.2.sslip.io/api/health', timeout=10)
    print("Health check status:", r.status_code, r.text)
except Exception as e:
    print("Health check error:", e)

try:
    r = requests.get('https://168.144.117.2.sslip.io/api/manual-items/lookup?limit=all', timeout=10)
    print("Manual items lookup status:", r.status_code, "Count:", len(r.json().get('data', [])))
except Exception as e:
    print("Manual lookup error:", e)

