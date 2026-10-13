import mongoose from 'mongoose';
import DamageStockMovement from '../models/DamageStockMovement.js';
import Item from '../models/Item.js';
import SupplierDamageClaim from '../models/SupplierDamageClaim.js';

/**
 * Get comprehensive summary of all damaged/quarantine stock and inventory items
 */
export const getDamageStockSummary = async (req, res, next) => {
  try {
    const { search, category, location } = req.query;

    const query = { damagedStock: { $gt: 0 } };

    if (search && search.trim()) {
      const q = search.trim();
      const regex = new RegExp(q, 'i');
      query.$or = [{ code: regex }, { description: regex }, { suppCode: regex }];
    }

    if (category && category.trim()) {
      query.category = category.trim();
    }

    if (location && location.trim()) {
      query.location = location.trim();
    }

    const [damagedItems, allDamagedItems, activeClaimsCount, recentMovements] = await Promise.all([
      Item.find(query).sort({ damagedStock: -1 }).lean(),
      Item.find({ damagedStock: { $gt: 0 } }, 'code description damagedStock averageCost sellingPrice').lean(),
      SupplierDamageClaim.countDocuments({
        claimStatus: { $in: ['PENDING', 'SENT_TO_SUPPLIER'] },
      }),
      DamageStockMovement.find({}).sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    let totalDamagedUnits = 0;
    let totalDamagedValue = 0;

    allDamagedItems.forEach((itm) => {
      const dQty = Number(itm.damagedStock) || 0;
      const unitVal = Number(itm.averageCost) || Number(itm.sellingPrice) || 0;
      totalDamagedUnits += dQty;
      totalDamagedValue += Math.round(dQty * unitVal * 100) / 100;
    });

    const enrichedItems = damagedItems.map((itm) => {
      const dQty = Number(itm.damagedStock) || 0;
      const sQty = Number(itm.quantity || itm.stockInHand || 0);
      const unitCost = Number(itm.averageCost) || Number(itm.sellingPrice) || 0;
      const totalVal = Math.round(dQty * unitCost * 100) / 100;

      return {
        _id: itm._id,
        itemCode: itm.code,
        description: itm.description || '',
        category: itm.category || '',
        location: itm.location || 'Main Store',
        suppCode: itm.suppCode || '',
        damagedStock: dQty,
        sellableStock: sQty,
        unitCost,
        totalDamagedValue: totalVal,
        sellingPrice: Number(itm.sellingPrice) || 0,
        lastGrn: itm.lastGrn || '',
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        metrics: {
          totalDamagedUnits,
          totalDamagedValue: Math.round(totalDamagedValue * 100) / 100,
          totalQuarantinedItemsCount: allDamagedItems.length,
          activeClaimsCount,
        },
        items: enrichedItems,
        recentMovements,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get audit trail of all damage stock movements with pagination & filters
 */
export const getDamageStockMovements = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, itemCode, origin, movementType, search } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(250, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (parsedPage - 1) * parsedLimit;

    const query = {};

    if (itemCode && itemCode.trim()) {
      query.itemCode = new RegExp(`^${itemCode.trim()}$`, 'i');
    }

    if (origin && origin.trim() && origin !== 'ALL') {
      query.origin = origin.trim();
    }

    if (movementType && movementType.trim() && movementType !== 'ALL') {
      query.movementType = movementType.trim();
    }

    if (search && search.trim()) {
      const q = search.trim();
      const regex = new RegExp(q, 'i');
      query.$or = [
        { movementNumber: regex },
        { referenceNumber: regex },
        { invoiceNumber: regex },
        { itemCode: regex },
        { description: regex },
        { supplierName: regex },
        { damageReason: regex },
      ];
    }

    const [movements, totalCount] = await Promise.all([
      DamageStockMovement.find(query).sort({ createdAt: -1 }).skip(skip).limit(parsedLimit).lean(),
      DamageStockMovement.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: movements,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total: totalCount,
        pages: Math.ceil(totalCount / parsedLimit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Record internal shop / warehouse damage:
 * Moves goods from sellable stock to quarantine damagedStock with origin 'SHOP DAMAGE'.
 */
export const recordShopDamage = async (req, res, next) => {
  try {
    const {
      itemCode,
      quantity,
      damageReason,
      reason,
      origin = 'SHOP DAMAGE',
      notes,
      location = 'Main Store',
    } = req.body;

    if (!itemCode || !itemCode.trim()) {
      return res.status(400).json({ success: false, message: 'Item code is required' });
    }

    const qtyNum = Number(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      return res.status(400).json({ success: false, message: 'Damage quantity must be greater than zero' });
    }

    const effectiveReason = (damageReason || reason || '').trim();
    if (!effectiveReason) {
      return res.status(400).json({ success: false, message: 'Damage reason is required' });
    }

    const cleanCode = itemCode.trim();
    const item = await Item.findOne({ code: new RegExp(`^${cleanCode}$`, 'i') });
    if (!item) {
      return res.status(404).json({ success: false, message: `Item '${cleanCode}' not found in inventory` });
    }

    const currentSellable = Number(item.quantity || item.stockInHand || 0);
    if (currentSellable < qtyNum) {
      return res.status(400).json({
        success: false,
        message: `Insufficient sellable stock for item '${cleanCode}'. Available sellable: ${currentSellable}, requested damage: ${qtyNum}`,
      });
    }

    // Atomic stock adjustment: deduct sellable, increment damaged stock
    await Item.updateOne(
      { _id: item._id },
      {
        $inc: {
          quantity: -qtyNum,
          stockInHand: -qtyNum,
          damagedStock: qtyNum,
        },
      }
    );

    // Sequence generation for movement
    const db = mongoose.connection.db;
    const docNum = await db.collection('docnumbers').findOne({ docType: 'DSM' });
    const latestMov = await DamageStockMovement.findOne({ no: { $exists: true, $ne: null } })
      .sort({ no: -1, createdAt: -1 })
      .lean();

    const docCurrent = docNum && Number(docNum.currentNumber) ? Number(docNum.currentNumber) : 0;
    const movCurrent = latestMov && Number(latestMov.no) ? Number(latestMov.no) : 0;
    const nextNo = Math.max(docCurrent, movCurrent) + 1;
    const movementNumber = `DSM-${String(nextNo).padStart(4, '0')}`;

    const unitCost = Number(item.averageCost) || Number(item.sellingPrice) || 0;
    const totalVal = Math.round(qtyNum * unitCost * 100) / 100;

    const movement = new DamageStockMovement({
      movementNumber,
      no: nextNo,
      date: new Date(),
      itemCode: item.code,
      description: item.description || '',
      category: item.category || '',
      quantity: qtyNum,
      movementType: 'IN_SHOP_DAMAGE',
      origin: origin === 'SUPPLIER DAMAGE' ? 'SUPPLIER DAMAGE' : 'SHOP DAMAGE',
      referenceNumber: `SHOP-ADJ-${String(nextNo).padStart(4, '0')}`,
      supplierCode: item.suppCode || '',
      supplierName: '',
      unitCost,
      totalValue: totalVal,
      damageReason: effectiveReason,
      notes: notes ? notes.trim() : `Recorded shop damage. Location: ${location}`,
      recordedBy: req.user?.username || req.user?.userCode || 'Admin',
    });

    await movement.save();

    await db.collection('docnumbers').updateOne(
      { docType: 'DSM' },
      { $set: { currentNumber: nextNo, prefix: 'DSM', padding: 4 } },
      { upsert: true }
    );

    const updatedItem = await Item.findById(item._id).lean();

    return res.status(201).json({
      success: true,
      message: `Successfully transferred ${qtyNum} unit(s) of '${cleanCode}' into Damaged Quarantine Stock.`,
      data: {
        movement,
        item: {
          code: updatedItem.code,
          sellableStock: updatedItem.quantity || updatedItem.stockInHand || 0,
          damagedStock: updatedItem.damagedStock || 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Write-off / Scrap unclaimable damaged stock:
 * Decrements damagedStock and logs audit record.
 */
export const writeOffDamagedStock = async (req, res, next) => {
  try {
    const { itemCode, quantity, reason, notes } = req.body;

    if (!itemCode || !itemCode.trim()) {
      return res.status(400).json({ success: false, message: 'Item code is required' });
    }

    const qtyNum = Number(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      return res.status(400).json({ success: false, message: 'Write-off quantity must be greater than zero' });
    }

    const cleanCode = itemCode.trim();
    const item = await Item.findOne({ code: new RegExp(`^${cleanCode}$`, 'i') });
    if (!item) {
      return res.status(404).json({ success: false, message: `Item '${cleanCode}' not found` });
    }

    const curDamaged = Number(item.damagedStock || 0);
    if (curDamaged < qtyNum) {
      return res.status(400).json({
        success: false,
        message: `Cannot write off ${qtyNum} units. Current damaged stock in quarantine is ${curDamaged}.`,
      });
    }

    await Item.updateOne(
      { _id: item._id },
      {
        $inc: { damagedStock: -qtyNum },
      }
    );

    const db = mongoose.connection.db;
    const docNum = await db.collection('docnumbers').findOne({ docType: 'DSM' });
    const latestMov = await DamageStockMovement.findOne({ no: { $exists: true, $ne: null } })
      .sort({ no: -1, createdAt: -1 })
      .lean();

    const docCurrent = docNum && Number(docNum.currentNumber) ? Number(docNum.currentNumber) : 0;
    const movCurrent = latestMov && Number(latestMov.no) ? Number(latestMov.no) : 0;
    const nextNo = Math.max(docCurrent, movCurrent) + 1;
    const movementNumber = `DSM-${String(nextNo).padStart(4, '0')}`;

    const unitCost = Number(item.averageCost) || Number(item.sellingPrice) || 0;
    const totalVal = Math.round(qtyNum * unitCost * 100) / 100;

    const movement = new DamageStockMovement({
      movementNumber,
      no: nextNo,
      date: new Date(),
      itemCode: item.code,
      description: item.description || '',
      category: item.category || '',
      quantity: qtyNum,
      movementType: 'OUT_SCRAP_WRITEOFF',
      origin: 'STOCK ADJUSTMENT',
      referenceNumber: `SCRAP-${String(nextNo).padStart(4, '0')}`,
      unitCost,
      totalValue: totalVal,
      damageReason: reason ? reason.trim() : 'Scrapped / Disposed damaged goods',
      notes: notes || 'Authorized write-off from quarantine stock',
      recordedBy: req.user?.username || req.user?.userCode || 'Admin',
    });

    await movement.save();

    await db.collection('docnumbers').updateOne(
      { docType: 'DSM' },
      { $set: { currentNumber: nextNo, prefix: 'DSM', padding: 4 } },
      { upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: `Successfully written off ${qtyNum} damaged unit(s) of '${cleanCode}'.`,
      data: movement,
    });
  } catch (error) {
    next(error);
  }
};
