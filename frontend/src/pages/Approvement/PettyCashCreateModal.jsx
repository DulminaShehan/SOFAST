import React, { useState } from 'react';
import './PaymentVoucherModal.css';

/**
 * PettyCashCreateModal
 * Modal allowing staff/admin to prepare and submit a physical
 * EXPENSES REIMBURSEMENT FORM with multiple expense line items and attachments.
 */
function PettyCashCreateModal({ isOpen, onClose, onSubmit, currentUser, spendableLimit }) {
  if (!isOpen) return null;

  const todayStr = new Date().toLocaleDateString('en-GB');

  const [name, setName] = useState(currentUser?.name || currentUser?.username || 'Sunil Shantha');
  const [dateFormatted, setDateFormatted] = useState(todayStr);
  const [subject, setSubject] = useState('');
  const [reimbursementDate, setReimbursementDate] = useState(todayStr);

  const [items, setItems] = useState([
    { description: 'Workshop Consumables & Fasteners', amount: '1850' },
  ]);

  const [notes, setNotes] = useState('Urgent consumables required for morning mechanical repairs.');
  const [attachments, setAttachments] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Auto-calculated total
  const totalAmount = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  // Check spendable balance
  const remainingFund = spendableLimit ? spendableLimit.remainingLimit : 50000;
  const isOverFund = totalAmount > remainingFund;

  const handleAddItem = () => {
    setItems([...items, { description: '', amount: '' }]);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  // Quick Preset Handlers
  const handleApplyPreset = (presetSubject, presetItems, presetNotes) => {
    setSubject(presetSubject);
    setItems(presetItems);
    if (presetNotes) setNotes(presetNotes);
  };

  // File Upload
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
    // Lightweight SVG placeholders for fast sample testing
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
          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%23f8fafc" stroke="%23cbd5e1" stroke-width="2"/><text x="150" y="40" font-family="Arial" font-weight="bold" font-size="16" text-anchor="middle" fill="%23ea580c">BAKE HOUSE MATUGAMA</text><text x="150" y="70" font-family="Arial" font-size="13" text-anchor="middle" fill="%23334155">Staff Tea & Evening Pastries</text><text x="150" y="105" font-family="Arial Black" font-size="18" text-anchor="middle" fill="%230f172a">Rs. 2,200.00</text><text x="150" y="140" font-family="Arial" font-size="11" text-anchor="middle" fill="%2364748b">Receipt No: BH-4491</text></svg>',
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
    }
  };

  const handleRemoveAttachment = (idx) => {
    setAttachments(attachments.filter((_, i) => i !== idx));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
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
      (item) => item.description.trim() && Number(item.amount) > 0
    );

    if (validItems.length === 0) {
      setValidationError('Please add at least one valid expense item description and amount');
      return;
    }

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
        notes: notes.trim(),
        requestedBy: name.trim(),
        checkedBy: 'Accountant',
        department: 'General',
        category: 'Office Supplies',
        purpose: subject.trim(),
        attachments,
      });
    } catch (err) {
      setValidationError(err.response?.data?.message || err.message || 'Failed to submit form');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pv-modal-overlay">
      <div className="pv-modal-container" style={{ maxWidth: '920px' }}>
        {/* Modal Header */}
        <div className="pv-modal-header">
          <div>
            <h2 className="pv-modal-title">New Expenses Reimbursement Form</h2>
            <p className="pv-modal-subtitle">
              Exact replica of physical Reimbursement Sheet. Multiple items allowed. Approved amounts are automatically deducted from spendable limit.
            </p>
          </div>
          <button type="button" className="pv-close-btn" onClick={onClose} disabled={isSubmitting}>
            ✕
          </button>
        </div>

        {/* Spendable Limit Alert Banner */}
        <div
          style={{
            margin: '12px 24px 0 24px',
            padding: '10px 16px',
            borderRadius: '8px',
            background: isOverFund ? '#fee2e2' : '#f0fdf4',
            border: isOverFund ? '1px solid #f87171' : '1px solid #86efac',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>{isOverFund ? '⚠️' : '💳'}</span>
            <div>
              <strong style={{ color: isOverFund ? '#991b1b' : '#166534' }}>
                Spendable Petty Cash Fund Balance:
              </strong>
              <span
                style={{
                  marginLeft: '8px',
                  fontWeight: '800',
                  color: isOverFund ? '#b91c1c' : '#15803d',
                }}
              >
                Rs. {Number(remainingFund).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span style={{ marginLeft: '6px', color: '#64748b', fontSize: '11px' }}>
                (Total Limit: Rs.{' '}
                {Number(spendableLimit?.totalLimit || 50000).toLocaleString()})
              </span>
            </div>
          </div>
          {isOverFund && (
            <span style={{ color: '#b91c1c', fontWeight: '700', fontSize: '12px' }}>
              Warning: Exceeds Available Balance!
            </span>
          )}
        </div>

        {/* Quick Presets Bar */}
        <div style={{ margin: '12px 24px 0 24px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>
            ⚡ Quick Expense Presets:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button
              type="button"
              className="pv-preset-btn"
              onClick={() =>
                handleApplyPreset(
                  'Delivery Van Fuel & Highway Tolls',
                  [
                    { description: 'Delivery Van Auto Diesel (Matugama Station)', amount: '3500' },
                    { description: 'Highway Southern Expressway Toll Fee', amount: '450' },
                  ],
                  'Urgent spare parts customer delivery to Kalutara region.'
                )
              }
            >
              ⛽ Van Fuel &amp; Toll (Rs. 3,950)
            </button>

            <button
              type="button"
              className="pv-preset-btn"
              onClick={() =>
                handleApplyPreset(
                  'Workshop Staff Overtime Refreshments',
                  [
                    { description: 'Technicians Evening Tea & Snacks (Saturday Shift)', amount: '2200' },
                    { description: 'Mineral Drinking Water Bottles (5L x 2)', amount: '1000' },
                  ],
                  'Overtime evening shift brake pad servicing crew tea and snacks.'
                )
              }
            >
              ☕ Overtime Tea &amp; Refreshments (Rs. 3,200)
            </button>

            <button
              type="button"
              className="pv-preset-btn"
              onClick={() =>
                handleApplyPreset(
                  'Cashier POS Thermal Rolls & Stationery Refill',
                  [
                    { description: 'Thermal Paper Rolls (80mm x 50 rolls)', amount: '3500' },
                    { description: 'Gel Ink Pens & Invoice Filing Folders', amount: '1000' },
                  ],
                  'Refills for cashier invoice printers for weekend rush.'
                )
              }
            >
              📄 POS Thermal Paper &amp; Pens (Rs. 4,500)
            </button>

            <button
              type="button"
              className="pv-preset-btn"
              onClick={() =>
                handleApplyPreset(
                  'Mechanical Workshop Fasteners & Drill Bits',
                  [
                    { description: 'High-tensile Grade 8.8 Hex Bolts & Lock Nuts', amount: '1850' },
                    { description: 'Cobalt Drill Bit Set (4mm, 6mm, 8mm)', amount: '1600' },
                  ],
                  'Emergency consumable purchase for engine overhaul bench.'
                )
              }
            >
              🔩 Bolts &amp; Drill Bits (Rs. 3,450)
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleFormSubmit}>
          <div className="pv-modal-body" style={{ padding: '16px 24px' }}>
            {validationError && (
              <div
                style={{
                  background: '#fee2e2',
                  color: '#b91c1c',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  marginBottom: '14px',
                }}
              >
                ⚠️ {validationError}
              </div>
            )}

            {/* Top Sheet Fields matching Page 1 */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {/* Name */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: '800',
                      color: '#000000',
                      marginBottom: '4px',
                    }}
                  >
                    Name : <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="pv-form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter employee / requester name"
                    required
                  />
                </div>

                {/* Date */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: '800',
                      color: '#000000',
                      marginBottom: '4px',
                    }}
                  >
                    Date :
                  </label>
                  <input
                    type="text"
                    className="pv-form-input"
                    value={dateFormatted}
                    onChange={(e) => setDateFormatted(e.target.value)}
                    placeholder="DD/MM/YYYY"
                    required
                  />
                </div>

                {/* Subject */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: '800',
                      color: '#000000',
                      marginBottom: '4px',
                    }}
                  >
                    Subject : <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="pv-form-input"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Delivery Van Fuel / Workshop Refreshments"
                    required
                  />
                </div>

                {/* Remburshment Date */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: '800',
                      color: '#000000',
                      marginBottom: '4px',
                    }}
                  >
                    Remburshment Date :
                  </label>
                  <input
                    type="text"
                    className="pv-form-input"
                    value={reimbursementDate}
                    onChange={(e) => setReimbursementDate(e.target.value)}
                    placeholder="DD/MM/YYYY"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Multiple Expenses Table */}
            <div style={{ marginBottom: '16px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                }}
              >
                <div style={{ fontWeight: '800', fontSize: '14px', color: '#0f172a' }}>
                  Expenses Table (Page 1 Physical Structure)
                </div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  style={{
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  + Add Expense Line
                </button>
              </div>

              <div style={{ border: '2px solid #000000', borderRadius: '4px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #000000' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', width: '65%' }}>
                        Description
                      </th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', width: '25%' }}>
                        Amount (Rs.)
                      </th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', width: '10%' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #cbd5e1' }}>
                        <td style={{ padding: '6px 10px' }}>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                            placeholder={`Expense description #${idx + 1}`}
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              fontSize: '13px',
                            }}
                            required
                          />
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.amount}
                            onChange={(e) => handleItemChange(idx, 'amount', e.target.value)}
                            placeholder="0.00"
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              fontSize: '13px',
                              textAlign: 'right',
                              fontWeight: '700',
                            }}
                            required
                          />
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              style={{
                                background: '#fee2e2',
                                color: '#b91c1c',
                                border: '1px solid #fca5a5',
                                borderRadius: '4px',
                                padding: '3px 7px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 'bold',
                              }}
                              title="Delete row"
                            >
                              ✕
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}

                    {/* Total Row */}
                    <tr style={{ background: '#f8fafc', borderTop: '2px solid #000000' }}>
                      <td
                        style={{
                          padding: '10px 14px',
                          fontWeight: '900',
                          fontSize: '15px',
                          fontFamily: 'Arial Black, Impact, sans-serif',
                        }}
                      >
                        Total
                      </td>
                      <td
                        style={{
                          padding: '10px 14px',
                          textAlign: 'right',
                          fontWeight: '900',
                          fontSize: '16px',
                          color: '#0f172a',
                        }}
                      >
                        Rs. {Number(totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notes / 3 Dotted Lines on PDF */}
            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#334155',
                  marginBottom: '4px',
                }}
              >
                Notes / Justification (Fills the 3 dotted lines below table on PDF):
              </label>
              <textarea
                className="pv-form-input"
                rows="2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Details of expense, vendor invoice number or reason..."
              />
            </div>

            {/* Attached Bills / Receipts */}
            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '14px',
                background: '#f8fafc',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                }}
              >
                <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>
                  📎 Attached Bills / Invoices ({attachments.length} attached)
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => handleAddSampleBill('fuel')}
                    className="pv-preset-btn"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                  >
                    + Fuel Slip
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddSampleBill('refreshments')}
                    className="pv-preset-btn"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                  >
                    + Bakery Receipt
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddSampleBill('stationery')}
                    className="pv-preset-btn"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                  >
                    + Stationery Bill
                  </button>
                </div>
              </div>

              <input
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                style={{ fontSize: '12px', marginBottom: '8px' }}
              />

              {attachments.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                  {attachments.map((att, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '12px',
                      }}
                    >
                      <span>📄 {att.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(idx)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#dc2626',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pv-modal-footer">
            <button
              type="button"
              className="pv-btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="pv-btn-primary"
              disabled={isSubmitting}
              style={{
                background: '#15803d',
                borderColor: '#15803d',
              }}
            >
              {isSubmitting ? 'Submitting Form...' : '✓ Submit Reimbursement Form'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PettyCashCreateModal;
