import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import MasterFilesDropdown from '../../components/navigation/MasterFilesDropdown';
import StockControlDropdown from '../../components/navigation/StockControlDropdown';
import SalesServiceDropdown from '../../components/navigation/SalesServiceDropdown';
import './DamageStock.css';

/**
 * DamageStock Component
 * Stock Control System - Damage Stock Management & Quarantine Control
 *
 * Features:
 * 1. Real-time quarantine inventory tracking separated from sellable stock.
 * 2. Origin classification: CUSTOMER RETURN, SHOP DAMAGE, SUPPLIER DAMAGE, STOCK ADJUSTMENT.
 * 3. Shop floor damage recording (transfers from sellable to damaged stock).
 * 4. Comprehensive audit trail / movement ledger of all damaged stock transactions.
 * 5. Direct handoff to Supplier Damage Claims.
 */
function DamageStock() {
  const navigate = useNavigate();
  const menuRef = useRef(null);

  // Navigation Dropdowns
  const [activeDropdown, setActiveDropdown] = useState(null);

  // Tabs: 'inventory' | 'record-damage' | 'audit-trail'
  const [activeTab, setActiveTab] = useState('inventory');

  // Notification Banner
  const [notification, setNotification] = useState(null);

  // Summary Metrics & Items
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [metrics, setMetrics] = useState({
    totalDamagedUnits: 0,
    totalDamagedValue: 0,
    totalQuarantinedItemsCount: 0,
    activeClaimsCount: 0,
  });
  const [damagedItems, setDamagedItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Movements Audit Trail
  const [movements, setMovements] = useState([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [movementSearch, setMovementSearch] = useState('');
  const [originFilter, setOriginFilter] = useState('ALL');

  // Record Shop Damage Form State
  const [inventoryItems, setInventoryItems] = useState([]);
  const [selectedItemCode, setSelectedItemCode] = useState('');
  const [selectedItemObj, setSelectedItemObj] = useState(null);
  const [damageQuantity, setDamageQuantity] = useState('1');
  const [damageOrigin, setDamageOrigin] = useState('SHOP DAMAGE');
  const [damageReason, setDamageReason] = useState('Dropped during stocking');
  const [damageNotes, setDamageNotes] = useState('');
  const [damageLocation, setDamageLocation] = useState('Main Store');
  const [isSubmittingDamage, setIsSubmittingDamage] = useState(false);

  // Write-Off Modal State
  const [showWriteOffModal, setShowWriteOffModal] = useState(false);
  const [writeOffItem, setWriteOffItem] = useState(null);
  const [writeOffQty, setWriteOffQty] = useState('1');
  const [writeOffReason, setWriteOffReason] = useState('Scrapped / Unsalvageable');
  const [isSubmittingWriteOff, setIsSubmittingWriteOff] = useState(false);

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
    }, 4500);
  };

  // Fetch Inventory items for picker
  useEffect(() => {
    api
      .get('/items?limit=500')
      .then((res) => {
        if (res.data?.data) {
          setInventoryItems(res.data.data);
        }
      })
      .catch(() => null);
  }, []);

  // Fetch Damage Stock Summary
  const fetchSummary = async () => {
    try {
      setLoadingSummary(true);
      const res = await api.get('/damage-stock/summary');
      if (res.data?.success && res.data.data) {
        setMetrics(res.data.data.metrics || {});
        setDamagedItems(res.data.data.items || []);
      }
    } catch (err) {
      showNotification('Failed to load damaged stock summary', 'error');
    } finally {
      setLoadingSummary(false);
    }
  };

  // Fetch Movement Audit Trail
  const fetchMovements = async () => {
    try {
      setLoadingMovements(true);
      const params = new URLSearchParams();
      if (movementSearch.trim()) params.append('search', movementSearch.trim());
      if (originFilter !== 'ALL') params.append('origin', originFilter);
      params.append('limit', '100');

      const res = await api.get(`/damage-stock/movements?${params.toString()}`);
      if (res.data?.success && res.data.data) {
        setMovements(res.data.data);
      }
    } catch (err) {
      showNotification('Failed to load movement audit trail', 'error');
    } finally {
      setLoadingMovements(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    if (activeTab === 'audit-trail') {
      fetchMovements();
    }
  }, [activeTab, originFilter]);

  // Handle Item Picker Selection for Shop Damage
  const handleSelectItem = (code) => {
    setSelectedItemCode(code);
    const found = inventoryItems.find((itm) => itm.code.toLowerCase() === code.trim().toLowerCase());
    setSelectedItemObj(found || null);
  };

  // Submit Shop Floor Damage Recording
  const handleSubmitShopDamage = async (e) => {
    if (e) e.preventDefault();

    if (!selectedItemCode.trim()) {
      showNotification('Please select or enter an item code', 'error');
      return;
    }

    const qNum = parseFloat(damageQuantity);
    if (isNaN(qNum) || qNum <= 0) {
      showNotification('Please enter a valid damage quantity greater than zero', 'error');
      return;
    }

    if (selectedItemObj) {
      const curSellable = selectedItemObj.quantity ?? selectedItemObj.stockInHand ?? 0;
      if (qNum > curSellable) {
        showNotification(
          `Cannot record damage exceeding sellable stock (${curSellable} units available)`,
          'error'
        );
        return;
      }
    }

    if (!damageReason.trim()) {
      showNotification('Please provide a damage reason', 'error');
      return;
    }

    try {
      setIsSubmittingDamage(true);
      const payload = {
        itemCode: selectedItemCode.trim(),
        quantity: qNum,
        damageReason: damageReason.trim(),
        origin: damageOrigin,
        notes: damageNotes.trim(),
        location: damageLocation,
      };

      const res = await api.post('/damage-stock/record-damage', payload);
      if (res.data?.success) {
        showNotification(
          `Recorded ${qNum} unit(s) of '${selectedItemCode}' into quarantine damaged stock!`,
          'success'
        );
        setSelectedItemCode('');
        setSelectedItemObj(null);
        setDamageQuantity('1');
        setDamageNotes('');
        fetchSummary();
        setActiveTab('inventory');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to record shop damage';
      showNotification(msg, 'error');
    } finally {
      setIsSubmittingDamage(false);
    }
  };

  // Open Write-Off Modal
  const handleOpenWriteOff = (item) => {
    setWriteOffItem(item);
    setWriteOffQty('1');
    setWriteOffReason('Scrapped / Unsalvageable damaged goods');
    setShowWriteOffModal(true);
  };

  // Submit Write-Off / Scrap
  const handleSubmitWriteOff = async (e) => {
    if (e) e.preventDefault();
    if (!writeOffItem) return;

    const qNum = parseFloat(writeOffQty);
    if (isNaN(qNum) || qNum <= 0) {
      showNotification('Please enter a valid write-off quantity', 'error');
      return;
    }

    if (qNum > writeOffItem.damagedStock) {
      showNotification(`Cannot write off more than quarantined stock (${writeOffItem.damagedStock})`, 'error');
      return;
    }

    try {
      setIsSubmittingWriteOff(true);
      const res = await api.post('/damage-stock/write-off', {
        itemCode: writeOffItem.itemCode,
        quantity: qNum,
        reason: writeOffReason.trim(),
      });

      if (res.data?.success) {
        showNotification(
          `Successfully written off ${qNum} damaged unit(s) of ${writeOffItem.itemCode}`,
          'success'
        );
        setShowWriteOffModal(false);
        setWriteOffItem(null);
        fetchSummary();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to process write-off';
      showNotification(msg, 'error');
    } finally {
      setIsSubmittingWriteOff(false);
    }
  };

  // Filtered damaged items in quarantine table
  const filteredDamagedItems = damagedItems.filter((itm) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (itm.itemCode || '').toLowerCase().includes(q) ||
      (itm.description || '').toLowerCase().includes(q) ||
      (itm.category || '').toLowerCase().includes(q) ||
      (itm.suppCode || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="sofast-app-container">
      {/* 1. Windows Blue Header Bar */}
      <header className="sofast-titlebar">
        <div className="sofast-titlebar-brand">
          <svg className="sofast-titlebar-icon" viewBox="0 0 24 24">
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
          </svg>
          <span className="sofast-titlebar-text">SOFAST MOTORS - Stock Control System</span>
        </div>
        <div className="sofast-window-controls">
          <button type="button" className="sofast-window-btn" aria-label="Minimize">&#8212;</button>
          <button type="button" className="sofast-window-btn" aria-label="Maximize">&#9633;</button>
          <button type="button" className="sofast-window-btn close" aria-label="Close" onClick={() => navigate('/selection')}>&#x2715;</button>
        </div>
      </header>

      {/* 2. Top Classic Menubar */}
      <nav className="sofast-menubar-wrapper" ref={menuRef}>
        <ul className="sofast-menubar">
          <li className="sofast-menubar-item">
            <button
              type="button"
              className={`sofast-menubar-btn ${activeDropdown === 'master-files' ? 'active' : ''}`}
              onClick={() => setActiveDropdown(activeDropdown === 'master-files' ? null : 'master-files')}
            >
              Master Files
            </button>
            {activeDropdown === 'master-files' && (
              <MasterFilesDropdown onItemClick={(item) => { setActiveDropdown(null); navigate(item.path); }} />
            )}
          </li>

          <li className="sofast-menubar-item">
            <button
              type="button"
              className={`sofast-menubar-btn active ${activeDropdown === 'stock-control' ? 'dropdown-open' : ''}`}
              onClick={() => setActiveDropdown(activeDropdown === 'stock-control' ? null : 'stock-control')}
            >
              Stock Control System
            </button>
            {activeDropdown === 'stock-control' && (
              <StockControlDropdown onItemClick={(item) => { setActiveDropdown(null); navigate(item.path); }} />
            )}
          </li>

          <li className="sofast-menubar-item">
            <button
              type="button"
              className={`sofast-menubar-btn ${activeDropdown === 'sales-service' ? 'active' : ''}`}
              onClick={() => setActiveDropdown(activeDropdown === 'sales-service' ? null : 'sales-service')}
            >
              Sales and Service
            </button>
            {activeDropdown === 'sales-service' && (
              <SalesServiceDropdown onItemClick={(item) => { setActiveDropdown(null); navigate(item.path); }} />
            )}
          </li>

          <li className="sofast-menubar-item">
            <button type="button" className="sofast-menubar-btn" onClick={() => navigate('/reports')}>
              Reports
            </button>
          </li>
          <li className="sofast-menubar-item">
            <button type="button" className="sofast-menubar-btn" onClick={() => navigate('/printer-setup')}>
              Administration
            </button>
          </li>
        </ul>
      </nav>

      {/* 3. Notification Banner */}
      {notification && (
        <div className={`dmg-alert-banner ${notification.type}`}>
          <span>{notification.message}</span>
          <button type="button" onClick={() => setNotification(null)} className="dmg-alert-close">&#x2715;</button>
        </div>
      )}

      {/* 4. Main Content Area */}
      <main className="dmg-main-container">
        {/* Title & Toolbar */}
        <div className="dmg-header-panel">
          <div className="dmg-header-left">
            <h1 className="dmg-screen-title">DAMAGE STOCK &amp; QUARANTINE CONTROL</h1>
            <p className="dmg-screen-subtitle">
              Isolate defective goods from sellable stock, record warehouse/shop damage, and audit inventory movements.
            </p>
          </div>
          <div className="dmg-header-actions">
            <button
              type="button"
              className="sofast-action-btn primary"
              onClick={() => setActiveTab('record-damage')}
            >
              + Record Shop Damage
            </button>
            <button
              type="button"
              className="sofast-action-btn secondary"
              onClick={() => navigate('/supplier-damage-claim')}
            >
              Supplier Damage Claims &rarr;
            </button>
            <button
              type="button"
              className="sofast-action-btn default"
              onClick={() => { fetchSummary(); if (activeTab === 'audit-trail') fetchMovements(); }}
            >
              &#8635; Refresh
            </button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="dmg-kpi-grid">
          <div className="dmg-kpi-card danger">
            <div className="kpi-icon">&#9888;</div>
            <div className="kpi-info">
              <span className="kpi-label">Quarantined Damaged Units</span>
              <span className="kpi-value">{metrics.totalDamagedUnits?.toLocaleString()}</span>
              <span className="kpi-sub">Total physical defective units</span>
            </div>
          </div>

          <div className="dmg-kpi-card warning">
            <div className="kpi-icon">&#128178;</div>
            <div className="kpi-info">
              <span className="kpi-label">Quarantine Stock Value</span>
              <span className="kpi-value">Rs. {metrics.totalDamagedValue?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              <span className="kpi-sub">Estimated at unit cost</span>
            </div>
          </div>

          <div className="dmg-kpi-card info">
            <div className="kpi-icon">&#128230;</div>
            <div className="kpi-info">
              <span className="kpi-label">Quarantined Item Codes</span>
              <span className="kpi-value">{metrics.totalQuarantinedItemsCount || damagedItems.length}</span>
              <span className="kpi-sub">Distinct SKUs with damaged stock</span>
            </div>
          </div>

          <div className="dmg-kpi-card success">
            <div className="kpi-icon">&#128225;</div>
            <div className="kpi-info">
              <span className="kpi-label">Active Supplier Claims</span>
              <span className="kpi-value">{metrics.activeClaimsCount}</span>
              <span className="kpi-sub">Pending supplier replacement</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="dmg-tab-bar">
          <button
            type="button"
            className={`dmg-tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            Quarantine Inventory ({filteredDamagedItems.length})
          </button>
          <button
            type="button"
            className={`dmg-tab-btn ${activeTab === 'record-damage' ? 'active' : ''}`}
            onClick={() => setActiveTab('record-damage')}
          >
            Record Shop Damage (Internal Adjustment)
          </button>
          <button
            type="button"
            className={`dmg-tab-btn ${activeTab === 'audit-trail' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit-trail')}
          >
            Stock Movement Audit Trail
          </button>
        </div>

        {/* TAB 1: Quarantine Inventory Table */}
        {activeTab === 'inventory' && (
          <div className="dmg-card-panel">
            <div className="dmg-panel-header">
              <div className="panel-title-group">
                <h2 className="dmg-panel-title">Quarantine Stock Inventory</h2>
                <span className="panel-badge">{filteredDamagedItems.length} Items</span>
              </div>
              <div className="dmg-search-wrapper">
                <input
                  type="text"
                  placeholder="Search by code, description, category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="sofast-input search"
                />
              </div>
            </div>

            {loadingSummary ? (
              <div className="dmg-loading-box">Loading quarantine stock inventory...</div>
            ) : filteredDamagedItems.length === 0 ? (
              <div className="dmg-empty-box">
                <span className="empty-icon">&#10003;</span>
                <p>No damaged items currently in quarantine.</p>
                <small>All inventory is in 100% sellable condition, or all claims have been resolved.</small>
              </div>
            ) : (
              <div className="sofast-table-container">
                <table className="sofast-grid-table">
                  <thead>
                    <tr>
                      <th style={{ width: '110px' }}>Item Code</th>
                      <th>Description</th>
                      <th style={{ width: '110px' }}>Category</th>
                      <th style={{ width: '100px' }}>Location</th>
                      <th style={{ width: '110px', textAlign: 'right' }} className="highlight-col">Damaged Stock</th>
                      <th style={{ width: '110px', textAlign: 'right' }}>Sellable Stock</th>
                      <th style={{ width: '110px', textAlign: 'right' }}>Unit Cost</th>
                      <th style={{ width: '120px', textAlign: 'right' }}>Total Value</th>
                      <th style={{ width: '180px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDamagedItems.map((itm) => (
                      <tr key={itm._id || itm.itemCode}>
                        <td className="code-cell font-mono">{itm.itemCode}</td>
                        <td className="desc-cell font-bold">{itm.description}</td>
                        <td>{itm.category || 'Standard'}</td>
                        <td>{itm.location || 'Main Store'}</td>
                        <td className="qty-cell text-right font-bold text-danger">
                          <span className="dmg-qty-badge">{itm.damagedStock}</span>
                        </td>
                        <td className="qty-cell text-right text-success font-bold">
                          {itm.sellableStock}
                        </td>
                        <td className="text-right">
                          Rs. {itm.unitCost?.toFixed(2)}
                        </td>
                        <td className="text-right font-bold">
                          Rs. {itm.totalDamagedValue?.toFixed(2)}
                        </td>
                        <td className="text-center">
                          <div className="dmg-row-actions">
                            <button
                              type="button"
                              className="dmg-row-btn claim"
                              title="Create Supplier Claim for this damaged item"
                              onClick={() => navigate(`/supplier-damage-claim?itemCode=${encodeURIComponent(itm.itemCode)}`)}
                            >
                              Claim Supplier
                            </button>
                            <button
                              type="button"
                              className="dmg-row-btn scrap"
                              title="Scrap or write off this damaged item"
                              onClick={() => handleOpenWriteOff(itm)}
                            >
                              Write-Off
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Record Shop Damage Form */}
        {activeTab === 'record-damage' && (
          <div className="dmg-card-panel">
            <div className="dmg-panel-header">
              <div>
                <h2 className="dmg-panel-title">Record Shop Damage (Internal Adjustment)</h2>
                <p className="dmg-panel-desc">
                  Transfer accidentally damaged goods from normal sellable inventory into Damaged Quarantine Stock.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitShopDamage} className="dmg-form-layout">
              <div className="dmg-form-grid">
                {/* Item Selector */}
                <div className="dmg-form-group">
                  <label className="dmg-form-label">
                    Select Item <span className="text-danger">*</span>
                  </label>
                  <div className="dmg-item-picker">
                    <input
                      type="text"
                      className="sofast-input font-mono"
                      placeholder="Enter or pick item code (e.g. 05101051)"
                      value={selectedItemCode}
                      onChange={(e) => handleSelectItem(e.target.value)}
                      required
                    />
                    <select
                      className="sofast-select"
                      value={selectedItemCode}
                      onChange={(e) => handleSelectItem(e.target.value)}
                    >
                      <option value="">-- Choose from inventory list --</option>
                      {inventoryItems.map((itm) => (
                        <option key={itm.code} value={itm.code}>
                          {itm.code} - {itm.description} (Sellable: {itm.quantity ?? itm.stockInHand ?? 0})
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedItemObj && (
                    <div className="dmg-item-preview-badge">
                      <span><strong>{selectedItemObj.description}</strong></span>
                      <span>Sellable Stock: <strong>{selectedItemObj.quantity ?? selectedItemObj.stockInHand ?? 0}</strong></span>
                      <span>Current Quarantined: <strong>{selectedItemObj.damagedStock ?? 0}</strong></span>
                    </div>
                  )}
                </div>

                {/* Quantity to Damage */}
                <div className="dmg-form-group">
                  <label className="dmg-form-label">
                    Damage Quantity <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="sofast-input"
                    value={damageQuantity}
                    onChange={(e) => setDamageQuantity(e.target.value)}
                    required
                  />
                  <small className="dmg-help-text">Will be deducted from sellable stock and added to quarantine.</small>
                </div>

                {/* Damage Origin */}
                <div className="dmg-form-group">
                  <label className="dmg-form-label">
                    Damage Origin <span className="text-danger">*</span>
                  </label>
                  <select
                    className="sofast-select"
                    value={damageOrigin}
                    onChange={(e) => setDamageOrigin(e.target.value)}
                  >
                    <option value="SHOP DAMAGE">SHOP DAMAGE (In-store mishap / dropped)</option>
                    <option value="SUPPLIER DAMAGE">SUPPLIER DAMAGE (Received broken / damaged transit)</option>
                    <option value="CUSTOMER RETURN">CUSTOMER RETURN (Defective warranty return)</option>
                  </select>
                </div>

                {/* Damage Reason */}
                <div className="dmg-form-group">
                  <label className="dmg-form-label">
                    Damage Reason <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="sofast-input"
                    value={damageReason}
                    onChange={(e) => setDamageReason(e.target.value)}
                    placeholder="e.g. Dropped during stocking, packaging punctured, fluid leak"
                    required
                  />
                </div>

                {/* Storage Location */}
                <div className="dmg-form-group">
                  <label className="dmg-form-label">Location / Bay</label>
                  <input
                    type="text"
                    className="sofast-input"
                    value={damageLocation}
                    onChange={(e) => setDamageLocation(e.target.value)}
                    placeholder="Main Store Quarantine Area"
                  />
                </div>

                {/* Notes */}
                <div className="dmg-form-group full-width">
                  <label className="dmg-form-label">Operator Notes / Circumstances</label>
                  <textarea
                    rows="3"
                    className="sofast-textarea"
                    value={damageNotes}
                    onChange={(e) => setDamageNotes(e.target.value)}
                    placeholder="Add details regarding the incident, inspection findings or photos taken..."
                  />
                </div>
              </div>

              <div className="dmg-form-actions">
                <button
                  type="submit"
                  className="sofast-action-btn primary"
                  disabled={isSubmittingDamage}
                >
                  {isSubmittingDamage ? 'Processing Adjustment...' : 'Record Damage into Quarantine Stock'}
                </button>
                <button
                  type="button"
                  className="sofast-action-btn default"
                  onClick={() => {
                    setSelectedItemCode('');
                    setSelectedItemObj(null);
                    setDamageQuantity('1');
                    setDamageNotes('');
                  }}
                >
                  Clear Form
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: Movement Audit Trail */}
        {activeTab === 'audit-trail' && (
          <div className="dmg-card-panel">
            <div className="dmg-panel-header">
              <div className="panel-title-group">
                <h2 className="dmg-panel-title">Damage Stock Movements Audit Trail</h2>
                <span className="panel-badge">{movements.length} Records</span>
              </div>
              <div className="dmg-trail-filters">
                <select
                  className="sofast-select sm"
                  value={originFilter}
                  onChange={(e) => setOriginFilter(e.target.value)}
                >
                  <option value="ALL">All Origins</option>
                  <option value="CUSTOMER RETURN">CUSTOMER RETURN</option>
                  <option value="SHOP DAMAGE">SHOP DAMAGE</option>
                  <option value="SUPPLIER DAMAGE">SUPPLIER DAMAGE</option>
                  <option value="STOCK ADJUSTMENT">STOCK ADJUSTMENT</option>
                </select>
                <input
                  type="text"
                  placeholder="Filter movements..."
                  value={movementSearch}
                  onChange={(e) => setMovementSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') fetchMovements(); }}
                  className="sofast-input search"
                />
                <button
                  type="button"
                  className="sofast-action-btn default sm"
                  onClick={fetchMovements}
                >
                  Search
                </button>
              </div>
            </div>

            {loadingMovements ? (
              <div className="dmg-loading-box">Loading movement history...</div>
            ) : movements.length === 0 ? (
              <div className="dmg-empty-box">
                <p>No stock movement records found matching the filter criteria.</p>
              </div>
            ) : (
              <div className="sofast-table-container">
                <table className="sofast-grid-table">
                  <thead>
                    <tr>
                      <th style={{ width: '100px' }}>Movement #</th>
                      <th style={{ width: '140px' }}>Date &amp; Time</th>
                      <th style={{ width: '100px' }}>Item Code</th>
                      <th>Description</th>
                      <th style={{ width: '130px' }}>Origin</th>
                      <th style={{ width: '170px' }}>Movement Type</th>
                      <th style={{ width: '70px', textAlign: 'right' }}>Qty</th>
                      <th style={{ width: '120px' }}>Reference</th>
                      <th style={{ width: '100px' }}>Operator</th>
                      <th>Reason / Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((mov) => (
                      <tr key={mov._id || mov.movementNumber}>
                        <td className="code-cell font-mono font-bold">{mov.movementNumber}</td>
                        <td className="text-muted">
                          {mov.date ? new Date(mov.date).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                        </td>
                        <td className="font-mono">{mov.itemCode}</td>
                        <td>{mov.description || '-'}</td>
                        <td>
                          <span className={`dmg-origin-badge origin-${(mov.origin || 'OTHER').replace(/\s+/g, '').toLowerCase()}`}>
                            {mov.origin}
                          </span>
                        </td>
                        <td>
                          <span className="dmg-type-tag font-mono">{mov.movementType}</span>
                        </td>
                        <td className="text-right font-bold text-danger">{mov.quantity}</td>
                        <td className="font-mono font-bold text-primary">{mov.referenceNumber || mov.invoiceNumber || '-'}</td>
                        <td>{mov.recordedBy || 'Admin'}</td>
                        <td className="notes-cell" title={mov.notes}>
                          <strong>{mov.damageReason || ''}</strong>
                          {mov.notes ? ` — ${mov.notes}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Write-Off / Scrap Modal */}
      {showWriteOffModal && writeOffItem && (
        <div className="dmg-modal-overlay">
          <div className="dmg-modal-content">
            <div className="dmg-modal-header">
              <h3>Write-Off Damaged Stock</h3>
              <button type="button" className="dmg-modal-close" onClick={() => setShowWriteOffModal(false)}>&#x2715;</button>
            </div>
            <form onSubmit={handleSubmitWriteOff} className="dmg-modal-body">
              <p className="dmg-modal-warning">
                <strong>Attention:</strong> Writing off will permanently deduct from Quarantined Damaged Stock. This cannot be undone.
              </p>

              <div className="dmg-modal-info-box">
                <div>Item: <strong>{writeOffItem.itemCode} - {writeOffItem.description}</strong></div>
                <div>Current Quarantined: <strong className="text-danger">{writeOffItem.damagedStock} units</strong></div>
              </div>

              <div className="dmg-form-group">
                <label className="dmg-form-label">Write-off Quantity</label>
                <input
                  type="number"
                  min="1"
                  max={writeOffItem.damagedStock}
                  value={writeOffQty}
                  onChange={(e) => setWriteOffQty(e.target.value)}
                  className="sofast-input"
                  required
                />
              </div>

              <div className="dmg-form-group">
                <label className="dmg-form-label">Scrap Reason / Authorization</label>
                <input
                  type="text"
                  value={writeOffReason}
                  onChange={(e) => setWriteOffReason(e.target.value)}
                  className="sofast-input"
                  required
                />
              </div>

              <div className="dmg-modal-footer">
                <button
                  type="submit"
                  className="sofast-action-btn danger"
                  disabled={isSubmittingWriteOff}
                >
                  {isSubmittingWriteOff ? 'Writing Off...' : 'Confirm Scrap / Write-Off'}
                </button>
                <button
                  type="button"
                  className="sofast-action-btn default"
                  onClick={() => setShowWriteOffModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default DamageStock;
