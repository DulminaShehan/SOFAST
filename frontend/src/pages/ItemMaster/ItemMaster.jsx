import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ClassicNavbar from '../../components/navigation/ClassicNavbar';
import api from '../../services/api';
import * as XLSX from 'xlsx';
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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [totalPages, setTotalPages] = useState(1);
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

  // Bulk Import States (Excel & CSV)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState('select'); // 'select' | 'preview' | 'processing' | 'results'
  const [importFileName, setImportFileName] = useState('');
  const [importFileSize, setImportFileSize] = useState('');
  const [parsedImportItems, setParsedImportItems] = useState([]);
  const [importPreviewSummary, setImportPreviewSummary] = useState({
    totalRows: 0,
    validNewCount: 0,
    existingCount: 0,
    duplicateInFileCount: 0,
    invalidCount: 0,
  });
  const [importPreviewRows, setImportPreviewRows] = useState([]);
  const [allImportEvaluatedRows, setAllImportEvaluatedRows] = useState([]);
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [importResults, setImportResults] = useState(null);
  const [importFilter, setImportFilter] = useState('all'); // 'all' | 'new' | 'existing' | 'duplicate' | 'invalid'
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const [importSearchTerm, setImportSearchTerm] = useState('');
  const [importProgress, setImportProgress] = useState({
    batch: 0,
    totalBatches: 0,
    percent: 0,
    statusText: '',
  });
  const importFileInputRef = useRef(null);

  // Exact 20 Fields matching Section 2 of prompt + Imported Inventory fields
  const [formData, setFormData] = useState({
    code: '',               // 1. Item Code
    image: '',              // 2. Item Image
    description: '',        // 3. Description
    category: '',           // 4. Category
    subCategory: '',        // 5. Sub Category
    location: 'Main Store', // 6. Location
    rackBin: '',            // Bin / Rack Location (imported from BIN column)
    quantity: 0,            // Closing Stock Quantity
    costPrice: 0,           // Unit Cost / Purchase Cost (imported from COST column)
    value: 0,               // Stock Valuation (imported from VALUE column)
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
    { id: 'approvement', label: 'Approvement', path: '/approvement' },
    { id: 'reports', label: 'Reports', path: '/reports' },
    { id: 'accounting', label: 'Accounting', path: '/management' },
    { id: 'administration', label: 'Administration', path: '/management' },
  ];

  const masterFilesDropdownItems = [
    { id: 'item-master', label: 'Item Master', path: '/item-master' },
    { id: 'supplier-master', label: 'Supplier Master', path: '/supplier-master' },
    { id: 'customer-details', label: 'Customer Details', path: '/customer-details' },
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

  // Fetch items from backend with pagination and search
  const fetchItems = async (search = searchTerm, page = currentPage, limit = pageSize) => {
    try {
      setLoading(true);
      const params = {};
      if (search && search.trim()) {
        params.search = search.trim();
      }
      params.page = page;
      params.limit = limit;

      const res = await api.get('/items', { params });
      if (res.data && res.data.success) {
        setItems(res.data.data || []);
        setTotalItems(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
        setCurrentPage(res.data.page || 1);
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
      rackBin: '',
      quantity: 0,
      costPrice: 0,
      value: 0,
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

  // =========================================================================
  // Bulk Import Helper Handlers (Excel & CSV)
  // =========================================================================

  // Open Bulk Import Modal
  const handleOpenImportModal = () => {
    setImportStep('select');
    setImportFileName('');
    setImportFileSize('');
    setParsedImportItems([]);
    setImportPreviewSummary({
      totalRows: 0,
      validNewCount: 0,
      existingCount: 0,
      duplicateInFileCount: 0,
      invalidCount: 0,
    });
    setImportPreviewRows([]);
    setAllImportEvaluatedRows([]);
    setOverwriteExisting(true);
    setImportResults(null);
    setImportFilter('all');
    setImportSearchTerm('');
    setIsImportModalOpen(true);
  };

  // Close Bulk Import Modal
  const handleCloseImportModal = () => {
    setIsImportModalOpen(false);
    setImportStep('select');
  };

  // Parse raw rows from Spreadsheet or CSV with all 7 columns mapped
  const processRawDataRows = async (rawRows, fileName, fileSizeStr) => {
    if (!rawRows || rawRows.length === 0) {
      showNotification('The uploaded file is empty.', 'error');
      setImportStep('select');
      return;
    }

    // Determine header row and column indices
    let headerRowIdx = -1;
    let codeColIdx = -1;
    let descColIdx = -1;
    let binColIdx = -1;
    let qtyColIdx = -1;
    let valColIdx = -1;
    let selPriceColIdx = -1;
    let costColIdx = -1;

    for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
      const row = rawRows[i];
      if (!row || !Array.isArray(row)) continue;

      row.forEach((cell, colIdx) => {
        const str = String(cell || '').trim();
        if (/^(item[\s_-]*code|code|part[\s_-]*no|part[\s_-]*number|item[\s_-]*no)$/i.test(str)) {
          codeColIdx = colIdx;
          headerRowIdx = i;
        }
        if (/^(description|item[\s_-]*desc|item[\s_-]*description|desc|name|item[\s_-]*name)$/i.test(str)) {
          descColIdx = colIdx;
          headerRowIdx = i;
        }
        if (/^(bin|rack[\s_-]*bin|rack|location|loc)$/i.test(str)) {
          binColIdx = colIdx;
        }
        if (/^(quantity|qty|stock|closing[\s_-]*stock|closing[\s_-]*qty|stock[\s_-]*qty)$/i.test(str)) {
          qtyColIdx = colIdx;
        }
        if (/^(value|stock[\s_-]*value|val|total[\s_-]*value)$/i.test(str)) {
          valColIdx = colIdx;
        }
        if (/^(sel\.[\s_-]*price|selling[\s_-]*price|sel[\s_-]*price|sell[\s_-]*price|price|mrp)$/i.test(str)) {
          selPriceColIdx = colIdx;
        }
        if (/^(cost|item[\s_-]*cost|cost[\s_-]*price|unit[\s_-]*cost|purchase[\s_-]*price|avg[\s_-]*cost)$/i.test(str)) {
          costColIdx = colIdx;
        }
      });

      if (codeColIdx !== -1 && descColIdx !== -1) {
        break;
      }
    }

    // Default column fallback if no explicit headers found
    if (codeColIdx === -1 || descColIdx === -1) {
      headerRowIdx = 0;
      codeColIdx = 0;
      descColIdx = 1;
      binColIdx = 2;
      qtyColIdx = 3;
      valColIdx = 4;
      selPriceColIdx = 5;
      costColIdx = 6;
    }

    const cleanNum = (v) => {
      if (v === '' || v === null || v === undefined) return 0;
      const n = parseFloat(String(v).replace(/[^0-9.-]+/g, ''));
      return isNaN(n) ? 0 : n;
    };

    const parsed = [];
    const startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;
    let currentCategory = 'General';

    for (let i = startRow; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || !Array.isArray(row)) continue;

      const codeVal = row[codeColIdx] !== undefined && row[codeColIdx] !== null ? String(row[codeColIdx]).trim() : '';
      const descVal = descColIdx !== -1 && row[descColIdx] !== undefined && row[descColIdx] !== null ? String(row[descColIdx]).trim() : '';
      const binVal = binColIdx !== -1 && row[binColIdx] !== undefined && row[binColIdx] !== null ? String(row[binColIdx]).trim() : '';
      const qtyRaw = qtyColIdx !== -1 && row[qtyColIdx] !== undefined && row[qtyColIdx] !== null ? row[qtyColIdx] : '';
      const valRaw = valColIdx !== -1 && row[valColIdx] !== undefined && row[valColIdx] !== null ? row[valColIdx] : '';
      const selPriceRaw = selPriceColIdx !== -1 && row[selPriceColIdx] !== undefined && row[selPriceColIdx] !== null ? row[selPriceColIdx] : '';
      const costRaw = costColIdx !== -1 && row[costColIdx] !== undefined && row[costColIdx] !== null ? row[costColIdx] : '';

      // Skip completely blank rows
      if (!codeVal && !descVal && !binVal && qtyRaw === '' && valRaw === '' && selPriceRaw === '' && costRaw === '') {
        continue;
      }

      // Skip subtotal rows (code and description are empty)
      if (!codeVal && !descVal) {
        continue;
      }

      // Category section header detection (e.g., '2W-BODY', '3W-BODY', '2W-ELEC', '3W', etc.)
      if (codeVal && !descVal && !binVal && (qtyRaw === '' || qtyRaw === null) && (valRaw === '' || valRaw === null) && (selPriceRaw === '' || selPriceRaw === null) && (costRaw === '' || costRaw === null)) {
        currentCategory = codeVal;
        continue;
      }

      const quantity = cleanNum(qtyRaw);
      const value = cleanNum(valRaw);
      const sellingPrice = cleanNum(selPriceRaw);
      const cost = cleanNum(costRaw);

      parsed.push({
        row: parsed.length + 1,
        code: codeVal,
        description: descVal,
        bin: binVal,
        quantity,
        value,
        sellingPrice,
        cost,
        category: currentCategory,
      });
    }

    if (parsed.length === 0) {
      showNotification('No data rows found in the uploaded file.', 'error');
      setImportStep('select');
      return;
    }

    setImportFileName(fileName);
    setImportFileSize(fileSizeStr);
    setParsedImportItems(parsed);
    setImportStep('preview');
    setIsProcessingImport(true);

    try {
      const previewRes = await api.post('/items/bulk-import-preview', { items: parsed });
      if (previewRes.data && previewRes.data.success) {
        setImportPreviewSummary(previewRes.data.summary);
        setImportPreviewRows(previewRes.data.previewRows || []);
        setAllImportEvaluatedRows(previewRes.data.allRowsSummary || []);
      } else {
        throw new Error(previewRes.data?.message || 'Failed to inspect database');
      }
    } catch (err) {
      console.error('Preview error:', err);
      showNotification('Error validating items with database: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setIsProcessingImport(false);
    }
  };

  // Parse file selected via file input or drag-and-drop
  const handleFileSelect = async (file) => {
    if (!file) return;
    const name = file.name || 'uploaded_file';
    const sizeKb = (file.size / 1024).toFixed(1) + ' KB';

    try {
      setIsProcessingImport(true);
      let workbook;
      if (name.toLowerCase().endsWith('.csv')) {
        const text = await file.text();
        workbook = XLSX.read(text, { type: 'string', raw: true });
      } else {
        const data = await file.arrayBuffer();
        workbook = XLSX.read(data, { type: 'array', raw: true, cellText: true });
      }
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: '' });
      await processRawDataRows(rawRows, name, sizeKb);
    } catch (err) {
      console.error('Failed to parse file:', err);
      showNotification('Failed to read file: ' + err.message, 'error');
      setIsProcessingImport(false);
    }
  };

  // Quick load pre-extracted closing stock dataset or test sample
  const handleLoadPredefined = async (type) => {
    let url = '/closingstock3 report excel -15.10.2026.csv';
    let label = 'closingstock3 report excel -15.10.2026.csv (5,974 Items)';

    if (type === 'sample_5') {
      url = '/sample_test_items.csv';
      label = 'sample_test_items.csv (5 items)';
    } else if (type === 'xlsx') {
      url = '/closingstock3 report excel -15.10.2026.xlsx';
      label = 'closingstock3 report excel -15.10.2026.xlsx (5,974 Items)';
    }

    try {
      setIsProcessingImport(true);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let workbook;
      let sizeStr = '';
      if (url.endsWith('.csv')) {
        const text = await res.text();
        sizeStr = (new Blob([text]).size / 1024).toFixed(1) + ' KB';
        workbook = XLSX.read(text, { type: 'string', raw: true });
      } else {
        const arrayBuf = await res.arrayBuffer();
        sizeStr = (arrayBuf.byteLength / 1024).toFixed(1) + ' KB';
        workbook = XLSX.read(arrayBuf, { type: 'array', raw: true, cellText: true });
      }
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: '' });
      await processRawDataRows(rawRows, label, sizeStr);
    } catch (err) {
      console.error('Could not load predefined dataset:', err);
      showNotification('Could not load predefined dataset: ' + err.message, 'error');
      setIsProcessingImport(false);
    }
  };

  // Button: Confirm and Execute Bulk Import in safe batches of 500 records
  const handleConfirmImport = async () => {
    if (parsedImportItems.length === 0) {
      showNotification('No items to import.', 'error');
      return;
    }

    const countToImport = importPreviewSummary.validNewCount;
    const confirmMsg =
      `Are you sure you want to import data from '${importFileName}' into Item Master?\n\n` +
      `• Total Valid Items in File: ${parsedImportItems.length}\n` +
      `• Valid New Items to Insert: ${countToImport}\n` +
      (overwriteExisting && importPreviewSummary.existingCount > 0
        ? `• Existing Items to Update: ${importPreviewSummary.existingCount} (Will update stock baseline, location/bin, selling price, cost, and valuation)\n`
        : `• Existing Items: ${importPreviewSummary.existingCount} (Will be safely preserved / skipped)\n`) +
      `\nItems will be processed in safe batches of 500 records with progress tracking. Proceed?`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      setIsProcessingImport(true);
      const BATCH_SIZE = 500;
      const totalBatches = Math.ceil(parsedImportItems.length / BATCH_SIZE);

      const aggregatedResults = {
        success: true,
        summary: {
          totalRows: parsedImportItems.length,
          importedCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          duplicateCount: 0,
          invalidCount: 0,
          errorCount: 0,
        },
        imported: [],
        updated: [],
        skipped: [],
        duplicates: [],
        invalid: [],
        errors: [],
        stockDifferences: [],
      };

      for (let b = 0; b < totalBatches; b++) {
        const start = b * BATCH_SIZE;
        const chunk = parsedImportItems.slice(start, start + BATCH_SIZE);

        setImportProgress({
          batch: b + 1,
          totalBatches,
          percent: Math.round((b / totalBatches) * 100),
          statusText: `Processing batch ${b + 1} of ${totalBatches} (${start + 1} to ${Math.min(start + BATCH_SIZE, parsedImportItems.length)})...`,
        });

        const res = await api.post('/items/bulk-import', {
          items: chunk,
          overwriteExisting,
        });

        if (res.data && res.data.success) {
          const s = res.data.summary || {};
          aggregatedResults.summary.importedCount += s.importedCount || 0;
          aggregatedResults.summary.updatedCount += s.updatedCount || 0;
          aggregatedResults.summary.skippedCount += s.skippedCount || 0;
          aggregatedResults.summary.duplicateCount += s.duplicateCount || 0;
          aggregatedResults.summary.invalidCount += s.invalidCount || 0;
          aggregatedResults.summary.errorCount += s.errorCount || 0;

          if (res.data.imported) aggregatedResults.imported.push(...res.data.imported);
          if (res.data.updated) aggregatedResults.updated.push(...res.data.updated);
          if (res.data.skipped) aggregatedResults.skipped.push(...res.data.skipped);
          if (res.data.duplicates) aggregatedResults.duplicates.push(...res.data.duplicates);
          if (res.data.invalid) aggregatedResults.invalid.push(...res.data.invalid);
          if (res.data.errors) aggregatedResults.errors.push(...res.data.errors);
          if (res.data.stockDifferences) aggregatedResults.stockDifferences.push(...res.data.stockDifferences);
        } else {
          throw new Error(res.data?.message || `Batch ${b + 1} failed.`);
        }
      }

      setImportProgress({
        batch: totalBatches,
        totalBatches,
        percent: 100,
        statusText: 'All batches completed successfully!',
      });

      setImportResults(aggregatedResults);
      setImportStep('results');
      showNotification(
        `Import Completed: ${aggregatedResults.summary.importedCount} new items inserted, ${aggregatedResults.summary.updatedCount} items updated, ${aggregatedResults.summary.skippedCount} skipped.`,
        'success'
      );
      // Refresh Item Master list
      fetchItems('', 1, pageSize);
    } catch (err) {
      console.error('Import execution error:', err);
      showNotification('Import failed: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setIsProcessingImport(false);
    }
  };

  // Download comprehensive audit & stock variance CSV report
  const handleDownloadErrorReport = () => {
    if (!importResults) return;
    const {
      imported = [],
      updated = [],
      skipped = [],
      duplicates = [],
      invalid = [],
      errors = [],
      stockDifferences = [],
    } = importResults;

    const rows = [];

    // 1. Stock differences / variance records
    stockDifferences.forEach((v) => {
      rows.push([
        v.row || '-',
        `"${v.code || ''}"`,
        `"${(v.description || '').replace(/"/g, '""')}"`,
        `"${v.bin || ''}"`,
        `"${v.category || ''}"`,
        v.sourceQty ?? 0,
        v.existingQty ?? 0,
        v.qtyDiff ?? 0,
        v.sellingPrice ?? 0,
        v.cost ?? 0,
        v.value ?? 0,
        'Stock Variance',
        `"Closing stock baseline updated from ${v.existingQty} to ${v.sourceQty}"`,
      ]);
    });

    // 2. Updated records
    updated.forEach((u) => {
      rows.push([
        u.row || '-',
        `"${u.code || ''}"`,
        `"${(u.description || '').replace(/"/g, '""')}"`,
        `"${u.bin || ''}"`,
        `"${u.category || ''}"`,
        u.quantity ?? 0,
        '-',
        '-',
        u.sellingPrice ?? 0,
        u.cost ?? 0,
        u.value ?? 0,
        'Updated Existing',
        '"Fields updated from closing stock report"',
      ]);
    });

    // 3. New imports
    imported.forEach((m) => {
      rows.push([
        m.row || '-',
        `"${m.code || ''}"`,
        `"${(m.description || '').replace(/"/g, '""')}"`,
        `"${m.bin || ''}"`,
        `"${m.category || ''}"`,
        m.quantity ?? 0,
        '-',
        '-',
        m.sellingPrice ?? 0,
        m.cost ?? 0,
        m.value ?? 0,
        'Imported New',
        '"New item inserted into master catalog"',
      ]);
    });

    // 4. Skipped / Duplicates / Errors
    skipped.forEach((s) => {
      rows.push([
        s.row || '-',
        `"${s.code || ''}"`,
        `"${(s.description || '').replace(/"/g, '""')}"`,
        `"${s.bin || ''}"`,
        `"${s.category || ''}"`,
        s.quantity ?? 0,
        '-',
        '-',
        s.sellingPrice ?? 0,
        s.cost ?? 0,
        s.value ?? 0,
        'Skipped',
        `"${(s.reason || 'Existing item skipped').replace(/"/g, '""')}"`,
      ]);
    });

    duplicates.forEach((d) => {
      rows.push([
        d.row || '-',
        `"${d.code || ''}"`,
        `"${(d.description || '').replace(/"/g, '""')}"`,
        `"${d.bin || ''}"`,
        '-',
        '-',
        '-',
        '-',
        '-',
        '-',
        '-',
        'Duplicate in File',
        `"${(d.reason || '').replace(/"/g, '""')}"`,
      ]);
    });

    invalid.forEach((iv) => {
      rows.push([
        iv.row || '-',
        `"${iv.code || ''}"`,
        `"${(iv.description || '').replace(/"/g, '""')}"`,
        '-',
        '-',
        '-',
        '-',
        '-',
        '-',
        '-',
        '-',
        'Invalid',
        `"${(iv.reason || '').replace(/"/g, '""')}"`,
      ]);
    });

    errors.forEach((er) => {
      rows.push([
        er.row || '-',
        `"${er.code || ''}"`,
        `"${(er.description || '').replace(/"/g, '""')}"`,
        '-',
        '-',
        '-',
        '-',
        '-',
        '-',
        '-',
        '-',
        'Error',
        `"${(er.reason || '').replace(/"/g, '""')}"`,
      ]);
    });

    const headers = [
      'Row Number',
      'Item Code',
      'Description',
      'Bin / Rack',
      'Category',
      'Report Closing Qty',
      'Previous DB Qty',
      'Qty Variance',
      'Selling Price',
      'Cost Price',
      'Stock Value',
      'Status',
      'Audit Reason / Detail',
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SOFAST_ClosingStock_Import_Audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
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
      rackBin: item.rackBin || item.bin || '',
      quantity: item.quantity !== undefined ? item.quantity : (item.stockInHand || 0),
      costPrice: item.costPrice !== undefined ? item.costPrice : (item.averageCost || item.lastGrnPrice || 0),
      value: item.value !== undefined ? item.value : (((item.quantity !== undefined ? item.quantity : (item.stockInHand || 0)) * (item.costPrice || item.averageCost || 0))),
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
      <ClassicNavbar activeMenu="master-files" />

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
                <label className="field-label" htmlFor="item-category" style={{ width: '140px' }}>
                  Category . . . . . .
                </label>
                <div className="field-control-group" style={{ width: '280px' }}>
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

                <label className="field-label" htmlFor="item-sub-category" style={{ marginLeft: '36px', width: '140px' }}>
                  Sub Category . . . .
                </label>
                <div className="field-control-group" style={{ width: '280px' }}>
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

              {/* Row 4: Location | Bin / Location | Closing Stock */}
              <div className="field-row">
                <label className="field-label" htmlFor="item-location" style={{ width: '140px' }}>
                  Location . . . . . .
                </label>
                <div className="field-control-group" style={{ width: '280px' }}>
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

                <label className="field-label" htmlFor="item-rack-bin" style={{ marginLeft: '36px', width: '140px' }}>
                  Bin / Location . . .
                </label>
                <input
                  id="item-rack-bin"
                  name="rackBin"
                  type="text"
                  className="input-classic"
                  style={{ width: '130px', fontWeight: 'bold', color: '#1e3a8a' }}
                  value={formData.rackBin || ''}
                  onChange={handleInputChange}
                  placeholder="e.g. R3-Q-1"
                  autoComplete="off"
                />

                <label className="field-label" htmlFor="item-quantity" style={{ marginLeft: '24px', width: '110px' }}>
                  Closing Stock .
                </label>
                <input
                  id="item-quantity"
                  name="quantity"
                  type="number"
                  className="input-classic input-num-small"
                  style={{ width: '90px', fontWeight: 'bold', color: '#002D62', backgroundColor: '#f8fafc' }}
                  value={formData.quantity !== undefined && formData.quantity !== '' ? formData.quantity : 0}
                  readOnly
                  title="Closing Stock Quantity from Closing Stock Report / Inventory"
                />
              </div>

              {/* Row 5: Re-Order Level | Re-Order Qty | Max Stock Level | Bulk Item */}
              <div className="field-row">
                <label className="field-label" htmlFor="item-reorder-level" style={{ width: '140px' }}>
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

                <label className="field-label" htmlFor="item-reorder-qty" style={{ marginLeft: '20px', width: '120px' }}>
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

                <label className="field-label" htmlFor="item-max-stock" style={{ marginLeft: '20px', width: '130px' }}>
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

                <label className="checkbox-field" style={{ marginLeft: '28px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <span className="field-label">Bulk Item . . . . .</span>
                  <input
                    type="checkbox"
                    name="isBulkItem"
                    checked={formData.isBulkItem}
                    onChange={handleInputChange}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#002D62' }}
                  />
                </label>
              </div>

              {/* Row 6: Selling Price | Bar Code | Last GRN Price */}
              <div className="field-row">
                <label className="field-label" htmlFor="item-selling-price" style={{ width: '140px' }}>
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

                <label className="field-label" htmlFor="item-barcode" style={{ marginLeft: '24px', width: '120px' }}>
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

                <label className="field-label" htmlFor="item-last-grn-price" style={{ marginLeft: '24px', width: '130px' }}>
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

              {/* Row 7: Last GRN Date | Item Cost | Stock Value */}
              <div className="field-row">
                <label className="field-label" htmlFor="item-last-grn-date" style={{ width: '140px' }}>
                  Last GRN Date . .
                </label>
                <div className="field-control-group" style={{ width: '280px' }}>
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

                <label className="field-label" htmlFor="item-cost-price" style={{ marginLeft: '36px', width: '140px' }}>
                  Item Cost . . . . . .
                </label>
                <input
                  id="item-cost-price"
                  name="costPrice"
                  type="text"
                  className="input-classic"
                  style={{ width: '130px', backgroundColor: '#f8fafc', color: '#475569' }}
                  value={Number(formData.costPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  readOnly
                  title="Unit Cost Price from Closing Stock Report"
                />

                <label className="field-label" htmlFor="item-stock-value" style={{ marginLeft: '24px', width: '110px' }}>
                  Stock Value . .
                </label>
                <input
                  id="item-stock-value"
                  name="value"
                  type="text"
                  className="input-classic"
                  style={{ width: '110px', backgroundColor: '#f8fafc', fontWeight: 'bold', color: '#047857' }}
                  value={Number(formData.value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  readOnly
                  title="Total Stock Valuation (Closing Stock Qty x Cost)"
                />
              </div>

              {/* Row 8: Supplier */}
              <div className="field-row">
                <label className="field-label" htmlFor="item-supplier" style={{ width: '140px' }}>
                  Supplier . . . . . . .
                </label>
                <div className="field-control-group" style={{ width: '340px' }}>
                  <select
                    id="item-supplier"
                    name="supplier"
                    className="select-classic"
                    style={{ flex: 1, minWidth: 0 }}
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
              </div>

              {/* Row 8b: Supplier Code (placed below Supplier) */}
              <div className="field-row">
                <label className="field-label" htmlFor="item-supplier-code" style={{ width: '140px' }}>
                  Supplier Code . . . .
                </label>
                <input
                  id="item-supplier-code"
                  name="supplierCode"
                  type="text"
                  className="input-classic input-readonly"
                  style={{ width: '220px' }}
                  value={formData.supplierCode}
                  readOnly
                  placeholder="Auto-populated"
                  title="Supplier Code is automatically populated from selected Supplier"
                />
              </div>

              {/* Row 9: Remark */}
              <div className="field-row">
                <label className="field-label" htmlFor="item-remark" style={{ width: '140px' }}>
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
                <label className="field-label" htmlFor="item-color" style={{ width: '140px' }}>
                  Color . . . . . . . . .
                </label>
                <div className="field-control-group color-field-group" ref={colorPaletteRef} style={{ width: '210px', position: 'relative' }}>
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
                  title="Export items to Excel/CSV"
                >
                  Excel
                </button>
                <button
                  type="button"
                  className="btn-classic"
                  onClick={handleOpenImportModal}
                  title="Bulk Import Item Codes & Descriptions from Excel (.xlsx) or CSV"
                >
                  Import Items
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
                      <th style={{ width: '90px' }}>Bin / Rack</th>
                      <th style={{ width: '80px', textAlign: 'right' }}>Stock Qty</th>
                      <th style={{ width: '95px', textAlign: 'right' }}>Selling Price</th>
                      <th style={{ width: '90px', textAlign: 'right' }}>Cost Price</th>
                      <th style={{ width: '95px', textAlign: 'right' }}>Stock Value</th>
                      <th style={{ width: '95px' }}>Category</th>
                      <th style={{ width: '95px' }}>Sub Category</th>
                      <th style={{ width: '90px' }}>Location</th>
                      <th style={{ width: '110px' }}>Supplier</th>
                      <th style={{ width: '65px', textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="12" className="grid-empty-state">
                          Loading item records...
                        </td>
                      </tr>
                    ) : items.length === 0 ? (
                      <tr>
                        <td colSpan="12" className="grid-empty-state">
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
                          <td style={{ fontWeight: '600', color: '#1e3a8a' }}>{item.rackBin || item.bin || '-'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', color: (item.quantity || 0) > 0 ? '#0f172a' : '#94a3b8' }}>
                            {item.quantity !== undefined ? Number(item.quantity).toLocaleString() : '0'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '600' }}>
                            {item.sellingPrice !== undefined && item.sellingPrice !== null && item.sellingPrice !== ''
                              ? Number(item.sellingPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              : '0.00'}
                          </td>
                          <td style={{ textAlign: 'right', color: '#475569' }}>
                            {item.costPrice !== undefined && item.costPrice !== null && item.costPrice !== ''
                              ? Number(item.costPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              : '0.00'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#047857' }}>
                            {item.value !== undefined && item.value !== null && item.value !== ''
                              ? Number(item.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              : '0.00'}
                          </td>
                          <td>{item.category || '-'}</td>
                          <td>{item.subCategory || '-'}</td>
                          <td>{item.location || 'Main Store'}</td>
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

              {/* Table search filter bar with pagination */}
              <div className="grid-footer-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  <span className="grid-footer-count">
                    Total Items: {totalItems.toLocaleString()}
                    {totalItems > 0 && ` | Showing ${((currentPage - 1) * (pageSize === 'all' ? totalItems : pageSize) + 1).toLocaleString()} - ${Math.min(currentPage * (pageSize === 'all' ? totalItems : pageSize), totalItems).toLocaleString()}`}
                  </span>

                  <div className="grid-pagination-controls">
                    <button
                      type="button"
                      className="btn-page-nav"
                      onClick={() => fetchItems(searchTerm, 1, pageSize)}
                      disabled={currentPage <= 1 || loading}
                      title="First Page"
                    >
                      |&lt;
                    </button>
                    <button
                      type="button"
                      className="btn-page-nav"
                      onClick={() => fetchItems(searchTerm, currentPage - 1, pageSize)}
                      disabled={currentPage <= 1 || loading}
                      title="Previous Page"
                    >
                      &lt;
                    </button>
                    <span className="pagination-page-indicator">
                      Page {currentPage} of {totalPages || 1}
                    </span>
                    <button
                      type="button"
                      className="btn-page-nav"
                      onClick={() => fetchItems(searchTerm, currentPage + 1, pageSize)}
                      disabled={currentPage >= totalPages || loading}
                      title="Next Page"
                    >
                      &gt;
                    </button>
                    <button
                      type="button"
                      className="btn-page-nav"
                      onClick={() => fetchItems(searchTerm, totalPages, pageSize)}
                      disabled={currentPage >= totalPages || loading}
                      title="Last Page"
                    >
                      &gt;|
                    </button>

                    <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '4px' }}>Per Page:</span>
                    <select
                      className="select-page-size"
                      value={pageSize}
                      onChange={(e) => {
                        const newSize = e.target.value === 'all' ? 'all' : Number(e.target.value);
                        setPageSize(newSize);
                        fetchItems(searchTerm, 1, newSize);
                      }}
                    >
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={250}>250</option>
                      <option value={500}>500</option>
                      <option value={1000}>1,000</option>
                      <option value="all">All ({totalItems.toLocaleString()})</option>
                    </select>
                  </div>
                </div>

                <div className="grid-search-control">
                  <span style={{ fontSize: '11px', color: '#002D62', fontWeight: 'bold' }}>Quick Search:</span>
                  <input
                    type="text"
                    className="input-classic input-table-search"
                    placeholder="Filter by code, description, bin, or category..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      fetchItems(e.target.value, 1, pageSize);
                    }}
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      className="btn-lookup"
                      onClick={() => {
                        setSearchTerm('');
                        fetchItems('', 1, pageSize);
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

      {/* 7. Bulk Import Items Modal (Excel & CSV) */}
      {isImportModalOpen && (
        <div className="import-modal-overlay" onClick={handleCloseImportModal}>
          <div className="import-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="import-modal-header">
              <span>📥 SOFAST POS — Bulk Import Items (Excel / CSV)</span>
              <button
                type="button"
                className="item-modal-close"
                onClick={handleCloseImportModal}
                title="Close"
              >
                &#x2715;
              </button>
            </div>

            <div className="import-modal-body">
              {/* STEP 1: Select / Upload File */}
              {importStep === 'select' && (
                <>
                  <div
                    className="import-dropzone"
                    onClick={() => importFileInputRef.current && importFileInputRef.current.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleFileSelect(e.dataTransfer.files[0]);
                      }
                    }}
                  >
                    <div className="import-dropzone-icon">📁</div>
                    <div className="import-dropzone-text">Click or Drag &amp; Drop Excel or CSV File Here</div>
                    <div className="import-dropzone-subtext">
                      Supports <strong>.xlsx, .xls, .csv</strong> — Columns: <code>Item Code</code> &amp; <code>Description</code>
                    </div>
                    <input
                      type="file"
                      ref={importFileInputRef}
                      style={{ display: 'none' }}
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileSelect(e.target.files[0]);
                        }
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '6px' }}>
                    <button
                      type="button"
                      className="btn-classic"
                      onClick={() => importFileInputRef.current && importFileInputRef.current.click()}
                    >
                      Browse File...
                    </button>
                  </div>

                  {/* Predefined closing stock or sample options */}
                  <div style={{
                    marginTop: '10px',
                    padding: '10px 12px',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    fontSize: '11px'
                  }}>
                    <div style={{ fontWeight: 'bold', color: '#002D62', marginBottom: '6px' }}>
                      ⚡ Quick Import Original Closing Stock Report:
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn-classic"
                        disabled={isProcessingImport}
                        onClick={() => handleLoadPredefined('closing_stock')}
                        style={{ fontWeight: 'bold', color: '#002D62' }}
                        title="Load original Closing Stock report with 5,974 items and all 7 columns"
                      >
                        📦 Load Original Closing Stock Report (5,974 Items)
                      </button>
                      <button
                        type="button"
                        className="btn-classic"
                        disabled={isProcessingImport}
                        onClick={() => handleLoadPredefined('xlsx')}
                        title="Load Excel (.xlsx) version of Closing Stock report"
                      >
                        📊 Load Excel (.xlsx) Report
                      </button>
                      <button
                        type="button"
                        className="btn-classic"
                        disabled={isProcessingImport}
                        onClick={() => handleLoadPredefined('sample_5')}
                        title="Load 5 items for safe testing"
                      >
                        🧪 Load Test Sample (5 Items)
                      </button>
                    </div>
                    <div style={{ marginTop: '6px', color: '#64748b', fontSize: '10.5px' }}>
                      * The full closing stock report containing all 5,974 valid items, rack bins, closing stock quantities, prices, costs, and categories is ready for immediate one-click import.
                    </div>
                  </div>

                  {/* Rules banner */}
                  <div style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '3px',
                    padding: '8px 10px',
                    fontSize: '11px',
                    color: '#1e3a8a'
                  }}>
                    <strong>🛡️ Safe Import Rules &amp; Inventory Baseline Protection:</strong>
                    <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                      <li><strong>7 Available Columns Mapped:</strong> <code>CODE</code>, <code>DESCRIPTION</code>, <code>BIN</code>, <code>QUANTITY</code>, <code>VALUE</code>, <code>SEL.PRICE</code>, <code>COST</code>.</li>
                      <li><strong>Category Headers Auto-Detected:</strong> Section headers (<code>2W-BODY</code>, <code>3W-BODY</code>, <code>2W-ELEC</code>, etc.) automatically tag all member items.</li>
                      <li><strong>Stock Baseline Migration:</strong> Closing stock quantity establishes the inventory baseline without double-counting.</li>
                      <li><strong>Existing Records Protected:</strong> Suppliers, customer discounts, barcodes, and transaction histories are strictly preserved.</li>
                    </ul>
                  </div>
                </>
              )}

              {/* STEP 2: Preview & Validation */}
              {importStep === 'preview' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', fontWeight: 'bold' }}>
                    <span>
                      📄 File: <span style={{ color: '#005bb7' }}>{importFileName}</span> ({importFileSize})
                    </span>
                    <button
                      type="button"
                      className="btn-classic"
                      onClick={() => setImportStep('select')}
                      disabled={isProcessingImport}
                    >
                      Choose Different File
                    </button>
                  </div>

                  {/* 5 KPI Metric Badges */}
                  <div className="import-kpi-strip">
                    <div className="import-kpi-badge kpi-total">
                      <span className="kpi-num">{importPreviewSummary.totalRows}</span>
                      <span className="kpi-lbl">Total Items</span>
                    </div>
                    <div className="import-kpi-badge kpi-new">
                      <span className="kpi-num">{importPreviewSummary.validNewCount}</span>
                      <span className="kpi-lbl">Valid New Items</span>
                    </div>
                    <div className="import-kpi-badge kpi-exist">
                      <span className="kpi-num">{importPreviewSummary.existingCount}</span>
                      <span className="kpi-lbl">Already in DB</span>
                    </div>
                    <div className="import-kpi-badge kpi-dup">
                      <span className="kpi-num">{importPreviewSummary.duplicateInFileCount}</span>
                      <span className="kpi-lbl">Duplicates in File</span>
                    </div>
                    <div className="import-kpi-badge kpi-invalid">
                      <span className="kpi-num">{importPreviewSummary.invalidCount}</span>
                      <span className="kpi-lbl">Invalid Rows</span>
                    </div>
                  </div>

                  {/* Live Progress Bar when importing */}
                  {isProcessingImport && importProgress.totalBatches > 0 && (
                    <div className="import-progress-box">
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', color: '#002D62' }}>
                        <span>⏳ {importProgress.statusText}</span>
                        <span>{importProgress.percent}%</span>
                      </div>
                      <div className="import-progress-bar-bg">
                        <div
                          className="import-progress-bar-fill"
                          style={{ width: `${importProgress.percent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Overwrite option and filter search */}
                  <div className="import-options-bar">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: '600' }}>
                      <input
                        type="checkbox"
                        checked={overwriteExisting}
                        onChange={(e) => setOverwriteExisting(e.target.checked)}
                      />
                      <span>Update existing items with Closing Stock Qty, Bin, Selling Price, Cost, and Value (Baseline Migration)</span>
                    </label>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Filter:</span>
                      <select
                        className="input-classic"
                        style={{ padding: '2px 6px', fontSize: '11px' }}
                        value={importFilter}
                        onChange={(e) => setImportFilter(e.target.value)}
                      >
                        <option value="all">All Rows ({importPreviewSummary.totalRows})</option>
                        <option value="new">New Items Only ({importPreviewSummary.validNewCount})</option>
                        <option value="existing">Already in DB ({importPreviewSummary.existingCount})</option>
                        <option value="duplicate">Duplicates in File ({importPreviewSummary.duplicateInFileCount})</option>
                        <option value="invalid">Invalid Rows ({importPreviewSummary.invalidCount})</option>
                      </select>

                      <input
                        type="text"
                        className="input-classic"
                        placeholder="Search preview..."
                        style={{ width: '130px', padding: '2px 6px', fontSize: '11px' }}
                        value={importSearchTerm}
                        onChange={(e) => setImportSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Preview Table with 7 mapped columns */}
                  <div className="import-preview-wrapper">
                    <table className="import-preview-table">
                      <thead>
                        <tr>
                          <th style={{ width: '35px', textAlign: 'center' }}>#</th>
                          <th style={{ width: '105px' }}>Item Code</th>
                          <th style={{ minWidth: '180px' }}>Description</th>
                          <th style={{ width: '85px' }}>Bin / Rack</th>
                          <th style={{ width: '75px', textAlign: 'right' }}>Closing Qty</th>
                          <th style={{ width: '85px', textAlign: 'right' }}>Sel. Price</th>
                          <th style={{ width: '85px', textAlign: 'right' }}>Cost</th>
                          <th style={{ width: '90px', textAlign: 'right' }}>Stock Value</th>
                          <th style={{ width: '85px' }}>Category</th>
                          <th style={{ width: '105px', textAlign: 'center' }}>Status</th>
                          <th style={{ width: '220px' }}>Validation Note / Stock Variance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const evaluatedList = allImportEvaluatedRows.length > 0 ? allImportEvaluatedRows : importPreviewRows;
                          const filtered = evaluatedList.filter((r) => {
                            if (importFilter === 'new' && r.status !== 'new') return false;
                            if (importFilter === 'existing' && r.status !== 'existing') return false;
                            if (importFilter === 'duplicate' && r.status !== 'duplicate') return false;
                            if (importFilter === 'invalid' && r.status !== 'invalid') return false;
                            if (importSearchTerm) {
                              const t = importSearchTerm.toLowerCase();
                              return (
                                String(r.code || '').toLowerCase().includes(t) ||
                                String(r.description || '').toLowerCase().includes(t) ||
                                String(r.bin || '').toLowerCase().includes(t) ||
                                String(r.category || '').toLowerCase().includes(t)
                              );
                            }
                            return true;
                          });

                          if (filtered.length === 0) {
                            return (
                              <tr>
                                <td colSpan="11" style={{ textAlign: 'center', padding: '16px', color: '#64748b' }}>
                                  No rows matching selected filter.
                                </td>
                              </tr>
                            );
                          }

                          return filtered.slice(0, 300).map((r, idx) => {
                            let tagClass = 'tag-new';
                            let tagLabel = 'NEW';
                            if (r.status === 'existing') {
                              tagClass = 'tag-exist';
                              tagLabel = overwriteExisting ? 'WILL UPDATE' : 'SKIP (EXISTS)';
                            } else if (r.status === 'duplicate') {
                              tagClass = 'tag-dup';
                              tagLabel = 'DUPLICATE';
                            } else if (r.status === 'invalid') {
                              tagClass = 'tag-invalid';
                              tagLabel = 'INVALID';
                            }

                            return (
                              <tr key={idx}>
                                <td style={{ textAlign: 'center', color: '#64748b' }}>{r.row}</td>
                                <td style={{ fontFamily: 'Consolas, monospace', fontWeight: 'bold' }}>{r.code || '(empty)'}</td>
                                <td>{r.description || '(empty)'}</td>
                                <td style={{ fontWeight: '600', color: '#1e3a8a' }}>{r.bin || '-'}</td>
                                <td style={{ textAlign: 'right', fontWeight: 'bold', color: (r.quantity || 0) > 0 ? '#0f172a' : '#94a3b8' }}>
                                  {r.quantity !== undefined ? r.quantity : 0}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  {r.sellingPrice !== undefined ? Number(r.sellingPrice).toFixed(2) : '0.00'}
                                </td>
                                <td style={{ textAlign: 'right', color: '#475569' }}>
                                  {r.cost !== undefined ? Number(r.cost).toFixed(2) : '0.00'}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#047857' }}>
                                  {r.value !== undefined ? Number(r.value).toFixed(2) : '0.00'}
                                </td>
                                <td style={{ color: '#0369a1' }}>{r.category || 'General'}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <span className={`import-status-tag ${tagClass}`}>{tagLabel}</span>
                                </td>
                                <td style={{ fontSize: '10.5px', color: '#475569' }}>
                                  {r.reason || (r.status === 'new' ? 'Ready to insert' : '')}
                                  {r.existingQty !== undefined && r.status === 'existing' && (
                                    <div style={{ fontSize: '10px', color: r.qtyDiff !== 0 ? '#d97706' : '#16a34a', fontWeight: '600' }}>
                                      DB Stock: {r.existingQty} → Report: {r.quantity} {r.qtyDiff !== 0 ? `(Variance: ${r.qtyDiff > 0 ? '+' : ''}${r.qtyDiff})` : '(Balanced)'}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {(() => {
                    const evaluatedList = allImportEvaluatedRows.length > 0 ? allImportEvaluatedRows : importPreviewRows;
                    if (evaluatedList.length > 300) {
                      return (
                        <div style={{ fontSize: '10.5px', color: '#64748b', textAlign: 'right' }}>
                          * Displaying first 300 rows for preview speed ({evaluatedList.length} total valid records will be imported in batches of 500)
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Safety note */}
                  <div style={{
                    fontSize: '11px',
                    color: '#065f46',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    padding: '6px 10px',
                    borderRadius: '3px'
                  }}>
                    ✓ <strong>Safe Inventory Import:</strong>
                    {overwriteExisting
                      ? ` ${importPreviewSummary.validNewCount} new items will be inserted and ${importPreviewSummary.existingCount} existing records will have Closing Stock, Bin, Selling Price, Cost, and Value safely updated.`
                      : ` Only ${importPreviewSummary.validNewCount} new items will be created. ${importPreviewSummary.existingCount} existing records will NOT be modified.`}
                  </div>
                </>
              )}

              {/* STEP 3: Results */}
              {importStep === 'results' && importResults && (
                <>
                  <div style={{
                    padding: '12px',
                    background: '#f0fdf4',
                    border: '1px solid #86efac',
                    borderRadius: '4px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '24px', marginBottom: '4px' }}>✅</div>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: '#166534' }}>
                      Closing Stock Report Bulk Import Completed
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#374151', marginTop: '2px' }}>
                      Processed {importResults.summary.totalRows} records from <strong>{importFileName}</strong> in safe batches of 500
                    </div>
                  </div>

                  {/* Result KPI cards */}
                  <div className="import-kpi-strip">
                    <div className="import-kpi-badge kpi-new">
                      <span className="kpi-num">{importResults.summary.importedCount}</span>
                      <span className="kpi-lbl">Successfully Imported</span>
                    </div>
                    {importResults.summary.updatedCount > 0 && (
                      <div className="import-kpi-badge kpi-exist">
                        <span className="kpi-num">{importResults.summary.updatedCount}</span>
                        <span className="kpi-lbl">Updated Baseline</span>
                      </div>
                    )}
                    <div className="import-kpi-badge kpi-exist">
                      <span className="kpi-num">{importResults.summary.skippedCount}</span>
                      <span className="kpi-lbl">Skipped (Existed)</span>
                    </div>
                    {importResults.stockDifferences && importResults.stockDifferences.length > 0 && (
                      <div className="import-kpi-badge kpi-dup">
                        <span className="kpi-num">{importResults.stockDifferences.length}</span>
                        <span className="kpi-lbl">Stock Variances</span>
                      </div>
                    )}
                    <div className="import-kpi-badge kpi-dup">
                      <span className="kpi-num">{importResults.summary.duplicateCount}</span>
                      <span className="kpi-lbl">In-File Duplicates</span>
                    </div>
                    <div className="import-kpi-badge kpi-invalid">
                      <span className="kpi-num">{importResults.summary.invalidCount + importResults.summary.errorCount}</span>
                      <span className="kpi-lbl">Invalid / Errors</span>
                    </div>
                  </div>

                  {/* Download Audit & Stock Variance Report */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '3px',
                    fontSize: '11.5px'
                  }}>
                    <div>
                      <strong>Audit Log &amp; Inventory Variance Report:</strong>
                      <div style={{ color: '#64748b', fontSize: '10.5px' }}>
                        {importResults.stockDifferences && importResults.stockDifferences.length > 0
                          ? `Recorded ${importResults.stockDifferences.length} stock quantity variances between report and system baseline.`
                          : 'All items imported cleanly into database master catalog.'}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-classic"
                      onClick={handleDownloadErrorReport}
                      style={{ fontWeight: 'bold', color: '#002D62' }}
                      title="Download complete CSV audit log of all imported items, updated records, and stock variances"
                    >
                      📥 Download Audit &amp; Variance Report (CSV)
                    </button>
                  </div>

                  {/* Stock Differences Table if any */}
                  {importResults.stockDifferences && importResults.stockDifferences.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#9a3412', marginBottom: '4px' }}>
                        ⚠️ Stock Differences Recorded ({importResults.stockDifferences.length} items):
                      </div>
                      <div className="import-preview-wrapper" style={{ maxHeight: '180px' }}>
                        <table className="import-preview-table">
                          <thead>
                            <tr>
                              <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                              <th style={{ width: '100px' }}>Item Code</th>
                              <th>Description</th>
                              <th style={{ width: '75px' }}>Bin</th>
                              <th style={{ width: '80px', textAlign: 'right' }}>Previous DB Qty</th>
                              <th style={{ width: '80px', textAlign: 'right' }}>Report Qty</th>
                              <th style={{ width: '80px', textAlign: 'right' }}>Difference</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importResults.stockDifferences.slice(0, 100).map((v, idx) => (
                              <tr key={idx}>
                                <td style={{ textAlign: 'center', color: '#64748b' }}>{v.row || idx + 1}</td>
                                <td style={{ fontFamily: 'Consolas, monospace', fontWeight: 'bold' }}>{v.code}</td>
                                <td>{v.description}</td>
                                <td style={{ fontWeight: '600' }}>{v.bin || '-'}</td>
                                <td style={{ textAlign: 'right', color: '#64748b' }}>{v.existingQty}</td>
                                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{v.sourceQty}</td>
                                <td style={{ textAlign: 'right', fontWeight: 'bold', color: v.qtyDiff > 0 ? '#16a34a' : '#dc2626' }}>
                                  {v.qtyDiff > 0 ? `+${v.qtyDiff}` : v.qtyDiff}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div className="import-modal-footer">
              {importStep === 'select' && (
                <>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    Select Closing Stock Excel (.xlsx, .xls) or CSV with CODE, DESCRIPTION, BIN, QUANTITY, VALUE, SEL.PRICE, COST
                  </div>
                  <button
                    type="button"
                    className="btn-classic"
                    onClick={handleCloseImportModal}
                  >
                    Cancel
                  </button>
                </>
              )}

              {importStep === 'preview' && (
                <>
                  <button
                    type="button"
                    className="btn-classic"
                    onClick={() => setImportStep('select')}
                    disabled={isProcessingImport}
                  >
                    ← Back
                  </button>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn-classic"
                      onClick={handleCloseImportModal}
                      disabled={isProcessingImport}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn-classic"
                      style={{
                        fontWeight: 'bold',
                        backgroundColor: importPreviewSummary.validNewCount > 0 || (overwriteExisting && importPreviewSummary.existingCount > 0) ? '#005bb7' : '#e2e8f0',
                        color: importPreviewSummary.validNewCount > 0 || (overwriteExisting && importPreviewSummary.existingCount > 0) ? '#ffffff' : '#94a3b8',
                      }}
                      disabled={isProcessingImport || (importPreviewSummary.validNewCount === 0 && (!overwriteExisting || importPreviewSummary.existingCount === 0))}
                      onClick={handleConfirmImport}
                    >
                      {isProcessingImport
                        ? '⏳ Importing in Batches...'
                        : `Confirm & Import (${importPreviewSummary.validNewCount} New, ${overwriteExisting ? importPreviewSummary.existingCount : 0} Updates)`}
                    </button>
                  </div>
                </>
              )}

              {importStep === 'results' && (
                <>
                  <div style={{ fontSize: '11px', color: '#166534', fontWeight: 'bold' }}>
                    ✓ Database successfully updated with Closing Stock baseline.
                  </div>
                  <button
                    type="button"
                    className="btn-classic"
                    onClick={handleCloseImportModal}
                  >
                    Done / Close
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ItemMaster;
