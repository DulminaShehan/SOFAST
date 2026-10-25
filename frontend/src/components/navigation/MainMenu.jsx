import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './MainMenu.css';
import MasterFilesDropdown from './MasterFilesDropdown';
import StockControlDropdown from './StockControlDropdown';
import SalesServiceDropdown from './SalesServiceDropdown';
import AdministrationDropdown from './AdministrationDropdown';
import ApprovementDropdown from './ApprovementDropdown';
import { useAuth } from '../../context/AuthContext';

/**
 * MainMenu Component
 * Classic horizontal SOFAST desktop ERP menu bar:
 * - Master Files
 * - Stock Control System
 * - Sales and Service
 * - Approvement (Payment Voucher, Petty Cash, Leave Request)
 * - Reports
 * - Accounting
 * - Administration (Printer Setup, New User [Admin only])
 */
function MainMenu({ onMenuSelect }) {
  const [openDropdown, setOpenDropdown] = useState(null);
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleTopItemClick = (item) => {
    if (item.hasDropdown) {
      if (openDropdown === item.id) {
        setOpenDropdown(null);
        if (item.defaultPath) {
          navigate(item.defaultPath);
        }
      } else {
        setOpenDropdown(item.id);
      }
    } else {
      setOpenDropdown(null);
      if (onMenuSelect) {
        onMenuSelect(item.label);
      }
      if (item.path) {
        navigate(item.path);
      }
    }
  };

  const handleDropdownItemClick = (item) => {
    setOpenDropdown(null);
    if (onMenuSelect) {
      onMenuSelect(item.label);
    }
    if (item.path) {
      navigate(item.path);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="sofast-menubar-container" ref={menuRef} aria-label="SOFAST Application Menu">
      <ul className="sofast-menubar" role="menubar">
        {topMenuItems.map((item) => (
          <li key={item.id} className="sofast-menu-item" role="none">
            <button
              type="button"
              className={`sofast-menu-button ${openDropdown === item.id ? 'active' : ''}`}
              role="menuitem"
              aria-haspopup={item.hasDropdown ? 'true' : 'false'}
              aria-expanded={openDropdown === item.id}
              onClick={() => handleTopItemClick(item)}
            >
              {item.label}
            </button>

            {item.id === 'master-files' && openDropdown === 'master-files' && (
              <MasterFilesDropdown onItemClick={handleDropdownItemClick} />
            )}

            {item.id === 'stock-control' && openDropdown === 'stock-control' && (
              <StockControlDropdown onItemClick={handleDropdownItemClick} />
            )}

            {item.id === 'sales-service' && openDropdown === 'sales-service' && (
              <SalesServiceDropdown onItemClick={handleDropdownItemClick} />
            )}

            {item.id === 'approvement' && openDropdown === 'approvement' && (
              <ApprovementDropdown onItemClick={handleDropdownItemClick} />
            )}

            {item.id === 'administration' && openDropdown === 'administration' && (
              <AdministrationDropdown onItemClick={handleDropdownItemClick} />
            )}
          </li>
        ))}
      </ul>

      {/* Right side user status badge */}
      {currentUser && (
        <div className="sofast-menubar-user-status">
          <span className="user-status-pill">
            <span className="user-status-icon">👤</span>
            <span className="user-status-name">{currentUser.username}</span>
            <span className={`user-status-role-badge ${isAdmin ? 'admin-badge' : 'user-badge'}`}>
              {isAdmin ? 'ADMIN' : 'USER'}
            </span>
          </span>
          <button
            type="button"
            className="user-status-logout-btn"
            onClick={handleLogout}
            title="Log out of system"
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}

export default MainMenu;
