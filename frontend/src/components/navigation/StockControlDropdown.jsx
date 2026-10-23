/**
 * StockControlDropdown Component
 * Displays classic desktop dropdown menu items under Stock Control System:
 * - Good Receive Note
 * - Supplier Damage Claim
 */
function StockControlDropdown({ onItemClick }) {
  const stockItems = [
    { id: 'good-receive-note', label: 'Good Receive Note (GRN)', path: '/grn' },
    { id: 'good-return-note', label: 'Good Return Note (GREN)', path: '/good-return-note' },
    { id: 'damage', label: 'Damage', path: '/damage' },
  ];



  return (
    <ul className="sofast-dropdown-menu" role="menu">
      {stockItems.map((item) => (
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

export default StockControlDropdown;
