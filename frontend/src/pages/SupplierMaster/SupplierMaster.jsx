import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './SupplierMaster.css';
import '../ManagementSystem/ManagementSystem.css';

/**
 * Supplier Master File Screen
 * Recreates the exact Visual Basic / desktop layout and operations of legacy SOFAST.
 */
function SupplierMaster() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [notification, setNotification] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    address: '',
    telephone1: '',
    telephone2: '',
  });

  const codeInputRef = useRef(null);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  // Top Menu Items
  const topMenuItems = [
    { id: 'master-files', label: 'Master Files', hasDropdown: true },
    { id: 'stock-control', label: 'Stock Control System', path: '/management' },
    { id: 'sales-service', label: 'Sales and Service', path: '/management' },
    { id: 'production', label: 'Production', path: '/management' },
    { id: 'reports', label: 'Reports', path: '/management' },
    { id: 'accounting', label: 'Accounting', path: '/management' },
    { id: 'administration', label: 'Administration', path: '/management' },
  ];

  const masterFilesDropdownItems = [
    {
      id: 'item-master',
      label: 'Item Master',
      path: '/item-master',
      renderIcon: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#60a5fa" />
          <path d="M2 17l10 5V12L2 7v10z" fill="#2563eb" />
          <path d="M22 17l-10 5V12l10-5v10z" fill="#1d4ed8" />
        </svg>
      ),
    },
    {
      id: 'supplier-master',
      label: 'Supplier Master',
      path: '/supplier-master',
      renderIcon: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
        </svg>
      ),
    },
    {
      id: 'customer-master',
      label: 'Customer Master',
      path: '/management',
      renderIcon: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
        </svg>
      ),
    },
    {
      id: 'category-master',
      label: 'Category Master',
      path: '/management',
      renderIcon: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#f97316">
          <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58s1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41s-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" />
        </svg>
      ),
    },
    {
      id: 'sub-category-master',
      label: 'Sub Category Master',
      path: '/management',
      renderIcon: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#64748b">
          <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58s1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41s-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" />
        </svg>
      ),
    },
  ];

  const [dbStatus, setDbStatus] = useState({ connected: true, name: 'sofast' });

  // Fetch supplier records and DB status from API
  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/suppliers');
      if (response.data && response.data.success) {
        setSuppliers(response.data.data || []);
      }
    } catch (error) {
      showNotification('Failed to load suppliers from API', 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkDbHealth = async () => {
    try {
      const res = await api.get('/health');
      if (res.data && res.data.database) {
        setDbStatus(res.data.database);
      }
    } catch (e) {
      setDbStatus({ connected: false, name: 'offline' });
    }
  };

  useEffect(() => {
    fetchSuppliers();
    checkDbHealth();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const showNotification = (msg, type = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Button: New
  const handleNew = () => {
    setSelectedId(null);
    setFormData({
      code: '',
      name: '',
      address: '',
      telephone1: '',
      telephone2: '',
    });
    if (codeInputRef.current) {
      codeInputRef.current.focus();
    }
  };

  // Button: Cancel
  const handleCancel = () => {
    handleNew();
  };

  // Button: Save
  const handleSave = async (e) => {
    if (e) e.preventDefault();

    if (!formData.code.trim()) {
      showNotification('Please enter Supplier Code.', 'error');
      if (codeInputRef.current) codeInputRef.current.focus();
      return;
    }

    if (!formData.name.trim()) {
      showNotification('Please enter Supplier Name.', 'error');
      return;
    }

    try {
      if (selectedId) {
        // Update existing supplier
        const res = await api.put(`/suppliers/${selectedId}`, formData);
        if (res.data && res.data.success) {
          showNotification('Supplier updated successfully.', 'success');
          fetchSuppliers();
        }
      } else {
        // Create new supplier
        const res = await api.post('/suppliers', formData);
        if (res.data && res.data.success) {
          showNotification('Supplier created successfully.', 'success');
          handleNew();
          fetchSuppliers();
        }
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Error saving supplier record.';
      showNotification(msg, 'error');
    }
  };

  // Button: Delete
  const handleDelete = async () => {
    if (!selectedId) {
      showNotification('Please select a supplier from the list to delete.', 'error');
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete supplier '${formData.name}' (${formData.code})?`
    );

    if (!confirmDelete) return;

    try {
      const res = await api.delete(`/suppliers/${selectedId}`);
      if (res.data && res.data.success) {
        showNotification('Supplier deleted successfully.', 'success');
        handleNew();
        fetchSuppliers();
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Error deleting supplier.';
      showNotification(msg, 'error');
    }
  };

  // Row selection
  const handleRowClick = (supplier) => {
    setSelectedId(supplier._id);
    setFormData({
      code: supplier.code || '',
      name: supplier.name || '',
      address: supplier.address || '',
      telephone1: supplier.telephone1 || supplier.telephone || '',
      telephone2: supplier.telephone2 || '',
    });
  };

  return (
    <div className="supplier-master-container">
      {/* 1. Top Windows/App Blue Title Bar */}
      <header className="management-titlebar">
        <div className="titlebar-brand">
          <svg className="titlebar-car-icon" viewBox="0 0 24 24">
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
          </svg>
          <span className="titlebar-heading">SOFAST MOTORS - Management System [Supplier Master File]</span>
        </div>
        <div className="titlebar-controls">
          <button type="button" className="control-btn" aria-label="Minimize">&#8212;</button>
          <button type="button" className="control-btn" aria-label="Maximize">&#9633;</button>
          <button
            type="button"
            className="control-btn close"
            aria-label="Close"
            onClick={() => navigate('/management')}
          >
            &#x2715;
          </button>
        </div>
      </header>

      {/* 2. Top Horizontal Menu Bar */}
      <nav className="management-menubar-container" ref={menuRef}>
        <ul className="management-menubar">
          {topMenuItems.map((item) => (
            <li key={item.id} className="menubar-item">
              <button
                type="button"
                className={`menubar-button ${
                  (item.id === 'master-files' && isDropdownOpen) || item.id === 'master-files' ? 'active' : ''
                }`}
                onClick={() => {
                  if (item.hasDropdown) {
                    setIsDropdownOpen((prev) => !prev);
                  } else {
                    setIsDropdownOpen(false);
                    navigate(item.path || '/management');
                  }
                }}
              >
                {item.label}
              </button>

              {/* Master Files Dropdown */}
              {item.id === 'master-files' && isDropdownOpen && (
                <ul className="masterfiles-dropdown">
                  {masterFilesDropdownItems.map((masterItem) => (
                    <li key={masterItem.id} className="dropdown-entry">
                      <button
                        type="button"
                        className={`dropdown-item-btn ${masterItem.id === 'supplier-master' ? 'selected' : ''}`}
                        onClick={() => {
                          setIsDropdownOpen(false);
                          navigate(masterItem.path);
                        }}
                      >
                        <span className="dropdown-item-icon">
                          {masterItem.renderIcon()}
                        </span>
                        <span>{masterItem.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* 3. Form Input Section */}
      <div className="supplier-form-wrapper">
        {notification && (
          <div className={`supplier-alert ${notification.type}`}>
            <span>{notification.message}</span>
            <button
              type="button"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
              onClick={() => setNotification(null)}
            >
              &times;
            </button>
          </div>
        )}

        <form className="supplier-form" onSubmit={handleSave}>
          {/* Code */}
          <div className="form-field-row">
            <label className="form-label" htmlFor="supplier-code">
              Code ..........
            </label>
            <input
              id="supplier-code"
              name="code"
              type="text"
              className="form-input-code"
              value={formData.code}
              onChange={handleInputChange}
              ref={codeInputRef}
              autoComplete="off"
            />
          </div>

          {/* Name */}
          <div className="form-field-row">
            <label className="form-label" htmlFor="supplier-name">
              Name .........
            </label>
            <input
              id="supplier-name"
              name="name"
              type="text"
              className="form-input-name"
              value={formData.name}
              onChange={handleInputChange}
              autoComplete="off"
            />
          </div>

          {/* Address */}
          <div className="form-field-row">
            <label className="form-label" htmlFor="supplier-address">
              Address .......
            </label>
            <textarea
              id="supplier-address"
              name="address"
              className="form-textarea-address"
              value={formData.address}
              onChange={handleInputChange}
            />
          </div>

          {/* Telephone No */}
          <div className="form-field-row">
            <label className="form-label" htmlFor="supplier-telephone1">
              Telephone No ..
            </label>
            <div className="phone-inputs-group">
              <input
                id="supplier-telephone1"
                name="telephone1"
                type="text"
                className="form-input-phone"
                value={formData.telephone1}
                onChange={handleInputChange}
                autoComplete="off"
              />
              <input
                id="supplier-telephone2"
                name="telephone2"
                type="text"
                className="form-input-phone"
                value={formData.telephone2}
                onChange={handleInputChange}
                autoComplete="off"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="form-button-row">
            <button
              type="button"
              className="btn-classic"
              onClick={handleNew}
            >
              New
            </button>
            <button
              type="submit"
              className="btn-classic"
            >
              Save
            </button>
            <button
              type="button"
              className="btn-classic"
              onClick={handleDelete}
              disabled={!selectedId}
            >
              Delete
            </button>
            <button
              type="button"
              className="btn-classic"
              onClick={handleCancel}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      {/* 4. Supplier List Grid Section */}
      <div className="supplier-grid-section">
        <div className="supplier-table-container">
          <table className="supplier-table">
            <thead>
              <tr>
                <th style={{ width: '100px' }}>Code</th>
                <th style={{ width: '220px' }}>Name</th>
                <th>Address</th>
                <th style={{ width: '130px' }}>Telephone 1</th>
                <th style={{ width: '130px' }}>Telephone 2</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="table-empty-message">
                    Loading suppliers...
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="table-empty-message">
                    No supplier records found. Click &quot;New&quot; to add a supplier.
                  </td>
                </tr>
              ) : (
                suppliers.map((supplier) => (
                  <tr
                    key={supplier._id}
                    className={`supplier-row ${selectedId === supplier._id ? 'selected' : ''}`}
                    onClick={() => handleRowClick(supplier)}
                  >
                    <td style={{ fontWeight: '600' }}>{supplier.code}</td>
                    <td>{supplier.name}</td>
                    <td>{supplier.address || ''}</td>
                    <td>{supplier.telephone1 || supplier.telephone || ''}</td>
                    <td>{supplier.telephone2 || ''}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Bottom Status Bar */}
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill={dbStatus.connected ? '#16a34a' : '#dc2626'}>
                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                <path d="M3 5v6c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                <path d="M3 11v6c0 1.66 4 3 9 3s9-1.34 9-3v-6"/>
              </svg>
            </span>
            <span>
              Database: MongoDB ({dbStatus.connected ? 'Connected' : 'Offline'})
            </span>
          </div>
        </div>

        <div className="statusbar-right">
          <span>Records: {suppliers.length}</span>
          <span>|</span>
          <span>SOFAST MOTORS | v1.0.0</span>
        </div>
      </footer>
    </div>
  );
}

export default SupplierMaster;
