import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';
import './ReportsNewFeatures.css';

/**
 * StockReportView Component
 * Official Stock Report for SOFAST MOTORS POS
 * Displays authoritative available inventory, reorder levels, locations, GRN costs, and selling prices.
 */
function StockReportView({ initialStockStatus = 'all', onNavigateTab }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [subCategory, setSubCategory] = useState('All');
  const [location, setLocation] = useState('All');
  const [stockStatus, setStockStatus] = useState(initialStockStatus);
  const [sortBy, setSortBy] = useState('code_asc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    items: [],
    summary: {
      totalItems: 0,
      totalAvailableStock: 0,
      totalValuation: 0,
      inStockCount: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
    },
    pagination: {
      page: 1,
      limit: 50,
      totalRecords: 0,
      totalPages: 1,
    },
    filterOptions: {
      categories: [],
      subCategories: [],
      locations: [],
    },
  });

  const [lastRefreshed, setLastRefreshed] = useState(null);

  // Fetch stock report from backend
  const fetchStockReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get('/reports/stock-report', {
        params: {
          search: search.trim(),
          category,
          subCategory,
          location,
          status: stockStatus,
          sortBy,
          page,
          limit,
        },
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
        },
      });

      // Verify HTTP status
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      // Check response content type before using
      const contentType = response.headers?.['content-type'] || '';
      if (contentType && !contentType.includes('application/json')) {
        throw new Error(`Expected JSON response but received ${contentType}. Please check backend.`);
      }

      const json = response.data;
      if (json && json.success) {
        setData(json);
        setLastRefreshed(new Date());
      } else {
        throw new Error(json?.message || 'Failed to load stock report');
      }
    } catch (err) {
      console.error('Error loading stock report:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Unable to connect to database';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [search, category, subCategory, location, stockStatus, sortBy, page, limit]);

  useEffect(() => {
    fetchStockReport();
  }, [fetchStockReport]);

  // Reset page to 1 when filters change
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleCategoryChange = (e) => {
    setCategory(e.target.value);
    setPage(1);
  };

  const handleSubCategoryChange = (e) => {
    setSubCategory(e.target.value);
    setPage(1);
  };

  const handleLocationChange = (e) => {
    setLocation(e.target.value);
    setPage(1);
  };

  const handleStatusChange = (e) => {
    setStockStatus(e.target.value);
    setPage(1);
  };

  const handleSortChange = (e) => {
    setSortBy(e.target.value);
    setPage(1);
  };

  const handleLimitChange = (e) => {
    setLimit(Number(e.target.value));
    setPage(1);
  };

  // Quick filter helpers from summary cards
  const handleQuickFilter = (status) => {
    setStockStatus(status);
    setPage(1);
  };

  // Export to CSV / Excel
  const handleExportCSV = async () => {
    try {
      setLoading(true);
      // Fetch all matching records without pagination for full export
      const response = await api.get('/reports/stock-report', {
        params: {
          search: search.trim(),
          category,
          subCategory,
          location,
          status: stockStatus,
          sortBy,
          page: 1,
          limit: 0, // 0 = all matching records
        },
        headers: {
          'Accept': 'application/json',
        },
      });

      const json = response.data;
      const exportItems = json?.items || data.items || [];

      if (exportItems.length === 0) {
        alert('No stock records to export.');
        return;
      }

      const headers = [
        'Item Code',
        'Item Description',
        'Category',
        'Subcategory',
        'Location',
        'Available Stock Quantity',
        'Reorder Level',
        'Stock Status',
        'Last GRN Date',
        'Last GRN Purchase Cost (Rs.)',
        'Selling Price (Rs.)',
        'Valuation (Rs.)',
      ];

      const csvRows = [headers.join(',')];

      exportItems.forEach((itm) => {
        const row = [
          `"${String(itm.code || '').replace(/"/g, '""')}"`,
          `"${String(itm.description || '').replace(/"/g, '""')}"`,
          `"${String(itm.category || '').replace(/"/g, '""')}"`,
          `"${String(itm.subCategory || '').replace(/"/g, '""')}"`,
          `"${String(itm.location || '').replace(/"/g, '""')}"`,
          itm.availableStock !== undefined ? itm.availableStock : 0,
          itm.reorderLevel !== undefined ? itm.reorderLevel : 0,
          `"${itm.stockStatus || 'In Stock'}"`,
          `"${itm.lastGrnDate || ''}"`,
          (Number(itm.lastGrnPurchaseCost) || 0).toFixed(2),
          (Number(itm.sellingPrice) || 0).toFixed(2),
          (Number(itm.valuation) || 0).toFixed(2),
        ];
        csvRows.push(row.join(','));
      });

      const csvContent = '\uFEFF' + csvRows.join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      link.setAttribute('href', url);
      link.setAttribute('download', `SOFAST_Stock_Report_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export stock report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Print function
  const handlePrint = () => {
    window.print();
  };

  const { items = [], summary = {}, pagination = {}, filterOptions = {} } = data;
  const { totalPages = 1, totalRecords = 0 } = pagination;

  return (
    <div className="stock-report-container">
      {/* 1. Header Toolbar with Title and Action Buttons */}
      <div className="sr-header-banner no-print">
        <div className="sr-title-block">
          <div className="sr-title-icon">📋</div>
          <div>
            <h2 className="sr-title">Stock Report (Authoritative Inventory)</h2>
            <p className="sr-subtitle">
              Live database balances across all registered items in Item Master &amp; Warehouse
            </p>
          </div>
        </div>

        <div className="sr-actions-block">
          <button
            type="button"
            className="sr-btn sr-btn-refresh"
            onClick={fetchStockReport}
            disabled={loading}
            title="Reload live stock data from MongoDB Atlas"
          >
            <span className={`sr-spin-icon ${loading ? 'spinning' : ''}`}>🔄</span>
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            className="sr-btn sr-btn-export"
            onClick={handleExportCSV}
            disabled={loading || totalRecords === 0}
            title="Download complete filtered inventory to CSV/Excel format"
          >
            <span>📊</span>
            <span>Export to CSV / Excel</span>
          </button>

          <button
            type="button"
            className="sr-btn sr-btn-print"
            onClick={handlePrint}
            title="Print printable stock report"
          >
            <span>🖨️</span>
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* 2. Top Metric Cards Strip */}
      <div className="sr-summary-strip no-print">
        <div
          className={`sr-kpi-card ${stockStatus === 'all' ? 'active-card' : ''}`}
          onClick={() => handleQuickFilter('all')}
          title="Click to view all items"
        >
          <div className="sr-kpi-title">TOTAL REGISTERED ITEMS</div>
          <div className="sr-kpi-val blue-text">
            {(summary.totalItems || 0).toLocaleString()}
          </div>
          <div className="sr-kpi-sub">Items in Master File</div>
        </div>

        <div className="sr-kpi-card">
          <div className="sr-kpi-title">TOTAL AVAILABLE STOCK</div>
          <div className="sr-kpi-val green-text">
            {(summary.totalAvailableStock || 0).toLocaleString()} <span className="sr-unit">Pcs</span>
          </div>
          <div className="sr-kpi-sub">Across All Locations</div>
        </div>

        <div className="sr-kpi-card">
          <div className="sr-kpi-title">TOTAL INVENTORY VALUE</div>
          <div className="sr-kpi-val purple-text">
            Rs. {(summary.totalValuation || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="sr-kpi-sub">Calculated at GRN / Cost</div>
        </div>

        <div
          className={`sr-kpi-card ${stockStatus === 'in_stock' ? 'active-card' : ''}`}
          onClick={() => handleQuickFilter('in_stock')}
          title="Click to filter In Stock only"
        >
          <div className="sr-kpi-title">IN-STOCK ITEMS</div>
          <div className="sr-kpi-val teal-text">
            {(summary.inStockCount || 0).toLocaleString()}
          </div>
          <div className="sr-kpi-sub">Quantity &gt; Reorder Level</div>
        </div>

        <div
          className={`sr-kpi-card ${stockStatus === 'low_stock' ? 'active-card' : ''}`}
          onClick={() => handleQuickFilter('low_stock')}
          title="Click to filter Low Stock only"
        >
          <div className="sr-kpi-title">LOW-STOCK ITEMS</div>
          <div className="sr-kpi-val orange-text">
            {(summary.lowStockCount || 0).toLocaleString()}
          </div>
          <div className="sr-kpi-sub">At or Below Reorder Level</div>
        </div>

        <div
          className={`sr-kpi-card ${stockStatus === 'out_of_stock' ? 'active-card' : ''}`}
          onClick={() => handleQuickFilter('out_of_stock')}
          title="Click to filter Out of Stock only"
        >
          <div className="sr-kpi-title">OUT-OF-STOCK ITEMS</div>
          <div className="sr-kpi-val red-text">
            {(summary.outOfStockCount || 0).toLocaleString()}
          </div>
          <div className="sr-kpi-sub">Zero Sellable Stock</div>
        </div>
      </div>

      {/* 3. Filter Controls Box */}
      <div className="sr-filter-box no-print">
        <div className="sr-filter-group sr-search-group">
          <label htmlFor="sr-search-input">Search Code / Description:</label>
          <div className="sr-input-with-icon">
            <span className="sr-search-icon">🔍</span>
            <input
              id="sr-search-input"
              type="text"
              placeholder="Filter by Item Code or Description..."
              value={search}
              onChange={handleSearchChange}
              className="sr-text-input"
            />
            {search && (
              <button
                type="button"
                className="sr-clear-btn"
                onClick={() => { setSearch(''); setPage(1); }}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="sr-filter-group">
          <label htmlFor="sr-category-select">Category:</label>
          <select
            id="sr-category-select"
            value={category}
            onChange={handleCategoryChange}
            className="sr-select"
          >
            <option value="All">All Categories</option>
            {(filterOptions.categories || []).map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="sr-filter-group">
          <label htmlFor="sr-subcategory-select">Subcategory:</label>
          <select
            id="sr-subcategory-select"
            value={subCategory}
            onChange={handleSubCategoryChange}
            className="sr-select"
          >
            <option value="All">All Subcategories</option>
            {(filterOptions.subCategories || []).map((sc) => (
              <option key={sc} value={sc}>
                {sc}
              </option>
            ))}
          </select>
        </div>

        <div className="sr-filter-group">
          <label htmlFor="sr-location-select">Location:</label>
          <select
            id="sr-location-select"
            value={location}
            onChange={handleLocationChange}
            className="sr-select"
          >
            <option value="All">All Locations</option>
            {(filterOptions.locations || []).map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        <div className="sr-filter-group">
          <label htmlFor="sr-status-select">Stock Status:</label>
          <select
            id="sr-status-select"
            value={stockStatus}
            onChange={handleStatusChange}
            className="sr-select"
          >
            <option value="all">All Statuses</option>
            <option value="in_stock">In Stock Only</option>
            <option value="low_stock">⚠️ Low Stock (Below Reorder)</option>
            <option value="out_of_stock">❌ Out of Stock (Zero Stock)</option>
          </select>
        </div>

        <div className="sr-filter-group">
          <label htmlFor="sr-sort-select">Sort By:</label>
          <select
            id="sr-sort-select"
            value={sortBy}
            onChange={handleSortChange}
            className="sr-select"
          >
            <option value="code_asc">Item Code (A - Z)</option>
            <option value="code_desc">Item Code (Z - A)</option>
            <option value="desc_asc">Description (A - Z)</option>
            <option value="desc_desc">Description (Z - A)</option>
            <option value="qty_desc">Available Qty (High to Low)</option>
            <option value="qty_asc">Available Qty (Low to High)</option>
            <option value="cost_desc">Purchase Cost (High to Low)</option>
            <option value="price_desc">Selling Price (High to Low)</option>
          </select>
        </div>

        <div className="sr-filter-group sr-limit-group">
          <label htmlFor="sr-limit-select">Rows per page:</label>
          <select
            id="sr-limit-select"
            value={limit}
            onChange={handleLimitChange}
            className="sr-select"
          >
            <option value={25}>25 Rows</option>
            <option value={50}>50 Rows</option>
            <option value={100}>100 Rows</option>
            <option value={250}>250 Rows</option>
            <option value={0}>All Records</option>
          </select>
        </div>
      </div>

      {/* 4. Printable Company Header (Only visible when printing) */}
      <div className="sr-print-header print-only">
        <div className="sr-print-company-name">SOFAST (PVT) LTD</div>
        <div className="sr-print-company-address">
          7E, MADDEGODA ROAD, MATHUGAMA • Tel: 034-2210680, 074-0295088
        </div>
        <div className="sr-print-report-title">STOCK REPORT — INVENTORY BALANCES AUDIT</div>
        <div className="sr-print-meta">
          <span>Date: {new Date().toLocaleDateString('en-GB')}</span>
          <span>Category: {category}</span>
          <span>Location: {location}</span>
          <span>Status Filter: {stockStatus.toUpperCase()}</span>
          <span>Total Items: {totalRecords}</span>
          <span>Total Valuation: Rs. {(summary.totalValuation || 0).toLocaleString()}</span>
        </div>
      </div>

      {/* 5. Main Data Table */}
      <div className="sr-table-container">
        {loading && (
          <div className="sr-loading-overlay">
            <span className="sr-spin-icon-large">🔄</span>
            <strong>Loading live stock data from MongoDB Atlas...</strong>
          </div>
        )}

        {error && (
          <div className="sr-error-banner">
            <span>⚠️</span>
            <span>{error}</span>
            <button type="button" onClick={fetchStockReport} className="sr-retry-btn">
              Retry
            </button>
          </div>
        )}

        <table className="sr-data-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>#</th>
              <th style={{ width: '110px' }}>Item Code</th>
              <th style={{ minWidth: '220px' }}>Item Description</th>
              <th style={{ width: '100px' }}>Category</th>
              <th style={{ width: '90px' }}>Subcategory</th>
              <th style={{ width: '95px' }}>Location</th>
              <th style={{ width: '100px', textAlign: 'right' }}>Available Qty</th>
              <th style={{ width: '85px', textAlign: 'right' }}>Reorder Lvl</th>
              <th style={{ width: '105px', textAlign: 'center' }}>Stock Status</th>
              <th style={{ width: '95px', textAlign: 'center' }}>Last GRN Date</th>
              <th style={{ width: '110px', textAlign: 'right' }}>Last GRN Cost</th>
              <th style={{ width: '110px', textAlign: 'right' }}>Selling Price</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading ? (
              <tr>
                <td colSpan={12} className="sr-no-data-cell">
                  <div className="sr-empty-state">
                    <span style={{ fontSize: '28px' }}>📦</span>
                    <p>No inventory items match the current search &amp; filter criteria.</p>
                    {(search || category !== 'All' || subCategory !== 'All' || location !== 'All' || stockStatus !== 'all') && (
                      <button
                        type="button"
                        className="sr-reset-filters-btn"
                        onClick={() => {
                          setSearch('');
                          setCategory('All');
                          setSubCategory('All');
                          setLocation('All');
                          setStockStatus('all');
                          setPage(1);
                        }}
                      >
                        Reset All Filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              items.map((itm, idx) => {
                const rowNum = limit === 0 ? idx + 1 : (page - 1) * limit + idx + 1;
                const isOutOfStock = itm.isOutOfStock || itm.availableStock <= 0;
                const isLowStock = !isOutOfStock && itm.isLowStock;

                return (
                  <tr
                    key={itm._id || itm.code}
                    className={`sr-table-row ${
                      isOutOfStock ? 'sr-row-out' : isLowStock ? 'sr-row-low' : idx % 2 === 0 ? 'sr-row-even' : 'sr-row-odd'
                    }`}
                  >
                    <td className="sr-cell-center text-muted">{rowNum}</td>
                    <td className="sr-cell-code">
                      <span className="sr-code-text">{itm.code}</span>
                    </td>
                    <td className="sr-cell-desc" title={itm.description}>
                      {itm.description}
                    </td>
                    <td>
                      <span className="sr-cat-tag">{itm.category || 'GENERAL'}</span>
                    </td>
                    <td className="sr-subcat-text">{itm.subCategory || 'N/A'}</td>
                    <td>
                      <span className="sr-loc-badge">{itm.location || 'Main Store'}</span>
                    </td>
                    <td className="sr-cell-right">
                      <span
                        className={`sr-qty-badge ${
                          isOutOfStock ? 'qty-out' : isLowStock ? 'qty-low' : 'qty-ok'
                        }`}
                      >
                        {itm.availableStock.toLocaleString()}
                      </span>
                    </td>
                    <td className="sr-cell-right text-muted">
                      {itm.reorderLevel > 0 ? itm.reorderLevel.toLocaleString() : '0'}
                    </td>
                    <td className="sr-cell-center">
                      {isOutOfStock ? (
                        <span className="sr-status-pill status-out" title="Sellable stock is zero">
                          ❌ Out of Stock
                        </span>
                      ) : isLowStock ? (
                        <span className="sr-status-pill status-low" title="Below reorder threshold">
                          ⚠️ Low Stock
                        </span>
                      ) : (
                        <span className="sr-status-pill status-ok" title="Stock is sufficient">
                          ✓ In Stock
                        </span>
                      )}
                    </td>
                    <td className="sr-cell-center sr-grn-date text-muted">
                      {itm.lastGrnDate ? itm.lastGrnDate.slice(0, 10) : '—'}
                    </td>
                    <td className="sr-cell-right sr-price-col">
                      {itm.lastGrnPurchaseCost > 0
                        ? `Rs. ${itm.lastGrnPurchaseCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '—'}
                    </td>
                    <td className="sr-cell-right sr-price-col font-weight-bold">
                      {itm.sellingPrice > 0
                        ? `Rs. ${itm.sellingPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 6. Footer Pagination and Summary Bar */}
      <div className="sr-footer-bar no-print">
        <div className="sr-footer-left">
          <span>
            Showing{' '}
            <strong>
              {totalRecords === 0
                ? 0
                : limit === 0
                ? 1
                : (page - 1) * limit + 1}
            </strong>{' '}
            to{' '}
            <strong>
              {limit === 0 ? totalRecords : Math.min(page * limit, totalRecords)}
            </strong>{' '}
            of <strong>{totalRecords.toLocaleString()}</strong> Total Matching Items
          </span>
          {lastRefreshed && (
            <span className="sr-last-sync">
              • Synced at: {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
        </div>

        {limit !== 0 && totalPages > 1 && (
          <div className="sr-pagination-controls">
            <button
              type="button"
              className="sr-pg-btn"
              onClick={() => setPage(1)}
              disabled={page === 1}
              title="First Page"
            >
              « First
            </button>
            <button
              type="button"
              className="sr-pg-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              title="Previous Page"
            >
              ‹ Prev
            </button>

            <span className="sr-pg-indicator">
              Page <strong>{page}</strong> of <strong>{totalPages}</strong>
            </span>

            <button
              type="button"
              className="sr-pg-btn"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              title="Next Page"
            >
              Next ›
            </button>
            <button
              type="button"
              className="sr-pg-btn"
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              title="Last Page"
            >
              Last »
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default StockReportView;
