import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';
import './InvoiceReportView.css';

/**
 * InvoiceReportView Component
 * Official Invoice Report for SOFAST MOTORS POS
 * Features:
 * 1. Executive Summary Cards: Total Invoices, Today's Invoices, Today's Sales, Outstanding Balance
 * 2. Combined Filters: Invoice Number, Customer, Date Range, Type, Method, Status
 * 3. Complete Saved Invoice Ledger with Pagination
 * 4. Detailed Invoice Inspector with Line Items and Settlement History
 * 5. Print Invoice & Report Support
 */
function InvoiceReportView({ onNavigateTab }) {
  // Filter States
  const [search, setSearch] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [customer, setCustomer] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [invoiceType, setInvoiceType] = useState('all');
  const [paymentMethod, setPaymentMethod] = useState('all');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [sortBy, setSortBy] = useState('date_desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  // Data States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState({
    totalInvoices: 0,
    todayInvoices: 0,
    todaySales: 0,
    totalOutstandingBalance: 0,
    matchingCount: 0,
    matchingNetTotal: 0,
    matchingAmountPaid: 0,
    matchingOutstanding: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    totalRecords: 0,
    totalPages: 1,
  });

  // Modal State for "View Details"
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [invoiceSettlements, setInvoiceSettlements] = useState([]);
  const [loadingSettlements, setLoadingSettlements] = useState(false);

  // Thermal Print Modal State
  const [printReceiptOpen, setPrintReceiptOpen] = useState(false);
  const [printInvoiceData, setPrintInvoiceData] = useState(null);

  // Fetch Report Data from Backend
  const fetchInvoiceReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        search: search.trim(),
        invoiceNumber: invoiceNumber.trim(),
        customer: customer.trim(),
        dateFrom: dateFrom || '',
        dateTo: dateTo || '',
        invoiceType,
        paymentMethod,
        paymentStatus,
        sortBy,
        page,
        limit,
      };

      const res = await api.get('/reports/invoices', { params });

      if (res.data && res.data.success) {
        setInvoices(res.data.data || []);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      } else {
        throw new Error(res.data?.message || 'Failed to load invoice report');
      }
    } catch (err) {
      console.error('[InvoiceReportView] Fetch error:', err);
      setError(err.response?.data?.message || err.message || 'Unable to connect to database');
    } finally {
      setLoading(false);
    }
  }, [search, invoiceNumber, customer, dateFrom, dateTo, invoiceType, paymentMethod, paymentStatus, sortBy, page, limit]);

  useEffect(() => {
    fetchInvoiceReport();
  }, [fetchInvoiceReport]);

  // Handle Search / Filter Form Submit
  const handleApplyFilter = (e) => {
    if (e) e.preventDefault();
    setPage(1);
    fetchInvoiceReport();
  };

  // Handle Clear / Reset Filters
  const handleResetFilters = () => {
    setSearch('');
    setInvoiceNumber('');
    setCustomer('');
    setDateFrom('');
    setDateTo('');
    setInvoiceType('all');
    setPaymentMethod('all');
    setPaymentStatus('all');
    setSortBy('date_desc');
    setPage(1);
    setLimit(50);
  };

  // Open "View Details" Modal
  const handleViewDetails = async (inv) => {
    setSelectedInvoice(inv);
    setDetailsModalOpen(true);
    setInvoiceSettlements(inv.settlements || []);

    // Also fetch fresh settlements for this invoice from settlement API
    if (inv.invoiceNumber) {
      try {
        setLoadingSettlements(true);
        const res = await api.get(`/settlements/invoice/${encodeURIComponent(inv.invoiceNumber)}`);
        if (res.data && res.data.success && Array.isArray(res.data.data)) {
          setInvoiceSettlements(res.data.data);
        }
      } catch (err) {
        console.warn('Could not fetch extra settlements:', err.message);
      } finally {
        setLoadingSettlements(false);
      }
    }
  };

  // Trigger Print for Single Invoice
  const handlePrintInvoice = (inv) => {
    setPrintInvoiceData(inv);
    setPrintReceiptOpen(true);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  // Trigger Print for Entire Report
  const handlePrintReport = () => {
    window.print();
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!invoices || invoices.length === 0) return;
    const headers = [
      'Invoice Number',
      'Date',
      'Customer Code',
      'Customer Name',
      'Invoice Type',
      'Payment Method',
      'Subtotal',
      'Discount',
      'Net Total',
      'Amount Paid',
      'Outstanding Balance',
      'Status',
    ];

    const rows = invoices.map((inv) => [
      `"${inv.invoiceNumber}"`,
      `"${inv.dateStr || ''}"`,
      `"${inv.customerCode || ''}"`,
      `"${inv.customerName || ''}"`,
      `"${inv.invoiceType || ''}"`,
      `"${inv.paymentMethod || ''}"`,
      inv.subTotal?.toFixed(2) || '0.00',
      inv.discount?.toFixed(2) || '0.00',
      inv.netTotal?.toFixed(2) || '0.00',
      inv.amountPaid?.toFixed(2) || '0.00',
      inv.outstandingBalance?.toFixed(2) || '0.00',
      `"${inv.status || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sofast_invoices_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Formatting helpers
  const formatLKR = (val) => {
    const num = Number(val) || 0;
    return `Rs. ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="inv-report-container">
      {/* Header Banner */}
      <div className="inv-header-banner no-print">
        <div className="inv-title-block">
          <span className="inv-title-icon">🧾</span>
          <div>
            <h1 className="inv-title">Invoice Report &amp; Complete Billing Ledger</h1>
            <p className="inv-subtitle">
              Live database register of all saved Sales Invoices, Manual Invoices, and settlements
            </p>
          </div>
        </div>
        <div className="inv-actions-block">
          <button
            type="button"
            className="inv-btn inv-btn-secondary"
            onClick={fetchInvoiceReport}
            disabled={loading}
            title="Reload latest invoices from database"
          >
            <span className={`inv-spin-icon ${loading ? 'spinning' : ''}`}>🔄</span> Refresh
          </button>
          <button
            type="button"
            className="inv-btn inv-btn-secondary"
            onClick={handleExportCSV}
            disabled={invoices.length === 0}
            title="Download visible invoices as CSV spreadsheet"
          >
            📥 Export CSV
          </button>
          <button
            type="button"
            className="inv-btn inv-btn-primary"
            onClick={handlePrintReport}
            title="Print invoice report"
          >
            🖨️ Print Report
          </button>
        </div>
      </div>

      {/* 1. Executive Summary Cards (Section 1) */}
      <div className="inv-kpi-strip">
        <div className="inv-kpi-card kpi-blue">
          <div className="inv-kpi-info">
            <span className="inv-kpi-label">Total Invoices</span>
            <span className="inv-kpi-value">{summary.totalInvoices}</span>
            <span className="inv-kpi-subtext">All saved invoices in database</span>
          </div>
          <div className="inv-kpi-icon-wrap" style={{ color: '#0284c7' }}>
            🧾
          </div>
        </div>

        <div className="inv-kpi-card kpi-purple">
          <div className="inv-kpi-info">
            <span className="inv-kpi-label">Today's Invoices</span>
            <span className="inv-kpi-value">{summary.todayInvoices}</span>
            <span className="inv-kpi-subtext">Created today (Asia/Colombo)</span>
          </div>
          <div className="inv-kpi-icon-wrap" style={{ color: '#7c3aed' }}>
            📅
          </div>
        </div>

        <div className="inv-kpi-card kpi-green">
          <div className="inv-kpi-info">
            <span className="inv-kpi-label">Today's Sales</span>
            <span className="inv-kpi-value">{formatLKR(summary.todaySales)}</span>
            <span className="inv-kpi-subtext">Total value of valid invoices</span>
          </div>
          <div className="inv-kpi-icon-wrap" style={{ color: '#059669' }}>
            📈
          </div>
        </div>

        <div className="inv-kpi-card kpi-amber">
          <div className="inv-kpi-info">
            <span className="inv-kpi-label">Outstanding Balance</span>
            <span className="inv-kpi-value" style={{ color: summary.totalOutstandingBalance > 0 ? '#b45309' : '#059669' }}>
              {formatLKR(summary.totalOutstandingBalance)}
            </span>
            <span className="inv-kpi-subtext">Total unpaid invoice balance</span>
          </div>
          <div className="inv-kpi-icon-wrap" style={{ color: '#d97706' }}>
            ⚖️
          </div>
        </div>
      </div>

      {/* 2. Invoice Search & Filters (Section 2) */}
      <div className="inv-filter-card no-print">
        <form onSubmit={handleApplyFilter}>
          <div className="inv-filter-grid">
            <div className="inv-filter-item">
              <label className="inv-filter-label">Invoice Number</label>
              <input
                type="text"
                className="inv-input"
                placeholder="Search Invoice # (e.g. 0018, MAN-0001)"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </div>

            <div className="inv-filter-item">
              <label className="inv-filter-label">Customer Code or Name</label>
              <input
                type="text"
                className="inv-input"
                placeholder="Search Customer (e.g. CASH, Gunawardana)"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
              />
            </div>

            <div className="inv-filter-item">
              <label className="inv-filter-label">Date From</label>
              <input
                type="date"
                className="inv-input"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="inv-filter-item">
              <label className="inv-filter-label">Date To</label>
              <input
                type="date"
                className="inv-input"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            <div className="inv-filter-item">
              <label className="inv-filter-label">Invoice Type</label>
              <select
                className="inv-select"
                value={invoiceType}
                onChange={(e) => setInvoiceType(e.target.value)}
              >
                <option value="all">All Invoice Types</option>
                <option value="standard">Normal Sales Invoice</option>
                <option value="manual">Manual Invoice</option>
                <option value="temporary">Temporary Bill</option>
              </select>
            </div>

            <div className="inv-filter-item">
              <label className="inv-filter-label">Payment Method</label>
              <select
                className="inv-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="all">All Payment Methods</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="online">Online Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="bank">Bank</option>
                <option value="credit">Credit Note</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="inv-filter-item">
              <label className="inv-filter-label">Payment Status</label>
              <select
                className="inv-select"
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
              >
                <option value="all">All Payment Statuses</option>
                <option value="paid">Paid</option>
                <option value="partial">Partially Paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="inv-filter-item">
              <label className="inv-filter-label">General Keyword Search</label>
              <input
                type="text"
                className="inv-input"
                placeholder="Item code, description, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="inv-filter-actions">
            <div className="inv-filter-stats">
              <span>
                Matching <b>{summary.matchingCount}</b> of <b>{summary.totalInvoices}</b> invoices
              </span>
              <span className="inv-stat-badge net">
                Net Total: {formatLKR(summary.matchingNetTotal)}
              </span>
              <span className="inv-stat-badge paid">
                Amount Paid: {formatLKR(summary.matchingAmountPaid)}
              </span>
              <span className="inv-stat-badge balance">
                Outstanding: {formatLKR(summary.matchingOutstanding)}
              </span>
            </div>

            <div className="inv-button-group">
              <button type="submit" className="inv-btn inv-btn-primary">
                🔍 Search / Filter
              </button>
              <button
                type="button"
                className="inv-btn inv-btn-secondary"
                onClick={handleResetFilters}
              >
                🔄 Clear / Reset
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Error Alert */}
      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #f87171', color: '#991b1b', padding: '10px 14px', borderRadius: '4px', fontSize: '12px' }}>
          ⚠️ <b>Error loading invoice data:</b> {error}
        </div>
      )}

      {/* 3. Invoice List Table (Section 3) */}
      <div className="inv-table-wrapper">
        <div className="inv-table-scroll">
          <table className="inv-table">
            <thead>
              <tr>
                <th
                  className="sortable"
                  onClick={() => setSortBy(sortBy === 'invoice_asc' ? 'invoice_desc' : 'invoice_asc')}
                  title="Click to sort by Invoice Number"
                >
                  Invoice # {sortBy === 'invoice_asc' ? '▲' : (sortBy === 'invoice_desc' ? '▼' : '')}
                </th>
                <th
                  className="sortable"
                  onClick={() => setSortBy(sortBy === 'date_asc' ? 'date_desc' : 'date_asc')}
                  title="Click to sort by Date"
                >
                  Date {sortBy === 'date_asc' ? '▲' : (sortBy === 'date_desc' ? '▼' : '')}
                </th>
                <th>Cus. Code</th>
                <th>Customer Name</th>
                <th>Invoice Type</th>
                <th>Payment Method</th>
                <th className="align-right">Subtotal</th>
                <th className="align-right">Discount</th>
                <th
                  className="align-right sortable"
                  onClick={() => setSortBy(sortBy === 'net_desc' ? 'net_asc' : 'net_desc')}
                  title="Click to sort by Net Total"
                >
                  Net Total {sortBy === 'net_desc' ? '▼' : (sortBy === 'net_asc' ? '▲' : '')}
                </th>
                <th className="align-right">Amount Paid</th>
                <th
                  className="align-right sortable"
                  onClick={() => setSortBy(sortBy === 'balance_desc' ? 'balance_asc' : 'balance_desc')}
                  title="Click to sort by Outstanding Balance"
                >
                  Outstanding {sortBy === 'balance_desc' ? '▼' : (sortBy === 'balance_asc' ? '▲' : '')}
                </th>
                <th className="align-center">Status</th>
                <th className="align-center no-print">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && invoices.length === 0 ? (
                <tr>
                  <td colSpan={13} className="inv-state-box">
                    <div className="inv-state-icon">⏳</div>
                    <div className="inv-state-text">Loading invoices from database...</div>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={13} className="inv-state-box">
                    <div className="inv-state-icon">🔍</div>
                    <div className="inv-state-text">No invoices found matching your filter criteria.</div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '11px' }}>
                      Try adjusting your date range or clearing the search fields.
                    </p>
                  </td>
                </tr>
              ) : (
                invoices.map((inv, index) => {
                  const isEven = index % 2 === 0;

                  // Status badge class
                  let statusClass = 'badge-unpaid';
                  if (inv.status === 'Paid') statusClass = 'badge-paid';
                  else if (inv.status === 'Partially Paid') statusClass = 'badge-partial';
                  else if (inv.status === 'Cancelled') statusClass = 'badge-cancelled';

                  // Type badge class
                  let typeClass = 'badge-type-normal';
                  if (inv.invoiceType === 'Manual Invoice') typeClass = 'badge-type-manual';
                  else if (inv.invoiceType === 'Temporary Bill') typeClass = 'badge-type-temp';

                  return (
                    <tr key={inv._id || inv.invoiceNumber || index} className={isEven ? 'inv-row-even' : 'inv-row-odd'}>
                      <td>
                        <span className="inv-code-text">{inv.invoiceNumber}</span>
                      </td>
                      <td>{inv.dateStr || (inv.date ? String(inv.date).split('T')[0] : '-')}</td>
                      <td>{inv.customerCode || '-'}</td>
                      <td>
                        <b>{inv.customerName || 'Walk-in Customer'}</b>
                      </td>
                      <td>
                        <span className={`inv-badge ${typeClass}`}>
                          {inv.invoiceType}
                        </span>
                      </td>
                      <td>
                        <span className="inv-badge badge-method">
                          {inv.paymentMethod || 'Cash'}
                        </span>
                      </td>
                      <td className="align-right">
                        {Number(inv.subTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="align-right" style={{ color: inv.discount > 0 ? '#b91c1c' : '#64748b' }}>
                        {Number(inv.discount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="align-right" style={{ fontWeight: '700', color: '#0f172a' }}>
                        {Number(inv.netTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="align-right" style={{ color: '#047857', fontWeight: '600' }}>
                        {Number(inv.amountPaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td
                        className="align-right"
                        style={{
                          fontWeight: '700',
                          color: inv.outstandingBalance > 0 ? '#b45309' : '#10b981',
                        }}
                      >
                        {Number(inv.outstandingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="align-center">
                        <span className={`inv-badge ${statusClass}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="align-center no-print">
                        <button
                          type="button"
                          className="inv-action-btn"
                          onClick={() => handleViewDetails(inv)}
                          title="View complete invoice details and settlements"
                        >
                          👁️ View
                        </button>
                        <button
                          type="button"
                          className="inv-action-btn print"
                          onClick={() => handlePrintInvoice(inv)}
                          title="Print invoice receipt"
                        >
                          🖨️ Print
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="inv-pagination-bar no-print">
          <div>
            Showing <b>{invoices.length}</b> of <b>{pagination.totalRecords}</b> matching records
          </div>

          <div className="inv-page-controls">
            <span style={{ marginRight: '8px' }}>Rows per page:</span>
            <select
              className="inv-select"
              style={{ padding: '2px 6px', fontSize: '11px', marginRight: '16px' }}
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={0}>All Records</option>
            </select>

            <button
              type="button"
              className="inv-page-btn"
              disabled={page <= 1 || loading}
              onClick={() => setPage(1)}
              title="First page"
            >
              ⏮
            </button>
            <button
              type="button"
              className="inv-page-btn"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              title="Previous page"
            >
              ◀ Prev
            </button>
            <span className="inv-page-info">
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>
            <button
              type="button"
              className="inv-page-btn"
              disabled={page >= pagination.totalPages || loading}
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              title="Next page"
            >
              Next ▶
            </button>
            <button
              type="button"
              className="inv-page-btn"
              disabled={page >= pagination.totalPages || loading}
              onClick={() => setPage(pagination.totalPages)}
              title="Last page"
            >
              ⏭
            </button>
          </div>
        </div>
      </div>

      {/* 4. View Invoice Details Modal (Section 4) */}
      {detailsModalOpen && selectedInvoice && (
        <div className="inv-modal-overlay no-print" onClick={() => setDetailsModalOpen(false)}>
          <div className="inv-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="inv-modal-titlebar">
              <div className="inv-modal-title">
                <span>🧾 Invoice Details — {selectedInvoice.invoiceNumber}</span>
                <span className={`inv-badge ${selectedInvoice.status === 'Paid' ? 'badge-paid' : (selectedInvoice.status === 'Cancelled' ? 'badge-cancelled' : 'badge-unpaid')}`}>
                  {selectedInvoice.status}
                </span>
                <span className="inv-badge badge-type-normal">
                  {selectedInvoice.invoiceType}
                </span>
              </div>
              <button
                type="button"
                className="inv-modal-close"
                onClick={() => setDetailsModalOpen(false)}
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="inv-modal-content">
              {/* Header and Customer Details */}
              <div className="inv-detail-card">
                <div className="inv-detail-card-title">Customer &amp; Header Information</div>
                <div className="inv-meta-grid">
                  <div className="inv-meta-item">
                    <span className="inv-meta-label">Invoice Number</span>
                    <span className="inv-meta-value inv-code-text">{selectedInvoice.invoiceNumber}</span>
                  </div>
                  <div className="inv-meta-item">
                    <span className="inv-meta-label">Date &amp; Time</span>
                    <span className="inv-meta-value">{selectedInvoice.dateStr || String(selectedInvoice.date).split('T')[0]}</span>
                  </div>
                  <div className="inv-meta-item">
                    <span className="inv-meta-label">Customer Code</span>
                    <span className="inv-meta-value">{selectedInvoice.customerCode || 'N/A'}</span>
                  </div>
                  <div className="inv-meta-item">
                    <span className="inv-meta-label">Customer Name</span>
                    <span className="inv-meta-value">{selectedInvoice.customerName || 'Walk-in Customer'}</span>
                  </div>
                  <div className="inv-meta-item">
                    <span className="inv-meta-label">Telephone</span>
                    <span className="inv-meta-value">{selectedInvoice.customerTelephone || '-'}</span>
                  </div>
                  <div className="inv-meta-item">
                    <span className="inv-meta-label">Address</span>
                    <span className="inv-meta-value">{selectedInvoice.customerAddress || '-'}</span>
                  </div>
                  <div className="inv-meta-item">
                    <span className="inv-meta-label">Payment Method</span>
                    <span className="inv-meta-value">{selectedInvoice.paymentMethod || 'Cash'}</span>
                  </div>
                  <div className="inv-meta-item">
                    <span className="inv-meta-label">Status</span>
                    <span className="inv-meta-value">{selectedInvoice.status}</span>
                  </div>
                </div>
              </div>

              {/* Items List Table */}
              <div className="inv-detail-card">
                <div className="inv-detail-card-title">Saved Invoice Items ({selectedInvoice.lineItems?.length || 0})</div>
                <table className="inv-items-table">
                  <thead>
                    <tr>
                      <th style={{ width: '30px' }}>#</th>
                      <th>Item Code</th>
                      <th>Description</th>
                      <th>Location</th>
                      <th>Unit</th>
                      <th style={{ textAlign: 'right' }}>Qty Sold</th>
                      <th style={{ textAlign: 'right' }}>Selling Price</th>
                      <th style={{ textAlign: 'right' }}>Discount</th>
                      <th style={{ textAlign: 'right' }}>Line Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!selectedInvoice.lineItems || selectedInvoice.lineItems.length === 0) ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: '16px', color: '#64748b' }}>
                          No line items recorded on this invoice.
                        </td>
                      </tr>
                    ) : (
                      selectedInvoice.lineItems.map((li, idx) => (
                        <tr key={idx}>
                          <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                          <td><b>{li.itemCode || li.code}</b></td>
                          <td>{li.description}</td>
                          <td>{li.location || 'Main Store'}</td>
                          <td>{li.unit || 'PCS'}</td>
                          <td style={{ textAlign: 'right', fontWeight: '600' }}>{li.quantity}</td>
                          <td style={{ textAlign: 'right' }}>{Number(li.sellingPrice || li.rate || 0).toFixed(2)}</td>
                          <td style={{ textAlign: 'right', color: li.discountAmount > 0 ? '#b91c1c' : '#64748b' }}>
                            {li.discountAmount > 0 ? `${Number(li.discountAmount).toFixed(2)} (${li.discountPercentage || 0}%)` : '0.00'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '700' }}>
                            {Number(li.lineValue || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Financial Totals Summary Grid */}
              <div className="inv-kpi-strip" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                <div className="inv-kpi-card" style={{ padding: '8px 10px' }}>
                  <span className="inv-kpi-label">Subtotal</span>
                  <span className="inv-kpi-value" style={{ fontSize: '15px' }}>{formatLKR(selectedInvoice.subTotal)}</span>
                </div>
                <div className="inv-kpi-card" style={{ padding: '8px 10px' }}>
                  <span className="inv-kpi-label">Total Discount</span>
                  <span className="inv-kpi-value" style={{ fontSize: '15px', color: selectedInvoice.discount > 0 ? '#b91c1c' : '#64748b' }}>
                    {formatLKR(selectedInvoice.discount)}
                  </span>
                </div>
                <div className="inv-kpi-card kpi-blue" style={{ padding: '8px 10px' }}>
                  <span className="inv-kpi-label">Net Total</span>
                  <span className="inv-kpi-value" style={{ fontSize: '16px', color: '#0284c7' }}>
                    {formatLKR(selectedInvoice.netTotal)}
                  </span>
                </div>
                <div className="inv-kpi-card kpi-green" style={{ padding: '8px 10px' }}>
                  <span className="inv-kpi-label">Amount Paid</span>
                  <span className="inv-kpi-value" style={{ fontSize: '16px', color: '#059669' }}>
                    {formatLKR(selectedInvoice.amountPaid)}
                  </span>
                </div>
                <div className="inv-kpi-card kpi-amber" style={{ padding: '8px 10px' }}>
                  <span className="inv-kpi-label">Outstanding Balance</span>
                  <span className="inv-kpi-value" style={{ fontSize: '16px', color: selectedInvoice.outstandingBalance > 0 ? '#b45309' : '#059669' }}>
                    {formatLKR(selectedInvoice.outstandingBalance)}
                  </span>
                </div>
              </div>

              {/* Payment & Settlement History */}
              <div className="inv-detail-card">
                <div className="inv-detail-card-title">
                  <span>💰 Payment &amp; Settlement History</span>
                  {loadingSettlements && <span style={{ fontSize: '11px', color: '#64748b' }}> (Refreshing...)</span>}
                </div>
                {invoiceSettlements && invoiceSettlements.length > 0 ? (
                  <table className="inv-items-table">
                    <thead>
                      <tr>
                        <th>Receipt #</th>
                        <th>Settlement Date</th>
                        <th>Payment Method</th>
                        <th style={{ textAlign: 'right' }}>Amount Paid</th>
                        <th>Cheque / Bank Details</th>
                        <th>Recorded By</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceSettlements.map((s, sIdx) => (
                        <tr key={s._id || s.receiptNo || sIdx}>
                          <td><b>{s.receiptNo}</b></td>
                          <td>{s.date ? String(s.date).split('T')[0] : '-'}</td>
                          <td><span className="inv-badge badge-method">{s.method || 'Cash'}</span></td>
                          <td style={{ textAlign: 'right', fontWeight: '700', color: '#047857' }}>
                            {formatLKR(s.amount)}
                          </td>
                          <td>{s.bank || s.chequeNo ? `${s.bank} ${s.chequeNo ? `(Cheque #${s.chequeNo})` : ''}` : '-'}</td>
                          <td>{s.createdBy || 'Staff'}</td>
                          <td>{s.remark || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ fontSize: '12px', color: '#475569', padding: '6px 0' }}>
                    {selectedInvoice.amountPaid > 0 ? (
                      <div>
                        Initial payment of <b>{formatLKR(selectedInvoice.amountPaid)}</b> recorded at invoice creation via <b>{selectedInvoice.paymentMethod || 'Cash'}</b>.
                      </div>
                    ) : (
                      <div>No payments recorded yet. Full balance of <b>{formatLKR(selectedInvoice.netTotal)}</b> remains outstanding.</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="inv-modal-footer">
              <button
                type="button"
                className="inv-btn inv-btn-primary"
                onClick={() => handlePrintInvoice(selectedInvoice)}
              >
                🖨️ Print Invoice
              </button>
              <button
                type="button"
                className="inv-btn inv-btn-secondary"
                onClick={() => setDetailsModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Thermal Receipt Preview Modal */}
      {printReceiptOpen && printInvoiceData && (
        <div className="inv-modal-overlay no-print" onClick={() => setPrintReceiptOpen(false)}>
          <div className="inv-modal-box" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="inv-modal-titlebar">
              <span>🖨️ Thermal Receipt Preview (80mm)</span>
              <button
                type="button"
                className="inv-modal-close"
                onClick={() => setPrintReceiptOpen(false)}
              >
                ✕
              </button>
            </div>
            <div style={{ background: '#555555', padding: '16px', display: 'flex', justifyContent: 'center' }}>
              <div
                style={{
                  background: '#ffffff',
                  color: '#000000',
                  padding: '14px',
                  width: '76mm',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '13px' }}>
                  SOFAST (PVT) LTD
                </div>
                <div style={{ textAlign: 'center', fontSize: '10px' }}>
                  7E, MADDEGODA ROAD, MATHUGAMA
                </div>
                <div style={{ textAlign: 'center', fontSize: '10px' }}>
                  Tel: 034-2210680, 074-0295088
                </div>
                <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Inv #: {printInvoiceData.invoiceNumber}</span>
                  <span>{printInvoiceData.dateStr}</span>
                </div>
                <div>Customer: {printInvoiceData.customerName || 'Walk-in'}</div>
                <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />

                <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #000' }}>
                      <th style={{ textAlign: 'left' }}>Item</th>
                      <th style={{ textAlign: 'right' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Price</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(printInvoiceData.lineItems || []).map((li, i) => (
                      <tr key={i}>
                        <td style={{ maxWidth: '32mm', overflow: 'hidden' }}>{li.description || li.itemCode}</td>
                        <td style={{ textAlign: 'right' }}>{li.quantity}</td>
                        <td style={{ textAlign: 'right' }}>{Number(li.sellingPrice || li.rate || 0).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(li.lineValue || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal:</span>
                  <span>Rs. {Number(printInvoiceData.subTotal || 0).toFixed(2)}</span>
                </div>
                {printInvoiceData.discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b91c1c' }}>
                    <span>Discount:</span>
                    <span>- Rs. {Number(printInvoiceData.discount || 0).toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '12px' }}>
                  <span>Net Total:</span>
                  <span>Rs. {Number(printInvoiceData.netTotal || 0).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Paid Amount:</span>
                  <span>Rs. {Number(printInvoiceData.amountPaid || 0).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                  <span>Outstanding:</span>
                  <span>Rs. {Number(printInvoiceData.outstandingBalance || 0).toFixed(2)}</span>
                </div>

                <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />
                <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '4px' }}>
                  Thank you for your business!
                </div>
              </div>
            </div>
            <div className="inv-modal-footer">
              <button
                type="button"
                className="inv-btn inv-btn-primary"
                onClick={() => window.print()}
              >
                🖨️ Print Again
              </button>
              <button
                type="button"
                className="inv-btn inv-btn-secondary"
                onClick={() => setPrintReceiptOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Dedicated Printable Elements for Browser Print */}
      <div className="print-only">
        {printInvoiceData ? (
          <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
            <h2 style={{ textAlign: 'center', margin: 0 }}>SOFAST (PVT) LTD</h2>
            <p style={{ textAlign: 'center', margin: '2px 0 10px 0', fontSize: '12px' }}>
              7E, MADDEGODA ROAD, MATHUGAMA | Tel: 034-2210680, 074-0295088
            </p>
            <hr />
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
              <div>
                <strong>Invoice Number:</strong> {printInvoiceData.invoiceNumber}<br />
                <strong>Date:</strong> {printInvoiceData.dateStr}<br />
                <strong>Invoice Type:</strong> {printInvoiceData.invoiceType}
              </div>
              <div>
                <strong>Customer:</strong> {printInvoiceData.customerName || 'Walk-in'}<br />
                <strong>Customer Code:</strong> {printInvoiceData.customerCode || 'N/A'}<br />
                <strong>Payment Method:</strong> {printInvoiceData.paymentMethod}
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '14px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #000' }}>
                  <th style={{ textAlign: 'left', padding: '6px' }}>#</th>
                  <th style={{ textAlign: 'left', padding: '6px' }}>Code</th>
                  <th style={{ textAlign: 'left', padding: '6px' }}>Description</th>
                  <th style={{ textAlign: 'right', padding: '6px' }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '6px' }}>Price</th>
                  <th style={{ textAlign: 'right', padding: '6px' }}>Discount</th>
                  <th style={{ textAlign: 'right', padding: '6px' }}>Total (Rs.)</th>
                </tr>
              </thead>
              <tbody>
                {(printInvoiceData.lineItems || []).map((li, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '6px' }}>{i + 1}</td>
                    <td style={{ padding: '6px' }}>{li.itemCode || li.code}</td>
                    <td style={{ padding: '6px' }}>{li.description}</td>
                    <td style={{ textAlign: 'right', padding: '6px' }}>{li.quantity}</td>
                    <td style={{ textAlign: 'right', padding: '6px' }}>{Number(li.sellingPrice || li.rate || 0).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', padding: '6px' }}>{Number(li.discountAmount || 0).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', padding: '6px' }}>{Number(li.lineValue || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <div style={{ width: '250px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>Subtotal:</span>
                  <span>Rs. {Number(printInvoiceData.subTotal || 0).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>Discount:</span>
                  <span>Rs. {Number(printInvoiceData.discount || 0).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontWeight: 'bold', borderTop: '1px solid #000' }}>
                  <span>Net Total:</span>
                  <span>Rs. {Number(printInvoiceData.netTotal || 0).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#047857' }}>
                  <span>Paid:</span>
                  <span>Rs. {Number(printInvoiceData.amountPaid || 0).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontWeight: 'bold' }}>
                  <span>Balance:</span>
                  <span>Rs. {Number(printInvoiceData.outstandingBalance || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '20px' }}>
            <h2>SOFAST POS — Invoice Report Ledger</h2>
            <p>Printed on: {new Date().toLocaleString()}</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Method</th>
                  <th>Net Total</th>
                  <th>Paid</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, idx) => (
                  <tr key={idx}>
                    <td>{inv.invoiceNumber}</td>
                    <td>{inv.dateStr}</td>
                    <td>{inv.customerName}</td>
                    <td>{inv.invoiceType}</td>
                    <td>{inv.paymentMethod}</td>
                    <td>{inv.netTotal?.toFixed(2)}</td>
                    <td>{inv.amountPaid?.toFixed(2)}</td>
                    <td>{inv.outstandingBalance?.toFixed(2)}</td>
                    <td>{inv.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default InvoiceReportView;
