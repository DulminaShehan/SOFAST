import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

base = "https://168.144.117.2.sslip.io"
endpoints = [
    "/api/invoices/next-manual-number",
    "/invoices/next-manual-number",
    "/api/manual-invoices/next-manual-number",
    "/api/manual-invoice/next-manual-number",
    "/api/manual-items/lookup?limit=all",
    "/api/manual-items/next-code",
    "/api/customers",
    "/api/items/meta/dropdowns",
    "/api/items/lookup-options",
    "/items/lookup-options",
    "/api/invoices?type=manual&limit=100",
    "/favicon.ico",
]

for ep in endpoints:
    url = base + ep
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, context=ctx, timeout=10) as r:
            print(f"✓ {ep} -> Status {r.status}")
    except urllib.error.HTTPError as e:
        print(f"✗ {ep} -> HTTP {e.code}: {e.read().decode('utf-8', errors='replace')}")
    except Exception as e:
        print(f"✗ {ep} -> {e}")

