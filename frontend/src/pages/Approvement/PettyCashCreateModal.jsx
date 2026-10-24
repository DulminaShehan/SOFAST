import React, { useState, useRef } from 'react';
import './ExpensesReimbursementSheet.css';

/**
 * PettyCashCreateModal
 * Displays the exact physical EXPENSES REIMBURSEMENT FORM sheet from Page 1 of the PDF.
 * Allows adding multiple expenses in one go, typing directly on the paper sheet lines,
 * attaching receipts/bills, and submitting for approval with automatic spendable fund balance tracking.
 */
function PettyCashCreateModal({ isOpen, onClose, onSubmit, currentUser, spendableLimit }) {
  if (!isOpen) return null;

  const todayStr = new Date().toLocaleDateString('en-GB');

  // Top Sheet Fields
  const [name, setName] = useState(currentUser?.name || currentUser?.username || 'Sunil Shantha');
  const [dateFormatted, setDateFormatted] = useState(todayStr);
  const [subject, setSubject] = useState('');
  const [reimbursementDate, setReimbursementDate] = useState(todayStr);

  // Multiple Expense Items (one-time can add multiple expenses)
  const [items, setItems] = useState([
    { description: 'Workshop Consumables & Fasteners', amount: '1850' },
    { description: '', amount: '' },
  ]);

  // 3 Dotted Notes Lines on PDF
  const [notesLine1, setNotesLine1] = useState('Urgent consumables required for morning mechanical repairs.');
  const [notesLine2, setNotesLine2] = useState('');
  const [notesLine3, setNotesLine3] = useState('');

  // Attachments / Receipts
  const [attachments, setAttachments] = useState([]);
  const [showReceiptsPanel, setShowReceiptsPanel] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Refs for smooth auto-focusing on Enter
  const itemInputsRef = useRef([]);

  // Auto-calculated total
  const totalAmount = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  // Check spendable balance
  const remainingFund = spendableLimit ? Number(spendableLimit.remainingLimit) || 50000 : 50000;
  const isOverFund = totalAmount > remainingFund;

  // Add new expense row
  const handleAddItem = () => {
    setItems((prev) => [...prev, { description: '', amount: '' }]);
    setTimeout(() => {
      const nextIdx = items.length;
      if (itemInputsRef.current[nextIdx]?.desc) {
        itemInputsRef.current[nextIdx].desc.focus();
      }
    }, 50);
  };

  // Remove expense row
  const handleRemoveItem = (index) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Update item field
  const handleItemChange = (index, field, value) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Handle Enter key on amount input: auto-adds next expense row
  const handleAmountKeyDown = (e, idx) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (idx === items.length - 1) {
        handleAddItem();
      } else if (itemInputsRef.current[idx + 1]?.desc) {
        itemInputsRef.current[idx + 1].desc.focus();
      }
    }
  };

  // Quick Preset Handlers (1-click populates multiple realistic expenses)
  const handleApplyPreset = (presetSubject, presetItems, presetNotes) => {
    setSubject(presetSubject);
    setItems(presetItems);
    setNotesLine1(presetNotes || '');
    setNotesLine2('');
    setNotesLine3('');
    setValidationError('');
  };

  // File Upload for Proof of Payment Receipts
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            type: file.type || 'image/jpeg',
            size: file.size,
            dataUrl: uploadEvent.target.result,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Sample quick bill attachments
  const handleAddSampleBill = (billType) => {
    const sampleBills = {
      fuel: {
        name: 'CEPETCO_Fuel_Receipt_Slip.jpg',
        type: 'image/jpeg',
        size: 45200,
        dataUrl:
          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%23f8fafc" stroke="%23cbd5e1" stroke-width="2"/><text x="150" y="40" font-family="Arial" font-weight="bold" font-size="16" text-anchor="middle" fill="%23b91c1c">CEPETCO FUEL STATION</text><text x="150" y="70" font-family="Arial" font-size="13" text-anchor="middle" fill="%23334155">Auto Diesel - 10.5 Litres</text><text x="150" y="105" font-family="Arial Black" font-size="18" text-anchor="middle" fill="%230f172a">Rs. 3,500.00</text><text x="150" y="140" font-family="Arial" font-size="11" text-anchor="middle" fill="%2364748b">Slip No: 98124 - Cash Paid</text></svg>',
      },
      refreshments: {
        name: 'BakeHouse_Refreshments_Receipt.jpg',
        type: 'image/jpeg',
        size: 38100,
        dataUrl:
          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%23f8fafc" stroke="%23cbd5e1" stroke-width="2"/><text x="150" y="40" font-family="Arial" font-weight="bold" font-size="16" text-anchor="middle" fill="%23ea580c">BAKE HOUSE MATUGAMA</text><text x="150" y="70" font-family="Arial" font-size="13" text-anchor="middle" fill="%23334155">Staff Tea &amp; Evening Pastries</text><text x="150" y="105" font-family="Arial Black" font-size="18" text-anchor="middle" fill="%230f172a">Rs. 2,200.00</text><text x="150" y="140" font-family="Arial" font-size="11" text-anchor="middle" fill="%2364748b">Receipt No: BH-4491</text></svg>',
      },
      stationery: {
        name: 'Apex_Stationery_Invoice.jpg',
        type: 'image/jpeg',
        size: 49800,
        dataUrl:
          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%23f8fafc" stroke="%23cbd5e1" stroke-width="2"/><text x="150" y="40" font-family="Arial" font-weight="bold" font-size="16" text-anchor="middle" fill="%232563eb">APEX PRINTERS &amp; STATIONERS</text><text x="150" y="70" font-family="Arial" font-size="13" text-anchor="middle" fill="%23334155">Thermal Rolls + Box Files</text><text x="150" y="105" font-family="Arial Black" font-size="18" text-anchor="middle" fill="%230f172a">Rs. 4,500.00</text><text x="150" y="140" font-family="Arial" font-size="11" text-anchor="middle" fill="%2364748b">Inv: AP-8802 - Tax Invoice</text></svg>',
      },
    };

    if (sampleBills[billType]) {
      setAttachments((prev) => [...prev, sampleBills[billType]]);
      setShowReceiptsPanel(true);
    }
  };

  const handleRemoveAttachment = (idx) => {
    setAttachments(attachments.filter((_, i) => i !== idx));
  };

  // Form submission
  const handleFormSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setValidationError('');

    if (!name.trim()) {
      setValidationError('Employee / Requester Name is required');
      return;
    }
    if (!subject.trim()) {
      setValidationError('Subject / Purpose of expense is required');
      return;
    }

    const validItems = items.filter(
      (item) => item.description && item.description.trim() !== '' && Number(item.amount) > 0
    );

    if (validItems.length === 0) {
      setValidationError('Please add at least one expense with description and amount greater than 0');
      return;
    }

    const combinedNotes = [notesLine1, notesLine2, notesLine3]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(' ');

    try {
      setIsSubmitting(true);
      await onSubmit({
        name: name.trim(),
        dateFormatted,
        subject: subject.trim(),
        reimbursementDate,
        items: validItems.map((item) => ({
          description: item.description.trim(),
          amount: Number(item.amount),
        })),
        amount: totalAmount,
        notes: combinedNotes,
        requestedBy: name.trim(),
        checkedBy: 'Accountant',
        department: 'General',
        category: 'Office Supplies',
        purpose: subject.trim(),
        attachments,
      });
    } catch (err) {
      setValidationError(err.response?.data?.message || err.message || 'Failed to submit reimbursement form');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate empty filler rows to match the authentic paper height from the PDF
  const minDisplayRows = 5;
  const emptyRowsCount = Math.max(0, minDisplayRows - items.length);

  return (
    <div className="erf-create-modal-overlay" onClick={() => !isSubmitting && onClose()}>
      <div className="erf-create-modal-window" onClick={(e) => e.stopPropagation()}>
        {/* =========================================================================
            TOP DESK TOOLBAR (Non-Printing)
            ========================================================================= */}
        <div className="erf-modal-top-bar no-print">
          <div className="erf-top-left">
            <span style={{ fontSize: '18px' }}>📄</span>
            <div className="erf-top-title">Expenses Reimbursement Form &bull; Petty Cash</div>
            <div className={`erf-fund-pill ${isOverFund ? 'warning' : 'healthy'}`}>
              <span>{isOverFund ? '⚠️' : '💳'}</span>
              <span>
                Available Fund: Rs.{' '}
                {Number(remainingFund).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="erf-top-actions">
            <button
              type="button"
              className="erf-top-btn"
              onClick={() => setShowReceiptsPanel(!showReceiptsPanel)}
              title="Attach bill receipts, invoices or slips"
            >
              📎 Attached Receipts ({attachments.length})
            </button>
            <button
              type="button"
              className="erf-top-close-btn"
              onClick={onClose}
              disabled={isSubmitting}
              title="Close modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* =========================================================================
            QUICK PRESETS STRIP (1-Click populate multiple realistic expense lines)
            ========================================================================= */}
        <div className="erf-presets-strip no-print">
          <span className="erf-presets-label">⚡ Multi-Expense Presets:</span>
          <button
            type="button"
            className="erf-preset-chip"
            onClick={() =>
              handleApplyPreset(
                'Delivery Van Fuel & Southern Expressway Tolls',
                [
                  { description: 'Delivery Van Auto Diesel (Matugama CEYPETCO)', amount: '3500' },
                  { description: 'Highway Southern Expressway Toll Slip', amount: '450' },
                ],
                'Urgent customer delivery of engine overhaul parts to Kalutara.'
              )
            }
          >
            ⛽ Van Fuel &amp; Toll (2 lines &bull; Rs. 3,950)
          </button>

          <button
            type="button"
            className="erf-preset-chip"
            onClick={() =>
              handleApplyPreset(
                'Workshop Overtime Technicians Refreshments & Water',
                [
                  { description: 'Technicians Evening Tea & Snacks (Saturday Shift)', amount: '2200' },
                  { description: 'Mineral Drinking Water Bottles (5L x 2)', amount: '1000' },
                  { description: 'Glucose & Biscuits for Heavy Work Shift', amount: '650' },
                ],
                'Overtime clutch servicing crew evening refreshments.'
              )
            }
          >
            ☕ Overtime Tea &amp; Snacks (3 lines &bull; Rs. 3,850)
          </button>

          <button
            type="button"
            className="erf-preset-chip"
            onClick={() =>
              handleApplyPreset(
                'POS Thermal Roll Refill & Cashier Stationery',
                [
                  { description: 'Thermal Paper Rolls (80mm x 50 rolls)', amount: '3500' },
                  { description: 'Gel Ink Pens & Invoice Filing Folders', amount: '1000' },
                ],
                'Weekend cashier invoice printer roll replenishment.'
              )
            }
          >
            📄 POS Thermal Paper &amp; Pens (2 lines &bull; Rs. 4,500)
          </button>

          <button
            type="button"
            className="erf-preset-chip"
            onClick={() =>
              handleApplyPreset(
                'Mechanical Workshop Fasteners, Drill Bits & Sandpaper',
                [
                  { description: 'High-tensile Grade 8.8 Hex Bolts & Lock Nuts', amount: '1850' },
                  { description: 'Cobalt Drill Bit Set (4mm, 6mm, 8mm)', amount: '1600' },
                  { description: 'Waterproof Emery Sandpaper 400 & 800 Grit', amount: '450' },
                ],
                'Emergency consumables for engine maintenance overhaul bench.'
              )
            }
          >
            🔩 Bolts, Bits &amp; Consumables (3 lines &bull; Rs. 3,900)
          </button>
        </div>

        {/* Validation Error Banner */}
        {validationError && (
          <div className="erf-val-alert no-print">
            ⚠️ {validationError}
          </div>
        )}

        {/* =========================================================================
            THE EXACT PHYSICAL EXPENSES REIMBURSEMENT FORM SHEET (MATCHING PDF PAGE 1)
            ========================================================================= */}
        <div className="erf-paper-container" id="printable-erf-sheet">
          {/* Document Header Area */}
          <div className="erf-header-area">
            {/* Logo badge with circular beads matching the PDF Page 1 */}
            <div className="erf-logo-badge">
              <svg viewBox="0 0 160 85" className="erf-badge-svg" xmlns="http://www.w3.org/2000/svg">
                {/* Outer decorative pearl / dot chain */}
                <g fill="#000000">
                  <circle cx="20" cy="40" r="4.5" />
                  <circle cx="23" cy="28" r="4.5" />
                  <circle cx="30" cy="18" r="4.5" />
                  <circle cx="42" cy="11" r="4.5" />
                  <circle cx="56" cy="8" r="4.5" />
                  <circle cx="70" cy="8" r="4.5" />
                  <circle cx="84" cy="8" r="4.5" />
                  <circle cx="98" cy="8" r="4.5" />
                  <circle cx="112" cy="8" r="4.5" />
                  <circle cx="126" cy="11" r="4.5" />
                  <circle cx="138" cy="18" r="4.5" />
                  <circle cx="145" cy="28" r="4.5" />
                  <circle cx="148" cy="40" r="4.5" />
                  <circle cx="145" cy="52" r="4.5" />
                  <circle cx="138" cy="62" r="4.5" />
                  <circle cx="126" cy="69" r="4.5" />
                  <circle cx="112" cy="72" r="4.5" />
                  <circle cx="98" cy="72" r="4.5" />
                  <circle cx="84" cy="72" r="4.5" />
                  <circle cx="70" cy="72" r="4.5" />
                  <circle cx="56" cy="72" r="4.5" />
                  <circle cx="42" cy="69" r="4.5" />
                  <circle cx="30" cy="62" r="4.5" />
                  <circle cx="23" cy="52" r="4.5" />
                </g>

                {/* Scalloped inner border */}
                <rect
                  x="28"
                  y="14"
                  width="112"
                  height="52"
                  rx="18"
                  fill="none"
                  stroke="#000000"
                  strokeWidth="2"
                />

                {/* Vertical center divider line */}
                <line x1="84" y1="16" x2="84" y2="64" stroke="#000000" strokeWidth="1.5" />

                {/* "SO" Text */}
                <text
                  x="56"
                  y="48"
                  fontFamily="'Arial Black', Impact, sans-serif"
                  fontSize="24"
                  fontWeight="900"
                  textAnchor="middle"
                  fill="#000000"
                >
                  SO
                </text>

                {/* "FAST" Text */}
                <text
                  x="112"
                  y="48"
                  fontFamily="'Arial Black', Impact, sans-serif"
                  fontSize="22"
                  fontWeight="900"
                  textAnchor="middle"
                  fill="#000000"
                >
                  FAST
                </text>
              </svg>
            </div>

            <div className="erf-company-sub">MOTORS</div>
            <div className="erf-location-title">Matugama</div>

            <div className="erf-contact-line">
              No : 11/7/F/3, Werellahena, Horana &nbsp;|&nbsp; Email : info@sofast.lk &nbsp;|&nbsp; Web : www.sofast.lk
            </div>

            {/* Bordered Box Title matching PDF */}
            <div className="erf-title-box">
              <h1 className="erf-title-text">EXPENSES REIMBURSEMENT FORM</h1>
            </div>
          </div>

          {/* Dotted Underline Fields Matching PDF Exactly */}
          <div className="erf-fields-block">
            {/* Name */}
            <div className="erf-field-row name-row">
              <span className="erf-field-label">Name</span>
              <span className="erf-field-colon">:</span>
              <div className="erf-field-line-wrapper">
                <input
                  type="text"
                  className="erf-dotted-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter employee / requester name"
                  required
                />
              </div>
            </div>

            {/* Date */}
            <div className="erf-field-row date-row">
              <span className="erf-field-label">Date</span>
              <span className="erf-field-colon">:</span>
              <div className="erf-field-line-wrapper">
                <input
                  type="text"
                  className="erf-dotted-input"
                  value={dateFormatted}
                  onChange={(e) => setDateFormatted(e.target.value)}
                  placeholder="DD/MM/YYYY"
                  required
                />
              </div>
            </div>

            {/* Subject */}
            <div className="erf-field-row subject-row">
              <span className="erf-field-label">Subject</span>
              <span className="erf-field-colon">:</span>
              <div className="erf-field-line-wrapper">
                <input
                  type="text"
                  className="erf-dotted-input"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Delivery Van Fuel, Refreshments, Workshop Hardware"
                  required
                />
              </div>
            </div>

            {/* Remburshment Date */}
            <div className="erf-field-row reimb-date-row">
              <span className="erf-field-label">Remburshment Date</span>
              <span className="erf-field-colon">:</span>
              <div className="erf-field-line-wrapper">
                <input
                  type="text"
                  className="erf-dotted-input"
                  value={reimbursementDate}
                  onChange={(e) => setReimbursementDate(e.target.value)}
                  placeholder="DD/MM/YYYY"
                  required
                />
              </div>
            </div>
          </div>

          {/* =========================================================================
              EXPENSES TABLE (SUPPORTS MULTIPLE EXPENSES AT ONCE)
              ========================================================================= */}
          <div className="erf-table-container">
            <table className="erf-table">
              <thead>
                <tr>
                  <th className="col-desc">Description</th>
                  <th className="col-amount">Amount (Rs.)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index} className="erf-editable-row">
                    <td className="col-desc">
                      <input
                        ref={(el) => {
                          if (!itemInputsRef.current[index]) itemInputsRef.current[index] = {};
                          itemInputsRef.current[index].desc = el;
                        }}
                        type="text"
                        className="erf-table-input"
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        placeholder={`Expense item description #${index + 1}`}
                        required
                      />
                    </td>
                    <td className="col-amount">
                      <div className="erf-amount-cell-inner">
                        <input
                          ref={(el) => {
                            if (!itemInputsRef.current[index]) itemInputsRef.current[index] = {};
                            itemInputsRef.current[index].amount = el;
                          }}
                          type="number"
                          step="any"
                          min="0"
                          className="erf-table-input amount"
                          value={item.amount}
                          onChange={(e) => handleItemChange(index, 'amount', e.target.value)}
                          onKeyDown={(e) => handleAmountKeyDown(e, index)}
                          placeholder="0.00"
                          required
                        />
                        {items.length > 1 && (
                          <button
                            type="button"
                            className="erf-row-delete-btn no-print"
                            onClick={() => handleRemoveItem(index)}
                            title="Remove this expense item"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {/* Blank empty rows to preserve authentic paper sheet look if < 5 items */}
                {Array.from({ length: emptyRowsCount }).map((_, idx) => (
                  <tr key={`empty-${idx}`} className="empty-row">
                    <td className="col-desc">&nbsp;</td>
                    <td className="col-amount">&nbsp;</td>
                  </tr>
                ))}

                {/* Total Row matching PDF */}
                <tr className="total-row">
                  <td className="total-label">Total</td>
                  <td className="total-value">
                    {Number(totalAmount).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Quick Action to Add Multiple Expense Items */}
            <div className="erf-add-line-row-wrap no-print">
              <button
                type="button"
                className="erf-add-line-btn"
                onClick={handleAddItem}
              >
                <span>+</span> Add Another Expense Line (Multiple Expenses Allowed)
              </button>
            </div>
          </div>

          {/* Three Dotted Notes Lines Below Table Matching PDF */}
          <div className="erf-notes-block">
            <div className="erf-dotted-line-row">
              <input
                type="text"
                className="erf-notes-input"
                value={notesLine1}
                onChange={(e) => setNotesLine1(e.target.value)}
                placeholder="Notes / Justification line 1..."
              />
            </div>
            <div className="erf-dotted-line-row">
              <input
                type="text"
                className="erf-notes-input"
                value={notesLine2}
                onChange={(e) => setNotesLine2(e.target.value)}
                placeholder="Notes / Justification line 2 (optional)..."
              />
            </div>
            <div className="erf-dotted-line-row">
              <input
                type="text"
                className="erf-notes-input"
                value={notesLine3}
                onChange={(e) => setNotesLine3(e.target.value)}
                placeholder="Notes / Justification line 3 (optional)..."
              />
            </div>
          </div>

          {/* Signatures Block: Requested by / Checked by / Approved by */}
          <div className="erf-signatures-grid">
            {/* Requested by */}
            <div className="erf-sig-col">
              <div className="erf-sig-line">
                <span className="erf-sig-handwriting">{name || 'Sunil Shantha'}</span>
              </div>
              <span className="erf-sig-label">Requested by</span>
            </div>

            {/* Checked by */}
            <div className="erf-sig-col">
              <div className="erf-sig-line">
                <span className="erf-sig-handwriting" style={{ color: '#64748b', fontSize: '15px' }}>
                  Accountant
                </span>
              </div>
              <span className="erf-sig-label">Checked by</span>
            </div>

            {/* Approved by */}
            <div className="erf-sig-col">
              <div className="erf-sig-line">
                <span style={{ color: '#94a3b8', fontSize: '11px', fontStyle: 'italic', paddingBottom: '4px' }}>
                  Pending Approval
                </span>
              </div>
              <span className="erf-sig-label">Approved by</span>
            </div>
          </div>

          {/* Scanner Watermark matching PDF */}
          <div className="erf-watermark-row">
            <span className="erf-scanner-text">
              <span className="erf-scanner-badge">CS</span> CamScanner
            </span>
          </div>
        </div>

        {/* =========================================================================
            RECEIPTS & BILLS ATTACHMENT TRAY (COLLAPSIBLE / OPTIONAL)
            ========================================================================= */}
        {showReceiptsPanel && (
          <div className="erf-attachments-panel no-print">
            <div className="erf-att-header">
              <div className="erf-att-title">
                📎 Attached Bills / Slips / Invoices ({attachments.length})
              </div>
              <div className="erf-att-quick-actions">
                <button
                  type="button"
                  className="erf-att-sample-btn"
                  onClick={() => handleAddSampleBill('fuel')}
                >
                  + Fuel Slip
                </button>
                <button
                  type="button"
                  className="erf-att-sample-btn"
                  onClick={() => handleAddSampleBill('refreshments')}
                >
                  + Bakery Slip
                </button>
                <button
                  type="button"
                  className="erf-att-sample-btn"
                  onClick={() => handleAddSampleBill('stationery')}
                >
                  + Stationery Bill
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                style={{ fontSize: '12px' }}
              />
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                (Attach photo of paper bill, cash voucher receipt, or PDF)
              </span>
            </div>

            {attachments.length > 0 && (
              <div className="erf-att-grid">
                {attachments.map((att, idx) => (
                  <div key={idx} className="erf-att-item-card">
                    <span>📄 {att.name}</span>
                    <button
                      type="button"
                      className="erf-att-del-btn"
                      onClick={() => handleRemoveAttachment(idx)}
                      title="Remove attachment"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            STICKY BOTTOM ACTION BAR (Non-Printing)
            ========================================================================= */}
        <div className="erf-modal-sticky-footer no-print">
          <div className="erf-footer-summary">
            <span className="erf-summary-count">
              <strong>{items.filter((it) => it.description.trim()).length}</strong> expense item(s) entered
            </span>
            <span className="erf-summary-total">
              Total: Rs.{' '}
              {Number(totalAmount).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>

          <div className="erf-footer-actions">
            <button
              type="button"
              className="erf-top-btn"
              onClick={handleAddItem}
              style={{ background: 'rgba(255,255,255,0.08)' }}
            >
              + Add Line
            </button>
            <button
              type="button"
              className="erf-btn-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="erf-btn-submit"
              onClick={handleFormSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting Form...' : '✓ Submit Expenses Reimbursement Form'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PettyCashCreateModal;
