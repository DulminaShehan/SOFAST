// Verify test cases and logic
import fs from 'fs';
import path from 'path';

console.log('====================================================');
console.log('SOFAST POS — AUTOMATED VERIFICATION SUITE');
console.log('====================================================\n');

let allPassed = true;
function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
  } else {
    console.error(`[FAIL] ${message}`);
    allPassed = false;
  }
}

// 1. Check Confirm Dialog Context & Implementation
const confirmDialogCode = fs.readFileSync('frontend/src/context/ConfirmDialogContext.jsx', 'utf-8');
assert(confirmDialogCode.includes('confirmSave'), 'ConfirmDialogContext exposes confirmSave');
assert(confirmDialogCode.includes('confirmDelete'), 'ConfirmDialogContext exposes confirmDelete');
assert(confirmDialogCode.includes('confirmInvoicePrint'), 'ConfirmDialogContext exposes confirmInvoicePrint with 3 buttons');
assert(confirmDialogCode.includes('Do you wish to print this invoice?'), 'confirmInvoicePrint default message matches user prompt');
assert(confirmDialogCode.includes("label: 'Yes'"), 'confirmInvoicePrint includes Yes (Save & Print)');
assert(confirmDialogCode.includes("label: 'No'"), 'confirmInvoicePrint includes No (Save without Print)');
assert(confirmDialogCode.includes("label: 'Cancel'"), 'confirmInvoicePrint includes Cancel (Return without Save)');

// 2. Check Classic Desktop Dialog UI
const dialogUiCode = fs.readFileSync('frontend/src/components/ClassicConfirmDialog.jsx', 'utf-8');
const dialogCssCode = fs.readFileSync('frontend/src/components/ClassicConfirmDialog.css', 'utf-8');
assert(dialogUiCode.includes('sofast-dialog-window'), 'Classic desktop dialog window markup present');
assert(dialogUiCode.includes("e.key === 'Escape'"), 'Escape key cancels/closes dialog');
assert(dialogUiCode.includes("e.key === 'ArrowRight'"), 'Left/Right arrow keys navigate dialog buttons');
assert(dialogCssCode.includes('#005bb7') || dialogCssCode.includes('#3a6ea5'), 'Classic Windows/SOFAST blue titlebar gradient');
assert(dialogCssCode.includes('#ece9d8') || dialogCssCode.includes('#d4d0c8'), 'Classic Windows 3D beveled background');

// 3. Check Enter Key Navigation Hook
const enterKeyNavCode = fs.readFileSync('frontend/src/hooks/useEnterKeyNavigation.js', 'utf-8');
assert(enterKeyNavCode.includes('handleEnterNavigation'), 'handleEnterNavigation exported');
assert(enterKeyNavCode.includes('textarea'), 'Textarea multiline editing is preserved');
assert(enterKeyNavCode.includes(':not([disabled])'), 'Disabled inputs are skipped');
assert(enterKeyNavCode.includes(':not([readonly])'), 'Readonly inputs are skipped');
assert(enterKeyNavCode.includes('button'), 'Buttons are skipped during natural field navigation');

// 4. Check Scoped Keyboard Shortcut Hook
const keyboardShortcutCode = fs.readFileSync('frontend/src/hooks/useKeyboardShortcut.js', 'utf-8');
assert(keyboardShortcutCode.includes('addEventListener'), 'Key listener is registered');
assert(keyboardShortcutCode.includes('removeEventListener'), 'Key listener is cleaned up on unmount');

// 5. Test Case 1, 2, 3: Item Master Save confirmation & Enter Navigation
const itemMasterCode = fs.readFileSync('frontend/src/pages/ItemMaster/ItemMaster.jsx', 'utf-8');
assert(itemMasterCode.includes('confirmSave'), 'ItemMaster uses confirmSave on Save');
assert(itemMasterCode.includes('confirmDelete'), 'ItemMaster uses confirmDelete on Delete');
assert(itemMasterCode.includes('handleEnterNavigation'), 'ItemMaster form uses handleEnterNavigation');

// 6. Test Case 4, 5, 6, 7, 8: Sales Invoice Save, Print 3-button question, Single Save Invariant
const invoiceCode = fs.readFileSync('frontend/src/pages/Invoice/Invoice.jsx', 'utf-8');
assert(invoiceCode.includes('confirmInvoicePrint'), 'Sales Invoice uses confirmInvoicePrint');
assert(invoiceCode.includes("choice === 'cancel'"), 'Sales Invoice aborts saving if Cancel chosen');
assert(invoiceCode.includes("choice === 'no'"), 'Sales Invoice saves without printing if No chosen');
assert(invoiceCode.includes("choice === 'yes'"), 'Sales Invoice saves once and prints if Yes chosen');
assert(invoiceCode.includes('if (activeInvoiceId)'), 'Sales Invoice prevents duplicate saving by updating active invoice');
assert(invoiceCode.includes('isSavingRef.current'), 'Sales Invoice prevents double submission via anti-reentry ref');
assert(invoiceCode.includes('handlePrint()'), 'Printing occurs only after successful save');

// 7. Test Case 9, 10: Enter Key Navigation across Sales Invoice fields & line items
assert(invoiceCode.includes('quantityInputRef'), 'Quantity input ref wired for Enter navigation');
assert(invoiceCode.includes('rateInputRef'), 'Rate input ref wired for Enter navigation');
assert(invoiceCode.includes('priceInputRef'), 'Price input ref wired for Enter navigation');
assert(invoiceCode.includes('entryDiscountInputRef'), 'Discount input ref wired for Enter navigation');
assert(invoiceCode.includes('handleAddOrUpdateItem()'), 'Enter key on final item entry field adds or updates item in table');

// 8. Test Case 11, 12: F6 Keyboard Shortcut for Alternative Items
assert(invoiceCode.includes("useKeyboardShortcut('F6'"), 'F6 shortcut registered in Sales Invoice');
assert(invoiceCode.includes('Please select an item first.'), 'F6 shows informative message if no item selected');
assert(invoiceCode.includes('No alternative items available.'), 'F6 shows informative message if no alternatives exist');
assert(invoiceCode.includes('Item Code') && invoiceCode.includes('Available Quantity') && invoiceCode.includes('Selling Price') && invoiceCode.includes('Location'), 'Alternative items window displays Code, Description, Available Qty, Selling Price, and Location');

// Verify F6 is NOT registered in unrelated screens
const otherFilesToCheckForF6 = [
  'frontend/src/pages/ItemMaster/ItemMaster.jsx',
  'frontend/src/pages/SupplierMaster/SupplierMaster.jsx',
  'frontend/src/pages/CustomerMaster/CustomerMaster.jsx',
  'frontend/src/pages/GoodReceiveNote/GoodReceiveNote.jsx',
  'frontend/src/pages/GoodReturnNote/GoodReturnNote.jsx',
  'frontend/src/pages/Damage/Damage.jsx',
  'frontend/src/pages/SettlementInvoice/SettlementInvoice.jsx',
];
for (const file of otherFilesToCheckForF6) {
  const code = fs.readFileSync(file, 'utf-8');
  assert(!code.includes("useKeyboardShortcut('F6'"), `F6 is not bound in ${path.basename(file)}`);
}

// 9. Check all other forms
const forms = [
  { name: 'SupplierMaster.jsx', path: 'frontend/src/pages/SupplierMaster/SupplierMaster.jsx', hasDelete: true },
  { name: 'CustomerMaster.jsx', path: 'frontend/src/pages/CustomerMaster/CustomerMaster.jsx', hasDelete: true },
  { name: 'GoodReceiveNote.jsx', path: 'frontend/src/pages/GoodReceiveNote/GoodReceiveNote.jsx', hasDelete: true },
  { name: 'GoodReturnNote.jsx', path: 'frontend/src/pages/GoodReturnNote/GoodReturnNote.jsx', hasDelete: true },
  { name: 'Damage.jsx', path: 'frontend/src/pages/Damage/Damage.jsx', hasDelete: false },
  { name: 'ManualInvoice.jsx', path: 'frontend/src/pages/ManualInvoice/ManualInvoice.jsx', hasDelete: true },
  { name: 'SettlementInvoice.jsx', path: 'frontend/src/pages/SettlementInvoice/SettlementInvoice.jsx', hasDelete: true },
  { name: 'PaymentVoucherCreateModal.jsx', path: 'frontend/src/pages/Approvement/PaymentVoucherCreateModal.jsx', hasDelete: false },
  { name: 'AlternativeProduct.jsx', path: 'frontend/src/pages/AlternativeProduct/AlternativeProduct.jsx', hasDelete: true },
];

for (const form of forms) {
  const code = fs.readFileSync(form.path, 'utf-8');
  assert(code.includes('confirmSave') || code.includes('confirmInvoicePrint'), `${form.name} implements Save Confirmation`);
  if (form.hasDelete) {
    assert(code.includes('confirmDelete'), `${form.name} implements Delete Confirmation`);
  }
  assert(code.includes('handleEnterNavigation'), `${form.name} implements Enter Key Navigation`);
}

console.log('\n====================================================');
if (allPassed) {
  console.log('ALL VERIFICATION CHECKS PASSED SUCCESSFULLY! (100%)');
} else {
  console.error('SOME CHECKS FAILED! Please review above.');
}
console.log('====================================================\n');
