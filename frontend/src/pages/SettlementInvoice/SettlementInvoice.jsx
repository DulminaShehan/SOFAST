import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import './SettlementInvoice.css';

/**
 * SOFAST MOTORS - Settlement Invoice Module
 * Exact Classic SOFAST Windows/ERP POS design with empty initial states,
 * dynamic real-time calculations, real MongoDB data integration,
 * and thermal receipt printing.
 */
function SettlementInvoice() {
  const navigate = useNavigate();
  const location = useLocation();

  // Top Menubar state
  const [activeDropdown, setActiveDropdown] = useState(null);
  const menuRef = useRef(null);

  // Backend Data Lists
  const [invoicesList, setInvoicesList] = useState([]);
  const [banksList, setBanksList] = useState([]);
  const [settlementsList, setSettlementsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Section 1: Invoice & Customer (Empty by default)
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedInvoiceNumber, setSelectedInvoiceNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [cashierUser, setCashierUser] = useState(
    localStorage.getItem('username') || localStorage.getItem('userCode') || 'PC004'
  );

  // Section 3: Payment / Settlement Inputs (Empty by default)
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [chequeNo, setChequeNo] = useState('');
  const [dateRealized, setDateRealized] = useState('');
  const [bank, setBank] = useState('');
  const [receiptNo, setReceiptNo] = useState('');

  // Selected settlement in history table for deletion
  const [selectedSettlementId, setSelectedSettlementId] = useState(null);

  // Modals & Popups
  const [invoiceLookupOpen, setInvoiceLookupOpen] = useState(false);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false);

  // Current time for thermal receipt
  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  );

  // Navigation Menubar Items
  const topMenuItems = [
    { id: 'master-files', label: 'Master Files', hasDropdown: true },
    { id: 'stock-control', label: 'Stock Control System', hasDropdown: true },
    { id: 'sales-service', label: 'Sales and Service', hasDropdown: true },
    { id: 'production', label: 'Production', path: '/management' },
    { id: 'reports', label: 'Reports', path: '/management' },
    { id: 'accounting', label: 'Accounting', path: '/management' },
    { id: 'administration', label: 'Administration', hasDropdown: true },
  ];

  const masterFilesDropdownItems = [
    { id: 'item-master', label: 'Item Master', path: '/item-master' },
    { id: 'supplier-master', label: 'Supplier Master', path: '/supplier-master' },
    { id: 'customer-details', label: 'Customer Details', path: '/customer-details' },
    { id: 'category-master', label: 'Category Master', path: '/management' },
    { id: 'sub-category-master', label: 'Sub Category Master', path: '/management' },
    { id: 'alternative-product', label: 'Alternative Product', path: '/alternative-product' },
  ];

  const stockControlDropdownItems = [
    { id: 'good-receive-note', label: 'Good Receive Note', path: '/grn' },
  ];

  const salesServiceDropdownItems = [
    { id: 'create-invoice', label: 'Create Invoice', path: '/invoice' },
    { id: 'settlement-invoice', label: 'Settlement Invoice', path: '/settlement-invoice' },
  ];

  const administrationDropdownItems = [
    { id: 'printer-setup', label: 'Printer Setup', path: '/printer-setup' },
  ];

  // Close dropdown menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

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
        api.get('/invoices?limit=250').catch(() => null),
        api.get('/settlements/banks').catch(() => null),
        api.get('/settlements/next-receipt').catch(() => null),
      ]);

      let availableInvoices = [];
      if (invsRes?.data?.data) {
        availableInvoices = invsRes.data.data;
        setInvoicesList(availableInvoices);
      }
      if (banksRes?.data?.data) {
        setBanksList(banksRes.data.data);
      }
      if (recRes?.data?.data?.receiptNo) {
        setReceiptNo(recRes.data.data.receiptNo);
      }

      // Check if routed from Create Invoice with specific invoiceNumber
      if (location.state?.invoiceNumber) {
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
  const formatCurrency = (val) => {
    if (val === undefined || val === null || val === '') return '';
    const num = Number(val);
    if (isNaN(num)) return '';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // 1. Invoice Totals from Real Database Record
  const invoiceTotalGross = selectedInvoice
    ? (selectedInvoice.lineItems && selectedInvoice.lineItems.length > 0
        ? selectedInvoice.lineItems.reduce(
            (sum, li) => sum + (parseFloat(li.price || li.unitPrice || 0) * parseFloat(li.quantity || li.qty || 1)),
            0
          )
        : parseFloat(selectedInvoice.subTotal || selectedInvoice.amountToPay || 0))
    : 0;

  const invoiceLineDiscounts = selectedInvoice
    ? (selectedInvoice.lineItems && selectedInvoice.lineItems.length > 0
        ? selectedInvoice.lineItems.reduce((sum, li) => sum + parseFloat(li.discountAmount || 0), 0) + (parseFloat(selectedInvoice.specialDiscount) || 0)
        : (parseFloat(selectedInvoice.specialDiscount) || 0))
    : 0;

  const amountToBePaid = selectedInvoice ? Math.max(0, invoiceTotalGross - invoiceLineDiscounts) : 0;

  // 2. Previously Saved Settlements Sum from MongoDB
  const savedSettlementsPaid = selectedInvoice
    ? (settlementsList.length > 0
        ? settlementsList.reduce((sum, s) => sum + Number(s.amount || 0), 0)
        : (selectedInvoice.amountReceived !== undefined && Number(selectedInvoice.amountReceived) > 0
            ? Number(selectedInvoice.amountReceived)
            : (selectedInvoice.paidAmount !== undefined && Number(selectedInvoice.paidAmount) > 0
                ? Number(selectedInvoice.paidAmount)
                : (selectedInvoice.dueAmount === 0 && selectedInvoice.paidStatus === 'Paid'
                    ? amountToBePaid
                    : 0))))
    : 0;

  // 3. Outstanding Balance Before Current Payment
  const outstandingBalanceBefore = selectedInvoice
    ? Math.max(0, amountToBePaid - savedSettlementsPaid)
    : 0;

  // 4. Current Typed Payment Calculations
  const hasTypedPayment = paymentAmount !== '' && !isNaN(parseFloat(paymentAmount));
  const typedAmount = hasTypedPayment ? Math.max(0, parseFloat(paymentAmount)) : 0;

  const amountReceivedVal = hasTypedPayment ? typedAmount : 0;
  const amountAppliedVal = hasTypedPayment ? Math.min(amountReceivedVal, outstandingBalanceBefore) : 0;
  const changeCashReturnVal = hasTypedPayment ? Math.max(0, amountReceivedVal - amountAppliedVal) : 0;

  const totalAmountReceivedVal = savedSettlementsPaid + amountAppliedVal;
  const balanceAfterVal = Math.max(0, outstandingBalanceBefore - amountAppliedVal);

  const statusVal = selectedInvoice
    ? (balanceAfterVal === 0 ? 'PAID' : (totalAmountReceivedVal > 0 ? 'PARTIAL' : 'UNPAID'))
    : '';

  // Calculate Button Trigger / Verification
  const handleCalculate = () => {
    if (!selectedInvoice) {
      showNotification('Please select an Invoice first', 'error');
      return;
    }
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      showNotification('Please enter a valid Payment Amount to calculate', 'error');
      return;
    }
    showNotification(
      `Calculation applied: Received Rs. ${formatCurrency(amountReceivedVal)}, Applied Rs. ${formatCurrency(amountAppliedVal)}, Change Rs. ${formatCurrency(changeCashReturnVal)}`,
      'info'
    );
  };

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
      received: amountReceivedVal, // Actual amount customer gave
      chequeNo: chequeNo.trim(),
      bank: bank.trim(),
      dateRealized: dateRealized ? dateRealized.trim() : '',
      date: paymentDate,
      receiptNo: receiptNo.trim(),
    };

    try {
      setLoading(true);
      const res = await api.post('/settlements', payload);
      if (res.data?.success) {
        showNotification(res.data.message || 'Settlement saved successfully!', 'success');

        // Update local invoice state
        if (res.data.invoice?.remainingBalance !== undefined) {
          setSelectedInvoice((prev) =>
            prev ? { ...prev, dueAmount: res.data.invoice.remainingBalance } : null
          );
        }

        // Refresh settlements list for this invoice
        fetchInvoiceSettlements(selectedInvoiceNumber);

        // Refresh global invoices list
        const invsRes = await api.get('/invoices?limit=250').catch(() => null);
        if (invsRes?.data?.data) setInvoicesList(invsRes.data.data);

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
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save Settlement';
      showNotification(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Button: Delete Settlement
  const handleDeleteSettlement = async () => {
    if (!selectedSettlementId) {
      showNotification('Please select a settlement row from Settlement History table below to delete', 'error');
      return;
    }

    const confirmDel = window.confirm(
      'Are you sure you want to delete this settlement record? The amount will be restored to the invoice balance.'
    );
    if (!confirmDel) return;

    try {
      setLoading(true);
      const res = await api.delete(`/settlements/${selectedSettlementId}`);
      if (res.data?.success) {
        showNotification(res.data.message || 'Settlement deleted and balance restored', 'success');

        if (res.data.data?.restoredBalance !== undefined) {
          setSelectedInvoice((prev) =>
            prev ? { ...prev, dueAmount: res.data.data.restoredBalance } : null
          );
        }

        fetchInvoiceSettlements(selectedInvoiceNumber);

        const invsRes = await api.get('/invoices?limit=250').catch(() => null);
        if (invsRes?.data?.data) setInvoicesList(invsRes.data.data);

        setSelectedSettlementId(null);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to delete Settlement';
      showNotification(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Line items for the Invoice Items table
  const displayLineItems = selectedInvoice?.lineItems || [];

  // Print Bill handler
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

  // Filtered invoices for lookup modal
  const filteredInvoices = invoicesList.filter((inv) => {
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
  const renderThermalReceiptContent = () => (
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
            <th style={{ textAlign: 'left' }}>Item</th>
            <th style={{ textAlign: 'right', width: '38%' }}>Qty x Rate</th>
            <th style={{ textAlign: 'right', width: '26%' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {displayLineItems.length === 0 ? (
            <tr>
              <td colSpan="3" style={{ textAlign: 'center', color: '#555', fontStyle: 'italic', padding: '1px 0' }}>
                No line items
              </td>
            </tr>
          ) : (
            displayLineItems.map((li, idx) => (
              <tr key={idx}>
                <td style={{ textAlign: 'left', wordBreak: 'break-word' }}>
                  {li.code || li.itemCode ? `${li.code || li.itemCode} - ` : ''}{li.description || ''}
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {Number(li.quantity || li.qty || 1).toFixed(2)} x {Number(li.price || li.unitPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
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
        <div className="thermal-receipt-total-row">
          <span>Amount to Be Paid:</span>
          <span style={{ fontWeight: 'bold' }}>
            {formatCurrency(amountToBePaid)}
          </span>
        </div>
        <div className="thermal-receipt-total-row">
          <span>Total Discount:</span>
          <span>
            {formatCurrency(invoiceLineDiscounts)}
          </span>
        </div>
        <div className="thermal-receipt-total-row">
          <span>Amount Received:</span>
          <span style={{ fontWeight: 'bold' }}>
            {formatCurrency(totalAmountReceivedVal)}
          </span>
        </div>
        <div className="thermal-receipt-total-row">
          <span>Balance:</span>
          <span style={{ fontWeight: 'bold' }}>
            {formatCurrency(balanceAfterVal)}
          </span>
        </div>
      </div>

      <div className="thermal-receipt-dashed"></div>

      <div className="thermal-receipt-notice">
        In case of price discrepancy, return the items & bill within 3 days for refund of difference
      </div>
    </div>
  );

  // Settlement History Summary Totals
  const totalSettledAmount = settlementsList.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const totalSettledReceived = settlementsList.reduce((sum, s) => sum + Number(s.received || s.amount || 0), 0);
  const totalSettledApplied = settlementsList.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const totalSettledChange = settlementsList.reduce((sum, s) => sum + Math.max(0, Number(s.received || s.amount || 0) - Number(s.amount || 0)), 0);

  return (
    <div className="settlement-page-wrapper">
      {/* 1. Top Classic Navigation Menu Bar */}
      <nav className="settlement-menubar-container" ref={menuRef}>
        <ul className="settlement-menubar">
          {topMenuItems.map((item) => (
            <li key={item.id} className="settlement-menubar-item">
              <button
                type="button"
                className={`settlement-menubar-button ${
                  (item.id === 'sales-service') || (activeDropdown === item.id) ? 'active' : ''
                }`}
                onClick={() => {
                  if (item.hasDropdown) {
                    setActiveDropdown(activeDropdown === item.id ? null : item.id);
                  } else if (item.path) {
                    navigate(item.path);
                  }
                }}
              >
                {item.label}
              </button>

              {/* Master Files Dropdown */}
              {item.id === 'master-files' && activeDropdown === 'master-files' && (
                <ul className="settlement-dropdown-menu">
                  {masterFilesDropdownItems.map((dropItem) => (
                    <li key={dropItem.id} className="settlement-dropdown-entry">
                      <button
                        type="button"
                        className="settlement-dropdown-item-btn"
                        onClick={() => {
                          setActiveDropdown(null);
                          navigate(dropItem.path);
                        }}
                      >
                        <span>{dropItem.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Stock Control System Dropdown */}
              {item.id === 'stock-control' && activeDropdown === 'stock-control' && (
                <ul className="settlement-dropdown-menu">
                  {stockControlDropdownItems.map((dropItem) => (
                    <li key={dropItem.id} className="settlement-dropdown-entry">
                      <button
                        type="button"
                        className="settlement-dropdown-item-btn"
                        onClick={() => {
                          setActiveDropdown(null);
                          navigate(dropItem.path);
                        }}
                      >
                        <span>{dropItem.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Sales and Service Dropdown */}
              {item.id === 'sales-service' && activeDropdown === 'sales-service' && (
                <ul className="settlement-dropdown-menu">
                  {salesServiceDropdownItems.map((dropItem) => (
                    <li key={dropItem.id} className="settlement-dropdown-entry">
                      <button
                        type="button"
                        className={`settlement-dropdown-item-btn ${
                          dropItem.id === 'settlement-invoice' ? 'selected' : ''
                        }`}
                        onClick={() => {
                          setActiveDropdown(null);
                          navigate(dropItem.path);
                        }}
                      >
                        <span>{dropItem.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Administration Dropdown */}
              {item.id === 'administration' && activeDropdown === 'administration' && (
                <ul className="settlement-dropdown-menu">
                  {administrationDropdownItems.map((dropItem) => (
                    <li key={dropItem.id} className="settlement-dropdown-entry">
                      <button
                        type="button"
                        className="settlement-dropdown-item-btn"
                        onClick={() => {
                          setActiveDropdown(null);
                          navigate(dropItem.path);
                        }}
                      >
                        <span>{dropItem.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>

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

      {/* 3. Main Full-Width Form Container */}
      <main className="main-settlement-container">
        {/* Notification Alert */}
        {notification && (
          <div className={`settlement-alert ${notification.type}`}>
            <span>{notification.message}</span>
            <button
              type="button"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
              onClick={() => setNotification(null)}
            >
              &#x2715;
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* SECTION 1: INVOICE & CUSTOMER                             */}
        {/* ========================================================= */}
        <div className="settlement-panel-box">
          <div className="settlement-section-header">Invoice & Customer</div>
          <div className="settlement-panel-content">
            <div className="settlement-top-grid">
              {/* Left Column: Invoice No, Value, Address */}
              <div className="settlement-top-col">
                <div className="settlement-field-row">
                  <span className="dotted-label-blue label-w-100">Invoice No . . . . .</span>
                  <div style={{ display: 'flex', flex: 1, gap: '4px' }}>
                    <select
                      className="settlement-select"
                      style={{ flex: 1, fontWeight: 'bold', color: '#000080' }}
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
                      className="settlement-btn-lookup"
                      title="Search Invoice in Database"
                      onClick={() => setInvoiceLookupOpen(true)}
                    >
                      Search
                    </button>
                  </div>
                </div>

                <div className="settlement-field-row">
                  <span className="dotted-label-blue label-w-100">Value . . . . . . . .</span>
                  <input
                    type="text"
                    className="settlement-input readonly"
                    style={{ flex: 1, fontWeight: 'bold' }}
                    readOnly
                    value={selectedInvoice ? formatCurrency(invoiceTotalGross) : ''}
                  />
                </div>

                <div className="settlement-field-row" style={{ alignItems: 'flex-start' }}>
                  <span className="dotted-label-blue label-w-100" style={{ marginTop: '3px' }}>Address . . . . . . .</span>
                  <textarea
                    className="settlement-textarea"
                    rows="2"
                    style={{ flex: 1, height: '42px' }}
                    readOnly
                    value={customerAddress}
                  />
                </div>
              </div>

              {/* Right Column: Customer, Balance, Date & User */}
              <div className="settlement-top-col">
                <div className="settlement-field-row">
                  <span className="dotted-label-blue label-w-90">Customer . . . . . .</span>
                  <input
                    type="text"
                    className="settlement-input readonly"
                    style={{ flex: 1, fontWeight: '600' }}
                    readOnly
                    value={customerName}
                  />
                </div>

                <div className="settlement-field-row">
                  <span className="dotted-label-blue label-w-90">Balance . . . . . . .</span>
                  <input
                    type="text"
                    className="settlement-input readonly settlement-input-green"
                    style={{ flex: 1, fontWeight: 'bold' }}
                    readOnly
                    value={selectedInvoice ? formatCurrency(outstandingBalanceBefore) : ''}
                  />
                </div>

                <div className="settlement-field-row">
                  <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: '6px' }}>
                    <span className="dotted-label-blue label-w-90">Date . . . . . . . .</span>
                    <input
                      type="date"
                      className="settlement-input"
                      style={{ flex: 1 }}
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', width: '180px', alignItems: 'center', gap: '6px' }}>
                    <span className="dotted-label-blue" style={{ width: '60px' }}>User . . . .</span>
                    <input
                      type="text"
                      className="settlement-input readonly"
                      style={{ flex: 1, textAlign: 'center' }}
                      readOnly
                      value={cashierUser}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION 2: INVOICE ITEMS                                  */}
        {/* ========================================================= */}
        <div className="settlement-panel-box">
          <div className="settlement-section-header">Invoice Items</div>
          <div className="settlement-table-container">
            <table className="settlement-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                  <th style={{ width: '180px' }}>Code</th>
                  <th>Description</th>
                  <th style={{ width: '90px', textAlign: 'right' }}>Qty</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Unit Price</th>
                  <th style={{ width: '140px', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {displayLineItems.length === 0 ? (
                  <>
                    <tr style={{ height: '22px' }}>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                    </tr>
                    <tr style={{ height: '22px' }}>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                    </tr>
                  </>
                ) : (
                  displayLineItems.map((li, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ fontWeight: '600', color: '#000080' }}>{li.code || li.itemCode}</td>
                      <td>{li.description}</td>
                      <td style={{ textAlign: 'right' }}>{Number(li.quantity || li.qty || 1).toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>
                        {Number(li.price || li.unitPrice || 0).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                        {Number(li.value || (li.price * li.quantity) || 0).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION 3: PAYMENT / SETTLEMENT (3-Column Layout)         */}
        {/* ========================================================= */}
        <div className="settlement-panel-box">
          <div className="settlement-section-header">Payment / Settlement</div>
          <div className="settlement-panel-content">
            <div className="settlement-payment-grid">
              {/* Column 1: Payment Entry Inputs + Green Calculate Button */}
              <div className="settlement-payment-col">
                <div className="settlement-field-row">
                  <span className="dotted-label-blue label-w-110">Payment Date . . . . .</span>
                  <input
                    type="date"
                    className="settlement-input"
                    style={{ flex: 1 }}
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>

                <div className="settlement-field-row">
                  <span className="dotted-label-blue label-w-110">Payment Amount . .</span>
                  <input
                    type="number"
                    step="0.01"
                    className="settlement-input"
                    style={{ flex: 1, textAlign: 'right', fontWeight: 'bold' }}
                    placeholder=""
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                </div>

                <div className="settlement-field-row">
                  <span className="dotted-label-blue label-w-110">Method . . . . . . . . .</span>
                  <select
                    className="settlement-select"
                    style={{ flex: 1, fontWeight: '600' }}
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="">Select method</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Credit Note">Credit Note</option>
                    <option value="Bank">Bank Transfer</option>
                    <option value="Card">Card</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="settlement-field-row">
                  <span className="dotted-label-blue label-w-110">Cheque No / CN . . .</span>
                  <input
                    type="text"
                    className="settlement-input"
                    style={{ flex: 1 }}
                    placeholder=""
                    value={chequeNo}
                    onChange={(e) => setChequeNo(e.target.value)}
                  />
                </div>

                <div className="settlement-field-row">
                  <span className="dotted-label-blue label-w-110">Date Realized . . . . .</span>
                  <input
                    type="date"
                    className="settlement-input"
                    style={{ flex: 1 }}
                    value={dateRealized}
                    onChange={(e) => setDateRealized(e.target.value)}
                  />
                </div>

                <div className="settlement-field-row">
                  <span className="dotted-label-blue label-w-110">Bank . . . . . . . . . . .</span>
                  <select
                    className="settlement-select"
                    style={{ flex: 1 }}
                    value={bank}
                    onChange={(e) => setBank(e.target.value)}
                  >
                    <option value="">Select bank</option>
                    {banksList.map((b, idx) => (
                      <option key={b._id || b.code || idx} value={b.code || b.description}>
                        {b.description || b.name || b.code}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Full-width green Calculate button */}
                <div style={{ marginTop: '4px' }}>
                  <button
                    type="button"
                    className="settlement-btn-calculate-green"
                    onClick={handleCalculate}
                  >
                    Calculate
                  </button>
                </div>
              </div>

              {/* Column 2: Calculation Panel (Inner Beige Card) */}
              <div className="settlement-calc-box">
                <div className="settlement-calc-row">
                  <span className="dotted-label-blue">Outstanding Balance (Before) . . . .</span>
                  <input
                    type="text"
                    className="settlement-input readonly"
                    style={{ width: '130px', textAlign: 'right', fontWeight: 'bold' }}
                    readOnly
                    value={selectedInvoice ? formatCurrency(outstandingBalanceBefore) : ''}
                  />
                </div>

                <div className="settlement-calc-row">
                  <span className="dotted-label-blue">Amount Received . . . . . . . . . . .</span>
                  <input
                    type="text"
                    className="settlement-input readonly"
                    style={{ width: '130px', textAlign: 'right', fontWeight: 'bold' }}
                    readOnly
                    value={selectedInvoice && hasTypedPayment ? formatCurrency(amountReceivedVal) : ''}
                  />
                </div>

                <div className="settlement-calc-row">
                  <span className="dotted-label-blue">Amount Applied . . . . . . . . . . . .</span>
                  <input
                    type="text"
                    className="settlement-input readonly"
                    style={{ width: '130px', textAlign: 'right', fontWeight: 'bold' }}
                    readOnly
                    value={selectedInvoice && hasTypedPayment ? formatCurrency(amountAppliedVal) : ''}
                  />
                </div>

                <div className="settlement-calc-row">
                  <span className="dotted-label-blue">Change / Cash Return . . . . . . . . .</span>
                  <input
                    type="text"
                    className="settlement-input readonly settlement-input-green"
                    style={{ width: '130px', textAlign: 'right', fontWeight: 'bold' }}
                    readOnly
                    value={selectedInvoice && hasTypedPayment ? formatCurrency(changeCashReturnVal) : ''}
                  />
                </div>
              </div>

              {/* Column 3: Invoice Summary */}
              <div className="settlement-summary-box">
                <div className="settlement-summary-row">
                  <span className="dotted-label-blue">Invoice Total . . . . . . . .</span>
                  <input
                    type="text"
                    className="settlement-input readonly"
                    style={{ width: '130px', textAlign: 'right' }}
                    readOnly
                    value={selectedInvoice ? formatCurrency(invoiceTotalGross) : ''}
                  />
                </div>

                <div className="settlement-summary-row">
                  <span className="dotted-label-blue">Total Discount . . . . . . . .</span>
                  <input
                    type="text"
                    className="settlement-input readonly"
                    style={{ width: '130px', textAlign: 'right' }}
                    readOnly
                    value={selectedInvoice ? formatCurrency(invoiceLineDiscounts) : ''}
                  />
                </div>

                <div className="settlement-summary-row">
                  <span className="dotted-label-blue">Amount To Be Paid . . . . .</span>
                  <input
                    type="text"
                    className="settlement-input readonly"
                    style={{ width: '130px', textAlign: 'right', fontWeight: 'bold' }}
                    readOnly
                    value={selectedInvoice ? formatCurrency(amountToBePaid) : ''}
                  />
                </div>

                <div className="settlement-summary-row">
                  <span className="dotted-label-blue">Total Amount Received . .</span>
                  <input
                    type="text"
                    className="settlement-input readonly"
                    style={{ width: '130px', textAlign: 'right', fontWeight: 'bold' }}
                    readOnly
                    value={selectedInvoice ? formatCurrency(totalAmountReceivedVal) : ''}
                  />
                </div>

                <div className="settlement-summary-row">
                  <span className="dotted-label-blue">Balance (After) . . . . . . . .</span>
                  <input
                    type="text"
                    className="settlement-input readonly settlement-input-green"
                    style={{ width: '130px', textAlign: 'right', fontWeight: 'bold' }}
                    readOnly
                    value={selectedInvoice ? formatCurrency(balanceAfterVal) : ''}
                  />
                </div>

                <div className="settlement-summary-row">
                  <span className="dotted-label-blue">Status . . . . . . . . . . . .</span>
                  <input
                    type="text"
                    className="settlement-input readonly settlement-input-green"
                    style={{ width: '130px', textAlign: 'center', fontWeight: 'bold' }}
                    readOnly
                    value={statusVal}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION 4: SETTLEMENT HISTORY                             */}
        {/* ========================================================= */}
        <div className="settlement-panel-box" style={{ flex: 1, minHeight: '130px' }}>
          <div className="settlement-section-header">Settlement History</div>
          <div className="settlement-table-container">
            <table className="settlement-table">
              <thead>
                <tr>
                  <th style={{ width: '35px', textAlign: 'center' }}>#</th>
                  <th style={{ width: '95px' }}>Date</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>Amount</th>
                  <th style={{ width: '90px' }}>Method</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>Received</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>Applied</th>
                  <th style={{ width: '90px', textAlign: 'right' }}>Change</th>
                  <th style={{ width: '120px' }}>Cheque No / CN</th>
                  <th style={{ width: '120px' }}>Bank</th>
                  <th style={{ width: '100px' }}>Date Realized</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>User</th>
                </tr>
              </thead>
              <tbody>
                {settlementsList.length === 0 ? (
                  <>
                    <tr style={{ height: '22px' }}>
                      <td></td>
                      <td></td>
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
                    <tr style={{ height: '22px' }}>
                      <td></td>
                      <td></td>
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
                  </>
                ) : (
                  settlementsList.map((st, idx) => {
                    const isSelected = selectedSettlementId === st._id;
                    const stAmount = Number(st.amount || 0);
                    const stReceived = Number(st.received || st.amount || 0);
                    const stApplied = Number(st.amount || 0);
                    const stChange = Math.max(0, stReceived - stApplied);

                    return (
                      <tr
                        key={st._id}
                        className={isSelected ? 'selected' : ''}
                        onClick={() => setSelectedSettlementId(isSelected ? null : st._id)}
                      >
                        <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                        <td>{new Date(st.date || st.createdAt).toLocaleDateString()}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          {formatCurrency(stAmount)}
                        </td>
                        <td>{st.method || 'Cash'}</td>
                        <td style={{ textAlign: 'right' }}>
                          {formatCurrency(stReceived)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {formatCurrency(stApplied)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {formatCurrency(stChange)}
                        </td>
                        <td>{st.chequeNo || '-'}</td>
                        <td>{st.bank || '-'}</td>
                        <td>{st.dateRealized || '-'}</td>
                        <td style={{ textAlign: 'center' }}>{st.createdBy || 'PC004'}</td>
                      </tr>
                    );
                  })
                )}

                {/* Total Summary Row (Light sky-blue) */}
                <tr className="settlement-total-row">
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>Total</td>
                  <td></td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    {settlementsList.length > 0 ? formatCurrency(totalSettledAmount) : ''}
                  </td>
                  <td></td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    {settlementsList.length > 0 ? formatCurrency(totalSettledReceived) : ''}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    {settlementsList.length > 0 ? formatCurrency(totalSettledApplied) : ''}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    {settlementsList.length > 0 ? formatCurrency(totalSettledChange) : ''}
                  </td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION 5: ACTION BUTTONS TOOLBAR                         */}
        {/* ========================================================= */}
        <div className="settlement-action-toolbar">
          <button type="button" className="settlement-btn-classic" onClick={handleNew}>
            New
          </button>
          <button
            type="button"
            className="settlement-btn-classic settlement-btn-save-blue"
            onClick={handleSaveSettlement}
            disabled={loading}
          >
            Save
          </button>
          <button
            type="button"
            className="settlement-btn-classic"
            onClick={handleDeleteSettlement}
            disabled={loading || !selectedSettlementId}
          >
            Delete
          </button>
          <button
            type="button"
            className="settlement-btn-classic btn-preview-bill"
            onClick={() => setReceiptPreviewOpen(true)}
          >
            Preview Bill
          </button>
          <button
            type="button"
            className="settlement-btn-classic btn-print-bill"
            onClick={handlePrintBill}
          >
            Print Bill
          </button>
          <button type="button" className="settlement-btn-classic" onClick={() => navigate('/invoice')}>
            Cancel
          </button>
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
                className="settlement-btn-classic btn-print-bill"
                onClick={handlePrintBill}
              >
                Print
              </button>
              <button
                type="button"
                className="settlement-btn-classic"
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
                className="settlement-input"
                style={{ width: '100%', fontSize: '11px' }}
                placeholder="Search by Invoice No, Customer Code, Name..."
                value={invoiceSearchQuery}
                onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                autoFocus
              />
              <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                <table className="settlement-table">
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
                              className="settlement-btn-classic"
                              style={{ height: '20px', minWidth: '45px', padding: '0 4px', fontSize: '10.5px' }}
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
                className="settlement-btn-classic"
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
