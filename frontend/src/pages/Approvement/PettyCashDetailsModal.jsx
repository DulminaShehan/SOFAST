import React, { useState } from 'react';
import ExpensesReimbursementSheet from './ExpensesReimbursementSheet';
import './PaymentVoucherModal.css';

/**
 * PettyCashDetailsModal
 * Full-fidelity viewer for Expenses Reimbursement Form.
 * Allows Admin to approve (deducting from spendable limit) or reject.
 * Allows viewing attached bill receipts and printing the exact sheet.
 */
function PettyCashDetailsModal({
  isOpen,
  onClose,
  voucher,
  isAdmin,
  onApprove,
  onReject,
  isProcessing,
  spendableLimit,
}) {
  if (!isOpen || !voucher) return null;

  const [activeViewTab, setActiveViewTab] = useState('sheet'); // 'sheet' | 'bills'
  const [adminRemarks, setAdminRemarks] = useState(voucher.remarks || '');
  const [activeImagePreview, setActiveImagePreview] = useState(null);

  const attachments = Array.isArray(voucher.attachments) ? voucher.attachments : [];
  const isPending = voucher.status === 'Pending';
  const isApproved = voucher.status === 'Approved';
  const isRejected = voucher.status === 'Rejected';

  const voucherAmount = Number(voucher.amount) || 0;
  const currentFund = spendableLimit ? spendableLimit.remainingLimit : 50000;
  const newBalanceAfterApproval = Math.max(0, currentFund - voucherAmount);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="pv-modal-overlay">
      <div className="pv-modal-container" style={{ maxWidth: '980px', maxHeight: '92vh' }}>
        {/* Modal Header */}
        <div className="pv-modal-header no-print">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 className="pv-modal-title">
                Expenses Reimbursement Form: {voucher.voucherNo}
              </h2>
              {isApproved && (
                <span className="erf-strip-badge approved">✓ Approved &amp; Deducted</span>
              )}
              {isPending && (
                <span className="erf-strip-badge pending">🟡 Pending Approval</span>
              )}
              {isRejected && (
                <span className="erf-strip-badge rejected">✕ Rejected</span>
              )}
            </div>
            <p className="pv-modal-subtitle">
              Submitted by <strong>{voucher.name || voucher.requestedBy}</strong> on{' '}
              {voucher.dateFormatted || new Date(voucher.date || voucher.createdAt).toLocaleDateString()}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="pv-btn-secondary"
              onClick={handlePrint}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            >
              🖨️ Print Form
            </button>
            <button type="button" className="pv-close-btn" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {/* View Switcher: Physical Form vs Attached Bills */}
        <div
          className="no-print"
          style={{
            display: 'flex',
            gap: '8px',
            padding: '10px 24px',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveViewTab('sheet')}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: activeViewTab === 'sheet' ? '1px solid #1e3a8a' : '1px solid #cbd5e1',
              background: activeViewTab === 'sheet' ? '#1e3a8a' : '#ffffff',
              color: activeViewTab === 'sheet' ? '#ffffff' : '#334155',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            📄 Physical Reimbursement Sheet (Page 1)
          </button>

          <button
            type="button"
            onClick={() => setActiveViewTab('bills')}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: activeViewTab === 'bills' ? '1px solid #1e3a8a' : '1px solid #cbd5e1',
              background: activeViewTab === 'bills' ? '#1e3a8a' : '#ffffff',
              color: activeViewTab === 'bills' ? '#ffffff' : '#334155',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            📎 Attached Bills &amp; Receipts ({attachments.length})
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="pv-modal-body" style={{ background: '#f1f5f9', padding: '24px' }}>
          {activeViewTab === 'sheet' && (
            <ExpensesReimbursementSheet voucher={voucher} onPrint={handlePrint} />
          )}

          {activeViewTab === 'bills' && (
            <div style={{ background: '#ffffff', borderRadius: '8px', padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#0f172a' }}>
                Attached Invoices, Fuel Slips &amp; Receipts ({attachments.length})
              </h3>

              {attachments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
                  <strong>No bill attachments provided for this reimbursement.</strong>
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '16px',
                  }}
                >
                  {attachments.map((att, idx) => (
                    <div
                      key={idx}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        background: '#f8fafc',
                      }}
                    >
                      <div
                        style={{
                          height: '180px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: '#ffffff',
                          cursor: 'pointer',
                          overflow: 'hidden',
                        }}
                        onClick={() => setActiveImagePreview(att)}
                      >
                        {att.dataUrl?.startsWith('data:image') || att.type?.includes('image') ? (
                          <img
                            src={att.dataUrl}
                            alt={att.name}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        ) : (
                          <div style={{ textAlign: 'center', color: '#475569' }}>
                            <span style={{ fontSize: '36px' }}>📄</span>
                            <div style={{ fontSize: '12px', marginTop: '4px' }}>PDF Document</div>
                          </div>
                        )}
                      </div>
                      <div style={{ padding: '10px 12px' }}>
                        <div
                          style={{
                            fontWeight: '700',
                            fontSize: '13px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {att.name}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {att.size ? `${(att.size / 1024).toFixed(1)} KB` : 'Attached file'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveImagePreview(att)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#2563eb',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                            }}
                          >
                            👁️ View Full
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Admin Decision Bar (If Admin and Pending) */}
        {isAdmin && isPending && (
          <div
            className="no-print"
            style={{
              padding: '16px 24px',
              background: '#eff6ff',
              borderTop: '2px solid #bfdbfe',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Spendable Limit Impact Callout */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #93c5fd',
                borderRadius: '6px',
                padding: '10px 14px',
                fontSize: '13px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <strong style={{ color: '#1e3a8a' }}>Fund Limit Deduction Notice:</strong>
                <span style={{ marginLeft: '8px', color: '#334155' }}>
                  Approving will deduct{' '}
                  <strong style={{ color: '#b91c1c' }}>
                    Rs. {voucherAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </strong>{' '}
                  from the available spendable balance of{' '}
                  <strong>Rs. {Number(currentFund).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>.
                </span>
              </div>
              <div style={{ fontWeight: '800', color: '#15803d' }}>
                New Balance: Rs. {newBalanceAfterApproval.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Optional Admin approval remarks / notes..."
                value={adminRemarks}
                onChange={(e) => setAdminRemarks(e.target.value)}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                }}
              />

              <button
                type="button"
                disabled={isProcessing}
                onClick={() => onApprove(voucher._id || voucher.voucherNo, adminRemarks)}
                style={{
                  background: '#15803d',
                  color: '#ffffff',
                  border: 'none',
                  padding: '9px 20px',
                  borderRadius: '6px',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {isProcessing ? 'Processing...' : '✓ Approve & Deduct Fund'}
              </button>

              <button
                type="button"
                disabled={isProcessing}
                onClick={() => onReject(voucher._id || voucher.voucherNo, adminRemarks)}
                style={{
                  background: '#b91c1c',
                  color: '#ffffff',
                  border: 'none',
                  padding: '9px 18px',
                  borderRadius: '6px',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                ✕ Reject
              </button>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="pv-modal-footer no-print">
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Form #{voucher.voucherNo} &bull; Total: Rs.{' '}
            {Number(voucher.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <button type="button" className="pv-btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        {/* Lightbox Preview */}
        {activeImagePreview && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.85)',
              zIndex: 99999,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
            onClick={() => setActiveImagePreview(null)}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: '8px',
                padding: '16px',
                maxWidth: '90vw',
                maxHeight: '90vh',
                overflow: 'auto',
                position: 'relative',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                }}
              >
                <strong>{activeImagePreview.name}</strong>
                <button
                  type="button"
                  onClick={() => setActiveImagePreview(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>
              <img
                src={activeImagePreview.dataUrl}
                alt={activeImagePreview.name}
                style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain' }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PettyCashDetailsModal;
