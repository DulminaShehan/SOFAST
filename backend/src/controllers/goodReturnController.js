import mongoose from 'mongoose';
import SupplierReturn from '../models/SupplierReturn.js';
import Grn from '../models/Grn.js';
import Item from '../models/Item.js';
import Supplier from '../models/Supplier.js';

const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * Get next available Good Return Note (GREN) sequential number.
 * Requirement:
 * - Generate a unique sequential number starting from 0, then 1, 2, 3, and so on.
 * - If no previous note with 0 exists, return 0.
 * - Never reuse an existing number that belongs to a saved active record.
 */
export const getNextGrenNumber = async (req, res, next) => {
  try {
    const existingNotes = await SupplierReturn.find(
      { status: { $ne: 'deleted' } },
      { no: 1, returnNumber: 1, grenNumber: 1 }
    ).lean();

    const usedNumbers = new Set();
    const numericList = [];

    existingNotes.forEach((n) => {
      const candidates = [n.returnNumber, n.grenNumber, n.no];
      candidates.forEach((val) => {
        if (val !== undefined && val !== null) {
          const str = String(val).trim();
          usedNumbers.add(str);
          if (/^\d+$/.test(str)) {
            numericList.push(parseInt(str, 10));
          }
          const grenMatch = str.match(/^GREN[-_]?(\d+)$/i);
          if (grenMatch) {
            numericList.push(parseInt(grenMatch[1], 10));
            usedNumbers.add(grenMatch[1]);
          }
        }
      });
    });

    // Start at 0 if 0 is not used
    let candidate = 0;
    while (
      usedNumbers.has(String(candidate)) ||
      usedNumbers.has(`GREN-${candidate}`) ||
      usedNumbers.has(`GREN-${String(candidate).padStart(4, '0')}`)
    ) {
      candidate++;
    }

    return res.status(200).json({
      success: true,
      nextNumber: candidate,
      returnNumber: String(candidate),
      grenNumber: String(candidate),
      formattedNumber: String(candidate),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get list of available GRNs for return selection
 * Computes return eligibility and already returned quantities
 */
export const getGrnListForReturn = async (req, res, next) => {
  try {
    const { supplier = '', invoice = '' } = req.query;
    let query = { status: { $ne: 'cancelled' } };

    if (supplier && supplier !== 'All') {
      const s = supplier.trim();
      query.$or = [
        { supplierCode: new RegExp(s, 'i') },
        { supplierName: new RegExp(s, 'i') },
        { supplier: new RegExp(s, 'i') },
      ];
    }

    if (invoice && invoice !== 'All') {
      const inv = invoice.trim();
      const invCondition = [
        { supplierInvoiceNo: new RegExp(inv, 'i') },
        { invoice: new RegExp(inv, 'i') },
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: invCondition }];
        delete query.$or;
      } else {
        query.$or = invCondition;
      }
    }

    const grns = await Grn.find(query)
      .sort({ date: -1, createdAt: -1 })
      .lean();

    // Query all active supplier returns to calculate cumulative returned quantities
    const returns = await SupplierReturn.find(
      { status: { $ne: 'deleted' } },
      { grnReference: 1, grnNumber: 1, lineItems: 1 }
    ).lean();

    const grnReturnMap = new Map();
    returns.forEach((ret) => {
      const ref = String(ret.grnReference || ret.grnNumber || '').trim();
      if (!ref) return;
      const existing = grnReturnMap.get(ref) || 0;
      const retSum = (ret.lineItems || []).reduce(
        (sum, li) => sum + (Number(li.qtyReturn !== undefined ? li.qtyReturn : li.returnQuantity) || 0),
        0
      );
      grnReturnMap.set(ref, existing + retSum);
    });

    const result = grns.map((g) => {
      const gNum = String(g.grnNumber !== undefined ? g.grnNumber : g.no);
      const totalReceived = (g.lineItems || []).reduce(
        (sum, li) => sum + (Number(li.quantity !== undefined ? li.quantity : li.qty) || 0),
        0
      );
      const totalReturned = grnReturnMap.get(gNum) || 0;
      const isFullyReturned = totalReceived > 0 && totalReturned >= totalReceived;

      return {
        _id: g._id,
        grnNumber: gNum,
        no: g.no,
        supplierCode: g.supplierCode || '',
        supplierName: g.supplierName || g.supplier || '',
        supplierInvoiceNo: g.supplierInvoiceNo || g.invoice || '',
        date: g.date,
        totalValue: g.totalValue || g.grnValue || 0,
        lineItemsCount: (g.lineItems || []).length,
        totalReceived,
        totalReturned,
        isFullyReturned,
      };
    });

    return res.status(200).json({
      success: true,
      count: result.length,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get details of a single GRN for return entry
 * Calculates original received quantities, already-returned quantities, remaining eligible quantities,
 * and current sellable stock from Item Master.
 */
export const getGrnDetailsForReturn = async (req, res, next) => {
  try {
    const { grnNumber } = req.params;
    const { excludeGrenNumber } = req.query;

    if (!grnNumber) {
      return res.status(400).json({ success: false, message: 'GRN Number is required' });
    }

    const cleanGrn = String(grnNumber).trim();
    const grn = await Grn.findOne({
      $or: [
        { grnNumber: cleanGrn },
        { grnNumber: new RegExp(`^${cleanGrn}$`, 'i') },
        ...(isNaN(Number(cleanGrn)) ? [] : [{ no: Number(cleanGrn) }]),
      ],
    }).lean();

    if (!grn) {
      return res.status(404).json({
        success: false,
        message: `GRN '${cleanGrn}' not found`,
      });
    }

    const canonicalGrnNumber = String(grn.grnNumber !== undefined ? grn.grnNumber : grn.no);

    // Query all other active GRENs linked to this GRN (excluding the one currently being edited if specified)
    const returnQuery = {
      status: { $ne: 'deleted' },
      $or: [{ grnReference: canonicalGrnNumber }, { grnNumber: canonicalGrnNumber }],
    };

    if (excludeGrenNumber) {
      const cleanEx = String(excludeGrenNumber).trim();
      returnQuery.returnNumber = { $ne: cleanEx };
    }

    const pastReturns = await SupplierReturn.find(returnQuery).lean();

    // Map already returned quantity per item code
    const alreadyReturnedMap = new Map();
    pastReturns.forEach((ret) => {
      (ret.lineItems || []).forEach((li) => {
        const itmCode = String(li.itemCode || li.code || '').trim().toLowerCase();
        if (!itmCode) return;
        const qRet = Number(li.qtyReturn !== undefined ? li.qtyReturn : li.returnQuantity) || 0;
        const prev = alreadyReturnedMap.get(itmCode) || 0;
        alreadyReturnedMap.set(itmCode, prev + qRet);
      });
    });

    // Load current stock for each line item from Item Master
    const rawLines = Array.isArray(grn.lineItems) ? grn.lineItems : [];
    const itemCodes = rawLines.map((li) => String(li.code || li.itemCode || '').trim()).filter(Boolean);
    const itemDocs = await Item.find({ code: { $in: itemCodes } }, { code: 1, quantity: 1, stockInHand: 1, description: 1 }).lean();
    const itemStockMap = new Map();
    itemDocs.forEach((doc) => {
      const stock = Math.max(0, Number(doc.quantity !== undefined ? doc.quantity : doc.stockInHand || 0));
      itemStockMap.set(doc.code.toLowerCase(), stock);
    });

    const detailedLines = rawLines.map((li) => {
      const itmCode = String(li.code || li.itemCode || '').trim();
      const codeKey = itmCode.toLowerCase();
      const originalQuantity = Number(li.quantity !== undefined ? li.quantity : li.qty || 0);
      const unitPrice = Number(li.unitPrice !== undefined ? li.unitPrice : li.rate || 0);
      const discount = Number(li.discount || 0);
      const totalValue = Number(li.totalValue !== undefined ? li.totalValue : li.value || 0);
      const alreadyReturnedQty = alreadyReturnedMap.get(codeKey) || 0;
      const eligibleReturnQty = Math.max(0, Math.round((originalQuantity - alreadyReturnedQty) * 100) / 100);
      const currentStock = itemStockMap.get(codeKey) !== undefined ? itemStockMap.get(codeKey) : 0;

      return {
        itemCode: itmCode,
        code: itmCode,
        description: li.description || '',
        unitPrice,
        price: unitPrice,
        rate: unitPrice,
        quantity: originalQuantity,
        qty: originalQuantity,
        discount,
        totalValue,
        value: totalValue,
        alreadyReturnedQty,
        eligibleReturnQty,
        currentStock,
        locationCode: li.locationCode || 'MAIN',
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        _id: grn._id,
        grnNumber: canonicalGrnNumber,
        no: grn.no,
        supplierCode: grn.supplierCode || '',
        supplierName: grn.supplierName || grn.supplier || '',
        supplierInvoiceNo: grn.supplierInvoiceNo || grn.invoice || '',
        date: grn.date,
        totalValue: grn.totalValue || grn.grnValue || 0,
        returnValue: grn.returnValue || 0,
        lineItems: detailedLines,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Validate Good Return Note draft without committing or altering inventory
 */
export const validateGoodReturn = async (req, res, next) => {
  try {
    const { grnNumber, lineItems = [] } = req.body;

    if (!grnNumber) {
      return res.status(400).json({ success: false, message: 'GRN Number is required for validation' });
    }

    const cleanGrn = String(grnNumber).trim();
    const grn = await Grn.findOne({
      $or: [
        { grnNumber: cleanGrn },
        { grnNumber: new RegExp(`^${cleanGrn}$`, 'i') },
        ...(isNaN(Number(cleanGrn)) ? [] : [{ no: Number(cleanGrn) }]),
      ],
    }).lean();

    if (!grn) {
      return res.status(404).json({ success: false, message: `GRN '${cleanGrn}' not found` });
    }

    const itemsToReturn = lineItems.filter((li) => {
      const q = parseFloat(li.qtyReturn !== undefined ? li.qtyReturn : li.returnQuantity);
      return !isNaN(q) && q > 0;
    });

    if (itemsToReturn.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a return quantity (QTY RETURN > 0) for at least one item',
      });
    }

    // Check eligible return quantities and current inventory
    const canonicalGrnNumber = String(grn.grnNumber !== undefined ? grn.grnNumber : grn.no);
    const pastReturns = await SupplierReturn.find({
      status: { $ne: 'deleted' },
      $or: [{ grnReference: canonicalGrnNumber }, { grnNumber: canonicalGrnNumber }],
    }).lean();

    const alreadyReturnedMap = new Map();
    pastReturns.forEach((ret) => {
      (ret.lineItems || []).forEach((li) => {
        const itmCode = String(li.itemCode || li.code || '').trim().toLowerCase();
        if (!itmCode) return;
        const qRet = Number(li.qtyReturn !== undefined ? li.qtyReturn : li.returnQuantity) || 0;
        const prev = alreadyReturnedMap.get(itmCode) || 0;
        alreadyReturnedMap.set(itmCode, prev + qRet);
      });
    });

    let totalReturnValue = 0;
    const validatedItems = [];

    for (const item of itemsToReturn) {
      const code = String(item.code || item.itemCode || '').trim();
      const returnQty = parseFloat(item.qtyReturn !== undefined ? item.qtyReturn : item.returnQuantity);

      // Find original item in GRN
      const grnLine = (grn.lineItems || []).find(
        (li) => String(li.code || li.itemCode || '').trim().toLowerCase() === code.toLowerCase()
      );

      if (!grnLine) {
        return res.status(400).json({
          success: false,
          message: `Item '${code}' does not belong to GRN '${canonicalGrnNumber}'`,
        });
      }

      const originalQty = Number(grnLine.quantity !== undefined ? grnLine.quantity : grnLine.qty || 0);
      const alreadyReturned = alreadyReturnedMap.get(code.toLowerCase()) || 0;
      const eligibleQty = Math.max(0, Math.round((originalQty - alreadyReturned) * 100) / 100);

      if (returnQty > eligibleQty) {
        return res.status(400).json({
          success: false,
          message: `Item '${code}': Return quantity (${returnQty}) exceeds eligible return quantity (${eligibleQty}) from GRN ${canonicalGrnNumber}`,
        });
      }

      // Check current sellable stock in Item Master
      const itemRecord = await Item.findOne({ code: new RegExp(`^${code}$`, 'i') }).lean();
      if (!itemRecord) {
        return res.status(404).json({
          success: false,
          message: `Item '${code}' not found in Item Master`,
        });
      }

      const currentStock = Math.max(0, Number(itemRecord.quantity !== undefined ? itemRecord.quantity : itemRecord.stockInHand || 0));
      if (currentStock < returnQty) {
        return res.status(400).json({
          success: false,
          message: `Item '${code}': Insufficient current sellable stock in inventory. Available in stock: ${currentStock}, Requested return: ${returnQty}`,
        });
      }

      const unitPrice = Number(grnLine.unitPrice !== undefined ? grnLine.unitPrice : grnLine.rate || 0);
      const discount = Number(grnLine.discount || 0);
      const lineReturnValue = Math.round(returnQty * unitPrice * (1 - discount / 100) * 100) / 100;
      totalReturnValue += lineReturnValue;

      validatedItems.push({
        code,
        description: grnLine.description || itemRecord.description || '',
        unitPrice,
        originalQuantity: originalQty,
        discount,
        returnQty,
        lineReturnValue,
        currentStock,
        eligibleQty,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Validation passed: ${validatedItems.length} item(s) eligible for return. Total return value: Rs. ${totalReturnValue.toFixed(2)}`,
      totalReturnValue: Math.round(totalReturnValue * 100) / 100,
      validatedItems,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Save new Good Return Note (GREN)
 * - Removes returned goods from sellable stock exactly once
 * - Records stock movement linked to Good Return Note and GRN
 * - Updates remaining returnable quantity / return value for GRN
 * - Uses MongoDB transaction for atomic integrity
 */
export const createGoodReturn = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      grenNumber,
      returnNumber,
      no,
      date,
      grnNumber,
      grnReference,
      supplierCode,
      supplierName,
      lineItems = [],
      remarks = '',
      note = '',
    } = req.body;

    const rawGren = String(
      (grenNumber !== undefined && grenNumber !== null && String(grenNumber).trim() !== '')
        ? grenNumber
        : (returnNumber !== undefined && returnNumber !== null && String(returnNumber).trim() !== '')
        ? returnNumber
        : (no !== undefined && no !== null)
        ? no
        : ''
    ).trim();
    if (!rawGren) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Good Return Note (GREN) Number is required' });
    }

    const cleanGrn = String(grnNumber || grnReference || '').trim();
    if (!cleanGrn) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'GRN selection is required' });
    }

    // 1. Prevent duplicate submission / duplicate GREN number
    const existingGREN = await SupplierReturn.findOne({
      status: { $ne: 'deleted' },
      $or: [{ returnNumber: rawGren }, { grenNumber: rawGren }, ...(isNaN(Number(rawGren)) ? [] : [{ no: Number(rawGren) }])],
    }).session(session);

    if (existingGREN) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({
        success: false,
        message: `Good Return Note '${rawGren}' already exists. Use Update to modify it or click New for a new note.`,
      });
    }

    // 2. Validate GRN
    const grn = await Grn.findOne({
      $or: [
        { grnNumber: cleanGrn },
        { grnNumber: new RegExp(`^${cleanGrn}$`, 'i') },
        ...(isNaN(Number(cleanGrn)) ? [] : [{ no: Number(cleanGrn) }]),
      ],
    }).session(session);

    if (!grn) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: `GRN '${cleanGrn}' not found` });
    }

    const canonicalGrnNumber = String(grn.grnNumber !== undefined ? grn.grnNumber : grn.no);

    // 3. Filter line items with return quantity > 0
    const itemsToReturn = lineItems.filter((li) => {
      const q = parseFloat(li.qtyReturn !== undefined ? li.qtyReturn : li.returnQuantity);
      return !isNaN(q) && q > 0;
    });

    if (itemsToReturn.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid return quantity (QTY RETURN > 0) for at least one item',
      });
    }

    // 4. Calculate already returned quantities from past GRENs
    const pastReturns = await SupplierReturn.find({
      status: { $ne: 'deleted' },
      $or: [{ grnReference: canonicalGrnNumber }, { grnNumber: canonicalGrnNumber }],
    }).session(session).lean();

    const alreadyReturnedMap = new Map();
    pastReturns.forEach((ret) => {
      (ret.lineItems || []).forEach((li) => {
        const itmCode = String(li.itemCode || li.code || '').trim().toLowerCase();
        if (!itmCode) return;
        const qRet = Number(li.qtyReturn !== undefined ? li.qtyReturn : li.returnQuantity) || 0;
        const prev = alreadyReturnedMap.get(itmCode) || 0;
        alreadyReturnedMap.set(itmCode, prev + qRet);
      });
    });

    // 5. Validate stock and compute return lines
    const validatedLines = [];
    let calculatedReturnTotal = 0;

    for (let i = 0; i < itemsToReturn.length; i++) {
      const row = itemsToReturn[i];
      const code = String(row.code || row.itemCode || '').trim();
      const returnQty = parseFloat(row.qtyReturn !== undefined ? row.qtyReturn : row.returnQuantity);

      // Match item in original GRN
      const grnLine = (grn.lineItems || []).find(
        (li) => String(li.code || li.itemCode || '').trim().toLowerCase() === code.toLowerCase()
      );

      if (!grnLine) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `Line #${i + 1}: Item '${code}' is not part of GRN '${canonicalGrnNumber}'`,
        });
      }

      const originalQty = Number(grnLine.quantity !== undefined ? grnLine.quantity : grnLine.qty || 0);
      const alreadyReturned = alreadyReturnedMap.get(code.toLowerCase()) || 0;
      const eligibleQty = Math.max(0, Math.round((originalQty - alreadyReturned) * 100) / 100);

      if (returnQty > eligibleQty) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `Item '${code}': Return quantity (${returnQty}) exceeds eligible return quantity (${eligibleQty}) for GRN ${canonicalGrnNumber}`,
        });
      }

      // Check current sellable stock in Item Master
      const itemRecord = await Item.findOne({ code: new RegExp(`^${code}$`, 'i') }).session(session);
      if (!itemRecord) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          success: false,
          message: `Item '${code}' does not exist in Item Master`,
        });
      }

      const availableStock = Math.max(0, Number(itemRecord.quantity !== undefined ? itemRecord.quantity : itemRecord.stockInHand || 0));
      if (availableStock < returnQty) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `Item '${code}': Insufficient current sellable inventory. Stock in hand: ${availableStock}, Requested return: ${returnQty}`,
        });
      }

      const unitPrice = Number(grnLine.unitPrice !== undefined ? grnLine.unitPrice : grnLine.rate || 0);
      const discount = Number(grnLine.discount || 0);
      const lineReturnValue = Math.round(returnQty * unitPrice * (1 - discount / 100) * 100) / 100;
      calculatedReturnTotal += lineReturnValue;

      validatedLines.push({
        no: i + 1,
        itemCode: itemRecord.code,
        code: itemRecord.code,
        description: row.description || grnLine.description || itemRecord.description || '',
        quantity: originalQty,
        qty: originalQty,
        unitPrice,
        price: unitPrice,
        rate: unitPrice,
        discount,
        qtyReturn: returnQty,
        returnQuantity: returnQty,
        totalValue: lineReturnValue,
        value: lineReturnValue,
        returnValue: lineReturnValue,
        locationCode: grnLine.locationCode || 'MAIN',
        itemDocId: itemRecord._id,
      });
    }

    // 6. Reduce sellable stock exactly once for each returned item
    for (const line of validatedLines) {
      await Item.updateOne(
        { _id: line.itemDocId },
        {
          $inc: {
            quantity: -line.qtyReturn,
            stockInHand: -line.qtyReturn,
          },
        },
        { session }
      );
    }

    // 7. Record stock movement entry in 'stockadjustments' collection
    const db = mongoose.connection.db;
    try {
      await db.collection('stockadjustments').insertOne(
        {
          adjustmentNumber: `ADJ-GREN-${rawGren}`,
          adjType: 'SUPPLIER_RETURN',
          referenceType: 'GREN',
          referenceNumber: rawGren,
          grnReference: canonicalGrnNumber,
          supplierCode: supplierCode || grn.supplierCode || '',
          lineItems: validatedLines.map((vl) => ({
            itemCode: vl.itemCode,
            returnedQty: vl.qtyReturn,
            unitValue: vl.unitPrice,
            lineValue: vl.totalValue,
          })),
          totalVarianceValue: -Math.round(calculatedReturnTotal * 100) / 100,
          date: date ? new Date(date) : new Date(),
          isPosted: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        { session }
      );
    } catch (e) {
      console.warn('Could not record stockadjustment audit:', e.message);
    }

    // 8. Update GRN return total
    await Grn.updateOne(
      { _id: grn._id },
      {
        $inc: {
          returnValue: Math.round(calculatedReturnTotal * 100) / 100,
        },
      },
      { session }
    );

    // 9. Save new SupplierReturn document in 'supplierreturns'
    const numericNo = !isNaN(Number(rawGren)) ? Number(rawGren) : validatedLines[0]?.no || 0;
    const finalSupplierCode = supplierCode || grn.supplierCode || '';
    const finalSupplierName = supplierName || grn.supplierName || grn.supplier || '';

    const newReturn = new SupplierReturn({
      no: numericNo,
      returnNumber: rawGren,
      grenNumber: rawGren,
      grnReference: canonicalGrnNumber,
      grnNumber: canonicalGrnNumber,
      grnId: grn._id,
      supplierCode: finalSupplierCode,
      supplierName: finalSupplierName,
      date: date ? new Date(date) : new Date(),
      time: new Date().toLocaleTimeString(),
      userCode: req.body.userCode || 'PC004',
      lineItems: validatedLines,
      returnTotal: Math.round(calculatedReturnTotal * 100) / 100,
      totalReturnValue: Math.round(calculatedReturnTotal * 100) / 100,
      isPosted: true,
      status: 'active',
      stockDeducted: true,
      remarks: remarks || note || '',
      note: note || remarks || '',
    });

    await newReturn.save({ session });

    // 10. Update docnumbers sequence for SUP_RTN or GREN
    try {
      await db.collection('docnumbers').updateOne(
        { docType: { $in: ['SUP_RTN', 'GREN'] } },
        { $max: { currentNumber: numericNo + 1 } },
        { session }
      );
    } catch (err) {
      // non-fatal
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: `Good Return Note '${rawGren}' saved successfully and stock deducted`,
      data: newReturn,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

/**
 * Update an existing Good Return Note (GREN)
 * - Computes delta between old returned quantities and new returned quantities
 * - Reverses old stock deduction and applies new stock deduction safely
 * - Updates GRN return totals
 */
export const updateGoodReturn = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { grenNumber } = req.params;
    const { date, lineItems = [], remarks = '', note = '' } = req.body;

    const cleanGren = String(grenNumber).trim();
    const existing = await SupplierReturn.findOne({
      status: { $ne: 'deleted' },
      $or: [{ returnNumber: cleanGren }, { grenNumber: cleanGren }, ...(isNaN(Number(cleanGren)) ? [] : [{ no: Number(cleanGren) }])],
    }).session(session);

    if (!existing) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: `Good Return Note '${cleanGren}' not found` });
    }

    const canonicalGrnNumber = String(existing.grnReference || existing.grnNumber || '');
    const grn = await Grn.findOne({
      $or: [
        { grnNumber: canonicalGrnNumber },
        { grnNumber: new RegExp(`^${canonicalGrnNumber}$`, 'i') },
        ...(isNaN(Number(canonicalGrnNumber)) ? [] : [{ no: Number(canonicalGrnNumber) }]),
      ],
    }).session(session);

    // Map old returned quantities by item code
    const oldQtyMap = new Map();
    (existing.lineItems || []).forEach((li) => {
      const code = String(li.itemCode || li.code || '').trim().toLowerCase();
      oldQtyMap.set(code, Number(li.qtyReturn !== undefined ? li.qtyReturn : li.returnQuantity) || 0);
    });

    // Query other GRENs for eligible quantity calculation
    const otherReturns = await SupplierReturn.find({
      status: { $ne: 'deleted' },
      _id: { $ne: existing._id },
      $or: [{ grnReference: canonicalGrnNumber }, { grnNumber: canonicalGrnNumber }],
    }).session(session).lean();

    const otherReturnedMap = new Map();
    otherReturns.forEach((ret) => {
      (ret.lineItems || []).forEach((li) => {
        const itmCode = String(li.itemCode || li.code || '').trim().toLowerCase();
        if (!itmCode) return;
        const qRet = Number(li.qtyReturn !== undefined ? li.qtyReturn : li.returnQuantity) || 0;
        const prev = otherReturnedMap.get(itmCode) || 0;
        otherReturnedMap.set(itmCode, prev + qRet);
      });
    });

    const itemsToReturn = lineItems.filter((li) => {
      const q = parseFloat(li.qtyReturn !== undefined ? li.qtyReturn : li.returnQuantity);
      return !isNaN(q) && q > 0;
    });

    if (itemsToReturn.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'A Good Return Note must have at least one returned item',
      });
    }

    let updatedReturnTotal = 0;
    const updatedLines = [];
    const stockDeltas = [];

    for (let i = 0; i < itemsToReturn.length; i++) {
      const row = itemsToReturn[i];
      const code = String(row.code || row.itemCode || '').trim();
      const newReturnQty = parseFloat(row.qtyReturn !== undefined ? row.qtyReturn : row.returnQuantity);
      const codeKey = code.toLowerCase();
      const oldReturnQty = oldQtyMap.get(codeKey) || 0;
      const delta = Math.round((newReturnQty - oldReturnQty) * 100) / 100;

      // Find original GRN line
      const grnLine = (grn?.lineItems || []).find(
        (li) => String(li.code || li.itemCode || '').trim().toLowerCase() === codeKey
      );

      if (grn && grnLine) {
        const originalQty = Number(grnLine.quantity !== undefined ? grnLine.quantity : grnLine.qty || 0);
        const otherReturned = otherReturnedMap.get(codeKey) || 0;
        const eligibleQty = Math.max(0, Math.round((originalQty - otherReturned) * 100) / 100);

        if (newReturnQty > eligibleQty) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            message: `Item '${code}': Return quantity (${newReturnQty}) exceeds eligible return quantity (${eligibleQty}) for GRN ${canonicalGrnNumber}`,
          });
        }
      }

      // Check Item Master
      const itemRecord = await Item.findOne({ code: new RegExp(`^${code}$`, 'i') }).session(session);
      if (!itemRecord) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ success: false, message: `Item '${code}' not found in Item Master` });
      }

      // If return quantity increased (delta > 0), verify additional stock is available
      if (delta > 0) {
        const availableStock = Math.max(0, Number(itemRecord.quantity !== undefined ? itemRecord.quantity : itemRecord.stockInHand || 0));
        if (availableStock < delta) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            message: `Item '${code}': Cannot increase return by ${delta}. Insufficient stock in inventory (available: ${availableStock})`,
          });
        }
      }

      const unitPrice = Number(row.unitPrice !== undefined ? row.unitPrice : (grnLine?.unitPrice || row.price || 0));
      const discount = Number(row.discount !== undefined ? row.discount : (grnLine?.discount || 0));
      const lineReturnValue = Math.round(newReturnQty * unitPrice * (1 - discount / 100) * 100) / 100;
      updatedReturnTotal += lineReturnValue;

      updatedLines.push({
        no: i + 1,
        itemCode: itemRecord.code,
        code: itemRecord.code,
        description: row.description || grnLine?.description || itemRecord.description || '',
        quantity: grnLine ? Number(grnLine.quantity || grnLine.qty || 0) : row.quantity || 0,
        qty: grnLine ? Number(grnLine.quantity || grnLine.qty || 0) : row.quantity || 0,
        unitPrice,
        price: unitPrice,
        rate: unitPrice,
        discount,
        qtyReturn: newReturnQty,
        returnQuantity: newReturnQty,
        totalValue: lineReturnValue,
        value: lineReturnValue,
        returnValue: lineReturnValue,
        locationCode: grnLine?.locationCode || 'MAIN',
      });

      if (delta !== 0) {
        stockDeltas.push({ itemDocId: itemRecord._id, delta });
      }
    }

    // Check items that were previously returned but now omitted (return quantity reduced to 0)
    for (const [codeKey, oldQty] of oldQtyMap.entries()) {
      const stillReturned = itemsToReturn.some((r) => String(r.code || r.itemCode || '').trim().toLowerCase() === codeKey);
      if (!stillReturned && oldQty > 0) {
        const itemRecord = await Item.findOne({ code: new RegExp(`^${codeKey}$`, 'i') }).session(session);
        if (itemRecord) {
          stockDeltas.push({ itemDocId: itemRecord._id, delta: -oldQty });
        }
      }
    }

    // Apply stock deltas
    for (const { itemDocId, delta } of stockDeltas) {
      await Item.updateOne(
        { _id: itemDocId },
        {
          $inc: {
            quantity: -delta,
            stockInHand: -delta,
          },
        },
        { session }
      );
    }

    // Update GRN return total delta
    const oldReturnTotal = Number(existing.returnTotal || existing.totalReturnValue || 0);
    const returnTotalDelta = Math.round((updatedReturnTotal - oldReturnTotal) * 100) / 100;

    if (grn && returnTotalDelta !== 0) {
      await Grn.updateOne(
        { _id: grn._id },
        { $inc: { returnValue: returnTotalDelta } },
        { session }
      );
    }

    // Update SupplierReturn document
    existing.lineItems = updatedLines;
    existing.returnTotal = Math.round(updatedReturnTotal * 100) / 100;
    existing.totalReturnValue = Math.round(updatedReturnTotal * 100) / 100;
    if (date) existing.date = new Date(date);
    if (remarks || note) {
      existing.remarks = remarks || note;
      existing.note = note || remarks;
    }

    await existing.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: `Good Return Note '${cleanGren}' updated successfully`,
      data: existing,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

/**
 * Delete a Good Return Note (GREN)
 * - Reverses the stock deduction: restores returned items back to sellable stock exactly once
 * - Reverts GRN return totals
 * - Marks status as 'deleted' or removes record
 */
export const deleteGoodReturn = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { grenNumber } = req.params;
    const cleanGren = String(grenNumber).trim();

    const existing = await SupplierReturn.findOne({
      status: { $ne: 'deleted' },
      $or: [{ returnNumber: cleanGren }, { grenNumber: cleanGren }, ...(isNaN(Number(cleanGren)) ? [] : [{ no: Number(cleanGren) }])],
    }).session(session);

    if (!existing) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: `Good Return Note '${cleanGren}' not found` });
    }

    // Reverse stock deduction for each returned item
    const rawLines = Array.isArray(existing.lineItems) ? existing.lineItems : [];
    for (const line of rawLines) {
      const code = String(line.itemCode || line.code || '').trim();
      const returnQty = Number(line.qtyReturn !== undefined ? line.qtyReturn : line.returnQuantity || 0);

      if (code && returnQty > 0) {
        await Item.updateOne(
          { code: new RegExp(`^${code}$`, 'i') },
          {
            $inc: {
              quantity: returnQty,
              stockInHand: returnQty,
            },
          },
          { session }
        );
      }
    }

    // Revert GRN return total
    const canonicalGrnNumber = String(existing.grnReference || existing.grnNumber || '');
    const returnTotal = Number(existing.returnTotal || existing.totalReturnValue || 0);

    if (canonicalGrnNumber && returnTotal > 0) {
      await Grn.updateOne(
        {
          $or: [
            { grnNumber: canonicalGrnNumber },
            { grnNumber: new RegExp(`^${canonicalGrnNumber}$`, 'i') },
            ...(isNaN(Number(canonicalGrnNumber)) ? [] : [{ no: Number(canonicalGrnNumber) }]),
          ],
        },
        { $inc: { returnValue: -returnTotal } },
        { session }
      );
    }

    // Mark as deleted in supplierreturns
    existing.status = 'deleted';
    existing.stockDeducted = false;
    await existing.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: `Good Return Note '${cleanGren}' deleted successfully and returned stock restored to inventory`,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

/**
 * Get all Good Return Notes with search, pagination, and dropdown summary
 */
export const getGoodReturns = async (req, res, next) => {
  try {
    const { search = '', page = 1, limit = 100 } = req.query;

    const query = { status: { $ne: 'deleted' } };
    if (search && search.trim()) {
      const q = search.trim();
      query.$or = [
        { returnNumber: { $regex: q, $options: 'i' } },
        { grenNumber: { $regex: q, $options: 'i' } },
        { grnReference: { $regex: q, $options: 'i' } },
        { grnNumber: { $regex: q, $options: 'i' } },
        { supplierCode: { $regex: q, $options: 'i' } },
        { supplierName: { $regex: q, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 100));
    const skip = (pageNum - 1) * limitNum;

    const [total, returns] = await Promise.all([
      SupplierReturn.countDocuments(query),
      SupplierReturn.find(query).sort({ date: -1, no: -1, createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    ]);

    const formatted = returns.map((r) => ({
      _id: r._id,
      no: r.no,
      returnNumber: r.returnNumber || String(r.no),
      grenNumber: r.returnNumber || String(r.no),
      grnReference: r.grnReference || r.grnNumber || '',
      grnNumber: r.grnReference || r.grnNumber || '',
      supplierCode: r.supplierCode || '',
      supplierName: r.supplierName || '',
      date: r.date,
      lineItemsCount: (r.lineItems || []).length,
      returnTotal: r.returnTotal || r.totalReturnValue || 0,
      totalReturnValue: r.returnTotal || r.totalReturnValue || 0,
      isPosted: r.isPosted,
      status: r.status,
    }));

    return res.status(200).json({
      success: true,
      count: formatted.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single Good Return Note by number
 */
export const getGoodReturnByNumber = async (req, res, next) => {
  try {
    const { grenNumber } = req.params;
    if (!grenNumber) {
      return res.status(400).json({ success: false, message: 'GREN Number is required' });
    }

    const cleanGren = String(grenNumber).trim();
    const returnNote = await SupplierReturn.findOne({
      status: { $ne: 'deleted' },
      $or: [
        { returnNumber: cleanGren },
        { returnNumber: new RegExp(`^${cleanGren}$`, 'i') },
        { grenNumber: cleanGren },
        ...(isNaN(Number(cleanGren)) ? [] : [{ no: Number(cleanGren) }]),
      ],
    }).lean();

    if (!returnNote) {
      return res.status(404).json({ success: false, message: `Good Return Note '${cleanGren}' not found` });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...returnNote,
        returnNumber: returnNote.returnNumber || String(returnNote.no),
        grenNumber: returnNote.returnNumber || String(returnNote.no),
        grnReference: returnNote.grnReference || returnNote.grnNumber || '',
        grnNumber: returnNote.grnReference || returnNote.grnNumber || '',
      },
    });
  } catch (error) {
    next(error);
  }
};
