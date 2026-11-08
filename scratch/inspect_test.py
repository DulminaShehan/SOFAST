import requests

BASE_URL = "https://168.144.117.2.sslip.io/api"
r = requests.get(f"{BASE_URL}/invoice?type=manual")
invs = r.json().get("data", [])
print(f"Total manual invoices with ?type=manual: {len(invs)}")
for i in invs:
    print(f"  {i.get('invoiceNumber')} - Total: Rs. {i.get('total') or i.get('netTotal') or i.get('grossTotal')} (Lines: {len(i.get('lineItems', []))})")

r_m = requests.get(f"{BASE_URL}/manual-items")
m_data = r_m.json().get("data", [])
print(f"\nManual items in report: {len(m_data)}")
for m in m_data:
    print(f"Code: {m.get('manualCode')}, Invoices: {m.get('associatedInvoiceNumbers')}")

