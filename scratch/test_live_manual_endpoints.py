import urllib.request
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

urls = [
    'https://168.144.117.2.sslip.io/api/manual-items',
    'https://168.144.117.2.sslip.io/api/manual-items/invoices',
]

for url in urls:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            print(f"=== URL: {url} ===")
            print("Status:", resp.status)
            print("Success:", data.get('success'))
            if 'summary' in data:
                print("Summary:", data['summary'])
            if 'manualInvoices' in data:
                print("manualInvoices count:", len(data['manualInvoices']))
                for inv in data['manualInvoices']:
                    print("  ->", inv.get('invoiceNumber'), inv.get('customerName'), inv.get('netTotal'))
            if 'invoiceNumbers' in data:
                print("invoiceNumbers in /invoices endpoint:", data.get('invoiceNumbers'))
            if 'count' in data:
                print("Count in /invoices endpoint:", data.get('count'))
            if 'data' in data and len(data['data']) > 0 and 'associatedInvoiceNumbers' in data['data'][0]:
                print("Sample item associated invoices:")
                for item in data['data'][:5]:
                    print("  Item:", item.get('manualCode'), item.get('description'), "-> Invoices:", item.get('associatedInvoiceNumbers'))
    except Exception as e:
        print(f"Error {url}: {e}")

