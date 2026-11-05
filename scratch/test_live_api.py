import urllib.request
import ssl
import json

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def test_url(url, desc):
    print(f'=== Testing {desc} ===')
    try:
        req = urllib.request.urlopen(url, context=ctx)
        data = json.loads(req.read().decode('utf-8'))
        items = data.get('data', [])
        if isinstance(items, list):
            print(f'Status {req.status}, returned {len(items)} items')
            for i in items[:5]:
                print('  - No:', i.get('invoiceNumber'), 'Type:', i.get('invoiceType'), 'isManual:', i.get('isManualInvoice'))
        else:
            print(f'Status {req.status}, returned: {items}')
    except urllib.error.HTTPError as e:
        print(f'HTTPError {e.code}: {e.read().decode("utf-8")}')
    except Exception as e:
        print('Error:', e)

test_url('https://168.144.117.2.sslip.io/api/invoices?limit=10', 'Default Invoices (Standard Only)')
test_url('https://168.144.117.2.sslip.io/api/invoices?type=manual&limit=10', 'Manual Invoices Only')
test_url('https://168.144.117.2.sslip.io/api/invoices/return-details/MAN-0004', 'Return details for Manual Invoice MAN-0004')

