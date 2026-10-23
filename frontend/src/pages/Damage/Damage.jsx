import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './Damage.css';

/**
 * SOFAST POS — Data Entry of Damage
 * Classic Windows VB6 / ERP Desktop form under Stock Control System.
 * Recreates the exact UI reference from legacy SOFAST with:
 *  - Header: Date, Supplier selection, Damage No dropdown, and Action buttons (Add a Note, New, Save, Update)
 *  - Item Entry Row: Item Code, Description, Reference, Qty, Cost
 *  - Large Table Area: ActiveX Grid displaying damage items
 */
function Damage() {
  const navigate = useNavigate();

  // Top ERP Menubar navigation state
  const [activeDropdown, setActiveDropdown] = useState(null);
  const menuRef = useRef(null);

  // Notifications
  const [notification, setNotification] = useState(null);
  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  // Header State
  const [damageDate, setDamageDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [damageNumber, setDamageNumber] = useState('');
  const [allDamagesList, setAllDamagesList] = useState([]);
  const [isSavedRecord, setIsSavedRecord] = useState(false);

  // Supplier State
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [suppliersList, setSuppliersList] = useState([]);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');

  // Note State (Add a Note)
  const [noteText, setNoteText] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [tempNoteText, setTempNoteText] = useState('');

  // Damage Items Table State
  const [tableItems, setTableItems] = useState([]);
  const [selectedRowIndex, setSelectedRowIndex] = useState(-1);

  // Line Item Entry Row State
  const [entryItemCode, setEntryItemCode] = useState('');
  const [entryDescription, setEntryDescription] = useState('');
  const [entryReference, setEntryReference] = useState('');
  const [entryQty, setEntryQty] = useState('');
  const [entryCost, setEntryCost] = useState('');
  const [entryAvailableStock, setEntryAvailableStock] = useState(null);

  // Item Lookup Modal State
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemsList, setItemsList] = useState([]);
  const [itemSearch, setItemSearch] = useState('');
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemModalPage, setItemModalPage] = useState(1);
  const ITEM_MODAL_PAGE_SIZE = 50;

  // Item Code Quick Auto-Suggest Dropdown
  const [itemDropdownOpen, setItemDropdownOpen] = useState(false);
  const [highlightedItemIndex, setHighlightedItemIndex] = useState(-1);
  const itemDropdownRef = useRef(null);

  // Loading and Submitting
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Input refs for keyboard navigation
  const itemCodeInputRef = useRef(null);
  const referenceInputRef = useRef(null);
  const qtyInputRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveDropdown(null);
      }
      if (itemDropdownRef.current && !itemDropdownRef.current.contains(e.target)) {
        setItemDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Fetch initial next damage number, damages list, suppliers, and ALL items on mount
  useEffect(() => {
    fetchNextDamageNumber();
    fetchDamagesList();
    fetchSuppliers();
    fetchAllItems();
  }, []);

  const fetchAllItems = async () => {
    setLoadingItems(true);
    try {
      const res = await api.get('/items?limit=all');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setItemsList(res.data.data);
      }
    } catch (err) {
      console.warn('Could not fetch items list:', err);
    } finally {
      setLoadingItems(false);
    }
  };

  const fetchNextDamageNumber = async () => {
    try {
      const res = await api.get('/damages/next-number');
      if (res.data?.success && res.data.data?.damageNumber) {
        setDamageNumber(res.data.data.damageNumber);
        setIsSavedRecord(false);
      }
    } catch (err) {
      console.warn('Could not fetch next damage number:', err);
      // Fallback
      setDamageNumber('DMGN-0003');
    }
  };

  const fetchDamagesList = async () => {
    try {
      const res = await api.get('/damages?limit=250');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setAllDamagesList(res.data.data);
      }
    } catch (err) {
      console.warn('Could not fetch damages list:', err);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await api.get('/suppliers');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setSuppliersList(res.data.data);
      }
    } catch (err) {
      console.warn('Could not fetch suppliers:', err);
    }
  };

  // Load a selected damage record by Damage No
  const handleSelectDamageRecord = async (targetNumber) => {
    if (!targetNumber) return;
    try {
      const res = await api.get(`/damages/${encodeURIComponent(targetNumber)}`);
      if (res.data?.success && res.data.data) {
        const record = res.data.data;
        setDamageNumber(record.damageNumber || record.damageNo);
        setIsSavedRecord(true);

        if (record.date) {
          const formattedDate = new Date(record.date).toISOString().split('T')[0];
          setDamageDate(formattedDate);
        }

        if (record.supplierCode || record.supplierName) {
          setSelectedSupplier({
            code: record.supplierCode || '',
            name: record.supplierName || record.supplierCode || '',
          });
        } else {
          setSelectedSupplier(null);
        }

        setNoteText(record.note || record.remarks || '');

        const lines = Array.isArray(record.lineItems) ? record.lineItems : [];
        setTableItems(
          lines.map((li) => ({
            itemCode: li.itemCode || li.code || '',
            description: li.description || '',
            reference: li.reference || '',
            quantity: Number(li.quantity !== undefined ? li.quantity : li.qty || 0),
            cost: Number(li.cost !== undefined ? li.cost : li.unitCost || 0),
          }))
        );

        // Clear entry draft
        clearItemEntryFields();
        showNotification('info', `Loaded damage record ${record.damageNumber || record.damageNo}`);
      }
    } catch (err) {
      console.error('Failed to load damage record:', err);
      showNotification('error', `Failed to load damage record '${targetNumber}'`);
    }
  };

  // Lookup Item details (cost, description, stock)
  const handleItemLookup = async (codeToLookup) => {
    const cleanCode = (codeToLookup || entryItemCode).trim();
    if (!cleanCode) return;

    // Check local itemsList first for faster canonical resolution
    const localItem = itemsList.find(
      (i) =>
        i.code?.toLowerCase() === cleanCode.toLowerCase() ||
        i.barcode?.toLowerCase() === cleanCode.toLowerCase() ||
        i.barCode?.toLowerCase() === cleanCode.toLowerCase()
    );

    const lookupTarget = localItem?.code || cleanCode;

    try {
      const res = await api.get(`/damages/item-cost/${encodeURIComponent(lookupTarget)}`);
      if (res.data?.success && res.data.data) {
        const { itemCode, description, purchaseCost, availableStock, supplierCode } = res.data.data;
        setEntryItemCode(itemCode || lookupTarget);
        setEntryDescription(description || localItem?.description || '');
        setEntryCost(
          purchaseCost !== null && purchaseCost !== undefined
            ? Number(purchaseCost).toFixed(2)
            : (localItem?.averageCost ? Number(localItem.averageCost).toFixed(2) : '')
        );
        setEntryAvailableStock(
          availableStock !== undefined
            ? availableStock
            : (localItem?.quantity !== undefined ? localItem.quantity : localItem?.stockInHand || 0)
        );

        // Do not auto-fill Qty with available stock! Keep entryQty empty or unchanged
        if (!entryQty) {
          setEntryQty('1');
        }

        // Auto-select supplier if none is selected yet and item has default supplier
        const finalSupplierCode = supplierCode || localItem?.supplierCode || localItem?.suppCode;
        if (!selectedSupplier && finalSupplierCode) {
          const matchedSupp = suppliersList.find(
            (s) => s.code?.toLowerCase() === finalSupplierCode.toLowerCase()
          );
          if (matchedSupp) {
            setSelectedSupplier(matchedSupp);
          }
        }

        // Focus reference or qty
        if (referenceInputRef.current) {
          referenceInputRef.current.focus();
        }
      }
    } catch (err) {
      console.warn('Item lookup error:', err);
      if (localItem) {
        // Fallback to local item if damages/item-cost route errored
        setEntryItemCode(localItem.code);
        setEntryDescription(localItem.description || '');
        setEntryCost(localItem.averageCost ? Number(localItem.averageCost).toFixed(2) : '');
        setEntryAvailableStock(localItem.quantity !== undefined ? localItem.quantity : localItem.stockInHand || 0);
        if (!entryQty) setEntryQty('1');
        if (referenceInputRef.current) referenceInputRef.current.focus();
      } else {
        showNotification('error', `Item '${cleanCode}' not found in Item Master`);
        setEntryDescription('');
        setEntryCost('');
        setEntryAvailableStock(null);
      }
    }
  };

  // Clear single item entry input fields
  const clearItemEntryFields = () => {
    setEntryItemCode('');
    setEntryDescription('');
    setEntryReference('');
    setEntryQty('');
    setEntryCost('');
    setEntryAvailableStock(null);
  };

  // Add validated item row into Table
  const handleAddLineItem = () => {
    const cleanCode = entryItemCode.trim();
    if (!cleanCode) {
      showNotification('error', 'Please enter or select an Item Code');
      itemCodeInputRef.current?.focus();
      return;
    }

    const qtyNum = parseFloat(entryQty);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      showNotification('error', 'Quantity must be greater than zero');
      qtyInputRef.current?.focus();
      return;
    }

    if (entryAvailableStock !== null && entryAvailableStock < qtyNum) {
      showNotification(
        'error',
        `Insufficient sellable stock for '${cleanCode}'. Available: ${entryAvailableStock}, Requested: ${qtyNum}`
      );
      return;
    }

    const costNum = parseFloat(entryCost) || 0;

    // Check for duplicate row
    const existingIndex = tableItems.findIndex(
      (item) => item.itemCode.toLowerCase() === cleanCode.toLowerCase() && item.reference === entryReference.trim()
    );

    if (existingIndex >= 0) {
      // Prompt or update quantity
      const updated = [...tableItems];
      updated[existingIndex].quantity = Math.round((updated[existingIndex].quantity + qtyNum) * 100) / 100;
      setTableItems(updated);
      showNotification('info', `Updated quantity for item '${cleanCode}' in table`);
    } else {
      const newLine = {
        itemCode: cleanCode,
        description: entryDescription || '',
        reference: entryReference.trim(),
        quantity: qtyNum,
        cost: costNum,
      };
      setTableItems([...tableItems, newLine]);
    }

    clearItemEntryFields();
    itemCodeInputRef.current?.focus();
  };

  // Remove a row from the table
  const handleRemoveLineItem = (index) => {
    const updated = tableItems.filter((_, idx) => idx !== index);
    setTableItems(updated);
    if (selectedRowIndex === index) {
      setSelectedRowIndex(-1);
    }
  };

  // Select row for inspection or editing
  const handleSelectTableRow = (index) => {
    setSelectedRowIndex(index);
  };

  // ==========================================================
  // BUTTON ACTIONS: New, Save, Update, Add a Note
  // ==========================================================

  // 1. New Button
  const handleNew = () => {
    if (tableItems.length > 0 && !isSavedRecord) {
      const confirmDiscard = window.confirm(
        'The current damage record has unsaved items. Start a new record and discard unsaved entries?'
      );
      if (!confirmDiscard) return;
    }

    clearItemEntryFields();
    setTableItems([]);
    setSelectedRowIndex(-1);
    setSelectedSupplier(null);
    setNoteText('');
    setDamageDate(new Date().toISOString().split('T')[0]);
    setIsSavedRecord(false);
    fetchNextDamageNumber();
    showNotification('info', 'Started new damage record');
  };

  // 2. Save Button
  const handleSave = async () => {
    if (!damageNumber || !damageNumber.trim()) {
      showNotification('error', 'Damage Number is required');
      return;
    }

    if (tableItems.length === 0) {
      showNotification('error', 'Please add at least one damaged item row to the table before saving');
      itemCodeInputRef.current?.focus();
      return;
    }

    if (isSavedRecord) {
      showNotification(
        'info',
        `Record '${damageNumber}' is already saved. Use 'Update' to modify it, or click 'New' for a new record.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        damageNumber: damageNumber.trim(),
        damageNo: damageNumber.trim(),
        date: damageDate,
        supplierCode: selectedSupplier?.code || '',
        supplierName: selectedSupplier?.name || '',
        lineItems: tableItems.map((item) => ({
          itemCode: item.itemCode,
          code: item.itemCode,
          description: item.description,
          reference: item.reference,
          quantity: item.quantity,
          qty: item.quantity,
          cost: item.cost,
          unitCost: item.cost,
        })),
        note: noteText.trim(),
        remarks: noteText.trim(),
      };

      const res = await api.post('/damages', payload);
      if (res.data?.success) {
        setIsSavedRecord(true);
        showNotification('success', `Damage record '${damageNumber}' saved successfully!`);
        fetchDamagesList();
      } else {
        showNotification('error', res.data?.message || 'Failed to save damage record');
      }
    } catch (err) {
      console.error('Save damage error:', err);
      const errMsg = err.response?.data?.message || err.message || 'Error saving damage record';
      showNotification('error', errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Update Button
  const handleUpdate = async () => {
    if (!damageNumber || !damageNumber.trim()) {
      showNotification('error', 'Damage Number is required');
      return;
    }

    if (tableItems.length === 0) {
      showNotification('error', 'At least one damage item row must be entered');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        date: damageDate,
        supplierCode: selectedSupplier?.code || '',
        supplierName: selectedSupplier?.name || '',
        lineItems: tableItems.map((item) => ({
          itemCode: item.itemCode,
          code: item.itemCode,
          description: item.description,
          reference: item.reference,
          quantity: item.quantity,
          qty: item.quantity,
          cost: item.cost,
          unitCost: item.cost,
        })),
        note: noteText.trim(),
        remarks: noteText.trim(),
      };

      const res = await api.put(`/damages/${encodeURIComponent(damageNumber.trim())}`, payload);
      if (res.data?.success) {
        showNotification('success', `Damage record '${damageNumber}' updated successfully!`);
        fetchDamagesList();
      } else {
        showNotification('error', res.data?.message || 'Failed to update damage record');
      }
    } catch (err) {
      console.error('Update damage error:', err);
      const errMsg = err.response?.data?.message || err.message || 'Error updating damage record';
      showNotification('error', errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Add a Note Button
  const handleOpenNoteModal = () => {
    setTempNoteText(noteText);
    setShowNoteModal(true);
  };

  const handleSaveNote = () => {
    setNoteText(tempNoteText.trim());
    setShowNoteModal(false);
    showNotification('info', 'Note attached to damage record');
  };

  // Item Selection from dropdown or modal
  const handleSelectItem = (item) => {
    if (!item || !item.code) return;
    setItemDropdownOpen(false);
    setHighlightedItemIndex(-1);
    setShowItemModal(false);
    handleItemLookup(item.code);
  };

  // Item Modal selection alias
  const handleSelectItemFromModal = (item) => {
    handleSelectItem(item);
  };

  // Supplier Modal selection
  const handleSelectSupplierFromModal = (supp) => {
    setSelectedSupplier(supp);
    setShowSupplierModal(false);
    showNotification('info', `Selected Supplier: ${supp.name}`);
  };

  // Open Items Lookup Modal
  const handleOpenItemModal = () => {
    setItemSearch(entryItemCode.trim());
    setItemModalPage(1);
    setShowItemModal(true);
    setItemDropdownOpen(false);
    if (itemsList.length === 0) {
      fetchAllItems();
    }
  };

  // Filtered lists for quick dropdown and modals
  const filteredSuppliers = suppliersList.filter((s) => {
    if (!supplierSearch.trim()) return true;
    const q = supplierSearch.toLowerCase();
    return s.code?.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q);
  });

  // Filtered items for quick inline dropdown (Code field)
  const filteredDropdownItems = useMemo(() => {
    const q = String(entryItemCode || '').trim().toLowerCase();
    if (!q) return itemsList.slice(0, 80);
    return itemsList.filter(
      (i) =>
        i.code?.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q) ||
        (i.barcode && String(i.barcode).toLowerCase().includes(q)) ||
        (i.barCode && String(i.barCode).toLowerCase().includes(q))
    );
  }, [itemsList, entryItemCode]);

  // Filtered items for full Item Master Lookup Modal (every item in database)
  const filteredModalItems = useMemo(() => {
    const q = String(itemSearch || '').trim().toLowerCase();
    if (!q) return itemsList;
    return itemsList.filter(
      (i) =>
        i.code?.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q) ||
        (i.barcode && String(i.barcode).toLowerCase().includes(q)) ||
        (i.barCode && String(i.barCode).toLowerCase().includes(q))
    );
  }, [itemsList, itemSearch]);

  const totalItemModalPages = Math.max(1, Math.ceil(filteredModalItems.length / ITEM_MODAL_PAGE_SIZE));
  const pagedModalItems = useMemo(() => {
    const start = (itemModalPage - 1) * ITEM_MODAL_PAGE_SIZE;
    return filteredModalItems.slice(start, start + ITEM_MODAL_PAGE_SIZE);
  }, [filteredModalItems, itemModalPage]);

  // Handle typing in Item Code field
  const handleItemCodeInputChange = (e) => {
    const val = e.target.value;
    setEntryItemCode(val);
    setItemDropdownOpen(true);
    setHighlightedItemIndex(0);

    if (!val.trim()) {
      setEntryDescription('');
      setEntryCost('');
      setEntryAvailableStock(null);
    }
  };

  // Handle keyboard navigation on Item Code field (Arrow keys, Enter, Escape, F2)
  const handleItemCodeKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!itemDropdownOpen) {
        setItemDropdownOpen(true);
        setHighlightedItemIndex(0);
      } else {
        setHighlightedItemIndex((prev) =>
          prev < Math.min(filteredDropdownItems.length, 80) - 1 ? prev + 1 : prev
        );
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (itemDropdownOpen) {
        setHighlightedItemIndex((prev) => (prev > 0 ? prev - 1 : 0));
      }
    } else if (e.key === 'Escape') {
      setItemDropdownOpen(false);
      setHighlightedItemIndex(-1);
    } else if (e.key === 'F2') {
      e.preventDefault();
      handleOpenItemModal();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // 1. If dropdown is open and user highlighted a row
      if (itemDropdownOpen && highlightedItemIndex >= 0 && filteredDropdownItems[highlightedItemIndex]) {
        handleSelectItem(filteredDropdownItems[highlightedItemIndex]);
        return;
      }

      const clean = entryItemCode.trim().toLowerCase();
      if (!clean) {
        handleOpenItemModal();
        return;
      }

      // 2. Exact match in full itemsList
      const exactMatch = itemsList.find(
        (i) =>
          i.code?.toLowerCase() === clean ||
          i.barcode?.toLowerCase() === clean ||
          i.barCode?.toLowerCase() === clean
      );
      if (exactMatch) {
        handleSelectItem(exactMatch);
        return;
      }

      // 3. First dropdown match
      if (filteredDropdownItems.length > 0) {
        handleSelectItem(filteredDropdownItems[0]);
        return;
      }

      // 4. Fallback to API lookup
      handleItemLookup(entryItemCode);
      setItemDropdownOpen(false);
    }
  };

  return (
    <div className="damage-window-wrapper">
      {/* 1. Window Title Bar (Matches classic Windows Data Entry of Damage titlebar) */}
      <div className="damage-window-titlebar">
        <div className="damage-titlebar-left">
          {/* Orange folder icon matching screenshot */}
          <svg className="damage-titlebar-icon" viewBox="0 0 24 24">
            <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
          </svg>
          <span className="damage-titlebar-text">Data Entry of Damage</span>
        </div>
        <div className="damage-titlebar-controls">
          <button type="button" className="damage-titlebar-btn" aria-label="Minimize">&#8212;</button>
          <button type="button" className="damage-titlebar-btn" aria-label="Maximize">&#9633;</button>
          <button
            type="button"
            className="damage-titlebar-btn close"
            aria-label="Close"
            onClick={() => navigate('/management')}
          >
            &#x2715;
          </button>
        </div>
      </div>

      {/* 2. Top Navigation Menubar (SOFAST Standard ERP Nav) */}
      <nav className="damage-menubar-container" ref={menuRef}>
        <ul className="damage-menubar">
          <li className="damage-menubar-item">
            <button
              type="button"
              className={`damage-menubar-btn ${activeDropdown === 'master-files' ? 'active' : ''}`}
              onClick={() => setActiveDropdown(activeDropdown === 'master-files' ? null : 'master-files')}
            >
              Master Files
            </button>
            {activeDropdown === 'master-files' && (
              <ul className="damage-dropdown-menu">
                <li className="damage-dropdown-entry">
                  <button type="button" className="damage-dropdown-item-btn" onClick={() => navigate('/item-master')}>
                    Item Master
                  </button>
                </li>
                <li className="damage-dropdown-entry">
                  <button type="button" className="damage-dropdown-item-btn" onClick={() => navigate('/supplier-master')}>
                    Supplier Master
                  </button>
                </li>
                <li className="damage-dropdown-entry">
                  <button type="button" className="damage-dropdown-item-btn" onClick={() => navigate('/customer-details')}>
                    Customer Details
                  </button>
                </li>
                <li className="damage-dropdown-entry">
                  <button type="button" className="damage-dropdown-item-btn" onClick={() => navigate('/alternative-product')}>
                    Alternative Product
                  </button>
                </li>
              </ul>
            )}
          </li>

          <li className="damage-menubar-item">
            <button
              type="button"
              className={`damage-menubar-btn active ${activeDropdown === 'stock-control' ? 'active' : ''}`}
              onClick={() => setActiveDropdown(activeDropdown === 'stock-control' ? null : 'stock-control')}
            >
              Stock Control System
            </button>
            {activeDropdown === 'stock-control' && (
              <ul className="damage-dropdown-menu">
                <li className="damage-dropdown-entry">
                  <button type="button" className="damage-dropdown-item-btn" onClick={() => navigate('/grn')}>
                    Good Receive Note (GRN)
                  </button>
                </li>
                <li className="damage-dropdown-entry">
                  <button
                    type="button"
                    className="damage-dropdown-item-btn"
                    style={{ fontWeight: 700, color: '#1d4ed8' }}
                    onClick={() => setActiveDropdown(null)}
                  >
                    Damage
                  </button>
                </li>
              </ul>
            )}
          </li>

          <li className="damage-menubar-item">
            <button
              type="button"
              className={`damage-menubar-btn ${activeDropdown === 'sales-service' ? 'active' : ''}`}
              onClick={() => setActiveDropdown(activeDropdown === 'sales-service' ? null : 'sales-service')}
            >
              Sales and Service
            </button>
            {activeDropdown === 'sales-service' && (
              <ul className="damage-dropdown-menu">
                <li className="damage-dropdown-entry">
                  <button type="button" className="damage-dropdown-item-btn" onClick={() => navigate('/invoice')}>
                    Create Invoice
                  </button>
                </li>
                <li className="damage-dropdown-entry">
                  <button type="button" className="damage-dropdown-item-btn" onClick={() => navigate('/settlement-invoice')}>
                    Settlement Invoice
                  </button>
                </li>
                <li className="damage-dropdown-entry">
                  <button type="button" className="damage-dropdown-item-btn" onClick={() => navigate('/remaining-balance')}>
                    Remaining Balance
                  </button>
                </li>
              </ul>
            )}
          </li>

          <li className="damage-menubar-item">
            <button type="button" className="damage-menubar-btn" onClick={() => navigate('/management')}>
              Production
            </button>
          </li>
          <li className="damage-menubar-item">
            <button type="button" className="damage-menubar-btn" onClick={() => navigate('/reports')}>
              Reports
            </button>
          </li>
          <li className="damage-menubar-item">
            <button type="button" className="damage-menubar-btn" onClick={() => navigate('/management')}>
              Accounting
            </button>
          </li>
          <li className="damage-menubar-item">
            <button type="button" className="damage-menubar-btn" onClick={() => navigate('/printer-setup')}>
              Administration
            </button>
          </li>
        </ul>
      </nav>

      {/* 3. Main Form Area */}
      <main className="damage-main-content">
        {/* Outer 3D Bevelled Frame (Preserving exact reference UI appearance) */}
        <div className="damage-outer-frame">
          {/* Notification Banner */}
          {notification && (
            <div className={`damage-notification ${notification.type}`}>
              <span>{notification.message}</span>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                onClick={() => setNotification(null)}
              >
                &#x2715;
              </button>
            </div>
          )}

          {/* Header Section: Row 1 (Date, Supplier) & Row 2 (Damage No, Buttons) */}
          <section className="damage-header-grid">
            {/* Header Row 1: Date & Supplier */}
            <div className="damage-header-row-1">
              {/* Date . . . . . . . . [ActiveX] */}
              <div className="damage-date-group">
                <label className="damage-blue-label">Date . . . . . . . .</label>
                <div className="damage-activex-date-box">
                  <input
                    type="date"
                    className="damage-date-input"
                    value={damageDate}
                    onChange={(e) => setDamageDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Supplier . . . [ActiveX] */}
              <div className="damage-supplier-group">
                <label className="damage-blue-label">Supplier . . .</label>
                <div
                  className="damage-activex-supplier-box"
                  onClick={() => setShowSupplierModal(true)}
                  title="Click to search and select supplier from Supplier Master"
                >
                  <span className={`damage-supplier-text ${!selectedSupplier ? 'damage-supplier-placeholder' : ''}`}>
                    {selectedSupplier
                      ? `${selectedSupplier.name} (${selectedSupplier.code})`
                      : '[Select Supplier - Click here to search Supplier Master]'}
                  </span>
                  <button
                    type="button"
                    className="damage-lookup-trigger-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSupplierModal(true);
                    }}
                  >
                    &#9660;
                  </button>
                </div>
              </div>
            </div>

            {/* Header Row 2: Damage No & 4 Action Buttons */}
            <div className="damage-header-row-2">
              {/* Damage No . . . [ v] */}
              <div className="damage-no-group">
                <label className="damage-blue-label">Damage No . . .</label>
                <div className="damage-combobox-wrapper">
                  <select
                    className="damage-select-input"
                    value={damageNumber}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'NEW') {
                        handleNew();
                      } else {
                        handleSelectDamageRecord(val);
                      }
                    }}
                  >
                    {/* Active damage number */}
                    {damageNumber && (
                      <option value={damageNumber}>{damageNumber}</option>
                    )}
                    <option disabled>──────────</option>
                    <option value="NEW">+ Start New Damage No</option>
                    <option disabled>── Saved Records ──</option>
                    {allDamagesList.map((d) => {
                      const num = d.damageNumber || d.damageNo;
                      return (
                        <option key={d._id || num} value={num}>
                          {num} {d.supplierName ? `- ${d.supplierName}` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* 4 Action Buttons: Add a Note, New, Save, Update */}
              <div className="damage-buttons-group">
                <button
                  type="button"
                  className="damage-classic-btn"
                  onClick={handleOpenNoteModal}
                  title="Enter and save notes for this damage record"
                >
                  Add a Note {noteText ? '•' : ''}
                </button>

                <button
                  type="button"
                  className="damage-classic-btn"
                  onClick={handleNew}
                  title="Start a new damage record"
                >
                  New
                </button>

                <button
                  type="button"
                  className="damage-classic-btn"
                  onClick={handleSave}
                  disabled={isSubmitting || isSavedRecord}
                  title="Validate and save damage record"
                >
                  {isSubmitting ? 'Saving...' : 'Save'}
                </button>

                <button
                  type="button"
                  className="damage-classic-btn"
                  onClick={handleUpdate}
                  disabled={isSubmitting || !isSavedRecord}
                  title="Update existing damage record"
                >
                  {isSubmitting ? 'Updating...' : 'Update'}
                </button>
              </div>
            </div>
          </section>

          {/* Item Entry Section: Blue Column Labels and Inputs Row */}
          <section className="damage-item-entry-section">
            {/* Blue Column Labels (Positions matching screenshot) */}
            <div className="damage-column-labels-row">
              <div className="col-header col-item-code">Item Code</div>
              <div className="col-header col-description">Description</div>
              <div className="col-header col-reference">Reference</div>
              <div className="col-header col-qty">Qty</div>
              <div className="col-header col-cost">Cost</div>
            </div>

            {/* Input Row */}
            <div className="damage-item-inputs-row">
              {/* Item Code Input with Quick Auto-Suggest Dropdown */}
              <div className="damage-input-cell item-code" ref={itemDropdownRef}>
                <input
                  ref={itemCodeInputRef}
                  type="text"
                  className="damage-text-input"
                  placeholder="Type or F2"
                  value={entryItemCode}
                  onChange={handleItemCodeInputChange}
                  onFocus={() => {
                    if (entryItemCode.trim()) {
                      setItemDropdownOpen(true);
                    }
                  }}
                  onKeyDown={handleItemCodeKeyDown}
                  onBlur={() => {
                    // Small delay to allow clicking dropdown item
                    setTimeout(() => {
                      if (entryItemCode.trim() && !entryDescription) {
                        handleItemLookup(entryItemCode);
                      }
                    }, 200);
                  }}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="damage-item-search-btn"
                  onClick={handleOpenItemModal}
                  title="Search all items from Item Master (F2)"
                >
                  &#128269;
                </button>

                {/* Quick Auto-suggest Dropdown */}
                {itemDropdownOpen && filteredDropdownItems.length > 0 && (
                  <div className="damage-item-dropdown-panel">
                    <div className="damage-item-dropdown-header">
                      <span>Code</span>
                      <span>Description</span>
                      <span style={{ textAlign: 'right' }}>Stock</span>
                    </div>
                    <div className="damage-item-dropdown-list">
                      {filteredDropdownItems.slice(0, 80).map((item, idx) => (
                        <div
                          key={item._id || item.code}
                          className={`damage-item-dropdown-row ${highlightedItemIndex === idx ? 'highlighted' : ''}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectItem(item);
                          }}
                          onMouseEnter={() => setHighlightedItemIndex(idx)}
                        >
                          <span className="dropdown-col-code">{item.code}</span>
                          <span className="dropdown-col-desc">{item.description}</span>
                          <span className="dropdown-col-stock">
                            {item.quantity !== undefined ? item.quantity : item.stockInHand || 0}
                          </span>
                        </div>
                      ))}
                    </div>
                    {filteredDropdownItems.length > 80 && (
                      <div className="damage-item-dropdown-footer">
                        Showing 80 of {filteredDropdownItems.length} matching items. Press F2 for all.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Description (Automatic from Item Master) */}
              <div className="damage-input-cell description" title={entryDescription}>
                <span>{entryDescription || ''}</span>
              </div>

              {/* Reference (Editable e.g. GRN #, Supplier Invoice #) */}
              <div className="damage-input-cell reference">
                <input
                  ref={referenceInputRef}
                  type="text"
                  className="damage-text-input"
                  placeholder="GRN / Inv / Ref"
                  value={entryReference}
                  onChange={(e) => setEntryReference(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      qtyInputRef.current?.focus();
                    }
                  }}
                />
              </div>

              {/* Qty (Actual purchase/damage quantity entered by user; NOT total stock) */}
              <div className="damage-input-cell qty">
                <input
                  ref={qtyInputRef}
                  type="number"
                  min="0.01"
                  step="any"
                  className="damage-text-input right-align"
                  placeholder="Qty"
                  value={entryQty}
                  onChange={(e) => setEntryQty(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddLineItem();
                    }
                  }}
                />
              </div>

              {/* Cost (Automatic purchase cost from latest GRN / Item Master; NOT selling price) */}
              <div className="damage-input-cell cost">
                <span>{entryCost ? Number(entryCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</span>
              </div>
            </div>

            {/* Quick action bar under inputs */}
            <div className="damage-entry-action-bar">
              <span>
                {entryAvailableStock !== null && (
                  <span>Available Sellable Stock: <strong>{entryAvailableStock}</strong> | </span>
                )}
                Press <strong>Enter</strong> in Qty or click Add Item to append row to the table.
              </span>
              <button
                type="button"
                className="damage-add-item-btn"
                onClick={handleAddLineItem}
              >
                + Add Item to Table
              </button>
            </div>
          </section>

          {/* Large Table Area (ActiveX Grid displaying damage items) */}
          <section className="damage-table-container">
            <table className="damage-grid-table">
              <thead>
                <tr className="damage-grid-header">
                  <th style={{ width: '160px' }}>Item Code</th>
                  <th>Description</th>
                  <th style={{ width: '180px' }}>Reference</th>
                  <th style={{ width: '85px' }} className="text-right">Qty</th>
                  <th style={{ width: '110px' }} className="text-right">Cost</th>
                  <th style={{ width: '50px' }} className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {tableItems.map((item, idx) => (
                  <tr
                    key={`${item.itemCode}-${idx}`}
                    className={`damage-grid-row ${selectedRowIndex === idx ? 'selected' : ''}`}
                    onClick={() => handleSelectTableRow(idx)}
                  >
                    <td>{item.itemCode}</td>
                    <td>{item.description}</td>
                    <td>{item.reference}</td>
                    <td className="text-right">{item.quantity}</td>
                    <td className="text-right">
                      {item.cost ? Number(item.cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                    </td>
                    <td className="action-cell">
                      <button
                        type="button"
                        className="damage-row-remove-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveLineItem(idx);
                        }}
                        title="Remove row"
                      >
                        &#x2715;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* If table is empty, show classic ActiveX grid watermark/notice */}
            {tableItems.length === 0 && (
              <div className="damage-empty-grid-notice">
                <span className="damage-activex-watermark">[ActiveX Grid]</span>
                <span>No damaged items entered. Enter an Item Code above and press Enter to add.</span>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* ==========================================================
          MODALS: Add a Note, Supplier Lookup, Item Lookup
          ========================================================== */}

      {/* 1. Add a Note Modal */}
      {showNoteModal && (
        <div className="damage-modal-backdrop" onClick={() => setShowNoteModal(false)}>
          <div className="damage-classic-dialog dialog-note" onClick={(e) => e.stopPropagation()}>
            <div className="damage-dialog-titlebar">
              <span>Add a Note - Damage Record</span>
              <button type="button" className="damage-dialog-close-btn" onClick={() => setShowNoteModal(false)}>
                &#x2715;
              </button>
            </div>
            <div className="damage-dialog-body">
              <label className="damage-blue-label">Damage Notes / Remarks:</label>
              <textarea
                className="damage-note-textarea"
                placeholder="Enter notes related to the damage record (e.g. defect reason, consignment notes, batch details)..."
                value={tempNoteText}
                onChange={(e) => setTempNoteText(e.target.value)}
                autoFocus
              />
            </div>
            <div className="damage-dialog-footer">
              <button type="button" className="damage-classic-btn" onClick={handleSaveNote}>
                Save Note
              </button>
              <button type="button" className="damage-classic-btn" onClick={() => setShowNoteModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Supplier Lookup Modal */}
      {showSupplierModal && (
        <div className="damage-modal-backdrop" onClick={() => setShowSupplierModal(false)}>
          <div className="damage-classic-dialog dialog-lookup" onClick={(e) => e.stopPropagation()}>
            <div className="damage-dialog-titlebar">
              <span>Select Supplier (Supplier Master)</span>
              <button type="button" className="damage-dialog-close-btn" onClick={() => setShowSupplierModal(false)}>
                &#x2715;
              </button>
            </div>
            <div className="damage-dialog-body">
              <div className="damage-lookup-search-bar">
                <label className="damage-blue-label">Search:</label>
                <input
                  type="text"
                  className="damage-lookup-search-input"
                  placeholder="Search by supplier name or code..."
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="damage-lookup-list-container">
                <table className="damage-lookup-table">
                  <thead>
                    <tr>
                      <th style={{ width: '100px' }}>Code</th>
                      <th>Supplier Name</th>
                      <th>Telephone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSuppliers.map((supp) => (
                      <tr key={supp._id || supp.code} onClick={() => handleSelectSupplierFromModal(supp)}>
                        <td><strong>{supp.code}</strong></td>
                        <td>{supp.name}</td>
                        <td>{supp.telephone1 || supp.telephone || '-'}</td>
                      </tr>
                    ))}
                    {filteredSuppliers.length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                          No suppliers found matching search
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="damage-dialog-footer">
              <button type="button" className="damage-classic-btn" onClick={() => setShowSupplierModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Item Master Lookup Modal (All 5,993 Items Searchable) */}
      {showItemModal && (
        <div className="damage-modal-backdrop" onClick={() => setShowItemModal(false)}>
          <div className="damage-classic-dialog dialog-lookup dialog-item-lookup" onClick={(e) => e.stopPropagation()}>
            <div className="damage-dialog-titlebar">
              <span>Select Item (Item Master) — Total: {itemsList.length} items</span>
              <button type="button" className="damage-dialog-close-btn" onClick={() => setShowItemModal(false)}>
                &#x2715;
              </button>
            </div>
            <div className="damage-dialog-body">
              <div className="damage-lookup-search-bar">
                <label className="damage-blue-label">Search:</label>
                <input
                  type="text"
                  className="damage-lookup-search-input"
                  placeholder="Search across all items by code, description, category, barcode..."
                  value={itemSearch}
                  onChange={(e) => {
                    setItemSearch(e.target.value);
                    setItemModalPage(1);
                  }}
                  autoFocus
                />
                {itemSearch && (
                  <button
                    type="button"
                    className="damage-lookup-clear-btn"
                    onClick={() => {
                      setItemSearch('');
                      setItemModalPage(1);
                    }}
                    title="Clear search"
                  >
                    &#x2715;
                  </button>
                )}
              </div>

              {/* Status and Paging Info Bar */}
              <div className="damage-lookup-status-bar">
                <span>
                  Showing {pagedModalItems.length > 0 ? (itemModalPage - 1) * ITEM_MODAL_PAGE_SIZE + 1 : 0} -{' '}
                  {Math.min(itemModalPage * ITEM_MODAL_PAGE_SIZE, filteredModalItems.length)} of{' '}
                  <strong>{filteredModalItems.length}</strong> matching items{' '}
                  {itemsList.length > 0 ? `(out of all ${itemsList.length} items in Item Master)` : ''}
                </span>

                {totalItemModalPages > 1 && (
                  <div className="damage-lookup-pagination">
                    <button
                      type="button"
                      className="damage-page-btn"
                      disabled={itemModalPage <= 1}
                      onClick={() => setItemModalPage((p) => Math.max(1, p - 1))}
                    >
                      &laquo; Prev
                    </button>
                    <span className="damage-page-info">
                      Page {itemModalPage} of {totalItemModalPages}
                    </span>
                    <button
                      type="button"
                      className="damage-page-btn"
                      disabled={itemModalPage >= totalItemModalPages}
                      onClick={() => setItemModalPage((p) => Math.min(totalItemModalPages, p + 1))}
                    >
                      Next &raquo;
                    </button>
                  </div>
                )}
              </div>

              <div className="damage-lookup-list-container">
                {loadingItems && itemsList.length === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: '#555' }}>
                    Loading all items from Item Master...
                  </div>
                ) : (
                  <table className="damage-lookup-table">
                    <thead>
                      <tr>
                        <th style={{ width: '130px' }}>Item Code</th>
                        <th>Description</th>
                        <th style={{ width: '100px' }}>Category</th>
                        <th style={{ width: '75px', textAlign: 'right' }}>Stock</th>
                        <th style={{ width: '85px', textAlign: 'right' }}>Avg Cost</th>
                        <th style={{ width: '60px', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedModalItems.map((itm) => (
                        <tr key={itm._id || itm.code} onClick={() => handleSelectItem(itm)}>
                          <td><strong style={{ color: '#000080' }}>{itm.code}</strong></td>
                          <td>{itm.description}</td>
                          <td>{itm.category || '-'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                            {itm.quantity !== undefined ? itm.quantity : itm.stockInHand || 0}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {itm.averageCost ? Number(itm.averageCost).toFixed(2) : '-'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="damage-classic-btn"
                              style={{ height: '20px', minWidth: '45px', padding: '0 4px', fontSize: '10px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectItem(itm);
                              }}
                            >
                              Select
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredModalItems.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
                            No items found matching "{itemSearch}". Every item in the database (all {itemsList.length} items) is searched.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            <div className="damage-dialog-footer">
              <button type="button" className="damage-classic-btn" onClick={() => setShowItemModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Damage;
