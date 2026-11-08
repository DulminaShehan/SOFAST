import React, { Component, useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ClassicNavbar from '../../components/navigation/ClassicNavbar';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { handleEnterNavigation } from '../../hooks/useEnterKeyNavigation';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import './AlternativeProduct.css';

/**
 * Alternative Product Master
 * Connects EXISTING Item Master products that are similar, compatible, or replacements.
 * Recreates the exact Classic ERP / Visual Basic 6 desktop UI from the reference image.
 */
function AlternativeProduct() {
  const navigate = useNavigate();
  const { confirmSave, confirmDelete } = useConfirmDialog();
  const { isAdmin } = useAuth();
  const { confirm } = useConfirm();

  // Navigation Menubar state
  const [activeDropdown, setActiveDropdown] = useState('master-files');
  const menuRef = useRef(null);
  const itemCodeInputRef = useRef(null);

  // Notification Banner
  const [notification, setNotification] = useState(null);

  // Loading States
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingRelationships, setLoadingRelationships] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);

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
    price: 0,
    location: 'Main Store',
  });

  // Items currently in the First Grid (Alternative Products group)
  const [alternativeItems, setAlternativeItems] = useState([]);

  // State when searched item is already an alternative product
  const [alreadyAltState, setAlreadyAltState] = useState(null);

  // Lower Section Table Search / Filter (Second Grid)
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
      setLoadError(null);
      const res = await api.get('/items?limit=all');
      if (res.data?.data && Array.isArray(res.data.data)) {
        setItemsList(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch items:', err);
      setLoadError('Failed to load items from Item Master. Please check server connection.');
    } finally {
      setLoadingItems(false);
    }
  };

  // 2. Fetch All Saved Alternative Relationships
  const fetchRelationships = async () => {
    try {
      setLoadingRelationships(true);
      const res = await api.get('/alternative-products?limit=all');
      if (res.data?.data && Array.isArray(res.data.data)) {
        setSavedRelationships(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch alternative products:', err);
      setLoadError('Failed to load alternative product relationships. Please check server connection.');
    } finally {
      setLoadingRelationships(false);
    }
  };

  const handleRetryLoad = () => {
    setLoadError(null);
    fetchItems();
    fetchRelationships();
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

  // Check if an item is already an alternative product (or main item) in any saved relationship
  const checkIfAlreadyAlternative = (code) => {
    if (!code) return null;
    const upper = String(code).trim().toUpperCase();

    // Check savedRelationships
    let found = savedRelationships.find(
      (r) => r.mainItemCode?.toUpperCase() === upper
    );
    let isMain = true;

    if (!found) {
      found = savedRelationships.find(
        (r) =>
          r.alternativeItemCodes &&
          r.alternativeItemCodes.some((ac) => ac?.toUpperCase() === upper)
      );
      isMain = false;
    }

    if (found) {
      const stateObj = {
        itemCode: upper,
        mainItemCode: found.mainItemCode,
        isMain,
        message: 'This item is already alternative',
        record: found,
      };
      setAlreadyAltState(stateObj);
      setRecordsFilter(found.mainItemCode);
      loadExistingMappingForCode(found.mainItemCode);
      showNotification(`This item is already alternative (Configured under '${found.mainItemCode}')`, 'warning');
      return stateObj;
    } else {
      setAlreadyAltState(null);
      return null;
    }
  };

  // Handle Main Item Code Input (as user types or selects)
  const handleItemCodeInputChange = (e) => {
    const val = e.target.value;
    setFormData((prev) => ({ ...prev, itemCode: val }));
    setAlreadyAltState(null);

    const trimmed = val.trim().toUpperCase();
    if (!trimmed) {
      setFormData((prev) => ({ ...prev, description: '', stock: 0, price: 0 }));
      return;
    }

    // Auto-fill description immediately if matching item found in itemsList
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
        itemCode: matchedItem.code,
        description: matchedItem.description || '',
        status: 'Active',
        stock: Number(stock),
        price: Number(matchedItem.finalSellingPrice || matchedItem.sellingPrice || 0),
        location: matchedItem.location || 'Main Store',
      }));

      // Check if this item is already alternative
      checkIfAlreadyAlternative(matchedItem.code);
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
        price: Number(matchedItem.finalSellingPrice || matchedItem.sellingPrice || 0),
        location: matchedItem.location || 'Main Store',
      }));
      checkIfAlreadyAlternative(matchedItem.code);
    } else {
      showNotification(`Item '${trimmed}' not found in Item Master`, 'error');
    }
  };

  // Load existing relationship for a given main item code
  const loadExistingMappingForCode = async (code) => {
    try {
      const upper = String(code).trim().toUpperCase();

      // Check local saved relationships first
      let rel = savedRelationships.find(
        (r) =>
          r.mainItemCode?.toUpperCase() === upper ||
          (r.alternativeItemCodes && r.alternativeItemCodes.some((ac) => ac?.toUpperCase() === upper))
      );

      // If not cached, fetch from server
      if (!rel) {
        const res = await api.get(`/alternative-products/${encodeURIComponent(upper)}`);
        if (res.data?.data) {
          rel = res.data.data;
        }
      }

      if (rel) {
        const mainObj = itemsList.find((i) => i.code?.toUpperCase() === rel.mainItemCode?.toUpperCase()) || {
          code: rel.mainItemCode,
          description: rel.description || rel.mainItemDescription || '',
          stock: rel.mainItemStock || 0,
          location: 'Main Store',
          price: 0,
        };

        const altList = Array.isArray(rel.alternativeItems) ? rel.alternativeItems : [];

        // In first grid, load the entire group (main item as row 1 + all alternatives)
        const allGroupItems = [
          {
            ...mainObj,
            isMain: true,
          },
          ...altList.map((ai) => ({
            ...ai,
            isMain: false,
          })),
        ];

        setAlternativeItems(allGroupItems);
        setFormData({
          itemCode: mainObj.code,
          description: mainObj.description || '',
          status: rel.status || 'Active',
          stock: mainObj.stock || 0,
          price: mainObj.price || 0,
          location: mainObj.location || 'Main Store',
        });

        setAlreadyAltState({
          itemCode: upper,
          mainItemCode: rel.mainItemCode,
          message: 'This item is already alternative',
          record: rel,
        });

        setRecordsFilter(rel.mainItemCode);
      } else {
        setAlternativeItems([]);
        setAlreadyAltState(null);
      }
    } catch (err) {
      console.error('Error loading mapping:', err);
      setAlternativeItems([]);
      setAlreadyAltState(null);
    }
  };

  // Select Item from Search Modal
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
      price: Number(item.finalSellingPrice || item.sellingPrice || 0),
      location: item.location || 'Main Store',
    });

    setMainItemModal({ isOpen: false, search: '', autoOpenAltAfterSelect: false });

    // Check if already alternative
    checkIfAlreadyAlternative(item.code);
  };

  // Load Record from Lower Section Table (Second Grid)
  const handleLoadRecord = (record) => {
    const mainObj = itemsList.find((i) => i.code?.toUpperCase() === record.mainItemCode?.toUpperCase()) || {
      code: record.mainItemCode,
      description: record.description || record.mainItemDescription || '',
      stock: record.mainItemStock || 0,
      location: 'Main Store',
      price: 0,
    };

    const altList = Array.isArray(record.alternativeItems) ? record.alternativeItems : [];

    const allGroupItems = [
      {
        ...mainObj,
        isMain: true,
      },
      ...altList.map((ai) => ({
        ...ai,
        isMain: false,
      })),
    ];

    setAlternativeItems(allGroupItems);
    setFormData({
      itemCode: mainObj.code,
      description: mainObj.description || '',
      status: record.status || 'Active',
      stock: mainObj.stock || 0,
      price: mainObj.price || 0,
      location: mainObj.location || 'Main Store',
    });

    setAlreadyAltState({
      itemCode: record.mainItemCode,
      mainItemCode: record.mainItemCode,
      message: 'This item is already alternative',
      record,
    });

    setRecordsFilter(record.mainItemCode);
    showNotification(`Loaded Alternative Product mapping for '${record.mainItemCode}' (${allGroupItems.length} items)`, 'info');
  };

  // Add Item to First Grid
  const handleAddItemToFirstGrid = async () => {
    const raw = formData.itemCode.trim();
    if (!raw) {
      showNotification('Please enter or select an Item Code first', 'error');
      itemCodeInputRef.current?.focus();
      return;
    }

    const upper = raw.toUpperCase();

    // 1. Verify item exists in Item Master
    let item = itemsList.find(
      (i) =>
        i.code?.toUpperCase() === upper ||
        (i.barcode && String(i.barcode).toUpperCase() === upper) ||
        (i.suppCode && String(i.suppCode).toUpperCase() === upper)
    );

    if (!item) {
      try {
        const res = await api.get(`/items?search=${encodeURIComponent(raw)}&limit=10`);
        if (res.data?.data?.length > 0) {
          item = res.data.data.find(
            (i) =>
              i.code?.toUpperCase() === upper ||
              (i.barcode && String(i.barcode).toUpperCase() === upper) ||
              (i.suppCode && String(i.suppCode).toUpperCase() === upper)
          );
        }
      } catch (e) {
        // ignore
      }
    }

    if (!item) {
      showNotification(`Item '${raw}' not found in Item Master`, 'error');
      return;
    }

    // 2. Check if this item is ALREADY an alternative product in the system
    const existing = checkIfAlreadyAlternative(item.code);
    if (existing) {
      showNotification(`This item is already alternative! (Configured under '${existing.mainItemCode}')`, 'warning');
      return;
    }

    // 3. Check if already added to first grid
    const alreadyInGrid = alternativeItems.some(
      (ai) => ai.code?.toUpperCase() === item.code.toUpperCase()
    );
    if (alreadyInGrid) {
      showNotification(`Item '${item.code}' is already added to the grid!`, 'info');
      return;
    }

    // 4. Add to first grid
    const stock =
      item.quantity !== undefined
        ? item.quantity
        : item.stockInHand !== undefined
        ? item.stockInHand
        : 0;

    const isFirstItem = alternativeItems.length === 0;

    const newEntry = {
      _id: item._id,
      code: item.code,
      description: item.description || '',
      stock: Number(stock),
      location: item.location || 'Main Store',
      price: Number(item.finalSellingPrice || item.sellingPrice || 0),
      category: item.category || '',
      isMain: isFirstItem,
    };

    setAlternativeItems((prev) => [...prev, newEntry]);

    showNotification(
      isFirstItem
        ? `Added '${item.code}' as Primary Item. Now enter the alternative product and click [Add].`
        : `Added '${item.code}' to alternative products grid.`,
      'success'
    );

    // 5. Clear input fields for next entry
    setFormData({
      itemCode: '',
      description: '',
      status: 'Active',
      stock: 0,
      price: 0,
      location: 'Main Store',
    });

    setTimeout(() => {
      itemCodeInputRef.current?.focus();
    }, 50);
  };

  // Remove an item from the first grid
  const handleRemoveItemFromGrid = (indexToRemove) => {
    const itemToRemove = alternativeItems[indexToRemove];
    if (!itemToRemove) return;

    const confirmRemove = window.confirm(
      `Remove '${itemToRemove.code} - ${itemToRemove.description}' from the grid?`
    );
    if (!confirmRemove) return;

    setAlternativeItems((prev) => {
      const updated = prev.filter((_, idx) => idx !== indexToRemove);
      if (updated.length > 0) {
        updated[0] = { ...updated[0], isMain: true };
      }
      return updated;
    });

    showNotification(`Removed '${itemToRemove.code}' from the grid.`, 'info');
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
  const handleRemoveAlternative = async (altItem) => {
    const confirmRemove = await confirm({
      title: 'SOFAST POS - Remove Alternative',
      message: `Remove alternative relationship for '${altItem.code} - ${altItem.description}'?\n\n(Note: This will NOT delete the item from Item Master)`,
      icon: 'warning',
      defaultFocus: 'no',
    });
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
      price: 0,
      location: 'Main Store',
    });
    setAlternativeItems([]);
    setAlreadyAltState(null);
    setRecordsFilter('');
    showNotification('Form cleared. Ready for new Alternative Product mapping.', 'info');
    setTimeout(() => {
      itemCodeInputRef.current?.focus();
    }, 50);
  };

  // BUTTON: SAVE / UPDATE
  const handleSaveOrUpdate = async () => {
    // Collect all items to link:
    let itemsToSave = [...alternativeItems];

    // If an item code is currently typed in the input field and not yet added to grid, auto-include it:
    const pendingCode = formData.itemCode?.trim().toUpperCase();
    if (pendingCode) {
      const alreadyInList = itemsToSave.some((it) => it.code?.toUpperCase() === pendingCode);
      if (!alreadyInList) {
        let matched = itemsList.find((it) => it.code?.toUpperCase() === pendingCode);
        if (!matched) {
          try {
            const res = await api.get(`/items?search=${encodeURIComponent(pendingCode)}&limit=5`);
            if (res.data?.data?.length > 0) {
              matched = res.data.data.find((i) => i.code?.toUpperCase() === pendingCode);
            }
          } catch (e) {
            // ignore
          }
        }
        if (matched) {
          itemsToSave.push({
            _id: matched._id,
            code: matched.code,
            description: matched.description || formData.description || '',
            stock: matched.quantity ?? matched.stockInHand ?? 0,
            location: matched.location || 'Main Store',
            price: Number(matched.finalSellingPrice || matched.sellingPrice || 0),
            isMain: itemsToSave.length === 0,
          });
        }
      }
    }

    if (itemsToSave.length < 2) {
      showNotification('Please add at least 2 items to the grid (e.g. Primary Item and Alternative Item) before saving.', 'error');
      itemCodeInputRef.current?.focus();
      return;
    }

    const primaryItem = itemsToSave[0];
    const altCodes = itemsToSave.slice(1).map((a) => a.code).filter(Boolean);

    const confirmed = await confirmSave(`Do you want to save alternative product relationships for '${primaryItem.code}' with ${altCodes.join(', ')}?`);
    if (!confirmed) return;

    try {
      setIsSaving(true);
      const payload = {
        mainItemCode: primaryItem.code,
        alternativeItemCodes: altCodes,
        status: formData.status || 'Active',
      };

      const res = await api.post('/alternative-products', payload);
      if (res.data?.success || res.status === 200) {
        showNotification(
          `Alternative Product mapping for '${primaryItem.code}' saved successfully! (${itemsToSave.length} items linked)`,
          'success'
        );
        await fetchRelationships();
        handleNew();
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
    const targetCode =
      alreadyAltState?.mainItemCode ||
      (alternativeItems.length > 0 ? alternativeItems[0].code : formData.itemCode?.trim());

    if (!targetCode) {
      showNotification('No alternative product relationship selected to delete', 'error');
      return;
    }

    const confirmDel = await confirm({
      title: 'SOFAST POS - Delete Alternative Mapping',
      message: `Are you sure you want to delete the Alternative Product mapping for '${targetCode}'?\n\nIMPORTANT: This will ONLY delete the relationship mapping. Products in Item Master will NOT be deleted.`,
      icon: 'warning',
      defaultFocus: 'no',
    });
    if (!confirmDel) return;

    try {
      const res = await api.delete(`/alternative-products/${encodeURIComponent(targetCode)}`);
      if (res.data?.success) {
        showNotification(`Alternative Product mapping for '${targetCode}' deleted successfully`, 'success');
        handleNew();
        fetchRelationships();
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to delete alternative product mapping';
      showNotification(errMsg, 'error');
    }
  };

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

  // Filter for Lower Records List (Second Grid)
  const filteredRecords = useMemo(() => {
    const q = recordsFilter.toLowerCase().trim();
    if (!q) return savedRelationships;
    return savedRelationships.filter((r) => {
      const mainMatch =
        r.mainItemCode?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.mainItemDescription?.toLowerCase().includes(q);

      const altCodeMatch =
        Array.isArray(r.alternativeItemCodes) &&
        r.alternativeItemCodes.some((ac) => ac?.toLowerCase().includes(q));

      const altObjMatch =
        Array.isArray(r.alternativeItems) &&
        r.alternativeItems.some(
          (ai) =>
            ai.code?.toLowerCase().includes(q) ||
            ai.description?.toLowerCase().includes(q)
        );

      return mainMatch || altCodeMatch || altObjMatch;
    });
  }, [savedRelationships, recordsFilter]);

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

        {/* Load Error Banner with Retry */}
        {loadError && (
          <div
            className="alt-prod-alert error"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              border: '1px solid #f87171',
              padding: '6px 12px',
              marginBottom: '8px',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            <span>⚠️ {loadError}</span>
            <button
              type="button"
              className="alt-prod-btn-classic"
              style={{
                marginLeft: '12px',
                padding: '2px 10px',
                fontWeight: 'bold',
                cursor: 'pointer',
                backgroundColor: '#ffffff',
              }}
              onClick={handleRetryLoad}
            >
              🔄 Retry
            </button>
          </div>
        )}

        {/* Already Alternative Alert Banner */}
        {alreadyAltState && (
          <div className="already-alt-banner" style={{ marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>⚠️</span>
              <span>
                <strong>This item is already alternative:</strong> Item <strong>'{alreadyAltState.itemCode}'</strong> is already an alternative product (configured under <strong>{alreadyAltState.mainItemCode}</strong>). See all linked alternatives below in Grid 1 and listed in Grid 2.
              </span>
            </div>
            <button
              type="button"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', color: '#92400e', fontSize: '15px' }}
              onClick={() => setAlreadyAltState(null)}
            >
              ✕
            </button>
          </div>
        )}

        {/* Form Container Panel */}
        <div className="alt-prod-panel-container" onKeyDown={(e) => handleEnterNavigation(e, { saveButtonSelector: '.alt-prod-btn-classic' })}>
          {/* Top Controls: Item Code, Add, Save, Update, New, Delete, Description, Active */}
          <div className="alt-prod-top-controls">
            {/* Row 1: Item Code + Add Button + Action Buttons */}
            <div className="alt-prod-row-1">
              <span className="dotted-label-blue">Item Code . . . . .</span>
              <div className="item-code-input-wrapper">
                <input
                  ref={itemCodeInputRef}
                  type="text"
                  name="itemCode"
                  list="alt-item-code-datalist"
                  className="alt-prod-input"
                  style={{ width: '185px', fontWeight: '700', color: '#000080' }}
                  value={formData.itemCode}
                  onChange={handleItemCodeInputChange}
                  onBlur={handleItemCodeBlur}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddItemToFirstGrid();
                    }
                  }}
                  placeholder={loadingItems ? 'Loading all items...' : 'Enter / Search Item Code...'}
                  title="Type or select Item Code, then click Add or press Enter"
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="alt-prod-btn-lookup"
                  title="Search Item in Item Master"
                  onClick={() => setMainItemModal({ isOpen: true, search: '' })}
                >
                  ...
                </button>
                <button
                  type="button"
                  className="alt-prod-btn-classic alt-add-btn"
                  onClick={handleAddItemToFirstGrid}
                  title="Add item to the first grid"
                >
                  Add
                </button>
              </div>

              <datalist id="alt-item-code-datalist">
                {itemsList.slice(0, 100).map((item) => (
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
                placeholder="Description automatically fills when Item Code is entered or selected..."
              />
              {alreadyAltState ? (
                <span className="badge-already-alt">
                  ⚠️ This item is already alternative
                </span>
              ) : (
                <div className="alt-prod-status-indicator" title="Active Status">
                  [Active]
                </div>
              )}
            </div>
          </div>

          {/* Upper Bordered Section: First Grid (Alternative Products Table) */}
          <div className="alt-prod-section-box upper">
            <div className="section-header-bar">
              <div className="section-title">
                <span>ALTERNATIVE PRODUCTS (First Grid)</span>
                <span className="section-subtitle">
                  ({alternativeItems.length} item{alternativeItems.length === 1 ? '' : 's'} staged in group)
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="alt-prod-btn-classic add-alt-btn"
                  onClick={() => setMainItemModal({ isOpen: true, search: '' })}
                  title="Search and select from Item Master"
                >
                  🔍 Browse Item Master...
                </button>
              </div>
            </div>

            <div className="table-viewport upper-table-scroll">
              <table className="alt-prod-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                    <th style={{ width: '140px' }}>Code</th>
                    <th>Description</th>
                    <th style={{ width: '90px', textAlign: 'center' }}>Stock</th>
                    <th style={{ width: '110px' }}>Location</th>
                    <th style={{ width: '110px', textAlign: 'right' }}>Selling Price</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>Role</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {alternativeItems.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="empty-table-message">
                        <span>
                          No items loaded in First Grid yet. Enter an Item Code above and click <strong>[Add]</strong> to add items to this alternative group.
                        </span>
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
                          {idx === 0 ? (
                            <span className="role-badge-main">Main Item</span>
                          ) : (
                            <span className="role-badge-alt">Alternative</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="alt-prod-btn-remove"
                            title="Remove from this alternative group"
                            onClick={() => handleRemoveItemFromGrid(idx)}
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

          {/* Lower Bordered Section: Second Grid (Saved Alternative Product Records) */}
          <div className="alt-prod-section-box lower">
            <div className="section-header-bar">
              <div className="section-title">
                <span>SAVED ALTERNATIVE PRODUCT MAPPINGS (Second Grid)</span>
                <span className="section-subtitle">({savedRelationships.length} relationships configured)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: '#333', fontWeight: 'bold' }}>Filter / Search:</span>
                <input
                  type="text"
                  className="alt-prod-input"
                  style={{ width: '200px', height: '24px' }}
                  placeholder="Search code or alternative..."
                  value={recordsFilter}
                  onChange={(e) => setRecordsFilter(e.target.value)}
                />
                {recordsFilter && (
                  <button
                    type="button"
                    className="alt-prod-btn-classic"
                    style={{ height: '24px', minWidth: '65px', padding: '0 6px', fontSize: '11px' }}
                    onClick={() => setRecordsFilter('')}
                  >
                    Show All
                  </button>
                )}
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
                    <th>Linked Alternatives</th>
                    <th style={{ width: '210px', textAlign: 'center' }}>Status</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="empty-table-message">
                        {loadingRelationships ? (
                          <span>Loading saved alternative product mappings...</span>
                        ) : savedRelationships.length === 0 ? (
                          <span>No Alternative Product relationship records found in the database. Enter items above and click Save to create one.</span>
                        ) : (
                          <span>No matching records found for "{recordsFilter}".</span>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((rec, idx) => {
                      const isSelected =
                        rec.mainItemCode?.toUpperCase() === formData.itemCode?.toUpperCase() ||
                        rec.mainItemCode?.toUpperCase() === alreadyAltState?.mainItemCode?.toUpperCase();

                      const isMatchedAlt =
                        alreadyAltState &&
                        (rec.mainItemCode?.toUpperCase() === alreadyAltState.itemCode?.toUpperCase() ||
                          (rec.alternativeItemCodes &&
                            rec.alternativeItemCodes.some((ac) => ac?.toUpperCase() === alreadyAltState.itemCode?.toUpperCase())));

                      return (
                        <tr
                          key={rec._id || rec.mainItemCode}
                          className={`${isSelected ? 'selected' : ''} ${isMatchedAlt ? 'highlight-already-alt' : ''}`}
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
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <span className="badge-count" style={{ alignSelf: 'flex-start' }}>
                                {rec.alternativeCount ?? rec.alternativeItemCodes?.length ?? 0} Alternatives
                              </span>
                              <div style={{ fontSize: '12px', color: isSelected ? '#ffffff' : '#333333' }}>
                                {rec.alternativeItems && rec.alternativeItems.length > 0
                                  ? rec.alternativeItems.map((ai) => `${ai.code} (${ai.description || ''})`).join(' | ')
                                  : (rec.alternativeItemCodes || []).join(', ')}
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="badge-already-alt">
                              This item is already alternative
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="alt-prod-btn-classic"
                              style={{ height: '22px', minWidth: '55px', padding: '0 4px', fontSize: '11px' }}
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

class AlternativeProductErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('AlternativeProduct render error caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="alt-prod-page" style={{ padding: '20px', fontFamily: 'Tahoma, Arial, sans-serif', backgroundColor: '#d4d0c8', minHeight: '100vh' }}>
          <header className="alt-prod-titlebar">
            <span className="alt-prod-titlebar-heading">SOFAST MOTORS - [Alternative Product Error]</span>
          </header>
          <div style={{ background: '#ece9d8', border: '2px solid #005bb7', padding: '24px', margin: '40px auto', maxWidth: '640px', boxShadow: '2px 2px 8px rgba(0,0,0,0.2)' }}>
            <h3 style={{ color: '#b00020', margin: '0 0 12px', fontSize: '15px' }}>⚠️ Unable to display Alternative Product page</h3>
            <p style={{ fontSize: '12px', color: '#333', background: '#fff', border: '1px solid #ccc', padding: '8px', fontFamily: 'monospace' }}>
              {this.state.error?.message || 'A component rendering error occurred.'}
            </p>
            <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="alt-prod-btn-classic"
                style={{ padding: '4px 14px', fontWeight: 'bold' }}
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
              >
                🔄 Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AlternativeProductPage() {
  return (
    <AlternativeProductErrorBoundary>
      <AlternativeProduct />
    </AlternativeProductErrorBoundary>
  );
}

export default AlternativeProductPage;
