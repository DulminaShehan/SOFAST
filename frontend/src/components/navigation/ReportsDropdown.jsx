/**
 * ReportsDropdown Component
 * Displays classic desktop dropdown menu items under Reports:
 * Preserves all 11 original reports + adds Reports Dashboard and Stock Report.
 */
function ReportsDropdown({ onItemClick }) {
  const reportsItems = [
    { id: 'reports-dashboard', label: '📊 Reports Dashboard', path: '/reports?tab=dashboard' },
    { id: 'stock-report', label: '📋 Stock Report', path: '/reports?tab=stock_report' },
    { id: 'daily-settlements', label: '💰 Daily Settlements Details', path: '/reports?tab=settlements' },
    { id: 'grn-report', label: '📥 Goods Received Notes (GRN)', path: '/reports?tab=grn' },
    { id: 'invoice-returns', label: '🔄 Invoice Returns Report', path: '/reports?tab=invoice_returns' },
    { id: 'daily-sales', label: '📈 Daily Sales & Profit Report', path: '/reports?tab=daily_sales' },
    { id: 'closing-stock', label: '📦 Closing Stock Report (170-Page Inventory)', path: '/reports?tab=closing_stock' },
    { id: 'alternative-products', label: '🔄 Alternative Products Report', path: '/reports?tab=alternative_products' },
    { id: 'supplier-purchases', label: '🚚 Supplier Wise Purchases', path: '/reports?tab=supplier_purchases' },
    { id: 'top-selling', label: '🔥 Top Selling Items Report', path: '/reports?tab=top_selling' },
    { id: 'non-moving', label: '⏳ Non Moving Inventory Report', path: '/reports?tab=non_moving' },
    { id: 'goods-return-notes', label: '↩️ Goods Return Notes (G.R.E.N.)', path: '/reports?tab=goods_return_notes' },
    { id: 'open-reports-center', label: '📊 Open Reports Center', path: '/reports' },
  ];

  return (
    <ul className="sofast-dropdown-menu" role="menu" style={{ minWidth: '300px', maxHeight: '85vh', overflowY: 'auto' }}>
      {reportsItems.map((item) => (
        <li key={item.id} className="sofast-dropdown-item" role="none">
          <button
            type="button"
            className="sofast-dropdown-button"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              onItemClick(item);
            }}
          >
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

export default ReportsDropdown;
