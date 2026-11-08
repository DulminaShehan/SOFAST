import re

with open('frontend/src/pages/ManualInvoice/ManualInvoice.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find all api. calls
calls = re.findall(r'api\.\w+\([^)]+\)', content)
for c in calls:
    print(c)

