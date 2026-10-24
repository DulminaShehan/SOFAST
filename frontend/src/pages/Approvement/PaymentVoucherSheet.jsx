import React from 'react';
import './PaymentVoucherSheet.css';

/**
 * PaymentVoucherSheet
 * Exact replica of the physical Payment Voucher sheet from Page 1 of the user's PDF:
 * - Sofast (Private) Limited. Payment Voucher header
 * - Dotted underline fields: PAYEE, DATE, BANK, CHEQUE NO, BRANCH
 * - PARTICULARS / ACCOUNT / AMOUNT (Rs. & Cts) table with Z-stroke line across unused rows
 * - Rupees in words line
 * - Prepared By, Checked By, Approved By, and Received By (Name, ID: 1602, Date, Signature Box)
 */
function PaymentVoucherSheet({ voucher, onPrint }) {
  if (!voucher) return null;

  // Extract or calculate values
  const voucherNo = voucher.voucherNo || 'PV-2026-001';
  const payeeName = voucher.payeeName || '';
  const payeeNote = voucher.payeeNote || '';
  const dateFormatted =
    voucher.dateFormatted ||
    (voucher.date ? new Date(voucher.date).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB'));
  const bank = voucher.bank || 'PEB';
  const branch = voucher.branch || 'Horana';
  const chequeNo = voucher.chequeNo || 'TFR.';
  const items = Array.isArray(voucher.items) && voucher.items.length > 0 ? voucher.items : [];
  
  // Total amount
  const totalAmount = voucher.totalAmount || voucher.amount || items.reduce((s, i) => s + (Number(i.totalLineAmount) || Number(i.amountRs) || 0), 0);
  const totalRs = Math.floor(totalAmount);
  const totalCts = Math.round((totalAmount - totalRs) * 100);

  const amountInWords = voucher.amountInWords || 'Rupees Only.';
  const preparedBy = voucher.preparedBy || 'cashier';
  const checkedBy = voucher.checkedBy || 'Accountant';
  const approvedBy = voucher.approvedBy || '';
  const approvedAt = voucher.approvedAt ? new Date(voucher.approvedAt).toLocaleDateString('en-GB') : '';
  const isApproved = voucher.status === 'Approved';
  const isRejected = voucher.status === 'Rejected';
  const isPending = voucher.status === 'Pending';
  const receivedByName = voucher.receivedByName || payeeName;
  const receivedByIdNumber = voucher.receivedByIdNumber || '1602';

  // Fill up to minimum 7 rows for authentic paper voucher look
  const minRows = 7;
  const emptyRowsCount = Math.max(0, minRows - items.length);

  return (
    <div className="pv-sheet-wrapper">
      {/* Top Action Bar (hidden on print) */}
      <div className="pv-sheet-actions no-print">
        <div className="pv-status-strip">
          <span className="pv-strip-label">Status:</span>
          {isApproved && (
            <span className="pv-strip-badge approved">
              ✓ Approved by Admin {approvedBy ? `(${approvedBy})` : ''}
            </span>
          )}
          {isPending && (
            <span className="pv-strip-badge pending">
              🟡 Pending Admin Approval
            </span>
          )}
          {isRejected && (
            <span className="pv-strip-badge rejected">
              ✕ Rejected by Admin
            </span>
          )}
          <span className="pv-strip-voucherno">Voucher #{voucherNo}</span>
        </div>

        <button
          type="button"
          className="pv-print-action-btn"
          onClick={() => {
            if (onPrint) onPrint();
            else window.print();
          }}
        >
          🖨️ Print Voucher
        </button>
      </div>

      {/* The Physical Paper Document */}
      <div className="pv-paper-container" id="printable-voucher-sheet">
        {/* Document Header */}
        <div className="pv-header-grid">
          {/* Logo badge matching Page 1 */}
          <div className="pv-logo-badge">
            <svg viewBox="0 0 120 70" className="pv-badge-svg" xmlns="http://www.w3.org/2000/svg">
              {/* Outer scalloped/ornate polygon border */}
              <path
                d="M10,25 C10,12 18,5 30,5 L90,5 C102,5 110,12 110,25 C110,35 115,40 115,45 C115,58 105,65 90,65 L30,65 C15,65 5,58 5,45 C5,40 10,35 10,25 Z"
                fill="none"
                stroke="#111827"
                strokeWidth="2.5"
                strokeDasharray="1, 0"
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

          {/* Company Title */}
          <div className="pv-title-area">
            <h1 className="pv-company-name">Sofast (Private) Limited.</h1>
            <h2 className="pv-document-title">Payment Voucher</h2>
          </div>
        </div>

        {/* Top Header Fields (Dotted Underlines) */}
        <div className="pv-top-fields">
          {/* Row 1: PAYEE & DATE */}
          <div className="pv-field-row">
            <div className="pv-field-col payee-col">
              <span className="pv-field-label">PAYEE</span>
              <span className="pv-field-colon">:</span>
              <div className="pv-dotted-line-content">
                <span className="pv-handwriting payee-main">{payeeName}</span>
                {payeeNote && <span className="pv-handwriting payee-note">{payeeNote}</span>}
              </div>
            </div>

            <div className="pv-field-col date-col">
              <span className="pv-field-label">DATE</span>
              <span className="pv-field-colon">:</span>
              <div className="pv-dotted-line-content">
                <span className="pv-handwriting">{dateFormatted}</span>
              </div>
            </div>
          </div>

          {/* Row 2: BANK & CHEQUE NO */}
          <div className="pv-field-row">
            <div className="pv-field-col bank-col">
              <span className="pv-field-label">BANK</span>
              <span className="pv-field-colon">:</span>
              <div className="pv-dotted-line-content">
                <span className="pv-handwriting">{bank}</span>
              </div>
            </div>

            <div className="pv-field-col cheque-col">
              <span className="pv-field-label">CHEQUE NO</span>
              <span className="pv-field-colon">:</span>
              <div className="pv-dotted-line-content">
                <span className="pv-handwriting">{chequeNo}</span>
              </div>
            </div>
          </div>

          {/* Row 3: BRANCH */}
          <div className="pv-field-row">
            <div className="pv-field-col branch-col">
              <span className="pv-field-label">BRANCH</span>
              <span className="pv-field-colon">:</span>
              <div className="pv-dotted-line-content">
                <span className="pv-handwriting">{branch}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Voucher Table with Authentic Border Structure */}
        <div className="pv-table-wrapper">
          <table className="pv-table">
            <thead>
              <tr>
                <th className="pv-th-particulars">PARTICULARS</th>
                <th className="pv-th-account">ACCOUNT</th>
                <th className="pv-th-amount-wrapper" colSpan="2">
                  <div className="pv-th-amount-top">AMOUNT</div>
                  <div className="pv-th-amount-split">
                    <span className="pv-sub-th-rs">Rs.</span>
                    <span className="pv-sub-th-cts">Cts</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Item Rows */}
              {items.map((item, idx) => {
                const rs = item.amountRs ?? Math.floor(item.totalLineAmount || 0);
                const cts = item.amountCts ?? Math.round(((item.totalLineAmount || 0) - rs) * 100);
                return (
                  <tr key={idx} className="pv-row-data">
                    <td className="pv-td-particulars">
                      <span className="pv-handwriting-cell">{item.particulars}</span>
                    </td>
                    <td className="pv-td-account">
                      <span className="pv-handwriting-cell">{item.account}</span>
                    </td>
                    <td className="pv-td-rs">
                      <span className="pv-handwriting-cell">{rs > 0 ? rs.toLocaleString() : ''}</span>
                    </td>
                    <td className="pv-td-cts">
                      <span className="pv-handwriting-cell">{String(cts).padStart(2, '0')}</span>
                    </td>
                  </tr>
                );
              })}

              {/* Classic Empty Rows with Z / diagonal strike-through effect matching Page 1 */}
              {Array.from({ length: emptyRowsCount }).map((_, idx) => (
                <tr key={`empty-${idx}`} className="pv-row-empty">
                  <td className="pv-td-particulars empty-cell">
                    {/* Render the classic handwritten circled amount & Z-stroke on first empty row */}
                    {idx === 0 && (
                      <div className="pv-callout-overlay">
                        <div className="pv-circled-amount">
                          <span>{totalRs.toLocaleString()}/=</span>
                        </div>
                        {/* Diagonal Z line */}
                        <svg className="pv-z-strike-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <line x1="10" y1="10" x2="90" y2="10" stroke="#0f172a" strokeWidth="2.5" />
                          <line x1="90" y1="10" x2="10" y2="90" stroke="#0f172a" strokeWidth="2.5" />
                          <line x1="10" y1="90" x2="90" y2="90" stroke="#0f172a" strokeWidth="2.5" />
                        </svg>
                      </div>
                    )}
                  </td>
                  <td className="pv-td-account empty-cell"></td>
                  <td className="pv-td-rs empty-cell"></td>
                  <td className="pv-td-cts empty-cell"></td>
                </tr>
              ))}
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
          {/* Prepared By & Checked By Row */}
          <div className="pv-sig-row-top">
            <div className="pv-sig-col">
              <div className="pv-sig-handwriting-box">
                <span className="pv-sig-signature-mock">{preparedBy}</span>
              </div>
              <div className="pv-sig-line"></div>
              <span className="pv-sig-role">Prepared By</span>
            </div>

            <div className="pv-sig-col">
              <div className="pv-sig-handwriting-box">
                {checkedBy && <span className="pv-sig-signature-mock faint">{checkedBy}</span>}
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
                {isApproved ? (
                  <div className="pv-official-stamp approved-stamp">
                    <span className="stamp-icon">✓</span>
                    <div className="stamp-text">
                      <strong>APPROVED BY ADMIN</strong>
                      <span className="stamp-details">
                        {approvedBy || 'System Administrator'} &bull; {approvedAt || dateFormatted}
                      </span>
                    </div>
                  </div>
                ) : isRejected ? (
                  <div className="pv-official-stamp rejected-stamp">
                    <span className="stamp-icon">✕</span>
                    <div className="stamp-text">
                      <strong>REJECTED BY ADMIN</strong>
                      <span className="stamp-details">{approvedBy || 'Administrator'}</span>
                    </div>
                  </div>
                ) : (
                  <span className="pv-approved-dotted-line">
                    <span className="pv-awaiting-txt">(Pending Admin Review)</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Received By Section */}
          <div className="pv-received-by-section">
            <div className="pv-received-title">Received By</div>

            <div className="pv-received-fields-grid">
              {/* Name & Date column */}
              <div className="pv-received-left-col">
                <div className="pv-rec-field">
                  <div className="pv-dotted-line-rec">
                    <span className="pv-handwriting">{receivedByName}</span>
                  </div>
                  <span className="pv-rec-label">Name</span>
                </div>

                <div className="pv-rec-field">
                  <div className="pv-dotted-line-rec">
                    <span className="pv-handwriting">{dateFormatted}</span>
                  </div>
                  <span className="pv-rec-label">Date</span>
                </div>
              </div>

              {/* ID Number column */}
              <div className="pv-received-mid-col">
                <span className="pv-rec-label-top">ID number</span>
                <span className="pv-handwriting id-number-val">{receivedByIdNumber}</span>
              </div>

              {/* Signature Box column */}
              <div className="pv-received-right-col">
                <span className="pv-rec-label-top">Signature</span>
                <div className="pv-signature-box">
                  {isApproved && <span className="pv-received-signed-mock">✓ Signed</span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CamScanner / Document Authenticity Footer watermark */}
        <div className="pv-scanner-footer">
          <div className="pv-footer-left">SOFAST MOTORS MANAGEMENT SYSTEM &bull; REF: {voucherNo}</div>
          <div className="pv-camscanner-tag">
            <span className="cs-box">CS</span>
            <span className="cs-text">CamScanner</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaymentVoucherSheet;
