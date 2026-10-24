import React from 'react';
import './ExpensesReimbursementSheet.css';

/**
 * ExpensesReimbursementSheet
 * Exact replica of the physical Expenses Reimbursement Form sheet from Page 1 of the user's PDF:
 * - Scalloped badge with circles/dots around "SO FAST"
 * - MOTORS / Matugama
 * - Address: No : 11/7/F/3, Werellahena, Horana | Email : info@sofast.lk | Web : www.sofast.lk
 * - Bordered box title: EXPENSES REIMBURSEMENT FORM
 * - Dotted lines for: Name, Date, Subject, Remburshment Date
 * - Description | Amount (Rs.) table
 * - Total row
 * - 3 full dotted lines across page for notes / justification
 * - Requested by, Checked by, Approved by signature block
 * - CS CamScanner watermark
 */
function ExpensesReimbursementSheet({ voucher, onPrint }) {
  if (!voucher) return null;

  const voucherNo = voucher.voucherNo || 'ERF-2026-001';
  const name = voucher.name || voucher.requestedBy || '';
  const dateFormatted =
    voucher.dateFormatted ||
    (voucher.date ? new Date(voucher.date).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB'));
  const subject = voucher.subject || voucher.purpose || '';
  const reimbursementDate = voucher.reimbursementDate || dateFormatted;

  const items = Array.isArray(voucher.items) && voucher.items.length > 0 ? voucher.items : [
    { description: voucher.purpose || 'Petty Cash Expense', amount: voucher.amount || 0 }
  ];

  const totalAmount = voucher.amount || items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  const notes = voucher.notes || voucher.remarks || '';

  const requestedBy = voucher.requestedBy || name;
  const checkedBy = voucher.checkedBy || 'Accountant';
  const approvedBy = voucher.approvedBy || '';
  const approvedAt = voucher.approvedAt ? new Date(voucher.approvedAt).toLocaleDateString('en-GB') : '';

  const isApproved = voucher.status === 'Approved';
  const isRejected = voucher.status === 'Rejected';
  const isPending = voucher.status === 'Pending';

  // Minimum 5 rows for authentic paper look
  const minRows = 5;
  const emptyRowsCount = Math.max(0, minRows - items.length);

  return (
    <div className="erf-sheet-wrapper">
      {/* Top Action Bar (hidden on print) */}
      <div className="erf-sheet-actions no-print">
        <div className="erf-status-strip">
          <span className="erf-strip-label">Status:</span>
          {isApproved && (
            <span className="erf-strip-badge approved">
              ✓ Approved & Deducted from Fund {approvedBy ? `(${approvedBy})` : ''}
            </span>
          )}
          {isPending && (
            <span className="erf-strip-badge pending">
              🟡 Pending Admin Approval
            </span>
          )}
          {isRejected && (
            <span className="erf-strip-badge rejected">
              ✕ Rejected by Admin
            </span>
          )}
          <span className="erf-strip-voucherno">Form #{voucherNo}</span>
        </div>

        <button
          type="button"
          className="erf-print-action-btn"
          onClick={() => {
            if (onPrint) onPrint();
            else window.print();
          }}
        >
          🖨️ Print Form
        </button>
      </div>

      {/* The Physical Paper Document */}
      <div className="erf-paper-container" id="printable-erf-sheet">
        {/* Document Header Area */}
        <div className="erf-header-area">
          {/* Logo badge with circular beads matching the PDF Page 1 */}
          <div className="erf-logo-badge">
            <svg viewBox="0 0 160 85" className="erf-badge-svg" xmlns="http://www.w3.org/2000/svg">
              {/* Outer decorative pearl / dot chain */}
              <g fill="#000000">
                {/* Top / bottom / sides dotted pearls */}
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

          {/* Bordered Box Title */}
          <div className="erf-title-box">
            <h1 className="erf-title-text">EXPENSES REIMBURSEMENT FORM</h1>
          </div>
        </div>

        {/* Dotted Underline Fields Matching PDF */}
        <div className="erf-fields-block">
          {/* Name */}
          <div className="erf-field-row name-row">
            <span className="erf-field-label">Name</span>
            <span className="erf-field-colon">:</span>
            <div className="erf-field-line-wrapper">
              <span className="erf-field-value">{name}</span>
            </div>
          </div>

          {/* Date */}
          <div className="erf-field-row date-row">
            <span className="erf-field-label">Date</span>
            <span className="erf-field-colon">:</span>
            <div className="erf-field-line-wrapper">
              <span className="erf-field-value">{dateFormatted}</span>
            </div>
          </div>

          {/* Subject */}
          <div className="erf-field-row subject-row">
            <span className="erf-field-label">Subject</span>
            <span className="erf-field-colon">:</span>
            <div className="erf-field-line-wrapper">
              <span className="erf-field-value">{subject}</span>
            </div>
          </div>

          {/* Remburshment Date */}
          <div className="erf-field-row reimb-date-row">
            <span className="erf-field-label">Remburshment Date</span>
            <span className="erf-field-colon">:</span>
            <div className="erf-field-line-wrapper">
              <span className="erf-field-value">{reimbursementDate}</span>
            </div>
          </div>
        </div>

        {/* Expenses Table */}
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
                <tr key={index}>
                  <td className="col-desc">{item.description}</td>
                  <td className="col-amount">
                    {Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}

              {/* Blank empty rows to preserve authentic paper sheet look */}
              {Array.from({ length: emptyRowsCount }).map((_, idx) => (
                <tr key={`empty-${idx}`} className="empty-row">
                  <td className="col-desc">&nbsp;</td>
                  <td className="col-amount">&nbsp;</td>
                </tr>
              ))}

              {/* Total Row */}
              <tr className="total-row">
                <td className="total-label">Total</td>
                <td className="total-value">
                  {Number(totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Three Dotted Notes Lines Below Table */}
        <div className="erf-notes-block">
          <div className="erf-dotted-line-row">
            {notes && <span className="erf-notes-text">{notes}</span>}
          </div>
          <div className="erf-dotted-line-row"></div>
          <div className="erf-dotted-line-row"></div>
        </div>

        {/* Signatures Block: Requested by / Checked by / Approved by */}
        <div className="erf-signatures-grid">
          {/* Requested by */}
          <div className="erf-sig-col">
            <div className="erf-sig-line">
              <span className="erf-sig-handwriting">{requestedBy}</span>
            </div>
            <span className="erf-sig-label">Requested by</span>
          </div>

          {/* Checked by */}
          <div className="erf-sig-col">
            <div className="erf-sig-line">
              <span className="erf-sig-handwriting">{checkedBy}</span>
            </div>
            <span className="erf-sig-label">Checked by</span>
          </div>

          {/* Approved by */}
          <div className="erf-sig-col">
            <div className="erf-sig-line">
              {isApproved ? (
                <>
                  <span className="erf-sig-approval-stamp">
                    APPROVED {approvedAt ? `[${approvedAt}]` : ''}
                  </span>
                  <span className="erf-sig-handwriting" style={{ fontSize: '13px' }}>
                    {approvedBy || 'Admin'}
                  </span>
                </>
              ) : isRejected ? (
                <span style={{ color: '#b91c1c', fontWeight: 'bold', fontSize: '12px' }}>
                  REJECTED
                </span>
              ) : (
                <span style={{ color: '#94a3b8', fontSize: '11px', fontStyle: 'italic' }}>
                  Pending Signature
                </span>
              )}
            </div>
            <span className="erf-sig-label">Approved by</span>
          </div>
        </div>

        {/* Scanner Watermark */}
        <div className="erf-watermark-row">
          <span className="erf-scanner-text">
            <span className="erf-scanner-badge">CS</span> CamScanner
          </span>
        </div>
      </div>
    </div>
  );
}

export default ExpensesReimbursementSheet;
