import { useState } from 'react';
import { numberToWords } from '../../utils/numberToWords';
import { SAMPLE_ATTACHMENTS } from './sampleAttachments';
import './PaymentVoucherSheet.css';
import './PaymentVoucherModal.css';

/**
 * PaymentVoucherCreateModal
 * Rendered directly as the physical paper Payment Voucher bill from Page 1 of the PDF.
 * Users fill in the voucher directly on the dotted lines and ledger table cells.
 * Attached bills (Pages 2-4: CEB, SLT, SMS photo, etc.) are stapled below the bill.
 */
function PaymentVoucherCreateModal({ isOpen, onClose, onSuccess, currentUser }) {
  if (!isOpen) return null;

  // Form State
  const [payeeName, setPayeeName] = useState('');
  const [payeeNote, setPayeeNote] = useState('');
  const [dateFormatted, setDateFormatted] = useState(() => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  });
  const [bank, setBank] = useState('PEB');
  const [branch, setBranch] = useState('Horana');
  const [chequeNo, setChequeNo] = useState('TFR.');
  const [receivedByName, setReceivedByName] = useState('');
  const [receivedByIdNumber, setReceivedByIdNumber] = useState('1602');

  // Particulars Line Items - Multiple rows ready by default matching PDF Page 1
  const [items, setItems] = useState([
    { particulars: '', account: '', amountRs: '', amountCts: '00', totalLineAmount: 0 },
    { particulars: '', account: '', amountRs: '', amountCts: '00', totalLineAmount: 0 },
    { particulars: '', account: '', amountRs: '', amountCts: '00', totalLineAmount: 0 },
    { particulars: '', account: '', amountRs: '', amountCts: '00', totalLineAmount: 0 },
  ]);

  // Attachments State (Pages 2-4 bills)
  const [attachments, setAttachments] = useState([]);
  const [previewMedia, setPreviewMedia] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Handle line item edit
  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;

    const rs = Number(updated[index].amountRs) || 0;
    const cts = Number(updated[index].amountCts) || 0;
    updated[index].totalLineAmount = rs + cts / 100;

    setItems(updated);
  };

  // Add line item
  const handleAddItem = (presetParticulars = '', presetAccount = '') => {
    setItems((prev) => [
      ...prev,
      { particulars: presetParticulars, account: presetAccount, amountRs: '', amountCts: '00', totalLineAmount: 0 },
    ]);
  };

  // Quick preset helper
  const handleAddPreset = (particulars, account = '') => {
    const emptyIndex = items.findIndex((i) => !i.particulars && !i.amountRs);
    if (emptyIndex !== -1) {
      const updated = [...items];
      updated[emptyIndex].particulars = particulars;
      updated[emptyIndex].account = account;
      setItems(updated);
    } else {
      handleAddItem(particulars, account);
    }
  };

  // Remove line item
  const handleRemoveItem = (index) => {
    if (items.length <= 1) {
      setItems([{ particulars: '', account: '', amountRs: '', amountCts: '00', totalLineAmount: 0 }]);
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  // Calculate totals across all active rows
  const totalAmount = items.reduce((sum, item) => {
    const rs = Number(item.amountRs) || 0;
    const cts = Number(item.amountCts) || 0;
    return sum + rs + cts / 100;
  }, 0);

  const totalRs = Math.floor(totalAmount);
  const totalCts = Math.round((totalAmount - totalRs) * 100);

  // Auto-calculated amount in words
  const amountInWords = numberToWords(totalAmount);

  // Load exact Page 1 PDF sample data
  const handleLoadPdfSample = () => {
    setPayeeName('P.H.A. Prashan');
    setPayeeNote('(Monthly Ex - Oct 26)');
    setDateFormatted('04/05/2026');
    setBank('PEB');
    setBranch('Horana');
    setChequeNo('TFR.');
    setReceivedByName('P.H.A. Prashan');
    setReceivedByIdNumber('1602');

    setItems([
      { particulars: 'Electricity Bill OCT-26', account: '4413433203', amountRs: 14200, amountCts: '00', totalLineAmount: 14200 },
      { particulars: 'Telephone Bill 0342210696', account: 'SLT-0342210680', amountRs: 5460, amountCts: '00', totalLineAmount: 5460 },
      { particulars: '0766064946', account: 'Mobitel Data', amountRs: 5000, amountCts: '00', totalLineAmount: 5000 },
      { particulars: '074-0895088', account: 'Dialog Mobile Bill', amountRs: 930, amountCts: '00', totalLineAmount: 930 },
    ]);

    // Attach sample bills from Pages 2-4
    if (attachments.length === 0) {
      setAttachments([...SAMPLE_ATTACHMENTS]);
    }
  };

  const handleLoadSampleBills = () => {
    setAttachments([...SAMPLE_ATTACHMENTS]);
  };

  // Handle file uploads
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            type: file.type || 'image/jpeg',
            category: file.name.toLowerCase().includes('elec')
              ? 'Electricity Bill'
              : file.name.toLowerCase().includes('phone') || file.name.toLowerCase().includes('slt')
              ? 'Telephone Bill'
              : 'Expense Receipt',
            size: file.size,
            dataUrl: reader.result,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = null;
  };

  const handleRemoveAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!payeeName.trim()) {
      setErrorMsg('Please enter Payee Name on the voucher.');
      return;
    }

    // Filter only rows that have either a description or an amount
    const validItems = items
      .filter((i) => (i.particulars && i.particulars.trim() !== '') || (Number(i.amountRs) || 0) > 0)
      .map((i) => ({
        particulars: i.particulars.trim() || 'Expense Item',
        account: i.account?.trim() || '',
        amountRs: Number(i.amountRs) || 0,
        amountCts: Number(i.amountCts) || 0,
        totalLineAmount: Number(i.totalLineAmount) || (Number(i.amountRs) || 0) + (Number(i.amountCts) || 0) / 100,
      }));

    if (validItems.length === 0) {
      setErrorMsg('Please enter at least one expense with an amount.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        payeeName: payeeName.trim(),
        payeeNote: payeeNote.trim(),
        dateFormatted: dateFormatted.trim(),
        bank: bank.trim(),
        branch: branch.trim(),
        chequeNo: chequeNo.trim(),
        items: validItems,
        totalAmount,
        amountInWords,
        preparedBy: currentUser?.username || 'user',
        receivedByName: receivedByName.trim() || payeeName.trim(),
        receivedByIdNumber: receivedByIdNumber.trim() || '1602',
        attachments,
      };

      await onSuccess(payload);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'Failed to submit payment voucher.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Minimum rows for authentic bill sheet look
  const minRows = 6;
  const emptyRowsCount = Math.max(0, minRows - items.length);

  return (
    <div className="pv-modal-overlay" onClick={() => !isSubmitting && onClose()}>
      <div className="pv-modal-window bill-creator-window" onClick={(e) => e.stopPropagation()}>
        {/* Top Control Bar */}
        <div className="pv-bill-modal-topbar">
          <div className="pv-topbar-info">
            <span className="pv-topbar-badge">NEW PAYMENT VOUCHER</span>
            <span className="pv-topbar-desc">Fill directly on the official bill sheet &bull; Replicating Page 1 of PDF</span>
          </div>
          <div className="pv-modal-header-actions">
            <button
              type="button"
              className="pv-sample-autofill-btn"
              onClick={handleLoadPdfSample}
              title="Autofill exact values from PDF Page 1"
            >
              ⚡ Load PDF Sample Data
            </button>
            <button
              type="button"
              className="pv-modal-close-btn"
              onClick={onClose}
              disabled={isSubmitting}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Container containing the Bill Paper Sheet */}
        <div className="pv-bill-scrollable-container">
          {errorMsg && <div className="pv-error-banner">⚠️ {errorMsg}</div>}

          <form onSubmit={handleSubmit} id="pv-bill-form">
            {/* =========================================================================
                THE EXACT PHYSICAL PAYMENT VOUCHER BILL SHEET (PAGE 1 OF PDF)
                ========================================================================= */}
            <div className="pv-paper-container interactive-bill-paper">
              {/* Header: SOFAST MOTORS Emblem & Company Name */}
              <div className="pv-header-grid">
                <div className="pv-logo-badge">
                  <svg viewBox="0 0 120 70" className="pv-badge-svg" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M10,25 C10,12 18,5 30,5 L90,5 C102,5 110,12 110,25 C110,35 115,40 115,45 C115,58 105,65 90,65 L30,65 C15,65 5,58 5,45 C5,40 10,35 10,25 Z"
                      fill="none"
                      stroke="#111827"
                      strokeWidth="2.5"
                    />
                    <path
                      d="M14,26 C14,15 21,9 32,9 L88,9 C99,9 106,15 106,26 C106,34 111,39 111,44 C111,54 102,61 88,61 L32,61 C18,61 9,54 9,44 C9,39 14,34 14,26 Z"
                      fill="none"
                      stroke="#111827"
                      strokeWidth="1"
                    />
                    <text x="60" y="30" fontFamily="'Georgia', serif" fontSize="17" fontWeight="bold" textAnchor="middle" fill="#000000">
                      SOFAST
                    </text>
                    <line x1="22" y1="36" x2="98" y2="36" stroke="#000000" strokeWidth="1.2" />
                    <text x="60" y="52" fontFamily="'Arial Black', sans-serif" fontSize="13" fontWeight="900" textAnchor="middle" letterSpacing="1.5" fill="#000000">
                      MOTORS
                    </text>
                  </svg>
                </div>

                <div className="pv-title-area">
                  <h1 className="pv-company-name">Sofast (Private) Limited.</h1>
                  <h2 className="pv-document-title">Payment Voucher</h2>
                </div>
              </div>

              {/* Dotted Underline Fields: PAYEE, DATE, BANK, CHEQUE NO, BRANCH */}
              <div className="pv-top-fields">
                {/* Row 1: PAYEE & DATE */}
                <div className="pv-field-row">
                  <div className="pv-field-col payee-col">
                    <span className="pv-field-label">PAYEE</span>
                    <span className="pv-field-colon">:</span>
                    <div className="pv-dotted-line-content edit-mode">
                      <input
                        type="text"
                        className="pv-bill-dotted-input payee-name-input"
                        placeholder="e.g. P.H.A. Prashan"
                        value={payeeName}
                        onChange={(e) => {
                          setPayeeName(e.target.value);
                          if (!receivedByName) setReceivedByName(e.target.value);
                        }}
                        required
                        autoFocus
                      />
                      <input
                        type="text"
                        className="pv-bill-dotted-input payee-note-input"
                        placeholder="(Monthly Ex - Oct 26)"
                        value={payeeNote}
                        onChange={(e) => setPayeeNote(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="pv-field-col date-col">
                    <span className="pv-field-label">DATE</span>
                    <span className="pv-field-colon">:</span>
                    <div className="pv-dotted-line-content edit-mode">
                      <input
                        type="text"
                        className="pv-bill-dotted-input center"
                        placeholder="04/05/2026"
                        value={dateFormatted}
                        onChange={(e) => setDateFormatted(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Row 2: BANK & CHEQUE NO */}
                <div className="pv-field-row">
                  <div className="pv-field-col bank-col">
                    <span className="pv-field-label">BANK</span>
                    <span className="pv-field-colon">:</span>
                    <div className="pv-dotted-line-content edit-mode">
                      <input
                        type="text"
                        className="pv-bill-dotted-input"
                        placeholder="PEB"
                        value={bank}
                        onChange={(e) => setBank(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="pv-field-col cheque-col">
                    <span className="pv-field-label">CHEQUE NO</span>
                    <span className="pv-field-colon">:</span>
                    <div className="pv-dotted-line-content edit-mode">
                      <input
                        type="text"
                        className="pv-bill-dotted-input center"
                        placeholder="TFR."
                        value={chequeNo}
                        onChange={(e) => setChequeNo(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Row 3: BRANCH */}
                <div className="pv-field-row">
                  <div className="pv-field-col branch-col">
                    <span className="pv-field-label">BRANCH</span>
                    <span className="pv-field-colon">:</span>
                    <div className="pv-dotted-line-content edit-mode" style={{ maxWidth: '320px' }}>
                      <input
                        type="text"
                        className="pv-bill-dotted-input"
                        placeholder="Horana"
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Expense Presets Toolbar */}
              <div className="pv-table-quick-presets">
                <span className="pv-quick-label">⚡ Quick Presets:</span>
                <button
                  type="button"
                  className="pv-preset-pill"
                  onClick={() => handleAddPreset('Electricity Bill OCT-26', '4413433203')}
                >
                  + Electricity Bill
                </button>
                <button
                  type="button"
                  className="pv-preset-pill"
                  onClick={() => handleAddPreset('Telephone Bill 0342210696', 'SLT-0342210680')}
                >
                  + Telephone Bill
                </button>
                <button
                  type="button"
                  className="pv-preset-pill"
                  onClick={() => handleAddPreset('0766064946', 'Mobitel Data')}
                >
                  + Mobile Data
                </button>
                <button
                  type="button"
                  className="pv-preset-pill"
                  onClick={() => handleAddPreset('074-0895088', 'Dialog Mobile Bill')}
                >
                  + Dialog Mobile
                </button>
                <button
                  type="button"
                  className="pv-preset-pill highlight"
                  onClick={() => handleAddItem()}
                >
                  + Add Empty Line
                </button>
              </div>

              {/* Bill Particulars & Amounts Table */}
              <div className="pv-table-wrapper">
                <table className="pv-table interactive-table">
                  <thead>
                    <tr>
                      <th className="pv-th-particulars">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px' }}>
                          <span>PARTICULARS</span>
                          <button
                            type="button"
                            className="pv-bill-add-row-action"
                            onClick={() => handleAddItem()}
                            title="Add new expense row to voucher"
                          >
                            + Add Line
                          </button>
                        </div>
                      </th>
                      <th className="pv-th-account">ACCOUNT</th>
                      <th className="pv-th-amount-wrapper" colSpan="2">
                        <div className="pv-th-amount-top">AMOUNT</div>
                        <div className="pv-th-amount-split">
                          <span className="pv-sub-th-rs">Rs.</span>
                          <span className="pv-sub-th-cts">Cts</span>
                        </div>
                      </th>
                      <th className="pv-th-action-col no-print"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* User Editable Rows - Every single row is open and ready to write on */}
                    {items.map((item, idx) => (
                      <tr key={idx} className="pv-row-data edit-row">
                        <td className="pv-td-particulars edit-cell">
                          <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                            <span className="pv-row-index-pill">{idx + 1}</span>
                            <input
                              type="text"
                              className="pv-bill-cell-input"
                              placeholder={`Line ${idx + 1}: e.g. Electricity Bill, SLT, Mobile...`}
                              value={item.particulars}
                              onChange={(e) => handleItemChange(idx, 'particulars', e.target.value)}
                            />
                          </div>
                        </td>
                        <td className="pv-td-account edit-cell">
                          <input
                            type="text"
                            className="pv-bill-cell-input center"
                            placeholder="Account / Ref"
                            value={item.account}
                            onChange={(e) => handleItemChange(idx, 'account', e.target.value)}
                          />
                        </td>
                        <td className="pv-td-rs edit-cell">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            className="pv-bill-cell-input right"
                            placeholder="Amount"
                            value={item.amountRs}
                            onChange={(e) => handleItemChange(idx, 'amountRs', e.target.value)}
                          />
                        </td>
                        <td className="pv-td-cts edit-cell">
                          <input
                            type="text"
                            maxLength="2"
                            className="pv-bill-cell-input center"
                            placeholder="00"
                            value={item.amountCts}
                            onChange={(e) => handleItemChange(idx, 'amountCts', e.target.value)}
                          />
                        </td>
                        <td className="pv-td-action-col no-print">
                          {items.length > 1 && (
                            <button
                              type="button"
                              className="pv-bill-remove-row-btn"
                              onClick={() => handleRemoveItem(idx)}
                              title="Delete this expense line"
                            >
                              ✕
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}

                    {/* Button Row to add more lines */}
                    <tr className="pv-add-more-row no-print">
                      <td colSpan="5" style={{ padding: '6px 10px', background: '#fafafa', textAlign: 'left' }}>
                        <button
                          type="button"
                          className="pv-add-more-line-btn"
                          onClick={() => handleAddItem()}
                        >
                          + Add Another Expense Line (Line {items.length + 1})
                        </button>
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="pv-total-row">
                      <td className="pv-td-total-label" colSpan="2">
                        <span className="pv-total-text">TOTAL</span>
                      </td>
                      <td className="pv-td-rs pv-total-val">
                        <span className="pv-handwriting-cell bold">{totalRs.toLocaleString()}</span>
                      </td>
                      <td className="pv-td-cts pv-total-val">
                        <span className="pv-handwriting-cell bold">{String(totalCts).padStart(2, '0')}</span>
                      </td>
                      <td className="no-print"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Rupees In Words Line */}
              <div className="pv-rupees-section">
                <div className="pv-rupees-row">
                  <span className="pv-rupees-label">Rupees</span>
                  <div className="pv-rupees-content">
                    <span className="pv-handwriting rupees-text">{amountInWords}</span>
                  </div>
                </div>
                <div className="pv-rupees-dotted-blank"></div>
              </div>

              {/* Signatures & Authorizations Grid */}
              <div className="pv-signatures-grid">
                {/* Prepared By & Checked By */}
                <div className="pv-sig-row-top">
                  <div className="pv-sig-col">
                    <div className="pv-sig-handwriting-box">
                      <span className="pv-sig-signature-mock">{currentUser?.username || 'Prepared'}</span>
                    </div>
                    <div className="pv-sig-line"></div>
                    <span className="pv-sig-role">Prepared By</span>
                  </div>

                  <div className="pv-sig-col">
                    <div className="pv-sig-handwriting-box">
                      <span className="pv-sig-signature-mock faint">Accountant</span>
                    </div>
                    <div className="pv-sig-line"></div>
                    <span className="pv-sig-role">Checked By</span>
                  </div>
                </div>

                {/* Approved By Row */}
                <div className="pv-approved-row">
                  <div className="pv-approved-col">
                    <span className="pv-approved-label">Approved By :</span>
                    <div className="pv-approved-stamp-area">
                      <span className="pv-approved-dotted-line">
                        <span className="pv-awaiting-txt">(Pending Admin Inbox Review)</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Received By Section */}
                <div className="pv-received-by-section">
                  <div className="pv-received-title">Received By</div>

                  <div className="pv-received-fields-grid">
                    {/* Name & Date */}
                    <div className="pv-received-left-col">
                      <div className="pv-rec-field">
                        <div className="pv-dotted-line-rec edit-mode">
                          <input
                            type="text"
                            className="pv-bill-dotted-input center"
                            placeholder="Recipient Name"
                            value={receivedByName}
                            onChange={(e) => setReceivedByName(e.target.value)}
                          />
                        </div>
                        <span className="pv-rec-label">Name</span>
                      </div>

                      <div className="pv-rec-field">
                        <div className="pv-dotted-line-rec edit-mode">
                          <input
                            type="text"
                            className="pv-bill-dotted-input center"
                            placeholder="DD/MM/YYYY"
                            value={dateFormatted}
                            onChange={(e) => setDateFormatted(e.target.value)}
                          />
                        </div>
                        <span className="pv-rec-label">Date</span>
                      </div>
                    </div>

                    {/* ID number */}
                    <div className="pv-received-mid-col">
                      <span className="pv-rec-label-top">ID number</span>
                      <input
                        type="text"
                        className="pv-bill-dotted-input center id-number-val-input"
                        placeholder="1602"
                        value={receivedByIdNumber}
                        onChange={(e) => setReceivedByIdNumber(e.target.value)}
                      />
                    </div>

                    {/* Signature Box */}
                    <div className="pv-received-right-col">
                      <span className="pv-rec-label-top">Signature</span>
                      <div className="pv-signature-box">
                        <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                          Sign on Receipt
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* CamScanner Footer */}
              <div className="pv-scanner-footer">
                <div className="pv-footer-left">SOFAST MOTORS MANAGEMENT SYSTEM &bull; VOUCHER FORM</div>
                <div className="pv-camscanner-tag">
                  <span className="cs-box">CS</span>
                  <span className="cs-text">CamScanner</span>
                </div>
              </div>
            </div>

            {/* =========================================================================
                STAPLED ATTACHMENTS SECTION (PAGES 2-4 BILLS & RECEIPTS)
                ========================================================================= */}
            <div className="pv-stapled-attachments-card">
              <div className="pv-stapled-header">
                <div className="pv-stapled-title">
                  <span className="pv-paperclip-icon">📎</span>
                  <div>
                    <h4>Attached Supporting Bills &amp; Receipts (Pages 2-4)</h4>
                    <p>Staple photos or PDF invoices for Electricity, SLT phone, Dialog SMS, and fuel expenses</p>
                  </div>
                </div>

                <div className="pv-stapled-actions">
                  <button
                    type="button"
                    className="pv-sample-bills-btn"
                    onClick={handleLoadSampleBills}
                  >
                    ⚡ Attach Demo Bills (Pages 2-4)
                  </button>

                  <label htmlFor="pv-bill-file-input" className="pv-attach-upload-btn">
                    <span>+ Upload Bill Photos / PDF</span>
                  </label>
                  <input
                    type="file"
                    id="pv-bill-file-input"
                    multiple
                    accept="image/*,application/pdf"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>

              {/* Attachments List */}
              {attachments.length === 0 ? (
                <div className="pv-no-attachments-prompt">
                  <p>No bills attached yet. Click <strong>"+ Upload Bill Photos / PDF"</strong> or <strong>"⚡ Attach Demo Bills"</strong> to attach supporting receipts.</p>
                </div>
              ) : (
                <div className="pv-attachments-grid">
                  {attachments.map((file, idx) => (
                    <div key={idx} className="pv-attachment-card">
                      <div
                        className="pv-attachment-preview-box"
                        onClick={() => setPreviewMedia(file)}
                        title="Click to preview full size"
                      >
                        {file.type?.includes('image') || file.dataUrl?.startsWith('data:image') ? (
                          <img src={file.dataUrl} alt={file.name} className="pv-attachment-thumb" />
                        ) : (
                          <div className="pv-pdf-badge-icon">📄 PDF DOCUMENT</div>
                        )}
                        <span className="pv-view-hover-pill">🔍 Zoom</span>
                      </div>

                      <div className="pv-attachment-info">
                        <span className="pv-attachment-name" title={file.name}>
                          {file.name}
                        </span>
                        <span className="pv-attachment-cat">{file.category || 'Receipt'}</span>
                      </div>

                      <button
                        type="button"
                        className="pv-remove-attachment-btn"
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

            {/* Bottom Form Actions */}
            <div className="pv-bill-modal-bottom-bar">
              <button
                type="button"
                className="pv-btn secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>

              <button type="submit" className="pv-btn primary submit-bill-btn" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting to Admin...' : '✓ Submit Payment Voucher to Admin Inbox'}
              </button>
            </div>
          </form>
        </div>

        {/* Lightbox Modal for Attached Bill Zoom */}
        {previewMedia && (
          <div className="pv-lightbox-overlay" onClick={() => setPreviewMedia(null)}>
            <div className="pv-lightbox-content" onClick={(e) => e.stopPropagation()}>
              <div className="pv-lightbox-header">
                <span>{previewMedia.name}</span>
                <button
                  type="button"
                  className="pv-lightbox-close"
                  onClick={() => setPreviewMedia(null)}
                >
                  ✕
                </button>
              </div>
              <div className="pv-lightbox-body">
                <img src={previewMedia.dataUrl} alt={previewMedia.name} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PaymentVoucherCreateModal;
