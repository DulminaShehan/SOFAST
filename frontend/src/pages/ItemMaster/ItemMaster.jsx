import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './ItemMaster.css';

// Standard Visual Basic & Automotive Color Palette
const standardColorPalettes = [
  { name: 'Black', hex: '#000000' },
  { name: 'Silver', hex: '#C0C0C0' },
  { name: 'Gray', hex: '#808080' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Red', hex: '#EF4444' },
  { name: 'Maroon', hex: '#800000' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Gold', hex: '#FFD700' },
  { name: 'Yellow', hex: '#EAB308' },
  { name: 'Lime', hex: '#84CC16' },
  { name: 'Green', hex: '#22C55E' },
  { name: 'Teal', hex: '#14B8A6' },
  { name: 'Cyan', hex: '#06B6D4' },
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Navy', hex: '#000080' },
  { name: 'Purple', hex: '#A855F7' },
  { name: 'Pink', hex: '#EC4899' },
  { name: 'Brown', hex: '#8B4513' },
];

const colorNameToHex = (colorName) => {
  if (!colorName) return '#ffffff';
  const name = String(colorName).toLowerCase().trim();
  const map = {
    black: '#000000',
    silver: '#c0c0c0',
    gray: '#808080',
    grey: '#808080',
    white: '#ffffff',
    red: '#ef4444',
    maroon: '#800000',
    yellow: '#eab308',
    gold: '#ffd700',
    green: '#22c55e',
    lime: '#84cc16',
    blue: '#3b82f6',
    navy: '#000080',
    cyan: '#06b6d4',
    teal: '#14b8a6',
    orange: '#f97316',
    purple: '#a855f7',
    pink: '#ec4899',
    brown: '#8b4513',
  };
  return map[name] || (colorName.startsWith('#') ? colorName : '#ffffff');
};

// Calculate Discount Amount, Discounted Price, and Final Selling Price with Round Off
const computePricing = (spVal, discPctVal, discAmtVal, roundOption = 'No Round Off', stepVal = 5, sourceField = 'percentage') => {
  const sellingPrice = parseFloat(spVal) || 0;
  let discountPercentage = parseFloat(discPctVal) || 0;
  let discountAmount = parseFloat(discAmtVal) || 0;

  if (sourceField === 'amount') {
    discountPercentage = sellingPrice > 0 ? (discountAmount / sellingPrice) * 100 : 0;
  } else {
    discountAmount = (sellingPrice * discountPercentage) / 100;
  }

  const discountedPrice = Math.max(0, sellingPrice - discountAmount);
  const step = Math.max(0.01, parseFloat(stepVal) || 5);

  let finalPrice = discountedPrice;
  if (roundOption === 'Round Up') {
    finalPrice = Math.ceil(discountedPrice / step) * step;
  } else if (roundOption === 'Round Down') {
    finalPrice = Math.floor(discountedPrice / step) * step;
  } else {
    finalPrice = discountedPrice;
  }

  return {
    sellingPrice: spVal,
    discountPercentage: discountPercentage ? (sourceField === 'amount' ? Math.round(discountPercentage * 100) / 100 : discPctVal) : (discPctVal !== '' ? discPctVal : ''),
    discountAmount: discountAmount ? (sourceField === 'percentage' || sourceField === 'sellingPrice' ? Math.round(discountAmount * 100) / 100 : discAmtVal) : (discAmtVal !== '' ? discAmtVal : ''),
    discountedPrice: Math.round(discountedPrice * 100) / 100,
    roundOffOption: roundOption,
    roundOffStep: stepVal,
    finalSellingPrice: Math.round(finalPrice * 100) / 100,
  };
};

/**
 * Item Master File Screen
 * Recreates the exact Visual Basic / ERP layout and operations from legacy SOFAST
 */
function ItemMaster() {
  const [items, setItems] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState({ connected: true, name: 'sofast_pos' });

  // Lookup modal states
  const [lookupModal, setLookupModal] = useState({
    isOpen: false,
    type: null,
    title: '',
    options: [],
    selectedVal: '',
  });

  const [lookupOptions, setLookupOptions] = useState({
    categories: [],
    subCategories: [],
    locations: [],
    types: ['Item', 'Service', 'Raw Material', 'Packaging'],
  });

  const [suppliersList, setSuppliersList] = useState([]);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

  // Form State matching all 20+ fields from reference image
  const [formData, setFormData] = useState({
    code: '',
    suppCode: '',
    type: 'Item',
    description: '',
    category: '',
    subCategory: '',
    location: 'Main Store',
    masterPack: '',
    reorderLevel: '',
    reorderQty: '',
    maxStockLevel: '',
    isBulkItem: false,
    stockInHand: '',
    roundOff: '',
    roundOffOption: 'No Round Off',
    roundOffStep: 5,
    discountPercentage: '',
    discountAmount: '',
    discountedPrice: '',
    costChange: false,
    lastGrnPrice: '',
    lastGrn: '',
    sellingPrice: '',
    finalSellingPrice: '',
    averageCost: '',
    remark: '',
    color: '',
    status: 'A',
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

  // Fetch Items from Backend
  const fetchItems = async (search = '') => {
    try {
      setLoading(true);
      const params = { limit: 1000 };
      if (search) params.search = search;

      const res = await api.get('/items', { params });
      if (res.data && res.data.success) {
        setItems(res.data.data || []);
        setTotalItems(res.data.total || res.data.count || 0);
      }
    } catch (error) {
      showNotification('Failed to load items from database', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch lookup options, db health, and suppliers from MongoDB
  const fetchLookupData = async () => {
    try {
      const [optRes, healthRes, suppRes] = await Promise.all([
        api.get('/items/lookup-options').catch(() => null),
        api.get('/health').catch(() => null),
        api.get('/suppliers').catch(() => null),
      ]);

      if (optRes && optRes.data && optRes.data.data) {
        setLookupOptions(optRes.data.data);
      }
      if (healthRes && healthRes.data && healthRes.data.database) {
        setDbStatus(healthRes.data.database);
      }
      if (suppRes && suppRes.data && suppRes.data.data) {
        setSuppliersList(suppRes.data.data);
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchItems();
    fetchLookupData();
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
    const { name, value, type, checked } = e.target;

    if (
      name === 'sellingPrice' ||
      name === 'discountPercentage' ||
      name === 'discountAmount' ||
      name === 'roundOffOption' ||
      name === 'roundOffStep'
    ) {
      setFormData((prev) => {
        const nextVals = {
          ...prev,
          [name]: type === 'checkbox' ? checked : value,
        };

        let sourceField = 'percentage';
        if (name === 'discountAmount') sourceField = 'amount';
        else if (name === 'sellingPrice') sourceField = 'sellingPrice';
        else if (name === 'roundOffOption' || name === 'roundOffStep') sourceField = 'roundOff';

        const computed = computePricing(
          name === 'sellingPrice' ? value : nextVals.sellingPrice,
          name === 'discountPercentage' ? value : nextVals.discountPercentage,
          name === 'discountAmount' ? value : nextVals.discountAmount,
          name === 'roundOffOption' ? value : nextVals.roundOffOption,
          name === 'roundOffStep' ? value : nextVals.roundOffStep,
          sourceField
        );

        return {
          ...nextVals,
          discountPercentage: name === 'discountPercentage' ? value : computed.discountPercentage,
          discountAmount: name === 'discountAmount' ? value : computed.discountAmount,
          discountedPrice: computed.discountedPrice,
          finalSellingPrice: computed.finalSellingPrice,
        };
      });
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // Button: New
  const handleNew = () => {
    setSelectedId(null);
    setFormData({
      code: '',
      suppCode: '',
      type: 'Item',
      description: '',
      category: '',
      subCategory: '',
      location: 'Main Store',
      masterPack: '',
      reorderLevel: '',
      reorderQty: '',
      maxStockLevel: '',
      isBulkItem: false,
      stockInHand: '',
      roundOff: '',
      roundOffOption: 'No Round Off',
      roundOffStep: 5,
      discountPercentage: '',
      discountAmount: '',
      discountedPrice: '',
      costChange: false,
      lastGrnPrice: '',
      lastGrn: '',
      sellingPrice: '',
      finalSellingPrice: '',
      averageCost: '',
      remark: '',
      color: '',
      status: 'A',
    });
    if (codeInputRef.current) {
      codeInputRef.current.focus();
    }
  };

  // Button: Save
  const handleSave = async (e) => {
    if (e) e.preventDefault();

    if (!formData.code.trim()) {
      showNotification('Please enter Item Code.', 'error');
      if (codeInputRef.current) codeInputRef.current.focus();
      return;
    }

    if (!formData.description.trim()) {
      showNotification('Please enter Item Description.', 'error');
      return;
    }

    try {
      if (selectedId) {
        const res = await api.put(`/items/${selectedId}`, formData);
        if (res.data && res.data.success) {
          showNotification('Item updated successfully.', 'success');
          fetchItems(searchTerm);
        }
      } else {
        const res = await api.post('/items', formData);
        if (res.data && res.data.success) {
          showNotification('Item created successfully.', 'success');
          handleNew();
          fetchItems(searchTerm);
        }
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Error saving item record.';
      showNotification(msg, 'error');
    }
  };

  // Button: Delete
  const handleDelete = async () => {
    if (!selectedId) {
      showNotification('Please select an item from the list to delete.', 'error');
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete item '${formData.description}' (${formData.code})?`
    );

    if (!confirmDelete) return;

    try {
      const res = await api.delete(`/items/${selectedId}`);
      if (res.data && res.data.success) {
        showNotification('Item deleted successfully.', 'success');
        handleNew();
        fetchItems(searchTerm);
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Error deleting item.';
      showNotification(msg, 'error');
    }
  };

  // Button: Export to Excel / CSV
  const handleExportExcel = () => {
    if (items.length === 0) {
      showNotification('No items available to export.', 'error');
      return;
    }

    const headers = [
      'Item Code',
      'Description',
      'Category',
      'Sub Category',
      'Type',
      'Location',
      'Selling Price',
      'Discount %',
      'Discount (Rs.)',
      'Round Off',
      'Step',
      'Final Selling Price',
      'Stock Qty',
      'Re-Order Level',
      'Status',
    ];

    const rows = items.map((i) => [
      `"${i.code}"`,
      `"${(i.description || '').replace(/"/g, '""')}"`,
      `"${i.category || ''}"`,
      `"${i.subCategory || ''}"`,
      `"${i.type || 'Item'}"`,
      `"${i.location || 'Main Store'}"`,
      i.sellingPrice || 0,
      i.discountPercentage || 0,
      i.discountAmount || 0,
      `"${i.roundOffOption || 'No Round Off'}"`,
      i.roundOffStep || 5,
      i.finalSellingPrice || i.sellingPrice || 0,
      i.quantity || 0,
      i.reorderLevel || 0,
      `"${i.status || 'A'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SOFAST_Item_Master_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification('Item Master list exported successfully.', 'success');
  };

  // Button: Link
  const handleLink = () => {
    if (!formData.code) {
      showNotification('Please select or enter an item code to link a supplier.', 'error');
      return;
    }
    setIsLinkModalOpen(true);
  };

  // Row selection
  const handleRowClick = (item) => {
    setSelectedId(item._id);
    const sp = item.sellingPrice !== undefined ? item.sellingPrice : '';
    const discPct = item.discountPercentage !== undefined ? item.discountPercentage : '';
    const discAmt = item.discountAmount !== undefined ? item.discountAmount : '';
    const roundOpt = item.roundOffOption || 'No Round Off';
    const step = item.roundOffStep !== undefined && Number(item.roundOffStep) > 0 ? item.roundOffStep : 5;

    let fsp = item.finalSellingPrice !== undefined && Number(item.finalSellingPrice) > 0
      ? item.finalSellingPrice
      : '';
    if (!fsp && sp) {
      const comp = computePricing(sp, discPct, discAmt, roundOpt, step, 'percentage');
      fsp = comp.finalSellingPrice;
    }

    setFormData({
      code: item.code || '',
      suppCode: item.suppCode || '',
      type: item.type || 'Item',
      description: item.description || '',
      category: item.category || '',
      subCategory: item.subCategory || '',
      location: item.location || 'Main Store',
      masterPack: item.masterPack || '',
      reorderLevel: item.reorderLevel !== undefined ? item.reorderLevel : '',
      reorderQty: item.reorderQty !== undefined ? item.reorderQty : '',
      maxStockLevel: item.maxStockLevel !== undefined ? item.maxStockLevel : '',
      isBulkItem: Boolean(item.isBulkItem),
      stockInHand: item.quantity !== undefined ? item.quantity : (item.stockInHand || ''),
      roundOff: item.roundOff !== undefined ? item.roundOff : '',
      roundOffOption: roundOpt,
      roundOffStep: step,
      discountPercentage: discPct,
      discountAmount: discAmt,
      discountedPrice: item.discountedPrice !== undefined ? item.discountedPrice : '',
      costChange: Boolean(item.costChange),
      lastGrnPrice: item.lastGrnPrice !== undefined ? item.lastGrnPrice : '',
      lastGrn: item.lastGrn || '',
      sellingPrice: sp,
      finalSellingPrice: fsp,
      averageCost: item.averageCost !== undefined ? item.averageCost : '',
      remark: item.remark || '',
      color: item.color || '',
      status: item.status || 'A',
    });
  };

  // Open Lookup Modal
  const openLookup = (type, title, options, currentVal) => {
    setLookupModal({
      isOpen: true,
      type,
      title,
      options: options || [],
      selectedVal: currentVal || '',
    });
  };

  // Apply Lookup Selection
  const applyLookup = (val) => {
    if (lookupModal.type) {
      let finalVal = val;
      if (lookupModal.type === 'suppCode' && typeof val === 'string' && val.includes(' - ')) {
        finalVal = val.split(' - ')[0].trim();
      }
      setFormData((prev) => ({
        ...prev,
        [lookupModal.type]: finalVal,
      }));
    }
    setLookupModal({ isOpen: false, type: null, title: '', options: [], selectedVal: '' });
  };

  // Quick Search Handler
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    fetchItems(val);
  };

  return (
    <div className="item-master-container">
      {/* 1. Top Windows/App Blue Title Bar */}
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

      {/* 2. Top Classic Menu Bar (Horizontal Flex) */}
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
                    setIsDropdownOpen(!isDropdownOpen);
                  } else if (item.path) {
                    navigate(item.path);
                  }
                }}
              >
                {item.label}
              </button>

              {/* Master Files Dropdown */}
              {item.hasDropdown && isDropdownOpen && (
                <ul className="masterfiles-dropdown">
                  {masterFilesDropdownItems.map((dropItem) => (
                    <li key={dropItem.id} className="dropdown-entry">
                      <button
                        type="button"
                        className={`dropdown-item-btn ${dropItem.id === 'item-master' ? 'selected' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsDropdownOpen(false);
                          navigate(dropItem.path);
                        }}
                      >
                        <span className="dropdown-item-icon">{dropItem.renderIcon()}</span>
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

      {/* Notification Alert */}
      {notification && (
        <div className={`supplier-alert ${notification.type}`} style={{ margin: '4px 12px 0 12px' }}>
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

      {/* 3. Form Section: Item Master File */}
      <div className="item-form-wrapper">
        <div className="blue-section-header">
          <span>Item Master File</span>
        </div>

        <div className="item-form-panel">
          {/* Row 1: Item code | Type */}
          <div className="form-row">
            <span className="dotted-label" style={{ width: '110px' }}>Item Code . . . . . .</span>
            <input
              ref={codeInputRef}
              type="text"
              name="code"
              className="desktop-input"
              style={{ width: '180px' }}
              value={formData.code}
              onChange={handleInputChange}
            />

            <span className="dotted-label" style={{ marginLeft: '40px', width: '60px' }}>Type . . . .</span>
            <select
              name="type"
              className="desktop-select"
              style={{ width: '140px' }}
              value={formData.type}
              onChange={handleInputChange}
            >
              {lookupOptions.types.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Row 2: Description */}
          <div className="form-row">
            <span className="dotted-label" style={{ width: '110px' }}>Description . . . . .</span>
            <input
              type="text"
              name="description"
              className="desktop-input"
              style={{ flex: 1, maxWidth: '680px' }}
              value={formData.description}
              onChange={handleInputChange}
            />
          </div>

          {/* Row 3: Category | Sub Category | Location */}
          <div className="form-row">
            <span className="dotted-label" style={{ width: '110px' }}>Category . . . . . . .</span>
            <input
              type="text"
              name="category"
              className="desktop-input"
              style={{ width: '150px' }}
              value={formData.category}
              onChange={handleInputChange}
            />
            <button
              type="button"
              className="btn-lookup"
              onClick={() => openLookup('category', 'Select Category', lookupOptions.categories, formData.category)}
            >
              ...
            </button>

            <span className="dotted-label" style={{ marginLeft: '15px', width: '95px' }}>Sub Category . . . .</span>
            <input
              type="text"
              name="subCategory"
              className="desktop-input"
              style={{ width: '150px' }}
              value={formData.subCategory}
              onChange={handleInputChange}
            />
            <button
              type="button"
              className="btn-lookup"
              onClick={() => openLookup('subCategory', 'Select Sub Category', lookupOptions.subCategories, formData.subCategory)}
            >
              ...
            </button>

            <span className="dotted-label" style={{ marginLeft: '15px', width: '70px' }}>Location . . .</span>
            <select
              name="location"
              className="desktop-select"
              style={{ width: '130px' }}
              value={formData.location}
              onChange={handleInputChange}
            >
              {lookupOptions.locations.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
            <button
              type="button"
              className="btn-lookup"
              onClick={() => openLookup('location', 'Select Location', lookupOptions.locations, formData.location)}
            >
              ...
            </button>
          </div>

          {/* Row 4: Re-Order Level | Re-Order Quantity | Max Stock Level | Bulk Item */}
          <div className="form-row">
            <span className="dotted-label" style={{ width: '110px' }}>Re-Order Level . .</span>
            <input
              type="number"
              name="reorderLevel"
              className="desktop-input"
              style={{ width: '90px' }}
              value={formData.reorderLevel}
              onChange={handleInputChange}
            />

            <span className="dotted-label" style={{ marginLeft: '15px', width: '90px' }}>Re-Order Qty . .</span>
            <input
              type="number"
              name="reorderQty"
              className="desktop-input"
              style={{ width: '90px' }}
              value={formData.reorderQty}
              onChange={handleInputChange}
            />

            <span className="dotted-label" style={{ marginLeft: '15px', width: '100px' }}>Max Stock Level . .</span>
            <input
              type="number"
              name="maxStockLevel"
              className="desktop-input"
              style={{ width: '90px' }}
              value={formData.maxStockLevel}
              onChange={handleInputChange}
            />

            <label className="checkbox-field" style={{ marginLeft: '20px' }}>
              <span className="dotted-label">Bulk Item . . . . . . .</span>
              <input
                type="checkbox"
                name="isBulkItem"
                checked={formData.isBulkItem}
                onChange={handleInputChange}
              />
            </label>
          </div>

          {/* Row 5: Selling Price | Supplier */}
          <div className="form-row">
            <span className="dotted-label" style={{ width: '110px' }}>Selling Price . . . .</span>
            <input
              type="number"
              name="sellingPrice"
              className="desktop-input"
              style={{ width: '130px', fontWeight: 'bold', color: '#000080' }}
              value={formData.sellingPrice}
              onChange={handleInputChange}
              placeholder="0.00"
            />

            <span className="dotted-label" style={{ marginLeft: '25px', width: '85px' }}>Supplier . . . . . . .</span>
            <input
              type="text"
              name="suppCode"
              list="supplier-code-datalist"
              className="desktop-input"
              style={{ width: '175px' }}
              value={formData.suppCode}
              onChange={handleInputChange}
              placeholder="Supplier code / name..."
            />
            <button
              type="button"
              className="btn-lookup"
              title="Select Supplier from Database"
              onClick={() =>
                openLookup(
                  'suppCode',
                  'Select Supplier',
                  suppliersList.map((s) => `${s.code} - ${s.name}`),
                  formData.suppCode
                )
              }
            >
              ...
            </button>
            <button
              type="button"
              className="btn-lookup"
              style={{ width: '45px', marginLeft: '2px' }}
              title="Link Supplier to Item"
              onClick={handleLink}
            >
              Link
            </button>
            <datalist id="supplier-code-datalist">
              {suppliersList.map((s) => (
                <option key={s._id} value={s.code}>
                  {s.name}
                </option>
              ))}
            </datalist>
          </div>

          {/* Row 6: Round Off | Step | Discount % | Discount (Rs) | Cost Change */}
          <div className="form-row">
            <span className="dotted-label" style={{ width: '110px' }}>Round Off . . . . . . .</span>
            <select
              name="roundOffOption"
              className="desktop-select"
              style={{ width: '115px' }}
              value={formData.roundOffOption}
              onChange={handleInputChange}
            >
              <option value="No Round Off">No Round Off</option>
              <option value="Round Up">Round Up</option>
              <option value="Round Down">Round Down</option>
            </select>

            <span className="dotted-label" style={{ marginLeft: '10px', width: '40px' }}>Step . .</span>
            <input
              type="number"
              name="roundOffStep"
              className="desktop-input"
              style={{ width: '50px' }}
              min="0.01"
              step="1"
              value={formData.roundOffStep}
              onChange={handleInputChange}
            />

            <span className="dotted-label" style={{ marginLeft: '15px', width: '75px' }}>Discount % . .</span>
            <input
              type="number"
              name="discountPercentage"
              className="desktop-input"
              style={{ width: '75px' }}
              value={formData.discountPercentage}
              onChange={handleInputChange}
              placeholder="0"
            />

            <span className="dotted-label" style={{ marginLeft: '15px', width: '90px' }}>Discount (Rs) . .</span>
            <input
              type="number"
              name="discountAmount"
              className="desktop-input"
              style={{ width: '95px' }}
              value={formData.discountAmount}
              onChange={handleInputChange}
              placeholder="0.00"
            />

            <label className="checkbox-field" style={{ marginLeft: '15px' }}>
              <span className="dotted-label">Cost Change . . .</span>
              <input
                type="checkbox"
                name="costChange"
                checked={formData.costChange}
                onChange={handleInputChange}
              />
            </label>
          </div>

          {/* Row 7: Final Price | Last GRN Price | Last GRN Date */}
          <div className="form-row">
            <span className="dotted-label" style={{ width: '110px', color: '#006600' }}>Final Price . . . . .</span>
            <input
              type="text"
              name="finalSellingPrice"
              className="desktop-input"
              style={{
                width: '130px',
                fontWeight: 'bold',
                color: '#005bb7',
                backgroundColor: '#f0fdf4',
                borderColor: '#86efac',
                textAlign: 'right',
              }}
              readOnly
              value={
                formData.finalSellingPrice !== '' && formData.finalSellingPrice !== undefined && formData.finalSellingPrice !== null
                  ? `Rs. ${Number(formData.finalSellingPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : formData.sellingPrice
                  ? `Rs. ${Number(formData.sellingPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : 'Rs. 0.00'
              }
              title="Final Selling Price after Discount & Round Off"
            />

            <span className="dotted-label" style={{ marginLeft: '25px', width: '105px' }}>Last GRN Price . .</span>
            <input
              type="number"
              name="lastGrnPrice"
              className="desktop-input"
              style={{ width: '110px' }}
              value={formData.lastGrnPrice}
              onChange={handleInputChange}
              placeholder="0.00"
            />

            <span className="dotted-label" style={{ marginLeft: '25px', width: '105px' }}>Last GRN Date . . .</span>
            <input
              type="text"
              name="lastGrn"
              className="desktop-input"
              style={{ width: '160px' }}
              value={formData.lastGrn}
              onChange={handleInputChange}
              placeholder="YYYY-MM-DD / Ref..."
            />
          </div>

          {/* Row 8: Remark */}
          <div className="form-row">
            <span className="dotted-label" style={{ width: '110px' }}>Remark . . . . . . . .</span>
            <input
              type="text"
              name="remark"
              className="desktop-input"
              style={{ flex: 1, maxWidth: '820px' }}
              value={formData.remark}
              onChange={handleInputChange}
            />
          </div>

          {/* Row 9: Color */}
          <div className="form-row">
            <span className="dotted-label" style={{ width: '110px' }}>Color . . . . . . . .</span>
            <input
              type="text"
              name="color"
              className="desktop-input"
              style={{ width: '150px' }}
              placeholder="Color..."
              value={formData.color}
              onChange={handleInputChange}
            />
            <button
              type="button"
              className="btn-lookup"
              style={{ marginLeft: '4px' }}
              title="Open Color Palette"
              onClick={() =>
                openLookup(
                  'color',
                  'Select Color Palette',
                  standardColorPalettes.map((c) => c.name),
                  formData.color
                )
              }
            >
              ...
            </button>
            <div
              className="color-plate-preview"
              title={`Color plate: ${formData.color || 'White / None'}`}
              style={{
                backgroundColor: colorNameToHex(formData.color),
                marginLeft: '4px',
              }}
              onClick={() =>
                openLookup(
                  'color',
                  'Select Color Palette',
                  standardColorPalettes.map((c) => c.name),
                  formData.color
                )
              }
            />
            <input
              type="color"
              style={{ width: '24px', height: '20px', padding: 0, border: 'none', cursor: 'pointer', background: 'transparent', marginLeft: '4px' }}
              title="Pick custom color"
              value={colorNameToHex(formData.color)}
              onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
            />
          </div>

          {/* Action Buttons: New | Delete | Save | Link | Excel */}
          <div className="item-actions-row">
            <button type="button" className="btn-action-classic" onClick={handleNew}>
              New
            </button>
            <button
              type="button"
              className="btn-action-classic"
              onClick={handleDelete}
              disabled={!selectedId}
            >
              Delete
            </button>
            <button type="button" className="btn-action-classic" onClick={handleSave}>
              Save
            </button>
            <button type="button" className="btn-action-classic" onClick={handleLink}>
              Link
            </button>
            <button type="button" className="btn-action-classic" onClick={handleExportExcel}>
              Excel
            </button>
          </div>
        </div>
      </div>

      {/* 4. Section: Item List Table */}
      <div className="item-grid-section">
        <div className="blue-section-header">
          <span>Item List</span>
        </div>

        {/* Quick Search Bar */}
        <div className="item-search-bar">
          <span style={{ fontWeight: '600', color: '#000080' }}>Quick Search:</span>
          <input
            type="text"
            className="desktop-input"
            style={{ width: '280px' }}
            placeholder="Filter by code, description, or category..."
            value={searchTerm}
            onChange={handleSearchChange}
          />
          {searchTerm && (
            <button
              type="button"
              className="btn-lookup"
              style={{ width: '50px' }}
              onClick={() => {
                setSearchTerm('');
                fetchItems('');
              }}
            >
              Clear
            </button>
          )}
          <span style={{ marginLeft: 'auto', color: '#666' }}>
            Showing {items.length} of {totalItems} items
          </span>
        </div>

        <div className="item-table-container">
          <table className="item-table">
            <thead>
              <tr>
                <th style={{ width: '100px' }}>Item Code</th>
                <th style={{ width: '250px' }}>Description</th>
                <th style={{ width: '110px' }}>Category</th>
                <th style={{ width: '110px' }}>Sub Category</th>
                <th style={{ width: '65px' }}>Type</th>
                <th style={{ width: '80px' }}>Location</th>
                <th style={{ width: '85px', textAlign: 'right' }}>Sell Price</th>
                <th style={{ width: '90px', textAlign: 'right' }}>Final Price</th>
                <th style={{ width: '75px', textAlign: 'center' }}>Stock Qty</th>
                <th style={{ width: '75px', textAlign: 'center' }}>Re-Order</th>
                <th style={{ width: '55px', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="11" className="table-empty-message">
                    Loading items from database...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan="11" className="table-empty-message">
                    No items found matching criteria. Click &quot;New&quot; to create a new item.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item._id}
                    className={`item-row ${selectedId === item._id ? 'selected' : ''}`}
                    onClick={() => handleRowClick(item)}
                  >
                    <td style={{ fontWeight: '600' }}>{item.code}</td>
                    <td>{item.description}</td>
                    <td>{item.category || '-'}</td>
                    <td>{item.subCategory || '-'}</td>
                    <td>{item.type || 'Item'}</td>
                    <td>{item.location || 'Main Store'}</td>
                    <td style={{ textAlign: 'right', color: selectedId === item._id ? '#fff' : '#475569' }}>
                      {item.sellingPrice !== undefined && item.sellingPrice !== null && item.sellingPrice !== ''
                        ? Number(item.sellingPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : '0.00'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: selectedId === item._id ? '#fff' : '#000080' }}>
                      {item.finalSellingPrice !== undefined && item.finalSellingPrice !== null && item.finalSellingPrice !== '' && Number(item.finalSellingPrice) > 0
                        ? Number(item.finalSellingPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : (item.sellingPrice ? Number(item.sellingPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00')}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: '600', color: selectedId === item._id ? '#fff' : '#16a34a' }}>
                      {item.quantity !== undefined ? item.quantity : 0}
                    </td>
                    <td style={{ textAlign: 'center' }}>{item.reorderLevel || 0}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={item.status === 'Inactive' ? 'status-badge-inactive' : 'status-badge-active'}>
                        {item.status === 'Inactive' ? 'Inactive' : 'A'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Total Items Footer Bar */}
        <div className="item-table-footer-bar">
          <span>Total Items : {totalItems || items.length}</span>
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
            <span>Database: MongoDB ({dbStatus.connected ? 'Connected' : 'Offline'})</span>
          </div>
        </div>

        <div className="statusbar-right">
          <span>Records: {totalItems}</span>
          <span>|</span>
          <span>SOFAST MOTORS | v1.0.0</span>
        </div>
      </footer>

      {/* 6. Classic Lookup Modal */}
      {lookupModal.isOpen && (
        <div className="lookup-modal-backdrop" onClick={() => setLookupModal({ isOpen: false, type: null, title: '', options: [], selectedVal: '' })}>
          <div className="lookup-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="lookup-modal-header">
              <span>{lookupModal.title}</span>
              <button
                type="button"
                className="control-btn close"
                style={{ width: '18px', height: '18px', fontSize: '11px', background: 'none', color: '#fff', border: 'none' }}
                onClick={() => setLookupModal({ isOpen: false, type: null, title: '', options: [], selectedVal: '' })}
              >
                &#x2715;
              </button>
            </div>
            <div className="lookup-modal-body">
              {lookupModal.type === 'color' ? (
                <>
                  <span style={{ fontSize: '11px', color: '#000080', fontWeight: 'bold' }}>
                    Click a Color Plate Swatch:
                  </span>
                  <div className="color-palette-grid">
                    {standardColorPalettes.map((c, idx) => (
                      <div
                        key={idx}
                        className="color-palette-tile"
                        style={{
                          backgroundColor: c.hex,
                          border: lookupModal.selectedVal === c.name ? '2px solid #005bb7' : '1px solid #716f64',
                        }}
                        title={`${c.name} (${c.hex})`}
                        onClick={() => applyLookup(c.name)}
                      >
                        <span
                          style={{
                            background: 'rgba(255,255,255,0.9)',
                            padding: '1px 3px',
                            borderRadius: '2px',
                            fontWeight: '600',
                            fontSize: '9px',
                            color: '#000000',
                          }}
                        >
                          {c.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '11px', color: '#333' }}>Select an option from the list below:</span>
                  <ul className="lookup-list">
                    {lookupModal.options.length === 0 ? (
                      <li style={{ padding: '8px', color: '#999', fontSize: '11px' }}>No options available</li>
                    ) : (
                      lookupModal.options.map((opt, idx) => (
                        <li
                          key={idx}
                          className={`lookup-item ${lookupModal.selectedVal === opt ? 'selected' : ''}`}
                          onClick={() => applyLookup(opt)}
                        >
                          {opt}
                        </li>
                      ))
                    )}
                  </ul>
                </>
              )}
            </div>
            <div className="lookup-modal-footer">
              <button
                type="button"
                className="btn-action-classic"
                onClick={() => setLookupModal({ isOpen: false, type: null, title: '', options: [], selectedVal: '' })}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Supplier Item Link Modal */}
      {isLinkModalOpen && (
        <div className="lookup-modal-backdrop" onClick={() => setIsLinkModalOpen(false)}>
          <div className="lookup-modal-window" style={{ width: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="lookup-modal-header">
              <span>Link Supplier to Item [{formData.code || 'New Item'}]</span>
              <button
                type="button"
                className="control-btn close"
                style={{ width: '18px', height: '18px', fontSize: '11px', background: 'none', color: '#fff', border: 'none' }}
                onClick={() => setIsLinkModalOpen(false)}
              >
                &#x2715;
              </button>
            </div>
            <div className="lookup-modal-body">
              <div style={{ fontSize: '11px', marginBottom: '6px', padding: '6px', background: '#fff', border: '1px solid #c0c0c0' }}>
                <div><strong>Item Code:</strong> {formData.code || '(Not specified)'}</div>
                <div><strong>Description:</strong> {formData.description || '(No description)'}</div>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#000080' }}>
                Select Supplier to link from MongoDB Database ({suppliersList.length} suppliers):
              </span>
              <ul className="lookup-list" style={{ maxHeight: '180px' }}>
                {suppliersList.length === 0 ? (
                  <li style={{ padding: '8px', color: '#999', fontSize: '11px' }}>No suppliers available</li>
                ) : (
                  suppliersList.map((sup) => (
                    <li
                      key={sup._id}
                      className={`lookup-item ${formData.suppCode === sup.code ? 'selected' : ''}`}
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, suppCode: sup.code }));
                      }}
                      style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '5px 8px' }}
                    >
                      <div style={{ fontWeight: '600' }}>{sup.code} - {sup.name}</div>
                      <div style={{ fontSize: '10px', color: formData.suppCode === sup.code ? '#e0f2fe' : '#666' }}>
                        {sup.address ? `${sup.address} | ` : ''}Phone: {sup.telephone1 || sup.telephone || '-'}
                      </div>
                    </li>
                  ))
                )}
              </ul>
              {formData.suppCode && (
                <div style={{ fontSize: '11px', color: '#005bb7', marginTop: '4px', fontWeight: 'bold' }}>
                  ✓ Selected Supplier Code: {formData.suppCode}
                </div>
              )}
            </div>
            <div className="lookup-modal-footer">
              <button
                type="button"
                className="btn-action-classic"
                onClick={() => {
                  showNotification(`Supplier [${formData.suppCode}] linked to Item [${formData.code}]. Click Save to persist.`, 'success');
                  setIsLinkModalOpen(false);
                }}
              >
                Apply Link
              </button>
              <button
                type="button"
                className="btn-action-classic"
                onClick={() => setIsLinkModalOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ItemMaster;
