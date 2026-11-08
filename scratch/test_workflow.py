import requests
import json
import time

BASE_URL = "https://168.144.117.2.sslip.io/api"

print("=" * 80)
print("SOFAST POS — 11-STEP END-TO-END WORKFLOW VERIFICATION SUITE")
print("=" * 80)

# 0. Baseline verification of pre-existing historical records
print("\n[Step 0] Verifying Pre-existing Historical Records...")
r_inv = requests.get(f"{BASE_URL}/invoice?type=manual")
all_invs = r_inv.json().get("data", [])

# Historical invoices are MAN-0001 through MAN-0006
historical_man = [
    i for i in all_invs
    if str(i.get("invoiceNumber", "")).upper() in ["MAN-0001", "MAN-0002", "MAN-0003", "MAN-0004", "MAN-0005", "MAN-0006"]
]
print(f"Historical MAN Invoices found: {len(historical_man)} of 6")
assert len(historical_man) == 6, f"Expected 6 historical invoices, found {len(historical_man)}"

historical_total_rev = sum(float(i.get("total", 0) or i.get("netTotal", 0) or i.get("grossTotal", 0) or 0) for i in historical_man)
print(f"Historical Revenue: Rs. {historical_total_rev:,.2f}")
assert abs(historical_total_rev - 43240.0) < 0.01, f"Expected Rs. 43,240, got {historical_total_rev}"
print("PRE-EXISTING DATABASE INTEGRITY CONFIRMED: MAN-0001 to MAN-0006, Rs. 43,240 Revenue intact!\n")

# Generate unique test codes for this test run
uid = int(time.time()) % 100000
test_manual_code = f"MAN-AF-{uid}"
test_desc = f"TEST UNREGISTERED AIR FILTER {uid}"
test_master_code = f"ITM-AF-{uid}"

# 1. Scenario 1: Create a Manual Invoice for an unregistered item
print(f"[Scenario 1] Creating Manual Invoice for unregistered item '{test_manual_code}'...")
r_num = requests.get(f"{BASE_URL}/invoice/next-manual-number")
next_man_inv_num = r_num.json().get("data", {}).get("invoiceNumber") or r_num.json().get("invoiceNumber") or f"MAN-AUTO-{uid}"
print(f"Allocated Manual Invoice Number: {next_man_inv_num}")

manual_inv_payload = {
    "invoiceNumber": next_man_inv_num,
    "invoiceType": "Manual",
    "isManualInvoice": True,
    "customer": {
        "name": "Walk-in Hardware Customer",
        "phone": "0771234567"
    },
    "paymentMethod": "Cash",
    "paymentStatus": "Paid",
    "status": "Completed",
    "subTotal": 4500.0,
    "discount": 0.0,
    "total": 4500.0,
    "paidAmount": 4500.0,
    "balance": 0.0,
    "lineItems": [
        {
            "code": test_manual_code,
            "description": test_desc,
            "unit": "PCS",
            "quantity": 3,
            "unitPrice": 1500.0,
            "sellingPrice": 1500.0,
            "discount": 0,
            "total": 4500.0,
            "isManual": True
        }
    ]
}

r_create_inv = requests.post(f"{BASE_URL}/invoice", json=manual_inv_payload)
print(f"Create Manual Invoice Status: {r_create_inv.status_code}")
assert r_create_inv.status_code in [200, 201], f"Failed to create manual invoice: {r_create_inv.text}"
created_inv_data = r_create_inv.json().get("data", {})
actual_inv_number = created_inv_data.get("invoiceNumber", next_man_inv_num)
print(f"PASS: Manual Invoice saved with invoice number: {actual_inv_number}")

# 2 & 3. Scenario 2 & 3: Confirm appearance in Manual Stock Report & invoice linkage
print(f"\n[Scenario 2 & 3] Confirming appearance in Manual Stock Report & linked invoice...")
time.sleep(1)
r_report = requests.get(f"{BASE_URL}/manual-items")
m_items = r_report.json().get("data", [])
tracked_item = next((m for m in m_items if m.get("manualCode") == test_manual_code or m.get("description") == test_desc), None)
assert tracked_item is not None, f"Unregistered item '{test_manual_code}' not found in Manual Stock Report!"

print(f"  Item Found: {tracked_item.get('manualCode')} — {tracked_item.get('description')}")
print(f"  Total Manual Sales: {tracked_item.get('totalSalesQty')} PCS (Expected: 3)")
print(f"  Available Manual Stock: {tracked_item.get('availableStock')} PCS (Expected: -3)")
print(f"  Status: {tracked_item.get('status')}")
assert tracked_item.get('totalSalesQty') == 3, f"Expected 3 sales, got {tracked_item.get('totalSalesQty')}"
assert tracked_item.get('availableStock') == -3, f"Expected -3 stock, got {tracked_item.get('availableStock')}"

linked_invoices = tracked_item.get("associatedInvoiceNumbers", [])
print(f"  Linked Invoice Numbers: {linked_invoices}")
assert actual_inv_number in linked_invoices, f"Expected {actual_inv_number} in linked invoices {linked_invoices}"
print(f"PASS: Unregistered item auto-tracked with original invoice number linked correctly!")

# 4 & 5. Scenario 4 & 5: Add goods through GRN & Match to tracked manual item
print(f"\n[Scenario 4 & 5] Adding supplier goods through GRN & linking to '{test_manual_code}'...")
r_grn_num = requests.get(f"{BASE_URL}/grn/next-number")
grn_no = r_grn_num.json().get("data", {}).get("grnNumber") or r_grn_num.json().get("grnNumber") or f"GRN-{uid}"

grn_payload = {
    "grnNumber": grn_no,
    "supplierCode": "SUP001",
    "supplierName": "TEST SUPPLIER LTD",
    "supplierInvoiceNo": f"SUP-INV-{uid}",
    "paidBy": "Cash",
    "date": "2026-11-08",
    "isPosted": True,
    "lineItems": [
        {
            "code": test_manual_code,
            "itemCode": test_manual_code,
            "description": test_desc,
            "unitPrice": 1000.0,
            "sellingPrice": 1500.0,
            "quantity": 10,
            "qty": 10,
            "discount": 0,
            "value": 10000.0,
            "locationCode": "MAIN",
            "isManualItem": True,
            "manualItemId": tracked_item.get("_id"),
            "manualCode": test_manual_code,
            "previouslySoldQty": 3
        }
    ]
}

r_grn = requests.post(f"{BASE_URL}/grn", json=grn_payload)
print(f"Create & Post GRN Status: {r_grn.status_code}")
assert r_grn.status_code in [200, 201], f"Failed to post GRN: {r_grn.text}"
grn_result = r_grn.json().get("data", {})
print(f"PASS: GRN Posted: {grn_result.get('grnNumber', grn_no)}")

# Verify stock reconciliation in manual item
time.sleep(1)
r_reconciled = requests.get(f"{BASE_URL}/manual-items/{tracked_item.get('_id')}")
reconciled_doc = r_reconciled.json().get("data", {})
print(f"Stock Reconciliation on Tracked Manual Item:")
print(f"  Confirmed Received Qty: {reconciled_doc.get('totalStockAdded')} PCS")
print(f"  Previously Sold Qty: {reconciled_doc.get('totalSalesQty')} PCS")
print(f"  Reconciled Available Stock: {reconciled_doc.get('availableStock')} PCS (Formula: 10 - 3 = 7)")
assert reconciled_doc.get('totalStockAdded') == 10, f"Expected 10 received, got {reconciled_doc.get('totalStockAdded')}"
assert reconciled_doc.get('availableStock') == 7, f"Expected 7 available, got {reconciled_doc.get('availableStock')}"
print("PASS: GRN confirmed stock reconciled accurately!")

# 6 & 7. Scenario 6 & 7: Convert to Item Master & verify reconciled stock
print(f"\n[Scenario 6 & 7] Converting unregistered item to Item Master code '{test_master_code}'...")
convert_payload = {
    "manualItemId": tracked_item.get("_id"),
    "targetCode": test_master_code,
    "itemCode": test_master_code,
    "description": test_desc,
    "category": "MAINTENANCE",
    "unit": "PCS",
    "sellingPrice": 1500.0,
    "costPrice": 1000.0,
    "notes": f"Converted from {test_manual_code}"
}

r_convert = requests.post(f"{BASE_URL}/manual-items/convert", json=convert_payload)
print(f"Convert Status: {r_convert.status_code}")
assert r_convert.status_code in [200, 201], f"Failed to convert: {r_convert.text}"
convert_json = r_convert.json()
created_master = convert_json.get("item") or convert_json.get("data", {}).get("item")
assert created_master is not None, "Missing converted item in response"

print(f"PASS: Converted to Item Master successfully!")
print(f"  Official Master Code: {created_master.get('code')}")
print(f"  Transferred Reconciled Stock in Hand: {created_master.get('stockInHand')} PCS (Expected: 7)")
print(f"  Transferred Reconciled Quantity: {created_master.get('quantity')} PCS (Expected: 7)")
assert created_master.get('stockInHand') == 7, f"Expected 7 stock in hand, got {created_master.get('stockInHand')}"
assert created_master.get('quantity') == 7, f"Expected 7 quantity, got {created_master.get('quantity')}"

# Verify double conversion prevention
print("\nVerifying Double Conversion Prevention...")
r_dup = requests.post(f"{BASE_URL}/manual-items/convert", json=convert_payload)
print(f"Double conversion HTTP Status: {r_dup.status_code} (Expected 400/409)")
assert r_dup.status_code in [400, 409], f"Double conversion allowed! Status: {r_dup.status_code}"
print("PASS: Double conversion blocked as expected!")

# 8 & 9. Scenario 8 & 9: Create normal Sales Invoice & verify stock deduction
print(f"\n[Scenario 8 & 9] Creating normal Sales Invoice using converted master code '{test_master_code}'...")
r_std_num = requests.get(f"{BASE_URL}/invoice/next-number")
std_inv_num = r_std_num.json().get("data", {}).get("invoiceNumber") or r_std_num.json().get("invoiceNumber") or f"INV-{uid}"

normal_sales_payload = {
    "invoiceNumber": std_inv_num,
    "invoiceType": "Standard",
    "isManualInvoice": False,
    "customer": {
        "name": "Standard Counter Customer",
        "phone": "0778889900"
    },
    "paymentMethod": "Cash",
    "paymentStatus": "Paid",
    "status": "Completed",
    "subTotal": 3000.0,
    "discount": 0.0,
    "total": 3000.0,
    "paidAmount": 3000.0,
    "balance": 0.0,
    "lineItems": [
        {
            "code": test_master_code,
            "description": test_desc,
            "unit": "PCS",
            "quantity": 2,
            "unitPrice": 1500.0,
            "sellingPrice": 1500.0,
            "discount": 0,
            "total": 3000.0,
            "isManual": False
        }
    ]
}

r_sale = requests.post(f"{BASE_URL}/invoice", json=normal_sales_payload)
print(f"Normal Sales Invoice Status: {r_sale.status_code}")
assert r_sale.status_code in [200, 201], f"Normal sales invoice failed: {r_sale.text}"

# Verify stock deduction
time.sleep(1)
r_master_check = requests.get(f"{BASE_URL}/items/{created_master.get('_id')}")
master_post_sale = r_master_check.json().get("data", {})
print(f"Item Master Stock After Normal Sale:")
print(f"  Stock Before: 7 PCS")
print(f"  Sold in Normal Invoice: 2 PCS")
print(f"  Stock In Hand After Sale: {master_post_sale.get('stockInHand')} PCS (Formula: 7 - 2 = 5)")
print(f"  Quantity After Sale: {master_post_sale.get('quantity')} PCS (Formula: 7 - 2 = 5)")
assert master_post_sale.get('stockInHand') == 5, f"Expected 5, got {master_post_sale.get('stockInHand')}"
assert master_post_sale.get('quantity') == 5, f"Expected 5, got {master_post_sale.get('quantity')}"
print("PASS: Normal sales invoice deducted inventory stock accurately (5 PCS remaining)!")

# 10. Scenario 10: Repeat synchronization and verify no duplicate stock movements
print(f"\n[Scenario 10] Testing Re-synchronization Idempotency...")
r_sync = requests.post(f"{BASE_URL}/manual-items/sync-history")
print(f"Sync history status: {r_sync.status_code}")
assert r_sync.status_code in [200, 201], f"Sync failed: {r_sync.text}"

time.sleep(1)
r_master_post_sync = requests.get(f"{BASE_URL}/items/{created_master.get('_id')}")
master_post_sync = r_master_post_sync.json().get("data", {})
print(f"Stock In Hand after sync-history: {master_post_sync.get('stockInHand')} PCS (Expected: 5)")
assert master_post_sync.get('stockInHand') == 5, f"Stock changed unexpectedly on sync! Got {master_post_sync.get('stockInHand')}"
print("PASS: Repeated synchronization is 100% idempotent with ZERO duplicate movements!")

# 11. Scenario 11: Verify historical Manual Invoice records remain unchanged
print(f"\n[Scenario 11] Verifying Historical Manual Invoices & Items Integrity...")
r_inv_check = requests.get(f"{BASE_URL}/invoice?type=manual")
all_invs_final = r_inv_check.json().get("data", [])
historical_final = [
    i for i in all_invs_final
    if str(i.get("invoiceNumber", "")).upper() in ["MAN-0001", "MAN-0002", "MAN-0003", "MAN-0004", "MAN-0005", "MAN-0006"]
]
print(f"Historical MAN Invoices Verified: {len(historical_final)} of 6")
assert len(historical_final) == 6, f"Expected 6 historical invoices, found {len(historical_final)}"

historical_final_rev = sum(float(i.get("total", 0) or i.get("netTotal", 0) or i.get("grossTotal", 0) or 0) for i in historical_final)
print(f"Historical Revenue: Rs. {historical_final_rev:,.2f} (Expected: Rs. 43,240.00)")
assert abs(historical_final_rev - 43240.0) < 0.01, f"Historical revenue altered: {historical_final_rev}"

# Verify the 3 original items are still intact
r_m_final = requests.get(f"{BASE_URL}/manual-items")
m_final = r_m_final.json().get("data", [])
print("Original Unregistered/Converted Items Check:")
for code in ["MAN-BRK-8686", "MAN-BRK-8741", "MAN-BRK-8808"]:
    item = next((m for m in m_final if m.get("manualCode") == code), None)
    assert item is not None, f"Original item {code} missing!"
    print(f"  - {item.get('manualCode')}: {item.get('description')} (Sold: {item.get('totalSalesQty')}, Stock: {item.get('availableStock')}, Status: {item.get('status')})")

print("\n" + "=" * 80)
print("ALL 11 WORKFLOW SCENARIOS VERIFIED AND PASSED WITH 100% SUCCESS!")
print("=" * 80)
