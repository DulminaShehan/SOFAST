/**
 * High-fidelity SVG-based sample attachments replicating Pages 2-4 of the provided PDF
 * 1. Page 2: EDL / CEB Mathugama Electricity Bill (Rs. 14,197.39)
 * 2. Page 3: SLT Mobitel Fiber Telephone & Internet Invoice (Rs. 5,458.24)
 * 3. Page 4: Dialog Mobile Bill SMS Screenshot on Nokia Phone (Rs. 922.56)
 */

export const SAMPLE_ATTACHMENTS = [
  {
    name: 'CEB_Electricity_Bill_Mathugama_OCT2026.png',
    type: 'image/svg+xml',
    category: 'Electricity Bill',
    size: 42100,
    dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 700" width="450" height="700">
  <rect width="100%" height="100%" fill="#ffffff" stroke="#cccccc" stroke-width="2"/>
  <rect x="0" y="0" width="100%" height="8" fill="#0284c7"/>
  
  <!-- EDL Logo Header -->
  <text x="225" y="45" font-family="'Courier New', monospace" font-size="28" font-weight="900" text-anchor="middle" fill="#0369a1" letter-spacing="4">EDL</text>
  <text x="225" y="65" font-family="'Courier New', monospace" font-size="11" text-anchor="middle" fill="#475569">Electricity Distribution Lanka (Pvt) Ltd</text>
  <text x="225" y="90" font-family="'Courier New', monospace" font-size="18" font-weight="bold" text-anchor="middle" fill="#0f172a" letter-spacing="2">Mathugama Area</text>
  
  <line x1="40" y1="105" x2="410" y2="105" stroke="#94a3b8" stroke-dasharray="4,4"/>

  <!-- Account Details -->
  <text x="50" y="130" font-family="'Courier New', monospace" font-size="13" font-weight="bold" fill="#0f172a">A/C No: 4413433203</text>
  <text x="50" y="150" font-family="'Courier New', monospace" font-size="12" fill="#334155">General-1P</text>
  <text x="50" y="170" font-family="'Courier New', monospace" font-size="14" font-weight="bold" fill="#0f172a">A. S. MUNASINGHE</text>
  <text x="50" y="190" font-family="'Courier New', monospace" font-size="12" fill="#334155">NO. 7E MADDEGODA RD MATHUGAMA.</text>
  <text x="50" y="210" font-family="'Courier New', monospace" font-size="12" fill="#334155">NO:03-02-080   SIN:M057</text>

  <line x1="40" y1="225" x2="410" y2="225" stroke="#cbd5e1"/>

  <!-- Bill breakdown -->
  <text x="50" y="250" font-family="'Courier New', monospace" font-size="13" fill="#334155">B/F:</text>
  <text x="400" y="250" font-family="'Courier New', monospace" font-size="13" text-anchor="end" fill="#0f172a">Rs. 14,342.52</text>
  <text x="50" y="270" font-family="'Courier New', monospace" font-size="13" fill="#334155">Payments:</text>
  <text x="400" y="270" font-family="'Courier New', monospace" font-size="13" text-anchor="end" fill="#0f172a">Rs. 14,340.00</text>
  <text x="50" y="290" font-family="'Courier New', monospace" font-size="13" fill="#334155">Outstanding:</text>
  <text x="400" y="290" font-family="'Courier New', monospace" font-size="13" text-anchor="end" fill="#0f172a">Rs. 2.52</text>

  <!-- Meter Reading -->
  <rect x="40" y="310" width="370" height="95" fill="#f8fafc" stroke="#e2e8f0"/>
  <text x="55" y="330" font-family="'Courier New', monospace" font-size="13" font-weight="bold" fill="#0f172a">THIS MONTH (2026-OCT)</text>
  <text x="55" y="350" font-family="'Courier New', monospace" font-size="12" fill="#475569">Reading Date: 2026/10/03 | Days: 31</text>
  <text x="55" y="370" font-family="'Courier New', monospace" font-size="12" fill="#475569">Meter No: 0419897</text>
  <text x="55" y="390" font-family="'Courier New', monospace" font-size="13" font-weight="bold" fill="#0369a1">Units / kWh: 17893 - 17553 = 340</text>

  <!-- Total Due Box -->
  <rect x="40" y="420" width="370" height="90" fill="#fef2f2" stroke="#f87171" stroke-width="1.5"/>
  <text x="55" y="445" font-family="'Courier New', monospace" font-size="13" fill="#334155">Charge: Rs. 13,840.00</text>
  <text x="55" y="465" font-family="'Courier New', monospace" font-size="13" fill="#334155">S.S.C. Levy: Rs. 354.87</text>
  <text x="55" y="492" font-family="'Courier New', monospace" font-size="18" font-weight="bold" fill="#b91c1c">TOTAL DUE: Rs. 14,197.39</text>

  <text x="225" y="535" font-family="'Courier New', monospace" font-size="13" text-anchor="middle" fill="#0f172a">Reg. Mobile : 076****946</text>

  <!-- Barcode -->
  <line x1="70" y1="565" x2="380" y2="565" stroke="#000" stroke-width="3" stroke-dasharray="10,4,6,3,12,5,8,3,10"/>
  <line x1="70" y1="575" x2="380" y2="575" stroke="#000" stroke-width="2" stroke-dasharray="6,3,10,4,4,8,12,3"/>
  <text x="225" y="600" font-family="'Courier New', monospace" font-size="14" font-weight="bold" text-anchor="middle">4413433203</text>
  
  <text x="225" y="630" font-family="'Courier New', monospace" font-size="12" text-anchor="middle" fill="#64748b">Printed 2026/10/03 11:07:44 am</text>
  <text x="225" y="650" font-family="'Courier New', monospace" font-size="13" font-weight="bold" text-anchor="middle" fill="#0284c7">⚡ CEB Assist Power System</text>
</svg>
`)}`,
  },
  {
    name: 'SLT_Mobitel_Invoice_Matugama_SEP2026.png',
    type: 'image/svg+xml',
    category: 'Telephone Bill',
    size: 51200,
    dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 700" width="500" height="700">
  <rect width="100%" height="100%" fill="#ffffff" stroke="#cccccc" stroke-width="2"/>
  
  <!-- Header Bar -->
  <rect x="0" y="0" width="100%" height="60" fill="#1e293b"/>
  <text x="20" y="32" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#ffffff">Sri Lanka Telecom PLC</text>
  <text x="20" y="48" font-family="Arial, sans-serif" font-size="10" fill="#94a3b8">Lotus Road, P.O. Box 503, Colombo 01. | SLT TIN: 294001727</text>
  <text x="480" y="40" font-family="Arial, sans-serif" font-size="16" font-weight="900" text-anchor="end" fill="#38bdf8">SLTMOBITEL</text>

  <!-- Title & Bill Info -->
  <text x="250" y="95" font-family="Arial, sans-serif" font-size="22" font-weight="bold" text-anchor="middle" fill="#0f172a">Invoice</text>
  
  <g font-family="Arial, sans-serif" font-size="11" fill="#334155">
    <text x="30" y="130">Invoice Date: 09/16/2026</text>
    <text x="30" y="150">Invoice Number: 26SEP_SLTNA0046164039_0697</text>
    <text x="30" y="170">Account Number: 004 616 4039</text>
    <text x="30" y="200" font-size="14" font-weight="bold" fill="#0284c7">TELEPHONE NUMBER: 0342210680</text>

    <text x="330" y="130" font-weight="bold">Sofast PVT</text>
    <text x="330" y="148">No. 7E</text>
    <text x="330" y="166">Maddegoda Road</text>
    <text x="330" y="184">Matugama 12100</text>
  </g>

  <!-- Summary of invoice banner -->
  <rect x="30" y="220" width="440" height="50" fill="#f1f5f9" rx="4"/>
  <text x="45" y="240" font-family="Arial, sans-serif" font-size="10" fill="#64748b">Charges for the period</text>
  <text x="45" y="260" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#0f172a">Rs. 5,458.24</text>
  <text x="410" y="250" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#0284c7">HOME FTTH</text>

  <!-- Table Details of charges -->
  <text x="30" y="300" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#0f172a">DETAILS OF CHARGES FOR THE PERIOD</text>
  <line x1="30" y1="310" x2="470" y2="310" stroke="#0284c7" stroke-width="2"/>

  <g font-family="Arial, sans-serif" font-size="11" fill="#1e293b">
    <text x="35" y="335">SLT BroadBand Service Any Tide (Rental)</text>
    <text x="460" y="335" text-anchor="end">3,890.00</text>

    <text x="35" y="360">Data Usage Report Fee</text>
    <text x="460" y="360" text-anchor="end">100.00</text>

    <text x="35" y="385">Fiber Access Home DP BB Customer Phone</text>
    <text x="460" y="385" text-anchor="end">430.00</text>

    <text x="35" y="410">Taxes &amp; Levies</text>
    <text x="460" y="410" text-anchor="end">1,038.24</text>
  </g>

  <!-- Highlight Total Charges Row -->
  <rect x="30" y="435" width="440" height="35" fill="#e0f2fe" stroke="#38bdf8"/>
  <text x="45" y="458" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#0369a1">Total Charges for the Period</text>
  <text x="460" y="458" font-family="Arial, sans-serif" font-size="16" font-weight="900" text-anchor="end" fill="#0284c7">5,458.24</text>

  <!-- Payment Slip portion at bottom -->
  <line x1="30" y1="500" x2="470" y2="500" stroke="#94a3b8" stroke-dasharray="4,4"/>
  <text x="250" y="525" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="#475569">PAYMENT SLIP</text>
  <text x="40" y="555" font-family="Arial, sans-serif" font-size="11" fill="#334155">Customer Name: Sofast PVT</text>
  <text x="40" y="575" font-family="Arial, sans-serif" font-size="11" fill="#334155">Account No: 004 616 4039</text>
  <text x="40" y="595" font-family="Arial, sans-serif" font-size="11" fill="#334155">Cheque / Cash Amount: Rs. 5,460.00</text>
  
  <rect x="330" y="540" width="130" height="70" fill="#f8fafc" stroke="#cbd5e1"/>
  <text x="395" y="580" font-family="Arial, sans-serif" font-size="10" text-anchor="middle" fill="#94a3b8">Bank Stamp / Slip</text>
</svg>
`)}`,
  },
  {
    name: 'Dialog_Mobile_Bill_SMS_Photo.png',
    type: 'image/svg+xml',
    category: 'Mobile / SMS Bill',
    size: 38700,
    dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 350 620" width="350" height="620">
  <!-- Background table surface -->
  <rect width="100%" height="100%" fill="#1e3a8a"/>
  
  <!-- Classic Nokia Phone Body -->
  <rect x="35" y="25" width="280" height="570" rx="45" ry="45" fill="#1e293b" stroke="#0f172a" stroke-width="4"/>
  <rect x="42" y="32" width="266" height="556" rx="40" ry="40" fill="#334155"/>
  
  <!-- Speaker earpiece -->
  <rect x="135" y="45" width="80" height="6" rx="3" fill="#0f172a"/>
  <text x="175" y="70" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="#cbd5e1" letter-spacing="3">NOKIA</text>

  <!-- Screen Frame -->
  <rect x="65" y="85" width="220" height="195" rx="10" fill="#0f172a" stroke="#1e293b" stroke-width="3"/>
  <!-- Screen LCD Area -->
  <rect x="72" y="92" width="206" height="181" rx="6" fill="#1e293b"/>
  
  <!-- Top bar status icons -->
  <text x="80" y="108" font-family="monospace" font-size="11" fill="#38bdf8">📶 Dialog</text>
  <rect x="250" y="99" width="18" height="10" fill="none" stroke="#38bdf8" stroke-width="1.5"/>
  <rect x="252" y="101" width="10" height="6" fill="#38bdf8"/>

  <!-- SMS Message Body -->
  <g font-family="Arial, sans-serif" font-size="12" fill="#ffffff">
    <text x="82" y="132" font-weight="bold">Dialog</text>
    <text x="82" y="152">Your last month</text>
    <text x="82" y="170" font-weight="bold" fill="#fde047">bill is Rs. 922.56,</text>
    <text x="82" y="190">Total Usage</text>
    <text x="82" y="208">amount as at</text>
    <text x="82" y="226">10/04 is Rs.</text>
    <text x="82" y="244" font-weight="bold" fill="#fde047">922.56. Pre Paid</text>
  </g>
  <rect x="75" y="255" width="60" height="15" fill="#38bdf8" rx="2"/>
  <text x="105" y="266" font-family="Arial, sans-serif" font-size="9" font-weight="bold" text-anchor="middle" fill="#0f172a">Read</text>

  <!-- Nokia Keypad -->
  <!-- Navigation / Menu Keys -->
  <rect x="135" y="295" width="80" height="12" rx="6" fill="#475569"/>
  <circle x="175" y="325" r="14" fill="#0f172a" stroke="#64748b" stroke-width="2"/>
  <rect x="80" y="315" width="35" height="18" rx="6" fill="#475569"/>
  <rect x="235" y="315" width="35" height="18" rx="6" fill="#475569"/>

  <!-- Number Keys Grid -->
  <g font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle">
    <!-- Row 1 -->
    <rect x="75" y="350" width="55" height="32" rx="8" fill="#1e293b" stroke="#475569"/>
    <text x="102" y="372">1 ➿</text>
    <rect x="147" y="350" width="55" height="32" rx="8" fill="#1e293b" stroke="#475569"/>
    <text x="175" y="372">2 abc</text>
    <rect x="220" y="350" width="55" height="32" rx="8" fill="#1e293b" stroke="#475569"/>
    <text x="247" y="372">3 def</text>

    <!-- Row 2 -->
    <rect x="75" y="390" width="55" height="32" rx="8" fill="#1e293b" stroke="#475569"/>
    <text x="102" y="412">4 ghi</text>
    <rect x="147" y="390" width="55" height="32" rx="8" fill="#1e293b" stroke="#475569"/>
    <text x="175" y="412">5 jkl</text>
    <rect x="220" y="390" width="55" height="32" rx="8" fill="#1e293b" stroke="#475569"/>
    <text x="247" y="412">6 mno</text>

    <!-- Row 3 -->
    <rect x="75" y="430" width="55" height="32" rx="8" fill="#1e293b" stroke="#475569"/>
    <text x="102" y="452">7 pqrs</text>
    <rect x="147" y="430" width="55" height="32" rx="8" fill="#1e293b" stroke="#475569"/>
    <text x="175" y="452">8 tuv</text>
    <rect x="220" y="430" width="55" height="32" rx="8" fill="#1e293b" stroke="#475569"/>
    <text x="247" y="452">9 wxyz</text>

    <!-- Row 4 -->
    <rect x="75" y="470" width="55" height="32" rx="8" fill="#1e293b" stroke="#475569"/>
    <text x="102" y="492">* +</text>
    <rect x="147" y="470" width="55" height="32" rx="8" fill="#1e293b" stroke="#475569"/>
    <text x="175" y="492">0 ␣</text>
    <rect x="220" y="470" width="55" height="32" rx="8" fill="#1e293b" stroke="#475569"/>
    <text x="247" y="492">#</text>
  </g>
</svg>
`)}`,
  },
];
