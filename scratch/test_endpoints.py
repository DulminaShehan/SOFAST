import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

endpoints = [
  'https://168.144.117.2.sslip.io/api/items/meta/dropdowns',
  'https://168.144.117.2.sslip.io/api/items/lookup-options',
  'https://168.144.117.2.sslip.io/api/invoices/next-manual-number',
  'https://168.144.117.2.sslip.io/api/manual-items?limit=5',
  'https://168.144.117.2.sslip.io/api/customers',
]

for ep in endpoints:
  try:
    req = urllib.request.Request(ep, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, context=ctx, timeout=10) as r:
      data = json.loads(r.read().decode())
      print(f"✓ {ep} -> Status {r.status}, success={data.get('success')}")
  except Exception as e:
    print(f"✗ {ep} -> {e}")
