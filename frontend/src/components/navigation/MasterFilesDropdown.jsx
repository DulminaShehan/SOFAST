/**
 * MasterFilesDropdown Component
 * Displays classic desktop dropdown menu items under Master Files
 */
function MasterFilesDropdown({ onItemClick }) {
  const masterItems = [
    { id: 'item-master', label: 'Item Master' },
    { id: 'supplier-master', label: 'Supplier Master' },
    { id: 'customer-master', label: 'Customer Master' },
    { id: 'category-master', label: 'Category Master' },
    { id: 'sub-category-master', label: 'Sub Category Master' },
  ];

  return (
    <ul className="sofast-dropdown-menu" role="menu">
      {masterItems.map((item) => (
        <li key={item.id} className="sofast-dropdown-item" role="none">
          <button
            type="button"
            className="sofast-dropdown-button"
            role="menuitem"
            onClick={() => onItemClick(item.label)}
          >
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

export default MasterFilesDropdown;
