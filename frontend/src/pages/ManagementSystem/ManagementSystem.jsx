import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './ManagementSystem.css';

/**
 * SOFAST MOTORS - Management System
 * Recreates the exact UI from the provided reference image.
 */
function ManagementSystem() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(true);
  const [selectedModule, setSelectedModule] = useState('Item Master');
  const menuRef = useRef(null);
  const navigate = useNavigate();

  // Module data for Master Files and top menus
  const masterFilesItems = [
    {
      id: 'item-master',
      label: 'Item Master',
      path: '/item-master',
      iconColor: '#2563eb',
      badgeBg: '#dbeafe',
      description: 'Manage item details, pricing, stock and other information.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#60a5fa" />
          <path d="M2 17l10 5V12L2 7v10z" fill="#2563eb" />
          <path d="M22 17l-10 5V12l10-5v10z" fill="#1d4ed8" />
          <path d="M12 22V12M12 12L2 7M12 12l10-5" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: 'supplier-master',
      label: 'Supplier Master',
      path: '/supplier-master',
      iconColor: '#10b981',
      badgeBg: '#d1fae5',
      description: 'Manage supplier profiles, contact details and vendor information.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      id: 'customer-master',
      label: 'Customer Master',
      path: null,
      iconColor: '#8b5cf6',
      badgeBg: '#ede9fe',
      description: 'Manage customer accounts, contact directories and credit limits.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      id: 'category-master',
      label: 'Category Master',
      path: null,
      iconColor: '#f97316',
      badgeBg: '#ffedd5',
      description: 'Organize products and inventory into main classification categories.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="#f97316">
          <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58s1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41s-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" />
        </svg>
      ),
    },
    {
      id: 'sub-category-master',
      label: 'Sub Category Master',
      path: null,
      iconColor: '#64748b',
      badgeBg: '#f1f5f9',
      description: 'Configure sub-categories for refined catalog and item grouping.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="#64748b">
          <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58s1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41s-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" />
        </svg>
      ),
    },
  ];

  const stockControlItems = [
    {
      id: 'good-receive-note',
      label: 'Good Receive Note',
      path: '/grn',
      iconColor: '#f59e0b',
      badgeBg: '#fef3c7',
      description: 'Record incoming supplier consignments, purchase invoices, and update inventory stock balances.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
  ];

  const topMenuItems = [
    { id: 'master-files', label: 'Master Files', hasDropdown: true },
    { id: 'stock-control', label: 'Stock Control System', hasDropdown: true, description: 'Real-time stock tracking, warehouse transfers and inventory balances.' },
    { id: 'sales-service', label: 'Sales and Service', description: 'Point of sale, customer billing, and service order management.' },
    { id: 'production', label: 'Production', description: 'Production planning, work orders, bill of materials and assembly.' },
    { id: 'reports', label: 'Reports', description: 'Financial, inventory, sales and audit analytical reporting.' },
    { id: 'accounting', label: 'Accounting', description: 'General ledger, accounts receivable, payable and banking.' },
    { id: 'administration', label: 'Administration', description: 'System configuration, user permissions, audit logs and backups.' },
  ];

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsDropdownOpen(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleDropdownSelect = (item) => {
    setIsDropdownOpen(null);
    if (item.path) {
      navigate(item.path);
    } else {
      setSelectedModule(item.label);
    }
  };

  const handleTopMenuClick = (item) => {
    if (item.hasDropdown) {
      setIsDropdownOpen((prev) => (prev === item.id ? null : item.id));
    } else {
      setIsDropdownOpen(null);
      setSelectedModule(item.label);
    }
  };

  // Find active module metadata
  const currentMasterItem = masterFilesItems.find((m) => m.label === selectedModule) || stockControlItems.find((s) => s.label === selectedModule);
  const currentTopMenuItem = topMenuItems.find((t) => t.label === selectedModule);

  const activeTitle = selectedModule;
  const activeDescription = currentMasterItem?.description || currentTopMenuItem?.description || 'Module details and management operations.';
  const activeBadgeBg = currentMasterItem?.badgeBg || '#dbeafe';

  return (
    <div className="management-system-container">
      {/* 1. Top Windows Blue Header */}
      <header className="management-titlebar">
        <div className="titlebar-brand">
          <svg className="titlebar-car-icon" viewBox="0 0 24 24">
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
          </svg>
          <span className="titlebar-heading">SOFAST MOTORS - Management System</span>
        </div>
        <div className="titlebar-controls">
          <button type="button" className="control-btn" aria-label="Minimize">&#8212;</button>
          <button type="button" className="control-btn" aria-label="Maximize">&#9633;</button>
          <button type="button" className="control-btn close" aria-label="Close" onClick={() => navigate('/selection')}>&#x2715;</button>
        </div>
      </header>

      {/* 2. Top Horizontal Menu Bar with Master Files & Stock Control Dropdown */}
      <nav className="management-menubar-container" ref={menuRef}>
        <ul className="management-menubar">
          {topMenuItems.map((item) => (
            <li key={item.id} className="menubar-item">
              <button
                type="button"
                className={`menubar-button ${
                  (isDropdownOpen === item.id) || selectedModule === item.label ? 'active' : ''
                }`}
                onClick={() => handleTopMenuClick(item)}
              >
                {item.label}
              </button>

              {/* Master Files Dropdown */}
              {item.id === 'master-files' && isDropdownOpen === 'master-files' && (
                <ul className="masterfiles-dropdown">
                  {masterFilesItems.map((masterItem) => (
                    <li key={masterItem.id} className="dropdown-entry">
                      <button
                        type="button"
                        className={`dropdown-item-btn ${selectedModule === masterItem.label ? 'selected' : ''}`}
                        onClick={() => handleDropdownSelect(masterItem)}
                      >
                        <span className="dropdown-item-icon">
                          {masterItem.renderIcon(18)}
                        </span>
                        <span>{masterItem.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Stock Control System Dropdown */}
              {item.id === 'stock-control' && isDropdownOpen === 'stock-control' && (
                <ul className="masterfiles-dropdown">
                  {stockControlItems.map((scItem) => (
                    <li key={scItem.id} className="dropdown-entry">
                      <button
                        type="button"
                        className={`dropdown-item-btn ${selectedModule === scItem.label ? 'selected' : ''}`}
                        onClick={() => handleDropdownSelect(scItem)}
                      >
                        <span className="dropdown-item-icon">
                          {scItem.renderIcon(18)}
                        </span>
                        <span>{scItem.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* 3. Center Workspace Content Area */}
      <main className="management-workspace">
        <div className="workspace-content">
          <div className="workspace-circle-badge" style={{ backgroundColor: activeBadgeBg }}>
            {currentMasterItem ? (
              currentMasterItem.renderIcon(54)
            ) : (
              <svg width="50" height="50" viewBox="0 0 24 24" fill="#2563eb">
                <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#60a5fa" />
                <path d="M2 17l10 5V12L2 7v10z" fill="#2563eb" />
                <path d="M22 17l-10 5V12l10-5v10z" fill="#1d4ed8" />
              </svg>
            )}
          </div>

          <h1 className="workspace-title">{activeTitle}</h1>
          <p className="workspace-description">{activeDescription}</p>

          <div className="coming-soon-badge">
            Coming Soon...
          </div>
        </div>
      </main>

      {/* 4. Bottom Status Bar */}
      <footer className="management-statusbar">
        <div className="statusbar-left">
          <div className="statusbar-item">
            <span className="statusbar-item-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </span>
            <span>User: Admin</span>
          </div>

          <span className="statusbar-divider">|</span>

          <div className="statusbar-item">
            <span className="statusbar-item-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#16a34a">
                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                <path d="M3 5v6c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                <path d="M3 11v6c0 1.66 4 3 9 3s9-1.34 9-3v-6"/>
              </svg>
            </span>
            <span>Database: MongoDB (Connected)</span>
          </div>
        </div>

        <div className="statusbar-right">
          <span>SOFAST MOTORS</span>
          <span>|</span>
          <span>v1.0.0</span>
        </div>
      </footer>
    </div>
  );
}

export default ManagementSystem;
