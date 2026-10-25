import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './CustomerDamageReturn.css';

/**
 * SOFAST MOTORS - Customer Return, Exchange & Damage Tracking
 * Classic SOFAST Windows/ERP POS Desktop Interface.
 * 
 * Supports:
 * - Workflow A: Good item returned for exchange (accepted into normal sellable stock, replacement item value difference calculated)
 * - Workflow B: Damaged/defective item returned (segregated into damaged stock quarantine, supplier traceability, inspection & claims)
 * - Traceability to original GRN and purchase history without guessing
 * - Returns history inspection update & status tracking
 * - Thermal / voucher printing
 */
function CustomerDamageReturn() {
  const navigate = useNavigate();

  // Navigation Menubar state
  const [activeDropdown, setActiveDropdown] = useState(null);
  const menuRef = useRef(null);

  // Active View Tab: 'new-return' | 'history'
  const [activeTab, setActiveTab] = useState('new-return');

  // Search & Invoice Loading
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);
  const [notification, setNotification] = useState(null);

  // Return Processing Form State
  const [selectedLineItem, setSelectedLineItem] = useState(null);
  const [returnedQty, setReturnedQty] = useState('1');
  
  // Return Reasons per specifications
  const [damageReason, setDamageReason] = useState('Exchange — item is in good condition');
  const [damageNotes, setDamageNotes] = useState('');
  
  // Workflow & Condition Logic
  const isGoodCondition = damageReason === 'Exchange — item is in good condition';
  const workflowType = isGoodCondition ? 'EXCHANGE' : 'DAMAGE_RETURN';
  const [goodItemInspected, setGoodItemInspected] = useState(true);
  
  // Damage Status for Workflow B: RECEIVED, UNDER INSPECTION, CLAIM PENDING, REPLACEMENT APPROVED, RESOLVED
  const [damageStatus, setDamageStatus] = useState('RECEIVED');

  // Disposition: 'REPLACEMENT' | 'QUARANTINE' | 'SUPPLIER_CLAIM' | 'REFUND_CREDIT'
  const [disposition, setDisposition] = useState('REPLACEMENT');

  // Replacement Options
  const [replacementItemCode, setReplacementItemCode] = useState('');
  const [replacementQty, setReplacementQty] = useState('1');
  const [replacementNotes, setReplacementNotes] = useState('');
  const [inventoryItems, setInventoryItems] = useState([]);
  const [selectedReplacementItem, setSelectedReplacementItem] = useState(null);

  // Supplier Traceability State
  const [traceability, setTraceability] = useState(null);
  const [loadingTrace, setLoadingTrace] = useState(false);
  const [verifiedSupplier, setVerifiedSupplier] = useState(null);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(0);

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedReturn, setCompletedReturn] = useState(null);

  // Returns History List
  const [returnsHistory, setReturnsHistory] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Inspection & Supplier Claim Modal State
  const [inspectingReturn, setInspectingReturn] = useState(null);
  const [modalSubTab, setModalSubTab] = useState('inspection'); // 'inspection' | 'claim'
  const [modalDamageStatus, setModalDamageStatus] = useState('UNDER INSPECTION');
  const [modalConditionResult, setModalConditionResult] = useState('DAMAGED_QUARANTINE');
  const [modalInspectionNotes, setModalInspectionNotes] = useState('');
  const [isSavingInspection, setIsSavingInspection] = useState(false);

  // Supplier Claim Tracking State inside Modal
  const [modalClaimStatus, setModalClaimStatus] = useState('PENDING');
  const [modalSupplierResponse, setModalSupplierResponse] = useState('PENDING');
  const [modalResolutionType, setModalResolutionType] = useState('REPLACEMENT');
  const [modalCreditNoteRef, setModalCreditNoteRef] = useState('');
  const [modalClaimNotes, setModalClaimNotes] = useState('');
  const [isSavingClaim, setIsSavingClaim] = useState(false);

  // Physical Replacement Receipt State inside Modal
  const [showReplacementReceiptForm, setShowReplacementReceiptForm] = useState(false);
  const [modalDeliveryNoteNo, setModalDeliveryNoteNo] = useState('');
  const [modalReceivedQty, setModalReceivedQty] = useState('1');
  const [modalReplacementItemCode, setModalReplacementItemCode] = useState('');
  const [isReceivingReplacement, setIsReceivingReplacement] = useState(false);

  // Print Voucher Modal State
  const [printingReturn, setPrintingReturn] = useState(null);

  const cashierUser =
    localStorage.getItem('username') || localStorage.getItem('userCode') || 'PC004';

  // Navigation Menubar Items (Matching Classic SOFAST ERP)
  const topMenuItems = [
    { id: 'master-files', label: 'Master Files', hasDropdown: true },
    { id: 'stock-control', label: 'Stock Control System', hasDropdown: true },
    { id: 'sales-service', label: 'Sales and Service', hasDropdown: true },
    { id: 'approvement', label: 'Approvement', path: '/approvement' },
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
    { id: 'good-receive-note', label: 'Good Receive Note (GRN)', path: '/grn' },
    { id: 'good-return-note', label: 'Good Return Note (GREN)', path: '/good-return-note' },
    { id: 'damage', label: 'Damage', path: '/damage' },
  ];

  const salesServiceDropdownItems = [
    { id: 'create-invoice', label: 'Create Invoice', path: '/invoice' },
    { id: 'settlement-invoice', label: 'Settlement Invoice', path: '/settlement-invoice' },
    { id: 'remaining-balance', label: 'Remaining Balance', path: '/remaining-balance' },
    { id: 'customer-return-exchange', label: 'Customer Return / Exchange', path: '/customer-return-exchange' },
  ];

  const administrationDropdownItems = [
    { id: 'printer-setup', label: 'Printer Setup', path: '/printer-setup' },
  ];

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

  // Show temporary alert banner
  const showNotification = (msg, type = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  // Load Inventory items for replacement picker
  useEffect(() => {
    api
      .get('/items?limit=500')
      .then((res) => {
        if (res.data?.data) {
          setInventoryItems(res.data.data);
        }
      })
      .catch(() => null);
  }, []);

  // Fetch Returns History
  const fetchReturnsHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await api.get('/damage-returns?limit=100');
      if (res.data?.data) {
        setReturnsHistory(res.data.data);
      }
    } catch (e) {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchReturnsHistory();
    }
  }, [activeTab]);

  // Search and Load Original Invoice
  const handleLoadInvoice = async (targetInvNum) => {
    const invToSearch = String(targetInvNum || invoiceQuery).trim();
    if (!invToSearch) {
      showNotification('Please enter an invoice number to search', 'error');
      return;
    }

    try {
      setLoadingInvoice(true);
      setCompletedReturn(null);
      setSelectedLineItem(null);
      setTraceability(null);
      setVerifiedSupplier(null);

      const res = await api.get(`/damage-returns/invoice/${encodeURIComponent(invToSearch)}`);
      if (res.data?.success && res.data.data) {
        setInvoiceData(res.data.data);
        showNotification(`Invoice '${invToSearch}' loaded successfully`, 'success');
      } else {
        setInvoiceData(null);
        showNotification(res.data?.message || 'Invoice not found', 'error');
      }
    } catch (err) {
      setInvoiceData(null);
      const msg = err.response?.data?.message || `Failed to find Invoice '${invToSearch}'`;
      showNotification(msg, 'error');
    } finally {
      setLoadingInvoice(false);
    }
  };

  // Select Item for Return and inspect supplier traceability
  const handleSelectItemForReturn = async (item) => {
    setSelectedLineItem(item);
    setReturnedQty('1');
    setReplacementQty('1');
    setReplacementItemCode(item.itemCode);
    setTraceability(null);
    setVerifiedSupplier(null);
    setSelectedHistoryIndex(0);

    // Fetch supplier traceability for this item code across GRNs
    try {
      setLoadingTrace(true);
      const traceRes = await api.get(`/damage-returns/traceability/${encodeURIComponent(item.itemCode)}`);
      if (traceRes.data?.success && traceRes.data.data) {
        const trace = traceRes.data.data;
        setTraceability(trace);

        if (trace.suggestedSupplier) {
          setVerifiedSupplier(trace.suggestedSupplier);
        } else if (trace.allSuppliers && trace.allSuppliers.length > 0) {
          const first = trace.allSuppliers[0];
          setVerifiedSupplier({
            supplierCode: first.code,
            supplierName: first.name,
            supplierTelephone: first.telephone || first.telephone1 || '',
            supplierInvoiceNo: '',
            grnNumber: '',
            purchaseDate: null,
            batchInfo: '',
            verificationStatus: 'MANUAL_OVERRIDE',
          });
        }
      }
    } catch (e) {
      // Traceability error fallback
    } finally {
      setLoadingTrace(false);
    }
  };

  // When replacement item code changes, find matching inventory item
  useEffect(() => {
    if (!replacementItemCode) {
      setSelectedReplacementItem(null);
      return;
    }
    const match = inventoryItems.find(
      (itm) => String(itm.code).toLowerCase() === replacementItemCode.trim().toLowerCase()
    );
    setSelectedReplacementItem(match || null);
  }, [replacementItemCode, inventoryItems]);

  // Adjust disposition default when reason changes
  useEffect(() => {
    if (isGoodCondition) {
      setDisposition('REPLACEMENT');
    } else {
      if (disposition === 'REPLACEMENT') {
        // keep replacement or default to QUARANTINE
      }
    }
  }, [damageReason]);

  // Financial Calculations
  const returnedUnitPrice = selectedLineItem ? Number(selectedLineItem.unitPrice || 0) : 0;
  const retQtyNum = parseFloat(returnedQty) || 0;
  const returnedTotalValue = retQtyNum * returnedUnitPrice;

  const replacementUnitPrice = selectedReplacementItem
    ? Number(selectedReplacementItem.finalSellingPrice || selectedReplacementItem.sellingPrice || 0)
    : 0;
  const replQtyNum = parseFloat(replacementQty) || 0;
  const replacementTotalValue = replQtyNum * replacementUnitPrice;

  const hasReplacement = isGoodCondition || disposition === 'REPLACEMENT';
  const priceDifference = hasReplacement ? Math.round((replacementTotalValue - returnedTotalValue) * 100) / 100 : 0;

  // Handle Return Submission
  const handleSubmitReturn = async (e) => {
    if (e) e.preventDefault();

    if (!invoiceData || !selectedLineItem) {
      showNotification('Please search an invoice and select an item to return', 'error');
      return;
    }

    if (isNaN(retQtyNum) || retQtyNum <= 0) {
      showNotification('Please enter a valid return quantity greater than 0', 'error');
      return;
    }

    if (retQtyNum > selectedLineItem.availableReturnQuantity) {
      showNotification(
        `Returned quantity (${retQtyNum}) exceeds available return limit (${selectedLineItem.availableReturnQuantity})`,
        'error'
      );
      return;
    }

    if (!damageReason.trim()) {
      showNotification('Please select a return reason', 'error');
      return;
    }

    let replPayload = undefined;
    if (hasReplacement) {
      if (!replacementItemCode.trim()) {
        showNotification('Please enter or select a replacement item code', 'error');
        return;
      }
      if (isNaN(replQtyNum) || replQtyNum <= 0) {
        showNotification('Replacement quantity must be greater than 0', 'error');
        return;
      }

      replPayload = {
        itemCode: replacementItemCode.trim(),
        description: selectedReplacementItem ? selectedReplacementItem.description : '',
        quantity: replQtyNum,
        additionalPaymentRequired: priceDifference > 0 ? priceDifference : 0,
        refundAmount: priceDifference < 0 ? Math.abs(priceDifference) : 0,
        notes: replacementNotes.trim(),
      };
    }

    const payload = {
      invoiceNumber: invoiceData.invoice.invoiceNumber,
      itemCode: selectedLineItem.itemCode,
      returnedQuantity: retQtyNum,
      returnReason: damageReason,
      damageReason,
      damageNotes,
      workflowType,
      itemCondition: isGoodCondition ? 'GOOD' : 'DAMAGED',
      damageStatus: isGoodCondition ? 'RESOLVED' : damageStatus,
      inspection: {
        conditionResult: isGoodCondition && goodItemInspected ? 'SELLABLE_STOCK' : 'DAMAGED_QUARANTINE',
        inspectionNotes: isGoodCondition ? 'Inspected good condition - approved for resale' : damageNotes,
        inspectedBy: cashierUser,
      },
      disposition: hasReplacement ? 'REPLACEMENT' : disposition,
      replacement: replPayload,
      verifiedSupplier,
      remarks: `Processed by ${cashierUser}`,
    };

    try {
      setIsSubmitting(true);
      const res = await api.post('/damage-returns', payload);
      if (res.data?.success) {
        const retRef = res.data.data?.returnRecord?.returnNumber || 'CDR-SUCCESS';
        const claimRef = res.data.data?.claimRecord?.claimNumber;

        let msg = `Return & Exchange '${retRef}' processed successfully!`;
        if (isGoodCondition) {
          msg += ` Good item inspected & restored to sellable stock. Replacement issued.`;
        } else if (disposition === 'REPLACEMENT') {
          msg += ` Defective item quarantined. Replacement issued.`;
        } else if (disposition === 'SUPPLIER_CLAIM') {
          msg += ` Quarantined and Supplier Claim '${claimRef}' auto-generated.`;
        } else {
          msg += ` Moved into Damaged Stock quarantine.`;
        }

        showNotification(msg, 'success');
        setCompletedReturn(res.data.data);

        // Reload invoice to update remaining returnable quantity
        handleLoadInvoice(invoiceData.invoice.invoiceNumber);

        // Reset inputs
        setSelectedLineItem(null);
        setReturnedQty('1');
        setDamageNotes('');
        setReplacementNotes('');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to submit return';
      showNotification(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset / New Return Form
  const handleNewReturn = () => {
    setSelectedLineItem(null);
    setReturnedQty('1');
    setReplacementQty('1');
    setReplacementItemCode('');
    setDamageNotes('');
    setReplacementNotes('');
    setTraceability(null);
    setVerifiedSupplier(null);
    setCompletedReturn(null);
    showNotification('Ready for new customer return entry', 'info');
  };

  // Cancel Action
  const handleCancel = () => {
    if (selectedLineItem) {
      setSelectedLineItem(null);
      setReturnedQty('1');
    } else {
      navigate('/management');
    }
  };

  // Print voucher preview
  const handlePrintVoucher = (returnObj) => {
    const toPrint = returnObj || completedReturn?.returnRecord;
    if (!toPrint) {
      showNotification('No completed return selected to print', 'error');
      return;
    }
    setPrintingReturn(toPrint);
  };

  // Save Inspection Update Modal
  const handleSaveInspection = async () => {
    if (!inspectingReturn) return;
    try {
      setIsSavingInspection(true);
      const res = await api.patch(`/damage-returns/${inspectingReturn._id}/inspection`, {
        damageStatus: modalDamageStatus,
        inspectionResult: modalConditionResult,
        inspectionNotes: modalInspectionNotes,
        inspectedBy: cashierUser,
      });

      if (res.data?.success) {
        showNotification(
          `Return '${inspectingReturn.returnNumber}' inspection updated successfully!`,
          'success'
        );
        setInspectingReturn(res.data.data);
        fetchReturnsHistory();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update inspection';
      showNotification(msg, 'error');
    } finally {
      setIsSavingInspection(false);
    }
  };

  // Open Inspection & Claim Modal
  const handleOpenInspectModal = (ret, initialTab = 'inspection') => {
    setInspectingReturn(ret);
    setModalSubTab(initialTab);
    setModalDamageStatus(ret.damageStatus || 'UNDER INSPECTION');
    setModalConditionResult(ret.inspection?.conditionResult || 'DAMAGED_QUARANTINE');
    setModalInspectionNotes(ret.inspection?.inspectionNotes || '');

    const sc = ret.supplierClaim || {};
    setModalClaimStatus(sc.claimStatus || (ret.supplierClaimNumber ? 'SUBMITTED' : 'PENDING'));
    setModalSupplierResponse(sc.supplierResponse || 'PENDING');
    setModalResolutionType(sc.resolutionType || 'REPLACEMENT');
    setModalCreditNoteRef(sc.creditNoteReference || '');
    setModalClaimNotes(sc.notes || '');

    setModalReceivedQty(String(ret.returnedItem?.returnedQuantity || 1));
    setModalReplacementItemCode(ret.returnedItem?.itemCode || '');
    setModalDeliveryNoteNo('');
    setShowReplacementReceiptForm(false);
  };

  // Save Supplier Claim Update
  const handleSaveSupplierClaim = async () => {
    if (!inspectingReturn) return;
    try {
      setIsSavingClaim(true);
      const res = await api.patch(`/damage-returns/${inspectingReturn._id}/supplier-claim`, {
        claimStatus: modalClaimStatus,
        supplierResponse: modalSupplierResponse,
        resolutionType: modalResolutionType,
        creditNoteReference: modalCreditNoteRef,
        notes: modalClaimNotes,
      });

      if (res.data?.success) {
        showNotification(
          `Supplier Claim for '${inspectingReturn.returnNumber}' updated successfully!`,
          'success'
        );
        setInspectingReturn(res.data.data);
        fetchReturnsHistory();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update supplier claim';
      showNotification(msg, 'error');
    } finally {
      setIsSavingClaim(false);
    }
  };

  // Receive Physical Replacement from Supplier into Stock
  const handleReceiveReplacement = async () => {
    if (!inspectingReturn) return;
    const qtyToReceive = Number(modalReceivedQty);
    if (!qtyToReceive || qtyToReceive <= 0) {
      showNotification('Please enter a valid received quantity (> 0)', 'error');
      return;
    }

    try {
      setIsReceivingReplacement(true);
      const res = await api.patch(`/damage-returns/${inspectingReturn._id}/supplier-claim`, {
        replacementReceived: {
          received: true,
          receivedDate: new Date(),
          quantityReceived: qtyToReceive,
          replacementItemCode: modalReplacementItemCode || inspectingReturn.returnedItem?.itemCode,
          deliveryNoteNo: modalDeliveryNoteNo,
          receivedBy: cashierUser,
        },
      });

      if (res.data?.success) {
        showNotification(
          `Supplier replacement received for '${inspectingReturn.returnNumber}'! Quantity restored into sellable inventory.`,
          'success'
        );
        setShowReplacementReceiptForm(false);
        setInspectingReturn(res.data.data);
        fetchReturnsHistory();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to receive supplier replacement';
      showNotification(msg, 'error');
    } finally {
      setIsReceivingReplacement(false);
    }
  };

  const formatCurrency = (val) => {
    const num = Number(val) || 0;
    return `Rs. ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toISOString().split('T')[0];
    } catch (e) {
      return String(dateStr);
    }
  };

  // Filtered History
  const filteredHistory = returnsHistory.filter((item) => {
    if (!historySearch.trim()) return true;
    const q = historySearch.toLowerCase().trim();
    return (
      String(item.returnNumber || '').toLowerCase().includes(q) ||
      String(item.invoiceNumber || '').toLowerCase().includes(q) ||
      String(item.customerName || '').toLowerCase().includes(q) ||
      String(item.returnedItem?.itemCode || '').toLowerCase().includes(q) ||
      String(item.returnedItem?.description || '').toLowerCase().includes(q) ||
      String(item.disposition || '').toLowerCase().includes(q) ||
      String(item.status || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="cdr-page-wrapper">
      {/* 1. Classic Windows Blue Header */}
      <header className="cdr-win-titlebar">
        <div className="cdr-win-title-left">
          <svg className="cdr-car-icon" viewBox="0 0 24 24">
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
          </svg>
          <span>SOFAST MOTORS - Customer Return, Exchange &amp; Damage Tracking</span>
        </div>
        <div className="cdr-win-controls">
          <button
            type="button"
            className="cdr-ctrl-btn"
            onClick={() => navigate('/management')}
            title="Minimize"
          >
            &#8212;
          </button>
          <button type="button" className="cdr-ctrl-btn" title="Maximize">
            &#9633;
          </button>
          <button
            type="button"
            className="cdr-ctrl-btn close"
            onClick={() => navigate('/management')}
            title="Close"
          >
            &#x2715;
          </button>
        </div>
      </header>

      {/* 2. Top Classic Menubar */}
      <nav className="cdr-menubar-container" ref={menuRef}>
        <ul className="cdr-menubar">
          {topMenuItems.map((item) => (
            <li key={item.id} className="cdr-menu-item-wrapper">
              <button
                type="button"
                className={`cdr-menubar-btn ${activeDropdown === item.id ? 'active' : ''}`}
                onClick={() => {
                  if (item.hasDropdown) {
                    setActiveDropdown(activeDropdown === item.id ? null : item.id);
                  } else if (item.path) {
                    setActiveDropdown(null);
                    navigate(item.path);
                  }
                }}
              >
                {item.label}
              </button>

              {/* Master Files Dropdown */}
              {item.id === 'master-files' && activeDropdown === 'master-files' && (
                <ul className="cdr-dropdown-menu">
                  {masterFilesDropdownItems.map((dropItem) => (
                    <li key={dropItem.id} className="cdr-dropdown-entry">
                      <button
                        type="button"
                        className="cdr-dropdown-item-btn"
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
                <ul className="cdr-dropdown-menu">
                  {stockControlDropdownItems.map((dropItem) => (
                    <li key={dropItem.id} className="cdr-dropdown-entry">
                      <button
                        type="button"
                        className="cdr-dropdown-item-btn"
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
                <ul className="cdr-dropdown-menu">
                  {salesServiceDropdownItems.map((dropItem) => (
                    <li key={dropItem.id} className="cdr-dropdown-entry">
                      <button
                        type="button"
                        className={`cdr-dropdown-item-btn ${
                          dropItem.id === 'customer-return-exchange' ? 'selected' : ''
                        }`}
                        onClick={() => {
                          setActiveDropdown(null);
                          navigate(dropItem.path);
                        }}
                      >
                        <span>{dropItem.label}</span>
                        {dropItem.id === 'customer-return-exchange' && <span>&#10003;</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Administration Dropdown */}
              {item.id === 'administration' && activeDropdown === 'administration' && (
                <ul className="cdr-dropdown-menu">
                  {administrationDropdownItems.map((dropItem) => (
                    <li key={dropItem.id} className="cdr-dropdown-entry">
                      <button
                        type="button"
                        className="cdr-dropdown-item-btn"
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

      {/* 3. Main Workspace */}
      <main className="cdr-main-container">
        {/* Notification Banner */}
        {notification && (
          <div className={`cdr-alert ${notification.type}`}>
            <span>{notification.message}</span>
            <button
              type="button"
              className="cdr-ctrl-btn"
              style={{ width: '16px', height: '16px', fontSize: '9px' }}
              onClick={() => setNotification(null)}
            >
              &#x2715;
            </button>
          </div>
        )}

        {/* View Switcher Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '2px' }}>
          <button
            type="button"
            className={`cdr-btn-classic ${activeTab === 'new-return' ? 'primary' : ''}`}
            onClick={() => setActiveTab('new-return')}
          >
            Process Return &amp; Exchange
          </button>
          <button
            type="button"
            className={`cdr-btn-classic ${activeTab === 'history' ? 'primary' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            Returns History Log &amp; Inspection ({returnsHistory.length})
          </button>
        </div>

        {activeTab === 'new-return' ? (
          <>
            {/* Step 1: Invoice Search & Customer Verification */}
            <section className="cdr-panel">
              <div className="cdr-panel-title">
                <span>1. Original Sales Invoice Search</span>
                {invoiceData && (
                  <span style={{ color: '#166534', fontWeight: 'normal' }}>
                    Invoice #{invoiceData.invoice.invoiceNumber} Verified
                  </span>
                )}
              </div>
              <div className="cdr-search-bar">
                <span className="cdr-label">Invoice Number:</span>
                <input
                  type="text"
                  className="cdr-input"
                  style={{ width: '160px' }}
                  placeholder="e.g. 47619 or INV-1001"
                  value={invoiceQuery}
                  onChange={(e) => setInvoiceQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleLoadInvoice();
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  className="cdr-btn-classic primary"
                  onClick={() => handleLoadInvoice()}
                  disabled={loadingInvoice}
                >
                  {loadingInvoice ? 'Searching...' : 'Search & Load Invoice'}
                </button>
                <button
                  type="button"
                  className="cdr-btn-classic"
                  onClick={() => {
                    setInvoiceQuery('47619');
                    handleLoadInvoice('47619');
                  }}
                  title="Quick Load Sample Invoice"
                >
                  Load #47619
                </button>
              </div>

              {/* Customer Details Display */}
              {invoiceData && (
                <div className="cdr-info-grid">
                  <div className="cdr-info-item">
                    <span className="cdr-info-label">Customer Name</span>
                    <span className="cdr-info-val highlight">
                      {invoiceData.invoice.customer.name}
                    </span>
                  </div>
                  <div className="cdr-info-item">
                    <span className="cdr-info-label">Customer Code</span>
                    <span className="cdr-info-val">{invoiceData.invoice.customer.code || '-'}</span>
                  </div>
                  <div className="cdr-info-item">
                    <span className="cdr-info-label">Telephone</span>
                    <span className="cdr-info-val">
                      {invoiceData.invoice.customer.telephone || '-'}
                    </span>
                  </div>
                  <div className="cdr-info-item">
                    <span className="cdr-info-label">Invoice Date</span>
                    <span className="cdr-info-val">{formatDate(invoiceData.invoice.date)}</span>
                  </div>
                  <div className="cdr-info-item">
                    <span className="cdr-info-label">Customer Address</span>
                    <span className="cdr-info-val">
                      {invoiceData.invoice.customer.address || '-'}
                    </span>
                  </div>
                  <div className="cdr-info-item">
                    <span className="cdr-info-label">Invoice Total</span>
                    <span className="cdr-info-val highlight">
                      {formatCurrency(invoiceData.invoice.netTotal)}
                    </span>
                  </div>
                </div>
              )}
            </section>

            {/* Step 2: Purchased Items Selection & Return Validation */}
            {invoiceData && (
              <section className="cdr-panel">
                <div className="cdr-panel-title">
                  <span>2. Purchased Items &amp; Returnable Limits</span>
                  <span style={{ fontSize: '10px', color: '#666' }}>
                    Select an item from the original invoice to initiate return or exchange
                  </span>
                </div>
                <div className="cdr-table-container">
                  <table className="cdr-table">
                    <thead>
                      <tr>
                        <th style={{ width: '30px' }}>#</th>
                        <th style={{ width: '100px' }}>Item Code</th>
                        <th>Description</th>
                        <th style={{ width: '80px', textAlign: 'right' }}>Original Qty</th>
                        <th style={{ width: '90px', textAlign: 'right' }}>Prev. Returned</th>
                        <th style={{ width: '100px', textAlign: 'right' }}>Returnable Qty</th>
                        <th style={{ width: '90px', textAlign: 'right' }}>Selling Price</th>
                        <th style={{ width: '110px', textAlign: 'center' }}>Current Stock</th>
                        <th style={{ width: '100px', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceData.lineItems.map((item, idx) => {
                        const isSelected = selectedLineItem?.itemCode === item.itemCode;
                        const canReturn = item.availableReturnQuantity > 0;

                        return (
                          <tr
                            key={item.itemCode || idx}
                            className={isSelected ? 'selected' : ''}
                            onClick={() => {
                              if (canReturn) handleSelectItemForReturn(item);
                            }}
                            style={{ cursor: canReturn ? 'pointer' : 'not-allowed' }}
                          >
                            <td>{idx + 1}</td>
                            <td><strong>{item.itemCode}</strong></td>
                            <td>{item.description || '-'}</td>
                            <td style={{ textAlign: 'right' }}>{item.purchasedQuantity}</td>
                            <td style={{ textAlign: 'right', color: item.previousReturnedQuantity > 0 ? '#b91c1c' : '#666' }}>
                              {item.previousReturnedQuantity}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 'bold', color: canReturn ? '#15803d' : '#999' }}>
                              {item.availableReturnQuantity}
                            </td>
                            <td style={{ textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ color: '#0369a1' }}>
                                Sellable: {item.currentSellableStock}
                              </span>
                              {item.currentDamagedStock > 0 && (
                                <span style={{ color: '#b45309', marginLeft: '4px' }}>
                                  (Quar: {item.currentDamagedStock})
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {canReturn ? (
                                <button
                                  type="button"
                                  className={`cdr-btn-classic ${isSelected ? 'primary' : ''}`}
                                  style={{ height: '20px', padding: '0 8px', fontSize: '10px' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectItemForReturn(item);
                                  }}
                                >
                                  {isSelected ? '✓ Selected' : 'Select'}
                                </button>
                              ) : (
                                <span className="cdr-badge danger">Limit Reached</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Step 3: Return & Exchange Details, Pricing, Traceability */}
            {selectedLineItem && (
              <section className="cdr-panel">
                <div className="cdr-panel-title">
                  <span>
                    3. Return &amp; Exchange Details: [{selectedLineItem.itemCode}] - {selectedLineItem.description}
                  </span>
                  <span className="cdr-badge info">
                    Max Returnable: {selectedLineItem.availableReturnQuantity} Unit(s)
                  </span>
                </div>

                {/* Workflow Type Banner */}
                {isGoodCondition ? (
                  <div className="cdr-workflow-banner workflow-a">
                    <div>
                      <strong>WORKFLOW A: Good Condition Item Returned for Exchange</strong>
                      <div style={{ fontSize: '10px', marginTop: '2px' }}>
                        Item will be inspected and returned directly into sellable stock. Replacement item will be deducted from sellable stock. No duplicate sales invoice or double charging.
                      </div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '11px' }}>
                      <input
                        type="checkbox"
                        checked={goodItemInspected}
                        onChange={(e) => setGoodItemInspected(e.target.checked)}
                      />
                      <span>Inspected &amp; Accepted into Sellable Stock</span>
                    </label>
                  </div>
                ) : (
                  <div className="cdr-workflow-banner workflow-b">
                    <div>
                      <strong>WORKFLOW B: Damaged / Defective Item Return</strong>
                      <div style={{ fontSize: '10px', marginTop: '2px' }}>
                        Accepted quantity will be placed in Damaged Stock / Quarantine. Normal sellable stock will NOT increase.
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 'bold' }}>Damage Status:</span>
                      <select
                        className="cdr-select"
                        value={damageStatus}
                        onChange={(e) => setDamageStatus(e.target.value)}
                        style={{ height: '22px', fontSize: '10px' }}
                      >
                        <option value="RECEIVED">RECEIVED</option>
                        <option value="UNDER INSPECTION">UNDER INSPECTION</option>
                        <option value="CLAIM PENDING">CLAIM PENDING</option>
                        <option value="REPLACEMENT APPROVED">REPLACEMENT APPROVED</option>
                        <option value="RESOLVED">RESOLVED</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="cdr-form-columns">
                  {/* Left Column: Return Parameters & Replacement Selection */}
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div className="cdr-field-group">
                        <label className="cdr-label">
                          Returned Quantity: <span style={{ color: 'red' }}>*</span>
                        </label>
                        <input
                          type="number"
                          className="cdr-input"
                          min="0.01"
                          max={selectedLineItem.availableReturnQuantity}
                          step="1"
                          value={returnedQty}
                          onChange={(e) => setReturnedQty(e.target.value)}
                          style={{
                            fontWeight: 'bold',
                            borderColor:
                              parseFloat(returnedQty) > selectedLineItem.availableReturnQuantity
                                ? '#ea4335'
                                : '#7f9db9',
                          }}
                        />
                        {parseFloat(returnedQty) > selectedLineItem.availableReturnQuantity && (
                          <span style={{ color: '#ea4335', fontSize: '10px' }}>
                            Exceeds max allowable return ({selectedLineItem.availableReturnQuantity})!
                          </span>
                        )}
                      </div>

                      <div className="cdr-field-group">
                        <label className="cdr-label">
                          Return Reason: <span style={{ color: 'red' }}>*</span>
                        </label>
                        <select
                          className="cdr-select"
                          value={damageReason}
                          onChange={(e) => setDamageReason(e.target.value)}
                          style={{ fontWeight: isGoodCondition ? 'bold' : 'normal' }}
                        >
                          <option value="Exchange — item is in good condition">
                            Exchange — item is in good condition
                          </option>
                          <option value="Damaged item">Damaged item</option>
                          <option value="Defective item">Defective item</option>
                          <option value="Wrong item supplied">Wrong item supplied</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div className="cdr-field-group">
                      <label className="cdr-label">Reason Notes / Defect Description:</label>
                      <textarea
                        className="cdr-textarea"
                        placeholder="Additional notes, customer comments, defect description..."
                        value={damageNotes}
                        onChange={(e) => setDamageNotes(e.target.value)}
                      />
                    </div>

                    {/* Action / Disposition Cards (For Workflow B Damaged items) */}
                    {!isGoodCondition && (
                      <div className="cdr-field-group" style={{ marginTop: '6px' }}>
                        <label className="cdr-label">Resolution / Action:</label>
                        <div className="cdr-action-card-group">
                          <div
                            className={`cdr-action-card ${disposition === 'REPLACEMENT' ? 'active' : ''}`}
                            onClick={() => setDisposition('REPLACEMENT')}
                          >
                            <input
                              type="radio"
                              name="disposition"
                              checked={disposition === 'REPLACEMENT'}
                              onChange={() => setDisposition('REPLACEMENT')}
                            />
                            <div className="cdr-action-card-content">
                              <span className="cdr-action-card-title">
                                1. Issue Replacement Item (Direct Swap)
                              </span>
                              <span className="cdr-action-card-desc">
                                Issues replacement goods to customer. Damaged item quarantined.
                              </span>
                            </div>
                          </div>

                          <div
                            className={`cdr-action-card ${disposition === 'QUARANTINE' ? 'active' : ''}`}
                            onClick={() => setDisposition('QUARANTINE')}
                          >
                            <input
                              type="radio"
                              name="disposition"
                              checked={disposition === 'QUARANTINE'}
                              onChange={() => setDisposition('QUARANTINE')}
                            />
                            <div className="cdr-action-card-content">
                              <span className="cdr-action-card-title">
                                2. Receive into Damaged / Quarantine Stock
                              </span>
                              <span className="cdr-action-card-desc">
                                Holds damaged goods separated from sellable stock pending inspection.
                              </span>
                            </div>
                          </div>

                          <div
                            className={`cdr-action-card ${disposition === 'SUPPLIER_CLAIM' ? 'active' : ''}`}
                            onClick={() => setDisposition('SUPPLIER_CLAIM')}
                          >
                            <input
                              type="radio"
                              name="disposition"
                              checked={disposition === 'SUPPLIER_CLAIM'}
                              onChange={() => setDisposition('SUPPLIER_CLAIM')}
                            />
                            <div className="cdr-action-card-content">
                              <span className="cdr-action-card-title">
                                3. Send for Supplier Claim / Inspection
                              </span>
                              <span className="cdr-action-card-desc">
                                Quarantines item and auto-generates a Supplier Damage Claim record.
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Replacement Item Form & Financial Calculations */}
                    {hasReplacement && (
                      <div
                        style={{
                          backgroundColor: '#f8fafc',
                          border: '1px solid #94a3b8',
                          padding: '8px',
                          marginTop: '6px',
                        }}
                      >
                        <div style={{ fontWeight: 'bold', color: '#0369a1', marginBottom: '4px' }}>
                          Replacement Item &amp; Value Comparison:
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '6px' }}>
                          <div className="cdr-field-group">
                            <label className="cdr-label">Replacement Item Code:</label>
                            <input
                              type="text"
                              className="cdr-input"
                              placeholder="Type code or search..."
                              value={replacementItemCode}
                              onChange={(e) => setReplacementItemCode(e.target.value)}
                              list="inventory-item-list"
                            />
                            <datalist id="inventory-item-list">
                              {inventoryItems.slice(0, 100).map((itm) => (
                                <option key={itm.code} value={itm.code}>
                                  {itm.description} - (Stock: {itm.quantity || itm.stockInHand})
                                </option>
                              ))}
                            </datalist>
                            {selectedReplacementItem && (
                              <span style={{ fontSize: '10px', color: '#16a34a', display: 'block', marginTop: '2px' }}>
                                {selectedReplacementItem.description} | Unit: {formatCurrency(replacementUnitPrice)} | Sellable Stock: {selectedReplacementItem.quantity || selectedReplacementItem.stockInHand}
                              </span>
                            )}
                          </div>

                          <div className="cdr-field-group">
                            <label className="cdr-label">Replacement Qty:</label>
                            <input
                              type="number"
                              className="cdr-input"
                              min="1"
                              value={replacementQty}
                              onChange={(e) => setReplacementQty(e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Financial Comparison Summary Box */}
                        <div className="cdr-diff-box">
                          <div className="cdr-diff-row">
                            <span>Returned Item Value ({retQtyNum} x {formatCurrency(returnedUnitPrice)}):</span>
                            <span><strong>{formatCurrency(returnedTotalValue)}</strong></span>
                          </div>
                          <div className="cdr-diff-row">
                            <span>Replacement Item Value ({replQtyNum} x {formatCurrency(replacementUnitPrice)}):</span>
                            <span><strong>{formatCurrency(replacementTotalValue)}</strong></span>
                          </div>
                          <div className="cdr-diff-row cdr-diff-total">
                            <span>Net Difference:</span>
                            {priceDifference > 0 ? (
                              <span style={{ color: '#b91c1c' }}>
                                Customer Pays Difference: {formatCurrency(priceDifference)}
                              </span>
                            ) : priceDifference < 0 ? (
                              <span style={{ color: '#15803d' }}>
                                Refund / Store Credit to Customer: {formatCurrency(Math.abs(priceDifference))}
                              </span>
                            ) : (
                              <span style={{ color: '#0369a1' }}>
                                Even Exchange (No additional payment)
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="cdr-field-group" style={{ marginTop: '6px' }}>
                          <label className="cdr-label">Replacement Notes / Warranty Info:</label>
                          <input
                            type="text"
                            className="cdr-input"
                            placeholder="Optional notes for replacement..."
                            value={replacementNotes}
                            onChange={(e) => setReplacementNotes(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Supplier Traceability for Damaged Items */}
                  <div>
                    <div className="cdr-trace-box">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ color: '#000080' }}>Supplier Traceability</strong>
                        {loadingTrace ? (
                          <span style={{ color: '#666' }}>Tracing GRNs...</span>
                        ) : traceability?.hasPurchaseHistory ? (
                          <span className="cdr-badge success">GRN Records Found</span>
                        ) : (
                          <span className="cdr-badge warning">No GRN History</span>
                        )}
                      </div>

                      {verifiedSupplier ? (
                        <>
                          <div className="cdr-trace-row">
                            <span className="cdr-trace-label">Supplier Name:</span>
                            <span className="cdr-trace-val">{verifiedSupplier.supplierName}</span>
                          </div>
                          <div className="cdr-trace-row">
                            <span className="cdr-trace-label">Supplier Code:</span>
                            <span className="cdr-trace-val">{verifiedSupplier.supplierCode}</span>
                          </div>
                          <div className="cdr-trace-row">
                            <span className="cdr-trace-label">Telephone:</span>
                            <span className="cdr-trace-val">{verifiedSupplier.supplierTelephone || '-'}</span>
                          </div>
                          <div className="cdr-trace-row">
                            <span className="cdr-trace-label">Supplier Invoice #:</span>
                            <span className="cdr-trace-val">{verifiedSupplier.supplierInvoiceNo || '-'}</span>
                          </div>
                          <div className="cdr-trace-row">
                            <span className="cdr-trace-label">GRN Reference:</span>
                            <span className="cdr-trace-val">{verifiedSupplier.grnNumber || '-'}</span>
                          </div>
                          <div className="cdr-trace-row">
                            <span className="cdr-trace-label">Purchase Date:</span>
                            <span className="cdr-trace-val">{formatDate(verifiedSupplier.purchaseDate)}</span>
                          </div>
                          <div className="cdr-trace-row">
                            <span className="cdr-trace-label">Damaged Return Qty:</span>
                            <span className="cdr-trace-val" style={{ color: '#b91c1c' }}>{retQtyNum} unit(s)</span>
                          </div>
                          <div className="cdr-trace-row">
                            <span className="cdr-trace-label">Claim Status:</span>
                            <span className="cdr-trace-val">
                              {disposition === 'SUPPLIER_CLAIM' ? 'AUTO-GENERATE CLAIM' : 'PENDING EVALUATION'}
                            </span>
                          </div>
                          <div className="cdr-trace-row">
                            <span className="cdr-trace-label">Verification:</span>
                            <span className="cdr-trace-val" style={{ color: '#16a34a' }}>
                              {verifiedSupplier.verificationStatus}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div style={{ padding: '12px', textAlign: 'center', color: '#666' }}>
                          No supplier traced yet.
                        </div>
                      )}

                      {/* If Multiple Purchases Exist across GRNs, show table to select verified source */}
                      {traceability && traceability.purchaseHistory && traceability.purchaseHistory.length > 1 && (
                        <div style={{ marginTop: '6px' }}>
                          <span style={{ fontWeight: 'bold', color: '#b45309', fontSize: '10px' }}>
                            Multiple Purchases Detected — Select Verified Source:
                          </span>
                          <div className="cdr-history-table-box">
                            <table className="cdr-table">
                              <thead>
                                <tr>
                                  <th>GRN #</th>
                                  <th>Date</th>
                                  <th>Supplier</th>
                                  <th>Inv #</th>
                                  <th>Purch. Qty</th>
                                  <th>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {traceability.purchaseHistory.map((hist, hIdx) => (
                                  <tr
                                    key={hist.grnId || hIdx}
                                    className={selectedHistoryIndex === hIdx ? 'selected' : ''}
                                  >
                                    <td>{hist.grnNumber}</td>
                                    <td>{formatDate(hist.date)}</td>
                                    <td>{hist.supplierName}</td>
                                    <td>{hist.supplierInvoiceNo || '-'}</td>
                                    <td style={{ textAlign: 'right' }}>{hist.purchasedQuantity}</td>
                                    <td>
                                      <button
                                        type="button"
                                        className="cdr-btn-classic"
                                        style={{ height: '18px', padding: '0 4px', fontSize: '9px' }}
                                        onClick={() => {
                                          setSelectedHistoryIndex(hIdx);
                                          setVerifiedSupplier({
                                            supplierCode: hist.supplierCode,
                                            supplierName: hist.supplierName,
                                            supplierTelephone: hist.supplierTelephone,
                                            supplierInvoiceNo: hist.supplierInvoiceNo,
                                            grnNumber: hist.grnNumber,
                                            purchaseDate: hist.date,
                                            batchInfo: hist.batchInfo,
                                            verificationStatus: 'SELECTED_FROM_HISTORY',
                                          });
                                        }}
                                      >
                                        Verify
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Manual Supplier Override option */}
                      <div style={{ marginTop: '6px', borderTop: '1px dotted #ccc', paddingTop: '4px' }}>
                        <span style={{ fontSize: '10px', color: '#666' }}>Manual Supplier Selection:</span>
                        <select
                          className="cdr-select"
                          style={{ width: '100%', marginTop: '2px' }}
                          value={verifiedSupplier?.supplierCode || ''}
                          onChange={(e) => {
                            const found = (traceability?.allSuppliers || []).find(
                              (s) => s.code === e.target.value
                            );
                            if (found) {
                              setVerifiedSupplier({
                                supplierCode: found.code,
                                supplierName: found.name,
                                supplierTelephone: found.telephone || found.telephone1 || '',
                                supplierInvoiceNo: verifiedSupplier?.supplierInvoiceNo || '',
                                grnNumber: verifiedSupplier?.grnNumber || '',
                                purchaseDate: verifiedSupplier?.purchaseDate || null,
                                batchInfo: verifiedSupplier?.batchInfo || '',
                                verificationStatus: 'MANUAL_OVERRIDE',
                              });
                            }
                          }}
                        >
                          <option value="">-- Choose Supplier --</option>
                          {(traceability?.allSuppliers || []).map((sup) => (
                            <option key={sup.code} value={sup.code}>
                              {sup.name} ({sup.code})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Step 4: Completion Confirmation Card */}
            {completedReturn && (
              <section
                className="cdr-panel"
                style={{ backgroundColor: '#f0fdf4', borderColor: '#86efac' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ color: '#15803d', fontSize: '13px' }}>
                    ✓ Return Reference: {completedReturn.returnRecord?.returnNumber}
                  </strong>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="cdr-btn-classic primary"
                      style={{ height: '22px', fontSize: '10px' }}
                      onClick={() => handlePrintVoucher(completedReturn.returnRecord)}
                    >
                      &#128424; Print Return Voucher
                    </button>
                    <span className="cdr-badge success">Completed</span>
                  </div>
                </div>
                <div style={{ marginTop: '6px', fontSize: '11px', color: '#166534' }}>
                  Recorded against Invoice #{completedReturn.returnRecord?.invoiceNumber} for customer{' '}
                  <strong>{completedReturn.returnRecord?.customerName}</strong>.
                  {completedReturn.returnRecord?.replacement?.issued && (
                    <span style={{ display: 'block', marginTop: '4px' }}>
                      Replacement issued: {completedReturn.returnRecord?.replacement?.quantity}x {completedReturn.returnRecord?.replacement?.itemCode}.
                      {completedReturn.returnRecord?.replacement?.additionalPaymentRequired > 0 && (
                        <span> Customer paid: {formatCurrency(completedReturn.returnRecord.replacement.additionalPaymentRequired)}.</span>
                      )}
                      {completedReturn.returnRecord?.replacement?.refundAmount > 0 && (
                        <span> Refunded to customer: {formatCurrency(completedReturn.returnRecord.replacement.refundAmount)}.</span>
                      )}
                    </span>
                  )}
                  {completedReturn.claimRecord && (
                    <span style={{ display: 'block', marginTop: '4px' }}>
                      Supplier Claim generated: <strong>{completedReturn.claimRecord?.claimNumber}</strong> (Supplier: {completedReturn.claimRecord?.supplierName}).
                    </span>
                  )}
                </div>
              </section>
            )}

            {/* Step 5: Standard Action Bar (Save, New, Print, Cancel) */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
                marginTop: '10px',
                padding: '6px 0',
              }}
            >
              <button
                type="button"
                className="cdr-btn-classic"
                style={{ minWidth: '80px', height: '28px', fontSize: '11px' }}
                onClick={handleNewReturn}
              >
                + New
              </button>
              <button
                type="button"
                className="cdr-btn-classic primary"
                style={{ minWidth: '90px', height: '28px', fontSize: '11px', fontWeight: 'bold' }}
                onClick={handleSubmitReturn}
                disabled={
                  isSubmitting ||
                  !selectedLineItem ||
                  !returnedQty ||
                  parseFloat(returnedQty) > (selectedLineItem?.availableReturnQuantity || 0)
                }
              >
                {isSubmitting ? 'Saving...' : '💾 Save'}
              </button>
              <button
                type="button"
                className="cdr-btn-classic"
                style={{ minWidth: '80px', height: '28px', fontSize: '11px' }}
                onClick={() => handlePrintVoucher(completedReturn?.returnRecord)}
                disabled={!completedReturn}
              >
                🖨 Print
              </button>
              <button
                type="button"
                className="cdr-btn-classic"
                style={{ minWidth: '80px', height: '28px', fontSize: '11px' }}
                onClick={handleCancel}
              >
                ✖ Cancel
              </button>
            </div>
          </>
        ) : (
          /* View Tab: Returns History Log & Inspection */
          <section className="cdr-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="cdr-panel-title">
              <span>Customer Returns &amp; Damage Tracking History</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  className="cdr-input"
                  placeholder="Search by Return #, Invoice #, Item, Customer, Status..."
                  style={{ width: '300px' }}
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                />
                <button
                  type="button"
                  className="cdr-btn-classic"
                  onClick={fetchReturnsHistory}
                  disabled={loadingHistory}
                >
                  {loadingHistory ? 'Refreshing...' : 'Refresh Log'}
                </button>
              </div>
            </div>

            <div className="cdr-table-container" style={{ maxHeight: 'calc(100vh - 190px)', flex: 1 }}>
              <table className="cdr-table">
                <thead>
                  <tr>
                    <th style={{ width: '85px' }}>Return #</th>
                    <th style={{ width: '75px' }}>Date</th>
                    <th style={{ width: '75px' }}>Invoice #</th>
                    <th>Customer Name</th>
                    <th style={{ width: '90px' }}>Item Code</th>
                    <th>Description</th>
                    <th style={{ width: '45px', textAlign: 'right' }}>Qty</th>
                    <th>Condition / Reason</th>
                    <th style={{ width: '110px' }}>Resolution</th>
                    <th>Supplier Traced</th>
                    <th style={{ width: '85px', textAlign: 'center' }}>Damage Status</th>
                    <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan="12" style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
                        {loadingHistory ? 'Loading history...' : 'No returns or exchanges recorded.'}
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((ret) => (
                      <tr key={ret._id}>
                        <td><strong>{ret.returnNumber}</strong></td>
                        <td>{formatDate(ret.date)}</td>
                        <td>{ret.invoiceNumber}</td>
                        <td>{ret.customerName}</td>
                        <td><strong>{ret.returnedItem?.itemCode}</strong></td>
                        <td>{ret.returnedItem?.description || '-'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#b91c1c' }}>
                          {ret.returnedItem?.returnedQuantity}
                        </td>
                        <td>
                          {ret.itemCondition === 'GOOD' ? (
                            <span style={{ color: '#15803d', fontWeight: 'bold' }}>GOOD (Exchange)</span>
                          ) : (
                            <span>{ret.returnedItem?.damageReason || 'DAMAGED'}</span>
                          )}
                        </td>
                        <td>
                          {ret.disposition === 'REPLACEMENT' ? (
                            <span className="cdr-badge info">
                              Repl: {ret.replacement?.quantity}x {ret.replacement?.itemCode}
                            </span>
                          ) : ret.disposition === 'SUPPLIER_CLAIM' ? (
                            <span className="cdr-badge warning">
                              Claim #{ret.supplierClaimNumber || 'Pending'}
                            </span>
                          ) : (
                            <span className="cdr-badge danger">Quarantined</span>
                          )}
                        </td>
                        <td>{ret.supplierTraceability?.supplierName || '-'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className={`cdr-badge ${
                              ret.damageStatus === 'RESOLVED'
                                ? 'success'
                                : ret.damageStatus === 'UNDER INSPECTION'
                                ? 'warning'
                                : 'info'
                            }`}
                          >
                            {ret.damageStatus || ret.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="cdr-btn-classic"
                              style={{ height: '18px', padding: '0 4px', fontSize: '9px' }}
                              onClick={() => handleOpenInspectModal(ret, ret.disposition === 'SUPPLIER_CLAIM' ? 'claim' : 'inspection')}
                              title="Update inspection or manage supplier claim"
                            >
                              {ret.disposition === 'SUPPLIER_CLAIM' || ret.supplierClaimNumber ? 'Claim / Inspect' : 'Inspect'}
                            </button>
                            <button
                              type="button"
                              className="cdr-btn-classic"
                              style={{ height: '18px', padding: '0 4px', fontSize: '9px' }}
                              onClick={() => handlePrintVoucher(ret)}
                              title="Print Return Voucher"
                            >
                              Print
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 4. Bottom Status Footer */}
        <footer className="cdr-footer">
          <div className="cdr-footer-left">
            <span><strong>Ready</strong></span>
            <span>Module: <strong>Customer Return, Exchange &amp; Damage Tracking</strong></span>
            <span>User: <strong>{cashierUser}</strong></span>
          </div>
          <div className="cdr-footer-right">
            <button
              type="button"
              className="cdr-btn-classic"
              onClick={() => navigate('/invoice')}
            >
              Create Invoice
            </button>
            <button
              type="button"
              className="cdr-btn-classic"
              onClick={() => navigate('/remaining-balance')}
            >
              Remaining Balance
            </button>
            <button
              type="button"
              className="cdr-btn-classic"
              onClick={() => navigate('/management')}
            >
              Close
            </button>
          </div>
        </footer>
      </main>

      {/* 5. Inspection & Supplier Claim Management Modal */}
      {inspectingReturn && (
        <div className="cdr-modal-backdrop">
          <div className="cdr-modal-box" style={{ maxWidth: '680px' }}>
            <div className="cdr-modal-header">
              <span>Inspect Return &amp; Manage Supplier Claim - {inspectingReturn.returnNumber}</span>
              <button
                type="button"
                className="cdr-ctrl-btn close"
                onClick={() => setInspectingReturn(null)}
              >
                &#x2715;
              </button>
            </div>

            {/* Modal Sub-Tab Selector */}
            <div style={{ display: 'flex', borderBottom: '1px solid #7f9db9', backgroundColor: '#e2dfd5', padding: '4px 8px 0' }}>
              <button
                type="button"
                style={{
                  padding: '3px 12px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  border: '1px solid #7f9db9',
                  borderBottom: modalSubTab === 'inspection' ? '1px solid #ffffff' : '1px solid #7f9db9',
                  backgroundColor: modalSubTab === 'inspection' ? '#ffffff' : '#d4d0c8',
                  cursor: 'pointer',
                  marginRight: '3px',
                }}
                onClick={() => setModalSubTab('inspection')}
              >
                1. Item Inspection &amp; Condition
              </button>
              <button
                type="button"
                style={{
                  padding: '3px 12px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  border: '1px solid #7f9db9',
                  borderBottom: modalSubTab === 'claim' ? '1px solid #ffffff' : '1px solid #7f9db9',
                  backgroundColor: modalSubTab === 'claim' ? '#ffffff' : '#d4d0c8',
                  cursor: 'pointer',
                }}
                onClick={() => setModalSubTab('claim')}
              >
                2. Supplier Claim &amp; Replacement
                {(inspectingReturn.supplierClaim?.claimStatus || inspectingReturn.supplierClaimNumber) && (
                  <span style={{ marginLeft: '4px', fontSize: '9px', color: '#0369a1' }}>
                    ({inspectingReturn.supplierClaim?.claimStatus || 'PENDING'})
                  </span>
                )}
              </button>
            </div>

            <div className="cdr-modal-body" style={{ maxHeight: '70vh' }}>
              {/* Return Item Summary Card */}
              <div style={{ padding: '6px 8px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span><strong>Return Ref:</strong> {inspectingReturn.returnNumber} | <strong>Invoice:</strong> #{inspectingReturn.invoiceNumber}</span>
                  <span><strong>Date:</strong> {formatDate(inspectingReturn.date)}</span>
                </div>
                <div><strong>Customer:</strong> {inspectingReturn.customerName}</div>
                <div><strong>Item:</strong> [{inspectingReturn.returnedItem?.itemCode}] {inspectingReturn.returnedItem?.description}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                  <span><strong>Returned Qty:</strong> <span style={{ color: '#b91c1c', fontWeight: 'bold' }}>{inspectingReturn.returnedItem?.returnedQuantity}</span></span>
                  <span><strong>Condition:</strong> {inspectingReturn.itemCondition || 'DAMAGED'}</span>
                  <span><strong>Damage Reason:</strong> {inspectingReturn.returnedItem?.damageReason || '-'}</span>
                </div>
              </div>

              {modalSubTab === 'inspection' ? (
                <>
                  <div className="cdr-field-group">
                    <label className="cdr-label">Damage / Inspection Status:</label>
                    <select
                      className="cdr-select"
                      value={modalDamageStatus}
                      onChange={(e) => setModalDamageStatus(e.target.value)}
                    >
                      <option value="RECEIVED">RECEIVED</option>
                      <option value="UNDER INSPECTION">UNDER INSPECTION</option>
                      <option value="CLAIM PENDING">CLAIM PENDING</option>
                      <option value="REPLACEMENT APPROVED">REPLACEMENT APPROVED</option>
                      <option value="RESOLVED">RESOLVED</option>
                    </select>
                  </div>

                  <div className="cdr-field-group">
                    <label className="cdr-label">Inspection Condition Result:</label>
                    <select
                      className="cdr-select"
                      value={modalConditionResult}
                      onChange={(e) => setModalConditionResult(e.target.value)}
                    >
                      <option value="DAMAGED_QUARANTINE">DAMAGED_QUARANTINE (Keep in quarantine)</option>
                      <option value="SELLABLE_STOCK">SELLABLE_STOCK (Approved - restore to sellable stock)</option>
                      <option value="REJECTED_RETURN">REJECTED_RETURN (Rejected)</option>
                      <option value="SCRAP_WRITEOFF">SCRAP_WRITEOFF (Unsalvageable)</option>
                    </select>
                    {modalConditionResult === 'SELLABLE_STOCK' && (
                      <span style={{ fontSize: '10px', color: '#15803d', fontWeight: 'bold', marginTop: '2px' }}>
                        Note: Selecting SELLABLE_STOCK will automatically restore returned quantity from quarantine into sellable stock!
                      </span>
                    )}
                  </div>

                  <div className="cdr-field-group">
                    <label className="cdr-label">Inspection Notes &amp; Findings:</label>
                    <textarea
                      className="cdr-textarea"
                      rows="3"
                      placeholder="Record inspection results, defects observed, next action..."
                      value={modalInspectionNotes}
                      onChange={(e) => setModalInspectionNotes(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '4px' }}>
                    <button
                      type="button"
                      className="cdr-btn-classic primary"
                      onClick={handleSaveInspection}
                      disabled={isSavingInspection}
                    >
                      {isSavingInspection ? 'Saving Inspection...' : 'Save Inspection Details'}
                    </button>
                  </div>
                </>
              ) : (
                /* Sub-Tab 2: Supplier Claim & Replacement Workflow */
                <>
                  {/* Supplier Traceability & GRN Information Box */}
                  <div style={{ backgroundColor: '#f1f5f9', border: '1px solid #94a3b8', padding: '6px 8px', fontSize: '11px' }}>
                    <div style={{ fontWeight: 'bold', color: '#000080', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px', marginBottom: '4px' }}>
                      Linked Supplier &amp; Purchase Traceability (From GRN)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
                      <div>
                        <strong>Supplier:</strong>{' '}
                        {inspectingReturn.supplierClaim?.supplierName ||
                          inspectingReturn.supplierTraceability?.supplierName ||
                          'Not Specified'}
                      </div>
                      <div>
                        <strong>Telephone:</strong>{' '}
                        {inspectingReturn.supplierClaim?.supplierTelephone ||
                          inspectingReturn.supplierTraceability?.supplierTelephone ||
                          '-'}
                      </div>
                      <div>
                        <strong>Supplier Invoice #:</strong>{' '}
                        {inspectingReturn.supplierClaim?.supplierInvoiceNo ||
                          inspectingReturn.supplierTraceability?.supplierInvoiceNo ||
                          '-'}
                      </div>
                      <div>
                        <strong>GRN Reference:</strong>{' '}
                        {inspectingReturn.supplierClaim?.grnNumber ||
                          inspectingReturn.supplierTraceability?.grnNumber ||
                          '-'}
                      </div>
                      <div>
                        <strong>Claim Number:</strong>{' '}
                        <span style={{ fontWeight: 'bold', color: '#b45309' }}>
                          {inspectingReturn.supplierClaim?.claimNumber ||
                            inspectingReturn.supplierClaimNumber ||
                            (inspectingReturn.returnNumber ? `SDC-${inspectingReturn.returnNumber.replace('CDR-', '')}` : 'Pending')}
                        </span>
                      </div>
                      <div>
                        <strong>Claim Date:</strong>{' '}
                        {formatDate(inspectingReturn.supplierClaim?.claimDate || inspectingReturn.date)}
                      </div>
                    </div>
                  </div>

                  {/* Supplier Claim Status & Response Controls */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div className="cdr-field-group">
                      <label className="cdr-label">Supplier Claim Status:</label>
                      <select
                        className="cdr-select"
                        value={modalClaimStatus}
                        onChange={(e) => setModalClaimStatus(e.target.value)}
                      >
                        <option value="PENDING">PENDING (Pending Review)</option>
                        <option value="SUBMITTED">SUBMITTED (Sent to Supplier)</option>
                        <option value="ACKNOWLEDGED">ACKNOWLEDGED (Supplier Acknowledged)</option>
                        <option value="INSPECTION_BY_SUPPLIER">INSPECTION_BY_SUPPLIER</option>
                        <option value="REPLACEMENT_RECEIVED">REPLACEMENT_RECEIVED</option>
                        <option value="CREDIT_NOTE_ISSUED">CREDIT_NOTE_ISSUED</option>
                        <option value="REJECTED">REJECTED</option>
                        <option value="RESOLVED">RESOLVED (Closed)</option>
                      </select>
                    </div>

                    <div className="cdr-field-group">
                      <label className="cdr-label">Supplier Response:</label>
                      <select
                        className="cdr-select"
                        value={modalSupplierResponse}
                        onChange={(e) => setModalSupplierResponse(e.target.value)}
                      >
                        <option value="PENDING">PENDING (Awaiting Response)</option>
                        <option value="APPROVED_REPLACEMENT">APPROVED_REPLACEMENT</option>
                        <option value="APPROVED_CREDIT_NOTE">APPROVED_CREDIT_NOTE</option>
                        <option value="REJECTED">REJECTED</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div className="cdr-field-group">
                      <label className="cdr-label">Resolution Type:</label>
                      <select
                        className="cdr-select"
                        value={modalResolutionType}
                        onChange={(e) => setModalResolutionType(e.target.value)}
                      >
                        <option value="REPLACEMENT">REPLACEMENT (Supplier Replacement)</option>
                        <option value="CREDIT_NOTE">CREDIT_NOTE (Supplier Credit Note)</option>
                        <option value="REPAIR">REPAIR (Supplier Repair)</option>
                        <option value="REJECTED">REJECTED (No Compensation)</option>
                      </select>
                    </div>

                    <div className="cdr-field-group">
                      <label className="cdr-label">Credit Note Reference (If applicable):</label>
                      <input
                        type="text"
                        className="cdr-input"
                        placeholder="e.g. CN-2026-0042"
                        value={modalCreditNoteRef}
                        onChange={(e) => setModalCreditNoteRef(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="cdr-field-group">
                    <label className="cdr-label">Supplier Claim Notes / Remarks:</label>
                    <textarea
                      className="cdr-textarea"
                      rows="2"
                      placeholder="Notes regarding communication with supplier, return delivery note, credit note terms..."
                      value={modalClaimNotes}
                      onChange={(e) => setModalClaimNotes(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                    <button
                      type="button"
                      className="cdr-btn-classic primary"
                      onClick={handleSaveSupplierClaim}
                      disabled={isSavingClaim}
                    >
                      {isSavingClaim ? 'Saving Claim...' : 'Save Supplier Claim'}
                    </button>
                  </div>

                  {/* Physical Replacement Receipt Section */}
                  <div style={{ marginTop: '8px', borderTop: '1px solid #cbd5e1', paddingTop: '8px' }}>
                    <div style={{ fontWeight: 'bold', color: '#0369a1', marginBottom: '4px' }}>
                      Physical Replacement Receipt (Restores Sellable Inventory):
                    </div>

                    {inspectingReturn.supplierClaim?.replacementReceived?.received ? (
                      <div style={{ backgroundColor: '#dcfce7', border: '1px solid #86efac', padding: '6px 8px', color: '#166534', fontSize: '11px' }}>
                        <div><strong>✓ Replacement Received &amp; Stock Restored:</strong></div>
                        <div>
                          Quantity: <strong>{inspectingReturn.supplierClaim.replacementReceived.quantityReceived} unit(s)</strong> of item [<strong>{inspectingReturn.supplierClaim.replacementReceived.replacementItemCode}</strong>]
                        </div>
                        <div>
                          Date Received: {formatDate(inspectingReturn.supplierClaim.replacementReceived.receivedDate)} | DO #: {inspectingReturn.supplierClaim.replacementReceived.deliveryNoteNo || 'N/A'} | Handled By: {inspectingReturn.supplierClaim.replacementReceived.receivedBy}
                        </div>
                      </div>
                    ) : (
                      <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', padding: '6px 8px' }}>
                        {!showReplacementReceiptForm ? (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: '#92400e' }}>
                              Has supplier delivered the replacement item? Receive it here to automatically restore sellable stock.
                            </span>
                            <button
                              type="button"
                              className="cdr-btn-classic"
                              style={{ backgroundColor: '#16a34a', color: '#ffffff', fontWeight: 'bold' }}
                              onClick={() => setShowReplacementReceiptForm(true)}
                            >
                              + Receive Replacement
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#92400e' }}>
                              Record Supplier Replacement Goods Receipt:
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '6px' }}>
                              <div className="cdr-field-group">
                                <label className="cdr-label">Delivery Note / DO #:</label>
                                <input
                                  type="text"
                                  className="cdr-input"
                                  placeholder="e.g. DN-9912"
                                  value={modalDeliveryNoteNo}
                                  onChange={(e) => setModalDeliveryNoteNo(e.target.value)}
                                />
                              </div>
                              <div className="cdr-field-group">
                                <label className="cdr-label">Received Qty:</label>
                                <input
                                  type="number"
                                  className="cdr-input"
                                  min="1"
                                  value={modalReceivedQty}
                                  onChange={(e) => setModalReceivedQty(e.target.value)}
                                />
                              </div>
                              <div className="cdr-field-group">
                                <label className="cdr-label">Replacement Item Code:</label>
                                <input
                                  type="text"
                                  className="cdr-input"
                                  value={modalReplacementItemCode}
                                  onChange={(e) => setModalReplacementItemCode(e.target.value)}
                                />
                              </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '2px' }}>
                              <button
                                type="button"
                                className="cdr-btn-classic"
                                onClick={() => setShowReplacementReceiptForm(false)}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="cdr-btn-classic primary"
                                onClick={handleReceiveReplacement}
                                disabled={isReceivingReplacement}
                              >
                                {isReceivingReplacement ? 'Processing Stock In...' : 'Confirm Stock Receipt (Restores Sellable Stock)'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="cdr-modal-footer">
              <button
                type="button"
                className="cdr-btn-classic"
                onClick={() => setInspectingReturn(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Printable Return & Exchange Voucher Modal */}
      {printingReturn && (
        <div className="cdr-modal-backdrop">
          <div className="cdr-modal-box" style={{ maxWidth: '520px' }}>
            <div className="cdr-modal-header cdr-no-print">
              <span>Return &amp; Exchange Voucher - {printingReturn.returnNumber}</span>
              <button
                type="button"
                className="cdr-ctrl-btn close"
                onClick={() => setPrintingReturn(null)}
              >
                &#x2715;
              </button>
            </div>
            <div className="cdr-modal-body" style={{ maxHeight: '75vh' }}>
              <div className="cdr-print-container">
                <div style={{ textAlign: 'center', marginBottom: '8px', borderBottom: '1px dashed #000', paddingBottom: '6px' }}>
                  <div style={{ fontSize: '16px', fontWeight: 'bold' }}>SOFAST MOTORS</div>
                  <div style={{ fontSize: '11px' }}>AUTOMOTIVE PARTS &amp; ACCESSORIES</div>
                  <div style={{ fontSize: '11px', marginTop: '4px' }}>CUSTOMER RETURN &amp; EXCHANGE VOUCHER</div>
                </div>

                <div style={{ fontSize: '11px', lineHeight: '1.4', marginBottom: '8px' }}>
                  <div><strong>Return Ref:</strong> {printingReturn.returnNumber}</div>
                  <div><strong>Date:</strong> {formatDate(printingReturn.date)}</div>
                  <div><strong>Invoice #:</strong> #{printingReturn.invoiceNumber}</div>
                  <div><strong>Customer:</strong> {printingReturn.customerName}</div>
                  <div><strong>Cashier:</strong> {cashierUser}</div>
                </div>

                <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '6px 0', margin: '6px 0' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>RETURNED ITEM:</div>
                  <div>[{printingReturn.returnedItem?.itemCode}] {printingReturn.returnedItem?.description}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Quantity: {printingReturn.returnedItem?.returnedQuantity}</span>
                    <span>Reason: {printingReturn.returnedItem?.damageReason}</span>
                  </div>
                  <div>Condition: {printingReturn.itemCondition || 'DAMAGED'}</div>
                </div>

                {printingReturn.replacement?.issued && (
                  <div style={{ borderBottom: '1px dashed #000', padding: '6px 0', margin: '6px 0' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>REPLACEMENT ITEM:</div>
                    <div>[{printingReturn.replacement?.itemCode}] {printingReturn.replacement?.description}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Quantity: {printingReturn.replacement?.quantity}</span>
                      <span>Rate: {formatCurrency(printingReturn.replacement?.unitPrice)}</span>
                    </div>
                    {printingReturn.replacement?.additionalPaymentRequired > 0 && (
                      <div style={{ fontWeight: 'bold', marginTop: '4px', textAlign: 'right' }}>
                        Customer Paid Difference: {formatCurrency(printingReturn.replacement?.additionalPaymentRequired)}
                      </div>
                    )}
                    {printingReturn.replacement?.refundAmount > 0 && (
                      <div style={{ fontWeight: 'bold', marginTop: '4px', textAlign: 'right' }}>
                        Refund / Credit to Customer: {formatCurrency(printingReturn.replacement?.refundAmount)}
                      </div>
                    )}
                  </div>
                )}

                {printingReturn.supplierTraceability?.supplierName && (
                  <div style={{ fontSize: '10px', color: '#333', marginTop: '6px' }}>
                    Supplier Traced: {printingReturn.supplierTraceability?.supplierName} (GRN: {printingReturn.supplierTraceability?.grnNumber || 'N/A'})
                  </div>
                )}

                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                  <div style={{ textAlign: 'center', width: '45%', borderTop: '1px dotted #000', paddingTop: '4px' }}>
                    Customer Signature
                  </div>
                  <div style={{ textAlign: 'center', width: '45%', borderTop: '1px dotted #000', paddingTop: '4px' }}>
                    Authorized Officer
                  </div>
                </div>
              </div>
            </div>
            <div className="cdr-modal-footer cdr-no-print">
              <button
                type="button"
                className="cdr-btn-classic primary"
                onClick={() => window.print()}
              >
                🖨 Print Voucher
              </button>
              <button
                type="button"
                className="cdr-btn-classic"
                onClick={() => setPrintingReturn(null)}
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

export default CustomerDamageReturn;
