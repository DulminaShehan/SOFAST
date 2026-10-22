import mongoose from 'mongoose';
import Grn from '../models/Grn.js';
import Item from '../models/Item.js';
import Supplier from '../models/Supplier.js';

/**
 * Format GRN number with zero padding (fallback)
 */
const formatGrnNumber = (num) => {
  return String(num);
};

/**
 * Helper to aggregate line items by item code to ensure unique quantities per item in GRN
 */
export const aggregateGrnItemsByCode = (lines) => {
  const map = new Map();
  if (!Array.isArray(lines)) return map;
  for (const line of lines) {
    const code = (line.code || line.itemCode || '').trim();
    if (!code) continue;
    const qty = parseFloat(line.quantity !== undefined ? line.quantity : line.qty) || 0;
    if (qty <= 0) continue;
    const existing = map.get(code) || { code, quantity: 0, line };
    existing.quantity += qty;
    map.set(code, existing);
  }
  return map;
};

/**
 * Get next available GRN Number and sequence number.
 * Requirement:
 * - Automatically generate a unique, sequential GRN number.
 * - The first GRN number must be 0, as requested.
 * - After saving the first GRN, the next number should be 1, followed by 2, and so on.
 * - Never reuse a GRN number that already belongs to a saved record.
 */
export const getNextGrnNumber = async (req, res, next) => {
  try {
    const existingGrns = await Grn.find({}, { no: 1, grnNumber: 1 }).lean();

    const usedGrnNumbers = new Set();
    const numericList = [];

    existingGrns.forEach((g) => {
      if (g.grnNumber !== undefined && g.grnNumber !== null) {
        const str = String(g.grnNumber).trim();
        usedGrnNumbers.add(str);
        if (/^\d+$/.test(str)) {
          numericList.push(parseInt(str, 10));
        }
      }
    });

    // Start at 0 if no numeric GRN exists, else max + 1
    let candidate = 0;
    if (numericList.length > 0) {
      candidate = Math.max(...numericList) + 1;
    }

    // Safety check to avoid any accidental collision
    while (usedGrnNumbers.has(String(candidate))) {
      candidate++;
    }

    const grnNumber = String(candidate);

    return res.status(200).json({
      success: true,
      data: {
        no: candidate,
        grnNumber,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get list of GRNs
 */
export const getGrns = async (req, res, next) => {
  try {
    const { search, limit = 100, page = 1 } = req.query;
    const query = {};

    if (search && search.trim() !== '') {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { grnNumber: regex },
        { supplierCode: regex },
        { supplier: regex },
        { supplierName: regex },
        { supplierInvoiceNo: regex },
        { invoice: regex },
        { masterPo: regex },
      ];
    }

    const parsedLimit = Math.min(Math.max(1, parseInt(limit, 10) || 100), 1000);
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const skip = (parsedPage - 1) * parsedLimit;

    const [grns, total] = await Promise.all([
      Grn.find(query).sort({ no: -1, createdAt: -1 }).skip(skip).limit(parsedLimit),
      Grn.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: grns,
      total,
      page: parsedPage,
      totalPages: Math.ceil(total / parsedLimit),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single GRN by ID or GRN Number
 */
export const getGrnById = async (req, res, next) => {
  try {
    const { id } = req.params;
    let grn = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      grn = await Grn.findById(id);
    }
    if (!grn) {
      grn = await Grn.findOne({ grnNumber: String(id).trim() });
    }

    if (!grn) {
      return res.status(404).json({
        success: false,
        message: `GRN '${id}' not found`,
      });
    }

    return res.status(200).json({
      success: true,
      data: grn,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper to compute safe next GRN number and no
 */
const resolveNextGrnSequence = async (requestedNo, requestedGrnNumber) => {
  const existingGrns = await Grn.find({}, { no: 1, grnNumber: 1 }).lean();
  const usedGrnNumbers = new Set();
  const numericList = [];

  existingGrns.forEach((g) => {
    if (g.grnNumber !== undefined && g.grnNumber !== null) {
      const str = String(g.grnNumber).trim();
      usedGrnNumbers.add(str);
      if (/^\d+$/.test(str)) {
        numericList.push(parseInt(str, 10));
      }
    }
  });

  // Check if requested numbers are valid and not already used
  if (
    requestedGrnNumber !== undefined &&
    requestedGrnNumber !== null &&
    String(requestedGrnNumber).trim() !== ''
  ) {
    const strGrn = String(requestedGrnNumber).trim();
    if (!usedGrnNumbers.has(strGrn)) {
      const numNo =
        requestedNo !== undefined && requestedNo !== null && !isNaN(Number(requestedNo))
          ? Number(requestedNo)
          : (/^\d+$/.test(strGrn) ? parseInt(strGrn, 10) : 0);
      return { no: numNo, grnNumber: strGrn };
    }
  }

  // Start at 0 if no numeric GRN exists, else max + 1
  let candidate = 0;
  if (numericList.length > 0) {
    candidate = Math.max(...numericList) + 1;
  }

  // Safety check to avoid any accidental collision
  while (usedGrnNumbers.has(String(candidate))) {
    candidate++;
  }

  return { no: candidate, grnNumber: String(candidate) };
};

/**
 * Create a new GRN.
 * Stock is increased ONLY if isPosted === true (Posting).
 * If isPosted === false, GRN is saved as a draft without changing stock.
 */
export const createGrn = async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    const {
      no,
      grnNumber: providedGrnNumber,
      supplierCode,
      supplierName,
      supplierInvoiceNo,
      invoice,
      paidBy = 'Cash',
      masterPo = '',
      useBarcode = false,
      lineItems = [],
      date,
      remark = '',
      isPosted = false,
    } = req.body;

    // 1. Supplier Validation: Must exist in Supplier Register
    if (!supplierCode || supplierCode.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Supplier code is required',
      });
    }

    const trimmedSuppCode = supplierCode.trim();
    const existingSupplier = await Supplier.findOne({
      $or: [
        { code: trimmedSuppCode },
        ...(mongoose.Types.ObjectId.isValid(trimmedSuppCode) ? [{ _id: trimmedSuppCode }] : []),
      ],
    });

    if (!existingSupplier) {
      return res.status(400).json({
        success: false,
        message: `Supplier '${trimmedSuppCode}' does not exist in Supplier Register`,
      });
    }

    const resolvedSupplierCode = existingSupplier.code;
    const resolvedSupplierName = existingSupplier.name;

    // 2. Line Items Validation
    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required in the GRN',
      });
    }

    // Verify all line item codes exist in Item Master
    for (let i = 0; i < lineItems.length; i++) {
      const line = lineItems[i];
      const itemCode = (line.code || line.itemCode || '').trim();
      if (!itemCode) {
        return res.status(400).json({
          success: false,
          message: `Line item #${i + 1} is missing an Item Code`,
        });
      }
      const itemExists = await Item.findOne({ code: itemCode });
      if (!itemExists) {
        return res.status(400).json({
          success: false,
          message: `Item code '${itemCode}' does not exist in Item Master`,
        });
      }
      const qty = parseFloat(line.quantity !== undefined ? line.quantity : line.qty);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({
          success: false,
          message: `Item '${itemCode}' quantity must be greater than 0`,
        });
      }
      const price = parseFloat(line.unitPrice !== undefined ? line.unitPrice : (line.price || line.rate || 0));
      if (isNaN(price) || price < 0) {
        return res.status(400).json({
          success: false,
          message: `Item '${itemCode}' purchase price cannot be negative`,
        });
      }
    }

    // 3. Sequential GRN Number Resolution (Starts at 0, never reuses saved numbers)
    const { no: finalNo, grnNumber: finalGrnNumber } = await resolveNextGrnSequence(no, providedGrnNumber);

    // 4. Process Line Items and Line Values:
    // Line Gross = Purchase Price * Quantity
    // Discount Amount = Line Gross * Discount Percentage / 100
    // Line Value = Line Gross - Discount Amount
    let totalGrnValue = 0;
    const processedLineItems = lineItems.map((item) => {
      const code = (item.code || item.itemCode || '').trim();
      const qty = parseFloat(item.quantity !== undefined ? item.quantity : item.qty) || 0;
      const unitPrice = parseFloat(item.unitPrice !== undefined ? item.unitPrice : (item.price || item.rate || 0));
      const sellingPrice = parseFloat(item.sellingPrice !== undefined ? item.sellingPrice : (item.sellPrice || 0));
      const discountPct = Math.min(100, Math.max(0, parseFloat(item.discount !== undefined ? item.discount : (item.discountPercentage || 0))));

      const lineGross = Math.round(qty * unitPrice * 100) / 100;
      const discountAmount = Math.round(((lineGross * discountPct) / 100) * 100) / 100;
      const value = Math.max(0, Math.round((lineGross - discountAmount) * 100) / 100);

      totalGrnValue = Math.round((totalGrnValue + value) * 100) / 100;

      return {
        code,
        itemCode: code,
        description: item.description || '',
        quantity: qty,
        qty,
        unitPrice,
        rate: unitPrice,
        sellingPrice,
        discount: discountPct,
        totalValue: value,
        value,
        locationCode: item.locationCode || item.location || 'MAIN',
      };
    });

    const grnDate = date ? new Date(date) : new Date();
    const formattedDateStr = grnDate.toISOString().split('T')[0];
    const willPost = Boolean(isPosted);

    // 5. Create GRN Record
    const newGrn = new Grn({
      no: finalNo,
      grnNumber: finalGrnNumber,
      supplierCode: resolvedSupplierCode,
      supplier: resolvedSupplierCode,
      supplierName: resolvedSupplierName,
      supplierInvoiceNo: supplierInvoiceNo || invoice || '',
      invoice: supplierInvoiceNo || invoice || '',
      paidBy,
      masterPo: masterPo || '',
      useBarcode: Boolean(useBarcode),
      lineItems: processedLineItems,
      grnValue: totalGrnValue,
      totalValue: totalGrnValue,
      setValue: 0,
      returnValue: 0,
      isPosted: willPost,
      paymentStatus: 'pending',
      date: grnDate,
      remark,
    });

    await newGrn.save();

    // 6. Update docnumbers sequence tracking
    await db.collection('docnumbers').updateOne(
      { docType: 'GRN' },
      { $set: { currentNumber: finalNo } },
      { upsert: true }
    );

    // 7. Update Item Stock ONLY if posting (isPosted === true)
    // IMPORTANT: Stock is increased strictly once atomically. Selling price is NOT overwritten!
    if (willPost) {
      const itemsMap = aggregateGrnItemsByCode(processedLineItems);
      for (const [code, { quantity: qty, line }] of itemsMap.entries()) {
        await Item.updateOne(
          { code },
          {
            $inc: { quantity: qty, stockInHand: qty },
            $set: {
              lastGrnPrice: line.unitPrice,
              lastGrn: formattedDateStr,
              lastGrnDate: formattedDateStr,
            },
          }
        );
      }
    }

    const msg = willPost
      ? `GRN '${newGrn.grnNumber}' posted and stock updated successfully`
      : `GRN '${newGrn.grnNumber}' saved successfully as draft`;

    return res.status(201).json({
      success: true,
      message: msg,
      data: newGrn,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A GRN with this number already exists. Please start a new GRN.',
      });
    }
    next(error);
  }
};

/**
 * Update an existing GRN.
 * - If updating an unposted GRN with isPosted: true -> Posts the GRN and applies stock movements exactly once.
 * - If GRN is already posted -> Prevents double stock increments!
 * - If updating draft without posting -> Updates records without touching stock.
 */
export const updateGrn = async (req, res, next) => {
  try {
    const { id } = req.params;
    let grn = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      grn = await Grn.findById(id);
    }
    if (!grn) {
      grn = await Grn.findOne({ grnNumber: String(id).trim() });
    }

    if (!grn) {
      return res.status(404).json({
        success: false,
        message: `GRN '${id}' not found`,
      });
    }

    const {
      supplierCode,
      supplierName,
      supplierInvoiceNo,
      invoice,
      paidBy,
      masterPo,
      useBarcode,
      lineItems = [],
      date,
      remark,
      isPosted,
    } = req.body;

    // Validate supplier if provided
    let resolvedSupplierCode = grn.supplierCode;
    let resolvedSupplierName = grn.supplierName;
    if (supplierCode !== undefined) {
      const trimmedSuppCode = supplierCode.trim();
      const existingSupplier = await Supplier.findOne({
        $or: [
          { code: trimmedSuppCode },
          ...(mongoose.Types.ObjectId.isValid(trimmedSuppCode) ? [{ _id: trimmedSuppCode }] : []),
        ],
      });
      if (!existingSupplier) {
        return res.status(400).json({
          success: false,
          message: `Supplier '${trimmedSuppCode}' does not exist in Supplier Register`,
        });
      }
      resolvedSupplierCode = existingSupplier.code;
      resolvedSupplierName = existingSupplier.name;
    }

    // Process line items if provided
    let processedLineItems = grn.lineItems;
    let totalGrnValue = grn.totalValue;

    if (Array.isArray(lineItems) && lineItems.length > 0) {
      // Validate line items
      for (let i = 0; i < lineItems.length; i++) {
        const line = lineItems[i];
        const itemCode = (line.code || line.itemCode || '').trim();
        if (!itemCode) {
          return res.status(400).json({
            success: false,
            message: `Line item #${i + 1} is missing an Item Code`,
          });
        }
        const itemExists = await Item.findOne({ code: itemCode });
        if (!itemExists) {
          return res.status(400).json({
            success: false,
            message: `Item code '${itemCode}' does not exist in Item Master`,
          });
        }
      }

      totalGrnValue = 0;
      processedLineItems = lineItems.map((item) => {
        const code = (item.code || item.itemCode || '').trim();
        const qty = parseFloat(item.quantity !== undefined ? item.quantity : item.qty) || 0;
        const unitPrice = parseFloat(item.unitPrice !== undefined ? item.unitPrice : (item.price || item.rate || 0));
        const sellingPrice = parseFloat(item.sellingPrice !== undefined ? item.sellingPrice : (item.sellPrice || 0));
        const discountPct = Math.min(100, Math.max(0, parseFloat(item.discount !== undefined ? item.discount : (item.discountPercentage || 0))));

        const lineGross = Math.round(qty * unitPrice * 100) / 100;
        const discountAmount = Math.round(((lineGross * discountPct) / 100) * 100) / 100;
        const value = Math.max(0, Math.round((lineGross - discountAmount) * 100) / 100);

        totalGrnValue = Math.round((totalGrnValue + value) * 100) / 100;

        return {
          code,
          itemCode: code,
          description: item.description || '',
          quantity: qty,
          qty,
          unitPrice,
          rate: unitPrice,
          sellingPrice,
          discount: discountPct,
          totalValue: value,
          value,
          locationCode: item.locationCode || item.location || 'MAIN',
        };
      });
    }

    const grnDate = date ? new Date(date) : grn.date;
    const formattedDateStr = new Date(grnDate).toISOString().split('T')[0];

    const wasPosted = Boolean(grn.isPosted);
    const targetPosted = isPosted !== undefined ? Boolean(isPosted) : wasPosted;

    // Stock state transition logic:
    // 1. If transitioning from unposted (false) to posted (true):
    //    Apply stock movements to items atomically!
    // 2. If already posted and target is posted:
    //    Calculate delta (delta = newQty - oldQty) and apply difference!
    // 3. If transitioning from posted (true) to unposted (false):
    //    Revert previous stock movements atomically.
    if (!wasPosted && targetPosted) {
      // First time posting this GRN: update stock atomically
      const itemsMap = aggregateGrnItemsByCode(processedLineItems);
      for (const [code, { quantity: qty, line }] of itemsMap.entries()) {
        await Item.updateOne(
          { code },
          {
            $inc: { quantity: qty, stockInHand: qty },
            $set: {
              lastGrnPrice: line.unitPrice,
              lastGrn: formattedDateStr,
              lastGrnDate: formattedDateStr,
            },
          }
        );
      }
    } else if (wasPosted && !targetPosted) {
      // Revert previous stock movements if explicitly unposting
      const oldMap = aggregateGrnItemsByCode(grn.lineItems);
      for (const [code, { quantity: oldQty }] of oldMap.entries()) {
        await Item.updateOne(
          { code },
          { $inc: { quantity: -oldQty, stockInHand: -oldQty } }
        );
      }
    } else if (wasPosted && targetPosted) {
      // Already posted GRN being updated: apply only the delta
      const oldMap = aggregateGrnItemsByCode(grn.lineItems);
      const newMap = aggregateGrnItemsByCode(processedLineItems);
      const allCodes = new Set([...oldMap.keys(), ...newMap.keys()]);

      for (const code of allCodes) {
        const oldQty = oldMap.get(code)?.quantity || 0;
        const newQty = newMap.get(code)?.quantity || 0;
        const delta = newQty - oldQty;
        if (delta !== 0) {
          await Item.updateOne(
            { code },
            { $inc: { quantity: delta, stockInHand: delta } }
          );
        }
      }
    }

    // Update document fields
    grn.supplierCode = resolvedSupplierCode;
    grn.supplier = resolvedSupplierCode;
    grn.supplierName = resolvedSupplierName;
    if (supplierInvoiceNo !== undefined || invoice !== undefined) {
      grn.supplierInvoiceNo = supplierInvoiceNo || invoice || '';
      grn.invoice = supplierInvoiceNo || invoice || '';
    }
    if (paidBy !== undefined) grn.paidBy = paidBy;
    if (masterPo !== undefined) grn.masterPo = masterPo;
    if (useBarcode !== undefined) grn.useBarcode = Boolean(useBarcode);
    if (remark !== undefined) grn.remark = remark;
    if (date !== undefined) grn.date = grnDate;

    grn.lineItems = processedLineItems;
    grn.grnValue = totalGrnValue;
    grn.totalValue = totalGrnValue;
    grn.isPosted = targetPosted;

    await grn.save();

    let msg = `GRN '${grn.grnNumber}' updated successfully`;
    if (!wasPosted && targetPosted) {
      msg = `GRN '${grn.grnNumber}' posted and stock updated successfully`;
    } else if (wasPosted && targetPosted) {
      msg = `GRN '${grn.grnNumber}' updated and stock reconciled successfully`;
    }

    return res.status(200).json({
      success: true,
      message: msg,
      data: grn,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Post a GRN to stock (Action: Update/Post)
 * Updates stock exactly once. If already posted, prevents duplicate stock increase.
 */
export const postGrn = async (req, res, next) => {
  try {
    const { id } = req.params;
    let grn = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      grn = await Grn.findById(id);
    }
    if (!grn) {
      grn = await Grn.findOne({ grnNumber: String(id).trim() });
    }

    if (!grn) {
      return res.status(404).json({
        success: false,
        message: `GRN '${id}' not found`,
      });
    }

    // Idempotency: Prevent duplicate stock additions
    if (grn.isPosted) {
      return res.status(200).json({
        success: true,
        message: `GRN '${grn.grnNumber}' is already posted. Stock was not modified.`,
        data: grn,
      });
    }

    // Apply atomic stock updates for each item in the GRN
    const formattedDateStr = new Date(grn.date || Date.now()).toISOString().split('T')[0];
    const itemsMap = aggregateGrnItemsByCode(grn.lineItems);
    for (const [code, { quantity: qty, line }] of itemsMap.entries()) {
      await Item.updateOne(
        { code },
        {
          $inc: { quantity: qty, stockInHand: qty },
          $set: {
            lastGrnPrice: line.unitPrice,
            lastGrn: formattedDateStr,
            lastGrnDate: formattedDateStr,
          },
        }
      );
    }

    grn.isPosted = true;
    await grn.save();

    return res.status(200).json({
      success: true,
      message: `GRN '${grn.grnNumber}' posted and stock updated successfully`,
      data: grn,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reverse or Cancel a GRN safely and idempotently
 */
export const reverseGrn = async (req, res, next) => {
  try {
    const { id } = req.params;
    let grn = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      grn = await Grn.findById(id);
    }
    if (!grn) {
      grn = await Grn.findOne({ grnNumber: String(id).trim() });
    }

    if (!grn) {
      return res.status(404).json({
        success: false,
        message: `GRN '${id}' not found`,
      });
    }

    if (grn.status === 'cancelled' || !grn.isPosted) {
      return res.status(200).json({
        success: true,
        message: `GRN '${grn.grnNumber}' is already cancelled/reversed or unposted. Stock was not modified.`,
        data: grn,
      });
    }

    // If posted, reverse the stock addition exactly once
    if (grn.isPosted && Array.isArray(grn.lineItems)) {
      const itemsMap = aggregateGrnItemsByCode(grn.lineItems);
      for (const [code, { quantity: qty }] of itemsMap.entries()) {
        await Item.updateOne(
          { code },
          { $inc: { quantity: -qty, stockInHand: -qty } }
        );
      }
      grn.isPosted = false;
    }

    grn.status = 'cancelled';
    await grn.save();

    return res.status(200).json({
      success: true,
      message: `GRN '${grn.grnNumber}' cancelled/reversed and stock adjusted successfully`,
      data: grn,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a GRN and safely revert stock if previously posted
 */
export const deleteGrn = async (req, res, next) => {
  try {
    const { id } = req.params;
    let grn = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      grn = await Grn.findById(id);
    }
    if (!grn) {
      grn = await Grn.findOne({ grnNumber: String(id).trim() });
    }

    if (!grn) {
      return res.status(404).json({
        success: false,
        message: `GRN '${id}' not found`,
      });
    }

    // Revert stock adjustments if posted
    if (grn.isPosted && Array.isArray(grn.lineItems)) {
      const itemsMap = aggregateGrnItemsByCode(grn.lineItems);
      for (const [code, { quantity: qty }] of itemsMap.entries()) {
        await Item.updateOne(
          { code },
          { $inc: { quantity: -qty, stockInHand: -qty } }
        );
      }
      grn.isPosted = false;
    }

    await Grn.findByIdAndDelete(grn._id);

    return res.status(200).json({
      success: true,
      message: `GRN '${grn.grnNumber}' deleted and stock reverted successfully`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get GRN Item History for a specific item code
 * Returns real historical GRN records containing this item, sorted newest first.
 * Includes header and line details:
 * - GRN Number, GRN Date, Supplier, Supplier Invoice Number
 * - Item Code, Description, Purchase Price, Selling Price, Quantity Received, Discount, Line Value, Location, Status
 * Strictly read-only: does NOT modify stock, purchase prices, or supplier balances.
 */
export const getItemGrnHistory = async (req, res, next) => {
  try {
    const { code } = req.params;
    const { location } = req.query;

    if (!code || code.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Item code is required',
      });
    }

    const trimmedCode = code.trim();
    const regex = new RegExp('^' + trimmedCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');

    // 1. Fetch item master record to obtain fresh closing stock and details
    const itemDoc = await Item.findOne({ code: regex }).lean();

    // 2. Query all GRNs containing this item in lineItems
    const grnQuery = {
      $or: [
        { 'lineItems.code': regex },
        { 'lineItems.itemCode': regex },
      ],
    };

    const matchingGrns = await Grn.find(grnQuery)
      .sort({ date: -1, createdAt: -1, no: -1 })
      .lean();

    // 3. Extract matching line items with header context
    const history = [];

    for (const grn of matchingGrns) {
      if (!Array.isArray(grn.lineItems)) continue;

      for (const li of grn.lineItems) {
        const lineCode = (li.code || li.itemCode || '').trim();
        if (lineCode.toLowerCase() === trimmedCode.toLowerCase()) {
          const loc = li.locationCode || 'Main Store';

          // Optional location filtering if provided and not 'all'
          if (location && location.trim() && location.trim().toLowerCase() !== 'all') {
            if (loc.toLowerCase() !== location.trim().toLowerCase()) {
              continue;
            }
          }

          const unitPrice = li.unitPrice !== undefined
            ? Number(li.unitPrice)
            : (li.price !== undefined ? Number(li.price) : Number(li.rate || 0));
          const qty = li.quantity !== undefined ? Number(li.quantity) : Number(li.qty || 0);
          const disc = li.discount !== undefined ? Number(li.discount) : 0;
          const val = li.value !== undefined
            ? Number(li.value)
            : (li.totalValue !== undefined ? Number(li.totalValue) : (unitPrice * qty));
          const sellPrice = li.sellingPrice !== undefined ? Number(li.sellingPrice) : 0;

          const suppCode = grn.supplierCode || grn.supplier || '';
          const suppName = grn.supplierName || '';
          const suppDisplay = suppCode && suppName
            ? `${suppCode} - ${suppName}`
            : (suppCode || suppName || '-');

          history.push({
            grnId: grn._id,
            grnNumber: grn.grnNumber || (grn.no !== undefined ? String(grn.no) : ''),
            no: grn.no,
            date: grn.date || grn.createdAt,
            supplierCode: suppCode,
            supplierName: suppName,
            supplier: suppDisplay,
            supplierInvoiceNo: grn.supplierInvoiceNo || grn.invoice || '',
            code: lineCode,
            description: li.description || (itemDoc ? itemDoc.description : ''),
            price: unitPrice,
            purchasePrice: unitPrice,
            sellPrice: sellPrice,
            sellingPrice: sellPrice,
            quantity: qty,
            discount: disc,
            value: val,
            location: loc,
            isPosted: Boolean(grn.isPosted),
            status: grn.isPosted ? 'Posted' : 'Draft',
          });
        }
      }
    }

    // Sort newest first by date, then createdAt, then no
    history.sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return (b.no || 0) - (a.no || 0);
    });

    // 4. Compute summary values for bottom fields
    const latestRecord = history[0] || null;
    const currentStock = itemDoc
      ? (itemDoc.quantity !== undefined ? itemDoc.quantity : (itemDoc.stockInHand || 0))
      : 0;
    const currentLocation = itemDoc?.location || 'Main Store';
    const lpc = latestRecord
      ? latestRecord.price
      : (itemDoc ? (itemDoc.lastGrnPrice || itemDoc.averageCost || 0) : 0);
    const lastGrnInfo = latestRecord
      ? `${latestRecord.grnNumber}${latestRecord.date ? ' (' + new Date(latestRecord.date).toISOString().split('T')[0] + ')' : ''}`
      : (itemDoc?.lastGrn || itemDoc?.lastGrnDate || '-');

    return res.status(200).json({
      success: true,
      data: {
        item: itemDoc,
        history,
        totalReceipts: history.length,
        summary: {
          closingStock: currentStock,
          location: currentLocation,
          lastGrn: lastGrnInfo,
          lpc: Number(lpc).toFixed(2),
          latestGrnNumber: latestRecord ? latestRecord.grnNumber : '',
          latestGrnDate: latestRecord ? latestRecord.date : null,
          isPosted: latestRecord ? latestRecord.isPosted : false,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

