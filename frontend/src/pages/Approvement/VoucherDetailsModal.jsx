import { useState } from 'react';
import PaymentVoucherSheet from './PaymentVoucherSheet';
import './PaymentVoucherModal.css';

/**
 * VoucherDetailsModal
 * Displays the full Payment Voucher sheet (Page 1 replica) + uploaded expense bills/receipts (Pages 2-4).
 * For Admin: provides the Approve / Reject action bar with optional remarks.
 * For Normal User: provides approval status verification and printing.
 */
function VoucherDetailsModal({
  isOpen,
  onClose,
  voucher,
  isAdmin,
  onApprove,
  onReject,
  isProcessing,
}) {
  if (!isOpen || !voucher) return null;

  const [activeTab, setActiveTab] = useState('sheet'); // 'sheet' or 'attachments'
  const [adminRemarks, setAdminRemarks] = useState(voucher.adminRemarks || '');
  const [previewMedia, setPreviewMedia] = useState(null); // Lightbox for bill image

  const attachments = Array.isArray(voucher.attachments) ? voucher.attachments : [];
  const isApproved = voucher.status === 'Approved';
  const isPending = voucher.status === 'Pending';
  const isRejected = voucher.status === 'Rejected';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="pv-modal-overlay" onClick={() => !isProcessing && onClose()}>
      <div className="pv-modal-window viewer-window" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="pv-modal-header viewer-header">
          <div className="pv-header-left-info">
            <span className="pv-voucher-code">{voucher.voucherNo}</span>
            <span className="pv-voucher-title-payee">{voucher.payeeName}</span>
            <span className={`pv-badge-status ${voucher.status.toLowerCase()}`}>
              {voucher.status === 'Approved'
                ? `✓ Approved by ${voucher.approvedBy || 'Admin'}`
                : voucher.status === 'Pending'
                ? '🟡 Pending Admin Approval'
                : '✕ Rejected'}
            </span>
          </div>

          <div className="pv-header-tabs-and-close">
            <div className="pv-viewer-tab-buttons">
              <button
                type="button"
                className={`pv-viewer-tab-btn ${activeTab === 'sheet' ? 'active' : ''}`}
                onClick={() => setActiveTab('sheet')}
              >
                📄 Voucher Sheet (Page 1)
              </button>
              <button
                type="button"
                className={`pv-viewer-tab-btn ${activeTab === 'attachments' ? 'active' : ''}`}
                onClick={() => setActiveTab('attachments')}
              >
                📎 Attached Bills ({attachments.length})
              </button>
            </div>

            <button
              type="button"
              className="pv-modal-close-btn"
              onClick={onClose}
              disabled={isProcessing}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Scroll Body */}
        <div className="pv-modal-scrollable-body viewer-body">
          {/* Status Alert for Normal User */}
          {!isAdmin && (
            <div className={`pv-user-status-card ${voucher.status.toLowerCase()}`}>
              {isApproved && (
                <div className="pv-user-status-content">
                  <span className="pv-status-icon-big">✅</span>
                  <div>
                    <h4>Approved by Administrator</h4>
                    <p>
                      This expense voucher was approved by <strong>{voucher.approvedBy || 'Admin'}</strong> on{' '}
                      {voucher.approvedAt ? new Date(voucher.approvedAt).toLocaleDateString('en-GB') : 'Verified'}.
                      {voucher.adminRemarks && ` Remarks: "${voucher.adminRemarks}"`}
                    </p>
                  </div>
                </div>
              )}

              {isPending && (
                <div className="pv-user-status-content">
                  <span className="pv-status-icon-big">⏳</span>
                  <div>
                    <h4>Awaiting Admin Approval</h4>
                    <p>
                      Your voucher has been submitted and is currently in the Administrator's Receive Inbox for review and verification.
                    </p>
                  </div>
                </div>
              )}

              {isRejected && (
                <div className="pv-user-status-content">
                  <span className="pv-status-icon-big">❌</span>
                  <div>
                    <h4>Voucher Rejected</h4>
                    <p>
                      {voucher.adminRemarks
                        ? `Reason: ${voucher.adminRemarks}`
                        : 'Please check with your administrator for more information.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 1: EXACT PAGE 1 VOUCHER SHEET */}
          {activeTab === 'sheet' && (
            <div className="pv-sheet-view-container">
              <PaymentVoucherSheet voucher={voucher} onPrint={handlePrint} />
            </div>
          )}

          {/* TAB 2: ATTACHED BILLS & RECEIPTS (PAGES 2-4) */}
          {activeTab === 'attachments' && (
            <div className="pv-attachments-view-container">
              <div className="pv-attachments-header-bar">
                <div>
                  <h3>Uploaded Expense Bills &amp; Verification Receipts</h3>
                  <p>
                    Inspect attached bills (CEB electricity, SLT Mobitel, mobile SMS receipts, etc.)
                  </p>
                </div>
                <span className="pv-attachments-counter">{attachments.length} Document(s)</span>
              </div>

              {attachments.length === 0 ? (
                <div className="pv-empty-attachments-box">
                  <span className="pv-empty-icon">📭</span>
                  <h4>No bill attachments uploaded for this voucher.</h4>
                  <p>Users can attach bills during voucher creation.</p>
                </div>
              ) : (
                <div className="pv-viewer-attachments-grid">
                  {attachments.map((file, idx) => (
                    <div key={idx} className="pv-bill-card">
                      <div className="pv-bill-card-top">
                        <span className="pv-bill-tag">{file.category || 'Expense Bill'}</span>
                        <span className="pv-bill-size">
                          {file.size ? `${Math.round(file.size / 1024)} KB` : ''}
                        </span>
                      </div>

                      <div
                        className="pv-bill-card-preview"
                        onClick={() => setPreviewMedia(file)}
                        title="Click to view full resolution"
                      >
                        <img src={file.dataUrl} alt={file.name} className="pv-bill-img" />
                        <div className="pv-bill-hover-overlay">
                          <span>🔍 View Full Resolution</span>
                        </div>
                      </div>

                      <div className="pv-bill-card-bottom">
                        <span className="pv-bill-name" title={file.name}>
                          {file.name}
                        </span>
                        <button
                          type="button"
                          className="pv-bill-zoom-btn"
                          onClick={() => setPreviewMedia(file)}
                        >
                          Enlarge Bill
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer / Admin Action Bar */}
        <div className="pv-modal-footer viewer-footer">
          {isAdmin ? (
            <div className="pv-admin-decision-bar">
              <div className="pv-admin-remarks-input-wrap">
                <label>Admin Approval Remarks / Settlement Note:</label>
                <input
                  type="text"
                  className="pv-admin-remarks-input"
                  placeholder="e.g. Verified against CEB & SLT bills. Approved for bank transfer."
                  value={adminRemarks}
                  onChange={(e) => setAdminRemarks(e.target.value)}
                  disabled={isProcessing}
                />
              </div>

              <div className="pv-admin-buttons-group">
                <button
                  type="button"
                  className="pv-btn pv-btn-print"
                  onClick={handlePrint}
                  disabled={isProcessing}
                >
                  🖨️ Print
                </button>

                <button
                  type="button"
                  className="pv-btn pv-btn-reject"
                  onClick={() => onReject(voucher._id || voucher.voucherNo, adminRemarks)}
                  disabled={isProcessing}
                >
                  ✕ Reject Voucher
                </button>

                <button
                  type="button"
                  className="pv-btn pv-btn-approve"
                  onClick={() => onApprove(voucher._id || voucher.voucherNo, adminRemarks)}
                  disabled={isProcessing}
                >
                  ✓ Approve Voucher
                </button>
              </div>
            </div>
          ) : (
            <div className="pv-user-footer-bar">
              <button type="button" className="pv-btn secondary" onClick={onClose}>
                Close
              </button>
              <button type="button" className="pv-btn primary" onClick={handlePrint}>
                🖨️ Print Voucher
              </button>
            </div>
          )}
        </div>

        {/* Lightbox Modal for Full Resolution Bill Viewing */}
        {previewMedia && (
          <div className="pv-lightbox-overlay" onClick={() => setPreviewMedia(null)}>
            <div className="pv-lightbox-content" onClick={(e) => e.stopPropagation()}>
              <div className="pv-lightbox-header">
                <span className="pv-lightbox-title">
                  {previewMedia.name} &bull; {previewMedia.category || 'Expense Document'}
                </span>
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

export default VoucherDetailsModal;
