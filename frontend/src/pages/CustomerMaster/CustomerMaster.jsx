import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './CustomerMaster.css';

/**
 * Customer Master / Customer Details
 * Classic SOFAST Desktop ERP / Visual Basic 6 UI
 */
function CustomerMaster() {
  const navigate = useNavigate();

  // Navigation Menubar state
  const [activeDropdown, setActiveDropdown] = useState('master-files');
  const menuRef = useRef(null);

  // Notification Banner
  const [notification, setNotification] = useState(null);

  // Loading States
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Customers Data List
  const [customersList, setCustomersList] = useState([]);

  // Form State matching the reference image
  const [formData, setFormData] = useState({
    _id: null,
    code: '',
    name: '',
    address: '',
    telephone1: '',
    telephone2: '',
    route: '',
    category: '',
    accNo: '',
    target: '',
    notes: '',
    gtnAllowed: 'Yes',
    discount: '0.00',
    creditLimit: '0.00',
    dueAmount: '0.00',
    creditPeriod: '0',
    use2ndPrice: 'No',
    vatNo: '',
    status: 'Active',
  });

  // Search Modal State
  const [searchModal, setSearchModal] = useState({
    isOpen: false,
    search: '',
  });

  // Table filter search
  const [tableSearch, setTableSearch] = useState('');

  // Top Menu Items
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

  // Route & Category options
  const defaultRoutes = ['Main Route', 'Colombo Route', 'Galle Route', 'Kandy Route', 'Route 1', 'Route 2', 'Direct'];
  const defaultCategories = ['Regular Customer', 'Retail Customer', 'Wholesale Customer', 'Credit Customer', 'Corporate', 'VIP'];

  const showNotification = (msg, type = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // 1. Fetch Customers from MongoDB
  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/customers?limit=1000');
      if (res.data?.data) {
        setCustomersList(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Next Customer Code
  const fetchNextCode = async () => {
    try {
      const res = await api.get('/customers/next-code');
      if (res.data?.nextCode) {
        setFormData((prev) => ({ ...prev, code: res.data.nextCode }));
      }
    } catch (err) {
      console.error('Failed to fetch next customer code:', err);
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchNextCode();
  }, []);

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

  // Form Field Change Handler
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Select Customer from Table or Search Modal
  const handleSelectCustomer = (customer) => {
    setFormData({
      _id: customer._id || null,
      code: customer.code || customer.customerCode || '',
      name: customer.name || '',
      address: customer.address || '',
      telephone1: customer.telephone1 || customer.telephone || '',
      telephone2: customer.telephone2 || '',
      route: customer.route || '',
      category: customer.category || '',
      accNo: customer.accNo || '',
      target: customer.target || customer.targetAmount || '',
      notes: customer.notes || customer.remark || '',
      gtnAllowed: customer.gtnAllowed || (customer.cusGtn === 1 ? 'Yes' : 'No') || 'Yes',
      discount: customer.discount !== undefined ? Number(customer.discount).toFixed(2) : '0.00',
      creditLimit: customer.creditLimit !== undefined ? Number(customer.creditLimit).toFixed(2) : '0.00',
      dueAmount: customer.dueAmount !== undefined ? Number(customer.dueAmount).toFixed(2) : '0.00',
      creditPeriod: String(customer.creditPeriod || '0'),
      use2ndPrice: customer.use2ndPrice || (customer.use2Price === 1 ? 'Yes' : 'No') || 'No',
      vatNo: customer.vatNo || customer.vatNumber || '',
      status: customer.status || 'Active',
    });

    setSearchModal({ isOpen: false, search: '' });
    showNotification(`Loaded Customer: ${customer.code} - ${customer.name}`, 'info');
  };

  // BUTTON: NEW
  const handleNew = () => {
    setFormData({
      _id: null,
      code: '',
      name: '',
      address: '',
      telephone1: '',
      telephone2: '',
      route: '',
      category: '',
      accNo: '',
      target: '',
      notes: '',
      gtnAllowed: 'Yes',
      discount: '0.00',
      creditLimit: '0.00',
      dueAmount: '0.00',
      creditPeriod: '0',
      use2ndPrice: 'No',
      vatNo: '',
      status: 'Active',
    });
    fetchNextCode();
    showNotification('Form cleared. Ready for new Customer entry.', 'info');
  };

  // BUTTON: CANCEL
  const handleCancel = () => {
    handleNew();
  };

  // BUTTON: SAVE
  const handleSave = async () => {
    if (!formData.name || !formData.name.trim()) {
      showNotification('Customer Name is required', 'error');
      return;
    }

    try {
      setIsSaving(true);

      const payload = {
        code: formData.code?.trim(),
        name: formData.name.trim(),
        address: formData.address || '',
        telephone: formData.telephone1 || '',
        telephone1: formData.telephone1 || '',
        telephone2: formData.telephone2 || '',
        route: formData.route || '',
        category: formData.category || '',
        accNo: formData.accNo || '',
        target: parseFloat(formData.target) || 0,
        notes: formData.notes || '',
        gtnAllowed: formData.gtnAllowed || 'Yes',
        discount: parseFloat(formData.discount) || 0,
        creditLimit: parseFloat(formData.creditLimit) || 0,
        dueAmount: parseFloat(formData.dueAmount) || 0,
        creditPeriod: parseInt(formData.creditPeriod, 10) || 0,
        use2ndPrice: formData.use2ndPrice || 'No',
        vatNo: formData.vatNo || '',
        status: formData.status || 'Active',
      };

      let res;
      if (formData._id) {
        // Update existing customer
        res = await api.put(`/customers/${formData._id}`, payload);
        if (res.data?.success) {
          showNotification(`Customer '${formData.name}' updated successfully!`, 'success');
        }
      } else {
        // Create new customer
        res = await api.post('/customers', payload);
        if (res.data?.success) {
          showNotification(`Customer '${formData.name}' saved successfully with Code '${res.data.data?.code}'!`, 'success');
        }
      }

      fetchCustomers();
      if (res.data?.data) {
        handleSelectCustomer(res.data.data);
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to save customer';
      showNotification(errMsg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // BUTTON: DELETE
  const handleDelete = async () => {
    if (!formData.code && !formData._id) {
      showNotification('No customer selected to delete', 'error');
      return;
    }

    const confirmDel = window.confirm(
      `Are you sure you want to delete Customer '${formData.code} - ${formData.name}'?`
    );
    if (!confirmDel) return;

    try {
      const targetId = formData._id || formData.code;
      const res = await api.delete(`/customers/${encodeURIComponent(targetId)}`);
      if (res.data?.success) {
        showNotification(`Customer '${formData.name}' deleted successfully`, 'success');
        handleNew();
        fetchCustomers();
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to delete customer';
      showNotification(errMsg, 'error');
    }
  };

  // Filter for Search Modal
  const modalSearchResults = useMemo(() => {
    const q = searchModal.search.toLowerCase().trim();
    if (!q) return customersList.slice(0, 50);
    return customersList.filter(
      (c) =>
        c.code?.toLowerCase().includes(q) ||
        c.name?.toLowerCase().includes(q) ||
        c.telephone?.toLowerCase().includes(q) ||
        c.telephone1?.toLowerCase().includes(q) ||
        c.telephone2?.toLowerCase().includes(q) ||
        c.address?.toLowerCase().includes(q)
    );
  }, [customersList, searchModal.search]);

  // Filter for Bottom Table
  const filteredTableCustomers = useMemo(() => {
    const q = tableSearch.toLowerCase().trim();
    if (!q) return customersList;
    return customersList.filter(
      (c) =>
        c.code?.toLowerCase().includes(q) ||
        c.name?.toLowerCase().includes(q) ||
        c.telephone?.toLowerCase().includes(q) ||
        c.category?.toLowerCase().includes(q) ||
        c.route?.toLowerCase().includes(q) ||
        c.vatNo?.toLowerCase().includes(q)
    );
  }, [customersList, tableSearch]);

  return (
    <div className="cust-master-page">
      {/* 1. Windows Blue Header */}
      <header className="cust-titlebar">
        <div className="cust-titlebar-brand">
          <svg className="cust-titlebar-car-icon" viewBox="0 0 24 24">
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
          </svg>
          <span className="cust-titlebar-heading">SOFAST MOTORS - Management System</span>
        </div>
        <div className="cust-titlebar-controls">
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
      <nav className="cust-menubar-container" ref={menuRef}>
        <ul className="cust-menubar">
          {topMenuItems.map((item) => (
            <li key={item.id} className="cust-menubar-item">
              <button
                type="button"
                className={`cust-menubar-button ${
                  item.id === 'master-files' || activeDropdown === item.id ? 'active' : ''
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
                <ul className="cust-dropdown-menu">
                  {masterFilesDropdownItems.map((dropItem) => (
                    <li key={dropItem.id} className="cust-dropdown-entry">
                      <button
                        type="button"
                        className={`cust-dropdown-item-btn ${
                          dropItem.id === 'customer-details' ? 'selected' : ''
                        }`}
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
                <ul className="cust-dropdown-menu">
                  {stockControlDropdownItems.map((dropItem) => (
                    <li key={dropItem.id} className="cust-dropdown-entry">
                      <button
                        type="button"
                        className="cust-dropdown-item-btn"
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
                <ul className="cust-dropdown-menu">
                  {salesServiceDropdownItems.map((dropItem) => (
                    <li key={dropItem.id} className="cust-dropdown-entry">
                      <button
                        type="button"
                        className="cust-dropdown-item-btn"
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
                <ul className="cust-dropdown-menu">
                  {administrationDropdownItems.map((dropItem) => (
                    <li key={dropItem.id} className="cust-dropdown-entry">
                      <button
                        type="button"
                        className="cust-dropdown-item-btn"
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

      {/* 3. Main Form Section */}
      <main className="cust-main-canvas">
        {/* Notification Box */}
        {notification && (
          <div className={`cust-alert ${notification.type}`}>
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

        {/* Outer Form Container */}
        <div className="cust-panel-container">
          {/* Section Header: Customer Master */}
          <div className="cust-section-header">
            <span>Customer Master</span>
          </div>

          {/* Form Two-Column Grid */}
          <div className="cust-form-grid">
            {/* ========================================================= */}
            {/* LEFT COLUMN FIELDS                                        */}
            {/* ========================================================= */}
            <div className="cust-left-col">
              {/* Code */}
              <div className="cust-form-row">
                <span className="dotted-label-blue">Code . . . . . . . . .</span>
                <div className="input-with-lookup">
                  <input
                    type="text"
                    name="code"
                    className="cust-input"
                    style={{ width: '150px', fontWeight: 'bold', color: '#000080' }}
                    value={formData.code}
                    onChange={handleChange}
                    placeholder="Customer Code"
                  />
                  <button
                    type="button"
                    className="cust-btn-lookup"
                    title="Search Customers"
                    onClick={() => setSearchModal({ isOpen: true, search: '' })}
                  >
                    ...
                  </button>
                </div>
              </div>

              {/* Name */}
              <div className="cust-form-row">
                <span className="dotted-label-blue">Name . . . . . . . . .</span>
                <input
                  type="text"
                  name="name"
                  className="cust-input"
                  style={{ width: '380px' }}
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Customer Full Name"
                />
              </div>

              {/* Address */}
              <div className="cust-form-row" style={{ alignItems: 'flex-start' }}>
                <span className="dotted-label-blue" style={{ paddingTop: '3px' }}>Address . . . . . . . .</span>
                <textarea
                  name="address"
                  className="cust-textarea"
                  style={{ width: '380px', height: '48px', resize: 'none' }}
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Customer Address"
                  rows={2}
                />
              </div>

              {/* Telephone No. */}
              <div className="cust-form-row">
                <span className="dotted-label-blue">Telephone No . . . . .</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    name="telephone1"
                    className="cust-input"
                    style={{ width: '187px' }}
                    value={formData.telephone1}
                    onChange={handleChange}
                    placeholder="Telephone 1"
                  />
                  <input
                    type="text"
                    name="telephone2"
                    className="cust-input"
                    style={{ width: '187px' }}
                    value={formData.telephone2}
                    onChange={handleChange}
                    placeholder="Telephone 2"
                  />
                </div>
              </div>

              {/* Route */}
              <div className="cust-form-row">
                <span className="dotted-label-blue">Route . . . . . . . . .</span>
                <div className="input-with-lookup">
                  <select
                    name="route"
                    className="cust-select"
                    style={{ width: '180px' }}
                    value={formData.route}
                    onChange={handleChange}
                  >
                    <option value="">-- Select Route --</option>
                    {defaultRoutes.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                    {formData.route && !defaultRoutes.includes(formData.route) && (
                      <option value={formData.route}>{formData.route}</option>
                    )}
                  </select>
                  <button
                    type="button"
                    className="cust-btn-lookup"
                    title="Quick enter route"
                    onClick={() => {
                      const newR = prompt('Enter custom Route:', formData.route);
                      if (newR !== null) setFormData((prev) => ({ ...prev, route: newR.trim() }));
                    }}
                  >
                    ...
                  </button>
                </div>
              </div>

              {/* Category */}
              <div className="cust-form-row">
                <span className="dotted-label-blue">Category . . . . . . . .</span>
                <div className="input-with-lookup">
                  <select
                    name="category"
                    className="cust-select"
                    style={{ width: '180px' }}
                    value={formData.category}
                    onChange={handleChange}
                  >
                    <option value="">-- Select Category --</option>
                    {defaultCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    {formData.category && !defaultCategories.includes(formData.category) && (
                      <option value={formData.category}>{formData.category}</option>
                    )}
                  </select>
                  <button
                    type="button"
                    className="cust-btn-lookup"
                    title="Quick enter category"
                    onClick={() => {
                      const newC = prompt('Enter custom Category:', formData.category);
                      if (newC !== null) setFormData((prev) => ({ ...prev, category: newC.trim() }));
                    }}
                  >
                    ...
                  </button>
                </div>
              </div>

              {/* Acc No */}
              <div className="cust-form-row">
                <span className="dotted-label-blue">Acc No . . . . . . . . .</span>
                <input
                  type="text"
                  name="accNo"
                  className="cust-input"
                  style={{ width: '180px' }}
                  value={formData.accNo}
                  onChange={handleChange}
                  placeholder="Account Number"
                />
              </div>

              {/* Target */}
              <div className="cust-form-row">
                <span className="dotted-label-blue">Target . . . . . . . . .</span>
                <input
                  type="text"
                  name="target"
                  className="cust-input"
                  style={{ width: '180px' }}
                  value={formData.target}
                  onChange={handleChange}
                  placeholder="Target Amount"
                />
              </div>
            </div>

            {/* ========================================================= */}
            {/* RIGHT COLUMN FIELDS                                       */}
            {/* ========================================================= */}
            <div className="cust-right-col">
              {/* G.T.N. Allowed */}
              <div className="cust-form-row">
                <span className="dotted-label-blue">G.T.N. Allowed . . . . . . .</span>
                <select
                  name="gtnAllowed"
                  className="cust-select"
                  style={{ width: '120px' }}
                  value={formData.gtnAllowed}
                  onChange={handleChange}
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>

              {/* Discount */}
              <div className="cust-form-row">
                <span className="dotted-label-blue">Discount . . . . . . . . . . .</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="number"
                    step="0.01"
                    name="discount"
                    className="cust-input"
                    style={{ width: '110px', textAlign: 'right' }}
                    value={formData.discount}
                    onChange={handleChange}
                  />
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#000080' }}>%</span>
                </div>
              </div>

              {/* Credit Limit */}
              <div className="cust-form-row">
                <span className="dotted-label-blue">Credit Limit . . . . . . . . .</span>
                <input
                  type="number"
                  step="0.01"
                  name="creditLimit"
                  className="cust-input"
                  style={{ width: '110px', textAlign: 'right' }}
                  value={formData.creditLimit}
                  onChange={handleChange}
                />
              </div>

              {/* Due Amount */}
              <div className="cust-form-row">
                <span className="dotted-label-blue">Due Amount . . . . . . . . .</span>
                <input
                  type="number"
                  step="0.01"
                  name="dueAmount"
                  className="cust-input"
                  style={{ width: '110px', textAlign: 'right' }}
                  value={formData.dueAmount}
                  onChange={handleChange}
                />
              </div>

              {/* Credit Period */}
              <div className="cust-form-row">
                <span className="dotted-label-blue">Credit Period . . . . . . . .</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="number"
                    name="creditPeriod"
                    className="cust-input"
                    style={{ width: '110px', textAlign: 'right' }}
                    value={formData.creditPeriod}
                    onChange={handleChange}
                  />
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#000080' }}>Days</span>
                </div>
              </div>

              {/* Use 2nd Price */}
              <div className="cust-form-row">
                <span className="dotted-label-blue">Use 2nd Price . . . . . . . .</span>
                <select
                  name="use2ndPrice"
                  className="cust-select"
                  style={{ width: '120px' }}
                  value={formData.use2ndPrice}
                  onChange={handleChange}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              {/* VAT No */}
              <div className="cust-form-row">
                <span className="dotted-label-blue">VAT No . . . . . . . . . . . .</span>
                <input
                  type="text"
                  name="vatNo"
                  className="cust-input"
                  style={{ width: '210px' }}
                  value={formData.vatNo}
                  onChange={handleChange}
                  placeholder="VAT Number"
                />
              </div>
            </div>
          </div>

          {/* Notes Full Width Row */}
          <div className="cust-notes-row">
            <span className="dotted-label-blue">Notes . . . . . . . . .</span>
            <textarea
              name="notes"
              className="cust-textarea"
              style={{ flex: 1, height: '42px', resize: 'none' }}
              value={formData.notes}
              onChange={handleChange}
              placeholder="Customer Notes / Remarks"
              rows={2}
            />
          </div>

          {/* Action Buttons Bar */}
          <div className="cust-btn-bar">
            <button
              type="button"
              className="cust-btn-classic"
              onClick={handleSave}
              disabled={isSaving}
            >
              <u>S</u>ave
            </button>
            <button type="button" className="cust-btn-classic" onClick={handleNew}>
              <u>N</u>ew
            </button>
            <button
              type="button"
              className="cust-btn-classic delete"
              onClick={handleDelete}
            >
              <u>D</u>elete
            </button>
            <button type="button" className="cust-btn-classic" onClick={handleCancel}>
              <u>C</u>ancel
            </button>
          </div>

          {/* Bottom Section: Customer List Table */}
          <div className="cust-table-section">
            <div className="cust-table-filter-bar">
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#000080' }}>
                Customer Directory ({customersList.length} records)
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: '#444' }}>Search Table:</span>
                <input
                  type="text"
                  className="cust-input"
                  style={{ width: '200px', height: '22px' }}
                  placeholder="Filter by code, name, tel..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="cust-table-viewport">
              <table className="cust-data-table">
                <thead>
                  <tr>
                    <th style={{ width: '35px', textAlign: 'center' }}>#</th>
                    <th style={{ width: '100px' }}>Code</th>
                    <th>Name</th>
                    <th style={{ width: '120px' }}>Telephone No</th>
                    <th style={{ width: '120px' }}>Category</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>Credit Limit</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>Due Amount</th>
                    <th style={{ width: '85px', textAlign: 'right' }}>Discount %</th>
                    <th style={{ width: '110px' }}>Route</th>
                    <th style={{ width: '90px', textAlign: 'center' }}>Use 2nd Price</th>
                    <th style={{ width: '110px' }}>VAT No</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTableCustomers.length === 0 ? (
                    <tr>
                      <td colSpan="11" style={{ textAlign: 'center', padding: '24px', color: '#666', fontStyle: 'italic' }}>
                        {loading ? 'Loading customers...' : 'No customer records found'}
                      </td>
                    </tr>
                  ) : (
                    filteredTableCustomers.map((cust, idx) => {
                      const isSelected = cust._id === formData._id || (cust.code && cust.code === formData.code);
                      return (
                        <tr
                          key={cust._id || cust.code || idx}
                          className={isSelected ? 'selected' : ''}
                          onClick={() => handleSelectCustomer(cust)}
                        >
                          <td style={{ textAlign: 'center', color: isSelected ? '#fff' : '#666' }}>{idx + 1}</td>
                          <td style={{ fontWeight: 'bold', color: isSelected ? '#fff' : '#000080' }}>
                            {cust.code || cust.customerCode}
                          </td>
                          <td style={{ fontWeight: '500' }}>{cust.name}</td>
                          <td>{cust.telephone1 || cust.telephone || '-'}</td>
                          <td>{cust.category || '-'}</td>
                          <td style={{ textAlign: 'right' }}>
                            {Number(cust.creditLimit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: cust.dueAmount > 0 ? 'bold' : 'normal', color: cust.dueAmount > 0 && !isSelected ? '#990000' : 'inherit' }}>
                            {Number(cust.dueAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {Number(cust.discount || 0).toFixed(2)}%
                          </td>
                          <td>{cust.route || '-'}</td>
                          <td style={{ textAlign: 'center' }}>{cust.use2ndPrice || 'No'}</td>
                          <td>{cust.vatNo || '-'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Customer Search Modal */}
      {searchModal.isOpen && (
        <div className="cust-modal-overlay">
          <div className="cust-modal-window">
            <div className="cust-modal-titlebar">
              <span>Customer Search Lookup</span>
              <button
                type="button"
                className="control-btn close"
                style={{ width: '24px', height: '20px' }}
                onClick={() => setSearchModal({ isOpen: false, search: '' })}
              >
                &#x2715;
              </button>
            </div>
            <div className="cust-modal-body">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="dotted-label-blue" style={{ width: 'auto' }}>Search:</span>
                <input
                  type="text"
                  className="cust-input"
                  style={{ flex: 1, padding: '4px 8px' }}
                  placeholder="Type Code, Name, or Telephone Number..."
                  autoFocus
                  value={searchModal.search}
                  onChange={(e) => setSearchModal({ ...searchModal, search: e.target.value })}
                />
              </div>

              <div className="modal-table-viewport">
                <table className="cust-data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '35px', textAlign: 'center' }}>#</th>
                      <th style={{ width: '110px' }}>Code</th>
                      <th>Customer Name</th>
                      <th style={{ width: '130px' }}>Telephone</th>
                      <th style={{ width: '130px' }}>Address</th>
                      <th style={{ width: '70px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalSearchResults.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                          No customers found
                        </td>
                      </tr>
                    ) : (
                      modalSearchResults.map((cust, idx) => (
                        <tr key={cust._id || cust.code} onClick={() => handleSelectCustomer(cust)}>
                          <td style={{ textAlign: 'center', color: '#666' }}>{idx + 1}</td>
                          <td style={{ fontWeight: 'bold', color: '#000080' }}>
                            {cust.code || cust.customerCode}
                          </td>
                          <td>{cust.name}</td>
                          <td>{cust.telephone1 || cust.telephone || '-'}</td>
                          <td>{cust.address || '-'}</td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="cust-btn-classic"
                              style={{ height: '20px', minWidth: '50px', padding: '0 4px', fontSize: '11px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectCustomer(cust);
                              }}
                            >
                              Select
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="cust-modal-footer">
              <button
                type="button"
                className="cust-btn-classic"
                onClick={() => setSearchModal({ isOpen: false, search: '' })}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerMaster;
