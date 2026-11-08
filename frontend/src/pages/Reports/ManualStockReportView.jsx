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

  const [reportViewTab, setReportViewTab] = useState('items'); // 'items' or 'invoices'
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [selectedInvoiceModal, setSelectedInvoiceModal] = useState(null);
  const [invoiceModalLoading, setInvoiceModalLoading] = useState(false);

  const [data, setData] = useState({
    items: [],
    manualInvoices: [],
    summary: {
      totalManualItems: 0,
      totalActiveItems: 0,
      totalConvertedItems: 0,
      totalStockAdded: 0,
      totalManualSales: 0,
      totalAvailableStock: 0,
      totalValuation: 0,
      totalManualInvoicesIssued: 0,
      totalManualInvoicesAmount: 0,
      allIssuedInvoiceNumbers: [],
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
          manualInvoices: res.data.manualInvoices || [],
          summary: res.data.summary || {
            totalManualItems: 0,
            totalActiveItems: 0,
            totalConvertedItems: 0,
            totalStockAdded: 0,
            totalManualSales: 0,
            totalAvailableStock: 0,
            totalValuation: 0,
            totalManualInvoicesIssued: 0,
            totalManualInvoicesAmount: 0,
            allIssuedInvoiceNumbers: [],
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

    api.get('/items/lookup-options').then((r) => {
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
      if (err.response?.status === 409 || err.response?.data?.conflict) {
        showNotification(err.response?.data?.message || 'Conflict: Stock addition collision. Please try again.', 'warning');
      } else {
        showNotification(err.response?.data?.message || err.message || 'Error adding stock', 'error');
      }
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
      manualCode: item.manualCode,
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
      totalStockAdded: item.totalStockAdded || 0,
      totalSalesQty: item.totalSalesQty || 0,
      availableStock: item.availableStock || 0,
      associatedInvoiceNumbers: item.associatedInvoiceNumbers || [],
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
      if (err.response?.status === 409 || err.response?.data?.conflict) {
        // Code conflict: Auto-fetch next available code
        api.get('/items/next-code').then((r) => {
          if (r.data?.nextCode) {
            setConvertFormData((prev) => ({ ...prev, targetCode: r.data.nextCode }));
          }
        }).catch(() => null);
        showNotification(err.response?.data?.message || 'Item code already exists in Item Master. Updated to next available code.', 'warning');
      } else {
        showNotification(err.response?.data?.message || err.message || 'Conversion error', 'error');
      }
    } finally {
      setConvertSubmitting(false);
    }
  };

  // Open full manual invoice modal
  const handleOpenInvoiceByNumber = async (invNumber) => {
    if (!invNumber) return;
    const cleanNo = String(invNumber).trim();
    // 1. Check in cached data.manualInvoices
    const found = (data.manualInvoices || []).find(
      (inv) => String(inv.invoiceNumber).toUpperCase() === cleanNo.toUpperCase()
    );
    if (found) {
      setSelectedInvoiceModal(found);
      return;
    }

    // 2. Fetch directly from server
    try {
      setInvoiceModalLoading(true);
      const res = await api.get(`/manual-items/invoices?search=${encodeURIComponent(cleanNo)}`);
      if (res.data?.success && res.data.data?.length > 0) {
        const match = res.data.data.find(
          (inv) => String(inv.invoiceNumber).toUpperCase() === cleanNo.toUpperCase()
        ) || res.data.data[0];
        setSelectedInvoiceModal(match);
      } else {
        const fallbackRes = await api.get(`/invoices?search=${encodeURIComponent(cleanNo)}`);
        if (fallbackRes.data?.data?.length > 0) {
          const inv = fallbackRes.data.data[0];
          setSelectedInvoiceModal(inv);
        } else {
          showNotification(`Invoice '${cleanNo}' details not found`, 'warning');
        }
      }
    } catch (err) {
      console.error('Error fetching invoice details:', err);
      showNotification(`Failed to load invoice ${cleanNo}`, 'error');
    } finally {
      setInvoiceModalLoading(false);
    }
  };

  // Filtered manual invoices list for the "Issued Manual Invoices" tab
  const filteredManualInvoices = useMemo(() => {
    const list = data.manualInvoices || [];
    if (!invoiceSearch.trim()) return list;
    const q = invoiceSearch.trim().toLowerCase();
    return list.filter((inv) => {
      const invNo = String(inv.invoiceNumber || '').toLowerCase();
      const cus = String(inv.customerName || '').toLowerCase();
      const code = String(inv.customerCode || '').toLowerCase();
      const phone = String(inv.telephone || '').toLowerCase();
      const itemsMatch = (inv.lineItems || []).some((li) =>
        String(li.description || '').toLowerCase().includes(q) ||
        String(li.code || '').toLowerCase().includes(q)
      );
      return invNo.includes(q) || cus.includes(q) || code.includes(q) || phone.includes(q) || itemsMatch;
    });
  }, [data.manualInvoices, invoiceSearch]);

  // Export CSV
  const handleExportCSV = () => {
    if (reportViewTab === 'invoices') {
      const invoicesToExport = filteredManualInvoices;
      if (!invoicesToExport || invoicesToExport.length === 0) {
        showNotification('No manual invoices to export', 'warning');
        return;
      }
      const headers = [
        'Invoice Number',
        'Date',
        'Customer Name',
        'Customer Code',
        'Phone',
        'Items Count',
        'Items Details',
        'Gross Amount',
        'Discount Amount',
        'Net Total',
        'Payment Method',
        'Cashier',
      ];
      const rows = invoicesToExport.map((inv) => {
        const itemsSummary = (inv.lineItems || [])
          .map((li) => `${li.code ? `[${li.code}] ` : ''}${li.description} (${li.quantity} ${li.unit || 'PCS'} @ ${li.unitPrice})`)
          .join('; ');
        return [
          `"${inv.invoiceNumber || ''}"`,
          inv.date ? new Date(inv.date).toISOString().split('T')[0] : '',
          `"${(inv.customerName || 'Walk In Customer').replace(/"/g, '""')}"`,
          `"${inv.customerCode || ''}"`,
          `"${inv.telephone || ''}"`,
          (inv.lineItems || []).length,
          `"${itemsSummary.replace(/"/g, '""')}"`,
          (inv.grossTotal || inv.netTotal || 0).toFixed(2),
          (inv.discountAmount || 0).toFixed(2),
          (inv.netTotal || 0).toFixed(2),
          `"${inv.paymentMethod || 'Cash'}"`,
          `"${inv.cashier || 'Cashier'}"`,
        ];
      });

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `SOFAST_Issued_Manual_Invoices_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification('Issued Manual Invoices exported to CSV', 'success');
      return;
    }

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
      'Issued Invoice Numbers',
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
      `"${(it.associatedInvoiceNumbers || []).join(', ')}"`,
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

  // Calculate KPI card statistics
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
      totalManualInvoicesIssued: s.totalManualInvoicesIssued || (data.manualInvoices || []).length || 0,
      totalManualInvoicesAmount: s.totalManualInvoicesAmount || 0,
      allIssuedInvoiceNumbers: s.allIssuedInvoiceNumbers || (data.manualInvoices || []).map((i) => i.invoiceNumber).filter(Boolean) || [],
    };
  }, [data.summary, data.manualInvoices]);

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
            <span className="ms-kpi-icon-wrap icon-blue">📦</span>
          </div>
          <div className="ms-kpi-value">{kpiStats.totalManualItems}</div>
          <div className="ms-kpi-desc">Total catalogued unregistered items</div>
        </div>

        {/* Card 2: Active (Unconverted) */}
        <div className="ms-kpi-card kpi-amber">
          <div className="ms-kpi-top">
            <span className="ms-kpi-title">Active (Unconverted)</span>
            <span className="ms-kpi-icon-wrap icon-amber">⏳</span>
          </div>
          <div className="ms-kpi-value text-amber">{kpiStats.activeUnconverted}</div>
          <div className="ms-kpi-desc">Currently managed as manual stock</div>
        </div>

        {/* Card 3: Pending Item Master Registration */}
        <div className="ms-kpi-card kpi-indigo">
          <div className="ms-kpi-top">
            <span className="ms-kpi-title">Pending Item Master Registration</span>
            <span className="ms-kpi-icon-wrap icon-indigo">📝</span>
          </div>
          <div className="ms-kpi-value text-indigo">{kpiStats.pendingRegistration}</div>
          <div className="ms-kpi-desc">Eligible for promotion to Item Master</div>
        </div>

        {/* Card 4: Available Manual Stock */}
        <div className="ms-kpi-card kpi-green">
          <div className="ms-kpi-top">
            <span className="ms-kpi-title">Available Manual Stock</span>
            <span className="ms-kpi-icon-wrap icon-green">📊</span>
          </div>
          <div
            className={`ms-kpi-value ${kpiStats.availableStock < 0 ? 'text-red' : 'text-green'}`}
          >
            {kpiStats.availableStock}
          </div>
          <div className="ms-kpi-desc">Total added stock minus manual sales</div>
        </div>

        {/* Card 5: Total Manual Sales */}
        <div className="ms-kpi-card kpi-purple">
          <div className="ms-kpi-top">
            <span className="ms-kpi-title">Total Manual Sales</span>
            <span className="ms-kpi-icon-wrap icon-purple">🛒</span>
          </div>
          <div className="ms-kpi-value text-purple">{kpiStats.totalSales}</div>
          <div className="ms-kpi-desc">Cumulative units sold via manual bills</div>
        </div>

        {/* Card 6: Total Stock Added */}
        <div className="ms-kpi-card kpi-teal">
          <div className="ms-kpi-top">
            <span className="ms-kpi-title">Total Stock Added</span>
            <span className="ms-kpi-icon-wrap icon-teal">📥</span>
          </div>
          <div className="ms-kpi-value text-teal">{kpiStats.totalAdded}</div>
          <div className="ms-kpi-desc">Physical stock received via receipts</div>
        </div>

        {/* Card 7: Converted Items */}
        <div className="ms-kpi-card kpi-navy">
          <div className="ms-kpi-top">
            <span className="ms-kpi-title">Converted Items</span>
            <span className="ms-kpi-icon-wrap icon-navy">⭐</span>
          </div>
          <div className="ms-kpi-value text-navy">{kpiStats.convertedItems}</div>
          <div className="ms-kpi-desc">Promoted to authoritative Item Master</div>
        </div>

        {/* Card 8: Estimated Valuation */}
        <div className="ms-kpi-card kpi-red">
          <div className="ms-kpi-top">
            <span className="ms-kpi-title">Estimated Valuation</span>
            <span className="ms-kpi-icon-wrap icon-red">💰</span>
          </div>
          <div className="ms-kpi-value val-currency text-red">
            Rs. {kpiStats.estimatedValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="ms-kpi-desc">Available manual stock × cost price</div>
        </div>

        {/* Card 9: Manual Invoices Issued */}
        <div
          className="ms-kpi-card kpi-cyan ms-kpi-clickable"
          onClick={() => setReportViewTab('invoices')}
          title="Click to view all issued manual invoice numbers"
        >
          <div className="ms-kpi-top">
            <span className="ms-kpi-title">Manual Invoices Issued</span>
            <span className="ms-kpi-icon-wrap icon-cyan">🧾</span>
          </div>
          <div className="ms-kpi-value text-cyan">
            {kpiStats.totalManualInvoicesIssued}
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', marginLeft: '6px' }}>bills</span>
          </div>
          <div className="ms-kpi-desc">
            {kpiStats.allIssuedInvoiceNumbers.length > 0 ? (
              <span style={{ color: '#0055aa', fontWeight: 600 }}>
                {kpiStats.allIssuedInvoiceNumbers.slice(0, 3).join(', ')}
                {kpiStats.allIssuedInvoiceNumbers.length > 3 ? ` +${kpiStats.allIssuedInvoiceNumbers.length - 3} more` : ''} ➜
              </span>
            ) : (
              'Click to view issued invoices'
            )}
          </div>
        </div>
      </div>

      {/* 3. Search and Filter Section (Requirement 4) */}
      <div className="ms-filter-panel no-print">
        <form
          className="ms-filter-grid"
          onSubmit={(e) => {
            e.preventDefault();
            fetchReport();
          }}
        >
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
            <label className="ms-filter-label" htmlFor="ms-filter-limit">Rows Per Page</label>
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

          {/* Apply & Clear Filters Actions */}
          <div className="ms-filter-actions">
            <button
              type="submit"
              className="ms-btn ms-btn-primary ms-btn-apply"
              title="Apply filters"
            >
              🔍 Apply Filters
            </button>
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
        </form>
      </div>

      {/* View Switcher Tabs: Items vs Issued Manual Invoices */}
      <div className="ms-view-tabs no-print">
        <button
          type="button"
          className={`ms-view-tab-btn ${reportViewTab === 'items' ? 'active' : ''}`}
          onClick={() => setReportViewTab('items')}
        >
          <span>📦 Manual Stock Inventory</span>
          <span className="ms-view-tab-pill">{data.pagination.totalRecords || data.items.length} Items</span>
        </button>
        <button
          type="button"
          className={`ms-view-tab-btn ${reportViewTab === 'invoices' ? 'active' : ''}`}
          onClick={() => setReportViewTab('invoices')}
        >
          <span>🧾 Issued Manual Invoices</span>
          <span className="ms-view-tab-pill pill-blue">
            {kpiStats.totalManualInvoicesIssued} Invoices Issued
          </span>
        </button>
      </div>

      {/* VIEW MODE 1: Manual Stock Items Table */}
      {reportViewTab === 'items' ? (
        <div className="ms-table-wrapper">
          <div className="ms-table-scroll">
            <table className="ms-table">
              <thead>
                <tr>
                  <th style={{ width: '38px', textAlign: 'center' }}>#</th>
                  <th style={{ width: '110px' }}>Item Code</th>
                  <th style={{ minWidth: '220px' }}>Description</th>
                  <th style={{ width: '55px', textAlign: 'center' }}>Unit</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Total Manual Sales Quantity</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>Total Stock Added</th>
                  <th style={{ width: '115px', textAlign: 'right' }}>Available Manual Stock</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>Selling Price</th>
                  <th style={{ width: '95px', textAlign: 'right' }}>Cost Price</th>
                  <th style={{ width: '130px', textAlign: 'center' }}>Issued Invoices</th>
                  <th style={{ width: '110px', textAlign: 'center' }}>First Transaction Date</th>
                  <th style={{ width: '110px', textAlign: 'center' }}>Last Transaction Date</th>
                  <th style={{ width: '140px', textAlign: 'center' }}>Conversion Status</th>
                  <th style={{ width: '260px', textAlign: 'center' }} className="no-print">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={14} className="cell-center" style={{ padding: '30px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#0055aa', fontWeight: 600 }}>
                        <span className="sr-spin-icon-large">🔄</span>
                        <span>Loading live manual stock data from MongoDB...</span>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={14} className="cell-center" style={{ padding: '24px', color: '#dc2626' }}>
                      ⚠️ {error}
                      <button type="button" onClick={fetchReport} className="ms-btn" style={{ marginLeft: '10px' }}>
                        Retry
                      </button>
                    </td>
                  </tr>
                ) : data.items.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="cell-center" style={{ padding: '40px 20px' }}>
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

                        {/* Available Manual Stock with Status Colors */}
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

                        {/* Issued Invoice Numbers */}
                        <td className="cell-center">
                          {item.associatedInvoiceNumbers && item.associatedInvoiceNumbers.length > 0 ? (
                            <div className="ms-inv-tags-container">
                              {item.associatedInvoiceNumbers.map((invNo) => (
                                <button
                                  key={invNo}
                                  type="button"
                                  className="ms-inv-tag-btn"
                                  onClick={() => handleOpenInvoiceByNumber(invNo)}
                                  title={`Click to view manual invoice ${invNo}`}
                                >
                                  🧾 {invNo}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '11px' }}>-</span>
                          )}
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

                        {/* Actions Menu */}
                        <td className="cell-center no-print">
                          <div className="ms-action-cell">
                            <button
                              type="button"
                              className="ms-row-btn btn-details"
                              onClick={() => handleOpenDetails(item)}
                              title="View detailed product profile & histories"
                            >
                              👁️ View Details
                            </button>

                            {!isConverted && (
                              <>
                                <button
                                  type="button"
                                  className="ms-row-btn btn-stock"
                                  onClick={() => handleOpenAddStock(item)}
                                  title="Record stock receipt"
                                >
                                  ➕ Add Stock
                                </button>
                                <button
                                  type="button"
                                  className="ms-row-btn btn-convert"
                                  onClick={() => handleOpenConvert(item)}
                                  title="Promote to Item Master"
                                >
                                  ⭐ Convert to Master
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

          {/* Pagination Footer */}
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
      ) : (
        /* VIEW MODE 2: Issued Manual Invoices Table */
        <div className="ms-table-wrapper">
          {/* Summary Banner with all invoice numbers */}
          <div className="ms-invoices-summary-banner no-print">
            <div className="ms-invoices-summary-text">
              <span style={{ fontSize: '18px' }}>🧾</span>
              <div>
                <strong>Total Manual Invoices Issued: {kpiStats.totalManualInvoicesIssued}</strong>
                <span style={{ margin: '0 8px', color: '#cbd5e1' }}>|</span>
                <span>Total Revenue: <strong>Rs. {kpiStats.totalManualInvoicesAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
              </div>
            </div>

            {/* Quick Chips of all invoice numbers */}
            {kpiStats.allIssuedInvoiceNumbers && kpiStats.allIssuedInvoiceNumbers.length > 0 && (
              <div className="ms-invoices-summary-tags">
                <span className="ms-invoices-summary-label">Invoice Numbers:</span>
                {kpiStats.allIssuedInvoiceNumbers.map((invNo) => (
                  <button
                    key={invNo}
                    type="button"
                    className="ms-inv-tag-btn"
                    onClick={() => handleOpenInvoiceByNumber(invNo)}
                    title={`Click to view full details of ${invNo}`}
                  >
                    🧾 {invNo}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Filter Search for Invoices */}
          <div className="ms-filter-panel no-print" style={{ marginBottom: '10px', padding: '8px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                Filter Invoices:
              </span>
              <input
                type="text"
                className="ms-input"
                style={{ flex: 1, maxWidth: '400px' }}
                placeholder="Search invoice number (e.g. MAN-0001), customer, item description..."
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
              />
              {invoiceSearch && (
                <button
                  type="button"
                  className="ms-btn-clear"
                  onClick={() => setInvoiceSearch('')}
                >
                  ✕ Clear
                </button>
              )}
              <span style={{ fontSize: '11px', color: '#64748b', marginLeft: 'auto' }}>
                Showing {filteredManualInvoices.length} of {data.manualInvoices.length} manual invoices
              </span>
            </div>
          </div>

          {/* Invoices Table */}
          <div className="ms-table-scroll">
            <table className="ms-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                  <th style={{ width: '130px', textAlign: 'center' }}>Invoice Number</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Date &amp; Time</th>
                  <th style={{ minWidth: '180px' }}>Customer Name</th>
                  <th style={{ width: '110px' }}>Telephone</th>
                  <th style={{ minWidth: '240px' }}>Items Sold</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>Gross Total</th>
                  <th style={{ width: '90px', textAlign: 'right' }}>Discount</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Net Total</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Payment</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Cashier</th>
                  <th style={{ width: '140px', textAlign: 'center' }} className="no-print">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredManualInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="cell-center" style={{ padding: '36px' }}>
                      <div style={{ fontSize: '28px', marginBottom: '8px' }}>🧾</div>
                      <div style={{ fontWeight: 600, color: '#334155' }}>No manual invoices found.</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                        Invoices issued with invoice numbers starting with MAN- or created via Manual Invoicing will appear here.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredManualInvoices.map((inv, idx) => (
                    <tr key={inv._id || inv.invoiceNumber}>
                      <td className="cell-center" style={{ color: '#64748b', fontSize: '11px' }}>{idx + 1}</td>
                      <td className="cell-center">
                        <button
                          type="button"
                          className="ms-inv-tag-btn"
                          style={{ fontSize: '12px', padding: '3px 8px' }}
                          onClick={() => handleOpenInvoiceByNumber(inv.invoiceNumber)}
                          title={`Click to view full details of ${inv.invoiceNumber}`}
                        >
                          🧾 {inv.invoiceNumber}
                        </button>
                      </td>
                      <td className="cell-center" style={{ fontSize: '11px', color: '#475569' }}>
                        {inv.date ? new Date(inv.date).toLocaleDateString() : '-'}
                      </td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>
                        {inv.customerName || 'Walk In Customer'}
                        {inv.customerCode && (
                          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'normal' }}>
                            Code: {inv.customerCode}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: '11px', color: '#64748b' }}>
                        {inv.telephone || '-'}
                      </td>
                      <td>
                        <div className="ms-inv-items-chips">
                          {(inv.lineItems || []).map((li, liIdx) => (
                            <div key={liIdx} className="ms-inv-item-chip" title={`${li.description} (${li.quantity} ${li.unit || 'PCS'} @ Rs. ${li.unitPrice})`}>
                              • <strong>{li.quantity} {li.unit || 'PCS'}</strong> {li.description}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="cell-num">Rs. {(inv.grossTotal || inv.netTotal || 0).toFixed(2)}</td>
                      <td className="cell-num" style={{ color: inv.discountAmount > 0 ? '#dc2626' : '#94a3b8' }}>
                        {inv.discountAmount > 0 ? `-Rs. ${inv.discountAmount.toFixed(2)}` : '-'}
                      </td>
                      <td className="cell-num" style={{ fontWeight: 800, color: '#0055aa', fontSize: '13px' }}>
                        Rs. {(inv.netTotal || 0).toFixed(2)}
                      </td>
                      <td className="cell-center">
                        <span className="ms-badge ms-badge-zero" style={{ background: '#f1f5f9', color: '#334155' }}>
                          {inv.paymentMethod || 'Cash'}
                        </span>
                      </td>
                      <td className="cell-center" style={{ fontSize: '11px', color: '#64748b' }}>
                        {inv.cashier || 'Cashier'}
                      </td>
                      <td className="cell-center no-print">
                        <div className="ms-action-cell">
                          <button
                            type="button"
                            className="ms-row-btn btn-details"
                            onClick={() => setSelectedInvoiceModal(inv)}
                            title="View full invoice modal"
                          >
                            👁️ View
                          </button>
                          <button
                            type="button"
                            className="ms-row-btn btn-history"
                            onClick={() => {
                              setSelectedInvoiceModal(inv);
                              setTimeout(() => window.print(), 200);
                            }}
                            title="Print invoice"
                          >
                            🖨️ Print
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Invoices Footer */}
          <div className="ms-footer no-print">
            <div>
              Showing {filteredManualInvoices.length} of {data.manualInvoices.length} manual invoices
              {lastRefreshed && <span style={{ marginLeft: '12px', color: '#94a3b8' }}>• Updated: {lastRefreshed}</span>}
            </div>
          </div>
        </div>
      )}

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
                                <td style={{ fontWeight: 600 }}>
                                  <button
                                    type="button"
                                    className="ms-inv-tag-btn"
                                    onClick={() => handleOpenInvoiceByNumber(s.referenceNumber)}
                                    title={`Click to view invoice details for ${s.referenceNumber}`}
                                  >
                                    🧾 {s.referenceNumber}
                                  </button>
                                </td>
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
              {detailsItem.status !== 'Converted' && (
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

                {/* Stock Reconciliation Summary Banner (Requirement 6 & 7) */}
                <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px 14px', marginBottom: '14px', fontSize: '12px' }}>
                  <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>⚖️ Stock Calculation & Reconciliation:</span>
                    <span style={{ background: '#e2e8f0', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace' }}>
                      {convertFormData.manualCode}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
                    <div style={{ background: '#fff', padding: '6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>CONFIRMED RECEIVED</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0284c7' }}>
                        {convertFormData.totalStockAdded || 0} {convertFormData.unit}
                      </div>
                    </div>
                    <div style={{ background: '#fff', padding: '6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>PREVIOUSLY SOLD</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#dc2626' }}>
                        {convertFormData.totalSalesQty || 0} {convertFormData.unit}
                      </div>
                    </div>
                    <div style={{ background: '#fff', padding: '6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>INITIAL MASTER STOCK</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#16a34a' }}>
                        {Math.max(0, (convertFormData.totalStockAdded || 0) - (convertFormData.totalSalesQty || 0))} {convertFormData.unit}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: '6px', fontSize: '11px', color: '#475569', fontStyle: 'italic' }}>
                    Available Stock = Confirmed Received ({convertFormData.totalStockAdded || 0}) - Previously Sold ({convertFormData.totalSalesQty || 0}) = {Math.max(0, (convertFormData.totalStockAdded || 0) - (convertFormData.totalSalesQty || 0))} {convertFormData.unit}
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

      {/* ========================================================================= */}
      {/* 5. MANUAL INVOICE DETAILS MODAL                                           */}
      {/* ========================================================================= */}
      {selectedInvoiceModal && (
        <div className="ms-modal-overlay" onClick={() => setSelectedInvoiceModal(null)}>
          <div className="ms-modal-dialog ms-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="ms-modal-header ms-inv-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>🧾</span>
                <div>
                  <h3 style={{ margin: 0, color: '#ffffff' }}>
                    MANUAL INVOICE: {selectedInvoiceModal.invoiceNumber}
                  </h3>
                  <div style={{ fontSize: '11px', color: '#e0f2fe', marginTop: '2px' }}>
                    Issued Date: {new Date(selectedInvoiceModal.date || selectedInvoiceModal.createdAt).toLocaleDateString()} | Status: Completed
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="ms-modal-close"
                style={{ color: '#ffffff' }}
                onClick={() => setSelectedInvoiceModal(null)}
              >
                ×
              </button>
            </div>
            <div className="ms-modal-body">
              {/* Customer & Invoice Meta Details */}
              <div className="ms-inv-meta-grid">
                <div className="ms-inv-meta-card">
                  <div className="ms-inv-meta-label">Customer Information</div>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#003366' }}>
                    {selectedInvoiceModal.customerName || selectedInvoiceModal.cusname || 'Walk In Customer'}
                  </div>
                  {selectedInvoiceModal.customerCode && (
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Code: {selectedInvoiceModal.customerCode}</div>
                  )}
                  {selectedInvoiceModal.telephone && (
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Phone: {selectedInvoiceModal.telephone}</div>
                  )}
                  {selectedInvoiceModal.address && (
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Address: {selectedInvoiceModal.address}</div>
                  )}
                </div>

                <div className="ms-inv-meta-card">
                  <div className="ms-inv-meta-label">Invoice Information</div>
                  <div style={{ fontSize: '12px', color: '#334155', marginTop: '2px' }}>
                    Invoice No: <strong>{selectedInvoiceModal.invoiceNumber}</strong>
                  </div>
                  <div style={{ fontSize: '12px', color: '#334155' }}>
                    Payment Method: <strong>{selectedInvoiceModal.paymentMethod || 'Cash'}</strong>
                  </div>
                  <div style={{ fontSize: '12px', color: '#334155' }}>
                    Cashier / User: <strong>{selectedInvoiceModal.cashier || 'Cashier'}</strong>
                  </div>
                </div>

                <div className="ms-inv-meta-card ms-inv-meta-amount">
                  <div className="ms-inv-meta-label">Net Total Payable</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#0055aa' }}>
                    Rs. {(Number(selectedInvoiceModal.netTotal || selectedInvoiceModal.totalAmount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    {(selectedInvoiceModal.lineItems || []).length} items in invoice
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#003366', fontWeight: 700 }}>
                  INVOICE ITEMS ({(selectedInvoiceModal.lineItems || []).length})
                </h4>
                <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                  <table className="ms-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                        <th style={{ width: '120px' }}>Item Code</th>
                        <th>Description</th>
                        <th style={{ width: '60px', textAlign: 'center' }}>Unit</th>
                        <th style={{ width: '90px', textAlign: 'right' }}>Qty</th>
                        <th style={{ width: '110px', textAlign: 'right' }}>Unit Price</th>
                        <th style={{ width: '120px', textAlign: 'right' }}>Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedInvoiceModal.lineItems || []).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="cell-center" style={{ padding: '16px', color: '#64748b' }}>
                            No line item details found for this invoice.
                          </td>
                        </tr>
                      ) : (
                        selectedInvoiceModal.lineItems.map((item, idx) => (
                          <tr key={idx}>
                            <td className="cell-center" style={{ color: '#64748b', fontSize: '11px' }}>{idx + 1}</td>
                            <td className="cell-code">{item.code || item.itemCode || '-'}</td>
                            <td className="cell-desc" style={{ fontWeight: 600 }}>{item.description}</td>
                            <td className="cell-center">{item.unit || 'PCS'}</td>
                            <td className="cell-num" style={{ fontWeight: 600 }}>{item.quantity || item.qty || 1}</td>
                            <td className="cell-num">Rs. {(Number(item.price || item.unitPrice || 0)).toFixed(2)}</td>
                            <td className="cell-num" style={{ fontWeight: 700, color: '#0055aa' }}>
                              Rs. {((Number(item.quantity || item.qty || 1)) * (Number(item.price || item.unitPrice || 0))).toFixed(2)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Summary */}
              <div className="ms-inv-totals-box">
                <div className="ms-inv-totals-row">
                  <span>Gross Subtotal:</span>
                  <span>Rs. {(Number(selectedInvoiceModal.grossTotal || selectedInvoiceModal.subtotal || selectedInvoiceModal.netTotal || 0)).toFixed(2)}</span>
                </div>
                {Number(selectedInvoiceModal.discountAmount) > 0 && (
                  <div className="ms-inv-totals-row" style={{ color: '#dc2626' }}>
                    <span>Discount:</span>
                    <span>- Rs. {Number(selectedInvoiceModal.discountAmount).toFixed(2)}</span>
                  </div>
                )}
                <div className="ms-inv-totals-row ms-inv-totals-net">
                  <span>Net Total:</span>
                  <span>Rs. {(Number(selectedInvoiceModal.netTotal || selectedInvoiceModal.totalAmount || 0)).toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="ms-modal-footer">
              <button
                type="button"
                className="ms-btn ms-btn-primary"
                onClick={() => window.print()}
              >
                🖨️ Print Invoice
              </button>
              <button
                type="button"
                className="ms-btn"
                onClick={() => setSelectedInvoiceModal(null)}
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

export default ManualStockReportView;
