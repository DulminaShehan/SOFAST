import urllib.request
import re
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

req = urllib.request.Request('https://frontend-six-delta-97.vercel.app', headers={'User-Agent': 'Mozilla/5.0'})
html = urllib.request.urlopen(req, context=ctx).read().decode()
print('HTML preview:', html[:300])

scripts = re.findall(r'src="([^"]+\.js)"', html)
print('Scripts found:', scripts)

for s in scripts:
    js_url = 'https://frontend-six-delta-97.vercel.app' + s
    print('Fetching JS:', js_url)
    req2 = urllib.request.Request(js_url, headers={'User-Agent': 'Mozilla/5.0'})
    js = urllib.request.urlopen(req2, context=ctx).read().decode()
    print('JS length:', len(js))
    # Search for baseURL or sslip.io or /api
    matches = re.findall(r'(https://[^"\']+sslip\.io[^"\']*)', js)
    print('Found sslip URLs in JS:', set(matches))

