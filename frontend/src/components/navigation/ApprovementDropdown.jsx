import { useAuth } from '../../context/AuthContext';

/**
 * ApprovementDropdown Component
 * Displays Approvement workflow sub-sections:
 * - Payment Voucher
 * - Petty Cash
 * - Leave Request
 */
function ApprovementDropdown({ isOpen = true, onItemClick, activePath = '' }) {
  if (isOpen === false) return null;
  const { hasPermission, isAdmin } = useAuth();

  const approvementItems = [
    {
      id: 'payment-voucher',
      label: 'Payment Voucher',
      path: '/payment-voucher',
      permitted: hasPermission('payment-voucher'),
      badge: 'Voucher',
    },
    {
      id: 'petty-cash',
      label: 'Petty Cash',
      path: '/petty-cash',
      permitted: hasPermission('petty-cash'),
      badge: 'Cash',
    },
    {
      id: 'leave-request',
      label: 'Leave Request',
      path: '/leave-request',
      permitted: hasPermission('leave-request'),
      badge: 'HR',
    },
    ...(isAdmin
      ? [
          {
            id: 'receive-inbox',
            label: '📥 Receive Inbox',
            path: '/receive-inbox',
            permitted: true,
            badge: 'Admin',
          },
        ]
      : []),
  ];

  const visibleItems = approvementItems.filter((item) => item.permitted);

  if (visibleItems.length === 0) {
    return (
      <ul className="sofast-dropdown-menu" role="menu">
        <li className="sofast-dropdown-item-disabled" role="none">
          <span style={{ padding: '6px 12px', fontSize: '11px', color: '#888', fontStyle: 'italic' }}>
            No approval permissions granted
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
          </button>
        </li>
      ))}
    </ul>
  );
}

export default ApprovementDropdown;
