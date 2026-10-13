/**
 * SalesServiceDropdown Component
 * Displays classic desktop dropdown menu items under Sales and Service:
 * - Create Invoice
 * - Settlement Invoice
 * - Remaining Balance
 */
function SalesServiceDropdown({ onItemClick }) {
  const salesItems = [
    { id: 'create-invoice', label: 'Create Invoice', path: '/invoice' },
    { id: 'settlement-invoice', label: 'Settlement Invoice', path: '/settlement-invoice' },
    { id: 'remaining-balance', label: 'Remaining Balance', path: '/remaining-balance' },
    { id: 'customer-return-exchange', label: 'Customer Return / Exchange', path: '/customer-return-exchange' },
  ];

  return (
    <ul className="sofast-dropdown-menu" role="menu">
      {salesItems.map((item) => (
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

export default SalesServiceDropdown;
