import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './GoodReturnNote.css';

/**
 * SOFAST POS — Good Return Note (GREN)
 *
 * Implements the classic Windows ERP Good Return Note form under Stock Control System.
 * Matches the exact UI layout from the legacy VB6 reference:
 *  - Header: GREN No (auto-sequential from 0), Date, GRN selection, Supplier details display text
 *  - Top Table: Return Entry (CODE, DESCRIPTION, PRICE, QUANTITY, DISCOUNT, VALUE, QTY RETURN)
 *  - Middle Section: "Details of the Current G.R.E.N." with buttons: New, Delete, Update, Validate, Save
 *  - Bottom Section: "Details of the G.R.N."
 *
 * Stock Management:
 *  - Deducts sellable inventory (quantity & stockInHand) exactly once upon Save/Update.
 *  - Restores inventory when a return note is Deleted.
 *  - Prevents returning more than the eligible quantity or current sellable stock.
 */
function GoodReturnNote() {
  const navigate = useNavigate();

  // Notification State
  const [notification, setNotification] = useState(null);
  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  };

  // Confirmation Modal State (for Delete, Validate)
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmAction: null,
    isAlertOnly: false,
  });

  // Top File Menu state
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const fileMenuRef = useRef(null);

  // Form Header State
  const [grenNumber, setGrenNumber] = useState('0');
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedGrnNumber, setSelectedGrnNumber] = useState('');
  const [supplierDetailsText, setSupplierDetailsText] = useState('');

  // Dropdown Lists
  const [grnList, setGrnList] = useState([]);
  const [existingGrenList, setExistingGrenList] = useState([]);

  // Full Data Objects
  const [selectedGrnData, setSelectedGrnData] = useState(null);
  const [currentGrenRecord, setCurrentGrenRecord] = useState(null);
  const [isSavedRecord, setIsSavedRecord] = useState(false);
  const [loading, setLoading] = useState(false);

  // Tables State
  // 1. Top Table: Items available for return entry with user input for qtyReturn
  const [returnEntryLines, setReturnEntryLines] = useState([]);

  // 2. Middle Table: Items in current GREN
  // 3. Bottom Table: Original GRN items
  // Selected row highlight state
  const [selectedTopRow, setSelectedTopRow] = useState(-1);
  const [selectedMidRow, setSelectedMidRow] = useState(-1);
  const [selectedBotRow, setSelectedBotRow] = useState(-1);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target)) {
        setFileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch initial next GREN number, existing returns, and GRNs on load
  useEffect(() => {
    initNewReturnNote();
    fetchGrnList();
    fetchExistingGrenList();
  }, []);

  /**
   * Initialize a new Good Return Note
   * Requirement 1: Sequential number starts from 0, then 1, 2, 3...
   */
  const initNewReturnNote = async () => {
    try {
      setLoading(true);
      const res = await api.get('/good-returns/next-number');
      if (res.data && res.data.success) {
        const nextNum = String(res.data.grenNumber !== undefined ? res.data.grenNumber : res.data.nextNumber);
        setGrenNumber(nextNum);
      } else {
        setGrenNumber('0');
      }
    } catch (err) {
      console.warn('Failed to fetch next GREN number, defaulting to 0:', err);
      setGrenNumber('0');
    } finally {
      setLoading(false);
    }

    setReturnDate(new Date().toISOString().split('T')[0]);
    setSelectedGrnNumber('');
    setSupplierDetailsText('');
    setSelectedGrnData(null);
    setCurrentGrenRecord(null);
    setIsSavedRecord(false);
    setReturnEntryLines([]);
    setSelectedTopRow(-1);
    setSelectedMidRow(-1);
    setSelectedBotRow(-1);
  };

  /**
   * Fetch list of available GRNs
   */
  const fetchGrnList = async () => {
    try {
      const res = await api.get('/good-returns/grns');
      if (res.data && res.data.success) {
        setGrnList(res.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching GRN list:', err);
    }
  };

  /**
   * Fetch list of existing GRENs for dropdown selection
   */
  const fetchExistingGrenList = async () => {
    try {
      const res = await api.get('/good-returns?limit=200');
      if (res.data && res.data.success) {
        setExistingGrenList(res.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching existing GREN list:', err);
    }
  };

  /**
   * Handle GRN Selection from Grn dropdown
   * Loads real items recorded in that GRN and populates Top & Bottom tables
   */
  const handleGrnChange = async (grnNum) => {
    const cleanNum = String(grnNum).trim();
    setSelectedGrnNumber(cleanNum);

    if (!cleanNum) {
      setSupplierDetailsText('');
      setSelectedGrnData(null);
      setReturnEntryLines([]);
      return;
    }

    try {
      setLoading(true);
      const res = await api.get(`/good-returns/grn/${encodeURIComponent(cleanNum)}`);
      if (res.data && res.data.success && res.data.data) {
        const grnData = res.data.data;
        setSelectedGrnData(grnData);

        // Update supplier & receipt details display box
        const suppCode = grnData.supplierCode || '';
        const suppName = grnData.supplierName || '';
        const invNo = grnData.supplierInvoiceNo ? ` (Inv: ${grnData.supplierInvoiceNo})` : '';
        const totalVal = grnData.totalValue ? ` - Total: Rs. ${Number(grnData.totalValue).toFixed(2)}` : '';
        setSupplierDetailsText(`${suppName} ${suppCode ? `[${suppCode}]` : ''}${invNo}${totalVal}`);

        // Populate return entry lines for top table
        const lines = (grnData.lineItems || []).map((li) => {
          const originalQty = Number(li.quantity !== undefined ? li.quantity : li.qty || 0);
          const alreadyReturned = Number(li.alreadyReturnedQty || 0);
          const eligibleQty = Math.max(0, Math.round((originalQty - alreadyReturned) * 100) / 100);
          const price = Number(li.unitPrice !== undefined ? li.unitPrice : li.price || 0);
          const discount = Number(li.discount || 0);
          const originalValue = Number(li.totalValue !== undefined ? li.totalValue : li.value || 0);

          return {
            code: li.code || li.itemCode || '',
            description: li.description || '',
            price,
            quantity: originalQty,
            discount,
            value: originalValue,
            qtyReturn: '', // user will enter this
            alreadyReturnedQty: alreadyReturned,
            eligibleReturnQty: eligibleQty,
            currentStock: Number(li.currentStock || 0),
            locationCode: li.locationCode || 'MAIN',
          };
        });

        setReturnEntryLines(lines);
      } else {
        showNotification('error', `Failed to load details for GRN ${cleanNum}`);
      }
    } catch (err) {
      console.error('Error fetching GRN details:', err);
      showNotification('error', err.response?.data?.message || `GRN ${cleanNum} not found`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle selecting an existing GREN from Gren dropdown
   */
  const handleGrenSelect = async (gNum) => {
    const cleanNum = String(gNum).trim();
    if (!cleanNum) return;

    // Check if this matches a saved GREN
    const exists = existingGrenList.find(
      (e) => String(e.returnNumber) === cleanNum || String(e.grenNumber) === cleanNum || String(e.no) === cleanNum
    );

    if (!exists) {
      // User typed a custom or new number
      setGrenNumber(cleanNum);
      setIsSavedRecord(false);
      setCurrentGrenRecord(null);
      return;
    }

    try {
      setLoading(true);
      const res = await api.get(`/good-returns/${encodeURIComponent(cleanNum)}`);
      if (res.data && res.data.success && res.data.data) {
        const record = res.data.data;
        setCurrentGrenRecord(record);
        setIsSavedRecord(true);
        setGrenNumber(String(record.returnNumber || record.grenNumber || record.no));
        if (record.date) {
          setReturnDate(new Date(record.date).toISOString().split('T')[0]);
        }

        const linkedGrn = String(record.grnReference || record.grnNumber || '');
        setSelectedGrnNumber(linkedGrn);

        // Fetch GRN details to populate bottom table and baseline
        if (linkedGrn) {
          const grnRes = await api.get(`/good-returns/grn/${encodeURIComponent(linkedGrn)}?excludeGrenNumber=${encodeURIComponent(cleanNum)}`);
          if (grnRes.data && grnRes.data.success && grnRes.data.data) {
            const grnData = grnRes.data.data;
            setSelectedGrnData(grnData);

            const suppCode = record.supplierCode || grnData.supplierCode || '';
            const suppName = record.supplierName || grnData.supplierName || '';
            const invNo = grnData.supplierInvoiceNo ? ` (Inv: ${grnData.supplierInvoiceNo})` : '';
            setSupplierDetailsText(`${suppName} ${suppCode ? `[${suppCode}]` : ''}${invNo}`);

            // Pre-fill top table with the saved returned quantities
            const savedItemsMap = new Map();
            (record.lineItems || []).forEach((li) => {
              const code = String(li.itemCode || li.code || '').trim().toLowerCase();
              savedItemsMap.set(code, Number(li.qtyReturn !== undefined ? li.qtyReturn : li.returnQuantity || 0));
            });

            const lines = (grnData.lineItems || []).map((li) => {
              const originalQty = Number(li.quantity !== undefined ? li.quantity : li.qty || 0);
              const alreadyReturned = Number(li.alreadyReturnedQty || 0);
              const eligibleQty = Math.max(0, Math.round((originalQty - alreadyReturned) * 100) / 100);
              const price = Number(li.unitPrice !== undefined ? li.unitPrice : li.price || 0);
              const discount = Number(li.discount || 0);
              const originalValue = Number(li.totalValue !== undefined ? li.totalValue : li.value || 0);
              const codeKey = String(li.code || li.itemCode || '').trim().toLowerCase();
              const savedQty = savedItemsMap.get(codeKey);

              return {
                code: li.code || li.itemCode || '',
                description: li.description || '',
                price,
                quantity: originalQty,
                discount,
                value: originalValue,
                qtyReturn: savedQty !== undefined ? String(savedQty) : '',
                alreadyReturnedQty: alreadyReturned,
                eligibleReturnQty: eligibleQty + (savedQty || 0), // include this note's own quantity as eligible
                currentStock: Number(li.currentStock || 0),
                locationCode: li.locationCode || 'MAIN',
              };
            });

            setReturnEntryLines(lines);
          }
        }

        showNotification('info', `Loaded Good Return Note #${cleanNum}`);
      }
    } catch (err) {
      console.error('Error fetching GREN details:', err);
      showNotification('error', err.response?.data?.message || `Failed to load GREN #${cleanNum}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle user typing in QTY RETURN column in Top Table
   */
  const handleQtyReturnChange = (index, value) => {
    setReturnEntryLines((prev) => {
      const updated = [...prev];
      const target = { ...updated[index] };
      target.qtyReturn = value;
      updated[index] = target;
      return updated;
    });
  };

  /**
   * Derive items to show in Middle Table ("Details of the Current G.R.E.N.")
   * Shows active staged return lines if new, or saved lines if record is saved.
   */
  const middleTableItems = useMemo(() => {
    if (isSavedRecord && currentGrenRecord && Array.isArray(currentGrenRecord.lineItems)) {
      return currentGrenRecord.lineItems.map((li, idx) => ({
        no: idx + 1,
        code: li.itemCode || li.code || '',
        description: li.description || '',
        price: Number(li.unitPrice !== undefined ? li.unitPrice : li.price || 0),
        quantity: Number(li.quantity !== undefined ? li.quantity : li.qty || 0),
        discount: Number(li.discount || 0),
        value: Number(li.totalValue !== undefined ? li.totalValue : li.value || 0),
        qtyReturn: Number(li.qtyReturn !== undefined ? li.qtyReturn : li.returnQuantity || 0),
      }));
    }

    // For new/editing draft: show rows where qtyReturn > 0
    return returnEntryLines
      .filter((line) => {
        const q = parseFloat(line.qtyReturn);
        return !isNaN(q) && q > 0;
      })
      .map((line, idx) => {
        const q = parseFloat(line.qtyReturn);
        const lineVal = Math.round(q * line.price * (1 - line.discount / 100) * 100) / 100;
        return {
          no: idx + 1,
          code: line.code,
          description: line.description,
          price: line.price,
          quantity: line.quantity,
          discount: line.discount,
          value: lineVal,
          qtyReturn: q,
        };
      });
  }, [isSavedRecord, currentGrenRecord, returnEntryLines]);

  /**
   * Derive items to show in Bottom Table ("Details of the G.R.N.")
   * Shows the original GRN line items with original qty, price, discount, value, and cumulative qty returned.
   */
  const bottomTableItems = useMemo(() => {
    if (!selectedGrnData || !Array.isArray(selectedGrnData.lineItems)) {
      return [];
    }

    return selectedGrnData.lineItems.map((li, idx) => ({
      no: idx + 1,
      code: li.code || li.itemCode || '',
      description: li.description || '',
      price: Number(li.unitPrice !== undefined ? li.unitPrice : li.price || 0),
      quantity: Number(li.quantity !== undefined ? li.quantity : li.qty || 0),
      discount: Number(li.discount || 0),
      value: Number(li.totalValue !== undefined ? li.totalValue : li.value || 0),
      qtyReturn: Number(li.alreadyReturnedQty || 0),
    }));
  }, [selectedGrnData]);

  /**
   * Action: Validate Button
   * Pre-flight checks without modifying inventory
   */
  const handleValidate = async () => {
    if (!selectedGrnNumber) {
      showNotification('error', 'Please select a GRN first.');
      return;
    }

    const validLines = returnEntryLines.filter((l) => {
      const q = parseFloat(l.qtyReturn);
      return !isNaN(q) && q > 0;
    });

    if (validLines.length === 0) {
      showNotification('error', 'Please enter a return quantity (QTY RETURN > 0) for at least one item.');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        grnNumber: selectedGrnNumber,
        lineItems: validLines.map((l) => ({
          code: l.code,
          itemCode: l.code,
          qtyReturn: parseFloat(l.qtyReturn),
        })),
      };

      const res = await api.post('/good-returns/validate', payload);
      if (res.data && res.data.success) {
        setModalState({
          isOpen: true,
          title: 'G.R.E.N. Validation Result',
          message: `${res.data.message}\n\nAll items belong to GRN ${selectedGrnNumber}, quantities are within eligible limits, and current sellable inventory is confirmed. Ready to Save.`,
          isAlertOnly: true,
          confirmAction: null,
        });
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Validation failed. Please check quantities.';
      setModalState({
        isOpen: true,
        title: 'Validation Warning',
        message: errMsg,
        isAlertOnly: true,
        confirmAction: null,
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Action: Save Button
   * Removes returned goods from sellable stock exactly once and saves GREN
   */
  const handleSave = async () => {
    if (isSavedRecord) {
      showNotification('info', `Good Return Note #${grenNumber} is already saved. Use Update to modify it.`);
      return;
    }

    if (!grenNumber || !grenNumber.trim()) {
      showNotification('error', 'Good Return Note (GREN) Number is required.');
      return;
    }

    if (!selectedGrnNumber) {
      showNotification('error', 'Please select a Goods Received Note (GRN).');
      return;
    }

    const itemsToSave = returnEntryLines.filter((l) => {
      const q = parseFloat(l.qtyReturn);
      return !isNaN(q) && q > 0;
    });

    if (itemsToSave.length === 0) {
      showNotification('error', 'Please enter a return quantity (QTY RETURN > 0) for at least one item.');
      return;
    }

    // Client-side quick check on eligible quantity
    for (const item of itemsToSave) {
      const q = parseFloat(item.qtyReturn);
      if (q > item.eligibleReturnQty) {
        showNotification(
          'error',
          `Item '${item.code}': Return quantity (${q}) exceeds eligible return quantity (${item.eligibleReturnQty})`
        );
        return;
      }
      if (q > item.currentStock) {
        showNotification(
          'error',
          `Item '${item.code}': Insufficient current sellable stock in inventory (Available: ${item.currentStock})`
        );
        return;
      }
    }

    try {
      setLoading(true);
      const payload = {
        grenNumber: grenNumber.trim(),
        returnNumber: grenNumber.trim(),
        no: !isNaN(Number(grenNumber)) ? Number(grenNumber) : 0,
        date: returnDate,
        grnNumber: selectedGrnNumber,
        grnReference: selectedGrnNumber,
        supplierCode: selectedGrnData?.supplierCode || '',
        supplierName: selectedGrnData?.supplierName || '',
        lineItems: itemsToSave.map((item) => ({
          code: item.code,
          itemCode: item.code,
          description: item.description,
          unitPrice: item.price,
          quantity: item.quantity,
          discount: item.discount,
          qtyReturn: parseFloat(item.qtyReturn),
          locationCode: item.locationCode || 'MAIN',
        })),
      };

      const res = await api.post('/good-returns', payload);
      if (res.data && res.data.success) {
        showNotification('success', `Good Return Note #${grenNumber} saved successfully and inventory stock deducted.`);
        setIsSavedRecord(true);
        setCurrentGrenRecord(res.data.data);

        // Refresh dropdown lists and GRN details
        await fetchExistingGrenList();
        await fetchGrnList();
        if (selectedGrnNumber) {
          await handleGrnChange(selectedGrnNumber);
        }
      }
    } catch (err) {
      console.error('Error saving Good Return Note:', err);
      showNotification('error', err.response?.data?.message || 'Failed to save Good Return Note');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Action: Update Button
   * Updates an existing GREN and recalculates stock differences safely
   */
  const handleUpdate = async () => {
    if (!isSavedRecord) {
      showNotification('info', 'Please select or save an existing Good Return Note to update.');
      return;
    }

    const itemsToUpdate = returnEntryLines.filter((l) => {
      const q = parseFloat(l.qtyReturn);
      return !isNaN(q) && q > 0;
    });

    if (itemsToUpdate.length === 0) {
      showNotification('error', 'A Good Return Note must have at least one returned item.');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        date: returnDate,
        lineItems: itemsToUpdate.map((item) => ({
          code: item.code,
          itemCode: item.code,
          description: item.description,
          unitPrice: item.price,
          quantity: item.quantity,
          discount: item.discount,
          qtyReturn: parseFloat(item.qtyReturn),
          locationCode: item.locationCode || 'MAIN',
        })),
      };

      const res = await api.put(`/good-returns/${encodeURIComponent(grenNumber)}`, payload);
      if (res.data && res.data.success) {
        showNotification('success', `Good Return Note #${grenNumber} updated successfully and stock adjusted.`);
        setCurrentGrenRecord(res.data.data);
        await fetchExistingGrenList();
        await fetchGrnList();
      }
    } catch (err) {
      console.error('Error updating Good Return Note:', err);
      showNotification('error', err.response?.data?.message || 'Failed to update Good Return Note');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Action: Delete Button
   * Confirms and deletes a saved GREN, safely reversing its stock deductions
   */
  const handleDeletePrompt = () => {
    if (!isSavedRecord) {
      showNotification('info', 'Delete is only available for saved Good Return Notes.');
      return;
    }

    setModalState({
      isOpen: true,
      title: 'Confirm Delete',
      message: `Are you sure you want to delete Good Return Note #${grenNumber}?\n\nThis will safely reverse its stock deductions and restore returned items back to sellable inventory.`,
      isAlertOnly: false,
      confirmAction: executeDelete,
    });
  };

  const executeDelete = async () => {
    setModalState({ isOpen: false, title: '', message: '', confirmAction: null, isAlertOnly: false });

    try {
      setLoading(true);
      const res = await api.delete(`/good-returns/${encodeURIComponent(grenNumber)}`);
      if (res.data && res.data.success) {
        showNotification('success', `Good Return Note #${grenNumber} deleted and returned items restored to inventory.`);
        await fetchExistingGrenList();
        await fetchGrnList();
        await initNewReturnNote();
      }
    } catch (err) {
      console.error('Error deleting Good Return Note:', err);
      showNotification('error', err.response?.data?.message || 'Failed to delete Good Return Note');
    } finally {
      setLoading(false);
    }
  };

  // Helper to render empty grid rows to fill table areas
  const renderEmptyRows = (currentCount, targetCount = 6) => {
    const emptyCount = Math.max(0, targetCount - currentCount);
    const rows = [];
    for (let i = 0; i < emptyCount; i++) {
      rows.push(
        <tr key={`empty-${i}`} className="empty-row">
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td style={{ width: 18 }}>&nbsp;</td>
        </tr>
      );
    }
    return rows;
  };

  return (
    <div className="gren-window-container">
      {/* 1. Window Title Bar */}
      <div className="gren-titlebar">
        <div className="gren-titlebar-left">
          <span className="gren-titlebar-title">Good Return Note</span>
        </div>
        <div className="gren-titlebar-controls">
          <button
            type="button"
            className="gren-titlebar-btn-close"
            onClick={() => navigate('/management')}
            title="Close"
          >
            &#x2715;
          </button>
        </div>
      </div>

      {/* 2. Menu Bar */}
      <div className="gren-menubar">
        <div className="gren-menu-item" ref={fileMenuRef} onClick={() => setFileMenuOpen(!fileMenuOpen)}>
          File
          {fileMenuOpen && (
            <div className="gren-menu-dropdown" onClick={(e) => e.stopPropagation()}>
              <div
                className="gren-menu-dropdown-item"
                onClick={() => {
                  setFileMenuOpen(false);
                  initNewReturnNote();
                }}
              >
                <span>New</span>
                <span style={{ color: '#666', fontSize: 10 }}>Ctrl+N</span>
              </div>
              <div
                className="gren-menu-dropdown-item"
                onClick={() => {
                  setFileMenuOpen(false);
                  handleSave();
                }}
              >
                <span>Save</span>
                <span style={{ color: '#666', fontSize: 10 }}>Ctrl+S</span>
              </div>
              <div
                className="gren-menu-dropdown-item"
                onClick={() => {
                  setFileMenuOpen(false);
                  handleValidate();
                }}
              >
                <span>Validate</span>
              </div>
              <div className="gren-menu-separator" />
              <div
                className="gren-menu-dropdown-item"
                onClick={() => {
                  setFileMenuOpen(false);
                  navigate('/grn');
                }}
              >
                <span>Good Receive Note (GRN)</span>
              </div>
              <div
                className="gren-menu-dropdown-item"
                onClick={() => {
                  setFileMenuOpen(false);
                  navigate('/damage');
                }}
              >
                <span>Damage</span>
              </div>
              <div className="gren-menu-separator" />
              <div
                className="gren-menu-dropdown-item"
                onClick={() => {
                  setFileMenuOpen(false);
                  navigate('/management');
                }}
              >
                <span>Exit</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Main Form Body */}
      <div className="gren-form-body">
        {/* Top Header Box */}
        <div className="gren-header-box">
          {/* Sub-group: Gren & Date */}
          <div className="gren-sub-group">
            <span className="gren-label">Gren</span>
            <div className="gren-combo-wrapper">
              <select
                className="gren-combo-select gren-input-gren-no"
                value={grenNumber}
                onChange={(e) => handleGrenSelect(e.target.value)}
              >
                {/* Always include current GREN number */}
                {!existingGrenList.some((n) => String(n.returnNumber || n.no) === String(grenNumber)) && (
                  <option value={grenNumber}>{grenNumber}</option>
                )}
                {existingGrenList.map((g) => {
                  const num = String(g.returnNumber || g.grenNumber || g.no);
                  return (
                    <option key={g._id || num} value={num}>
                      {num} {g.supplierName ? `- ${g.supplierName}` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <span className="gren-label" style={{ marginLeft: 6 }}>Date</span>
            <input
              type="date"
              className="gren-date-input"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
            />
          </div>

          {/* Grn Selection & Details Display Area */}
          <div className="gren-field-group" style={{ flex: 1 }}>
            <span className="gren-label">Grn</span>
            <select
              className="gren-combo-select gren-input-grn-no"
              value={selectedGrnNumber}
              onChange={(e) => handleGrnChange(e.target.value)}
            >
              <option value="">-- Select --</option>
              {grnList.map((g) => {
                const gNum = String(g.grnNumber !== undefined ? g.grnNumber : g.no);
                return (
                  <option key={g._id || gNum} value={gNum}>
                    {gNum} {g.supplierName ? `(${g.supplierName})` : ''}
                  </option>
                );
              })}
            </select>

            {/* Supplier / receipt details display box */}
            <input
              type="text"
              readOnly
              className="gren-supplier-details-input"
              value={supplierDetailsText}
              placeholder="Supplier and receipt details will appear here..."
            />
          </div>
        </div>

        {/* 1. Top Table: Return Entry */}
        <div className="gren-table-container">
          <div className="gren-table-scroll-area gren-table-scroll-area-top">
            <table className="gren-grid-table">
              <thead>
                <tr>
                  <th style={{ width: 130 }}>CODE</th>
                  <th style={{ width: 260 }}>DESCRIPTION</th>
                  <th style={{ width: 100 }} className="align-right">PRICE</th>
                  <th style={{ width: 95 }} className="align-right">QUANTITY</th>
                  <th style={{ width: 85 }} className="align-right">DISCOUNT</th>
                  <th style={{ width: 110 }} className="align-right">VALUE</th>
                  <th style={{ width: 110 }} className="align-right">QTY RETURN</th>
                  <th style={{ width: 18 }}></th>
                </tr>
              </thead>
              <tbody>
                {returnEntryLines.length > 0 ? (
                  returnEntryLines.map((row, idx) => (
                    <tr
                      key={row.code || idx}
                      className={selectedTopRow === idx ? 'selected' : ''}
                      onClick={() => setSelectedTopRow(idx)}
                    >
                      <td style={{ width: 130 }} title={row.code}>{row.code}</td>
                      <td style={{ width: 260 }} title={row.description}>{row.description}</td>
                      <td style={{ width: 100 }} className="align-right">{row.price.toFixed(2)}</td>
                      <td style={{ width: 95 }} className="align-right">{row.quantity}</td>
                      <td style={{ width: 85 }} className="align-right">{row.discount}%</td>
                      <td style={{ width: 110 }} className="align-right">{row.value.toFixed(2)}</td>
                      <td style={{ width: 110 }} className="align-right" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max={row.eligibleReturnQty}
                          className="gren-cell-input"
                          value={row.qtyReturn}
                          onChange={(e) => handleQtyReturnChange(idx, e.target.value)}
                          placeholder="0"
                          title={`Eligible to return: ${row.eligibleReturnQty} | Current Stock: ${row.currentStock}`}
                        />
                      </td>
                      <td style={{ width: 18 }}></td>
                    </tr>
                  ))
                ) : (
                  renderEmptyRows(0, 3)
                )}
              </tbody>
            </table>
          </div>

          {/* Dark grey separator scroll bar track directly below top table */}
          <div className="gren-top-scroll-track">
            <button type="button" className="gren-scroll-arrow-btn" tabIndex={-1}>&#9668;</button>
            <div style={{ flex: 1 }} />
            <button type="button" className="gren-scroll-arrow-btn" tabIndex={-1}>&#9658;</button>
          </div>
        </div>

        {/* 2. Middle Section: Details of the Current G.R.E.N. & Buttons */}
        <div className="gren-section-bar">
          <span className="gren-section-heading">Details of the Current G.R.E.N.</span>
          <div className="gren-buttons-group">
            <button
              type="button"
              className="gren-btn"
              onClick={initNewReturnNote}
              disabled={loading}
            >
              New
            </button>
            <button
              type="button"
              className="gren-btn"
              onClick={handleDeletePrompt}
              disabled={!isSavedRecord || loading}
            >
              Delete
            </button>
            <button
              type="button"
              className="gren-btn"
              onClick={handleUpdate}
              disabled={!isSavedRecord || loading}
            >
              Update
            </button>
            <button
              type="button"
              className="gren-btn"
              onClick={handleValidate}
              disabled={loading}
            >
              Validate
            </button>
            <button
              type="button"
              className="gren-btn btn-save-default"
              onClick={handleSave}
              disabled={isSavedRecord || loading}
            >
              Save
            </button>
          </div>
        </div>

        {/* Middle Table: Details of the Current G.R.E.N. */}
        <div className="gren-table-container">
          <div className="gren-table-scroll-area gren-table-scroll-area-mid">
            <table className="gren-grid-table">
              <thead>
                <tr>
                  <th style={{ width: 130 }}>CODE</th>
                  <th style={{ width: 260 }}>DESCRIPTION</th>
                  <th style={{ width: 100 }} className="align-right">PRICE</th>
                  <th style={{ width: 95 }} className="align-right">QUANTITY</th>
                  <th style={{ width: 85 }} className="align-right">DISCOUNT</th>
                  <th style={{ width: 110 }} className="align-right">VALUE</th>
                  <th style={{ width: 110 }} className="align-right">QTY RETURN</th>
                  <th style={{ width: 18 }}></th>
                </tr>
              </thead>
              <tbody>
                {middleTableItems.length > 0 ? (
                  middleTableItems.map((row, idx) => (
                    <tr
                      key={row.code || idx}
                      className={selectedMidRow === idx ? 'selected' : ''}
                      onClick={() => setSelectedMidRow(idx)}
                    >
                      <td style={{ width: 130 }} title={row.code}>{row.code}</td>
                      <td style={{ width: 260 }} title={row.description}>{row.description}</td>
                      <td style={{ width: 100 }} className="align-right">{row.price.toFixed(2)}</td>
                      <td style={{ width: 95 }} className="align-right">{row.quantity}</td>
                      <td style={{ width: 85 }} className="align-right">{row.discount}%</td>
                      <td style={{ width: 110 }} className="align-right">{row.value.toFixed(2)}</td>
                      <td style={{ width: 110 }} className="align-right">{row.qtyReturn}</td>
                      <td style={{ width: 18 }}></td>
                    </tr>
                  ))
                ) : (
                  renderEmptyRows(0, 6)
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Bottom Section: Details of the G.R.N. */}
        <div className="gren-section-bar">
          <span className="gren-section-heading">Details of the G.R.N.</span>
        </div>

        {/* Bottom Table: Details of the G.R.N. */}
        <div className="gren-table-container">
          <div className="gren-table-scroll-area gren-table-scroll-area-bot">
            <table className="gren-grid-table">
              <thead>
                <tr>
                  <th style={{ width: 130 }}>CODE</th>
                  <th style={{ width: 260 }}>DESCRIPTION</th>
                  <th style={{ width: 100 }} className="align-right">PRICE</th>
                  <th style={{ width: 95 }} className="align-right">QUANTITY</th>
                  <th style={{ width: 85 }} className="align-right">DISCOUNT</th>
                  <th style={{ width: 110 }} className="align-right">VALUE</th>
                  <th style={{ width: 110 }} className="align-right">QTY RETURN</th>
                  <th style={{ width: 18 }}></th>
                </tr>
              </thead>
              <tbody>
                {bottomTableItems.length > 0 ? (
                  bottomTableItems.map((row, idx) => (
                    <tr
                      key={row.code || idx}
                      className={selectedBotRow === idx ? 'selected' : ''}
                      onClick={() => setSelectedBotRow(idx)}
                    >
                      <td style={{ width: 130 }} title={row.code}>{row.code}</td>
                      <td style={{ width: 260 }} title={row.description}>{row.description}</td>
                      <td style={{ width: 100 }} className="align-right">{row.price.toFixed(2)}</td>
                      <td style={{ width: 95 }} className="align-right">{row.quantity}</td>
                      <td style={{ width: 85 }} className="align-right">{row.discount}%</td>
                      <td style={{ width: 110 }} className="align-right">{row.value.toFixed(2)}</td>
                      <td style={{ width: 110 }} className="align-right">{row.qtyReturn}</td>
                      <td style={{ width: 18 }}></td>
                    </tr>
                  ))
                ) : (
                  renderEmptyRows(0, 6)
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Floating Notification */}
      {notification && (
        <div className={`gren-notification ${notification.type}`}>
          {notification.type === 'success' && <span>&#10004;</span>}
          {notification.type === 'error' && <span>&#9888;</span>}
          {notification.type === 'info' && <span>&#8505;</span>}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Classic Windows Modal Dialog */}
      {modalState.isOpen && (
        <div className="gren-modal-overlay">
          <div className="gren-modal-window">
            <div className="gren-modal-titlebar">
              <span>{modalState.title}</span>
              <button
                type="button"
                className="gren-modal-close-btn"
                onClick={() => setModalState({ isOpen: false, title: '', message: '', confirmAction: null, isAlertOnly: false })}
              >
                &#x2715;
              </button>
            </div>
            <div className="gren-modal-content">
              <pre style={{ margin: 0, fontFamily: 'inherit', whiteSpace: 'pre-wrap', fontSize: 11 }}>
                {modalState.message}
              </pre>
            </div>
            <div className="gren-modal-actions">
              {modalState.isAlertOnly ? (
                <button
                  type="button"
                  className="gren-btn btn-save-default"
                  onClick={() => setModalState({ isOpen: false, title: '', message: '', confirmAction: null, isAlertOnly: false })}
                >
                  OK
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="gren-btn"
                    onClick={() => setModalState({ isOpen: false, title: '', message: '', confirmAction: null, isAlertOnly: false })}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="gren-btn btn-save-default"
                    onClick={modalState.confirmAction}
                  >
                    OK
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GoodReturnNote;
