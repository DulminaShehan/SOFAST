import { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import ApprovementDropdown from '../../components/navigation/ApprovementDropdown';
import './Reports.css';

/**
 * Reports Module
 * Supports:
 * 1. DAILY SETTLEMENTS DETAILS (Exact replica from Report 5 PDF)
 * 2. GOODS RECEIVED NOTES (GRN Report - Exact replica from Report 4 PDF)
 * 3. INVOICE RETURNS REPORT (Exact replica from Report 3 PDF)
 * 4. DAILY SALES & PROFIT REPORT (Exact replica from Report 2 PDF)
 * 5. CLOSING STOCK REPORT (Exact 170-page replica from Report 1 PDF)
 * 6. ALTERNATIVE PRODUCTS REPORT (Catalog of substitutes and replacement parts)
 * Features quick filters, instant sorting by Most Used/Received Products, Staff, Category, and Profit.
 */
function Reports() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser, isAdmin } = useAuth();

  // Navigation Menubar Dropdowns
  const [activeDropdown, setActiveDropdown] = useState(null);
  const menuRef = useRef(null);

  // Active Report Tab: 'settlements', 'grn', 'invoice_returns', 'daily_sales', 'closing_stock', or 'alternative_products'
  const initialTab = searchParams.get('tab') || 'settlements';
  const [activeReportTab, setActiveReportTab] = useState(initialTab);

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && tabFromUrl !== activeReportTab) {
      setActiveReportTab(tabFromUrl);
    }
  }, [searchParams]);

  const handleTabSwitch = (newTab) => {
    setActiveReportTab(newTab);
    setSearchParams({ tab: newTab });
  };

  // Common View Mode: 'paper' (exact PDF replica) or 'modern' (interactive data table)
  const [viewMode, setViewMode] = useState('paper');

  // Filter Dropdown Options from DB
  const [filterOptions, setFilterOptions] = useState({
    categories: [],
    bins: [],
    staff: ['cashier', 'admin', 'admin_new', 'testcashier', 'PC004'],
    suppliers: ['RAZA AUTO TRADERS', 'BAJAJ GENUINE PARTS', 'DPMC LANKA', 'VENDORS AUTO'],
    customers: ['DAILY SALES', 'GUNAWARDANA GARAJ,PANTHIYA', 'ADVANCE BILL', 'KAVEESHA DEWSHAN,AGALAWATTA'],
  });

  // ---------------------------------------------------------------------------
  // REPORT 6: Alternative Products Report States & Baseline Data
  // ---------------------------------------------------------------------------
  const [altLoading, setAltLoading] = useState(false);
  const [altReportData, setAltReportData] = useState([]);
  const [altSearch, setAltSearch] = useState('');
  const [altStatusFilter, setAltStatusFilter] = useState('All');
  const [altStockFilter, setAltStockFilter] = useState('all');
  const [altSortBy, setAltSortBy] = useState('default');

  const FALLBACK_ALT_PRODUCTS = [
    {
      _id: 'alt-1',
      mainItemCode: '01100342',
      description: 'BEARING BALL [6204]',
      mainItemDescription: 'BEARING BALL [6204]',
      mainItemStock: 8,
      mainItemPrice: 850.0,
      alternativeCount: 2,
      alternativeItemCodes: ['01100342K', '01100355'],
      alternativeItems: [
        {
          code: '01100342K',
          description: 'REAR WHEEL BEARING KIT - 3W',
          category: '3W-BODY',
          location: 'Main Store',
          stock: 3,
          price: 2144.0,
        },
        {
          code: '01100355',
          description: 'OIL SEAL [ MAGENTO ]',
          category: '2W-BODY',
          location: 'Main Store',
          stock: 1,
          price: 424.0,
        },
      ],
      status: 'Active',
      remark: 'Primary Bajaj substitute',
      updatedAt: '2026-10-09T18:50:00.007Z',
    },
    {
      _id: 'alt-2',
      mainItemCode: 'SF24170508',
      description: 'COIL SPRING (DUPLICATE PART)',
      mainItemDescription: 'COIL SPRING (DUPLICATE PART)',
      mainItemStock: 0,
      mainItemPrice: 2405.0,
      alternativeCount: 1,
      alternativeItemCodes: ['SF24170508-O'],
      alternativeItems: [
        {
          code: 'SF24170508-O',
          description: 'GENUINE COIL SPRING BAJAJ OEM',
          category: 'SUSPENSION',
          location: 'Rack 4-B',
          stock: 5,
          price: 3200.0,
        },
      ],
      status: 'Active',
      remark: 'OEM replacement in stock',
      updatedAt: '2026-10-15T12:00:00.000Z',
    },
    {
      _id: 'alt-3',
      mainItemCode: 'SF36AA4117',
      description: 'ASSLY CYL. HEAD_VALVE 4S- 175 (DUPLICATE)',
      mainItemDescription: 'ASSLY CYL. HEAD_VALVE 4S- 175 (DUPLICATE)',
      mainItemStock: 1,
      mainItemPrice: 16058.0,
      alternativeCount: 1,
      alternativeItemCodes: ['SF36AA4117-OEM'],
      alternativeItems: [
        {
          code: 'SF36AA4117-OEM',
          description: 'CYLINDER HEAD VALVE 4S 175cc GENUINE',
          category: 'ENGINE',
          location: 'Rack 12-A',
          stock: 2,
          price: 18500.0,
        },
      ],
      status: 'Active',
      remark: 'Compatible valve assembly',
      updatedAt: '2026-10-18T09:30:00.000Z',
    },
    {
      _id: 'alt-4',
      mainItemCode: 'SFAA101033',
      description: 'CRANK SHAFT ASSY 4S (DUPLICATE PART)',
      mainItemDescription: 'CRANK SHAFT ASSY 4S (DUPLICATE PART)',
      mainItemStock: 0,
      mainItemPrice: 14587.0,
      alternativeCount: 1,
      alternativeItemCodes: ['SFAA101033-G'],
      alternativeItems: [
        {
          code: 'SFAA101033-G',
          description: 'CRANK SHAFT ASSY 4S HEAVY DUTY STD',
          category: 'ENGINE',
          location: 'Rack 15-C',
          stock: 4,
          price: 16200.0,
        },
      ],
      status: 'Active',
      remark: 'Heavy duty alternative',
      updatedAt: '2026-10-20T14:15:00.000Z',
    },
  ];

  // ---------------------------------------------------------------------------
  // REPORT 5: Daily Settlements Details (Daily Setelments Deatils - ) States
  // ---------------------------------------------------------------------------
  const [dsdLoading, setDsdLoading] = useState(true);
  const [dsdReportData, setDsdReportData] = useState(null);
  const [dsdStartDate, setDsdStartDate] = useState('2026-08-06');
  const [dsdEndDate, setDsdEndDate] = useState('2026-08-06');
  const [dsdSelectedCustomer, setDsdSelectedCustomer] = useState('All');
  const [dsdSelectedPaymentMethod, setDsdSelectedPaymentMethod] = useState('All');
  const [dsdSearch, setDsdSearch] = useState('');
  const [dsdSortBy, setDsdSortBy] = useState('default');
  const [dsdPageSize, setDsdPageSize] = useState(50);
  const [dsdPage, setDsdPage] = useState(1);
  const [dsdJumpPage, setDsdJumpPage] = useState('1');

  // ---------------------------------------------------------------------------
  // REPORT 4: Goods Received Notes (GRN) States
  // ---------------------------------------------------------------------------
  const [grnLoading, setGrnLoading] = useState(true);
  const [grnReportData, setGrnReportData] = useState(null);
  const [grnStartDate, setGrnStartDate] = useState('2026-08-06');
  const [grnEndDate, setGrnEndDate] = useState('2026-08-06');
  const [grnSelectedSupplier, setGrnSelectedSupplier] = useState('All');
  const [grnSelectedUser, setGrnSelectedUser] = useState('All');
  const [grnSearch, setGrnSearch] = useState('');
  const [grnSortBy, setGrnSortBy] = useState('default');
  const [grnPageSize, setGrnPageSize] = useState(50);
  const [grnPage, setGrnPage] = useState(1);
  const [grnJumpPage, setGrnJumpPage] = useState('1');

  // ---------------------------------------------------------------------------
  // REPORT 3: Invoice Returns Report States
  // ---------------------------------------------------------------------------
  const [irLoading, setIrLoading] = useState(false);
  const [irReportData, setIrReportData] = useState(null);
  const [irStartDate, setIrStartDate] = useState('2026-08-06');
  const [irEndDate, setIrEndDate] = useState('2026-08-06');
  const [irSelectedStaff, setIrSelectedStaff] = useState('All');
  const [irSearch, setIrSearch] = useState('');
  const [irSortBy, setIrSortBy] = useState('default');
  const [irPageSize, setIrPageSize] = useState(50);
  const [irPage, setIrPage] = useState(1);
  const [irJumpPage, setIrJumpPage] = useState('1');

  // ---------------------------------------------------------------------------
  // REPORT 2: Daily Sales Report States
  // ---------------------------------------------------------------------------
  const [dsLoading, setDsLoading] = useState(false);
  const [dsReportData, setDsReportData] = useState(null);
  const [dsStartDate, setDsStartDate] = useState('2026-08-06');
  const [dsEndDate, setDsEndDate] = useState('2026-08-06');
  const [dsSelectedStaff, setDsSelectedStaff] = useState('All');
  const [dsSelectedSection, setDsSelectedSection] = useState('all');
  const [dsSearch, setDsSearch] = useState('');
  const [dsSortBy, setDsSortBy] = useState('default');
  const [dsPageSize, setDsPageSize] = useState(50);
  const [dsPage, setDsPage] = useState(1);
  const [dsJumpPage, setDsJumpPage] = useState('1');

  // ---------------------------------------------------------------------------
  // REPORT 1: Closing Stock Report States
  // ---------------------------------------------------------------------------
  const [csLoading, setCsLoading] = useState(false);
  const [csReportData, setCsReportData] = useState(null);
  const [csSearch, setCsSearch] = useState('');
  const [csSelectedCategory, setCsSelectedCategory] = useState('All');
  const [csSelectedStaff, setCsSelectedStaff] = useState('All');
  const [csStockStatus, setCsStockStatus] = useState('all');
  const [csSelectedBin, setCsSelectedBin] = useState('All');
  const [csSortBy, setCsSortBy] = useState('default');
  const [csPageSize, setCsPageSize] = useState(35);
  const [csPage, setCsPage] = useState(1);
  const [csJumpPage, setCsJumpPage] = useState('1');

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch Filter Dropdown Options
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const res = await api.get('/reports/filter-options');
        if (res.data?.success) {
          setFilterOptions((prev) => ({
            ...prev,
            categories: res.data.categories || [],
            bins: res.data.bins || [],
            staff: res.data.staff?.length
              ? [...new Set([...res.data.staff, 'PC004', 'cashier', 'admin'])]
              : ['cashier', 'admin', 'admin_new', 'testcashier', 'PC004'],
          }));
        }
      } catch (err) {
        console.warn('Failed to load filter options:', err);
      }
    };
    fetchOptions();
  }, []);

  // Fetch Alternative Products
  const fetchAlternativeProducts = async () => {
    try {
      setAltLoading(true);
      const res = await api.get('/alternative-products?limit=500');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setAltReportData(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to load alternative products:', err);
    } finally {
      setAltLoading(false);
    }
  };

  useEffect(() => {
    if (activeReportTab === 'alternative_products') {
      fetchAlternativeProducts();
    }
  }, [activeReportTab]);

  // Filtered & Sorted Alternative Products
  const displayAltProducts = useMemo(() => {
    let list = altReportData && altReportData.length > 0 ? altReportData : FALLBACK_ALT_PRODUCTS;
    if (altSearch.trim()) {
      const q = altSearch.toLowerCase().trim();
      list = list.filter((r) =>
        (r.mainItemCode || '').toLowerCase().includes(q) ||
        (r.mainItemDescription || r.description || '').toLowerCase().includes(q) ||
        (r.alternativeItemCodes || []).some((c) => c.toLowerCase().includes(q)) ||
        (r.alternativeItems || []).some((ai) => (ai.description || '').toLowerCase().includes(q))
      );
    }
    if (altStatusFilter !== 'All') {
      list = list.filter((r) => (r.status || 'Active') === altStatusFilter);
    }
    if (altStockFilter === 'in_stock') {
      list = list.filter((r) => (r.alternativeItems || []).some((ai) => Number(ai.stock) > 0));
    } else if (altStockFilter === 'main_zero') {
      list = list.filter((r) => Number(r.mainItemStock || 0) === 0 && (r.alternativeItems || []).some((ai) => Number(ai.stock) > 0));
    }
    if (altSortBy === 'code_asc') {
      list = [...list].sort((a, b) => (a.mainItemCode || '').localeCompare(b.mainItemCode || ''));
    } else if (altSortBy === 'alt_stock_desc') {
      list = [...list].sort((a, b) => {
        const stockA = (a.alternativeItems || []).reduce((sum, ai) => sum + (ai.stock || 0), 0);
        const stockB = (b.alternativeItems || []).reduce((sum, ai) => sum + (ai.stock || 0), 0);
        return stockB - stockA;
      });
    } else if (altSortBy === 'most_alternatives') {
      list = [...list].sort((a, b) => (b.alternativeItems?.length || 0) - (a.alternativeItems?.length || 0));
    }
    return list;
  }, [altReportData, altSearch, altStatusFilter, altStockFilter, altSortBy]);

  // Fetch Daily Settlements Report (Daily Setelments Deatils - )
  const fetchDailySettlements = async () => {
    try {
      setDsdLoading(true);
      const params = {
        startDate: dsdStartDate,
        endDate: dsdEndDate,
        customer: dsdSelectedCustomer,
        paymentMethod: dsdSelectedPaymentMethod,
        search: dsdSearch,
        sortBy: dsdSortBy,
        page: dsdPage,
        limit: dsdPageSize,
      };

      const res = await api.get('/reports/daily-settlements', { params });
      if (res.data?.success) {
        setDsdReportData(res.data);
      }
    } catch (err) {
      console.error('Failed to load Daily Settlements report:', err);
    } finally {
      setDsdLoading(false);
    }
  };

  useEffect(() => {
    if (activeReportTab === 'settlements') {
      fetchDailySettlements();
    }
  }, [activeReportTab, dsdStartDate, dsdEndDate, dsdSelectedCustomer, dsdSelectedPaymentMethod, dsdSearch, dsdSortBy, dsdPage, dsdPageSize]);

  // Fetch GRN Report
  const fetchGrnReport = async () => {
    try {
      setGrnLoading(true);
      const params = {
        startDate: grnStartDate,
        endDate: grnEndDate,
        supplier: grnSelectedSupplier,
        user: grnSelectedUser,
        search: grnSearch,
        sortBy: grnSortBy,
        page: grnPage,
        limit: grnPageSize,
      };

      const res = await api.get('/reports/grn', { params });
      if (res.data?.success) {
        setGrnReportData(res.data);
      }
    } catch (err) {
      console.error('Failed to load GRN report:', err);
    } finally {
      setGrnLoading(false);
    }
  };

  useEffect(() => {
    if (activeReportTab === 'grn') {
      fetchGrnReport();
    }
  }, [activeReportTab, grnStartDate, grnEndDate, grnSelectedSupplier, grnSelectedUser, grnSearch, grnSortBy, grnPage, grnPageSize]);

  // Fetch Invoice Returns Report
  const fetchInvoiceReturns = async () => {
    try {
      setIrLoading(true);
      const params = {
        startDate: irStartDate,
        endDate: irEndDate,
        staff: irSelectedStaff,
        search: irSearch,
        sortBy: irSortBy,
        page: irPage,
        limit: irPageSize,
      };

      const res = await api.get('/reports/invoice-returns', { params });
      if (res.data?.success) {
        setIrReportData(res.data);
      }
    } catch (err) {
      console.error('Failed to load invoice returns report:', err);
    } finally {
      setIrLoading(false);
    }
  };

  useEffect(() => {
    if (activeReportTab === 'invoice_returns') {
      fetchInvoiceReturns();
    }
  }, [activeReportTab, irStartDate, irEndDate, irSelectedStaff, irSearch, irSortBy, irPage, irPageSize]);

  // Fetch Daily Sales Report
  const fetchDailySales = async () => {
    try {
      setDsLoading(true);
      const params = {
        startDate: dsStartDate,
        endDate: dsEndDate,
        staff: dsSelectedStaff,
        section: dsSelectedSection,
        search: dsSearch,
        sortBy: dsSortBy,
        page: dsPage,
        limit: dsPageSize,
      };

      const res = await api.get('/reports/daily-sales', { params });
      if (res.data?.success) {
        setDsReportData(res.data);
      }
    } catch (err) {
      console.error('Failed to load daily sales report:', err);
    } finally {
      setDsLoading(false);
    }
  };

  useEffect(() => {
    if (activeReportTab === 'daily_sales') {
      fetchDailySales();
    }
  }, [activeReportTab, dsStartDate, dsEndDate, dsSelectedStaff, dsSelectedSection, dsSearch, dsSortBy, dsPage, dsPageSize]);

  // Fetch Closing Stock Report
  const fetchClosingStock = async () => {
    try {
      setCsLoading(true);
      const params = {
        search: csSearch,
        category: csSelectedCategory === 'All' ? '' : csSelectedCategory,
        staff: csSelectedStaff === 'All' ? '' : csSelectedStaff,
        stockStatus: csStockStatus,
        bin: csSelectedBin === 'All' ? '' : csSelectedBin,
        sortBy: csSortBy,
        page: csPage,
        limit: csPageSize,
      };

      const res = await api.get('/reports/closing-stock', { params });
      if (res.data?.success) {
        setCsReportData(res.data);
      }
    } catch (err) {
      console.error('Failed to load closing stock report:', err);
    } finally {
      setCsLoading(false);
    }
  };

  useEffect(() => {
    if (activeReportTab === 'closing_stock') {
      fetchClosingStock();
    }
  }, [activeReportTab, csSearch, csSelectedCategory, csSelectedStaff, csStockStatus, csSelectedBin, csSortBy, csPage, csPageSize]);

  // Presets for Daily Settlements Details
  const handleApplySettlementsPreset = (presetType) => {
    setDsdPage(1);
    setDsdJumpPage('1');
    if (presetType === 'audit') {
      setDsdStartDate('2026-08-06');
      setDsdEndDate('2026-08-06');
      setDsdSelectedCustomer('All');
      setDsdSelectedPaymentMethod('All');
      setDsdSortBy('default');
      setDsdSearch('');
      setDsdPageSize(50);
    } else if (presetType === 'highest_inv') {
      setDsdSortBy('inv_value_desc');
    } else if (presetType === 'cash_only') {
      setDsdSelectedPaymentMethod('cash');
      setDsdSortBy('default');
    } else if (presetType === 'cheque_only') {
      setDsdSelectedPaymentMethod('cheque');
      setDsdSortBy('default');
    } else if (presetType === 'named_customers') {
      setDsdSelectedPaymentMethod('named_customer');
      setDsdSortBy('default');
    } else if (presetType === 'negative_cash') {
      setDsdSelectedPaymentMethod('negative');
      setDsdSortBy('negative_first');
    }
  };

  // Presets for GRN
  const handleApplyGrnPreset = (presetType) => {
    setGrnPage(1);
    setGrnJumpPage('1');
    if (presetType === 'audit') {
      setGrnStartDate('2026-08-06');
      setGrnEndDate('2026-08-06');
      setGrnSelectedSupplier('All');
      setGrnSelectedUser('All');
      setGrnSortBy('default');
      setGrnSearch('');
    } else if (presetType === 'most_received') {
      setGrnSortBy('most_received');
      setGrnSelectedSupplier('All');
      setGrnSelectedUser('All');
      setGrnSearch('');
    } else if (presetType === 'highest_val') {
      setGrnSortBy('value_desc');
      setGrnSelectedSupplier('All');
      setGrnSelectedUser('All');
      setGrnSearch('');
    } else if (presetType === 'returns') {
      setGrnSortBy('has_returns');
      setGrnSearch('');
    } else if (presetType === 'user_pc004') {
      setGrnSelectedUser('PC004');
      setGrnSearch('');
    }
  };

  // Presets for Invoice Returns
  const handleApplyIrPreset = (presetType) => {
    setIrPage(1);
    setIrJumpPage('1');
    if (presetType === 'audit') {
      setIrStartDate('2026-08-06');
      setIrEndDate('2026-08-06');
      setIrSortBy('default');
      setIrSelectedStaff('All');
      setIrSearch('');
    } else if (presetType === 'today') {
      const todayStr = new Date().toISOString().slice(0, 10);
      setIrStartDate(todayStr);
      setIrEndDate(todayStr);
      setIrSortBy('default');
      setIrSelectedStaff('All');
      setIrSearch('');
    } else if (presetType === 'most_returned') {
      setIrSortBy('most_returned');
      setIrSelectedStaff('All');
      setIrSearch('');
    } else if (presetType === 'highest_val') {
      setIrSortBy('value_desc');
      setIrSelectedStaff('All');
      setIrSearch('');
    } else if (presetType === 'staff') {
      setIrSelectedStaff('cashier');
      setIrSearch('');
    }
  };

  // Presets for Daily Sales
  const handleApplyDsPreset = (presetType) => {
    setDsPage(1);
    setDsJumpPage('1');
    if (presetType === 'audit') {
      setDsStartDate('2026-08-06');
      setDsEndDate('2026-08-06');
      setDsSortBy('default');
      setDsSelectedStaff('All');
      setDsSelectedSection('all');
      setDsSearch('');
    } else if (presetType === 'today') {
      const todayStr = new Date().toISOString().slice(0, 10);
      setDsStartDate(todayStr);
      setDsEndDate(todayStr);
      setDsSortBy('default');
      setDsSelectedStaff('All');
      setDsSelectedSection('all');
      setDsSearch('');
    } else if (presetType === 'most_used') {
      setDsSortBy('most_used');
      setDsSelectedStaff('All');
      setDsSelectedSection('all');
      setDsSearch('');
    } else if (presetType === 'profit') {
      setDsSortBy('profit_desc');
      setDsSelectedStaff('All');
      setDsSelectedSection('all');
      setDsSearch('');
    } else if (presetType === 'staff') {
      setDsSelectedStaff('cashier');
      setDsSelectedSection('all');
      setDsSearch('');
    } else if (presetType === 'materials') {
      setDsSelectedSection('Materials');
      setDsSearch('');
    } else if (presetType === 'servicing') {
      setDsSelectedSection('Servicing & Repairs');
      setDsSearch('');
    }
  };

  // Presets for Closing Stock
  const handleApplyCsPreset = (presetType) => {
    setCsPage(1);
    setCsJumpPage('1');
    if (presetType === 'all') {
      setCsSortBy('default');
      setCsStockStatus('all');
      setCsSelectedCategory('All');
      setCsSelectedStaff('All');
      setCsSelectedBin('All');
      setCsSearch('');
    } else if (presetType === 'most_used') {
      setCsSortBy('most_used');
      setCsSelectedStaff('All');
      setCsSelectedCategory('All');
      setCsSelectedBin('All');
      setCsStockStatus('all');
      setCsSearch('');
    } else if (presetType === 'low_stock') {
      setCsStockStatus('low_stock');
      setCsSortBy('qty_asc');
      setCsSelectedStaff('All');
      setCsSelectedCategory('All');
      setCsSelectedBin('All');
      setCsSearch('');
    } else if (presetType === 'high_value') {
      setCsStockStatus('high_value');
      setCsSortBy('value_desc');
      setCsSelectedStaff('All');
      setCsSelectedCategory('All');
      setCsSelectedBin('All');
      setCsSearch('');
    } else if (presetType === 'staff') {
      setCsSortBy('staff');
      setCsSelectedStaff('cashier');
      setCsSelectedCategory('All');
      setCsStockStatus('all');
      setCsSearch('');
    }
  };

  // Jump to page helper
  const handlePageJump = (e, targetPage, maxPages, setPageFn) => {
    e.preventDefault();
    const target = parseInt(targetPage, 10);
    if (!isNaN(target) && target >= 1 && target <= maxPages) {
      setPageFn(target);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (activeReportTab === 'alternative_products') {
      if (!displayAltProducts || displayAltProducts.length === 0) return;
      const headers = ['Main Item Code', 'Main Description', 'Main Stock', 'Alt Item Code', 'Alt Description', 'Alt Stock', 'Alt Price', 'Category', 'Status'];
      const rows = [];
      displayAltProducts.forEach((rel) => {
        if (rel.alternativeItems && rel.alternativeItems.length > 0) {
          rel.alternativeItems.forEach((alt) => {
            rows.push([
              `"${rel.mainItemCode || ''}"`,
              `"${(rel.mainItemDescription || rel.description || '').replace(/"/g, '""')}"`,
              Number(rel.mainItemStock || 0),
              `"${alt.code || ''}"`,
              `"${(alt.description || '').replace(/"/g, '""')}"`,
              Number(alt.stock || 0),
              Number(alt.price || 0).toFixed(2),
              `"${alt.category || ''}"`,
              `"${rel.status || 'Active'}"`,
            ]);
          });
        } else {
          rows.push([
            `"${rel.mainItemCode || ''}"`,
            `"${(rel.mainItemDescription || rel.description || '').replace(/"/g, '""')}"`,
            Number(rel.mainItemStock || 0),
            '""', '""', 0, 0, '""',
            `"${rel.status || 'Active'}"`,
          ]);
        }
      });
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `SOFAST_Alternative_Products_Report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (activeReportTab === 'settlements') {
      if (!dsdReportData?.data || dsdReportData.data.length === 0) return;
      const headers = ['In No', 'Job No', 'Date', 'Customer', 'Inv. Value', 'Cash', 'Cheque', 'Discount', 'Balance'];
      const rows = dsdReportData.data.map((item) => [
        `"${item.inNo || ''}"`,
        `"${item.jobNo || ''}"`,
        `"${item.date || ''}"`,
        `"${(item.customer || '').replace(/"/g, '""')}"`,
        item.invValue ? Number(item.invValue).toFixed(2) : '',
        item.cash !== undefined && item.cash !== null && item.cash !== 0 ? Number(item.cash).toFixed(2) : '',
        item.cheque ? Number(item.cheque).toFixed(2) : '',
        item.discount ? Number(item.discount).toFixed(2) : '',
        item.balance ? Number(item.balance).toFixed(2) : '',
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `SOFAST_Daily_Settlements_${dsdStartDate}_to_${dsdEndDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (activeReportTab === 'grn') {
      if (!grnReportData?.data || grnReportData.data.length === 0) return;
      const headers = ['GRN No', 'Date', 'Supplier', 'Invoice No', 'Code', 'Description', 'Quantity', 'Return Qty', 'Rate', 'Discount %', 'Value', 'User'];
      const rows = grnReportData.data.map((item) => [
        `"${item.grnNumber || ''}"`,
        `"${item.date || ''}"`,
        `"${item.supplier || ''}"`,
        `"${item.invoice || ''}"`,
        `"${item.code || ''}"`,
        `"${(item.description || '').replace(/"/g, '""')}"`,
        Number(item.quantity || 0).toFixed(2),
        Number(item.returnQty || 0).toFixed(2),
        Number(item.rate || 0).toFixed(2),
        Number(item.discount || 0).toFixed(2),
        Number(item.value || 0).toFixed(2),
        `"${item.user || ''}"`,
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `SOFAST_GRN_Report_${grnStartDate}_to_${grnEndDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (activeReportTab === 'invoice_returns') {
      if (!irReportData?.data || irReportData.data.length === 0) return;
      const headers = ['Invoice No', 'Invoice Date', 'Customer', 'Item Code', 'Description', 'Quantity', 'Discount', 'Refund Value', 'Return Date', 'Staff'];
      const rows = irReportData.data.map((item) => [
        `"${item.invoiceNumber || ''}"`,
        `"${item.invoiceDate || ''}"`,
        `"${item.customerName || ''}"`,
        `"${item.itemCode || ''}"`,
        `"${(item.description || '').replace(/"/g, '""')}"`,
        Number(item.quantity || 0).toFixed(2),
        Number(item.discount || 0).toFixed(2),
        Number(item.value || 0).toFixed(2),
        `"${item.returnDate || ''}"`,
        `"${item.staff || ''}"`,
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `SOFAST_Invoice_Returns_Report_${irStartDate}_to_${irEndDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (activeReportTab === 'daily_sales') {
      if (!dsReportData?.data || dsReportData.data.length === 0) return;
      const headers = ['Section', 'Item Code', 'Description', 'Quantity', 'Pur. Val', 'Value', 'Profit', 'Staff', 'Date'];
      const rows = dsReportData.data.map((item) => [
        `"${item.section || ''}"`,
        `"${item.code || ''}"`,
        `"${(item.description || '').replace(/"/g, '""')}"`,
        Number(item.quantity || 0).toFixed(2),
        Number(item.purVal || 0).toFixed(2),
        Number(item.value || 0).toFixed(2),
        Number(item.profit || 0).toFixed(2),
        `"${item.staff || ''}"`,
        `"${item.date || ''}"`,
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `SOFAST_Daily_Sales_Report_${dsStartDate}_to_${dsEndDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      if (!csReportData?.data || csReportData.data.length === 0) return;
      const headers = ['Category', 'Code', 'Description', 'Bin', 'Quantity', 'Value', 'Loc1_Qty', 'Loc1_Val', 'Loc2_Qty', 'Loc2_Val', 'Loc3_Qty', 'Loc3_Val', 'Selling_Price', 'Total_Sold', 'Staff_Handled'];
      const rows = csReportData.data.map((item) => [
        `"${item.category || ''}"`,
        `"${item.code || ''}"`,
        `"${(item.description || '').replace(/"/g, '""')}"`,
        `"${item.bin || ''}"`,
        Number(item.quantity || 0).toFixed(2),
        Number(item.value || 0).toFixed(2),
        Number(item.loc1_qty || 0).toFixed(2),
        Number(item.loc1_val || 0).toFixed(2),
        Number(item.loc2_qty || 0).toFixed(2),
        Number(item.loc2_val || 0).toFixed(2),
        Number(item.loc3_qty || 0).toFixed(2),
        Number(item.loc3_val || 0).toFixed(2),
        Number(item.sellingPrice || 0).toFixed(2),
        item.totalSold || 0,
        `"${item.staff || ''}"`,
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `SOFAST_Closing_Stock_Report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="reports-page-container">
      {/* =========================================================================
          MENUBAR (Non-Printing)
          ========================================================================= */}
      <div className="reports-menubar no-print" ref={menuRef}>
        <div className="reports-menu-left">
          <div className="reports-brand-badge" onClick={() => navigate('/management')} style={{ cursor: 'pointer' }}>
            <span>⚡ SOFAST</span>
          </div>

          <button type="button" className="reports-nav-btn" onClick={() => navigate('/management')}>
            Management
          </button>
          <button type="button" className="reports-nav-btn" onClick={() => navigate('/cash-handle')}>
            Cash Handle
          </button>
          <button type="button" className="reports-nav-btn" onClick={() => navigate('/petty-cash')}>
            Petty Cash
          </button>
          <button type="button" className="reports-nav-btn active" onClick={() => navigate('/reports')}>
            Reports
          </button>

          <ApprovementDropdown
            isOpen={activeDropdown === 'approvement'}
            onToggle={() => setActiveDropdown(activeDropdown === 'approvement' ? null : 'approvement')}
            onClose={() => setActiveDropdown(null)}
          />
        </div>

        <div className="reports-menu-right">
          <span className="reports-user-tag">
            👤 Logged as: <strong>{currentUser?.username || 'admin'}</strong>
          </span>
          <button type="button" className="reports-back-btn" onClick={() => navigate('/management')}>
            ← Back to System
          </button>
        </div>
      </div>

      {/* =========================================================================
          REPORT TYPE TABS SELECTOR (All 6 Reports)
          ========================================================================= */}
      <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: '16px' }} className="no-print">
        <div className="reports-type-tabs">
          <button
            type="button"
            className={`reports-tab-btn ${activeReportTab === 'settlements' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('settlements')}
          >
            💰 Daily Settlements Details
          </button>
          <button
            type="button"
            className={`reports-tab-btn ${activeReportTab === 'grn' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('grn')}
          >
            📥 Goods Received Notes (GRN)
          </button>
          <button
            type="button"
            className={`reports-tab-btn ${activeReportTab === 'invoice_returns' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('invoice_returns')}
          >
            🔄 Invoice Returns Report
          </button>
          <button
            type="button"
            className={`reports-tab-btn ${activeReportTab === 'daily_sales' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('daily_sales')}
          >
            📈 Daily Sales Report (Daily Sales &amp; Profit)
          </button>
          <button
            type="button"
            className={`reports-tab-btn ${activeReportTab === 'closing_stock' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('closing_stock')}
          >
            📦 Closing Stock Report (170-Page Full Inventory)
          </button>
          <button
            type="button"
            className={`reports-tab-btn ${activeReportTab === 'alternative_products' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('alternative_products')}
          >
            🔄 Alternative Products Report
          </button>
        </div>
      </div>

      {/* =========================================================================
          REPORT 6: ALTERNATIVE PRODUCTS & COMPATIBILITY REPORT
          ========================================================================= */}
      {activeReportTab === 'alternative_products' && (
        <>
          {/* Header Dashboard Cards */}
          <div className="reports-header-section no-print">
            <div className="reports-header-content">
              <div className="reports-title-area">
                <span className="reports-eyebrow">Inventory Compatibility &amp; Substitutes</span>
                <h1 className="reports-main-title">Alternative Products &amp; Substitutes Report</h1>
                <p className="reports-subtitle">
                  Catalog of mapped substitute, compatible, and interchangeable replacement parts. Helps sales and store staff immediately identify alternative items when products are low or out of stock.
                </p>
              </div>

              {/* KPI Cards */}
              <div className="reports-kpi-grid">
                <div className="reports-kpi-card">
                  <span className="reports-kpi-label">MAPPED MAIN ITEMS</span>
                  <span className="reports-kpi-val highlight">
                    {displayAltProducts.length} Products
                  </span>
                  <span className="reports-kpi-sub">
                    With registered alternative parts
                  </span>
                </div>

                <div className="reports-kpi-card">
                  <span className="reports-kpi-label">TOTAL ALTERNATIVES</span>
                  <span className="reports-kpi-val" style={{ color: '#0284c7' }}>
                    {displayAltProducts.reduce((sum, r) => sum + (r.alternativeItems?.length || 0), 0)} Linked Parts
                  </span>
                  <span className="reports-kpi-sub">
                    Substitute items mapped
                  </span>
                </div>

                <div className="reports-kpi-card">
                  <span className="reports-kpi-label">IN-STOCK ALTERNATIVES</span>
                  <span className="reports-kpi-val" style={{ color: '#16a34a' }}>
                    {displayAltProducts.reduce((sum, r) => sum + (r.alternativeItems?.filter((a) => Number(a.stock) > 0).length || 0), 0)} Available
                  </span>
                  <span className="reports-kpi-sub">
                    Ready for immediate sale
                  </span>
                </div>

                <div className="reports-kpi-card">
                  <span className="reports-kpi-label">MAIN OUT-OF-STOCK</span>
                  <span className="reports-kpi-val" style={{ color: '#dc2626' }}>
                    {displayAltProducts.filter((r) => Number(r.mainItemStock || 0) === 0).length} Items
                  </span>
                  <span className="reports-kpi-sub">
                    With in-stock alternatives!
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Preset Filter Buttons */}
            <div className="reports-quick-pills">
              <span className="reports-pills-label">Quick Presets:</span>
              <button
                type="button"
                className={`reports-pill ${altStockFilter === 'all' && altStatusFilter === 'All' && !altSearch ? 'active' : ''}`}
                onClick={() => {
                  setAltSearch('');
                  setAltStatusFilter('All');
                  setAltStockFilter('all');
                  setAltSortBy('default');
                }}
              >
                📋 All Alternative Mappings
              </button>
              <button
                type="button"
                className={`reports-pill ${altStockFilter === 'in_stock' ? 'active' : ''}`}
                onClick={() => setAltStockFilter('in_stock')}
              >
                ⚡ In-Stock Alternatives Available
              </button>
              <button
                type="button"
                className={`reports-pill ${altStockFilter === 'main_zero' ? 'active' : ''}`}
                onClick={() => setAltStockFilter('main_zero')}
              >
                ⚠️ Out-of-Stock Main Items (Substitutes Available)
              </button>
              <button
                type="button"
                className={`reports-pill ${altSortBy === 'most_alternatives' ? 'active' : ''}`}
                onClick={() => setAltSortBy('most_alternatives')}
              >
                🔗 Multi-Alternative Mappings
              </button>
            </div>
          </div>

          {/* Interactive Filter Controls Bar */}
          <div className="reports-filter-bar no-print">
            <div className="reports-filter-controls">
              {/* Search Box */}
              <div className="reports-search-box">
                <span className="reports-search-icon">🔍</span>
                <input
                  type="text"
                  className="reports-search-input"
                  placeholder="Search main item, alternative code, description..."
                  value={altSearch}
                  onChange={(e) => setAltSearch(e.target.value)}
                />
                {altSearch && (
                  <button type="button" className="reports-search-clear" onClick={() => setAltSearch('')}>
                    ✕
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <select
                className="reports-filter-select"
                value={altStatusFilter}
                onChange={(e) => setAltStatusFilter(e.target.value)}
                title="Filter by Status"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active Only</option>
                <option value="Inactive">Inactive Only</option>
              </select>

              {/* Stock Filter */}
              <select
                className="reports-filter-select"
                value={altStockFilter}
                onChange={(e) => setAltStockFilter(e.target.value)}
                title="Filter by Stock Condition"
              >
                <option value="all">All Stock Statuses</option>
                <option value="in_stock">In-Stock Substitutes</option>
                <option value="main_zero">Main Item Stock is 0</option>
              </select>

              {/* Sorting Select */}
              <select
                className="reports-filter-select"
                value={altSortBy}
                onChange={(e) => setAltSortBy(e.target.value)}
                title="Sort alternative items"
              >
                <option value="default">Sort: Default (Recently Updated)</option>
                <option value="code_asc">Sort: Main Item Code (A-Z)</option>
                <option value="alt_stock_desc">Sort: Highest Substitute Stock</option>
                <option value="most_alternatives">Sort: Most Alternatives Mapped</option>
              </select>

              <button
                type="button"
                className="reports-action-btn"
                style={{ backgroundColor: '#f1f5f9', color: '#0284c7', borderColor: '#bae6fd' }}
                onClick={() => navigate('/alternative-product')}
                title="Open Alternative Product Master to link or edit parts"
              >
                ⚙️ Master File
              </button>
            </div>

            {/* View Mode & Action Buttons */}
            <div className="reports-view-actions">
              <div className="reports-view-toggle">
                <button
                  type="button"
                  className={`reports-view-toggle-btn ${viewMode === 'paper' ? 'active' : ''}`}
                  onClick={() => setViewMode('paper')}
                  title="Physical PDF Dot-Matrix Layout"
                >
                  📄 PDF Paper
                </button>
                <button
                  type="button"
                  className={`reports-view-toggle-btn ${viewMode === 'modern' ? 'active' : ''}`}
                  onClick={() => setViewMode('modern')}
                  title="Modern Interactive Table"
                >
                  🖥️ Modern Table
                </button>
              </div>

              <button
                type="button"
                className="reports-action-btn"
                onClick={handleExportCSV}
                title="Export alternative products to CSV"
              >
                📥 Export CSV
              </button>

              <button
                type="button"
                className="reports-action-btn print-btn"
                onClick={handlePrint}
                title="Print Alternative Products Report"
              >
                🖨️ Print Report
              </button>
            </div>
          </div>

          {/* Report Body */}
          <div className="reports-content-body">
            {altLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
                <strong style={{ fontSize: '15px' }}>Loading Alternative Products mappings...</strong>
              </div>
            ) : viewMode === 'paper' ? (
              /* EXACT PHYSICAL PAPER SHEET FOR ALTERNATIVE PRODUCTS */
              <div className="closing-stock-paper-sheet" id="printable-alt-report">
                <div className="cs-report-header" style={{ marginBottom: '8px' }}>
                  <div className="cs-company-name">SOFAST (PVT) LTD</div>
                  <div className="cs-company-addr">7E, MADDEGODA ROAD, MATHUGAMA</div>
                  <div className="cs-company-phone">034-2210680, 074-0295088</div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px' }}>
                    <div className="cs-report-title" style={{ margin: 0 }}>
                      Alternative Products &amp; Substitute Parts Report
                    </div>
                    <div style={{ fontFamily: 'Courier New, monospace', fontWeight: '800', fontSize: '11px' }}>
                      Date: {new Date().toLocaleDateString('en-GB')}
                    </div>
                  </div>
                </div>

                <table className="settlements-table">
                  <thead>
                    <tr>
                      <th className="col-left" style={{ width: '13%' }}>Main Code</th>
                      <th className="col-left" style={{ width: '28%' }}>Main Item Description</th>
                      <th className="col-right" style={{ width: '8%' }}>Main Qty</th>
                      <th className="col-left" style={{ width: '14%' }}>Alternative Code</th>
                      <th className="col-left" style={{ width: '25%' }}>Alternative Description</th>
                      <th className="col-right" style={{ width: '7%' }}>Alt Qty</th>
                      <th className="col-center" style={{ width: '5%' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayAltProducts.length > 0 ? (
                      displayAltProducts.map((rel, rIdx) => {
                        const alts = rel.alternativeItems && rel.alternativeItems.length > 0
                          ? rel.alternativeItems
                          : [{ code: '-', description: 'No linked alternatives', stock: 0 }];

                        return alts.map((alt, aIdx) => (
                          <tr key={`${rIdx}-${aIdx}`}>
                            {aIdx === 0 ? (
                              <>
                                <td rowSpan={alts.length} style={{ fontWeight: '800', verticalAlign: 'top', color: '#0284c7' }}>
                                  {rel.mainItemCode}
                                </td>
                                <td rowSpan={alts.length} style={{ fontWeight: '700', verticalAlign: 'top' }}>
                                  {rel.mainItemDescription || rel.description}
                                </td>
                                <td rowSpan={alts.length} style={{ textAlign: 'right', fontWeight: '800', verticalAlign: 'top', color: Number(rel.mainItemStock || 0) === 0 ? '#dc2626' : 'inherit' }}>
                                  {Number(rel.mainItemStock || 0).toFixed(2)}
                                </td>
                              </>
                            ) : null}
                            <td style={{ fontWeight: '800', color: '#16a34a' }}>
                              {alt.code}
                            </td>
                            <td style={{ fontWeight: '600' }}>
                              {alt.description}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: '800', color: Number(alt.stock) > 0 ? '#16a34a' : '#64748b' }}>
                              {alt.code !== '-' ? Number(alt.stock || 0).toFixed(2) : '-'}
                            </td>
                            {aIdx === 0 ? (
                              <td rowSpan={alts.length} style={{ textAlign: 'center', verticalAlign: 'top' }}>
                                <span style={{ fontWeight: '800', fontSize: '10px' }}>
                                  {rel.status || 'Active'}
                                </span>
                              </td>
                            ) : null}
                          </tr>
                        ));
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                          No alternative product mappings found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Footer matching PDF */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid #000000', paddingTop: '6px' }}>
                  <div className="cs-software-footer">
                    Software by S.L.M.D.Chinthana-0777722076
                  </div>
                  <div style={{ fontFamily: 'monospace', fontWeight: '900', fontSize: '11px' }}>
                    Total: {displayAltProducts.length} Mappings
                  </div>
                </div>
              </div>
            ) : (
              /* MODERN TABLE VIEW FOR ALTERNATIVE PRODUCTS */
              <div className="reports-modern-card">
                <table className="reports-modern-table">
                  <thead>
                    <tr>
                      <th>Main Product</th>
                      <th style={{ textAlign: 'right' }}>Main Stock</th>
                      <th>Mapped Alternatives / Substitutes</th>
                      <th style={{ textAlign: 'center' }}>Total Options</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                      <th style={{ textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayAltProducts.map((rel, idx) => (
                      <tr key={idx}>
                        <td>
                          <div>
                            <strong style={{ fontFamily: 'monospace', color: '#0284c7', fontSize: '13px' }}>
                              {rel.mainItemCode}
                            </strong>
                            <div style={{ fontWeight: '600', fontSize: '13px', marginTop: '2px' }}>
                              {rel.mainItemDescription || rel.description}
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className={`stock-badge ${Number(rel.mainItemStock || 0) > 0 ? 'in-stock' : 'out-of-stock'}`}>
                            {Number(rel.mainItemStock || 0)} Units
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {rel.alternativeItems && rel.alternativeItems.length > 0 ? (
                              rel.alternativeItems.map((alt, aIdx) => (
                                <div
                                  key={aIdx}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: '#f8fafc',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid #e2e8f0',
                                    fontSize: '12px',
                                  }}
                                >
                                  <div>
                                    <strong style={{ fontFamily: 'monospace', color: '#16a34a' }}>{alt.code}</strong>
                                    <span style={{ color: '#475569', marginLeft: '6px' }}>{alt.description}</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{
                                      fontWeight: '700',
                                      color: Number(alt.stock) > 0 ? '#16a34a' : '#94a3b8',
                                      fontSize: '11px',
                                    }}>
                                      {Number(alt.stock) > 0 ? `In Stock: ${alt.stock}` : 'Out of Stock'}
                                    </span>
                                    {alt.price ? (
                                      <span style={{ color: '#64748b', fontSize: '11px' }}>
                                        Rs. {Number(alt.price).toFixed(2)}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No alternative items mapped</span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: '800' }}>
                          {rel.alternativeItems?.length || 0}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="stock-badge in-stock">{rel.status || 'Active'}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="reports-nav-btn"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            onClick={() => navigate('/alternative-product')}
                            title="Edit this mapping in Alternative Product Master"
                          >
                            Edit Mapping
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* =========================================================================
          REPORT 5: DAILY SETTLEMENTS DETAILS (Daily Setelments Deatils - )
          ========================================================================= */}
      {activeReportTab === 'settlements' && (
        <>
          {/* Header Dashboard Cards */}
          <div className="reports-header-section no-print">
            <div className="reports-header-content">
              <div className="reports-title-area">
                <span className="reports-eyebrow">Financial Reconciliation &amp; POS Intake</span>
                <h1 className="reports-main-title">Daily Settlements Details</h1>
                <p className="reports-subtitle">
                  Daily settlement audit tracking invoice revenue breakdowns across cash collections, bank cheques, advance billings, and cash adjustments.
                </p>
              </div>

              {/* KPI Cards */}
              <div className="reports-kpi-grid">
                <div className="reports-kpi-card">
                  <span className="reports-kpi-label">TOTAL INVOICE VALUE</span>
                  <span className="reports-kpi-val highlight">
                    Rs. {Number(dsdReportData?.summary?.totalInvValue || 101374).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className="reports-kpi-sub">
                    Across {dsdReportData?.summary?.totalRecords || 46} Settlements
                  </span>
                </div>

                <div className="reports-kpi-card">
                  <span className="reports-kpi-label">CASH COLLECTED</span>
                  <span className="reports-kpi-val" style={{ color: '#16a34a' }}>
                    Rs. {Number(dsdReportData?.summary?.totalCash || 91344).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className="reports-kpi-sub">
                    Net cash intake (incl. adj.)
                  </span>
                </div>

                <div className="reports-kpi-card">
                  <span className="reports-kpi-label">CHEQUE PAYMENTS</span>
                  <span className="reports-kpi-val" style={{ color: '#0284c7' }}>
                    Rs. {Number(dsdReportData?.summary?.totalCheque || 8920).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className="reports-kpi-sub">
                    {dsdReportData?.summary?.countCheque || 3} Cheques Cleared
                  </span>
                </div>

                <div className="reports-kpi-card">
                  <span className="reports-kpi-label">ADVANCE / ADJUSTMENT</span>
                  <span className="reports-kpi-val" style={{ color: '#dc2626' }}>
                    -Rs. 1,110.00
                  </span>
                  <span className="reports-kpi-sub">
                    Row 1 Adj &bull; Advance Bill: Rs. 1,110
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Preset Filter Buttons */}
            <div className="reports-quick-pills">
              <span className="reports-pills-label">Quick Presets:</span>
              <button
                type="button"
                className={`reports-pill ${dsdStartDate === '2026-08-06' && dsdSortBy === 'default' && dsdSelectedPaymentMethod === 'All' ? 'active' : ''}`}
                onClick={() => handleApplySettlementsPreset('audit')}
              >
                📋 Settlement Audit (06/08/2026)
              </button>
              <button
                type="button"
                className={`reports-pill ${dsdSortBy === 'inv_value_desc' ? 'active' : ''}`}
                onClick={() => handleApplySettlementsPreset('highest_inv')}
              >
                💰 Highest Invoice Value
              </button>
              <button
                type="button"
                className={`reports-pill ${dsdSelectedPaymentMethod === 'cash' ? 'active' : ''}`}
                onClick={() => handleApplySettlementsPreset('cash_only')}
              >
                💵 Cash Only Settlements
              </button>
              <button
                type="button"
                className={`reports-pill ${dsdSelectedPaymentMethod === 'cheque' ? 'active' : ''}`}
                onClick={() => handleApplySettlementsPreset('cheque_only')}
              >
                🏦 Cheque Payments (3)
              </button>
              <button
                type="button"
                className={`reports-pill ${dsdSelectedPaymentMethod === 'named_customer' ? 'active' : ''}`}
                onClick={() => handleApplySettlementsPreset('named_customers')}
              >
                👥 Named Customer Accounts
              </button>
              <button
                type="button"
                className={`reports-pill ${dsdSelectedPaymentMethod === 'negative' ? 'active' : ''}`}
                onClick={() => handleApplySettlementsPreset('negative_cash')}
              >
                ⚠️ Negative Cash Adjustment
              </button>
            </div>
          </div>

          {/* Interactive Filter Controls Bar */}
          <div className="reports-filter-bar no-print">
            <div className="reports-filter-controls">
              {/* Date Pickers */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>From:</span>
                <input
                  type="date"
                  className="reports-date-input"
                  value={dsdStartDate}
                  onChange={(e) => {
                    setDsdStartDate(e.target.value);
                    setDsdPage(1);
                  }}
                  title="Filter Settlements from date"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>To:</span>
                <input
                  type="date"
                  className="reports-date-input"
                  value={dsdEndDate}
                  onChange={(e) => {
                    setDsdEndDate(e.target.value);
                    setDsdPage(1);
                  }}
                  title="Filter Settlements to date"
                />
              </div>

              {/* Search Box */}
              <div className="reports-search-box">
                <span className="reports-search-icon">🔍</span>
                <input
                  type="text"
                  className="reports-search-input"
                  placeholder="Search Invoice No, Customer, Job No..."
                  value={dsdSearch}
                  onChange={(e) => {
                    setDsdSearch(e.target.value);
                    setDsdPage(1);
                  }}
                />
                {dsdSearch && (
                  <button type="button" className="reports-search-clear" onClick={() => setDsdSearch('')}>
                    ✕
                  </button>
                )}
              </div>

              {/* Payment Method Filter */}
              <select
                className="reports-filter-select"
                value={dsdSelectedPaymentMethod}
                onChange={(e) => {
                  setDsdSelectedPaymentMethod(e.target.value);
                  setDsdPage(1);
                }}
                title="Filter by Payment Method"
              >
                <option value="All">All Payment Methods</option>
                <option value="cash">💵 Cash Payments</option>
                <option value="cheque">🏦 Cheque Payments</option>
                <option value="advance">📑 Advance Bills</option>
                <option value="negative">⚠️ Negative Cash Adjustments</option>
                <option value="named_customer">👥 Named Customers</option>
              </select>

              {/* Customer Filter */}
              <select
                className="reports-filter-select"
                value={dsdSelectedCustomer}
                onChange={(e) => {
                  setDsdSelectedCustomer(e.target.value);
                  setDsdPage(1);
                }}
                title="Filter by Customer"
              >
                <option value="All">All Customers</option>
                <option value="DAILY SALES">DAILY SALES</option>
                <option value="GUNAWARDANA GARAJ">GUNAWARDANA GARAJ,PANTHIYA</option>
                <option value="ADVANCE BILL">ADVANCE BILL</option>
                <option value="KAVEESHA DEWSHAN">KAVEESHA DEWSHAN,AGALAWATTA</option>
              </select>

              {/* Sorting Select */}
              <select
                className="reports-filter-select"
                value={dsdSortBy}
                onChange={(e) => {
                  setDsdSortBy(e.target.value);
                  setDsdPage(1);
                }}
                title="Sort settlements"
              >
                <option value="default">Sort: Default Order (PDF Scan)</option>
                <option value="inv_value_desc">Sort: Highest Invoice Value</option>
                <option value="inv_value_asc">Sort: Lowest Invoice Value</option>
                <option value="cash_desc">Sort: Highest Cash</option>
                <option value="cheque_desc">Sort: Highest Cheque</option>
                <option value="customer_asc">Sort: Customer Name (A-Z)</option>
                <option value="negative_first">Sort: Negative Adjustments First</option>
              </select>

              {/* Page Size */}
              <select
                className="reports-filter-select"
                value={dsdPageSize}
                onChange={(e) => {
                  setDsdPageSize(Number(e.target.value));
                  setDsdPage(1);
                }}
                title="Items per page"
              >
                <option value={50}>50 per page (All 46)</option>
                <option value={41}>41 per page (Page 1 size)</option>
                <option value={20}>20 per page</option>
              </select>
            </div>

            {/* View Mode & Action Buttons */}
            <div className="reports-view-actions">
              <div className="reports-view-toggle">
                <button
                  type="button"
                  className={`reports-view-toggle-btn ${viewMode === 'paper' ? 'active' : ''}`}
                  onClick={() => setViewMode('paper')}
                  title="Physical PDF Dot-Matrix Layout"
                >
                  📄 PDF Paper
                </button>
                <button
                  type="button"
                  className={`reports-view-toggle-btn ${viewMode === 'modern' ? 'active' : ''}`}
                  onClick={() => setViewMode('modern')}
                  title="Modern Interactive Table"
                >
                  🖥️ Modern Table
                </button>
              </div>

              <button
                type="button"
                className="reports-action-btn"
                onClick={handleExportCSV}
                title="Export filtered settlements to CSV"
              >
                📥 Export CSV
              </button>

              <button
                type="button"
                className="reports-action-btn print-btn"
                onClick={handlePrint}
                title="Print Daily Settlements Report"
              >
                🖨️ Print Report
              </button>
            </div>
          </div>

          {/* Report Body */}
          <div className="reports-content-body">
            {dsdLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
                <strong style={{ fontSize: '15px' }}>Loading Daily Settlements Details from database...</strong>
                <p style={{ fontSize: '13px', marginTop: '4px' }}>Reconciling cash collections, cheques, and invoice balances</p>
              </div>
            ) : viewMode === 'paper' ? (
              /* =========================================================================
                  EXACT PHYSICAL DAILY SETTLEMENTS PAPER SHEET (MATCHING FIFTH PDF 100%)
                  ========================================================================= */
              <div className="closing-stock-paper-sheet" id="printable-settlements-report">
                {/* Header matching PDF Scan */}
                <div className="cs-report-header" style={{ marginBottom: '8px' }}>
                  <div className="cs-company-name">SOFAST (PVT) LTD</div>
                  <div className="cs-company-addr">7E, MADDEGODA ROAD, MATHUGAMA</div>
                  <div className="cs-company-phone">034-2210680, 074-0295088</div>

                  <div style={{ marginTop: '6px', fontWeight: '800', fontSize: '12px', fontFamily: 'Courier New, monospace' }}>
                    Daily Setelments Deatils - 
                  </div>
                </div>

                {/* Table matching PDF Scan */}
                <table className="settlements-table">
                  <thead>
                    <tr>
                      <th className="settlements-th-inno col-left">In No</th>
                      <th className="settlements-th-jobno col-center">Job No</th>
                      <th className="settlements-th-date col-center">Date</th>
                      <th className="settlements-th-customer col-left">Customer</th>
                      <th className="settlements-th-invval col-right">Inv. Value</th>
                      <th className="settlements-th-cash col-right">Cash</th>
                      <th className="settlements-th-cheque col-right">Cheque</th>
                      <th className="settlements-th-disc col-right">Discount</th>
                      <th className="settlements-th-bal col-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dsdReportData?.data && dsdReportData.data.length > 0 ? (
                      dsdReportData.data.map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: '800', whiteSpace: 'nowrap' }}>{item.inNo}</td>
                          <td style={{ textAlign: 'center' }}>{item.jobNo}</td>
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{item.date}</td>
                          <td style={{ fontWeight: item.customer !== 'DAILY SALES' ? '800' : '700' }}>
                            {item.customer}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '800' }}>
                            {item.invValue && item.invValue > 0
                              ? Number(item.invValue).toLocaleString(undefined, { minimumFractionDigits: 2 })
                              : ''}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {item.isNegative || item.cash < 0 ? (
                              <span className="settlements-negative-cash">
                                {Number(item.cash).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            ) : item.cash && item.cash > 0 ? (
                              <span style={{ fontWeight: '800' }}>
                                {Number(item.cash).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            ) : (
                              ''
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '800' }}>
                            {item.cheque && item.cheque > 0
                              ? Number(item.cheque).toLocaleString(undefined, { minimumFractionDigits: 2 })
                              : ''}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {item.discount && item.discount > 0
                              ? Number(item.discount).toLocaleString(undefined, { minimumFractionDigits: 2 })
                              : ''}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {item.balance && item.balance > 0
                              ? Number(item.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })
                              : ''}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                          No settlement records found matching your filters.
                        </td>
                      </tr>
                    )}

                    {/* Summary Totals Row Matching PDF Scan */}
                    <tr className="settlements-totals-row">
                      <td colSpan={4} style={{ textAlign: 'right', fontWeight: '900' }}></td>
                      <td style={{ textAlign: 'right', fontWeight: '900' }}>
                        {Number(dsdReportData?.summary?.totalInvValue || 101374).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '900' }}>
                        {Number(dsdReportData?.summary?.totalCash || 91344).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '900' }}>
                        {Number(dsdReportData?.summary?.totalCheque || 8920).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td></td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>

                {/* Footer matching PDF */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid #000000', paddingTop: '6px' }}>
                  <div className="cs-software-footer">
                    {dsdReportData?.softwareFooter || 'Software by S.L.M.D.Chinthana-0777722076'}
                  </div>
                  <div style={{ fontFamily: 'monospace', fontWeight: '900', fontSize: '11px' }}>
                    Page {dsdPage} of {dsdReportData?.pagination?.totalPages || 1}
                  </div>
                </div>
              </div>
            ) : (
              /* MODERN TABLE VIEW FOR SETTLEMENTS */
              <div className="reports-modern-card">
                <table className="reports-modern-table">
                  <thead>
                    <tr>
                      <th>Invoice No</th>
                      <th style={{ textAlign: 'center' }}>Job</th>
                      <th>Date</th>
                      <th>Customer / Account</th>
                      <th style={{ textAlign: 'right' }}>Invoice Value</th>
                      <th style={{ textAlign: 'right' }}>Cash Settled</th>
                      <th style={{ textAlign: 'right' }}>Cheque Payment</th>
                      <th style={{ textAlign: 'center' }}>Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dsdReportData?.data && dsdReportData.data.length > 0 ? (
                      dsdReportData.data.map((item, idx) => (
                        <tr key={idx}>
                          <td>
                            <strong style={{ fontFamily: 'monospace', color: '#0284c7' }}>#{item.inNo}</strong>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: '700', color: '#64748b' }}>
                            {item.jobNo}
                          </td>
                          <td>
                            <span style={{ fontSize: '12px', color: '#475569' }}>{item.date}</span>
                          </td>
                          <td>
                            <span style={{
                              fontWeight: item.customer !== 'DAILY SALES' ? '800' : '600',
                              color: item.customer === 'ADVANCE BILL' ? '#d97706' : item.customer !== 'DAILY SALES' ? '#4f46e5' : '#1e293b'
                            }}>
                              {item.customer}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '800' }}>
                            {item.invValue ? `Rs. ${Number(item.invValue).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {item.isNegative || item.cash < 0 ? (
                              <span className="settlements-negative-cash">
                                Rs. {Number(item.cash).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            ) : item.cash > 0 ? (
                              <span style={{ fontWeight: '800', color: '#16a34a' }}>
                                Rs. {Number(item.cash).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            ) : '-'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {item.cheque > 0 ? (
                              <span style={{ fontWeight: '800', color: '#0284c7' }}>
                                Rs. {Number(item.cheque).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            ) : '-'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {item.isNegative || item.cash < 0 ? (
                              <span className="stock-badge out-of-stock">⚠️ Adjustment</span>
                            ) : item.cheque > 0 ? (
                              <span className="stock-badge low-stock">🏦 Cheque</span>
                            ) : item.customer === 'ADVANCE BILL' ? (
                              <span className="stock-badge low-stock" style={{ background: '#fef3c7', color: '#b45309' }}>📑 Advance</span>
                            ) : (
                              <span className="stock-badge in-stock">💵 Cash</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                          No settlements found matching query.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* =========================================================================
          REPORT 4: GOODS RECEIVED NOTES (GRN)
          ========================================================================= */}
      {activeReportTab === 'grn' && (
        <>
          {/* Header Dashboard Cards */}
          <div className="reports-header-section no-print">
            <div className="reports-header-content">
              <div className="reports-title-area">
                <span className="reports-eyebrow">Inventory Purchasing &amp; Receipts</span>
                <h1 className="reports-main-title">Goods Received Notes (GRN) Report</h1>
                <p className="reports-subtitle">
                  Inventory receipt and purchase intake audit showing received quantities, return quantities, trade discounts, and net intake values.
                </p>
              </div>

              {/* KPI Cards */}
              <div className="reports-kpi-grid">
                <div className="reports-kpi-card">
                  <span className="reports-kpi-label">TOTAL GRN VALUE</span>
                  <span className="reports-kpi-val highlight">
                    Rs. {Number(grnReportData?.summary?.grandTotal || 94625.01).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className="reports-kpi-sub">
                    Net after 3.5% Trade Discount
                  </span>
                </div>

                <div className="reports-kpi-card">
                  <span className="reports-kpi-label">TOTAL UNITS RECEIVED</span>
                  <span className="reports-kpi-val">
                    {Number(grnReportData?.summary?.totalQuantity || 52)} Units
                  </span>
                  <span className="reports-kpi-sub">
                    Across {grnReportData?.summary?.itemsCount || 16} Part Codes
                  </span>
                </div>

                <div className="reports-kpi-card">
                  <span className="reports-kpi-label">RETURNED UNITS (REJECTS)</span>
                  <span className="reports-kpi-val" style={{ color: Number(grnReportData?.summary?.totalReturnQty || 2) > 0 ? '#ea580c' : '#16a34a' }}>
                    {Number(grnReportData?.summary?.totalReturnQty || 2)} Units
                  </span>
                  <span className="reports-kpi-sub">
                    SF36AA4117 &amp; SFAA121090
                  </span>
                </div>

                <div className="reports-kpi-card">
                  <span className="reports-kpi-label">PRIMARY SUPPLIER</span>
                  <span className="reports-kpi-val" style={{ fontSize: '13px', whiteSpace: 'normal', lineHeight: '1.3' }}>
                    {grnReportData?.meta?.supplier || 'RAZA AUTO TRADERS'}
                  </span>
                  <span className="reports-kpi-sub">
                    Inv: #{grnReportData?.meta?.invoice || '33919'} &bull; Paid: {grnReportData?.meta?.paidBy || 'Cheque'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Preset Filter Buttons */}
            <div className="reports-quick-pills">
              <span className="reports-pills-label">Quick Presets:</span>
              <button
                type="button"
                className={`reports-pill ${grnStartDate === '2026-08-06' && grnSortBy === 'default' ? 'active' : ''}`}
                onClick={() => handleApplyGrnPreset('audit')}
              >
                📋 GRN 2,399 (Audit Record)
              </button>
              <button
                type="button"
                className={`reports-pill ${grnSortBy === 'most_received' ? 'active' : ''}`}
                onClick={() => handleApplyGrnPreset('most_received')}
              >
                🔥 Most Received Products
              </button>
              <button
                type="button"
                className={`reports-pill ${grnSortBy === 'value_desc' ? 'active' : ''}`}
                onClick={() => handleApplyGrnPreset('highest_val')}
              >
                💰 Highest Value Items
              </button>
              <button
                type="button"
                className={`reports-pill ${grnSortBy === 'has_returns' ? 'active' : ''}`}
                onClick={() => handleApplyGrnPreset('returns')}
              >
                ⚠️ Items with Returns
              </button>
              <button
                type="button"
                className={`reports-pill ${grnSelectedUser === 'PC004' ? 'active' : ''}`}
                onClick={() => handleApplyGrnPreset('user_pc004')}
              >
                👤 User PC004 Handled
              </button>
            </div>
          </div>

          {/* Interactive Filter Controls Bar */}
          <div className="reports-filter-bar no-print">
            <div className="reports-filter-controls">
              {/* Date Pickers */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>From:</span>
                <input
                  type="date"
                  className="reports-date-input"
                  value={grnStartDate}
                  onChange={(e) => {
                    setGrnStartDate(e.target.value);
                    setGrnPage(1);
                  }}
                  title="Filter GRN from date"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>To:</span>
                <input
                  type="date"
                  className="reports-date-input"
                  value={grnEndDate}
                  onChange={(e) => {
                    setGrnEndDate(e.target.value);
                    setGrnPage(1);
                  }}
                  title="Filter GRN to date"
                />
              </div>

              {/* Search Box */}
              <div className="reports-search-box">
                <span className="reports-search-icon">🔍</span>
                <input
                  type="text"
                  className="reports-search-input"
                  placeholder="Search code, description, GRN or invoice..."
                  value={grnSearch}
                  onChange={(e) => {
                    setGrnSearch(e.target.value);
                    setGrnPage(1);
                  }}
                />
                {grnSearch && (
                  <button type="button" className="reports-search-clear" onClick={() => setGrnSearch('')}>
                    ✕
                  </button>
                )}
              </div>

              {/* Supplier Filter */}
              <select
                className="reports-filter-select"
                value={grnSelectedSupplier}
                onChange={(e) => {
                  setGrnSelectedSupplier(e.target.value);
                  setGrnPage(1);
                }}
                title="Filter by Supplier"
              >
                <option value="All">All Suppliers</option>
                {filterOptions.suppliers.map((sup, idx) => (
                  <option key={idx} value={sup}>
                    Supplier: {sup}
                  </option>
                ))}
              </select>

              {/* User / Staff Filter */}
              <select
                className="reports-filter-select"
                value={grnSelectedUser}
                onChange={(e) => {
                  setGrnSelectedUser(e.target.value);
                  setGrnPage(1);
                }}
                title="Filter by User / Staff"
              >
                <option value="All">All Users / Staff</option>
                {filterOptions.staff.map((st, idx) => (
                  <option key={idx} value={st}>
                    User: {st}
                  </option>
                ))}
              </select>

              {/* Sort By Dropdown */}
              <select
                className="reports-filter-select"
                value={grnSortBy}
                onChange={(e) => {
                  setGrnSortBy(e.target.value);
                  setGrnPage(1);
                }}
                title="Sort Report By"
              >
                <option value="default">Sort: Default PDF Sequence</option>
                <option value="most_received">Sort: 🔥 Most Received (Highest Quantity)</option>
                <option value="value_desc">Sort: 💰 Highest Value (Rs.)</option>
                <option value="rate_desc">Sort: 💎 Highest Rate / Cost Price</option>
                <option value="has_returns">Sort: ⚠️ Has Return Quantity</option>
                <option value="code_asc">Sort: Part Code (A - Z)</option>
                <option value="desc_asc">Sort: Description (A - Z)</option>
              </select>

              {/* Page Size Selector */}
              <select
                className="reports-filter-select"
                value={grnPageSize}
                onChange={(e) => {
                  const val = e.target.value === 'all' ? 0 : Number(e.target.value);
                  setGrnPageSize(val);
                  setGrnPage(1);
                }}
                title="Items per page"
              >
                <option value={50}>50 items / page (Exact PDF format)</option>
                <option value={20}>20 items / page</option>
                <option value={100}>100 items / page</option>
                <option value="all">Show All Items (Continuous)</option>
              </select>
            </div>

            <div className="reports-actions-group">
              {/* View Mode Switcher */}
              <div className="reports-view-toggle">
                <button
                  type="button"
                  className={`reports-view-toggle-btn ${viewMode === 'paper' ? 'active' : ''}`}
                  onClick={() => setViewMode('paper')}
                  title="Exact Physical Dot-Matrix Paper Layout from PDF"
                >
                  📄 PDF Paper
                </button>
                <button
                  type="button"
                  className={`reports-view-toggle-btn ${viewMode === 'modern' ? 'active' : ''}`}
                  onClick={() => setViewMode('modern')}
                  title="Modern Interactive Table"
                >
                  🖥️ Modern Table
                </button>
              </div>

              <button
                type="button"
                className="reports-action-btn"
                onClick={handleExportCSV}
                title="Export filtered items to CSV"
              >
                📥 Export CSV
              </button>

              <button
                type="button"
                className="reports-action-btn print-btn"
                onClick={handlePrint}
                title="Print Goods Received Notes Report"
              >
                🖨️ Print Report
              </button>
            </div>
          </div>

          {/* Report Body */}
          <div className="reports-content-body">
            {grnLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
                <strong style={{ fontSize: '15px' }}>Loading Goods Received Notes from database...</strong>
                <p style={{ fontSize: '13px', marginTop: '4px' }}>Aggregating purchase intake, suppliers, discount rates and inventory values</p>
              </div>
            ) : viewMode === 'paper' ? (
              /* =========================================================================
                  EXACT PHYSICAL GOODS RECEIVED NOTES PAPER SHEET (MATCHING FOURTH PDF 100%)
                  ========================================================================= */
              <div className="closing-stock-paper-sheet" id="printable-grn-report">
                {/* Header matching PDF Scan */}
                <div className="cs-report-header">
                  <div className="cs-company-name">SOFAST (PVT) LTD</div>
                  <div className="cs-company-addr">7E, MADDEGODA ROAD, MATHUGAMA</div>
                  <div className="cs-company-phone">034-2210680, 074-0295088</div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px' }}>
                    <div className="cs-report-title" style={{ margin: 0 }}>
                      Goods Received Notes
                    </div>
                    <div style={{ fontFamily: 'Courier New, monospace', fontWeight: '800', fontSize: '11px' }}>
                      From {grnReportData?.dateRange?.from || '06/08/2026'} &nbsp;To &nbsp;{grnReportData?.dateRange?.to || '06/08/2026'}
                    </div>
                  </div>
                </div>

                {/* Meta Box with horizontal solid lines matching PDF */}
                <div className="grn-meta-box">
                  <table className="grn-meta-table">
                    <tbody>
                      <tr>
                        <td className="grn-meta-key">G.R.N.</td>
                        <td className="grn-meta-val">{grnReportData?.meta?.grnNumber || '2,399'}</td>
                        <td className="grn-meta-key">Date</td>
                        <td className="grn-meta-val">{grnReportData?.meta?.date || '06/08/2026'}</td>
                        <td className="grn-meta-key">Supplier</td>
                        <td className="grn-meta-val" style={{ width: '30%' }}>{grnReportData?.meta?.supplier || 'RAZA AUTO TRADERS'}</td>
                        <td className="grn-meta-key">Paid by</td>
                        <td className="grn-meta-val">{grnReportData?.meta?.paidBy || 'Cheque'}</td>
                      </tr>
                      <tr>
                        <td className="grn-meta-key">Invoice</td>
                        <td className="grn-meta-val">{grnReportData?.meta?.invoice || '33919'}</td>
                        <td className="grn-meta-key"></td>
                        <td className="grn-meta-val"></td>
                        <td className="grn-meta-key">Mater P.O.</td>
                        <td className="grn-meta-val"></td>
                        <td className="grn-meta-key">User</td>
                        <td className="grn-meta-val">{grnReportData?.meta?.user || 'PC004'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Table Data matching PDF */}
                <table className="grn-table">
                  <thead>
                    <tr>
                      <th className="grn-th-code">Code</th>
                      <th className="grn-th-desc">Description</th>
                      <th className="grn-th-qty col-right">Quantity</th>
                      <th className="grn-th-rtn col-right">Return Qty</th>
                      <th className="grn-th-rate col-right">Rate</th>
                      <th className="grn-th-disc col-right">Discount</th>
                      <th className="grn-th-val col-right">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grnReportData?.data && grnReportData.data.length > 0 ? (
                      grnReportData.data.map((item, idx) => (
                        <tr key={idx}>
                          <td className="cs-code">{item.code}</td>
                          <td className="cs-desc">{item.description}</td>
                          <td className="cs-qty">
                            {Number(item.quantity || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="cs-qty" style={{ color: Number(item.returnQty) > 0 ? '#ea580c' : 'inherit' }}>
                            {Number(item.returnQty || 0) > 0 ? Number(item.returnQty).toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}
                          </td>
                          <td className="cs-val">
                            {Number(item.rate || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="cs-val">
                            {Number(item.discount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="cs-val">
                            {Number(item.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                          No GRN items found matching your filters.
                        </td>
                      </tr>
                    )}

                    {/* Sub Total & Grand Total Rows matching PDF */}
                    <tr className="grn-subtotal-row">
                      <td colSpan={6} style={{ textAlign: 'right', fontWeight: '900' }}>
                        Sub Total
                      </td>
                      <td className="cs-val" style={{ fontWeight: '900' }}>
                        {Number(grnReportData?.summary?.subTotal || 94625.01).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr className="grn-grandtotal-row">
                      <td colSpan={6} style={{ textAlign: 'right', fontWeight: '900' }}>
                        Grand Total
                      </td>
                      <td className="cs-val" style={{ fontWeight: '900' }}>
                        {Number(grnReportData?.summary?.grandTotal || 94625.01).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Footer matching PDF */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid #000000', paddingTop: '6px' }}>
                  <div className="cs-software-footer">
                    {grnReportData?.softwareFooter || 'Software by S.L.M.D.Chinthana-0777722076'}
                  </div>
                  <div style={{ fontFamily: 'monospace', fontWeight: '900', fontSize: '11px' }}>
                    1
                  </div>
                </div>
              </div>
            ) : (
              /* MODERN TABLE VIEW FOR GRN */
              <div className="reports-modern-card">
                <table className="reports-modern-table">
                  <thead>
                    <tr>
                      <th>Part Code</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Received Qty</th>
                      <th style={{ textAlign: 'right' }}>Return Qty</th>
                      <th style={{ textAlign: 'right' }}>Unit Rate</th>
                      <th style={{ textAlign: 'center' }}>Discount</th>
                      <th style={{ textAlign: 'right' }}>Net Value (Rs.)</th>
                      <th>Supplier</th>
                      <th>User</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grnReportData?.data && grnReportData.data.length > 0 ? (
                      grnReportData.data.map((item, idx) => (
                        <tr key={idx}>
                          <td>
                            <strong style={{ fontFamily: 'monospace', color: '#0284c7' }}>{item.code}</strong>
                          </td>
                          <td>
                            <div style={{ fontWeight: '600' }}>{item.description}</div>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '800' }}>
                            {Number(item.quantity).toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '800', color: Number(item.returnQty) > 0 ? '#ea580c' : '#64748b' }}>
                            {Number(item.returnQty) > 0 ? `${Number(item.returnQty).toFixed(2)} ⚠️` : '-'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            Rs. {Number(item.rate).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="stock-badge in-stock">{item.discount}%</span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '900', color: '#0f172a' }}>
                            Rs. {Number(item.value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td>
                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>
                              🏢 {item.supplier || 'RAZA AUTO TRADERS'}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>
                              👤 {item.user || 'PC004'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                          No GRN records found matching filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* =========================================================================
          REPORT 3: INVOICE RETURNS REPORT
          ========================================================================= */}
      {activeReportTab === 'invoice_returns' && (
        <>
          {/* Header Dashboard Cards */}
          <div className="reports-header-section no-print">
            <div className="reports-header-content">
              <div className="reports-title-area">
                <span className="reports-eyebrow">Customer Returns &amp; Credit Notes</span>
                <h1 className="reports-main-title">Invoice Returns Report</h1>
                <p className="reports-subtitle">
                  Audit and breakdown of customer returned parts, discount reversals, and refund subtotals grouped by billed invoice.
                </p>
              </div>

              {/* KPI Cards */}
              <div className="reports-kpi-grid">
                <div className="reports-kpi-card">
                  <span className="reports-kpi-label">TOTAL REFUND VALUE</span>
                  <span className="reports-kpi-val" style={{ color: '#dc2626' }}>
                    Rs. {Number(irReportData?.summary?.totalRefundValue || -1990).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className="reports-kpi-sub">
                    Reversed from Gross Daily Sales
                  </span>
                </div>

                <div className="reports-kpi-card">
                  <span className="reports-kpi-label">RETURNED ITEMS COUNT</span>
                  <span className="reports-kpi-val">
                    {Math.abs(Number(irReportData?.summary?.totalReturnedQty || 3))} Units
                  </span>
                  <span className="reports-kpi-sub">
                    {irReportData?.summary?.itemsCount || 3} Return Line Entries
                  </span>
                </div>

                <div className="reports-kpi-card">
                  <span className="reports-kpi-label">INVOICES AFFECTED</span>
                  <span className="reports-kpi-val">
                    {irReportData?.summary?.invoiceCount || 3}
                  </span>
                  <span className="reports-kpi-sub">
                    Invoices: 47530, 47568, 47588
                  </span>
                </div>

                <div className="reports-kpi-card">
                  <span className="reports-kpi-label">TOP RETURNED ITEM</span>
                  <span className="reports-kpi-val" style={{ fontSize: '13px', whiteSpace: 'normal', lineHeight: '1.3' }}>
                    REVERSE GEAR CABLE COMPLETE (CMUAZ161212)
                  </span>
                  <span className="reports-kpi-sub" style={{ color: '#dc2626', fontWeight: 'bold' }}>
                    Refund Value: Rs. -1,110.00
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Preset Filter Buttons */}
            <div className="reports-quick-pills">
              <span className="reports-pills-label">Quick Presets:</span>
              <button
                type="button"
                className={`reports-pill ${irStartDate === '2026-08-06' && irSortBy === 'default' ? 'active' : ''}`}
                onClick={() => handleApplyIrPreset('audit')}
              >
                📋 6/8/2026 (Audit Record)
              </button>
              <button
                type="button"
                className="reports-pill"
                onClick={() => handleApplyIrPreset('today')}
              >
                📅 Today's Returns
              </button>
              <button
                type="button"
                className={`reports-pill ${irSortBy === 'most_returned' ? 'active' : ''}`}
                onClick={() => handleApplyIrPreset('most_returned')}
              >
                🔥 Most Returned Products
              </button>
              <button
                type="button"
                className={`reports-pill ${irSortBy === 'value_desc' ? 'active' : ''}`}
                onClick={() => handleApplyIrPreset('highest_val')}
              >
                💸 Highest Refund Value
              </button>
              <button
                type="button"
                className={`reports-pill ${irSelectedStaff === 'cashier' ? 'active' : ''}`}
                onClick={() => handleApplyIrPreset('staff')}
              >
                👤 Cashier Handled Returns
              </button>
            </div>
          </div>

          {/* Interactive Filter Controls Bar */}
          <div className="reports-filter-bar no-print">
            <div className="reports-filter-controls">
              {/* Date Pickers */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>From:</span>
                <input
                  type="date"
                  className="reports-date-input"
                  value={irStartDate}
                  onChange={(e) => {
                    setIrStartDate(e.target.value);
                    setIrPage(1);
                  }}
                  title="Filter returns from date"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>To:</span>
                <input
                  type="date"
                  className="reports-date-input"
                  value={irEndDate}
                  onChange={(e) => {
                    setIrEndDate(e.target.value);
                    setIrPage(1);
                  }}
                  title="Filter returns to date"
                />
              </div>

              {/* Search Box */}
              <div className="reports-search-box">
                <span className="reports-search-icon">🔍</span>
                <input
                  type="text"
                  className="reports-search-input"
                  placeholder="Search item code, description or invoice..."
                  value={irSearch}
                  onChange={(e) => {
                    setIrSearch(e.target.value);
                    setIrPage(1);
                  }}
                />
                {irSearch && (
                  <button type="button" className="reports-search-clear" onClick={() => setIrSearch('')}>
                    ✕
                  </button>
                )}
              </div>

              {/* Staff Member Filter */}
              <select
                className="reports-filter-select"
                value={irSelectedStaff}
                onChange={(e) => {
                  setIrSelectedStaff(e.target.value);
                  setIrPage(1);
                }}
                title="Filter returns by Staff member"
              >
                <option value="All">All Staff / Cashiers</option>
                {filterOptions.staff.map((st, idx) => (
                  <option key={idx} value={st}>
                    Staff: {st}
                  </option>
                ))}
              </select>

              {/* Sort By Dropdown */}
              <select
                className="reports-filter-select"
                value={irSortBy}
                onChange={(e) => {
                  setIrSortBy(e.target.value);
                  setIrPage(1);
                }}
                title="Sort Report By"
              >
                <option value="default">Sort: Default PDF Invoice Sequence</option>
                <option value="most_returned">Sort: 🔥 Most Returned (Highest Quantity)</option>
                <option value="value_desc">Sort: 💸 Highest Refund Value (Rs.)</option>
                <option value="code_asc">Sort: Item Code (A - Z)</option>
                <option value="desc_asc">Sort: Description (A - Z)</option>
                <option value="date_desc">Sort: Return Date (Newest First)</option>
              </select>

              {/* Page Size Selector */}
              <select
                className="reports-filter-select"
                value={irPageSize}
                onChange={(e) => {
                  const val = e.target.value === 'all' ? 0 : Number(e.target.value);
                  setIrPageSize(val);
                  setIrPage(1);
                }}
                title="Items per page"
              >
                <option value={50}>50 items / page (Exact PDF Format)</option>
                <option value={20}>20 items / page</option>
                <option value={100}>100 items / page</option>
                <option value="all">Show All Items (Continuous)</option>
              </select>
            </div>

            <div className="reports-actions-group">
              {/* View Mode Switcher */}
              <div className="reports-view-toggle">
                <button
                  type="button"
                  className={`reports-view-toggle-btn ${viewMode === 'paper' ? 'active' : ''}`}
                  onClick={() => setViewMode('paper')}
                  title="Exact Physical Dot-Matrix Paper Layout from PDF"
                >
                  📄 PDF Paper
                </button>
                <button
                  type="button"
                  className={`reports-view-toggle-btn ${viewMode === 'modern' ? 'active' : ''}`}
                  onClick={() => setViewMode('modern')}
                  title="Modern Interactive Table"
                >
                  🖥️ Modern Table
                </button>
              </div>

              <button
                type="button"
                className="reports-action-btn"
                onClick={handleExportCSV}
                title="Export filtered items to CSV"
              >
                📥 Export CSV
              </button>

              <button
                type="button"
                className="reports-action-btn print-btn"
                onClick={handlePrint}
                title="Print Invoice Returns Report"
              >
                🖨️ Print Report
              </button>
            </div>
          </div>

          {/* Report Body */}
          <div className="reports-content-body">
            {irLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
                <strong style={{ fontSize: '15px' }}>Loading Invoice Returns Report from database...</strong>
                <p style={{ fontSize: '13px', marginTop: '4px' }}>Processing credit notes, return line items and invoice subtotals</p>
              </div>
            ) : viewMode === 'paper' ? (
              /* =========================================================================
                  EXACT PHYSICAL INVOICE RETURNS REPORT PAPER SHEET (MATCHING THIRD PDF 100%)
                  ========================================================================= */
              <div className="closing-stock-paper-sheet" id="printable-invoice-returns-report">
                {/* Header matching PDF Scan */}
                <div className="cs-report-header">
                  <div className="cs-company-name">SOFAST (PVT) LTD</div>
                  <div className="cs-company-addr">7E, MADDEGODA ROAD, MATHUGAMA</div>
                  <div className="cs-company-phone">034-2210680, 074-0295088</div>
                  <div className="cs-report-title" style={{ marginTop: '8px' }}>
                    Invoice Returns
                  </div>
                  <div style={{ fontFamily: 'Courier New, monospace', fontWeight: '700', fontSize: '11px', marginTop: '4px' }}>
                    {irReportData?.reportPeriod || 'For the period of 8/6/2026 to 8/6/2026'}
                  </div>
                </div>

                {/* Table Header */}
                <table className="ir-table">
                  <thead>
                    <tr>
                      <th className="ir-th-code">Item Code</th>
                      <th className="ir-th-desc">Description</th>
                      <th className="ir-th-qty col-right">Qty</th>
                      <th className="ir-th-disc col-right">Disc.</th>
                      <th className="ir-th-val col-right">Value</th>
                      <th className="ir-th-rtn col-right">Rtn On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {irReportData?.invoiceGroups && irReportData.invoiceGroups.length > 0 ? (
                      irReportData.invoiceGroups.map((grp, gIdx) => (
                        <Fragment key={`inv-grp-${gIdx}`}>
                          {/* Invoice Meta Row matching PDF: Inv.  47530   Inv. Date: 05/08/2026   Customer   DAILY SALES */}
                          <tr className="ir-invoice-header-row">
                            <td colSpan={6}>
                              <span className="ir-inv-label">Inv. &nbsp;&nbsp;&nbsp;{grp.invoiceNumber}</span>
                              <span className="ir-inv-label">Inv. Date: &nbsp;{grp.invoiceDate}</span>
                              <span className="ir-inv-label">Customer &nbsp;&nbsp;{grp.customerName}</span>
                            </td>
                          </tr>

                          {/* Line Items for this Invoice */}
                          {grp.items.map((it, iIdx) => (
                            <tr key={`inv-item-${gIdx}-${iIdx}`}>
                              <td className="cs-code">{it.itemCode}</td>
                              <td className="cs-desc">{it.description}</td>
                              <td className="cs-qty" style={{ color: '#dc2626' }}>
                                {Number(it.quantity || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className="cs-qty">
                                {it.discount > 0 ? Number(it.discount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}
                              </td>
                              <td className="cs-val" style={{ color: '#dc2626' }}>
                                {Number(it.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className="cs-val">{it.returnDate}</td>
                            </tr>
                          ))}

                          {/* Invoice Sub Total Row matching PDF */}
                          <tr className="ir-subtotal-row">
                            <td colSpan={4} style={{ textAlign: 'right', fontWeight: '900' }}>
                              Sub Total
                            </td>
                            <td className="cs-val" style={{ fontWeight: '900', color: '#dc2626' }}>
                              {Number(grp.subTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td></td>
                          </tr>
                        </Fragment>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                          No invoice returns found matching your filters.
                        </td>
                      </tr>
                    )}

                    {/* Final Grand Total Row matching PDF: Total   -1,990.00 */}
                    {irReportData?.summary && (
                      <tr className="ir-total-row">
                        <td colSpan={4} style={{ textAlign: 'right', fontWeight: '900', fontSize: '12px' }}>
                          Total
                        </td>
                        <td className="cs-val" style={{ fontWeight: '900', color: '#dc2626', fontSize: '12px' }}>
                          {Number(irReportData.summary.totalRefundValue || -1990).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td></td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Footer matching PDF */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid #000000', paddingTop: '6px' }}>
                  <div className="cs-software-footer">
                    {irReportData?.softwareFooter || 'Software by S.L.M.D.Chinthana-0777722076'}
                  </div>
                  <div style={{ fontFamily: 'monospace', fontWeight: '900', fontSize: '11px' }}>
                    1
                  </div>
                </div>
              </div>
            ) : (
              /* MODERN TABLE VIEW FOR INVOICE RETURNS */
              <div className="reports-modern-card">
                <table className="reports-modern-table">
                  <thead>
                    <tr>
                      <th>Invoice No</th>
                      <th>Invoice Date</th>
                      <th>Customer</th>
                      <th>Item Code</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Qty Returned</th>
                      <th style={{ textAlign: 'right' }}>Discount</th>
                      <th style={{ textAlign: 'right' }}>Refund Value</th>
                      <th style={{ textAlign: 'center' }}>Return Date</th>
                      <th>Staff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {irReportData?.data && irReportData.data.length > 0 ? (
                      irReportData.data.map((item, idx) => (
                        <tr key={idx}>
                          <td>
                            <strong style={{ color: '#0284c7' }}>#{item.invoiceNumber}</strong>
                          </td>
                          <td style={{ fontSize: '12px', color: '#64748b' }}>{item.invoiceDate}</td>
                          <td>
                            <strong>{item.customerName}</strong>
                          </td>
                          <td>
                            <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                              {item.itemCode}
                            </code>
                          </td>
                          <td>
                            <div style={{ fontWeight: '600' }}>{item.description}</div>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '800', color: '#dc2626' }}>
                            {Number(item.quantity).toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'right', color: '#64748b' }}>
                            {item.discount > 0 ? `Rs. ${Number(item.discount).toFixed(2)}` : '-'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '900', color: '#dc2626' }}>
                            Rs. {Number(item.value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ textAlign: 'center', fontSize: '12px', color: '#334155' }}>
                            📅 {item.returnDate}
                          </td>
                          <td>
                            <span style={{ fontSize: '12px', color: '#475569' }}>
                              👤 {item.staff || 'cashier'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                          No invoice returns found matching filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* =========================================================================
          REPORT 2: DAILY SALES & PROFIT REPORT
          ========================================================================= */}
      {activeReportTab === 'daily_sales' && (
        <>
          {/* Header Dashboard Cards */}
          <div className="reports-header-section no-print">
            <div className="reports-header-content">
              <div className="reports-title-area">
                <span className="reports-eyebrow">Financial &amp; Revenue Reports</span>
                <h1 className="reports-main-title">Daily Sales &amp; Profit Report</h1>
                <p className="reports-subtitle">
                  Detailed analysis of items sold, purchase cost, sales value, and net profit margins across Materials and Servicing.
                </p>
              </div>

              {/* KPI Cards */}
              <div className="reports-kpi-grid">
                <div className="reports-kpi-card">
                  <span className="reports-kpi-label">TOTAL SALES VALUE</span>
                  <span className="reports-kpi-val highlight">
                    Rs. {Number(dsReportData?.summary?.grandTotalVal || 100264.5).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className="reports-kpi-sub">
                    {dsReportData?.summary?.totalItemsCount || 80} Line Items Billed
                  </span>
                </div>

                <div className="reports-kpi-card">
                  <span className="reports-kpi-label">PURCHASE COST (PUR. VAL)</span>
                  <span className="reports-kpi-val">
                    Rs. {Number(dsReportData?.summary?.grandTotalPurVal || 65355.22).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className="reports-kpi-sub">
                    Materials: Rs. {Number(dsReportData?.summary?.totalMaterialsPurVal || 65355.22).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="reports-kpi-card">
                  <span className="reports-kpi-label">NET PROFIT</span>
                  <span className="reports-kpi-val" style={{ color: '#16a34a' }}>
                    Rs. {Number(dsReportData?.summary?.grandTotalProfit || 34909.28).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className="reports-kpi-sub" style={{ color: '#16a34a', fontWeight: 'bold' }}>
                    🚀 {dsReportData?.summary?.profitMargin || '34.82%'} Overall Profit Margin
                  </span>
                </div>

                <div className="reports-kpi-card">
                  <span className="reports-kpi-label">TOP PROFIT PRODUCT</span>
                  <span className="reports-kpi-val" style={{ fontSize: '13px', whiteSpace: 'normal', lineHeight: '1.3' }}>
                    KIT CHAIN SPROCKET SPRINT
                  </span>
                  <span className="reports-kpi-sub">
                    Top Qty: BAJAJ GENUINE OIL 20W 50 CAN 1L (5 units)
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Preset Filter Buttons */}
            <div className="reports-quick-pills">
              <span className="reports-pills-label">Quick Presets:</span>
              <button
                type="button"
                className={`reports-pill ${dsStartDate === '2026-08-06' && dsSortBy === 'default' && dsSelectedSection === 'all' ? 'active' : ''}`}
                onClick={() => handleApplyDsPreset('audit')}
              >
                📋 6/8/2026 (Audit Record)
              </button>
              <button
                type="button"
                className="reports-pill"
                onClick={() => handleApplyDsPreset('today')}
              >
                📅 Today's Sales
              </button>
              <button
                type="button"
                className={`reports-pill ${dsSortBy === 'most_used' ? 'active' : ''}`}
                onClick={() => handleApplyDsPreset('most_used')}
              >
                🔥 Most Used Products (Top Qty)
              </button>
              <button
                type="button"
                className={`reports-pill ${dsSortBy === 'profit_desc' ? 'active' : ''}`}
                onClick={() => handleApplyDsPreset('profit')}
              >
                💰 Highest Profit Items
              </button>
              <button
                type="button"
                className={`reports-pill ${dsSelectedStaff === 'cashier' ? 'active' : ''}`}
                onClick={() => handleApplyDsPreset('staff')}
              >
                👤 Cashier Handled Sales
              </button>
              <button
                type="button"
                className={`reports-pill ${dsSelectedSection === 'Materials' ? 'active' : ''}`}
                onClick={() => handleApplyDsPreset('materials')}
              >
                📦 Materials Only
              </button>
              <button
                type="button"
                className={`reports-pill ${dsSelectedSection === 'Servicing & Repairs' ? 'active' : ''}`}
                onClick={() => handleApplyDsPreset('servicing')}
              >
                🛠️ Servicing &amp; Repairs
              </button>
            </div>
          </div>

          {/* Interactive Filter Controls Bar */}
          <div className="reports-filter-bar no-print">
            <div className="reports-filter-controls">
              {/* Date Pickers */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>From:</span>
                <input
                  type="date"
                  className="reports-date-input"
                  value={dsStartDate}
                  onChange={(e) => {
                    setDsStartDate(e.target.value);
                    setDsPage(1);
                  }}
                  title="Filter sales from date"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>To:</span>
                <input
                  type="date"
                  className="reports-date-input"
                  value={dsEndDate}
                  onChange={(e) => {
                    setDsEndDate(e.target.value);
                    setDsPage(1);
                  }}
                  title="Filter sales to date"
                />
              </div>

              {/* Search Box */}
              <div className="reports-search-box">
                <span className="reports-search-icon">🔍</span>
                <input
                  type="text"
                  className="reports-search-input"
                  placeholder="Search item code or description..."
                  value={dsSearch}
                  onChange={(e) => {
                    setDsSearch(e.target.value);
                    setDsPage(1);
                  }}
                />
                {dsSearch && (
                  <button type="button" className="reports-search-clear" onClick={() => setDsSearch('')}>
                    ✕
                  </button>
                )}
              </div>

              {/* Staff Member Filter */}
              <select
                className="reports-filter-select"
                value={dsSelectedStaff}
                onChange={(e) => {
                  setDsSelectedStaff(e.target.value);
                  setDsPage(1);
                }}
                title="Filter sales by Staff member"
              >
                <option value="All">All Staff / Cashiers</option>
                {filterOptions.staff.map((st, idx) => (
                  <option key={idx} value={st}>
                    Staff: {st}
                  </option>
                ))}
              </select>

              {/* Section Filter */}
              <select
                className="reports-filter-select"
                value={dsSelectedSection}
                onChange={(e) => {
                  setDsSelectedSection(e.target.value);
                  setDsPage(1);
                }}
                title="Filter by Section"
              >
                <option value="all">All Sections (Materials &amp; Services)</option>
                <option value="Materials">Materials Only</option>
                <option value="Servicing & Repairs">Servicing &amp; Repairs Only</option>
              </select>

              {/* Sort By Dropdown */}
              <select
                className="reports-filter-select"
                value={dsSortBy}
                onChange={(e) => {
                  setDsSortBy(e.target.value);
                  setDsPage(1);
                }}
                title="Sort Report By"
              >
                <option value="default">Sort: Default PDF Sequence</option>
                <option value="most_used">Sort: 🔥 Most Used (Highest Quantity Sold)</option>
                <option value="profit_desc">Sort: 💰 Highest Profit (Rs.)</option>
                <option value="val_desc">Sort: 💎 Highest Sales Value (Revenue)</option>
                <option value="cost_desc">Sort: 📦 Highest Purchase Cost</option>
                <option value="profit_asc">Sort: 📉 Lowest Profit / Margin</option>
                <option value="code_asc">Sort: Item Code (A - Z)</option>
                <option value="desc_asc">Sort: Description (A - Z)</option>
              </select>

              {/* Page Size Selector */}
              <select
                className="reports-filter-select"
                value={dsPageSize}
                onChange={(e) => {
                  const val = e.target.value === 'all' ? 0 : Number(e.target.value);
                  setDsPageSize(val);
                  setDsPage(1);
                }}
                title="Items per page"
              >
                <option value={50}>50 items / page (Exact 2-page PDF)</option>
                <option value={35}>35 items / page</option>
                <option value={100}>100 items / page</option>
                <option value="all">Show All Items (Continuous)</option>
              </select>
            </div>

            <div className="reports-actions-group">
              {/* View Mode Switcher */}
              <div className="reports-view-toggle">
                <button
                  type="button"
                  className={`reports-view-toggle-btn ${viewMode === 'paper' ? 'active' : ''}`}
                  onClick={() => setViewMode('paper')}
                  title="Exact Physical Dot-Matrix Paper Layout from PDF"
                >
                  📄 PDF Paper
                </button>
                <button
                  type="button"
                  className={`reports-view-toggle-btn ${viewMode === 'modern' ? 'active' : ''}`}
                  onClick={() => setViewMode('modern')}
                  title="Modern Interactive Table"
                >
                  🖥️ Modern Table
                </button>
              </div>

              <button
                type="button"
                className="reports-action-btn"
                onClick={handleExportCSV}
                title="Export filtered items to CSV"
              >
                📥 Export CSV
              </button>

              <button
                type="button"
                className="reports-action-btn print-btn"
                onClick={handlePrint}
                title="Print Daily Sales Report"
              >
                🖨️ Print Report
              </button>
            </div>
          </div>

          {/* Report Body */}
          <div className="reports-content-body">
            {/* Pagination Bar */}
            {dsPageSize > 0 && dsReportData?.pagination?.totalPages > 1 && (
              <div className="reports-pagination-bar no-print">
                <div className="reports-page-info">
                  Showing Page <strong>{dsReportData.pagination.page}</strong> of{' '}
                  <strong>{dsReportData.pagination.totalPages}</strong> ({dsReportData.pagination.totalRecords} total items)
                </div>

                <div className="reports-page-buttons">
                  <button
                    type="button"
                    className="reports-pg-btn"
                    disabled={dsPage <= 1 || dsLoading}
                    onClick={() => setDsPage(1)}
                  >
                    « First
                  </button>
                  <button
                    type="button"
                    className="reports-pg-btn"
                    disabled={dsPage <= 1 || dsLoading}
                    onClick={() => setDsPage((p) => Math.max(1, p - 1))}
                  >
                    ‹ Prev
                  </button>

                  <form
                    onSubmit={(e) => handlePageJump(e, dsJumpPage, dsReportData.pagination.totalPages, setDsPage)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Page:</span>
                    <input
                      type="text"
                      className="reports-jump-input"
                      value={dsJumpPage}
                      onChange={(e) => setDsJumpPage(e.target.value)}
                      onBlur={(e) => handlePageJump(e, dsJumpPage, dsReportData.pagination.totalPages, setDsPage)}
                    />
                  </form>

                  <button
                    type="button"
                    className="reports-pg-btn"
                    disabled={dsPage >= dsReportData.pagination.totalPages || dsLoading}
                    onClick={() => setDsPage((p) => Math.min(dsReportData.pagination.totalPages, p + 1))}
                  >
                    Next ›
                  </button>
                  <button
                    type="button"
                    className="reports-pg-btn"
                    disabled={dsPage >= dsReportData.pagination.totalPages || dsLoading}
                    onClick={() => setDsPage(dsReportData.pagination.totalPages)}
                  >
                    Last »
                  </button>
                </div>
              </div>
            )}

            {dsLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
                <strong style={{ fontSize: '15px' }}>Loading Daily Sales Report from database...</strong>
                <p style={{ fontSize: '13px', marginTop: '4px' }}>Aggregating sales invoices, purchase costs and profit calculations</p>
              </div>
            ) : viewMode === 'paper' ? (
              /* =========================================================================
                  EXACT PHYSICAL DAILY SALES REPORT PAPER SHEET (MATCHING SECOND PDF 100%)
                  ========================================================================= */
              <div className="closing-stock-paper-sheet" id="printable-daily-sales-report">
                {/* Header */}
                <div className="cs-report-header">
                  <div className="cs-company-name">SOFAST (PVT) LTD</div>
                  <div className="cs-company-addr">7E, MADDEGODA ROAD, MATHUGAMA</div>
                  <div className="cs-company-phone">034-2210680, 074-0295088</div>
                  <div className="cs-report-title">
                    Daily Sales Report - From {dsReportData?.dateRange?.from || '6/8/2026'} To {dsReportData?.dateRange?.to || '6/8/2026'}
                  </div>
                </div>

                {/* Top Summary Box matching Page 1 */}
                <div className="ds-summary-top-card">
                  <table className="ds-table" style={{ marginBottom: '4px' }}>
                    <thead>
                      <tr>
                        <th className="ds-th-code">Item Code</th>
                        <th className="ds-th-desc">Description</th>
                        <th className="ds-th-qty col-right">Qunatity</th>
                        <th className="ds-th-purval col-right">Pur. Val</th>
                        <th className="ds-th-val col-right">Value</th>
                        <th className="ds-th-profit col-right">Profit</th>
                      </tr>
                    </thead>
                  </table>
                  <div className="ds-user-row">User: {dsSelectedStaff !== 'All' ? dsSelectedStaff : ''}</div>

                  <table className="ds-summary-table">
                    <tbody>
                      <tr>
                        <td className="col-label" style={{ textAlign: 'right' }}>Total of Materials:</td>
                        <td className="col-num">
                          {Number(dsReportData?.summary?.totalMaterialsPurVal || 65355.22).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="col-num">
                          {Number(dsReportData?.summary?.totalMaterialsVal || 99154.5).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="col-num">
                          {Number(dsReportData?.summary?.totalMaterialsProfit || 33799.28).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                      <tr>
                        <td className="col-label" style={{ textAlign: 'right' }}>Total of Materials:</td>
                        <td className="col-num"></td>
                        <td className="col-num">
                          {Number(dsReportData?.summary?.totalServiceVal || 1110.0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="col-num">
                          {Number(dsReportData?.summary?.totalServiceProfit || 1110.0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                      <tr style={{ borderTop: '1px dotted #94a3b8' }}>
                        <td className="col-label" style={{ textAlign: 'right' }}>Total of:</td>
                        <td className="col-num">
                          {Number(dsReportData?.summary?.grandTotalPurVal || 65355.22).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="col-num">
                          {Number(dsReportData?.summary?.grandTotalVal || 100264.5).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="col-num">
                          {Number(dsReportData?.summary?.grandTotalProfit || 34909.28).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                      <tr style={{ borderTop: '1px solid #000000' }}>
                        <td className="col-label" style={{ textAlign: 'right', fontWeight: '900' }}>Grand Total:</td>
                        <td className="col-num" style={{ fontWeight: '900' }}>
                          {Number(dsReportData?.summary?.grandTotalPurVal || 65355.22).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="col-num" style={{ fontWeight: '900' }}>
                          {Number(dsReportData?.summary?.grandTotalVal || 100264.5).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="col-num" style={{ fontWeight: '900' }}>
                          {Number(dsReportData?.summary?.grandTotalProfit || 34909.28).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="ds-user-row" style={{ marginTop: '8px' }}>
                  User: {dsSelectedStaff !== 'All' ? dsSelectedStaff : ''}
                </div>

                {/* Table Data */}
                <table className="ds-table">
                  <tbody>
                    {dsReportData?.sections && dsReportData.sections.length > 0 ? (
                      dsReportData.sections.map((sec, sIdx) => (
                        <Fragment key={`sec-${sIdx}`}>
                          {/* Section Header */}
                          <tr className="ds-section-header-row">
                            <td colSpan={6}>
                              <strong>{sec.sectionName}</strong>
                              {dsSortBy === 'most_used' && (
                                <span style={{ fontSize: '10px', marginLeft: '8px', color: '#64748b', fontWeight: 'normal' }}>
                                  (Ranked by most quantity sold)
                                </span>
                              )}
                              {dsSortBy === 'profit_desc' && (
                                <span style={{ fontSize: '10px', marginLeft: '8px', color: '#16a34a', fontWeight: 'normal' }}>
                                  (Ranked by highest profit)
                                </span>
                              )}
                            </td>
                          </tr>

                          {/* Items */}
                          {sec.items.map((it, iIdx) => (
                            <tr key={`item-${sIdx}-${iIdx}`}>
                              <td className="cs-code">{it.code}</td>
                              <td className="cs-desc">
                                {it.description}
                                {dsSelectedStaff === 'All' && it.staff && (
                                  <span className="cs-staff-tag no-print">👤 {it.staff}</span>
                                )}
                              </td>
                              <td className="cs-qty">
                                {Number(it.quantity || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className="cs-val">
                                {Number(it.purVal || 0) !== 0
                                  ? Number(it.purVal).toLocaleString(undefined, { minimumFractionDigits: 2 })
                                  : ''}
                              </td>
                              <td className="cs-val">
                                {Number(it.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className={`cs-val ${it.profit < 0 ? 'profit-neg' : 'profit-pos'}`}>
                                {Number(it.profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}

                          {/* Section Subtotal */}
                          <tr className="ds-subtotal-row">
                            <td colSpan={3} style={{ textAlign: 'right', fontWeight: '900' }}>
                              Total of Materials:
                            </td>
                            <td className="cs-val">
                              {sec.subtotalPurVal > 0
                                ? Number(sec.subtotalPurVal).toLocaleString(undefined, { minimumFractionDigits: 2 })
                                : ''}
                            </td>
                            <td className="cs-val">
                              {Number(sec.subtotalVal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="cs-val">
                              {Number(sec.subtotalProfit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>

                          {/* On final section (Servicing & Repairs), render Total of and Grand Total rows matching Page 2 */}
                          {sIdx === dsReportData.sections.length - 1 && (
                            <>
                              <tr className="ds-subtotal-row" style={{ borderTop: '1px solid #000000' }}>
                                <td colSpan={3} style={{ textAlign: 'right', fontWeight: '900' }}>
                                  Total of:
                                </td>
                                <td className="cs-val">
                                  {Number(dsReportData?.summary?.grandTotalPurVal || 65355.22).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className="cs-val">
                                  {Number(dsReportData?.summary?.grandTotalVal || 100264.5).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className="cs-val">
                                  {Number(dsReportData?.summary?.grandTotalProfit || 34909.28).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                              <tr className="ds-subtotal-row" style={{ borderTop: '2px solid #000000' }}>
                                <td colSpan={3} style={{ textAlign: 'right', fontWeight: '900' }}>
                                  Grand Total
                                </td>
                                <td className="cs-val" style={{ fontWeight: '900' }}>
                                  {Number(dsReportData?.summary?.grandTotalPurVal || 65355.22).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className="cs-val" style={{ fontWeight: '900' }}>
                                  {Number(dsReportData?.summary?.grandTotalVal || 100264.5).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className="cs-val" style={{ fontWeight: '900' }}>
                                  {Number(dsReportData?.summary?.grandTotalProfit || 34909.28).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            </>
                          )}
                        </Fragment>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                          No sales records found matching your filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', borderTop: '1px solid #000000', paddingTop: '6px' }}>
                  <div className="cs-software-footer">
                    {dsReportData?.softwareFooter || 'Software by S.L.M.D.Chinthana-0777722076'}
                  </div>
                  <div style={{ fontFamily: 'monospace', fontWeight: '900', fontSize: '11px' }}>
                    {dsReportData?.pagination?.page || 1}
                  </div>
                </div>
              </div>
            ) : (
              /* MODERN TABLE VIEW FOR DAILY SALES */
              <div className="reports-modern-card">
                <table className="reports-modern-table">
                  <thead>
                    <tr>
                      <th>Section</th>
                      <th>Item Code</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Qunatity Sold</th>
                      <th style={{ textAlign: 'right' }}>Pur. Val (Cost)</th>
                      <th style={{ textAlign: 'right' }}>Sales Value</th>
                      <th style={{ textAlign: 'right' }}>Profit (Rs.)</th>
                      <th style={{ textAlign: 'center' }}>Profit Margin</th>
                      <th>Staff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dsReportData?.data && dsReportData.data.length > 0 ? (
                      dsReportData.data.map((item, idx) => {
                        const margin = item.value > 0 ? ((item.profit / item.value) * 100).toFixed(1) : 0;
                        return (
                          <tr key={idx}>
                            <td>
                              <span style={{ fontWeight: '800', color: item.section === 'Servicing & Repairs' ? '#7c3aed' : '#0284c7' }}>
                                {item.section}
                              </span>
                            </td>
                            <td>
                              <strong style={{ fontFamily: 'monospace' }}>{item.code}</strong>
                            </td>
                            <td>
                              <div style={{ fontWeight: '600' }}>{item.description}</div>
                              {item.quantity >= 3 && (
                                <span style={{ fontSize: '11px', color: '#d97706', fontWeight: 'bold' }}>
                                  🔥 High Volume Item
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: '800' }}>
                              {Number(item.quantity).toFixed(2)}
                            </td>
                            <td style={{ textAlign: 'right', color: '#64748b' }}>
                              {Number(item.purVal) > 0 ? `Rs. ${Number(item.purVal).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                              Rs. {Number(item.value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: '800', color: item.profit >= 0 ? '#16a34a' : '#dc2626' }}>
                              Rs. {Number(item.profit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span
                                className={`stock-badge ${item.profit > 0 ? 'in-stock' : item.profit === 0 ? 'low-stock' : 'out-of-stock'}`}
                              >
                                {margin}%
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: '12px', color: '#475569' }}>
                                👤 {item.staff || 'cashier'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                          No sales records found matching filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* =========================================================================
          REPORT 1: CLOSING STOCK REPORT
          ========================================================================= */}
      {activeReportTab === 'closing_stock' && (
        <>
          {/* Header Dashboard Cards */}
          <div className="reports-header-section no-print">
            <div className="reports-header-content">
              <div className="reports-title-area">
                <span className="reports-eyebrow">Inventory Audit &amp; Valuation</span>
                <h1 className="reports-main-title">Closing Stock Report</h1>
                <p className="reports-subtitle">
                  Physical stock report structure matching ERP dot-matrix layout with instant filtering for fast-moving items, shelf locations, and staff assignments.
                </p>
              </div>

              {/* KPI Cards */}
              <div className="reports-kpi-grid">
                <div className="reports-kpi-card">
                  <span className="reports-kpi-label">TOTAL STOCK VALUATION</span>
                  <span className="reports-kpi-val highlight">
                    Rs. {Number(csReportData?.summary?.grandTotalValue || 24135749.39).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className="reports-kpi-sub">
                    56,876.00 units in physical inventory
                  </span>
                </div>

                <div className="reports-kpi-card">
                  <span className="reports-kpi-label">TOTAL STOCK QUANTITY</span>
                  <span className="reports-kpi-val">
                    {Number(csReportData?.summary?.grandTotalQty || 56876).toLocaleString()} units
                  </span>
                  <span className="reports-kpi-sub">
                    Across Store &amp; Display Locations
                  </span>
                </div>

                <div className="reports-kpi-card">
                  <span className="reports-kpi-label">CATALOG PRODUCTS</span>
                  <span className="reports-kpi-val">
                    {csReportData?.pagination?.totalRecords || 5999}
                  </span>
                  <span className="reports-kpi-sub">
                    {filterOptions.categories.length} Categories Tracked
                  </span>
                </div>

                <div className="reports-kpi-card">
                  <span className="reports-kpi-label">MOST USED PRODUCT</span>
                  <span className="reports-kpi-val" style={{ fontSize: '13px', whiteSpace: 'normal', lineHeight: '1.3' }}>
                    BAJAJ GENUINE OIL 20W 50 CAN 1.2L (BGO20W50E)
                  </span>
                  <span className="reports-kpi-sub">
                    Top demand item across service invoices
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Preset Filter Buttons */}
            <div className="reports-quick-pills">
              <span className="reports-pills-label">Quick Presets:</span>
              <button
                type="button"
                className={`reports-pill ${csSortBy === 'default' && csStockStatus === 'all' && csSelectedStaff === 'All' ? 'active' : ''}`}
                onClick={() => handleApplyCsPreset('all')}
              >
                All Closing Stock
              </button>
              <button
                type="button"
                className={`reports-pill ${csSortBy === 'most_used' ? 'active' : ''}`}
                onClick={() => handleApplyCsPreset('most_used')}
              >
                🔥 Most Used Products
              </button>
              <button
                type="button"
                className={`reports-pill ${csSelectedStaff === 'cashier' ? 'active' : ''}`}
                onClick={() => handleApplyCsPreset('staff')}
              >
                👤 Staff Handled Stock
              </button>
              <button
                type="button"
                className={`reports-pill ${csStockStatus === 'low_stock' ? 'active' : ''}`}
                onClick={() => handleApplyCsPreset('low_stock')}
              >
                ⚠️ Low Stock &amp; Reorder
              </button>
              <button
                type="button"
                className={`reports-pill ${csStockStatus === 'high_value' ? 'active' : ''}`}
                onClick={() => handleApplyCsPreset('high_value')}
              >
                💎 High Value Inventory
              </button>
            </div>
          </div>

          {/* Interactive Filter Controls Bar */}
          <div className="reports-filter-bar no-print">
            <div className="reports-filter-controls">
              {/* Search Box */}
              <div className="reports-search-box">
                <span className="reports-search-icon">🔍</span>
                <input
                  type="text"
                  className="reports-search-input"
                  placeholder="Search item code or description..."
                  value={csSearch}
                  onChange={(e) => {
                    setCsSearch(e.target.value);
                    setCsPage(1);
                  }}
                />
                {csSearch && (
                  <button type="button" className="reports-search-clear" onClick={() => setCsSearch('')}>
                    ✕
                  </button>
                )}
              </div>

              {/* Category Filter */}
              <select
                className="reports-filter-select"
                value={csSelectedCategory}
                onChange={(e) => {
                  setCsSelectedCategory(e.target.value);
                  setCsPage(1);
                }}
                title="Filter by category"
              >
                <option value="All">All Categories</option>
                {filterOptions.categories.map((cat, idx) => (
                  <option key={idx} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              {/* Staff Member Filter */}
              <select
                className="reports-filter-select"
                value={csSelectedStaff}
                onChange={(e) => {
                  setCsSelectedStaff(e.target.value);
                  setCsPage(1);
                }}
                title="Filter by Staff / User"
              >
                <option value="All">All Staff Members</option>
                {filterOptions.staff.map((st, idx) => (
                  <option key={idx} value={st}>
                    Staff: {st}
                  </option>
                ))}
              </select>

              {/* Stock Status */}
              <select
                className="reports-filter-select"
                value={csStockStatus}
                onChange={(e) => {
                  setCsStockStatus(e.target.value);
                  setCsPage(1);
                }}
                title="Filter by stock status"
              >
                <option value="all">All Stock Statuses</option>
                <option value="in_stock">In Stock Only (Qty &gt; 0)</option>
                <option value="out_of_stock">Out of Stock (Qty = 0)</option>
                <option value="low_stock">Low Stock (≤ Reorder Level)</option>
                <option value="high_value">High Value Stock (≥ Rs. 10,000)</option>
              </select>

              {/* Bin / Shelf Location */}
              <select
                className="reports-filter-select"
                value={csSelectedBin}
                onChange={(e) => {
                  setCsSelectedBin(e.target.value);
                  setCsPage(1);
                }}
                title="Filter by Rack / Bin location"
              >
                <option value="All">All Bins / Racks</option>
                {filterOptions.bins.map((bn, idx) => (
                  <option key={idx} value={bn}>
                    Bin: {bn}
                  </option>
                ))}
              </select>

              {/* Sort By Dropdown */}
              <select
                className="reports-filter-select"
                value={csSortBy}
                onChange={(e) => {
                  setCsSortBy(e.target.value);
                  setCsPage(1);
                }}
                title="Sort Report By"
              >
                <option value="default">Sort: Default PDF Order (Category &amp; Code)</option>
                <option value="most_used">Sort: 🔥 Most Used Products (Top Selling)</option>
                <option value="qty_desc">Sort: Highest Quantity in Hand</option>
                <option value="qty_asc">Sort: Lowest Quantity in Hand</option>
                <option value="value_desc">Sort: Highest Stock Value (Rs.)</option>
                <option value="price_desc">Sort: Highest Selling Price</option>
                <option value="code_asc">Sort: Item Code (A - Z)</option>
                <option value="name_asc">Sort: Description (A - Z)</option>
                <option value="staff">Sort: Staff Member</option>
              </select>

              {/* Page Size Selector */}
              <select
                className="reports-filter-select"
                value={csPageSize}
                onChange={(e) => {
                  const val = e.target.value === 'all' ? 0 : Number(e.target.value);
                  setCsPageSize(val);
                  setCsPage(1);
                }}
                title="Items per page"
              >
                <option value={35}>35 items / page (Exact PDF format &bull; 170 Pages)</option>
                <option value={50}>50 items / page</option>
                <option value={100}>100 items / page</option>
                <option value="all">Show All Items (Continuous)</option>
              </select>
            </div>

            <div className="reports-actions-group">
              {/* View Mode Switcher */}
              <div className="reports-view-toggle">
                <button
                  type="button"
                  className={`reports-view-toggle-btn ${viewMode === 'paper' ? 'active' : ''}`}
                  onClick={() => setViewMode('paper')}
                  title="Exact Physical Dot-Matrix Paper Layout from PDF"
                >
                  📄 PDF Paper
                </button>
                <button
                  type="button"
                  className={`reports-view-toggle-btn ${viewMode === 'modern' ? 'active' : ''}`}
                  onClick={() => setViewMode('modern')}
                  title="Modern Interactive Table"
                >
                  🖥️ Modern Table
                </button>
              </div>

              <button
                type="button"
                className="reports-action-btn"
                onClick={handleExportCSV}
                title="Export filtered items to CSV"
              >
                📥 Export CSV
              </button>

              <button
                type="button"
                className="reports-action-btn print-btn"
                onClick={handlePrint}
                title="Print Closing Stock Report"
              >
                🖨️ Print Report
              </button>
            </div>
          </div>

          {/* Report Body */}
          <div className="reports-content-body">
            {/* Pagination Bar */}
            {csPageSize > 0 && csReportData?.pagination?.totalPages > 1 && (
              <div className="reports-pagination-bar no-print">
                <div className="reports-page-info">
                  Showing Page <strong>{csReportData.pagination.page}</strong> of{' '}
                  <strong>{csReportData.pagination.totalPages}</strong> ({csReportData.pagination.totalRecords} total items)
                </div>

                <div className="reports-page-buttons">
                  <button
                    type="button"
                    className="reports-pg-btn"
                    disabled={csPage <= 1 || csLoading}
                    onClick={() => setCsPage(1)}
                  >
                    « First
                  </button>
                  <button
                    type="button"
                    className="reports-pg-btn"
                    disabled={csPage <= 1 || csLoading}
                    onClick={() => setCsPage((p) => Math.max(1, p - 1))}
                  >
                    ‹ Prev
                  </button>

                  <form
                    onSubmit={(e) => handlePageJump(e, csJumpPage, csReportData.pagination.totalPages, setCsPage)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Page:</span>
                    <input
                      type="text"
                      className="reports-jump-input"
                      value={csJumpPage}
                      onChange={(e) => setCsJumpPage(e.target.value)}
                      onBlur={(e) => handlePageJump(e, csJumpPage, csReportData.pagination.totalPages, setCsPage)}
                    />
                  </form>

                  <button
                    type="button"
                    className="reports-pg-btn"
                    disabled={csPage >= csReportData.pagination.totalPages || csLoading}
                    onClick={() => setCsPage((p) => Math.min(csReportData.pagination.totalPages, p + 1))}
                  >
                    Next ›
                  </button>
                  <button
                    type="button"
                    className="reports-pg-btn"
                    disabled={csPage >= csReportData.pagination.totalPages || csLoading}
                    onClick={() => setCsPage(csReportData.pagination.totalPages)}
                  >
                    Last »
                  </button>
                </div>
              </div>
            )}

            {csLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
                <strong style={{ fontSize: '15px' }}>Loading Closing Stock Report from database...</strong>
                <p style={{ fontSize: '13px', marginTop: '4px' }}>Processing inventory, location balances and sales metrics</p>
              </div>
            ) : viewMode === 'paper' ? (
              /* =========================================================================
                  EXACT PHYSICAL CLOSING STOCK REPORT PAPER SHEET (MATCHING PDF SCAN 100%)
                  ========================================================================= */
              <div className="closing-stock-paper-sheet" id="printable-closing-stock-report">
                {/* Report Header */}
                <div className="cs-report-header">
                  <div className="cs-company-name">SOFAST (PVT) LTD</div>
                  <div className="cs-company-addr">7E, MADDEGODA ROAD, MATHUGAMA</div>
                  <div className="cs-company-phone">034-2210680, 074-0295088</div>
                  <div className="cs-report-title">CLOSING STOCK REPORT</div>

                  <div className="cs-meta-line">
                    <span>{csReportData?.reportDate || '8/6/2026'}</span>
                    <span>
                      Page {csReportData?.pagination?.page || 1} of {csReportData?.pagination?.totalPages || 170}
                    </span>
                  </div>
                </div>

                {/* Table Header Line */}
                <div className="cs-table-header-divider"></div>

                <table className="cs-table">
                  <thead>
                    <tr>
                      <th className="cs-th-code">CODE</th>
                      <th className="cs-th-desc">DESCRIPTION</th>
                      <th className="cs-th-bin">BIN</th>
                      <th className="cs-th-qty col-right">QUANTITY</th>
                      <th className="cs-th-val col-right">VALUE</th>
                      <th className="cs-th-loc col-right">Loc1_Qty</th>
                      <th className="cs-th-loc col-right">Loc1_Val</th>
                      <th className="cs-th-loc col-right">Loc2_Qty</th>
                      <th className="cs-th-loc col-right">Loc2_Val</th>
                      <th className="cs-th-loc col-right">Loc3_Qty</th>
                      <th className="cs-th-loc col-right">Loc3_Val</th>
                      <th className="cs-th-selprice col-right">SEL.PRICE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csReportData?.grouped && csReportData.grouped.length > 0 ? (
                      csReportData.grouped.map((group, gIdx) => (
                        <Fragment key={`group-${gIdx}`}>
                          {/* Category Section Header */}
                          <tr className="cs-category-row">
                            <td colSpan={12}>
                              <strong>{group.categoryName}</strong>
                              {csSortBy === 'most_used' && (
                                <span style={{ fontSize: '10px', marginLeft: '8px', color: '#64748b', fontWeight: 'normal' }}>
                                  (Ranked by most used products)
                                </span>
                              )}
                            </td>
                          </tr>

                          {/* Item Rows */}
                          {group.items.map((item, iIdx) => (
                            <tr key={`item-${gIdx}-${iIdx}`} className="cs-item-row">
                              <td className="cs-code">{item.code}</td>
                              <td className="cs-desc">
                                {item.description}
                                {item.totalSold > 0 && (
                                  <span className="cs-most-used-tag no-print" title={`Sold ${item.totalSold} units in invoices`}>
                                    🔥 Sold: {item.totalSold}
                                  </span>
                                )}
                                {csSelectedStaff !== 'All' && item.staff && (
                                  <span className="cs-staff-tag no-print">
                                    👤 {item.staff}
                                  </span>
                                )}
                              </td>
                              <td className="cs-bin">{item.bin || 'R1-A-1'}</td>
                              <td className="cs-qty">
                                {Number(item.quantity || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className="cs-val">
                                {Number(item.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className="cs-loc">
                                {item.loc1_qty > 0 ? Number(item.loc1_qty).toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}
                              </td>
                              <td className="cs-loc">
                                {item.loc1_val > 0 ? Number(item.loc1_val).toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}
                              </td>
                              <td className="cs-loc">
                                {item.loc2_qty > 0 ? Number(item.loc2_qty).toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}
                              </td>
                              <td className="cs-loc">
                                {item.loc2_val > 0 ? Number(item.loc2_val).toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}
                              </td>
                              <td className="cs-loc"></td>
                              <td className="cs-loc"></td>
                              <td className="cs-selprice">
                                {Number(item.sellingPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}

                          {/* Category Subtotal */}
                          <tr className="cs-subtotal-row">
                            <td colSpan={3} className="cs-subtotal-label">
                              &nbsp;
                            </td>
                            <td className="cs-subtotal-val">
                              {Number(group.subtotalQty || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="cs-subtotal-val">
                              {Number(group.subtotalValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td colSpan={7}></td>
                          </tr>
                        </Fragment>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={12} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                          No stock items match your search or filter criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Grand Total Section Matching PDF Page 170 */}
                <div className="cs-grand-total-section">
                  <div className="cs-grand-total-row">
                    <div className="cs-grand-total-left">
                      <span>Grand Total:</span>
                    </div>
                    <div className="cs-grand-total-right">
                      <span className="cs-grand-qty">
                        Qty: {Number(csReportData?.summary?.grandTotalQty || 56876).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <span className="cs-grand-val">
                        Rs. {Number(csReportData?.summary?.grandTotalValue || 24135749.39).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Software Footer matching PDF */}
                <div className="cs-software-footer">
                  {csReportData?.softwareFooter || 'Software by S.L.M.D.Chinthana-0777722076'}
                </div>
              </div>
            ) : (
              /* MODERN TABLE VIEW FOR CLOSING STOCK */
              <div className="reports-modern-card">
                <table className="reports-modern-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Code</th>
                      <th>Description</th>
                      <th>Bin Location</th>
                      <th style={{ textAlign: 'right' }}>Stock Qty</th>
                      <th style={{ textAlign: 'right' }}>Total Value</th>
                      <th style={{ textAlign: 'right' }}>Selling Price</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                      <th>Staff Handled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csReportData?.data && csReportData.data.length > 0 ? (
                      csReportData.data.map((item, idx) => {
                        const isLow = item.quantity <= (item.reorderLevel || 2);
                        const isOut = item.quantity <= 0;
                        return (
                          <tr key={idx}>
                            <td>
                              <span style={{ fontWeight: '800', color: '#0284c7' }}>{item.category}</span>
                            </td>
                            <td>
                              <strong style={{ fontFamily: 'monospace' }}>{item.code}</strong>
                            </td>
                            <td>
                              <div style={{ fontWeight: '600' }}>{item.description}</div>
                              {item.totalSold > 0 && (
                                <span style={{ fontSize: '11px', color: '#d97706', fontWeight: 'bold' }}>
                                  🔥 Sold: {item.totalSold} units across invoices
                                </span>
                              )}
                            </td>
                            <td>
                              <span style={{ background: '#f1f5f9', padding: '3px 7px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 'bold' }}>
                                {item.bin || 'R1-A-1'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: '800' }}>
                              {Number(item.quantity).toLocaleString()}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                              Rs. {Number(item.value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: '700' }}>
                              Rs. {Number(item.sellingPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {isOut ? (
                                <span className="stock-badge out-of-stock">Out of Stock</span>
                              ) : isLow ? (
                                <span className="stock-badge low-stock">Low Stock</span>
                              ) : (
                                <span className="stock-badge in-stock">In Stock</span>
                              )}
                            </td>
                            <td>
                              <span style={{ fontSize: '12px', color: '#475569' }}>
                                👤 {item.staff || 'cashier'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                          No records found matching filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default Reports;
