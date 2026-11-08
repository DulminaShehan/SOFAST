import urllib.request
import re
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

js_url = 'https://frontend-six-delta-97.vercel.app/assets/index-CoJ3aDn8.js'
req = urllib.request.Request(js_url, headers={'User-Agent': 'Mozilla/5.0'})
js = urllib.request.urlopen(req, context=ctx).read().decode()

# Find strings starting with /
matches = re.findall(r'["\'](/[^"\'\s\<\>]{2,50})["\']', js)
print('Total /... strings:', len(matches))
api_like = [m for m in set(matches) if any(k in m.lower() for k in ['invoice', 'manual', 'item', 'customer', 'report', 'lookup', 'user', 'supplier', 'grn', 'damage', 'settle'])]
for m in sorted(api_like):
    print(' ', m)
