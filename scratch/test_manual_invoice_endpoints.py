import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

base = "https://168.144.117.2.sslip.io/api"
endpoints = [
    "/invoices/next-manual-number",
    "/customers",
    "/items?limit=all",
    "/manual-items/lookup?limit=all",
    "/invoices?type=manual&limit=100",
]

for ep in endpoints:
    url = base + ep
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, context=ctx, timeout=10) as r:
            body = r.read().decode("utf-8", errors="replace")
            print(f"✓ {ep} -> Status {r.status}, length={len(body)}")
    except urllib.error.HTTPError as e:
        print(f"✗ {ep} -> HTTP {e.code}: {e.read().decode('utf-8', errors='replace')}")
    except Exception as e:
        print(f"✗ {ep} -> {e}")

