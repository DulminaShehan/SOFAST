import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './DamageClaim.css';

/**
 * SOFAST MOTORS - Damage Claim Form (Stock Control System)
 * Classic Windows Desktop ERP interface matching reference screenshot.
 * Handles both:
 *  - Exchange (Good Item): Returns to sellable stock, replacement item issued, price difference calculated.
 *  - Damage (Defective Item): Quarantined away from sellable stock, supplier traceability & GRN tracking.
 */
function DamageClaim() {
  const navigate = useNavigate();

  // Navigation Menubar state
  const [activeDropdown, setActiveDropdown] = useState(null);
  const menuRef = useRef(null);

  // Notification Banner
  const [notification, setNotification] = useState(null);

  // Bottom-right Damage Claim Info
  const [claimNumber, setClaimNumber] = useState('');
  const [claimDate, setClaimDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [existingClaimId, setExistingClaimId] = useState(null);

  // Invoice Details
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerTelephone, setCustomerTelephone] = useState('');
  const [customerCode, setCustomerCode] = useState('');
  const [invoiceRecord, setInvoiceRecord] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  // Invoice Items Table
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [selectedItemIndex, setSelectedItemIndex] = useState(-1);

  // Return Claim Details
  const [itemCode, setItemCode] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [originalQty, setOriginalQty] = useState(0);
  const [returnedQty, setReturnedQty] = useState(0);
  const [returnableQty, setReturnableQty] = useState(0);
  const [returnQty, setReturnQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [returnType, setReturnType] = useState('DAMAGE'); // 'EXCHANGE' | 'DAMAGE'
  const [damageReason, setDamageReason] = useState('Broken');
  const [notes, setNotes] = useState('');

  // Supplier Details (Shown for Damage)
  const [supplierName, setSupplierName] = useState('');
  const [supplierCode, setSupplierCode] = useState('');
  const [supplierTelephone, setSupplierTelephone] = useState('');
  const [supplierInvNo, setSupplierInvNo] = useState('');
  const [grnNo, setGrnNo] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchaseQty, setPurchaseQty] = useState('');
  const [claimStatus, setClaimStatus] = useState('Claim to Supplier');
  const [supplierNotes, setSupplierNotes] = useState('');
  const [purchaseHistory, setPurchaseHistory] = useState([]);

  // Exchange Item (Shown for Exchange)
  const [replacementItemCode, setReplacementItemCode] = useState('');
  const [replacementDescription, setReplacementDescription] = useState('');
  const [replacementQty, setReplacementQty] = useState(1);
  const [replacementUnitPrice, setReplacementUnitPrice] = useState(0);
  const [priceDifference, setPriceDifference] = useState(0);

  // Modals
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [loadingInvoicesList, setLoadingInvoicesList] = useState(false);

  const [showItemModal, setShowItemModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [allSuppliersList, setAllSuppliersList] = useState([]);

  const [showReplacementModal, setShowReplacementModal] = useState(false);
  const [itemMasterList, setItemMasterList] = useState([]);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [loadingItems, setLoadingItems] = useState(false);

  const [showPrintModal, setShowPrintModal] = useState(false);
  const [savedClaimData, setSavedClaimData] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Fetch initial next Damage Claim Number
  useEffect(() => {
    fetchNextClaimNumber();
  }, []);

  const fetchNextClaimNumber = async () => {
    try {
      const res = await api.get('/damage-claims/next-claim-number');
      if (res.data && res.data.success && res.data.data) {
        setClaimNumber(res.data.data.claimNumber);
      }
    } catch (err) {
      // Fallback formatting if endpoint unavailable
      const currentYear = new Date().getFullYear();
      setClaimNumber(`DC-${currentYear}-0001`);
    }
  };

  // Calculate price difference whenever exchange parameters change
  useEffect(() => {
    if (returnType === 'EXCHANGE') {
      const originalTotal = (Number(unitPrice) || 0) * (Number(returnQty) || 0);
      const replacementTotal = (Number(replacementUnitPrice) || 0) * (Number(replacementQty) || 0);
      const diff = Math.round((replacementTotal - originalTotal) * 100) / 100;
      setPriceDifference(diff);
    } else {
      setPriceDifference(0);
    }
  }, [returnType, unitPrice, returnQty, replacementUnitPrice, replacementQty]);

  // Search invoice by invoice number
  const handleSearchInvoice = async (targetInv) => {
    const invQuery = (targetInv || invoiceNo || '').trim();
    if (!invQuery) {
      setNotification({ type: 'error', message: 'Please enter an Invoice Number to search' });
      return;
    }

    setLoadingInvoice(true);
    setNotification(null);

    try {
      const res = await api.get(`/damage-claims/invoice/${encodeURIComponent(invQuery)}`);
      if (res.data && res.data.success && res.data.data) {
        const { invoice, lineItems } = res.data.data;
        setInvoiceRecord(invoice);
        setInvoiceNo(invoice.invoiceNumber);
        setInvoiceDate(invoice.date ? invoice.date.split('T')[0] : '');
        setCustomerName(invoice.customer?.name || 'Walk-in Customer');
        setCustomerTelephone(invoice.customer?.telephone || '');
        setCustomerCode(invoice.customer?.code || '');

        setInvoiceItems(lineItems || []);

        // Automatically select the first returnable item if available
        if (lineItems && lineItems.length > 0) {
          const firstEligibleIdx = lineItems.findIndex((li) => li.availableReturnQuantity > 0);
          const pickIdx = firstEligibleIdx >= 0 ? firstEligibleIdx : 0;
          selectInvoiceItem(lineItems[pickIdx], pickIdx);
        } else {
          resetItemSelection();
        }

        setNotification({
          type: 'success',
          message: `Invoice #${invoice.invoiceNumber} loaded with ${lineItems?.length || 0} items`,
        });
      } else {
        setNotification({ type: 'error', message: `Invoice '${invQuery}' not found` });
      }
    } catch (err) {
      console.error('Invoice search error:', err);
      const errMsg = err.response?.data?.message || `Invoice '${invQuery}' not found`;
      setNotification({ type: 'error', message: errMsg });
    } finally {
      setLoadingInvoice(false);
    }
  };

  // Select an item from the Invoice Items table
  const selectInvoiceItem = async (item, index) => {
    setSelectedItemIndex(index);
    if (!item) return;

    const code = item.itemCode || item.code || '';
    setItemCode(code);
    setItemDescription(item.description || '');
    setOriginalQty(Number(item.purchasedQuantity || item.quantity || 0));
    setReturnedQty(Number(item.previousReturnedQuantity || 0));
    const available = Number(item.availableReturnQuantity !== undefined ? item.availableReturnQuantity : (item.purchasedQuantity || 1));
    setReturnableQty(available);
    setReturnQty(available > 0 ? 1 : 0);
    setUnitPrice(Number(item.unitPrice || item.price || 0));

    // Reset replacement item defaults
    setReplacementItemCode('');
    setReplacementDescription('');
    setReplacementUnitPrice(0);
    setReplacementQty(1);

    // Fetch supplier traceability for this item
    if (code) {
      try {
        const traceRes = await api.get(`/damage-claims/traceability/${encodeURIComponent(code)}`);
        if (traceRes.data && traceRes.data.success && traceRes.data.data) {
          const trace = traceRes.data.data;
          setPurchaseHistory(trace.purchaseHistory || []);
          setAllSuppliersList(trace.allSuppliers || []);

          if (trace.suggestedSupplier) {
            const s = trace.suggestedSupplier;
            setSupplierName(s.supplierName || '');
            setSupplierCode(s.supplierCode || '');
            setSupplierTelephone(s.supplierTelephone || '');
            setSupplierInvNo(s.supplierInvoiceNo || '');
            setGrnNo(s.grnNumber || '');
            setPurchaseDate(s.purchaseDate ? s.purchaseDate.split('T')[0] : '');
            setPurchaseQty(s.purchasedQuantity || '');
          }
        }
      } catch (traceErr) {
        console.warn('Traceability lookup warning:', traceErr);
      }
    }
  };

  const resetItemSelection = () => {
    setSelectedItemIndex(-1);
    setItemCode('');
    setItemDescription('');
    setOriginalQty(0);
    setReturnedQty(0);
    setReturnableQty(0);
    setReturnQty(1);
    setUnitPrice(0);
    setSupplierName('');
    setSupplierCode('');
    setSupplierTelephone('');
    setSupplierInvNo('');
    setGrnNo('');
    setPurchaseDate('');
    setPurchaseQty('');
    setReplacementItemCode('');
    setReplacementDescription('');
    setReplacementUnitPrice(0);
  };

  // Clear / Reset Form for "New"
  const handleNew = () => {
    setExistingClaimId(null);
    setInvoiceNo('');
    setInvoiceDate('');
    setCustomerName('');
    setCustomerTelephone('');
    setCustomerCode('');
    setInvoiceRecord(null);
    setInvoiceItems([]);
    resetItemSelection();
    setReturnType('DAMAGE');
    setDamageReason('Broken');
    setNotes('');
    setSupplierNotes('');
    setClaimStatus('Claim to Supplier');
    setSavedClaimData(null);
    setNotification(null);
    fetchNextClaimNumber();
  };

  // Validate form prior to save or update
  const validateForm = () => {
    if (!invoiceNo.trim()) {
      setNotification({ type: 'error', message: 'Invoice Number is required' });
      return false;
    }
    if (!itemCode.trim()) {
      setNotification({ type: 'error', message: 'Please select an item from the invoice items table' });
      return false;
    }
    const rQty = Number(returnQty);
    if (isNaN(rQty) || rQty <= 0) {
      setNotification({ type: 'error', message: 'Return Quantity must be greater than 0' });
      return false;
    }
    if (rQty > returnableQty) {
      setNotification({
        type: 'error',
        message: `Return Quantity (${rQty}) cannot exceed Returnable Quantity (${returnableQty})`,
      });
      return false;
    }

    if (returnType === 'EXCHANGE') {
      if (!replacementItemCode.trim()) {
        setNotification({ type: 'error', message: 'Please select a Replacement Item for exchange' });
        return false;
      }
      const replQ = Number(replacementQty);
      if (isNaN(replQ) || replQ <= 0) {
        setNotification({ type: 'error', message: 'Replacement Quantity must be greater than 0' });
        return false;
      }
    }

    return true;
  };

  // Save new Damage Claim
  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    setNotification(null);

    const payload = {
      claimNumber: claimNumber.trim(),
      claimDate: claimDate,
      invoiceNumber: invoiceNo.trim(),
      itemCode: itemCode.trim(),
      returnedQuantity: Number(returnQty),
      returnType: returnType,
      workflowType: returnType === 'EXCHANGE' ? 'EXCHANGE' : 'DAMAGE_RETURN',
      itemCondition: returnType === 'EXCHANGE' ? 'GOOD' : 'DAMAGED',
      damageReason: returnType === 'EXCHANGE' ? 'Exchange — item is in good condition' : damageReason,
      notes: notes.trim(),
      damageNotes: notes.trim(),
      disposition: returnType === 'EXCHANGE' ? 'REPLACEMENT' : 'QUARANTINE',
      supplierDetails: {
        supplierName: supplierName.trim(),
        supplierCode: supplierCode.trim(),
        supplierTelephone: supplierTelephone.trim(),
        supplierInvoiceNo: supplierInvNo.trim(),
        grnNumber: grnNo.trim(),
        purchaseDate: purchaseDate || null,
        purchaseQuantity: Number(purchaseQty) || 0,
        claimStatus: claimStatus,
        supplierNotes: supplierNotes.trim(),
      },
      replacement:
        returnType === 'EXCHANGE'
          ? {
              itemCode: replacementItemCode.trim(),
              replacementItemCode: replacementItemCode.trim(),
              quantity: Number(replacementQty),
              unitPrice: Number(replacementUnitPrice),
              notes: notes.trim(),
            }
          : undefined,
    };

    try {
      const res = await api.post('/damage-claims', payload);
      if (res.data && res.data.success) {
        const result = res.data.data;
        const savedDoc = result.returnRecord || result;
        setExistingClaimId(savedDoc._id);
        setSavedClaimData(savedDoc);

        setNotification({
          type: 'success',
          message: `Damage Claim '${payload.claimNumber}' saved successfully!`,
        });

        // Refresh invoice to update returnable quantities
        handleSearchInvoice(invoiceNo);
      }
    } catch (err) {
      console.error('Save error:', err);
      const errMsg = err.response?.data?.message || 'Failed to save Damage Claim';
      setNotification({ type: 'error', message: errMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update existing Damage Claim
  const handleUpdate = async () => {
    const claimTarget = existingClaimId || claimNumber;
    if (!claimTarget) {
      setNotification({ type: 'error', message: 'No existing Damage Claim selected to update' });
      return;
    }

    setIsSubmitting(true);
    setNotification(null);

    const updatePayload = {
      claimStatus: claimStatus,
      damageReason: damageReason,
      notes: notes.trim(),
      supplierNotes: supplierNotes.trim(),
      supplierDetails: {
        supplierName: supplierName.trim(),
        supplierTelephone: supplierTelephone.trim(),
        supplierInvoiceNo: supplierInvNo.trim(),
        grnNumber: grnNo.trim(),
        purchaseDate: purchaseDate || null,
        purchaseQuantity: Number(purchaseQty) || 0,
        claimStatus: claimStatus,
        supplierNotes: supplierNotes.trim(),
      },
    };

    try {
      const res = await api.put(`/damage-claims/${encodeURIComponent(claimTarget)}`, updatePayload);
      if (res.data && res.data.success) {
        setNotification({
          type: 'success',
          message: `Damage Claim '${claimNumber}' updated successfully!`,
        });
      }
    } catch (err) {
      console.error('Update error:', err);
      const errMsg = err.response?.data?.message || 'Failed to update Damage Claim';
      setNotification({ type: 'error', message: errMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Invoice Search Modal
  const handleOpenInvoiceModal = async () => {
    setShowInvoiceModal(true);
    setLoadingInvoicesList(true);
    try {
      const res = await api.get('/invoices?limit=25');
      if (res.data && res.data.data) {
        setRecentInvoices(res.data.data);
      }
    } catch (e) {
      console.warn('Failed to load recent invoices:', e);
    } finally {
      setLoadingInvoicesList(false);
    }
  };

  // Open Replacement Item Master Modal
  const handleOpenReplacementModal = async () => {
    setShowReplacementModal(true);
    setLoadingItems(true);
    try {
      const res = await api.get('/items?limit=100');
      if (res.data && res.data.data) {
        setItemMasterList(res.data.data);
      }
    } catch (e) {
      console.warn('Failed to load items:', e);
    } finally {
      setLoadingItems(false);
    }
  };

  // Select replacement item
  const handleSelectReplacementItem = (item) => {
    setReplacementItemCode(item.code || '');
    setReplacementDescription(item.description || '');
    setReplacementUnitPrice(Number(item.finalSellingPrice || item.sellingPrice || 0));
    setShowReplacementModal(false);
  };

  // Print voucher
  const handlePrint = () => {
    setShowPrintModal(true);
  };

  return (
    <div className="dc-desktop-viewport">
      {/* Top System Menubar */}
      <header className="dc-system-menubar" ref={menuRef}>
        <div className="dc-menu-left">
          {/* Master Files */}
          <div className="dc-menu-item-wrapper">
            <button
              type="button"
              className={`dc-menu-item-btn ${activeDropdown === 'master' ? 'active' : ''}`}
              onClick={() => setActiveDropdown(activeDropdown === 'master' ? null : 'master')}
            >
              Master Files
            </button>
            {activeDropdown === 'master' && (
              <div className="dc-dropdown-panel">
                <button type="button" className="dc-dropdown-action" onClick={() => navigate('/item-master')}>
                  Item Master
                </button>
                <button type="button" className="dc-dropdown-action" onClick={() => navigate('/supplier-master')}>
                  Supplier Master
                </button>
                <button type="button" className="dc-dropdown-action" onClick={() => navigate('/customer-master')}>
                  Customer Details
                </button>
                <button type="button" className="dc-dropdown-action" onClick={() => navigate('/alternative-product')}>
                  Alternative Product
                </button>
              </div>
            )}
          </div>

          {/* Stock Control System */}
          <div className="dc-menu-item-wrapper">
            <button
              type="button"
              className={`dc-menu-item-btn ${activeDropdown === 'stock' ? 'active' : ''}`}
              onClick={() => setActiveDropdown(activeDropdown === 'stock' ? null : 'stock')}
            >
              Stock Control System
            </button>
            {activeDropdown === 'stock' && (
              <div className="dc-dropdown-panel">
                <button type="button" className="dc-dropdown-action" onClick={() => navigate('/grn')}>
                  Good Receive Note (GRN)
                </button>
                <button type="button" className="dc-dropdown-action" onClick={() => navigate('/damage-claim')}>
                  Damage Claim
                </button>
              </div>
            )}
          </div>

          {/* Sales and Service */}
          <div className="dc-menu-item-wrapper">
            <button
              type="button"
              className={`dc-menu-item-btn ${activeDropdown === 'sales' ? 'active' : ''}`}
              onClick={() => setActiveDropdown(activeDropdown === 'sales' ? null : 'sales')}
            >
              Sales and Service
            </button>
            {activeDropdown === 'sales' && (
              <div className="dc-dropdown-panel">
                <button type="button" className="dc-dropdown-action" onClick={() => navigate('/invoice')}>
                  Create Invoice
                </button>
                <button type="button" className="dc-dropdown-action" onClick={() => navigate('/settlement-invoice')}>
                  Settlement Invoice
                </button>
                <button type="button" className="dc-dropdown-action" onClick={() => navigate('/remaining-balance')}>
                  Remaining Balance
                </button>
              </div>
            )}
          </div>

          {/* Reports */}
          <div className="dc-menu-item-wrapper">
            <button
              type="button"
              className={`dc-menu-item-btn ${activeDropdown === 'reports' ? 'active' : ''}`}
              onClick={() => setActiveDropdown(activeDropdown === 'reports' ? null : 'reports')}
            >
              Reports
            </button>
            {activeDropdown === 'reports' && (
              <div className="dc-dropdown-panel">
                <button type="button" className="dc-dropdown-action" onClick={() => navigate('/reports')}>
                  Sales & Stock Reports
                </button>
              </div>
            )}
          </div>

          {/* Administration */}
          <div className="dc-menu-item-wrapper">
            <button
              type="button"
              className={`dc-menu-item-btn ${activeDropdown === 'admin' ? 'active' : ''}`}
              onClick={() => setActiveDropdown(activeDropdown === 'admin' ? null : 'admin')}
            >
              Administration
            </button>
            {activeDropdown === 'admin' && (
              <div className="dc-dropdown-panel">
                <button type="button" className="dc-dropdown-action" onClick={() => navigate('/printer-setup')}>
                  Printer Setup
                </button>
              </div>
            )}
          </div>

          <button type="button" className="dc-menu-item-btn" onClick={() => navigate('/management')}>
            Exit
          </button>
        </div>

        <div className="dc-menu-right">
          <span>SOFAST POS v3.4.1</span>
          <span className="dc-system-status-pill">Connected</span>
        </div>
      </header>

      {/* Main Window */}
      <main className="dc-window-container">
        {/* Title Bar matching reference image */}
        <div className="dc-window-titlebar">
          <div className="dc-titlebar-left">
            <svg className="dc-folder-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z" />
            </svg>
            <span className="dc-window-title">Damage Claim - Stock Control System</span>
          </div>
          <div className="dc-titlebar-controls">
            <button type="button" className="dc-window-btn" title="Minimize">
              &#8211;
            </button>
            <button type="button" className="dc-window-btn" title="Maximize">
              &#9633;
            </button>
            <button type="button" className="dc-window-btn close" title="Close" onClick={() => navigate('/management')}>
              &#10005;
            </button>
          </div>
        </div>

        {/* Window Body */}
        <div className="dc-window-body">
          {/* Notification */}
          {notification && (
            <div className={`dc-alert ${notification.type}`}>
              <span>{notification.message}</span>
              <button type="button" className="dc-alert-close" onClick={() => setNotification(null)}>
                &times;
              </button>
            </div>
          )}

          {/* SECTION 1: Invoice Details */}
          <section className="dc-section-card">
            <div className="dc-section-header">Invoice Details</div>
            <div className="dc-section-body">
              <div className="dc-invoice-details-grid">
                {/* Invoice No */}
                <div className="dc-field-row">
                  <span className="dc-label-dots">Invoice No . . . . . . .</span>
                  <input
                    type="text"
                    className="dc-input"
                    style={{ width: '180px' }}
                    value={invoiceNo}
                    placeholder="e.g. INV-2025-00125"
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSearchInvoice(invoiceNo);
                    }}
                  />
                  <button
                    type="button"
                    className="dc-btn-dots"
                    title="Lookup Invoices"
                    onClick={handleOpenInvoiceModal}
                  >
                    &#128269;
                  </button>
                  <button
                    type="button"
                    className="dc-btn-compact"
                    onClick={() => handleSearchInvoice(invoiceNo)}
                    disabled={loadingInvoice}
                  >
                    {loadingInvoice ? 'Searching...' : 'Search'}
                  </button>
                </div>

                {/* Invoice Date */}
                <div className="dc-field-row">
                  <span className="dc-label-dots">Invoice Date . . . . . .</span>
                  <input
                    type="text"
                    className="dc-input readonly"
                    style={{ width: '150px' }}
                    value={invoiceDate}
                    readOnly
                    placeholder="YYYY-MM-DD"
                  />
                </div>

                {/* Customer */}
                <div className="dc-field-row">
                  <span className="dc-label-dots">Customer . . . . . . . .</span>
                  <input
                    type="text"
                    className="dc-input readonly"
                    style={{ flex: 1 }}
                    value={customerName}
                    readOnly
                    placeholder="Customer Name"
                  />
                </div>

                {/* Telephone */}
                <div className="dc-field-row">
                  <span className="dc-label-dots">Telephone . . . . . . .</span>
                  <input
                    type="text"
                    className="dc-input readonly"
                    style={{ width: '180px' }}
                    value={customerTelephone}
                    readOnly
                    placeholder="Telephone Number"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: Invoice Items Table */}
          <section className="dc-section-card">
            <div className="dc-section-header">Invoice Items</div>
            <div className="dc-section-body" style={{ padding: '6px' }}>
              <div className="dc-table-container">
                <table className="dc-table">
                  <thead>
                    <tr>
                      <th style={{ width: '45px', textAlign: 'center' }}>No</th>
                      <th style={{ width: '130px' }}>Item Code</th>
                      <th>Description</th>
                      <th style={{ width: '110px', textAlign: 'right' }}>Original Qty</th>
                      <th style={{ width: '110px', textAlign: 'right' }}>Returned Qty</th>
                      <th style={{ width: '110px', textAlign: 'right' }}>Returnable Qty</th>
                      <th style={{ width: '130px', textAlign: 'right' }}>Unit Price (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceItems.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '16px', color: '#64748b' }}>
                          No invoice items loaded. Please search for an invoice above.
                        </td>
                      </tr>
                    ) : (
                      invoiceItems.map((item, idx) => {
                        const isSelected = selectedItemIndex === idx;
                        return (
                          <tr
                            key={idx}
                            className={isSelected ? 'selected' : ''}
                            onClick={() => selectInvoiceItem(item, idx)}
                          >
                            <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                            <td>{item.itemCode || item.code}</td>
                            <td>{item.description}</td>
                            <td style={{ textAlign: 'right' }}>{item.purchasedQuantity || item.quantity || 0}</td>
                            <td style={{ textAlign: 'right' }}>{item.previousReturnedQuantity || 0}</td>
                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                              {item.availableReturnQuantity !== undefined ? item.availableReturnQuantity : (item.purchasedQuantity || 0)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {(Number(item.unitPrice || item.price || 0)).toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* MIDDLE GRID: Return Claim Details & Supplier Details & Exchange Item */}
          <div className="dc-middle-grid">
            {/* LEFT COLUMN: Return Claim Details & Exchange Item */}
            <div className="dc-left-column">
              {/* SECTION 3: Return Claim Details */}
              <section className="dc-section-card">
                <div className="dc-section-header">Return Claim Details</div>
                <div className="dc-section-body">
                  {/* Row 1: Item Code & Description */}
                  <div className="dc-form-row">
                    <span className="dc-label-dots">Item Code . . . . . . .</span>
                    <input
                      type="text"
                      className="dc-input readonly"
                      style={{ width: '100px' }}
                      value={itemCode}
                      readOnly
                    />
                    <button
                      type="button"
                      className="dc-btn-dots"
                      title="Select Item from Invoice"
                      onClick={() => setShowItemModal(true)}
                    >
                      ...
                    </button>
                    <span className="dc-label-dots" style={{ marginLeft: '6px' }}>Description . . . . . .</span>
                    <input
                      type="text"
                      className="dc-input readonly"
                      style={{ flex: 1 }}
                      value={itemDescription}
                      readOnly
                    />
                  </div>

                  {/* Row 2: Original Qty, Returned Qty, Returnable Qty */}
                  <div className="dc-form-row">
                    <span className="dc-label-dots">Original Qty . . . . . .</span>
                    <input
                      type="text"
                      className="dc-input readonly"
                      style={{ width: '65px', textAlign: 'center' }}
                      value={originalQty}
                      readOnly
                    />
                    <span className="dc-label-dots" style={{ marginLeft: '12px' }}>Returned Qty . . . . .</span>
                    <input
                      type="text"
                      className="dc-input readonly"
                      style={{ width: '65px', textAlign: 'center' }}
                      value={returnedQty}
                      readOnly
                    />
                    <span className="dc-label-dots" style={{ marginLeft: '12px' }}>Returnable Qty . . .</span>
                    <input
                      type="text"
                      className="dc-input readonly"
                      style={{ width: '65px', textAlign: 'center', fontWeight: 'bold' }}
                      value={returnableQty}
                      readOnly
                    />
                  </div>

                  {/* Row 3: Return Qty & Unit Price */}
                  <div className="dc-form-row">
                    <span className="dc-label-dots">Return Qty . . . . . . .</span>
                    <input
                      type="number"
                      className="dc-input"
                      style={{ width: '70px', textAlign: 'center' }}
                      min="1"
                      max={returnableQty > 0 ? returnableQty : 1}
                      value={returnQty}
                      onChange={(e) => setReturnQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    />
                    <span className="dc-label-dots" style={{ marginLeft: '16px' }}>Unit Price (Rs.) . . . .</span>
                    <input
                      type="text"
                      className="dc-input readonly"
                      style={{ width: '130px', textAlign: 'right' }}
                      value={(Number(unitPrice) || 0).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      readOnly
                    />
                  </div>

                  {/* Row 4: Return Type Radio */}
                  <div className="dc-form-row">
                    <span className="dc-label-dots">Return Type . . . . . .</span>
                    <div className="dc-radio-group">
                      <label className="dc-radio-label">
                        <input
                          type="radio"
                          name="returnType"
                          value="EXCHANGE"
                          checked={returnType === 'EXCHANGE'}
                          onChange={() => setReturnType('EXCHANGE')}
                        />
                        Exchange (Good Item)
                      </label>
                      <label className="dc-radio-label">
                        <input
                          type="radio"
                          name="returnType"
                          value="DAMAGE"
                          checked={returnType === 'DAMAGE'}
                          onChange={() => setReturnType('DAMAGE')}
                        />
                        Damage (Defective Item)
                      </label>
                    </div>
                  </div>

                  {/* Row 5: Damage Reason */}
                  <div className="dc-form-row">
                    <span className="dc-label-dots">Damage Reason . . . .</span>
                    <select
                      className="dc-select"
                      style={{ flex: 1 }}
                      value={damageReason}
                      onChange={(e) => setDamageReason(e.target.value)}
                    >
                      <option value="Broken">Broken</option>
                      <option value="Defective">Defective</option>
                      <option value="Transport Damage">Transport Damage</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Row 6: Notes */}
                  <div className="dc-form-row" style={{ alignItems: 'flex-start' }}>
                    <span className="dc-label-dots" style={{ paddingTop: '4px' }}>Notes . . . . . . . . . .</span>
                    <textarea
                      className="dc-textarea"
                      rows="2"
                      style={{ flex: 1 }}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Enter customer return details..."
                    />
                  </div>
                </div>
              </section>

              {/* SECTION 5: Exchange Item (Shown for Exchange) */}
              <section className={`dc-section-card ${returnType !== 'EXCHANGE' ? 'inactive' : ''}`}>
                <div className="dc-section-header">Exchange Item (Shown for Exchange)</div>
                <div className="dc-section-body">
                  {/* Row 1: Replacement Item & Description */}
                  <div className="dc-form-row">
                    <span className="dc-label-dots">Replacement Item . .</span>
                    <input
                      type="text"
                      className="dc-input readonly"
                      style={{ width: '110px' }}
                      value={replacementItemCode}
                      disabled={returnType !== 'EXCHANGE'}
                      readOnly
                      placeholder="Item Code"
                    />
                    <button
                      type="button"
                      className="dc-btn-dots"
                      title="Select Replacement Item"
                      disabled={returnType !== 'EXCHANGE'}
                      onClick={handleOpenReplacementModal}
                    >
                      ...
                    </button>
                    <span className="dc-label-dots" style={{ marginLeft: '6px' }}>Description . . . . . .</span>
                    <input
                      type="text"
                      className="dc-input readonly"
                      style={{ flex: 1 }}
                      value={replacementDescription}
                      disabled={returnType !== 'EXCHANGE'}
                      readOnly
                      placeholder="Replacement Description"
                    />
                  </div>

                  {/* Row 2: Qty, Unit Price, Price Difference */}
                  <div className="dc-form-row">
                    <span className="dc-label-dots">Qty . . . . . . . . . . .</span>
                    <input
                      type="number"
                      className="dc-input"
                      style={{ width: '65px', textAlign: 'center' }}
                      min="1"
                      disabled={returnType !== 'EXCHANGE'}
                      value={replacementQty}
                      onChange={(e) => setReplacementQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    />
                    <span className="dc-label-dots" style={{ marginLeft: '8px' }}>Unit Price (Rs.) . . .</span>
                    <input
                      type="text"
                      className="dc-input readonly"
                      style={{ width: '100px', textAlign: 'right' }}
                      disabled={returnType !== 'EXCHANGE'}
                      value={(Number(replacementUnitPrice) || 0).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      readOnly
                    />
                    <span className="dc-label-dots" style={{ marginLeft: '8px' }}>Price Difference</span>
                    <input
                      type="text"
                      className="dc-input readonly"
                      style={{
                        width: '105px',
                        textAlign: 'right',
                        fontWeight: 'bold',
                        color: priceDifference > 0 ? '#b91c1c' : priceDifference < 0 ? '#15803d' : '#1e293b',
                      }}
                      disabled={returnType !== 'EXCHANGE'}
                      value={
                        priceDifference !== 0
                          ? `${priceDifference > 0 ? '+' : ''}${priceDifference.toFixed(2)}`
                          : '0.00'
                      }
                      readOnly
                    />
                  </div>
                </div>
              </section>
            </div>

            {/* RIGHT COLUMN: Supplier Details (Shown for Damage) */}
            <div className="dc-right-column">
              <section className={`dc-section-card ${returnType !== 'DAMAGE' ? 'inactive' : ''}`}>
                <div className="dc-section-header">Supplier Details (Shown for Damage)</div>
                <div className="dc-section-body">
                  {/* Supplier */}
                  <div className="dc-form-row">
                    <span className="dc-label-dots">Supplier . . . . . . . .</span>
                    <input
                      type="text"
                      className="dc-input readonly"
                      style={{ flex: 1 }}
                      value={supplierName}
                      disabled={returnType !== 'DAMAGE'}
                      readOnly
                      placeholder="Supplier Name"
                    />
                    <button
                      type="button"
                      className="dc-btn-dots"
                      title="Select Supplier / View Purchase History"
                      disabled={returnType !== 'DAMAGE'}
                      onClick={() => setShowSupplierModal(true)}
                    >
                      ...
                    </button>
                  </div>

                  {/* Telephone */}
                  <div className="dc-form-row">
                    <span className="dc-label-dots">Telephone . . . . . . .</span>
                    <input
                      type="text"
                      className="dc-input readonly"
                      style={{ flex: 1 }}
                      value={supplierTelephone}
                      disabled={returnType !== 'DAMAGE'}
                      readOnly
                      placeholder="Supplier Telephone"
                    />
                  </div>

                  {/* Supplier Inv. No */}
                  <div className="dc-form-row">
                    <span className="dc-label-dots">Supplier Inv. No . . .</span>
                    <input
                      type="text"
                      className="dc-input"
                      style={{ flex: 1 }}
                      value={supplierInvNo}
                      disabled={returnType !== 'DAMAGE'}
                      onChange={(e) => setSupplierInvNo(e.target.value)}
                      placeholder="Supplier Invoice No"
                    />
                  </div>

                  {/* GRN No */}
                  <div className="dc-form-row">
                    <span className="dc-label-dots">GRN No . . . . . . . .</span>
                    <input
                      type="text"
                      className="dc-input"
                      style={{ flex: 1 }}
                      value={grnNo}
                      disabled={returnType !== 'DAMAGE'}
                      onChange={(e) => setGrnNo(e.target.value)}
                      placeholder="GRN-YYYY-XXXX"
                    />
                  </div>

                  {/* Purchase Date */}
                  <div className="dc-form-row">
                    <span className="dc-label-dots">Purchase Date . . . .</span>
                    <input
                      type="date"
                      className="dc-input"
                      style={{ width: '150px' }}
                      value={purchaseDate}
                      disabled={returnType !== 'DAMAGE'}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                    />
                  </div>

                  {/* Purchase Qty */}
                  <div className="dc-form-row">
                    <span className="dc-label-dots">Purchase Qty . . . . .</span>
                    <input
                      type="text"
                      className="dc-input readonly"
                      style={{ width: '110px' }}
                      value={purchaseQty}
                      disabled={returnType !== 'DAMAGE'}
                      readOnly
                      placeholder="Quantity"
                    />
                  </div>

                  {/* Claim Status */}
                  <div className="dc-form-row">
                    <span className="dc-label-dots">Claim Status . . . . .</span>
                    <select
                      className="dc-select"
                      style={{ flex: 1 }}
                      value={claimStatus}
                      disabled={returnType !== 'DAMAGE'}
                      onChange={(e) => setClaimStatus(e.target.value)}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Claim to Supplier">Claim to Supplier</option>
                      <option value="Replacement Approved">Replacement Approved</option>
                      <option value="Replaced">Replaced</option>
                      <option value="Rejected">Rejected</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </div>

                  {/* Supplier Notes */}
                  <div className="dc-form-row" style={{ alignItems: 'flex-start' }}>
                    <span className="dc-label-dots" style={{ paddingTop: '4px' }}>Supplier Notes . . . .</span>
                    <textarea
                      className="dc-textarea"
                      rows="3"
                      style={{ flex: 1 }}
                      value={supplierNotes}
                      disabled={returnType !== 'DAMAGE'}
                      onChange={(e) => setSupplierNotes(e.target.value)}
                      placeholder="Notes regarding supplier claim or replacement..."
                    />
                  </div>
                </div>
              </section>
            </div>
          </div>

          {/* SECTION 7 & BOTTOM BAR: Buttons & Damage Claim Info */}
          <div className="dc-bottom-bar">
            {/* Buttons on left */}
            <div className="dc-action-buttons">
              <button type="button" className="dc-action-btn" onClick={handleNew}>
                <span style={{ fontSize: '14px' }}>&#128196;</span> New
              </button>
              <button
                type="button"
                className="dc-action-btn"
                onClick={handleSave}
                disabled={isSubmitting}
              >
                <span style={{ fontSize: '14px', color: '#2563eb' }}>&#128190;</span>
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                className="dc-action-btn"
                onClick={handleUpdate}
                disabled={isSubmitting || !existingClaimId}
              >
                <span style={{ fontSize: '14px', color: '#f59e0b' }}>&#9998;</span> Update
              </button>
              <button type="button" className="dc-action-btn" onClick={handlePrint}>
                <span style={{ fontSize: '14px' }}>&#128438;</span> Print
              </button>
              <button type="button" className="dc-action-btn" onClick={handleNew}>
                <span style={{ fontSize: '14px', color: '#ef4444' }}>&#10006;</span> Cancel
              </button>
            </div>

            {/* Damage Claim Info on right */}
            <div className="dc-claim-info-card">
              <div className="dc-claim-info-row">
                <span className="dc-label-dots">Damage Claim No . . . . .</span>
                <input
                  type="text"
                  className="dc-input readonly"
                  style={{ width: '130px', fontWeight: 'bold' }}
                  value={claimNumber}
                  readOnly
                />
              </div>
              <div className="dc-claim-info-row">
                <span className="dc-label-dots">Claim Date . . . . . . . .</span>
                <input
                  type="date"
                  className="dc-input"
                  style={{ width: '130px' }}
                  value={claimDate}
                  onChange={(e) => setClaimDate(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ========================================================================
          MODAL: Invoice Lookup Modal
         ======================================================================== */}
      {showInvoiceModal && (
        <div className="dc-modal-overlay">
          <div className="dc-modal-window" style={{ maxWidth: '720px' }}>
            <div className="dc-modal-header">
              <span>Search Sales Invoices</span>
              <button type="button" className="dc-modal-close-btn" onClick={() => setShowInvoiceModal(false)}>
                &times;
              </button>
            </div>
            <div className="dc-modal-content">
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input
                  type="text"
                  className="dc-input"
                  style={{ flex: 1 }}
                  placeholder="Filter by invoice no, customer name..."
                  value={invoiceSearchQuery}
                  onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                />
              </div>
              <div className="dc-table-container" style={{ maxHeight: '350px' }}>
                <table className="dc-table">
                  <thead>
                    <tr>
                      <th>Invoice No</th>
                      <th>Date</th>
                      <th>Customer</th>
                      <th style={{ textAlign: 'right' }}>Total (Rs.)</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentInvoices
                      .filter((inv) => {
                        if (!invoiceSearchQuery) return true;
                        const q = invoiceSearchQuery.toLowerCase();
                        return (
                          String(inv.invoiceNumber || inv.no).toLowerCase().includes(q) ||
                          String(inv.customerName || inv.cusname || '').toLowerCase().includes(q)
                        );
                      })
                      .map((inv, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600 }}>{inv.invoiceNumber || inv.no}</td>
                          <td>{inv.date ? inv.date.split('T')[0] : ''}</td>
                          <td>{inv.customerName || inv.cusname || 'Walk-in Customer'}</td>
                          <td style={{ textAlign: 'right' }}>
                            {Number(inv.netTotal || inv.amountToPay || inv.subTotal || 0).toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="dc-btn-compact"
                              onClick={() => {
                                setShowInvoiceModal(false);
                                handleSearchInvoice(inv.invoiceNumber || String(inv.no));
                              }}
                            >
                              Select
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="dc-modal-footer">
              <button type="button" className="dc-btn-compact" onClick={() => setShowInvoiceModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL: Item Selection Modal from Invoice
         ======================================================================== */}
      {showItemModal && (
        <div className="dc-modal-overlay">
          <div className="dc-modal-window">
            <div className="dc-modal-header">
              <span>Select Item from Invoice #{invoiceNo}</span>
              <button type="button" className="dc-modal-close-btn" onClick={() => setShowItemModal(false)}>
                &times;
              </button>
            </div>
            <div className="dc-modal-content">
              <div className="dc-table-container">
                <table className="dc-table">
                  <thead>
                    <tr>
                      <th>Item Code</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Purchased</th>
                      <th style={{ textAlign: 'right' }}>Returnable</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceItems.map((li, idx) => (
                      <tr key={idx}>
                        <td>{li.itemCode || li.code}</td>
                        <td>{li.description}</td>
                        <td style={{ textAlign: 'right' }}>{li.purchasedQuantity || li.quantity}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          {li.availableReturnQuantity !== undefined ? li.availableReturnQuantity : (li.purchasedQuantity || 0)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="dc-btn-compact"
                            onClick={() => {
                              selectInvoiceItem(li, idx);
                              setShowItemModal(false);
                            }}
                          >
                            Select
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="dc-modal-footer">
              <button type="button" className="dc-btn-compact" onClick={() => setShowItemModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL: Supplier & Purchase History Modal
         ======================================================================== */}
      {showSupplierModal && (
        <div className="dc-modal-overlay">
          <div className="dc-modal-window" style={{ maxWidth: '750px' }}>
            <div className="dc-modal-header">
              <span>Supplier & Purchase History for Item {itemCode}</span>
              <button type="button" className="dc-modal-close-btn" onClick={() => setShowSupplierModal(false)}>
                &times;
              </button>
            </div>
            <div className="dc-modal-content">
              <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>
                Historical GRN / Purchase Records:
              </p>
              {purchaseHistory.length === 0 ? (
                <div style={{ padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', marginBottom: '12px' }}>
                  No historical GRNs recorded for this item. You can select a supplier from Supplier Master below.
                </div>
              ) : (
                <div className="dc-table-container" style={{ marginBottom: '14px', maxHeight: '180px' }}>
                  <table className="dc-table">
                    <thead>
                      <tr>
                        <th>GRN No</th>
                        <th>Date</th>
                        <th>Supplier</th>
                        <th>Telephone</th>
                        <th>Inv #</th>
                        <th style={{ textAlign: 'right' }}>Qty</th>
                        <th style={{ textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchaseHistory.map((ph, idx) => (
                        <tr key={idx}>
                          <td>{ph.grnNumber}</td>
                          <td>{ph.date ? ph.date.split('T')[0] : ''}</td>
                          <td>{ph.supplierName}</td>
                          <td>{ph.supplierTelephone}</td>
                          <td>{ph.supplierInvoiceNo}</td>
                          <td style={{ textAlign: 'right' }}>{ph.purchasedQuantity}</td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="dc-btn-compact"
                              onClick={() => {
                                setSupplierName(ph.supplierName || '');
                                setSupplierCode(ph.supplierCode || '');
                                setSupplierTelephone(ph.supplierTelephone || '');
                                setSupplierInvNo(ph.supplierInvoiceNo || '');
                                setGrnNo(ph.grnNumber || '');
                                setPurchaseDate(ph.date ? ph.date.split('T')[0] : '');
                                setPurchaseQty(ph.purchasedQuantity || '');
                                setShowSupplierModal(false);
                              }}
                            >
                              Choose
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p style={{ margin: '8px 0', fontWeight: 600 }}>Or Select from All Registered Suppliers:</p>
              <div className="dc-table-container" style={{ maxHeight: '180px' }}>
                <table className="dc-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Supplier Name</th>
                      <th>Telephone</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allSuppliersList.map((sup, idx) => (
                      <tr key={idx}>
                        <td>{sup.code}</td>
                        <td>{sup.name}</td>
                        <td>{sup.telephone || sup.telephone1 || ''}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="dc-btn-compact"
                            onClick={() => {
                              setSupplierName(sup.name || '');
                              setSupplierCode(sup.code || '');
                              setSupplierTelephone(sup.telephone || sup.telephone1 || '');
                              setShowSupplierModal(false);
                            }}
                          >
                            Select
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="dc-modal-footer">
              <button type="button" className="dc-btn-compact" onClick={() => setShowSupplierModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL: Replacement Item Master Selection Modal
         ======================================================================== */}
      {showReplacementModal && (
        <div className="dc-modal-overlay">
          <div className="dc-modal-window" style={{ maxWidth: '750px' }}>
            <div className="dc-modal-header">
              <span>Select Replacement Item from Item Master</span>
              <button type="button" className="dc-modal-close-btn" onClick={() => setShowReplacementModal(false)}>
                &times;
              </button>
            </div>
            <div className="dc-modal-content">
              <div style={{ marginBottom: '10px' }}>
                <input
                  type="text"
                  className="dc-input"
                  style={{ width: '100%' }}
                  placeholder="Search item code or description..."
                  value={itemSearchQuery}
                  onChange={(e) => setItemSearchQuery(e.target.value)}
                />
              </div>
              <div className="dc-table-container" style={{ maxHeight: '350px' }}>
                <table className="dc-table">
                  <thead>
                    <tr>
                      <th>Item Code</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Stock in Hand</th>
                      <th style={{ textAlign: 'right' }}>Selling Price (Rs.)</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemMasterList
                      .filter((it) => {
                        if (!itemSearchQuery) return true;
                        const q = itemSearchQuery.toLowerCase();
                        return (
                          String(it.code).toLowerCase().includes(q) ||
                          String(it.description).toLowerCase().includes(q)
                        );
                      })
                      .map((it, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600 }}>{it.code}</td>
                          <td>{it.description}</td>
                          <td style={{ textAlign: 'right' }}>
                            {Number(it.quantity || it.stockInHand || 0)}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {(Number(it.finalSellingPrice || it.sellingPrice || 0)).toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="dc-btn-compact"
                              onClick={() => handleSelectReplacementItem(it)}
                            >
                              Select
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="dc-modal-footer">
              <button type="button" className="dc-btn-compact" onClick={() => setShowReplacementModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL: Print Voucher / Document
         ======================================================================== */}
      {showPrintModal && (
        <div className="dc-modal-overlay">
          <div className="dc-modal-window" style={{ maxWidth: '600px' }}>
            <div className="dc-modal-header">
              <span>Damage Claim Voucher - {claimNumber}</span>
              <button type="button" className="dc-modal-close-btn" onClick={() => setShowPrintModal(false)}>
                &times;
              </button>
            </div>
            <div className="dc-modal-content">
              <div
                className="dc-print-sheet"
                style={{
                  fontFamily: 'monospace',
                  padding: '16px',
                  border: '1px dashed #94a3b8',
                  background: '#ffffff',
                }}
              >
                <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '8px', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0 }}>SOFAST MOTORS</h3>
                  <div style={{ fontSize: '11px' }}>Damage Claim & Return Voucher</div>
                  <div style={{ fontSize: '11px', marginTop: '4px' }}>Claim No: {claimNumber}</div>
                  <div style={{ fontSize: '11px' }}>Date: {claimDate}</div>
                </div>

                <div style={{ fontSize: '12px', lineHeight: 1.6 }}>
                  <div><strong>Invoice No:</strong> {invoiceNo}</div>
                  <div><strong>Customer:</strong> {customerName} ({customerTelephone})</div>
                  <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
                  <div><strong>Item:</strong> {itemCode} - {itemDescription}</div>
                  <div><strong>Return Qty:</strong> {returnQty} @ Rs. {Number(unitPrice).toFixed(2)}</div>
                  <div><strong>Return Type:</strong> {returnType === 'EXCHANGE' ? 'Exchange (Good Item)' : 'Damage (Defective Item)'}</div>
                  <div><strong>Reason:</strong> {damageReason}</div>

                  {returnType === 'DAMAGE' && (
                    <>
                      <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
                      <div><strong>Supplier:</strong> {supplierName || 'N/A'}</div>
                      <div><strong>GRN No:</strong> {grnNo || 'N/A'} | <strong>Supplier Inv:</strong> {supplierInvNo || 'N/A'}</div>
                      <div><strong>Claim Status:</strong> {claimStatus}</div>
                    </>
                  )}

                  {returnType === 'EXCHANGE' && (
                    <>
                      <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
                      <div><strong>Replacement Item:</strong> {replacementItemCode} - {replacementDescription}</div>
                      <div><strong>Replacement Qty:</strong> {replacementQty} @ Rs. {Number(replacementUnitPrice).toFixed(2)}</div>
                      <div><strong>Price Difference:</strong> Rs. {priceDifference.toFixed(2)}</div>
                    </>
                  )}

                  {notes && (
                    <>
                      <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
                      <div><strong>Notes:</strong> {notes}</div>
                    </>
                  )}

                  <div style={{ borderTop: '1px dashed #000', marginTop: '16px', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                    <div>Customer Signature: ____________</div>
                    <div>Authorized Signature: ____________</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="dc-modal-footer">
              <button
                type="button"
                className="dc-btn-compact"
                onClick={() => window.print()}
              >
                &#128438; Print Voucher
              </button>
              <button
                type="button"
                className="dc-btn-compact"
                onClick={() => setShowPrintModal(false)}
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

export default DamageClaim;
