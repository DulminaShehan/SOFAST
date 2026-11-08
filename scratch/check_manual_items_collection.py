import requests

BASE_URL = "https://168.144.117.2.sslip.io/api"
r = requests.get(f"{BASE_URL}/manual-items")
m_data = r.json().get("data", [])
print(f"Total manual items in API: {len(m_data)}")
for m in m_data:
    print(f" - {m.get('manualCode')}: {m.get('description')} (Status: {m.get('status')}, Sold: {m.get('totalSalesQty')}, Stock: {m.get('availableStock')}, Invoices: {m.get('associatedInvoiceNumbers')})")

