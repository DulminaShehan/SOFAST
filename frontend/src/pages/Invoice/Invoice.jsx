import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
    isManualInvoice: false,
    remark: '',
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
    rackBin: '',
    availableQty: '',
    quantity: '',
    rate: '',
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
    value: '',
    due: '',
    balance: '',
    disc: '',
    note: '',
  });

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

  // Receipt Preview Modal
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // Input Refs
  const itemCodeInputRef = useRef(null);
  const paidAmountInputRef = useRef(null);
  const dateInputRef = useRef(null);

  // Menubar items
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
      id: 'damage-claim',
      label: 'Damage Claim',
      path: '/damage-claim',
      renderIcon: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    },
    {
      id: 'damage-items',
      label: 'Damage Items',
      path: '/damage-items',
      renderIcon: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="9" y1="15" x2="15" y2="15" />
          <line x1="9" y1="11" x2="15" y2="11" />
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
        const rawNum = nextNumRes.data.data.invoiceNumber || nextNumRes.data.data.no;
        const formattedNum = String(rawNum).startsWith('INV-')
          ? String(rawNum)
          : `INV-${String(rawNum).padStart(6, '0')}`;
        setInvoiceHeader((prev) => ({
          ...prev,
          no: nextNumRes.data.data.no,
          invoiceNumber: formattedNum,
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
      remark: inv.remark || '',
    });

    const lines = (inv.lineItems || []).map((li) => ({
      code: li.code || li.itemCode || '',
      description: li.description || '',
      location: li.location || 'Main Store',
      quantity: Number(li.quantity || li.qty || 1),
      price: Number(li.price || li.unitPrice || 0),
      discountPercentage: li.discountPercentage !== undefined ? Number(li.discountPercentage) : 0,
      discountAmount: li.discountAmount !== undefined ? Number(li.discountAmount) : 0,
      finalPrice: Number(li.finalPrice !== undefined ? li.finalPrice : (li.value || 0)),
      itemCost: Number(li.itemCost || 0),
      lastGrn: li.lastGrn || '',
      lastGrnDate: li.lastGrnDate || '',
      masterPack: String(li.masterPack || '1'),
      rateType: li.rateType || 'Retail',
      mpCost: Number(li.mpCost || 0),
      value: Number(li.value || li.finalPrice || 0),
      total: Number(li.total || li.finalPrice || 0),
      balance: li.balance !== undefined ? li.balance : (li.availableQty || 0),
      availableQty: li.availableQty !== undefined ? li.availableQty : (li.balance || 0),
    }));
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
      prev.map((item) => ({
        ...item,
        discountPercentage: 0,
        discountAmount: 0,
        discount: '0',
        value: Math.round(Number(item.sellingPrice || item.price) * Number(item.quantity) * 100) / 100,
        finalPrice: Math.round(Number(item.sellingPrice || item.price) * Number(item.quantity) * 100) / 100,
      }))
    );
    showNotification('Discounts removed');
  };

  // Select Invoice from Lookup Modal
  const handleSelectInvoiceFromLookup = (inv) => {
    loadInvoiceData(inv);
    setLookupModal({ isOpen: false, type: null, title: '', search: '' });
  };

  // Select Item from Lookup Modal
  const handleSelectItemFromLookup = async (item) => {
    if (!item) return;

    const sellingPrice =
      item.sellingPrice !== undefined && Number(item.sellingPrice) >= 0
        ? Number(item.sellingPrice)
        : (item.finalSellingPrice !== undefined ? Number(item.finalSellingPrice) : 0);

    const available =
      item.quantity !== undefined
        ? item.quantity
        : (item.stockInHand !== undefined ? item.stockInHand : 0);

    const roundOpt = item.roundOffOption || 'No Round Off';
    const roundStp = item.roundOffStep || 10;

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

    // Requirement 2: Quantity field represents customer purchase quantity, default 1 (never available stock)
    const initQty = '1';

    const comp = computeLinePricing(
      sellingPrice,
      initQty,
      initDiscPct,
      '',
      'percentage',
      roundOpt,
      roundStp
    );

    const grnHistory = await fetchItemGrnHistory(item.code);
    const hasHistory = Boolean(grnHistory?.summary?.hasGrnHistory);
    const latestCost = grnHistory?.summary?.latestGrnCost;
    const costDisplay =
      hasHistory && latestCost !== null && latestCost !== undefined
        ? Number(latestCost).toFixed(2)
        : '-';

    const lastGrnFormatted = grnHistory?.summary?.lastGrnFormatted || item.lastGrn || '-';
    const grnNum = grnHistory?.summary?.latestGrnNumber || item.lastGrn || '';
    const grnDate = grnHistory?.summary?.latestGrnDate
      ? new Date(grnHistory.summary.latestGrnDate).toISOString().split('T')[0]
      : (item.lastGrnDate ? String(item.lastGrnDate).split('T')[0] : '');

    setItemEntry({
      code: item.code || '',
      description: item.description || '',
      location: item.location || 'Main Store',
      availableQty: available,
      quantity: initQty,
      price: sellingPrice,
      rate: '0',
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
      balance: available,
      total: comp.finalPrice,
      note: '',
    });

    fetchAlternativeProducts(item.code);
    setItemDropdownOpen(false);
    setHighlightedItemIndex(-1);
    setLookupModal({ isOpen: false, type: null, title: '', search: '' });
  };

  // Handle Keyboard navigation on Item Code input
  const handleCodeKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!itemDropdownOpen) {
        setItemDropdownOpen(true);
        setHighlightedItemIndex(0);
      } else {
        setHighlightedItemIndex((prev) =>
          prev < Math.min(filteredDropdownItems.length, 150) - 1 ? prev + 1 : prev
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
        handleSelectItemFromLookup(filteredDropdownItems[highlightedItemIndex]);
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
        handleSelectItemFromLookup(match);
        setItemDropdownOpen(false);
        setHighlightedItemIndex(-1);
      } else if (filteredDropdownItems.length > 0) {
        handleSelectItemFromLookup(filteredDropdownItems[0]);
        setItemDropdownOpen(false);
        setHighlightedItemIndex(-1);
      } else {
        setItemDropdownOpen(false);
        setLookupModal({
          isOpen: true,
          type: 'item',
          title: 'Select Item from Item Master',
          search: itemEntry.code,
        });
        setLookupPage(1);
      }
    }
  };

  // Handle Item Entry Changes
  const handleItemEntryChange = (e) => {
    const { name, value } = e.target;
    let updated = { ...itemEntry, [name]: value };

    // Auto-match Item by Code or Barcode
    if (name === 'code') {
      const trimmed = String(value || '').trim().toLowerCase();
      const match = itemsList.find(
        (i) =>
          i.code?.toLowerCase() === trimmed ||
          i.barcode?.toLowerCase() === trimmed ||
          i.barCode?.toLowerCase() === trimmed
      );

      if (match) {
        const sellingPrice =
          match.sellingPrice !== undefined && Number(match.sellingPrice) >= 0
            ? Number(match.sellingPrice)
            : (match.finalSellingPrice !== undefined ? Number(match.finalSellingPrice) : 0);

        const available =
          match.quantity !== undefined
            ? match.quantity
            : (match.stockInHand !== undefined ? match.stockInHand : 0);

        const roundOpt = match.roundOffOption || 'No Round Off';
        const roundStp = match.roundOffStep || 10;

        let initDiscPct = '';
        if (invoiceHeader.customerCode) {
          const cust = customersList.find((c) => (c.code || c.customerCode) === invoiceHeader.customerCode);
          if (cust && cust.discount && Number(cust.discount) > 0) {
            initDiscPct = String(cust.discount);
          }
        }
        if (!initDiscPct && match.discountPercentage && Number(match.discountPercentage) > 0) {
          initDiscPct = String(match.discountPercentage);
        }

        // Requirement 2: Quantity field represents customer purchase quantity, default 1 (never available stock)
        const initQty = '1';

        const comp = computeLinePricing(
          sellingPrice,
          initQty,
          initDiscPct,
          '',
          'percentage',
          roundOpt,
          roundStp
        );

        updated.code = match.code;
        updated.description = match.description || '';
        updated.location = match.location || 'Main Store';
        updated.availableQty = available;
        updated.quantity = initQty;
        updated.price = sellingPrice;
        updated.rate = '0';
        updated.itemCost = '-';
        updated.lastGrn = match.lastGrn || '';
        updated.lastGrnDate = match.lastGrnDate ? String(match.lastGrnDate).split('T')[0] : '';
        updated.lastGrnFormatted = match.lastGrn || '-';
        updated.roundOffOption = roundOpt;
        updated.roundOffStep = roundStp;
        updated.discountPercentage = comp.discountPercentage;
        updated.discountAmount = comp.discountAmount;
        updated.finalPrice = comp.finalPrice;
        updated.value = comp.finalPrice;
        updated.balance = available;
        updated.total = comp.finalPrice;

        fetchItemGrnHistory(match.code).then((grnData) => {
          if (grnData?.summary) {
            setItemEntry((curr) => {
              if (curr.code.toLowerCase() === match.code.toLowerCase()) {
                const dateStr = grnData.summary.latestGrnDate
                  ? new Date(grnData.summary.latestGrnDate).toISOString().split('T')[0]
                  : curr.lastGrnDate;
                const costDisp =
                  grnData.summary.hasGrnHistory &&
                  grnData.summary.latestGrnCost !== null &&
                  grnData.summary.latestGrnCost !== undefined
                    ? Number(grnData.summary.latestGrnCost).toFixed(2)
                    : '-';
                return {
                  ...curr,
                  itemCost: costDisp,
                  lastGrn: grnData.summary.latestGrnNumber || curr.lastGrn,
                  lastGrnDate: dateStr,
                  lastGrnFormatted: grnData.summary.lastGrnFormatted || curr.lastGrnFormatted,
                  availableQty:
                    grnData.summary.closingStock !== undefined
                      ? grnData.summary.closingStock
                      : curr.availableQty,
                };
              }
              return curr;
            });
          }
        });

        fetchAlternativeProducts(match.code);
      } else {
        setAlternativeProducts([]);
      }
    }

    // Quantity change: validate customer purchase quantity against available stock and recalculate Value
    if (name === 'quantity') {
      let qtyVal = value;
      const numQty = parseFloat(qtyVal);
      const avail = parseFloat(updated.availableQty);

      if (!isNaN(numQty) && !isNaN(avail) && avail > 0 && numQty > avail) {
        showNotification(`Requested purchase quantity (${numQty}) cannot exceed available stock (${avail})`, 'error');
      } else if (!isNaN(numQty) && numQty <= 0) {
        showNotification('Purchase quantity must be greater than 0', 'error');
      }

      const comp = computeLinePricing(
        updated.price,
        qtyVal,
        updated.discountPercentage,
        updated.discountAmount,
        'percentage',
        updated.roundOffOption,
        updated.roundOffStep
      );
      updated.discountPercentage = comp.discountPercentage;
      updated.discountAmount = comp.discountAmount;
      updated.finalPrice = comp.finalPrice;
      updated.value = comp.finalPrice;
      updated.total = comp.finalPrice;
    } else if (name === 'price') {
      const comp = computeLinePricing(
        value,
        updated.quantity,
        updated.discountPercentage,
        updated.discountAmount,
        'percentage',
        updated.roundOffOption,
        updated.roundOffStep
      );
      updated.discountPercentage = comp.discountPercentage;
      updated.discountAmount = comp.discountAmount;
      updated.finalPrice = comp.finalPrice;
      updated.value = comp.finalPrice;
      updated.total = comp.finalPrice;
    } else if (name === 'discountPercentage') {
      const comp = computeLinePricing(
        updated.price,
        updated.quantity,
        value,
        updated.discountAmount,
        'percentage',
        updated.roundOffOption,
        updated.roundOffStep
      );
      updated.discountPercentage = comp.discountPercentage;
      updated.discountAmount = comp.discountAmount;
      updated.finalPrice = comp.finalPrice;
      updated.value = comp.finalPrice;
      updated.total = comp.finalPrice;
    } else if (name === 'discountAmount') {
      const comp = computeLinePricing(
        updated.price,
        updated.quantity,
        updated.discountPercentage,
        value,
        'amount',
        updated.roundOffOption,
        updated.roundOffStep
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

    let match = itemsList.find((i) => i.code?.toLowerCase() === alt.code.toLowerCase());

    const stock = Number(
      match
        ? (match.quantity !== undefined
            ? match.quantity
            : (match.stockInHand !== undefined ? match.stockInHand : 0))
        : (alt.stock !== undefined
            ? alt.stock
            : (alt.quantity !== undefined ? alt.quantity : (alt.availableQty || 0)))
    );

    if (stock <= 0) {
      showNotification(`Note: Alternative item '${alt.code}' currently has 0 available stock.`, 'info');
    }

    const sellingPrice = match
      ? (match.sellingPrice !== undefined ? Number(match.sellingPrice) : (match.finalSellingPrice || alt.sellingPrice || alt.price || 0))
      : (alt.sellingPrice || alt.price || 0);

    const roundOpt = match?.roundOffOption || alt.roundOffOption || 'No Round Off';
    const roundStp = match?.roundOffStep || alt.roundOffStep || 10;

    let initDiscPct = '';
    if (invoiceHeader.customerCode) {
      const cust = customersList.find((c) => (c.code || c.customerCode) === invoiceHeader.customerCode);
      if (cust && cust.discount && Number(cust.discount) > 0) {
        initDiscPct = String(cust.discount);
      }
    }
    if (!initDiscPct) {
      const disc = match?.discountPercentage || alt.discountPercentage;
      if (disc && Number(disc) > 0) {
        initDiscPct = String(disc);
      }
    }

    // Requirement 2: Quantity field represents customer purchase quantity, default 1 (never available stock)
    const initQty = '1';

    const comp = computeLinePricing(
      sellingPrice,
      initQty,
      initDiscPct,
      '',
      'percentage',
      roundOpt,
      roundStp
    );

    const grnHistory = await fetchItemGrnHistory(alt.code);
    const hasHistory = Boolean(grnHistory?.summary?.hasGrnHistory);
    const latestCost = grnHistory?.summary?.latestGrnCost;
    const costDisplay =
      hasHistory && latestCost !== null && latestCost !== undefined
        ? Number(latestCost).toFixed(2)
        : '-';

    const lastGrnFormatted = grnHistory?.summary?.lastGrnFormatted || match?.lastGrn || alt.lastGrn || '-';
    const grnNum = grnHistory?.summary?.latestGrnNumber || match?.lastGrn || alt.lastGrn || '';
    const grnDate = grnHistory?.summary?.latestGrnDate
      ? new Date(grnHistory.summary.latestGrnDate).toISOString().split('T')[0]
      : (match?.lastGrnDate ? String(match.lastGrnDate).split('T')[0] : '');

    // Requirement 4: Load the selected alternative's own code, description, available qty, price, discount, location, GRN cost
    setItemEntry({
      code: alt.code,
      description: alt.description || match?.description || '',
      location: alt.location || match?.location || 'Main Store',
      availableQty: stock,
      quantity: initQty,
      price: sellingPrice,
      rate: '0',
      itemCost: costDisplay,
      lastGrn: grnNum,
      lastGrnDate: grnDate,
      lastGrnFormatted: lastGrnFormatted,
      roundOffOption: roundOpt,
      roundOffStep: roundStp,
      discountPercentage: comp.discountPercentage,
      discountAmount: comp.discountAmount,
      finalPrice: comp.finalPrice,
      masterPack: match?.masterPack || '1',
      rateType: 'Retail',
      mpCost: match?.averageCost || 0,
      value: comp.finalPrice,
      balance: stock,
      total: comp.finalPrice,
      note: '',
    });

    fetchAlternativeProducts(alt.code);
  };

  // Add or Update Line Item in Table
  const handleAddOrUpdateItem = () => {
    if (!itemEntry.code || itemEntry.code.trim() === '') {
      showNotification('Please enter or select an Item Code', 'error');
      itemCodeInputRef.current?.focus();
      return;
    }

    const saleQty = parseFloat(itemEntry.quantity);
    if (isNaN(saleQty) || saleQty <= 0) {
      showNotification('Please enter a valid purchase quantity greater than 0', 'error');
      return;
    }

    const avail = parseFloat(itemEntry.availableQty);
    if (!isNaN(avail) && avail > 0 && saleQty > avail) {
      showNotification(`Requested purchase quantity (${saleQty}) cannot exceed available stock (${avail})`, 'error');
      return;
    }

    const price = parseFloat(itemEntry.price) || 0;
    const discPct = parseFloat(itemEntry.discountPercentage) || 0;
    const discAmt = parseFloat(itemEntry.discountAmount) || 0;
    const finalPrice = parseFloat(itemEntry.value !== undefined ? itemEntry.value : itemEntry.finalPrice) || Math.max(0, (price * saleQty) - discAmt);

    // Requirement 5: Bottom Invoice Grid uses actual selected item and the user's sale quantity
    const newLineItem = {
      code: itemEntry.code.trim().toUpperCase(),
      description: itemEntry.description || '',
      location: itemEntry.location || 'Main Store',
      availableQty: itemEntry.availableQty !== '' ? itemEntry.availableQty : avail,
      quantity: saleQty, // user's sale quantity!
      sellingPrice: price,
      price: price,
      rate: itemEntry.rate || '0',
      discountPercentage: discPct,
      discountAmount: discAmt,
      discount: discPct > 0 ? `${discPct}%` : (discAmt > 0 ? discAmt.toFixed(2) : '0'),
      value: finalPrice,
      finalPrice: finalPrice,
      itemCost: itemEntry.itemCost || '-',
      lastGrn: itemEntry.lastGrn || '',
      lastGrnDate: itemEntry.lastGrnDate || '',
      note: itemEntry.note || '',
    };

    if (selectedLineIndex >= 0) {
      const updated = [...lineItems];
      updated[selectedLineIndex] = newLineItem;
      setLineItems(updated);
      setSelectedLineIndex(-1);
      showNotification(`Updated item ${newLineItem.code}`);
    } else {
      setLineItems([...lineItems, newLineItem]);
      showNotification(`Added item ${newLineItem.code} to invoice`);
    }

    // Reset item entry row
    setItemEntry({
      code: '',
      description: '',
      location: 'Main Store',
      availableQty: '',
      quantity: '1',
      rate: '0',
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
      balance: '',
      total: '0.00',
      note: '',
    });
    setAlternativeProducts([]);
    itemCodeInputRef.current?.focus();
  };

  // Click row in table to load back into item entry
  const handleRowClick = (index) => {
    setSelectedLineIndex(index);
    const item = lineItems[index];
    if (item) {
      setItemEntry({
        code: item.code,
        description: item.description,
        location: item.location || 'Main Store',
        availableQty: item.availableQty !== undefined ? item.availableQty : '',
        quantity: String(item.quantity),
        rate: item.rate || '0',
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
        balance: item.availableQty || '',
        total: Number(item.value !== undefined ? item.value : item.finalPrice).toFixed(2),
        note: item.note || '',
      });
      fetchAlternativeProducts(item.code);
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
        'Invoice contains unsaved items. Would you like to discard them and create a New invoice?'
      );
      if (!confirmClear) return;
    }

    setActiveInvoiceId(null);
    setLineItems([]);
    setSelectedLineIndex(-1);
    setAlternativeProducts([]);
    setCustomerDue('0.00');
    setItemEntry({
      code: '',
      description: '',
      location: 'Main Store',
      availableQty: '',
      quantity: '1',
      rate: '0',
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
      balance: '',
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
      const nextNumRes = await api.get('/invoices/next-number');
      if (nextNumRes?.data?.data) {
        const rawNum = nextNumRes.data.data.invoiceNumber || nextNumRes.data.data.no;
        const formattedNum = String(rawNum).startsWith('INV-')
          ? String(rawNum)
          : `INV-${String(rawNum).padStart(6, '0')}`;
        setInvoiceHeader({
          no: nextNumRes.data.data.no,
          invoiceNumber: formattedNum,
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
        });
      }
    } catch (e) {
      setInvoiceHeader({
        no: '',
        invoiceNumber: 'INV-000123',
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
      });
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

  // BUTTON: CALCULATE DISCOUNT
  const handleCalculateDiscount = () => {
    if (lineItems.length === 0) {
      showNotification('No items in invoice to calculate discount', 'info');
      return;
    }
    const updated = lineItems.map((item) => {
      const comp = computeLinePricing(
        item.price,
        item.quantity,
        item.discountPercentage,
        item.discountAmount,
        'percentage'
      );
      return {
        ...item,
        discountPercentage: parseFloat(comp.discountPercentage) || 0,
        discountAmount: parseFloat(comp.discountAmount) || 0,
        finalPrice: parseFloat(comp.finalPrice) || 0,
        value: parseFloat(comp.finalPrice) || 0,
        total: parseFloat(comp.finalPrice) || 0,
      };
    });
    setLineItems(updated);
    showNotification('Discounts and final prices calculated', 'success');
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
    if (lineItems.length === 0) {
      showNotification('Please add at least one item to the invoice', 'error');
      return;
    }

    const isHoldVal = forceHold || invoiceHeader.isHold;

    const payload = {
      no: invoiceHeader.no,
      invoiceNumber: invoiceHeader.invoiceNumber,
      date: invoiceHeader.date,
      customerCode: invoiceHeader.customerCode,
      customerName: invoiceHeader.customerName,
      customerAddress: invoiceHeader.customerAddress,
      customerTelephone: invoiceHeader.customerTelephone,
      jobType: invoiceHeader.jobType,
      jd: invoiceHeader.jd,
      isHold: isHoldVal,
      status: isHoldVal ? 'hold' : 'completed',
      remark: invoiceHeader.remark,
      lineItems: lineItems.map((li) => ({
        code: li.code,
        itemCode: li.code,
        description: li.description,
        location: li.location,
        quantity: li.quantity,
        qty: li.quantity,
        masterPack: li.masterPack,
        rateType: li.rateType,
        price: li.price,
        unitPrice: li.price,
        itemCost: li.itemCost,
        mpCost: li.mpCost,
        discountPercentage: li.discountPercentage,
        discountAmount: li.discountAmount,
        finalPrice: li.finalPrice !== undefined ? li.finalPrice : li.value,
        availableQty: li.availableQty !== undefined ? li.availableQty : li.balance,
        lastGrn: li.lastGrn || '',
        lastGrnDate: li.lastGrnDate || '',
        value: li.value,
        total: li.total || li.value,
        balance: li.balance,
      })),
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
        res = await api.put(`/invoices/${activeInvoiceId}`, payload);
      } else {
        res = await api.post('/invoices', payload);
      }

      if (res.data && res.data.success) {
        showNotification(
          `Invoice '${res.data.data?.invoiceNumber || invoiceHeader.invoiceNumber}' ${isHoldVal ? 'saved on HOLD' : 'completed & stock updated'} successfully!`,
          'success'
        );

        // Refresh and prepare next invoice
        const [nextNumRes, invsRes] = await Promise.all([
          api.get('/invoices/next-number').catch(() => null),
          api.get('/invoices?limit=50').catch(() => null),
        ]);
        if (invsRes?.data?.data) setInvoicesList(invsRes.data.data);
        if (nextNumRes?.data?.data) {
          setActiveInvoiceId(null);
          setLineItems([]);
          setInvoiceHeader({
            no: nextNumRes.data.data.no,
            invoiceNumber: nextNumRes.data.data.invoiceNumber,
            date: new Date().toISOString().split('T')[0],
            customerCode: '',
            customerName: '',
            customerAddress: '',
            customerTelephone: '',
            jd: 'Invoice',
            isHold: false,
            jobType: 'Material',
            remark: '',
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
        }
        return res.data?.data || { invoiceNumber: invoiceHeader.invoiceNumber };
      }
      return null;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save Invoice';
      showNotification(msg, 'error');
      return null;
    } finally {
      setLoading(false);
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
        `Are you sure you want to delete / cancel Invoice '${invoiceHeader.invoiceNumber}'? This will restore any deducted stock and update customer outstanding balance!`
      );
      if (!confirmDel) return;

      try {
        setLoading(true);
        const res = await api.delete(`/invoices/${activeInvoiceId}`);
        if (res.data && res.data.success) {
          showNotification(res.data.message || `Invoice '${invoiceHeader.invoiceNumber}' cancelled and stock restored`, 'success');
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
    if (selectedLineIndex >= 0) {
      const itemToDelete = lineItems[selectedLineIndex];
      const confirmItem = window.confirm(
        `Remove item '${itemToDelete?.code || 'selected'}' from the invoice?`
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
    if (activeInvoiceId) {
      handlePrint();
      return;
    }

    if (lineItems.length > 0) {
      const confirmSave = window.confirm(
        'Invoice contains unsaved items. Invoices must be saved before printing a finalized bill. Would you like to save now?'
      );
      if (confirmSave) {
        const saved = await handleSaveInvoice(false);
        if (saved) {
          handlePrint();
        }
      }
      return;
    }

    showNotification('Please select or create an invoice before printing', 'error');
  };

  // Print Invoice (Thermal Receipt)
  const handlePrint = () => {
    if (lineItems.length === 0) {
      showNotification('Please add items or select an invoice first before printing', 'error');
      return;
    }
    requestAnimationFrame(() => {
      setTimeout(() => {
        window.print();
      }, 50);
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
        setInvoiceHeader((prev) => ({
          ...prev,
          jobType: prev.jobType === 'Material' ? 'Labour' : 'Material',
        }));
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
  }, [lineItems, invoiceHeader, activeInvoiceId, payment]);

  // Filtered items for quick dropdown list (Code field)
  const filteredDropdownItems = useMemo(() => {
    const q = String(itemEntry.code || '').trim().toLowerCase();
    if (!q) return itemsList;
    return itemsList.filter(
      (i) =>
        i.code?.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q) ||
        (i.barcode && String(i.barcode).toLowerCase().includes(q)) ||
        (i.barCode && String(i.barCode).toLowerCase().includes(q))
    );
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
    const q = lookupModal.search.toLowerCase().trim();
    if (!q) return itemsList;
    return itemsList.filter(
      (i) =>
        i.code?.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q) ||
        (i.barcode && String(i.barcode).toLowerCase().includes(q)) ||
        (i.barCode && String(i.barCode).toLowerCase().includes(q))
    );
  }, [itemsList, lookupModal.search]);

  const totalLookupPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE) || 1;
  const pagedItems = useMemo(() => {
    const start = (lookupPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, lookupPage]);

  // Reusable Compact Thermal Receipt component for both Print and Preview
  const renderThermalReceiptContent = () => {
    const grossTotal = lineItems.reduce(
      (acc, item) => acc + ((parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 1)),
      0
    );
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
              lineItems.map((item, idx) => (
                <tr key={idx} className="thermal-tr-item">
                  <td className="thermal-td-item" style={{ textAlign: 'left', wordBreak: 'break-word' }}>
                    {item.code ? `${item.code} - ` : ''}{item.description || ''}
                  </td>
                  <td className="thermal-td-qtyrate" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {Number(item.quantity || 1).toFixed(2)} x {Number(item.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="thermal-td-amount" style={{ textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                    {Number(item.value || (item.price * item.quantity) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="thermal-receipt-dashed"></div>

        {/* Totals Section */}
        <div className="thermal-receipt-totals">
          <div className="thermal-receipt-total-row thermal-receipt-total-main">
            <span>Amount to Be Paid:</span>
            <span>
              {amountToPay.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="thermal-receipt-total-row">
            <span>Total Discount:</span>
            <span>
              {calculatedDiscount.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
          <div className="thermal-receipt-total-row">
            <span>Amount Received:</span>
            <span style={{ fontWeight: 'bold' }}>
              {amountReceivedVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="thermal-receipt-total-row">
            <span>Balance:</span>
            <span style={{ fontWeight: 'bold' }}>
              {dueAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

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
      <nav className="invoice-menubar-container" ref={menuRef}>
        <ul className="invoice-menubar">
          {topMenuItems.map((item) => (
            <li key={item.id} className="invoice-menubar-item">
              <button
                type="button"
                className={`invoice-menubar-button ${
                  (item.id === 'sales-service' && activeDropdown === 'sales-service') ||
                  (item.id === 'sales-service') ||
                  (activeDropdown === item.id)
                    ? 'active'
                    : ''
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
                <ul className="invoice-dropdown-menu">
                  {masterFilesDropdownItems.map((dropItem) => (
                    <li key={dropItem.id} className="invoice-dropdown-entry">
                      <button
                        type="button"
                        className="invoice-dropdown-item-btn"
                        onClick={() => {
                          setActiveDropdown(null);
                          navigate(dropItem.path);
                        }}
                      >
                        {dropItem.renderIcon()}
                        <span>{dropItem.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Stock Control System Dropdown */}
              {item.id === 'stock-control' && activeDropdown === 'stock-control' && (
                <ul className="invoice-dropdown-menu">
                  {stockControlDropdownItems.map((dropItem) => (
                    <li key={dropItem.id} className="invoice-dropdown-entry">
                      <button
                        type="button"
                        className="invoice-dropdown-item-btn"
                        onClick={() => {
                          setActiveDropdown(null);
                          navigate(dropItem.path);
                        }}
                      >
                        {dropItem.renderIcon()}
                        <span>{dropItem.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Sales and Service Dropdown */}
              {item.id === 'sales-service' && activeDropdown === 'sales-service' && (
                <ul className="invoice-dropdown-menu">
                  {salesServiceDropdownItems.map((dropItem) => (
                    <li key={dropItem.id} className="invoice-dropdown-entry">
                      <button
                        type="button"
                        className="invoice-dropdown-item-btn selected"
                        onClick={() => {
                          setActiveDropdown(null);
                          navigate(dropItem.path);
                        }}
                      >
                        {dropItem.renderIcon()}
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
                        onChange={(e) => setInvoiceHeader({ ...invoiceHeader, jobType: e.target.value })}
                      />
                      Material
                    </label>
                    <label className="sofast-radio-label">
                      <input
                        type="radio"
                        name="jobType"
                        value="Labour"
                        checked={invoiceHeader.jobType === 'Labour'}
                        onChange={(e) => setInvoiceHeader({ ...invoiceHeader, jobType: e.target.value })}
                      />
                      Labour
                    </label>
                    <label className="sofast-radio-label">
                      <input
                        type="radio"
                        name="jobType"
                        value="Group"
                        checked={invoiceHeader.jobType === 'Group'}
                        onChange={(e) => setInvoiceHeader({ ...invoiceHeader, jobType: e.target.value })}
                      />
                      Group
                    </label>
                    <label className="sofast-radio-label">
                      <input
                        type="radio"
                        name="jobType"
                        value="J.G."
                        checked={invoiceHeader.jobType === 'J.G.'}
                        onChange={(e) => setInvoiceHeader({ ...invoiceHeader, jobType: e.target.value })}
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

                {/* Form Row 1: Code - Material & GRN */}
                <div className="sofast-form-row">
                  <span className="sofast-navy-label" style={{ width: '95px' }}>Code - Material</span>
                  <input
                    ref={itemCodeInputRef}
                    type="text"
                    name="code"
                    className="sofast-input code-olive-input"
                    style={{ width: '210px', marginRight: '8px' }}
                    value={itemEntry.code}
                    onChange={handleItemEntryChange}
                    onKeyDown={handleCodeKeyDown}
                    placeholder="Search by Item Code / Name"
                  />
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
                      itemEntry.code
                        ? (alternativeProducts.length > 0
                            ? `${alternativeProducts.length} Alternative(s) Available`
                            : 'No Product Available')
                        : ''
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
                    onClick={() => {
                      const noteText = prompt('Add a Note for this line item:', itemEntry.note || '');
                      if (noteText !== null) {
                        setItemEntry((prev) => ({ ...prev, note: noteText }));
                      }
                    }}
                  >
                    Add a Note
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

                {/* Form Row 6: Value, Location, Available Stock */}
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
                      value={itemEntry.location || 'Main Store'}
                      onChange={(e) => setItemEntry({ ...itemEntry, location: e.target.value })}
                    >
                      <option value="Main Store">Main Store</option>
                      <option value="Front Shop">Front Shop</option>
                      <option value="Rack B">Rack B</option>
                      <option value="Warehouse">Warehouse</option>
                    </select>
                  </div>
                  <span className="sofast-navy-label" style={{ width: '45px' }}>Stock . .</span>
                  <input
                    type="text"
                    className="sofast-input"
                    style={{ width: '95px', backgroundColor: '#f0f0f0', fontWeight: 'bold', textAlign: 'center' }}
                    readOnly
                    value={itemEntry.availableQty !== '' && itemEntry.availableQty !== undefined && itemEntry.availableQty !== null ? itemEntry.availableQty : ''}
                    title="Available Stock in Inventory"
                  />
                </div>
              </div>
            </div>

            {/* Right Side: Single Tall Catalog Items Table */}
            <div className="sofast-right-tables-col">
              <div className="sofast-table-panel sofast-tall-table-panel">
                <div className="sofast-table-scroll-container">
                  <table className="sofast-classic-table">
                    <thead>
                      <tr>
                        <th style={{ width: '110px' }}>Code</th>
                        <th>
                          Description
                          {itemEntry.code && (
                            <span style={{ fontSize: '10px', color: '#000080', marginLeft: '6px', fontWeight: 'normal' }}>
                              ({filteredDropdownItems.length} found)
                            </span>
                          )}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDropdownItems.length === 0 ? (
                        <tr>
                          <td colSpan="2" style={{ padding: '8px', color: '#888', fontStyle: 'italic', textAlign: 'center' }}>
                            No items matching "{itemEntry.code}"
                          </td>
                        </tr>
                      ) : (
                        filteredDropdownItems.map((item) => {
                          const isSelected = itemEntry.code && item.code?.toLowerCase() === itemEntry.code.toLowerCase();
                          return (
                            <tr
                              key={item._id || item.code}
                              className={isSelected ? 'selected-row' : ''}
                              onClick={() => handleSelectItemFromLookup(item)}
                              title="Click to select this product"
                            >
                              <td className="sofast-cell-code">{item.code}</td>
                              <td className="sofast-cell-desc">{item.description}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
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
                  Array.from({ length: 12 }).map((_, emptyIdx) => (
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
                {lineItems.length > 0 && Array.from({ length: Math.max(0, 10 - lineItems.length) }).map((_, emptyIdx) => (
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

      {/* DEDICATED PRINT AREA FOR 80MM/58MM THERMAL RECEIPT */}
      <div id="thermal-receipt-print-area">
        {renderThermalReceiptContent()}
      </div>
    </div>
  );
}

export default Invoice;
