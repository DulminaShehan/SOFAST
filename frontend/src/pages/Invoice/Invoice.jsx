import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ClassicNavbar from '../../components/navigation/ClassicNavbar';
import api from '../../services/api';
import './Invoice.css';

/**
 * Sales Invoice Module
 * Recreates the exact Visual Basic / Classic ERP layout and workflow from legacy SOFAST
 */
function Invoice() {
  const navigate = useNavigate();
  const location = useLocation();

  // Navigation Menubar state
  const [activeDropdown, setActiveDropdown] = useState(null);
  const menuRef = useRef(null);

  // Backend Data State
  const [customersList, setCustomersList] = useState([]);
  const [itemsList, setItemsList] = useState([]);
  const [invoicesList, setInvoicesList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Active Invoice State
  const [activeInvoiceId, setActiveInvoiceId] = useState(null);
  const [invoiceHeader, setInvoiceHeader] = useState({
    no: '',
    invoiceNumber: '',
    date: new Date().toLocaleDateString('en-CA'),
    customerCode: '',
    customerName: '',
    customerAddress: '',
    customerTelephone: '',
    brand: '',
    puchaOn: '',
    model: '',
    engineNo: '',
    chassisNo: '',
    jobDoneBy: '',
    jobDoneBy2: '',
    meterReading: '',
    paymentMethod: 'Cash',
    type: 'Cash',
    cusPo: '',
    jobSheetMasterPo: '',
    jd: 'Invoice',
    isHold: false,
    jobType: 'Material',
    itemLookupMode: 'Item Code',
    remark: '',
    note: '',
  });

  // Multiple Invoice Items
  const [lineItems, setLineItems] = useState([]);
  const [selectedLineIndex, setSelectedLineIndex] = useState(-1);

  // Alternative Products State
  const [alternativeProducts, setAlternativeProducts] = useState([]);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);

  // Current Item Entry Draft
  const [itemEntry, setItemEntry] = useState({
    code: '',
    description: '',
    secondDesc: '',
    location: 'Main Store',
    storedLocation: 'Main Store',
    totalStoredStock: '',
    rackBin: '',
    availableQty: '',
    quantity: '1',
    rate: '0',
    standardRate: '',
    discountPercentage: '',
    discountAmount: '',
    finalPrice: '',
    itemCost: '',
    lastGrn: '',
    lastGrnDate: '',
    lastGrnFormatted: '',
    price: '',
    masterPack: '1',
    rateType: 'Retail',
    mpCost: '',
    roundOffOption: 'No Round Off',
    roundOffStep: 10,
    value: '0.00',
    due: '',
    balance: '',
    disc: '',
    total: '0.00',
    note: '',
  });

  // Locations State for Stock Location dropdown
  const [locationsList, setLocationsList] = useState([
    'Main Store',
    'Main Warehouse',
    'Store 2',
    'Shop Floor',
    'Front Shop',
    'Warehouse',
    'Rack B',
  ]);

  // Anti double-click refs
  const isAddingRef = useRef(false);
  const isSavingRef = useRef(false);

  // Customer Outstanding Due Balance
  const [customerDue, setCustomerDue] = useState('0.00');

  // Payment Details State
  const [payment, setPayment] = useState({
    paymentMethod: 'Cash',
    customerPaidAmount: '',
    amountReceived: '',
    specialDiscount: '0.00',
    chequeNo: '',
    bank: '',
    dateRealized: '',
  });

  // Lookup Modals
  const [lookupModal, setLookupModal] = useState({
    isOpen: false,
    type: null, // 'customer' | 'item'
    title: '',
    search: '',
  });
  const [lookupPage, setLookupPage] = useState(1);
  const ITEMS_PER_PAGE = 100;

  // Item Dropdown List State (Quick item selection right on Code input)
  const [itemDropdownOpen, setItemDropdownOpen] = useState(false);
  const [highlightedItemIndex, setHighlightedItemIndex] = useState(-1);
  const itemDropdownRef = useRef(null);

  // Customer Display - Item Photo Preview State
  const [selectedItemPreview, setSelectedItemPreview] = useState(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  // Active Item Preview for Customer Display Window
  const activePreviewItem = useMemo(() => {
    // 1. If explicit selectedItemPreview matches current itemEntry.code
    if (selectedItemPreview) {
      if (!itemEntry.code || selectedItemPreview.code?.toLowerCase() === itemEntry.code.trim().toLowerCase()) {
        return selectedItemPreview;
      }
    }
    // 2. If itemEntry.code matches an item in itemsList
    const code = String(itemEntry.code || '').trim().toLowerCase();
    if (code) {
      const match = itemsList.find(
        (i) =>
          i.code?.toLowerCase() === code ||
          (i.barcode && i.barcode.toLowerCase() === code) ||
          i.description?.toLowerCase() === code
      );
      if (match) return match;
    }
    // 3. Fallback to selectedItemPreview if available
    if (selectedItemPreview) return selectedItemPreview;
    // 4. Fallback to active lineItem selected in bottom table
    if (lineItems.length > 0 && selectedLineIndex >= 0 && lineItems[selectedLineIndex]) {
      const selCode = lineItems[selectedLineIndex].code?.toLowerCase();
      const match = itemsList.find((i) => i.code?.toLowerCase() === selCode);
      return match || lineItems[selectedLineIndex];
    }
    return null;
  }, [selectedItemPreview, itemEntry.code, itemsList, lineItems, selectedLineIndex]);

  // Receipt Preview Modal
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // Calculate Discount Modal State
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [discountInputPercentage, setDiscountInputPercentage] = useState('');
  const [discountInputError, setDiscountInputError] = useState('');
  const discountInputRef = useRef(null);

  // Invoice Note Modal State
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteInputText, setNoteInputText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const noteTextareaRef = useRef(null);

  // Input Refs
  const itemCodeInputRef = useRef(null);
  const paidAmountInputRef = useRef(null);
  const dateInputRef = useRef(null);

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

  // Fetch initial data (Next Invoice Number, Customers, Items, Invoices)
  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [nextNumRes, custRes, itemsRes, invsRes] = await Promise.all([
        api.get('/invoices/next-number').catch(() => null),
        api.get('/customers').catch(() => null),
        api.get('/items?limit=all').catch(() => null),
        api.get('/invoices?limit=50').catch(() => null),
      ]);

      if (nextNumRes?.data?.data) {
        const invNum = nextNumRes.data.data.invoiceNumber || String(nextNumRes.data.data.no || 1).padStart(4, '0');
        setInvoiceHeader((prev) => ({
          ...prev,
          no: nextNumRes.data.data.no,
          invoiceNumber: invNum,
        }));
      }
      if (custRes?.data?.data) {
        setCustomersList(custRes.data.data);
      }
      if (itemsRes?.data?.data) {
        setItemsList(itemsRes.data.data);
      }
      if (invsRes?.data?.data) {
        setInvoicesList(invsRes.data.data);
      }

      // Fetch dynamic locations list from Item Master metadata
      api.get('/items/meta/dropdowns').then((mRes) => {
        if (mRes.data?.data?.locations && Array.isArray(mRes.data.data.locations)) {
          setLocationsList((prev) => Array.from(new Set([...prev, ...mRes.data.data.locations])).filter(Boolean));
        }
      }).catch(() => null);
    } catch (e) {
      showNotification('Failed to initialize Sales Invoice data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Close menubar and item dropdowns on outside click
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

  const showNotification = (msg, type = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Fetch Alternative Products for an Item Code
  const fetchAlternativeProducts = async (itemCode) => {
    if (!itemCode || !String(itemCode).trim()) {
      setAlternativeProducts([]);
      return;
    }
    try {
      setLoadingAlternatives(true);
      const res = await api.get(`/alternative-products/${encodeURIComponent(String(itemCode).trim())}`);
      if (res.data?.success && res.data?.data) {
        const altItems = res.data.data.alternativeItems || [];
        setAlternativeProducts(altItems);
      } else {
        setAlternativeProducts([]);
      }
    } catch (e) {
      setAlternativeProducts([]);
    } finally {
      setLoadingAlternatives(false);
    }
  };

  // Automatically fetch alternative products whenever itemEntry.code changes (search/select/typing)
  useEffect(() => {
    const code = String(itemEntry.code || '').trim();
    if (!code) {
      setAlternativeProducts([]);
      return;
    }

    const timer = setTimeout(() => {
      fetchAlternativeProducts(code);
    }, 250);

    return () => clearTimeout(timer);
  }, [itemEntry.code]);

  // Fetch real outstanding due balance whenever selected customer changes
  useEffect(() => {
    let isCancelled = false;
    const code = String(invoiceHeader.customerCode || '').trim();
    if (!code) {
      setCustomerDue('0.00');
      return;
    }

    const fetchCustomerBalance = async () => {
      try {
        const res = await api.get(`/customers/${encodeURIComponent(code)}`);
        if (!isCancelled && res.data?.success && res.data.data) {
          const due = res.data.data.dueAmount !== undefined
            ? res.data.data.dueAmount
            : (res.data.data.outstandingBalance || 0);
          setCustomerDue(Number(due).toFixed(2));
          return;
        }
      } catch (err) {
        // fallback to customersList if API error
      }
      if (!isCancelled) {
        const local = customersList.find(
          (c) => (c.code || c.customerCode || '').toLowerCase() === code.toLowerCase()
        );
        if (local) {
          const due = local.dueAmount !== undefined ? local.dueAmount : (local.outstandingBalance || 0);
          setCustomerDue(Number(due).toFixed(2));
        } else {
          setCustomerDue('0.00');
        }
      }
    };

    fetchCustomerBalance();
    return () => {
      isCancelled = true;
    };
  }, [invoiceHeader.customerCode, customersList]);

  // Load an existing invoice into the form (restoring all details, line items, and payment method)
  const loadInvoiceData = (inv) => {
    if (!inv) return;
    setActiveInvoiceId(inv._id);
    setInvoiceHeader({
      no: inv.no !== undefined ? inv.no : '',
      invoiceNumber: inv.invoiceNumber || '',
      date: inv.date ? new Date(inv.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      customerCode: inv.customerCode || inv.cuscode || '',
      customerName: inv.customerName || inv.cusname || 'Walk In Customer',
      customerAddress: inv.customerAddress || 'No Address',
      customerTelephone: inv.customerTelephone || inv.telephone || '-',
      jd: inv.jd || 'Invoice',
      isHold: Boolean(inv.isHold),
      jobType: inv.jobType || 'Material',
      itemLookupMode: 'Item Code',
      isManualInvoice: false,
      remark: inv.remark || inv.note || '',
      note: inv.note || inv.remark || '',
    });

    const lines = (inv.lineItems || []).map((li) => {
      const isLabour = li.jobType === 'Labour' || li.type === 'Labour' || Boolean(li.isService);
      return {
        code: li.code || li.itemCode || (isLabour ? 'DELIVERY' : ''),
        description: li.description || (isLabour ? 'Delivery Charge' : ''),
        jobType: isLabour ? 'Labour' : (li.jobType || 'Material'),
        type: isLabour ? 'Labour' : (li.type || 'Material'),
        isService: isLabour,
        location: isLabour ? '-' : (li.location || 'Main Store'),
        quantity: Number(li.quantity || li.qty || 1),
        price: Number(li.price || li.unitPrice || 0),
        rate: li.rate !== undefined && li.rate !== null && li.rate !== '' ? String(li.rate) : String(li.price || li.unitPrice || 0),
        discountPercentage: li.discountPercentage !== undefined ? Number(li.discountPercentage) : 0,
        discountAmount: li.discountAmount !== undefined ? Number(li.discountAmount) : 0,
        finalPrice: Number(li.finalPrice !== undefined ? li.finalPrice : (li.value || 0)),
        itemCost: isLabour ? '-' : Number(li.itemCost || 0),
        lastGrn: isLabour ? '-' : (li.lastGrn || ''),
        lastGrnDate: isLabour ? '-' : (li.lastGrnDate || ''),
        masterPack: String(li.masterPack || '1'),
        rateType: li.rateType || 'Retail',
        mpCost: isLabour ? 0 : Number(li.mpCost || 0),
        value: Number(li.value || li.finalPrice || 0),
        total: Number(li.total || li.finalPrice || 0),
        balance: isLabour ? '-' : (li.balance !== undefined ? li.balance : (li.availableQty || 0)),
        availableQty: isLabour ? '-' : (li.availableQty !== undefined ? li.availableQty : (li.balance || 0)),
      };
    });
    setLineItems(lines);

    const loadedMethod = inv.paymentMethod || inv.paidBy || 'Cash';
    const loadedPaid =
      inv.customerPaidAmount !== undefined && inv.customerPaidAmount !== null
        ? String(inv.customerPaidAmount)
        : (inv.amountReceived !== undefined && inv.amountReceived !== null
            ? String(inv.amountReceived)
            : (inv.paidAmount !== undefined ? String(inv.paidAmount) : ''));

    setPayment({
      paymentMethod: loadedMethod,
      customerPaidAmount: loadedPaid,
      amountReceived: String(inv.amountReceived !== undefined ? inv.amountReceived : ''),
      specialDiscount: inv.specialDiscount !== undefined ? String(inv.specialDiscount) : '0.00',
      chequeNo: inv.chequeNo || '',
      bank: inv.bank || '',
      dateRealized: inv.dateRealized || '',
    });

    showNotification(`Loaded Invoice '${inv.invoiceNumber}' (${loadedMethod})`, 'info');
  };

  // Auto-load invoice if navigated from Settlement or Invoices list
  useEffect(() => {
    if (location.state?.invoiceNumber || location.state?.invoiceId) {
      const target = location.state.invoiceNumber || location.state.invoiceId;
      api.get(`/invoices/${encodeURIComponent(target)}`)
        .then((res) => {
          if (res.data?.success && res.data?.data) {
            loadInvoiceData(res.data.data);
          }
        })
        .catch(() => null);
    }
  }, [location.state]);

  // Fetch GRN History for an Item Code to obtain last GRN and last GRN Date
  const fetchItemGrnHistory = async (itemCode) => {
    if (!itemCode || !String(itemCode).trim()) return null;
    try {
      const res = await api.get(`/grn/item-history/${encodeURIComponent(String(itemCode).trim())}`);
      if (res.data?.success && res.data?.data) {
        return res.data.data;
      }
    } catch (e) {
      // ignore
    }
    return null;
  };

  // Helper: compute line item pricing with discount and round off
  const computeLinePricing = (
    priceVal,
    qtyVal,
    discPctVal,
    discAmtVal,
    source = 'percentage',
    roundOption = 'No Round Off',
    roundStep = 10
  ) => {
    const price = parseFloat(priceVal) || 0;
    const qty = Math.max(0, parseFloat(qtyVal) || 0);
    let discPct = parseFloat(discPctVal) || 0;
    let discAmt = parseFloat(discAmtVal) || 0;

    const gross = Math.round(price * qty * 100) / 100;

    if (source === 'amount') {
      discPct = gross > 0 ? (discAmt / gross) * 100 : 0;
    } else {
      discAmt = (gross * discPct) / 100;
    }

    let netValue = Math.max(0, gross - discAmt);

    // Apply Round Off rule if configured
    const step = Number(roundStep) || 10;
    const opt = (roundOption || 'No Round Off').trim();
    if (opt === 'Round Up' || opt === 'Up') {
      netValue = Math.ceil(netValue / step) * step;
    } else if (opt === 'Round Down' || opt === 'Down') {
      netValue = Math.floor(netValue / step) * step;
    }

    return {
      price: priceVal,
      quantity: qtyVal,
      discountPercentage: discPct
        ? (source === 'amount' ? discPct.toFixed(2) : String(discPctVal))
        : (discPctVal !== '' ? String(discPctVal) : ''),
      discountAmount: discAmt
        ? (source === 'percentage' ? discAmt.toFixed(2) : String(discAmtVal))
        : (discAmtVal !== '' ? String(discAmtVal) : ''),
      finalPrice: netValue.toFixed(2),
      value: netValue.toFixed(2),
      total: netValue.toFixed(2),
    };
  };

  // Grand Total of Invoice Items
  const invoiceSubTotal = lineItems.reduce(
    (acc, item) => acc + (parseFloat(item.finalPrice !== undefined ? item.finalPrice : item.value) || 0),
    0
  );
  const specialDiscVal = parseFloat(payment.specialDiscount) || 0;
  const totalAmount = Math.max(0, invoiceSubTotal - specialDiscVal);
  const paidAmount =
    payment.customerPaidAmount !== '' && !isNaN(parseFloat(payment.customerPaidAmount))
      ? parseFloat(payment.customerPaidAmount)
      : (payment.amountReceived !== '' && !isNaN(parseFloat(payment.amountReceived))
          ? parseFloat(payment.amountReceived)
          : 0);

  // Balance: Paid - Total (matches screenshot: Paid 5,000, Total 4,564.80 => Balance 435.20)
  const balanceAmount =
    payment.customerPaidAmount !== '' || payment.amountReceived !== ''
      ? (paidAmount - totalAmount)
      : 0;

  const amountToPay = totalAmount;
  const amountReceivedVal = paidAmount;
  const dueAmount = balanceAmount < 0 ? Math.abs(balanceAmount) : 0;

  // Handle Customer Dropdown Selection
  const handleCustomerDropdownChange = (e) => {
    const val = e.target.value;
    if (!val) {
      setInvoiceHeader((prev) => ({
        ...prev,
        customerCode: '',
        customerName: 'Walk In Customer',
        customerAddress: 'No Address',
        customerTelephone: '-',
      }));
      return;
    }
    const match = customersList.find((c) => (c.code || c.customerCode) === val);
    if (match) {
      setInvoiceHeader((prev) => ({
        ...prev,
        customerCode: match.code || match.customerCode || '',
        customerName: match.name || '',
        customerAddress: match.address || 'No Address',
        customerTelephone: match.telephone1 || match.telephone || '-',
      }));

      // Apply customer discount if configured
      if (match.discount && Number(match.discount) > 0 && !itemEntry.discountPercentage && itemEntry.price) {
        const comp = computeLinePricing(
          itemEntry.price,
          itemEntry.quantity || '1',
          Number(match.discount).toFixed(2),
          '',
          'percentage',
          itemEntry.roundOffOption,
          itemEntry.roundOffStep
        );
        setItemEntry((prev) => ({
          ...prev,
          discountPercentage: comp.discountPercentage,
          discountAmount: comp.discountAmount,
          finalPrice: comp.finalPrice,
          value: comp.finalPrice,
          total: comp.finalPrice,
        }));
      }
    }
  };

  // Select Customer from Lookup Modal
  const handleSelectCustomerFromLookup = (cust) => {
    setInvoiceHeader((prev) => ({
      ...prev,
      customerCode: cust.code || cust.customerCode || '',
      customerName: cust.name || '',
      customerAddress: cust.address || 'No Address',
      customerTelephone: cust.telephone1 || cust.telephone || '-',
    }));

    if (cust.discount && Number(cust.discount) > 0 && !itemEntry.discountPercentage && itemEntry.price) {
      const comp = computeLinePricing(
        itemEntry.price,
        itemEntry.quantity || '1',
        Number(cust.discount).toFixed(2),
        '',
        'percentage',
        itemEntry.roundOffOption,
        itemEntry.roundOffStep
      );
      setItemEntry((prev) => ({
        ...prev,
        discountPercentage: comp.discountPercentage,
        discountAmount: comp.discountAmount,
        finalPrice: comp.finalPrice,
        value: comp.finalPrice,
        total: comp.finalPrice,
      }));
    }
    setLookupModal({ isOpen: false, type: null, title: '', search: '' });
  };

  // Select Customer from Left Listbox
  const handleSelectCustomerFromListbox = (cust) => {
    if (!cust) return;
    const code = cust.code || cust.customerCode || '';
    setInvoiceHeader((prev) => ({
      ...prev,
      customerCode: code,
      customerName: cust.name || '',
      customerAddress: cust.address || 'No Address',
      customerTelephone: cust.telephone1 || cust.telephone || '-',
    }));

    if (cust.discount && Number(cust.discount) > 0 && itemEntry.price) {
      const comp = computeLinePricing(
        itemEntry.price,
        itemEntry.quantity || '1',
        Number(cust.discount).toFixed(2),
        '',
        'percentage',
        itemEntry.roundOffOption,
        itemEntry.roundOffStep
      );
      setItemEntry((prev) => ({
        ...prev,
        discountPercentage: comp.discountPercentage,
        discountAmount: comp.discountAmount,
        finalPrice: comp.finalPrice,
        value: comp.finalPrice,
        total: comp.finalPrice,
      }));
    }
  };

  // Calculate subtotal, discount amounts, and preview totals for Calculate Discount Modal
  const discountCalculationSummary = useMemo(() => {
    // 1. Filter eligible material items (excluding Labour / delivery charge lines)
    const eligibleItems = lineItems.filter(
      (li) => !li.isService && li.jobType !== 'Labour' && li.type !== 'Labour'
    );
    const nonEligibleItems = lineItems.filter(
      (li) => li.isService || li.jobType === 'Labour' || li.type === 'Labour'
    );

    // 2. Gross subtotal of eligible items based on original unit selling prices
    const eligibleGrossSubTotal = eligibleItems.reduce((acc, item) => {
      const p = parseFloat(item.sellingPrice !== undefined ? item.sellingPrice : (item.price || 0)) || 0;
      const q = parseFloat(item.quantity) || 1;
      return acc + (p * q);
    }, 0);

    // 3. Gross subtotal of non-eligible items (Labour/delivery charges)
    const nonEligibleGrossSubTotal = nonEligibleItems.reduce((acc, item) => {
      const p = parseFloat(item.sellingPrice !== undefined ? item.sellingPrice : (item.price || 0)) || 0;
      const q = parseFloat(item.quantity) || 1;
      return acc + (p * q);
    }, 0);

    const totalGrossSubTotal = eligibleGrossSubTotal + nonEligibleGrossSubTotal;

    const parsedPct = parseFloat(discountInputPercentage);
    const isValidPct = !isNaN(parsedPct) && parsedPct >= 0 && parsedPct <= 100;
    const effectivePct = isValidPct ? parsedPct : 0;

    // 4. Calculate total discount amount across eligible items with per-line 2-decimal precision
    const calculatedDiscountAmount = eligibleItems.reduce((acc, item) => {
      const p = parseFloat(item.sellingPrice !== undefined ? item.sellingPrice : (item.price || 0)) || 0;
      const q = parseFloat(item.quantity) || 1;
      const gross = Math.round(p * q * 100) / 100;
      const discAmt = Math.round((gross * effectivePct) / 100 * 100) / 100;
      return acc + discAmt;
    }, 0);

    const specDisc = parseFloat(payment.specialDiscount) || 0;
    const newNetTotal = Math.max(0, Math.round((totalGrossSubTotal - calculatedDiscountAmount - specDisc) * 100) / 100);

    return {
      eligibleCount: eligibleItems.length,
      nonEligibleCount: nonEligibleItems.length,
      eligibleGrossSubTotal: Math.round(eligibleGrossSubTotal * 100) / 100,
      totalGrossSubTotal: Math.round(totalGrossSubTotal * 100) / 100,
      effectivePct,
      isValidPct,
      calculatedDiscountAmount: Math.round(calculatedDiscountAmount * 100) / 100,
      newNetTotal,
    };
  }, [lineItems, discountInputPercentage, payment.specialDiscount]);

  // Button: Cal. Discount (Open Calculate Discount Modal)
  const handleCalculateDiscount = () => {
    // Check if eligible items share an existing discount percentage
    const eligibleItems = lineItems.filter(
      (li) => !li.isService && li.jobType !== 'Labour' && li.type !== 'Labour'
    );
    if (eligibleItems.length > 0) {
      const firstDisc = eligibleItems[0].discountPercentage;
      const allSame = eligibleItems.every((li) => Number(li.discountPercentage) === Number(firstDisc));
      setDiscountInputPercentage(allSame && Number(firstDisc) > 0 ? String(firstDisc) : '');
    } else {
      setDiscountInputPercentage('');
    }
    setDiscountInputError('');
    setDiscountModalOpen(true);
    setTimeout(() => {
      discountInputRef.current?.focus();
      discountInputRef.current?.select();
    }, 50);
  };

  // Close Calculate Discount Modal
  const handleCloseDiscountModal = () => {
    setDiscountModalOpen(false);
    setDiscountInputError('');
  };

  // Clear Calculate Discount Modal input
  const handleClearDiscountModal = () => {
    setDiscountInputPercentage('');
    setDiscountInputError('');
    discountInputRef.current?.focus();
  };

  // Handle Percentage Input Change
  const handleDiscountPercentageInputChange = (val) => {
    setDiscountInputPercentage(val);
    if (val === '') {
      setDiscountInputError('');
      return;
    }
    const num = parseFloat(val);
    if (isNaN(num)) {
      setDiscountInputError('Please enter a valid number');
    } else if (num < 0 || num > 100) {
      setDiscountInputError('Percentage must be between 0% and 100%');
    } else {
      setDiscountInputError('');
    }
  };

  // Apply Common Discount to All Eligible Items
  const handleApplyDiscountModal = () => {
    const rawVal = String(discountInputPercentage || '').trim();
    if (rawVal === '') {
      setDiscountInputError('Please enter a discount percentage');
      discountInputRef.current?.focus();
      return;
    }

    const pct = parseFloat(rawVal);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      setDiscountInputError('Percentage must be between 0% and 100%');
      discountInputRef.current?.focus();
      return;
    }

    const eligibleCount = lineItems.filter(
      (li) => !li.isService && li.jobType !== 'Labour' && li.type !== 'Labour'
    ).length;

    if (eligibleCount === 0) {
      showNotification('No eligible material items in invoice to apply discount', 'warning');
      setDiscountModalOpen(false);
      return;
    }

    // Apply common discount percentage to all eligible items
    // Replaces previous discount percentage rather than stacking
    setLineItems((prev) =>
      prev.map((item) => {
        const isLabour = item.jobType === 'Labour' || item.type === 'Labour' || Boolean(item.isService);
        if (isLabour) return item;

        const price = Number(item.sellingPrice !== undefined ? item.sellingPrice : item.price) || 0;
        const qty = Number(item.quantity) || 1;
        const gross = Math.round(price * qty * 100) / 100;
        const discAmt = Math.round((gross * pct) / 100 * 100) / 100;
        const netValue = Math.max(0, Math.round((gross - discAmt) * 100) / 100);

        return {
          ...item,
          discountPercentage: pct,
          discountAmount: discAmt,
          discount: pct > 0 ? `${pct}%` : '0%',
          value: netValue,
          finalPrice: netValue,
          total: netValue,
        };
      })
    );

    // Also update draft itemEntry if an eligible item is currently loaded
    if (itemEntry.code && invoiceHeader.jobType !== 'Labour') {
      const price = parseFloat(itemEntry.price !== '' ? itemEntry.price : (itemEntry.rate || 0)) || 0;
      const qty = parseFloat(itemEntry.quantity) || 1;
      const comp = computeLinePricing(
        price,
        qty,
        pct,
        0,
        'percentage',
        itemEntry.roundOffOption,
        itemEntry.roundOffStep
      );
      setItemEntry((prev) => ({
        ...prev,
        discountPercentage: String(pct),
        discountAmount: comp.discountAmount,
        finalPrice: comp.finalPrice,
        value: comp.finalPrice,
        total: comp.finalPrice,
      }));
    }

    setDiscountModalOpen(false);
    setDiscountInputError('');
    showNotification(`Applied ${pct}% discount to all eligible invoice items`, 'success');
  };

  // Button: Rem. Discount (Remove Discount)
  const handleRemoveDiscount = () => {
    setItemEntry((prev) => {
      const comp = computeLinePricing(
        prev.price,
        prev.quantity || '1',
        '0',
        '0',
        'percentage',
        prev.roundOffOption,
        prev.roundOffStep
      );
      return {
        ...prev,
        discountPercentage: '0',
        discountAmount: '0',
        finalPrice: comp.finalPrice,
        value: comp.finalPrice,
        total: comp.finalPrice,
      };
    });
    setLineItems((prev) =>
      prev.map((item) => {
        const isLabour = item.jobType === 'Labour' || item.type === 'Labour' || Boolean(item.isService);
        if (isLabour) return item;
        const price = Number(item.sellingPrice !== undefined ? item.sellingPrice : item.price) || 0;
        const qty = Number(item.quantity) || 1;
        const gross = Math.round(price * qty * 100) / 100;
        return {
          ...item,
          discountPercentage: 0,
          discountAmount: 0,
          discount: '0%',
          value: gross,
          finalPrice: gross,
          total: gross,
        };
      })
    );
    showNotification('Discounts removed');
  };

  // Open Invoice Note Modal
  const handleOpenNoteModal = () => {
    setNoteInputText(invoiceHeader.note || invoiceHeader.remark || '');
    setNoteModalOpen(true);
    setTimeout(() => {
      noteTextareaRef.current?.focus();
    }, 50);
  };

  // Close Invoice Note Modal (Cancel)
  const handleCloseNoteModal = () => {
    setNoteModalOpen(false);
  };

  // Clear Note input
  const handleClearNoteModal = () => {
    setNoteInputText('');
    noteTextareaRef.current?.focus();
  };

  // Save Note to invoice
  const handleSaveNoteModal = async () => {
    const trimmed = (noteInputText || '').trim();

    // 1. Update local invoiceHeader state immediately
    setInvoiceHeader((prev) => ({
      ...prev,
      note: trimmed,
      remark: trimmed,
    }));

    // 2. If invoice is already persisted in database, save directly via dedicated note endpoint
    if (activeInvoiceId) {
      try {
        setSavingNote(true);
        const res = await api.patch(`/invoices/${activeInvoiceId}/note`, {
          note: trimmed,
          remark: trimmed,
        });
        if (res.data?.success) {
          showNotification('Invoice note saved successfully', 'success');
        } else {
          showNotification('Note attached to invoice', 'info');
        }
      } catch (err) {
        console.error('Error saving invoice note:', err);
        try {
          await api.put(`/invoices/${activeInvoiceId}`, {
            note: trimmed,
            remark: trimmed,
          });
          showNotification('Invoice note saved successfully', 'success');
        } catch (e2) {
          showNotification('Note saved locally in invoice session', 'info');
        }
      } finally {
        setSavingNote(false);
      }
    } else {
      // 3. Draft invoice: retained in draft state, will persist upon invoice save
      showNotification('Note attached to draft invoice', 'info');
    }

    setNoteModalOpen(false);
  };

  // Select Invoice from Lookup Modal
  const handleSelectInvoiceFromLookup = (inv) => {
    loadInvoiceData(inv);
    setLookupModal({ isOpen: false, type: null, title: '', search: '' });
  };

  // =========================================================================
  // ITEM SELECTION & STOCK MANAGEMENT
  // =========================================================================

  // Central function: Load item into entry draft with real stock, location, price, cost, and discount
  const loadItemIntoEntry = async (itemOrCode, requestedQty = '1') => {
    if (!itemOrCode) return;
    const code = typeof itemOrCode === 'string' ? itemOrCode.trim() : (itemOrCode.code || '').trim();
    if (!code) return;

    let item = typeof itemOrCode === 'object' && itemOrCode.description ? itemOrCode : null;
    if (!item || item.quantity === undefined) {
      item = itemsList.find(
        (i) =>
          i.code?.toLowerCase() === code.toLowerCase() ||
          i.barcode?.toLowerCase() === code.toLowerCase() ||
          i.barCode?.toLowerCase() === code.toLowerCase()
      );
    }

    // Always fetch latest data from backend API to guarantee real-time stock and GRN cost
    try {
      const res = await api.get(`/items/${encodeURIComponent(code)}`);
      if (res.data?.success && res.data?.data) {
        item = res.data.data;
      }
    } catch (e) {
      // fallback to preloaded item if network call fails
    }

    if (!item) {
      showNotification(`Item '${code}' not found in Item Master`, 'error');
      return;
    }

    setSelectedItemPreview(item);

    // 1. Location: Selected item's actual stock location from database
    const actualLocation = item.location || 'Main Store';

    // 2. Stock: Actual available quantity for selected item and location
    const storedStock = Number(
      item.quantity !== undefined
        ? item.quantity
        : (item.stockInHand !== undefined ? item.stockInHand : 0)
    );

    // 3. Selling Price: From Item Master
    const sellingPrice = Number(
      item.sellingPrice !== undefined && Number(item.sellingPrice) >= 0
        ? item.sellingPrice
        : (item.finalSellingPrice !== undefined ? item.finalSellingPrice : 0)
    );

    // 4. Discount: Customer discount configured in Item Master / Customer Details
    let initDiscPct = '';
    if (invoiceHeader.customerCode) {
      const cust = customersList.find((c) => (c.code || c.customerCode) === invoiceHeader.customerCode);
      if (cust && cust.discount && Number(cust.discount) > 0) {
        initDiscPct = String(cust.discount);
      }
    }
    if (!initDiscPct && item.discountPercentage && Number(item.discountPercentage) > 0) {
      initDiscPct = String(item.discountPercentage);
    }

    const roundOpt = item.roundOffOption || 'No Round Off';
    const roundStp = item.roundOffStep || 10;

    // 5. Quantity & Value: Default customer purchase quantity (editable, default 1)
    const validQty = requestedQty && !isNaN(parseFloat(requestedQty)) && parseFloat(requestedQty) > 0 ? String(requestedQty) : '1';
    const comp = computeLinePricing(
      sellingPrice,
      validQty,
      initDiscPct,
      '',
      'percentage',
      roundOpt,
      roundStp
    );

    // 6. Cost: Last GRN purchase cost from supplier
    const grnHistory = await fetchItemGrnHistory(item.code);
    const hasHistory = Boolean(grnHistory?.summary?.hasGrnHistory);
    const latestCost = grnHistory?.summary?.latestGrnCost;
    const costDisplay =
      hasHistory && latestCost !== null && latestCost !== undefined
        ? Number(latestCost).toFixed(2)
        : (item.lastGrnPrice ? Number(item.lastGrnPrice).toFixed(2) : (item.averageCost ? Number(item.averageCost).toFixed(2) : '0.00'));

    const lastGrnFormatted = grnHistory?.summary?.lastGrnFormatted || item.lastGrn || '-';
    const grnNum = grnHistory?.summary?.latestGrnNumber || item.lastGrn || '';
    const grnDate = grnHistory?.summary?.latestGrnDate
      ? new Date(grnHistory.summary.latestGrnDate).toISOString().split('T')[0]
      : (item.lastGrnDate ? String(item.lastGrnDate).split('T')[0] : '');

    // Populate draft item entry
    setItemEntry({
      code: item.code,
      description: item.description || '',
      secondDesc: item.secondDesc || '',
      location: actualLocation,
      storedLocation: actualLocation,
      totalStoredStock: storedStock,
      availableQty: storedStock, // actual database stock!
      quantity: validQty, // customer purchase quantity (editable)
      price: sellingPrice,
      rate: sellingPrice ? Number(sellingPrice).toFixed(2) : '0.00',
      itemCost: costDisplay,
      lastGrn: grnNum,
      lastGrnDate: grnDate,
      lastGrnFormatted: lastGrnFormatted,
      roundOffOption: roundOpt,
      roundOffStep: roundStp,
      discountPercentage: comp.discountPercentage,
      discountAmount: comp.discountAmount,
      finalPrice: comp.finalPrice,
      masterPack: item.masterPack || '1',
      rateType: 'Retail',
      mpCost: item.averageCost || 0,
      value: comp.finalPrice,
      balance: storedStock,
      total: comp.finalPrice,
      note: '',
    });

    // Make sure locationsList has this item's location
    if (actualLocation) {
      setLocationsList((prev) => {
        if (!prev.includes(actualLocation)) {
          return [...prev, actualLocation];
        }
        return prev;
      });
    }

    // Stock display rules: Warn if out of stock
    if (storedStock <= 0) {
      showNotification(`Warning: Item '${item.code}' has NO available stock (Available: 0) in ${actualLocation}`, 'error');
    }

    fetchAlternativeProducts(item.code);
    setItemDropdownOpen(false);
    setHighlightedItemIndex(-1);
    setLookupModal({ isOpen: false, type: null, title: '', search: '' });
  };

  // Change location for selected item & refresh available stock
  const handleItemLocationChange = (newLocation) => {
    setItemEntry((prev) => {
      if (!prev.code) {
        return { ...prev, location: newLocation };
      }

      const storedLoc = prev.storedLocation || 'Main Store';
      const storedQty = prev.totalStoredStock !== undefined ? Number(prev.totalStoredStock) : Number(prev.availableQty || 0);

      if (newLocation.toLowerCase() === storedLoc.toLowerCase()) {
        showNotification(`Location switched to '${newLocation}'. Available stock: ${storedQty}`, 'info');
        return {
          ...prev,
          location: newLocation,
          availableQty: storedQty,
          balance: storedQty,
        };
      } else {
        showNotification(
          `Warning: Item '${prev.code}' is not stored in '${newLocation}' (Available: 0). Stored in: '${storedLoc}' (${storedQty})`,
          'error'
        );
        return {
          ...prev,
          location: newLocation,
          availableQty: 0,
          balance: 0,
        };
      }
    });
  };

  // Handle Job Type Change (Material, Labour / Delivery, Group, J.G.)
  const handleJobTypeChange = (newJobType) => {
    const prevJobType = invoiceHeader.jobType;
    setInvoiceHeader((prev) => ({ ...prev, jobType: newJobType }));

    if (newJobType === 'Labour') {
      // Switching to Labour: pre-populate delivery charge defaults
      setItemDropdownOpen(false);
      setAlternativeProducts([]);
      setSelectedItemPreview(null);
      setItemEntry((prev) => {
        const isAlreadyLabour = prev.code === 'DELIVERY' || prev.description === 'Delivery Charge';
        const currentQty = prev.quantity && parseFloat(prev.quantity) > 0 ? prev.quantity : '1';
        const currentRate = isAlreadyLabour && prev.rate ? prev.rate : (prev.rate && prev.rate !== '0' && prev.rate !== '0.00' ? prev.rate : '');
        const currentPrice = currentRate || '';
        const comp = computeLinePricing(
          currentPrice || '0',
          currentQty,
          prev.discountPercentage || '',
          prev.discountAmount || '',
          'percentage',
          prev.roundOffOption,
          prev.roundOffStep
        );

        return {
          ...prev,
          code: prev.code && prev.code !== '' && prev.code !== 'DELIVERY' && prevJobType === 'Labour' ? prev.code : 'DELIVERY',
          description: prev.description && prev.description.trim() !== '' && prevJobType === 'Labour' ? prev.description : 'Delivery Charge',
          secondDesc: '',
          location: '-',
          storedLocation: '-',
          totalStoredStock: '-',
          rackBin: '',
          availableQty: '-',
          quantity: currentQty,
          rate: currentRate,
          price: currentPrice,
          standardRate: '',
          discountPercentage: comp.discountPercentage,
          discountAmount: comp.discountAmount,
          finalPrice: comp.finalPrice,
          itemCost: '-',
          lastGrn: '-',
          lastGrnDate: '-',
          lastGrnFormatted: '-',
          masterPack: '1',
          rateType: 'Retail',
          mpCost: '',
          roundOffOption: 'No Round Off',
          roundOffStep: 10,
          value: comp.finalPrice,
          due: '',
          balance: '-',
          disc: '',
          total: comp.finalPrice,
          note: prev.note || '',
        };
      });
      showNotification('Switched to Labour mode: Enter delivery charge details', 'info');
    } else if (newJobType === 'Material' && prevJobType === 'Labour') {
      // Switching back to Material from Labour: clear delivery entry ready for stock items
      if (itemEntry.code === 'DELIVERY' || itemEntry.description === 'Delivery Charge') {
        setItemEntry({
          code: '',
          description: '',
          secondDesc: '',
          location: 'Main Store',
          storedLocation: 'Main Store',
          totalStoredStock: '',
          rackBin: '',
          availableQty: '',
          quantity: '1',
          rate: '0',
          standardRate: '',
          discountPercentage: '',
          discountAmount: '',
          finalPrice: '',
          itemCost: '',
          lastGrn: '',
          lastGrnDate: '',
          lastGrnFormatted: '',
          price: '',
          masterPack: '1',
          rateType: 'Retail',
          mpCost: '',
          roundOffOption: 'No Round Off',
          roundOffStep: 10,
          value: '0.00',
          due: '',
          balance: '',
          disc: '',
          total: '0.00',
          note: '',
        });
      }
      showNotification('Switched to Material mode: Select items from Item Master', 'info');
    }
  };

  // Select Item from Lookup Modal
  const handleSelectItemFromLookup = async (item) => {
    if (!item) return;
    setSelectedItemPreview(item);
    await loadItemIntoEntry(item, itemEntry.quantity || '1');
  };

  // Handle Keyboard navigation on Item Code input
  const handleCodeKeyDown = (e) => {
    if (invoiceHeader.jobType === 'Labour') {
      if (e.key === 'Enter') {
        e.preventDefault();
        const price = parseFloat(itemEntry.price !== '' ? itemEntry.price : (itemEntry.rate || 0));
        if (price > 0) {
          handleAddOrUpdateItem();
        }
      }
      return;
    }

    if (e.key === 'F2' || e.key === 'F4') {
      e.preventDefault();
      e.stopPropagation();
      setItemDropdownOpen(false);
      setLookupModal({
        isOpen: true,
        type: 'item',
        title: 'Select Item from Item Master',
        search: itemEntry.code || '',
      });
      setLookupPage(1);
      return;
    }
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
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (
        itemDropdownOpen &&
        highlightedItemIndex >= 0 &&
        filteredDropdownItems[highlightedItemIndex]
      ) {
        loadItemIntoEntry(filteredDropdownItems[highlightedItemIndex], itemEntry.quantity || '1');
        setItemDropdownOpen(false);
        setHighlightedItemIndex(-1);
        return;
      }

      const query = String(itemEntry.code || '').trim().toLowerCase();
      if (!query) {
        setItemDropdownOpen(false);
        setLookupModal({
          isOpen: true,
          type: 'item',
          title: 'Select Item from Item Master',
          search: '',
        });
        setLookupPage(1);
        return;
      }

      const match = itemsList.find(
        (i) =>
          i.code?.toLowerCase() === query ||
          i.barcode?.toLowerCase() === query ||
          i.barCode?.toLowerCase() === query ||
          i.description?.toLowerCase() === query
      );

      if (match) {
        loadItemIntoEntry(match, itemEntry.quantity || '1');
        setItemDropdownOpen(false);
        setHighlightedItemIndex(-1);
      } else if (filteredDropdownItems.length > 0) {
        loadItemIntoEntry(filteredDropdownItems[0], itemEntry.quantity || '1');
        setItemDropdownOpen(false);
        setHighlightedItemIndex(-1);
      } else {
        // Query backend directly in case item wasn't preloaded
        api.get(`/items/${encodeURIComponent(query)}`)
          .then((res) => {
            if (res.data?.success && res.data.data) {
              loadItemIntoEntry(res.data.data, itemEntry.quantity || '1');
            } else {
              api.get(`/items?search=${encodeURIComponent(query)}&limit=10`)
                .then((sRes) => {
                  if (sRes.data?.data && sRes.data.data.length > 0) {
                    loadItemIntoEntry(sRes.data.data[0], itemEntry.quantity || '1');
                  } else {
                    showNotification(`Item '${query}' not found in Item Master`, 'error');
                  }
                })
                .catch(() => null);
            }
          })
          .catch(() => {
            showNotification(`Item '${query}' not found in Item Master`, 'error');
          });
        setItemDropdownOpen(false);
      }
    }
  };

  // Handle Item Entry Changes
  const handleItemEntryChange = (e) => {
    const { name, value } = e.target;
    let updated = { ...itemEntry, [name]: value };
    const isLabour = invoiceHeader.jobType === 'Labour';

    // Auto-match Item by Code or Barcode (Material only)
    if (name === 'code') {
      if (isLabour) {
        setItemDropdownOpen(false);
        setItemEntry(updated);
        return;
      }
      setItemDropdownOpen(true);
      setHighlightedItemIndex(0);
      const trimmed = String(value || '').trim().toLowerCase();
      const match = itemsList.find(
        (i) =>
          (i.code && String(i.code).toLowerCase() === trimmed) ||
          (i.itemCode && String(i.itemCode).toLowerCase() === trimmed) ||
          (i.barcode && String(i.barcode).toLowerCase() === trimmed) ||
          (i.barCode && String(i.barCode).toLowerCase() === trimmed)
      );

      if (match) {
        loadItemIntoEntry(match, itemEntry.quantity || '1');
        return;
      } else {
        setAlternativeProducts([]);
      }
    }

    // Quantity change: validate customer purchase quantity against available stock and recalculate Value
    if (name === 'quantity') {
      let qtyVal = value;
      const numQty = parseFloat(qtyVal);
      if (!isLabour) {
        const avail = parseFloat(itemEntry.availableQty !== undefined && itemEntry.availableQty !== '' ? itemEntry.availableQty : 0);

        if (!isNaN(numQty) && !isNaN(avail) && avail > 0 && numQty > avail) {
          showNotification(`Warning: Requested purchase quantity (${numQty}) exceeds available stock (${avail})!`, 'error');
        } else if (!isNaN(numQty) && numQty <= 0) {
          showNotification('Purchase quantity must be greater than 0', 'error');
        }
      }

      const comp = computeLinePricing(
        itemEntry.price || itemEntry.rate || '0',
        qtyVal,
        itemEntry.discountPercentage,
        itemEntry.discountAmount,
        'percentage',
        itemEntry.roundOffOption,
        itemEntry.roundOffStep
      );
      updated.quantity = qtyVal;
      updated.discountPercentage = comp.discountPercentage;
      updated.discountAmount = comp.discountAmount;
      updated.finalPrice = comp.finalPrice;
      updated.value = comp.finalPrice;
      updated.total = comp.finalPrice;
    } else if (name === 'rate') {
      const comp = computeLinePricing(
        value,
        itemEntry.quantity || '1',
        itemEntry.discountPercentage,
        itemEntry.discountAmount,
        'percentage',
        itemEntry.roundOffOption,
        itemEntry.roundOffStep
      );
      updated.rate = value;
      updated.price = value;
      updated.discountPercentage = comp.discountPercentage;
      updated.discountAmount = comp.discountAmount;
      updated.finalPrice = comp.finalPrice;
      updated.value = comp.finalPrice;
      updated.total = comp.finalPrice;
    } else if (name === 'price') {
      const comp = computeLinePricing(
        value,
        itemEntry.quantity || '1',
        itemEntry.discountPercentage,
        itemEntry.discountAmount,
        'percentage',
        itemEntry.roundOffOption,
        itemEntry.roundOffStep
      );
      updated.price = value;
      updated.rate = value;
      updated.discountPercentage = comp.discountPercentage;
      updated.discountAmount = comp.discountAmount;
      updated.finalPrice = comp.finalPrice;
      updated.value = comp.finalPrice;
      updated.total = comp.finalPrice;
    } else if (name === 'discountPercentage') {
      const comp = computeLinePricing(
        itemEntry.price || itemEntry.rate || '0',
        itemEntry.quantity || '1',
        value,
        itemEntry.discountAmount,
        'percentage',
        itemEntry.roundOffOption,
        itemEntry.roundOffStep
      );
      updated.discountPercentage = comp.discountPercentage;
      updated.discountAmount = comp.discountAmount;
      updated.finalPrice = comp.finalPrice;
      updated.value = comp.finalPrice;
      updated.total = comp.finalPrice;
    } else if (name === 'discountAmount') {
      const comp = computeLinePricing(
        itemEntry.price || itemEntry.rate || '0',
        itemEntry.quantity || '1',
        itemEntry.discountPercentage,
        value,
        'amount',
        itemEntry.roundOffOption,
        itemEntry.roundOffStep
      );
      updated.discountPercentage = comp.discountPercentage;
      updated.discountAmount = comp.discountAmount;
      updated.finalPrice = comp.finalPrice;
      updated.value = comp.finalPrice;
      updated.total = comp.finalPrice;
    }

    setItemEntry(updated);
  };

  // Select an Alternative Product to load into item entry
  const handleSelectAlternativeProduct = async (alt) => {
    if (!alt || !alt.code) return;
    await loadItemIntoEntry(alt.code, '1');
  };

  // Add or Update Line Item in Table (Add Item Button or Enter key)
  const handleAddOrUpdateItem = () => {
    if (isAddingRef.current) return;
    isAddingRef.current = true;
    setTimeout(() => {
      isAddingRef.current = false;
    }, 350);

    const isLabour = invoiceHeader.jobType === 'Labour';

    // 1. Validate Item Code / Description
    if (isLabour) {
      if (!itemEntry.description || itemEntry.description.trim() === '') {
        showNotification('Please enter a description for the delivery charge', 'error');
        return;
      }
    } else {
      if (!itemEntry.code || itemEntry.code.trim() === '') {
        showNotification('Please enter or select an Item Code first', 'error');
        itemCodeInputRef.current?.focus();
        return;
      }
    }

    // 2. Validate quantity and selling price / delivery charge
    const saleQty = parseFloat(itemEntry.quantity);
    if (isNaN(saleQty) || saleQty <= 0) {
      showNotification('Please enter a valid purchase quantity greater than 0', 'error');
      return;
    }

    const price = parseFloat(itemEntry.price !== '' ? itemEntry.price : (itemEntry.rate || 0));
    if (isNaN(price) || price < 0) {
      showNotification(isLabour ? 'Please enter a valid delivery charge amount' : 'Please enter a valid selling price', 'error');
      return;
    }

    // 3. Stock validation (Physical Material items only!)
    let avail = 0;
    if (!isLabour) {
      avail = parseFloat(itemEntry.availableQty !== undefined && itemEntry.availableQty !== '' ? itemEntry.availableQty : 0);
      if (isNaN(avail) || avail <= 0) {
        showNotification(
          `Cannot add item '${itemEntry.code}' — No stock available in location '${itemEntry.location || 'Main Store'}' (Available: 0)`,
          'error'
        );
        return;
      }

      if (saleQty > avail) {
        showNotification(
          `Cannot add item '${itemEntry.code}' — Requested purchase quantity (${saleQty}) exceeds available stock (${avail})`,
          'error'
        );
        return;
      }
    }

    const discPct = parseFloat(itemEntry.discountPercentage) || 0;
    const discAmt = parseFloat(itemEntry.discountAmount) || 0;
    const comp = computeLinePricing(
      price,
      saleQty,
      discPct,
      discAmt,
      'percentage',
      itemEntry.roundOffOption,
      itemEntry.roundOffStep
    );
    const finalPrice = parseFloat(comp.finalPrice) || Math.max(0, (price * saleQty) - discAmt);

    const newLineItem = {
      code: isLabour
        ? (itemEntry.code ? itemEntry.code.trim().toUpperCase() : 'DELIVERY')
        : itemEntry.code.trim().toUpperCase(),
      description: isLabour
        ? (itemEntry.description?.trim() || 'Delivery Charge')
        : (itemEntry.description || ''),
      jobType: isLabour ? 'Labour' : 'Material',
      type: isLabour ? 'Labour' : 'Material',
      isService: isLabour,
      location: isLabour ? '-' : (itemEntry.location || 'Main Store'),
      availableQty: isLabour ? '-' : avail,
      quantity: saleQty,
      sellingPrice: price,
      price: price,
      rate: itemEntry.rate || String(price),
      discountPercentage: discPct,
      discountAmount: parseFloat(comp.discountAmount) || 0,
      discount: discPct > 0 ? `${discPct}%` : (discAmt > 0 ? discAmt.toFixed(2) : '0%'),
      value: finalPrice,
      finalPrice: finalPrice,
      itemCost: isLabour ? '-' : (itemEntry.itemCost || '-'),
      lastGrn: isLabour ? '-' : (itemEntry.lastGrn || ''),
      lastGrnDate: isLabour ? '-' : (itemEntry.lastGrnDate || ''),
      note: itemEntry.note || '',
    };

    if (selectedLineIndex >= 0) {
      // Editing an existing line item in the table
      const updated = [...lineItems];
      updated[selectedLineIndex] = newLineItem;
      setLineItems(updated);
      setSelectedLineIndex(-1);
      showNotification(`Updated ${isLabour ? 'delivery charge' : `item ${newLineItem.code}`} in invoice`, 'success');
    } else if (isLabour) {
      // Labour delivery charge: always add as a separate line (supports multiple delivery/labour charges)
      setLineItems([...lineItems, newLineItem]);
      showNotification(`Added ${newLineItem.description} (Rs. ${finalPrice.toFixed(2)}) to invoice`, 'success');
    } else {
      // Material items: merge with existing line if same code & location
      const existingIdx = lineItems.findIndex(
        (li) => !li.isService && li.code?.toUpperCase() === newLineItem.code && (li.location || 'Main Store') === newLineItem.location
      );

      if (existingIdx >= 0) {
        const existingLine = lineItems[existingIdx];
        const combinedQty = (parseFloat(existingLine.quantity) || 0) + saleQty;
        if (combinedQty > avail) {
          showNotification(
            `Cannot add ${saleQty} more of '${newLineItem.code}'. Already in invoice: ${existingLine.quantity}. Total (${combinedQty}) would exceed available stock (${avail}).`,
            'error'
          );
          return;
        }

        const combinedComp = computeLinePricing(
          price,
          combinedQty,
          discPct,
          discAmt,
          'percentage',
          itemEntry.roundOffOption,
          itemEntry.roundOffStep
        );

        const updated = [...lineItems];
        updated[existingIdx] = {
          ...existingLine,
          quantity: combinedQty,
          sellingPrice: price,
          price: price,
          discountPercentage: discPct,
          discountAmount: parseFloat(combinedComp.discountAmount) || 0,
          discount: discPct > 0 ? `${discPct}%` : '0%',
          value: parseFloat(combinedComp.finalPrice) || 0,
          finalPrice: parseFloat(combinedComp.finalPrice) || 0,
        };
        setLineItems(updated);
        showNotification(`Updated item ${newLineItem.code} quantity to ${combinedQty} in invoice`, 'success');
      } else {
        setLineItems([...lineItems, newLineItem]);
        showNotification(`Added item ${newLineItem.code} to invoice`, 'success');
      }
    }

    // Reset item entry fields
    if (isLabour) {
      setItemEntry({
        code: 'DELIVERY',
        description: 'Delivery Charge',
        secondDesc: '',
        location: '-',
        storedLocation: '-',
        totalStoredStock: '-',
        rackBin: '',
        availableQty: '-',
        quantity: '1',
        rate: '',
        standardRate: '',
        discountPercentage: '',
        discountAmount: '',
        finalPrice: '0.00',
        itemCost: '-',
        lastGrn: '-',
        lastGrnDate: '-',
        lastGrnFormatted: '-',
        price: '',
        masterPack: '1',
        rateType: 'Retail',
        mpCost: '',
        roundOffOption: 'No Round Off',
        roundOffStep: 10,
        value: '0.00',
        due: '',
        balance: '-',
        disc: '',
        total: '0.00',
        note: '',
      });
    } else {
      setItemEntry({
        code: '',
        description: '',
        secondDesc: '',
        location: 'Main Store',
        storedLocation: 'Main Store',
        totalStoredStock: '',
        rackBin: '',
        availableQty: '',
        quantity: '1',
        rate: '0',
        standardRate: '',
        discountPercentage: '',
        discountAmount: '',
        finalPrice: '',
        itemCost: '',
        lastGrn: '',
        lastGrnDate: '',
        lastGrnFormatted: '',
        price: '',
        masterPack: '1',
        rateType: 'Retail',
        mpCost: '',
        roundOffOption: 'No Round Off',
        roundOffStep: 10,
        value: '0.00',
        due: '',
        balance: '',
        disc: '',
        total: '0.00',
        note: '',
      });
    }
    setSelectedItemPreview(null);
    setAlternativeProducts([]);
    itemCodeInputRef.current?.focus();
  };

  // Click row in table to load back into item entry
  const handleRowClick = (index) => {
    setSelectedLineIndex(index);
    const item = lineItems[index];
    if (item) {
      const isLabour = item.jobType === 'Labour' || item.isService;
      if (isLabour) {
        setInvoiceHeader((prev) => ({ ...prev, jobType: 'Labour' }));
        setSelectedItemPreview(null);
        setAlternativeProducts([]);
        setItemEntry({
          code: item.code || 'DELIVERY',
          description: item.description || 'Delivery Charge',
          secondDesc: '',
          location: '-',
          storedLocation: '-',
          totalStoredStock: '-',
          rackBin: '',
          availableQty: '-',
          quantity: String(item.quantity || 1),
          rate: item.rate !== undefined && item.rate !== null && item.rate !== '' ? String(item.rate) : String(item.price || 0),
          price: item.price !== undefined ? item.price : (item.sellingPrice || 0),
          standardRate: '',
          discountPercentage: item.discountPercentage !== undefined && item.discountPercentage !== '' ? String(item.discountPercentage) : '',
          discountAmount: item.discountAmount !== undefined && item.discountAmount !== '' ? String(item.discountAmount) : '',
          finalPrice: Number(item.finalPrice !== undefined ? item.finalPrice : item.value).toFixed(2),
          itemCost: '-',
          lastGrn: '-',
          lastGrnDate: '-',
          lastGrnFormatted: '-',
          masterPack: '1',
          rateType: 'Retail',
          mpCost: '',
          roundOffOption: 'No Round Off',
          roundOffStep: 10,
          value: Number(item.value !== undefined ? item.value : item.finalPrice).toFixed(2),
          due: '',
          balance: '-',
          disc: '',
          total: Number(item.value !== undefined ? item.value : item.finalPrice).toFixed(2),
          note: item.note || '',
        });
      } else {
        setInvoiceHeader((prev) => ({ ...prev, jobType: 'Material' }));
        const matched = itemsList.find((i) => i.code?.toLowerCase() === item.code?.toLowerCase());
        setSelectedItemPreview(matched || item);
        setItemEntry({
          code: item.code,
          description: item.description,
          secondDesc: '',
          location: item.location || 'Main Store',
          storedLocation: item.location || 'Main Store',
          totalStoredStock: item.availableQty !== undefined ? item.availableQty : '',
          rackBin: '',
          availableQty: item.availableQty !== undefined ? item.availableQty : '',
          quantity: String(item.quantity),
          rate: item.rate || '0',
          standardRate: '',
          discountPercentage: item.discountPercentage !== undefined && item.discountPercentage !== '' ? String(item.discountPercentage) : '',
          discountAmount: item.discountAmount !== undefined && item.discountAmount !== '' ? String(item.discountAmount) : '',
          finalPrice: Number(item.finalPrice !== undefined ? item.finalPrice : item.value).toFixed(2),
          itemCost: item.itemCost || '-',
          lastGrn: item.lastGrn || '',
          lastGrnDate: item.lastGrnDate || '',
          lastGrnFormatted: item.lastGrn || '',
          price: item.sellingPrice !== undefined ? item.sellingPrice : (item.price || 0),
          masterPack: '1',
          rateType: item.rateType || 'Retail',
          mpCost: '',
          roundOffOption: 'No Round Off',
          roundOffStep: 10,
          value: Number(item.value !== undefined ? item.value : item.finalPrice).toFixed(2),
          due: '',
          balance: item.availableQty || '',
          disc: '',
          total: Number(item.value !== undefined ? item.value : item.finalPrice).toFixed(2),
          note: item.note || '',
        });
        fetchAlternativeProducts(item.code);
      }
    }
  };

  // Remove line item
  const handleRemoveLineItem = (index, e) => {
    if (e) e.stopPropagation();
    const updated = lineItems.filter((_, i) => i !== index);
    setLineItems(updated);
    if (selectedLineIndex === index) {
      setSelectedLineIndex(-1);
    }
  };

  // BUTTON: NEW INVOICE
  const handleNew = async (force = false) => {
    if (!force && lineItems.length > 0 && !activeInvoiceId) {
      const confirmClear = window.confirm(
        'Current invoice contains unsaved items. Would you like to discard them and create a New invoice?'
      );
      if (!confirmClear) return;
    }

    setActiveInvoiceId(null);
    setLineItems([]);
    setSelectedLineIndex(-1);
    setSelectedItemPreview(null);
    setAlternativeProducts([]);
    setCustomerDue('0.00');
    setItemEntry({
      code: '',
      description: '',
      secondDesc: '',
      location: 'Main Store',
      storedLocation: 'Main Store',
      totalStoredStock: '',
      rackBin: '',
      availableQty: '',
      quantity: '1',
      rate: '0',
      standardRate: '',
      discountPercentage: '',
      discountAmount: '',
      finalPrice: '',
      itemCost: '',
      lastGrn: '',
      lastGrnDate: '',
      lastGrnFormatted: '',
      price: '',
      masterPack: '1',
      rateType: 'Retail',
      mpCost: '',
      roundOffOption: 'No Round Off',
      roundOffStep: 10,
      value: '0.00',
      due: '',
      balance: '',
      disc: '',
      total: '0.00',
      note: '',
    });
    setPayment({
      paymentMethod: 'Cash',
      customerPaidAmount: '',
      amountReceived: '',
      specialDiscount: '0.00',
      chequeNo: '',
      bank: '',
      dateRealized: '',
    });

    try {
      setLoading(true);
      const nextNumRes = await api.get('/invoices/next-number');
      if (nextNumRes?.data?.data) {
        const invNum = nextNumRes.data.data.invoiceNumber || String(nextNumRes.data.data.no || 1).padStart(4, '0');
        setInvoiceHeader({
          no: nextNumRes.data.data.no,
          invoiceNumber: invNum,
          date: new Date().toISOString().split('T')[0],
          customerCode: '',
          customerName: 'Walk In Customer',
          customerAddress: '',
          customerTelephone: '',
          jd: 'Invoice',
          isHold: false,
          jobType: 'Material',
          itemLookupMode: 'Item Code',
          isManualInvoice: false,
          remark: '',
          note: '',
        });
      }
    } catch (e) {
      setInvoiceHeader({
        no: 1,
        invoiceNumber: '0001',
        date: new Date().toISOString().split('T')[0],
        customerCode: '',
        customerName: 'Walk In Customer',
        customerAddress: '',
        customerTelephone: '',
        jd: 'Invoice',
        isHold: false,
        jobType: 'Material',
        itemLookupMode: 'Item Code',
        isManualInvoice: false,
        remark: '',
        note: '',
      });
    } finally {
      setLoading(false);
    }

    showNotification('Prepared New Invoice', 'info');
  };

  // BUTTON: MANUAL INVOICE
  const handleManualInvoiceToggle = () => {
    setInvoiceHeader((prev) => {
      const nextManual = !prev.isManualInvoice;
      showNotification(
        nextManual
          ? 'Manual Invoice mode activated. You can now edit the Invoice Number.'
          : 'Automatic invoice numbering restored.',
        'info'
      );
      return { ...prev, isManualInvoice: nextManual };
    });
  };


  // BUTTON: HOLD INVOICE
  const handleHoldInvoice = async () => {
    if (lineItems.length === 0) {
      showNotification('Add at least one item before putting invoice on Hold', 'error');
      return;
    }
    setInvoiceHeader((prev) => ({ ...prev, isHold: true }));
    await handleSaveInvoice(true);
  };

  // BUTTON: SAVE / COMPLETE INVOICE
  const handleSaveInvoice = async (forceHold = false) => {
    if (isSavingRef.current) return null;
    isSavingRef.current = true;

    // 1. Validation
    if (lineItems.length === 0) {
      showNotification('Please add at least one item before saving the invoice', 'error');
      isSavingRef.current = false;
      return null;
    }

    for (const li of lineItems) {
      if (!li.quantity || Number(li.quantity) <= 0) {
        showNotification(`Invalid quantity for item '${li.code}'`, 'error');
        isSavingRef.current = false;
        return null;
      }
    }

    const isHoldVal = forceHold || invoiceHeader.isHold;

    const payload = {
      no: invoiceHeader.no,
      invoiceNumber: invoiceHeader.invoiceNumber,
      date: invoiceHeader.date,
      customerCode: invoiceHeader.customerCode,
      customerName: invoiceHeader.customerName || 'Walk In Customer',
      customerAddress: invoiceHeader.customerAddress || '',
      customerTelephone: invoiceHeader.customerTelephone || '',
      jobType: invoiceHeader.jobType || 'Material',
      jd: invoiceHeader.jd || 'Invoice',
      isHold: isHoldVal,
      status: isHoldVal ? 'hold' : 'completed',
      remark: (invoiceHeader.note || invoiceHeader.remark || '').trim(),
      note: (invoiceHeader.note || invoiceHeader.remark || '').trim(),
      lineItems: lineItems.map((li) => {
        const isLabour = li.jobType === 'Labour' || li.type === 'Labour' || Boolean(li.isService);
        return {
          code: (li.code || (isLabour ? 'DELIVERY' : '')).trim(),
          itemCode: (li.code || (isLabour ? 'DELIVERY' : '')).trim(),
          description: li.description || (isLabour ? 'Delivery Charge' : ''),
          jobType: isLabour ? 'Labour' : (li.jobType || 'Material'),
          type: isLabour ? 'Labour' : (li.type || 'Material'),
          isService: isLabour,
          location: isLabour ? '-' : (li.location || 'Main Store'),
          quantity: Number(li.quantity),
          qty: Number(li.quantity),
          masterPack: li.masterPack || '1',
          rateType: li.rateType || 'Retail',
          rate: Number(li.rate !== undefined && !isNaN(Number(li.rate)) ? li.rate : (li.sellingPrice !== undefined ? li.sellingPrice : li.price)),
          price: Number(li.sellingPrice !== undefined ? li.sellingPrice : li.price),
          unitPrice: Number(li.sellingPrice !== undefined ? li.sellingPrice : li.price),
          itemCost: isLabour ? 0 : Number(li.itemCost || 0),
          mpCost: isLabour ? 0 : Number(li.mpCost || 0),
          discountPercentage: Number(li.discountPercentage || 0),
          discountAmount: Number(li.discountAmount || 0),
          finalPrice: Number(li.finalPrice !== undefined ? li.finalPrice : li.value),
          availableQty: isLabour ? 0 : Number(li.availableQty !== undefined && !isNaN(Number(li.availableQty)) ? li.availableQty : 0),
          lastGrn: isLabour ? '' : (li.lastGrn || ''),
          lastGrnDate: isLabour ? '' : (li.lastGrnDate || ''),
          value: Number(li.value !== undefined ? li.value : li.finalPrice),
          total: Number(li.total || li.value || li.finalPrice),
          balance: isLabour ? 0 : Number(li.balance || 0),
        };
      }),
      subTotal: invoiceSubTotal,
      specialDiscount: specialDiscVal,
      amountToPay: totalAmount,
      paymentMethod: payment.paymentMethod || 'Cash',
      paidBy: payment.paymentMethod || 'Cash',
      customerPaidAmount: paidAmount,
      amountReceived: Math.min(paidAmount, totalAmount),
      paidAmount: Math.min(paidAmount, totalAmount),
      balance: balanceAmount >= 0 ? balanceAmount : 0,
      dueAmount: balanceAmount < 0 ? Math.abs(balanceAmount) : 0,
    };

    try {
      setLoading(true);
      let res;
      if (activeInvoiceId) {
        // Prevent duplicate creation: update existing invoice
        res = await api.put(`/invoices/${activeInvoiceId}`, payload);
      } else {
        res = await api.post('/invoices', payload);
      }

      if (res.data && res.data.success) {
        const savedData = res.data.data;
        const savedId = savedData?._id || activeInvoiceId;
        const savedInvNum = savedData?.invoiceNumber || invoiceHeader.invoiceNumber;

        // Preserve invoice on screen: set activeInvoiceId and keep lineItems
        setActiveInvoiceId(savedId);
        setInvoiceHeader((prev) => ({
          ...prev,
          invoiceNumber: savedInvNum,
          no: savedData?.no || prev.no,
          note: savedData?.note !== undefined ? savedData.note : (savedData?.remark !== undefined ? savedData.remark : prev.note),
          remark: savedData?.remark !== undefined ? savedData.remark : (savedData?.note !== undefined ? savedData.note : prev.remark),
        }));

        showNotification(
          `Invoice '${savedInvNum}' ${isHoldVal ? 'saved on HOLD' : 'saved successfully! Stock updated.'}`,
          'success'
        );

        // Refresh invoices list and items in background
        Promise.all([
          api.get('/invoices?limit=50').catch(() => null),
          api.get('/items?limit=all').catch(() => null),
        ]).then(([invsRes, itemsRes]) => {
          if (invsRes?.data?.data) setInvoicesList(invsRes.data.data);
          if (itemsRes?.data?.data) setItemsList(itemsRes.data.data);
        });

        return savedData || { _id: savedId, invoiceNumber: savedInvNum };
      }
      return null;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save Invoice';
      showNotification(msg, 'error');
      return null;
    } finally {
      setLoading(false);
      setTimeout(() => {
        isSavingRef.current = false;
      }, 350);
    }
  };

  // BUTTON: CREATE INVOICE (Clicking this button goes to Settlement Invoice)
  const handleCreateInvoiceButtonClick = async () => {
    if (lineItems.length > 0) {
      const saved = await handleSaveInvoice(false);
      if (saved) {
        navigate('/settlement-invoice', {
          state: { invoiceNumber: saved.invoiceNumber || invoiceHeader.invoiceNumber }
        });
        return;
      }
    } else if (invoiceHeader.invoiceNumber) {
      navigate('/settlement-invoice', {
        state: { invoiceNumber: invoiceHeader.invoiceNumber }
      });
      return;
    }
    navigate('/settlement-invoice');
  };

  // BUTTON: DELETE INVOICE
  const handleDeleteInvoice = async () => {
    // 1. If an active saved invoice is loaded
    if (activeInvoiceId) {
      const confirmDel = window.confirm(
        `Are you sure you want to delete / cancel Invoice '${invoiceHeader.invoiceNumber}'?\n\nThis will restore deducted inventory stock and update customer outstanding balance.`
      );
      if (!confirmDel) return;

      try {
        setLoading(true);
        const res = await api.delete(`/invoices/${activeInvoiceId}`);
        if (res.data && res.data.success) {
          showNotification(
            res.data.message || `Invoice '${invoiceHeader.invoiceNumber}' cancelled and stock restored`,
            'success'
          );
          // Refresh background items to show restored stock
          api.get('/items?limit=all').then((r) => {
            if (r.data?.data) setItemsList(r.data.data);
          }).catch(() => null);
          await handleNew(true);
        }
      } catch (err) {
        const errMsg = err.response?.data?.message || 'Failed to delete invoice';
        showNotification(errMsg, 'error');
      } finally {
        setLoading(false);
      }
      return;
    }

    // 2. If a line item is selected in the bottom table
    if (selectedLineIndex >= 0 && selectedLineIndex < lineItems.length) {
      const itemToDelete = lineItems[selectedLineIndex];
      const confirmItem = window.confirm(
        `Remove item '${itemToDelete?.code || 'selected'}' from invoice?`
      );
      if (confirmItem) {
        handleRemoveLineItem(selectedLineIndex);
        showNotification(`Removed item '${itemToDelete?.code || ''}' from invoice`, 'info');
      }
      return;
    }

    // 3. If there are unsaved line items in the table
    if (lineItems.length > 0) {
      const confirmLines = window.confirm('Clear all unsaved line items from the invoice?');
      if (confirmLines) {
        setLineItems([]);
        showNotification('Cleared unsaved invoice lines', 'info');
      }
      return;
    }

    showNotification('No saved invoice or line item selected to delete', 'info');
  };

  // BUTTON: BILL PRINT
  const handleBillPrint = async () => {
    if (lineItems.length === 0) {
      showNotification('Please add items to invoice before printing', 'error');
      return;
    }

    // 1. Always open the Receipt Preview modal immediately so user sees the bill on screen
    setPreviewModalOpen(true);

    // 2. If invoice is already saved, trigger print directly
    if (activeInvoiceId) {
      handlePrint();
      return;
    }

    // 3. If invoice has unsaved items, save it to assign sequential invoice number and deduct stock
    showNotification('Saving invoice and preparing bill...', 'info');
    try {
      const saved = await handleSaveInvoice(false);
      if (saved) {
        showNotification(`Invoice #${saved.invoiceNumber || invoiceHeader.invoiceNumber} saved. Printing bill...`, 'success');
        handlePrint();
      } else {
        showNotification('Invoice preview loaded. You can print directly from the preview window.', 'info');
      }
    } catch (err) {
      console.error('Error during bill print save:', err);
      showNotification('Invoice preview loaded. Click Print to proceed.', 'info');
    }
  };

  // Print Invoice (Thermal Receipt)
  const handlePrint = () => {
    if (lineItems.length === 0) {
      showNotification('Please add items or select an invoice first before printing', 'error');
      return;
    }
    setPreviewModalOpen(true);
    requestAnimationFrame(() => {
      setTimeout(() => {
        window.print();
      }, 100);
    });
  };

  // Keyboard Shortcuts (F1, F2, F3, F4, F5, F7, F11)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        paidAmountInputRef.current?.focus();
        paidAmountInputRef.current?.select();
      } else if (e.key === 'F2') {
        e.preventDefault();
        handleCreateInvoiceButtonClick();
      } else if (e.key === 'F3') {
        e.preventDefault();
        const nextJob = invoiceHeader.jobType === 'Material' ? 'Labour' : 'Material';
        handleJobTypeChange(nextJob);
      } else if (e.key === 'F4') {
        e.preventDefault();
        setLookupModal({
          isOpen: true,
          type: 'item',
          title: 'Select Item from Item Master',
          search: '',
        });
      } else if (e.key === 'F5') {
        e.preventDefault();
        itemCodeInputRef.current?.focus();
        itemCodeInputRef.current?.select();
      } else if (e.key === 'F7') {
        e.preventDefault();
        handleCalculateDiscount();
      } else if (e.key === 'F11') {
        e.preventDefault();
        setInvoiceHeader((prev) => ({
          ...prev,
          itemLookupMode: prev.itemLookupMode === 'Item Code' ? 'Bar Code' : 'Item Code',
        }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lineItems, invoiceHeader, activeInvoiceId, payment, discountModalOpen, discountInputPercentage]);

  // Filtered items for quick dropdown list (Code field)
  const filteredDropdownItems = useMemo(() => {
    const raw = String(itemEntry.code || '').trim().toLowerCase();
    if (!raw) return itemsList;
    const tokens = raw.split(/\s+/).filter(Boolean);
    return itemsList.filter((i) => {
      const codeStr = String(i.code || i.itemCode || '').toLowerCase();
      const descStr = String(i.description || i.name || i.itemName || '').toLowerCase();
      const catStr = String(i.category || '').toLowerCase();
      const subCatStr = String(i.subCategory || '').toLowerCase();
      const suppStr = String(i.suppCode || i.supplierCode || '').toLowerCase();
      const barStr = String(i.barcode || i.barCode || '').toLowerCase();
      const cleanCode = codeStr.replace(/[^a-z0-9]/gi, '');
      const combined = `${codeStr} ${cleanCode} ${descStr} ${catStr} ${subCatStr} ${suppStr} ${barStr}`;
      return tokens.every((token) => {
        const cleanToken = token.replace(/[^a-z0-9]/gi, '');
        return combined.includes(token) || (cleanToken && cleanCode.includes(cleanToken));
      });
    });
  }, [itemsList, itemEntry.code]);

  // Filtered customers / items for lookup modal
  const filteredCustomers = useMemo(() => {
    const q = lookupModal.search.toLowerCase().trim();
    if (!q) return customersList;
    return customersList.filter(
      (c) =>
        c.code?.toLowerCase().includes(q) ||
        c.customerCode?.toLowerCase().includes(q) ||
        c.name?.toLowerCase().includes(q) ||
        c.telephone?.toLowerCase().includes(q) ||
        c.address?.toLowerCase().includes(q) ||
        c.vehicleNo?.toLowerCase().includes(q)
    );
  }, [customersList, lookupModal.search]);

  const filteredInvoices = useMemo(() => {
    const q = lookupModal.search.toLowerCase().trim();
    if (!q) return invoicesList;
    return invoicesList.filter(
      (inv) =>
        inv.invoiceNumber?.toLowerCase().includes(q) ||
        String(inv.no || '').toLowerCase().includes(q) ||
        inv.customerName?.toLowerCase().includes(q) ||
        inv.customerCode?.toLowerCase().includes(q) ||
        (inv.paymentMethod && inv.paymentMethod.toLowerCase().includes(q))
    );
  }, [invoicesList, lookupModal.search]);

  const filteredItems = useMemo(() => {
    const raw = lookupModal.search.toLowerCase().trim();
    if (!raw) return itemsList;
    const tokens = raw.split(/\s+/).filter(Boolean);
    return itemsList.filter((i) => {
      const codeStr = String(i.code || i.itemCode || '').toLowerCase();
      const descStr = String(i.description || i.name || i.itemName || '').toLowerCase();
      const catStr = String(i.category || '').toLowerCase();
      const subCatStr = String(i.subCategory || '').toLowerCase();
      const suppStr = String(i.suppCode || i.supplierCode || '').toLowerCase();
      const barStr = String(i.barcode || i.barCode || '').toLowerCase();
      const combined = `${codeStr} ${descStr} ${catStr} ${subCatStr} ${suppStr} ${barStr}`;
      return tokens.every((token) => combined.includes(token));
    });
  }, [itemsList, lookupModal.search]);

  const totalLookupPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE) || 1;
  const pagedItems = useMemo(() => {
    const start = (lookupPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, lookupPage]);

  // Reusable Compact Thermal Receipt component for both Print and Preview
  const renderThermalReceiptContent = () => {
    const grossTotal = lineItems.reduce((acc, item) => {
      const p = parseFloat(item.price !== undefined && item.price !== '' ? item.price : (item.sellingPrice || item.rate || 0)) || 0;
      const q = parseFloat(item.quantity !== undefined ? item.quantity : (item.qty || 1)) || 1;
      return acc + (p * q);
    }, 0);
    const calculatedDiscount = (grossTotal - amountToPay) > 0 ? (grossTotal - amountToPay) : specialDiscVal;

    return (
      <div className="thermal-receipt">
        <div className="thermal-receipt-header">
          <div className="thermal-receipt-title">SOFA ST (PVT) LTD</div>
          <div className="thermal-receipt-subtitle">Dealer for David Peris Motor Company</div>
          <div className="thermal-receipt-address">7E, MADDE GODA ROAD, MATHUGAMA</div>
          <div className="thermal-receipt-address">034-2210680, 074-0295088</div>
        </div>

        <div className="thermal-receipt-dashed"></div>

        <div className="thermal-receipt-meta">
          <div className="thermal-receipt-meta-row">
            <span>Date: {invoiceHeader.date}</span>
            <span>Time: {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
          </div>
          <div className="thermal-receipt-meta-row">
            <span>Inv No: {invoiceHeader.invoiceNumber || '-'}</span>
            <span>User: PC004</span>
          </div>
          {invoiceHeader.customerName && (
            <div className="thermal-receipt-meta-row">
              <span>Customer: {invoiceHeader.customerCode ? `${invoiceHeader.customerCode} - ` : ''}{invoiceHeader.customerName}</span>
            </div>
          )}
        </div>

        <div className="thermal-receipt-dashed"></div>

        {/* Items Table */}
        <table className="thermal-receipt-table">
          <thead>
            <tr>
              <th className="thermal-th-item" style={{ textAlign: 'left' }}>Item</th>
              <th className="thermal-th-qtyrate" style={{ textAlign: 'right' }}>Qty x Rate</th>
              <th className="thermal-th-amount" style={{ textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.length === 0 ? (
              <tr>
                <td colSpan="3" style={{ textAlign: 'center', color: '#555', fontStyle: 'italic', padding: '2px 0' }}>
                  No line items
                </td>
              </tr>
            ) : (
              lineItems.map((item, idx) => {
                const itemQty = parseFloat(item.quantity !== undefined ? item.quantity : (item.qty || 1)) || 1;
                const itemRate = parseFloat(item.price !== undefined && item.price !== '' ? item.price : (item.sellingPrice || item.rate || 0)) || 0;
                const itemTotal = parseFloat(item.value !== undefined && item.value !== '' ? item.value : (item.finalPrice !== undefined ? item.finalPrice : itemRate * itemQty)) || 0;
                return (
                  <tr key={idx} className="thermal-tr-item">
                    <td className="thermal-td-item" style={{ textAlign: 'left', wordBreak: 'break-word' }}>
                      {item.jobType === 'Labour' || item.isService
                        ? (item.description || 'Delivery Charge')
                        : `${item.code ? `${item.code} - ` : ''}${item.description || ''}`}
                    </td>
                    <td className="thermal-td-qtyrate" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {itemQty.toFixed(2)} x {itemRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="thermal-td-amount" style={{ textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                      {itemTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div className="thermal-receipt-dashed"></div>

        {/* Totals Section */}
        <div className="thermal-receipt-totals">
          <div className="thermal-receipt-total-row thermal-receipt-total-main">
            <span>Amount to Be Paid:</span>
            <span>
              {Number(amountToPay || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="thermal-receipt-total-row">
            <span>Total Discount:</span>
            <span>
              {Number(calculatedDiscount || 0).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
          <div className="thermal-receipt-total-row">
            <span>Amount Received:</span>
            <span style={{ fontWeight: 'bold' }}>
              {Number(amountReceivedVal || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="thermal-receipt-total-row">
            <span>Balance:</span>
            <span style={{ fontWeight: 'bold' }}>
              {Number(dueAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {(invoiceHeader.note || invoiceHeader.remark) && (
          <>
            <div className="thermal-receipt-dashed"></div>
            <div className="thermal-receipt-note" style={{ fontSize: '11px', padding: '2px 0', wordBreak: 'break-word' }}>
              <strong>Note:</strong> {invoiceHeader.note || invoiceHeader.remark}
            </div>
          </>
        )}

        <div className="thermal-receipt-dashed"></div>

        <div className="thermal-receipt-notice">
          In case of price discrepancy, return the items & bill within 3 days for refund of difference
        </div>
      </div>
    );
  };

  return (
    <div className="invoice-container">
      {/* 1. Windows Blue Header */}
      <header className="invoice-titlebar">
        <div className="invoice-titlebar-brand">
          <svg className="invoice-titlebar-car-icon" viewBox="0 0 24 24">
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
          </svg>
          <span className="invoice-titlebar-heading">SOFAST MOTORS - Management System</span>
        </div>
        <div className="invoice-titlebar-controls">
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
      <ClassicNavbar activeMenu="sales-service" />

      {/* Main Canvas */}
      <main className="invoice-main-canvas">
        {/* Blue Banner Header */}
        <div className="invoice-blue-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Sales Invoice</span>
          <button
            type="button"
            style={{
              background: '#ffffff',
              color: '#00227b',
              border: '1px solid #707070',
              fontSize: '11px',
              fontWeight: 'bold',
              padding: '2px 8px',
              cursor: 'pointer',
              borderRadius: '2px',
            }}
            onClick={() => navigate('/settlement-invoice')}
            title="Open Settlement Invoice"
          >
            Settlement Invoice ▶
          </button>
        </div>

        {/* Notification Box */}
        {notification && (
          <div className={`invoice-alert ${notification.type}`}>
            <span>{notification.message}</span>
            <button
              type="button"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
              onClick={() => setNotification(null)}
            >
              &#x2715;
            </button>
          </div>
        )}        <div className="sofast-window-container">
          {/* TOP SECTION: Left (Customer + Vehicle Info + Action Buttons) and Right (Tall Catalog Table) */}
          <div className="sofast-top-middle-grid">
            {/* Left Side: Header Panel + Item Entry Frame */}
            <div className="sofast-left-side">
              {/* Header Panel (Customer Col + Vehicle Col + 4 Buttons + Settlement Invoice button) */}
              <div className="sofast-header-panel">
                {/* 1. Customer Column (Left) */}
                <div className="sofast-customer-col">
                  <div className="sofast-navy-label sofast-field-header-label">Customer</div>
                  <div className="sofast-combo-box">
                    <input
                      type="text"
                      className="sofast-input sofast-customer-input"
                      value={invoiceHeader.customerCode}
                      onChange={(e) => {
                        const val = e.target.value;
                        setInvoiceHeader({ ...invoiceHeader, customerCode: val });
                      }}
                      placeholder="Customer Code"
                    />
                    <button
                      type="button"
                      className="sofast-combo-btn"
                      onClick={() =>
                        setLookupModal({
                          isOpen: true,
                          type: 'customer',
                          title: 'Select Customer from Database',
                          search: '',
                        })
                      }
                    >
                      &#x25BC;
                    </button>
                  </div>

                  {/* Scrollable Customer Listbox */}
                  <div className="sofast-customer-listbox">
                    {customersList.map((c) => {
                      const cCode = c.code || c.customerCode || '';
                      const isSelected = invoiceHeader.customerCode === cCode;
                      return (
                        <div
                          key={c._id || cCode}
                          className={`sofast-listbox-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSelectCustomerFromListbox(c)}
                        >
                          {cCode} - {c.name}
                        </div>
                      );
                    })}
                  </div>

                  {/* Invoice No under listbox */}
                  <div className="sofast-inv-no-row">
                    <span className="sofast-navy-label" style={{ minWidth: '65px' }}>Invoice No .</span>
                    <div className="sofast-combo-box" style={{ flex: 1 }}>
                      <input
                        type="text"
                        className="sofast-input"
                        value={invoiceHeader.invoiceNumber || ''}
                        readOnly={!invoiceHeader.isManualInvoice}
                        onChange={(e) =>
                          setInvoiceHeader({ ...invoiceHeader, invoiceNumber: e.target.value })
                        }
                      />
                      <button
                        type="button"
                        className="sofast-combo-btn"
                        onClick={() =>
                          setLookupModal({
                            isOpen: true,
                            type: 'invoice',
                            title: 'Select Existing Invoice',
                            search: '',
                          })
                        }
                      >
                        &#x25BC;
                      </button>
                    </div>
                  </div>

                  {/* Customer Due field */}
                  <div className="sofast-inv-no-row" style={{ marginTop: '2px' }}>
                    <span className="sofast-navy-label" style={{ minWidth: '65px' }}>Due . . . . .</span>
                    <input
                      type="text"
                      className="sofast-input"
                      style={{
                        flex: 1,
                        backgroundColor: '#f4f4f4',
                        fontWeight: 'bold',
                        color: Number(customerDue) > 0 ? '#b91c1c' : '#000080',
                        textAlign: 'right',
                        paddingRight: '6px',
                      }}
                      readOnly
                      value={invoiceHeader.customerCode ? Number(customerDue || 0).toFixed(2) : '0.00'}
                      title="Customer Outstanding Due Balance"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* 2. Vehicle & Job Info (Middle) */}
                <div className="sofast-vehicle-col">
                  {/* Row 1: Brand & Pucha. On: */}
                  <div className="sofast-row">
                    <span className="sofast-navy-label" style={{ width: '45px' }}>Brand</span>
                    <input
                      type="text"
                      className="sofast-input"
                      style={{ width: '105px', marginRight: '6px' }}
                      value={invoiceHeader.brand || ''}
                      onChange={(e) => setInvoiceHeader({ ...invoiceHeader, brand: e.target.value })}
                    />
                    <span className="sofast-navy-label" style={{ width: '65px' }}>Pucha. On:</span>
                    <div className="sofast-combo-box" style={{ width: '125px' }}>
                      <input
                        type="text"
                        className="sofast-input"
                        value={invoiceHeader.puchaOn || ''}
                        onChange={(e) => setInvoiceHeader({ ...invoiceHeader, puchaOn: e.target.value })}
                      />
                      <button type="button" className="sofast-combo-btn">&#x25BC;</button>
                    </div>
                  </div>

                  {/* Row 2: Model & Payment Method . . . */}
                  <div className="sofast-row">
                    <span className="sofast-navy-label" style={{ width: '45px' }}>Model</span>
                    <input
                        type="text"
                      className="sofast-input"
                      style={{ width: '105px', marginRight: '6px' }}
                      value={invoiceHeader.model || ''}
                      onChange={(e) => setInvoiceHeader({ ...invoiceHeader, model: e.target.value })}
                    />
                    <span className="sofast-navy-label" style={{ width: '110px' }}>Payment Method . . .</span>
                    <div className="sofast-combo-box" style={{ width: '80px' }}>
                      <select
                        className="sofast-select"
                        value={invoiceHeader.paymentMethod || invoiceHeader.type || 'Cash'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setInvoiceHeader({ ...invoiceHeader, paymentMethod: val, type: val });
                          setPayment({ ...payment, paymentMethod: val });
                        }}
                      >
                        <option value="Cash">Cash</option>
                        <option value="Credit">Credit</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Card">Card</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 3: Address (multi-row box) */}
                  <div className="sofast-row" style={{ height: '36px', alignItems: 'flex-start' }}>
                    <span className="sofast-navy-label" style={{ width: '45px', marginTop: '2px' }}>Address</span>
                    <textarea
                      className="sofast-input sofast-address-textarea"
                      style={{ flex: 1, height: '34px', resize: 'none' }}
                      value={invoiceHeader.customerAddress || ''}
                      onChange={(e) => setInvoiceHeader({ ...invoiceHeader, customerAddress: e.target.value })}
                    />
                  </div>

                  {/* Row 4: Job Done by .. */}
                  <div className="sofast-row">
                    <span className="sofast-navy-label" style={{ width: '80px' }}>Job Done by ..</span>
                    <div className="sofast-combo-box" style={{ width: '145px' }}>
                      <input
                        type="text"
                        className="sofast-input"
                        value={invoiceHeader.jobDoneBy || ''}
                        onChange={(e) => setInvoiceHeader({ ...invoiceHeader, jobDoneBy: e.target.value })}
                      />
                      <button type="button" className="sofast-combo-btn">&#x25BC;</button>
                    </div>
                  </div>

                  {/* Row 5: Date . . . . . . . */}
                  <div className="sofast-row">
                    <span className="sofast-navy-label" style={{ width: '80px' }}>Date . . . . . . .</span>
                    <div className="sofast-combo-box" style={{ width: '145px' }}>
                      <input
                        type="text"
                        className="sofast-input"
                        value={invoiceHeader.date || ''}
                        onChange={(e) => setInvoiceHeader({ ...invoiceHeader, date: e.target.value })}
                      />
                      <button type="button" className="sofast-combo-btn">&#x25BC;</button>
                    </div>
                  </div>

                  {/* Row 6: Type . . . . . . . */}
                  <div className="sofast-row">
                    <span className="sofast-navy-label" style={{ width: '80px' }}>Type . . . . . . .</span>
                    <div className="sofast-combo-box" style={{ width: '145px' }}>
                      <select
                        className="sofast-select"
                        value={invoiceHeader.type || invoiceHeader.paymentMethod || 'Cash'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setInvoiceHeader({ ...invoiceHeader, type: val, paymentMethod: val });
                          setPayment({ ...payment, paymentMethod: val });
                        }}
                      >
                        <option value="Cash">Cash</option>
                        <option value="Credit">Credit</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Card">Card</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                      </select>
                    </div>
                  </div>

                  {/* Bottom: Create New Invoice / Settlement Invoice button */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                    <button
                      type="button"
                      className="sofast-classic-btn"
                      style={{ padding: '2px 14px', height: '22px' }}
                      onClick={handleCreateInvoiceButtonClick}
                    >
                      Create New Invoice / Settlement Invoice
                    </button>
                  </div>
                </div>

                {/* 3. Action Buttons (Right of Middle Column) */}
                <div className="sofast-actions-col">
                  <button
                    type="button"
                    className="sofast-classic-btn"
                    onClick={() => handleNew()}
                    title="Prepare form for New Invoice"
                  >
                    New
                  </button>
                  <button
                    type="button"
                    className="sofast-classic-btn"
                    onClick={handleBillPrint}
                    title="Print Bill for Current Invoice"
                  >
                    Bill Print
                  </button>
                  <button
                    type="button"
                    className="sofast-classic-btn delete"
                    onClick={handleDeleteInvoice}
                    title="Delete or Cancel Invoice"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    className="sofast-classic-btn"
                    onClick={handleCalculateDiscount}
                  >
                    Cal. Discount
                  </button>
                  <button
                    type="button"
                    className="sofast-classic-btn"
                    onClick={handleRemoveDiscount}
                  >
                    Rem. Discount
                  </button>
                  <button
                    type="button"
                    className="sofast-classic-btn"
                    onClick={handleManualInvoiceToggle}
                  >
                    {invoiceHeader.isManualInvoice ? 'Auto Invoice' : 'Manual Invoice'}
                  </button>
                </div>
              </div>

              {/* Item Entry Box */}
              <div className="sofast-item-entry-frame">
                {/* Header row: Type of Job */}
                <div className="sofast-entry-header-row">
                  <div className="sofast-job-type-box">
                    <span className="sofast-navy-label" style={{ marginRight: '6px' }}>Type of Job . . . .</span>
                    <label className="sofast-radio-label">
                      <input
                        type="radio"
                        name="jobType"
                        value="Material"
                        checked={invoiceHeader.jobType === 'Material'}
                        onChange={(e) => handleJobTypeChange(e.target.value)}
                      />
                      Material
                    </label>
                    <label className="sofast-radio-label">
                      <input
                        type="radio"
                        name="jobType"
                        value="Labour"
                        checked={invoiceHeader.jobType === 'Labour'}
                        onChange={(e) => handleJobTypeChange(e.target.value)}
                      />
                      Labour
                    </label>
                    <label className="sofast-radio-label">
                      <input
                        type="radio"
                        name="jobType"
                        value="Group"
                        checked={invoiceHeader.jobType === 'Group'}
                        onChange={(e) => handleJobTypeChange(e.target.value)}
                      />
                      Group
                    </label>
                    <label className="sofast-radio-label">
                      <input
                        type="radio"
                        name="jobType"
                        value="J.G."
                        checked={invoiceHeader.jobType === 'J.G.'}
                        onChange={(e) => handleJobTypeChange(e.target.value)}
                      />
                      J.G.
                    </label>

                    <span className="sofast-radio-divider">|</span>

                    <label className="sofast-radio-label">
                      <input
                        type="radio"
                        name="itemLookupMode"
                        value="Item Code"
                        checked={invoiceHeader.itemLookupMode === 'Item Code'}
                        onChange={(e) => setInvoiceHeader({ ...invoiceHeader, itemLookupMode: e.target.value })}
                      />
                      Item Code
                    </label>
                    <label className="sofast-radio-label">
                      <input
                        type="radio"
                        name="itemLookupMode"
                        value="Bar Code"
                        checked={invoiceHeader.itemLookupMode === 'Bar Code'}
                        onChange={(e) => setInvoiceHeader({ ...invoiceHeader, itemLookupMode: e.target.value })}
                      />
                      Bar Code
                    </label>
                  </div>
                </div>

                {/* Form Row 1: Code & GRN */}
                <div className="sofast-form-row">
                  <span className="sofast-navy-label" style={{ width: '95px' }}>Code</span>
                  <div
                    className="sofast-code-search-container"
                    ref={itemDropdownRef}
                    style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '215px', marginRight: '8px' }}
                  >
                    <input
                      ref={itemCodeInputRef}
                      type="text"
                      name="code"
                      className="sofast-input code-olive-input"
                      style={{ flex: 1, paddingRight: '22px' }}
                      value={itemEntry.code}
                      onChange={handleItemEntryChange}
                      onKeyDown={handleCodeKeyDown}
                      onFocus={() => {
                        if (itemEntry.code && itemEntry.code.trim()) {
                          setItemDropdownOpen(true);
                        }
                      }}
                      placeholder="Type code/name/barcode (F2)"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      className="sofast-item-search-btn"
                      onClick={() => {
                        if (invoiceHeader.jobType === 'Labour') {
                          showNotification('Labour delivery charge does not require Item Master search', 'info');
                          return;
                        }
                        setLookupModal({
                          isOpen: true,
                          type: 'item',
                          title: 'Select Item from Item Master',
                          search: itemEntry.code || '',
                        });
                        setLookupPage(1);
                      }}
                      title={invoiceHeader.jobType === 'Labour' ? 'Labour delivery charge (no Item Master needed)' : 'Search all 5,993+ items in Item Master (F2 / F4)'}
                    >
                      &#128269;
                    </button>

                    {/* Quick Auto-suggest Dropdown Panel directly beneath Code - Material */}
                    {itemDropdownOpen && filteredDropdownItems.length > 0 && (
                      <div className="invoice-item-dropdown-panel">
                        <div className="invoice-item-dropdown-header">
                          <span style={{ width: '95px' }}>Code</span>
                          <span style={{ flex: 1 }}>Description</span>
                          <span style={{ width: '65px', textAlign: 'right' }}>Price</span>
                          <span style={{ width: '45px', textAlign: 'right' }}>Stock</span>
                        </div>
                        <div className="invoice-item-dropdown-list">
                          {filteredDropdownItems.slice(0, 80).map((item, idx) => (
                            <div
                              key={item._id || item.code}
                              className={`invoice-item-dropdown-row ${highlightedItemIndex === idx ? 'highlighted' : ''}`}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectItemFromLookup(item);
                              }}
                              onMouseEnter={() => setHighlightedItemIndex(idx)}
                            >
                              <span className="dropdown-col-code">{item.code}</span>
                              <span className="dropdown-col-desc">{item.description}</span>
                              <span className="dropdown-col-price">
                                {Number(item.sellingPrice || item.finalSellingPrice || 0).toFixed(2)}
                              </span>
                              <span className="dropdown-col-stock">
                                {item.quantity !== undefined ? item.quantity : (item.stockInHand || 0)}
                              </span>
                            </div>
                          ))}
                        </div>
                        {filteredDropdownItems.length > 80 && (
                          <div className="invoice-item-dropdown-footer">
                            Showing 80 of {filteredDropdownItems.length} matching items. Click 🔍 or press F2 for full list.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="sofast-navy-label" style={{ width: '45px' }}>GRN . .</span>
                  <input
                    type="text"
                    className="sofast-input"
                    style={{ flex: 1 }}
                    readOnly
                    value={itemEntry.lastGrnFormatted || itemEntry.lastGrn || ''}
                  />
                </div>

                {/* Form Row 2: Coupon No & INV */}
                <div className="sofast-form-row">
                  <span className="sofast-navy-label" style={{ width: '95px' }}>Coupon No . . . .</span>
                  <input
                    type="text"
                    className="sofast-input coupon-green-input"
                    style={{ width: '210px', marginRight: '8px' }}
                    value={
                      invoiceHeader.jobType === 'Labour'
                        ? '-'
                        : (itemEntry.code
                            ? (alternativeProducts.length > 0
                                ? `${alternativeProducts.length} Alternative(s) Available`
                                : 'No Product Available')
                            : '')
                    }
                    readOnly
                  />
                  <span className="sofast-navy-label" style={{ width: '45px' }}>INV . . .</span>
                  <input
                    type="text"
                    className="sofast-input"
                    style={{ flex: 1 }}
                    readOnly
                    value={itemEntry.lastInv || ''}
                  />
                </div>

                {/* Form Row 3: Description */}
                <div className="sofast-form-row">
                  <span className="sofast-navy-label" style={{ width: '95px' }}>Description . . . .</span>
                  <input
                    type="text"
                    name="description"
                    className="sofast-input"
                    style={{ flex: 1 }}
                    value={itemEntry.description}
                    onChange={handleItemEntryChange}
                    placeholder={invoiceHeader.jobType === 'Labour' ? 'e.g. Delivery Charge' : ''}
                  />
                </div>

                {/* Form Row 4: Quantity, Rate, Add a Note */}
                <div className="sofast-form-row">
                  <span className="sofast-navy-label" style={{ width: '95px' }}>Quantity . . . . . .</span>
                  <input
                    type="number"
                    name="quantity"
                    className="sofast-input"
                    style={{ width: '115px', marginRight: '10px' }}
                    value={itemEntry.quantity}
                    onChange={handleItemEntryChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddOrUpdateItem();
                    }}
                  />
                  <span className="sofast-navy-label" style={{ width: '75px' }}>Rate . . . . . . . .</span>
                  <input
                    type="text"
                    name="rate"
                    className="sofast-input"
                    style={{ width: '120px', marginRight: 'auto' }}
                    value={itemEntry.rate}
                    onChange={handleItemEntryChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddOrUpdateItem();
                    }}
                  />
                  <button
                    type="button"
                    className="sofast-classic-btn"
                    style={{ width: '95px' }}
                    onClick={handleOpenNoteModal}
                    title={invoiceHeader.note ? `Note attached: ${invoiceHeader.note}` : 'Add or edit customer note for this invoice'}
                  >
                    Add a Note{invoiceHeader.note ? ' •' : ''}
                  </button>
                </div>

                {/* Form Row 5: Selling Price, Discount, Cost */}
                <div className="sofast-form-row">
                  <span className="sofast-navy-label" style={{ width: '95px' }}>Selling Price . . .</span>
                  <input
                    type="number"
                    name="price"
                    className="sofast-input"
                    style={{ width: '115px', marginRight: '10px' }}
                    value={itemEntry.price}
                    onChange={handleItemEntryChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddOrUpdateItem();
                    }}
                  />
                  <span className="sofast-navy-label" style={{ width: '75px' }}>Discount . . .</span>
                  <input
                    type="text"
                    name="discountPercentage"
                    className="sofast-input discount-lavender-input"
                    style={{ width: '120px', marginRight: '10px' }}
                    value={itemEntry.discountPercentage}
                    onChange={handleItemEntryChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddOrUpdateItem();
                    }}
                  />
                  <span className="sofast-navy-label" style={{ width: '45px' }}>Cost . . .</span>
                  <input
                    type="text"
                    className="sofast-input"
                    style={{ width: '95px' }}
                    readOnly
                    value={itemEntry.itemCost !== undefined && itemEntry.itemCost !== null ? itemEntry.itemCost : ''}
                  />
                </div>

                {/* Form Row 6: Value, Location, Available Stock, Add Item */}
                <div className="sofast-form-row">
                  <span className="sofast-navy-label" style={{ width: '95px' }}>Value . . . . . . . .</span>
                  <input
                    type="text"
                    className="sofast-input"
                    style={{ width: '115px', marginRight: '10px' }}
                    readOnly
                    value={itemEntry.value || itemEntry.finalPrice || ''}
                  />
                  <span className="sofast-navy-label" style={{ width: '75px' }}>Location . . . .</span>
                  <div className="sofast-combo-box" style={{ width: '120px', marginRight: '10px' }}>
                    <select
                      className="sofast-select"
                      value={invoiceHeader.jobType === 'Labour' ? '-' : (itemEntry.location || 'Main Store')}
                      onChange={(e) => handleItemLocationChange(e.target.value)}
                      disabled={invoiceHeader.jobType === 'Labour'}
                    >
                      {invoiceHeader.jobType === 'Labour' && <option value="-">-</option>}
                      {locationsList.map((loc) => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                  </div>
                  <span className="sofast-navy-label" style={{ width: '45px' }}>Stock . .</span>
                  <input
                    type="text"
                    className="sofast-input"
                    style={{ width: '80px', backgroundColor: '#f0f0f0', fontWeight: 'bold', textAlign: 'center', marginRight: '8px' }}
                    readOnly
                    value={invoiceHeader.jobType === 'Labour' ? '-' : (itemEntry.availableQty !== '' && itemEntry.availableQty !== undefined && itemEntry.availableQty !== null ? itemEntry.availableQty : '')}
                    title={invoiceHeader.jobType === 'Labour' ? 'Delivery charges do not require inventory stock' : 'Available Stock in Inventory for Selected Item and Location'}
                  />
                  <button
                    type="button"
                    className="sofast-classic-btn"
                    style={{
                      height: '20px',
                      padding: '0 8px',
                      fontWeight: 'bold',
                      color: '#000080',
                      cursor: 'pointer',
                    }}
                    onClick={handleAddOrUpdateItem}
                    title="Add selected item to invoice table (or press Enter)"
                  >
                    Add Item
                  </button>
                </div>
              </div>
            </div>

            {/* Right Side: Quick Catalog Lookup Table + Customer Display Item Photo Window */}
            <div className="sofast-right-tables-col">
              {/* 1. Quick Catalog Items Lookup Table */}
              <div className="sofast-table-panel sofast-catalog-table-panel">
                <div className="sofast-table-scroll-container">
                  <table className="sofast-classic-table" style={{ minWidth: '500px' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '100px', minWidth: '95px' }}>Code</th>
                        <th style={{ minWidth: '150px' }}>
                          Description
                          {itemEntry.code && (
                            <span style={{ fontSize: '11px', color: '#000080', marginLeft: '6px', fontWeight: 'bold' }}>
                              ({filteredDropdownItems.length} found)
                            </span>
                          )}
                        </th>
                        <th style={{ width: '65px', minWidth: '60px', textAlign: 'center' }}>Quantity</th>
                        <th style={{ width: '85px', minWidth: '80px', textAlign: 'right' }}>Selling Price</th>
                        <th style={{ width: '90px', minWidth: '85px' }}>Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDropdownItems.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ padding: '8px', color: '#888', fontStyle: 'italic', textAlign: 'center' }}>
                            No items matching "{itemEntry.code}"
                          </td>
                        </tr>
                      ) : (
                        <>
                          {filteredDropdownItems.slice(0, 150).map((item) => {
                            const isSelected =
                              (activePreviewItem && activePreviewItem.code?.toLowerCase() === item.code?.toLowerCase()) ||
                              (itemEntry.code && item.code?.toLowerCase() === itemEntry.code.toLowerCase());

                            const stockQty = item.quantity !== undefined
                              ? Number(item.quantity)
                              : (item.stockInHand !== undefined ? Number(item.stockInHand) : 0);

                            const sellingPrice = Number(
                              item.sellingPrice !== undefined && Number(item.sellingPrice) >= 0
                                ? item.sellingPrice
                                : (item.finalSellingPrice !== undefined && Number(item.finalSellingPrice) >= 0
                                    ? item.finalSellingPrice
                                    : (item.price || 0))
                            ).toFixed(2);

                            const loc = item.location || (Array.isArray(item.locations) && item.locations[0]?.name) || 'Main Store';

                            return (
                              <tr
                                key={item._id || item.code}
                                className={isSelected ? 'selected-row' : ''}
                                onClick={() => handleSelectItemFromLookup(item)}
                                title={`Click to select ${item.code} (${item.description}) — Available: ${stockQty} in ${loc}`}
                              >
                                <td className="sofast-cell-code">{item.code}</td>
                                <td className="sofast-cell-desc" title={item.description}>{item.description}</td>
                                <td
                                  style={{
                                    textAlign: 'center',
                                    fontWeight: 'bold',
                                    color: isSelected ? '#ffffff' : (stockQty <= 0 ? '#b00020' : '#000000'),
                                  }}
                                  title={`Available Stock: ${stockQty}`}
                                >
                                  {stockQty}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  {sellingPrice}
                                </td>
                                <td className="sofast-cell-loc" title={loc}>
                                  {loc}
                                </td>
                              </tr>
                            );
                          })}
                          {filteredDropdownItems.length > 150 && (
                            <tr>
                              <td colSpan="5" style={{ padding: '4px', color: '#000080', background: '#ece9d8', textAlign: 'center', fontSize: '11px', fontStyle: 'italic', borderTop: '1px solid #7f9db9' }}>
                                Showing top 150 of {filteredDropdownItems.length} items. Type to search or press F2 for all.
                              </td>
                            </tr>
                          )}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. Customer Display - Selected Item Photo & Specs Window */}
              <div className="sofast-customer-display-window">
                <div className="sofast-display-titlebar">
                  <div className="sofast-display-title">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    <span>Customer Display — Item Photo & Details</span>
                  </div>
                  {activePreviewItem?.image && (
                    <button
                      type="button"
                      className="sofast-display-enlarge-btn"
                      onClick={() => setIsImageModalOpen(true)}
                      title="Enlarge item image for customer"
                    >
                      🔍 Enlarge
                    </button>
                  )}
                </div>

                <div className="sofast-display-body">
                  {activePreviewItem ? (
                    <div className="sofast-display-item-content">
                      <div
                        className={`sofast-display-img-box ${activePreviewItem.image ? 'clickable' : ''}`}
                        onClick={() => {
                          if (activePreviewItem.image) setIsImageModalOpen(true);
                        }}
                        title={activePreviewItem.image ? 'Click to view full-size photo' : 'No photo uploaded for this item'}
                      >
                        {activePreviewItem.image ? (
                          <img
                            src={activePreviewItem.image}
                            alt={activePreviewItem.description}
                            className="sofast-display-img"
                          />
                        ) : (
                          <div className="sofast-display-no-img">
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#7f9db9" strokeWidth="1.5">
                              <rect x="3" y="3" width="18" height="18" rx="2" />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <path d="M21 15l-5-5L5 21" />
                            </svg>
                            <span>No Photo</span>
                            <small>Item Master</small>
                          </div>
                        )}
                        {activePreviewItem.image && (
                          <span className="sofast-display-zoom-hint">🔍 Zoom</span>
                        )}
                      </div>

                      <div className="sofast-display-info-col">
                        <div className="sofast-display-code-row">
                          <span className="sofast-display-code-badge">{activePreviewItem.code}</span>
                          {activePreviewItem.brand && (
                            <span className="sofast-display-brand-badge">{activePreviewItem.brand}</span>
                          )}
                        </div>
                        <div className="sofast-display-desc" title={activePreviewItem.description}>
                          {activePreviewItem.description}
                        </div>
                        <div className="sofast-display-price-stock-row">
                          <div className="sofast-display-price-tag">
                            <span className="sofast-display-price-lbl">Price:</span>
                            <span className="sofast-display-price-val">
                              Rs. {Number(
                                activePreviewItem.sellingPrice !== undefined && Number(activePreviewItem.sellingPrice) >= 0
                                  ? activePreviewItem.sellingPrice
                                  : (activePreviewItem.finalSellingPrice || activePreviewItem.price || 0)
                              ).toFixed(2)}
                            </span>
                          </div>
                          <div className="sofast-display-stock-tag">
                            <span className="sofast-display-stock-lbl">Stock:</span>
                            <span className={`sofast-display-stock-val ${Number(activePreviewItem.quantity || activePreviewItem.stockInHand || 0) <= 0 ? 'out' : ''}`}>
                              {activePreviewItem.quantity !== undefined
                                ? activePreviewItem.quantity
                                : (activePreviewItem.stockInHand !== undefined ? activePreviewItem.stockInHand : '0')}
                            </span>
                          </div>
                        </div>
                        {activePreviewItem.category && (
                          <div className="sofast-display-cat">
                            Category: <b>{activePreviewItem.category}</b>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="sofast-display-empty-state">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#7f9db9" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                      <span className="empty-title">Customer Item Photo Display</span>
                      <span className="empty-subtitle">
                        Select an item from the catalog or invoice to view photo and details for the customer
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM FULL-WIDTH MAIN INVOICE GRID */}
          <div className="sofast-bottom-grid-container">
            <table className="sofast-grid-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Code</th>
                  <th style={{ minWidth: '400px' }}>Description</th>
                  <th style={{ width: '85px', textAlign: 'right' }}>Selling Price</th>
                  <th style={{ width: '70px', textAlign: 'center' }}>Quantity</th>
                  <th style={{ width: '70px', textAlign: 'center' }}>Discount</th>
                  <th style={{ width: '95px', textAlign: 'right' }}>Value</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.length === 0 ? (
                  Array.from({ length: 7 }).map((_, emptyIdx) => (
                    <tr key={`empty-${emptyIdx}`} className="empty-grid-row">
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                    </tr>
                  ))
                ) : (
                  lineItems.map((item, index) => (
                    <tr
                      key={index}
                      className={selectedLineIndex === index ? 'selected-row' : ''}
                      onClick={() => handleRowClick(index)}
                      title="Click to edit, Double click to remove"
                      onDoubleClick={(e) => handleRemoveLineItem(index, e)}
                    >
                      <td className="sofast-cell-code">{item.code}</td>
                      <td>{item.description}</td>
                      <td style={{ textAlign: 'right' }}>
                        {Number(item.sellingPrice || item.price || 0).toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ textAlign: 'center' }}>
                        {item.discountPercentage ? `${item.discountPercentage}%` : '0%'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {Number(item.finalPrice || item.value || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
                {/* Visual grid filler rows */}
                {lineItems.length > 0 && Array.from({ length: Math.max(0, 6 - lineItems.length) }).map((_, emptyIdx) => (
                  <tr key={`empty-fill-${emptyIdx}`} className="empty-grid-row">
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* BOTTOM ACTIONS BAR (New | Bill Print | Save | Delete) & Summary Totals */}
          <div className="sofast-bottom-action-bar">
            <div className="sofast-bottom-buttons-group">
              <button
                type="button"
                className="sofast-bottom-btn sofast-btn-new"
                onClick={() => handleNew(false)}
                title="Start a new invoice (clears unsaved items with confirmation)"
              >
                New
              </button>
              <button
                type="button"
                className="sofast-bottom-btn sofast-btn-print"
                onClick={handleBillPrint}
                title="Save invoice (if unsaved) and print thermal bill receipt"
              >
                Bill Print
              </button>
              <button
                type="button"
                className="sofast-bottom-btn sofast-btn-save"
                onClick={() => handleSaveInvoice(false)}
                disabled={loading}
                title="Save invoice to database and update stock"
              >
                Save
              </button>
              <button
                type="button"
                className="sofast-bottom-btn sofast-btn-delete"
                onClick={handleDeleteInvoice}
                disabled={loading}
                title="Delete or cancel invoice and restore stock"
              >
                Delete
              </button>
            </div>

            {/* Quick summary totals on the right of the bottom bar */}
            <div className="sofast-bottom-summary">
              <span
                className="sofast-bottom-summary-item"
                title={
                  lineItems.some((li) => li.jobType === 'Labour' || li.isService)
                    ? `${lineItems.filter((li) => li.jobType !== 'Labour' && !li.isService).length} Stock, ${lineItems.filter((li) => li.jobType === 'Labour' || li.isService).length} Service`
                    : `${lineItems.length} Items`
                }
              >
                <span className="summary-label">Items:</span>
                <span className="summary-value">
                  {lineItems.length}
                  {lineItems.some((li) => li.jobType === 'Labour' || li.isService) && (
                    <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#555', marginLeft: '4px' }}>
                      ({lineItems.filter((li) => li.jobType !== 'Labour' && !li.isService).length} stock, {lineItems.filter((li) => li.jobType === 'Labour' || li.isService).length} service)
                    </span>
                  )}
                </span>
              </span>
              <span className="sofast-bottom-summary-item">
                <span className="summary-label">Sub Total:</span>
                <span className="summary-value">{invoiceSubTotal.toFixed(2)}</span>
              </span>
              {specialDiscVal > 0 && (
                <span className="sofast-bottom-summary-item">
                  <span className="summary-label">Discount:</span>
                  <span className="summary-value">{specialDiscVal.toFixed(2)}</span>
                </span>
              )}
              <span className="sofast-bottom-summary-item grand-total-item">
                <span className="summary-label">Net Total:</span>
                <span className="summary-value grand-total-value">
                  {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Lookup Modal (Customer / Item) */}
      {lookupModal.isOpen && (
        <div className="invoice-modal-overlay">
          <div className="invoice-modal-window">
            <div className="invoice-modal-titlebar">
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
            <div className="invoice-modal-body">
              <input
                type="text"
                className="invoice-input"
                style={{ width: '100%', padding: '4px 8px' }}
                placeholder={
                  lookupModal.type === 'item'
                    ? "Type to search by code, description, category, barcode..."
                    : lookupModal.type === 'invoice'
                    ? "Type to search by invoice number, customer name, date..."
                    : "Type to filter..."
                }
                autoFocus
                value={lookupModal.search}
                onChange={(e) => {
                  setLookupModal({ ...lookupModal, search: e.target.value });
                  setLookupPage(1);
                }}
              />

              <div style={{ fontSize: '11px', color: '#000080', fontWeight: 'bold', margin: '4px 2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  {lookupModal.type === 'item'
                    ? `Showing ${pagedItems.length} of ${filteredItems.length} matching items (Total: ${itemsList.length} items in Item Master)`
                    : lookupModal.type === 'invoice'
                    ? `Showing ${filteredInvoices.length} invoices (Total: ${invoicesList.length} invoices)`
                    : `Showing ${filteredCustomers.length} customers (Total: ${customersList.length} customers)`}
                </span>
                {lookupModal.type === 'item' && totalLookupPages > 1 && (
                  <span style={{ fontSize: '11px', color: '#555' }}>
                    Page {lookupPage} of {totalLookupPages}
                  </span>
                )}
              </div>

              <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                {lookupModal.type === 'customer' ? (
                  <table className="invoice-lookup-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                        <th style={{ width: '90px' }}>Code</th>
                        <th>Customer Name</th>
                        <th style={{ width: '160px' }}>Address</th>
                        <th style={{ width: '100px' }}>Phone</th>
                        <th style={{ width: '60px', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCustomers.length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '12px', color: '#666' }}>
                            No customers found matching "{lookupModal.search}"
                          </td>
                        </tr>
                      ) : (
                        filteredCustomers.map((c, idx) => (
                          <tr key={c._id || c.code} onClick={() => handleSelectCustomerFromLookup(c)}>
                            <td style={{ textAlign: 'center', color: '#666' }}>{idx + 1}</td>
                            <td style={{ fontWeight: 'bold', color: '#000080' }}>{c.code || c.customerCode}</td>
                            <td style={{ fontWeight: '600' }}>{c.name}</td>
                            <td>{c.address || '-'}</td>
                            <td>{c.telephone || c.telephone1 || '-'}</td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="invoice-btn-classic"
                                style={{ height: '20px', minWidth: '45px', padding: '0 4px', fontSize: '11px' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectCustomerFromLookup(c);
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
                ) : lookupModal.type === 'invoice' ? (
                  <table className="invoice-lookup-table">
                    <thead>
                      <tr>
                        <th style={{ width: '35px', textAlign: 'center' }}>#</th>
                        <th style={{ width: '110px' }}>Invoice No</th>
                        <th style={{ width: '90px' }}>Date</th>
                        <th>Customer</th>
                        <th style={{ width: '90px', textAlign: 'center' }}>Method</th>
                        <th style={{ width: '85px', textAlign: 'right' }}>Total</th>
                        <th style={{ width: '80px', textAlign: 'right' }}>Due</th>
                        <th style={{ width: '55px', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.length === 0 ? (
                        <tr>
                          <td colSpan="8" style={{ textAlign: 'center', padding: '16px', color: '#666' }}>
                            No invoices found matching "{lookupModal.search}"
                          </td>
                        </tr>
                      ) : (
                        filteredInvoices.map((inv, idx) => (
                          <tr key={inv._id || inv.invoiceNumber} onClick={() => handleSelectInvoiceFromLookup(inv)}>
                            <td style={{ textAlign: 'center', color: '#666' }}>{idx + 1}</td>
                            <td style={{ fontWeight: 'bold', color: '#000080' }}>{inv.invoiceNumber || inv.no}</td>
                            <td>{inv.date ? new Date(inv.date).toISOString().split('T')[0] : '-'}</td>
                            <td style={{ fontWeight: '600' }}>{inv.customerName || 'Walk In Customer'}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{
                                padding: '1px 6px',
                                borderRadius: '3px',
                                fontSize: '10px',
                                fontWeight: 'bold',
                                background: inv.paymentMethod === 'Credit' ? '#fef3c7' : '#e0f2fe',
                                color: inv.paymentMethod === 'Credit' ? '#92400e' : '#0369a1'
                              }}>
                                {inv.paymentMethod || inv.paidBy || 'Cash'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                              {Number(inv.totalAmount || inv.total || 0).toFixed(2)}
                            </td>
                            <td style={{ textAlign: 'right', color: Number(inv.dueAmount || 0) > 0 ? '#b91c1c' : '#15803d', fontWeight: 'bold' }}>
                              {Number(inv.dueAmount || 0).toFixed(2)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="invoice-btn-classic"
                                style={{ height: '20px', minWidth: '45px', padding: '0 4px', fontSize: '11px' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectInvoiceFromLookup(inv);
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
                ) : (
                  <table className="invoice-lookup-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                        <th style={{ width: '100px' }}>Code</th>
                        <th>Description</th>
                        <th style={{ width: '95px' }}>Category</th>
                        <th style={{ width: '85px', textAlign: 'right' }}>Price</th>
                        <th style={{ width: '85px', textAlign: 'right' }}>Cost</th>
                        <th style={{ width: '65px', textAlign: 'center' }}>Stock</th>
                        <th style={{ width: '60px', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan="8" style={{ textAlign: 'center', padding: '16px', color: '#666' }}>
                            No items found matching "{lookupModal.search}"
                          </td>
                        </tr>
                      ) : (
                        pagedItems.map((i, idx) => (
                          <tr key={i._id || i.code} onClick={() => handleSelectItemFromLookup(i)}>
                            <td style={{ textAlign: 'center', color: '#666' }}>
                              {(lookupPage - 1) * ITEMS_PER_PAGE + idx + 1}
                            </td>
                            <td style={{ fontWeight: 'bold', color: '#000080' }}>{i.code}</td>
                            <td>{i.description}</td>
                            <td>{i.category || '-'}</td>
                            <td style={{ textAlign: 'right' }}>
                              {Number(i.finalSellingPrice || i.sellingPrice || 0).toFixed(2)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {Number(i.lastGrnPrice || i.averageCost || 0).toFixed(2)}
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{i.quantity || 0}</td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="invoice-btn-classic"
                                style={{ height: '20px', minWidth: '45px', padding: '0 4px', fontSize: '11px' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectItemFromLookup(i);
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
                )}
              </div>
            </div>
            <div className="invoice-modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {lookupModal.type === 'item' && totalLookupPages > 1 && (
                  <>
                    <button
                      type="button"
                      className="invoice-btn-classic"
                      disabled={lookupPage <= 1}
                      onClick={() => setLookupPage((p) => Math.max(1, p - 1))}
                      style={{ padding: '2px 8px', fontSize: '11px' }}
                    >
                      ◀ Previous
                    </button>
                    <span style={{ fontSize: '11px', color: '#333' }}>
                      Page <strong>{lookupPage}</strong> of <strong>{totalLookupPages}</strong>
                    </span>
                    <button
                      type="button"
                      className="invoice-btn-classic"
                      disabled={lookupPage >= totalLookupPages}
                      onClick={() => setLookupPage((p) => Math.min(totalLookupPages, p + 1))}
                      style={{ padding: '2px 8px', fontSize: '11px' }}
                    >
                      Next ▶
                    </button>
                  </>
                )}
              </div>
              <button
                type="button"
                className="invoice-btn-classic"
                onClick={() => setLookupModal({ isOpen: false, type: null, title: '', search: '' })}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Note Modal */}
      {noteModalOpen && (
        <div className="invoice-modal-overlay" onClick={handleCloseNoteModal}>
          <div
            className="invoice-modal-window"
            style={{ width: '640px', maxWidth: '96vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="invoice-modal-titlebar">
              <span>Invoice Note</span>
              <button
                type="button"
                className="control-btn close"
                style={{ width: '24px', height: '20px' }}
                onClick={handleCloseNoteModal}
                title="Close dialog"
              >
                &#x2715;
              </button>
            </div>

            <div className="invoice-modal-body" style={{ padding: '16px', gap: '12px' }}>
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #7f9db9',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  fontSize: '13px',
                }}
              >
                {/* Customer Name */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: '#000080' }}>Customer Name:</span>
                  <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#000000' }}>
                    {invoiceHeader.customerName || 'Walk In Customer'}
                    {invoiceHeader.customerCode ? ` (${invoiceHeader.customerCode})` : ''}
                  </span>
                </div>

                {/* Invoice Number */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: '#000080' }}>Invoice Number:</span>
                  <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#005bb7' }}>
                    {invoiceHeader.invoiceNumber || 'Draft (New Invoice)'}
                  </span>
                </div>

                {/* Note / Customer Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                  <label htmlFor="invoice-note-textarea" style={{ fontWeight: 600, color: '#000080', fontSize: '13px' }}>
                    Note / Customer Details:
                  </label>
                  <textarea
                    id="invoice-note-textarea"
                    ref={noteTextareaRef}
                    rows={10}
                    className="invoice-input"
                    style={{
                      width: '100%',
                      minHeight: '220px',
                      padding: '8px 10px',
                      fontSize: '13px',
                      lineHeight: 1.5,
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                    placeholder="Enter delivery instructions, special requests, or customer details..."
                    value={noteInputText}
                    onChange={(e) => setNoteInputText(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <div style={{ fontSize: '11px', color: '#555555', fontStyle: 'italic', lineHeight: 1.3 }}>
                * This note is associated with this specific invoice and does not affect inventory stock, prices, or Customer Master records.
              </div>
            </div>

            <div className="invoice-modal-footer">
              <button
                type="button"
                className="invoice-btn-classic"
                onClick={handleClearNoteModal}
                style={{ minWidth: '70px', height: '26px' }}
                title="Clear note text"
              >
                Clear
              </button>
              <button
                type="button"
                className="invoice-btn-classic"
                onClick={handleCloseNoteModal}
                style={{ minWidth: '70px', height: '26px' }}
                title="Cancel without saving"
              >
                Cancel
              </button>
              <button
                type="button"
                className="invoice-btn-classic"
                onClick={handleSaveNoteModal}
                disabled={savingNote}
                style={{ fontWeight: 'bold', minWidth: '95px', height: '26px' }}
                title="Save note to invoice"
              >
                {savingNote ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calculate Discount Modal (Common Discount for All Eligible Items) */}
      {discountModalOpen && (
        <div className="invoice-modal-overlay" onClick={handleCloseDiscountModal}>
          <div
            className="invoice-modal-window"
            style={{ width: '420px', maxWidth: '95vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="invoice-modal-titlebar">
              <span>Calculate Discount</span>
              <button
                type="button"
                className="control-btn close"
                style={{ width: '24px', height: '20px' }}
                onClick={handleCloseDiscountModal}
                title="Close dialog"
              >
                &#x2715;
              </button>
            </div>
            <div className="invoice-modal-body" style={{ padding: '14px', gap: '10px' }}>
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #7f9db9',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  fontSize: '12px',
                }}
              >
                {/* Current Invoice Subtotal */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: '#000080' }}>Current Invoice Subtotal:</span>
                  <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#000000' }}>
                    Rs. {discountCalculationSummary.eligibleGrossSubTotal.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>

                {/* Discount Percentage Input */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label htmlFor="discount-pct-input" style={{ fontWeight: 600, color: '#000080' }}>
                    Discount Percentage (%):
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      id="discount-pct-input"
                      ref={discountInputRef}
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      value={discountInputPercentage}
                      onChange={(e) => handleDiscountPercentageInputChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleApplyDiscountModal();
                        if (e.key === 'Escape') handleCloseDiscountModal();
                      }}
                      className="invoice-input"
                      style={{
                        width: '90px',
                        textAlign: 'right',
                        padding: '3px 6px',
                        fontWeight: 'bold',
                        borderColor: discountInputError ? '#d32f2f' : '#7f9db9',
                      }}
                      placeholder="0.00"
                      autoFocus
                    />
                    <span style={{ fontWeight: 'bold' }}>%</span>
                  </div>
                </div>

                {/* Validation Error Message */}
                {discountInputError && (
                  <div style={{ color: '#d32f2f', fontSize: '11px', textAlign: 'right', marginTop: '-4px' }}>
                    {discountInputError}
                  </div>
                )}

                {/* Calculated Discount Amount */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px dashed #cccccc',
                    paddingTop: '8px',
                  }}
                >
                  <span style={{ fontWeight: 600, color: '#8b0000' }}>Calculated Discount Amount:</span>
                  <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#8b0000' }}>
                    - Rs. {discountCalculationSummary.calculatedDiscountAmount.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>

                {/* New Net Total */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '2px solid #005bb7',
                    paddingTop: '8px',
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: '13px', color: '#000080' }}>New Net Total:</span>
                  <span style={{ fontWeight: 800, fontSize: '14px', color: '#005bb7' }}>
                    Rs. {discountCalculationSummary.newNetTotal.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              {/* Informative notice */}
              <div style={{ fontSize: '11px', color: '#555555', fontStyle: 'italic', lineHeight: 1.3 }}>
                * Applies to {discountCalculationSummary.eligibleCount} eligible item{discountCalculationSummary.eligibleCount === 1 ? '' : 's'}, replacing previous individual discounts.
                {discountCalculationSummary.nonEligibleCount > 0 && ` (${discountCalculationSummary.nonEligibleCount} Labour/delivery charge line excluded)`}
              </div>
            </div>

            <div className="invoice-modal-footer">
              <button
                type="button"
                className="invoice-btn-classic"
                onClick={handleClearDiscountModal}
                title="Clear discount percentage"
              >
                Clear
              </button>
              <button
                type="button"
                className="invoice-btn-classic"
                onClick={handleCloseDiscountModal}
                title="Cancel and close dialog"
              >
                Cancel
              </button>
              <button
                type="button"
                className="invoice-btn-classic"
                onClick={handleApplyDiscountModal}
                style={{ fontWeight: 'bold' }}
                title="Apply discount percentage to all eligible invoice items"
              >
                Apply Discount
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Receipt Preview Modal */}
      {previewModalOpen && (
        <div className="invoice-modal-overlay">
          <div className="invoice-modal-window" style={{ width: '380px', maxWidth: '95vw' }}>
            <div className="invoice-modal-titlebar">
              <span>Receipt Preview - Invoice #{invoiceHeader.invoiceNumber || '-'}</span>
              <button
                type="button"
                className="control-btn close"
                style={{ width: '24px', height: '20px' }}
                onClick={() => setPreviewModalOpen(false)}
              >
                &#x2715;
              </button>
            </div>
            <div className="invoice-modal-body" style={{ background: '#808080', display: 'flex', justifyContent: 'center', padding: '12px' }}>
              {renderThermalReceiptContent()}
            </div>
            <div className="invoice-modal-footer">
              <button
                type="button"
                className="invoice-btn-classic"
                onClick={handlePrint}
              >
                Print
              </button>
              <button
                type="button"
                className="invoice-btn-classic"
                onClick={() => setPreviewModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-size Product Image Modal for Customer Preview */}
      {isImageModalOpen && activePreviewItem?.image && (
        <div className="invoice-modal-overlay" onClick={() => setIsImageModalOpen(false)}>
          <div
            className="invoice-modal-window sofast-img-preview-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '560px', maxWidth: '95vw' }}
          >
            <div className="invoice-modal-titlebar">
              <span>📷 Product Photo - {activePreviewItem.code} ({activePreviewItem.description})</span>
              <button
                type="button"
                className="control-btn close"
                style={{ width: '26px', height: '22px' }}
                onClick={() => setIsImageModalOpen(false)}
              >
                &#x2715;
              </button>
            </div>
            <div className="sofast-modal-img-body">
              <img
                src={activePreviewItem.image}
                alt={activePreviewItem.description}
                className="sofast-modal-full-img"
              />
              <div className="sofast-modal-img-footer-details">
                <div className="sofast-modal-code-desc">
                  <span className="sofast-modal-code">{activePreviewItem.code}</span>
                  <span className="sofast-modal-desc">{activePreviewItem.description}</span>
                </div>
                <div className="sofast-modal-price-stock">
                  <span className="sofast-modal-price">
                    Price: Rs. {Number(activePreviewItem.sellingPrice || activePreviewItem.finalSellingPrice || activePreviewItem.price || 0).toFixed(2)}
                  </span>
                  <span className="sofast-modal-stock">
                    Available Stock: {activePreviewItem.quantity !== undefined ? activePreviewItem.quantity : (activePreviewItem.stockInHand || '0')}
                  </span>
                </div>
              </div>
            </div>
            <div className="invoice-modal-footer">
              <button
                type="button"
                className="invoice-btn-classic"
                onClick={() => setIsImageModalOpen(false)}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED PRINT AREA FOR 80MM/58MM THERMAL RECEIPT */}
      <div id="thermal-receipt-print-area">
        {renderThermalReceiptContent()}
      </div>
    </div>
  );
}

export default Invoice;
