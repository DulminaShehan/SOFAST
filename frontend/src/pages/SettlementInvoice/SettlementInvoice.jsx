import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ClassicNavbar from '../../components/navigation/ClassicNavbar';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { handleEnterNavigation } from '../../hooks/useEnterKeyNavigation';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { compareBillPrintItems } from '../../utils/itemSort';
import './SettlementInvoice.css';

/**
 * SOFAST MOTORS - Settlement Invoice Module
 * Exact Classic Visual Basic 6 desktop ERP layout matching legacy G.R. Settlement design.
 * Full MongoDB Atlas data integration, real-time calculations, and thermal receipt printing.
 */
function SettlementInvoice() {
  const navigate = useNavigate();
  const { confirmSave, confirmDelete } = useConfirmDialog();
  const location = useLocation();
  const { isAdmin } = useAuth();
  const { confirm } = useConfirm();

  // Backend Data Lists
  const [invoicesList, setInvoicesList] = useState([]);
  const [banksList, setBanksList] = useState([]);
  const [settlementsList, setSettlementsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Top Section: G.R. / Invoice & Customer
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedInvoiceNumber, setSelectedInvoiceNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [cashierUser, setCashierUser] = useState(
    localStorage.getItem('username') || localStorage.getItem('userCode') || 'PC004'
  );

  // Middle Section: Payment / Settlement Inputs
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [chequeNo, setChequeNo] = useState('');
  const [dateRealized, setDateRealized] = useState('');
  const [bank, setBank] = useState('');
  const [receiptNo, setReceiptNo] = useState('');

  // Selected settlement in DataGrid for deletion
  const [selectedSettlementId, setSelectedSettlementId] = useState(null);

  // Modals & Popups
  const [invoiceLookupOpen, setInvoiceLookupOpen] = useState(false);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false);

  // Current time for thermal receipt
  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  );

  const showNotification = (msg, type = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Fetch Initial Data (Invoices, Banks, Next Receipt)
  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [invsRes, banksRes, recRes] = await Promise.all([
        api.get('/invoices?type=standard&limit=250').catch(() => null),
        api.get('/settlements/banks').catch(() => null),
        api.get('/settlements/next-receipt').catch(() => null),
      ]);

      let availableInvoices = [];
      if (invsRes?.data?.data) {
        availableInvoices = invsRes.data.data.filter(
          (inv) => !inv.isManualInvoice && inv.invoiceType !== 'Manual' && !String(inv.invoiceNumber || '').toUpperCase().startsWith('MAN-')
        );
        setInvoicesList(availableInvoices);
      }
      if (banksRes?.data?.data) {
        setBanksList(banksRes.data.data);
      }
      if (recRes?.data?.data?.receiptNo) {
        setReceiptNo(recRes.data.data.receiptNo);
      }

      // Check if routed from Create Invoice or Remaining Balance with specific invoice
      if (location.state?.invoice) {
        handleSelectInvoice(location.state.invoice);
      } else if (location.state?.invoiceNumber) {
        const invNum = String(location.state.invoiceNumber).trim();
        const match = availableInvoices.find(
          (i) => String(i.invoiceNumber).toLowerCase() === invNum.toLowerCase() || String(i.no) === invNum
        );
        if (match) {
          handleSelectInvoice(match);
        } else {
          api.get(`/invoices/${invNum}`).then((single) => {
            if (single?.data?.data) handleSelectInvoice(single.data.data);
          }).catch(() => null);
        }
      }
    } catch (e) {
      showNotification('Failed to initialize Settlement data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [location.state]);

  // Fetch Settlements for Selected Invoice
  const fetchInvoiceSettlements = async (invNum) => {
    if (!invNum) {
      setSettlementsList([]);
      return;
    }
    try {
      const res = await api.get(`/settlements/invoice/${invNum}`);
      if (res.data?.data) {
        setSettlementsList(res.data.data);
      }
    } catch (e) {
      setSettlementsList([]);
    }
  };

  // Handle Invoice Selection
  const handleSelectInvoice = (inv) => {
    if (inv && (inv.isManualInvoice || inv.invoiceType === 'Manual' || String(inv.invoiceNumber || '').toUpperCase().startsWith('MAN-'))) {
      showNotification(`Invoice '${inv.invoiceNumber}' is a Manual Invoice and cannot be settled in standard Settlements.`, 'warning');
      return;
    }
    if (!inv) {
      setSelectedInvoice(null);
      setSelectedInvoiceNumber('');
      setCustomerName('');
      setCustomerAddress('');
      setPaymentAmount('');
      setPaymentMethod('');
      setChequeNo('');
      setDateRealized('');
      setBank('');
      setSelectedSettlementId(null);
      setSettlementsList([]);
      return;
    }

    setSelectedInvoice(inv);
    setSelectedInvoiceNumber(inv.invoiceNumber || String(inv.no));
    setCustomerName(inv.customerName || (inv.customerCode ? `${inv.customerCode}` : ''));

    const addr = inv.customerAddress || '';
    const tel = inv.customerTelephone || inv.telephone || '';
    setCustomerAddress(tel && !addr.includes(tel) ? (addr ? `${addr}\n${tel}` : tel) : addr);

    if (inv.date) {
      try {
        setInvoiceDate(new Date(inv.date).toISOString().split('T')[0]);
      } catch (e) {
        setInvoiceDate(new Date().toISOString().split('T')[0]);
      }
    }

    // Reset payment inputs
    setPaymentAmount('');
    setPaymentMethod('');
    setChequeNo('');
    setDateRealized('');
    setBank('');
    setSelectedSettlementId(null);

    fetchInvoiceSettlements(inv.invoiceNumber || String(inv.no));
    setInvoiceLookupOpen(false);
  };

  // =========================================================================
  // CORE BUSINESS CALCULATIONS
  // =========================================================================
  const round2 = (val) => Math.round((Number(val) || 0) * 100) / 100;

  const formatCurrency = (val) => {
    if (val === undefined || val === null || val === '') return '';
    const num = Number(val);
    if (isNaN(num)) return '';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Invoice Totals from Real Database Record
  const invoiceTotalGross = selectedInvoice
    ? (selectedInvoice.lineItems && selectedInvoice.lineItems.length > 0
        ? selectedInvoice.lineItems.reduce(
            (sum, li) => sum + (parseFloat(li.price || li.unitPrice || 0) * parseFloat(li.quantity || li.qty || 1)),
            0
          )
        : parseFloat(selectedInvoice.subTotal || selectedInvoice.amountToPay || selectedInvoice.netTotal || 0))
    : 0;

  const invoiceLineDiscounts = selectedInvoice
    ? (selectedInvoice.lineItems && selectedInvoice.lineItems.length > 0
        ? selectedInvoice.lineItems.reduce((sum, li) => sum + parseFloat(li.discountAmount || 0), 0) + (parseFloat(selectedInvoice.specialDiscount) || 0)
        : (parseFloat(selectedInvoice.specialDiscount) || 0))
    : 0;

  const amountToBePaid = selectedInvoice ? round2(Math.max(0, invoiceTotalGross - invoiceLineDiscounts)) : 0;

  // 2. Previously Saved Settlements Sum from MongoDB
  const previouslyAppliedPayments = selectedInvoice
    ? round2(settlementsList.reduce((sum, s) => sum + (Number(s.amount) || 0), 0))
    : 0;

  // 3. Outstanding Balance Before Current Payment
  const outstandingBalanceBefore = selectedInvoice
    ? (settlementsList.length > 0
        ? round2(Math.max(0, amountToBePaid - previouslyAppliedPayments))
        : (selectedInvoice.isSettled === true || (selectedInvoice.paymentStatus === 'paid' && Number(selectedInvoice.dueAmount) === 0 && Number(selectedInvoice.paidAmount) > 0)
            ? 0
            : (selectedInvoice.dueAmount !== undefined && Number(selectedInvoice.dueAmount) > 0
                ? round2(Number(selectedInvoice.dueAmount))
                : amountToBePaid)))
    : 0;

  // 4. Return Amount
  const invoiceReturnAmount = selectedInvoice
    ? round2(Number(selectedInvoice.returnAmount || selectedInvoice.goodReturnAmount || 0))
    : 0;

  // 5. Current Typed Payment Calculations
  const hasTypedPayment = paymentAmount !== '' && !isNaN(parseFloat(paymentAmount));
  const typedAmount = hasTypedPayment ? round2(parseFloat(paymentAmount)) : 0;

  const amountReceivedVal = hasTypedPayment && typedAmount > 0 ? typedAmount : 0;
  const amountAppliedVal = hasTypedPayment && typedAmount > 0
    ? round2(Math.min(amountReceivedVal, outstandingBalanceBefore))
    : 0;
  const changeCashReturnVal = hasTypedPayment && typedAmount > 0
    ? round2(Math.max(0, amountReceivedVal - amountAppliedVal))
    : 0;

  const totalAmountReceivedVal = round2(previouslyAppliedPayments + amountAppliedVal);
  const balanceAfterVal = hasTypedPayment && typedAmount > 0
    ? round2(Math.max(0, outstandingBalanceBefore - amountAppliedVal))
    : outstandingBalanceBefore;

  // Print Bill / Thermal Receipt handler
  const handlePrintBill = () => {
    if (!selectedInvoiceNumber && (!selectedInvoice || !selectedInvoice.invoiceNumber)) {
      showNotification('Please select an Invoice first before printing the bill', 'error');
      return;
    }

    setCurrentTime(
      new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    );

    requestAnimationFrame(() => {
      setTimeout(() => {
        window.print();
      }, 50);
    });
  };

  const handlePrintReceipt = handlePrintBill;

  // Button: New (Clears all fields completely to clean initial state)
  const handleNew = async () => {
    setSelectedInvoice(null);
    setSelectedInvoiceNumber('');
    setCustomerName('');
    setCustomerAddress('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentAmount('');
    setPaymentMethod('');
    setChequeNo('');
    setDateRealized('');
    setBank('');
    setSelectedSettlementId(null);
    setSettlementsList([]);

    try {
      const recRes = await api.get('/settlements/next-receipt');
      if (recRes?.data?.data?.receiptNo) {
        setReceiptNo(recRes.data.data.receiptNo);
      }
    } catch (e) {
      // Retain existing receiptNo
    }

    showNotification('Form cleared for new entry', 'info');
  };

  // Button: Save Settlement
  const handleSaveSettlement = async () => {
    if (isSubmitting || loading) return;

    if (!selectedInvoice || !selectedInvoiceNumber) {
      showNotification('Please select an Invoice first', 'error');
      return;
    }

    if (!hasTypedPayment || typedAmount <= 0) {
      showNotification('Please enter a valid Payment Amount greater than 0', 'error');
      return;
    }

    if (outstandingBalanceBefore <= 0) {
      showNotification('This invoice is already fully paid and settled', 'error');
      return;
    }

    if (amountAppliedVal <= 0) {
      showNotification('No payment amount can be applied to this invoice', 'error');
      return;
    }

    const method = paymentMethod || 'Cash';

    if ((method === 'Cheque' || method === 'Credit Note') && !chequeNo.trim()) {
      showNotification(`Please enter the ${method === 'Cheque' ? 'Cheque' : 'Credit Note'} number`, 'error');
      return;
    }

    if (method === 'Cheque' && !bank.trim()) {
      showNotification('Please select or enter the Bank for the cheque', 'error');
      return;
    }

    const payload = {
      invoiceNumber: selectedInvoiceNumber,
      amount: amountAppliedVal, // Amount applied to reduce invoice balance
      method,
      received: amountReceivedVal, // Actual customer payment amount
      change: changeCashReturnVal, // Change / cash return amount
      chequeNo: chequeNo.trim(),
      bank: bank.trim(),
      dateRealized: dateRealized ? dateRealized.trim() : '',
      date: paymentDate,
      receiptNo: receiptNo.trim(),
    };

    try {
      setIsSubmitting(true);
      setLoading(true);
      const res = await api.post('/settlements', payload);
      if (res.data?.success) {
        showNotification(res.data.message || 'Settlement saved successfully!', 'success');

        // Update local invoice state
        if (res.data.invoice) {
          setSelectedInvoice((prev) =>
            prev
              ? {
                  ...prev,
                  dueAmount: res.data.invoice.remainingBalance,
                  paidAmount: res.data.invoice.totalPaid,
                  amountReceived: res.data.invoice.totalPaid,
                  paymentStatus: res.data.invoice.paymentStatus,
                  isSettled: res.data.invoice.isSettled,
                }
              : null
          );
        }

        // Refresh settlements list for this invoice
        await fetchInvoiceSettlements(selectedInvoiceNumber);

        // Refresh global invoices list
        const invsRes = await api.get('/invoices?type=standard&limit=250').catch(() => null);
        if (invsRes?.data?.data) {
          const standardOnly = invsRes.data.data.filter(
            (inv) => !inv.isManualInvoice && inv.invoiceType !== 'Manual' && !String(inv.invoiceNumber || '').toUpperCase().startsWith('MAN-')
          );
          setInvoicesList(standardOnly);
        }

        // Fetch next receipt number
        const recRes = await api.get('/settlements/next-receipt').catch(() => null);
        if (recRes?.data?.data?.receiptNo) {
          setReceiptNo(recRes.data.data.receiptNo);
        }

        // Reset payment entry inputs
        setPaymentAmount('');
        setChequeNo('');
        setDateRealized('');
        setBank('');
        setSelectedSettlementId(null);

        // Prompt: "Do you wish to print this settlement receipt?" (Standard Windows Yes/No dialog)
        setTimeout(async () => {
          const shouldPrint = await confirm({
            title: 'SOFAST POS - Print Settlement',
            message: 'Do you wish to print this settlement receipt?',
            icon: 'print',
            defaultFocus: 'yes',
          });
          if (shouldPrint) {
            handlePrintBill();
          }
        }, 150);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save Settlement';
      showNotification(msg, 'error');
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  // Button: Delete Settlement
  const handleDeleteSettlement = async () => {
    if (!selectedSettlementId) {
      showNotification('Please select a settlement row from Settlement History table below to delete', 'error');
      return;
    }

    const confirmDel = await confirm({
      title: 'SOFAST POS - Delete Settlement',
      message: 'Are you sure you want to delete this settlement record? The amount will be restored to the invoice balance.',
      icon: 'warning',
      defaultFocus: 'no',
    });
    if (!confirmDel) return;

    try {
      setLoading(true);
      const res = await api.delete(`/settlements/${selectedSettlementId}`);
      if (res.data?.success) {
        showNotification(res.data.message || 'Settlement deleted and balance restored', 'success');

        await fetchInvoiceSettlements(selectedInvoiceNumber);

        if (res.data.data?.restoredBalance !== undefined) {
          setSelectedInvoice((prev) =>
            prev ? { ...prev, dueAmount: res.data.data.restoredBalance } : null
          );
        }

        const invsRes = await api.get('/invoices?type=standard&limit=250').catch(() => null);
        if (invsRes?.data?.data) {
          const standardOnly = invsRes.data.data.filter(
            (inv) => !inv.isManualInvoice && inv.invoiceType !== 'Manual' && !String(inv.invoiceNumber || '').toUpperCase().startsWith('MAN-')
          );
          setInvoicesList(standardOnly);
        }

        setSelectedSettlementId(null);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to delete Settlement';
      showNotification(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Line items for the thermal receipt
  const displayLineItems = selectedInvoice?.lineItems || [];

  // Filtered invoices for lookup modal (Standard invoices only)
  const filteredInvoices = invoicesList
    .filter((inv) => !inv.isManualInvoice && inv.invoiceType !== 'Manual' && !String(inv.invoiceNumber || '').toUpperCase().startsWith('MAN-'))
    .filter((inv) => {
      const q = invoiceSearchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        inv.invoiceNumber?.toLowerCase().includes(q) ||
        inv.customerCode?.toLowerCase().includes(q) ||
        inv.customerName?.toLowerCase().includes(q) ||
        inv.date?.toLowerCase().includes(q)
      );
    });

  // Reusable Compact Thermal Receipt Component
  const renderThermalReceiptContent = () => {
    const sortedPrintLineItems = [...displayLineItems].sort(compareBillPrintItems);

    return (
      <div className="thermal-receipt">
        <div className="thermal-receipt-header">
          <div className="thermal-receipt-title">SOFA ST (PVT) LTD</div>
          <div className="thermal-receipt-subtitle">Dealer for David Peris Motor Company</div>
          <div className="thermal-receipt-address">7E, MADDE GODA ROAD, MATHUGAMA</div>
          <div className="thermal-receipt-address">034-2210680, 074-0295088</div>
        </div>

        <div className="thermal-receipt-dashed"></div>

        <div className="thermal-receipt-meta">
          <div className="thermal-receipt-meta-row">
            <span>Date: {invoiceDate}</span>
            <span>Time: {currentTime}</span>
          </div>
          <div className="thermal-receipt-meta-row">
            <span>Inv No: {selectedInvoiceNumber || '-'}</span>
            <span>User: {cashierUser}</span>
          </div>
          {customerName && (
            <div className="thermal-receipt-meta-row">
              <span>Customer: {customerName}</span>
            </div>
          )}
        </div>

        <div className="thermal-receipt-dashed"></div>

        {/* Items Table */}
        <table className="thermal-receipt-table">
          <thead>
            <tr>
              <th className="thermal-th-item" style={{ textAlign: 'left' }}>Item</th>
              <th className="thermal-th-qtyrate" style={{ textAlign: 'right' }}>Qty x Rate</th>
              <th className="thermal-th-amount" style={{ textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {sortedPrintLineItems.length === 0 ? (
              <tr>
                <td colSpan="3" style={{ textAlign: 'center', color: '#555', fontStyle: 'italic', padding: '2px 0' }}>
                  No line items
                </td>
              </tr>
            ) : (
              sortedPrintLineItems.map((li, idx) => (
                <tr key={idx} className="thermal-tr-item">
                  <td className="thermal-td-item" style={{ textAlign: 'left', wordBreak: 'break-word' }}>
                    {li.jobType === 'Labour' || li.isService
                      ? (li.description || 'Delivery Charge')
                      : `${li.code || li.itemCode ? `${li.code || li.itemCode} - ` : ''}${li.description || ''}`}
                  </td>
                  <td className="thermal-td-qtyrate" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {Number(li.quantity || li.qty || 1).toFixed(2)} x {Number(li.price || li.unitPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="thermal-td-amount" style={{ textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                    {Number(li.value || (li.price * li.quantity) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="thermal-receipt-dashed"></div>

        {/* Totals */}
        <div className="thermal-receipt-totals">
          <div className="thermal-receipt-total-row thermal-receipt-total-main">
            <span>Amount to Be Paid:</span>
            <span>{formatCurrency(amountToBePaid)}</span>
          </div>
          {invoiceLineDiscounts > 0 && (
            <div className="thermal-receipt-total-row">
              <span>Total Discount:</span>
              <span>{formatCurrency(invoiceLineDiscounts)}</span>
            </div>
          )}
          <div className="thermal-receipt-total-row">
            <span>Total Paid Toward Inv:</span>
            <span style={{ fontWeight: 'bold' }}>{formatCurrency(totalAmountReceivedVal)}</span>
          </div>
          {hasTypedPayment && typedAmount > 0 && (
            <>
              <div className="thermal-receipt-total-row">
                <span>Payment Received:</span>
                <span>{formatCurrency(amountReceivedVal)}</span>
              </div>
              <div className="thermal-receipt-total-row">
                <span>Amount Applied:</span>
                <span style={{ fontWeight: 'bold' }}>{formatCurrency(amountAppliedVal)}</span>
              </div>
              {changeCashReturnVal > 0 && (
                <div className="thermal-receipt-total-row">
                  <span>Change / Cash Return:</span>
                  <span style={{ fontWeight: 'bold' }}>{formatCurrency(changeCashReturnVal)}</span>
                </div>
              )}
            </>
          )}
          <div className="thermal-receipt-total-row">
            <span>Remaining Balance:</span>
            <span style={{ fontWeight: 'bold' }}>{formatCurrency(balanceAfterVal)}</span>
          </div>
        </div>

        <div className="thermal-receipt-dashed"></div>

        <div className="thermal-receipt-notice">
          In case of price discrepancy, return the items & bill within 3 days for refund of difference
        </div>
      </div>
    );
  };

  return (
    <div className="settlement-page-wrapper">
      {/* 1. Top Classic Navigation Menu Bar */}
      <ClassicNavbar activeMenu="sales-service" />

      {/* 2. Windows Classic Title Bar */}
      <header className="settlement-win-titlebar">
        <div className="settlement-win-brand">
          <svg className="settlement-win-icon" viewBox="0 0 24 24">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
          </svg>
          <span className="settlement-win-heading">Settlement Invoice</span>
        </div>
        <div className="settlement-win-controls">
          <button type="button" className="settlement-ctrl-btn" aria-label="Minimize">&#8212;</button>
          <button type="button" className="settlement-ctrl-btn" aria-label="Maximize">&#9633;</button>
          <button
            type="button"
            className="settlement-ctrl-btn close"
            aria-label="Close"
            onClick={() => navigate('/invoice')}
          >
            &#x2715;
          </button>
        </div>
      </header>

      {/* 3. Main Classic VB6 ERP Form Container */}
      <main
        className="settlement-vb6-main"
        onKeyDown={(e) => handleEnterNavigation(e, { saveButtonSelector: '.settlement-vb6-btn-save' })}
      >
        {/* Notification Alert */}
        {notification && (
          <div className={`settlement-vb6-alert ${notification.type}`}>
            <span>{notification.message}</span>
            <button
              type="button"
              className="settlement-vb6-alert-close"
              onClick={() => setNotification(null)}
            >
              &#x2715;
            </button>
          </div>
        )}

        <div className="settlement-vb6-form-window">
          {/* ========================================================= */}
          {/* TOP SECTION: G.R. No, Value, Customer, Return, Balance   */}
          {/* ========================================================= */}
          <div className="settlement-vb6-top-grid">
            {/* Row 1: G.R. No, Value, Customer */}
            <div className="settlement-vb6-top-row">
              <div className="settlement-vb6-field grn-field">
                <span className="settlement-vb6-navy-label grn-label">G.R. No: . . . .</span>
                <div className="settlement-vb6-combo-wrap">
                  <select
                    className="settlement-vb6-select grn-select"
                    value={selectedInvoiceNumber}
                    onChange={(e) => {
                      const invNum = e.target.value;
                      const match = invoicesList.find((i) => i.invoiceNumber === invNum || String(i.no) === invNum);
                      handleSelectInvoice(match || null);
                    }}
                  >
                    <option value="">Select Invoice...</option>
                    {invoicesList.map((inv) => (
                      <option key={inv._id || inv.invoiceNumber} value={inv.invoiceNumber || inv.no}>
                        {inv.invoiceNumber || inv.no} - {inv.customerName || 'Cash'}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="settlement-vb6-lookup-btn"
                    title="Lookup Invoice (Search)"
                    onClick={() => setInvoiceLookupOpen(true)}
                  >
                    ...
                  </button>
                </div>
              </div>

              <div className="settlement-vb6-field value-field">
                <span className="settlement-vb6-navy-label value-label">Value:</span>
                <input
                  type="text"
                  className="settlement-vb6-input readonly value-input"
                  readOnly
                  value={selectedInvoice ? formatCurrency(invoiceTotalGross) : ''}
                />
              </div>

              <div className="settlement-vb6-field customer-field">
                <span className="settlement-vb6-navy-label customer-label">Customer:</span>
                <input
                  type="text"
                  className="settlement-vb6-input readonly customer-input"
                  readOnly
                  value={customerName}
                />
              </div>
            </div>

            {/* Row 2: (Blank space on left), Return, Balance */}
            <div className="settlement-vb6-top-row row-2">
              <div className="settlement-vb6-spacer-left"></div>

              <div className="settlement-vb6-field return-field">
                <span className="settlement-vb6-navy-label return-label">Return:</span>
                <input
                  type="text"
                  className="settlement-vb6-input readonly return-input"
                  readOnly
                  value={selectedInvoice ? formatCurrency(invoiceReturnAmount) : ''}
                />
              </div>

              <div className="settlement-vb6-field balance-field">
                <span className="settlement-vb6-navy-label balance-label">Balance: . . .</span>
                <input
                  type="text"
                  className="settlement-vb6-input readonly balance-input"
                  readOnly
                  value={selectedInvoice ? formatCurrency(outstandingBalanceBefore) : ''}
                />
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* MIDDLE SECTION: Header Bar, Entry Row, Buttons & Bank/Rec */}
          {/* ========================================================= */}
          <div className="settlement-vb6-middle-container">
            {/* 5-Column Silver Header Bar */}
            <div className="settlement-vb6-header-bar">
              <div className="settlement-vb6-th col-date">Date</div>
              <div className="settlement-vb6-th col-amount">Amount</div>
              <div className="settlement-vb6-th col-method">Method</div>
              <div className="settlement-vb6-th col-cheque">Cheque No</div>
              <div className="settlement-vb6-th col-realized">Date Realized</div>
            </div>

            {/* Entry Controls Row */}
            <div className="settlement-vb6-entry-row">
              <div className="settlement-vb6-td col-date">
                <input
                  type="date"
                  className="settlement-vb6-grid-input"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>
              <div className="settlement-vb6-td col-amount">
                <input
                  type="number"
                  step="0.01"
                  className="settlement-vb6-grid-input text-right"
                  value={paymentAmount}
                  placeholder=""
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>
              <div className="settlement-vb6-td col-method">
                <select
                  className="settlement-vb6-grid-select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="">Select</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Credit Note">Credit Note</option>
                  <option value="Bank">Bank</option>
                  <option value="Card">Card</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="settlement-vb6-td col-cheque">
                <input
                  type="text"
                  className="settlement-vb6-grid-input"
                  value={chequeNo}
                  onChange={(e) => setChequeNo(e.target.value)}
                />
              </div>
              <div className="settlement-vb6-td col-realized">
                <input
                  type="date"
                  className="settlement-vb6-grid-input"
                  value={dateRealized}
                  onChange={(e) => setDateRealized(e.target.value)}
                />
              </div>
            </div>

            {/* Split Sub-Row: Left Buttons, Right Bank & Receipts No */}
            <div className="settlement-vb6-subrow-split">
              {/* Left Side: Save, Delete, New Buttons */}
              <div className="settlement-vb6-buttons-area">
                <button
                  type="button"
                  className="settlement-vb6-btn settlement-vb6-btn-save"
                  onClick={handleSaveSettlement}
                  disabled={loading || isSubmitting}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="settlement-vb6-btn"
                  onClick={handleDeleteSettlement}
                  disabled={loading || !selectedSettlementId}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="settlement-vb6-btn"
                  onClick={handleNew}
                >
                  New
                </button>
              </div>

              {/* Right Side: Bank & Receipts No Controls */}
              <div className="settlement-vb6-bank-receipts-area">
                <div className="settlement-vb6-meta-row">
                  <div className="settlement-vb6-gray-label">Bank</div>
                  <select
                    className="settlement-vb6-select meta-select"
                    value={bank}
                    onChange={(e) => setBank(e.target.value)}
                  >
                    <option value="">Select Bank...</option>
                    {banksList.map((b, idx) => (
                      <option key={b._id || b.code || idx} value={b.code || b.description}>
                        {b.description || b.name || b.code}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="settlement-vb6-meta-row">
                  <div className="settlement-vb6-gray-label">Receipts No</div>
                  <input
                    type="text"
                    className="settlement-vb6-input meta-input"
                    value={receiptNo}
                    onChange={(e) => setReceiptNo(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* BOTTOM SECTION: Large Classic ActiveX DataGrid Panel     */}
          {/* ========================================================= */}
          <div className="settlement-vb6-datagrid-box">
            <table className="settlement-vb6-table">
              <thead>
                <tr>
                  <th style={{ width: '38px', textAlign: 'center' }}>#</th>
                  <th style={{ width: '95px' }}>Date</th>
                  <th style={{ width: '105px', textAlign: 'right' }}>Amount</th>
                  <th style={{ width: '90px' }}>Method</th>
                  <th style={{ width: '120px' }}>Cheque No</th>
                  <th style={{ width: '105px' }}>Date Realized</th>
                  <th style={{ width: '135px' }}>Bank</th>
                  <th style={{ width: '115px' }}>Receipts No</th>
                  <th style={{ width: '105px', textAlign: 'right' }}>Balance</th>
                  <th style={{ width: '85px', textAlign: 'center' }}>User</th>
                </tr>
              </thead>
              <tbody>
                {settlementsList.length === 0 ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={`empty-${i}`} className="settlement-vb6-empty-tr">
                      <td style={{ textAlign: 'center' }}>&nbsp;</td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                    </tr>
                  ))
                ) : (
                  settlementsList.map((st, idx) => {
                    const isSelected = selectedSettlementId === st._id;
                    const stAmount = Number(st.amount || 0);
                    return (
                      <tr
                        key={st._id}
                        className={isSelected ? 'vb6-row-selected' : ''}
                        onClick={() => setSelectedSettlementId(isSelected ? null : st._id)}
                      >
                        <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                        <td>{new Date(st.date || st.createdAt).toLocaleDateString()}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          {formatCurrency(stAmount)}
                        </td>
                        <td>{st.method || 'Cash'}</td>
                        <td>{st.chequeNo || '-'}</td>
                        <td>{st.dateRealized || '-'}</td>
                        <td>{st.bank || '-'}</td>
                        <td>{st.receiptNo || '-'}</td>
                        <td style={{ textAlign: 'right' }}>
                          {st.balanceAfter !== undefined ? formatCurrency(st.balanceAfter) : '-'}
                        </td>
                        <td style={{ textAlign: 'center' }}>{st.createdBy || 'PC004'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* DEDICATED PRINT AREA FOR THERMAL RECEIPT */}
      <div id="thermal-receipt-print-area">
        {renderThermalReceiptContent()}
      </div>

      {/* DEDICATED RECEIPT PREVIEW MODAL */}
      {receiptPreviewOpen && (
        <div className="receipt-modal-overlay">
          <div className="receipt-modal-container">
            <div className="receipt-modal-header">
              <span>Receipt Preview - Invoice #{selectedInvoiceNumber || '-'}</span>
              <button
                type="button"
                className="settlement-ctrl-btn close"
                style={{ width: '24px', height: '20px' }}
                onClick={() => setReceiptPreviewOpen(false)}
              >
                &#x2715;
              </button>
            </div>
            <div className="receipt-modal-body">
              {renderThermalReceiptContent()}
            </div>
            <div className="receipt-modal-footer">
              <button
                type="button"
                className="settlement-vb6-btn"
                onClick={handlePrintBill}
              >
                Print
              </button>
              <button
                type="button"
                className="settlement-vb6-btn"
                onClick={() => setReceiptPreviewOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Search Lookup Modal */}
      {invoiceLookupOpen && (
        <div className="settlement-modal-overlay">
          <div className="settlement-modal-window">
            <div className="settlement-modal-titlebar">
              <span>Select Invoice from Database</span>
              <button
                type="button"
                className="settlement-ctrl-btn close"
                style={{ width: '24px', height: '20px' }}
                onClick={() => setInvoiceLookupOpen(false)}
              >
                &#x2715;
              </button>
            </div>
            <div className="settlement-modal-body">
              <input
                type="text"
                className="settlement-vb6-input"
                style={{ width: '100%', fontSize: '11px', marginBottom: '8px' }}
                placeholder="Search by Invoice No, Customer Code, Name..."
                value={invoiceSearchQuery}
                onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                autoFocus
              />
              <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                <table className="settlement-vb6-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>#</th>
                      <th style={{ width: '90px' }}>Invoice No</th>
                      <th style={{ width: '90px' }}>Date</th>
                      <th>Customer</th>
                      <th style={{ width: '95px', textAlign: 'right' }}>Total (Rs.)</th>
                      <th style={{ width: '95px', textAlign: 'right' }}>Due (Rs.)</th>
                      <th style={{ width: '60px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '16px', color: '#666' }}>
                          No matching invoices found
                        </td>
                      </tr>
                    ) : (
                      filteredInvoices.map((inv, idx) => (
                        <tr key={inv._id || inv.invoiceNumber} onClick={() => handleSelectInvoice(inv)}>
                          <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                          <td style={{ fontWeight: 'bold', color: '#000080' }}>
                            {inv.invoiceNumber || inv.no}
                          </td>
                          <td>{new Date(inv.date || inv.createdAt).toLocaleDateString()}</td>
                          <td>{inv.customerCode ? `${inv.customerCode} - ` : ''}{inv.customerName || 'Cash'}</td>
                          <td style={{ textAlign: 'right' }}>
                            {Number(inv.amountToPay || inv.subTotal || 0).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#b91c1c' }}>
                            {Number(inv.dueAmount !== undefined ? inv.dueAmount : inv.amountToPay || 0).toLocaleString(
                              'en-US',
                              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="settlement-vb6-btn"
                              style={{ height: '22px', minWidth: '48px', padding: '0 4px', fontSize: '11px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectInvoice(inv);
                              }}
                            >
                              Select
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="settlement-modal-footer">
              <button
                type="button"
                className="settlement-vb6-btn"
                onClick={() => setInvoiceLookupOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettlementInvoice;