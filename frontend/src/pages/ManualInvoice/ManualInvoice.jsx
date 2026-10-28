import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ClassicNavbar from '../../components/navigation/ClassicNavbar';
import api from '../../services/api';
import './ManualInvoice.css';

/**
 * SOFAST MOTORS - Manual Invoice Module
 * Non-inventory invoice workflow for purchasing unregistered items.
 * Does not modify stock quantities or require Item Master records.
 */
function ManualInvoice() {
  const navigate = useNavigate();

  // Active loaded invoice ID (null for new unsaved invoice)
  const [activeInvoiceId, setActiveInvoiceId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  // Invoice Header State
  const [invoiceHeader, setInvoiceHeader] = useState({
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    customerCode: '',
    customerName: 'Walk In Customer',
    customerAddress: '',
    customerTelephone: '',
    paymentMethod: 'Cash',
    note: '',
    status: 'completed',
  });

  // Current Manual Item Entry Form
  const [itemEntry, setItemEntry] = useState({
    code: '',
    description: '',
    unit: 'PCS',
    quantity: '1',
    sellingPrice: '',
    discountPercentage: '0',
  });

  // List of added line items
  const [lineItems, setLineItems] = useState([]);

  // Settlement / Payment Fields
  const [amountReceived, setAmountReceived] = useState('');
  const [cashierUser] = useState(
    localStorage.getItem('username') || localStorage.getItem('userCode') || 'PC004'
  );

  // Modals & Popups
  const [customerLookupOpen, setCustomerLookupOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customersList, setCustomersList] = useState([]);

  const [invoiceLookupOpen, setInvoiceLookupOpen] = useState(false);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [manualInvoicesList, setManualInvoicesList] = useState([]);

  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false);
  const [printTime, setPrintTime] = useState('');

  // Refs for focusing
  const descInputRef = useRef(null);
  const priceInputRef = useRef(null);
  const qtyInputRef = useRef(null);

  // Notification helper
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4000);
  };

  // Fetch next manual invoice number
  const fetchNextManualNumber = async () => {
    try {
      const res = await api.get('/invoices/next-manual-number');
      if (res.data?.success && res.data.data?.invoiceNumber) {
        setInvoiceHeader((prev) => ({
          ...prev,
          invoiceNumber: res.data.data.invoiceNumber,
        }));
      }
    } catch (err) {
      console.error('Failed to fetch next manual invoice number:', err);
      showNotification('Could not load next manual invoice number', 'error');
    }
  };

  // Load customer master list
  const fetchCustomers = async () => {
    try {
      const res = await api.get('/customers');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setCustomersList(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to load customers:', err);
    }
  };

  // Initial load
  useEffect(() => {
    fetchNextManualNumber();
    fetchCustomers();
  }, []);

  // Compute live preview of the item line currently being entered
  const liveLinePreview = useMemo(() => {
    const q = parseFloat(itemEntry.quantity) || 0;
    const p = parseFloat(itemEntry.sellingPrice) || 0;
    const d = parseFloat(itemEntry.discountPercentage) || 0;

    const gross = q * p;
    const discAmt = gross * (Math.max(0, Math.min(100, d)) / 100);
    const net = gross - discAmt;

    return {
      gross: Math.max(0, gross),
      discountAmount: Math.max(0, discAmt),
      net: Math.max(0, net),
    };
  }, [itemEntry.quantity, itemEntry.sellingPrice, itemEntry.discountPercentage]);

  // Overall Invoice Calculations
  const invoiceCalculations = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalQuantity = 0;

    lineItems.forEach((item) => {
      const gross = (item.quantity || 0) * (item.sellingPrice || 0);
      const disc = item.discountAmount || 0;
      subtotal += gross;
      totalDiscount += disc;
      totalQuantity += item.quantity || 0;
    });

    const netTotal = Math.max(0, subtotal - totalDiscount);
    const rcvd = amountReceived === '' ? netTotal : parseFloat(amountReceived) || 0;
    const balance = rcvd - netTotal;

    return {
      totalItems: lineItems.length,
      totalQuantity,
      subtotal,
      totalDiscount,
      netTotal,
      balance,
    };
  }, [lineItems, amountReceived]);

  // Handle Add Item to invoice table
  const handleAddItem = (e) => {
    if (e) e.preventDefault();

    const desc = itemEntry.description.trim();
    if (!desc) {
      showNotification('Please enter Item Description', 'error');
      descInputRef.current?.focus();
      return;
    }

    const qty = parseFloat(itemEntry.quantity);
    if (isNaN(qty) || qty <= 0) {
      showNotification('Quantity must be greater than 0', 'error');
      qtyInputRef.current?.focus();
      return;
    }

    const price = parseFloat(itemEntry.sellingPrice);
    if (isNaN(price) || price < 0) {
      showNotification('Selling Price cannot be negative', 'error');
      priceInputRef.current?.focus();
      return;
    }

    const discPercent = Math.max(0, Math.min(100, parseFloat(itemEntry.discountPercentage) || 0));

    // Auto-generate item code if left blank
    const code = itemEntry.code.trim() || `MAN-${lineItems.length + 1}`;
    const unit = itemEntry.unit.trim().toUpperCase() || 'PCS';

    const grossValue = qty * price;
    const discountAmount = grossValue * (discPercent / 100);
    const netLineValue = grossValue - discountAmount;

    const newItem = {
      code,
      description: desc,
      unit,
      quantity: qty,
      sellingPrice: price,
      price: price,
      discountPercentage: discPercent,
      discountAmount: Math.round(discountAmount * 100) / 100,
      finalPrice: Math.round(netLineValue * 100) / 100,
      value: Math.round(netLineValue * 100) / 100,
      total: Math.round(netLineValue * 100) / 100,
    };

    setLineItems((prev) => [...prev, newItem]);

    // Reset item entry form for next entry
    setItemEntry({
      code: '',
      description: '',
      unit: 'PCS',
      quantity: '1',
      sellingPrice: '',
      discountPercentage: '0',
    });

    showNotification(`Item "${desc}" added to invoice`, 'success');
    descInputRef.current?.focus();
  };

  // Remove an item from the invoice table
  const handleRemoveItem = (index) => {
    setLineItems((prev) => prev.filter((_, idx) => idx !== index));
    showNotification('Item removed from manual invoice', 'info');
  };

  // Start fresh Manual Invoice
  const handleNewInvoice = () => {
    setActiveInvoiceId(null);
    setInvoiceHeader({
      invoiceNumber: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      customerCode: '',
      customerName: 'Walk In Customer',
      customerAddress: '',
      customerTelephone: '',
      paymentMethod: 'Cash',
      note: '',
      status: 'completed',
    });
    setItemEntry({
      code: '',
      description: '',
      unit: 'PCS',
      quantity: '1',
      sellingPrice: '',
      discountPercentage: '0',
    });
    setLineItems([]);
    setAmountReceived('');
    fetchNextManualNumber();
    showNotification('Prepared fresh Manual Invoice', 'info');
    descInputRef.current?.focus();
  };

  // Save Manual Invoice (POST or PUT)
  const handleSaveInvoice = async (silentAfterPrint = false) => {
    if (isSubmitting) return null;

    if (!invoiceHeader.invoiceNumber.trim()) {
      showNotification('Invoice Number is required', 'error');
      return null;
    }

    if (lineItems.length === 0) {
      showNotification('Please add at least one item to save the manual invoice', 'error');
      descInputRef.current?.focus();
      return null;
    }

    setIsSubmitting(true);
    try {
      const net = invoiceCalculations.netTotal;
      const rcvd = amountReceived === '' ? net : parseFloat(amountReceived) || 0;
      const bal = rcvd - net;

      const payload = {
        invoiceNumber: invoiceHeader.invoiceNumber.trim(),
        date: invoiceHeader.invoiceDate,
        customerName: invoiceHeader.customerName || 'Walk In Customer',
        customerCode: invoiceHeader.customerCode || '',
        customerAddress: invoiceHeader.customerAddress || '',
        customerTelephone: invoiceHeader.customerTelephone || '',
        paymentMethod: invoiceHeader.paymentMethod || 'Cash',
        note: invoiceHeader.note || '',
        remark: invoiceHeader.note || '',
        status: 'completed',
        isCompleted: true,
        isHold: false,

        // Critical Manual Invoice identifiers
        isManualInvoice: true,
        invoiceType: 'Manual',
        isStockUpdated: false, // Ensures zero stock modification invariant

        lineItems: lineItems.map((item) => ({
          code: item.code,
          description: item.description,
          unit: item.unit || 'PCS',
          quantity: item.quantity,
          sellingPrice: item.sellingPrice,
          price: item.price || item.sellingPrice,
          discountPercentage: item.discountPercentage || 0,
          discountAmount: item.discountAmount || 0,
          finalPrice: item.finalPrice || item.value,
          value: item.value || item.finalPrice,
          total: item.total || item.finalPrice,
        })),

        subTotal: Math.round(invoiceCalculations.subtotal * 100) / 100,
        totalDiscount: Math.round(invoiceCalculations.totalDiscount * 100) / 100,
        netTotal: Math.round(net * 100) / 100,
        total: Math.round(net * 100) / 100,
        grandTotal: Math.round(net * 100) / 100,
        paidAmount: Math.round(rcvd * 100) / 100,
        balance: Math.round(bal * 100) / 100,
        dueAmount: bal < 0 ? Math.abs(Math.round(bal * 100) / 100) : 0,
        cashier: cashierUser,
      };

      let res;
      if (activeInvoiceId) {
        res = await api.put(`/invoices/${activeInvoiceId}`, payload);
      } else {
        res = await api.post('/invoices', payload);
      }

      if (res.data?.success) {
        const savedDoc = res.data.data;
        setActiveInvoiceId(savedDoc._id);
        if (!silentAfterPrint) {
          showNotification(
            `Manual Invoice "${savedDoc.invoiceNumber}" saved successfully! Zero stock impact.`,
            'success'
          );
        }
        return savedDoc;
      } else {
        throw new Error(res.data?.message || 'Save failed');
      }
    } catch (err) {
      console.error('Error saving manual invoice:', err);
      const errMsg = err.response?.data?.message || err.message || 'Error saving invoice';
      showNotification(`Failed to save invoice: ${errMsg}`, 'error');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bill Print
  const handleBillPrint = async () => {
    if (lineItems.length === 0) {
      showNotification('Cannot print an empty invoice. Add items first.', 'error');
      return;
    }

    setPrintTime(
      new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      })
    );

    // Auto-save if invoice hasn't been saved yet
    if (!activeInvoiceId) {
      const saved = await handleSaveInvoice(true);
      if (!saved) return;
    }

    // Open print preview and launch browser print dialog
    setReceiptPreviewOpen(true);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  // Delete saved Manual Invoice
  const handleDeleteInvoice = async () => {
    if (!activeInvoiceId) {
      showNotification('No saved manual invoice is currently loaded to delete.', 'info');
      return;
    }

    const confirmDel = window.confirm(
      `Are you sure you want to delete Manual Invoice "${invoiceHeader.invoiceNumber}"?\n\nThis will remove the invoice record permanently without affecting stock.`
    );
    if (!confirmDel) return;

    setIsSubmitting(true);
    try {
      const res = await api.delete(`/invoices/${activeInvoiceId}`);
      if (res.data?.success) {
        showNotification(
          `Manual Invoice "${invoiceHeader.invoiceNumber}" deleted successfully. Stock unchanged.`,
          'success'
        );
        handleNewInvoice();
      } else {
        throw new Error(res.data?.message || 'Delete failed');
      }
    } catch (err) {
      console.error('Error deleting invoice:', err);
      const errMsg = err.response?.data?.message || err.message || 'Error deleting invoice';
      showNotification(`Delete failed: ${errMsg}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Load existing Manual Invoice into form
  const loadInvoiceData = (inv) => {
    if (!inv) return;
    setActiveInvoiceId(inv._id);
    setInvoiceHeader({
      invoiceNumber: inv.invoiceNumber || '',
      invoiceDate: inv.date ? String(inv.date).split('T')[0] : new Date().toISOString().split('T')[0],
      customerCode: inv.customerCode || inv.cuscode || '',
      customerName: inv.customerName || inv.cusname || 'Walk In Customer',
      customerAddress: inv.customerAddress || '',
      customerTelephone: inv.customerTelephone || '',
      paymentMethod: inv.paymentMethod || 'Cash',
      note: inv.note || inv.remark || '',
      status: inv.status || 'completed',
    });

    if (Array.isArray(inv.lineItems) && inv.lineItems.length > 0) {
      setLineItems(
        inv.lineItems.map((item, idx) => ({
          code: item.code || `MAN-${idx + 1}`,
          description: item.description || 'Manual Item',
          unit: item.unit || 'PCS',
          quantity: item.quantity || 1,
          sellingPrice: item.sellingPrice || item.price || 0,
          price: item.price || item.sellingPrice || 0,
          discountPercentage: item.discountPercentage || 0,
          discountAmount: item.discountAmount || 0,
          finalPrice: item.finalPrice || item.value || 0,
          value: item.value || item.finalPrice || 0,
          total: item.total || item.finalPrice || 0,
        }))
      );
    } else {
      setLineItems([]);
    }

    setAmountReceived(inv.paidAmount != null ? String(inv.paidAmount) : '');
    setInvoiceLookupOpen(false);
    showNotification(`Manual Invoice "${inv.invoiceNumber}" loaded`, 'info');
  };

  // Open existing manual invoices lookup
  const handleOpenInvoiceLookup = async () => {
    setInvoiceLookupOpen(true);
    try {
      const res = await api.get('/invoices?type=manual&limit=100');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setManualInvoicesList(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to load manual invoices list:', err);
    }
  };

  // Select customer from lookup
  const handleSelectCustomer = (c) => {
    setInvoiceHeader((prev) => ({
      ...prev,
      customerCode: c.code || c.customerCode || '',
      customerName: c.name || c.customerName || 'Walk In Customer',
      customerAddress: c.address || '',
      customerTelephone: c.telephone1 || c.telephone || '',
    }));
    setCustomerLookupOpen(false);
    showNotification(`Customer "${c.name}" selected`, 'info');
  };

  // Reset to Walk-in customer
  const handleResetWalkInCustomer = () => {
    setInvoiceHeader((prev) => ({
      ...prev,
      customerCode: '',
      customerName: 'Walk In Customer',
      customerAddress: '',
      customerTelephone: '',
    }));
    showNotification('Customer reset to Walk-In Customer', 'info');
  };

  // Filtered customers for lookup
  const filteredCustomers = useMemo(() => {
    const q = customerSearchQuery.toLowerCase().trim();
    if (!q) return customersList;
    return customersList.filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.code && c.code.toLowerCase().includes(q)) ||
        (c.telephone1 && c.telephone1.includes(q)) ||
        (c.telephone && c.telephone.includes(q))
    );
  }, [customersList, customerSearchQuery]);

  // Filtered manual invoices for lookup
  const filteredInvoices = useMemo(() => {
    const q = invoiceSearchQuery.toLowerCase().trim();
    if (!q) return manualInvoicesList;
    return manualInvoicesList.filter(
      (inv) =>
        (inv.invoiceNumber && inv.invoiceNumber.toLowerCase().includes(q)) ||
        (inv.customerName && inv.customerName.toLowerCase().includes(q))
    );
  }, [manualInvoicesList, invoiceSearchQuery]);

  // Render Thermal Bill Content
  const renderThermalReceiptContent = () => {
    const net = invoiceCalculations.netTotal;
    const rcvd = amountReceived === '' ? net : parseFloat(amountReceived) || 0;
    const bal = rcvd - net;

    return (
      <div className="manual-receipt-preview-container">
        <div className="manual-receipt-header">
          <div className="manual-receipt-title">SOFAST (PVT) LTD</div>
          <div className="manual-receipt-subtitle">Dealer for David Pieris Motor Company</div>
          <div>7E, MADDE GODA ROAD, MATHUGAMA</div>
          <div>034-2210680, 074-0295088</div>
          <div className="manual-receipt-badge">*** MANUAL INVOICE ***</div>
        </div>

        <div className="manual-receipt-dashed" />

        <div className="manual-receipt-meta-row">
          <span>Inv No: <b>{invoiceHeader.invoiceNumber}</b></span>
          <span>Date: {invoiceHeader.invoiceDate}</span>
        </div>
        <div className="manual-receipt-meta-row">
          <span>Time: {printTime || new Date().toLocaleTimeString()}</span>
          <span>User: {cashierUser}</span>
        </div>
        <div className="manual-receipt-meta-row">
          <span>Cust: {invoiceHeader.customerName}</span>
          <span>Pay: {invoiceHeader.paymentMethod}</span>
        </div>
        {invoiceHeader.customerAddress && (
          <div className="manual-receipt-meta-row">
            <span>Addr: {invoiceHeader.customerAddress}</span>
          </div>
        )}

        <div className="manual-receipt-dashed" />

        <table className="manual-receipt-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Item Description</th>
              <th style={{ textAlign: 'right' }}>Qty x Rate</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, idx) => {
              const gross = (item.quantity || 0) * (item.sellingPrice || 0);
              const disc = item.discountAmount || 0;
              const val = gross - disc;
              return (
                <tr key={idx}>
                  <td style={{ textAlign: 'left', wordBreak: 'break-word' }}>
                    <div><b>{item.description}</b></div>
                    <div style={{ fontSize: '10px', color: '#555' }}>
                      [{item.code}] {item.discountPercentage > 0 ? `(${item.discountPercentage}% off)` : ''}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {item.quantity} {item.unit} x {Number(item.sellingPrice).toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    {val.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="manual-receipt-dashed" />

        <div className="manual-receipt-totals">
          <div className="manual-receipt-total-row">
            <span>Subtotal ({invoiceCalculations.totalItems} items):</span>
            <span>Rs. {invoiceCalculations.subtotal.toFixed(2)}</span>
          </div>
          {invoiceCalculations.totalDiscount > 0 && (
            <div className="manual-receipt-total-row">
              <span>Total Discount:</span>
              <span>- Rs. {invoiceCalculations.totalDiscount.toFixed(2)}</span>
            </div>
          )}
          <div className="manual-receipt-total-row manual-receipt-total-main">
            <span>NET TOTAL:</span>
            <span>Rs. {net.toFixed(2)}</span>
          </div>
          <div className="manual-receipt-total-row">
            <span>Amount Received ({invoiceHeader.paymentMethod}):</span>
            <span>Rs. {rcvd.toFixed(2)}</span>
          </div>
          <div className="manual-receipt-total-row">
            <span>{bal >= 0 ? 'Change / Balance:' : 'Due Amount:'}</span>
            <span><b>Rs. {Math.abs(bal).toFixed(2)}</b></span>
          </div>
        </div>

        {invoiceHeader.note && (
          <>
            <div className="manual-receipt-dashed" />
            <div style={{ fontSize: '10px' }}>
              <b>Note:</b> {invoiceHeader.note}
            </div>
          </>
        )}

        <div className="manual-receipt-dashed" />
        <div className="manual-receipt-footer">
          <div>Goods once sold will not be accepted or exchanged without bill.</div>
          <div style={{ fontWeight: 'bold', marginTop: '4px' }}>Thank You! Come Again</div>
          <div style={{ fontSize: '9px', color: '#666' }}>SOFAST ERP Solutions</div>
        </div>
      </div>
    );
  };

  return (
    <div className="manual-invoice-page">
      {/* 1. Classic Windows XP / ERP Titlebar */}
      <div className="manual-invoice-titlebar">
        <div className="manual-invoice-titlebar-brand">
          <span className="manual-invoice-titlebar-icon">📝</span>
          <span className="manual-invoice-titlebar-heading">
            SOFAST MOTORS — MANUAL SALES INVOICE (NON-STOCK ENTRY)
          </span>
        </div>
        <div className="manual-invoice-titlebar-controls">
          <button
            type="button"
            className="manual-win-control-btn"
            title="Minimize"
            onClick={() => {}}
          >
            _
          </button>
          <button
            type="button"
            className="manual-win-control-btn"
            title="Maximize"
            onClick={() => {}}
          >
            □
          </button>
          <button
            type="button"
            className="manual-win-control-btn close"
            title="Close / Back to Sales Invoice"
            onClick={() => navigate('/invoice')}
          >
            ✕
          </button>
        </div>
      </div>

      {/* 2. Top Navigation Bar */}
      <ClassicNavbar activeMenu="sales-service" />

      {/* Notification Toast */}
      {notification && (
        <div className={`manual-invoice-notification ${notification.type}`}>
          <span>
            {notification.type === 'success' ? '✅' : notification.type === 'error' ? '❌' : 'ℹ️'}
          </span>
          <span>{notification.message}</span>
        </div>
      )}

      {/* 3. Main Form Container */}
      <div className="manual-invoice-container">
        {/* Info Banner explaining non-stock nature */}
        <div className="manual-invoice-banner">
          <div className="manual-invoice-banner-text">
            <span className="manual-invoice-badge">NON-STOCK INVOICE</span>
            <span>
              Create, save, and print customer bills for items not registered in Item Master.
              <b> Zero inventory quantities will be modified</b> by this invoice.
            </span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              className="manual-btn manual-btn-small"
              onClick={handleOpenInvoiceLookup}
              title="Search or load previously saved manual invoices"
            >
              🔍 Find Manual Invoice
            </button>
            <button
              type="button"
              className="manual-btn manual-btn-small"
              onClick={() => navigate('/invoice')}
              title="Switch back to standard stock sales invoice"
            >
              ↩️ Standard Sales Invoice
            </button>
          </div>
        </div>

        {/* Header Fieldset: Invoice & Customer Info */}
        <fieldset className="manual-fieldset">
          <legend className="manual-legend">Invoice Header & Customer Details</legend>
          <div className="manual-header-grid">
            {/* Invoice Number */}
            <div className="manual-form-group">
              <label className="manual-label">
                <span>Manual Invoice No <span className="required">*</span></span>
                {activeInvoiceId && (
                  <span style={{ color: '#006600', fontSize: '10px' }}>(SAVED)</span>
                )}
              </label>
              <div className="manual-input-with-button">
                <input
                  type="text"
                  className="manual-input read-only"
                  value={invoiceHeader.invoiceNumber}
                  readOnly
                  placeholder="Auto (MAN-XXXX)"
                />
                <button
                  type="button"
                  className="manual-btn manual-btn-small"
                  onClick={fetchNextManualNumber}
                  title="Generate next sequential number"
                >
                  ⚡ Next
                </button>
              </div>
            </div>

            {/* Invoice Date */}
            <div className="manual-form-group">
              <label className="manual-label">
                <span>Invoice Date <span className="required">*</span></span>
              </label>
              <input
                type="date"
                className="manual-input"
                value={invoiceHeader.invoiceDate}
                onChange={(e) =>
                  setInvoiceHeader({ ...invoiceHeader, invoiceDate: e.target.value })
                }
              />
            </div>

            {/* Customer Selection */}
            <div className="manual-form-group">
              <label className="manual-label">
                <span>Customer <span className="required">*</span></span>
                <span
                  style={{
                    color: '#0055ea',
                    cursor: 'pointer',
                    fontSize: '10px',
                    textDecoration: 'underline',
                  }}
                  onClick={handleResetWalkInCustomer}
                  title="Reset to default Walk-In customer"
                >
                  Walk-In
                </span>
              </label>
              <div className="manual-input-with-button">
                <input
                  type="text"
                  className="manual-input"
                  value={invoiceHeader.customerName}
                  onChange={(e) =>
                    setInvoiceHeader({ ...invoiceHeader, customerName: e.target.value })
                  }
                  placeholder="Walk In Customer"
                />
                <button
                  type="button"
                  className="manual-btn manual-btn-small"
                  onClick={() => setCustomerLookupOpen(true)}
                  title="Select from Customer Master"
                >
                  👥 Select
                </button>
              </div>
            </div>

            {/* Payment Method */}
            <div className="manual-form-group">
              <label className="manual-label">Payment Method</label>
              <select
                className="manual-select"
                value={invoiceHeader.paymentMethod}
                onChange={(e) =>
                  setInvoiceHeader({ ...invoiceHeader, paymentMethod: e.target.value })
                }
              >
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="Online Transfer">Online Transfer</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>

            {/* Customer Address */}
            <div className="manual-form-group" style={{ gridColumn: 'span 2' }}>
              <label className="manual-label">Customer Address</label>
              <input
                type="text"
                className="manual-input"
                value={invoiceHeader.customerAddress}
                onChange={(e) =>
                  setInvoiceHeader({ ...invoiceHeader, customerAddress: e.target.value })
                }
                placeholder="Enter customer address or populate from Customer Master"
              />
            </div>

            {/* Reference / Note */}
            <div className="manual-form-group" style={{ gridColumn: 'span 2' }}>
              <label className="manual-label">Reference / Note</label>
              <input
                type="text"
                className="manual-input"
                value={invoiceHeader.note}
                onChange={(e) => setInvoiceHeader({ ...invoiceHeader, note: e.target.value })}
                placeholder="Optional invoice remarks, supplier notes, or vehicle details"
              />
            </div>
          </div>
        </fieldset>

        {/* Manual Item Entry Section */}
        <fieldset className="manual-fieldset">
          <legend className="manual-legend">Manual Item Entry (No Stock Item Required)</legend>
          <form onSubmit={handleAddItem} className="manual-item-entry-grid">
            {/* Item Code (Optional) */}
            <div className="manual-form-group">
              <label className="manual-label">Item Code (Ref)</label>
              <input
                type="text"
                className="manual-input"
                placeholder={`MAN-${lineItems.length + 1}`}
                value={itemEntry.code}
                onChange={(e) => setItemEntry({ ...itemEntry, code: e.target.value })}
              />
            </div>

            {/* Description (Required) */}
            <div className="manual-form-group">
              <label className="manual-label">
                <span>Description <span className="required">*</span></span>
              </label>
              <input
                ref={descInputRef}
                type="text"
                className="manual-input"
                placeholder="Enter item description..."
                value={itemEntry.description}
                onChange={(e) => setItemEntry({ ...itemEntry, description: e.target.value })}
              />
            </div>

            {/* Unit */}
            <div className="manual-form-group">
              <label className="manual-label">Unit</label>
              <select
                className="manual-select"
                value={itemEntry.unit}
                onChange={(e) => setItemEntry({ ...itemEntry, unit: e.target.value })}
              >
                <option value="PCS">PCS</option>
                <option value="SET">SET</option>
                <option value="NOS">NOS</option>
                <option value="KG">KG</option>
                <option value="MTR">MTR</option>
                <option value="PKT">PKT</option>
                <option value="BOX">BOX</option>
                <option value="LTR">LTR</option>
              </select>
            </div>

            {/* Quantity (Required > 0) */}
            <div className="manual-form-group">
              <label className="manual-label">
                <span>Qty <span className="required">*</span></span>
              </label>
              <input
                ref={qtyInputRef}
                type="number"
                step="any"
                min="0.001"
                className="manual-input"
                value={itemEntry.quantity}
                onChange={(e) => setItemEntry({ ...itemEntry, quantity: e.target.value })}
              />
            </div>

            {/* Selling Price (Required >= 0) */}
            <div className="manual-form-group">
              <label className="manual-label">
                <span>Selling Price (Rs.) <span className="required">*</span></span>
              </label>
              <input
                ref={priceInputRef}
                type="number"
                step="0.01"
                min="0"
                className="manual-input"
                placeholder="0.00"
                value={itemEntry.sellingPrice}
                onChange={(e) => setItemEntry({ ...itemEntry, sellingPrice: e.target.value })}
              />
            </div>

            {/* Discount (%) */}
            <div className="manual-form-group">
              <label className="manual-label">Disc (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                className="manual-input"
                placeholder="0"
                value={itemEntry.discountPercentage}
                onChange={(e) =>
                  setItemEntry({ ...itemEntry, discountPercentage: e.target.value })
                }
              />
            </div>

            {/* Calculated Line Value Preview */}
            <div className="manual-form-group">
              <label className="manual-label">Line Value (Rs.)</label>
              <div className="manual-calc-preview">
                {liveLinePreview.net.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>

            {/* Add Item Button */}
            <div style={{ display: 'flex', gap: '4px' }}>
              <button type="submit" className="manual-btn manual-btn-primary">
                ➕ Add Item
              </button>
            </div>
          </form>
        </fieldset>

        {/* Items Table */}
        <div className="manual-table-container">
          <table className="manual-table">
            <thead>
              <tr>
                <th style={{ width: '35px' }} className="center">#</th>
                <th style={{ width: '110px' }}>Item Code</th>
                <th>Item Description</th>
                <th style={{ width: '60px' }} className="center">Unit</th>
                <th style={{ width: '80px' }} className="right">Quantity</th>
                <th style={{ width: '110px' }} className="right">Selling Price</th>
                <th style={{ width: '80px' }} className="right">Disc (%)</th>
                <th style={{ width: '120px' }} className="right">Net Value (Rs.)</th>
                <th style={{ width: '60px' }} className="center">Action</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.length === 0 ? (
                <tr>
                  <td colSpan="9" className="manual-table-empty">
                    No items on this manual invoice yet. Enter an item description, quantity, and selling price above and click <b>Add Item</b>.
                  </td>
                </tr>
              ) : (
                lineItems.map((item, index) => {
                  const gross = (item.quantity || 0) * (item.sellingPrice || 0);
                  const net = gross - (item.discountAmount || 0);
                  return (
                    <tr key={index}>
                      <td className="center">{index + 1}</td>
                      <td><b>{item.code}</b></td>
                      <td>{item.description}</td>
                      <td className="center">{item.unit || 'PCS'}</td>
                      <td className="right">{Number(item.quantity).toLocaleString()}</td>
                      <td className="right">{Number(item.sellingPrice).toFixed(2)}</td>
                      <td className="right">
                        {item.discountPercentage > 0
                          ? `${item.discountPercentage}%`
                          : '-'}
                      </td>
                      <td className="right bold">{net.toFixed(2)}</td>
                      <td className="center">
                        <button
                          type="button"
                          className="btn-remove-row"
                          onClick={() => handleRemoveItem(index)}
                          title="Remove item from manual invoice"
                        >
                          ✕ Remove
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Section: Action Buttons & Totals Card */}
        <div className="manual-bottom-panel">
          {/* Action Buttons Panel */}
          <div className="manual-action-bar">
            <div>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#003399', marginBottom: '8px' }}>
                Invoice Operations
              </div>
              <div className="manual-action-buttons-row">
                <button
                  type="button"
                  className="manual-btn"
                  onClick={handleNewInvoice}
                  disabled={isSubmitting}
                  title="Start a fresh new manual invoice (F2)"
                >
                  📄 New (F2)
                </button>

                <button
                  type="button"
                  className="manual-btn manual-btn-success"
                  onClick={() => handleSaveInvoice(false)}
                  disabled={isSubmitting || lineItems.length === 0}
                  title="Validate and save manual invoice"
                >
                  {isSubmitting ? '💾 Saving...' : '💾 Save Invoice'}
                </button>

                <button
                  type="button"
                  className="manual-btn manual-btn-primary"
                  onClick={handleBillPrint}
                  disabled={isSubmitting || lineItems.length === 0}
                  title="Save and print thermal bill receipt"
                >
                  🖨️ Bill Print
                </button>

                <button
                  type="button"
                  className="manual-btn manual-btn-danger"
                  onClick={handleDeleteInvoice}
                  disabled={isSubmitting || !activeInvoiceId}
                  title="Delete this saved manual invoice"
                >
                  🗑️ Delete
                </button>

                <button
                  type="button"
                  className="manual-btn"
                  onClick={() => navigate('/invoice')}
                  disabled={isSubmitting}
                  title="Cancel and close manual invoice form (Esc)"
                >
                  ✖️ Cancel
                </button>
              </div>
            </div>

            {/* Status bar */}
            <div className="manual-status-bar">
              <span>
                Status: <b>{activeInvoiceId ? 'Saved in Database' : 'Unsaved Draft'}</b>
              </span>
              <span>
                Lines: <b>{invoiceCalculations.totalItems}</b> | Total Qty: <b>{invoiceCalculations.totalQuantity}</b>
              </span>
              <span>
                Stock Status: <b style={{ color: '#006600' }}>Zero Stock Modification (Pure Manual)</b>
              </span>
            </div>
          </div>

          {/* Totals & Calculations Card */}
          <div className="manual-totals-card">
            <div className="manual-total-row">
              <span className="manual-total-label">Total Items / Lines:</span>
              <span className="manual-total-val">{invoiceCalculations.totalItems}</span>
            </div>

            <div className="manual-total-row">
              <span className="manual-total-label">Subtotal (Gross):</span>
              <span className="manual-total-val">
                Rs. {invoiceCalculations.subtotal.toFixed(2)}
              </span>
            </div>

            <div className="manual-total-row">
              <span className="manual-total-label">Total Discount:</span>
              <span className="manual-total-val" style={{ color: '#cc0000' }}>
                - Rs. {invoiceCalculations.totalDiscount.toFixed(2)}
              </span>
            </div>

            {/* Prominent Net Total Display */}
            <div className="manual-net-total-display">
              <span className="label">NET TOTAL:</span>
              <span className="amount">
                Rs. {invoiceCalculations.netTotal.toFixed(2)}
              </span>
            </div>

            {/* Amount Received Input */}
            <div className="manual-total-row highlight">
              <span className="manual-total-label">Amount Received:</span>
              <input
                type="number"
                step="0.01"
                min="0"
                style={{
                  width: '120px',
                  textAlign: 'right',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  height: '24px',
                }}
                className="manual-input"
                placeholder={invoiceCalculations.netTotal.toFixed(2)}
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
              />
            </div>

            {/* Balance Calculation */}
            <div className="manual-balance-row">
              <span className="manual-total-label">
                {invoiceCalculations.balance >= 0 ? 'Change / Balance:' : 'Due Balance:'}
              </span>
              <span
                className={`manual-balance-val ${
                  invoiceCalculations.balance >= 0 ? 'positive' : 'negative'
                }`}
              >
                Rs. {Math.abs(invoiceCalculations.balance).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Customer Lookup Modal */}
      {customerLookupOpen && (
        <div className="manual-modal-overlay">
          <div className="manual-modal-box">
            <div className="manual-modal-titlebar">
              <span>Select Customer from Master File</span>
              <button
                type="button"
                className="manual-win-control-btn close"
                onClick={() => setCustomerLookupOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="manual-modal-body">
              <input
                type="text"
                className="manual-input"
                placeholder="Search by customer name, code, or telephone..."
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                autoFocus
              />
              <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #7f9db9' }}>
                <table className="manual-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Telephone</th>
                      <th>Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="center">No customers found</td>
                      </tr>
                    ) : (
                      filteredCustomers.map((cust) => (
                        <tr
                          key={cust._id}
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleSelectCustomer(cust)}
                        >
                          <td><b>{cust.code || cust.customerCode}</b></td>
                          <td>{cust.name || cust.customerName}</td>
                          <td>{cust.telephone1 || cust.telephone || '-'}</td>
                          <td>{cust.address || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="manual-modal-footer">
              <button
                type="button"
                className="manual-btn"
                onClick={() => setCustomerLookupOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Existing Manual Invoices Lookup Modal */}
      {invoiceLookupOpen && (
        <div className="manual-modal-overlay">
          <div className="manual-modal-box">
            <div className="manual-modal-titlebar">
              <span>Find & Re-Open Manual Invoice</span>
              <button
                type="button"
                className="manual-win-control-btn close"
                onClick={() => setInvoiceLookupOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="manual-modal-body">
              <input
                type="text"
                className="manual-input"
                placeholder="Search by Manual Invoice No (MAN-XXXX) or Customer..."
                value={invoiceSearchQuery}
                onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                autoFocus
              />
              <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #7f9db9' }}>
                <table className="manual-table">
                  <thead>
                    <tr>
                      <th>Invoice No</th>
                      <th>Date</th>
                      <th>Customer</th>
                      <th className="right">Net Total</th>
                      <th className="center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="center">No manual invoices found</td>
                      </tr>
                    ) : (
                      filteredInvoices.map((inv) => (
                        <tr
                          key={inv._id}
                          style={{ cursor: 'pointer' }}
                          onClick={() => loadInvoiceData(inv)}
                        >
                          <td><b>{inv.invoiceNumber}</b></td>
                          <td>{inv.date ? String(inv.date).split('T')[0] : '-'}</td>
                          <td>{inv.customerName || 'Walk In Customer'}</td>
                          <td className="right bold">
                            Rs. {Number(inv.netTotal || inv.total || 0).toFixed(2)}
                          </td>
                          <td className="center">{inv.status || 'completed'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="manual-modal-footer">
              <button
                type="button"
                className="manual-btn"
                onClick={() => setInvoiceLookupOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Receipt Print Preview Modal */}
      {receiptPreviewOpen && (
        <div className="manual-modal-overlay">
          <div className="manual-modal-box" style={{ maxWidth: '400px' }}>
            <div className="manual-modal-titlebar">
              <span>Thermal Receipt Preview (80mm)</span>
              <button
                type="button"
                className="manual-win-control-btn close"
                onClick={() => setReceiptPreviewOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="manual-modal-body" style={{ background: '#777777', padding: '10px' }}>
              {renderThermalReceiptContent()}
            </div>
            <div className="manual-modal-footer">
              <button
                type="button"
                className="manual-btn manual-btn-primary"
                onClick={() => window.print()}
              >
                🖨️ Print Again
              </button>
              <button
                type="button"
                className="manual-btn"
                onClick={() => setReceiptPreviewOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Dedicated Print Element for Browser Print (@media print) */}
      <div id="manual-thermal-print-area">
        {renderThermalReceiptContent()}
      </div>
    </div>
  );
}

export default ManualInvoice;
