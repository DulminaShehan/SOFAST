import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './ItemMaster.css';

// Window Icon (SVG data URI for classic window titlebar)
const windowIcon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23f59e0b' d='M12 2L2 7l10 5 10-5-10-5z'/%3E%3Cpath fill='%232563eb' d='M2 17l10 5V12L2 7v10z'/%3E%3Cpath fill='%231d4ed8' d='M22 17l-10 5V12l10-5v10z'/%3E%3C/svg%3E";

// Visual Basic & Automotive Color Palette Presets
const PRESET_COLORS = [
  { name: 'Black', hex: '#000000' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Silver', hex: '#C0C0C0' },
  { name: 'Gray', hex: '#808080' },
  { name: 'Red', hex: '#DC2626' },
  { name: 'Maroon', hex: '#800000' },
  { name: 'Orange', hex: '#EA580C' },
  { name: 'Gold', hex: '#D4AF37' },
  { name: 'Yellow', hex: '#EAB308' },
  { name: 'Green', hex: '#16A34A' },
  { name: 'Teal', hex: '#0D9488' },
  { name: 'Blue', hex: '#2563EB' },
  { name: 'Navy', hex: '#000080' },
  { name: 'Purple', hex: '#9333EA' },
  { name: 'Pink', hex: '#EC4899' },
  { name: 'Brown', hex: '#8B4513' },
];

/**
 * Calculate Pricing with Round Off & Discount
 */
/**
 * Calculate Pricing with Round Off & Discount (Multiples of Rs. 10)
 */
const computePricing = (spVal, discPctVal, roundOption = 'No Round Off', stepVal = 10) => {
  const sellingPrice = Math.max(0, parseFloat(spVal) || 0);
  const discountPercentage = Math.min(100, Math.max(0, parseFloat(discPctVal) || 0));
  const discountAmount = Math.round(((sellingPrice * discountPercentage) / 100) * 100) / 100;
  const discountedPrice = Math.max(0, Math.round((sellingPrice - discountAmount) * 100) / 100);
  const step = Math.max(1, parseFloat(stepVal) || 10);

  const remainder = Math.round((discountedPrice % step) * 100) / 100;
  const isExactMultiple = remainder === 0 || Math.abs(remainder - step) < 0.001;

  let finalPrice = discountedPrice;
  const opt = (roundOption || 'No Round Off').trim();

  if (isExactMultiple) {
    finalPrice = discountedPrice;
  } else if (opt === 'Round Up' || opt === 'Up') {
    finalPrice = Math.ceil(discountedPrice / step) * step;
  } else if (opt === 'Round Down' || opt === 'Down') {
    finalPrice = Math.floor(discountedPrice / step) * step;
  } else {
    finalPrice = discountedPrice;
  }

  return {
    sellingPrice: spVal,
    discountPercentage: discPctVal,
    discountAmount: Math.round(discountAmount * 100) / 100,
    discountedPrice: Math.round(discountedPrice * 100) / 100,
    roundOffOption: opt,
    roundOffStep: step,
    finalSellingPrice: Math.round(finalPrice * 100) / 100,
  };
};

/**
 * Item Master File Screen (Data Entry for Master File)
 * Recreates the exact 20-field Visual Basic SOFAST POS interface from the reference screenshot
 */
function ItemMaster() {
  const [items, setItems] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [dbStatus, setDbStatus] = useState({ connected: true });

  // Lookup modal state
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
    categorySubCategoryMap: {},
  });

  const [suppliersList, setSuppliersList] = useState([]);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

  // Exact 20 Fields matching Section 2 of prompt
  const [formData, setFormData] = useState({
    code: '',               // 1. Item Code
    image: '',              // 2. Item Image
    description: '',        // 3. Description
    category: '',           // 4. Category
    subCategory: '',        // 5. Sub Category
    location: 'Main Store', // 6. Location
    reorderLevel: '',       // 7. Re-Order Level
    reorderQty: '',         // 8. Re-Order Quantity
    maxStockLevel: '',      // 9. Max Stock Level
    isBulkItem: false,      // 10. Bulk Item
    sellingPrice: '',       // 11. Selling Price
    barcode: '',            // 12. Bar Code (auto-generated)
    lastGrnPrice: '',       // 13. Last GRN Price
    lastGrnDate: '',        // 14. Last GRN Date
    supplierId: '',         // Supplier Reference ID
    supplier: '',           // 15. Supplier
    supplierCode: '',       // 16. Supplier Code
    remark: '',             // 17. Remark
    color: '',              // 18. Color
    roundOffOption: 'No Round Off', // 19. Round Off (Up / Down)
    discountPercentage: '', // 20. Discount (%)
  });

  const [isDirty, setIsDirty] = useState(false);
  const [showColorPalette, setShowColorPalette] = useState(false);

  const codeInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);
  const colorPaletteRef = useRef(null);
  const nativeColorInputRef = useRef(null);
  const navigate = useNavigate();

  // Top Menu Items for standard management layout
  const topMenuItems = [
    { id: 'master-files', label: 'Master Files', hasDropdown: true },
    { id: 'stock-control', label: 'Stock Control System', hasDropdown: true },
    { id: 'sales-service', label: 'Sales and Service', hasDropdown: true },
    { id: 'production', label: 'Production', path: '/management' },
    { id: 'reports', label: 'Reports', path: '/management' },
    { id: 'accounting', label: 'Accounting', path: '/management' },
    { id: 'administration', label: 'Administration', path: '/management' },
  ];

  const masterFilesDropdownItems = [
    { id: 'item-master', label: 'Item Master', path: '/item-master' },
    { id: 'supplier-master', label: 'Supplier Master', path: '/supplier-master' },
    { id: 'customer-details', label: 'Customer Details', path: '/customer-details' },
    { id: 'category-master', label: 'Category Master', path: '/management' },
    { id: 'sub-category-master', label: 'Sub Category Master', path: '/management' },
  ];

  const stockControlDropdownItems = [
    { id: 'good-receive-note', label: 'Good Receive Note (GRN)', path: '/grn' },
    { id: 'damage', label: 'Damage', path: '/damage' },
  ];

  const salesServiceDropdownItems = [
    { id: 'create-invoice', label: 'Create Invoice', path: '/invoice' },
    { id: 'settlement-invoice', label: 'Settlement Invoice', path: '/settlement-invoice' },
    { id: 'remaining-balance', label: 'Remaining Balance', path: '/remaining-balance' },
  ];

  // Fetch items from backend
  const fetchItems = async (search = '') => {
    try {
      setLoading(true);
      const params = {};
      if (search && search.trim()) {
        params.search = search.trim();
      }
      params.limit = 1000;

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

  // Fetch lookup data & suppliers
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

  // Fetch next item code from backend
  const fetchNextCode = async () => {
    try {
      const res = await api.get('/items/next-code');
      if (res.data && res.data.success && res.data.nextCode) {
        setFormData((prev) => ({
          ...prev,
          code: res.data.nextCode,
        }));
      }
    } catch (e) {
      // fallback
    }
  };

  // Fetch next unique barcode from backend (Code 128 format)
  const fetchNextBarcode = async () => {
    try {
      const res = await api.get('/items/next-barcode');
      if (res.data && res.data.success && res.data.nextBarcode) {
        setFormData((prev) => ({
          ...prev,
          barcode: res.data.nextBarcode,
        }));
      }
    } catch (e) {
      // fallback
    }
  };

  useEffect(() => {
    fetchItems();
    fetchLookupData();
    fetchNextCode();
    fetchNextBarcode();
  }, []);

  // Close top menu and color palette on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveDropdown(null);
      }
      if (colorPaletteRef.current && !colorPaletteRef.current.contains(e.target)) {
        setShowColorPalette(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const showNotification = (msg, type = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === msg ? null : curr));
    }, 4500);
  };

  // Form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setIsDirty(true);

    if (name === 'sellingPrice' || name === 'discountPercentage') {
      const sp = name === 'sellingPrice' ? value : formData.sellingPrice;
      const disc = name === 'discountPercentage' ? value : formData.discountPercentage;
      computePricing(sp, disc, formData.roundOffOption);
    }

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // Category change with dependent Sub Category filtering
  const handleCategoryChange = (e) => {
    const cat = e.target.value;
    setIsDirty(true);
    setFormData((prev) => {
      const map = lookupOptions.categorySubCategoryMap || {};
      const subsForCat = map[cat] || [];
      const currentSubValid = subsForCat.includes(prev.subCategory);
      return {
        ...prev,
        category: cat,
        subCategory: currentSubValid ? prev.subCategory : (subsForCat[0] || ''),
      };
    });
  };

  // Supplier dropdown change: automatically populates Supplier Code and Supplier Reference
  const handleSupplierChange = (e) => {
    const selectedSupplierName = e.target.value;
    setIsDirty(true);

    const foundSupp = suppliersList.find((s) => s.name === selectedSupplierName);
    const suppCode = foundSupp ? foundSupp.code : '';
    const suppId = foundSupp ? foundSupp._id : '';

    setFormData((prev) => ({
      ...prev,
      supplier: selectedSupplierName,
      supplierCode: suppCode,
      supplierId: suppId,
    }));
  };

  // Round Off radio button toggle (Up / Down)
  const handleRoundOffChange = (opt) => {
    setIsDirty(true);
    setFormData((prev) => {
      // Toggle off if clicked again
      const newOption = prev.roundOffOption === opt ? 'No Round Off' : opt;
      return {
        ...prev,
        roundOffOption: newOption,
      };
    });
  };

  // Image Selection Handler
  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showNotification('Please select a valid image file (PNG, JPG, WEBP).', 'error');
      return;
    }

    // Limit image size to 2MB to keep database payload clean
    if (file.size > 2 * 1024 * 1024) {
      showNotification('Image size must be less than 2MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      setIsDirty(true);
      setFormData((prev) => ({
        ...prev,
        image: dataUrl,
      }));
      showNotification('Item image loaded successfully.', 'info');
    };
    reader.readAsDataURL(file);
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Button: New
  const handleNew = async () => {
    if (isDirty) {
      const confirmDiscard = window.confirm('Discard unsaved changes?');
      if (!confirmDiscard) return;
    }

    setSelectedId(null);
    setIsDirty(false);
    setFormData({
      code: '',
      image: '',
      description: '',
      category: lookupOptions.categories[0] || '',
      subCategory: '',
      location: 'Main Store',
      reorderLevel: '',
      reorderQty: '',
      maxStockLevel: '',
      isBulkItem: false,
      sellingPrice: '',
      barcode: '',
      lastGrnPrice: '',
      lastGrnDate: '',
      supplierId: '',
      supplier: '',
      supplierCode: '',
      remark: '',
      color: '',
      roundOffOption: 'No Round Off',
      discountPercentage: '',
    });

    await fetchNextCode();
    await fetchNextBarcode();
    if (codeInputRef.current) {
      codeInputRef.current.focus();
    }
  };

  // Button: Save
  const handleSave = async (e) => {
    if (e) e.preventDefault();

    if (!formData.code || !formData.code.trim()) {
      showNotification('Please enter Item Code.', 'error');
      if (codeInputRef.current) codeInputRef.current.focus();
      return;
    }

    if (!formData.description || !formData.description.trim()) {
      showNotification('Please enter Item Description.', 'error');
      return;
    }

    const payload = {
      code: formData.code.trim(),
      image: formData.image || '',
      description: formData.description.trim(),
      category: formData.category ? formData.category.trim() : '',
      subCategory: formData.subCategory ? formData.subCategory.trim() : '',
      location: formData.location ? formData.location.trim() : 'Main Store',
      reorderLevel: formData.reorderLevel !== '' ? Math.max(0, Number(formData.reorderLevel) || 0) : 0,
      reorderQty: formData.reorderQty !== '' ? Math.max(0, Number(formData.reorderQty) || 0) : 0,
      maxStockLevel: formData.maxStockLevel !== '' ? Math.max(0, Number(formData.maxStockLevel) || 0) : 0,
      isBulkItem: Boolean(formData.isBulkItem),
      sellingPrice: formData.sellingPrice !== '' ? Number(formData.sellingPrice) || 0 : 0,
      barcode: formData.barcode ? formData.barcode.trim() : '',
      barCode: formData.barcode ? formData.barcode.trim() : '',
      lastGrnPrice: formData.lastGrnPrice !== '' ? Number(formData.lastGrnPrice) || 0 : 0,
      lastGrnDate: formData.lastGrnDate ? formData.lastGrnDate.trim() : '',
      lastGrn: formData.lastGrnDate ? formData.lastGrnDate.trim() : '',
      supplierId: formData.supplierId || null,
      supplier: formData.supplier ? formData.supplier.trim() : '',
      supplierCode: formData.supplierCode ? formData.supplierCode.trim() : '',
      suppCode: formData.supplierCode ? formData.supplierCode.trim() : '',
      remark: formData.remark ? formData.remark.trim() : '',
      color: formData.color ? formData.color.trim() : '',
      roundOffOption: formData.roundOffOption || 'No Round Off',
      discountPercentage: formData.discountPercentage !== '' ? Number(formData.discountPercentage) || 0 : 0,
    };

    try {
      if (selectedId) {
        const res = await api.put(`/items/${selectedId}`, payload);
        if (res.data && res.data.success) {
          showNotification('Item updated successfully.', 'success');
          setIsDirty(false);
          await fetchItems(searchTerm);
        }
      } else {
        const res = await api.post('/items', payload);
        if (res.data && res.data.success) {
          showNotification('Item saved successfully.', 'success');
          setSelectedId(res.data.data?._id || null);
          setIsDirty(false);
          await fetchItems(searchTerm);
        }
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Error saving item record.';
      showNotification(msg, 'error');
    }
  };

  // Button: Delete (Safe reference-checked deletion)
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
        showNotification(res.data.message || 'Item deleted successfully.', res.data.isDeactivated ? 'info' : 'success');
        handleNew();
        await fetchItems(searchTerm);
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Error deleting item.';
      showNotification(msg, 'error');
    }
  };

  // Button: Link
  const handleLink = () => {
    if (!formData.code) {
      showNotification('Please select or enter an Item Code to link a supplier.', 'error');
      return;
    }
    setIsLinkModalOpen(true);
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
      'Location',
      'Selling Price',
      'Discount %',
      'Round Off',
      'Re-Order Level',
      'Re-Order Qty',
      'Max Stock Level',
      'Bulk Item',
      'Bar Code',
      'Supplier',
      'Supplier Code',
      'Last GRN Price',
      'Last GRN Date',
      'Remark',
      'Color',
      'Status',
    ];

    const rows = items.map((i) => [
      `"${i.code || ''}"`,
      `"${(i.description || '').replace(/"/g, '""')}"`,
      `"${i.category || ''}"`,
      `"${i.subCategory || ''}"`,
      `"${i.location || 'Main Store'}"`,
      i.sellingPrice || 0,
      i.discountPercentage || 0,
      `"${i.roundOffOption || 'No Round Off'}"`,
      i.reorderLevel || 0,
      i.reorderQty || 0,
      i.maxStockLevel || 0,
      i.isBulkItem ? 'Yes' : 'No',
      `"${i.barcode || ''}"`,
      `"${i.supplier || ''}"`,
      `"${i.supplierCode || i.suppCode || ''}"`,
      i.lastGrnPrice || 0,
      `"${i.lastGrnDate || i.lastGrn || ''}"`,
      `"${(i.remark || '').replace(/"/g, '""')}"`,
      `"${i.color || ''}"`,
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

  // Row selection from lower grid
  const handleRowClick = (item) => {
    if (isDirty) {
      const confirmDiscard = window.confirm('Discard unsaved changes and load selected item?');
      if (!confirmDiscard) return;
    }

    setSelectedId(item._id);
    setIsDirty(false);

    // Restore supplier, supplier code, and supplierId from Supplier Register
    let matchedSupp = null;
    if (item.supplierId) {
      matchedSupp = suppliersList.find((s) => String(s._id) === String(item.supplierId));
    }
    if (!matchedSupp && (item.supplierCode || item.suppCode)) {
      const codeToMatch = (item.supplierCode || item.suppCode).trim().toLowerCase();
      matchedSupp = suppliersList.find((s) => s.code?.toLowerCase() === codeToMatch);
    }
    if (!matchedSupp && item.supplier) {
      const nameToMatch = item.supplier.trim().toLowerCase();
      matchedSupp = suppliersList.find((s) => s.name?.toLowerCase() === nameToMatch);
    }

    const suppName = matchedSupp ? matchedSupp.name : (item.supplier || '');
    const suppCode = matchedSupp ? matchedSupp.code : (item.supplierCode || item.suppCode || '');
    const suppId = matchedSupp ? matchedSupp._id : (item.supplierId || '');

    setFormData({
      code: item.code || '',
      image: item.image || '',
      description: item.description || '',
      category: item.category || '',
      subCategory: item.subCategory || '',
      location: item.location || 'Main Store',
      reorderLevel: item.reorderLevel !== undefined ? item.reorderLevel : '',
      reorderQty: item.reorderQty !== undefined ? item.reorderQty : '',
      maxStockLevel: item.maxStockLevel !== undefined ? item.maxStockLevel : '',
      isBulkItem: Boolean(item.isBulkItem),
      sellingPrice: item.sellingPrice !== undefined ? item.sellingPrice : '',
      barcode: item.barcode || item.barCode || '', // preserve existing item barcode
      lastGrnPrice: item.lastGrnPrice !== undefined ? item.lastGrnPrice : '',
      lastGrnDate: item.lastGrnDate || item.lastGrn || '',
      supplierId: suppId,
      supplier: suppName,
      supplierCode: suppCode,
      remark: item.remark || '',
      color: item.color || '',
      roundOffOption: item.roundOffOption || 'No Round Off',
      discountPercentage: item.discountPercentage !== undefined ? item.discountPercentage : '',
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
    setIsDirty(true);
    if (lookupModal.type === 'supplier') {
      const foundSupp = suppliersList.find(
        (s) => s.name === val || `${s.code} - ${s.name}` === val || s.code === val
      );
      setFormData((prev) => ({
        ...prev,
        supplier: foundSupp ? foundSupp.name : val,
        supplierCode: foundSupp ? foundSupp.code : '',
        supplierId: foundSupp ? foundSupp._id : '',
      }));
    } else if (lookupModal.type === 'category') {
      const map = lookupOptions.categorySubCategoryMap || {};
      const subsForCat = map[val] || [];
      setFormData((prev) => ({
        ...prev,
        category: val,
        subCategory: subsForCat[0] || '',
      }));
    } else if (lookupModal.type) {
      setFormData((prev) => ({
        ...prev,
        [lookupModal.type]: val,
      }));
    }
    setLookupModal({ isOpen: false, type: null, title: '', options: [], selectedVal: '' });
  };

  // Sub Categories available based on currently selected Category
  const availableSubCategories = (lookupOptions.categorySubCategoryMap && formData.category && lookupOptions.categorySubCategoryMap[formData.category])
    ? lookupOptions.categorySubCategoryMap[formData.category]
    : (lookupOptions.subCategories || []);

  return (
    <div className="item-master-page-container">
      {/* Hidden file input for Item Image upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageFileChange}
        accept="image/*"
        style={{ display: 'none' }}
      />

      {/* 1. Top Windows/App Blue Title Bar */}
      <header className="management-titlebar">
        <div className="titlebar-brand">
          <svg className="titlebar-car-icon" viewBox="0 0 24 24">
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
          </svg>
          <span className="titlebar-heading">SOFAST MOTORS - Management System [Item Master File]</span>
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

      {/* 2. Top Classic Menu Bar */}
      <nav className="management-menubar-container" ref={menuRef}>
        <ul className="management-menubar">
          {topMenuItems.map((item) => (
            <li key={item.id} className="menubar-item">
              <button
                type="button"
                className={`menubar-button ${activeDropdown === item.id ? 'active' : ''}`}
                onClick={() => {
                  if (item.hasDropdown) {
                    setActiveDropdown(activeDropdown === item.id ? null : item.id);
                  } else if (item.path) {
                    setActiveDropdown(null);
                    navigate(item.path);
                  }
                }}
              >
                {item.label}
              </button>

              {item.id === 'master-files' && activeDropdown === 'master-files' && (
                <ul className="masterfiles-dropdown">
                  {masterFilesDropdownItems.map((masterItem) => (
                    <li key={masterItem.id} className="dropdown-entry">
                      <button
                        type="button"
                        className={`dropdown-item-btn ${masterItem.id === 'item-master' ? 'selected' : ''}`}
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
            </li>
          ))}
        </ul>
      </nav>

      {/* 3. Main Desktop Workspace centering the Data Entry for Master File window */}
      <main className="item-master-workspace">
        <div className="item-master-window">
          {/* Dialog Title Bar */}
          <div className="item-titlebar">
            <div className="titlebar-left">
              <img src={windowIcon} alt="" className="window-icon" />
              <span className="window-title">Data Entry for Master File</span>
            </div>
            <div className="titlebar-right-controls">
              <button
                type="button"
                className="titlebar-close-btn"
                aria-label="Close"
                onClick={() => navigate('/management')}
                title="Close"
              >
                &#x2715;
              </button>
            </div>
          </div>

          {/* Dialog Window Body */}
          <div className="item-window-body">
            {/* Notification Banner */}
            {notification && (
              <div className={`item-notification-banner ${notification.type}`}>
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

            {/* Form Section containing the 20 requested fields matching reference */}
            <form className="item-master-form" onSubmit={handleSave} autoComplete="off">
              {/* Row 1 & 2 Block: Item Code + Description on the Left; Item Image on the Right */}
              {/* Row 1 & 2 Block: Item Code + Description on the Left; Item Image spanning rows 1 & 2 on the Right */}
              <div className="form-top-block">
                {/* Row 1 Left: Item Code */}
                <label className="field-label top-label-code" htmlFor="item-code">
                  Item Code . . . . . .
                </label>
                <input
                  id="item-code"
                  name="code"
                  type="text"
                  className="input-classic input-item-code top-input-code"
                  value={formData.code}
                  onChange={handleInputChange}
                  ref={codeInputRef}
                  autoComplete="off"
                />

                {/* Row 1 Right: Item Image Label */}
                <span className="field-label top-label-image">
                  Item Image . . . .
                </span>

                {/* Row 1 & 2 Right: Item Image Box (Rowspan 2) */}
                <div
                  className="item-image-box top-image-box"
                  onClick={triggerFileInput}
                  title="Click to select or change item image"
                >
                  {formData.image ? (
                    <img src={formData.image} alt="Item Preview" className="item-image-preview" />
                  ) : (
                    <span className="image-empty-placeholder">[ActiveX]</span>
                  )}
                </div>

                {/* Row 1 Right: Item Image Lookup Button */}
                <div className="top-image-btn-col">
                  <button
                    type="button"
                    className="btn-lookup"
                    onClick={triggerFileInput}
                    title="Select Image file from computer"
                  >
                    ...
                  </button>
                  {formData.image && (
                    <button
                      type="button"
                      className="btn-lookup-clear"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsDirty(true);
                        setFormData((prev) => ({ ...prev, image: '' }));
                      }}
                      title="Clear Image"
                    >
                      &times;
                    </button>
                  )}
                </div>

                {/* Row 2 Left: Description Label */}
                <label className="field-label top-label-desc" htmlFor="item-description">
                  Description . . . .
                </label>

                {/* Row 2: Description Input spanning horizontally to the Image Box */}
                <input
                  id="item-description"
                  name="description"
                  type="text"
                  className="input-classic top-input-desc"
                  value={formData.description}
                  onChange={handleInputChange}
                  autoComplete="off"
                />
              </div>

              {/* Row 3: Category | Sub Category */}
              <div className="field-row">
                <label className="field-label" htmlFor="item-category" style={{ width: '120px' }}>
                  Category . . . . . .
                </label>
                <div className="field-control-group" style={{ width: '220px' }}>
                  <select
                    id="item-category"
                    name="category"
                    className="select-classic"
                    value={formData.category}
                    onChange={handleCategoryChange}
                  >
                    <option value="">-- Select Category --</option>
                    {lookupOptions.categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-lookup"
                    onClick={() => openLookup('category', 'Select Category', lookupOptions.categories, formData.category)}
                    title="Category Lookup"
                  >
                    ...
                  </button>
                </div>

                <label className="field-label" htmlFor="item-sub-category" style={{ marginLeft: '36px', width: '120px' }}>
                  Sub Category . . . .
                </label>
                <div className="field-control-group" style={{ width: '220px' }}>
                  <select
                    id="item-sub-category"
                    name="subCategory"
                    className="select-classic"
                    value={formData.subCategory}
                    onChange={handleInputChange}
                  >
                    <option value="">-- Select Sub Category --</option>
                    {availableSubCategories.map((sc) => (
                      <option key={sc} value={sc}>{sc}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-lookup"
                    onClick={() => openLookup('subCategory', 'Select Sub Category', availableSubCategories, formData.subCategory)}
                    title="Sub Category Lookup"
                  >
                    ...
                  </button>
                </div>
              </div>

              {/* Row 4: Location */}
              <div className="field-row">
                <label className="field-label" htmlFor="item-location" style={{ width: '120px' }}>
                  Location . . . . . .
                </label>
                <div className="field-control-group" style={{ width: '220px' }}>
                  <select
                    id="item-location"
                    name="location"
                    className="select-classic"
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
                    title="Location Lookup"
                  >
                    ...
                  </button>
                </div>
              </div>

              {/* Row 5: Re-Order Level | Re-Order Qty | Max Stock Level | Bulk Item */}
              <div className="field-row">
                <label className="field-label" htmlFor="item-reorder-level" style={{ width: '120px' }}>
                  Re-Order Level .
                </label>
                <input
                  id="item-reorder-level"
                  name="reorderLevel"
                  type="number"
                  min="0"
                  className="input-classic input-num-small"
                  value={formData.reorderLevel}
                  onChange={handleInputChange}
                  autoComplete="off"
                />

                <label className="field-label" htmlFor="item-reorder-qty" style={{ marginLeft: '14px', width: '100px' }}>
                  Re-Order Qty . . .
                </label>
                <input
                  id="item-reorder-qty"
                  name="reorderQty"
                  type="number"
                  min="0"
                  className="input-classic input-num-small"
                  value={formData.reorderQty}
                  onChange={handleInputChange}
                  autoComplete="off"
                />

                <label className="field-label" htmlFor="item-max-stock" style={{ marginLeft: '14px', width: '110px' }}>
                  Max Stock Level . .
                </label>
                <input
                  id="item-max-stock"
                  name="maxStockLevel"
                  type="number"
                  min="0"
                  className="input-classic input-num-small"
                  value={formData.maxStockLevel}
                  onChange={handleInputChange}
                  autoComplete="off"
                />

                <label className="checkbox-field" style={{ marginLeft: '24px' }}>
                  <span className="field-label">Bulk Item . . . . .</span>
                  <input
                    type="checkbox"
                    name="isBulkItem"
                    checked={formData.isBulkItem}
                    onChange={handleInputChange}
                  />
                </label>
              </div>

              {/* Row 6: Selling Price | Bar Code | Last GRN Price */}
              <div className="field-row">
                <label className="field-label" htmlFor="item-selling-price" style={{ width: '120px' }}>
                  Selling Price . . . .
                </label>
                <input
                  id="item-selling-price"
                  name="sellingPrice"
                  type="number"
                  step="any"
                  min="0"
                  className="input-classic input-selling-price"
                  value={formData.sellingPrice}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  autoComplete="off"
                />

                <label className="field-label" htmlFor="item-barcode" style={{ marginLeft: '24px', width: '100px' }}>
                  Bar Code . . . . . .
                </label>
                <input
                  id="item-barcode"
                  name="barcode"
                  type="text"
                  className="input-classic input-barcode"
                  value={formData.barcode}
                  onChange={handleInputChange}
                  autoComplete="off"
                />

                <label className="field-label" htmlFor="item-last-grn-price" style={{ marginLeft: '20px', width: '105px' }}>
                  Last GRN Price .
                </label>
                <input
                  id="item-last-grn-price"
                  name="lastGrnPrice"
                  type="number"
                  step="any"
                  className="input-classic input-num-small"
                  value={formData.lastGrnPrice}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  autoComplete="off"
                />
              </div>

              {/* Row 7: Last GRN Date */}
              <div className="field-row">
                <label className="field-label" htmlFor="item-last-grn-date" style={{ width: '120px' }}>
                  Last GRN Date . .
                </label>
                <div className="field-control-group" style={{ width: '170px' }}>
                  <input
                    id="item-last-grn-date"
                    name="lastGrnDate"
                    type="text"
                    className="input-classic"
                    value={formData.lastGrnDate}
                    onChange={handleInputChange}
                    placeholder="YYYY-MM-DD"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="btn-lookup"
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0];
                      setIsDirty(true);
                      setFormData((prev) => ({ ...prev, lastGrnDate: prev.lastGrnDate || today }));
                    }}
                    title="Set to Today / Lookup Date"
                  >
                    ...
                  </button>
                </div>
              </div>

              {/* Row 8: Supplier & Supplier Code */}
              <div className="field-row">
                <label className="field-label" htmlFor="item-supplier" style={{ width: '120px' }}>
                  Supplier . . . . . . .
                </label>
                <div className="field-control-group" style={{ width: '200px' }}>
                  <select
                    id="item-supplier"
                    name="supplier"
                    className="select-classic"
                    value={formData.supplier}
                    onChange={handleSupplierChange}
                  >
                    <option value="">-- Select Supplier --</option>
                    {suppliersList.map((s) => (
                      <option key={s._id} value={s.name}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-lookup"
                    onClick={() =>
                      openLookup(
                        'supplier',
                        'Select Supplier',
                        suppliersList.map((s) => `${s.code} - ${s.name}`),
                        formData.supplier
                      )
                    }
                    title="Select Supplier Lookup"
                  >
                    ...
                  </button>
                </div>

                <label className="field-label" htmlFor="item-supplier-code" style={{ marginLeft: '12px', width: '115px' }}>
                  Supplier Code . . . .
                </label>
                <input
                  id="item-supplier-code"
                  name="supplierCode"
                  type="text"
                  className="input-classic input-readonly"
                  style={{ width: '130px' }}
                  value={formData.supplierCode}
                  readOnly
                  placeholder="Auto-populated"
                  title="Supplier Code is automatically populated from selected Supplier"
                />
              </div>

              {/* Row 9: Remark */}
              <div className="field-row">
                <label className="field-label" htmlFor="item-remark" style={{ width: '120px' }}>
                  Remark . . . . . . .
                </label>
                <input
                  id="item-remark"
                  name="remark"
                  type="text"
                  className="input-classic input-full-width"
                  value={formData.remark}
                  onChange={handleInputChange}
                  autoComplete="off"
                />
              </div>

              {/* Row 10: Color | Round Off (Up / Down) | Discount (%) */}
              <div className="field-row">
                <label className="field-label" htmlFor="item-color" style={{ width: '120px' }}>
                  Color . . . . . . . . .
                </label>
                <div className="field-control-group color-field-group" ref={colorPaletteRef} style={{ width: '170px', position: 'relative' }}>
                  <input
                    id="item-color"
                    name="color"
                    type="text"
                    className="input-classic"
                    style={{ flex: 1, minWidth: 0 }}
                    value={formData.color}
                    onChange={handleInputChange}
                    placeholder="Color"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="btn-color-swatch-trigger"
                    onClick={() => setShowColorPalette((prev) => !prev)}
                    title="Open Color Palette"
                    style={{
                      backgroundColor: formData.color || '#ffffff',
                    }}
                  >
                    <span className="swatch-palette-icon">🎨</span>
                  </button>

                  {/* Hidden native color picker for custom colors */}
                  <input
                    type="color"
                    ref={nativeColorInputRef}
                    style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                    value={
                      /^#([0-9A-F]{3}){1,2}$/i.test(formData.color)
                        ? formData.color
                        : '#000000'
                    }
                    onChange={(e) => {
                      setIsDirty(true);
                      setFormData((prev) => ({ ...prev, color: e.target.value }));
                      setShowColorPalette(false);
                    }}
                  />

                  {/* Popover Color Palette */}
                  {showColorPalette && (
                    <div className="color-palette-popover">
                      <div className="palette-header">
                        <span className="palette-title">Color Palette</span>
                        <button
                          type="button"
                          className="palette-close-btn"
                          onClick={() => setShowColorPalette(false)}
                          title="Close"
                        >
                          &times;
                        </button>
                      </div>
                      <div className="palette-grid">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c.name}
                            type="button"
                            className="palette-color-btn"
                            style={{ backgroundColor: c.hex }}
                            onClick={() => {
                              setIsDirty(true);
                              setFormData((prev) => ({ ...prev, color: c.name }));
                              setShowColorPalette(false);
                            }}
                            title={`${c.name} (${c.hex})`}
                          />
                        ))}
                      </div>
                      <div className="palette-footer">
                        <button
                          type="button"
                          className="btn-classic palette-custom-btn"
                          onClick={() => nativeColorInputRef.current?.click()}
                          title="Choose custom color from system palette"
                        >
                          Custom...
                        </button>
                        <button
                          type="button"
                          className="btn-classic palette-clear-btn"
                          onClick={() => {
                            setIsDirty(true);
                            setFormData((prev) => ({ ...prev, color: '' }));
                            setShowColorPalette(false);
                          }}
                          title="Clear Color"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Round Off Options: Up and Down using classic desktop radio buttons */}
                <div className="round-off-group" style={{ marginLeft: '36px' }}>
                  <span className="field-label" style={{ width: '120px' }}>Round Off . . . . .</span>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="roundOffOption"
                      value="Round Up"
                      checked={formData.roundOffOption === 'Round Up' || formData.roundOffOption === 'Up'}
                      onChange={() => handleRoundOffChange('Round Up')}
                    />
                    <span>Up</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="roundOffOption"
                      value="Round Down"
                      checked={formData.roundOffOption === 'Round Down' || formData.roundOffOption === 'Down'}
                      onChange={() => handleRoundOffChange('Round Down')}
                    />
                    <span>Down</span>
                  </label>
                </div>

                {/* Discount (%) */}
                <label className="field-label" htmlFor="item-discount" style={{ marginLeft: '28px', width: '105px' }}>
                  Discount (%) . . . .
                </label>
                <input
                  id="item-discount"
                  name="discountPercentage"
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  className="input-classic input-num-small"
                  value={formData.discountPercentage}
                  onChange={handleInputChange}
                  placeholder="0"
                  autoComplete="off"
                />
              </div>

              {/* Row 11: Buttons in exact order and style: New, Delete, Save, Link, Excel */}
              <div className="buttons-row">
                <button
                  type="button"
                  className="btn-classic"
                  onClick={handleNew}
                >
                  New
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
                  type="submit"
                  className="btn-classic"
                >
                  Save
                </button>
                <button
                  type="button"
                  className="btn-classic"
                  onClick={handleLink}
                >
                  Link
                </button>
                <button
                  type="button"
                  className="btn-classic"
                  onClick={handleExportExcel}
                >
                  Excel
                </button>
              </div>
            </form>

            {/* Lower Grid: Real saved items table */}
            <div className="item-records-grid-container">
              <div className="item-grid-table-wrapper">
                <table className="item-records-table">
                  <thead>
                    <tr>
                      <th style={{ width: '100px' }}>Item Code</th>
                      <th style={{ width: '220px' }}>Description</th>
                      <th style={{ width: '110px' }}>Category</th>
                      <th style={{ width: '110px' }}>Sub Category</th>
                      <th style={{ width: '95px' }}>Location</th>
                      <th style={{ width: '95px', textAlign: 'right' }}>Selling Price</th>
                      <th style={{ width: '75px', textAlign: 'center' }}>Disc (%)</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>Re-Order</th>
                      <th style={{ width: '130px' }}>Supplier</th>
                      <th style={{ width: '60px', textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="10" className="grid-empty-state">
                          Loading item records...
                        </td>
                      </tr>
                    ) : items.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="grid-empty-state">
                          No item records found in database. Click &quot;New&quot; to add an item.
                        </td>
                      </tr>
                    ) : (
                      items.map((item) => (
                        <tr
                          key={item._id}
                          className={`grid-data-row ${selectedId === item._id ? 'selected' : ''}`}
                          onClick={() => handleRowClick(item)}
                          title={`Select ${item.description}`}
                        >
                          <td className="col-code">{item.code}</td>
                          <td className="col-desc">{item.description}</td>
                          <td>{item.category || '-'}</td>
                          <td>{item.subCategory || '-'}</td>
                          <td>{item.location || 'Main Store'}</td>
                          <td style={{ textAlign: 'right' }}>
                            {item.sellingPrice !== undefined && item.sellingPrice !== null && item.sellingPrice !== ''
                              ? Number(item.sellingPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              : '0.00'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {item.discountPercentage ? `${item.discountPercentage}%` : '-'}
                          </td>
                          <td style={{ textAlign: 'center' }}>{item.reorderLevel || 0}</td>
                          <td>{item.supplier || item.supplierCode || item.suppCode || '-'}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={item.status === 'I' || item.status === 'Inactive' ? 'badge-inactive' : 'badge-active'}>
                              {item.status === 'I' || item.status === 'Inactive' ? 'Inactive' : 'Active'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table search filter bar */}
              <div className="grid-footer-bar">
                <span className="grid-footer-count">Total Items: {items.length}</span>
                <div className="grid-search-control">
                  <span style={{ fontSize: '11px', color: '#002D62', fontWeight: 'bold' }}>Quick Search:</span>
                  <input
                    type="text"
                    className="input-classic input-table-search"
                    placeholder="Filter by code, description, or category..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      fetchItems(e.target.value);
                    }}
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      className="btn-lookup"
                      onClick={() => {
                        setSearchTerm('');
                        fetchItems('');
                      }}
                      title="Clear search"
                    >
                      &times;
                    </button>
                  )}
                </div>
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
          <span className="statusbar-divider">|</span>
          <span>SOFAST MOTORS | Item Master File</span>
        </div>
      </footer>

      {/* 5. Classic Lookup Modal */}
      {lookupModal.isOpen && (
        <div className="item-modal-backdrop" onClick={() => setLookupModal({ isOpen: false, type: null, title: '', options: [], selectedVal: '' })}>
          <div className="item-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="item-modal-header">
              <span>{lookupModal.title}</span>
              <button
                type="button"
                className="item-modal-close"
                onClick={() => setLookupModal({ isOpen: false, type: null, title: '', options: [], selectedVal: '' })}
              >
                &#x2715;
              </button>
            </div>
            <div className="item-modal-body">
              <span style={{ fontSize: '11px', color: '#002D62', fontWeight: 'bold' }}>
                Select an option from the list:
              </span>
              <ul className="lookup-options-list">
                {lookupModal.options.length === 0 ? (
                  <li className="lookup-option-empty">No options available</li>
                ) : (
                  lookupModal.options.map((opt, idx) => (
                    <li
                      key={idx}
                      className={`lookup-option-row ${lookupModal.selectedVal === opt ? 'selected' : ''}`}
                      onClick={() => applyLookup(opt)}
                    >
                      {opt}
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div className="item-modal-footer">
              <button
                type="button"
                className="btn-classic"
                onClick={() => setLookupModal({ isOpen: false, type: null, title: '', options: [], selectedVal: '' })}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Link Supplier Modal */}
      {isLinkModalOpen && (
        <div className="item-modal-backdrop" onClick={() => setIsLinkModalOpen(false)}>
          <div className="item-modal-dialog" style={{ width: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="item-modal-header">
              <span>Link Supplier to Item [{formData.code || 'New Item'}]</span>
              <button
                type="button"
                className="item-modal-close"
                onClick={() => setIsLinkModalOpen(false)}
              >
                &#x2715;
              </button>
            </div>
            <div className="item-modal-body">
              <div className="link-item-summary">
                <div><strong>Item Code:</strong> {formData.code || '(None)'}</div>
                <div><strong>Description:</strong> {formData.description || '(None)'}</div>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#002D62' }}>
                Select Supplier from Database ({suppliersList.length} suppliers):
              </span>
              <ul className="lookup-options-list" style={{ maxHeight: '180px' }}>
                {suppliersList.length === 0 ? (
                  <li className="lookup-option-empty">No suppliers found</li>
                ) : (
                  suppliersList.map((sup) => (
                    <li
                      key={sup._id}
                      className={`lookup-option-row ${formData.supplierCode === sup.code ? 'selected' : ''}`}
                      onClick={() => {
                        setIsDirty(true);
                        setFormData((prev) => ({
                          ...prev,
                          supplier: sup.name,
                          supplierCode: sup.code,
                          supplierId: sup._id,
                        }));
                      }}
                    >
                      <div style={{ fontWeight: 'bold' }}>{sup.code} - {sup.name}</div>
                      <div style={{ fontSize: '10px', color: '#555' }}>
                        {sup.telephone1 || sup.telephone ? `Phone: ${sup.telephone1 || sup.telephone}` : ''}
                      </div>
                    </li>
                  ))
                )}
              </ul>
              {formData.supplierCode && (
                <div style={{ fontSize: '11px', color: '#005bb7', marginTop: '6px', fontWeight: 'bold' }}>
                  ✓ Selected Supplier: {formData.supplier} ({formData.supplierCode})
                </div>
              )}
            </div>
            <div className="item-modal-footer">
              <button
                type="button"
                className="btn-classic"
                onClick={() => {
                  showNotification(`Linked supplier '${formData.supplier}' to item. Click Save to persist.`, 'success');
                  setIsLinkModalOpen(false);
                }}
              >
                Apply Link
              </button>
              <button
                type="button"
                className="btn-classic"
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
