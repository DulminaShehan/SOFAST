import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ClassicNavbar from '../../components/navigation/ClassicNavbar';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { handleEnterNavigation } from '../../hooks/useEnterKeyNavigation';
import api from '../../services/api';
import './GoodReceiveNote.css';

// Classic window icon
const windowIcon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23f59e0b' d='M12 2L2 7l10 5 10-5-10-5z'/%3E%3Cpath fill='%232563eb' d='M2 17l10 5V12L2 7v10z'/%3E%3Cpath fill='%231d4ed8' d='M22 17l-10 5V12l10-5v10z'/%3E%3C/svg%3E";

/**
 * Good Receive Note (GRN) Module
 * Recreates the exact Visual Basic / Classic ERP layout and workflow from legacy SOFAST
 */
function GoodReceiveNote() {
  const navigate = useNavigate();

  // Navigation Menubar state
  const [activeDropdown, setActiveDropdown] = useState(null);
  const menuRef = useRef(null);

  // Backend Data State
  const [suppliersList, setSuppliersList] = useState([]);
  const [grnList, setGrnList] = useState([]);
  const [itemsList, setItemsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Active GRN Record State
  const [activeGrnId, setActiveGrnId] = useState(null);
  const [isRecordPosted, setIsRecordPosted] = useState(false);
  const [grnHeader, setGrnHeader] = useState({
    no: '',
    grnNumber: '',
    date: new Date().toISOString().split('T')[0],
    supplierCode: '',
    supplierName: '',
    paidBy: 'Cash',
    supplierInvoiceNo: '',
    masterPo: '',
    useBarcode: false,
    remark: '',
  });

  // Items added to the current GRN table
  const [lineItems, setLineItems] = useState([]);
  const [selectedLineIndex, setSelectedLineIndex] = useState(-1);

  // Item Entry Draft (Top Input Row)
  const [itemEntry, setItemEntry] = useState({
    code: '',
    description: '',
    price: '',
    sellPrice: '',
    quantity: '',
    discount: '0',
    value: '0.00',
    location: 'Main Store',
    closingStock: '',
    lastGrn: '',
    lpc: '',
    isManualItem: false,
    manualItemId: null,
    manualCode: '',
    previouslySoldQty: 0,
  });

  // Tracked Unregistered Manual Items from Manual Stock Report
  const [trackedManualItems, setTrackedManualItems] = useState([]);
  const [potentialManualMatch, setPotentialManualMatch] = useState(null);
  const [lookupItemTab, setLookupItemTab] = useState('master'); // 'master' | 'manual'

  // Item GRN History State
  const [itemHistory, setItemHistory] = useState([]);
  const [gridMode, setGridMode] = useState('current'); // 'current' | 'history'
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(-1);

  // Lookup Modals
  const [lookupModal, setLookupModal] = useState({
    isOpen: false,
    type: null, // 'supplier' | 'item'
    title: '',
    search: '',
  });

  // Validate Modal
  const [validateModal, setValidateModal] = useState({
    isOpen: false,
    isValid: false,
    errors: [],
    summary: null,
  });

  // Discount Modal
  const [discountModal, setDiscountModal] = useState({
    isOpen: false,
    discountPercent: '',
  });

  // Ref for Code Input focus
  const itemCodeInputRef = useRef(null);
  const grnPriceInputRef = useRef(null);
  const grnSellPriceInputRef = useRef(null);
  const grnQtyInputRef = useRef(null);
  const grnDiscountInputRef = useRef(null);
  const { confirmSave, confirmDelete, showConfirm } = useConfirmDialog();

  // Menubar items
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
      id: 'customer-details',
      label: 'Customer Details',
      path: '/customer-details',
      renderIcon: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
        </svg>
      ),
    },
    {
      id: 'alternative-product',
      label: 'Alternative Product',
      path: '/alternative-product',
      renderIcon: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      ),
    },
  ];

  const stockControlDropdownItems = [
    {
      id: 'good-receive-note',
      label: 'Good Receive Note (GRN)',
      path: '/grn',
      renderIcon: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      id: 'good-return-note',
      label: 'Good Return Note (GREN)',
      path: '/good-return-note',
      renderIcon: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
          <path d="M9 14l-4-4 4-4" />
          <path d="M5 10h11a4 4 0 1 1 0 8h-1" />
        </svg>
      ),
    },
    {
      id: 'damage',
      label: 'Damage',
      path: '/damage',
      renderIcon: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    },
  ];

  const salesServiceDropdownItems = [
    {
      id: 'create-invoice',
      label: 'Create Invoice',
      path: '/invoice',
      renderIcon: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
          <path d="M9 14l6-6m-6 0l6 6m-9 7h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'settlement-invoice',
      label: 'Settlement Invoice',
      path: '/settlement-invoice',
      renderIcon: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      ),
    },
    {
      id: 'remaining-balance',
      label: 'Remaining Balance',
      path: '/remaining-balance',
      renderIcon: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
    },
    {
      id: 'customer-return-exchange',
      label: 'Customer Return / Exchange',
      path: '/customer-return-exchange',
      renderIcon: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
          <path d="M3 10h10a5 5 0 0 1 5 5v2m0 0l-3-3m3 3l3-3M3 10l3-3m-3 3l3 3" />
        </svg>
      ),
    },
  ];

  // Load initial data (Suppliers, Items, Next GRN Number, GRN list)
  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [suppRes, nextNumRes, grnsRes, itemsRes, manualRes] = await Promise.all([
        api.get('/suppliers').catch(() => null),
        api.get('/grn/next-number').catch(() => null),
        api.get('/grn?limit=100').catch(() => null),
        api.get('/items?limit=all').catch(() => null),
        api.get('/manual-items/lookup?limit=all').catch(() => null),
      ]);

      if (suppRes?.data?.data) {
        setSuppliersList(suppRes.data.data);
      }
      if (nextNumRes?.data?.data) {
        setGrnHeader((prev) => ({
          ...prev,
          no: nextNumRes.data.data.no !== undefined ? nextNumRes.data.data.no : '',
          grnNumber: nextNumRes.data.data.grnNumber !== undefined ? String(nextNumRes.data.data.grnNumber) : '',
        }));
      }
      if (grnsRes?.data?.data) {
        setGrnList(grnsRes.data.data);
      }
      if (itemsRes?.data?.data) {
        setItemsList(itemsRes.data.data);
      }
      if (manualRes?.data?.data) {
        setTrackedManualItems(manualRes.data.data.filter((it) => it.status !== 'Converted'));
      }
    } catch (e) {
      showNotification('Failed to initialize GRN form data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Close menubar dropdowns on outside click
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
    }, 4500);
  };

  /**
   * Helper: decimal-safe calculation of item line value
   * Line Gross = Purchase Price * Quantity
   * Discount Amount = Line Gross * Discount Percentage / 100
   * Line Value = Line Gross - Discount Amount
   */
  const computeItemValue = (priceVal, qtyVal, discPctVal) => {
    const price = parseFloat(priceVal) || 0;
    const qty = parseFloat(qtyVal) || 0;
    const discPct = Math.min(100, Math.max(0, parseFloat(discPctVal) || 0));

    const lineGross = Math.round(price * qty * 100) / 100;
    const discountAmount = Math.round(((lineGross * discPct) / 100) * 100) / 100;
    const val = Math.max(0, Math.round((lineGross - discountAmount) * 100) / 100);

    return val.toFixed(2);
  };

  // Helper: compute total value of all line items
  const totalGrnValue = lineItems.reduce((acc, item) => acc + (parseFloat(item.value) || 0), 0);

  // Handle GRN Header Changes
  const handleHeaderChange = (e) => {
    const { name, value, type, checked } = e.target;
    const finalVal = type === 'checkbox' ? checked : value;

    setGrnHeader((prev) => ({
      ...prev,
      [name]: finalVal,
    }));

    // If typing supplier code directly, match supplier name
    if (name === 'supplierCode') {
      const trimmed = String(value || '').trim();
      if (!trimmed) {
        setGrnHeader((prev) => ({ ...prev, supplierCode: '', supplierName: '' }));
        return;
      }

      // Direct code match
      let match = suppliersList.find(
        (s) => s.code?.toLowerCase() === trimmed.toLowerCase()
      );

      // Value contains " - " (e.g. "RAT - RATHNASIRI")
      if (!match && trimmed.includes(' - ')) {
        const codePart = trimmed.split(' - ')[0].trim();
        match = suppliersList.find(
          (s) => s.code?.toLowerCase() === codePart.toLowerCase()
        );
      }

      // Match by name
      if (!match) {
        match = suppliersList.find(
          (s) => s.name?.toLowerCase() === trimmed.toLowerCase()
        );
      }

      if (match) {
        setGrnHeader((prev) => ({
          ...prev,
          supplierCode: match.code,
          supplierName: match.name,
        }));
      }
    }
  };

  // Handle existing GRN selection from dropdown
  const handleSelectExistingGrn = async (grnNum) => {
    if (!grnNum) return;
    try {
      setLoading(true);
      const res = await api.get(`/grn/${grnNum}`);
      if (res.data && res.data.data) {
        const g = res.data.data;
        setActiveGrnId(g._id);
        setIsRecordPosted(Boolean(g.isPosted));
        setGrnHeader({
          no: g.no !== undefined ? g.no : '',
          grnNumber: g.grnNumber || '',
          date: g.date ? new Date(g.date).toISOString().split('T')[0] : '',
          supplierCode: g.supplierCode || g.supplier || '',
          supplierName: g.supplierName || '',
          paidBy: g.paidBy || 'Cash',
          supplierInvoiceNo: g.supplierInvoiceNo || g.invoice || '',
          masterPo: g.masterPo || '',
          useBarcode: Boolean(g.useBarcode),
          remark: g.remark || '',
        });

        const formattedItems = (g.lineItems || []).map((li) => ({
          code: li.code || li.itemCode || '',
          description: li.description || '',
          price: li.unitPrice !== undefined ? li.unitPrice : (li.price || 0),
          sellPrice: li.sellingPrice || 0,
          quantity: li.quantity !== undefined ? li.quantity : (li.qty || 1),
          discount: li.discount !== undefined ? li.discount : 0,
          value: li.value !== undefined ? li.value : (li.totalValue || 0),
          location: li.locationCode || 'Main Store',
        }));

        setLineItems(formattedItems);
        setSelectedLineIndex(-1);
        setItemHistory([]);
        setGridMode('current');
        setSelectedHistoryIndex(-1);
        showNotification(`Loaded GRN '${g.grnNumber}' (${g.isPosted ? 'POSTED' : 'DRAFT'})`, 'info');
      }
    } catch (err) {
      showNotification('Failed to load selected GRN', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Toggle between Current GRN items and Item History
  const toggleGridMode = () => {
    if (gridMode === 'history') {
      setGridMode('current');
    } else {
      if (itemEntry.code && itemHistory.length === 0) {
        fetchItemHistory(itemEntry.code, itemEntry.location);
      }
      setGridMode('history');
    }
  };

  // Load real historical GRN records for selected item
  const fetchItemHistory = async (itemCode, loc) => {
    if (!itemCode || !itemCode.trim()) {
      setItemHistory([]);
      return;
    }
    const cleanCode = itemCode.trim();
    try {
      const locParam = loc ? `?location=${encodeURIComponent(loc)}` : '';
      const res = await api.get(`/grn/item-history/${encodeURIComponent(cleanCode)}${locParam}`);
      if (res.data && res.data.success) {
        const { history, summary, item: backendItem } = res.data.data;
        setItemHistory(history || []);
        setSelectedHistoryIndex(-1);
        setGridMode('history');

        // Safely update bottom fields and entry values with real DB history
        setItemEntry((prev) => {
          if (prev.code && prev.code.trim().toLowerCase() !== cleanCode.toLowerCase()) {
            return prev;
          }
          const lpcVal = summary?.lpc !== undefined && summary.lpc !== null ? summary.lpc : prev.lpc;
          const unitPrice =
            prev.price !== '' && prev.price !== '0' && prev.price !== 0
              ? prev.price
              : summary?.lpc > 0
              ? summary.lpc
              : backendItem?.lastGrnPrice || prev.price || '';
          const qtyVal = prev.quantity || 1;
          const discVal = prev.discount || '0';

          return {
            ...prev,
            closingStock: summary?.closingStock !== undefined ? summary.closingStock : prev.closingStock,
            location: summary?.location || prev.location || 'Main Store',
            lastGrn: summary?.lastGrn || prev.lastGrn || '-',
            lpc: lpcVal,
            price: unitPrice,
            sellPrice:
              prev.sellPrice !== ''
                ? prev.sellPrice
                : backendItem?.finalSellingPrice || backendItem?.sellingPrice || '',
            description: prev.description || backendItem?.description || '',
            value: computeItemValue(unitPrice, qtyVal, discVal),
          };
        });
      }
    } catch (err) {
      setItemHistory([]);
    }
  };

  // Populate item details when matching an item
  const populateItemDetails = (item, currentQty = 1, currentDiscount = '0') => {
    const unitPrice = item.lastGrnPrice || item.averageCost || 0;
    const sellPrice = item.finalSellingPrice || item.sellingPrice || 0;
    const stock = item.quantity !== undefined ? item.quantity : (item.stockInHand !== undefined ? item.stockInHand : 0);
    const loc = item.location || 'Main Store';
    const lastGrnInfo = item.lastGrn || item.lastGrnDate || '-';
    const lpcVal = item.lastGrnPrice !== undefined ? Number(item.lastGrnPrice).toFixed(2) : '0.00';

    return {
      code: item.code || '',
      description: item.description || '',
      price: unitPrice,
      sellPrice: sellPrice,
      quantity: currentQty || 1,
      discount: currentDiscount || '0',
      value: computeItemValue(unitPrice, currentQty || 1, currentDiscount || '0'),
      location: loc,
      closingStock: stock,
      lastGrn: lastGrnInfo,
      lpc: lpcVal,
    };
  };

  // Handle Item Entry Changes (Live Calculation)
  const handleItemEntryChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...itemEntry, [name]: value };

    // When typing Item Code: allow user to freely type without premature auto-filling or overwriting!
    if (name === 'code') {
      const clean = value.trim().toLowerCase();
      if (!clean) {
        setItemHistory([]);
        setPotentialManualMatch(null);
        if (lineItems.length > 0) setGridMode('current');
      } else {
        const mMatch = trackedManualItems.find(
          (m) =>
            m.manualCode?.toLowerCase() === clean ||
            (clean.length >= 3 && m.description?.toLowerCase().includes(clean))
        );
        if (mMatch && !itemEntry.isManualItem) {
          setPotentialManualMatch(mMatch);
        } else {
          setPotentialManualMatch(null);
        }
      }
    }

    if (name === 'price' || name === 'quantity' || name === 'discount') {
      updated.value = computeItemValue(
        name === 'price' ? value : updated.price,
        name === 'quantity' ? value : updated.quantity,
        name === 'discount' ? value : updated.discount
      );
    }

    setItemEntry(updated);
  };

  // Handle Barcode Scanner / Enter key press on Code field
  const handleCodeKeyDown = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = (itemEntry.code || '').trim().toLowerCase();
      if (!query) {
        setLookupModal({
          isOpen: true,
          type: 'item',
          title: 'Select Item from Item Master',
          search: '',
        });
        return;
      }

      // 1. Check local itemsList for exact match by code or barcode
      let match = null;
      if (grnHeader.useBarcode) {
        match = itemsList.find(
          (i) =>
            i.barcode?.trim().toLowerCase() === query ||
            i.barCode?.trim().toLowerCase() === query ||
            i.code?.trim().toLowerCase() === query
        );
      } else {
        match = itemsList.find((i) => i.code?.trim().toLowerCase() === query);
        if (!match) {
          match = itemsList.find(
            (i) =>
              i.barcode?.trim().toLowerCase() === query ||
              i.barCode?.trim().toLowerCase() === query
          );
        }
      }

      // If user entered "CODE - DESC" format
      if (!match && query.includes(' - ')) {
        const codePart = query.split(' - ')[0].trim().toLowerCase();
        match = itemsList.find((i) => i.code?.trim().toLowerCase() === codePart);
      }

      if (match) {
        const itemObj = populateItemDetails(match, itemEntry.quantity || 1, itemEntry.discount || '0');
        setItemEntry(itemObj);
        fetchItemHistory(match.code, match.location);

        if (grnHeader.useBarcode) {
          addLineItemDirectly(itemObj);
        } else {
          // Move focus to Price or Quantity field so user can enter received values
          if (grnPriceInputRef.current) {
            grnPriceInputRef.current.focus();
            grnPriceInputRef.current.select();
          } else if (grnQtyInputRef.current) {
            grnQtyInputRef.current.focus();
            grnQtyInputRef.current.select();
          }
        }
        return;
      }

      // 2. Fallback live server lookup for exact match
      try {
        setLoading(true);
        // Direct code lookup
        const directRes = await api.get(`/items/${encodeURIComponent(query)}`).catch(() => null);
        if (directRes?.data?.success && directRes?.data?.data) {
          const exact = directRes.data.data;
          const itemObj = populateItemDetails(exact, itemEntry.quantity || 1, itemEntry.discount || '0');
          setItemEntry(itemObj);
          fetchItemHistory(exact.code, exact.location);
          if (grnHeader.useBarcode) {
            addLineItemDirectly(itemObj);
          } else {
            grnPriceInputRef.current?.focus();
            grnPriceInputRef.current?.select();
          }
          return;
        }

        // Search query
        const searchRes = await api.get(`/items?search=${encodeURIComponent(query)}&limit=10`);
        if (searchRes.data?.data?.length > 0) {
          const exact = searchRes.data.data.find(
            (i) =>
              (i.code && i.code.trim().toLowerCase() === query) ||
              (i.barcode && i.barcode.trim().toLowerCase() === query) ||
              (i.barCode && i.barCode.trim().toLowerCase() === query)
          );
          if (exact) {
            const itemObj = populateItemDetails(exact, itemEntry.quantity || 1, itemEntry.discount || '0');
            setItemEntry(itemObj);
            fetchItemHistory(exact.code, exact.location);
            if (grnHeader.useBarcode) {
              addLineItemDirectly(itemObj);
            } else {
              grnPriceInputRef.current?.focus();
              grnPriceInputRef.current?.select();
            }
            return;
          }
        }

        // Check if query matches a tracked manual item
        const manualMatch = trackedManualItems.find(
          (m) =>
            m.manualCode?.toLowerCase() === query ||
            m.description?.toLowerCase() === query
        );
        if (manualMatch) {
          setPotentialManualMatch(manualMatch);
          showNotification(`Item code '${query}' matches tracked manual item '${manualMatch.description}'. Confirm link to proceed.`, 'info');
          return;
        }

        showNotification(`Item code '${itemEntry.code.trim()}' not found in Item Master or Manual Stock`, 'warning');
      } catch (err) {
        showNotification(`Item code '${query}' not found in Item Master or Manual Stock`, 'warning');
      } finally {
        setLoading(false);
      }
    }
  };

  // Handle Blur on Code field: if user typed an exact code and description is still empty, populate details
  const handleCodeBlur = async () => {
    const query = (itemEntry.code || '').trim().toLowerCase();
    if (!query || itemEntry.description) return;

    let match = itemsList.find(
      (i) =>
        (i.code && i.code.trim().toLowerCase() === query) ||
        (i.barcode && i.barcode.trim().toLowerCase() === query)
    );

    if (match) {
      const itemObj = populateItemDetails(match, itemEntry.quantity || 1, itemEntry.discount || '0');
      setItemEntry(itemObj);
      fetchItemHistory(match.code, match.location);
      return;
    }

    try {
      const directRes = await api.get(`/items/${encodeURIComponent(query)}`).catch(() => null);
      if (directRes?.data?.success && directRes?.data?.data) {
        const exact = directRes.data.data;
        const itemObj = populateItemDetails(exact, itemEntry.quantity || 1, itemEntry.discount || '0');
        setItemEntry(itemObj);
        fetchItemHistory(exact.code, exact.location);
      }
    } catch (e) {
      // ignore blur lookup error
    }
  };

  // Select Item from Lookup Modal
  const handleSelectItemFromLookup = (item) => {
    const itemObj = populateItemDetails(item, 1, 0);
    setItemEntry({
      ...itemObj,
      isManualItem: false,
      manualItemId: null,
      manualCode: '',
      previouslySoldQty: 0,
    });
    setPotentialManualMatch(null);
    setLookupModal({ isOpen: false, type: null, title: '', search: '' });
    fetchItemHistory(item.code, item.location);
  };

  // Select Tracked Manual Item from Lookup or Identification Banner (Requirement 5)
  const handleSelectManualItemForGrn = (manualItem) => {
    const cost = manualItem.costPrice || 0;
    const sell = manualItem.sellingPrice || 0;
    const soldQty = Number(manualItem.totalSalesQty) || 0;
    const initialQty = soldQty > 0 ? soldQty : 1;

    setItemEntry({
      code: manualItem.manualCode,
      description: manualItem.description || '',
      price: cost > 0 ? String(cost) : '',
      sellPrice: sell > 0 ? String(sell) : '',
      quantity: String(initialQty),
      discount: '0',
      value: computeItemValue(cost, initialQty, '0'),
      location: manualItem.location || 'Main Store',
      closingStock: manualItem.availableStock !== undefined ? manualItem.availableStock : -soldQty,
      lastGrn: 'Pending Master',
      lpc: cost > 0 ? Number(cost).toFixed(2) : '-',
      isManualItem: true,
      manualItemId: manualItem._id,
      manualCode: manualItem.manualCode,
      previouslySoldQty: soldQty,
    });
    setPotentialManualMatch(null);
    setLookupModal({ isOpen: false, type: null, title: '', search: '' });
    showNotification(`Linked to Tracked Manual Item '${manualItem.manualCode}' (Previously Sold: ${soldQty} PCS)`, 'info');
    if (grnPriceInputRef.current) {
      grnPriceInputRef.current.focus();
      grnPriceInputRef.current.select();
    }
  };

  // Select Supplier from Lookup Modal
  const handleSelectSupplierFromLookup = (supp) => {
    setGrnHeader((prev) => ({
      ...prev,
      supplierCode: supp.code,
      supplierName: supp.name,
    }));
    setLookupModal({ isOpen: false, type: null, title: '', search: '' });
  };

  // Add line item directly (e.g. from barcode scan)
  const addLineItemDirectly = (itemObj) => {
    const qty = parseFloat(itemObj.quantity) || 1;
    const price = parseFloat(itemObj.price) || 0;
    const sellPrice = parseFloat(itemObj.sellPrice) || 0;
    const disc = parseFloat(itemObj.discount) || 0;
    const val = parseFloat(computeItemValue(price, qty, disc));

    const newLineItem = {
      code: itemObj.code.trim(),
      description: itemObj.description || '',
      price,
      sellPrice,
      quantity: qty,
      discount: disc,
      value: val,
      location: itemObj.location || 'Main Store',
      closingStock: itemObj.closingStock,
      lastGrn: itemObj.lastGrn,
      lpc: itemObj.lpc,
    };

    const existingIdx = lineItems.findIndex(
      (li) => li.code.toLowerCase() === newLineItem.code.toLowerCase()
    );

    if (existingIdx >= 0) {
      const updated = [...lineItems];
      updated[existingIdx].quantity += newLineItem.quantity;
      updated[existingIdx].value = parseFloat(
        computeItemValue(
          updated[existingIdx].price,
          updated[existingIdx].quantity,
          updated[existingIdx].discount
        )
      );
      setLineItems(updated);
      setGridMode('current');
      showNotification(`Incremented quantity for '${newLineItem.code}'`, 'info');
    } else {
      setLineItems([...lineItems, newLineItem]);
      setGridMode('current');
      showNotification(`Added item '${newLineItem.code}'`, 'info');
    }

    // Reset Code input for next scan
    setItemEntry({
      code: '',
      description: '',
      price: '',
      sellPrice: '',
      quantity: '',
      discount: '0',
      value: '0.00',
      location: itemObj.location || 'Main Store',
      closingStock: itemObj.closingStock,
      lastGrn: itemObj.lastGrn,
      lpc: itemObj.lpc,
    });

    itemCodeInputRef.current?.focus();
  };

  // Add or Update Line Item in Main Table
  const handleAddOrUpdateLineItem = () => {
    if (!itemEntry.code || itemEntry.code.trim() === '') {
      showNotification('Please enter an Item Code', 'error');
      itemCodeInputRef.current?.focus();
      return;
    }

    const qty = parseFloat(itemEntry.quantity) || 1;
    if (qty <= 0) {
      showNotification('Please enter a valid Quantity (> 0)', 'error');
      return;
    }

    const price = parseFloat(itemEntry.price) || 0;
    const sellPrice = parseFloat(itemEntry.sellPrice) || 0;
    const disc = parseFloat(itemEntry.discount) || 0;
    const val = parseFloat(computeItemValue(price, qty, disc));

    const newLineItem = {
      code: itemEntry.code.trim(),
      description: itemEntry.description || '',
      price,
      sellPrice,
      quantity: qty,
      discount: disc,
      value: val,
      location: itemEntry.location || 'Main Store',
      closingStock: itemEntry.closingStock,
      lastGrn: itemEntry.lastGrn,
      lpc: itemEntry.lpc,
      isManualItem: Boolean(itemEntry.isManualItem),
      manualItemId: itemEntry.manualItemId || null,
      manualCode: itemEntry.manualCode || '',
      previouslySoldQty: itemEntry.previouslySoldQty || 0,
    };

    if (selectedLineIndex >= 0) {
      // Update existing selected row
      const updated = [...lineItems];
      updated[selectedLineIndex] = newLineItem;
      setLineItems(updated);
      setSelectedLineIndex(-1);
      setGridMode('current');
      showNotification('Updated item in GRN table', 'info');
    } else {
      // Check if code already exists in lineItems
      const existingIdx = lineItems.findIndex(
        (li) => li.code.toLowerCase() === newLineItem.code.toLowerCase()
      );
      if (existingIdx >= 0) {
        const updated = [...lineItems];
        updated[existingIdx].quantity += newLineItem.quantity;
        updated[existingIdx].price = newLineItem.price;
        updated[existingIdx].sellPrice = newLineItem.sellPrice;
        updated[existingIdx].discount = newLineItem.discount;
        updated[existingIdx].value = parseFloat(
          computeItemValue(
            updated[existingIdx].price,
            updated[existingIdx].quantity,
            updated[existingIdx].discount
          )
        );
        setLineItems(updated);
        setGridMode('current');
        showNotification(`Incremented quantity for '${newLineItem.code}'`, 'info');
      } else {
        setLineItems([...lineItems, newLineItem]);
        setGridMode('current');
      }
    }

    // Reset Item Entry Row for next entry
    setItemEntry({
      code: '',
      description: '',
      price: '',
      sellPrice: '',
      quantity: '',
      discount: '0',
      value: '0.00',
      location: 'Main Store',
      closingStock: '',
      lastGrn: '',
      lpc: '',
      isManualItem: false,
      manualItemId: null,
      manualCode: '',
      previouslySoldQty: 0,
    });
    setPotentialManualMatch(null);

    itemCodeInputRef.current?.focus();
  };

  // Click on a table row: load into entry row and show bottom info
  const handleRowClick = (index) => {
    setSelectedLineIndex(index);
    const item = lineItems[index];
    if (item) {
      // Match with current itemsList to get real fresh closing stock & LPC
      const matched = itemsList.find((i) => i.code?.toLowerCase() === item.code?.toLowerCase());
      const realStock = matched ? (matched.quantity !== undefined ? matched.quantity : (matched.stockInHand || 0)) : item.closingStock;
      const realLastGrn = matched ? (matched.lastGrn || matched.lastGrnDate || '-') : item.lastGrn;
      const realLpc = matched ? (matched.lastGrnPrice !== undefined ? Number(matched.lastGrnPrice).toFixed(2) : '-') : item.lpc;

      setItemEntry({
        code: item.code,
        description: item.description,
        price: item.price,
        sellPrice: item.sellPrice,
        quantity: item.quantity,
        discount: item.discount,
        value: Number(item.value).toFixed(2),
        location: item.location || 'Main Store',
        closingStock: realStock,
        lastGrn: realLastGrn,
        lpc: realLpc,
      });

      // Fetch history for this row item in background so bottom fields are fresh
      fetchItemHistory(item.code, item.location);
    }
  };

  // Remove a line item from current draft
  const handleRemoveLineItem = (index, e) => {
    if (e) e.stopPropagation();
    const updated = lineItems.filter((_, i) => i !== index);
    setLineItems(updated);
    if (selectedLineIndex === index) {
      setSelectedLineIndex(-1);
    }
  };

  // 1. BUTTON: NEW
  const handleNew = async () => {
    setActiveGrnId(null);
    setIsRecordPosted(false);
    setLineItems([]);
    setSelectedLineIndex(-1);
    setItemHistory([]);
    setGridMode('current');
    setSelectedHistoryIndex(-1);
    setItemEntry({
      code: '',
      description: '',
      price: '',
      sellPrice: '',
      quantity: '',
      discount: '0',
      value: '0.00',
      location: 'Main Store',
      closingStock: '',
      lastGrn: '',
      lpc: '',
    });

    try {
      const nextNumRes = await api.get('/grn/next-number');
      if (nextNumRes?.data?.data) {
        setGrnHeader({
          no: nextNumRes.data.data.no,
          grnNumber: String(nextNumRes.data.data.grnNumber),
          date: new Date().toISOString().split('T')[0],
          supplierCode: '',
          supplierName: '',
          paidBy: 'Cash',
          supplierInvoiceNo: '',
          masterPo: '',
          useBarcode: false,
          remark: '',
        });
      }
    } catch (e) {
      setGrnHeader({
        no: 0,
        grnNumber: '0',
        date: new Date().toISOString().split('T')[0],
        supplierCode: '',
        supplierName: '',
        paidBy: 'Cash',
        supplierInvoiceNo: '',
        masterPo: '',
        useBarcode: false,
        remark: '',
      });
    }

    showNotification('Initialized new Good Receive Note', 'info');
  };

  // 2. BUTTON: VALIDATE
  const handleValidate = () => {
    const errors = [];
    if (!grnHeader.supplierCode || grnHeader.supplierCode.trim() === '') {
      errors.push('Supplier is not selected.');
    } else {
      const suppExists = suppliersList.some(
        (s) => s.code?.toLowerCase() === grnHeader.supplierCode.trim().toLowerCase()
      );
      if (!suppExists) {
        errors.push(`Supplier '${grnHeader.supplierCode}' not found in Supplier Register.`);
      }
    }

    if (lineItems.length === 0) {
      errors.push('No items added to the GRN.');
    }

    lineItems.forEach((li, idx) => {
      if (!li.code) errors.push(`Row ${idx + 1}: Missing item code.`);
      if (li.quantity <= 0) errors.push(`Row ${idx + 1} (${li.code}): Quantity must be > 0.`);
      if (li.price < 0) errors.push(`Row ${idx + 1} (${li.code}): Price cannot be negative.`);
      if (li.isManualItem && li.previouslySoldQty > 0 && li.quantity < li.previouslySoldQty) {
        errors.push(`Row ${idx + 1} (${li.code}): Discrepancy Alert — Received quantity (${li.quantity}) is less than previously sold manual quantity (${li.previouslySoldQty}). Reconciled stock will be negative (${li.quantity - li.previouslySoldQty} PCS).`);
      }
    });

    const totalQty = lineItems.reduce((acc, li) => acc + li.quantity, 0);

    setValidateModal({
      isOpen: true,
      isValid: errors.length === 0,
      errors,
      summary: {
        grnNumber: grnHeader.grnNumber,
        supplier: `${grnHeader.supplierCode} - ${grnHeader.supplierName || 'N/A'}`,
        itemCount: lineItems.length,
        totalQuantity: totalQty,
        totalValue: `Rs. ${totalGrnValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      },
    });
  };

  // 3. BUTTON: SAVE (Prompts to Post to Stock or Save as Draft)
  const handleSave = async () => {
    if (!grnHeader.supplierCode || grnHeader.supplierCode.trim() === '') {
      showNotification('Please select a Supplier before saving', 'error');
      return;
    }

    // Auto-include any item currently typed in the item entry bar
    let currentLineItems = [...lineItems];
    if (itemEntry.code && itemEntry.code.trim()) {
      const qty = parseFloat(itemEntry.quantity) || 1;
      const price = parseFloat(itemEntry.price) || 0;
      const sellPrice = parseFloat(itemEntry.sellPrice) || 0;
      const disc = parseFloat(itemEntry.discount) || 0;
      const val = parseFloat(computeItemValue(price, qty, disc));

      const pendingItem = {
        code: itemEntry.code.trim(),
        description: itemEntry.description || '',
        price,
        sellPrice,
        quantity: qty,
        discount: disc,
        value: val,
        location: itemEntry.location || 'Main Store',
        isManualItem: Boolean(itemEntry.isManualItem),
        manualItemId: itemEntry.manualItemId || null,
        manualCode: itemEntry.manualCode || '',
        previouslySoldQty: itemEntry.previouslySoldQty || 0,
      };

      currentLineItems.push(pendingItem);
      setLineItems(currentLineItems);
    }

    if (currentLineItems.length === 0) {
      showNotification('Please add at least one Item before saving', 'error');
      itemCodeInputRef.current?.focus();
      return;
    }

    // Prompt user to choose between posting stock or saving as draft (single clean confirmation)
    let willPost = isRecordPosted;
    if (!isRecordPosted) {
      const postChoice = await showConfirm({
        title: 'Save GRN - Post to Stock',
        message: 'Do you want to post this GRN to stock now?\n\n• Post to Stock — Stock increases immediately in Item Master & Sales Invoice\n• Save as Draft — Stock will NOT change\n• Cancel — Abort saving',
        type: 'question',
        buttons: [
          { key: 'post', label: 'Post to Stock', isPrimary: true, isDefault: true, title: 'Post to Stock immediately' },
          { key: 'draft', label: 'Save as Draft', isDefault: false, title: 'Save as Draft without changing stock' },
          { key: 'cancel', label: 'Cancel', isDefault: false, title: 'Cancel saving' },
        ],
      });
      if (postChoice === 'cancel' || !postChoice) return;
      willPost = postChoice === 'post';
    } else {
      const confirmed = await confirmSave('Do you want to update this posted GRN record?');
      if (!confirmed) return;
    }

    const payload = {
      no: grnHeader.no,
      grnNumber: grnHeader.grnNumber,
      supplierCode: grnHeader.supplierCode,
      supplierName: grnHeader.supplierName,
      supplierInvoiceNo: grnHeader.supplierInvoiceNo,
      paidBy: grnHeader.paidBy,
      masterPo: grnHeader.masterPo,
      useBarcode: grnHeader.useBarcode,
      date: grnHeader.date,
      remark: grnHeader.remark,
      lineItems: currentLineItems.map((li) => ({
        code: li.code,
        itemCode: li.code,
        description: li.description,
        unitPrice: li.price,
        rate: li.price,
        sellingPrice: li.sellPrice,
        quantity: li.quantity,
        qty: li.quantity,
        discount: li.discount,
        value: li.value,
        locationCode: li.location || 'MAIN',
        isManualItem: Boolean(li.isManualItem),
        manualItemId: li.manualItemId || null,
        manualCode: li.manualCode || '',
        previouslySoldQty: li.previouslySoldQty || 0,
      })),
      isPosted: willPost,
    };

    try {
      setLoading(true);
      let res;
      if (activeGrnId) {
        res = await api.put(`/grn/${activeGrnId}`, payload);
      } else {
        res = await api.post('/grn', payload);
      }

      if (res.data && res.data.success) {
        const savedGrn = res.data.data;
        setActiveGrnId(savedGrn._id);
        setIsRecordPosted(Boolean(savedGrn.isPosted));
        showNotification(
          `GRN '${savedGrn.grnNumber || grnHeader.grnNumber}' saved successfully (${savedGrn.isPosted ? 'POSTED TO STOCK' : 'SAVED AS DRAFT'})!`,
          'success'
        );

        // Refresh Items and GRN list from backend so Closing Stock & Item Master displays real updated values
        const [grnsRes, itemsRes] = await Promise.all([
          api.get('/grn?limit=100').catch(() => null),
          api.get('/items?limit=2000').catch(() => null),
        ]);
        if (grnsRes?.data?.data) setGrnList(grnsRes.data.data);
        if (itemsRes?.data?.data) setItemsList(itemsRes.data.data);

        // Refresh item history if item is being viewed
        if (itemEntry.code) {
          fetchItemHistory(itemEntry.code, itemEntry.location);
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save GRN';
      showNotification(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 4. BUTTON: UPDATE / POST (Applies Stock Movements Exactly Once)
  const handleUpdate = async () => {
    if (!grnHeader.supplierCode || grnHeader.supplierCode.trim() === '') {
      showNotification('Please select a Supplier before updating', 'error');
      return;
    }

    // Auto-include any item currently typed in the item entry bar
    let currentLineItems = [...lineItems];
    if (itemEntry.code && itemEntry.code.trim()) {
      const qty = parseFloat(itemEntry.quantity) || 1;
      const price = parseFloat(itemEntry.price) || 0;
      const sellPrice = parseFloat(itemEntry.sellPrice) || 0;
      const disc = parseFloat(itemEntry.discount) || 0;
      const val = parseFloat(computeItemValue(price, qty, disc));

      const pendingItem = {
        code: itemEntry.code.trim(),
        description: itemEntry.description || '',
        price,
        sellPrice,
        quantity: qty,
        discount: disc,
        value: val,
        location: itemEntry.location || 'Main Store',
        isManualItem: Boolean(itemEntry.isManualItem),
        manualItemId: itemEntry.manualItemId || null,
        manualCode: itemEntry.manualCode || '',
        previouslySoldQty: itemEntry.previouslySoldQty || 0,
      };

      currentLineItems.push(pendingItem);
      setLineItems(currentLineItems);
    }

    if (currentLineItems.length === 0) {
      showNotification('Please add at least one Item before updating', 'error');
      itemCodeInputRef.current?.focus();
      return;
    }

    const payload = {
      no: grnHeader.no,
      grnNumber: grnHeader.grnNumber,
      supplierCode: grnHeader.supplierCode,
      supplierName: grnHeader.supplierName,
      supplierInvoiceNo: grnHeader.supplierInvoiceNo,
      paidBy: grnHeader.paidBy,
      masterPo: grnHeader.masterPo,
      useBarcode: grnHeader.useBarcode,
      date: grnHeader.date,
      remark: grnHeader.remark,
      lineItems: currentLineItems.map((li) => ({
        code: li.code,
        itemCode: li.code,
        description: li.description,
        unitPrice: li.price,
        rate: li.price,
        sellingPrice: li.sellPrice,
        quantity: li.quantity,
        qty: li.quantity,
        discount: li.discount,
        value: li.value,
        locationCode: li.location || 'MAIN',
        isManualItem: Boolean(li.isManualItem),
        manualItemId: li.manualItemId || null,
        manualCode: li.manualCode || '',
        previouslySoldQty: li.previouslySoldQty || 0,
      })),
      isPosted: true, // Post to stock!
    };

    try {
      setLoading(true);
      let res;
      if (activeGrnId) {
        res = await api.put(`/grn/${activeGrnId}`, payload);
      } else {
        res = await api.post('/grn', payload);
      }

      if (res.data && res.data.success) {
        const savedGrn = res.data.data;
        setActiveGrnId(savedGrn._id);
        setIsRecordPosted(true);

        showNotification(
          `GRN '${savedGrn.grnNumber || grnHeader.grnNumber}' updated & stock posted successfully!`,
          'success'
        );

        // Refresh Items and GRN list from backend so Closing Stock displays real updated values
        const [grnsRes, itemsRes] = await Promise.all([
          api.get('/grn?limit=100').catch(() => null),
          api.get('/items?limit=2000').catch(() => null),
        ]);
        if (grnsRes?.data?.data) setGrnList(grnsRes.data.data);
        if (itemsRes?.data?.data) setItemsList(itemsRes.data.data);

        // Refresh item history so the newly posted GRN is immediately reflected
        if (itemEntry.code) {
          fetchItemHistory(itemEntry.code, itemEntry.location);
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update and post GRN';
      showNotification(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 5. BUTTON: DELETE
  const handleDelete = async () => {
    if (!activeGrnId) {
      if (selectedLineIndex >= 0) {
        handleRemoveLineItem(selectedLineIndex);
        showNotification('Removed selected item from table', 'info');
      } else {
        showNotification('Select a GRN or an item to delete', 'info');
      }
      return;
    }

    const isConfirmed = await confirmDelete(
      `Are you sure you want to delete GRN '${grnHeader.grnNumber}'?${
        isRecordPosted ? ' This will revert updated stock quantities!' : ''
      }`
    );
    if (!isConfirmed) return;

    try {
      setLoading(true);
      const res = await api.delete(`/grn/${activeGrnId}`);
      if (res.data && res.data.success) {
        showNotification(`GRN '${grnHeader.grnNumber}' deleted successfully`, 'success');
        handleNew();
        // Refresh items and grn list
        const [grnsRes, itemsRes] = await Promise.all([
          api.get('/grn?limit=100').catch(() => null),
          api.get('/items?limit=2000').catch(() => null),
        ]);
        if (grnsRes?.data?.data) setGrnList(grnsRes.data.data);
        if (itemsRes?.data?.data) setItemsList(itemsRes.data.data);
      }
    } catch (err) {
      showNotification('Failed to delete GRN', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 6. BUTTON: DISCOUNT
  const handleApplyGlobalDiscount = () => {
    const pct = parseFloat(discountModal.discountPercent);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      showNotification('Please enter a valid discount percentage (0 - 100%)', 'error');
      return;
    }

    const updated = lineItems.map((item) => {
      const val = parseFloat(computeItemValue(item.price, item.quantity, pct));
      return {
        ...item,
        discount: pct,
        value: val,
      };
    });

    setLineItems(updated);
    setDiscountModal({ isOpen: false, discountPercent: '' });
    showNotification(`Applied ${pct}% discount across all items`, 'success');
  };

  // 7. BUTTON: DOWNLOAD / EXCEL
  const handleDownloadReport = () => {
    if (lineItems.length === 0) {
      showNotification('No items in GRN to download', 'error');
      return;
    }

    const rows = [
      ['SOFAST MOTORS - GOOD RECEIVE NOTE (GRN)'],
      ['GRN Number', grnHeader.grnNumber],
      ['Date', grnHeader.date],
      ['Supplier', `${grnHeader.supplierCode} - ${grnHeader.supplierName}`],
      ['Invoice No', grnHeader.supplierInvoiceNo],
      ['Paid By', grnHeader.paidBy],
      ['Master PO', grnHeader.masterPo],
      ['Status', isRecordPosted ? 'POSTED' : 'DRAFT'],
      [],
      ['Code', 'Description', 'Price', 'Sell. Price', 'Quantity', 'Discount (%)', 'Value'],
      ...lineItems.map((li) => [
        li.code,
        li.description,
        li.price,
        li.sellPrice,
        li.quantity,
        li.discount,
        li.value,
      ]),
      [],
      ['Total GRN Value', '', '', '', '', '', totalGrnValue],
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GRN_${grnHeader.grnNumber || 'New'}_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Downloaded GRN CSV Report', 'success');
  };

  // Filtered items/suppliers for modal lookup
  const filteredSuppliers = suppliersList.filter((s) => {
    const q = lookupModal.search.toLowerCase().trim();
    if (!q) return true;
    return (
      s.code?.toLowerCase().includes(q) ||
      s.name?.toLowerCase().includes(q) ||
      s.address?.toLowerCase().includes(q) ||
      s.telephone?.toLowerCase().includes(q) ||
      s.telephone1?.toLowerCase().includes(q) ||
      s.telephone2?.toLowerCase().includes(q)
    );
  });

  const filteredItems = itemsList.filter((i) => {
    const q = lookupModal.search.toLowerCase().trim();
    return (
      !q ||
      i.code?.toLowerCase().includes(q) ||
      i.description?.toLowerCase().includes(q) ||
      i.category?.toLowerCase().includes(q)
    );
  });

  const filteredManualItems = trackedManualItems.filter((m) => {
    const q = lookupModal.search.toLowerCase().trim();
    if (!q) return true;
    return (
      m.itemCode?.toLowerCase().includes(q) ||
      m.description?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="grn-master-container">
      {/* 1. System Title Bar */}
      <header className="grn-titlebar">
        <div className="grn-titlebar-brand">
          <svg className="grn-titlebar-car-icon" viewBox="0 0 24 24">
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
          </svg>
          <span className="grn-titlebar-heading">SOFAST MOTORS - Management System</span>
        </div>
        <div className="grn-titlebar-controls">
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

      {/* 2. Top Navigation Menu Bar */}
      <ClassicNavbar activeMenu="stock-control" />

      {/* Main Canvas Centering the Exact Window */}
      <main className="grn-main-canvas">
        {/* Notification Box */}
        {notification && (
          <div className={`grn-alert ${notification.type}`}>
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

        <div className="grn-window-frame">
          {/* Exact Window Title Bar matching screenshot: Data Entry of Goods Received */}
          <div className="grn-dialog-titlebar">
            <div className="grn-titlebar-left">
              <img src={windowIcon} alt="" className="grn-window-icon" />
              <span className="grn-window-title">Data Entry of Goods Received</span>
            </div>
            <div className="grn-dialog-controls">
              <button type="button" className="dialog-control-btn" aria-label="Minimize">&#8212;</button>
              <button type="button" className="dialog-control-btn" aria-label="Maximize">&#9633;</button>
              <button
                type="button"
                className="dialog-control-btn close"
                aria-label="Close"
                onClick={() => navigate('/management')}
              >
                &#x2715;
              </button>
            </div>
          </div>

          <div className="grn-panel-container">
            {/* Top Form Section (GRN, Date, Supplier & Top Right Buttons) */}
            <div className="grn-header-section">
              <div className="grn-header-fields" onKeyDown={(e) => handleEnterNavigation(e, { finalAction: () => itemCodeInputRef.current?.focus() })}>
                {/* Row 1: GRN | Date | Supplier */}
                <div className="grn-row">
                  <span className="grn-label-blue">GRN</span>
                  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                    <input
                      type="text"
                      name="grnNumber"
                      className="grn-input"
                      style={{ width: '105px', fontWeight: 'bold', color: '#000080', fontSize: '15px' }}
                      value={grnHeader.grnNumber}
                      onChange={handleHeaderChange}
                      title="GRN Number"
                    />
                    {grnList.length > 0 && (
                      <select
                        className="grn-select"
                        style={{ width: '20px', marginLeft: '-20px', opacity: 0 }}
                        onChange={(e) => handleSelectExistingGrn(e.target.value)}
                        value=""
                        title="Select previous saved GRN"
                      >
                        <option value="">-- Select Saved GRN --</option>
                        {grnList.map((g) => (
                          <option key={g._id} value={g.grnNumber}>
                            {g.grnNumber} ({g.supplierCode} - {g.date ? String(g.date).substring(0, 10) : ''})
                          </option>
                        ))}
                      </select>
                    )}
                    {isRecordPosted ? (
                      <span
                        title="Stock has been posted to Item Master & Sales Invoice"
                        style={{
                          marginLeft: '6px',
                          padding: '2px 6px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          backgroundColor: '#d1fae5',
                          color: '#065f46',
                          border: '1px solid #10b981',
                          borderRadius: '2px',
                        }}
                      >
                        POSTED
                      </span>
                    ) : activeGrnId ? (
                      <span
                        title="Draft only - Stock has NOT been posted yet. Click Update or Process to post."
                        style={{
                          marginLeft: '6px',
                          padding: '2px 6px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          backgroundColor: '#fef3c7',
                          color: '#92400e',
                          border: '1px solid #f59e0b',
                          borderRadius: '2px',
                        }}
                      >
                        DRAFT
                      </span>
                    ) : null}
                  </div>

                  <span className="grn-label-blue" style={{ marginLeft: '14px' }}>Date</span>
                  <input
                    type="date"
                    name="date"
                    className="grn-input"
                    style={{ width: '145px' }}
                    value={grnHeader.date}
                    onChange={handleHeaderChange}
                  />

                  <span className="grn-label-blue" style={{ marginLeft: '14px' }}>Supplier</span>
                  <input
                    type="text"
                    name="supplierCode"
                    list="grn-supplier-code-datalist"
                    className="grn-input"
                    style={{ width: '105px' }}
                    placeholder="Code..."
                    value={grnHeader.supplierCode}
                    onChange={handleHeaderChange}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="grn-btn-lookup"
                    title="Search Suppliers from Database"
                    onClick={() =>
                      setLookupModal({
                        isOpen: true,
                        type: 'supplier',
                        title: 'Select Supplier from Database',
                        search: '',
                      })
                    }
                  >
                    ...
                  </button>
                  <select
                    className="grn-select"
                    style={{ width: '160px', marginLeft: '3px' }}
                    value={grnHeader.supplierCode}
                    onChange={(e) => {
                      const code = e.target.value;
                      const match = suppliersList.find((s) => s.code === code);
                      setGrnHeader((prev) => ({
                        ...prev,
                        supplierCode: code,
                        supplierName: match ? match.name : '',
                      }));
                    }}
                    title="Quick select supplier"
                  >
                    <option value="">-- Select Supplier --</option>
                    {suppliersList.map((s) => (
                      <option key={s._id || s.code} value={s.code}>
                        {s.code} - {s.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    name="supplierName"
                    list="grn-supplier-name-datalist"
                    className="grn-input"
                    style={{ width: '300px', marginLeft: '3px' }}
                    placeholder="Supplier Name"
                    value={grnHeader.supplierName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setGrnHeader((prev) => ({ ...prev, supplierName: val }));
                      const match = suppliersList.find(
                        (s) => s.name?.toLowerCase() === val.trim().toLowerCase()
                      );
                      if (match) {
                        setGrnHeader((prev) => ({
                          ...prev,
                          supplierCode: match.code,
                          supplierName: match.name,
                        }));
                      }
                    }}
                    autoComplete="off"
                  />
                  <datalist id="grn-supplier-code-datalist">
                    {suppliersList.map((s) => (
                      <option key={s._id || s.code} value={s.code}>
                        {s.name}
                      </option>
                    ))}
                  </datalist>
                  <datalist id="grn-supplier-name-datalist">
                    {suppliersList.map((s) => (
                      <option key={s._id || s.code} value={s.name}>
                        {s.code}
                      </option>
                    ))}
                  </datalist>
                </div>

                {/* Row 2: Paid By | Invoice No | Process | Download | Master P.O. */}
                <div className="grn-row" style={{ marginTop: '6px' }}>
                  <span className="grn-label-blue">Paid By</span>
                  <select
                    name="paidBy"
                    className="grn-select"
                    style={{ width: '140px' }}
                    value={grnHeader.paidBy}
                    onChange={handleHeaderChange}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="Credit">Credit</option>
                    <option value="Online Transfer">Online Transfer</option>
                  </select>

                  <span className="grn-label-blue" style={{ marginLeft: '14px' }}>Invoice No</span>
                  <input
                    type="text"
                    name="supplierInvoiceNo"
                    className="grn-input"
                    style={{ width: '170px' }}
                    placeholder="INV-..."
                    value={grnHeader.supplierInvoiceNo}
                    onChange={handleHeaderChange}
                  />

                  <button
                    type="button"
                    className="grn-btn-classic"
                    style={{ marginLeft: '12px', minWidth: '85px', height: '28px' }}
                    onClick={handleValidate}
                  >
                    Process
                  </button>

                  <button
                    type="button"
                    className="grn-btn-classic"
                    style={{ marginLeft: '8px', minWidth: '90px', height: '28px' }}
                    onClick={handleDownloadReport}
                  >
                    Download
                  </button>

                  <span className="grn-label-blue" style={{ marginLeft: '24px' }}>Master P.O.</span>
                  <input
                    type="text"
                    name="masterPo"
                    className="grn-input"
                    style={{ width: '160px' }}
                    placeholder="PO-..."
                    value={grnHeader.masterPo}
                    onChange={handleHeaderChange}
                  />
                </div>
              </div>

              {/* Right-Side Action Buttons: New, Delete, Save */}
              <div className="grn-right-actions">
                <button type="button" className="grn-btn-classic" onClick={handleNew}>
                  New
                </button>
                <button type="button" className="grn-btn-classic" onClick={handleDelete}>
                  Delete
                </button>
                <button type="button" className="grn-btn-classic" onClick={handleSave} disabled={loading}>
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

            {/* Manual Item Identification & Confirmation Banner */}
            {potentialManualMatch && (
              <div
                style={{
                  backgroundColor: '#eff6ff',
                  border: '1px solid #3b82f6',
                  borderLeft: '4px solid #1d4ed8',
                  padding: '6px 12px',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: '#1e3a8a',
                  borderRadius: '2px',
                }}
              >
                <div>
                  <strong>Tracked Manual Item Found:</strong> <code>{potentialManualMatch.itemCode}</code> — {potentialManualMatch.description}{' '}
                  <span style={{ marginLeft: '8px', color: '#b91c1c', fontWeight: 'bold' }}>
                    (Previously Sold: {potentialManualMatch.totalManualSales || 0} PCS | Current Manual Stock: {potentialManualMatch.availableStock ?? 0})
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className="grn-btn-classic"
                    style={{ height: '22px', fontSize: '11px', fontWeight: 'bold', color: '#1e40af' }}
                    onClick={() => handleSelectManualItemForGrn(potentialManualMatch)}
                  >
                    Confirm & Link to this Manual Item
                  </button>
                  <button
                    type="button"
                    className="grn-btn-classic"
                    style={{ height: '22px', fontSize: '11px' }}
                    onClick={() => setPotentialManualMatch(null)}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Manual Item Reconciled Active Link Banner */}
            {itemEntry.isManualItem && (
              <div
                style={{
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #22c55e',
                  borderLeft: '4px solid #15803d',
                  padding: '5px 12px',
                  marginBottom: '8px',
                  fontSize: '11px',
                  color: '#166534',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderRadius: '2px',
                }}
              >
                <span>
                  🔗 <strong>Linked to Manual Stock Item:</strong> <code>{itemEntry.manualCode}</code> | Previously Sold:{' '}
                  <strong>{itemEntry.previouslySoldQty} PCS</strong> | Reconciliation: Received (
                  <strong>{parseFloat(itemEntry.quantity) || 0}</strong>) - Sold (
                  <strong>{itemEntry.previouslySoldQty}</strong>) = Net Available Stock (
                  <strong style={{ color: (parseFloat(itemEntry.quantity) || 0) < itemEntry.previouslySoldQty ? '#b91c1c' : '#15803d' }}>
                    {(parseFloat(itemEntry.quantity) || 0) - itemEntry.previouslySoldQty}
                  </strong>)
                </span>
                {(parseFloat(itemEntry.quantity) || 0) < itemEntry.previouslySoldQty && (
                  <span style={{ color: '#b91c1c', fontWeight: 'bold', marginLeft: '8px' }}>
                    ⚠️ Warning: Received Qty is less than previously sold Qty!
                  </span>
                )}
              </div>
            )}

            {/* Item Entry Row Section (Above Grid) */}
            <div className="grn-item-entry-bar">
              <div className="grn-entry-grid">
                {/* Code */}
                <div className="grn-entry-col">
                  <span className="grn-col-header">Code</span>
                  <div className="grn-entry-col-code">
                    <input
                      ref={itemCodeInputRef}
                      type="text"
                      name="code"
                      className="grn-input"
                      style={{ width: '110px' }}
                      placeholder="Code..."
                      value={itemEntry.code}
                      onChange={handleItemEntryChange}
                      onKeyDown={handleCodeKeyDown}
                      onBlur={handleCodeBlur}
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      className="grn-btn-lookup"
                      title="Search Items Master"
                      onClick={() =>
                        setLookupModal({
                          isOpen: true,
                          type: 'item',
                          title: 'Select Item from Item Master',
                          search: itemEntry.code || '',
                        })
                      }
                    >
                      ...
                    </button>
                  </div>
                </div>

                {/* Description */}
                <div className="grn-entry-col">
                  <span className="grn-col-header">Descrption</span>
                  <input
                    type="text"
                    name="description"
                    className="grn-input"
                    style={{ width: '100%' }}
                    placeholder="1234567890123456789012345"
                    value={itemEntry.description}
                    onChange={handleItemEntryChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddOrUpdateLineItem();
                    }}
                  />
                </div>

                {/* Price (Purchase Price) */}
                <div className="grn-entry-col">
                  <span className="grn-col-header">Price</span>
                  <input
                    ref={grnPriceInputRef}
                    type="number"
                    name="price"
                    className="grn-input"
                    style={{ width: '100%', textAlign: 'right' }}
                    placeholder="0.00"
                    value={itemEntry.price}
                    onChange={handleItemEntryChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        grnSellPriceInputRef.current?.focus();
                        grnSellPriceInputRef.current?.select();
                      }
                    }}
                  />
                </div>

                {/* Sell. Price */}
                <div className="grn-entry-col">
                  <span className="grn-col-header">Sell. Price</span>
                  <input
                    ref={grnSellPriceInputRef}
                    type="number"
                    name="sellPrice"
                    className="grn-input"
                    style={{ width: '100%', textAlign: 'right' }}
                    placeholder="-567890123456"
                    value={itemEntry.sellPrice}
                    onChange={handleItemEntryChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        grnQtyInputRef.current?.focus();
                        grnQtyInputRef.current?.select();
                      }
                    }}
                  />
                </div>

                {/* Quantity */}
                <div className="grn-entry-col">
                  <span className="grn-col-header">Quantity</span>
                  <input
                    ref={grnQtyInputRef}
                    type="number"
                    name="quantity"
                    className="grn-input"
                    style={{ width: '100%', textAlign: 'center', fontWeight: 'bold' }}
                    placeholder="0"
                    value={itemEntry.quantity}
                    onChange={handleItemEntryChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        grnDiscountInputRef.current?.focus();
                        grnDiscountInputRef.current?.select();
                      }
                    }}
                  />
                </div>

                {/* Discount (%) */}
                <div className="grn-entry-col">
                  <span className="grn-col-header">Discount</span>
                  <input
                    ref={grnDiscountInputRef}
                    type="number"
                    name="discount"
                    className="grn-input"
                    style={{ width: '100%', textAlign: 'right' }}
                    placeholder="0.00"
                    value={itemEntry.discount}
                    onChange={handleItemEntryChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddOrUpdateLineItem();
                        setTimeout(() => {
                          itemCodeInputRef.current?.focus();
                          itemCodeInputRef.current?.select();
                        }, 50);
                      }
                    }}
                  />
                </div>

                {/* Value */}
                <div className="grn-entry-col">
                  <span className="grn-col-header">Value</span>
                  <input
                    type="text"
                    name="value"
                    className="grn-input readonly"
                    style={{ width: '100%', textAlign: 'right', fontWeight: 'bold', color: '#000080' }}
                    readOnly
                    placeholder="1234567890123456"
                    value={itemEntry.value}
                  />
                </div>

                {/* Add / Set Action */}
                <div className="grn-entry-col">
                  <button
                    type="button"
                    className="grn-btn-classic"
                    style={{ width: '56px', height: '28px', padding: 0, fontSize: '13px', fontWeight: 'bold' }}
                    title={selectedLineIndex >= 0 ? 'Update row' : 'Add to GRN table'}
                    onClick={handleAddOrUpdateLineItem}
                  >
                    {selectedLineIndex >= 0 ? 'Set' : 'Add'}
                  </button>
                </div>
              </div>
            </div>

            {/* 5. Main GRN Item Table (ActiveX Grid Style) */}
            <div className="grn-table-wrapper">
              {gridMode === 'history' ? (
                itemHistory.length === 0 && (
                  <div className="grn-activex-watermark">
                    {itemEntry.code ? 'No GRN history found' : '[ActiveX]'}
                  </div>
                )
              ) : (
                lineItems.length === 0 && (
                  <div className="grn-activex-watermark">[ActiveX]</div>
                )
              )}

              {gridMode === 'history' ? (
                <table className="grn-table">
                  <thead>
                    <tr
                      onClick={toggleGridMode}
                      style={{ cursor: lineItems.length > 0 ? 'pointer' : 'default' }}
                      title={lineItems.length > 0 ? "Showing Item History. Click here or 'Last Grn' to view current GRN." : "Showing Item History"}
                    >
                      <th style={{ width: '30px', textAlign: 'center' }}>#</th>
                      <th style={{ width: '90px' }}>GRN No</th>
                      <th style={{ width: '85px', textAlign: 'center' }}>Date</th>
                      <th style={{ width: '150px' }}>Supplier</th>
                      <th style={{ width: '95px' }}>Invoice No</th>
                      <th style={{ width: '95px' }}>Code</th>
                      <th>Description</th>
                      <th style={{ width: '75px', textAlign: 'right' }}>Price</th>
                      <th style={{ width: '80px', textAlign: 'right' }}>Sell. Price</th>
                      <th style={{ width: '65px', textAlign: 'center' }}>Quantity</th>
                      <th style={{ width: '65px', textAlign: 'right' }}>Discount</th>
                      <th style={{ width: '85px', textAlign: 'right' }}>Value</th>
                      <th style={{ width: '85px' }}>Location</th>
                      <th style={{ width: '70px', textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemHistory.map((h, idx) => (
                      <tr
                        key={`${h.grnNumber}-${idx}`}
                        className={selectedHistoryIndex === idx ? 'selected' : ''}
                        onClick={() => setSelectedHistoryIndex(idx)}
                      >
                        <td style={{ textAlign: 'center', color: '#666' }}>{idx + 1}</td>
                        <td style={{ fontWeight: 'bold' }}>{h.grnNumber}</td>
                        <td style={{ textAlign: 'center' }}>
                          {h.date ? new Date(h.date).toISOString().split('T')[0] : '-'}
                        </td>
                        <td title={h.supplier}>{h.supplier}</td>
                        <td>{h.supplierInvoiceNo || '-'}</td>
                        <td style={{ fontWeight: '600' }}>{h.code}</td>
                        <td>{h.description}</td>
                        <td style={{ textAlign: 'right' }}>
                          {Number(h.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {Number(h.sellPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{h.quantity}</td>
                        <td style={{ textAlign: 'right' }}>
                          {Number(h.discount || 0).toFixed(2)}%
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          {Number(h.value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td>{h.location}</td>
                        <td
                          style={{
                            textAlign: 'center',
                            fontWeight: 'bold',
                            color: h.isPosted ? '#008000' : '#b45309',
                          }}
                        >
                          {h.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="grn-table">
                  <thead>
                    <tr
                      onClick={toggleGridMode}
                      style={{ cursor: itemHistory.length > 0 ? 'pointer' : 'default' }}
                      title={itemHistory.length > 0 ? "Showing Current GRN. Click here or 'Last Grn' to view Item History." : "Showing Current GRN"}
                    >
                      <th style={{ width: '35px', textAlign: 'center' }}>#</th>
                      <th style={{ width: '120px' }}>Code</th>
                      <th>Description</th>
                      <th style={{ width: '90px', textAlign: 'right' }}>Price</th>
                      <th style={{ width: '95px', textAlign: 'right' }}>Sell. Price</th>
                      <th style={{ width: '75px', textAlign: 'center' }}>Quantity</th>
                      <th style={{ width: '80px', textAlign: 'right' }}>Discount</th>
                      <th style={{ width: '110px', textAlign: 'right' }}>Value</th>
                      <th style={{ width: '40px', textAlign: 'center' }}>Del</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, index) => (
                      <tr
                        key={`${item.code}-${index}`}
                        className={selectedLineIndex === index ? 'selected' : ''}
                        onClick={() => handleRowClick(index)}
                      >
                        <td style={{ textAlign: 'center', color: '#666' }}>{index + 1}</td>
                        <td style={{ fontWeight: '600' }}>
                          {item.code}
                          {item.isManualItem && (
                            <span
                              style={{
                                marginLeft: '5px',
                                fontSize: '10px',
                                padding: '1px 4px',
                                backgroundColor: '#dbeafe',
                                color: '#1e40af',
                                borderRadius: '3px',
                                border: '1px solid #93c5fd',
                                verticalAlign: 'middle',
                              }}
                              title={`Linked to Manual Item: ${item.manualCode} (Previously Sold: ${item.previouslySoldQty || 0} PCS)`}
                            >
                              🔗 Manual
                            </span>
                          )}
                        </td>
                        <td>
                          {item.description}
                          {item.isManualItem && item.previouslySoldQty > 0 && (
                            <div
                              style={{
                                fontSize: '10px',
                                color: item.quantity < item.previouslySoldQty ? '#b91c1c' : '#4b5563',
                                fontWeight: item.quantity < item.previouslySoldQty ? 'bold' : 'normal',
                                marginTop: '1px',
                              }}
                            >
                              Reconciliation: Rec: {item.quantity} - Sold: {item.previouslySoldQty} = Net: {item.quantity - item.previouslySoldQty}
                              {item.quantity < item.previouslySoldQty && ' ⚠️ [Shortage Warning]'}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {Number(item.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {Number(item.sellPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{item.quantity}</td>
                        <td style={{ textAlign: 'right' }}>
                          {Number(item.discount).toFixed(2)}%
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          {Number(item.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#e81123',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                            }}
                            title="Remove item"
                            onClick={(e) => handleRemoveLineItem(index, e)}
                          >
                            &#x2715;
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* 6. Bottom Info & Actions Section */}
            <div className="grn-bottom-section">
              {/* Left: Checkbox & Info Rows */}
              <div className="grn-bottom-left">
                <label className="grn-checkbox-label">
                  <input
                    type="checkbox"
                    name="useBarcode"
                    checked={grnHeader.useBarcode}
                    onChange={handleHeaderChange}
                  />
                  <span>Use Bar Code</span>
                </label>

                <div className="grn-info-grid">
                  {/* Row 1: Closing Stock | Location */}
                  <div className="grn-info-row">
                    <span className="grn-label-blue" style={{ width: '100px' }}>Closing Stock</span>
                    <input
                      type="text"
                      className="grn-input readonly"
                      style={{ width: '95px', textAlign: 'center' }}
                      readOnly
                      value={itemEntry.closingStock !== '' ? itemEntry.closingStock : '-'}
                    />

                    <span className="grn-label-blue" style={{ marginLeft: '16px', width: '70px' }}>Location</span>
                    <input
                      type="text"
                      className="grn-input readonly"
                      style={{ width: '160px' }}
                      readOnly
                      value={itemEntry.location || 'Main Store'}
                    />
                  </div>

                  {/* Row 2: Last Grn | L.P.C. */}
                  <div className="grn-info-row">
                    <span
                      className="grn-label-blue"
                      style={{ width: '100px', cursor: 'pointer' }}
                      onClick={toggleGridMode}
                      title={gridMode === 'history' ? "Click to view Current GRN items" : "Click to view Item GRN History"}
                    >
                      Last Grn
                    </span>
                    <input
                      type="text"
                      className="grn-input readonly"
                      style={{ width: '220px', cursor: 'pointer' }}
                      readOnly
                      value={itemEntry.lastGrn || '-'}
                      onClick={toggleGridMode}
                      title={gridMode === 'history' ? "Click to view Current GRN items" : "Click to view Item GRN History"}
                    />

                    <span className="grn-label-blue" style={{ marginLeft: '16px', width: '55px' }}>L.P.C.</span>
                    <input
                      type="text"
                      className="grn-input readonly"
                      style={{ width: '95px', textAlign: 'right' }}
                      readOnly
                      value={itemEntry.lpc !== '' && itemEntry.lpc !== '-' ? Number(itemEntry.lpc).toFixed(2) : '-'}
                    />
                  </div>
                </div>
              </div>

              {/* Right: Discount | Validate | Update | Total */}
              <div className="grn-bottom-right">
                <button
                  type="button"
                  className="grn-btn-classic"
                  onClick={() => setDiscountModal({ isOpen: true, discountPercent: '' })}
                >
                  Discount
                </button>

                <button
                  type="button"
                  className="grn-btn-classic"
                  onClick={handleValidate}
                >
                  Validate
                </button>

                <button
                  type="button"
                  className="grn-btn-classic"
                  onClick={handleUpdate}
                  title="Post GRN and update stock movements"
                >
                  Update
                </button>

                <div className="grn-total-box">
                  <span className="grn-label-blue" style={{ fontSize: '13px' }}>Total</span>
                  <input
                    type="text"
                    className="grn-input grn-total-input"
                    readOnly
                    value={`Rs. ${totalGrnValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Lookup Modal (Supplier / Item) */}
      {lookupModal.isOpen && (
        <div className="grn-modal-overlay">
          <div className="grn-modal-window">
            <div className="grn-modal-titlebar">
              <span>{lookupModal.title}</span>
              <button
                type="button"
                className="control-btn close"
                style={{ width: '24px', height: '20px' }}
                onClick={() => setLookupModal({ isOpen: false, type: null, title: '', search: '' })}
              >
                &#x2715;
              </button>
            </div>
            <div className="grn-modal-body">
              <input
                type="text"
                className="grn-input"
                style={{ width: '100%', padding: '4px 8px' }}
                placeholder={lookupModal.type === 'item' ? "Type to search by code, description, category, barcode..." : "Type to filter..."}
                autoFocus
                value={lookupModal.search}
                onChange={(e) => setLookupModal({ ...lookupModal, search: e.target.value })}
              />

              {lookupModal.type === 'item' && (
                <div style={{ display: 'flex', gap: '6px', margin: '6px 0' }}>
                  <button
                    type="button"
                    className="grn-btn-classic"
                    style={{
                      height: '24px',
                      fontSize: '11px',
                      fontWeight: lookupItemTab === 'master' ? 'bold' : 'normal',
                      backgroundColor: lookupItemTab === 'master' ? '#d0d7de' : '#f6f8fa',
                      border: lookupItemTab === 'master' ? '1px solid #0969da' : '1px solid #d0d7de',
                      color: lookupItemTab === 'master' ? '#0969da' : '#24292f',
                    }}
                    onClick={() => setLookupItemTab('master')}
                  >
                    📦 Item Master ({itemsList.length})
                  </button>
                  <button
                    type="button"
                    className="grn-btn-classic"
                    style={{
                      height: '24px',
                      fontSize: '11px',
                      fontWeight: lookupItemTab === 'manual' ? 'bold' : 'normal',
                      backgroundColor: lookupItemTab === 'manual' ? '#eff6ff' : '#f6f8fa',
                      border: lookupItemTab === 'manual' ? '1px solid #2563eb' : '1px solid #d0d7de',
                      color: lookupItemTab === 'manual' ? '#1d4ed8' : '#24292f',
                    }}
                    onClick={() => setLookupItemTab('manual')}
                  >
                    📋 Tracked Manual Items ({trackedManualItems.length})
                  </button>
                </div>
              )}

              <div style={{ fontSize: '11px', color: '#000080', fontWeight: 'bold', margin: '3px 2px' }}>
                {lookupModal.type === 'supplier'
                  ? `Showing ${filteredSuppliers.length} suppliers`
                  : lookupItemTab === 'master'
                  ? `Showing ${filteredItems.length} items (Total: ${itemsList.length} items in Item Master)`
                  : `Showing ${filteredManualItems.length} tracked manual items (Total: ${trackedManualItems.length})`}
              </div>

              <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                {lookupModal.type === 'supplier' ? (
                  <table className="grn-lookup-table">
                    <thead>
                      <tr>
                        <th style={{ width: '35px', textAlign: 'center' }}>#</th>
                        <th style={{ width: '85px' }}>Code</th>
                        <th>Supplier Name</th>
                        <th style={{ width: '130px' }}>Address</th>
                        <th style={{ width: '110px' }}>Phone</th>
                        <th style={{ width: '55px', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSuppliers.length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '12px', color: '#666' }}>
                            No suppliers found matching "{lookupModal.search}"
                          </td>
                        </tr>
                      ) : (
                        filteredSuppliers.map((s, idx) => (
                          <tr
                            key={s._id || s.code}
                            onClick={() => handleSelectSupplierFromLookup(s)}
                            title="Click to select this supplier"
                          >
                            <td style={{ textAlign: 'center', color: '#666' }}>{idx + 1}</td>
                            <td style={{ fontWeight: 'bold', color: '#000080' }}>{s.code}</td>
                            <td style={{ fontWeight: '600' }}>{s.name}</td>
                            <td>{s.address || '-'}</td>
                            <td>{s.telephone || s.telephone1 || s.telephone2 || '-'}</td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="grn-btn-classic"
                                style={{ height: '20px', minWidth: '45px', padding: '0 4px', fontSize: '11px' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectSupplierFromLookup(s);
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
                ) : lookupItemTab === 'manual' ? (
                  <table className="grn-lookup-table">
                    <thead>
                      <tr>
                        <th style={{ width: '110px' }}>Manual Code</th>
                        <th>Description</th>
                        <th style={{ width: '65px', textAlign: 'center' }}>Sold Qty</th>
                        <th style={{ width: '65px', textAlign: 'center' }}>Added Qty</th>
                        <th style={{ width: '65px', textAlign: 'center' }}>Net Stock</th>
                        <th style={{ width: '80px', textAlign: 'right' }}>Cost</th>
                        <th style={{ width: '80px', textAlign: 'right' }}>Sell Price</th>
                        <th style={{ width: '90px', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredManualItems.length === 0 ? (
                        <tr>
                          <td colSpan="8" style={{ textAlign: 'center', padding: '16px', color: '#666' }}>
                            No tracked manual items found matching "{lookupModal.search}"
                          </td>
                        </tr>
                      ) : (
                        filteredManualItems.map((m) => (
                          <tr key={m._id || m.itemCode} onClick={() => handleSelectManualItemForGrn(m)}>
                            <td style={{ fontWeight: 'bold', color: '#1d4ed8' }}>{m.itemCode}</td>
                            <td>{m.description}</td>
                            <td style={{ textAlign: 'center', color: '#b91c1c', fontWeight: 'bold' }}>
                              {m.totalManualSales || 0}
                            </td>
                            <td style={{ textAlign: 'center', color: '#15803d', fontWeight: 'bold' }}>
                              {m.totalStockAdded || 0}
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                              {m.availableStock ?? 0}
                            </td>
                            <td style={{ textAlign: 'right' }}>{Number(m.purchaseCost || 0).toFixed(2)}</td>
                            <td style={{ textAlign: 'right' }}>{Number(m.sellingPrice || 0).toFixed(2)}</td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="grn-btn-classic"
                                style={{ height: '20px', padding: '0 6px', fontSize: '11px', color: '#1e40af', fontWeight: 'bold' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectManualItemForGrn(m);
                                }}
                              >
                                Select & Link
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table className="grn-lookup-table">
                    <thead>
                      <tr>
                        <th style={{ width: '100px' }}>Code</th>
                        <th>Description</th>
                        <th style={{ width: '80px', textAlign: 'right' }}>Cost</th>
                        <th style={{ width: '80px', textAlign: 'right' }}>Sell Price</th>
                        <th style={{ width: '60px', textAlign: 'center' }}>Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', padding: '16px', color: '#666' }}>
                            No items found matching "{lookupModal.search}"
                          </td>
                        </tr>
                      ) : (
                        filteredItems.map((i) => (
                          <tr key={i._id} onClick={() => handleSelectItemFromLookup(i)}>
                            <td style={{ fontWeight: 'bold', color: '#000080' }}>{i.code}</td>
                            <td>{i.description}</td>
                            <td style={{ textAlign: 'right' }}>{Number(i.lastGrnPrice || i.averageCost || 0).toFixed(2)}</td>
                            <td style={{ textAlign: 'right' }}>{Number(i.finalSellingPrice || i.sellingPrice || 0).toFixed(2)}</td>
                            <td style={{ textAlign: 'center' }}>{i.quantity !== undefined ? i.quantity : (i.stockInHand || 0)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            <div className="grn-modal-footer">
              <button
                type="button"
                className="grn-btn-classic"
                onClick={() => setLookupModal({ isOpen: false, type: null, title: '', search: '' })}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Validation Summary Modal */}
      {validateModal.isOpen && (
        <div className="grn-modal-overlay">
          <div className="grn-modal-window" style={{ maxWidth: '480px' }}>
            <div className="grn-modal-titlebar">
              <span>GRN Validation Summary</span>
              <button
                type="button"
                className="control-btn close"
                style={{ width: '24px', height: '20px' }}
                onClick={() => setValidateModal({ isOpen: false, isValid: false, errors: [], summary: null })}
              >
                &#x2715;
              </button>
            </div>
            <div className="grn-modal-body">
              {validateModal.isValid ? (
                <div style={{ color: '#065f46', backgroundColor: '#d1fae5', padding: '8px', border: '1px solid #10b981' }}>
                  <strong>&#10004; Validation Passed:</strong> All fields, item quantities, supplier, and calculations are valid!
                </div>
              ) : (
                <div style={{ color: '#991b1b', backgroundColor: '#fee2e2', padding: '8px', border: '1px solid #ef4444' }}>
                  <strong>&#10008; Validation Errors Found:</strong>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                    {validateModal.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {validateModal.summary && (
                <div style={{ marginTop: '8px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #e0ded4' }}>
                    <span>GRN Number:</span>
                    <strong>{validateModal.summary.grnNumber}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #e0ded4' }}>
                    <span>Supplier:</span>
                    <strong>{validateModal.summary.supplier}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #e0ded4' }}>
                    <span>Total Item Lines:</span>
                    <strong>{validateModal.summary.itemCount}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #e0ded4' }}>
                    <span>Total Quantity:</span>
                    <strong>{validateModal.summary.totalQuantity}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#000080', fontSize: '13px' }}>
                    <span>Total GRN Value:</span>
                    <strong>{validateModal.summary.totalValue}</strong>
                  </div>
                </div>
              )}
            </div>
            <div className="grn-modal-footer">
              <button
                type="button"
                className="grn-btn-classic"
                onClick={() => setValidateModal({ isOpen: false, isValid: false, errors: [], summary: null })}
              >
                Close
              </button>
              {validateModal.isValid && (
                <button
                  type="button"
                  className="grn-btn-classic"
                  style={{ backgroundColor: '#006600', color: '#ffffff', fontWeight: 'bold', marginLeft: '6px' }}
                  onClick={async () => {
                    setValidateModal({ isOpen: false, isValid: false, errors: [], summary: null });
                    await handleUpdate();
                  }}
                >
                  &#10004; Post GRN to Stock
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global Discount Modal */}
      {discountModal.isOpen && (
        <div className="grn-modal-overlay">
          <div className="grn-modal-window" style={{ maxWidth: '360px' }}>
            <div className="grn-modal-titlebar">
              <span>Apply Overall Discount</span>
              <button
                type="button"
                className="control-btn close"
                style={{ width: '24px', height: '20px' }}
                onClick={() => setDiscountModal({ isOpen: false, discountPercent: '' })}
              >
                &#x2715;
              </button>
            </div>
            <div className="grn-modal-body">
              <span className="grn-label-blue">Enter Discount Percentage (%):</span>
              <input
                type="number"
                className="grn-input"
                style={{ width: '100%', marginTop: '4px' }}
                placeholder="e.g. 5 or 10"
                autoFocus
                value={discountModal.discountPercent}
                onChange={(e) => setDiscountModal({ ...discountModal, discountPercent: e.target.value })}
              />
            </div>
            <div className="grn-modal-footer">
              <button
                type="button"
                className="grn-btn-classic"
                onClick={() => setDiscountModal({ isOpen: false, discountPercent: '' })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="grn-btn-classic"
                onClick={handleApplyGlobalDiscount}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GoodReceiveNote;
