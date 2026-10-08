import { useState, useEffect, useRef } from 'react';
import './MainMenu.css';
import MasterFilesDropdown from './MasterFilesDropdown';

/**
 * MainMenu Component
 * Reusable classic desktop horizontal menu bar matching legacy SOFAST style.
 */
function MainMenu({ onSelectMenuItem }) {
  const [openDropdown, setOpenDropdown] = useState(null);
  const menuRef = useRef(null);

  const topMenuItems = [
    { id: 'master-files', label: 'Master Files', hasDropdown: true },
    { id: 'stock-control', label: 'Stock Control System', hasDropdown: false },
    { id: 'sales-service', label: 'Sales and Service', hasDropdown: false },
    { id: 'production', label: 'Production', hasDropdown: false },
    { id: 'reports', label: 'Reports', hasDropdown: false },
    { id: 'accounting', label: 'Accounting', hasDropdown: false },
    { id: 'administration', label: 'Administration', hasDropdown: false },
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
      setOpenDropdown((prev) => (prev === item.id ? null : item.id));
    } else {
      setOpenDropdown(null);
      if (onSelectMenuItem) {
        onSelectMenuItem(item.label);
      }
    }
  };

  const handleDropdownItemClick = (itemLabel) => {
    setOpenDropdown(null);
    if (onSelectMenuItem) {
      onSelectMenuItem(itemLabel);
    }
  };

  return (
    <nav className="sofast-menubar-container" ref={menuRef} aria-label="Application Menu">
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
