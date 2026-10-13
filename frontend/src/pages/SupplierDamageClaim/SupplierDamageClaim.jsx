import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './SupplierDamageClaim.css';

/**
 * SOFAST MOTORS - Supplier Damage Claim & Replacement
 * Screen under Stock Control System to record returned defective items to suppliers,
 * track claim lifecycle, and update sellable inventory ONLY when physical replacement
 * goods are received and accepted into stores.
 */
function SupplierDamageClaim() {
  const navigate = useNavigate();

  // Navigation Menubar state
  const [activeDropdown, setActiveDropdown] = useState(null);
  const menuRef = useRef(null);

  // Data & State
  const [claims, setClaims] = useState([]);
  const [metrics, setMetrics] = useState({
    totalClaims: 0,
    pendingClaims: 0,
    sentToSupplier: 0,
    replacementsReceived: 0,
    totalDamagedUnitsInQuarantine: 0,
  });
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [showNewClaimModal, setShowNewClaimModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState(null);

  // New Claim Form State
  const [suppliersList, setSuppliersList] = useState([]);
  const [quarantineItems, setQuarantineItems] = useState([]);
  const [newSupplierCode, setNewSupplierCode] = useState('');
  const [newItemCode, setNewItemCode] = useState('');
  const [newQuantity, setNewQuantity] = useState('1');
  const [newReason, setNewReason] = useState('Defective / Failed Part');
  const [newInvoiceNo, setNewInvoiceNo] = useState('');
  const [newGrnNo, setNewGrnNo] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  // Receive Replacement Form State
  const [receiveQty, setReceiveQty] = useState('1');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [acceptedBy, setAcceptedBy] = useState(
    localStorage.getItem('username') || localStorage.getItem('userCode') || 'Stores'
  );
  const [receiveRemarks, setReceiveRemarks] = useState('');
  const [isSubmittingReceive, setIsSubmittingReceive] = useState(false);

  // Send to Supplier Form State
  const [sentReference, setSentReference] = useState('');
  const [sentNotes, setSentNotes] = useState('');
  const [isSubmittingSend, setIsSubmittingSend] = useState(false);

  const cashierUser =
    localStorage.getItem('username') || localStorage.getItem('userCode') || 'PC004';

  // Navigation Menubar Items (Matching Classic SOFAST ERP)
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
    { id: 'good-receive-note', label: 'Good Receive Note (GRN)', path: '/grn' },
    { id: 'damage-stock', label: 'Damage Stock', path: '/damage-stock' },
    { id: 'supplier-damage-claim', label: 'Supplier Damage Claim / Replacement', path: '/supplier-damage-claim' },
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

  const showNotification = (msg, type = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  // Fetch Claims from Backend
  const fetchClaims = async () => {
    try {
      setLoading(true);
      const res = await api.get('/supplier-claims?limit=250');
      if (res.data?.success) {
        setClaims(res.data.data || []);
        if (res.data.metrics) {
          setMetrics(res.data.metrics);
        }
        if (res.data.quarantineItems) {
          setQuarantineItems(res.data.quarantineItems);
        }
      }
    } catch (err) {
      showNotification('Failed to load supplier claims data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();

    // Fetch suppliers list
    api
      .get('/suppliers')
      .then((res) => {
        if (res.data?.data) {
          setSuppliersList(res.data.data);
        }
      })
      .catch(() => null);
  }, []);

  // Filter Claims
  const filteredClaims = claims.filter((cl) => {
    if (statusFilter !== 'ALL' && cl.claimStatus !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        String(cl.claimNumber || '').toLowerCase().includes(q) ||
        String(cl.supplierName || '').toLowerCase().includes(q) ||
        String(cl.supplierCode || '').toLowerCase().includes(q) ||
        String(cl.itemCode || '').toLowerCase().includes(q) ||
        String(cl.description || '').toLowerCase().includes(q) ||
        String(cl.customerReturnNumber || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Handle Create New Claim Submit
  const handleCreateClaim = async (e) => {
    if (e) e.preventDefault();

    if (!newSupplierCode) {
      showNotification('Please select a supplier', 'error');
      return;
    }
    if (!newItemCode) {
      showNotification('Please enter or select an item code', 'error');
      return;
    }
    const qNum = parseFloat(newQuantity);
    if (isNaN(qNum) || qNum <= 0) {
      showNotification('Please enter a valid quantity greater than 0', 'error');
      return;
    }

    const suppObj = suppliersList.find((s) => s.code === newSupplierCode);

    const payload = {
      supplierCode: newSupplierCode,
      supplierName: suppObj ? suppObj.name : newSupplierCode,
      supplierTelephone: suppObj ? suppObj.telephone || suppObj.telephone1 || '' : '',
      supplierInvoiceNo: newInvoiceNo,
      grnNumber: newGrnNo,
      itemCode: newItemCode,
      quantity: qNum,
      damageReason: newReason,
      notes: newNotes,
    };

    try {
      setIsSubmittingNew(true);
      const res = await api.post('/supplier-claims', payload);
      if (res.data?.success) {
        showNotification(
          `Supplier Claim '${res.data.data?.claimNumber}' created successfully!`,
          'success'
        );
        setShowNewClaimModal(false);
        setNewSupplierCode('');
        setNewItemCode('');
        setNewQuantity('1');
        setNewNotes('');
        fetchClaims();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create supplier claim';
      showNotification(msg, 'error');
    } finally {
      setIsSubmittingNew(false);
    }
  };

  // Handle Mark Sent to Supplier
  const handleSendClaim = async (e) => {
    if (e) e.preventDefault();
    if (!selectedClaim) return;

    try {
      setIsSubmittingSend(true);
      const res = await api.patch(`/supplier-claims/${selectedClaim._id}/status`, {
        status: 'SENT_TO_SUPPLIER',
        sentReference,
        notes: sentNotes,
      });
      if (res.data?.success) {
        showNotification(
          `Claim '${selectedClaim.claimNumber}' marked as SENT TO SUPPLIER`,
          'success'
        );
        setShowSendModal(false);
        setSelectedClaim(null);
        setSentReference('');
        setSentNotes('');
        fetchClaims();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update claim status';
      showNotification(msg, 'error');
    } finally {
      setIsSubmittingSend(false);
    }
  };

  // Handle Physical Replacement Receipt
  const handleReceiveReplacement = async (e) => {
    if (e) e.preventDefault();
    if (!selectedClaim) return;

    const rQty = parseFloat(receiveQty);
    if (isNaN(rQty) || rQty <= 0) {
      showNotification('Please enter a valid received quantity greater than 0', 'error');
      return;
    }

    try {
      setIsSubmittingReceive(true);
      const res = await api.post(
        `/supplier-claims/${selectedClaim._id}/receive-replacement`,
        {
          quantityReceived: rQty,
          deliveryNoteNo: deliveryNote,
          acceptedBy,
          remarks: receiveRemarks,
        }
      );
      if (res.data?.success) {
        showNotification(
          res.data.message || 'Physical replacement accepted. Sellable stock updated!',
          'success'
        );
        setShowReceiveModal(false);
        setSelectedClaim(null);
        setDeliveryNote('');
        setReceiveRemarks('');
        fetchClaims();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to receive replacement';
      showNotification(msg, 'error');
    } finally {
      setIsSubmittingReceive(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toISOString().split('T')[0];
    } catch (e) {
      return String(dateStr);
    }
  };

  return (
    <div className="sdc-page-wrapper">
      {/* 1. Classic Windows Blue Header */}
      <header className="sdc-win-titlebar">
        <div className="sdc-win-title-left">
          <svg className="sdc-ctrl-btn" style={{ width: '15px', height: '15px', fill: '#ffcc00' }} viewBox="0 0 24 24">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z" />
          </svg>
          <span>SOFAST MOTORS - Supplier Damage Claim & Replacement</span>
        </div>
        <div className="sdc-win-controls">
          <button
            type="button"
            className="sdc-ctrl-btn"
            onClick={() => navigate('/management')}
            title="Minimize"
          >
            &#8212;
          </button>
          <button type="button" className="sdc-ctrl-btn" title="Maximize">
            &#9633;
          </button>
          <button
            type="button"
            className="sdc-ctrl-btn close"
            onClick={() => navigate('/management')}
            title="Close"
          >
            &#x2715;
          </button>
        </div>
      </header>

      {/* 2. Top Classic Menubar */}
      <nav className="sdc-menubar-container" ref={menuRef}>
        <ul className="sdc-menubar">
          {topMenuItems.map((item) => (
            <li key={item.id} className="sdc-menu-item-wrapper">
              <button
                type="button"
                className={`sdc-menubar-btn ${
                  activeDropdown === item.id ? 'active' : ''
                }`}
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
                <ul className="sdc-dropdown-menu">
                  {masterFilesDropdownItems.map((dropItem) => (
                    <li key={dropItem.id} className="sdc-dropdown-entry">
                      <button
                        type="button"
                        className="sdc-dropdown-item-btn"
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
                <ul className="sdc-dropdown-menu">
                  {stockControlDropdownItems.map((dropItem) => (
                    <li key={dropItem.id} className="sdc-dropdown-entry">
                      <button
                        type="button"
                        className={`sdc-dropdown-item-btn ${
                          dropItem.id === 'supplier-damage-claim' ? 'selected' : ''
                        }`}
                        onClick={() => {
                          setActiveDropdown(null);
                          navigate(dropItem.path);
                        }}
                      >
                        <span>{dropItem.label}</span>
                        {dropItem.id === 'supplier-damage-claim' && <span>&#10003;</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Sales and Service Dropdown */}
              {item.id === 'sales-service' && activeDropdown === 'sales-service' && (
                <ul className="sdc-dropdown-menu">
                  {salesServiceDropdownItems.map((dropItem) => (
                    <li key={dropItem.id} className="sdc-dropdown-entry">
                      <button
                        type="button"
                        className="sdc-dropdown-item-btn"
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
                <ul className="sdc-dropdown-menu">
                  {administrationDropdownItems.map((dropItem) => (
                    <li key={dropItem.id} className="sdc-dropdown-entry">
                      <button
                        type="button"
                        className="sdc-dropdown-item-btn"
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
      <main className="sdc-main-container">
        {/* Notification Banner */}
        {notification && (
          <div className={`sdc-alert ${notification.type}`}>
            <span>{notification.message}</span>
            <button
              type="button"
              className="sdc-ctrl-btn"
              style={{ width: '16px', height: '16px', fontSize: '9px' }}
              onClick={() => setNotification(null)}
            >
              &#x2715;
            </button>
          </div>
        )}

        {/* KPI Summary Cards */}
        <div className="sdc-kpi-row">
          <div className="sdc-kpi-card">
            <span className="sdc-kpi-title">Total Claims</span>
            <span className="sdc-kpi-val">{metrics.totalClaims}</span>
          </div>
          <div className="sdc-kpi-card">
            <span className="sdc-kpi-title">Pending Inspection</span>
            <span className="sdc-kpi-val pending">{metrics.pendingClaims}</span>
          </div>
          <div className="sdc-kpi-card">
            <span className="sdc-kpi-title">Sent to Supplier</span>
            <span className="sdc-kpi-val sent">{metrics.sentToSupplier}</span>
          </div>
          <div className="sdc-kpi-card">
            <span className="sdc-kpi-title">Replacements Received</span>
            <span className="sdc-kpi-val received">{metrics.replacementsReceived}</span>
          </div>
          <div className="sdc-kpi-card">
            <span className="sdc-kpi-title">Quarantine Stock Units</span>
            <span className="sdc-kpi-val quarantine">{metrics.totalDamagedUnitsInQuarantine}</span>
          </div>
        </div>

        {/* Filter Bar & Actions */}
        <section className="sdc-panel">
          <div className="sdc-filter-bar">
            <span style={{ fontWeight: 'bold' }}>Filter Claims:</span>
            <input
              type="text"
              className="sdc-input"
              style={{ width: '220px' }}
              placeholder="Search by Claim #, Supplier, Item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <select
              className="sdc-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="SENT_TO_SUPPLIER">Sent to Supplier</option>
              <option value="REPLACEMENT_RECEIVED">Replacement Received</option>
              <option value="REFUNDED">Refunded</option>
              <option value="REJECTED">Rejected</option>
            </select>

            <button
              type="button"
              className="sdc-btn-classic primary"
              onClick={() => setShowNewClaimModal(true)}
            >
              + New Supplier Claim
            </button>

            <button
              type="button"
              className="sdc-btn-classic"
              onClick={fetchClaims}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </section>

        {/* Claims Data Table */}
        <section className="sdc-table-container">
          <table className="sdc-table">
            <thead>
              <tr>
                <th style={{ width: '30px' }}>#</th>
                <th style={{ width: '85px' }}>Claim #</th>
                <th style={{ width: '80px' }}>Date</th>
                <th>Supplier Name</th>
                <th style={{ width: '90px' }}>Item Code</th>
                <th>Description</th>
                <th style={{ width: '60px', textAlign: 'right' }}>Qty</th>
                <th>Damage Reason</th>
                <th style={{ width: '90px' }}>Return Ref</th>
                <th style={{ width: '130px', textAlign: 'center' }}>Claim Status</th>
                <th style={{ width: '140px', textAlign: 'center' }}>Replacement Stock</th>
                <th style={{ width: '180px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClaims.length === 0 ? (
                <tr>
                  <td colSpan="12" style={{ textAlign: 'center', padding: '32px', color: '#666' }}>
                    {loading ? 'Loading claims from database...' : 'No supplier damage claims found.'}
                  </td>
                </tr>
              ) : (
                filteredClaims.map((cl, idx) => (
                  <tr key={cl._id}>
                    <td>{idx + 1}</td>
                    <td><strong>{cl.claimNumber}</strong></td>
                    <td>{formatDate(cl.date)}</td>
                    <td>
                      <strong>{cl.supplierName}</strong>
                      <span style={{ color: '#666', fontSize: '10px', display: 'block' }}>
                        {cl.supplierCode} {cl.supplierTelephone ? `(${cl.supplierTelephone})` : ''}
                      </span>
                    </td>
                    <td><strong>{cl.itemCode}</strong></td>
                    <td>{cl.description || '-'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{cl.quantity}</td>
                    <td>{cl.damageReason}</td>
                    <td>{cl.customerReturnNumber || '-'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        className={`sdc-badge ${
                          cl.claimStatus === 'REPLACEMENT_RECEIVED'
                            ? 'received'
                            : cl.claimStatus === 'SENT_TO_SUPPLIER'
                            ? 'sent'
                            : cl.claimStatus === 'PENDING'
                            ? 'pending'
                            : 'rejected'
                        }`}
                      >
                        {cl.claimStatus.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {cl.replacementReceipt?.received ? (
                        <span style={{ color: '#15803d', fontWeight: 'bold', fontSize: '10px' }}>
                          ✓ Received ({cl.replacementReceipt.quantityReceived} units)
                        </span>
                      ) : (
                        <span style={{ color: '#b45309', fontSize: '10px' }}>
                          Pending Physical Receipt
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
                        {cl.claimStatus === 'PENDING' && (
                          <button
                            type="button"
                            className="sdc-btn-classic"
                            style={{ height: '20px', fontSize: '10px' }}
                            onClick={() => {
                              setSelectedClaim(cl);
                              setShowSendModal(true);
                            }}
                          >
                            Send to Supplier
                          </button>
                        )}

                        {cl.claimStatus !== 'REPLACEMENT_RECEIVED' && (
                          <button
                            type="button"
                            className="sdc-btn-classic success"
                            style={{ height: '20px', fontSize: '10px' }}
                            onClick={() => {
                              setSelectedClaim(cl);
                              setReceiveQty(String(cl.quantity));
                              setShowReceiveModal(true);
                            }}
                            title="Accept physical replacement goods and increase sellable stock"
                          >
                            Receive Replacement
                          </button>
                        )}

                        {cl.claimStatus === 'REPLACEMENT_RECEIVED' && (
                          <span style={{ color: '#15803d', fontWeight: 'bold' }}>
                            ✓ Resolved
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        {/* Modal 1: New Supplier Claim */}
        {showNewClaimModal && (
          <div className="sdc-modal-overlay">
            <div className="sdc-modal-window">
              <div className="sdc-modal-header">
                <span>Create New Supplier Damage Claim</span>
                <button
                  type="button"
                  className="sdc-ctrl-btn close"
                  onClick={() => setShowNewClaimModal(false)}
                >
                  &#x2715;
                </button>
              </div>
              <form onSubmit={handleCreateClaim}>
                <div className="sdc-modal-body">
                  <div>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>
                      Supplier: <span style={{ color: 'red' }}>*</span>
                    </label>
                    <select
                      className="sdc-select"
                      style={{ width: '100%' }}
                      value={newSupplierCode}
                      onChange={(e) => setNewSupplierCode(e.target.value)}
                      required
                    >
                      <option value="">-- Select Supplier --</option>
                      {suppliersList.map((sup) => (
                        <option key={sup.code} value={sup.code}>
                          {sup.name} ({sup.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>
                        Item Code: <span style={{ color: 'red' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="sdc-input"
                        style={{ width: '100%' }}
                        placeholder="e.g. 05101051"
                        value={newItemCode}
                        onChange={(e) => setNewItemCode(e.target.value)}
                        required
                      />
                      {quarantineItems.length > 0 && (
                        <div style={{ marginTop: '3px', fontSize: '10px', color: '#b45309' }}>
                          Quarantine candidates:{' '}
                          {quarantineItems.slice(0, 3).map((qi) => (
                            <span
                              key={qi.code}
                              style={{ textDecoration: 'underline', cursor: 'pointer', marginRight: '6px' }}
                              onClick={() => {
                                setNewItemCode(qi.code);
                                setNewQuantity(String(qi.damagedStock));
                                if (qi.suppCode) setNewSupplierCode(qi.suppCode);
                              }}
                            >
                              {qi.code} ({qi.damagedStock} damaged)
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>
                        Quantity: <span style={{ color: 'red' }}>*</span>
                      </label>
                      <input
                        type="number"
                        className="sdc-input"
                        style={{ width: '100%' }}
                        min="1"
                        value={newQuantity}
                        onChange={(e) => setNewQuantity(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>
                      Damage Reason: <span style={{ color: 'red' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="sdc-input"
                      style={{ width: '100%' }}
                      placeholder="e.g. Defective casting, internal leakage, sensor fault"
                      value={newReason}
                      onChange={(e) => setNewReason(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>
                        Supplier Invoice #:
                      </label>
                      <input
                        type="text"
                        className="sdc-input"
                        style={{ width: '100%' }}
                        placeholder="Optional"
                        value={newInvoiceNo}
                        onChange={(e) => setNewInvoiceNo(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>
                        GRN Reference:
                      </label>
                      <input
                        type="text"
                        className="sdc-input"
                        style={{ width: '100%' }}
                        placeholder="Optional"
                        value={newGrnNo}
                        onChange={(e) => setNewGrnNo(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>
                      Notes / Instructions:
                    </label>
                    <textarea
                      className="sdc-input"
                      style={{ width: '100%', height: '40px' }}
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                    />
                  </div>
                </div>

                <div className="sdc-modal-footer">
                  <button
                    type="button"
                    className="sdc-btn-classic"
                    onClick={() => setShowNewClaimModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="sdc-btn-classic primary"
                    disabled={isSubmittingNew}
                  >
                    {isSubmittingNew ? 'Creating...' : 'Create Claim'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 2: Receive Physical Replacement Goods */}
        {showReceiveModal && selectedClaim && (
          <div className="sdc-modal-overlay">
            <div className="sdc-modal-window">
              <div className="sdc-modal-header">
                <span>Receive Physical Replacement - Claim #{selectedClaim.claimNumber}</span>
                <button
                  type="button"
                  className="sdc-ctrl-btn close"
                  onClick={() => setShowReceiveModal(false)}
                >
                  &#x2715;
                </button>
              </div>
              <form onSubmit={handleReceiveReplacement}>
                <div className="sdc-modal-body">
                  <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '6px 8px', fontSize: '11px', color: '#1e40af' }}>
                    <strong>Stock Rule:</strong> Increasing sellable stock will take effect immediately upon physical receipt & acceptance.
                  </div>

                  <div>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>
                      Claimed Item:
                    </label>
                    <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
                      {selectedClaim.itemCode} - {selectedClaim.description}
                    </span>
                    <span style={{ display: 'block', color: '#666', fontSize: '10px' }}>
                      Supplier: {selectedClaim.supplierName} ({selectedClaim.supplierCode}) | Claimed Qty: {selectedClaim.quantity}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>
                        Quantity Received & Accepted: <span style={{ color: 'red' }}>*</span>
                      </label>
                      <input
                        type="number"
                        className="sdc-input"
                        style={{ width: '100%', fontWeight: 'bold', color: '#15803d' }}
                        min="1"
                        value={receiveQty}
                        onChange={(e) => setReceiveQty(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>
                        Supplier Delivery Note / Dispatch #:
                      </label>
                      <input
                        type="text"
                        className="sdc-input"
                        style={{ width: '100%' }}
                        placeholder="e.g. DN-88421"
                        value={deliveryNote}
                        onChange={(e) => setDeliveryNote(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>
                      Accepted By / Stores Officer:
                    </label>
                    <input
                      type="text"
                      className="sdc-input"
                      style={{ width: '100%' }}
                      value={acceptedBy}
                      onChange={(e) => setAcceptedBy(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>
                      Remarks / Quality Inspection Notes:
                    </label>
                    <textarea
                      className="sdc-input"
                      style={{ width: '100%', height: '40px' }}
                      placeholder="Verified new packaging, tested working..."
                      value={receiveRemarks}
                      onChange={(e) => setReceiveRemarks(e.target.value)}
                    />
                  </div>
                </div>

                <div className="sdc-modal-footer">
                  <button
                    type="button"
                    className="sdc-btn-classic"
                    onClick={() => setShowReceiveModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="sdc-btn-classic success"
                    disabled={isSubmittingReceive}
                  >
                    {isSubmittingReceive ? 'Updating Stock...' : '✓ Accept Goods & Increase Sellable Stock'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 3: Mark Sent to Supplier */}
        {showSendModal && selectedClaim && (
          <div className="sdc-modal-overlay">
            <div className="sdc-modal-window">
              <div className="sdc-modal-header">
                <span>Dispatch / Send Claim to Supplier - #{selectedClaim.claimNumber}</span>
                <button
                  type="button"
                  className="sdc-ctrl-btn close"
                  onClick={() => setShowSendModal(false)}
                >
                  &#x2715;
                </button>
              </div>
              <form onSubmit={handleSendClaim}>
                <div className="sdc-modal-body">
                  <div>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>
                      Courier / Gate Pass / Dispatch Reference:
                    </label>
                    <input
                      type="text"
                      className="sdc-input"
                      style={{ width: '100%' }}
                      placeholder="e.g. Courier Waybill # or Gatepass Ref"
                      value={sentReference}
                      onChange={(e) => setSentReference(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>
                      Dispatch Notes:
                    </label>
                    <textarea
                      className="sdc-input"
                      style={{ width: '100%', height: '50px' }}
                      placeholder="Handed over to supplier representative..."
                      value={sentNotes}
                      onChange={(e) => setSentNotes(e.target.value)}
                    />
                  </div>
                </div>

                <div className="sdc-modal-footer">
                  <button
                    type="button"
                    className="sdc-btn-classic"
                    onClick={() => setShowSendModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="sdc-btn-classic primary"
                    disabled={isSubmittingSend}
                  >
                    {isSubmittingSend ? 'Saving...' : 'Mark as Sent'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 4. Bottom Status Footer */}
        <footer className="sdc-footer">
          <div className="sdc-footer-left">
            <span><strong>Ready</strong></span>
            <span>Total Claims: <strong>{filteredClaims.length}</strong></span>
            <span>User: <strong>{cashierUser}</strong></span>
          </div>
          <div className="sdc-footer-right">
            <button
              type="button"
              className="sdc-btn-classic"
              onClick={() => navigate('/grn')}
            >
              Good Receive Note
            </button>
            <button
              type="button"
              className="sdc-btn-classic"
              onClick={() => navigate('/customer-damage-return')}
            >
              Customer Damage Return
            </button>
            <button
              type="button"
              className="sdc-btn-classic"
              onClick={() => navigate('/management')}
            >
              Close
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default SupplierDamageClaim;
