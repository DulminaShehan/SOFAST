/**
 * MasterFilesDropdown Component
 * Displays classic desktop dropdown menu items under Master Files:
 * - Item Master
 * - Supplier Master
 * - Customer Master
 * - Category Master
 * - Sub Category Master
 */
function MasterFilesDropdown({ onItemClick }) {
  const masterItems = [
    { id: 'master-files-hub', label: '📁 Master Files (Main Hub)', path: '/management' },
    { id: 'item-master', label: 'Item Master', path: '/item-master' },
    { id: 'supplier-master', label: 'Supplier Master', path: '/supplier-master' },
    { id: 'customer-details', label: 'Customer Details', path: '/customer-details' },
    { id: 'category-master', label: 'Category Master', path: '/management' },
    { id: 'sub-category-master', label: 'Sub Category Master', path: '/management' },
    { id: 'alternative-product', label: 'Alternative Product', path: '/alternative-product' },
  ];

  return (
    <ul className="sofast-dropdown-menu" role="menu">
      {masterItems.map((item) => (
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

export default MasterFilesDropdown;
