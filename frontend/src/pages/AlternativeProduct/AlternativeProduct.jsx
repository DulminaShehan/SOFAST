import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ClassicNavbar from '../../components/navigation/ClassicNavbar';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import './AlternativeProduct.css';

/**
 * Alternative Product Master
 * Connects EXISTING Item Master products that are similar, compatible, or replacements.
 * Recreates the exact Classic ERP / Visual Basic 6 desktop UI from the reference image.
 */
function AlternativeProduct() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  // Navigation Menubar state
  const [activeDropdown, setActiveDropdown] = useState('master-files');
  const menuRef = useRef(null);

  // Notification Banner
  const [notification, setNotification] = useState(null);

  // Loading States
  const [loadingItems, setLoadingItems] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Available Items List from Item Master
  const [itemsList, setItemsList] = useState([]);

  // Saved Alternative Product Relationships from MongoDB
  const [savedRelationships, setSavedRelationships] = useState([]);

  // Main Item Form State
  const [formData, setFormData] = useState({
    itemCode: '',
    description: '',
    status: 'Active',
    stock: 0,
  });

  // Alternative Products currently linked to the selected Main Item
  const [alternativeItems, setAlternativeItems] = useState([]);

  // Lower Section Table Search / Filter
  const [recordsFilter, setRecordsFilter] = useState('');

  // Main Item Search Modal State
  const [mainItemModal, setMainItemModal] = useState({
    isOpen: false,
    search: '',
    autoOpenAltAfterSelect: false,
  });

  // Add Alternative Item Search Modal State
  const [addAltModal, setAddAltModal] = useState({
    isOpen: false,
    search: '',
  });

  // Quick Add Alternative Product Input State
  const [quickAltCode, setQuickAltCode] = useState('');

  // Fallback live server search results for Modals
  const [mainServerResults, setMainServerResults] = useState([]);
  const [isSearchingServerMain, setIsSearchingServerMain] = useState(false);
  const [altServerResults, setAltServerResults] = useState([]);
  const [isSearchingServerAlt, setIsSearchingServerAlt] = useState(false);

  // Top Navigation Menus
  const topMenuItems = [
    { id: 'master-files', label: 'Master Files', hasDropdown: true },
    { id: 'stock-control', label: 'Stock Control System', hasDropdown: true },
    { id: 'sales-service', label: 'Sales and Service', hasDropdown: true },
    { id: 'approvement', label: 'Approvement', hasDropdown: true },
    { id: 'reports', label: 'Reports', path: '/reports' },
    { id: 'accounting', label: 'Accounting', path: '/management' },
    { id: 'administration', label: 'Administration', hasDropdown: true },
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

  const approvementDropdownItems = [
    { id: 'payment-voucher', label: 'Payment Voucher', path: '/payment-voucher' },
    { id: 'petty-cash', label: 'Petty Cash', path: '/petty-cash' },
    { id: 'leave-request', label: 'Leave Request', path: '/leave-request' },
  ];

  const administrationDropdownItems = [
    { id: 'printer-setup', label: 'Printer Setup', path: '/printer-setup' },
    ...(isAdmin ? [{ id: 'new-user', label: 'New User', path: '/new-user' }] : []),
  ];

  const showNotification = (msg, type = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // 1. Fetch Item Master Items (All items from database)
  const fetchItems = async () => {
    try {
      setLoadingItems(true);
      const res = await api.get('/items?limit=all');
      if (res.data?.data) {
        setItemsList(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch items:', err);
    } finally {
      setLoadingItems(false);
    }
  };

  // 2. Fetch All Saved Alternative Relationships
  const fetchRelationships = async () => {
    try {
      const res = await api.get('/alternative-products?limit=all');
      if (res.data?.data) {
        setSavedRelationships(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch alternative products:', err);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchRelationships();
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

  // Handle Main Item Code Input (as user types)
  const handleItemCodeInputChange = (e) => {
    const val = e.target.value;
    setFormData((prev) => ({ ...prev, itemCode: val }));

    const trimmed = val.trim().toUpperCase();
    if (!trimmed) {
      setFormData((prev) => ({ ...prev, description: '', stock: 0 }));
      setAlternativeItems([]);
      return;
    }

    // Only auto-fill description if the entered code is an EXACT match
    const matchedItem = itemsList.find(
      (item) =>
        item.code?.toUpperCase() === trimmed ||
        (item.barcode && String(item.barcode).toUpperCase() === trimmed) ||
        (item.suppCode && String(item.suppCode).toUpperCase() === trimmed)
    );

    if (matchedItem) {
      const stock =
        matchedItem.quantity !== undefined
          ? matchedItem.quantity
          : matchedItem.stockInHand !== undefined
          ? matchedItem.stockInHand
          : 0;

      setFormData((prev) => ({
        ...prev,
        description: matchedItem.description || '',
        status: 'Active',
        stock: Number(stock),
      }));

      loadExistingMappingForCode(matchedItem.code);
    }
  };

  // Blur / Enter handler for Item Code input
  const handleItemCodeBlur = async () => {
    const trimmed = formData.itemCode.trim().toUpperCase();
    if (!trimmed) return;

    let matchedItem = itemsList.find(
      (item) =>
        item.code?.toUpperCase() === trimmed ||
        (item.barcode && String(item.barcode).toUpperCase() === trimmed) ||
        (item.suppCode && String(item.suppCode).toUpperCase() === trimmed)
    );

    if (!matchedItem) {
      try {
        const res = await api.get(`/items?search=${encodeURIComponent(trimmed)}&limit=10`);
        if (res.data?.data?.length > 0) {
          matchedItem = res.data.data.find(
            (i) =>
              i.code?.toUpperCase() === trimmed ||
              (i.barcode && String(i.barcode).toUpperCase() === trimmed) ||
              (i.suppCode && String(i.suppCode).toUpperCase() === trimmed)
          );
        }
      } catch (e) {
        // ignore
      }
    }

    if (matchedItem) {
      const stock =
        matchedItem.quantity !== undefined
          ? matchedItem.quantity
          : matchedItem.stockInHand !== undefined
          ? matchedItem.stockInHand
          : 0;

      setFormData((prev) => ({
        ...prev,
        itemCode: matchedItem.code,
        description: matchedItem.description || '',
        status: 'Active',
        stock: Number(stock),
      }));
      loadExistingMappingForCode(matchedItem.code);
    } else {
      showNotification(`Item '${trimmed}' not found in Item Master`, 'error');
    }
  };

  // Load existing relationship for a given main item code
  const loadExistingMappingForCode = async (code) => {
    try {
      const res = await api.get(`/alternative-products/${encodeURIComponent(code)}?direct=true`);
      if (res.data?.data && Array.isArray(res.data.data.alternativeItems)) {
        setAlternativeItems(res.data.data.alternativeItems);
        if (res.data.data.description) {
          setFormData((prev) => ({
            ...prev,
            description: res.data.data.description,
            stock: res.data.data.mainItemStock !== undefined ? res.data.data.mainItemStock : prev.stock,
          }));
        }
      } else {
        setAlternativeItems([]);
      }
    } catch (err) {
      // If none exists yet, clear alternative items
      setAlternativeItems([]);
    }
  };

  // Select Main Item from Search Modal
  const handleSelectMainItem = (item) => {
    const stock =
      item.quantity !== undefined
        ? item.quantity
        : item.stockInHand !== undefined
        ? item.stockInHand
        : 0;

    setFormData({
      itemCode: item.code,
      description: item.description || '',
      status: 'Active',
      stock: Number(stock),
    });

    const shouldAutoOpenAlt = Boolean(mainItemModal.autoOpenAltAfterSelect);
    setMainItemModal({ isOpen: false, search: '', autoOpenAltAfterSelect: false });

    // Load any existing alternative mapping for this main item
    loadExistingMappingForCode(item.code);

    if (shouldAutoOpenAlt) {
      setTimeout(() => {
        setAddAltModal({ isOpen: true, search: '' });
      }, 150);
    }
  };

  // Load Record from Lower Section Table
  const handleLoadRecord = (record) => {
    setFormData({
      itemCode: record.mainItemCode,
      description: record.description || record.mainItemDescription || '',
      status: record.status || 'Active',
      stock: record.mainItemStock || 0,
    });
    setAlternativeItems(record.alternativeItems || []);
    showNotification(`Loaded Alternative Product mapping for '${record.mainItemCode}'`, 'info');
  };

  // Add Alternative Item from Dialog
  const handleAddAlternativeItem = (item, closeAfter = false) => {
    if (!formData.itemCode || !formData.itemCode.trim()) {
      showNotification('Please select a Main Item Code first', 'error');
      return;
    }

    const mainCode = formData.itemCode.trim().toUpperCase();
    const altCode = item.code?.trim().toUpperCase();

    // RULE 1: Main item cannot be added as its own alternative
    if (mainCode === altCode) {
      showNotification(`Cannot add Main Item '${mainCode}' as its own alternative!`, 'error');
      return;
    }

    // RULE 2: Prevent duplicate relationships
    const exists = alternativeItems.some(
      (ai) => ai.code?.toUpperCase() === altCode
    );
    if (exists) {
      showNotification(`Alternative Item '${altCode}' is already added!`, 'error');
      return;
    }

    const stock =
      item.quantity !== undefined
        ? item.quantity
        : item.stockInHand !== undefined
        ? item.stockInHand
        : 0;

    const newAltEntry = {
      _id: item._id,
      code: item.code,
      description: item.description || '',
      stock: Number(stock),
      location: item.location || 'Main Store',
      price: Number(item.finalSellingPrice || item.sellingPrice || 0),
      category: item.category || '',
    };

    setAlternativeItems((prev) => [...prev, newAltEntry]);
    showNotification(`Added '${item.code} - ${item.description}' to alternative products list. Remember to click Save.`, 'success');

    if (closeAfter) {
      setAddAltModal({ isOpen: false, search: '' });
    }
  };

  // Quick Add Alternative Item by typing/scanning code directly
  const handleQuickAddAlternative = async () => {
    const raw = quickAltCode.trim();
    if (!raw) {
      showNotification('Please enter an alternative item code or barcode', 'error');
      return;
    }

    if (!formData.itemCode || !formData.itemCode.trim()) {
      showNotification('Please select or enter a Main Item Code first before adding alternatives.', 'info');
      setMainItemModal({ isOpen: true, search: '', autoOpenAltAfterSelect: true });
      return;
    }

    const mainCode = formData.itemCode.trim().toUpperCase();
    const targetCode = raw.toUpperCase();

    if (mainCode === targetCode) {
      showNotification(`Cannot add Main Item '${mainCode}' as its own alternative!`, 'error');
      return;
    }

    const exists = alternativeItems.some(
      (ai) => ai.code?.toUpperCase() === targetCode
    );
    if (exists) {
      showNotification(`Alternative Item '${targetCode}' is already in the list!`, 'error');
      setQuickAltCode('');
      return;
    }

    // Check in itemsList
    let matched = itemsList.find(
      (i) =>
        i.code?.toUpperCase() === targetCode ||
        (i.barcode && String(i.barcode).toUpperCase() === targetCode) ||
        (i.suppCode && String(i.suppCode).toUpperCase() === targetCode)
    );

    // If not found in loaded list, search backend
    if (!matched) {
      try {
        const res = await api.get(`/items?search=${encodeURIComponent(raw)}&limit=10`);
        if (res.data?.data?.length > 0) {
          matched = res.data.data.find(
            (i) =>
              i.code?.toUpperCase() === targetCode ||
              (i.barcode && String(i.barcode).toUpperCase() === targetCode) ||
              (i.suppCode && String(i.suppCode).toUpperCase() === targetCode)
          );
        }
      } catch (e) {
        // ignore
      }
    }

    if (!matched) {
      showNotification(`Item '${raw}' not found in Item Master. Please verify code or create it first.`, 'error');
      return;
    }

    handleAddAlternativeItem(matched, false);
    setQuickAltCode('');
  };

  // Open Add Alternative Modal with check for main item code
  const handleOpenAddAltModal = () => {
    if (!formData.itemCode || !formData.itemCode.trim()) {
      showNotification('Please select or enter a Main Item Code first before adding alternatives.', 'info');
      setMainItemModal({ isOpen: true, search: '', autoOpenAltAfterSelect: true });
      return;
    }
    setAddAltModal({ isOpen: true, search: '' });
  };

  // Remove Alternative Item from List
  const handleRemoveAlternative = (altItem) => {
    const confirmRemove = window.confirm(
      `Remove alternative relationship for '${altItem.code} - ${altItem.description}'?\n\n(Note: This will NOT delete the item from Item Master)`
    );
    if (!confirmRemove) return;

    setAlternativeItems((prev) => prev.filter((ai) => ai.code !== altItem.code));
    showNotification(`Removed '${altItem.code}' from current alternative list. Click Save/Update to persist.`, 'info');
  };

  // BUTTON: NEW
  const handleNew = () => {
    setFormData({
      itemCode: '',
      description: '',
      status: 'Active',
      stock: 0,
    });
    setAlternativeItems([]);
    showNotification('Form cleared. Ready for new Alternative Product mapping.', 'info');
  };

  // BUTTON: SAVE / UPDATE
  const handleSaveOrUpdate = async () => {
    if (!formData.itemCode || !formData.itemCode.trim()) {
      showNotification('Please enter or select a Main Item Code', 'error');
      return;
    }

    const trimmedCode = formData.itemCode.trim().toUpperCase();

    // Verify main item exists (prefer cached code for casing)
    let finalCode = trimmedCode;
    const mainItemObj = itemsList.find(
      (i) => i.code?.toUpperCase() === trimmedCode
    );
    if (mainItemObj?.code) {
      finalCode = mainItemObj.code;
    }

    try {
      setIsSaving(true);
      const altCodes = alternativeItems.map((a) => a.code).filter(Boolean);

      const payload = {
        mainItemCode: finalCode,
        alternativeItemCodes: altCodes,
        status: formData.status || 'Active',
      };

      const res = await api.post('/alternative-products', payload);
      if (res.data?.success) {
        showNotification(
          `Alternative Product mapping for '${finalCode}' saved successfully! (${altCodes.length} alternative items linked)`,
          'success'
        );
        fetchRelationships();
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to save alternative product relationship';
      showNotification(errMsg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // BUTTON: DELETE RELATIONSHIP
  const handleDeleteRelationship = async () => {
    if (!formData.itemCode || !formData.itemCode.trim()) {
      showNotification('No Main Item selected to delete relationship', 'error');
      return;
    }

    const trimmedCode = formData.itemCode.trim().toUpperCase();

    const confirmDel = window.confirm(
      `Are you sure you want to delete the Alternative Product mapping for '${trimmedCode}'?\n\nIMPORTANT: This will ONLY delete the relationship. No items in Item Master will be deleted.`
    );
    if (!confirmDel) return;

    try {
      const res = await api.delete(`/alternative-products/${encodeURIComponent(trimmedCode)}`);
      if (res.data?.success) {
        showNotification(`Alternative Product mapping for '${trimmedCode}' deleted successfully`, 'success');
        handleNew();
        fetchRelationships();
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to delete alternative product mapping';
      showNotification(errMsg, 'error');
    }
  };

  // Debounced server search fallback for Main Item Modal
  useEffect(() => {
    const q = mainItemModal.search?.trim();
    if (!mainItemModal.isOpen || !q || q.length < 2) {
      setMainServerResults([]);
      setIsSearchingServerMain(false);
      return;
    }

    if (filteredMainItems.length >= 5) {
      setMainServerResults([]);
      setIsSearchingServerMain(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingServerMain(true);
        const res = await api.get(`/items?search=${encodeURIComponent(q)}&limit=20`);
        if (res.data?.data) {
          const existingCodes = new Set(filteredMainItems.map((i) => i.code?.toUpperCase()));
          const extra = res.data.data.filter((i) => !existingCodes.has(i.code?.toUpperCase()));
          setMainServerResults(extra);
        }
      } catch (e) {
        // ignore
      } finally {
        setIsSearchingServerMain(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [mainItemModal.search, mainItemModal.isOpen, filteredMainItems]);

  // Debounced server search fallback for Add Alternative Modal
  useEffect(() => {
    const q = addAltModal.search?.trim();
    if (!addAltModal.isOpen || !q || q.length < 2) {
      setAltServerResults([]);
      setIsSearchingServerAlt(false);
      return;
    }

    if (filteredAltCandidateItems.length >= 5) {
      setAltServerResults([]);
      setIsSearchingServerAlt(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingServerAlt(true);
        const res = await api.get(`/items?search=${encodeURIComponent(q)}&limit=25`);
        if (res.data?.data) {
          const existingCodes = new Set(filteredAltCandidateItems.map((i) => i.code?.toUpperCase()));
          const extra = res.data.data.filter((i) => !existingCodes.has(i.code?.toUpperCase()));
          setAltServerResults(extra);
        }
      } catch (e) {
        // ignore
      } finally {
        setIsSearchingServerAlt(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [addAltModal.search, addAltModal.isOpen, filteredAltCandidateItems]);

  // Filter for Main Item Search Modal
  const filteredMainItems = useMemo(() => {
    const q = mainItemModal.search.toLowerCase().trim();
    if (!q) return itemsList;
    return itemsList.filter(
      (i) =>
        i.code?.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q) ||
        (i.barcode && String(i.barcode).toLowerCase().includes(q)) ||
        (i.suppCode && String(i.suppCode).toLowerCase().includes(q))
    );
  }, [itemsList, mainItemModal.search]);

  // Slice to max 100 to prevent React DOM lockup
  const displayedMainItems = useMemo(() => {
    return [...filteredMainItems.slice(0, 100), ...mainServerResults];
  }, [filteredMainItems, mainServerResults]);

  // Filter for Add Alternative Item Search Modal
  const filteredAltCandidateItems = useMemo(() => {
    const q = addAltModal.search.toLowerCase().trim();

    return itemsList.filter((i) => {
      if (!q) return true;
      const c = i.code?.toLowerCase() || '';
      const d = i.description?.toLowerCase() || '';
      const cat = i.category?.toLowerCase() || '';
      const b = i.barcode ? String(i.barcode).toLowerCase() : '';
      const supp = i.suppCode ? String(i.suppCode).toLowerCase() : '';

      return c.includes(q) || d.includes(q) || cat.includes(q) || b.includes(q) || supp.includes(q);
    });
  }, [itemsList, addAltModal.search]);

  // Slice to max 100 to prevent browser freezing
  const displayedAltCandidateItems = useMemo(() => {
    return [...filteredAltCandidateItems.slice(0, 100), ...altServerResults];
  }, [filteredAltCandidateItems, altServerResults]);

  // Filter for Lower Records List
  const filteredRecords = useMemo(() => {
    const q = recordsFilter.toLowerCase().trim();
    if (!q) return savedRelationships;
    return savedRelationships.filter(
      (r) =>
        r.mainItemCode?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        (r.alternativeItemCodes &&
          r.alternativeItemCodes.some((ac) => ac.toLowerCase().includes(q)))
    );
  }, [savedRelationships, recordsFilter]);

  return (
    <div className="alt-prod-page">
      {/* 1. Windows Blue Header */}
      <header className="alt-prod-titlebar">
        <div className="alt-prod-titlebar-brand">
          <svg className="alt-prod-titlebar-car-icon" viewBox="0 0 24 24">
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
          </svg>
          <span className="alt-prod-titlebar-heading">SOFAST MOTORS - Management System [Alternative Product]</span>
        </div>
        <div className="alt-prod-titlebar-controls">
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

      {/* 3. Main Form Canvas */}
      <main className="alt-prod-main-canvas">
        {/* Notification Box */}
        {notification && (
          <div className={`alt-prod-alert ${notification.type}`}>
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

        {/* Form Container Panel */}
        <div className="alt-prod-panel-container">
          {/* Top Controls: Item Code, Save, Update, New, Delete, Description, Active */}
          <div className="alt-prod-top-controls">
            {/* Row 1: Item Code + Buttons */}
            <div className="alt-prod-row-1">
              <span className="dotted-label-blue">Item Code . . . . .</span>
              <div className="item-code-input-wrapper">
                <input
                  type="text"
                  name="itemCode"
                  list="alt-item-code-datalist"
                  className="alt-prod-input"
                  style={{ width: '175px', fontWeight: '700', color: '#000080' }}
                  value={formData.itemCode}
                  onChange={handleItemCodeInputChange}
                  onBlur={handleItemCodeBlur}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleItemCodeBlur();
                    }
                  }}
                  placeholder={loadingItems ? 'Loading all items...' : 'Enter Item Code...'}
                  title={loadingItems ? 'Loading all items from Item Master...' : 'Enter or select Item Code'}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="alt-prod-btn-lookup"
                  title="Search Main Item in Item Master"
                  onClick={() => setMainItemModal({ isOpen: true, search: '' })}
                >
                  ...
                </button>
              </div>

              <datalist id="alt-item-code-datalist">
                {itemsList.slice(0, 50).map((item) => (
                  <option key={item._id || item.code} value={item.code}>
                    {item.description ? `${item.description}` : item.code}
                  </option>
                ))}
              </datalist>

              <div className="alt-prod-btn-group">
                <button
                  type="button"
                  className="alt-prod-btn-classic"
                  onClick={handleSaveOrUpdate}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  className="alt-prod-btn-classic"
                  onClick={handleSaveOrUpdate}
                  disabled={isSaving}
                >
                  Update
                </button>
                <button type="button" className="alt-prod-btn-classic" onClick={handleNew}>
                  New
                </button>
                <button
                  type="button"
                  className="alt-prod-btn-classic delete"
                  onClick={handleDeleteRelationship}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="alt-prod-btn-classic"
                  style={{ color: '#000080', fontWeight: 'bold' }}
                  onClick={() => navigate('/reports?tab=alternative_products')}
                  title="View Alternative Products Report in Reports Center"
                >
                  Reports
                </button>
              </div>
            </div>

            {/* Row 2: Descriptoin + Status Indicator */}
            <div className="alt-prod-row-2">
              <span className="dotted-label-blue">Descriptoin . . . .</span>
              <input
                type="text"
                name="description"
                className="alt-prod-input"
                style={{ flex: 1, backgroundColor: '#fcfcfc' }}
                value={formData.description}
                readOnly
                placeholder="Main Item Description (loaded from Item Master)"
              />
              <div className="alt-prod-status-indicator" title="Active Status">
                [Active]
              </div>
            </div>
          </div>

          {/* Upper Bordered Section: Alternative Products Table */}
          <div className="alt-prod-section-box upper">
            <div className="section-header-bar">
              <div className="section-title">
                <span>ALTERNATIVE PRODUCTS</span>
                {formData.itemCode && (
                  <span className="section-subtitle">
                    (Linked alternatives for: <strong>{formData.itemCode}</strong> - {formData.description})
                  </span>
                )}
              </div>
              <button
                type="button"
                className="alt-prod-btn-classic add-alt-btn"
                onClick={handleOpenAddAltModal}
                title="Search and select from Item Master"
              >
                + Add Alternative Item (Search Dialog)
              </button>
            </div>

            {/* Quick Inline Entry for Alternative Products */}
            <div className="alt-prod-quick-add-bar">
              <span className="dotted-label-blue" style={{ fontSize: '12px' }}>
                Quick Add Alternative:
              </span>
              <input
                type="text"
                className="alt-prod-input"
                style={{ width: '220px', fontWeight: 'bold', color: '#000080' }}
                placeholder="Type/Scan Alt Item Code or Barcode..."
                value={quickAltCode}
                onChange={(e) => setQuickAltCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleQuickAddAlternative();
                  }
                }}
              />
              <button
                type="button"
                className="alt-prod-btn-classic"
                style={{ fontWeight: 'bold' }}
                onClick={handleQuickAddAlternative}
                title="Add to alternative list"
              >
                + Add
              </button>
              <button
                type="button"
                className="alt-prod-btn-classic"
                onClick={handleOpenAddAltModal}
                title="Browse all items"
              >
                🔍 Browse Items...
              </button>
              <span style={{ fontSize: '11px', color: '#555', marginLeft: 'auto' }}>
                Total Linked: <strong>{alternativeItems.length}</strong>
              </span>
            </div>

            <div className="table-viewport upper-table-scroll">
              <table className="alt-prod-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                    <th style={{ width: '130px' }}>Code</th>
                    <th>Description</th>
                    <th style={{ width: '90px', textAlign: 'center' }}>Stock</th>
                    <th style={{ width: '110px' }}>Location</th>
                    <th style={{ width: '110px', textAlign: 'right' }}>Selling Price</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {alternativeItems.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="empty-table-message">
                        {formData.itemCode ? (
                          <span>
                            No alternative products linked yet for <strong>{formData.itemCode}</strong>.
                            Click <strong>[+ Add Alternative Item]</strong> to link compatible products from Item Master.
                          </span>
                        ) : (
                          <span>Please select or enter a Main Item Code above to view or link alternative products.</span>
                        )}
                      </td>
                    </tr>
                  ) : (
                    alternativeItems.map((alt, idx) => (
                      <tr key={alt.code || idx}>
                        <td style={{ textAlign: 'center', color: '#666' }}>{idx + 1}</td>
                        <td style={{ fontWeight: '700', color: '#000080' }}>{alt.code}</td>
                        <td style={{ fontWeight: '500' }}>{alt.description}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: alt.stock > 0 ? '#006600' : '#cc0000' }}>
                          {alt.stock ?? 0}
                        </td>
                        <td>{alt.location || 'Main Store'}</td>
                        <td style={{ textAlign: 'right' }}>
                          {Number(alt.price || alt.finalSellingPrice || alt.sellingPrice || 0).toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="alt-prod-btn-remove"
                            title="Remove alternative relationship"
                            onClick={() => handleRemoveAlternative(alt)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Lower Bordered Section: Saved Alternative Product Records */}
          <div className="alt-prod-section-box lower">
            <div className="section-header-bar">
              <div className="section-title">
                <span>SAVED ALTERNATIVE PRODUCT MAPPINGS</span>
                <span className="section-subtitle">({savedRelationships.length} items configured)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: '#333' }}>Filter:</span>
                <input
                  type="text"
                  className="alt-prod-input"
                  style={{ width: '180px', height: '22px' }}
                  placeholder="Filter records..."
                  value={recordsFilter}
                  onChange={(e) => setRecordsFilter(e.target.value)}
                />
              </div>
            </div>

            <div className="table-viewport lower-table-scroll">
              <table className="alt-prod-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                    <th style={{ width: '130px' }}>Main Item Code</th>
                    <th>Main Item Description</th>
                    <th style={{ width: '90px', textAlign: 'center' }}>Main Stock</th>
                    <th style={{ width: '130px', textAlign: 'center' }}>Linked Alternatives</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>Status</th>
                    <th style={{ width: '90px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="empty-table-message">
                        No Alternative Product relationship records found in the database.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((rec, idx) => {
                      const isSelected = rec.mainItemCode === formData.itemCode;
                      return (
                        <tr
                          key={rec._id || rec.mainItemCode}
                          className={isSelected ? 'selected' : ''}
                          onClick={() => handleLoadRecord(rec)}
                        >
                          <td style={{ textAlign: 'center', color: isSelected ? '#fff' : '#666' }}>{idx + 1}</td>
                          <td style={{ fontWeight: '700', color: isSelected ? '#fff' : '#000080' }}>
                            {rec.mainItemCode}
                          </td>
                          <td>{rec.description || rec.mainItemDescription}</td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                            {rec.mainItemStock ?? 0}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="badge-count">
                              {rec.alternativeCount ?? rec.alternativeItemCodes?.length ?? 0} Items
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>{rec.status || 'Active'}</td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="alt-prod-btn-classic"
                              style={{ height: '20px', minWidth: '55px', padding: '0 4px', fontSize: '11px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLoadRecord(rec);
                              }}
                            >
                              Load
                            </button>
                          </td>
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

      {/* Main Item Search Modal */}
      {mainItemModal.isOpen && (
        <div className="alt-prod-modal-overlay">
          <div className="alt-prod-modal-window">
            <div className="alt-prod-modal-titlebar">
              <span>Select Main Item from Item Master</span>
              <button
                type="button"
                className="control-btn close"
                style={{ width: '24px', height: '20px' }}
                onClick={() => setMainItemModal({ isOpen: false, search: '', autoOpenAltAfterSelect: false })}
              >
                &#x2715;
              </button>
            </div>
            <div className="alt-prod-modal-body">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1 }}>
                  <span className="dotted-label-blue" style={{ width: 'auto' }}>Search Item:</span>
                  <input
                    type="text"
                    className="alt-prod-input"
                    style={{ flex: 1, padding: '4px 8px' }}
                    placeholder="Search by Item Code, Description, Category, Barcode..."
                    autoFocus
                    value={mainItemModal.search}
                    onChange={(e) => setMainItemModal({ ...mainItemModal, search: e.target.value })}
                  />
                </div>
                <span style={{ fontSize: '11px', color: '#000080', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                  {loadingItems
                    ? 'Loading items...'
                    : isSearchingServerMain
                    ? 'Searching database...'
                    : `Showing ${displayedMainItems.length} of ${filteredMainItems.length} items`}
                </span>
              </div>

              <div className="modal-table-viewport">
                <table className="alt-prod-table">
                  <thead>
                    <tr>
                      <th style={{ width: '35px', textAlign: 'center' }}>#</th>
                      <th style={{ width: '120px' }}>Item Code</th>
                      <th>Description</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>Stock</th>
                      <th style={{ width: '100px' }}>Location</th>
                      <th style={{ width: '90px', textAlign: 'right' }}>Price</th>
                      <th style={{ width: '70px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedMainItems.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '16px', color: '#666' }}>
                          No matching items found in Item Master
                        </td>
                      </tr>
                    ) : (
                      displayedMainItems.map((item, idx) => (
                        <tr
                          key={item._id || item.code}
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleSelectMainItem(item)}
                          title="Click to select this as Main Item"
                        >
                          <td style={{ textAlign: 'center', color: '#666' }}>{idx + 1}</td>
                          <td style={{ fontWeight: 'bold', color: '#000080' }}>{item.code}</td>
                          <td>{item.description}</td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                            {item.quantity ?? item.stockInHand ?? 0}
                          </td>
                          <td>{item.location || 'Main Store'}</td>
                          <td style={{ textAlign: 'right' }}>
                            {Number(item.finalSellingPrice || item.sellingPrice || 0).toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="alt-prod-btn-classic"
                              style={{ height: '22px', minWidth: '55px', padding: '0 4px', fontSize: '11px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectMainItem(item);
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
            <div className="alt-prod-modal-footer">
              <button
                type="button"
                className="alt-prod-btn-classic"
                onClick={() => setMainItemModal({ isOpen: false, search: '', autoOpenAltAfterSelect: false })}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Alternative Item Modal */}
      {addAltModal.isOpen && (
        <div className="alt-prod-modal-overlay">
          <div className="alt-prod-modal-window">
            <div className="alt-prod-modal-titlebar">
              <span>Link Alternative Item for Main Item [{formData.itemCode}]</span>
              <button
                type="button"
                className="control-btn close"
                style={{ width: '24px', height: '20px' }}
                onClick={() => setAddAltModal({ isOpen: false, search: '' })}
              >
                &#x2715;
              </button>
            </div>
            <div className="alt-prod-modal-body">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1 }}>
                  <span className="dotted-label-blue" style={{ width: 'auto' }}>Search Item:</span>
                  <input
                    type="text"
                    className="alt-prod-input"
                    style={{ flex: 1, padding: '4px 8px' }}
                    placeholder="Type code, description, or barcode to find replacement/alternative product..."
                    autoFocus
                    value={addAltModal.search}
                    onChange={(e) => setAddAltModal({ ...addAltModal, search: e.target.value })}
                  />
                </div>
                <span style={{ fontSize: '11px', color: '#000080', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                  {loadingItems
                    ? 'Loading items...'
                    : isSearchingServerAlt
                    ? 'Searching database...'
                    : `Showing ${displayedAltCandidateItems.length} of ${filteredAltCandidateItems.length} items`}
                </span>
              </div>

              <div className="modal-table-viewport">
                <table className="alt-prod-table">
                  <thead>
                    <tr>
                      <th style={{ width: '35px', textAlign: 'center' }}>#</th>
                      <th style={{ width: '120px' }}>Code</th>
                      <th>Description</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>Stock</th>
                      <th style={{ width: '100px' }}>Location</th>
                      <th style={{ width: '90px', textAlign: 'right' }}>Price</th>
                      <th style={{ width: '130px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedAltCandidateItems.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '16px', color: '#666' }}>
                          No items found in Item Master
                        </td>
                      </tr>
                    ) : (
                      displayedAltCandidateItems.map((item, idx) => {
                        const isMain = String(item.code || '').trim().toUpperCase() === String(formData.itemCode || '').trim().toUpperCase();
                        const isAlreadyLinked = alternativeItems.some(
                          (ai) => String(ai.code || '').trim().toUpperCase() === String(item.code || '').trim().toUpperCase()
                        );

                        return (
                          <tr
                            key={item._id || item.code}
                            style={{
                              cursor: isMain || isAlreadyLinked ? 'default' : 'pointer',
                              opacity: isMain || isAlreadyLinked ? 0.6 : 1,
                              backgroundColor: isAlreadyLinked ? '#f0fdf4' : undefined,
                            }}
                            onClick={() => {
                              if (!isMain && !isAlreadyLinked) {
                                handleAddAlternativeItem(item, false);
                              }
                            }}
                            title={isMain ? 'Main Item' : isAlreadyLinked ? 'Already Added' : 'Click to add as alternative product'}
                          >
                            <td style={{ textAlign: 'center', color: '#666' }}>{idx + 1}</td>
                            <td style={{ fontWeight: 'bold', color: '#000080' }}>{item.code}</td>
                            <td>{item.description}</td>
                            <td style={{ textAlign: 'center', fontWeight: 'bold', color: item.quantity > 0 ? '#006600' : '#cc0000' }}>
                              {item.quantity ?? item.stockInHand ?? 0}
                            </td>
                            <td>{item.location || 'Main Store'}</td>
                            <td style={{ textAlign: 'right' }}>
                              {Number(item.finalSellingPrice || item.sellingPrice || 0).toFixed(2)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {isMain ? (
                                <span style={{ fontSize: '11px', color: '#888', fontWeight: 'bold' }}>
                                  Main Item
                                </span>
                              ) : isAlreadyLinked ? (
                                <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 'bold' }}>
                                  Added ✓
                                </span>
                              ) : (
                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                  <button
                                    type="button"
                                    className="alt-prod-btn-classic"
                                    style={{ height: '22px', minWidth: '45px', padding: '0 4px', fontSize: '11px' }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddAlternativeItem(item, false);
                                    }}
                                    title="Add to alternative list"
                                  >
                                    + Add
                                  </button>
                                  <button
                                    type="button"
                                    className="alt-prod-btn-classic"
                                    style={{ height: '22px', minWidth: '65px', padding: '0 4px', fontSize: '11px', backgroundColor: '#e0f2fe' }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddAlternativeItem(item, true);
                                    }}
                                    title="Add and close dialog"
                                  >
                                    Add & Close
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="alt-prod-modal-footer">
              <button
                type="button"
                className="alt-prod-btn-classic"
                onClick={() => setAddAltModal({ isOpen: false, search: '' })}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AlternativeProduct;
