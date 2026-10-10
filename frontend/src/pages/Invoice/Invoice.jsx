import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './Invoice.css';

/**
 * Sales Invoice Module
 * Recreates the exact Visual Basic / Classic ERP layout and workflow from legacy SOFAST
 */
function Invoice() {
  const navigate = useNavigate();

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

  // Multiple Invoice Items
  const [lineItems, setLineItems] = useState([]);
  const [selectedLineIndex, setSelectedLineIndex] = useState(-1);

  // Current Item Entry Draft
  const [itemEntry, setItemEntry] = useState({
    code: '',
    description: '',
    location: 'Main Store',
    quantity: '1',
    masterPack: '1',
    rateType: 'Retail',
    price: '',
    itemCost: '',
    mpCost: '',
    discountPercentage: '',
    discountAmount: '',
    value: '0.00',
    balance: '',
    total: '0.00',
  });

  // Payment Details State
  const [payment, setPayment] = useState({
    specialDiscount: '0.00',
    amountReceived: '',
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

  // Receipt Preview Modal
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // Ref for Code Input focus
  const itemCodeInputRef = useRef(null);

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
      label: 'Good Receive Note',
      path: '/grn',
      renderIcon: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
  ];

  // Fetch initial data (Next Invoice Number, Customers, Items, Invoices)
  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [nextNumRes, custRes, itemsRes, invsRes] = await Promise.all([
        api.get('/invoices/next-number').catch(() => null),
        api.get('/customers').catch(() => null),
        api.get('/items?limit=1000').catch(() => null),
        api.get('/invoices?limit=50').catch(() => null),
      ]);

      if (nextNumRes?.data?.data) {
        setInvoiceHeader((prev) => ({
          ...prev,
          no: nextNumRes.data.data.no,
          invoiceNumber: nextNumRes.data.data.invoiceNumber,
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
    }, 4000);
  };

  // Helper: compute line item pricing with discount
  const computeLinePricing = (priceVal, qtyVal, discPctVal, discAmtVal, source = 'percentage') => {
    const price = parseFloat(priceVal) || 0;
    const qty = Math.max(0.01, parseFloat(qtyVal) || 1);
    let discPct = parseFloat(discPctVal) || 0;
    let discAmt = parseFloat(discAmtVal) || 0;

    const gross = price * qty;

    if (source === 'amount') {
      discPct = gross > 0 ? (discAmt / gross) * 100 : 0;
    } else {
      discAmt = (gross * discPct) / 100;
    }

    const netValue = Math.max(0, gross - discAmt);

    return {
      price: priceVal,
      quantity: qtyVal,
      discountPercentage: discPct ? (source === 'amount' ? Math.round(discPct * 100) / 100 : discPctVal) : (discPctVal !== '' ? discPctVal : ''),
      discountAmount: discAmt ? (source === 'percentage' ? Math.round(discAmt * 100) / 100 : discAmtVal) : (discAmtVal !== '' ? discAmtVal : ''),
      value: netValue.toFixed(2),
      total: netValue.toFixed(2),
    };
  };

  // Grand Total of Invoice Items
  const invoiceSubTotal = lineItems.reduce((acc, item) => acc + (parseFloat(item.value) || 0), 0);
  const specialDiscVal = parseFloat(payment.specialDiscount) || 0;
  const amountToPay = Math.max(0, invoiceSubTotal - specialDiscVal);
  const amountReceivedVal = payment.amountReceived !== '' ? parseFloat(payment.amountReceived) || 0 : amountToPay;
  const dueAmount = Math.max(0, amountToPay - amountReceivedVal);

  // Handle Customer Selection / Changes
  const handleCustomerChange = (e) => {
    const { name, value } = e.target;
    const trimmed = String(value || '').trim();

    if (name === 'customerCode') {
      setInvoiceHeader((prev) => ({ ...prev, customerCode: value }));
      if (!trimmed) {
        setInvoiceHeader((prev) => ({ ...prev, customerCode: '', customerName: '', customerAddress: '', customerTelephone: '' }));
        return;
      }
      // Match customer
      let match = customersList.find(
        (c) => c.code?.toLowerCase() === trimmed.toLowerCase() || c.customerCode?.toLowerCase() === trimmed.toLowerCase()
      );
      if (!match && trimmed.includes(' - ')) {
        const codePart = trimmed.split(' - ')[0].trim();
        match = customersList.find((c) => c.code?.toLowerCase() === codePart.toLowerCase());
      }
      if (!match) {
        match = customersList.find((c) => c.name?.toLowerCase() === trimmed.toLowerCase());
      }
      if (match) {
        setInvoiceHeader((prev) => ({
          ...prev,
          customerCode: match.code || match.customerCode || '',
          customerName: match.name || '',
          customerAddress: match.address || '',
          customerTelephone: match.telephone1 || match.telephone || '',
        }));
      }
    } else if (name === 'customerName') {
      setInvoiceHeader((prev) => ({ ...prev, customerName: value }));
      const match = customersList.find((c) => c.name?.toLowerCase() === trimmed.toLowerCase());
      if (match) {
        setInvoiceHeader((prev) => ({
          ...prev,
          customerCode: match.code || match.customerCode || '',
          customerName: match.name || '',
          customerAddress: match.address || '',
          customerTelephone: match.telephone1 || match.telephone || '',
        }));
      }
    } else {
      setInvoiceHeader((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Select Customer from Lookup Modal
  const handleSelectCustomerFromLookup = (cust) => {
    setInvoiceHeader((prev) => ({
      ...prev,
      customerCode: cust.code || cust.customerCode || '',
      customerName: cust.name || '',
      customerAddress: cust.address || '',
      customerTelephone: cust.telephone1 || cust.telephone || '',
    }));
    setLookupModal({ isOpen: false, type: null, title: '', search: '' });
  };

  // Select Item from Lookup Modal
  const handleSelectItemFromLookup = (item) => {
    const sp = item.finalSellingPrice || item.sellingPrice || 0;
    const discPct = item.discountPercentage || 0;
    const discAmt = item.discountAmount || 0;
    const comp = computeLinePricing(sp, 1, discPct, discAmt, 'percentage');

    setItemEntry({
      code: item.code || '',
      description: item.description || '',
      location: item.location || 'Main Store',
      quantity: '1',
      masterPack: item.masterPack || '1',
      rateType: 'Retail',
      price: sp,
      itemCost: item.lastGrnPrice || item.averageCost || 0,
      mpCost: item.averageCost || item.lastGrnPrice || 0,
      discountPercentage: comp.discountPercentage,
      discountAmount: comp.discountAmount,
      value: comp.value,
      balance: item.quantity !== undefined ? item.quantity : (item.stockInHand || 0),
      total: comp.total,
    });
    setLookupModal({ isOpen: false, type: null, title: '', search: '' });
  };

  // Handle Item Entry Changes
  const handleItemEntryChange = (e) => {
    const { name, value } = e.target;
    let updated = { ...itemEntry, [name]: value };

    // Auto-match Item by Code
    if (name === 'code') {
      const trimmed = String(value || '').trim().toLowerCase();
      const match = itemsList.find((i) => i.code?.toLowerCase() === trimmed);
      if (match) {
        const sp = match.finalSellingPrice || match.sellingPrice || 0;
        const discPct = match.discountPercentage || 0;
        const discAmt = match.discountAmount || 0;
        const comp = computeLinePricing(sp, updated.quantity || 1, discPct, discAmt, 'percentage');

        updated.description = match.description || '';
        updated.location = match.location || 'Main Store';
        updated.masterPack = match.masterPack || '1';
        updated.price = sp;
        updated.itemCost = match.lastGrnPrice || match.averageCost || 0;
        updated.mpCost = match.averageCost || match.lastGrnPrice || 0;
        updated.discountPercentage = comp.discountPercentage;
        updated.discountAmount = comp.discountAmount;
        updated.value = comp.value;
        updated.total = comp.total;
        updated.balance = match.quantity !== undefined ? match.quantity : (match.stockInHand || 0);
      }
    }

    if (name === 'price' || name === 'quantity' || name === 'discountPercentage') {
      const comp = computeLinePricing(
        name === 'price' ? value : updated.price,
        name === 'quantity' ? value : updated.quantity,
        name === 'discountPercentage' ? value : updated.discountPercentage,
        updated.discountAmount,
        'percentage'
      );
      updated.discountPercentage = comp.discountPercentage;
      updated.discountAmount = comp.discountAmount;
      updated.value = comp.value;
      updated.total = comp.total;
    } else if (name === 'discountAmount') {
      const comp = computeLinePricing(
        updated.price,
        updated.quantity,
        updated.discountPercentage,
        value,
        'amount'
      );
      updated.discountPercentage = comp.discountPercentage;
      updated.discountAmount = comp.discountAmount;
      updated.value = comp.value;
      updated.total = comp.total;
    }

    setItemEntry(updated);
  };

  // Add or Update Line Item in Table
  const handleSaveLineItem = () => {
    if (!itemEntry.code || itemEntry.code.trim() === '') {
      showNotification('Please enter or select an Item Code', 'error');
      itemCodeInputRef.current?.focus();
      return;
    }

    const qty = parseFloat(itemEntry.quantity);
    if (isNaN(qty) || qty <= 0) {
      showNotification('Please enter a valid Quantity (> 0)', 'error');
      return;
    }

    const price = parseFloat(itemEntry.price) || 0;
    const discPct = parseFloat(itemEntry.discountPercentage) || 0;
    const discAmt = parseFloat(itemEntry.discountAmount) || 0;
    const val = parseFloat(itemEntry.value) || 0;

    const newLineItem = {
      code: itemEntry.code.trim(),
      description: itemEntry.description || '',
      location: itemEntry.location || 'Main Store',
      quantity: qty,
      masterPack: itemEntry.masterPack || '1',
      rateType: itemEntry.rateType || 'Retail',
      price,
      itemCost: parseFloat(itemEntry.itemCost) || 0,
      mpCost: parseFloat(itemEntry.mpCost) || 0,
      discountPercentage: discPct,
      discountAmount: discAmt,
      value: val,
      balance: parseFloat(itemEntry.balance) || 0,
      total: val,
    };

    if (selectedLineIndex >= 0) {
      const updated = [...lineItems];
      updated[selectedLineIndex] = newLineItem;
      setLineItems(updated);
      setSelectedLineIndex(-1);
      showNotification('Updated item in invoice table', 'info');
    } else {
      const existingIdx = lineItems.findIndex(
        (li) => li.code.toLowerCase() === newLineItem.code.toLowerCase()
      );
      if (existingIdx >= 0) {
        const updated = [...lineItems];
        updated[existingIdx].quantity += newLineItem.quantity;
        const comp = computeLinePricing(
          updated[existingIdx].price,
          updated[existingIdx].quantity,
          updated[existingIdx].discountPercentage,
          0,
          'percentage'
        );
        updated[existingIdx].discountAmount = parseFloat(comp.discountAmount) || 0;
        updated[existingIdx].value = parseFloat(comp.value) || 0;
        updated[existingIdx].total = parseFloat(comp.total) || 0;
        setLineItems(updated);
        showNotification(`Incremented quantity for '${newLineItem.code}'`, 'info');
      } else {
        setLineItems([...lineItems, newLineItem]);
      }
    }

    // Reset item entry row
    setItemEntry({
      code: '',
      description: '',
      location: 'Main Store',
      quantity: '1',
      masterPack: '1',
      rateType: 'Retail',
      price: '',
      itemCost: '',
      mpCost: '',
      discountPercentage: '',
      discountAmount: '',
      value: '0.00',
      balance: '',
      total: '0.00',
    });

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
        quantity: String(item.quantity),
        masterPack: String(item.masterPack || '1'),
        rateType: item.rateType || 'Retail',
        price: item.price,
        itemCost: item.itemCost || '',
        mpCost: item.mpCost || '',
        discountPercentage: item.discountPercentage || '',
        discountAmount: item.discountAmount || '',
        value: Number(item.value).toFixed(2),
        balance: item.balance || '',
        total: Number(item.total || item.value).toFixed(2),
      });
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

  // BUTTON: NEW
  const handleNew = async () => {
    setActiveInvoiceId(null);
    setLineItems([]);
    setSelectedLineIndex(-1);
    setItemEntry({
      code: '',
      description: '',
      location: 'Main Store',
      quantity: '1',
      masterPack: '1',
      rateType: 'Retail',
      price: '',
      itemCost: '',
      mpCost: '',
      discountPercentage: '',
      discountAmount: '',
      value: '0.00',
      balance: '',
      total: '0.00',
    });
    setPayment({
      specialDiscount: '0.00',
      amountReceived: '',
      chequeNo: '',
      bank: '',
      dateRealized: '',
    });

    try {
      const nextNumRes = await api.get('/invoices/next-number');
      if (nextNumRes?.data?.data) {
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
      }
    } catch (e) {
      setInvoiceHeader({
        no: '',
        invoiceNumber: '2001',
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
    }

    showNotification('Initialized new Sales Invoice', 'info');
  };

  // BUTTON: CALCULATE DISCOUNT
  const handleCalculateDiscount = () => {
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
        discountPercentage: comp.discountPercentage,
        discountAmount: comp.discountAmount,
        value: parseFloat(comp.value) || 0,
        total: parseFloat(comp.total) || 0,
      };
    });
    setLineItems(updated);
    showNotification('Discounts and totals recalculated', 'success');
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
        value: li.value,
        total: li.total || li.value,
        balance: li.balance,
      })),
      subTotal: invoiceSubTotal,
      specialDiscount: specialDiscVal,
      amountToPay: amountToPay,
      amountReceived: payment.amountReceived !== '' ? parseFloat(payment.amountReceived) || 0 : amountToPay,
      chequeNo: payment.chequeNo,
      bank: payment.bank,
      dateRealized: payment.dateRealized,
      dueAmount: dueAmount,
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
            specialDiscount: '0.00',
            amountReceived: '',
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
    if (!activeInvoiceId) {
      if (selectedLineIndex >= 0) {
        handleRemoveLineItem(selectedLineIndex);
        showNotification('Removed selected item from invoice', 'info');
      } else {
        showNotification('No saved invoice or line item selected to delete', 'info');
      }
      return;
    }

    const confirmDel = window.confirm(
      `Are you sure you want to delete Invoice '${invoiceHeader.invoiceNumber}'? This will restore any deducted stock!`
    );
    if (!confirmDel) return;

    try {
      setLoading(true);
      const res = await api.delete(`/invoices/${activeInvoiceId}`);
      if (res.data && res.data.success) {
        showNotification(`Invoice '${invoiceHeader.invoiceNumber}' deleted and stock restored`, 'success');
        handleNew();
      }
    } catch (err) {
      showNotification('Failed to delete invoice', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Print Invoice (Thermal Receipt)
  const handlePrint = () => {
    if (!invoiceHeader.invoiceNumber && lineItems.length === 0) {
      showNotification('Please add items or select an invoice first before printing', 'error');
      return;
    }
    requestAnimationFrame(() => {
      setTimeout(() => {
        window.print();
      }, 50);
    });
  };

  // Filtered customers / items for lookup modal
  const filteredCustomers = customersList.filter((c) => {
    const q = lookupModal.search.toLowerCase().trim();
    if (!q) return true;
    return (
      c.code?.toLowerCase().includes(q) ||
      c.customerCode?.toLowerCase().includes(q) ||
      c.name?.toLowerCase().includes(q) ||
      c.telephone?.toLowerCase().includes(q) ||
      c.address?.toLowerCase().includes(q) ||
      c.vehicleNo?.toLowerCase().includes(q)
    );
  });

  const filteredItems = itemsList.filter((i) => {
    const q = lookupModal.search.toLowerCase().trim();
    if (!q) return true;
    return (
      i.code?.toLowerCase().includes(q) ||
      i.description?.toLowerCase().includes(q) ||
      i.category?.toLowerCase().includes(q)
    );
  });

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
              <th style={{ textAlign: 'left' }}>Item</th>
              <th style={{ textAlign: 'right', width: '38%' }}>Qty x Rate</th>
              <th style={{ textAlign: 'right', width: '26%' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.length === 0 ? (
              <tr>
                <td colSpan="3" style={{ textAlign: 'center', color: '#555', fontStyle: 'italic', padding: '1px 0' }}>
                  No line items
                </td>
              </tr>
            ) : (
              lineItems.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ textAlign: 'left', wordBreak: 'break-word' }}>
                    {item.code ? `${item.code} - ` : ''}{item.description || ''}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {Number(item.quantity || 1).toFixed(2)} x {Number(item.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
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
          <div className="thermal-receipt-total-row">
            <span>Amount to Be Paid:</span>
            <span style={{ fontWeight: 'bold' }}>
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
        )}

        <div className="invoice-panel-container">
          {/* 1. Top Customer & Invoice Information Section */}
          <div className="invoice-customer-section">
            {/* Customer block (Left) */}
            <div className="customer-left-box">
              <div className="customer-code-name-row">
                <span className="dotted-label-blue">Customer . . . .</span>
                <input
                  type="text"
                  name="customerCode"
                  list="invoice-customer-code-datalist"
                  className="invoice-input"
                  style={{ width: '110px' }}
                  placeholder="Code..."
                  value={invoiceHeader.customerCode}
                  onChange={handleCustomerChange}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="invoice-btn-lookup"
                  title="Search Customers"
                  onClick={() =>
                    setLookupModal({
                      isOpen: true,
                      type: 'customer',
                      title: 'Select Customer from Database',
                      search: '',
                    })
                  }
                >
                  ...
                </button>
                <input
                  type="text"
                  name="customerName"
                  list="invoice-customer-name-datalist"
                  className="invoice-input"
                  style={{ flex: 1, minWidth: '220px' }}
                  placeholder="Customer Name"
                  value={invoiceHeader.customerName}
                  onChange={handleCustomerChange}
                  autoComplete="off"
                />
                <datalist id="invoice-customer-code-datalist">
                  {customersList.map((c) => (
                    <option key={c._id || c.code} value={c.code || c.customerCode}>
                      {c.name}
                    </option>
                  ))}
                </datalist>
                <datalist id="invoice-customer-name-datalist">
                  {customersList.map((c) => (
                    <option key={c._id || c.code} value={c.name}>
                      {c.code || c.customerCode}
                    </option>
                  ))}
                </datalist>
              </div>

              {/* Address & Telephone Line (Aligned with Code input) */}
              <div className="customer-address-row">
                <input
                  type="text"
                  name="customerAddress"
                  className="invoice-input"
                  style={{ flex: 1, minWidth: '150px' }}
                  placeholder="Customer Address"
                  value={invoiceHeader.customerAddress}
                  onChange={(e) => setInvoiceHeader({ ...invoiceHeader, customerAddress: e.target.value })}
                />
                <span className="dotted-label-blue" style={{ width: 'auto', margin: '0 6px 0 10px' }}>Tel . .</span>
                <input
                  type="text"
                  name="customerTelephone"
                  className="invoice-input"
                  style={{ width: '135px' }}
                  placeholder="Telephone No."
                  value={invoiceHeader.customerTelephone}
                  onChange={(e) => setInvoiceHeader({ ...invoiceHeader, customerTelephone: e.target.value })}
                />
              </div>
            </div>

            {/* Header Right grid (Date, J/D, Invoice No, Hold) */}
            <div className="customer-right-box">
              <span className="dotted-label-blue">Date . . . . . .</span>
              <input
                type="date"
                name="date"
                className="invoice-input"
                style={{ width: '135px' }}
                value={invoiceHeader.date}
                onChange={(e) => setInvoiceHeader({ ...invoiceHeader, date: e.target.value })}
              />

              <span className="dotted-label-blue" style={{ marginLeft: '4px' }}>J/D . .</span>
              <select
                name="jd"
                className="invoice-select"
                style={{ width: '95px' }}
                value={invoiceHeader.jd}
                onChange={(e) => setInvoiceHeader({ ...invoiceHeader, jd: e.target.value })}
              >
                <option value="Invoice">Invoice</option>
                <option value="Job Order">Job Order</option>
                <option value="Draft">Draft</option>
              </select>

              <span className="dotted-label-blue">Invoice No .</span>
              <input
                type="text"
                className="invoice-input readonly"
                style={{ width: '135px', fontWeight: 'bold', color: '#000080' }}
                readOnly
                value={invoiceHeader.invoiceNumber || 'Auto'}
                title="Auto-generated sequential invoice number"
              />

              <span className="dotted-label-blue" style={{ marginLeft: '4px' }}>Hold . .</span>
              <select
                name="isHold"
                className="invoice-select"
                style={{ width: '95px' }}
                value={invoiceHeader.isHold ? 'Yes' : 'No'}
                onChange={(e) => setInvoiceHeader({ ...invoiceHeader, isHold: e.target.value === 'Yes' })}
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
          </div>

          {/* 2. Type of Job Section (Full Width Row) */}
          <div className="invoice-job-type">
            <span className="job-type-label">Type of Job:</span>
            <div className="job-type-radios">
              {['Material', 'Labour', 'Item Code', 'Bar Code'].map((t) => (
                <label key={t} className="job-radio-option">
                  <input
                    type="radio"
                    name="jobType"
                    value={t}
                    checked={invoiceHeader.jobType === t}
                    onChange={(e) => setInvoiceHeader({ ...invoiceHeader, jobType: e.target.value })}
                  />
                  <span>{t}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 3. Main Split Section (Item Entry Left | Payment Section Right) */}
          <div className="invoice-main">
            {/* Left: Item Entry Panel */}
            <div className="invoice-item-entry">
              {/* Code & Location */}
              <div className="item-code-location-row">
                <span className="dotted-label-blue">Code . . . . . .</span>
                <input
                  ref={itemCodeInputRef}
                  type="text"
                  name="code"
                  list="invoice-item-code-datalist"
                  className="invoice-input"
                  style={{ width: '140px' }}
                  placeholder="Code..."
                  value={itemEntry.code}
                  onChange={handleItemEntryChange}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="invoice-btn-lookup"
                  title="Search Items"
                  onClick={() =>
                    setLookupModal({
                      isOpen: true,
                      type: 'item',
                      title: 'Select Item from Item Master',
                      search: '',
                    })
                  }
                >
                  ...
                </button>

                <span className="dotted-label-blue" style={{ marginLeft: '12px' }}>Location .</span>
                <select
                  name="location"
                  className="invoice-select"
                  style={{ flex: 1, minWidth: '130px' }}
                  value={itemEntry.location}
                  onChange={handleItemEntryChange}
                >
                  <option value="Main Store">Main Store</option>
                  <option value="Store 2">Store 2</option>
                  <option value="Workshop">Workshop</option>
                </select>

                <datalist id="invoice-item-code-datalist">
                  {itemsList.map((i) => (
                    <option key={i._id || i.code} value={i.code}>
                      {i.description}
                    </option>
                  ))}
                </datalist>
              </div>

              {/* Description */}
              <div className="item-desc-row">
                <span className="dotted-label-blue">Description . . .</span>
                <input
                  type="text"
                  name="description"
                  className="invoice-input"
                  style={{ flex: 1 }}
                  placeholder="Item Description"
                  value={itemEntry.description}
                  onChange={handleItemEntryChange}
                />
              </div>

              {/* Two Column Entry Fields */}
              <div className="item-entry-grid-2col">
                {/* Column 1 */}
                <div className="item-entry-subcol">
                  <div className="form-field-row">
                    <span className="dotted-label-blue">Quantity . . . . .</span>
                    <input
                      type="number"
                      name="quantity"
                      className="invoice-input"
                      style={{ textAlign: 'center', fontWeight: 'bold' }}
                      value={itemEntry.quantity}
                      onChange={handleItemEntryChange}
                    />
                  </div>

                  <div className="form-field-row">
                    <span className="dotted-label-blue">Rate . . . . . . .</span>
                    <select
                      name="rateType"
                      className="invoice-select"
                      value={itemEntry.rateType}
                      onChange={handleItemEntryChange}
                    >
                      <option value="Retail">Retail</option>
                      <option value="Wholesale">Wholesale</option>
                    </select>
                  </div>

                  <div className="form-field-row">
                    <span className="dotted-label-blue">Discount % . . . .</span>
                    <input
                      type="number"
                      name="discountPercentage"
                      className="invoice-input"
                      style={{ textAlign: 'right' }}
                      placeholder="0"
                      value={itemEntry.discountPercentage}
                      onChange={handleItemEntryChange}
                    />
                  </div>

                  <div className="form-field-row">
                    <span className="dotted-label-blue">Discount (Rs) . . .</span>
                    <input
                      type="number"
                      name="discountAmount"
                      className="invoice-input"
                      style={{ textAlign: 'right' }}
                      placeholder="0.00"
                      value={itemEntry.discountAmount}
                      onChange={handleItemEntryChange}
                    />
                  </div>

                  <div className="form-field-row">
                    <span className="dotted-label-blue">Value . . . . . . .</span>
                    <input
                      type="text"
                      name="value"
                      className="invoice-input readonly"
                      style={{ textAlign: 'right', fontWeight: 'bold', color: '#000080' }}
                      readOnly
                      value={itemEntry.value}
                    />
                  </div>
                </div>

                {/* Column 2 */}
                <div className="item-entry-subcol">
                  <div className="form-field-row">
                    <span className="dotted-label-blue">Mas. Pack . . . .</span>
                    <input
                      type="text"
                      name="masterPack"
                      className="invoice-input"
                      style={{ textAlign: 'center' }}
                      value={itemEntry.masterPack}
                      onChange={handleItemEntryChange}
                    />
                  </div>

                  <div className="form-field-row">
                    <span className="dotted-label-blue">Price . . . . . . .</span>
                    <input
                      type="number"
                      name="price"
                      className="invoice-input"
                      style={{ textAlign: 'right', fontWeight: 'bold' }}
                      value={itemEntry.price}
                      onChange={handleItemEntryChange}
                    />
                  </div>

                  <div className="form-field-row">
                    <span className="dotted-label-blue">Item Cost . . . .</span>
                    <input
                      type="number"
                      name="itemCost"
                      className="invoice-input readonly"
                      style={{ textAlign: 'right' }}
                      readOnly
                      value={itemEntry.itemCost}
                    />
                  </div>

                  <div className="form-field-row">
                    <span className="dotted-label-blue">M/P Cost . . . . .</span>
                    <input
                      type="number"
                      name="mpCost"
                      className="invoice-input readonly"
                      style={{ textAlign: 'right' }}
                      readOnly
                      value={itemEntry.mpCost}
                    />
                  </div>

                  <div className="form-field-row">
                    <span className="dotted-label-blue">Balance . . . . .</span>
                    <input
                      type="text"
                      name="balance"
                      className="invoice-input readonly"
                      style={{ textAlign: 'center', fontWeight: 'bold', color: '#065f46', backgroundColor: '#f0fdf4' }}
                      readOnly
                      value={itemEntry.balance !== '' ? itemEntry.balance : '-'}
                      title="Available stock in inventory"
                    />
                  </div>
                </div>
              </div>

              {/* Save Button for Line Item */}
              <div className="item-save-btn-container">
                <button
                  type="button"
                  className="invoice-btn-classic"
                  style={{ width: '120px', height: '26px', fontWeight: 'bold' }}
                  onClick={handleSaveLineItem}
                >
                  {selectedLineIndex >= 0 ? 'Update Item' : 'Save'}
                </button>
              </div>
            </div>

            {/* Right: Actions & Payment Section */}
            <div className="invoice-payment">
              {/* 4 Action Buttons Grid */}
              <div className="payment-top-actions">
                <button
                  type="button"
                  className="invoice-btn-classic"
                  onClick={handleCreateInvoiceButtonClick}
                  title="Create Invoice / Open Settlement Invoice"
                >
                  Create<br />Invoice
                </button>
                <button
                  type="button"
                  className="invoice-btn-classic"
                  onClick={handleHoldInvoice}
                >
                  Hold<br />Invoice
                </button>
                <button
                  type="button"
                  className="invoice-btn-classic"
                  onClick={handleCalculateDiscount}
                >
                  Calculate<br />Discount
                </button>
                <button
                  type="button"
                  className="invoice-btn-classic"
                  onClick={handleNew}
                >
                  Blank<br />Invoice
                </button>
              </div>

              {/* Payment Fields List */}
              <div className="payment-fields-card">
                <div className="payment-field-row">
                  <span className="dotted-label-blue">Special Discount . . . . . . . .</span>
                  <input
                    type="number"
                    name="specialDiscount"
                    className="invoice-input"
                    style={{ textAlign: 'right' }}
                    value={payment.specialDiscount}
                    onChange={(e) => setPayment({ ...payment, specialDiscount: e.target.value })}
                  />
                </div>

                <div className="payment-field-row">
                  <span className="dotted-label-blue">Amount To Pay . . . . . . . . .</span>
                  <input
                    type="text"
                    className="invoice-input readonly"
                    style={{ textAlign: 'right', fontWeight: 'bold', color: '#000080' }}
                    readOnly
                    value={amountToPay.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  />
                </div>

                <div className="payment-field-row">
                  <span className="dotted-label-blue">Amount Received . . . . . . . .</span>
                  <input
                    type="number"
                    name="amountReceived"
                    className="invoice-input"
                    style={{ textAlign: 'right', fontWeight: 'bold' }}
                    placeholder={amountToPay.toFixed(2)}
                    value={payment.amountReceived}
                    onChange={(e) => setPayment({ ...payment, amountReceived: e.target.value })}
                  />
                </div>

                <div className="payment-field-row">
                  <span className="dotted-label-blue">Cheque No . . . . . . . . . . . .</span>
                  <input
                    type="text"
                    name="chequeNo"
                    className="invoice-input"
                    placeholder=""
                    value={payment.chequeNo}
                    onChange={(e) => setPayment({ ...payment, chequeNo: e.target.value })}
                  />
                </div>

                <div className="payment-field-row">
                  <span className="dotted-label-blue">Bank . . . . . . . . . . . . . . .</span>
                  <input
                    type="text"
                    name="bank"
                    className="invoice-input"
                    style={{ textAlign: 'center' }}
                    placeholder="[ActiveX]"
                    value={payment.bank}
                    onChange={(e) => setPayment({ ...payment, bank: e.target.value })}
                  />
                </div>

                <div className="payment-field-row">
                  <span className="dotted-label-blue">Date Realized . . . . . . . . . .</span>
                  <input
                    type="text"
                    name="dateRealized"
                    className="invoice-input"
                    style={{ textAlign: 'center' }}
                    placeholder="[ActiveX]"
                    value={payment.dateRealized}
                    onChange={(e) => setPayment({ ...payment, dateRealized: e.target.value })}
                  />
                </div>

                <div className="payment-field-row">
                  <span className="dotted-label-blue">Due Amount . . . . . . . . . . . .</span>
                  <input
                    type="text"
                    className="invoice-input readonly"
                    style={{
                      textAlign: 'right',
                      fontWeight: 'bold',
                      color: dueAmount > 0 ? '#991b1b' : '#065f46',
                      backgroundColor: dueAmount > 0 ? '#fee2e2' : '#f0fdf4',
                    }}
                    readOnly
                    value={dueAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 4. Remark Section (Full Width Below Item Entry + Payment) */}
          <div className="invoice-remark">
            <span className="dotted-label-blue">Remark . . . . . .</span>
            <input
              type="text"
              name="remark"
              className="invoice-input"
              placeholder="Invoice remarks..."
              value={invoiceHeader.remark}
              onChange={(e) => setInvoiceHeader({ ...invoiceHeader, remark: e.target.value })}
            />
          </div>

          {/* 5. Main Multiple Items Table */}
          <div className="invoice-items-table-wrapper">
            <table className="invoice-items-table">
              <thead>
                <tr>
                  <th style={{ width: '35px', textAlign: 'center' }}>#</th>
                  <th style={{ width: '100px' }}>Code</th>
                  <th>Description</th>
                  <th style={{ width: '110px' }}>Location</th>
                  <th style={{ width: '60px', textAlign: 'center' }}>Qty</th>
                  <th style={{ width: '75px', textAlign: 'center' }}>Mas. Pack</th>
                  <th style={{ width: '80px' }}>Rate</th>
                  <th style={{ width: '95px', textAlign: 'right' }}>Price</th>
                  <th style={{ width: '70px', textAlign: 'right' }}>Disc. %</th>
                  <th style={{ width: '90px', textAlign: 'right' }}>Disc. (Rs)</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>Value</th>
                  <th style={{ width: '75px', textAlign: 'center' }}>Balance</th>
                  <th style={{ width: '55px', textAlign: 'center' }}>Delete</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.length === 0 ? (
                  <tr>
                    <td colSpan="13" style={{ textAlign: 'center', padding: '30px', color: '#888' }}>
                      No items added to current invoice. Select an item above and click Save.
                    </td>
                  </tr>
                ) : (
                  lineItems.map((item, index) => (
                    <tr
                      key={`${item.code}-${index}`}
                      className={selectedLineIndex === index ? 'selected' : ''}
                      onClick={() => handleRowClick(index)}
                    >
                      <td style={{ textAlign: 'center', color: '#666' }}>{index + 1}</td>
                      <td style={{ fontWeight: 'bold' }}>{item.code}</td>
                      <td>{item.description}</td>
                      <td>{item.location || 'Main Store'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{item.quantity}</td>
                      <td style={{ textAlign: 'center' }}>{item.masterPack || 1}</td>
                      <td>{item.rateType || 'Retail'}</td>
                      <td style={{ textAlign: 'right' }}>
                        {Number(item.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right' }}>{item.discountPercentage || 0}</td>
                      <td style={{ textAlign: 'right' }}>
                        {Number(item.discountAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                        {Number(item.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'center' }}>{item.balance || '-'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#e81123',
                            cursor: 'pointer',
                            fontSize: '14px',
                          }}
                          title="Delete item"
                          onClick={(e) => handleRemoveLineItem(index, e)}
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 6. Bottom Action Bar */}
          <div className="invoice-footer">
            {/* Left buttons: New | Delete | Save | Print | Preview | Clear */}
            <div className="invoice-footer-left">
              <button type="button" className="invoice-btn-classic" onClick={handleNew}>
                New
              </button>
              <button type="button" className="invoice-btn-classic" onClick={handleDeleteInvoice}>
                Delete
              </button>
              <button
                type="button"
                className="invoice-btn-classic"
                onClick={() => handleSaveInvoice(false)}
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
              <button type="button" className="invoice-btn-classic" onClick={handlePrint}>
                Print
              </button>
              <button
                type="button"
                className="invoice-btn-classic"
                onClick={() => setPreviewModalOpen(true)}
              >
                Preview
              </button>
              <button type="button" className="invoice-btn-classic" onClick={handleNew}>
                Clear
              </button>
            </div>

            {/* Right: Grand Total */}
            <div className="invoice-footer-right">
              <span className="dotted-label-blue" style={{ fontSize: '13px' }}>Total</span>
              <input
                type="text"
                className="invoice-input invoice-total-display"
                readOnly
                value={invoiceSubTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              />
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
                placeholder="Type to filter..."
                autoFocus
                value={lookupModal.search}
                onChange={(e) => setLookupModal({ ...lookupModal, search: e.target.value })}
              />

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
                            No customers found
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
                ) : (
                  <table className="invoice-lookup-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                        <th style={{ width: '90px' }}>Code</th>
                        <th>Description</th>
                        <th style={{ width: '80px', textAlign: 'right' }}>Price</th>
                        <th style={{ width: '80px', textAlign: 'right' }}>Cost</th>
                        <th style={{ width: '60px', textAlign: 'center' }}>Stock</th>
                        <th style={{ width: '60px', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.slice(0, 100).map((i, idx) => (
                        <tr key={i._id} onClick={() => handleSelectItemFromLookup(i)}>
                          <td style={{ textAlign: 'center', color: '#666' }}>{idx + 1}</td>
                          <td style={{ fontWeight: 'bold', color: '#000080' }}>{i.code}</td>
                          <td>{i.description}</td>
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
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            <div className="invoice-modal-footer">
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
