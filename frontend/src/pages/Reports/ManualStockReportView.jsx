import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';
import './ManualStockReportView.css';

/**
 * Professional Manual Stock Report
 * Enterprise ERP Design matching classic SOFAST aesthetic
 * Preserves all business logic, live MongoDB database connections, and operational capabilities.
 */
function ManualStockReportView({ onNavigateTab }) {
  // Query Filters State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('lastDate_desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // Data State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const [data, setData] = useState({
    items: [],
    summary: {
      totalManualItems: 0,
      totalActiveItems: 0,
      totalConvertedItems: 0,
      totalStockAdded: 0,
      totalManualSales: 0,
      totalAvailableStock: 0,
      totalValuation: 0,
    },
    pagination: {
      page: 1,
      limit: 25,
      totalRecords: 0,
      totalPages: 1,
    },
  });

  // Modal States
  // 1. Item Details Modal
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsItem, setDetailsItem] = useState(null);
  const [detailsTab, setDetailsTab] = useState('invoices'); // 'invoices', 'receipts', 'conversion', 'ledger'
  const [detailsHistory, setDetailsHistory] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // 2. Transaction History Modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 3. Add Stock Modal
  const [addStockModalOpen, setAddStockModalOpen] = useState(false);
  const [stockFormData, setStockFormData] = useState({
    manualItemId: '',
    manualCode: '',
    description: '',
    supplier: '',
    supplierCode: '',
    date: new Date().toISOString().split('T')[0],
    quantity: '',
    costPrice: '',
    sellingPrice: '',
    location: 'Main Store',
    referenceNumber: '',
    notes: '',
  });
  const [stockSubmitting, setStockSubmitting] = useState(false);

  // 4. Convert to Item Master Modal
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [convertFormData, setConvertFormData] = useState({
    manualItemId: '',
    targetCode: '',
    description: '',
    category: 'General',
    subCategory: '',
    location: 'Main Store',
    sellingPrice: '',
    costPrice: '',
    reorderLevel: '0',
    reorderQty: '10',
    supplier: '',
    supplierCode: '',
    barcode: '',
    unit: 'PCS',
    notes: '',
  });
  const [convertSubmitting, setConvertSubmitting] = useState(false);
  const [codeAvailability, setCodeAvailability] = useState({ checking: false, available: null, message: '' });

  // Lookup Options (Suppliers & Categories)
  const [suppliersList, setSuppliersList] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);

  const showNotification = (msg, type = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => {
      setNotification((curr) => (curr?.msg === msg ? null : curr));
    }, 4500);
  };

  // Fetch report data from live MongoDB API
  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (sortBy) params.append('sortBy', sortBy);
      params.append('page', page);
      params.append('limit', limit);

      const res = await api.get(`/manual-items?${params.toString()}`);
      if (res.data?.success) {
        setData({
          items: res.data.data || [],
          summary: res.data.summary || {
            totalManualItems: 0,
            totalActiveItems: 0,
            totalConvertedItems: 0,
            totalStockAdded: 0,
            totalManualSales: 0,
            totalAvailableStock: 0,
            totalValuation: 0,
          },
          pagination: res.data.pagination || {
            page,
            limit,
            totalRecords: (res.data.data || []).length,
            totalPages: 1,
          },
        });
        setLastRefreshed(new Date().toLocaleTimeString());
      } else {
        setError(res.data?.message || 'Failed to load manual stock report');
      }
    } catch (err) {
      console.error('Manual stock report fetch error:', err);
      setError(err.response?.data?.message || err.message || 'Error fetching manual stock report');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, startDate, endDate, sortBy, page, limit]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Load suppliers and categories for modals
  useEffect(() => {
    api.get('/suppliers?limit=100').then((r) => {
      if (r.data?.data) setSuppliersList(r.data.data);
    }).catch(() => null);

    api.get('/items/meta/dropdowns').then((r) => {
      if (r.data?.data?.categories) setCategoriesList(r.data.data.categories);
    }).catch(() => null);
  }, []);

  // Sync historical manual invoices on demand
  const handleSyncHistorical = async () => {
    try {
      setLoading(true);
      const res = await api.post('/manual-items/sync-history');
      if (res.data?.success) {
        showNotification(res.data.message || 'Historical manual invoices synchronized', 'success');
        fetchReport();
      } else {
        showNotification(res.data?.message || 'Sync failed', 'error');
      }
    } catch (err) {
      showNotification(err.response?.data?.message || err.message || 'Sync error', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Open Item Details Modal (Requirement 6)
  const handleOpenDetails = async (item) => {
    setDetailsItem(item);
    setDetailsTab('invoices');
    setDetailsModalOpen(true);
    setDetailsLoading(true);
    try {
      const res = await api.get(`/manual-items/${item._id}/history`);
      if (res.data?.success) {
        setDetailsHistory(res.data.data || []);
      } else {
        setDetailsHistory([]);
      }
    } catch (err) {
      console.error('Error fetching item details history:', err);
      setDetailsHistory([]);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Open Transaction History Modal
  const handleOpenHistory = async (item) => {
    setSelectedHistoryItem(item);
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
      const res = await api.get(`/manual-items/${item._id}/history`);
      if (res.data?.success) {
        setHistoryData(res.data.data || []);
      } else {
        setHistoryData([]);
      }
    } catch (err) {
      console.error('History fetch error:', err);
      setHistoryData([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Open Add Stock Modal
  const handleOpenAddStock = (item = null) => {
    if (item) {
      setStockFormData({
        manualItemId: item._id,
        manualCode: item.manualCode,
        description: item.description,
        supplier: item.supplier || '',
        supplierCode: item.supplierCode || '',
        date: new Date().toISOString().split('T')[0],
        quantity: '',
        costPrice: item.costPrice > 0 ? String(item.costPrice) : '',
        sellingPrice: item.sellingPrice > 0 ? String(item.sellingPrice) : '',
        location: item.location || 'Main Store',
        referenceNumber: '',
        notes: '',
      });
    } else {
      setStockFormData({
        manualItemId: '',
        manualCode: '',
        description: '',
        supplier: '',
        supplierCode: '',
        date: new Date().toISOString().split('T')[0],
        quantity: '',
        costPrice: '',
        sellingPrice: '',
        location: 'Main Store',
        referenceNumber: '',
        notes: '',
      });
    }
    setAddStockModalOpen(true);
  };

  // Submit Add Stock
  const handleSaveStock = async (e) => {
    e.preventDefault();
    if (!stockFormData.referenceNumber.trim()) {
      showNotification('Reference Number (Supplier Invoice / Note #) is required', 'error');
      return;
    }
    const q = parseFloat(stockFormData.quantity);
    if (isNaN(q) || q <= 0) {
      showNotification('Received Quantity must be greater than zero', 'error');
      return;
    }
    const c = parseFloat(stockFormData.costPrice);
    if (isNaN(c) || c < 0) {
      showNotification('Purchase Cost cannot be negative', 'error');
      return;
    }

    try {
      setStockSubmitting(true);
      const res = await api.post('/manual-items/add-stock', stockFormData);
      if (res.data?.success) {
        showNotification(res.data.message || 'Stock received successfully', 'success');
        setAddStockModalOpen(false);
        fetchReport();
      } else {
        showNotification(res.data?.message || 'Failed to add stock', 'error');
      }
    } catch (err) {
      showNotification(err.response?.data?.message || err.message || 'Error adding stock', 'error');
    } finally {
      setStockSubmitting(false);
    }
  };

  // Open Convert to Item Master Modal
  const handleOpenConvert = (item) => {
    let candidateCode = item.manualCode;
    if (/^MI-\d+$/i.test(candidateCode) || /^MAN-\d+$/i.test(candidateCode)) {
      api.get('/items/next-code').then((r) => {
        if (r.data?.nextCode) {
          setConvertFormData((prev) => ({ ...prev, targetCode: r.data.nextCode }));
        }
      }).catch(() => null);
    }

    setConvertFormData({
      manualItemId: item._id,
      targetCode: candidateCode || '',
      description: item.description,
      category: item.category || 'General',
      subCategory: '',
      location: item.location || 'Main Store',
      sellingPrice: String(item.sellingPrice || 0),
      costPrice: String(item.costPrice || 0),
      reorderLevel: '0',
      reorderQty: '10',
      supplier: item.supplier || '',
      supplierCode: item.supplierCode || '',
      barcode: '',
      unit: item.unit || 'PCS',
      notes: `Converted from manual item ${item.manualCode}`,
    });
    setCodeAvailability({ checking: false, available: null, message: '' });
    setConvertModalOpen(true);
  };

  // Live validate target item code in Item Master
  const handleCheckCodeAvailability = async (codeToTest) => {
    const val = String(codeToTest || '').trim();
    if (!val) {
      setCodeAvailability({ checking: false, available: null, message: '' });
      return;
    }
    setCodeAvailability({ checking: true, available: null, message: 'Validating code...' });
    try {
      const res = await api.get(`/items?search=${encodeURIComponent(val)}&limit=5`);
      const matched = (res.data?.data || []).some(
        (it) => it.code?.toLowerCase() === val.toLowerCase()
      );
      if (matched) {
        setCodeAvailability({
          checking: false,
          available: false,
          message: `Code '${val}' already exists in Item Master`,
        });
      } else {
        setCodeAvailability({
          checking: false,
          available: true,
          message: `Code '${val}' is available!`,
        });
      }
    } catch (err) {
      setCodeAvailability({ checking: false, available: true, message: 'Code is available' });
    }
  };

  // Submit Convert to Item Master
  const handleSaveConvert = async (e) => {
    e.preventDefault();
    if (!convertFormData.targetCode.trim()) {
      showNotification('Target Item Code is required', 'error');
      return;
    }
    if (!convertFormData.description.trim()) {
      showNotification('Item Description is required', 'error');
      return;
    }
    if (codeAvailability.available === false) {
      showNotification('Target Item Code already exists in Item Master. Please choose a unique code.', 'error');
      return;
    }

    try {
      setConvertSubmitting(true);
      const res = await api.post('/manual-items/convert', convertFormData);
      if (res.data?.success) {
        showNotification(res.data.message || 'Item converted to Item Master successfully!', 'success');
        setConvertModalOpen(false);
        fetchReport();
      } else {
        showNotification(res.data?.message || 'Failed to convert item', 'error');
      }
    } catch (err) {
      showNotification(err.response?.data?.message || err.message || 'Conversion error', 'error');
    } finally {
      setConvertSubmitting(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!data.items || data.items.length === 0) {
      showNotification('No data to export', 'warning');
      return;
    }
    const headers = [
      'Manual Item Code',
      'Description',
      'Unit',
      'Total Sales Qty',
      'Total Stock Added',
      'Available Stock',
      'Selling Price',
      'Cost Price',
      'First Sale Date',
      'Last Transaction Date',
      'Status',
      'Converted Item Code',
    ];

    const rows = data.items.map((it) => [
      `"${it.manualCode || ''}"`,
      `"${(it.description || '').replace(/"/g, '""')}"`,
      `"${it.unit || 'PCS'}"`,
      it.totalSalesQty || 0,
      it.totalStockAdded || 0,
      it.availableStock || 0,
      (it.sellingPrice || 0).toFixed(2),
      (it.costPrice || 0).toFixed(2),
      it.firstTransactionDate ? new Date(it.firstTransactionDate).toISOString().split('T')[0] : '',
      it.lastTransactionDate ? new Date(it.lastTransactionDate).toISOString().split('T')[0] : '',
      `"${it.status || 'Active'}"`,
      `"${it.convertedItemCode || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SOFAST_Manual_Stock_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Manual Stock Report exported to CSV', 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  // Calculate 8 exact KPI card statistics (Requirement 3)
  const kpiStats = useMemo(() => {
    const s = data.summary;
    const pendingCount = s.totalActiveItems || 0;
    return {
      totalManualItems: s.totalManualItems || 0,
      activeUnconverted: s.totalActiveItems || 0,
      pendingRegistration: pendingCount,
      availableStock: s.totalAvailableStock || 0,
      totalSales: s.totalManualSales || 0,
      totalAdded: s.totalStockAdded || 0,
      convertedItems: s.totalConvertedItems || 0,
      estimatedValuation: s.totalValuation || 0,
    };
  }, [data.summary]);

  // Split details history into categories for Item Details modal
  const categorizedHistory = useMemo(() => {
    const sales = detailsHistory.filter((t) => t.transactionType === 'MANUAL_SALE');
    const receipts = detailsHistory.filter((t) => t.transactionType === 'STOCK_ADDITION');
    const conversions = detailsHistory.filter((t) => t.transactionType === 'CONVERSION_TRANSFER');
    return { sales, receipts, conversions, all: detailsHistory };
  }, [detailsHistory]);

  return (
    <div className="ms-container">
      {/* Toast Notification */}
      {notification && (
        <div className={`ms-notification-toast ms-toast-${notification.type} no-print`}>
          <span>{notification.type === 'error' ? '⚠️' : notification.type === 'success' ? '✓' : 'ℹ️'}</span>
          <span>{notification.msg}</span>
          <button type="button" onClick={() => setNotification(null)} className="ms-toast-close">×</button>
        </div>
      )}

      {/* 1. Header Section (Requirement 2) */}
      <div className="ms-header no-print">
        <div className="ms-header-title-box">
          <span className="ms-header-badge">UNREGISTERED INVENTORY CONTROL</span>
          <h2>📦 MANUAL STOCK REPORT</h2>
          <p className="ms-header-subtitle">
            Manage unregistered products, manual stock additions, sales, and Item Master conversions.
          </p>
        </div>
        <div className="ms-header-actions">
          <button type="button" className="ms-btn ms-btn-primary" onClick={() => handleOpenAddStock()} title="Add stock to any manual item">
            ➕ Add Manual Stock
          </button>
          <button type="button" className="ms-btn" onClick={handleSyncHistorical} title="Sync past unregistered manual invoices">
            🔄 Sync Past Invoices
          </button>
          <button type="button" className="ms-btn" onClick={fetchReport} title="Refresh live data" disabled={loading}>
            🔃 {loading ? 'Loading...' : 'Refresh'}
          </button>
          <button type="button" className="ms-btn" onClick={handlePrint} title="Print report">
            🖨️ Print Report
          </button>
          <button type="button" className="ms-btn" onClick={handleExportCSV} title="Export CSV">
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Printable Header */}
      <div className="print-only ms-print-header">
        <h1>SOFAST MOTORS (PVT) LTD</h1>
        <h2>MANUAL STOCK REPORT</h2>
        <p>Generated: {new Date().toLocaleString()} | User: {localStorage.getItem('username') || 'Admin'}</p>
      </div>

      {/* 2. Statistics Dashboard - 8 Responsive KPI Cards (Requirement 3) */}
      <div className="ms-kpi-grid no-print">
        {/* Card 1: Total Manual Items */}
        <div className="ms-kpi-card kpi-blue">
          <div className="ms-kpi-top">
            <span className="ms-kpi-title">Total Manual Items</span>
            <span className="ms-kpi-icon">📦</span>
          </div>
          <div className="ms-kpi-value">{kpiStats.totalManualItems}</div>
          <div className="ms-kpi-desc">Total catalogued unregistered items</div>
        </div>

        {/* Card 2: Active (Unconverted) */}
        <div className="ms-kpi-card kpi-amber">
          <div className="ms-kpi-top">
            <span className="ms-kpi-title">Active (Unconverted)</span>
            <span className="ms-kpi-icon">⏳</span>
          </div>
          <div className="ms-kpi-value" style={{ color: '#d97706' }}>{kpiStats.activeUnconverted}</div>
          <div className="ms-kpi-desc">Currently managed as manual stock</div>
        </div>

        {/* Card 3: Pending Item Master Registration */}
        <div className="ms-kpi-card kpi-indigo">
          <div className="ms-kpi-top">
            <span className="ms-kpi-title">Pending Master Registration</span>
            <span className="ms-kpi-icon">📝</span>
          </div>
          <div className="ms-kpi-value" style={{ color: '#4f46e5' }}>{kpiStats.pendingRegistration}</div>
          <div className="ms-kpi-desc">Eligible for promotion to Item Master</div>
        </div>

        {/* Card 4: Available Manual Stock */}
        <div className="ms-kpi-card kpi-green">
          <div className="ms-kpi-top">
            <span className="ms-kpi-title">Available Manual Stock</span>
            <span className="ms-kpi-icon">📊</span>
          </div>
          <div
            className="ms-kpi-value"
            style={{ color: kpiStats.availableStock < 0 ? '#dc2626' : '#16a34a' }}
          >
            {kpiStats.availableStock}
          </div>
          <div className="ms-kpi-desc">Total added stock minus manual sales</div>
        </div>

        {/* Card 5: Total Manual Sales */}
        <div className="ms-kpi-card kpi-purple">
          <div className="ms-kpi-top">
            <span className="ms-kpi-title">Total Manual Sales</span>
            <span className="ms-kpi-icon">🛒</span>
          </div>
          <div className="ms-kpi-value">{kpiStats.totalSales}</div>
          <div className="ms-kpi-desc">Cumulative units sold via manual bills</div>
        </div>

        {/* Card 6: Total Stock Added */}
        <div className="ms-kpi-card kpi-emerald">
          <div className="ms-kpi-top">
            <span className="ms-kpi-title">Total Stock Added</span>
            <span className="ms-kpi-icon">📥</span>
          </div>
          <div className="ms-kpi-value" style={{ color: '#059669' }}>{kpiStats.totalAdded}</div>
          <div className="ms-kpi-desc">Physical stock received via receipts</div>
        </div>

        {/* Card 7: Converted Items */}
        <div className="ms-kpi-card kpi-navy">
          <div className="ms-kpi-top">
            <span className="ms-kpi-title">Converted Items</span>
            <span className="ms-kpi-icon">⭐</span>
          </div>
          <div className="ms-kpi-value" style={{ color: '#003366' }}>{kpiStats.convertedItems}</div>
          <div className="ms-kpi-desc">Promoted to authoritative Item Master</div>
        </div>

        {/* Card 8: Estimated Valuation */}
        <div className="ms-kpi-card kpi-red">
          <div className="ms-kpi-top">
            <span className="ms-kpi-title">Estimated Valuation</span>
            <span className="ms-kpi-icon">💰</span>
          </div>
          <div className="ms-kpi-value" style={{ fontSize: '18px', color: '#b91c1c' }}>
            Rs. {kpiStats.estimatedValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="ms-kpi-desc">Available manual stock × cost price</div>
        </div>
      </div>

      {/* 3. Search and Filter Section (Requirement 4) */}
      <div className="ms-filter-panel no-print">
        <div className="ms-filter-grid">
          {/* Search Item / Code */}
          <div className="ms-filter-field">
            <label className="ms-filter-label" htmlFor="ms-filter-search">Search Item / Code</label>
            <input
              id="ms-filter-search"
              type="text"
              className="ms-input"
              placeholder="Search code, description, supplier..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Conversion Status */}
          <div className="ms-filter-field">
            <label className="ms-filter-label" htmlFor="ms-filter-status">Conversion Status</label>
            <select
              id="ms-filter-status"
              className="ms-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All Statuses ({kpiStats.totalManualItems})</option>
              <option value="Active">Active / Pending ({kpiStats.activeUnconverted})</option>
              <option value="Converted">Converted to Master ({kpiStats.convertedItems})</option>
            </select>
          </div>

          {/* From Date */}
          <div className="ms-filter-field">
            <label className="ms-filter-label" htmlFor="ms-filter-from">From Date</label>
            <input
              id="ms-filter-from"
              type="date"
              className="ms-input"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* To Date */}
          <div className="ms-filter-field">
            <label className="ms-filter-label" htmlFor="ms-filter-to">To Date</label>
            <input
              id="ms-filter-to"
              type="date"
              className="ms-input"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Sort By */}
          <div className="ms-filter-field">
            <label className="ms-filter-label" htmlFor="ms-filter-sort">Sort By</label>
            <select
              id="ms-filter-sort"
              className="ms-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="lastDate_desc">Last Transaction (Newest)</option>
              <option value="lastDate_asc">Last Transaction (Oldest)</option>
              <option value="code_asc">Item Code (A → Z)</option>
              <option value="code_desc">Item Code (Z → A)</option>
              <option value="description_asc">Description (A → Z)</option>
              <option value="stock_desc">Available Stock (High → Low)</option>
              <option value="stock_asc">Available Stock (Low → High)</option>
              <option value="sales_desc">Sales Quantity (High → Low)</option>
            </select>
          </div>

          {/* Rows Per Page */}
          <div className="ms-filter-field">
            <label className="ms-filter-label" htmlFor="ms-filter-limit">Rows</label>
            <select
              id="ms-filter-limit"
              className="ms-select"
              value={limit}
              onChange={(e) => {
                setLimit(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10));
                setPage(1);
              }}
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value="all">All</option>
            </select>
          </div>

          {/* Clear Filters Action */}
          <div className="ms-filter-actions">
            {(search || statusFilter !== 'all' || startDate || endDate) && (
              <button
                type="button"
                className="ms-btn-clear"
                onClick={handleClearFilters}
                title="Reset all filters"
              >
                ✕ Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Manual Stock Data Table (Requirement 5) */}
      <div className="ms-table-wrapper">
        <div className="ms-table-scroll">
          <table className="ms-table">
            <thead>
              <tr>
                <th style={{ width: '38px', textAlign: 'center' }}>#</th>
                <th style={{ width: '110px' }}>Item Code</th>
                <th style={{ minWidth: '220px' }}>Description</th>
                <th style={{ width: '55px', textAlign: 'center' }}>Unit</th>
                <th style={{ width: '90px', textAlign: 'right' }}>Sales Qty</th>
                <th style={{ width: '95px', textAlign: 'right' }}>Stock Added</th>
                <th style={{ width: '105px', textAlign: 'right' }}>Available Stock</th>
                <th style={{ width: '100px', textAlign: 'right' }}>Selling Price</th>
                <th style={{ width: '95px', textAlign: 'right' }}>Cost Price</th>
                <th style={{ width: '95px', textAlign: 'center' }}>First Date</th>
                <th style={{ width: '95px', textAlign: 'center' }}>Last Date</th>
                <th style={{ width: '140px', textAlign: 'center' }}>Conversion Status</th>
                <th style={{ width: '230px', textAlign: 'center' }} className="no-print">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={13} className="cell-center" style={{ padding: '30px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#0055aa', fontWeight: 600 }}>
                      <span className="sr-spin-icon-large">🔄</span>
                      <span>Loading live manual stock data from MongoDB...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={13} className="cell-center" style={{ padding: '24px', color: '#dc2626' }}>
                    ⚠️ {error}
                    <button type="button" onClick={fetchReport} className="ms-btn" style={{ marginLeft: '10px' }}>
                      Retry
                    </button>
                  </td>
                </tr>
              ) : data.items.length === 0 ? (
                <tr>
                  <td colSpan={13} className="cell-center" style={{ padding: '40px 20px' }}>
                    <div style={{ fontSize: '30px', marginBottom: '8px' }}>📦</div>
                    <div style={{ fontWeight: 600, color: '#334155' }}>No manual items match the current criteria.</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                      Items sold via Manual Invoices that do not exist in Item Master will automatically appear here.
                    </div>
                  </td>
                </tr>
              ) : (
                data.items.map((item, idx) => {
                  const rowNum = (page - 1) * (limit === 'all' ? 0 : limit) + idx + 1;
                  const avail = item.availableStock || 0;
                  const isConverted = item.status === 'Converted';

                  return (
                    <tr key={item._id || item.manualCode}>
                      <td className="cell-center" style={{ color: '#64748b', fontSize: '11px' }}>{rowNum}</td>
                      <td className="cell-code">{item.manualCode}</td>
                      <td className="cell-desc">
                        <div>{item.description}</div>
                        {item.supplier && (
                          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'normal' }}>
                            Supplier: {item.supplier}
                          </div>
                        )}
                      </td>
                      <td className="cell-center">{item.unit || 'PCS'}</td>
                      <td className="cell-num" style={{ fontWeight: 600 }}>{item.totalSalesQty || 0}</td>
                      <td className="cell-num" style={{ color: '#15803d', fontWeight: 600 }}>{item.totalStockAdded || 0}</td>

                      {/* Available Manual Stock with Requirement 5 Status Colors */}
                      <td className="cell-num">
                        {avail > 0 ? (
                          <span className="ms-badge ms-badge-available">
                            ● {avail}
                          </span>
                        ) : avail < 0 ? (
                          <span className="ms-badge ms-badge-negative" title="Negative stock: Sales exceed recorded receipts">
                            ▲ {avail}
                          </span>
                        ) : (
                          <span className="ms-badge ms-badge-zero">0</span>
                        )}
                      </td>

                      <td className="cell-num">Rs. {(item.sellingPrice || 0).toFixed(2)}</td>
                      <td className="cell-num" style={{ color: '#64748b' }}>
                        {item.costPrice > 0 ? `Rs. ${item.costPrice.toFixed(2)}` : '-'}
                      </td>
                      <td className="cell-center" style={{ fontSize: '11px', color: '#64748b' }}>
                        {item.firstTransactionDate ? new Date(item.firstTransactionDate).toISOString().split('T')[0] : '-'}
                      </td>
                      <td className="cell-center" style={{ fontSize: '11px', color: '#64748b' }}>
                        {item.lastTransactionDate ? new Date(item.lastTransactionDate).toISOString().split('T')[0] : '-'}
                      </td>

                      {/* Conversion Status Badge */}
                      <td className="cell-center">
                        {isConverted ? (
                          <span className="ms-badge ms-badge-converted" title={`Converted to Item Master: ${item.convertedItemCode}`}>
                            ✓ Converted ({item.convertedItemCode})
                          </span>
                        ) : avail > 0 ? (
                          <span className="ms-badge ms-badge-pending" title="Available stock ready for conversion">
                            ⏳ Ready to Convert
                          </span>
                        ) : (
                          <span className="ms-badge ms-badge-pending">
                            ● Active Manual
                          </span>
                        )}
                      </td>

                      {/* Actions Menu (Requirement 5) */}
                      <td className="cell-center no-print">
                        <div className="ms-action-cell">
                          <button
                            type="button"
                            className="ms-row-btn btn-details"
                            onClick={() => handleOpenDetails(item)}
                            title="View detailed product profile & histories"
                          >
                            👁️ Details
                          </button>

                          {!isConverted && (
                            <>
                              <button
                                type="button"
                                className="ms-row-btn btn-stock"
                                onClick={() => handleOpenAddStock(item)}
                                title="Record stock receipt"
                              >
                                ➕ Stock
                              </button>
                              <button
                                type="button"
                                className="ms-row-btn btn-convert"
                                onClick={() => handleOpenConvert(item)}
                                title="Promote to Item Master"
                              >
                                ⭐ Convert
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            className="ms-row-btn btn-history"
                            onClick={() => handleOpenHistory(item)}
                            title="Audit log timeline"
                          >
                            📜 History
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Pagination Footer */}
        <div className="ms-footer no-print">
          <div>
            Showing {data.items.length > 0 ? (page - 1) * (limit === 'all' ? 0 : limit) + 1 : 0} to{' '}
            {Math.min(page * (limit === 'all' ? data.pagination.totalRecords : limit), data.pagination.totalRecords)} of{' '}
            {data.pagination.totalRecords} manual items
            {lastRefreshed && <span style={{ marginLeft: '12px', color: '#94a3b8' }}>• Updated: {lastRefreshed}</span>}
          </div>

          {limit !== 'all' && data.pagination.totalPages > 1 && (
            <div className="ms-pagination">
              <button
                type="button"
                className="ms-page-btn"
                disabled={page <= 1}
                onClick={() => setPage(1)}
                title="First Page"
              >
                ««
              </button>
              <button
                type="button"
                className="ms-page-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                title="Previous Page"
              >
                « Prev
              </button>
              <span className="ms-page-indicator">
                Page <strong>{page}</strong> of <strong>{data.pagination.totalPages}</strong>
              </span>
              <button
                type="button"
                className="ms-page-btn"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                title="Next Page"
              >
                Next »
              </button>
              <button
                type="button"
                className="ms-page-btn"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage(data.pagination.totalPages)}
                title="Last Page"
              >
                »»
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. ITEM DETAILS MODAL (Requirement 6)                                     */}
      {/* ========================================================================= */}
      {detailsModalOpen && detailsItem && (
        <div className="ms-modal-overlay" onClick={() => setDetailsModalOpen(false)}>
          <div className="ms-modal-dialog ms-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="ms-modal-header">
              <h3>📦 Item Details: [{detailsItem.manualCode}] {detailsItem.description}</h3>
              <button type="button" className="ms-modal-close" onClick={() => setDetailsModalOpen(false)}>×</button>
            </div>
            <div className="ms-modal-body">
              {/* Hero Overview */}
              <div className="ms-details-hero">
                <div>
                  <h4 className="ms-details-title">{detailsItem.description}</h4>
                  <div className="ms-details-meta">
                    Code: <strong>{detailsItem.manualCode}</strong> | Unit: <strong>{detailsItem.unit || 'PCS'}</strong> | Location: <strong>{detailsItem.location || 'Main Store'}</strong>
                    {detailsItem.supplier && <span> | Supplier: <strong>{detailsItem.supplier}</strong></span>}
                  </div>
                </div>
                <div>
                  {detailsItem.status === 'Converted' ? (
                    <span className="ms-badge ms-badge-converted" style={{ padding: '4px 10px', fontSize: '12px' }}>
                      ✓ Converted to Master: {detailsItem.convertedItemCode}
                    </span>
                  ) : (
                    <span className="ms-badge ms-badge-available" style={{ padding: '4px 10px', fontSize: '12px' }}>
                      ● Active Manual Stock
                    </span>
                  )}
                </div>
              </div>

              {/* Key Metrics Tiles */}
              <div className="ms-details-stats">
                <div className="ms-details-tile">
                  <span className="ms-details-tile-lbl">Available Stock</span>
                  <span className="ms-details-tile-val" style={{ color: detailsItem.availableStock < 0 ? '#dc2626' : '#16a34a' }}>
                    {detailsItem.availableStock || 0} {detailsItem.unit || 'PCS'}
                  </span>
                </div>
                <div className="ms-details-tile">
                  <span className="ms-details-tile-lbl">Selling Price</span>
                  <span className="ms-details-tile-val">Rs. {(detailsItem.sellingPrice || 0).toFixed(2)}</span>
                </div>
                <div className="ms-details-tile">
                  <span className="ms-details-tile-lbl">Purchase Cost</span>
                  <span className="ms-details-tile-val">
                    {detailsItem.costPrice > 0 ? `Rs. ${detailsItem.costPrice.toFixed(2)}` : 'N/A'}
                  </span>
                </div>
                <div className="ms-details-tile">
                  <span className="ms-details-tile-lbl">Total Sales / Added</span>
                  <span className="ms-details-tile-val">{detailsItem.totalSalesQty || 0} / {detailsItem.totalStockAdded || 0}</span>
                </div>
              </div>

              {/* Sub-Tabs */}
              <div className="ms-modal-tabs">
                <button
                  type="button"
                  className={`ms-tab-btn ${detailsTab === 'invoices' ? 'active' : ''}`}
                  onClick={() => setDetailsTab('invoices')}
                >
                  🛒 Manual Invoice Sales ({categorizedHistory.sales.length})
                </button>
                <button
                  type="button"
                  className={`ms-tab-btn ${detailsTab === 'receipts' ? 'active' : ''}`}
                  onClick={() => setDetailsTab('receipts')}
                >
                  📥 Stock Receipts ({categorizedHistory.receipts.length})
                </button>
                {detailsItem.status === 'Converted' && (
                  <button
                    type="button"
                    className={`ms-tab-btn ${detailsTab === 'conversion' ? 'active' : ''}`}
                    onClick={() => setDetailsTab('conversion')}
                  >
                    ⭐ Conversion Record
                  </button>
                )}
                <button
                  type="button"
                  className={`ms-tab-btn ${detailsTab === 'ledger' ? 'active' : ''}`}
                  onClick={() => setDetailsTab('ledger')}
                >
                  📜 Full Ledger ({categorizedHistory.all.length})
                </button>
              </div>

              {detailsLoading ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#0055aa' }}>
                  Loading history records...
                </div>
              ) : (
                <>
                  {/* Tab 1: Manual Invoices */}
                  {detailsTab === 'invoices' && (
                    <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                      <table className="ms-table">
                        <thead>
                          <tr>
                            <th>Date &amp; Time</th>
                            <th>Invoice Number</th>
                            <th style={{ textAlign: 'right' }}>Qty Sold</th>
                            <th style={{ textAlign: 'right' }}>Selling Price</th>
                            <th style={{ textAlign: 'right' }}>Line Total</th>
                            <th>Reference / Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categorizedHistory.sales.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="cell-center" style={{ padding: '16px', color: '#64748b' }}>
                                No manual invoice sales recorded for this item.
                              </td>
                            </tr>
                          ) : (
                            categorizedHistory.sales.map((s) => (
                              <tr key={s._id}>
                                <td>{new Date(s.date || s.createdAt).toLocaleString()}</td>
                                <td style={{ fontWeight: 600 }}>{s.referenceNumber}</td>
                                <td className="cell-num">{s.quantity}</td>
                                <td className="cell-num">Rs. {(s.unitPrice || 0).toFixed(2)}</td>
                                <td className="cell-num">Rs. {((s.quantity || 0) * (s.unitPrice || 0)).toFixed(2)}</td>
                                <td>{s.notes || '-'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Tab 2: Stock Receipts */}
                  {detailsTab === 'receipts' && (
                    <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                      <table className="ms-table">
                        <thead>
                          <tr>
                            <th>Receipt Date</th>
                            <th>Reference #</th>
                            <th>Supplier</th>
                            <th style={{ textAlign: 'right' }}>Qty Received</th>
                            <th style={{ textAlign: 'right' }}>Purchase Cost</th>
                            <th style={{ textAlign: 'right' }}>Balance After</th>
                            <th>Location</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categorizedHistory.receipts.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="cell-center" style={{ padding: '16px', color: '#64748b' }}>
                                No stock addition receipts recorded yet.
                              </td>
                            </tr>
                          ) : (
                            categorizedHistory.receipts.map((r) => (
                              <tr key={r._id}>
                                <td>{new Date(r.date || r.createdAt).toLocaleString()}</td>
                                <td style={{ fontWeight: 600 }}>{r.referenceNumber}</td>
                                <td>{r.supplier || '-'}</td>
                                <td className="cell-num" style={{ color: '#15803d', fontWeight: 600 }}>+{r.quantity}</td>
                                <td className="cell-num">Rs. {(r.costPrice || 0).toFixed(2)}</td>
                                <td className="cell-num" style={{ fontWeight: 600 }}>{r.balanceAfter}</td>
                                <td>{r.location || 'Main Store'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Tab 3: Conversion Details */}
                  {detailsTab === 'conversion' && detailsItem.status === 'Converted' && (
                    <div className="ms-alert-box" style={{ background: '#eff6ff', borderColor: '#bfdbfe', color: '#1e40af' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>⭐ Authoritative Item Master Record</h4>
                      <p style={{ margin: '0 0 6px 0' }}>
                        This manual product was converted into Item Master under official code <strong>{detailsItem.convertedItemCode}</strong>.
                      </p>
                      <div style={{ fontSize: '11px', color: '#475569' }}>
                        Conversion Date: <strong>{detailsItem.convertedAt ? new Date(detailsItem.convertedAt).toLocaleString() : 'N/A'}</strong> |
                        Converted By: <strong>{detailsItem.convertedBy || 'Admin'}</strong>
                      </div>
                    </div>
                  )}

                  {/* Tab 4: Full Ledger */}
                  {detailsTab === 'ledger' && (
                    <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                      <table className="ms-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Transaction Type</th>
                            <th>Reference #</th>
                            <th style={{ textAlign: 'right' }}>Qty</th>
                            <th style={{ textAlign: 'right' }}>Price/Cost</th>
                            <th style={{ textAlign: 'right' }}>Balance</th>
                            <th>User</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categorizedHistory.all.map((t) => (
                            <tr key={t._id}>
                              <td>{new Date(t.date || t.createdAt).toLocaleDateString()}</td>
                              <td>
                                {t.transactionType === 'MANUAL_SALE' && <span className="ms-badge ms-badge-negative">🛒 Sale</span>}
                                {t.transactionType === 'STOCK_ADDITION' && <span className="ms-badge ms-badge-available">📥 Receipt</span>}
                                {t.transactionType === 'CONVERSION_TRANSFER' && <span className="ms-badge ms-badge-converted">⭐ Converted</span>}
                              </td>
                              <td style={{ fontWeight: 600 }}>{t.referenceNumber}</td>
                              <td className="cell-num">
                                {t.transactionType === 'MANUAL_SALE' ? `-${t.quantity}` : `+${t.quantity}`}
                              </td>
                              <td className="cell-num">Rs. {(t.transactionType === 'STOCK_ADDITION' ? t.costPrice : t.unitPrice || 0).toFixed(2)}</td>
                              <td className="cell-num" style={{ fontWeight: 600 }}>{t.balanceAfter}</td>
                              <td>{t.performedBy || 'System'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="ms-modal-footer">
              {!detailsItem.status === 'Converted' && (
                <button
                  type="button"
                  className="ms-btn ms-btn-primary"
                  onClick={() => {
                    setDetailsModalOpen(false);
                    handleOpenConvert(detailsItem);
                  }}
                >
                  ⭐ Convert to Item Master
                </button>
              )}
              <button type="button" className="ms-btn" onClick={() => setDetailsModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. TRANSACTION HISTORY MODAL                                              */}
      {/* ========================================================================= */}
      {historyModalOpen && selectedHistoryItem && (
        <div className="ms-modal-overlay" onClick={() => setHistoryModalOpen(false)}>
          <div className="ms-modal-dialog ms-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="ms-modal-header">
              <h3>📜 Transaction History: [{selectedHistoryItem.manualCode}] {selectedHistoryItem.description}</h3>
              <button type="button" className="ms-modal-close" onClick={() => setHistoryModalOpen(false)}>×</button>
            </div>
            <div className="ms-modal-body">
              <div style={{ display: 'flex', gap: '16px', background: '#f8fafc', padding: '8px 14px', borderRadius: '6px', marginBottom: '12px', fontSize: '12px' }}>
                <span>Total Sold: <strong>{selectedHistoryItem.totalSalesQty || 0}</strong></span>
                <span>Total Received: <strong>{selectedHistoryItem.totalStockAdded || 0}</strong></span>
                <span>Available Stock: <strong>{selectedHistoryItem.availableStock || 0}</strong></span>
                <span>Status: <strong>{selectedHistoryItem.status}</strong></span>
              </div>

              {historyLoading ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#0055aa' }}>Loading audit records...</div>
              ) : historyData.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>No transactions recorded.</div>
              ) : (
                <div style={{ maxHeight: '360px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                  <table className="ms-table">
                    <thead>
                      <tr>
                        <th>Date &amp; Time</th>
                        <th>Type</th>
                        <th>Ref Number</th>
                        <th style={{ textAlign: 'right' }}>Qty</th>
                        <th style={{ textAlign: 'right' }}>Price / Cost</th>
                        <th style={{ textAlign: 'right' }}>Balance</th>
                        <th>Notes</th>
                        <th>User</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyData.map((tx) => (
                        <tr key={tx._id || tx.referenceNumber}>
                          <td style={{ fontSize: '11px' }}>{new Date(tx.date || tx.createdAt).toLocaleString()}</td>
                          <td>
                            {tx.transactionType === 'MANUAL_SALE' && <span className="ms-badge ms-badge-negative">🛒 Manual Sale</span>}
                            {tx.transactionType === 'STOCK_ADDITION' && <span className="ms-badge ms-badge-available">📥 Stock Receipt</span>}
                            {tx.transactionType === 'CONVERSION_TRANSFER' && <span className="ms-badge ms-badge-converted">⭐ Converted</span>}
                          </td>
                          <td style={{ fontWeight: 600 }}>{tx.referenceNumber}</td>
                          <td className="cell-num" style={{ fontWeight: 600 }}>
                            {tx.transactionType === 'MANUAL_SALE' ? `-${tx.quantity}` : `+${tx.quantity}`}
                          </td>
                          <td className="cell-num">
                            Rs. {(tx.transactionType === 'STOCK_ADDITION' ? tx.costPrice : tx.unitPrice || 0).toFixed(2)}
                          </td>
                          <td className="cell-num" style={{ fontWeight: 600 }}>{tx.balanceAfter}</td>
                          <td style={{ fontSize: '11px' }}>{tx.notes || '-'}</td>
                          <td style={{ fontSize: '11px' }}>{tx.performedBy || 'System'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="ms-modal-footer">
              <button type="button" className="ms-btn" onClick={() => window.print()}>
                🖨️ Print
              </button>
              <button type="button" className="ms-btn" onClick={() => setHistoryModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. ADD MANUAL STOCK MODAL                                                 */}
      {/* ========================================================================= */}
      {addStockModalOpen && (
        <div className="ms-modal-overlay" onClick={() => setAddStockModalOpen(false)}>
          <div className="ms-modal-dialog ms-modal-md" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSaveStock}>
              <div className="ms-modal-header">
                <h3>📥 Add Manual Stock Receipt</h3>
                <button type="button" className="ms-modal-close" onClick={() => setAddStockModalOpen(false)}>×</button>
              </div>
              <div className="ms-modal-body">
                <p className="ms-form-hint">
                  Record physical stock received for this unregistered item. Creates an auditable stock receipt without modifying Item Master.
                </p>

                <div className="ms-form-grid">
                  <div className="ms-form-field full">
                    <label>Item Description <span style={{ color: '#dc2626' }}>*</span></label>
                    <input
                      type="text"
                      className="ms-input"
                      required
                      value={stockFormData.description}
                      onChange={(e) => setStockFormData({ ...stockFormData, description: e.target.value })}
                      placeholder="e.g. TATA REAR BRAKE LINER"
                    />
                  </div>

                  <div className="ms-form-field">
                    <label>Manual Code</label>
                    <input
                      type="text"
                      className="ms-input"
                      value={stockFormData.manualCode}
                      onChange={(e) => setStockFormData({ ...stockFormData, manualCode: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>

                  <div className="ms-form-field">
                    <label>Reference # <span style={{ color: '#dc2626' }}>*</span></label>
                    <input
                      type="text"
                      className="ms-input"
                      required
                      value={stockFormData.referenceNumber}
                      onChange={(e) => setStockFormData({ ...stockFormData, referenceNumber: e.target.value })}
                      placeholder="e.g. INV-9042, DN-102"
                    />
                  </div>

                  <div className="ms-form-field">
                    <label>Receipt Date <span style={{ color: '#dc2626' }}>*</span></label>
                    <input
                      type="date"
                      className="ms-input"
                      required
                      value={stockFormData.date}
                      onChange={(e) => setStockFormData({ ...stockFormData, date: e.target.value })}
                    />
                  </div>

                  <div className="ms-form-field">
                    <label>Quantity Received <span style={{ color: '#dc2626' }}>*</span></label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      className="ms-input"
                      required
                      value={stockFormData.quantity}
                      onChange={(e) => setStockFormData({ ...stockFormData, quantity: e.target.value })}
                      placeholder="e.g. 10"
                    />
                  </div>

                  <div className="ms-form-field">
                    <label>Purchase Cost (Rs.) <span style={{ color: '#dc2626' }}>*</span></label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="ms-input"
                      required
                      value={stockFormData.costPrice}
                      onChange={(e) => setStockFormData({ ...stockFormData, costPrice: e.target.value })}
                      placeholder="e.g. 450.00"
                    />
                  </div>

                  <div className="ms-form-field">
                    <label>Selling Price (Rs.)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="ms-input"
                      value={stockFormData.sellingPrice}
                      onChange={(e) => setStockFormData({ ...stockFormData, sellingPrice: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>

                  <div className="ms-form-field">
                    <label>Supplier</label>
                    <input
                      type="text"
                      className="ms-input"
                      list="ms-supp-list"
                      value={stockFormData.supplier}
                      onChange={(e) => setStockFormData({ ...stockFormData, supplier: e.target.value })}
                      placeholder="Select or enter supplier"
                    />
                    <datalist id="ms-supp-list">
                      {suppliersList.map((s) => (
                        <option key={s._id || s.code} value={s.name}>{s.code} - {s.name}</option>
                      ))}
                    </datalist>
                  </div>

                  <div className="ms-form-field">
                    <label>Storage Location</label>
                    <input
                      type="text"
                      className="ms-input"
                      value={stockFormData.location}
                      onChange={(e) => setStockFormData({ ...stockFormData, location: e.target.value })}
                      placeholder="e.g. Main Store"
                    />
                  </div>

                  <div className="ms-form-field full">
                    <label>Remarks</label>
                    <input
                      type="text"
                      className="ms-input"
                      value={stockFormData.notes}
                      onChange={(e) => setStockFormData({ ...stockFormData, notes: e.target.value })}
                      placeholder="Optional notes"
                    />
                  </div>
                </div>
              </div>
              <div className="ms-modal-footer">
                <button type="button" className="ms-btn" onClick={() => setAddStockModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="ms-btn ms-btn-primary" disabled={stockSubmitting}>
                  {stockSubmitting ? 'Saving...' : '💾 Save Stock Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. CONVERT TO ITEM MASTER MODAL                                           */}
      {/* ========================================================================= */}
      {convertModalOpen && (
        <div className="ms-modal-overlay" onClick={() => setConvertModalOpen(false)}>
          <div className="ms-modal-dialog ms-modal-md" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSaveConvert}>
              <div className="ms-modal-header">
                <h3>⭐ Convert Manual Item to Item Master</h3>
                <button type="button" className="ms-modal-close" onClick={() => setConvertModalOpen(false)}>×</button>
              </div>
              <div className="ms-modal-body">
                <div className="ms-alert-box">
                  <strong>Notice:</strong>
                  <div>
                    This action creates an authoritative Item Master record and transfers available manual stock exactly once.
                    Historical manual invoices remain unchanged. Once converted, normal Sales Invoices will deduct live stock.
                  </div>
                </div>

                <div className="ms-form-grid">
                  <div className="ms-form-field">
                    <label>Item Master Code <span style={{ color: '#dc2626' }}>*</span></label>
                    <input
                      type="text"
                      className="ms-input"
                      required
                      value={convertFormData.targetCode}
                      onChange={(e) => {
                        const val = e.target.value;
                        setConvertFormData({ ...convertFormData, targetCode: val });
                        handleCheckCodeAvailability(val);
                      }}
                      placeholder="e.g. ITM-045"
                    />
                    {codeAvailability.message && (
                      <span style={{ fontSize: '10px', color: codeAvailability.available === false ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                        {codeAvailability.message}
                      </span>
                    )}
                  </div>

                  <div className="ms-form-field">
                    <label>Unit of Measure</label>
                    <input
                      type="text"
                      className="ms-input"
                      value={convertFormData.unit}
                      onChange={(e) => setConvertFormData({ ...convertFormData, unit: e.target.value })}
                      placeholder="PCS, SET, etc."
                    />
                  </div>

                  <div className="ms-form-field full">
                    <label>Description <span style={{ color: '#dc2626' }}>*</span></label>
                    <input
                      type="text"
                      className="ms-input"
                      required
                      value={convertFormData.description}
                      onChange={(e) => setConvertFormData({ ...convertFormData, description: e.target.value })}
                    />
                  </div>

                  <div className="ms-form-field">
                    <label>Category</label>
                    <input
                      type="text"
                      className="ms-input"
                      list="ms-cat-list"
                      value={convertFormData.category}
                      onChange={(e) => setConvertFormData({ ...convertFormData, category: e.target.value })}
                      placeholder="Category"
                    />
                    <datalist id="ms-cat-list">
                      {categoriesList.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>

                  <div className="ms-form-field">
                    <label>Sub Category</label>
                    <input
                      type="text"
                      className="ms-input"
                      value={convertFormData.subCategory}
                      onChange={(e) => setConvertFormData({ ...convertFormData, subCategory: e.target.value })}
                    />
                  </div>

                  <div className="ms-form-field">
                    <label>Selling Price (Rs.) <span style={{ color: '#dc2626' }}>*</span></label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="ms-input"
                      required
                      value={convertFormData.sellingPrice}
                      onChange={(e) => setConvertFormData({ ...convertFormData, sellingPrice: e.target.value })}
                    />
                  </div>

                  <div className="ms-form-field">
                    <label>Cost Price (Rs.)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="ms-input"
                      value={convertFormData.costPrice}
                      onChange={(e) => setConvertFormData({ ...convertFormData, costPrice: e.target.value })}
                    />
                  </div>

                  <div className="ms-form-field">
                    <label>Reorder Level</label>
                    <input
                      type="number"
                      min="0"
                      className="ms-input"
                      value={convertFormData.reorderLevel}
                      onChange={(e) => setConvertFormData({ ...convertFormData, reorderLevel: e.target.value })}
                    />
                  </div>

                  <div className="ms-form-field">
                    <label>Location</label>
                    <input
                      type="text"
                      className="ms-input"
                      value={convertFormData.location}
                      onChange={(e) => setConvertFormData({ ...convertFormData, location: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="ms-modal-footer">
                <button type="button" className="ms-btn" onClick={() => setConvertModalOpen(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ms-btn ms-btn-primary"
                  disabled={convertSubmitting || codeAvailability.available === false}
                >
                  {convertSubmitting ? 'Converting...' : '⭐ Confirm Conversion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManualStockReportView;
