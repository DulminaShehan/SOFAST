import requests

BASE_URL = "https://168.144.117.2.sslip.io/api"
r = requests.get(f"{BASE_URL}/invoice?type=manual")
for inv in r.json().get("data", []):
    lines = inv.get("lineItems", [])
    total_qty = sum(li.get("quantity") or li.get("qty") or 0 for li in lines)
    print(f"{inv.get('invoiceNumber')}: Total Rs. {inv.get('total') or inv.get('netTotal')}, Lines: {len(lines)}, Total Qty: {total_qty}")
    for li in lines:
        print(f"   - {li.get('code')}: {li.get('description')} | Qty: {li.get('quantity') or li.get('qty')} | Price: {li.get('price') or li.get('unitPrice')}")

