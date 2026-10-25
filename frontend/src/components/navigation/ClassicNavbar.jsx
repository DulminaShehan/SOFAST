import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './ClassicNavbar.css';

/**
 * ClassicNavbar Component
 * Standard Visual Basic 6 / Windows 95/XP ERP Menubar matching Customer Details.
 * Provides unified, bulletproof navigation across every tab in the system.
 */
function ClassicNavbar({ activeMenu = '', className = '' }) {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const { currentUser, isAdmin, logout } = useAuth();

  const topMenuItems = [
    { id: 'master-files', label: 'Master Files', hasDropdown: true, defaultPath: '/management' },
    { id: 'stock-control', label: 'Stock Control System', hasDropdown: true, defaultPath: '/grn' },
    { id: 'sales-service', label: 'Sales and Service', hasDropdown: true, defaultPath: '/invoice' },
    { id: 'approvement', label: 'Approvement', hasDropdown: true, defaultPath: '/approvement' },
    { id: 'reports', label: 'Reports', path: '/reports' },
    { id: 'accounting', label: 'Accounting', path: '/management' },
    { id: 'administration', label: 'Administration', hasDropdown: true, defaultPath: '/printer-setup' },
  ];

  const masterFilesDropdownItems = [
    { id: 'master-files-hub', label: '📁 Master Files (Main Hub)', path: '/management', badge: 'Hub' },
    { id: 'item-master', label: '📦 Item Master', path: '/item-master' },
    { id: 'supplier-master', label: '🚚 Supplier Master', path: '/supplier-master' },
    { id: 'customer-details', label: '👥 Customer Details', path: '/customer-details' },
    { id: 'category-master', label: '🏷️ Category Master', path: '/management' },
    { id: 'sub-category-master', label: '🔖 Sub Category Master', path: '/management' },
    { id: 'alternative-product', label: '🔄 Alternative Product', path: '/alternative-product' },
  ];

  const stockControlDropdownItems = [
    { id: 'stock-control-hub', label: '📦 Stock Control (Overview)', path: '/grn', badge: 'Hub' },
    { id: 'good-receive-note', label: '📥 Good Receive Note (GRN)', path: '/grn' },
    { id: 'good-return-note', label: '↩️ Good Return Note (GREN)', path: '/good-return-note' },
    { id: 'damage', label: '⚠️ Damage', path: '/damage' },
  ];

  const salesServiceDropdownItems = [
    { id: 'sales-service-hub', label: '🧾 Sales & Service (Overview)', path: '/invoice', badge: 'Hub' },
    { id: 'create-invoice', label: '🧾 Create Invoice', path: '/invoice' },
    { id: 'settlement-invoice', label: '💰 Settlement Invoice', path: '/settlement-invoice' },
    { id: 'remaining-balance', label: '⚖️ Remaining Balance', path: '/remaining-balance' },
  ];

  const approvementDropdownItems = [
    { id: 'approvement-hub', label: '🛡️ Approvement System (Overview)', path: '/approvement', badge: 'Hub' },
    { id: 'payment-voucher', label: '💳 Payment Voucher', path: '/payment-voucher' },
    { id: 'petty-cash', label: '💵 Petty Cash', path: '/petty-cash' },
    { id: 'leave-request', label: '📝 Leave Request', path: '/leave-request' },
    ...(isAdmin
      ? [{ id: 'receive-inbox', label: '📥 Admin Receive Inbox', path: '/receive-inbox', badge: 'Admin' }]
      : []),
  ];

  const administrationDropdownItems = [
    { id: 'printer-setup', label: '🖨️ Printer Setup', path: '/printer-setup' },
    ...(isAdmin
      ? [{ id: 'new-user', label: '👤 New User & Permissions', path: '/new-user', badge: 'Admin' }]
      : []),
  ];

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveDropdown(null);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleTopMenuClick = (item) => {
    if (item.hasDropdown) {
      if (activeDropdown === item.id) {
        // If clicking again on the open dropdown header, navigate to default screen
        setActiveDropdown(null);
        if (item.defaultPath) {
          navigate(item.defaultPath);
        }
      } else {
        setActiveDropdown(item.id);
      }
    } else if (item.path) {
      setActiveDropdown(null);
      navigate(item.path);
    }
  };

  const handleDropdownItemClick = (path) => {
    setActiveDropdown(null);
    if (path) {
      navigate(path);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className={`cust-menubar-container ${className}`} ref={menuRef} aria-label="SOFAST Application Navigation">
      <div className="cust-menubar-left">
        <ul className="cust-menubar" role="menubar">
          {topMenuItems.map((item) => {
            const isItemActive = activeMenu === item.id || activeDropdown === item.id;
            return (
              <li key={item.id} className="cust-menubar-item" role="none">
                <button
                  type="button"
                  className={`cust-menubar-button ${isItemActive ? 'active' : ''} ${
                    activeDropdown === item.id ? 'dropdown-open' : ''
                  }`}
                  role="menuitem"
                  aria-haspopup={item.hasDropdown ? 'true' : 'false'}
                  aria-expanded={activeDropdown === item.id}
                  onClick={() => handleTopMenuClick(item)}
                  title={item.hasDropdown ? `Click to open menu, or click again to go to ${item.label}` : item.label}
                >
                  {item.label}
                </button>

                {/* 1. Master Files Dropdown */}
                {item.id === 'master-files' && activeDropdown === 'master-files' && (
                  <ul className="cust-dropdown-menu" role="menu">
                    {masterFilesDropdownItems.map((dropItem) => (
                      <li key={dropItem.id} className="cust-dropdown-entry" role="none">
                        <button
                          type="button"
                          className="cust-dropdown-item-btn"
                          role="menuitem"
                          onClick={() => handleDropdownItemClick(dropItem.path)}
                        >
                          <span className="cust-dropdown-item-left">{dropItem.label}</span>
                          {dropItem.badge && (
                            <span className={`cust-dropdown-badge ${dropItem.badge === 'Hub' ? 'hub-badge' : ''}`}>
                              {dropItem.badge}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* 2. Stock Control System Dropdown */}
                {item.id === 'stock-control' && activeDropdown === 'stock-control' && (
                  <ul className="cust-dropdown-menu" role="menu">
                    {stockControlDropdownItems.map((dropItem) => (
                      <li key={dropItem.id} className="cust-dropdown-entry" role="none">
                        <button
                          type="button"
                          className="cust-dropdown-item-btn"
                          role="menuitem"
                          onClick={() => handleDropdownItemClick(dropItem.path)}
                        >
                          <span className="cust-dropdown-item-left">{dropItem.label}</span>
                          {dropItem.badge && (
                            <span className={`cust-dropdown-badge ${dropItem.badge === 'Hub' ? 'hub-badge' : ''}`}>
                              {dropItem.badge}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* 3. Sales and Service Dropdown */}
                {item.id === 'sales-service' && activeDropdown === 'sales-service' && (
                  <ul className="cust-dropdown-menu" role="menu">
                    {salesServiceDropdownItems.map((dropItem) => (
                      <li key={dropItem.id} className="cust-dropdown-entry" role="none">
                        <button
                          type="button"
                          className="cust-dropdown-item-btn"
                          role="menuitem"
                          onClick={() => handleDropdownItemClick(dropItem.path)}
                        >
                          <span className="cust-dropdown-item-left">{dropItem.label}</span>
                          {dropItem.badge && (
                            <span className={`cust-dropdown-badge ${dropItem.badge === 'Hub' ? 'hub-badge' : ''}`}>
                              {dropItem.badge}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* 4. Approvement Dropdown */}
                {item.id === 'approvement' && activeDropdown === 'approvement' && (
                  <ul className="cust-dropdown-menu" role="menu">
                    {approvementDropdownItems.map((dropItem) => (
                      <li key={dropItem.id} className="cust-dropdown-entry" role="none">
                        <button
                          type="button"
                          className="cust-dropdown-item-btn"
                          role="menuitem"
                          onClick={() => handleDropdownItemClick(dropItem.path)}
                        >
                          <span className="cust-dropdown-item-left">{dropItem.label}</span>
                          {dropItem.badge && (
                            <span className={`cust-dropdown-badge ${dropItem.badge === 'Admin' ? 'admin-badge' : 'hub-badge'}`}>
                              {dropItem.badge}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* 5. Administration Dropdown */}
                {item.id === 'administration' && activeDropdown === 'administration' && (
                  <ul className="cust-dropdown-menu" role="menu">
                    {administrationDropdownItems.map((dropItem) => (
                      <li key={dropItem.id} className="cust-dropdown-entry" role="none">
                        <button
                          type="button"
                          className="cust-dropdown-item-btn"
                          role="menuitem"
                          onClick={() => handleDropdownItemClick(dropItem.path)}
                        >
                          <span className="cust-dropdown-item-left">{dropItem.label}</span>
                          {dropItem.badge && (
                            <span className="cust-dropdown-badge admin-badge">{dropItem.badge}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Right side: User information & quick Logout button */}
      <div className="cust-menubar-right">
        {currentUser && (
          <div className="cust-user-pill">
            <span>👤</span>
            <span style={{ fontWeight: 600 }}>{currentUser.username}</span>
            <span className={`cust-user-role-badge ${isAdmin ? 'admin' : 'user'}`}>
              {isAdmin ? 'ADMIN' : 'USER'}
            </span>
          </div>
        )}
        <button
          type="button"
          className="cust-logout-btn"
          onClick={handleLogout}
          title="Sign out of SOFAST system"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}

export default ClassicNavbar;
