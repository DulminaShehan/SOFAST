import mongoose from 'mongoose';
import Damage from '../models/Damage.js';
import Item from '../models/Item.js';
import Grn from '../models/Grn.js';
import Supplier from '../models/Supplier.js';
import DamageStockMovement from '../models/DamageStockMovement.js';

/**
 * Get next sequential damage record number (e.g. DMGN-0003)
 * Inspects docnumbers docType 'DMGN' and existing 'damages' collection.
 */
export const getNextDamageNumber = async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    const docNum = await db.collection('docnumbers').findOne({ docType: 'DMGN' });
    const latestDamage = await Damage.findOne({ no: { $exists: true, $ne: null } })
      .sort({ no: -1, createdAt: -1 })
      .lean();

    let docCurrent = docNum && Number(docNum.currentNumber) ? Number(docNum.currentNumber) : 0;
    let damageCurrent = latestDamage && Number(latestDamage.no) ? Number(latestDamage.no) : 0;

    // Scan all damages for numeric suffixes matching DMGN-XXXX
    const allDamages = await Damage.find({}, { damageNumber: 1, damageNo: 1 }).lean();
    let maxSuffix = 0;
    allDamages.forEach((d) => {
      const numStr = String(d.damageNumber || d.damageNo || '');
      const match = numStr.match(/^DMGN-(\d+)$/i);
      if (match && match[1]) {
        const val = parseInt(match[1], 10);
        if (val < 1000000 && val > maxSuffix) maxSuffix = val;
      }
    });

    const currentMax = Math.max(docCurrent, damageCurrent, maxSuffix);
    const nextNo = currentMax + 1;
    const damageNumber = `DMGN-${String(nextNo).padStart(4, '0')}`;

    return res.status(200).json({
      success: true,
      data: {
        no: nextNo,
        damageNumber,
        damageNo: damageNumber,
        prefix: 'DMGN',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Look up purchase cost and details for an item.
 * Strictly adheres to requirement:
 * - Automatically populate actual purchase cost using existing inventory/GRN data.
 * - Prefer the latest valid GRN supplier purchase cost for that item.
 * - Do NOT use the selling price as the purchase cost.
 * - If no valid purchase cost exists, return null / empty instead of inventing one.
 */
export const getItemPurchaseCost = async (req, res, next) => {
  try {
    const { itemCode } = req.params;
    if (!itemCode || !itemCode.trim()) {
      return res.status(400).json({ success: false, message: 'Item code is required' });
    }

    const cleanCode = itemCode.trim();
    const codeRegex = new RegExp(`^${cleanCode}$`, 'i');

    // 1. Look up item in Item Master (by code or barcode)
    const item = await Item.findOne({
      $or: [
        { code: codeRegex },
        { barcode: codeRegex },
        { barCode: codeRegex },
      ],
    }).lean();
    if (!item) {
      return res.status(404).json({
        success: false,
        message: `Item '${cleanCode}' not found in Item Master`,
      });
    }

    const availableStock = Math.max(0, Number(item.quantity !== undefined ? item.quantity : item.stockInHand || 0));

    // 2. Query GRNs for most recent purchase of this item
    const latestGrn = await Grn.findOne({
      $or: [
        { 'lineItems.code': codeRegex },
        { 'lineItems.itemCode': codeRegex },
      ],
      status: { $ne: 'cancelled' },
    })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    let purchaseCost = null;
    let costSource = 'NONE';
    let grnNumber = '';
    let grnSupplierCode = '';

    if (latestGrn && Array.isArray(latestGrn.lineItems)) {
      const matchedLine = latestGrn.lineItems.find(
        (li) =>
          String(li.code || li.itemCode || '').trim().toLowerCase() === cleanCode.toLowerCase()
      );
      if (matchedLine) {
        const unitPrice = Number(matchedLine.unitPrice !== undefined ? matchedLine.unitPrice : matchedLine.rate);
        if (!isNaN(unitPrice) && unitPrice > 0) {
          purchaseCost = unitPrice;
          costSource = 'LATEST_GRN';
          grnNumber = latestGrn.grnNumber || String(latestGrn.no || '');
          grnSupplierCode = latestGrn.supplierCode || '';
        }
      }
    }

    // 3. Fallback to Item.lastGrnPrice if valid positive number
    if (purchaseCost === null && item.lastGrnPrice !== undefined) {
      const lgp = Number(item.lastGrnPrice);
      if (!isNaN(lgp) && lgp > 0) {
        purchaseCost = lgp;
        costSource = 'LAST_GRN_PRICE';
      }
    }

    // 4. Fallback to Item.averageCost if valid positive number
    if (purchaseCost === null && item.averageCost !== undefined) {
      const avg = Number(item.averageCost);
      if (!isNaN(avg) && avg > 0) {
        purchaseCost = avg;
        costSource = 'AVERAGE_COST';
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        itemCode: item.code,
        description: item.description || '',
        purchaseCost,
        costSource,
        availableStock,
        damagedStock: Number(item.damagedStock || 0),
        grnNumber,
        grnSupplierCode,
        supplierCode: item.suppCode || grnSupplierCode || '',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all damage records with optional search, pagination, and dropdown selection list
 */
export const getDamages = async (req, res, next) => {
  try {
    const { search = '', page = 1, limit = 100 } = req.query;

    const query = {};
    if (search && search.trim()) {
      const q = search.trim();
      const regex = new RegExp(q, 'i');
      query.$or = [
        { damageNumber: regex },
        { damageNo: regex },
        { supplierCode: regex },
        { supplierName: regex },
        { note: regex },
        { remarks: regex },
        { 'lineItems.itemCode': regex },
        { 'lineItems.description': regex },
        { 'lineItems.reference': regex },
      ];
    }

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(250, Math.max(1, parseInt(limit, 10) || 100));
    const skip = (parsedPage - 1) * parsedLimit;

    const [damages, total] = await Promise.all([
      Damage.find(query)
        .sort({ createdAt: -1, date: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      Damage.countDocuments(query),
    ]);

    // Normalize line items
    const normalized = damages.map((d) => {
      const rawLines = d.lineItems && d.lineItems.length > 0 ? d.lineItems : (d.items || d.notes || []);
      const lines = rawLines.map((li) => ({
        itemCode: li.itemCode || li.code || '',
        description: li.description || '',
        reference: li.reference || '',
        quantity: Number(li.quantity !== undefined ? li.quantity : li.qty || 0),
        qty: Number(li.quantity !== undefined ? li.quantity : li.qty || 0),
        cost: Number(li.cost !== undefined ? li.cost : li.unitCost || 0),
      }));

      return {
        ...d,
        damageNumber: d.damageNumber || d.damageNo || '',
        damageNo: d.damageNo || d.damageNumber || '',
        lineItems: lines,
        itemsCount: lines.length,
      };
    });

    return res.status(200).json({
      success: true,
      data: normalized,
      total,
      page: parsedPage,
      totalPages: Math.ceil(total / parsedLimit),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single damage record by damage number or ID
 */
export const getDamageByNumber = async (req, res, next) => {
  try {
    const { damageNumber } = req.params;
    if (!damageNumber || !damageNumber.trim()) {
      return res.status(400).json({ success: false, message: 'Damage number is required' });
    }

    const cleanNum = damageNumber.trim();
    const query = {
      $or: [
        { damageNumber: cleanNum },
        { damageNumber: new RegExp(`^${cleanNum}$`, 'i') },
        { damageNo: cleanNum },
        { damageNo: new RegExp(`^${cleanNum}$`, 'i') },
      ],
    };

    if (mongoose.Types.ObjectId.isValid(cleanNum)) {
      query.$or.push({ _id: cleanNum });
    }

    let damage = await Damage.findOne(query).lean();

    // Fallback: check legacy damageclaimreturnnotes collection if not found in damages
    if (!damage) {
      const db = mongoose.connection.db;
      const legacyNote = await db.collection('damageclaimreturnnotes').findOne({
        $or: [
          { damageNo: cleanNum },
          { damageNo: new RegExp(`^${cleanNum}$`, 'i') },
        ],
      });

      if (legacyNote) {
        const rawLines = legacyNote.notes || [];
        const lines = rawLines.map((li) => ({
          itemCode: li.itemCode || li.code || '',
          description: li.description || '',
          reference: li.reference || '',
          quantity: Number(li.qty || li.quantity || 1),
          qty: Number(li.qty || li.quantity || 1),
          cost: Number(li.cost || 0),
        }));

        let suppName = '';
        if (legacyNote.supplierCode) {
          const supp = await Supplier.findOne({ code: legacyNote.supplierCode }).lean();
          if (supp) suppName = supp.name || '';
        }

        damage = {
          _id: legacyNote._id,
          damageNumber: legacyNote.damageNo,
          damageNo: legacyNote.damageNo,
          date: legacyNote.date || legacyNote.createdAt,
          supplierCode: legacyNote.supplierCode || '',
          supplierName: suppName,
          lineItems: lines,
          items: lines,
          note: '',
          remarks: '',
          status: 'active',
          stockDeducted: true,
        };
      }
    }

    if (!damage) {
      return res.status(404).json({
        success: false,
        message: `Damage record '${cleanNum}' not found`,
      });
    }

    // Normalize line items
    const rawLines = damage.lineItems && damage.lineItems.length > 0 ? damage.lineItems : (damage.items || damage.notes || []);
    const normalizedLines = rawLines.map((li) => ({
      itemCode: li.itemCode || li.code || '',
      description: li.description || '',
      reference: li.reference || '',
      quantity: Number(li.quantity !== undefined ? li.quantity : li.qty || 0),
      qty: Number(li.quantity !== undefined ? li.quantity : li.qty || 0),
      cost: Number(li.cost !== undefined ? li.cost : li.unitCost || 0),
    }));

    return res.status(200).json({
      success: true,
      data: {
        ...damage,
        damageNumber: damage.damageNumber || damage.damageNo || cleanNum,
        damageNo: damage.damageNo || damage.damageNumber || cleanNum,
        lineItems: normalizedLines,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Save new Data Entry of Damage record
 * - Validates item codes exist in Item Master
 * - Validates quantities > 0 and available stock exists
 * - Atomically deducts sellable stock and increments damagedStock
 * - Logs audit trail in DamageStockMovement
 * - Saves record in 'damages' collection
 * - Updates sequence in 'docnumbers'
 */
export const createDamage = async (req, res, next) => {
  try {
    const {
      damageNumber,
      damageNo,
      date,
      supplierCode,
      supplierName,
      lineItems = [],
      items = [],
      note = '',
      remarks = '',
    } = req.body;

    const effectiveDamageNumber = (damageNumber || damageNo || '').trim();
    if (!effectiveDamageNumber) {
      return res.status(400).json({ success: false, message: 'Damage number is required' });
    }

    // 1. Check if damageNumber already exists
    const existing = await Damage.findOne({
      $or: [
        { damageNumber: effectiveDamageNumber },
        { damageNo: effectiveDamageNumber },
      ],
    }).lean();

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Damage record '${effectiveDamageNumber}' already exists. Use 'Update' to modify it or click 'New' for a new record.`,
      });
    }

    // 2. Validate line items
    const rawItems = lineItems.length > 0 ? lineItems : items;
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one damage item row must be entered',
      });
    }

    const validatedLines = [];
    let calculatedTotalValue = 0;

    for (let i = 0; i < rawItems.length; i++) {
      const row = rawItems[i];
      const itmCode = String(row.itemCode || row.code || '').trim();
      if (!itmCode) {
        return res.status(400).json({
          success: false,
          message: `Row #${i + 1}: Item code is required`,
        });
      }

      const qty = Number(row.quantity !== undefined ? row.quantity : row.qty);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({
          success: false,
          message: `Row #${i + 1} (${itmCode}): Quantity must be greater than zero`,
        });
      }

      // Check item in Item Master
      const itemRecord = await Item.findOne({ code: new RegExp(`^${itmCode}$`, 'i') });
      if (!itemRecord) {
        return res.status(404).json({
          success: false,
          message: `Row #${i + 1}: Item '${itmCode}' does not exist in Item Master`,
        });
      }

      // Validate stock availability
      const available = Math.max(0, Number(itemRecord.quantity !== undefined ? itemRecord.quantity : itemRecord.stockInHand || 0));
      if (available < qty) {
        return res.status(400).json({
          success: false,
          message: `Row #${i + 1} (${itmCode}): Insufficient stock. Available: ${available}, Requested: ${qty}`,
        });
      }

      const cost = Number(row.cost !== undefined ? row.cost : row.unitCost || 0);
      const rowTotal = Math.round(cost * qty * 100) / 100;
      calculatedTotalValue += rowTotal;

      validatedLines.push({
        itemCode: itemRecord.code,
        code: itemRecord.code,
        description: row.description || itemRecord.description || '',
        reference: String(row.reference || '').trim(),
        quantity: qty,
        qty,
        cost,
        unitCost: cost,
        totalCost: rowTotal,
        itemDocId: itemRecord._id,
      });
    }

    // 3. Atomically update inventory and log stock movements
    const db = mongoose.connection.db;

    for (const line of validatedLines) {
      // Deduct from sellable stock, increment damagedStock
      await Item.updateOne(
        { _id: line.itemDocId },
        {
          $inc: {
            quantity: -line.quantity,
            stockInHand: -line.quantity,
            damagedStock: line.quantity,
          },
        }
      );

      // Log DamageStockMovement audit entry
      try {
        const dsmDocNum = await db.collection('docnumbers').findOne({ docType: 'DSM' });
        const latestDsm = await DamageStockMovement.findOne({ no: { $exists: true, $ne: null } })
          .sort({ no: -1, createdAt: -1 })
          .lean();

        const dsmDocCurrent = dsmDocNum && Number(dsmDocNum.currentNumber) ? Number(dsmDocNum.currentNumber) : 0;
        const dsmLatestNo = latestDsm && Number(latestDsm.no) ? Number(latestDsm.no) : 0;
        const nextDsmNo = Math.max(dsmDocCurrent, dsmLatestNo) + 1;
        const dsmNumber = `DSM-${String(nextDsmNo).padStart(4, '0')}`;

        const damageMovement = new DamageStockMovement({
          movementNumber: dsmNumber,
          no: nextDsmNo,
          date: date ? new Date(date) : new Date(),
          itemCode: line.itemCode,
          description: line.description,
          quantity: line.quantity,
          movementType: 'IN_SHOP_DAMAGE',
          origin: supplierCode ? 'SUPPLIER DAMAGE' : 'SHOP DAMAGE',
          referenceNumber: effectiveDamageNumber,
          supplierCode: supplierCode || '',
          supplierName: supplierName || '',
          unitCost: line.cost,
          totalValue: line.totalCost,
          damageReason: note || line.reference || 'Data Entry of Damage',
          notes: note || line.reference || '',
          recordedBy: req.user?.username || req.user?.userCode || 'Admin',
        });

        await damageMovement.save();

        await db.collection('docnumbers').updateOne(
          { docType: 'DSM' },
          { $set: { currentNumber: nextDsmNo, prefix: 'DSM', padding: 4 } },
          { upsert: true }
        );
      } catch (dsmErr) {
        console.warn('Could not save DSM entry:', dsmErr);
      }
    }

    // 4. Calculate sequential numerical 'no'
    const numMatch = effectiveDamageNumber.match(/^DMGN-(\d+)$/i);
    const numericNo = numMatch && numMatch[1] ? parseInt(numMatch[1], 10) : undefined;

    // 5. Save Damage record
    const damageRecord = new Damage({
      no: numericNo,
      damageNumber: effectiveDamageNumber,
      damageNo: effectiveDamageNumber,
      date: date ? new Date(date) : new Date(),
      supplierCode: (supplierCode || '').trim(),
      supplierName: (supplierName || '').trim(),
      lineItems: validatedLines,
      items: validatedLines,
      notes: validatedLines,
      note: (note || '').trim(),
      remarks: (remarks || note || '').trim(),
      totalValue: Math.round(calculatedTotalValue * 100) / 100,
      stockDeducted: true,
      status: 'active',
      recordedBy: req.user?.username || req.user?.userCode || 'Admin',
    });

    await damageRecord.save();

    // 6. Update sequence in docnumbers
    if (numericNo && numericNo < 1000000) {
      await db.collection('docnumbers').updateOne(
        { docType: 'DMGN' },
        { $set: { currentNumber: numericNo, prefix: 'DMGN', padding: 4 } },
        { upsert: true }
      );
    }

    return res.status(201).json({
      success: true,
      message: `Damage record '${effectiveDamageNumber}' saved successfully`,
      data: damageRecord,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update existing Data Entry of Damage record
 * - Calculates delta between old and new item quantities to adjust stock accurately
 * - Ensures stock is never deducted twice
 * - Updates record in 'damages' collection
 */
export const updateDamage = async (req, res, next) => {
  try {
    const { damageNumber } = req.params;
    const {
      date,
      supplierCode,
      supplierName,
      lineItems = [],
      items = [],
      note,
      remarks,
    } = req.body;

    const cleanNum = damageNumber.trim();
    const existing = await Damage.findOne({
      $or: [
        { damageNumber: cleanNum },
        { damageNo: cleanNum },
      ],
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Damage record '${cleanNum}' not found`,
      });
    }

    const rawNewItems = lineItems.length > 0 ? lineItems : items;
    if (!Array.isArray(rawNewItems) || rawNewItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one damage item row must be entered',
      });
    }

    // Map old items by itemCode
    const oldItemsMap = new Map();
    (existing.lineItems || existing.items || []).forEach((item) => {
      const code = String(item.itemCode || item.code || '').trim().toUpperCase();
      const qty = Number(item.quantity !== undefined ? item.quantity : item.qty || 0);
      oldItemsMap.set(code, (oldItemsMap.get(code) || 0) + qty);
    });

    // Map new items by itemCode and validate
    const newItemsMap = new Map();
    const validatedNewLines = [];
    let calculatedTotalValue = 0;

    for (let i = 0; i < rawNewItems.length; i++) {
      const row = rawNewItems[i];
      const itmCode = String(row.itemCode || row.code || '').trim();
      if (!itmCode) {
        return res.status(400).json({
          success: false,
          message: `Row #${i + 1}: Item code is required`,
        });
      }

      const qty = Number(row.quantity !== undefined ? row.quantity : row.qty);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({
          success: false,
          message: `Row #${i + 1} (${itmCode}): Quantity must be greater than zero`,
        });
      }

      const itemRecord = await Item.findOne({ code: new RegExp(`^${itmCode}$`, 'i') });
      if (!itemRecord) {
        return res.status(404).json({
          success: false,
          message: `Row #${i + 1}: Item '${itmCode}' does not exist in Item Master`,
        });
      }

      const cost = Number(row.cost !== undefined ? row.cost : row.unitCost || 0);
      const rowTotal = Math.round(cost * qty * 100) / 100;
      calculatedTotalValue += rowTotal;

      const codeUpper = itemRecord.code.toUpperCase();
      newItemsMap.set(codeUpper, (newItemsMap.get(codeUpper) || 0) + qty);

      validatedNewLines.push({
        itemCode: itemRecord.code,
        code: itemRecord.code,
        description: row.description || itemRecord.description || '',
        reference: String(row.reference || '').trim(),
        quantity: qty,
        qty,
        cost,
        unitCost: cost,
        totalCost: rowTotal,
        itemDocId: itemRecord._id,
      });
    }

    // Stock Safety: calculate net differences per item
    const allCodes = new Set([...oldItemsMap.keys(), ...newItemsMap.keys()]);
    for (const codeUpper of allCodes) {
      const oldQty = oldItemsMap.get(codeUpper) || 0;
      const newQty = newItemsMap.get(codeUpper) || 0;
      const delta = newQty - oldQty; // positive: need more stock deducted; negative: restore stock

      if (delta !== 0) {
        const itemRecord = await Item.findOne({ code: new RegExp(`^${codeUpper}$`, 'i') });
        if (itemRecord) {
          if (delta > 0) {
            const available = Math.max(0, Number(itemRecord.quantity !== undefined ? itemRecord.quantity : itemRecord.stockInHand || 0));
            if (available < delta) {
              return res.status(400).json({
                success: false,
                message: `Insufficient stock for '${itemRecord.code}'. Required additional: ${delta}, Available: ${available}`,
              });
            }
          }

          // Apply delta: if delta > 0, deducts sellable and increases damagedStock; if delta < 0, restores sellable
          await Item.updateOne(
            { _id: itemRecord._id },
            {
              $inc: {
                quantity: -delta,
                stockInHand: -delta,
                damagedStock: delta,
              },
            }
          );
        }
      }
    }

    // Update fields
    if (date) existing.date = new Date(date);
    if (supplierCode !== undefined) existing.supplierCode = (supplierCode || '').trim();
    if (supplierName !== undefined) existing.supplierName = (supplierName || '').trim();
    if (note !== undefined) existing.note = (note || '').trim();
    if (remarks !== undefined) existing.remarks = (remarks || '').trim();

    existing.lineItems = validatedNewLines;
    existing.items = validatedNewLines;
    existing.notes = validatedNewLines;
    existing.totalValue = Math.round(calculatedTotalValue * 100) / 100;

    await existing.save();

    return res.status(200).json({
      success: true,
      message: `Damage record '${existing.damageNumber || existing.damageNo}' updated successfully`,
      data: existing,
    });
  } catch (error) {
    next(error);
  }
};
