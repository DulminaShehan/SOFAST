import re

with open('frontend/src/pages/Invoice/Invoice.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'api.get(' in line and 'invoice' in line.lower():
        print(f"Line {i+1}: {line.strip()}")

