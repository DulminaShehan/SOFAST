import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './PrinterSetup.css';

/**
 * SOFAST Administration - Printer Setup Page
 * Classic ERP / Visual Basic 6 desktop design
 */
function PrinterSetup() {
  const navigate = useNavigate();

  // Navigation Menubar state
  const [activeDropdown, setActiveDropdown] = useState('administration');
  const menuRef = useRef(null);

  // Notification Banner
  const [notification, setNotification] = useState(null);

  // Selected row index
  const [selectedPrinterIndex, setSelectedPrinterIndex] = useState(0);

  // Available Windows Printers list (Simulated for UI)
  const [availableSystemPrinters, setAvailableSystemPrinters] = useState([
    'POS-80MM (EPSON TM-T82III)',
    'POS-58MM Thermal Printer',
    'HP LaserJet Pro MFP M428fdw',
    'EPSON LQ-310 Dot Matrix',
    'Microsoft Print to PDF',
    'Send to OneNote (Desktop)',
  ]);

  // Form State
  const [formData, setFormData] = useState({
    code: 'PRN001',
    name: 'POS Thermal Printer',
    type: 'Thermal Printer',
    systemPrinter: 'POS-80MM (EPSON TM-T82III)',
    paperSize: '80mm',
    status: 'Active',
    isDefault: true,
    description: 'POS Thermal Receipt Printer (Sales Invoice)',
  });

  // Configured Printers Table List (Initial seed data matching reference screenshot)
  const [printersList, setPrintersList] = useState([
    {
      id: 1,
      code: 'PRN001',
      name: 'POS Thermal Printer',
      type: 'Thermal Printer',
      systemPrinter: 'POS-80MM (EPSON TM-T82III)',
      paperSize: '80mm',
      status: 'Active',
      isDefault: true,
      description: 'POS Thermal Receipt Printer (Sales Invoice)',
    },
    {
      id: 2,
      code: 'PRN002',
      name: 'Counter Thermal Printer',
      type: 'Thermal Printer',
      systemPrinter: 'POS-58MM Thermal Printer',
      paperSize: '58mm',
      status: 'Active',
      isDefault: false,
      description: 'Counter Receipt Printer',
    },
    {
      id: 3,
      code: 'PRN003',
      name: 'Office Laser Printer',
      type: 'A4 Printer',
      systemPrinter: 'HP LaserJet Pro MFP M428fdw',
      paperSize: 'A4',
      status: 'Active',
      isDefault: false,
      description: 'Office Invoice Printer (A4)',
    },
    {
      id: 4,
      code: 'PRN004',
      name: 'Dot Matrix Printer',
      type: 'Dot Matrix Printer',
      systemPrinter: 'EPSON LQ-310 Dot Matrix',
      paperSize: 'A4',
      status: 'Inactive',
      isDefault: false,
      description: 'Old Dot Matrix Printer',
    },
  ]);

  // Menubar items
  const topMenuItems = [
    { id: 'master-files', label: 'Master Files', hasDropdown: true },
    { id: 'stock-control', label: 'Stock Control System', hasDropdown: true },
    { id: 'sales-service', label: 'Sales and Service', hasDropdown: true },
    { id: 'production', label: 'Production', path: '/management' },
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
    { id: 'good-receive-note', label: 'Good Receive Note', path: '/grn' },
  ];

  const salesServiceDropdownItems = [
    { id: 'create-invoice', label: 'Create Invoice', path: '/invoice' },
    { id: 'settlement-invoice', label: 'Settlement Invoice', path: '/settlement-invoice' },
  ];

  const administrationDropdownItems = [
    { id: 'printer-setup', label: 'Printer Setup', path: '/printer-setup' },
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

  const showNotification = (msg, type = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => {
      setNotification(null);
    }, 3500);
  };

  // Form Field Change Handler
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // Auto-generate next Printer Code
  const getNextPrinterCode = () => {
    const numbers = printersList.map((p) => {
      const match = p.code.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    });
    const maxNum = numbers.length > 0 ? Math.max(...numbers, 0) : 0;
    const nextNum = maxNum + 1;
    return `PRN${String(nextNum).padStart(3, '0')}`;
  };

  // BUTTON: NEW
  const handleNew = () => {
    const nextCode = getNextPrinterCode();
    setFormData({
      code: nextCode,
      name: '',
      type: 'Thermal Printer',
      systemPrinter: availableSystemPrinters[0] || '',
      paperSize: '80mm',
      status: 'Active',
      isDefault: false,
      description: '',
    });
    setSelectedPrinterIndex(-1);
    showNotification(`Initialized new printer profile '${nextCode}'`, 'info');
  };

  // BUTTON: CLEAR
  const handleClear = () => {
    setFormData({
      code: '',
      name: '',
      type: 'Thermal Printer',
      systemPrinter: availableSystemPrinters[0] || '',
      paperSize: '80mm',
      status: 'Active',
      isDefault: false,
      description: '',
    });
    setSelectedPrinterIndex(-1);
    showNotification('Form cleared', 'info');
  };

  // BUTTON: REFRESH PRINTERS
  const handleRefreshPrinters = () => {
    showNotification('Refreshed local Windows printer hardware devices', 'info');
  };

  // BUTTON: SAVE (Add or Update)
  const handleSave = (e) => {
    if (e) e.preventDefault();

    if (!formData.code || formData.code.trim() === '') {
      showNotification('Please provide a Printer Code', 'error');
      return;
    }
    if (!formData.name || formData.name.trim() === '') {
      showNotification('Please enter a Printer Name', 'error');
      return;
    }

    const trimmedCode = formData.code.trim().toUpperCase();
    const existingIndex = printersList.findIndex((p) => p.code.toUpperCase() === trimmedCode);

    let updatedList = [...printersList];

    // If marked as default, unmark others
    if (formData.isDefault) {
      updatedList = updatedList.map((p) => ({ ...p, isDefault: false }));
    }

    const printerObj = {
      id: existingIndex >= 0 ? printersList[existingIndex].id : Date.now(),
      code: trimmedCode,
      name: formData.name.trim(),
      type: formData.type,
      systemPrinter: formData.systemPrinter,
      paperSize: formData.paperSize,
      status: formData.status,
      isDefault: formData.isDefault,
      description: formData.description.trim(),
    };

    if (existingIndex >= 0) {
      updatedList[existingIndex] = printerObj;
      setPrintersList(updatedList);
      setSelectedPrinterIndex(existingIndex);
      showNotification(`Printer configuration '${trimmedCode}' updated successfully`, 'success');
    } else {
      updatedList.push(printerObj);
      setPrintersList(updatedList);
      setSelectedPrinterIndex(updatedList.length - 1);
      showNotification(`Printer '${trimmedCode}' created and configured successfully`, 'success');
    }
  };

  // BUTTON: DELETE
  const handleDelete = () => {
    if (!formData.code) {
      showNotification('No printer selected to delete', 'error');
      return;
    }

    const confirmDelete = window.confirm(`Are you sure you want to delete printer '${formData.code}'?`);
    if (!confirmDelete) return;

    const filtered = printersList.filter((p) => p.code.toUpperCase() !== formData.code.trim().toUpperCase());
    setPrintersList(filtered);
    handleNew();
    showNotification(`Printer '${formData.code}' deleted successfully`, 'success');
  };

  // Select row from table
  const handleSelectRow = (printer, index) => {
    setSelectedPrinterIndex(index);
    setFormData({
      code: printer.code,
      name: printer.name,
      type: printer.type,
      systemPrinter: printer.systemPrinter,
      paperSize: printer.paperSize,
      status: printer.status,
      isDefault: printer.isDefault,
      description: printer.description,
    });
  };

  return (
    <div className="printer-setup-page">
      {/* 1. Windows Blue Header */}
      <header className="printer-titlebar">
        <div className="printer-titlebar-brand">
          <svg className="printer-titlebar-car-icon" viewBox="0 0 24 24">
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
          </svg>
          <span className="printer-titlebar-heading">SOFAST MOTORS - Management System</span>
        </div>
        <div className="printer-titlebar-controls">
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

      {/* 2. Top Classic Menu Bar */}
      <nav className="printer-menubar-container" ref={menuRef}>
        <ul className="printer-menubar">
          {topMenuItems.map((item) => (
            <li key={item.id} className="printer-menubar-item">
              <button
                type="button"
                className={`printer-menubar-button ${
                  item.id === 'administration' || activeDropdown === item.id ? 'active' : ''
                }`}
                onClick={() => {
                  if (item.hasDropdown) {
                    setActiveDropdown(activeDropdown === item.id ? null : item.id);
                  } else if (item.path) {
                    navigate(item.path);
                  }
                }}
              >
                {item.label}
              </button>

              {/* Master Files Dropdown */}
              {item.id === 'master-files' && activeDropdown === 'master-files' && (
                <ul className="printer-dropdown-menu">
                  {masterFilesDropdownItems.map((dropItem) => (
                    <li key={dropItem.id} className="printer-dropdown-entry">
                      <button
                        type="button"
                        className="printer-dropdown-item-btn"
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

              {/* Stock Control System Dropdown */}
              {item.id === 'stock-control' && activeDropdown === 'stock-control' && (
                <ul className="printer-dropdown-menu">
                  {stockControlDropdownItems.map((dropItem) => (
                    <li key={dropItem.id} className="printer-dropdown-entry">
                      <button
                        type="button"
                        className="printer-dropdown-item-btn"
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

              {/* Sales and Service Dropdown */}
              {item.id === 'sales-service' && activeDropdown === 'sales-service' && (
                <ul className="printer-dropdown-menu">
                  {salesServiceDropdownItems.map((dropItem) => (
                    <li key={dropItem.id} className="printer-dropdown-entry">
                      <button
                        type="button"
                        className="printer-dropdown-item-btn"
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
                <ul className="printer-dropdown-menu">
                  {administrationDropdownItems.map((dropItem) => (
                    <li key={dropItem.id} className="printer-dropdown-entry">
                      <button
                        type="button"
                        className="printer-dropdown-item-btn selected"
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
            </li>
          ))}
        </ul>
      </nav>

      {/* 3. Main Form Canvas */}
      <main className="printer-main-canvas">
        {/* Notification Box */}
        {notification && (
          <div className={`printer-alert ${notification.type}`}>
            <span>{notification.message}</span>
            <button
              type="button"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
              onClick={() => setNotification(null)}
            >
              &#x2715;
            </button>
          </div>
        )}

        {/* SECTION 1: Printer Setup Header */}
        <div className="printer-blue-header">
          <span>Printer Setup</span>
        </div>

        {/* SECTION 1: Form Panel Container */}
        <form className="printer-panel-container" onSubmit={handleSave}>
          {/* Printer Code */}
          <div className="printer-form-row">
            <span className="dotted-label-blue">Printer Code . . . . . . .</span>
            <input
              type="text"
              name="code"
              className="printer-input"
              style={{ width: '130px', fontWeight: '600' }}
              value={formData.code}
              onChange={handleInputChange}
              placeholder="PRN001"
            />
          </div>

          {/* Printer Name */}
          <div className="printer-form-row">
            <span className="dotted-label-blue">Printer Name . . . . . .</span>
            <input
              type="text"
              name="name"
              className="printer-input"
              style={{ width: '520px' }}
              value={formData.name}
              onChange={handleInputChange}
              placeholder="POS Thermal Printer"
            />
          </div>

          {/* Printer Type */}
          <div className="printer-form-row">
            <span className="dotted-label-blue">Printer Type . . . . . . .</span>
            <select
              name="type"
              className="printer-select"
              style={{ width: '280px' }}
              value={formData.type}
              onChange={handleInputChange}
            >
              <option value="Thermal Printer">Thermal Printer</option>
              <option value="A4 Printer">A4 Printer</option>
              <option value="Dot Matrix Printer">Dot Matrix Printer</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Printer (System device selection) & Refresh button */}
          <div className="printer-form-row">
            <span className="dotted-label-blue">Printer . . . . . . . . . .</span>
            <select
              name="systemPrinter"
              className="printer-select"
              style={{ width: '280px' }}
              value={formData.systemPrinter}
              onChange={handleInputChange}
            >
              {availableSystemPrinters.map((prn) => (
                <option key={prn} value={prn}>
                  {prn}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="printer-btn-classic"
              style={{ height: '24px', minWidth: '76px' }}
              onClick={handleRefreshPrinters}
            >
              Refresh
            </button>
          </div>

          {/* Paper Size */}
          <div className="printer-form-row">
            <span className="dotted-label-blue">Paper Size . . . . . . . .</span>
            <select
              name="paperSize"
              className="printer-select"
              style={{ width: '280px' }}
              value={formData.paperSize}
              onChange={handleInputChange}
            >
              <option value="80mm">80mm</option>
              <option value="58mm">58mm</option>
              <option value="A4">A4</option>
              <option value="A5">A5</option>
              <option value="Custom">Custom</option>
            </select>
          </div>

          {/* Printer Status */}
          <div className="printer-form-row">
            <span className="dotted-label-blue">Printer Status . . . . . .</span>
            <select
              name="status"
              className="printer-select"
              style={{ width: '280px' }}
              value={formData.status}
              onChange={handleInputChange}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          {/* Default Printer Checkbox */}
          <div className="printer-form-row">
            <span className="dotted-label-blue">Default Printer . . . . .</span>
            <label className="printer-checkbox-label">
              <input
                type="checkbox"
                name="isDefault"
                checked={formData.isDefault}
                onChange={handleInputChange}
                style={{ width: '15px', height: '15px', cursor: 'pointer' }}
              />
              <span>Set as Default Printer</span>
            </label>
          </div>

          {/* Description */}
          <div className="printer-form-row">
            <span className="dotted-label-blue">Description . . . . . . . .</span>
            <input
              type="text"
              name="description"
              className="printer-input"
              style={{ flex: 1 }}
              value={formData.description}
              onChange={handleInputChange}
              placeholder="POS Thermal Receipt Printer (Sales Invoice)"
            />
          </div>

          {/* Action Buttons: New | Save | Delete | Clear */}
          <div className="printer-form-actions-row">
            <button type="button" className="printer-btn-classic" onClick={handleNew}>
              New
            </button>
            <button type="submit" className="printer-btn-classic">
              Save
            </button>
            <button type="button" className="printer-btn-classic" onClick={handleDelete}>
              Delete
            </button>
            <button type="button" className="printer-btn-classic" onClick={handleClear}>
              Clear
            </button>
          </div>
        </form>

        {/* SECTION 2: Configured Printers Header */}
        <div className="printer-blue-header" style={{ marginTop: '4px' }}>
          <span>Configured Printers</span>
        </div>

        {/* SECTION 2: Configured Printers Table */}
        <div className="printer-table-wrapper">
          <table className="printer-table">
            <thead>
              <tr>
                <th style={{ width: '35px', textAlign: 'center' }}>#</th>
                <th style={{ width: '80px' }}>Code</th>
                <th style={{ width: '190px' }}>Printer Name</th>
                <th style={{ width: '150px' }}>Printer Type</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Paper Size</th>
                <th style={{ width: '85px', textAlign: 'center' }}>Status</th>
                <th style={{ width: '75px', textAlign: 'center' }}>Default</th>
                <th>Description</th>
                <th style={{ width: '80px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {printersList.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: '#888' }}>
                    No printers configured. Use the form above to add a printer.
                  </td>
                </tr>
              ) : (
                printersList.map((prn, idx) => (
                  <tr
                    key={prn.code}
                    className={selectedPrinterIndex === idx ? 'selected' : ''}
                    onClick={() => handleSelectRow(prn, idx)}
                  >
                    <td style={{ textAlign: 'center', color: '#666' }}>{idx + 1}</td>
                    <td style={{ fontWeight: 'bold' }}>{prn.code}</td>
                    <td>{prn.name}</td>
                    <td>{prn.type}</td>
                    <td style={{ textAlign: 'center' }}>{prn.paperSize}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={prn.status === 'Active' ? 'status-active' : 'status-inactive'}>
                        {prn.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={prn.isDefault ? 'default-yes' : 'default-no'}>
                        {prn.isDefault ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td>{prn.description}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="printer-action-btn"
                        title="Edit Printer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectRow(prn, idx);
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        className="printer-action-btn"
                        title="Delete Printer"
                        style={{ color: '#e81123', marginLeft: '6px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          const confirmDelete = window.confirm(`Are you sure you want to delete printer '${prn.code}'?`);
                          if (confirmDelete) {
                            setPrintersList((prev) => prev.filter((p) => p.code !== prn.code));
                            if (selectedPrinterIndex === idx) handleNew();
                            showNotification(`Printer '${prn.code}' deleted`, 'success');
                          }
                        }}
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default PrinterSetup;
