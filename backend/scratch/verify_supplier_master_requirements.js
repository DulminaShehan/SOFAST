const API_BASE = 'http://localhost:5000/api/suppliers';

async function runTests() {
  console.log('--- Starting Comprehensive Supplier Master Functional Verification ---\n');

  // Test 1: Fetch Next Code
  console.log('1. Testing GET /next-code...');
  const nextCodeRes = await fetch(`${API_BASE}/next-code`).then((r) => r.json());
  console.log('Next Code Response:', nextCodeRes);
  if (!nextCodeRes.success || !nextCodeRes.nextCode) {
    throw new Error('Next code generation failed');
  }
  const autoCode = nextCodeRes.nextCode;
  console.log(`Auto-generated Code: ${autoCode} [PASS]\n`);

  // Test 2: Validation - Missing Code
  console.log('2. Testing Validation: Missing Supplier Code...');
  const noCodeRes = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: '', name: 'Test Supplier' }),
  });
  const noCodeJson = await noCodeRes.json();
  console.log('Missing Code Response:', noCodeJson);
  if (noCodeRes.status !== 400 || !noCodeJson.message.includes('Code')) {
    throw new Error('Missing code validation failed');
  }
  console.log('[PASS] Missing code rejected.\n');

  // Test 3: Validation - Missing Name
  console.log('3. Testing Validation: Missing Supplier Name...');
  const noNameRes = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'SUP-NEW-01', name: '' }),
  });
  const noNameJson = await noNameRes.json();
  console.log('Missing Name Response:', noNameJson);
  if (noNameRes.status !== 400 || !noNameJson.message.includes('Name')) {
    throw new Error('Missing name validation failed');
  }
  console.log('[PASS] Missing name rejected.\n');

  // Test 4: Create a New Supplier
  console.log('4. Testing POST / (Create New Supplier)...');
  const testPayload = {
    code: autoCode,
    name: 'Auto Speed Enterprises (Pvt) Ltd',
    address: 'No. 45, High Level Road, Colombo 06',
    telephone1: '0112888999',
    telephone2: '0777123456',
  };
  const createRes = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testPayload),
  });
  const createJson = await createRes.json();
  console.log('Create Response:', createJson);
  if (!createJson.success || !createJson.data?._id) {
    throw new Error('Failed to create supplier');
  }
  const createdId = createJson.data._id;
  console.log(`[PASS] Supplier created with _id: ${createdId}\n`);

  // Test 5: Validation - Duplicate Code Prevention
  console.log('5. Testing Validation: Prevent Duplicate Code...');
  const dupRes = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testPayload),
  });
  const dupJson = await dupRes.json();
  console.log('Duplicate Code Response:', dupJson);
  if (dupRes.status !== 400 || !dupJson.message.includes('already exists')) {
    throw new Error('Duplicate code validation failed');
  }
  console.log('[PASS] Duplicate code successfully prevented.\n');

  // Test 6: Fetch All Suppliers & Verify Presence
  console.log('6. Testing GET / (List Suppliers)...');
  const listRes = await fetch(API_BASE).then((r) => r.json());
  console.log(`Suppliers count in DB: ${listRes.count}`);
  const found = listRes.data.find((s) => s.code === autoCode);
  if (!found) {
    throw new Error(`Newly created supplier with code ${autoCode} not found in listing`);
  }
  console.log(`Found supplier: ${found.code} - ${found.name} [PASS]\n`);

  // Test 7: Update Supplier
  console.log('7. Testing PUT /:id (Update Supplier Details)...');
  const updatePayload = {
    code: autoCode,
    name: 'Auto Speed Enterprises PLC',
    address: 'No. 88, Galle Road, Colombo 03',
    telephone1: '0112888999',
    telephone2: '0711999888',
  };
  const updateRes = await fetch(`${API_BASE}/${createdId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatePayload),
  });
  const updateJson = await updateRes.json();
  console.log('Update Response:', updateJson);
  if (!updateJson.success || updateJson.data.name !== 'Auto Speed Enterprises PLC') {
    throw new Error('Failed to update supplier');
  }
  console.log('[PASS] Supplier details updated.\n');

  // Test 8: Safe Deletion Behavior for Referenced Supplier (e.g., SUP-001 in GRNs)
  console.log('8. Testing Safe Deletion on Supplier with GRN references (SUP-001)...');
  const sup001 = listRes.data.find((s) => s.code === 'SUP-001');
  if (sup001) {
    const delReferencedRes = await fetch(`${API_BASE}/${sup001._id}`, { method: 'DELETE' });
    const delReferencedJson = await delReferencedRes.json();
    console.log('Referenced Supplier Delete Response:', delReferencedJson);
    if (!delReferencedJson.success || !delReferencedJson.isDeactivated) {
      throw new Error('Referenced supplier was not safely deactivated');
    }
    console.log('[PASS] Referenced supplier safely deactivated to preserve historical transactions.\n');
    
    // Restore status back to 'A' so existing tests remain intact
    await fetch(`${API_BASE}/${sup001._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: sup001.code, name: sup001.name, status: 'A' }),
    });
  }

  // Test 9: Complete Deletion of Unreferenced Test Supplier
  console.log('9. Testing Permanent Deletion of Unreferenced Test Supplier...');
  const delTestRes = await fetch(`${API_BASE}/${createdId}`, { method: 'DELETE' });
  const delTestJson = await delTestRes.json();
  console.log('Unreferenced Delete Response:', delTestJson);
  if (!delTestJson.success || delTestJson.isDeactivated) {
    throw new Error('Failed to permanently delete unreferenced supplier');
  }
  console.log('[PASS] Unreferenced supplier cleanly deleted.\n');

  // Test 10: Verify DB State and Integrity
  console.log('10. Final check: Verifying database state...');
  const finalListRes = await fetch(API_BASE).then((r) => r.json());
  console.log(`Final supplier count: ${finalListRes.count}`);
  const notFoundAnymore = finalListRes.data.find((s) => s.code === autoCode);
  if (notFoundAnymore) {
    throw new Error('Deleted test supplier still exists in database');
  }
  console.log('[PASS] Clean database state verified.\n');

  console.log('=== ALL SUPPLIER REGISTER ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY! ===');
}

runTests().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
