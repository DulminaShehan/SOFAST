import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './ManagementSystem.css';

/**
 * SOFAST MOTORS - Management System
 * Recreates the exact UI from the provided reference image.
 */
function ManagementSystem() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(true);
  const [selectedModule, setSelectedModule] = useState('Item Master');
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  // Module data for Master Files and top menus
  const masterFilesItems = [
    {
      id: 'item-master',
      label: 'Item Master',
      path: '/item-master',
      iconColor: '#2563eb',
      badgeBg: '#dbeafe',
      description: 'Manage item details, pricing, stock and other information.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#60a5fa" />
          <path d="M2 17l10 5V12L2 7v10z" fill="#2563eb" />
          <path d="M22 17l-10 5V12l10-5v10z" fill="#1d4ed8" />
          <path d="M12 22V12M12 12L2 7M12 12l10-5" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: 'supplier-master',
      label: 'Supplier Master',
      path: '/supplier-master',
      iconColor: '#10b981',
      badgeBg: '#d1fae5',
      description: 'Manage supplier profiles, contact details and vendor information.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      id: 'customer-details',
      label: 'Customer Details',
      path: '/customer-details',
      iconColor: '#8b5cf6',
      badgeBg: '#ede9fe',
      description: 'Manage customer accounts, contact directories, credit limits and VAT configurations.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      id: 'category-master',
      label: 'Category Master',
      path: null,
      iconColor: '#f97316',
      badgeBg: '#ffedd5',
      description: 'Organize products and inventory into main classification categories.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="#f97316">
          <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58s1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41s-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" />
        </svg>
      ),
    },
    {
      id: 'sub-category-master',
      label: 'Sub Category Master',
      path: null,
      iconColor: '#64748b',
      badgeBg: '#f1f5f9',
      description: 'Configure sub-categories for refined catalog and item grouping.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="#64748b">
          <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58s1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41s-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" />
        </svg>
      ),
    },
    {
      id: 'alternative-product',
      label: 'Alternative Product',
      path: '/alternative-product',
      iconColor: '#0284c7',
      badgeBg: '#e0f2fe',
      description: 'Manage interchangeable and alternative product mappings for inventory items.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      ),
    },
  ];

  const stockControlItems = [
    {
      id: 'good-receive-note',
      label: 'Good Receive Note (GRN)',
      path: '/grn',
      iconColor: '#f59e0b',
      badgeBg: '#fef3c7',
      description: 'Record incoming supplier consignments, purchase invoices, and update inventory stock balances.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      id: 'good-return-note',
      label: 'Good Return Note (GREN)',
      path: '/good-return-note',
      iconColor: '#2563eb',
      badgeBg: '#dbeafe',
      description: 'Create supplier good return notes, reverse purchases, and reduce sellable inventory.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 14l-4-4 4-4" />
          <path d="M5 10h11a4 4 0 1 1 0 8h-1" />
        </svg>
      ),
    },
    {
      id: 'damage',
      label: 'Damage',
      path: '/damage',
      iconColor: '#ea580c',
      badgeBg: '#ffedd5',
      description: 'Data entry of damage inventory items, supplier damage tracking, and quarantine adjustments.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    },
  ];



  const salesServiceItems = [
    {
      id: 'create-invoice',
      label: 'Create Invoice',
      path: '/invoice',
      iconColor: '#2563eb',
      badgeBg: '#dbeafe',
      description: 'Customer sales invoicing, retail/wholesale billing, multiple items entry, and payment processing.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 14l6-6m-6 0l6 6m-9 7h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'settlement-invoice',
      label: 'Settlement Invoice',
      path: '/settlement-invoice',
      iconColor: '#16a34a',
      badgeBg: '#dcfce7',
      description: 'Settle outstanding sales invoices with payments, cheque records, bank details, and special discounts.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      ),
    },
    {
      id: 'remaining-balance',
      label: 'Remaining Balance',
      path: '/remaining-balance',
      iconColor: '#d97706',
      badgeBg: '#fef3c7',
      description: 'View customers and invoices with outstanding balances and process payments directly.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
    },
    {
      id: 'customer-return-exchange',
      label: 'Customer Return / Exchange',
      path: '/customer-return-exchange',
      iconColor: '#e11d48',
      badgeBg: '#ffe4e6',
      description: 'Process customer returns for exchanges, defective goods, quarantine stock, and trace suppliers.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
      ),
    },
  ];

  const administrationItems = [
    {
      id: 'printer-setup',
      label: 'Printer Setup',
      path: '/printer-setup',
      iconColor: '#2563eb',
      badgeBg: '#dbeafe',
      description: 'Configure POS thermal printers, A4 report printers, and default printing hardware.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 6 2 18 2 18 9" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </svg>
      ),
    },
    ...(isAdmin
      ? [
          {
            id: 'new-user',
            label: 'New User',
            path: '/new-user',
            iconColor: '#f59e0b',
            badgeBg: '#fef3c7',
            description: 'Create user accounts, set login credentials, and configure page access permissions.',
            renderIcon: (size = 20) => (
              <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
            ),
          },
        ]
      : []),
  ];

  const approvementItems = [
    {
      id: 'payment-voucher',
      label: 'Payment Voucher',
      path: '/payment-voucher',
      iconColor: '#2563eb',
      badgeBg: '#dbeafe',
      description: 'Authorize supplier settlements, check payments, and bank transfers.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      ),
    },
    {
      id: 'petty-cash',
      label: 'Petty Cash',
      path: '/petty-cash',
      iconColor: '#10b981',
      badgeBg: '#d1fae5',
      description: 'Review and approve store petty cash vouchers and emergency expenditures.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
          <line x1="12" y1="6" x2="12" y2="8" />
          <line x1="12" y1="16" x2="12" y2="18" />
        </svg>
      ),
    },
    {
      id: 'leave-request',
      label: 'Leave Request',
      path: '/leave-request',
      iconColor: '#8b5cf6',
      badgeBg: '#ede9fe',
      description: 'Staff leave applications, vacation calendars, and supervisor approval logs.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
  ];

  const reportsItems = [
    {
      id: 'daily-settlements',
      label: 'Daily Settlements Details',
      path: '/reports?tab=settlements',
      iconColor: '#10b981',
      badgeBg: '#d1fae5',
      description: 'Daily cash collections, cheque payments and invoice settlement breakdown.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
    },
    {
      id: 'grn-report',
      label: 'Goods Received Notes (GRN)',
      path: '/reports?tab=grn',
      iconColor: '#f59e0b',
      badgeBg: '#fef3c7',
      description: 'Inventory intake audit, supplier trade discounts and return quantities.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      id: 'invoice-returns',
      label: 'Invoice Returns Report',
      path: '/reports?tab=invoice_returns',
      iconColor: '#ea580c',
      badgeBg: '#ffedd5',
      description: 'Customer returns audit, refund values and returned stock items.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <path d="M3 21v-5h5" />
        </svg>
      ),
    },
    {
      id: 'daily-sales',
      label: 'Daily Sales & Profit Report',
      path: '/reports?tab=daily_sales',
      iconColor: '#2563eb',
      badgeBg: '#dbeafe',
      description: 'Daily counter sales, purchase costs, gross margins and profit calculations.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
      ),
    },
    {
      id: 'closing-stock',
      label: 'Closing Stock Report (170-Page Inventory)',
      path: '/reports?tab=closing_stock',
      iconColor: '#8b5cf6',
      badgeBg: '#ede9fe',
      description: 'Complete warehouse inventory audit with bin locations, quantities and valuations.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      ),
    },
    {
      id: 'alternative-products-rep',
      label: 'Alternative Products Report',
      path: '/reports?tab=alternative_products',
      iconColor: '#0284c7',
      badgeBg: '#e0f2fe',
      description: 'Mapped substitute and interchangeable products catalog for fast counter lookup.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      ),
    },
    {
      id: 'supplier-purchases-rep',
      label: 'Supplier Wise Purchases',
      path: '/reports?tab=supplier_purchases',
      iconColor: '#059669',
      badgeBg: '#d1fae5',
      description: 'Consolidated supplier purchases audit, return deductions, net payable and trade discounts.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      ),
    },
    {
      id: 'top-selling-items-rep',
      label: 'Top Selling Items Report',
      path: '/reports?tab=top_selling',
      iconColor: '#dc2626',
      badgeBg: '#fee2e2',
      description: 'Monthly item volume consumption analysis, market share percentage and sales velocity.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
        </svg>
      ),
    },
    {
      id: 'non-moving-rep',
      label: 'Non Moving Inventory Report',
      path: '/reports?tab=non_moving',
      iconColor: '#e11d48',
      badgeBg: '#ffe4e6',
      description: 'Dead stock audit, dormant capital valuation and slow-moving spare parts analysis across 14 categories.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      id: 'all-reports',
      label: '📊 Open Reports Center',
      path: '/reports',
      iconColor: '#0284c7',
      badgeBg: '#e0f2fe',
      description: 'Open full comprehensive reporting suite with PDF dot-matrix paper views.',
      renderIcon: (size = 20) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
    },
  ];

  const topMenuItems = [
    { id: 'master-files', label: 'Master Files', hasDropdown: true },
    { id: 'stock-control', label: 'Stock Control System', hasDropdown: true, description: 'Real-time stock tracking, warehouse transfers and inventory balances.' },
    { id: 'sales-service', label: 'Sales and Service', hasDropdown: true, description: 'Point of sale, customer billing, and service order management.' },
    { id: 'approvement', label: 'Approvement', hasDropdown: true, description: 'Payment vouchers, petty cash claims, and employee leave authorization.' },
    { id: 'reports', label: 'Reports', hasDropdown: true, path: '/reports', description: 'Financial, inventory, sales, audit and alternative product reporting.' },
    { id: 'accounting', label: 'Accounting', description: 'General ledger, accounts receivable, payable and banking.' },
    { id: 'administration', label: 'Administration', hasDropdown: true, description: 'System configuration, user permissions, printer setup and audit logs.' },
  ];

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsDropdownOpen(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleDropdownSelect = (item) => {
    setIsDropdownOpen(null);
    if (item.path) {
      navigate(item.path);
    } else {
      setSelectedModule(item.label);
    }
  };

  const handleTopMenuClick = (item) => {
    if (item.hasDropdown) {
      setIsDropdownOpen((prev) => (prev === item.id ? null : item.id));
      if (item.id === 'reports') {
        setSelectedModule('Reports');
      }
    } else if (item.path) {
      setIsDropdownOpen(null);
      navigate(item.path);
    } else {
      setIsDropdownOpen(null);
      setSelectedModule(item.label);
    }
  };

  // Find active module metadata
  const currentMasterItem = masterFilesItems.find((m) => m.label === selectedModule) || stockControlItems.find((s) => s.label === selectedModule) || salesServiceItems.find((ss) => ss.label === selectedModule) || administrationItems.find((adm) => adm.label === selectedModule) || reportsItems.find((rep) => rep.label === selectedModule);
  const currentTopMenuItem = topMenuItems.find((t) => t.label === selectedModule);

  const activeTitle = selectedModule;
  const activeDescription = currentMasterItem?.description || currentTopMenuItem?.description || 'Module details and management operations.';
  const activeBadgeBg = currentMasterItem?.badgeBg || '#dbeafe';

  return (
    <div className="management-system-container">
      {/* 1. Top Windows Blue Header */}
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
          <button type="button" className="control-btn close" aria-label="Close" onClick={() => navigate('/selection')}>&#x2715;</button>
        </div>
      </header>

      {/* 2. Top Horizontal Menu Bar with Master Files & Stock Control Dropdown */}
      <nav className="management-menubar-container" ref={menuRef}>
        <ul className="management-menubar">
          {topMenuItems.map((item) => (
            <li key={item.id} className="menubar-item">
              <button
                type="button"
                className={`menubar-button ${
                  (isDropdownOpen === item.id) || selectedModule === item.label ? 'active' : ''
                }`}
                onClick={() => handleTopMenuClick(item)}
              >
                {item.label}
              </button>

              {/* Master Files Dropdown */}
              {item.id === 'master-files' && isDropdownOpen === 'master-files' && (
                <ul className="masterfiles-dropdown">
                  {masterFilesItems.map((masterItem) => (
                    <li key={masterItem.id} className="dropdown-entry">
                      <button
                        type="button"
                        className={`dropdown-item-btn ${selectedModule === masterItem.label ? 'selected' : ''}`}
                        onClick={() => handleDropdownSelect(masterItem)}
                      >
                        <span className="dropdown-item-icon">
                          {masterItem.renderIcon(18)}
                        </span>
                        <span>{masterItem.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Stock Control System Dropdown */}
              {item.id === 'stock-control' && isDropdownOpen === 'stock-control' && (
                <ul className="masterfiles-dropdown">
                  {stockControlItems.map((scItem) => (
                    <li key={scItem.id} className="dropdown-entry">
                      <button
                        type="button"
                        className={`dropdown-item-btn ${selectedModule === scItem.label ? 'selected' : ''}`}
                        onClick={() => handleDropdownSelect(scItem)}
                      >
                        <span className="dropdown-item-icon">
                          {scItem.renderIcon(18)}
                        </span>
                        <span>{scItem.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Sales and Service Dropdown */}
              {item.id === 'sales-service' && isDropdownOpen === 'sales-service' && (
                <ul className="masterfiles-dropdown">
                  {salesServiceItems.map((ssItem) => (
                    <li key={ssItem.id} className="dropdown-entry">
                      <button
                        type="button"
                        className={`dropdown-item-btn ${selectedModule === ssItem.label ? 'selected' : ''}`}
                        onClick={() => handleDropdownSelect(ssItem)}
                      >
                        <span className="dropdown-item-icon">
                          {ssItem.renderIcon(18)}
                        </span>
                        <span>{ssItem.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Approvement Dropdown */}
              {item.id === 'approvement' && isDropdownOpen === 'approvement' && (
                <ul className="masterfiles-dropdown">
                  {approvementItems.map((apprItem) => (
                    <li key={apprItem.id} className="dropdown-entry">
                      <button
                        type="button"
                        className={`dropdown-item-btn ${selectedModule === apprItem.label ? 'selected' : ''}`}
                        onClick={() => handleDropdownSelect(apprItem)}
                      >
                        <span className="dropdown-item-icon">
                          {apprItem.renderIcon(18)}
                        </span>
                        <span>{apprItem.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Reports Dropdown */}
              {item.id === 'reports' && isDropdownOpen === 'reports' && (
                <ul className="masterfiles-dropdown">
                  {reportsItems.map((repItem) => (
                    <li key={repItem.id} className="dropdown-entry">
                      <button
                        type="button"
                        className={`dropdown-item-btn ${selectedModule === repItem.label ? 'selected' : ''}`}
                        onClick={() => handleDropdownSelect(repItem)}
                      >
                        <span className="dropdown-item-icon">
                          {repItem.renderIcon(18)}
                        </span>
                        <span>{repItem.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Administration Dropdown */}
              {item.id === 'administration' && isDropdownOpen === 'administration' && (
                <ul className="masterfiles-dropdown">
                  {administrationItems.map((admItem) => (
                    <li key={admItem.id} className="dropdown-entry">
                      <button
                        type="button"
                        className={`dropdown-item-btn ${selectedModule === admItem.label ? 'selected' : ''}`}
                        onClick={() => handleDropdownSelect(admItem)}
                      >
                        <span className="dropdown-item-icon">
                          {admItem.renderIcon(18)}
                        </span>
                        <span>{admItem.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* 3. Center Workspace Content Area */}
      <main className="management-workspace">
        <div className="workspace-content">
          <div className="workspace-circle-badge" style={{ backgroundColor: activeBadgeBg }}>
            {currentMasterItem ? (
              currentMasterItem.renderIcon(54)
            ) : (
              <svg width="50" height="50" viewBox="0 0 24 24" fill="#2563eb">
                <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#60a5fa" />
                <path d="M2 17l10 5V12L2 7v10z" fill="#2563eb" />
                <path d="M22 17l-10 5V12l10-5v10z" fill="#1d4ed8" />
              </svg>
            )}
          </div>

          <h1 className="workspace-title">{activeTitle}</h1>
          <p className="workspace-description">{activeDescription}</p>

          {selectedModule === 'Reports' ? (
            <div className="management-reports-hub" style={{ marginTop: '20px', width: '100%', maxWidth: '840px' }}>
              <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => navigate('/reports')}
                  style={{
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 28px',
                    fontWeight: '700',
                    fontSize: '15px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'transform 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <span>📊 Open Full Reports Center (All Reports)</span>
                  <span>&rarr;</span>
                </button>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '14px',
                textAlign: 'left'
              }}>
                {reportsItems.filter(r => r.id !== 'all-reports').map(r => (
                  <div
                    key={r.id}
                    onClick={() => navigate(r.path)}
                    style={{
                      background: '#ffffff',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#0284c7';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 20px rgba(2, 132, 199, 0.16)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.04)';
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <div style={{
                          background: r.badgeBg,
                          borderRadius: '8px',
                          padding: '7px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {r.renderIcon(20)}
                        </div>
                        <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>{r.label}</strong>
                      </div>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 12px 0', lineHeight: '1.45' }}>
                        {r.description}
                      </p>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Launch Report &rarr;
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="coming-soon-badge">
              Coming Soon...
            </div>
          )}
        </div>
      </main>

      {/* 4. Bottom Status Bar */}
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#16a34a">
                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                <path d="M3 5v6c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                <path d="M3 11v6c0 1.66 4 3 9 3s9-1.34 9-3v-6"/>
              </svg>
            </span>
            <span>Database: MongoDB (Connected)</span>
          </div>
        </div>

        <div className="statusbar-right">
          <span>SOFAST MOTORS</span>
          <span>|</span>
          <span>v1.0.0</span>
        </div>
      </footer>
    </div>
  );
}

export default ManagementSystem;
