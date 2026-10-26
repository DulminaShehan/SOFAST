import React, { useState, useEffect, useCallback } from 'react';
import './ReportsNewFeatures.css';

/**
 * ReportsDashboardView Component
 * Executive Business & Inventory Dashboard for SOFAST MOTORS POS
 * Summarizes real database transactions with 10 KPI metric cards, daily sales trends,
 * top sellers, low-stock warnings, recent invoices, GRNs, and returns.
 */
function ReportsDashboardView({ onNavigateTab }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState({
    dateInfo: {
      currentDate: new Date().toISOString().slice(0, 10),
      timezone: 'Asia/Colombo (UTC+05:30)',
      asOfTime: new Date().toLocaleTimeString(),
    },
    cards: {
      totalItems: 0,
      totalAvailableStock: 0,
      stockUnit: 'Pcs',
      outOfStockCount: 0,
      lowStockCount: 0,
      inStockCount: 0,
      todayBills: 0,
      todaySales: 0,
      todayReturns: 0,
      todayReturnValue: 0,
      todayGrns: 0,
      todayGoodsReturns: 0,
    },
    past7Days: [],
    topSellingToday: [],
    lowStockList: [],
    outOfStockList: [],
    recentInvoices: [],
    recentGrns: [],
    recentCustomerReturns: [],
  });

  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [activeTabSubView, setActiveTabSubView] = useState('overview'); // 'overview', 'low_stock', 'recent_activity'

  const fetchDashboardMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/reports/dashboard-metrics', {
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const json = await res.json();
      if (json && json.success) {
        setDashboardData(json);
        setLastRefreshed(new Date());
      } else {
        throw new Error(json.message || 'Failed to load dashboard metrics');
      }
    } catch (err) {
      console.error('Error loading dashboard metrics:', err);
      setError(err.message || 'Unable to connect to database');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardMetrics();
  }, [fetchDashboardMetrics]);

  const { cards = {}, dateInfo = {}, past7Days = [], topSellingToday = [], lowStockList = [], outOfStockList = [], recentInvoices = [], recentGrns = [], recentCustomerReturns = [] } = dashboardData;

  // Maximum value for past 7 days chart scaling
  const maxDaySales = Math.max(...past7Days.map((d) => d.sales || 0), 1000);

  // Jump to specific report tab
  const handleJumpToReport = (tabName) => {
    if (onNavigateTab) {
      onNavigateTab(tabName);
    }
  };

  return (
    <div className="reports-dashboard-container">
      {/* 1. Dashboard Top Header Bar */}
      <div className="rdb-header-banner no-print">
        <div className="rdb-title-block">
          <div className="rdb-title-icon">📊</div>
          <div>
            <h2 className="rdb-title">Reports Dashboard — Executive Business Overview</h2>
            <div className="rdb-meta-info">
              <span>📅 Date: <strong>{dateInfo.currentDate || 'Today'}</strong></span>
              <span>• Timezone: <strong>{dateInfo.timezone || 'UTC+05:30'}</strong></span>
              <span>• Synced: <strong>{lastRefreshed ? lastRefreshed.toLocaleTimeString() : dateInfo.asOfTime || 'Active'}</strong></span>
            </div>
          </div>
        </div>

        <div className="rdb-actions-block">
          <button
            type="button"
            className="rdb-btn rdb-btn-refresh"
            onClick={fetchDashboardMetrics}
            disabled={loading}
            title="Refresh metrics directly from MongoDB Atlas"
          >
            <span className={`rdb-spin-icon ${loading ? 'spinning' : ''}`}>🔄</span>
            <span>{loading ? 'Refreshing...' : 'Refresh Data'}</span>
          </button>

          <button
            type="button"
            className="rdb-btn rdb-btn-stock"
            onClick={() => handleJumpToReport('stock_report')}
            title="Open comprehensive stock report"
          >
            <span>📋</span>
            <span>Open Stock Report</span>
          </button>

          <button
            type="button"
            className="rdb-btn rdb-btn-print"
            onClick={() => window.print()}
            title="Print executive dashboard summary"
          >
            <span>🖨️</span>
            <span>Print Dashboard</span>
          </button>
        </div>
      </div>

      {loading && (
        <div className="rdb-loading-bar no-print">
          <span className="rdb-pulse-dot"></span>
          <span>Updating real-time business metrics from MongoDB Atlas...</span>
        </div>
      )}

      {error && (
        <div className="rdb-error-banner no-print">
          <span>⚠️ {error}</span>
          <button type="button" onClick={fetchDashboardMetrics} className="rdb-retry-btn">
            Retry
          </button>
        </div>
      )}

      {/* 2. The 10 Primary Summary KPI Cards (Responsive 5x2 Grid) */}
      <section className="rdb-cards-section">
        <div className="rdb-section-header">
          <span className="rdb-section-title">TODAY'S BUSINESS &amp; INVENTORY KPI METRICS</span>
          <span className="rdb-section-badge">Live Real-Time Data</span>
        </div>

        <div className="rdb-cards-grid">
          {/* Card 1: Total Items */}
          <div
            className="rdb-kpi-card card-total-items"
            onClick={() => handleJumpToReport('stock_report')}
            title="Total registered inventory items in Item Master. Click to open Stock Report."
          >
            <div className="rdb-card-top">
              <span className="rdb-card-label">1. TOTAL ITEMS</span>
              <span className="rdb-card-icon">📦</span>
            </div>
            <div className="rdb-card-value text-blue">
              {(cards.totalItems || 0).toLocaleString()}
            </div>
            <div className="rdb-card-footer">
              <span>Item Master Registry</span>
              <span className="rdb-arrow">➔</span>
            </div>
          </div>

          {/* Card 2: Total Available Stock */}
          <div
            className="rdb-kpi-card card-avail-stock"
            onClick={() => handleJumpToReport('stock_report')}
            title="Total sellable inventory across warehouse locations. Click to view balances."
          >
            <div className="rdb-card-top">
              <span className="rdb-card-label">2. TOTAL AVAILABLE STOCK</span>
              <span className="rdb-card-icon">🏷️</span>
            </div>
            <div className="rdb-card-value text-green">
              {(cards.totalAvailableStock || 0).toLocaleString()}{' '}
              <span className="rdb-card-unit">{cards.stockUnit || 'Pcs'}</span>
            </div>
            <div className="rdb-card-footer">
              <span>All Sellable Locations</span>
              <span className="rdb-arrow">➔</span>
            </div>
          </div>

          {/* Card 3: Out-of-Stock Items */}
          <div
            className="rdb-kpi-card card-out-stock"
            onClick={() => handleJumpToReport('stock_report')}
            title="Items with zero sellable stock. Click to inspect out-of-stock items."
          >
            <div className="rdb-card-top">
              <span className="rdb-card-label">3. OUT-OF-STOCK ITEMS</span>
              <span className="rdb-card-icon">❌</span>
            </div>
            <div className="rdb-card-value text-red">
              {(cards.outOfStockCount || 0).toLocaleString()}
            </div>
            <div className="rdb-card-footer">
              <span className="rdb-tag-red">Requires Reorder</span>
              <span className="rdb-arrow">➔</span>
            </div>
          </div>

          {/* Card 4: Low-Stock Items */}
          <div
            className="rdb-kpi-card card-low-stock"
            onClick={() => handleJumpToReport('stock_report')}
            title="Items at or below reorder level. Click to view low-stock alerts."
          >
            <div className="rdb-card-top">
              <span className="rdb-card-label">4. LOW-STOCK ITEMS</span>
              <span className="rdb-card-icon">⚠️</span>
            </div>
            <div className="rdb-card-value text-orange">
              {(cards.lowStockCount || 0).toLocaleString()}
            </div>
            <div className="rdb-card-footer">
              <span className="rdb-tag-orange">At / Below Reorder</span>
              <span className="rdb-arrow">➔</span>
            </div>
          </div>

          {/* Card 5: Today's Bills */}
          <div
            className="rdb-kpi-card card-today-bills"
            onClick={() => handleJumpToReport('daily_sales')}
            title="Finalized sales invoices issued today. Click to open Daily Sales Report."
          >
            <div className="rdb-card-top">
              <span className="rdb-card-label">5. TODAY'S BILLS</span>
              <span className="rdb-card-icon">🧾</span>
            </div>
            <div className="rdb-card-value text-indigo">
              {(cards.todayBills || 0).toLocaleString()}{' '}
              <span className="rdb-card-unit">Bills</span>
            </div>
            <div className="rdb-card-footer">
              <span>Finalized Invoices</span>
              <span className="rdb-arrow">➔</span>
            </div>
          </div>

          {/* Card 6: Today's Sales */}
          <div
            className="rdb-kpi-card card-today-sales"
            onClick={() => handleJumpToReport('daily_sales')}
            title="Total finalized sales revenue for today. Click to open Daily Sales Report."
          >
            <div className="rdb-card-top">
              <span className="rdb-card-label">6. TODAY'S SALES</span>
              <span className="rdb-card-icon">💰</span>
            </div>
            <div className="rdb-card-value text-emerald">
              Rs. {(cards.todaySales || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="rdb-card-footer">
              <span>Net Invoiced Revenue</span>
              <span className="rdb-arrow">➔</span>
            </div>
          </div>

          {/* Card 7: Today's Returns */}
          <div
            className="rdb-kpi-card card-today-returns"
            onClick={() => handleJumpToReport('invoice_returns')}
            title="Customer damage & counter returns recorded today. Click to open Invoice Returns Report."
          >
            <div className="rdb-card-top">
              <span className="rdb-card-label">7. TODAY'S RETURNS</span>
              <span className="rdb-card-icon">↩️</span>
            </div>
            <div className="rdb-card-value text-purple">
              {(cards.todayReturns || 0).toLocaleString()}{' '}
              <span className="rdb-card-unit">Returns</span>
            </div>
            <div className="rdb-card-footer">
              <span>Customer Returns</span>
              <span className="rdb-arrow">➔</span>
            </div>
          </div>

          {/* Card 8: Today's Return Value */}
          <div
            className="rdb-kpi-card card-return-val"
            onClick={() => handleJumpToReport('invoice_returns')}
            title="Total refund value of customer returns recorded today."
          >
            <div className="rdb-card-top">
              <span className="rdb-card-label">8. TODAY'S RETURN VALUE</span>
              <span className="rdb-card-icon">💳</span>
            </div>
            <div className="rdb-card-value text-rose">
              Rs. {(cards.todayReturnValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="rdb-card-footer">
              <span>Customer Refunds</span>
              <span className="rdb-arrow">➔</span>
            </div>
          </div>

          {/* Card 9: Today's GRNs */}
          <div
            className="rdb-kpi-card card-today-grns"
            onClick={() => handleJumpToReport('grn')}
            title="Goods Received Notes successfully posted today. Click to open GRN Report."
          >
            <div className="rdb-card-top">
              <span className="rdb-card-label">9. TODAY'S GRNs</span>
              <span className="rdb-card-icon">📥</span>
            </div>
            <div className="rdb-card-value text-teal">
              {(cards.todayGrns || 0).toLocaleString()}{' '}
              <span className="rdb-card-unit">GRNs</span>
            </div>
            <div className="rdb-card-footer">
              <span>Supplier Goods Receipts</span>
              <span className="rdb-arrow">➔</span>
            </div>
          </div>

          {/* Card 10: Today's Goods Returns */}
          <div
            className="rdb-kpi-card card-goods-returns"
            onClick={() => handleJumpToReport('goods_return_notes')}
            title="Supplier Goods Return Notes (GREN) posted today. Click to open GREN Report."
          >
            <div className="rdb-card-top">
              <span className="rdb-card-label">10. TODAY'S GOODS RETURNS</span>
              <span className="rdb-card-icon">🚚</span>
            </div>
            <div className="rdb-card-value text-amber">
              {(cards.todayGoodsReturns || 0).toLocaleString()}{' '}
              <span className="rdb-card-unit">GREN</span>
            </div>
            <div className="rdb-card-footer">
              <span>Supplier Return Notes</span>
              <span className="rdb-arrow">➔</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Middle Section: Daily Sales Summary Chart & Top Selling Items */}
      <div className="rdb-middle-grid">
        {/* Daily Sales 7-Day Visual Chart */}
        <div className="rdb-panel rdb-chart-panel">
          <div className="rdb-panel-header">
            <div>
              <h3 className="rdb-panel-title">📈 Daily Sales Summary (Past 7 Days)</h3>
              <p className="rdb-panel-subtitle">Revenue trend &amp; finalized invoice count</p>
            </div>
            <button
              type="button"
              className="rdb-panel-link-btn"
              onClick={() => handleJumpToReport('daily_sales')}
            >
              View Daily Sales Report ›
            </button>
          </div>

          <div className="rdb-chart-container">
            <div className="rdb-bars-row">
              {past7Days.map((d, idx) => {
                const heightPct = Math.min(100, Math.max(8, (d.sales / maxDaySales) * 100));
                const isToday = idx === past7Days.length - 1;

                return (
                  <div key={d.label} className="rdb-bar-column">
                    <div className="rdb-bar-val-label">
                      {d.sales > 0 ? `Rs. ${d.sales.toLocaleString()}` : '—'}
                    </div>
                    <div className="rdb-bar-track">
                      <div
                        className={`rdb-bar-fill ${isToday ? 'fill-today' : ''}`}
                        style={{ height: `${heightPct}%` }}
                      >
                        {d.bills > 0 && (
                          <span className="rdb-bar-bill-count">{d.bills} bill{d.bills > 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </div>
                    <div className={`rdb-bar-date-label ${isToday ? 'date-today' : ''}`}>
                      {d.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Top-Selling Items Today */}
        <div className="rdb-panel rdb-topsellers-panel">
          <div className="rdb-panel-header">
            <div>
              <h3 className="rdb-panel-title">🔥 Top-Selling Items Today</h3>
              <p className="rdb-panel-subtitle">Fastest moving spare parts by volume</p>
            </div>
            <button
              type="button"
              className="rdb-panel-link-btn"
              onClick={() => handleJumpToReport('top_selling')}
            >
              Full Top Selling Report ›
            </button>
          </div>

          <div className="rdb-panel-table-wrap">
            {topSellingToday.length === 0 ? (
              <div className="rdb-empty-panel">
                <span>📦 No items sold today yet.</span>
              </div>
            ) : (
              <table className="rdb-mini-table">
                <thead>
                  <tr>
                    <th style={{ width: '30px' }}>#</th>
                    <th style={{ width: '90px' }}>Code</th>
                    <th>Description</th>
                    <th style={{ width: '60px', textAlign: 'right' }}>Qty</th>
                    <th style={{ width: '95px', textAlign: 'right' }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topSellingToday.slice(0, 7).map((item, idx) => (
                    <tr key={item.code || idx}>
                      <td className="text-muted">{idx + 1}</td>
                      <td className="font-code">{item.code}</td>
                      <td className="text-truncate" title={item.description}>
                        {item.description}
                        {item.source === 'Today' && (
                          <span className="rdb-mini-badge badge-today">Today</span>
                        )}
                      </td>
                      <td className="text-right font-weight-bold">{item.quantity}</td>
                      <td className="text-right font-price">
                        Rs. {(item.revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* 4. Action Alert Section: Low-Stock & Out-of-Stock Tables */}
      <div className="rdb-middle-grid">
        {/* Low-Stock Warning List */}
        <div className="rdb-panel">
          <div className="rdb-panel-header">
            <div>
              <h3 className="rdb-panel-title">⚠️ Low-Stock Action Alert</h3>
              <p className="rdb-panel-subtitle">Items at or below configured reorder level</p>
            </div>
            <button
              type="button"
              className="rdb-panel-link-btn"
              onClick={() => handleJumpToReport('stock_report')}
            >
              View in Stock Report ›
            </button>
          </div>

          <div className="rdb-panel-table-wrap">
            {lowStockList.length === 0 ? (
              <div className="rdb-empty-panel">
                <span>✓ All items are above reorder level.</span>
              </div>
            ) : (
              <table className="rdb-mini-table">
                <thead>
                  <tr>
                    <th style={{ width: '85px' }}>Code</th>
                    <th>Description</th>
                    <th style={{ width: '75px' }}>Category</th>
                    <th style={{ width: '60px', textAlign: 'right' }}>Stock</th>
                    <th style={{ width: '60px', textAlign: 'right' }}>Reorder</th>
                    <th style={{ width: '85px', textAlign: 'right' }}>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockList.slice(0, 8).map((itm) => (
                    <tr key={itm.code} className="row-low-highlight">
                      <td className="font-code">{itm.code}</td>
                      <td className="text-truncate" title={itm.description}>
                        {itm.description}
                      </td>
                      <td>
                        <span className="rdb-mini-tag">{itm.category}</span>
                      </td>
                      <td className="text-right">
                        <span className="rdb-qty-pill pill-low">{itm.availableStock}</span>
                      </td>
                      <td className="text-right text-muted">{itm.reorderLevel || 0}</td>
                      <td className="text-right font-price">
                        Rs. {itm.sellingPrice.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Out-of-Stock Action List */}
        <div className="rdb-panel">
          <div className="rdb-panel-header">
            <div>
              <h3 className="rdb-panel-title">❌ Out-of-Stock Action Alert</h3>
              <p className="rdb-panel-subtitle">Zero sellable balance in warehouse</p>
            </div>
            <button
              type="button"
              className="rdb-panel-link-btn"
              onClick={() => handleJumpToReport('stock_report')}
            >
              View in Stock Report ›
            </button>
          </div>

          <div className="rdb-panel-table-wrap">
            {outOfStockList.length === 0 ? (
              <div className="rdb-empty-panel">
                <span>✓ No out-of-stock items detected.</span>
              </div>
            ) : (
              <table className="rdb-mini-table">
                <thead>
                  <tr>
                    <th style={{ width: '85px' }}>Code</th>
                    <th>Description</th>
                    <th style={{ width: '75px' }}>Category</th>
                    <th style={{ width: '75px' }}>Location</th>
                    <th style={{ width: '60px', textAlign: 'center' }}>Stock</th>
                    <th style={{ width: '85px', textAlign: 'right' }}>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {outOfStockList.slice(0, 8).map((itm) => (
                    <tr key={itm.code} className="row-out-highlight">
                      <td className="font-code">{itm.code}</td>
                      <td className="text-truncate" title={itm.description}>
                        {itm.description}
                      </td>
                      <td>
                        <span className="rdb-mini-tag">{itm.category}</span>
                      </td>
                      <td className="text-muted">{itm.location}</td>
                      <td className="text-center">
                        <span className="rdb-qty-pill pill-out">0</span>
                      </td>
                      <td className="text-right font-price">
                        Rs. {itm.sellingPrice.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* 5. Bottom Section: Recent Transactions Activity (Invoices, GRNs, Returns) */}
      <div className="rdb-activity-section">
        <div className="rdb-activity-grid">
          {/* Recent Invoices */}
          <div className="rdb-panel">
            <div className="rdb-panel-header">
              <h3 className="rdb-panel-title">🧾 Recent Finalized Invoices</h3>
              <button
                type="button"
                className="rdb-panel-link-btn"
                onClick={() => handleJumpToReport('daily_sales')}
              >
                All Sales ›
              </button>
            </div>
            <div className="rdb-panel-table-wrap">
              <table className="rdb-mini-table">
                <thead>
                  <tr>
                    <th style={{ width: '75px' }}>Inv #</th>
                    <th>Customer</th>
                    <th style={{ width: '85px', textAlign: 'right' }}>Amount</th>
                    <th style={{ width: '70px', textAlign: 'center' }}>Pay Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.slice(0, 6).map((inv) => (
                    <tr key={inv._id || inv.invoiceNumber}>
                      <td className="font-code">{inv.invoiceNumber}</td>
                      <td className="text-truncate" title={inv.customerName}>
                        {inv.customerName}
                      </td>
                      <td className="text-right font-price">
                        Rs. {(inv.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="text-center">
                        <span className="rdb-pay-badge">{inv.paymentMethod}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Goods Received Notes (GRN) */}
          <div className="rdb-panel">
            <div className="rdb-panel-header">
              <h3 className="rdb-panel-title">📥 Recent Goods Received Notes</h3>
              <button
                type="button"
                className="rdb-panel-link-btn"
                onClick={() => handleJumpToReport('grn')}
              >
                All GRNs ›
              </button>
            </div>
            <div className="rdb-panel-table-wrap">
              <table className="rdb-mini-table">
                <thead>
                  <tr>
                    <th style={{ width: '75px' }}>GRN #</th>
                    <th>Supplier</th>
                    <th style={{ width: '85px', textAlign: 'right' }}>Value</th>
                    <th style={{ width: '70px', textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentGrns.slice(0, 6).map((grn) => (
                    <tr key={grn._id || grn.grnNumber}>
                      <td className="font-code">{grn.grnNumber}</td>
                      <td className="text-truncate" title={grn.supplierName}>
                        {grn.supplierName}
                      </td>
                      <td className="text-right font-price">
                        Rs. {(grn.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="text-center">
                        <span className="rdb-status-badge badge-active">{grn.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Customer Returns */}
          <div className="rdb-panel">
            <div className="rdb-panel-header">
              <h3 className="rdb-panel-title">↩️ Recent Customer Returns</h3>
              <button
                type="button"
                className="rdb-panel-link-btn"
                onClick={() => handleJumpToReport('invoice_returns')}
              >
                All Returns ›
              </button>
            </div>
            <div className="rdb-panel-table-wrap">
              {recentCustomerReturns.length === 0 ? (
                <div className="rdb-empty-panel">
                  <span>No customer returns on file.</span>
                </div>
              ) : (
                <table className="rdb-mini-table">
                  <thead>
                    <tr>
                      <th style={{ width: '80px' }}>Return #</th>
                      <th>Item Description</th>
                      <th style={{ width: '40px', textAlign: 'right' }}>Qty</th>
                      <th style={{ width: '80px', textAlign: 'right' }}>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentCustomerReturns.slice(0, 6).map((ret) => (
                      <tr key={ret._id || ret.returnNumber}>
                        <td className="font-code">{ret.returnNumber}</td>
                        <td className="text-truncate" title={ret.description}>
                          {ret.description}
                        </td>
                        <td className="text-right font-weight-bold">{ret.quantity}</td>
                        <td className="text-right font-price">
                          Rs. {(ret.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 6. Dashboard Quick Jump Footer */}
      <div className="rdb-footer-nav no-print">
        <span className="rdb-footer-heading">QUICK REPORT NAVIGATION:</span>
        <div className="rdb-footer-links">
          <button type="button" onClick={() => handleJumpToReport('stock_report')}>📋 Stock Report</button>
          <button type="button" onClick={() => handleJumpToReport('daily_sales')}>📈 Daily Sales &amp; Profit</button>
          <button type="button" onClick={() => handleJumpToReport('grn')}>📥 Goods Received Notes</button>
          <button type="button" onClick={() => handleJumpToReport('invoice_returns')}>🔄 Invoice Returns</button>
          <button type="button" onClick={() => handleJumpToReport('settlements')}>💰 Daily Settlements</button>
          <button type="button" onClick={() => handleJumpToReport('closing_stock')}>📦 Closing Stock</button>
          <button type="button" onClick={() => handleJumpToReport('supplier_purchases')}>🚚 Supplier Purchases</button>
          <button type="button" onClick={() => handleJumpToReport('top_selling')}>🔥 Top Selling Items</button>
          <button type="button" onClick={() => handleJumpToReport('non_moving')}>⏳ Non Moving Inventory</button>
          <button type="button" onClick={() => handleJumpToReport('goods_return_notes')}>↩️ Goods Return Notes (GREN)</button>
        </div>
      </div>
    </div>
  );
}

export default ReportsDashboardView;
