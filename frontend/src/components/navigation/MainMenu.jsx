import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './MainMenu.css';
import MasterFilesDropdown from './MasterFilesDropdown';

/**
 * MainMenu Component
 * Classic horizontal SOFAST desktop ERP menu bar:
 * - Master Files (Dropdown with Item, Supplier, Customer, Category, Sub Category Master)
 * - Stock Control System
 * - Sales and Service
 * - Production
 * - Reports
 * - Accounting
 * - Administration
 */
function MainMenu({ onMenuSelect }) {
  const [openDropdown, setOpenDropdown] = useState(null);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  const topMenuItems = [
    { id: 'master-files', label: 'Master Files', hasDropdown: true },
    { id: 'stock-control', label: 'Stock Control System', path: '/stock-control' },
    { id: 'sales-service', label: 'Sales and Service', path: '/sales-service' },
    { id: 'production', label: 'Production', path: '/production' },
    { id: 'reports', label: 'Reports', path: '/reports' },
    { id: 'accounting', label: 'Accounting', path: '/accounting' },
    { id: 'administration', label: 'Administration', path: '/administration' },
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
      // Toggle dropdown on click
      setOpenDropdown((prev) => (prev === item.id ? null : item.id));
    } else {
      // Clicking another top menu immediately closes the Master Files dropdown
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
    // Close dropdown and navigate to the selected master module
    setOpenDropdown(null);
    if (onMenuSelect) {
      onMenuSelect(item.label);
    }
    if (item.path) {
      navigate(item.path);
    }
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
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default MainMenu;
