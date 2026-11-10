import os
from pymongo import MongoClient
import requests

uri = os.environ.get('MONGODB_URI', '')
if not uri:
    for line in open('backend/.env'):
        if line.startswith('MONGODB_URI='):
            uri = line.strip().split('=', 1)[1].strip()
            break

client = MongoClient(uri)
db = client['sofast_pos']

# Find a test invoice
test_inv = db.invoices.find_one({'isManualInvoice': False, 'invoiceNumber': {'$regex': '^0001$'}})
if not test_inv:
    test_inv = db.invoices.find_one({'isManualInvoice': False})

print('Found invoice for testing:', test_inv.get('invoiceNumber'), 'Gross:', test_inv.get('amountToPay'), 'Due:', test_inv.get('dueAmount'))

# Check settlements for this invoice
settlements = list(db.invoicesettlements.find({'invoiceNumber': test_inv.get('invoiceNumber')}))
print('Existing settlements count:', len(settlements))
for s in settlements:
    print('  Receipt:', s.get('receiptNo'), 'Amount:', s.get('amount'), 'Method:', s.get('method'), 'BalanceAfter:', s.get('balanceAfter'))

