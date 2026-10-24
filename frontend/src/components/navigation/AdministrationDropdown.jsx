import { useAuth } from '../../context/AuthContext';

/**
 * AdministrationDropdown Component
 * Displays Administration options based on user privileges:
 * - Printer Setup (accessible if permitted)
 * - New User (shown ONLY for Administrators)
 */
function AdministrationDropdown({ onItemClick, activePath = '' }) {
  const { isAdmin, hasPermission } = useAuth();

  const adminItems = [
    {
      id: 'printer-setup',
      label: 'Printer Setup',
      path: '/printer-setup',
      permitted: hasPermission('printer-setup'),
    },
    // New User: strictly restricted to Administrators
    ...(isAdmin
      ? [
          {
            id: 'new-user',
            label: 'New User',
            path: '/new-user',
            permitted: true,
            badge: 'Admin Only',
          },
        ]
      : []),
  ];

  const visibleItems = adminItems.filter((item) => item.permitted);

  if (visibleItems.length === 0) {
    return (
      <ul className="sofast-dropdown-menu admin-restricted-menu" role="menu">
        <li className="sofast-dropdown-item-disabled" role="none">
          <span style={{ padding: '6px 12px', fontSize: '11px', color: '#888', fontStyle: 'italic' }}>
            No administrative options permitted
          </span>
        </li>
      </ul>
    );
  }

  return (
    <ul className="sofast-dropdown-menu" role="menu">
      {visibleItems.map((item) => (
        <li key={item.id} className="sofast-dropdown-item" role="none">
          <button
            type="button"
            className={`sofast-dropdown-button ${activePath === item.path ? 'selected' : ''}`}
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              onItemClick(item);
            }}
          >
            <span>{item.label}</span>
            {item.badge && (
              <span
                style={{
                  fontSize: '9px',
                  backgroundColor: '#2563eb',
                  color: '#fff',
                  padding: '1px 5px',
                  borderRadius: '3px',
                  marginLeft: '8px',
                  fontWeight: 'bold',
                }}
              >
                {item.badge}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

export default AdministrationDropdown;
