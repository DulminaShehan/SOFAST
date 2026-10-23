import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import './RemainingBalance.css';

/**
 * SOFAST MOTORS - Remaining Balance Screen
 * Displays customers and invoices with outstanding balances.
 * Allows filtering, searching by customer/phone/invoice,
 * and direct 'Receive Payment' action leading to Settlement Invoice.
 */
function RemainingBalance() {
  const navigate = useNavigate();
  const location = useLocation();

  // Navigation Menubar state
  const [activeDropdown, setActiveDropdown] = useState(null);
  const menuRef = useRef(null);

  // Data & State
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('outstanding'); // 'outstanding' | 'all' | 'partial' | 'unpaid' | 'paid'
  const [selectedRowId, setSelectedRowId] = useState(null);

  const cashierUser =
    localStorage.getItem('username') || localStorage.getItem('userCode') || 'PC004';

  // Navigation Menubar Items (Matching Classic SOFAST ERP)
  const topMenuItems = [
    { id: 'master-files', label: 'Master Files', hasDropdown: true },
    { id: 'stock-control', label: 'Stock Control System', hasDropdown: true },
    { id: 'sales-service', label: 'Sales and Service', hasDropdown: true },
    { id: 'production', label: 'Production', path: '/management' },
    { id: 'reports', label: 'Reports', path: '/management' },
    { id: 'accounting', label: 'Accounting', path: '/management' },
    { id: 'administration', label: 'Administration', hasDropdown: true },
  ];

  const masterFilesDropdownItems = [
    { id: 'item-master', label: 'Item Master', path: '/item-master' },
    { id: 'supplier-master', label: 'Supplier Master', path: '/supplier-master' },
    { id: 'customer-details', label: 'Customer Details', path: '/customer-details' },
    { id: 'category-master', label: 'Category Master', path: '/management' },
    { id: 'sub-category-master', label: 'Sub Category Master', path: '/management' },
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


  const administrationDropdownItems = [
    { id: 'printer-setup', label: 'Printer Setup', path: '/printer-setup' },
  ];

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

  const showNotification = (msg, type = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Fetch Remaining Balances from Backend API
  const fetchBalances = async () => {
    try {
      setLoading(true);
      // Fetch all invoices to allow client-side instant filtering while keeping 'outstanding' by default
      const res = await api.get('/invoices/remaining-balances?filter=all&limit=500');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setRecords(res.data.data);
      } else {
        setRecords([]);
      }
    } catch (err) {
      showNotification('Failed to load remaining balance data', 'error');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();

    const handleWindowFocus = () => {
      fetchBalances();
    };
    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [location.key]);

  // Filter and Search Logic
  const filteredRecords = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return records.filter((rec) => {
      // 1. Status Filter
      if (statusFilter === 'outstanding' && rec.remainingBalance <= 0) {
        return false;
      }
      if (statusFilter === 'unpaid' && rec.paymentStatus !== 'UNPAID') {
        return false;
      }
      if (statusFilter === 'partial' && rec.paymentStatus !== 'PARTIALLY PAID') {
        return false;
      }
      if (statusFilter === 'paid' && rec.paymentStatus !== 'PAID') {
        return false;
      }

      // 2. Search Query (Customer Name, Telephone, or Invoice Number)
      if (q) {
        const nameMatch = String(rec.customerName || '').toLowerCase().includes(q);
        const telMatch = String(rec.customerTelephone || '').toLowerCase().includes(q);
        const invMatch = String(rec.invoiceNumber || rec.no || '').toLowerCase().includes(q);
        const codeMatch = String(rec.customerCode || '').toLowerCase().includes(q);
        return nameMatch || telMatch || invMatch || codeMatch;
      }

      return true;
    });
  }, [records, statusFilter, searchQuery]);

  // Aggregate statistics for summary panel
  const totalOutstanding = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + (Number(r.remainingBalance) || 0), 0);
  }, [filteredRecords]);

  const totalInvoiced = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + (Number(r.invoiceTotal) || 0), 0);
  }, [filteredRecords]);

  const formatCurrency = (val) => {
    const num = Number(val) || 0;
    return `Rs. ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toISOString().split('T')[0];
    } catch (e) {
      return String(dateStr);
    }
  };

  // Action: Open Settlement Invoice to Receive Payment
  const handleReceivePayment = (item) => {
    if (!item) return;

    navigate('/settlement-invoice', {
      state: {
        invoiceNumber: item.invoiceNumber,
        invoice: item.rawInvoice,
      },
    });
  };

  return (
    <div className="remaining-balance-page-wrapper">
      {/* 1. Classic Windows Blue Header */}
      <header className="remaining-balance-win-titlebar">
        <div className="remaining-balance-win-title-left">
          <svg className="remaining-balance-car-icon" viewBox="0 0 24 24">
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
          </svg>
          <span>SOFAST MOTORS - Remaining Balance [Outstanding Invoices]</span>
        </div>
        <div className="remaining-balance-win-controls">
          <button
            type="button"
            className="remaining-balance-ctrl-btn"
            onClick={() => navigate('/management')}
            title="Minimize"
          >
            &#8212;
          </button>
          <button
            type="button"
            className="remaining-balance-ctrl-btn"
            title="Maximize"
          >
            &#9633;
          </button>
          <button
            type="button"
            className="remaining-balance-ctrl-btn close"
            onClick={() => navigate('/management')}
            title="Close"
          >
            &#x2715;
          </button>
        </div>
      </header>

      {/* 2. Top Classic Menubar */}
      <nav className="remaining-balance-menubar-container" ref={menuRef}>
        <ul className="remaining-balance-menubar">
          {topMenuItems.map((item) => (
            <li key={item.id} className="remaining-balance-menu-item-wrapper">
              <button
                type="button"
                className={`remaining-balance-menubar-btn ${
                  activeDropdown === item.id ? 'active' : ''
                }`}
                onClick={() => {
                  if (item.hasDropdown) {
                    setActiveDropdown(activeDropdown === item.id ? null : item.id);
                  } else if (item.path) {
                    setActiveDropdown(null);
                    navigate(item.path);
                  }
                }}
              >
                {item.label}
              </button>

              {/* Master Files Dropdown */}
              {item.id === 'master-files' && activeDropdown === 'master-files' && (
                <ul className="remaining-balance-dropdown-menu">
                  {masterFilesDropdownItems.map((dropItem) => (
                    <li key={dropItem.id} className="remaining-balance-dropdown-entry">
                      <button
                        type="button"
                        className="remaining-balance-dropdown-item-btn"
                        onClick={() => {
                          setActiveDropdown(null);
                          navigate(dropItem.path);
                        }}
                      >
                        <span>{dropItem.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Stock Control System Dropdown */}
              {item.id === 'stock-control' && activeDropdown === 'stock-control' && (
                <ul className="remaining-balance-dropdown-menu">
                  {stockControlDropdownItems.map((dropItem) => (
                    <li key={dropItem.id} className="remaining-balance-dropdown-entry">
                      <button
                        type="button"
                        className="remaining-balance-dropdown-item-btn"
                        onClick={() => {
                          setActiveDropdown(null);
                          navigate(dropItem.path);
                        }}
                      >
                        <span>{dropItem.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Sales and Service Dropdown */}
              {item.id === 'sales-service' && activeDropdown === 'sales-service' && (
                <ul className="remaining-balance-dropdown-menu">
                  {salesServiceDropdownItems.map((dropItem) => (
                    <li key={dropItem.id} className="remaining-balance-dropdown-entry">
                      <button
                        type="button"
                        className={`remaining-balance-dropdown-item-btn ${
                          dropItem.id === 'remaining-balance' ? 'selected' : ''
                        }`}
                        onClick={() => {
                          setActiveDropdown(null);
                          navigate(dropItem.path);
                        }}
                      >
                        <span>{dropItem.label}</span>
                        {dropItem.id === 'remaining-balance' && <span>&#10003;</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Administration Dropdown */}
              {item.id === 'administration' && activeDropdown === 'administration' && (
                <ul className="remaining-balance-dropdown-menu">
                  {administrationDropdownItems.map((dropItem) => (
                    <li key={dropItem.id} className="remaining-balance-dropdown-entry">
                      <button
                        type="button"
                        className="remaining-balance-dropdown-item-btn"
                        onClick={() => {
                          setActiveDropdown(null);
                          navigate(dropItem.path);
                        }}
                      >
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

      {/* 3. Main Workspace */}
      <main className="remaining-balance-main-container">
        {/* Notification Banner */}
        {notification && (
          <div className={`remaining-balance-alert ${notification.type}`}>
            <span>{notification.message}</span>
            <button
              type="button"
              className="remaining-balance-ctrl-btn"
              style={{ width: '16px', height: '16px', fontSize: '9px' }}
              onClick={() => setNotification(null)}
            >
              &#x2715;
            </button>
          </div>
        )}

        {/* Filter Bar & KPI Panel */}
        <section className="remaining-balance-panel">
          <div className="remaining-balance-filter-bar">
            {/* Search Input Box */}
            <div className="remaining-balance-search-box">
              <span className="remaining-balance-label">Search Invoices / Customers:</span>
              <input
                type="text"
                className="remaining-balance-input"
                placeholder="Search by customer name, telephone, or invoice number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  className="remaining-balance-btn-classic"
                  onClick={() => setSearchQuery('')}
                  title="Clear Search"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Radio Filter Options */}
            <div className="remaining-balance-filter-options">
              <label className="remaining-balance-radio-label">
                <input
                  type="radio"
                  name="statusFilter"
                  value="outstanding"
                  checked={statusFilter === 'outstanding'}
                  onChange={(e) => setStatusFilter(e.target.value)}
                />
                <strong>Outstanding Only (Default)</strong>
              </label>
              <label className="remaining-balance-radio-label">
                <input
                  type="radio"
                  name="statusFilter"
                  value="all"
                  checked={statusFilter === 'all'}
                  onChange={(e) => setStatusFilter(e.target.value)}
                />
                <span>All Invoices</span>
              </label>
              <label className="remaining-balance-radio-label">
                <input
                  type="radio"
                  name="statusFilter"
                  value="partial"
                  checked={statusFilter === 'partial'}
                  onChange={(e) => setStatusFilter(e.target.value)}
                />
                <span>Partially Paid</span>
              </label>
              <label className="remaining-balance-radio-label">
                <input
                  type="radio"
                  name="statusFilter"
                  value="unpaid"
                  checked={statusFilter === 'unpaid'}
                  onChange={(e) => setStatusFilter(e.target.value)}
                />
                <span>Unpaid</span>
              </label>
              <label className="remaining-balance-radio-label">
                <input
                  type="radio"
                  name="statusFilter"
                  value="paid"
                  checked={statusFilter === 'paid'}
                  onChange={(e) => setStatusFilter(e.target.value)}
                />
                <span>Paid</span>
              </label>

              <button
                type="button"
                className="remaining-balance-btn-classic"
                onClick={fetchBalances}
                disabled={loading}
                title="Refresh from Database"
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {/* KPI Cards */}
            <div className="remaining-balance-kpi-container">
              <div className="remaining-balance-kpi-card">
                <span className="remaining-balance-kpi-title">Invoices Listed</span>
                <span className="remaining-balance-kpi-value">{filteredRecords.length}</span>
              </div>
              <div className="remaining-balance-kpi-card">
                <span className="remaining-balance-kpi-title">Total Outstanding</span>
                <span className="remaining-balance-kpi-value outstanding">
                  {formatCurrency(totalOutstanding)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Table / Grid */}
        <section className="remaining-balance-table-container">
          <table className="remaining-balance-table">
            <thead>
              <tr>
                <th className="text-center" style={{ width: '38px' }}>#</th>
                <th style={{ width: '85px' }}>Invoice No</th>
                <th style={{ width: '90px' }}>Date</th>
                <th>Customer Name</th>
                <th style={{ width: '110px' }}>Telephone</th>
                <th className="text-right" style={{ width: '105px' }}>Invoice Total</th>
                <th className="text-right" style={{ width: '105px' }}>Paid / Applied</th>
                <th className="text-right" style={{ width: '115px' }}>Remaining Balance</th>
                <th className="text-center" style={{ width: '110px' }}>Payment Status</th>
                <th className="text-center" style={{ width: '130px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
                    Loading remaining balances from database...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '32px', color: '#666' }}>
                    {searchQuery
                      ? `No invoices matching "${searchQuery}" found.`
                      : statusFilter === 'outstanding'
                      ? 'No outstanding invoice balances pending payment.'
                      : 'No invoices found.'}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((row, idx) => {
                  const isSelected = selectedRowId === row._id;
                  const hasDue = Number(row.remainingBalance) > 0;

                  return (
                    <tr
                      key={row._id}
                      className={isSelected ? 'row-selected' : ''}
                      onClick={() => setSelectedRowId(row._id)}
                    >
                      <td className="text-center" style={{ color: '#666' }}>{idx + 1}</td>
                      <td>
                        <span
                          className="remaining-balance-inv-link"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReceivePayment(row);
                          }}
                          title="Click to settle invoice"
                        >
                          {row.invoiceNumber}
                        </span>
                      </td>
                      <td>{formatDate(row.date)}</td>
                      <td>
                        <strong>{row.customerName}</strong>
                        {row.customerCode ? ` (${row.customerCode})` : ''}
                      </td>
                      <td>{row.customerTelephone || '-'}</td>
                      <td className="text-right remaining-balance-amt-total">
                        {formatCurrency(row.invoiceTotal)}
                      </td>
                      <td className="text-right remaining-balance-amt-paid">
                        {formatCurrency(row.totalPaid)}
                      </td>
                      <td
                        className={`text-right ${
                          hasDue ? 'remaining-balance-amt-due' : 'remaining-balance-amt-settled'
                        }`}
                      >
                        {formatCurrency(row.remainingBalance)}
                      </td>
                      <td className="text-center">
                        <span
                          className={`remaining-balance-status-badge ${
                            row.paymentStatus === 'PAID'
                              ? 'paid'
                              : row.paymentStatus === 'PARTIALLY PAID'
                              ? 'partial'
                              : 'unpaid'
                          }`}
                        >
                          {row.paymentStatus}
                        </span>
                      </td>
                      <td className="text-center">
                        {hasDue ? (
                          <button
                            type="button"
                            className="remaining-balance-btn-receive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReceivePayment(row);
                            }}
                            title={`Receive payment for invoice #${row.invoiceNumber}`}
                          >
                            Receive Payment
                          </button>
                        ) : (
                          <span style={{ color: '#166534', fontWeight: 'bold', fontSize: '10px' }}>
                            &#10003; Settled
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>

        {/* 4. Bottom Status Footer */}
        <footer className="remaining-balance-footer">
          <div className="remaining-balance-footer-left">
            <span><strong>Ready</strong></span>
            <span>Total Records: <strong>{filteredRecords.length}</strong></span>
            <span>Total Outstanding Amount: <strong style={{ color: '#b91c1c' }}>{formatCurrency(totalOutstanding)}</strong></span>
            <span>User: <strong>{cashierUser}</strong></span>
          </div>
          <div className="remaining-balance-footer-right">
            <button
              type="button"
              className="remaining-balance-btn-classic"
              onClick={() => navigate('/invoice')}
            >
              Create Invoice
            </button>
            <button
              type="button"
              className="remaining-balance-btn-classic"
              onClick={() => navigate('/settlement-invoice')}
            >
              Settlement Invoice
            </button>
            <button
              type="button"
              className="remaining-balance-btn-classic"
              onClick={() => navigate('/management')}
            >
              Close
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default RemainingBalance;
