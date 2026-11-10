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
 * SOFAST POS — Professional Desktop ERP Settlement Invoice Module
 * Exact implementation of the SOFAST Customer Settlement / Receipt Entry design.
 * Features:
 * - Two-row Header: G.R. No., Invoice No., Supplier/Customer, Invoice Value, Return, Balance
 * - Add Settlement Payment with column-aligned inputs and Bank / Receipt No.
 * - Emerald Green Save, Delete, New, and Clear action buttons with confirmations
 * - Full Settlement History table loading real MongoDB Atlas records
 * - History row selection for editing/deletion
 * - Real-time Summary: Total Settled and Current Balance
 * - Dedicated Thermal Bill & Receipt Printing
 */
function SettlementInvoice() {
  const navigate = useNavigate();
  const { confirmSave, confirmDelete } = useConfirmDialog();
  const location = useLocation();
  const { isAdmin } = useAuth();
  const { confirm } = useConfirm();

  // Backend Data Lists
  const [invoicesList, setInvoicesList] = useState([]);
  const [grnsList, setGrnsList] = useState([]);
  const [banksList, setBanksList] = useState([]);
  const [settlementsList, setSettlementsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Section 1: Header Information
  const [grnNumber, setGrnNumber] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedInvoiceNumber, setSelectedInvoiceNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [cashierUser, setCashierUser] = useState(
    localStorage.getItem('username') || localStorage.getItem('userCode') || 'Admin'
  );

  // Section 2: Payment / Settlement Inputs
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [chequeNo, setChequeNo] = useState('');
  const [dateRealized, setDateRealized] = useState('');
  const [bank, setBank] = useState('');
  const [receiptNo, setReceiptNo] = useState('');

  // Selected settlement in History table for editing/deletion
  const [selectedSettlementId, setSelectedSettlementId] = useState(null);

  // Modals & Popups
  const [invoiceLookupOpen, setInvoiceLookupOpen] = useState(false);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [grnLookupOpen, setGrnLookupOpen] = useState(false);
  const [grnSearchQuery, setGrnSearchQuery] = useState('');
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

  // Fetch Initial Data (Invoices, GRNs, Banks, Next Receipt)
  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [invsRes, grnsRes, banksRes, recRes] = await Promise.all([
        api.get('/invoices?type=standard&limit=250').catch(() => null),
        api.get('/grn?limit=250').catch(() => null),
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
      if (grnsRes?.data?.data) {
        setGrnsList(grnsRes.data.data);
      }
      if (banksRes?.data?.data) {
        setBanksList(banksRes.data.data);
      }
      if (recRes?.data?.data?.receiptNo) {
        setReceiptNo(recRes.data.data.receiptNo);
      }

      // Check if routed with specific invoice state
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
      setGrnNumber('');
      setPaymentAmount('');
      setPaymentMethod('Cash');
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
    if (inv.grnNumber || inv.lastGrn) {
      setGrnNumber(inv.grnNumber || inv.lastGrn);
    }

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
    setPaymentMethod('Cash');
    setChequeNo('');
    setDateRealized('');
    setBank('');
    setSelectedSettlementId(null);

    fetchInvoiceSettlements(inv.invoiceNumber || String(inv.no));
    setInvoiceLookupOpen(false);
  };

  // Handle GRN Selection
  const handleSelectGrn = (grn) => {
    if (!grn) return;
    setGrnNumber(grn.grnNumber || grn.grnNo || '');
    if (!customerName && (grn.supplierName || grn.supplierCode)) {
      setCustomerName(grn.supplierName || grn.supplierCode);
    }
    if (grn.invoiceNumber) {
      const matchInv = invoicesList.find(
        (i) => String(i.invoiceNumber).toLowerCase() === String(grn.invoiceNumber).toLowerCase()
      );
      if (matchInv) {
        handleSelectInvoice(matchInv);
      }
    }
    setGrnLookupOpen(false);
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

  // 2. Returns Amount
  const invoiceReturnAmount = selectedInvoice
    ? round2(Number(selectedInvoice.returnAmount || selectedInvoice.goodReturnAmount || 0))
    : 0;

  const amountToBePaid = selectedInvoice ? round2(Math.max(0, invoiceTotalGross - invoiceLineDiscounts - invoiceReturnAmount)) : 0;

  // 3. Previously Saved Settlements Sum from MongoDB
  const previouslyAppliedPayments = selectedInvoice
    ? round2(settlementsList.reduce((sum, s) => sum + (Number(s.amount) || 0), 0))
    : 0;

  // 4. Outstanding Current Balance
  const currentBalance = selectedInvoice
    ? (settlementsList.length > 0
        ? round2(Math.max(0, amountToBePaid - previouslyAppliedPayments))
        : (selectedInvoice.isSettled === true || (selectedInvoice.paymentStatus === 'paid' && Number(selectedInvoice.dueAmount) === 0 && Number(selectedInvoice.paidAmount) > 0)
            ? 0
            : (selectedInvoice.dueAmount !== undefined && Number(selectedInvoice.dueAmount) > 0
                ? round2(Number(selectedInvoice.dueAmount))
                : amountToBePaid)))
    : 0;

  // 5. Current Typed Payment Calculations
  const hasTypedPayment = paymentAmount !== '' && !isNaN(parseFloat(paymentAmount));
  const typedAmount = hasTypedPayment ? round2(parseFloat(paymentAmount)) : 0;

  const amountReceivedVal = hasTypedPayment && typedAmount > 0 ? typedAmount : 0;
  const amountAppliedVal = hasTypedPayment && typedAmount > 0
    ? round2(Math.min(amountReceivedVal, currentBalance))
    : 0;
  const changeCashReturnVal = hasTypedPayment && typedAmount > 0
    ? round2(Math.max(0, amountReceivedVal - amountAppliedVal))
    : 0;

  const totalAmountReceivedVal = round2(previouslyAppliedPayments + amountAppliedVal);
  const balanceAfterVal = hasTypedPayment && typedAmount > 0
    ? round2(Math.max(0, currentBalance - amountAppliedVal))
    : currentBalance;

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

  // Row selection in History table: load record into form for editing or deletion
  const handleSelectHistoryRow = (st) => {
    if (selectedSettlementId === st._id) {
      // Deselect and clear
      setSelectedSettlementId(null);
      handleClearPaymentInputs();
      return;
    }

    setSelectedSettlementId(st._id);
    if (st.date) {
      try {
        setPaymentDate(new Date(st.date).toISOString().split('T')[0]);
      } catch (e) {
        setPaymentDate(new Date().toISOString().split('T')[0]);
      }
    }
    setPaymentAmount(st.received !== undefined && st.received !== null ? String(st.received) : String(st.amount || ''));
    setPaymentMethod(st.method || 'Cash');
    setChequeNo(st.chequeNo || '');
    setDateRealized(st.dateRealized || '');
    setBank(st.bank || '');
    setReceiptNo(st.receiptNo || '');

    showNotification(`Selected settlement #${st.receiptNo || st.no} for editing/deletion`, 'info');
  };

  // Button: Clear Payment Inputs (keeps selected invoice intact)
  const handleClearPaymentInputs = () => {
    setSelectedSettlementId(null);
    setPaymentAmount('');
    setPaymentMethod('Cash');
    setChequeNo('');
    setDateRealized('');
    setBank('');
    showNotification('Payment fields cleared', 'info');
  };

  // Button: New (Clears payment inputs and loads fresh next receipt number)
  const handleNew = async () => {
    setSelectedSettlementId(null);
    setPaymentAmount('');
    setPaymentMethod('Cash');
    setChequeNo('');
    setDateRealized('');
    setBank('');
    setPaymentDate(new Date().toISOString().split('T')[0]);

    try {
      const recRes = await api.get('/settlements/next-receipt');
      if (recRes?.data?.data?.receiptNo) {
        setReceiptNo(recRes.data.data.receiptNo);
      }
    } catch (e) {
      // Retain existing receiptNo
    }

    showNotification('Ready for new settlement entry', 'info');
  };

  // Button: Save Payment (Create or Update with Confirmation)
  const handleSavePayment = async () => {
    if (isSubmitting || loading) return;

    if (!selectedInvoice || !selectedInvoiceNumber) {
      showNotification('Please select an Invoice first', 'error');
      return;
    }

    if (!hasTypedPayment || typedAmount <= 0) {
      showNotification('Please enter a valid Payment Amount greater than 0', 'error');
      return;
    }

    if (!selectedSettlementId && currentBalance <= 0) {
      showNotification('This invoice is already fully paid and settled', 'error');
      return;
    }

    const method = paymentMethod || 'Cash';

    // Only require cheque details when the selected payment method requires them
    if (method === 'Cheque') {
      if (!chequeNo.trim()) {
        showNotification('Please enter the Cheque Number for cheque payment', 'error');
        return;
      }
      if (!bank.trim()) {
        showNotification('Please select or enter the Bank for cheque payment', 'error');
        return;
      }
    } else if (method === 'Credit Note' && !chequeNo.trim()) {
      showNotification('Please enter the Credit Note number', 'error');
      return;
    }

    const isEditing = Boolean(selectedSettlementId);
    const confirmMessage = isEditing
      ? `Do you wish to update settlement receipt #${receiptNo}?`
      : 'Do you wish to save this settlement payment?';

    const confirmed = await confirm({
      title: isEditing ? 'SOFAST POS - Update Payment' : 'SOFAST POS - Save Payment',
      message: confirmMessage,
      icon: 'question',
      defaultFocus: 'yes',
    });
    if (!confirmed) return;

    const payload = {
      invoiceNumber: selectedInvoiceNumber,
      amount: amountAppliedVal,
      method,
      received: amountReceivedVal,
      change: changeCashReturnVal,
      chequeNo: chequeNo.trim(),
      bank: bank.trim(),
      dateRealized: dateRealized ? dateRealized.trim() : '',
      date: paymentDate,
      receiptNo: receiptNo.trim(),
    };

    try {
      setIsSubmitting(true);
      setLoading(true);

      let res;
      if (isEditing) {
        try {
          res = await api.put(`/settlements/${selectedSettlementId}`, payload);
        } catch (err) {
          if (err.response?.status === 404 || err.response?.status === 405) {
            await api.delete(`/settlements/${selectedSettlementId}`);
            res = await api.post('/settlements', payload);
          } else {
            throw err;
          }
        }
      } else {
        res = await api.post('/settlements', payload);
      }

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
        setSelectedSettlementId(null);
        setPaymentAmount('');
        setChequeNo('');
        setDateRealized('');
        setBank('');

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

  // Button: Delete Settlement (with Confirmation)
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
        handleClearPaymentInputs();
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

  // Filtered GRNs for lookup modal
  const filteredGrns = grnsList.filter((grn) => {
    const q = grnSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (grn.grnNumber && String(grn.grnNumber).toLowerCase().includes(q)) ||
      (grn.supplierName && String(grn.supplierName).toLowerCase().includes(q)) ||
      (grn.supplierCode && String(grn.supplierCode).toLowerCase().includes(q)) ||
      (grn.invoiceNumber && String(grn.invoiceNumber).toLowerCase().includes(q))
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
            <span>Rs. {formatCurrency(amountToBePaid)}</span>
          </div>
          {invoiceLineDiscounts > 0 && (
            <div className="thermal-receipt-total-row">
              <span>Total Discount:</span>
              <span>Rs. {formatCurrency(invoiceLineDiscounts)}</span>
            </div>
          )}
          {invoiceReturnAmount > 0 && (
            <div className="thermal-receipt-total-row">
              <span>Return / Credit:</span>
              <span>Rs. {formatCurrency(invoiceReturnAmount)}</span>
            </div>
          )}
          <div className="thermal-receipt-total-row">
            <span>Total Settled:</span>
            <span style={{ fontWeight: 'bold' }}>Rs. {formatCurrency(previouslyAppliedPayments)}</span>
          </div>
          {hasTypedPayment && typedAmount > 0 && (
            <>
              <div className="thermal-receipt-total-row">
                <span>Payment Received:</span>
                <span>Rs. {formatCurrency(amountReceivedVal)}</span>
              </div>
              <div className="thermal-receipt-total-row">
                <span>Amount Applied:</span>
                <span style={{ fontWeight: 'bold' }}>Rs. {formatCurrency(amountAppliedVal)}</span>
              </div>
              {changeCashReturnVal > 0 && (
                <div className="thermal-receipt-total-row">
                  <span>Change / Cash Return:</span>
                  <span style={{ fontWeight: 'bold' }}>Rs. {formatCurrency(changeCashReturnVal)}</span>
                </div>
              )}
            </>
          )}
          <div className="thermal-receipt-total-row">
            <span>Current Balance:</span>
            <span style={{ fontWeight: 'bold', color: '#b30000' }}>Rs. {formatCurrency(currentBalance)}</span>
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
          <span className="settlement-win-heading">SOFAST POS | Customer Settlement</span>
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

      {/* 3. Main Desktop ERP Form Container */}
      <main
        className="settlement-erp-main"
        onKeyDown={(e) => handleEnterNavigation(e, { saveButtonSelector: '.erp-btn-save' })}
      >
        {/* Notification Alert */}
        {notification && (
          <div className={`settlement-erp-alert ${notification.type}`}>
            <span>{notification.message}</span>
            <button
              type="button"
              className="settlement-erp-alert-close"
              onClick={() => setNotification(null)}
            >
              &#x2715;
            </button>
          </div>
        )}

        <div className="settlement-erp-window-card">
          {/* ========================================================= */}
          {/* SECTION 1: CUSTOMER SETTLEMENT / RECEIPT ENTRY (HEADER)   */}
          {/* ========================================================= */}
          <div className="erp-section-box">
            <div className="erp-section-header">
              <svg className="erp-section-header-icon" viewBox="0 0 24 24">
                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
              </svg>
              <span>Customer Settlement / Receipt Entry</span>
            </div>

            <div className="erp-section-body">
              {/* Row 1: G.R. No., Invoice No., Supplier / Customer */}
              <div className="erp-form-row">
                {/* G.R. No. */}
                <div className="erp-field-group field-grn">
                  <label className="erp-label">G.R. No.</label>
                  <div className="erp-input-with-btn">
                    <input
                      type="text"
                      className="erp-input text-bold"
                      placeholder=""
                      value={grnNumber}
                      onChange={(e) => setGrnNumber(e.target.value)}
                    />
                    <button
                      type="button"
                      className="erp-search-btn"
                      title="Search Goods Receive Note"
                      onClick={() => setGrnLookupOpen(true)}
                    >
                      <svg viewBox="0 0 24 24" className="erp-search-icon">
                        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Invoice No. */}
                <div className="erp-field-group field-inv">
                  <label className="erp-label">Invoice No.</label>
                  <div className="erp-input-with-btn">
                    <input
                      type="text"
                      className="erp-input text-bold"
                      placeholder="INV-..."
                      value={selectedInvoiceNumber}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedInvoiceNumber(val);
                        const match = invoicesList.find((i) => i.invoiceNumber === val || String(i.no) === val);
                        if (match) handleSelectInvoice(match);
                      }}
                    />
                    <button
                      type="button"
                      className="erp-search-btn"
                      title="Search Invoices in Database"
                      onClick={() => setInvoiceLookupOpen(true)}
                    >
                      <svg viewBox="0 0 24 24" className="erp-search-icon">
                        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Customer */}
                <div className="erp-field-group field-customer">
                  <label className="erp-label">Customer</label>
                  <input
                    type="text"
                    className="erp-input readonly text-bold"
                    readOnly
                    placeholder=""
                    value={customerName}
                  />
                </div>
              </div>

              {/* Row 2: Invoice Value, Return, Balance */}
              <div className="erp-form-row row-2">
                {/* Invoice Value */}
                <div className="erp-field-group field-inv-val">
                  <label className="erp-label">Invoice Value</label>
                  <input
                    type="text"
                    className="erp-input readonly text-right text-bold"
                    readOnly
                    value={selectedInvoice ? `Rs. ${formatCurrency(invoiceTotalGross)}` : ''}
                  />
                </div>

                {/* Return */}
                <div className="erp-field-group field-return">
                  <label className="erp-label">Return</label>
                  <input
                    type="text"
                    className="erp-input readonly text-right text-bold"
                    readOnly
                    value={selectedInvoice ? `Rs. ${formatCurrency(invoiceReturnAmount)}` : ''}
                  />
                </div>

                {/* Balance (Highlighted in soft red) */}
                <div className="erp-field-group field-balance">
                  <label className="erp-label">Balance</label>
                  <input
                    type="text"
                    className="erp-input readonly text-right text-bold erp-balance-highlight"
                    readOnly
                    value={selectedInvoice ? `Rs. ${formatCurrency(currentBalance)}` : ''}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* SECTION 2: ADD SETTLEMENT PAYMENT                         */}
          {/* ========================================================= */}
          <div className="erp-section-box">
            <div className="erp-section-header">
              <svg className="erp-section-header-icon" viewBox="0 0 24 24">
                <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" />
              </svg>
              <span>Add Settlement Payment</span>
            </div>

            <div className="erp-section-body">
              {/* Payment Entry Table Grid Header & Inputs */}
              <div className="erp-payment-table-grid">
                <div className="erp-grid-header-row">
                  <div className="erp-grid-th th-date">Date</div>
                  <div className="erp-grid-th th-amount">Amount (Rs.)</div>
                  <div className="erp-grid-th th-method">Method</div>
                  <div className="erp-grid-th th-cheque">Cheque No.</div>
                  <div className="erp-grid-th th-realized">Date Realized</div>
                </div>

                <div className="erp-grid-inputs-row">
                  <div className="erp-grid-td td-date">
                    <input
                      type="date"
                      className="erp-grid-input"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                    />
                  </div>
                  <div className="erp-grid-td td-amount">
                    <input
                      type="number"
                      step="0.01"
                      className="erp-grid-input text-right text-bold"
                      placeholder="0.00"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                    />
                  </div>
                  <div className="erp-grid-td td-method">
                    <select
                      className="erp-grid-select"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Card">Card</option>
                      <option value="Credit Note">Credit Note</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="erp-grid-td td-cheque">
                    <input
                      type="text"
                      className="erp-grid-input"
                      placeholder={paymentMethod === 'Cheque' ? 'Enter Cheque No.' : ''}
                      value={chequeNo}
                      onChange={(e) => setChequeNo(e.target.value)}
                    />
                  </div>
                  <div className="erp-grid-td td-realized">
                    <input
                      type="date"
                      className="erp-grid-input"
                      value={dateRealized}
                      onChange={(e) => setDateRealized(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Lower Controls: Left Action Buttons, Right Bank & Receipt No. */}
              <div className="erp-payment-subrow">
                {/* Left Side: Buttons */}
                <div className="erp-action-buttons-group">
                  <button
                    type="button"
                    className="erp-btn erp-btn-save"
                    onClick={handleSavePayment}
                    disabled={loading || isSubmitting}
                  >
                    <svg viewBox="0 0 24 24" className="erp-btn-icon">
                      <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" />
                    </svg>
                    <span>{selectedSettlementId ? 'Update Payment' : 'Save Payment'}</span>
                  </button>

                  <button
                    type="button"
                    className={`erp-btn erp-btn-delete ${selectedSettlementId ? 'active-delete' : ''}`}
                    onClick={handleDeleteSettlement}
                    disabled={loading || !selectedSettlementId}
                    title={selectedSettlementId ? 'Delete selected settlement' : 'Select a history row below to delete'}
                  >
                    <svg viewBox="0 0 24 24" className="erp-btn-icon">
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                    </svg>
                    <span>Delete</span>
                  </button>

                  <button
                    type="button"
                    className="erp-btn erp-btn-new"
                    onClick={handleNew}
                  >
                    <svg viewBox="0 0 24 24" className="erp-btn-icon">
                      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                    </svg>
                    <span>New</span>
                  </button>

                  <button
                    type="button"
                    className="erp-btn erp-btn-clear"
                    onClick={handleClearPaymentInputs}
                  >
                    <svg viewBox="0 0 24 24" className="erp-btn-icon">
                      <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                    </svg>
                    <span>Clear</span>
                  </button>
                </div>

                {/* Right Side: Bank & Receipt No. */}
                <div className="erp-bank-receipt-group">
                  <div className="erp-meta-line">
                    <div className="erp-meta-pill">
                      <svg viewBox="0 0 24 24" className="erp-meta-icon">
                        <path d="M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zm-4.5-9L2 6v2h19V6l-9.5-5z" />
                      </svg>
                      <span>Bank</span>
                    </div>
                    <select
                      className="erp-meta-select"
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

                  <div className="erp-meta-line">
                    <div className="erp-meta-pill">
                      <svg viewBox="0 0 24 24" className="erp-meta-icon">
                        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                      </svg>
                      <span>Receipt No.</span>
                    </div>
                    <input
                      type="text"
                      className="erp-meta-input text-bold"
                      value={receiptNo}
                      onChange={(e) => setReceiptNo(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* SECTION 3: SETTLEMENT HISTORY                             */}
          {/* ========================================================= */}
          <div className="erp-section-box">
            <div className="erp-section-header">
              <svg className="erp-section-header-icon" viewBox="0 0 24 24">
                <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" />
              </svg>
              <span>Settlement History</span>
            </div>

            <div className="erp-section-body erp-history-body">
              <div className="erp-history-table-container">
                <table className="erp-history-table">
                  <thead>
                    <tr>
                      <th style={{ width: '38px', textAlign: 'center' }}>#</th>
                      <th style={{ width: '100px' }}>Date</th>
                      <th style={{ width: '120px', textAlign: 'right' }}>Amount (Rs.)</th>
                      <th style={{ width: '110px' }}>Method</th>
                      <th style={{ width: '130px' }}>Cheque No.</th>
                      <th style={{ width: '110px' }}>Date Realized</th>
                      <th style={{ width: '145px' }}>Bank</th>
                      <th style={{ width: '120px' }}>Receipt No.</th>
                      <th style={{ width: '120px', textAlign: 'right' }}>Balance (Rs.)</th>
                      <th style={{ width: '90px', textAlign: 'center' }}>User</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlementsList.length === 0 ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <tr key={`empty-${i}`} className="erp-empty-row">
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
                            className={isSelected ? 'erp-row-selected' : ''}
                            onClick={() => handleSelectHistoryRow(st)}
                            title="Click to load into payment form for editing or deletion"
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
                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                              {st.balanceAfter !== undefined ? formatCurrency(st.balanceAfter) : '-'}
                            </td>
                            <td style={{ textAlign: 'center' }}>{st.createdBy || 'Admin'}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* ===================================================== */}
              {/* SECTION 4: SUMMARY SECTION (BOTTOM BAR)               */}
              {/* ===================================================== */}
              <div className="erp-summary-bar">
                {/* Left: Total Settled */}
                <div className="erp-summary-left">
                  <div className="erp-summary-label">Total Settled</div>
                  <div className="erp-summary-val-box">
                    <span>Rs. {formatCurrency(previouslyAppliedPayments)}</span>
                  </div>
                </div>

                {/* Right: Current Balance */}
                <div className="erp-summary-right">
                  <div className="erp-summary-label">Current Balance</div>
                  <div className="erp-summary-bal-box">
                    <span>Rs. {formatCurrency(currentBalance)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* DEDICATED PRINT AREA FOR THERMAL RECEIPT */}
      <div id="thermal-receipt-print-area">
        {renderThermalReceiptContent()}
      </div>

      {/* Invoice Search Lookup Modal */}
      {invoiceLookupOpen && (
        <div className="erp-modal-overlay">
          <div className="erp-modal-card">
            <div className="erp-modal-header">
              <span>Select Invoice from Database</span>
              <button
                type="button"
                className="settlement-ctrl-btn close"
                style={{ width: '22px', height: '22px' }}
                onClick={() => setInvoiceLookupOpen(false)}
              >
                &#x2715;
              </button>
            </div>
            <div className="erp-modal-body">
              <input
                type="text"
                className="erp-input"
                style={{ width: '100%', marginBottom: '10px' }}
                placeholder="Search by Invoice No, Customer Code, Name..."
                value={invoiceSearchQuery}
                onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                autoFocus
              />
              <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                <table className="erp-history-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>#</th>
                      <th style={{ width: '95px' }}>Invoice No</th>
                      <th style={{ width: '95px' }}>Date</th>
                      <th>Customer</th>
                      <th style={{ width: '100px', textAlign: 'right' }}>Total (Rs.)</th>
                      <th style={{ width: '100px', textAlign: 'right' }}>Due (Rs.)</th>
                      <th style={{ width: '65px', textAlign: 'center' }}>Action</th>
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
                          <td style={{ fontWeight: 'bold', color: '#003366' }}>
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
                          <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#b30000' }}>
                            {Number(inv.dueAmount !== undefined ? inv.dueAmount : inv.amountToPay || 0).toLocaleString(
                              'en-US',
                              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="erp-btn erp-btn-new"
                              style={{ height: '22px', minWidth: '50px', padding: '0 6px', fontSize: '11px' }}
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
            <div className="erp-modal-footer">
              <button
                type="button"
                className="erp-btn erp-btn-clear"
                onClick={() => setInvoiceLookupOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GRN Search Lookup Modal */}
      {grnLookupOpen && (
        <div className="erp-modal-overlay">
          <div className="erp-modal-card">
            <div className="erp-modal-header">
              <span>Select Goods Receive Note (GRN)</span>
              <button
                type="button"
                className="settlement-ctrl-btn close"
                style={{ width: '22px', height: '22px' }}
                onClick={() => setGrnLookupOpen(false)}
              >
                &#x2715;
              </button>
            </div>
            <div className="erp-modal-body">
              <input
                type="text"
                className="erp-input"
                style={{ width: '100%', marginBottom: '10px' }}
                placeholder="Search by GRN No, Supplier Name, Invoice No..."
                value={grnSearchQuery}
                onChange={(e) => setGrnSearchQuery(e.target.value)}
                autoFocus
              />
              <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                <table className="erp-history-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>#</th>
                      <th style={{ width: '120px' }}>GRN No</th>
                      <th style={{ width: '95px' }}>Date</th>
                      <th>Supplier</th>
                      <th style={{ width: '100px' }}>Invoice No</th>
                      <th style={{ width: '110px', textAlign: 'right' }}>Total (Rs.)</th>
                      <th style={{ width: '65px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGrns.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '16px', color: '#666' }}>
                          No matching GRNs found
                        </td>
                      </tr>
                    ) : (
                      filteredGrns.map((grn, idx) => (
                        <tr key={grn._id || grn.grnNumber} onClick={() => handleSelectGrn(grn)}>
                          <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                          <td style={{ fontWeight: 'bold', color: '#003366' }}>
                            {grn.grnNumber || grn.grnNo}
                          </td>
                          <td>{grn.date ? new Date(grn.date).toLocaleDateString() : '-'}</td>
                          <td>{grn.supplierName || grn.supplierCode || '-'}</td>
                          <td>{grn.invoiceNumber || '-'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                            {Number(grn.totalAmount || grn.netTotal || 0).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="erp-btn erp-btn-new"
                              style={{ height: '22px', minWidth: '50px', padding: '0 6px', fontSize: '11px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectGrn(grn);
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
            <div className="erp-modal-footer">
              <button
                type="button"
                className="erp-btn erp-btn-clear"
                onClick={() => setGrnLookupOpen(false)}
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