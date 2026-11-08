import urllib.request
import re
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

js_url = 'https://frontend-six-delta-97.vercel.app/assets/index-CoJ3aDn8.js'
req = urllib.request.Request(js_url, headers={'User-Agent': 'Mozilla/5.0'})
js = urllib.request.urlopen(req, context=ctx).read().decode()

# Find all api.get/post/put/delete endpoints
matches = re.findall(r'api\.(?:get|post|put|delete|patch)\([`"\']([^`"\']+)[`"\']', js)
print('Total api.* calls:', len(matches))
print('Unique api calls:')
for m in sorted(set(matches)):
    print(' ', m)

