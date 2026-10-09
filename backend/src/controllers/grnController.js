import mongoose from 'mongoose';
import Grn from '../models/Grn.js';
import Item from '../models/Item.js';
import Supplier from '../models/Supplier.js';

/**
 * Format GRN number with zero padding (e.g., no: 7, padding: 4 -> GRN-0007)
 */
const formatGrnNumber = (num, padding = 4, prefix = 'GRN') => {
  const padded = String(num).padStart(padding, '0');
  return `${prefix}-${padded}`;
};

/**
 * Get next available GRN Number and sequence number
 */
export const getNextGrnNumber = async (req, res, next) => {
  try {
    const db = mongoose.connection.db;

    // Check docnumbers collection
    let nextNo = 1;
    let padding = 4;
    let prefix = 'GRN';

    const docNum = await db.collection('docnumbers').findOne({ docType: 'GRN' });
    if (docNum && docNum.currentNumber !== undefined) {
      nextNo = Number(docNum.currentNumber) + 1;
      padding = docNum.padding || 4;
      prefix = docNum.prefix || 'GRN';
    } else {
      // Fallback: Check highest no in grns
      const latestGrn = await Grn.findOne().sort({ no: -1, createdAt: -1 });
      if (latestGrn && latestGrn.no) {
        nextNo = Number(latestGrn.no) + 1;
      }
    }

    const grnNumber = formatGrnNumber(nextNo, padding, prefix);

    return res.status(200).json({
      success: true,
      data: {
        no: nextNo,
        grnNumber,
        padding,
        prefix,
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
      grn = await Grn.findOne({ grnNumber: id.trim() });
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
 * Create and post a new GRN, and automatically update item stock quantities & last GRN prices
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
      isPosted = true,
    } = req.body;

    if (!supplierCode || supplierCode.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Supplier code is required',
      });
    }

    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required in the GRN',
      });
    }

    // Determine sequence number and GRN number
    let finalNo = no;
    let finalGrnNumber = providedGrnNumber;

    if (!finalNo || !finalGrnNumber) {
      const docNum = await db.collection('docnumbers').findOne({ docType: 'GRN' });
      let nextNo = 1;
      let padding = 4;
      let prefix = 'GRN';

      if (docNum && docNum.currentNumber !== undefined) {
        nextNo = Number(docNum.currentNumber) + 1;
        padding = docNum.padding || 4;
        prefix = docNum.prefix || 'GRN';
      } else {
        const latestGrn = await Grn.findOne().sort({ no: -1, createdAt: -1 });
        if (latestGrn && latestGrn.no) {
          nextNo = Number(latestGrn.no) + 1;
        }
      }

      finalNo = finalNo || nextNo;
      finalGrnNumber = finalGrnNumber || formatGrnNumber(nextNo, padding, prefix);
    }

    // Lookup supplier name if not provided
    let resolvedSupplierName = supplierName || '';
    if (!resolvedSupplierName) {
      const supp = await Supplier.findOne({ code: supplierCode.trim() });
      if (supp) {
        resolvedSupplierName = supp.name;
      }
    }

    // Calculate line items totals
    let totalGrnValue = 0;
    const processedLineItems = lineItems.map((item) => {
      const code = item.code || item.itemCode || '';
      const qty = parseFloat(item.quantity || item.qty) || 0;
      const unitPrice = parseFloat(item.unitPrice || item.price || item.rate) || 0;
      const sellingPrice = parseFloat(item.sellingPrice || item.sellPrice) || 0;
      const discount = parseFloat(item.discount) || 0;
      const value = Math.max(0, qty * unitPrice - discount);

      totalGrnValue += value;

      return {
        code,
        itemCode: code,
        description: item.description || '',
        quantity: qty,
        qty: qty,
        unitPrice,
        rate: unitPrice,
        sellingPrice,
        discount,
        totalValue: value,
        value: value,
        locationCode: item.locationCode || 'MAIN',
      };
    });

    const grnDate = date ? new Date(date) : new Date();
    const formattedDateStr = grnDate.toISOString().split('T')[0];

    // Create GRN record
    const newGrn = new Grn({
      no: finalNo,
      grnNumber: finalGrnNumber,
      supplierCode: supplierCode.trim(),
      supplier: supplierCode.trim(),
      supplierName: resolvedSupplierName,
      supplierInvoiceNo: supplierInvoiceNo || invoice || '',
      invoice: supplierInvoiceNo || invoice || '',
      paidBy,
      masterPo,
      useBarcode: Boolean(useBarcode),
      lineItems: processedLineItems,
      grnValue: totalGrnValue,
      totalValue: totalGrnValue,
      setValue: 0,
      returnValue: 0,
      isPosted: Boolean(isPosted),
      paymentStatus: 'pending',
      date: grnDate,
      remark,
    });

    await newGrn.save();

    // Update docnumbers sequence
    await db.collection('docnumbers').updateOne(
      { docType: 'GRN' },
      { $set: { currentNumber: finalNo } },
      { upsert: true }
    );

    // If posted, update stock in items collection
    if (newGrn.isPosted) {
      for (const line of processedLineItems) {
        if (!line.code) continue;

        const existingItem = await Item.findOne({ code: line.code.trim() });
        if (existingItem) {
          const currentQty = Number(existingItem.quantity || existingItem.stockInHand) || 0;
          const newQty = currentQty + line.quantity;

          existingItem.quantity = newQty;
          existingItem.stockInHand = newQty;
          existingItem.lastGrnPrice = line.unitPrice;
          existingItem.lastGrn = formattedDateStr;

          if (line.sellingPrice && line.sellingPrice > 0) {
            existingItem.sellingPrice = line.sellingPrice;
          }

          await existingItem.save();
        }
      }
    }

    return res.status(201).json({
      success: true,
      message: `GRN '${newGrn.grnNumber}' saved and stock updated successfully`,
      data: newGrn,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A GRN with this number already exists',
      });
    }
    next(error);
  }
};

/**
 * Update an existing GRN and adjust stock accordingly
 */
export const updateGrn = async (req, res, next) => {
  try {
    const { id } = req.params;
    let grn = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      grn = await Grn.findById(id);
    }
    if (!grn) {
      grn = await Grn.findOne({ grnNumber: id.trim() });
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
    } = req.body;

    // If previous GRN was posted, revert previous item stock quantities
    if (grn.isPosted && Array.isArray(grn.lineItems)) {
      for (const oldLine of grn.lineItems) {
        if (!oldLine.code) continue;
        const item = await Item.findOne({ code: oldLine.code.trim() });
        if (item) {
          const currentQty = Number(item.quantity || item.stockInHand) || 0;
          const revertedQty = Math.max(0, currentQty - (oldLine.quantity || 0));
          item.quantity = revertedQty;
          item.stockInHand = revertedQty;
          await item.save();
        }
      }
    }

    // Process new line items
    let totalGrnValue = 0;
    const processedLineItems = lineItems.map((item) => {
      const code = item.code || item.itemCode || '';
      const qty = parseFloat(item.quantity || item.qty) || 0;
      const unitPrice = parseFloat(item.unitPrice || item.price || item.rate) || 0;
      const sellingPrice = parseFloat(item.sellingPrice || item.sellPrice) || 0;
      const discount = parseFloat(item.discount) || 0;
      const value = Math.max(0, qty * unitPrice - discount);

      totalGrnValue += value;

      return {
        code,
        itemCode: code,
        description: item.description || '',
        quantity: qty,
        qty: qty,
        unitPrice,
        rate: unitPrice,
        sellingPrice,
        discount,
        totalValue: value,
        value: value,
        locationCode: item.locationCode || 'MAIN',
      };
    });

    const grnDate = date ? new Date(date) : grn.date;
    const formattedDateStr = new Date(grnDate).toISOString().split('T')[0];

    // Update GRN fields
    if (supplierCode !== undefined) {
      grn.supplierCode = supplierCode.trim();
      grn.supplier = supplierCode.trim();
    }
    if (supplierName !== undefined) grn.supplierName = supplierName;
    if (supplierInvoiceNo !== undefined || invoice !== undefined) {
      grn.supplierInvoiceNo = supplierInvoiceNo || invoice;
      grn.invoice = supplierInvoiceNo || invoice;
    }
    if (paidBy !== undefined) grn.paidBy = paidBy;
    if (masterPo !== undefined) grn.masterPo = masterPo;
    if (useBarcode !== undefined) grn.useBarcode = Boolean(useBarcode);
    if (remark !== undefined) grn.remark = remark;
    if (date !== undefined) grn.date = grnDate;

    grn.lineItems = processedLineItems;
    grn.grnValue = totalGrnValue;
    grn.totalValue = totalGrnValue;

    await grn.save();

    // Re-apply stock updates for the updated line items
    if (grn.isPosted) {
      for (const line of processedLineItems) {
        if (!line.code) continue;
        const item = await Item.findOne({ code: line.code.trim() });
        if (item) {
          const currentQty = Number(item.quantity || item.stockInHand) || 0;
          const newQty = currentQty + line.quantity;
          item.quantity = newQty;
          item.stockInHand = newQty;
          item.lastGrnPrice = line.unitPrice;
          item.lastGrn = formattedDateStr;

          if (line.sellingPrice && line.sellingPrice > 0) {
            existingItem.sellingPrice = line.sellingPrice;
          }

          await item.save();
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `GRN '${grn.grnNumber}' updated successfully`,
      data: grn,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a GRN and revert stock adjustments
 */
export const deleteGrn = async (req, res, next) => {
  try {
    const { id } = req.params;
    let grn = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      grn = await Grn.findById(id);
    }
    if (!grn) {
      grn = await Grn.findOne({ grnNumber: id.trim() });
    }

    if (!grn) {
      return res.status(404).json({
        success: false,
        message: `GRN '${id}' not found`,
      });
    }

    // Revert stock adjustments if posted
    if (grn.isPosted && Array.isArray(grn.lineItems)) {
      for (const line of grn.lineItems) {
        if (!line.code) continue;
        const item = await Item.findOne({ code: line.code.trim() });
        if (item) {
          const currentQty = Number(item.quantity || item.stockInHand) || 0;
          const revertedQty = Math.max(0, currentQty - (line.quantity || 0));
          item.quantity = revertedQty;
          item.stockInHand = revertedQty;
          await item.save();
        }
      }
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
