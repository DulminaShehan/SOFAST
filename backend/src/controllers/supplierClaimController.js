import mongoose from 'mongoose';
import SupplierDamageClaim from '../models/SupplierDamageClaim.js';
import CustomerDamageReturn from '../models/CustomerDamageReturn.js';
import DamageStockMovement from '../models/DamageStockMovement.js';
import Item from '../models/Item.js';
import Supplier from '../models/Supplier.js';

/**
 * Get next sequential claim number (e.g. SDC-0001)
 */
export const getNextClaimNumber = async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    const docNum = await db.collection('docnumbers').findOne({ docType: 'SDC' });
    const latestClaim = await SupplierDamageClaim.findOne({ no: { $exists: true, $ne: null } })
      .sort({ no: -1, createdAt: -1 })
      .lean();

    const docCurrent = docNum && Number(docNum.currentNumber) ? Number(docNum.currentNumber) : 0;
    const claimCurrent = latestClaim && Number(latestClaim.no) ? Number(latestClaim.no) : 0;
    const currentMax = Math.max(docCurrent, claimCurrent);
    const nextNo = currentMax + 1;
    const claimNumber = `SDC-${String(nextNo).padStart(4, '0')}`;

    return res.status(200).json({
      success: true,
      data: {
        no: nextNo,
        claimNumber,
        prefix: 'SDC',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all supplier damage claims with filters and summary metrics
 */
export const getSupplierDamageClaims = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 100,
      search = '',
      status = '',
      supplierCode = '',
    } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(250, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (parsedPage - 1) * parsedLimit;

    const query = {};

    if (search && search.trim()) {
      const q = search.trim();
      const regex = new RegExp(q, 'i');
      query.$or = [
        { claimNumber: regex },
        { customerReturnNumber: regex },
        { supplierName: regex },
        { supplierCode: regex },
        { itemCode: regex },
        { description: regex },
        { grnNumber: regex },
        { supplierInvoiceNo: regex },
      ];
    }

    if (status && status.trim() && status !== 'ALL') {
      query.claimStatus = status.trim();
    }

    if (supplierCode && supplierCode.trim()) {
      query.supplierCode = supplierCode.trim();
    }

    const [claims, totalCount] = await Promise.all([
      SupplierDamageClaim.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      SupplierDamageClaim.countDocuments(query),
    ]);

    // Aggregate KPI summary metrics
    const [pendingCount, sentCount, resolvedCount, itemsWithDamaged] = await Promise.all([
      SupplierDamageClaim.countDocuments({ claimStatus: 'PENDING' }),
      SupplierDamageClaim.countDocuments({ claimStatus: 'SENT_TO_SUPPLIER' }),
      SupplierDamageClaim.countDocuments({ claimStatus: 'REPLACEMENT_RECEIVED' }),
      Item.find({ damagedStock: { $gt: 0 } }, 'code description damagedStock quantity stockInHand sellingPrice suppCode').lean(),
    ]);

    const totalDamagedQuantity = itemsWithDamaged.reduce(
      (sum, itm) => sum + (Number(itm.damagedStock) || 0),
      0
    );

    return res.status(200).json({
      success: true,
      data: claims,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total: totalCount,
        pages: Math.ceil(totalCount / parsedLimit),
      },
      metrics: {
        totalClaims: totalCount,
        pendingClaims: pendingCount,
        sentToSupplier: sentCount,
        replacementsReceived: resolvedCount,
        totalDamagedUnitsInQuarantine: totalDamagedQuantity,
        itemsInQuarantineCount: itemsWithDamaged.length,
      },
      quarantineItems: itemsWithDamaged,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new Supplier Damage Claim manually or from quarantine stock
 */
export const createSupplierDamageClaim = async (req, res, next) => {
  try {
    const {
      supplierCode,
      supplierName,
      supplierTelephone,
      supplierInvoiceNo,
      grnNumber,
      itemCode,
      quantity,
      damageReason,
      notes,
      customerReturnNumber,
      unitCost,
    } = req.body;

    if (!supplierCode || !supplierCode.trim()) {
      return res.status(400).json({ success: false, message: 'Supplier is required' });
    }
    if (!itemCode || !itemCode.trim()) {
      return res.status(400).json({ success: false, message: 'Item code is required' });
    }
    const claimQty = Number(quantity);
    if (isNaN(claimQty) || claimQty <= 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be greater than zero' });
    }
    if (!damageReason || !damageReason.trim()) {
      return res.status(400).json({ success: false, message: 'Damage reason is required' });
    }

    const cleanItemCode = itemCode.trim();
    const item = await Item.findOne({ code: new RegExp(`^${cleanItemCode}$`, 'i') });

    let finalSuppName = supplierName;
    let finalSuppPhone = supplierTelephone;
    if (!finalSuppName || !finalSuppPhone) {
      const supp = await Supplier.findOne({ code: supplierCode.trim() }).lean();
      if (supp) {
        finalSuppName = finalSuppName || supp.name;
        finalSuppPhone = finalSuppPhone || supp.telephone || supp.telephone1 || '';
      }
    }

    // Generate sequence number
    const db = mongoose.connection.db;
    const docNum = await db.collection('docnumbers').findOne({ docType: 'SDC' });
    const latestClaim = await SupplierDamageClaim.findOne({ no: { $exists: true, $ne: null } })
      .sort({ no: -1, createdAt: -1 })
      .lean();
    const docCurrent = docNum && Number(docNum.currentNumber) ? Number(docNum.currentNumber) : 0;
    const latestNo = latestClaim && Number(latestClaim.no) ? Number(latestClaim.no) : 0;
    const nextNo = Math.max(docCurrent, latestNo) + 1;
    const claimNumber = `SDC-${String(nextNo).padStart(4, '0')}`;

    const cost = Number(unitCost) || (item ? Number(item.averageCost || item.lastGrnPrice || 0) : 0);
    const totalVal = Math.round(cost * claimQty * 100) / 100;

    const claim = new SupplierDamageClaim({
      claimNumber,
      no: nextNo,
      date: new Date(),
      customerReturnNumber: customerReturnNumber ? customerReturnNumber.trim() : '',
      supplierCode: supplierCode.trim(),
      supplierName: finalSuppName || supplierCode.trim(),
      supplierTelephone: finalSuppPhone || '',
      supplierInvoiceNo: supplierInvoiceNo ? supplierInvoiceNo.trim() : '',
      grnNumber: grnNumber ? grnNumber.trim() : '',
      itemCode: cleanItemCode,
      description: item ? item.description : '',
      quantity: claimQty,
      unitCost: cost,
      totalValue: totalVal,
      damageReason: damageReason.trim(),
      claimStatus: 'PENDING',
      notes: notes || '',
      createdBy: req.user?.username || req.user?.userCode || 'Admin',
    });

    await claim.save();

    await db.collection('docnumbers').updateOne(
      { docType: 'SDC' },
      { $set: { currentNumber: nextNo, prefix: 'SDC', padding: 4 } },
      { upsert: true }
    );

    return res.status(201).json({
      success: true,
      message: `Supplier Damage Claim '${claimNumber}' created successfully`,
      data: claim,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update claim status (e.g. mark as SENT_TO_SUPPLIER)
 */
export const updateClaimStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, claimStatus, sentReference, supplierReference, sentDate, notes } = req.body;

    const claim = await SupplierDamageClaim.findById(id);
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Supplier claim not found' });
    }

    const newStatus = status || claimStatus;
    if (newStatus) {
      claim.claimStatus = newStatus;
    }
    if (newStatus === 'SENT_TO_SUPPLIER') {
      claim.sentDate = sentDate ? new Date(sentDate) : new Date();
      const ref = sentReference || supplierReference;
      if (ref) claim.sentReference = String(ref).trim();
    }
    if (notes) {
      claim.notes = `${claim.notes ? `${claim.notes}\n` : ''}${notes}`.trim();
    }

    await claim.save();

    return res.status(200).json({
      success: true,
      message: `Claim '${claim.claimNumber}' status updated to '${claim.claimStatus}'`,
      data: claim,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Receive Replacement Goods from Supplier
 * CRITICAL RULE: Increase sellable stock ONLY when replacement goods are physically received and accepted.
 * Atomically increases sellable stock (quantity & stockInHand) and decreases damagedStock.
 */
export const receiveClaimReplacement = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      quantityReceived,
      replacementQuantity,
      replacementItemCode,
      deliveryNoteNo,
      acceptedBy,
      remarks,
      receivedDate,
    } = req.body;

    const claim = await SupplierDamageClaim.findById(id);
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Supplier claim not found' });
    }

    if (claim.claimStatus === 'REPLACEMENT_RECEIVED') {
      return res.status(400).json({
        success: false,
        message: `Replacement goods for claim '${claim.claimNumber}' have already been received and accepted`,
      });
    }

    const qtyRec = Number(quantityReceived || replacementQuantity);
    if (isNaN(qtyRec) || qtyRec <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Received quantity must be greater than zero',
      });
    }

    const targetItemCode = replacementItemCode ? replacementItemCode.trim() : claim.itemCode;
    const item = await Item.findOne({ code: new RegExp(`^${targetItemCode}$`, 'i') });
    if (!item) {
      return res.status(404).json({
        success: false,
        message: `Item '${targetItemCode}' not found in inventory`,
      });
    }

    // 1. ATOMIC STOCK INCREMENT:
    // Physical goods are received & accepted -> Increase sellable stock!
    // And release from damaged stock quarantine.
    await Item.updateOne(
      { _id: item._id },
      {
        $inc: {
          quantity: qtyRec,
          stockInHand: qtyRec,
          damagedStock: -qtyRec,
        },
      }
    );

    // Safeguard: ensure damagedStock never drops below 0
    await Item.updateOne(
      { _id: item._id, damagedStock: { $lt: 0 } },
      { $set: { damagedStock: 0 } }
    );

    // 2. Record Replacement Receipt
    claim.claimStatus = 'REPLACEMENT_RECEIVED';
    claim.resolutionDate = receivedDate ? new Date(receivedDate) : new Date();
    claim.replacementReceipt = {
      received: true,
      receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
      quantityReceived: qtyRec,
      replacementItemCode: item.code,
      replacementDescription: item.description,
      deliveryNoteNo: deliveryNoteNo ? deliveryNoteNo.trim() : '',
      acceptedBy: acceptedBy ? acceptedBy.trim() : (req.user?.username || 'Stores'),
      remarks: remarks || '',
      stockIncremented: true,
    };

    if (remarks) {
      claim.notes = `${claim.notes ? `${claim.notes}\n` : ''}Replacement received: ${remarks}`.trim();
    }

    await claim.save();

    // Log DamageStockMovement audit trail
    try {
      const db = mongoose.connection.db;
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
        date: new Date(),
        itemCode: item.code,
        description: item.description || '',
        category: item.category || '',
        quantity: qtyRec,
        movementType: 'OUT_REPLACED_BY_SUPPLIER',
        origin: 'SUPPLIER DAMAGE',
        referenceNumber: claim.claimNumber,
        supplierCode: claim.supplierCode || '',
        supplierName: claim.supplierName || '',
        unitCost: Number(claim.unitCost || item.averageCost || 0),
        totalValue: Math.round(qtyRec * Number(claim.unitCost || item.averageCost || 0) * 100) / 100,
        damageReason: 'Supplier replacement physically received and accepted into sellable inventory',
        notes: `Delivery Note: ${deliveryNoteNo || 'N/A'}. Accepted by: ${acceptedBy || 'Stores'}. Remarks: ${remarks || 'None'}`,
        recordedBy: acceptedBy || 'Stores',
      });
      await damageMovement.save();

      await db.collection('docnumbers').updateOne(
        { docType: 'DSM' },
        { $set: { currentNumber: nextDsmNo, prefix: 'DSM', padding: 4 } },
        { upsert: true }
      );
    } catch (dsmErr) {
      console.warn('Failed to log DSM on supplier replacement:', dsmErr);
    }

    // 3. If linked to CustomerDamageReturn, update its status
    if (claim.customerReturnNumber) {
      await CustomerDamageReturn.updateOne(
        { returnNumber: claim.customerReturnNumber },
        { $set: { status: 'COMPLETED', damageStatus: 'RESOLVED' } }
      );
    }

    return res.status(200).json({
      success: true,
      message: `Physical replacement of ${qtyRec} unit(s) for item '${item.code}' accepted. Sellable stock updated successfully.`,
      data: claim,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resolve claim without replacement (e.g. Credit Note / Refunded, or Rejected / Scrapped)
 */
export const resolveClaimWithoutReplacement = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { resolutionType, remarks } = req.body; // 'REFUNDED' | 'REJECTED'

    if (!['REFUNDED', 'REJECTED', 'CLOSED'].includes(resolutionType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid resolution type. Must be 'REFUNDED', 'REJECTED', or 'CLOSED'",
      });
    }

    const claim = await SupplierDamageClaim.findById(id);
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Supplier claim not found' });
    }

    // Release from damagedStock if written off or refunded
    const claimQty = Number(claim.quantity) || 0;
    if (claimQty > 0) {
      await Item.updateOne(
        { code: new RegExp(`^${claim.itemCode}$`, 'i') },
        { $inc: { damagedStock: -claimQty } }
      );
      await Item.updateOne(
        { code: new RegExp(`^${claim.itemCode}$`, 'i'), damagedStock: { $lt: 0 } },
        { $set: { damagedStock: 0 } }
      );
    }

    claim.claimStatus = resolutionType;
    claim.resolutionDate = new Date();
    if (remarks) {
      claim.notes = `${claim.notes ? `${claim.notes}\n` : ''}${resolutionType}: ${remarks}`.trim();
    }

    await claim.save();

    if (claim.customerReturnNumber) {
      await CustomerDamageReturn.updateOne(
        { returnNumber: claim.customerReturnNumber },
        { $set: { status: 'COMPLETED' } }
      );
    }

    return res.status(200).json({
      success: true,
      message: `Supplier claim '${claim.claimNumber}' resolved as '${resolutionType}'`,
      data: claim,
    });
  } catch (error) {
    next(error);
  }
};
