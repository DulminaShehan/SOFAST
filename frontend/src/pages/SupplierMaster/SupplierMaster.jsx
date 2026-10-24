import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import windowIcon from '../../assets/window-icon.png';
import { useAuth } from '../../context/AuthContext';
import './SupplierMaster.css';
import '../ManagementSystem/ManagementSystem.css';

/**
 * Supplier Master File Screen
 * Full SOFAST MOTORS Desktop Application with top Header Bar, Menu Navigation,
 * Status Bar, and the classic Supplier Master File dialog window (#EAF3FF pale blue theme).
 */
function SupplierMaster() {
  const { isAdmin } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [notification, setNotification] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null); // 'master-files' | 'stock-control' | 'sales-service' | 'administration' | null

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    address: '',
    telephone1: '',
    telephone2: '',
    status: 'A', // 'A' = Active, 'I' = Inactive
  });

  const codeInputRef = useRef(null);
  const nameInputRef = useRef(null);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  // Top Menu Navigation Items matching SOFAST POS
  const topMenuItems = [
    { id: 'master-files', label: 'Master Files', hasDropdown: true },
    { id: 'stock-control', label: 'Stock Control System', hasDropdown: true },
    { id: 'sales-service', label: 'Sales and Service', hasDropdown: true },
    { id: 'approvement', label: 'Approvement', hasDropdown: true },
    { id: 'reports', label: 'Reports', path: '/management' },
    { id: 'accounting', label: 'Accounting', path: '/management' },
    { id: 'administration', label: 'Administration', hasDropdown: true },
  ];

  const masterFilesDropdownItems = [
    { id: 'item-master', label: 'Item Master', path: '/item-master' },
    { id: 'supplier-master', label: 'Supplier Master', path: '/supplier-master' },
    { id: 'customer-details', label: 'Customer Details', path: '/customer-details' },
    { id: 'category-master', label: 'Category Master', path: '/management' },
    { id: 'sub-category-master', label: 'Sub Category Master', path: '/management' },
    { id: 'alternative-product', label: 'Alternative Product', path: '/alternative-product' },
  ];

  const stockControlDropdownItems = [
    { id: 'good-receive-note', label: 'Good Receive Note (GRN)', path: '/grn' },
    { id: 'good-return-note', label: 'Good Return Note (GREN)', path: '/good-return-note' },
    { id: 'damage', label: 'Damage', path: '/damage' },
  ];

  const salesServiceDropdownItems = [
    { id: 'create-invoice', label: 'Create Invoice', path: '/invoice' },
    { id: 'settlement-invoice', label: 'Settlement Invoice', path: '/settlement-invoice' },
    { id: 'remaining-balance', label: 'Remaining Balance', path: '/remaining-balance' },
  ];

  const approvementDropdownItems = [
    { id: 'payment-voucher', label: 'Payment Voucher', path: '/payment-voucher' },
    { id: 'petty-cash', label: 'Petty Cash', path: '/petty-cash' },
    { id: 'leave-request', label: 'Leave Request', path: '/leave-request' },
  ];

  const administrationDropdownItems = [
    { id: 'printer-setup', label: 'Printer Setup', path: '/printer-setup' },
    ...(isAdmin ? [{ id: 'new-user', label: 'New User', path: '/new-user' }] : []),
  ];

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Fetch supplier records from API
  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/suppliers');
      if (response.data && response.data.success) {
        setSuppliers(response.data.data || []);
      }
    } catch (error) {
      showNotification('Failed to load suppliers from database.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch next sequential supplier code
  const fetchNextCode = async () => {
    try {
      const response = await api.get('/suppliers/next-code');
      if (response.data && response.data.success && response.data.nextCode) {
        setFormData({
          code: response.data.nextCode,
          name: '',
          address: '',
          telephone1: '',
          telephone2: '',
          status: 'A',
        });
      } else {
        setFormData({
          code: 'SUP-001',
          name: '',
          address: '',
          telephone1: '',
          telephone2: '',
          status: 'A',
        });
      }
      setIsDirty(false);
      setSelectedId(null);
    } catch (error) {
      setFormData({
        code: '',
        name: '',
        address: '',
        telephone1: '',
        telephone2: '',
        status: 'A',
      });
      setIsDirty(false);
      setSelectedId(null);
    }
  };

  useEffect(() => {
    fetchSuppliers();
    fetchNextCode();
  }, []);

  const showNotification = (msg, type = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === msg ? null : curr));
    }, 4500);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setIsDirty(true);
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };


  // 1. Button: New
  const handleNew = async () => {
    if (isDirty) {
      const confirmDiscard = window.confirm('Discard unsaved changes?');
      if (!confirmDiscard) return;
    }
    await fetchNextCode();
    if (nameInputRef.current) {
      nameInputRef.current.focus();
    }
  };

  // 4. Button: Cancel
  const handleCancel = async () => {
    if (isDirty) {
      const confirmDiscard = window.confirm('Discard changes and restore form?');
      if (!confirmDiscard) return;
    }
    await fetchNextCode();
    showNotification('Form cleared.', 'info');
  };

  // 2. Button: Save
  const handleSave = async (e) => {
    if (e) e.preventDefault();

    if (!formData.code || !formData.code.trim()) {
      showNotification('Please enter Supplier Code.', 'error');
      if (codeInputRef.current) codeInputRef.current.focus();
      return;
    }

    if (!formData.name || !formData.name.trim()) {
      showNotification('Please enter Supplier Name.', 'error');
      if (nameInputRef.current) nameInputRef.current.focus();
      return;
    }

    const payload = {
      code: formData.code.trim(),
      name: formData.name.trim(),
      address: formData.address ? formData.address.trim() : '',
      telephone1: formData.telephone1 ? formData.telephone1.trim() : '',
      telephone2: formData.telephone2 ? formData.telephone2.trim() : '',
      status: formData.status || 'A',
    };

    try {
      if (selectedId) {
        // Update existing supplier
        const res = await api.put(`/suppliers/${selectedId}`, payload);
        if (res.data && res.data.success) {
          showNotification('Supplier updated successfully.', 'success');
          setIsDirty(false);
          await fetchSuppliers();
        }
      } else {
        // Create new supplier
        const res = await api.post('/suppliers', payload);
        if (res.data && res.data.success) {
          showNotification('Supplier saved successfully.', 'success');
          setSelectedId(res.data.data?._id || null);
          setIsDirty(false);
          await fetchSuppliers();
        }
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Error saving supplier record.';
      showNotification(msg, 'error');
    }
  };

  // 3. Button: Delete
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
        showNotification(res.data.message || 'Supplier deleted successfully.', res.data.isDeactivated ? 'info' : 'success');
        await fetchNextCode();
        await fetchSuppliers();
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Error deleting supplier.';
      showNotification(msg, 'error');
    }
  };

  // 5. Lower panel row selection
  const handleRowClick = (supplier) => {
    if (isDirty) {
      const confirmDiscard = window.confirm('Discard unsaved changes and load selected supplier?');
      if (!confirmDiscard) return;
    }

    setSelectedId(supplier._id);
    setIsDirty(false);
    setFormData({
      code: supplier.code || '',
      name: supplier.name || '',
      address: supplier.address || '',
      telephone1: supplier.telephone1 || supplier.telephone || '',
      telephone2: supplier.telephone2 || '',
      status: supplier.status || 'A',
    });
  };

  // Window Close
  const handleClose = () => {
    if (isDirty) {
      const confirmClose = window.confirm('Close Supplier Master File? Unsaved changes will be discarded.');
      if (!confirmClose) return;
    }
    navigate('/management');
  };

  return (
    <div className="supplier-master-page-container">
      {/* 1. Top Windows/App Blue Header Bar */}
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
            onClick={handleClose}
          >
            &#x2715;
          </button>
        </div>
      </header>

      {/* 2. Top Classic Menu Bar */}
      <nav className="management-menubar-container" ref={menuRef}>
        <ul className="management-menubar">
          {topMenuItems.map((item) => (
            <li key={item.id} className="menubar-item">
              <button
                type="button"
                className={`menubar-button ${
                  (activeDropdown === item.id) || (item.id === 'master-files' && activeDropdown === 'master-files') ? 'active' : ''
                }`}
                onClick={() => {
                  if (item.hasDropdown) {
                    setActiveDropdown((prev) => (prev === item.id ? null : item.id));
                  } else {
                    setActiveDropdown(null);
                    navigate(item.path || '/management');
                  }
                }}
              >
                {item.label}
              </button>

              {/* Master Files Dropdown */}
              {item.id === 'master-files' && activeDropdown === 'master-files' && (
                <ul className="masterfiles-dropdown">
                  {masterFilesDropdownItems.map((masterItem) => (
                    <li key={masterItem.id} className="dropdown-entry">
                      <button
                        type="button"
                        className={`dropdown-item-btn ${masterItem.id === 'supplier-master' ? 'selected' : ''}`}
                        onClick={() => {
                          setActiveDropdown(null);
                          navigate(masterItem.path);
                        }}
                      >
                        <span>{masterItem.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Stock Control System Dropdown */}
              {item.id === 'stock-control' && activeDropdown === 'stock-control' && (
                <ul className="masterfiles-dropdown">
                  {stockControlDropdownItems.map((scItem) => (
                    <li key={scItem.id} className="dropdown-entry">
                      <button
                        type="button"
                        className="dropdown-item-btn"
                        onClick={() => {
                          setActiveDropdown(null);
                          navigate(scItem.path);
                        }}
                      >
                        <span>{scItem.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Sales and Service Dropdown */}
              {item.id === 'sales-service' && activeDropdown === 'sales-service' && (
                <ul className="masterfiles-dropdown">
                  {salesServiceDropdownItems.map((dropItem) => (
                    <li key={dropItem.id} className="dropdown-entry">
                      <button
                        type="button"
                        className="dropdown-item-btn"
                        onClick={() => {
                          setActiveDropdown(null);
                          navigate(dropItem.path);
                        }}
                      >
                        <span>{dropItem.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Approvement Dropdown */}
              {item.id === 'approvement' && activeDropdown === 'approvement' && (
                <ul className="masterfiles-dropdown">
                  {approvementDropdownItems.map((dropItem) => (
                    <li key={dropItem.id} className="dropdown-entry">
                      <button
                        type="button"
                        className="dropdown-item-btn"
                        onClick={() => {
                          setActiveDropdown(null);
                          navigate(dropItem.path);
                        }}
                      >
                        <span>{dropItem.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Administration Dropdown */}
              {item.id === 'administration' && activeDropdown === 'administration' && (
                <ul className="masterfiles-dropdown">
                  {administrationDropdownItems.map((admItem) => (
                    <li key={admItem.id} className="dropdown-entry">
                      <button
                        type="button"
                        className="dropdown-item-btn"
                        onClick={() => {
                          setActiveDropdown(null);
                          navigate(admItem.path);
                        }}
                      >
                        <span>{admItem.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* 3. Main Desktop Workspace centering the Supplier Master Window */}
      <main className="supplier-master-workspace">
        <div className="supplier-master-window">
          {/* Fixed Dialog Title Bar (Always visible at the top) */}
          <div className="supplier-titlebar">
            <div className="titlebar-left">
              <img src={windowIcon} alt="" className="window-icon" />
              <span className="window-title">Supplier Master File</span>
            </div>
            <button
              type="button"
              className="titlebar-close-btn"
              aria-label="Close"
              onClick={handleClose}
              title="Close"
            >
              &#x2715;
            </button>
          </div>

          {/* Scrollable Window Body */}
          <div className="supplier-window-body">
            {/* Status / Validation Notification Bar */}
            {notification && (
              <div className={`supplier-notification-banner ${notification.type}`}>
                <span className="notification-text">{notification.message}</span>
                <button
                  type="button"
                  className="notification-dismiss"
                  onClick={() => setNotification(null)}
                  aria-label="Dismiss notification"
                >
                  &times;
                </button>
              </div>
            )}

            <form className="supplier-form" onSubmit={handleSave} autoComplete="off">
              {/* Field: Code */}
              <div className="field-row">
                <label className="field-label" htmlFor="supplier-code">
                  Code . . . . . . . . .
                </label>
                <input
                  id="supplier-code"
                  name="code"
                  type="text"
                  className="input-code"
                  value={formData.code}
                  onChange={handleInputChange}
                  ref={codeInputRef}
                  autoComplete="off"
                />
              </div>

              {/* Field: Name */}
              <div className="field-row">
                <label className="field-label" htmlFor="supplier-name">
                  Name . . . . . . . .
                </label>
                <input
                  id="supplier-name"
                  name="name"
                  type="text"
                  className="input-name"
                  value={formData.name}
                  onChange={handleInputChange}
                  ref={nameInputRef}
                  autoComplete="off"
                />
              </div>

              {/* Field: Address */}
              <div className="field-row field-row-address">
                <label className="field-label" htmlFor="supplier-address">
                  Address . . . . . .
                </label>
                <textarea
                  id="supplier-address"
                  name="address"
                  className="textarea-address"
                  value={formData.address}
                  onChange={handleInputChange}
                />
              </div>

              {/* Field: Telephone No */}
              <div className="field-row">
                <label className="field-label" htmlFor="supplier-telephone1">
                  Telephone No . .
                </label>
                <div className="phone-inputs-container">
                  <input
                    id="supplier-telephone1"
                    name="telephone1"
                    type="text"
                    className="input-phone"
                    value={formData.telephone1}
                    onChange={handleInputChange}
                    placeholder="Telephone 1"
                    autoComplete="off"
                  />
                  <input
                    id="supplier-telephone2"
                    name="telephone2"
                    type="text"
                    className="input-phone"
                    value={formData.telephone2}
                    onChange={handleInputChange}
                    placeholder="Telephone 2"
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Buttons Row: New, Save, Delete, Cancel */}
              <div className="buttons-row">
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

            {/* Lower Panel: Displays real supplier records for selection */}
            <div className="lower-panel">
              <div className="lower-panel-table-wrapper">
                <table className="lower-panel-table">
                  <thead>
                    <tr>
                      <th style={{ width: '75px' }}>Code</th>
                      <th style={{ width: '175px' }}>Name</th>
                      <th style={{ width: '110px' }}>Telephone 1</th>
                      <th style={{ width: '110px' }}>Telephone 2</th>
                      <th style={{ width: '150px' }}>Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="5" className="lower-panel-empty">
                          Loading...
                        </td>
                      </tr>
                    ) : suppliers.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="lower-panel-empty">
                          No supplier records found.
                        </td>
                      </tr>
                    ) : (
                      suppliers.map((supplier) => (
                        <tr
                          key={supplier._id}
                          className={`lower-panel-row ${selectedId === supplier._id ? 'selected' : ''}`}
                          onClick={() => handleRowClick(supplier)}
                          title={`Select ${supplier.name}`}
                        >
                          <td className="col-code">{supplier.code}</td>
                          <td className="col-name">{supplier.name}</td>
                          <td className="col-phone">{supplier.telephone1 || supplier.telephone || ''}</td>
                          <td className="col-phone">{supplier.telephone2 || ''}</td>
                          <td className="col-address">{supplier.address || ''}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 4. Bottom Desktop Status Bar */}
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
            <span>
              Database: MongoDB (Connected)
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
