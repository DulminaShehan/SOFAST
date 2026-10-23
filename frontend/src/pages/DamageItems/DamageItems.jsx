import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './DamageItems.css';

/**
 * SOFAST MOTORS - Damage Items Screen (Stock Control System)
 * Displays all items recorded as damaged through the Damage Claim workflow.
 * Strictly read-only: does not modify stock balances or create duplicate records.
 */
function DamageItems() {
  const navigate = useNavigate();

  // Navigation Menubar state
  const [activeDropdown, setActiveDropdown] = useState(null);
  const menuRef = useRef(null);

  // Data & Loading state
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 100, total: 0, pages: 1 });

  // Filter state
  const [search, setSearch] = useState('');
  const [claimNoFilter, setClaimNoFilter] = useState('');
  const [invoiceNoFilter, setInvoiceNoFilter] = useState('');
  const [itemFilter, setItemFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Selected row & Modals
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [recordToPrint, setRecordToPrint] = useState(null);

  // Sorting
  const [sortField, setSortField] = useState('claimDate');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' | 'desc'

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

  // Fetch damaged items
  const fetchDamageItems = async (customFilters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: customFilters.page || 1,
        limit: 100,
      };

      const s = customFilters.search !== undefined ? customFilters.search : search;
      if (s.trim()) params.search = s.trim();

      const cn = customFilters.claimNumber !== undefined ? customFilters.claimNumber : claimNoFilter;
      if (cn.trim()) params.claimNumber = cn.trim();

      const inv = customFilters.invoiceNumber !== undefined ? customFilters.invoiceNumber : invoiceNoFilter;
      if (inv.trim()) params.invoiceNumber = inv.trim();

      const itm = customFilters.itemCode !== undefined ? customFilters.itemCode : itemFilter;
      if (itm.trim()) params.itemCode = itm.trim();

      const sup = customFilters.supplier !== undefined ? customFilters.supplier : supplierFilter;
      if (sup.trim()) params.supplier = sup.trim();

      const st = customFilters.claimStatus !== undefined ? customFilters.claimStatus : statusFilter;
      if (st && st !== 'ALL') params.claimStatus = st;

      const fd = customFilters.fromDate !== undefined ? customFilters.fromDate : fromDate;
      if (fd) params.fromDate = fd;

      const td = customFilters.toDate !== undefined ? customFilters.toDate : toDate;
      if (td) params.toDate = td;

      const res = await api.get('/damage-items', { params });
      if (res.data && res.data.success) {
        setItems(res.data.data || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      } else {
        setItems([]);
      }
    } catch (err) {
      console.error('Failed to load damaged items:', err);
      setError(err.response?.data?.message || 'Failed to connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDamageItems();
  }, []);

  // Search handler
  const handleApplyFilter = (e) => {
    if (e) e.preventDefault();
    fetchDamageItems();
  };

  // Reset filter
  const handleResetFilters = () => {
    setSearch('');
    setClaimNoFilter('');
    setInvoiceNoFilter('');
    setItemFilter('');
    setSupplierFilter('');
    setStatusFilter('ALL');
    setFromDate('');
    setToDate('');
    fetchDamageItems({
      search: '',
      claimNumber: '',
      invoiceNumber: '',
      itemCode: '',
      supplier: '',
      claimStatus: 'ALL',
      fromDate: '',
      toDate: '',
    });
  };

  // Sort handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sort items client-side
  const sortedItems = [...items].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (valA === undefined || valA === null) valA = '';
    if (valB === undefined || valB === null) valB = '';

    if (sortField === 'damagedQuantity' || sortField === 'unitPrice') {
      valA = Number(valA) || 0;
      valB = Number(valB) || 0;
    } else if (sortField === 'claimDate' || sortField === 'purchaseDate') {
      valA = new Date(valA).getTime() || 0;
      valB = new Date(valB).getTime() || 0;
    } else {
      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Calculate KPIs
  const totalDamagedUnits = items.reduce((sum, item) => sum + (Number(item.damagedQuantity) || 0), 0);
  const pendingCount = items.filter((item) => {
    const st = (item.claimStatus || '').toLowerCase();
    return st.includes('pending') || st.includes('claim to supplier') || st.includes('supplier');
  }).length;
  const resolvedCount = items.filter((item) => {
    const st = (item.claimStatus || '').toLowerCase();
    return st.includes('resolved') || st.includes('replaced') || st.includes('completed');
  }).length;

  // View Details
  const handleViewDetails = (item) => {
    setSelectedRecord(item);
    setShowDetailModal(true);
  };

  // Open Print
  const handlePrintRecord = (item) => {
    setRecordToPrint(item);
    setShowPrintModal(true);
  };

  // Trigger Print
  const handlePrintSubmit = () => {
    window.print();
  };

  // Helper status class
  const getStatusBadgeClass = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('pending')) return 'pending';
    if (s.includes('claim to supplier') || s.includes('supplier')) return 'claim-to-supplier';
    if (s.includes('approved')) return 'replacement-approved';
    if (s.includes('replaced') || s.includes('resolved')) return 'resolved';
    if (s.includes('rejected')) return 'rejected';
    return 'pending';
  };

  // Format Date Helper
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? '-' : d.toISOString().split('T')[0];
    } catch {
      return '-';
    }
  };

  return (
    <div className="di-desktop-viewport">
      {/* Top Application Menubar */}
      <header className="di-system-menubar" ref={menuRef}>
        <div className="di-menu-left">
          {/* Master Files */}
          <div className="di-menu-item-wrapper">
            <button
              type="button"
              className={`di-menu-item-btn ${activeDropdown === 'master' ? 'active' : ''}`}
              onClick={() => setActiveDropdown(activeDropdown === 'master' ? null : 'master')}
            >
              Master Files
            </button>
            {activeDropdown === 'master' && (
              <div className="di-dropdown-panel">
                <button type="button" className="di-dropdown-action" onClick={() => navigate('/item-master')}>
                  Item Master
                </button>
                <button type="button" className="di-dropdown-action" onClick={() => navigate('/supplier-master')}>
                  Supplier Master
                </button>
                <button type="button" className="di-dropdown-action" onClick={() => navigate('/customer-master')}>
                  Customer Details
                </button>
                <button type="button" className="di-dropdown-action" onClick={() => navigate('/alternative-product')}>
                  Alternative Product
                </button>
              </div>
            )}
          </div>

          {/* Stock Control System */}
          <div className="di-menu-item-wrapper">
            <button
              type="button"
              className={`di-menu-item-btn ${activeDropdown === 'stock' ? 'active' : ''}`}
              onClick={() => setActiveDropdown(activeDropdown === 'stock' ? null : 'stock')}
            >
              Stock Control System
            </button>
            {activeDropdown === 'stock' && (
              <div className="di-dropdown-panel">
                <button type="button" className="di-dropdown-action" onClick={() => navigate('/grn')}>
                  Good Receive Note (GRN)
                </button>
                <button type="button" className="di-dropdown-action" onClick={() => navigate('/good-return-note')}>
                  Good Return Note (GREN)
                </button>
                <button type="button" className="di-dropdown-action" onClick={() => navigate('/damage')}>
                  Damage
                </button>
              </div>
            )}
          </div>

          {/* Sales and Service */}
          <div className="di-menu-item-wrapper">
            <button
              type="button"
              className={`di-menu-item-btn ${activeDropdown === 'sales' ? 'active' : ''}`}
              onClick={() => setActiveDropdown(activeDropdown === 'sales' ? null : 'sales')}
            >
              Sales and Service
            </button>
            {activeDropdown === 'sales' && (
              <div className="di-dropdown-panel">
                <button type="button" className="di-dropdown-action" onClick={() => navigate('/invoice')}>
                  Create Invoice
                </button>
                <button type="button" className="di-dropdown-action" onClick={() => navigate('/settlement-invoice')}>
                  Settlement Invoice
                </button>
                <button type="button" className="di-dropdown-action" onClick={() => navigate('/remaining-balance')}>
                  Remaining Balance
                </button>
              </div>
            )}
          </div>

          {/* Reports */}
          <div className="di-menu-item-wrapper">
            <button
              type="button"
              className={`di-menu-item-btn ${activeDropdown === 'reports' ? 'active' : ''}`}
              onClick={() => setActiveDropdown(activeDropdown === 'reports' ? null : 'reports')}
            >
              Reports
            </button>
            {activeDropdown === 'reports' && (
              <div className="di-dropdown-panel">
                <button type="button" className="di-dropdown-action" onClick={() => navigate('/reports')}>
                  Sales & Stock Reports
                </button>
              </div>
            )}
          </div>

          {/* Administration */}
          <div className="di-menu-item-wrapper">
            <button
              type="button"
              className={`di-menu-item-btn ${activeDropdown === 'admin' ? 'active' : ''}`}
              onClick={() => setActiveDropdown(activeDropdown === 'admin' ? null : 'admin')}
            >
              Administration
            </button>
            {activeDropdown === 'admin' && (
              <div className="di-dropdown-panel">
                <button type="button" className="di-dropdown-action" onClick={() => navigate('/printer-setup')}>
                  Printer Setup
                </button>
              </div>
            )}
          </div>

          <button type="button" className="di-menu-item-btn" onClick={() => navigate('/management')}>
            Exit
          </button>
        </div>

        <div className="di-menu-right">
          <span>SOFAST POS v3.4.1</span>
          <span className="di-system-status-pill">Connected</span>
        </div>
      </header>

      {/* Main ERP Window */}
      <main className="di-window-container">
        {/* Title Bar */}
        <div className="di-window-titlebar">
          <div className="di-titlebar-left">
            <svg className="di-folder-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
            </svg>
            <span className="di-window-title">Damage Items - Stock Control System</span>
          </div>
          <div className="di-titlebar-controls">
            <button type="button" className="di-window-btn" title="Minimize">_</button>
            <button type="button" className="di-window-btn" title="Maximize">□</button>
            <button type="button" className="di-window-btn close" title="Close" onClick={() => navigate('/management')}>✕</button>
          </div>
        </div>

        {/* Window Content */}
        <div className="di-window-body">
          {/* Section: Search & Filters */}
          <div className="di-section-card">
            <div className="di-section-header">
              <span>Filter Damaged Stock Records</span>
              <span style={{ fontSize: '11px', fontWeight: 'normal', opacity: 0.9 }}>
                Read-Only Audit Trail
              </span>
            </div>
            <div className="di-section-body">
              <form onSubmit={handleApplyFilter} className="di-filter-grid">
                {/* Search Term */}
                <div className="di-filter-item">
                  <span className="di-label-dots">Search:</span>
                  <input
                    type="text"
                    className="di-input"
                    placeholder="Search all fields..."
                    style={{ width: '150px' }}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                {/* Claim Number */}
                <div className="di-filter-item">
                  <span className="di-label-dots">Claim No:</span>
                  <input
                    type="text"
                    className="di-input"
                    placeholder="e.g. DC-2026-0001"
                    style={{ width: '130px' }}
                    value={claimNoFilter}
                    onChange={(e) => setClaimNoFilter(e.target.value)}
                  />
                </div>

                {/* Invoice Number */}
                <div className="di-filter-item">
                  <span className="di-label-dots">Invoice No:</span>
                  <input
                    type="text"
                    className="di-input"
                    placeholder="e.g. 47622"
                    style={{ width: '100px' }}
                    value={invoiceNoFilter}
                    onChange={(e) => setInvoiceNoFilter(e.target.value)}
                  />
                </div>

                {/* Item Code/Name */}
                <div className="di-filter-item">
                  <span className="di-label-dots">Item:</span>
                  <input
                    type="text"
                    className="di-input"
                    placeholder="Item code or name"
                    style={{ width: '140px' }}
                    value={itemFilter}
                    onChange={(e) => setItemFilter(e.target.value)}
                  />
                </div>

                {/* Supplier */}
                <div className="di-filter-item">
                  <span className="di-label-dots">Supplier:</span>
                  <input
                    type="text"
                    className="di-input"
                    placeholder="Supplier name"
                    style={{ width: '130px' }}
                    value={supplierFilter}
                    onChange={(e) => setSupplierFilter(e.target.value)}
                  />
                </div>

                {/* Claim Status */}
                <div className="di-filter-item">
                  <span className="di-label-dots">Status:</span>
                  <select
                    className="di-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="Claim to Supplier">Claim to Supplier</option>
                    <option value="Pending">Pending</option>
                    <option value="Replacement Approved">Replacement Approved</option>
                    <option value="Replaced">Replaced</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                {/* From Date */}
                <div className="di-filter-item">
                  <span className="di-label-dots">From:</span>
                  <input
                    type="date"
                    className="di-input"
                    style={{ width: '125px' }}
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </div>

                {/* To Date */}
                <div className="di-filter-item">
                  <span className="di-label-dots">To:</span>
                  <input
                    type="date"
                    className="di-input"
                    style={{ width: '125px' }}
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                  />
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                  <button type="submit" className="di-btn-compact primary">
                    🔍 Search
                  </button>
                  <button type="button" className="di-btn-compact" onClick={handleResetFilters}>
                    ↺ Reset
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Section: KPI Chips */}
          <div className="di-kpi-bar">
            <div className="di-kpi-chip">
              <span>Total Records:</span>
              <span className="di-kpi-badge">{pagination.total || items.length}</span>
            </div>
            <div className="di-kpi-chip">
              <span>Total Damaged Units:</span>
              <span className="di-kpi-badge amber">{totalDamagedUnits}</span>
            </div>
            <div className="di-kpi-chip">
              <span>Pending / With Supplier:</span>
              <span className="di-kpi-badge">{pendingCount}</span>
            </div>
            <div className="di-kpi-chip">
              <span>Resolved / Replaced:</span>
              <span className="di-kpi-badge green">{resolvedCount}</span>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="di-btn-compact"
                onClick={() => fetchDamageItems()}
                title="Refresh from database"
              >
                ⟳ Refresh
              </button>
              <button
                type="button"
                className="di-btn-compact primary"
                onClick={() => navigate('/damage-claim')}
                title="Create a new Damage Claim"
              >
                + New Damage Claim
              </button>
            </div>
          </div>

          {/* Section: Main Data Table */}
          <div className="di-table-container">
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>⌛</div>
                <div style={{ fontSize: '13px', fontWeight: 'bold' }}>Loading Damage Items...</div>
                <div style={{ fontSize: '11px' }}>Retrieving records from MongoDB database</div>
              </div>
            ) : error ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#b91c1c' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚠️</div>
                <div style={{ fontSize: '13px', fontWeight: 'bold' }}>Error Loading Damage Records</div>
                <div style={{ fontSize: '12px', margin: '6px 0 12px 0' }}>{error}</div>
                <button type="button" className="di-btn-compact primary" onClick={() => fetchDamageItems()}>
                  Retry Now
                </button>
              </div>
            ) : sortedItems.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>📦</div>
                <div style={{ fontSize: '13px', fontWeight: 'bold' }}>No Damaged Items Found</div>
                <div style={{ fontSize: '12px', margin: '4px 0 12px 0' }}>
                  No damage records matched your search criteria.
                </div>
                <button type="button" className="di-btn-compact" onClick={handleResetFilters}>
                  Clear Filters
                </button>
              </div>
            ) : (
              <table className="di-table">
                <thead>
                  <tr>
                    <th style={{ width: '35px', textAlign: 'center' }}>#</th>
                    <th onClick={() => handleSort('claimNumber')} style={{ cursor: 'pointer' }}>
                      Claim Number {sortField === 'claimNumber' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th onClick={() => handleSort('claimDate')} style={{ cursor: 'pointer' }}>
                      Claim Date {sortField === 'claimDate' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th onClick={() => handleSort('invoiceNumber')} style={{ cursor: 'pointer' }}>
                      Invoice No {sortField === 'invoiceNumber' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th onClick={() => handleSort('itemCode')} style={{ cursor: 'pointer' }}>
                      Item Code {sortField === 'itemCode' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th onClick={() => handleSort('itemDescription')} style={{ cursor: 'pointer' }}>
                      Item Description {sortField === 'itemDescription' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th onClick={() => handleSort('damagedQuantity')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                      Damaged Qty {sortField === 'damagedQuantity' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th onClick={() => handleSort('damageReason')} style={{ cursor: 'pointer' }}>
                      Damage Reason {sortField === 'damageReason' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th onClick={() => handleSort('supplierName')} style={{ cursor: 'pointer' }}>
                      Supplier Name {sortField === 'supplierName' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th>Supplier Inv No</th>
                    <th>GRN Number</th>
                    <th onClick={() => handleSort('claimStatus')} style={{ cursor: 'pointer', textAlign: 'center' }}>
                      Claim Status {sortField === 'claimStatus' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th style={{ textAlign: 'center', width: '130px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((item, index) => {
                    const isSelected = selectedRecord?._id === item._id;
                    return (
                      <tr
                        key={item._id || index}
                        className={isSelected ? 'selected' : ''}
                        onClick={() => setSelectedRecord(item)}
                      >
                        <td style={{ textAlign: 'center', color: '#64748b' }}>{index + 1}</td>
                        <td style={{ fontWeight: 600, color: '#1d4ed8' }}>
                          {item.claimNumber || item.returnNumber || '-'}
                        </td>
                        <td>{formatDate(item.claimDate)}</td>
                        <td style={{ fontWeight: 500 }}>{item.invoiceNumber || '-'}</td>
                        <td style={{ fontWeight: 600 }}>{item.itemCode || '-'}</td>
                        <td title={item.itemDescription}>
                          {item.itemDescription && item.itemDescription.length > 32
                            ? `${item.itemDescription.substring(0, 32)}...`
                            : item.itemDescription || '-'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                          {item.damagedQuantity}
                        </td>
                        <td>{item.damageReason || 'Broken'}</td>
                        <td title={item.supplierName}>
                          {item.supplierName && item.supplierName.length > 22
                            ? `${item.supplierName.substring(0, 22)}...`
                            : item.supplierName || 'N/A'}
                        </td>
                        <td>{item.supplierInvoiceNo || '-'}</td>
                        <td style={{ fontWeight: 500, color: '#0369a1' }}>{item.grnNumber || '-'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`di-status-tag ${getStatusBadgeClass(item.claimStatus)}`}>
                            {item.claimStatus || 'Pending'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '4px' }}>
                            <button
                              type="button"
                              className="di-btn-action"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewDetails(item);
                              }}
                              title="View full claim details"
                            >
                              👁 View
                            </button>
                            <button
                              type="button"
                              className="di-btn-action"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePrintRecord(item);
                              }}
                              title="Print damage voucher"
                            >
                              🖨 Print
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Section: Bottom Status & Action Bar */}
          <div className="di-bottom-bar">
            <div style={{ fontSize: '11px', color: '#475569' }}>
              {selectedRecord ? (
                <span>
                  Selected: <strong>{selectedRecord.claimNumber}</strong> — {selectedRecord.itemCode} ({selectedRecord.itemDescription})
                </span>
              ) : (
                <span>Click a record to select or view details</span>
              )}
            </div>

            <div className="di-action-buttons">
              <button
                type="button"
                className="di-action-btn"
                disabled={!selectedRecord}
                onClick={() => selectedRecord && handleViewDetails(selectedRecord)}
              >
                👁 View Full Record
              </button>
              <button
                type="button"
                className="di-action-btn"
                disabled={!selectedRecord}
                onClick={() => selectedRecord && handlePrintRecord(selectedRecord)}
              >
                🖨 Print Record
              </button>
              <button
                type="button"
                className="di-action-btn"
                onClick={() => navigate('/damage-claim')}
              >
                ➕ Open Damage Claim Form
              </button>
              <button
                type="button"
                className="di-action-btn"
                onClick={() => navigate('/management')}
              >
                Exit to Main
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL 1: Full Damage Claim Details Modal */}
      {showDetailModal && selectedRecord && (
        <div className="di-modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="di-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="di-modal-header">
              <span>Damage Claim Record: {selectedRecord.claimNumber || selectedRecord.returnNumber}</span>
              <button
                type="button"
                className="di-modal-close-btn"
                onClick={() => setShowDetailModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="di-modal-content">
              {/* Grid 1: Claim Information & Customer Traceability */}
              <div className="di-detail-grid">
                <div className="di-detail-card">
                  <h4>Damage Claim Details</h4>
                  <div className="di-detail-row">
                    <span className="di-detail-label">Claim Number:</span>
                    <span className="di-detail-val" style={{ color: '#1d4ed8' }}>
                      {selectedRecord.claimNumber || selectedRecord.returnNumber}
                    </span>
                  </div>
                  <div className="di-detail-row">
                    <span className="di-detail-label">Claim Date:</span>
                    <span className="di-detail-val">{formatDate(selectedRecord.claimDate)}</span>
                  </div>
                  <div className="di-detail-row">
                    <span className="di-detail-label">Claim Status:</span>
                    <span className="di-detail-val">
                      <span className={`di-status-tag ${getStatusBadgeClass(selectedRecord.claimStatus)}`}>
                        {selectedRecord.claimStatus || 'Pending'}
                      </span>
                    </span>
                  </div>
                  <div className="di-detail-row">
                    <span className="di-detail-label">Damage Reason:</span>
                    <span className="di-detail-val">{selectedRecord.damageReason || 'Broken'}</span>
                  </div>
                  <div className="di-detail-row">
                    <span className="di-detail-label">Notes / Remarks:</span>
                    <span className="di-detail-val">{selectedRecord.damageNotes || selectedRecord.rawClaim?.remarks || '-'}</span>
                  </div>
                </div>

                <div className="di-detail-card">
                  <h4>Invoice & Customer Traceability</h4>
                  <div className="di-detail-row">
                    <span className="di-detail-label">Invoice Number:</span>
                    <span className="di-detail-val" style={{ color: '#0369a1' }}>
                      {selectedRecord.invoiceNumber || '-'}
                    </span>
                  </div>
                  <div className="di-detail-row">
                    <span className="di-detail-label">Invoice Date:</span>
                    <span className="di-detail-val">{formatDate(selectedRecord.invoiceDate)}</span>
                  </div>
                  <div className="di-detail-row">
                    <span className="di-detail-label">Customer Name:</span>
                    <span className="di-detail-val">{selectedRecord.customerName || 'Walk-in Customer'}</span>
                  </div>
                  <div className="di-detail-row">
                    <span className="di-detail-label">Telephone:</span>
                    <span className="di-detail-val">{selectedRecord.customerTelephone || '-'}</span>
                  </div>
                  <div className="di-detail-row">
                    <span className="di-detail-label">Customer Code:</span>
                    <span className="di-detail-val">{selectedRecord.customerCode || selectedRecord.rawClaim?.customerCode || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Grid 2: Damaged Item Details & Supplier Traceability */}
              <div className="di-detail-grid">
                <div className="di-detail-card">
                  <h4>Damaged Item Information</h4>
                  <div className="di-detail-row">
                    <span className="di-detail-label">Item Code:</span>
                    <span className="di-detail-val">{selectedRecord.itemCode || '-'}</span>
                  </div>
                  <div className="di-detail-row">
                    <span className="di-detail-label">Description:</span>
                    <span className="di-detail-val">{selectedRecord.itemDescription || '-'}</span>
                  </div>
                  <div className="di-detail-row">
                    <span className="di-detail-label">Damaged Quantity:</span>
                    <span className="di-detail-val" style={{ color: '#dc2626' }}>
                      {selectedRecord.damagedQuantity}
                    </span>
                  </div>
                  <div className="di-detail-row">
                    <span className="di-detail-label">Unit Selling Price:</span>
                    <span className="di-detail-val">
                      Rs. {Number(selectedRecord.unitPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="di-detail-row">
                    <span className="di-detail-label">Total Loss Value:</span>
                    <span className="di-detail-val" style={{ color: '#b91c1c' }}>
                      Rs. {(Number(selectedRecord.unitPrice || 0) * Number(selectedRecord.damagedQuantity || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="di-detail-card">
                  <h4>Supplier & GRN Traceability</h4>
                  <div className="di-detail-row">
                    <span className="di-detail-label">Supplier Code:</span>
                    <span className="di-detail-val">{selectedRecord.supplierCode || '-'}</span>
                  </div>
                  <div className="di-detail-row">
                    <span className="di-detail-label">Supplier Name:</span>
                    <span className="di-detail-val">{selectedRecord.supplierName || 'N/A'}</span>
                  </div>
                  <div className="di-detail-row">
                    <span className="di-detail-label">Supplier Telephone:</span>
                    <span className="di-detail-val">{selectedRecord.supplierTelephone || '-'}</span>
                  </div>
                  <div className="di-detail-row">
                    <span className="di-detail-label">Supplier Invoice No:</span>
                    <span className="di-detail-val">{selectedRecord.supplierInvoiceNo || '-'}</span>
                  </div>
                  <div className="di-detail-row">
                    <span className="di-detail-label">GRN Number:</span>
                    <span className="di-detail-val" style={{ color: '#0369a1' }}>
                      {selectedRecord.grnNumber || '-'}
                    </span>
                  </div>
                  <div className="di-detail-row">
                    <span className="di-detail-label">Purchase Date:</span>
                    <span className="di-detail-val">{formatDate(selectedRecord.purchaseDate)}</span>
                  </div>
                </div>
              </div>

              {/* Grid 3: Supplier Resolution & Replacement Status */}
              <div className="di-detail-card" style={{ marginTop: '4px' }}>
                <h4>Supplier Claim Resolution & Status</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className="di-detail-row">
                    <span className="di-detail-label">Supplier Claim Ref:</span>
                    <span className="di-detail-val">{selectedRecord.rawClaim?.supplierClaimNumber || '-'}</span>
                  </div>
                  <div className="di-detail-row">
                    <span className="di-detail-label">Resolution Status:</span>
                    <span className="di-detail-val">{selectedRecord.claimStatus || 'Pending'}</span>
                  </div>
                  <div className="di-detail-row">
                    <span className="di-detail-label">Supplier Notes:</span>
                    <span className="di-detail-val">{selectedRecord.supplierNotes || '-'}</span>
                  </div>
                  <div className="di-detail-row">
                    <span className="di-detail-label">Recorded By:</span>
                    <span className="di-detail-val">{selectedRecord.rawClaim?.createdBy || 'Admin'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="di-modal-footer">
              <button
                type="button"
                className="di-btn-compact primary"
                onClick={() => {
                  setShowDetailModal(false);
                  handlePrintRecord(selectedRecord);
                }}
              >
                🖨 Print Voucher
              </button>
              <button
                type="button"
                className="di-btn-compact"
                onClick={() => setShowDetailModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Printable Damage Claim Voucher */}
      {showPrintModal && recordToPrint && (
        <div className="di-modal-overlay" onClick={() => setShowPrintModal(false)}>
          <div className="di-modal-window" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
            <div className="di-modal-header">
              <span>Print Damage Claim Voucher</span>
              <button
                type="button"
                className="di-modal-close-btn"
                onClick={() => setShowPrintModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="di-modal-content di-print-sheet" style={{ background: '#ffffff', color: '#000000', padding: '24px' }}>
              {/* Printable Header */}
              <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '14px' }}>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', letterSpacing: '1px' }}>SOFAST MOTORS (PVT) LTD</h2>
                <div style={{ fontSize: '11px', color: '#444' }}>
                  No. 128, Kandy Road, Kurunegala | Tel: 037-2223456 / 077-1234567
                </div>
                <h3 style={{ margin: '8px 0 0 0', fontSize: '15px', textTransform: 'uppercase', textDecoration: 'underline' }}>
                  DAMAGE CLAIM RECORD VOUCHER
                </h3>
              </div>

              {/* Metadata Table */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px', fontSize: '12px' }}>
                <div style={{ border: '1px solid #999', padding: '8px', borderRadius: '4px' }}>
                  <div style={{ fontWeight: 'bold', borderBottom: '1px solid #ccc', paddingBottom: '2px', marginBottom: '4px' }}>
                    Claim Details
                  </div>
                  <div><strong>Claim No:</strong> {recordToPrint.claimNumber || recordToPrint.returnNumber}</div>
                  <div><strong>Date:</strong> {formatDate(recordToPrint.claimDate)}</div>
                  <div><strong>Status:</strong> {recordToPrint.claimStatus || 'Pending'}</div>
                  <div><strong>Invoice No:</strong> {recordToPrint.invoiceNumber || '-'}</div>
                  <div><strong>Invoice Date:</strong> {formatDate(recordToPrint.invoiceDate)}</div>
                </div>

                <div style={{ border: '1px solid #999', padding: '8px', borderRadius: '4px' }}>
                  <div style={{ fontWeight: 'bold', borderBottom: '1px solid #ccc', paddingBottom: '2px', marginBottom: '4px' }}>
                    Customer & Supplier Info
                  </div>
                  <div><strong>Customer:</strong> {recordToPrint.customerName || 'Walk-in Customer'}</div>
                  <div><strong>Telephone:</strong> {recordToPrint.customerTelephone || '-'}</div>
                  <div><strong>Supplier:</strong> {recordToPrint.supplierName || 'N/A'}</div>
                  <div><strong>Supplier Inv:</strong> {recordToPrint.supplierInvoiceNo || '-'}</div>
                  <div><strong>GRN No:</strong> {recordToPrint.grnNumber || '-'}</div>
                </div>
              </div>

              {/* Damaged Item Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '16px' }}>
                <thead>
                  <tr style={{ background: '#f0f0f0', borderBottom: '2px solid #333' }}>
                    <th style={{ border: '1px solid #999', padding: '6px', textAlign: 'left' }}>Item Code</th>
                    <th style={{ border: '1px solid #999', padding: '6px', textAlign: 'left' }}>Description</th>
                    <th style={{ border: '1px solid #999', padding: '6px', textAlign: 'right' }}>Damaged Qty</th>
                    <th style={{ border: '1px solid #999', padding: '6px', textAlign: 'left' }}>Damage Reason</th>
                    <th style={{ border: '1px solid #999', padding: '6px', textAlign: 'right' }}>Unit Price (Rs)</th>
                    <th style={{ border: '1px solid #999', padding: '6px', textAlign: 'right' }}>Total (Rs)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #999', padding: '6px', fontWeight: 'bold' }}>{recordToPrint.itemCode}</td>
                    <td style={{ border: '1px solid #999', padding: '6px' }}>{recordToPrint.itemDescription}</td>
                    <td style={{ border: '1px solid #999', padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>{recordToPrint.damagedQuantity}</td>
                    <td style={{ border: '1px solid #999', padding: '6px' }}>{recordToPrint.damageReason || 'Broken'}</td>
                    <td style={{ border: '1px solid #999', padding: '6px', textAlign: 'right' }}>
                      {Number(recordToPrint.unitPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ border: '1px solid #999', padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>
                      {(Number(recordToPrint.unitPrice || 0) * Number(recordToPrint.damagedQuantity || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Damage Notes */}
              <div style={{ border: '1px solid #ccc', padding: '6px 8px', fontSize: '11px', marginBottom: '30px' }}>
                <strong>Remarks / Notes:</strong> {recordToPrint.damageNotes || recordToPrint.supplierNotes || 'None'}
              </div>

              {/* Signatures */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', fontSize: '11px' }}>
                <div style={{ textAlign: 'center', width: '160px', borderTop: '1px solid #000', paddingTop: '4px' }}>
                  Store Keeper Signature
                </div>
                <div style={{ textAlign: 'center', width: '160px', borderTop: '1px solid #000', paddingTop: '4px' }}>
                  Supplier Representative
                </div>
                <div style={{ textAlign: 'center', width: '160px', borderTop: '1px solid #000', paddingTop: '4px' }}>
                  Authorized Manager
                </div>
              </div>
            </div>

            <div className="di-modal-footer">
              <button
                type="button"
                className="di-btn-compact primary"
                onClick={handlePrintSubmit}
              >
                🖨 Print Now
              </button>
              <button
                type="button"
                className="di-btn-compact"
                onClick={() => setShowPrintModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DamageItems;
