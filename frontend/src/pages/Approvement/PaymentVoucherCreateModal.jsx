import { useState } from 'react';
import { numberToWords } from '../../utils/numberToWords';
import { SAMPLE_ATTACHMENTS } from './sampleAttachments';
import './PaymentVoucherModal.css';

/**
 * PaymentVoucherCreateModal
 * Allows normal users (and admin) to create and submit a new Payment Voucher
 * matching the exact structure of Page 1 of the PDF, and attach multiple
 * expense bills/receipts (like Pages 2-4: CEB electricity bill, SLT mobitel bill, Dialog SMS).
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

  // Particulars Line Items
  const [items, setItems] = useState([
    { particulars: '', account: '', amountRs: '', amountCts: '00', totalLineAmount: 0 },
  ]);

  // Attachments State
  const [attachments, setAttachments] = useState([]);
  const [previewMedia, setPreviewMedia] = useState(null); // Lightbox preview
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Handle item line change
  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;

    // Recalculate line total
    const rs = Number(updated[index].amountRs) || 0;
    const cts = Number(updated[index].amountCts) || 0;
    updated[index].totalLineAmount = rs + cts / 100;

    setItems(updated);
  };

  // Add new item row
  const handleAddItem = () => {
    setItems([
      ...items,
      { particulars: '', account: '', amountRs: '', amountCts: '00', totalLineAmount: 0 },
    ]);
  };

  // Remove item row
  const handleRemoveItem = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  // Total calculation
  const totalAmount = items.reduce((sum, item) => {
    const rs = Number(item.amountRs) || 0;
    const cts = Number(item.amountCts) || 0;
    return sum + rs + cts / 100;
  }, 0);

  // Auto-calculated amount in words
  const amountInWords = numberToWords(totalAmount);

  // Helper to load sample items matching Page 1 of the PDF
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

    // Attach sample bills from Pages 2-4 if none yet
    if (attachments.length === 0) {
      setAttachments([...SAMPLE_ATTACHMENTS]);
    }
  };

  // Attach sample bills button
  const handleLoadSampleBills = () => {
    setAttachments([...SAMPLE_ATTACHMENTS]);
  };

  // File Upload Handler (Base64 conversion)
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

    e.target.value = null; // Reset input
  };

  // Remove attachment
  const handleRemoveAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  // Form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!payeeName.trim()) {
      setErrorMsg('Please enter Payee Name.');
      return;
    }

    if (totalAmount <= 0) {
      setErrorMsg('Please enter at least one line item with a valid amount.');
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
        items: items.map((i) => ({
          particulars: i.particulars || 'Expense Item',
          account: i.account || '',
          amountRs: Number(i.amountRs) || 0,
          amountCts: Number(i.amountCts) || 0,
          totalLineAmount: Number(i.totalLineAmount) || (Number(i.amountRs) || 0) + (Number(i.amountCts) || 0) / 100,
        })),
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

  return (
    <div className="pv-modal-overlay" onClick={() => !isSubmitting && onClose()}>
      <div className="pv-modal-window large" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="pv-modal-header">
          <div className="pv-modal-header-titles">
            <h2>💳 Create Payment Voucher &amp; Upload Expense Bills</h2>
            <p>Structure replicates Page 1 of PDF &bull; Attach multiple expense bills (Pages 2-4)</p>
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

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="pv-modal-form">
          <div className="pv-modal-scrollable-body">
            {errorMsg && <div className="pv-error-banner">⚠️ {errorMsg}</div>}

            {/* Section 1: Header / Payee & Bank Info */}
            <div className="pv-form-section">
              <div className="pv-section-header">
                <span className="pv-section-num">1</span>
                <h3>Voucher Header &amp; Banking Details</h3>
              </div>

              <div className="pv-form-grid-3">
                <div className="pv-input-group">
                  <label>PAYEE NAME *</label>
                  <input
                    type="text"
                    className="pv-text-input"
                    placeholder="e.g. P.H.A. Prashan"
                    value={payeeName}
                    onChange={(e) => {
                      setPayeeName(e.target.value);
                      if (!receivedByName) setReceivedByName(e.target.value);
                    }}
                    required
                    autoFocus
                  />
                </div>

                <div className="pv-input-group">
                  <label>PAYEE NOTE / PERIOD</label>
                  <input
                    type="text"
                    className="pv-text-input"
                    placeholder="e.g. (Monthly Ex - Oct 26)"
                    value={payeeNote}
                    onChange={(e) => setPayeeNote(e.target.value)}
                  />
                </div>

                <div className="pv-input-group">
                  <label>DATE (DD/MM/YYYY) *</label>
                  <input
                    type="text"
                    className="pv-text-input"
                    placeholder="04/05/2026"
                    value={dateFormatted}
                    onChange={(e) => setDateFormatted(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="pv-form-grid-3" style={{ marginTop: '12px' }}>
                <div className="pv-input-group">
                  <label>BANK</label>
                  <input
                    type="text"
                    className="pv-text-input"
                    placeholder="e.g. PEB / Commercial Bank"
                    value={bank}
                    onChange={(e) => setBank(e.target.value)}
                  />
                </div>

                <div className="pv-input-group">
                  <label>BRANCH</label>
                  <input
                    type="text"
                    className="pv-text-input"
                    placeholder="e.g. Horana"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                  />
                </div>

                <div className="pv-input-group">
                  <label>CHEQUE NO / METHOD</label>
                  <input
                    type="text"
                    className="pv-text-input"
                    placeholder="e.g. TFR. / Cheque # 049811"
                    value={chequeNo}
                    onChange={(e) => setChequeNo(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Table of Particulars (Line Items) */}
            <div className="pv-form-section">
              <div className="pv-section-header between">
                <div className="pv-section-title-wrap">
                  <span className="pv-section-num">2</span>
                  <h3>Particulars &amp; Expense Line Items</h3>
                </div>
                <button
                  type="button"
                  className="pv-add-row-btn"
                  onClick={handleAddItem}
                >
                  + Add Expense Line
                </button>
              </div>

              <div className="pv-items-table-container">
                <table className="pv-edit-table">
                  <thead>
                    <tr>
                      <th style={{ width: '4%' }}>#</th>
                      <th style={{ width: '48%' }}>PARTICULARS</th>
                      <th style={{ width: '22%' }}>ACCOUNT / REF</th>
                      <th style={{ width: '15%' }}>AMOUNT (Rs.)</th>
                      <th style={{ width: '7%' }}>Cts</th>
                      <th style={{ width: '4%' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="pv-edit-td-num">{idx + 1}</td>
                        <td>
                          <input
                            type="text"
                            className="pv-table-input"
                            placeholder="e.g. Electricity Bill OCT-26"
                            value={item.particulars}
                            onChange={(e) => handleItemChange(idx, 'particulars', e.target.value)}
                            required
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="pv-table-input"
                            placeholder="e.g. 4413433203"
                            value={item.account}
                            onChange={(e) => handleItemChange(idx, 'account', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            className="pv-table-input right"
                            placeholder="14200"
                            value={item.amountRs}
                            onChange={(e) => handleItemChange(idx, 'amountRs', e.target.value)}
                            required
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            maxLength="2"
                            className="pv-table-input center"
                            placeholder="00"
                            value={item.amountCts}
                            onChange={(e) => handleItemChange(idx, 'amountCts', e.target.value)}
                          />
                        </td>
                        <td className="pv-edit-td-action">
                          {items.length > 1 && (
                            <button
                              type="button"
                              className="pv-delete-row-btn"
                              onClick={() => handleRemoveItem(idx)}
                              title="Delete row"
                            >
                              ✕
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="pv-edit-total-row">
                      <td colSpan="3" style={{ textAlign: 'right', fontWeight: 'bold' }}>
                        TOTAL AMOUNT (LKR):
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '900', color: '#1e3a8a', fontSize: '15px' }}>
                        Rs. {Math.floor(totalAmount).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                        {String(Math.round((totalAmount - Math.floor(totalAmount)) * 100)).padStart(2, '0')}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Rupees In Words display */}
              <div className="pv-words-display-box">
                <span className="pv-words-label">Rupees:</span>
                <span className="pv-words-value">{amountInWords}</span>
              </div>
            </div>

            {/* Section 3: Supporting Bills & Attachments (Pages 2-4) */}
            <div className="pv-form-section">
              <div className="pv-section-header between">
                <div className="pv-section-title-wrap">
                  <span className="pv-section-num">3</span>
                  <div>
                    <h3>Supporting Expense Bills &amp; Receipts Upload</h3>
                    <p className="pv-sub-desc">
                      Upload receipts or invoices (e.g. CEB Electricity bill, SLT Telecom, Dialog SMS screenshot)
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="pv-sample-bills-btn"
                  onClick={handleLoadSampleBills}
                >
                  ⚡ Attach Demo Bills (Pages 2-4)
                </button>
              </div>

              {/* Dropzone & Upload Button */}
              <div className="pv-upload-dropzone">
                <input
                  type="file"
                  id="pv-file-uploader"
                  multiple
                  accept="image/*,application/pdf"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <label htmlFor="pv-file-uploader" className="pv-upload-btn-label">
                  <span className="pv-upload-icon">📁</span>
                  <span className="pv-upload-txt">Choose Bill Photos / Invoices to Upload</span>
                  <span className="pv-upload-sub">Supports PNG, JPG, JPEG, WEBP, and PDF</span>
                </label>
              </div>

              {/* Uploaded Files Grid */}
              {attachments.length > 0 && (
                <div className="pv-attachments-grid">
                  {attachments.map((file, idx) => (
                    <div key={idx} className="pv-attachment-card">
                      <div
                        className="pv-attachment-preview-box"
                        onClick={() => setPreviewMedia(file)}
                        title="Click to preview full size"
                      >
                        {file.type.includes('image') || file.dataUrl.startsWith('data:image') ? (
                          <img src={file.dataUrl} alt={file.name} className="pv-attachment-thumb" />
                        ) : (
                          <div className="pv-pdf-badge-icon">📄 PDF DOCUMENT</div>
                        )}
                        <span className="pv-view-hover-pill">🔍 View</span>
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

            {/* Section 4: Received By & Signatory Info */}
            <div className="pv-form-section">
              <div className="pv-section-header">
                <span className="pv-section-num">4</span>
                <h3>Received By &amp; Signatures</h3>
              </div>

              <div className="pv-form-grid-3">
                <div className="pv-input-group">
                  <label>RECEIVED BY (NAME)</label>
                  <input
                    type="text"
                    className="pv-text-input"
                    placeholder="e.g. P.H.A. Prashan"
                    value={receivedByName}
                    onChange={(e) => setReceivedByName(e.target.value)}
                  />
                </div>

                <div className="pv-input-group">
                  <label>ID NUMBER (DEFAULT: 1602)</label>
                  <input
                    type="text"
                    className="pv-text-input"
                    placeholder="1602"
                    value={receivedByIdNumber}
                    onChange={(e) => setReceivedByIdNumber(e.target.value)}
                  />
                </div>

                <div className="pv-input-group">
                  <label>PREPARED BY</label>
                  <input
                    type="text"
                    className="pv-text-input disabled"
                    value={currentUser?.username || 'user'}
                    disabled
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pv-modal-footer">
            <button
              type="button"
              className="pv-btn secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button type="submit" className="pv-btn primary" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting Voucher...' : '✓ Submit Voucher to Admin Inbox'}
            </button>
          </div>
        </form>

        {/* Lightbox Preview Modal for uploaded bills */}
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
