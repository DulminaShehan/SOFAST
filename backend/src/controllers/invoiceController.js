import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Item from '../models/Item.js';
import Customer from '../models/Customer.js';
import Settlement from '../models/Settlement.js';
import { syncCustomerOutstandingBalance } from './customerController.js';
import { findItemMasterRecord } from './grnController.js';

/**
 * Helper to compute the next sequential 4-digit invoice number starting from 0001 (e.g. 0001, 0002, ...)
 */
export const computeNextInvoiceNumber = async (db) => {
  const docNum = await db.collection('docnumbers').findOne({ docType: 'INV' });

  // Find all existing 4-digit invoices in collection
  const existing4Digit = await Invoice.find(
    { invoiceNumber: { $regex: /^\d{4}$/ } },
    { invoiceNumber: 1, no: 1 }
  ).lean();

  const maxExisting = existing4Digit.length > 0
    ? Math.max(
        ...existing4Digit
          .map((i) => parseInt(i.invoiceNumber || i.no, 10))
          .filter((n) => !isNaN(n))
      )
    : 0;

  let docCurrent =
    docNum && Number(docNum.currentNumber) !== undefined && Number(docNum.currentNumber) < 10000
      ? Number(docNum.currentNumber)
      : maxExisting;

  // Reset docnumbers if old legacy/test number was >= 10000
  if (docNum && Number(docNum.currentNumber) >= 10000) {
    await db.collection('docnumbers').updateOne(
      { docType: 'INV' },
      { $set: { currentNumber: maxExisting, padding: 4 } },
      { upsert: true }
    );
  }

  let nextNo = Math.max(docCurrent, maxExisting) + 1;
  if (nextNo < 1) nextNo = 1;

  let candidateInvoiceNumber = String(nextNo).padStart(4, '0');
  while (await Invoice.findOne({ invoiceNumber: candidateInvoiceNumber })) {
    nextNo++;
    candidateInvoiceNumber = String(nextNo).padStart(4, '0');
  }

  return {
    no: nextNo,
    invoiceNumber: candidateInvoiceNumber,
  };
};

/**
 * Get next sequential invoice number from MongoDB docnumbers and invoices (0001, 0002, ...)
 */
export const getNextInvoiceNumber = async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    const { no, invoiceNumber } = await computeNextInvoiceNumber(db);

    return res.status(200).json({
      success: true,
      data: {
        no,
        invoiceNumber,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get list of invoices with search, filter, and pagination
 */
export const getInvoices = async (req, res, next) => {
  try {
    const { search, status, limit = 100, page = 1 } = req.query;
    const query = {};

    if (status && status !== 'all') {
      if (status === 'hold') {
        query.$or = [{ isHold: true }, { status: 'hold' }];
      } else if (status === 'completed') {
        query.$and = [{ isHold: { $ne: true } }, { status: { $ne: 'hold' } }];
      }
    }

    if (search && search.trim() !== '') {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { invoiceNumber: regex },
        { customerCode: regex },
        { cuscode: regex },
        { customerName: regex },
        { cusname: regex },
        { chequeNo: regex },
        { bank: regex },
        { remark: regex },
      ];
    }

    const parsedLimit = Math.min(Math.max(1, parseInt(limit, 10) || 100), 1000);
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const skip = (parsedPage - 1) * parsedLimit;

    const [invoices, total] = await Promise.all([
      Invoice.find(query).sort({ createdAt: -1, no: -1 }).skip(skip).limit(parsedLimit).lean(),
      Invoice.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: invoices,
      total,
      page: parsedPage,
      totalPages: Math.ceil(total / parsedLimit),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single invoice by ID or Invoice Number
 */
export const getInvoiceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    let invoice = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      invoice = await Invoice.findById(id).lean();
    }
    if (!invoice) {
      const trimmed = id.trim();
      const padded = /^\d{1,4}$/.test(trimmed) ? trimmed.padStart(4, '0') : trimmed;
      const numVal = parseInt(trimmed, 10);

      invoice = await Invoice.findOne({
        $or: [
          { invoiceNumber: trimmed },
          { invoiceNumber: padded },
          ...(isNaN(numVal) ? [] : [{ no: numVal }]),
        ],
      }).lean();
    }

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: `Invoice '${id}' not found`,
      });
    }

    return res.status(200).json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper to aggregate line items by item code to ensure unique quantities per item
 */
export const aggregateItemsByCode = (lines) => {
  const map = new Map();
  if (!Array.isArray(lines)) return map;
  for (const line of lines) {
    if (line.jobType === 'Labour' || line.type === 'Labour' || line.isService === true || line.isService === 'true') {
      continue;
    }
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
 * Create and Save a new Invoice, updating stock atomically if completed
 */
export const createInvoice = async (req, res, next) => {
  let appliedDeductions = [];
  try {
    const db = mongoose.connection.db;
    const {
      no: providedNo,
      invoiceNumber: providedInvoiceNumber,
      date,
      customerCode = '',
      customerName = '',
      customerAddress = '',
      customerTelephone = '',
      jobType = 'Material',
      jd = 'Invoice',
      isHold = false,
      status: reqStatus,
      remark = '',
      note = '',
      lineItems = [],
      specialDiscount = 0,
      paymentMethod = 'Cash',
      paidBy = 'Cash',
      customerPaidAmount,
      amountReceived,
      paidAmount,
      chequeNo = '',
      bank = '',
      dateRealized = '',
    } = req.body;

    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required in the invoice',
      });
    }

    // Determine sequential invoice number (starting at 0001, 0002, ...)
    let finalNo = providedNo;
    let finalInvoiceNumber = providedInvoiceNumber;

    if (!finalNo || !finalInvoiceNumber) {
      const nextData = await computeNextInvoiceNumber(db);
      finalNo = nextData.no;
      finalInvoiceNumber = nextData.invoiceNumber;
    } else {
      finalInvoiceNumber = String(finalInvoiceNumber).trim();
      if (/^\d{1,4}$/.test(finalInvoiceNumber)) {
        finalInvoiceNumber = finalInvoiceNumber.padStart(4, '0');
      }
      if (!finalNo) {
        finalNo = parseInt(finalInvoiceNumber, 10) || 1;
      }
    }

    // Lookup customer name/address/telephone if not provided
    let finalCusName = customerName;
    let finalCusAddress = customerAddress;
    let finalCusTelephone = customerTelephone || req.body.telephone || '';
    if (customerCode && (!finalCusName || !finalCusAddress || !finalCusTelephone)) {
      const cus = await Customer.findOne({
        $or: [{ code: customerCode.trim() }, { customerCode: customerCode.trim() }],
      }).lean();
      if (cus) {
        if (!finalCusName) finalCusName = cus.name || '';
        if (!finalCusAddress) finalCusAddress = cus.address || '';
        if (!finalCusTelephone) finalCusTelephone = cus.telephone1 || cus.telephone || '';
      }
    }

    // Process line items and compute pricing
    let calculatedSubTotal = 0;
    const processedLineItems = [];
    for (const item of lineItems) {
      const isLabour = item.jobType === 'Labour' || item.type === 'Labour' || item.isService === true || item.isService === 'true';
      const code = (item.code || item.itemCode || (isLabour ? 'DELIVERY' : '')).trim();
      const qty = Math.max(0.01, parseFloat(item.quantity || item.qty) || 1);
      let price = parseFloat(item.price || item.unitPrice || item.rate) || 0;

      // If price not explicitly supplied, lookup item's configured customer selling price (Material items only)
      if (!isLabour && price <= 0 && code) {
        const dbItem = await Item.findOne({
          $or: [{ code }, { barcode: code }, { barCode: code }],
        }).lean();
        if (dbItem) {
          price = dbItem.finalSellingPrice !== undefined && Number(dbItem.finalSellingPrice) > 0
            ? Number(dbItem.finalSellingPrice)
            : (Number(dbItem.sellingPrice) || 0);
        }
      }

      const rate = parseFloat(item.rate || price) || price;
      let discPct = isLabour ? 0 : (parseFloat(item.discountPercentage) || 0);
      let discAmt = isLabour ? 0 : (parseFloat(item.discountAmount) || 0);

      if (discPct > 0 && (!discAmt || discAmt === 0)) {
        discAmt = (price * discPct) / 100 * qty;
      } else if (discAmt > 0 && (!discPct || discPct === 0) && price > 0) {
        discPct = (discAmt / (price * qty)) * 100;
      }

      const gross = price * qty;
      const lineVal = Math.max(0, gross - discAmt);
      calculatedSubTotal += lineVal;

      processedLineItems.push({
        code,
        itemCode: code,
        description: item.description || (isLabour ? 'Delivery Charge' : ''),
        jobType: isLabour ? 'Labour' : (item.jobType || 'Material'),
        type: isLabour ? 'Labour' : (item.type || 'Material'),
        isService: isLabour,
        location: isLabour ? '-' : (item.location || 'Main Store'),
        quantity: qty,
        qty: qty,
        masterPack: String(item.masterPack || '1'),
        rateType: item.rateType || 'Retail',
        rate,
        price,
        unitPrice: price,
        itemCost: isLabour ? 0 : (parseFloat(item.itemCost) || 0),
        mpCost: isLabour ? 0 : (parseFloat(item.mpCost) || 0),
        discountPercentage: Math.round(discPct * 100) / 100,
        discountAmount: Math.round(discAmt * 100) / 100,
        value: Math.round(lineVal * 100) / 100,
        total: Math.round(lineVal * 100) / 100,
        balance: isLabour ? 0 : (parseFloat(item.balance) || 0),
        availableQty: isLabour ? 0 : (parseFloat(item.availableQty) !== undefined && !isNaN(parseFloat(item.availableQty))
          ? parseFloat(item.availableQty)
          : parseFloat(item.balance) || 0),
        finalPrice: parseFloat(item.finalPrice) !== undefined && !isNaN(parseFloat(item.finalPrice))
          ? parseFloat(item.finalPrice)
          : Math.round(lineVal * 100) / 100,
        lastGrn: isLabour ? '' : (item.lastGrn ? String(item.lastGrn).trim() : ''),
        lastGrnDate: isLabour ? '' : (item.lastGrnDate ? String(item.lastGrnDate).trim() : ''),
      });
    }

    const resolvedPaymentMethod = paymentMethod || paidBy || 'Cash';
    const specDisc = Math.max(0, parseFloat(specialDiscount) || 0);
    const amountToPay = Math.max(0, calculatedSubTotal - specDisc);

    // Customer Paid amount (can exceed amountToPay, e.g. Customer gives 5000 for 4500 bill)
    const rawCustomerPaid = customerPaidAmount !== undefined && customerPaidAmount !== ''
      ? parseFloat(customerPaidAmount)
      : (amountReceived !== undefined && amountReceived !== ''
          ? parseFloat(amountReceived)
          : (paidAmount !== undefined ? parseFloat(paidAmount) : 0));
    const customerPaid = Math.max(0, isNaN(rawCustomerPaid) ? 0 : rawCustomerPaid);

    // Amount actually received towards the invoice (strictly capped at amountToPay; change is NOT additional revenue!)
    const actualReceived = Math.min(customerPaid, amountToPay);
    const changeGiven = Math.max(0, customerPaid - amountToPay);
    const calculatedDueAmount = Math.max(0, amountToPay - actualReceived);
    const paymentStatus = calculatedDueAmount === 0 ? 'paid' : (actualReceived > 0 ? 'partial' : 'unpaid');

    const holdStatus = Boolean(isHold);
    const invStatus = holdStatus ? 'hold' : (reqStatus || 'completed');
    const isCompleted = !holdStatus;
    const isStockUpdated = isCompleted;

    // Stock validation & atomic deduction ONLY if invoice is completed (not on hold)
    if (isStockUpdated) {
      const itemsMap = aggregateItemsByCode(processedLineItems);

      // Pre-validation: Verify sufficient stock for all items
      for (const [code, { quantity: requiredQty }] of itemsMap.entries()) {
        const item = await findItemMasterRecord(code);
        if (!item) {
          return res.status(400).json({
            success: false,
            message: `Item code '${code}' does not exist in Item Master`,
          });
        }
        const available = Number(item.quantity !== undefined ? item.quantity : (item.stockInHand || 0)) || 0;
        if (available < requiredQty) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for item '${code}' (${item.description || ''}). Available: ${available}, Required: ${requiredQty}`,
          });
        }
      }

      // Atomic deduction with rollback on failure
      for (const [code, { quantity: qtyToDeduct }] of itemsMap.entries()) {
        const item = await findItemMasterRecord(code);
        const updateRes = await Item.updateOne(
          { _id: item._id, quantity: { $gte: qtyToDeduct } },
          { $inc: { quantity: -qtyToDeduct, stockInHand: -qtyToDeduct } }
        );
        if (updateRes.matchedCount === 0 || updateRes.modifiedCount === 0) {
          for (const rolled of appliedDeductions) {
            await Item.updateOne(
              { _id: rolled.id },
              { $inc: { quantity: rolled.qty, stockInHand: rolled.qty } }
            );
          }
          appliedDeductions = [];
          return res.status(400).json({
            success: false,
            message: `Concurrent stock change detected for item '${code}'. Insufficient stock to complete sale.`,
          });
        }
        appliedDeductions.push({ id: item._id, code: item.code, qty: qtyToDeduct });
      }
    }

    const newInvoice = new Invoice({
      no: Number(finalNo),
      invoiceNumber: String(finalInvoiceNumber),
      date: date ? new Date(date) : new Date(),
      customerCode: customerCode.trim(),
      cuscode: customerCode.trim(),
      customerName: finalCusName,
      cusname: finalCusName,
      customerAddress: finalCusAddress,
      customerTelephone: finalCusTelephone,
      telephone: finalCusTelephone,
      jobType,
      jd,
      isHold: holdStatus,
      remark: (note || remark || '').trim(),
      note: (note || remark || '').trim(),
      lineItems: processedLineItems,
      subTotal: Math.round(calculatedSubTotal * 100) / 100,
      specialDiscount: specDisc,
      amountToPay: Math.round(amountToPay * 100) / 100,
      netTotal: Math.round(amountToPay * 100) / 100,
      value: Math.round(amountToPay * 100) / 100,
      paymentMethod: resolvedPaymentMethod,
      paidBy: resolvedPaymentMethod,
      customerPaidAmount: customerPaid,
      amountReceived: actualReceived,
      cashReceived: resolvedPaymentMethod === 'Cash' ? actualReceived : 0,
      paidAmount: actualReceived,
      balance: changeGiven,
      chequeNo,
      bank,
      dateRealized,
      dueAmount: Math.round(calculatedDueAmount * 100) / 100,
      paymentStatus,
      isSettled: calculatedDueAmount === 0,
      settlementRef: req.body.settlementRef || '',
      settlementStatus: req.body.settlementStatus || '',
      isStockUpdated,
      isCompleted,
    });

    try {
      await newInvoice.save();
    } catch (saveError) {
      // Rollback applied stock deductions if database save fails
      for (const rolled of appliedDeductions) {
        await Item.updateOne(
          { _id: rolled.id },
          { $inc: { quantity: rolled.qty, stockInHand: rolled.qty } }
        );
      }
      throw saveError;
    }

    // Update docnumbers sequence for 4-digit sequential invoice numbers
    const numericInvNo = parseInt(finalInvoiceNumber, 10);
    if (!isNaN(numericInvNo) && numericInvNo > 0 && numericInvNo < 10000) {
      const docNum = await db.collection('docnumbers').findOne({ docType: 'INV' });
      if (docNum && Number(docNum.currentNumber) >= 10000) {
        await db.collection('docnumbers').updateOne(
          { docType: 'INV' },
          { $set: { currentNumber: numericInvNo, padding: 4 } },
          { upsert: true }
        );
      } else {
        await db.collection('docnumbers').updateOne(
          { docType: 'INV' },
          { $max: { currentNumber: numericInvNo }, $set: { padding: 4 } },
          { upsert: true }
        );
      }
    }

    // Sync customer outstanding balance for credit / partial payments
    if (customerCode && customerCode.trim()) {
      await syncCustomerOutstandingBalance(customerCode);
    }

    return res.status(201).json({
      success: true,
      message: `Invoice '${newInvoice.invoiceNumber}' ${holdStatus ? 'saved on HOLD' : 'created and stock updated'} successfully`,
      data: newInvoice,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'An invoice with this number already exists',
      });
    }
    next(error);
  }
};

/**
 * Update an existing Invoice and manage stock differences safely and idempotently
 */
export const updateInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    let invoice = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      invoice = await Invoice.findById(id);
    }
    if (!invoice) {
      const trimmed = id.trim();
      const padded = /^\d{1,4}$/.test(trimmed) ? trimmed.padStart(4, '0') : trimmed;
      invoice = await Invoice.findOne({
        $or: [{ invoiceNumber: trimmed }, { invoiceNumber: padded }],
      });
    }

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: `Invoice '${id}' not found`,
      });
    }

    const {
      date,
      customerCode,
      customerName,
      customerAddress,
      jobType,
      jd,
      isHold,
      status: reqStatus,
      remark,
      note,
      lineItems = [],
      specialDiscount,
      paymentMethod,
      paidBy,
      customerPaidAmount,
      amountReceived,
      paidAmount,
      chequeNo,
      bank,
      dateRealized,
    } = req.body;

    // Process updated line items
    let calculatedSubTotal = 0;
    const processedLineItems = [];
    for (const item of lineItems) {
      const isLabour = item.jobType === 'Labour' || item.type === 'Labour' || item.isService === true || item.isService === 'true';
      const code = (item.code || item.itemCode || (isLabour ? 'DELIVERY' : '')).trim();
      const qty = Math.max(0.01, parseFloat(item.quantity || item.qty) || 1);
      let price = parseFloat(item.price || item.unitPrice || item.rate) || 0;

      // If price not explicitly supplied, lookup item's configured customer selling price (Material items only)
      if (!isLabour && price <= 0 && code) {
        const dbItem = await Item.findOne({
          $or: [{ code }, { barcode: code }, { barCode: code }],
        }).lean();
        if (dbItem) {
          price = dbItem.finalSellingPrice !== undefined && Number(dbItem.finalSellingPrice) > 0
            ? Number(dbItem.finalSellingPrice)
            : (Number(dbItem.sellingPrice) || 0);
        }
      }

      const rate = parseFloat(item.rate || price) || price;
      let discPct = isLabour ? 0 : (parseFloat(item.discountPercentage) || 0);
      let discAmt = isLabour ? 0 : (parseFloat(item.discountAmount) || 0);

      if (discPct > 0 && (!discAmt || discAmt === 0)) {
        discAmt = (price * discPct) / 100 * qty;
      } else if (discAmt > 0 && (!discPct || discPct === 0) && price > 0) {
        discPct = (discAmt / (price * qty)) * 100;
      }

      const gross = price * qty;
      const lineVal = Math.max(0, gross - discAmt);
      calculatedSubTotal += lineVal;

      processedLineItems.push({
        code,
        itemCode: code,
        description: item.description || (isLabour ? 'Delivery Charge' : ''),
        jobType: isLabour ? 'Labour' : (item.jobType || 'Material'),
        type: isLabour ? 'Labour' : (item.type || 'Material'),
        isService: isLabour,
        location: isLabour ? '-' : (item.location || 'Main Store'),
        quantity: qty,
        qty: qty,
        masterPack: String(item.masterPack || '1'),
        rateType: item.rateType || 'Retail',
        rate,
        price,
        unitPrice: price,
        itemCost: isLabour ? 0 : (parseFloat(item.itemCost) || 0),
        mpCost: isLabour ? 0 : (parseFloat(item.mpCost) || 0),
        discountPercentage: Math.round(discPct * 100) / 100,
        discountAmount: Math.round(discAmt * 100) / 100,
        value: Math.round(lineVal * 100) / 100,
        total: Math.round(lineVal * 100) / 100,
        balance: isLabour ? 0 : (parseFloat(item.balance) || 0),
        availableQty: isLabour ? 0 : (parseFloat(item.availableQty) !== undefined && !isNaN(parseFloat(item.availableQty))
          ? parseFloat(item.availableQty)
          : parseFloat(item.balance) || 0),
        finalPrice: parseFloat(item.finalPrice) !== undefined && !isNaN(parseFloat(item.finalPrice))
          ? parseFloat(item.finalPrice)
          : Math.round(lineVal * 100) / 100,
        lastGrn: isLabour ? '' : (item.lastGrn ? String(item.lastGrn).trim() : ''),
        lastGrnDate: isLabour ? '' : (item.lastGrnDate ? String(item.lastGrnDate).trim() : ''),
      });
    }

    const resolvedPaymentMethod =
      paymentMethod || paidBy || invoice.paymentMethod || invoice.paidBy || 'Cash';
    const specDisc = specialDiscount !== undefined
      ? Math.max(0, parseFloat(specialDiscount) || 0)
      : (invoice.specialDiscount || 0);
    const amountToPay = Math.max(0, calculatedSubTotal - specDisc);

    const rawCustomerPaid = customerPaidAmount !== undefined && customerPaidAmount !== ''
      ? parseFloat(customerPaidAmount)
      : (amountReceived !== undefined && amountReceived !== ''
          ? parseFloat(amountReceived)
          : (paidAmount !== undefined
              ? parseFloat(paidAmount)
              : (invoice.customerPaidAmount !== undefined
                  ? invoice.customerPaidAmount
                  : invoice.amountReceived)));
    const customerPaid = Math.max(0, isNaN(rawCustomerPaid) ? 0 : rawCustomerPaid);

    // Amount actually received towards the invoice (strictly capped at amountToPay; change is NOT additional revenue!)
    const actualReceived = Math.min(customerPaid, amountToPay);
    const changeGiven = Math.max(0, customerPaid - amountToPay);
    const calculatedDueAmount = Math.max(0, amountToPay - actualReceived);
    const paymentStatus = calculatedDueAmount === 0 ? 'paid' : (actualReceived > 0 ? 'partial' : 'unpaid');

    const holdStatus = isHold !== undefined ? Boolean(isHold) : invoice.isHold;
    const invStatus = holdStatus ? 'hold' : (reqStatus || invoice.status || 'completed');
    const wasStockUpdated = Boolean(invoice.isStockUpdated && !invoice.isHold && invoice.status !== 'hold' && invoice.status !== 'cancelled');
    const targetStockUpdated = Boolean(!holdStatus && invStatus !== 'cancelled');

    // Safe Stock Reconciliation Workflow
    if (!wasStockUpdated && targetStockUpdated) {
      // Case A: Transition from Draft/Hold to Completed -> Deduct stock
      const newMap = aggregateItemsByCode(processedLineItems);

      // Pre-validation
      for (const [code, { quantity: requiredQty }] of newMap.entries()) {
        const itemDoc = await findItemMasterRecord(code);
        if (!itemDoc) {
          return res.status(400).json({
            success: false,
            message: `Item code '${code}' not found in Item Master`,
          });
        }
        const available = Number(itemDoc.quantity !== undefined ? itemDoc.quantity : (itemDoc.stockInHand || 0)) || 0;
        if (available < requiredQty) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for item '${code}'. Available: ${available}, Required: ${requiredQty}`,
          });
        }
      }

      for (const [code, { quantity: requiredQty }] of newMap.entries()) {
        const itemDoc = await findItemMasterRecord(code);
        if (itemDoc) {
          await Item.updateOne(
            { _id: itemDoc._id },
            { $inc: { quantity: -requiredQty, stockInHand: -requiredQty } }
          );
        }
      }
      invoice.isStockUpdated = true;
    } else if (wasStockUpdated && !targetStockUpdated) {
      // Case B: Transition from Completed to Draft/Hold/Cancelled -> Revert stock
      const oldMap = aggregateItemsByCode(invoice.lineItems);
      for (const [code, { quantity: oldQty }] of oldMap.entries()) {
        const itemDoc = await findItemMasterRecord(code);
        if (itemDoc) {
          await Item.updateOne(
            { _id: itemDoc._id },
            { $inc: { quantity: oldQty, stockInHand: oldQty } }
          );
        }
      }
      invoice.isStockUpdated = false;
    } else if (wasStockUpdated && targetStockUpdated) {
      // Case C: Already posted invoice being modified -> Apply only the difference (delta = new - old)
      const oldMap = aggregateItemsByCode(invoice.lineItems);
      const newMap = aggregateItemsByCode(processedLineItems);
      const allCodes = new Set([...oldMap.keys(), ...newMap.keys()]);

      // Pre-validate any items where delta > 0 (requiring additional stock)
      for (const code of allCodes) {
        const oldQty = oldMap.get(code)?.quantity || 0;
        const newQty = newMap.get(code)?.quantity || 0;
        const delta = newQty - oldQty;
        if (delta > 0) {
          const itemDoc = await findItemMasterRecord(code);
          const available = Number(itemDoc ? (itemDoc.quantity !== undefined ? itemDoc.quantity : itemDoc.stockInHand) : 0) || 0;
          if (available < delta) {
            return res.status(400).json({
              success: false,
              message: `Insufficient stock to increase quantity of item '${code}'. Available: ${available}, Additional required: ${delta}`,
            });
          }
        }
      }

      // Apply atomic delta adjustments
      for (const code of allCodes) {
        const oldQty = oldMap.get(code)?.quantity || 0;
        const newQty = newMap.get(code)?.quantity || 0;
        const delta = newQty - oldQty;
        if (delta !== 0) {
          // If delta > 0: reduce stock by delta (-delta)
          // If delta < 0: return stock by |delta| (+(-delta))
          const itemDoc = await findItemMasterRecord(code);
          if (itemDoc) {
            await Item.updateOne(
              { _id: itemDoc._id },
              { $inc: { quantity: -delta, stockInHand: -delta } }
            );
          }
        }
      }
      invoice.isStockUpdated = true;
    }

    if (date) invoice.date = new Date(date);
    if (customerCode !== undefined) {
      invoice.customerCode = customerCode.trim();
      invoice.cuscode = customerCode.trim();
    }
    if (customerName !== undefined) {
      invoice.customerName = customerName;
      invoice.cusname = customerName;
    }
    if (customerAddress !== undefined) invoice.customerAddress = customerAddress;
    if (req.body.customerTelephone !== undefined || req.body.telephone !== undefined) {
      const tel = req.body.customerTelephone !== undefined ? req.body.customerTelephone : req.body.telephone;
      invoice.customerTelephone = tel;
      invoice.telephone = tel;
    }
    if (jobType !== undefined) invoice.jobType = jobType;
    if (jd !== undefined) invoice.jd = jd;
    invoice.isHold = holdStatus;
    if (remark !== undefined || note !== undefined) {
      const finalNote = (note !== undefined ? note : remark) || '';
      invoice.remark = finalNote;
      invoice.note = finalNote;
    }
    invoice.lineItems = processedLineItems;
    invoice.subTotal = Math.round(calculatedSubTotal * 100) / 100;
    invoice.specialDiscount = specDisc;
    invoice.amountToPay = Math.round(amountToPay * 100) / 100;
    invoice.netTotal = Math.round(amountToPay * 100) / 100;
    invoice.value = Math.round(amountToPay * 100) / 100;
    invoice.paymentMethod = resolvedPaymentMethod;
    invoice.paidBy = resolvedPaymentMethod;
    invoice.customerPaidAmount = customerPaid;
    invoice.amountReceived = actualReceived;
    invoice.cashReceived = resolvedPaymentMethod === 'Cash' ? actualReceived : 0;
    invoice.paidAmount = actualReceived;
    invoice.balance = changeGiven;
    if (chequeNo !== undefined) invoice.chequeNo = chequeNo;
    if (bank !== undefined) invoice.bank = bank;
    if (dateRealized !== undefined) invoice.dateRealized = dateRealized;
    if (req.body.settlementRef !== undefined) invoice.settlementRef = req.body.settlementRef;
    if (req.body.settlementStatus !== undefined) invoice.settlementStatus = req.body.settlementStatus;
    invoice.dueAmount = Math.round(calculatedDueAmount * 100) / 100;
    invoice.paymentStatus = paymentStatus;
    invoice.isSettled = calculatedDueAmount === 0;
    invoice.isStockUpdated = targetStockUpdated;
    invoice.isCompleted = targetStockUpdated;

    await invoice.save();

    // Sync customer outstanding balance for credit / partial payments
    const custCodeToSync = invoice.customerCode || customerCode;
    if (custCodeToSync && String(custCodeToSync).trim()) {
      await syncCustomerOutstandingBalance(custCodeToSync);
    }

    return res.status(200).json({
      success: true,
      message: `Invoice '${invoice.invoiceNumber}' updated successfully`,
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel an invoice and safely restore stock exactly once
 */
export const cancelInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    let invoice = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      invoice = await Invoice.findById(id);
    }
    if (!invoice) {
      const trimmed = id.trim();
      const padded = /^\d{1,4}$/.test(trimmed) ? trimmed.padStart(4, '0') : trimmed;
      invoice = await Invoice.findOne({
        $or: [{ invoiceNumber: trimmed }, { invoiceNumber: padded }],
      });
    }

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: `Invoice '${id}' not found`,
      });
    }

    // Idempotency: Prevent duplicate cancellations / reversals
    if (invoice.status === 'cancelled') {
      return res.status(200).json({
        success: true,
        message: `Invoice '${invoice.invoiceNumber}' is already cancelled. Stock was not modified.`,
        data: invoice,
      });
    }

    // Prevent cancelling an invoice that has linked settlement payments or settlement reference
    if (Boolean(invoice.settlementRef)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel Invoice '${invoice.invoiceNumber}' because it is linked to settlement transaction '${invoice.settlementRef}'. Please cancel through Settlement module.`,
      });
    }

    const linkedSettlements = await Settlement.find({
      $or: [
        { invoiceNumber: invoice.invoiceNumber },
        { invoiceNo: invoice.invoiceNumber },
        { invoiceId: invoice._id },
      ],
    }).lean();

    if (linkedSettlements && linkedSettlements.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel Invoice '${invoice.invoiceNumber}' because it is linked to ${linkedSettlements.length} settlement payment record(s). Reverse or remove settlements first in Settlement module.`,
      });
    }

    // Revert stock deductions if they were applied
    if (invoice.isStockUpdated && Array.isArray(invoice.lineItems)) {
      const itemsMap = aggregateItemsByCode(invoice.lineItems);
      for (const [code, { quantity: oldQty }] of itemsMap.entries()) {
        const itemDoc = await findItemMasterRecord(code);
        if (itemDoc) {
          await Item.updateOne(
            { _id: itemDoc._id },
            { $inc: { quantity: oldQty, stockInHand: oldQty } }
          );
        }
      }
      invoice.isStockUpdated = false;
    }

    invoice.status = 'cancelled';
    invoice.dueAmount = 0;
    invoice.isSettled = false;
    await invoice.save();

    const customerCode = invoice.customerCode || invoice.cuscode;
    if (customerCode) {
      await syncCustomerOutstandingBalance(customerCode);
    }

    return res.status(200).json({
      success: true,
      message: `Invoice '${invoice.invoiceNumber}' cancelled and stock restored successfully`,
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete an invoice and restore stock if previously deducted
 */
export const deleteInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    let invoice = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      invoice = await Invoice.findById(id);
    }
    if (!invoice) {
      const trimmed = id.trim();
      const padded = /^\d{1,4}$/.test(trimmed) ? trimmed.padStart(4, '0') : trimmed;
      invoice = await Invoice.findOne({
        $or: [{ invoiceNumber: trimmed }, { invoiceNumber: padded }],
      });
    }

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: `Invoice '${id}' not found`,
      });
    }

    // Prevent deleting an invoice that is linked to financial settlement records
    if (Boolean(invoice.settlementRef)) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete Invoice '${invoice.invoiceNumber}' because it is linked to settlement transaction '${invoice.settlementRef}'. Please cancel through Settlement module.`,
      });
    }

    const linkedSettlements = await Settlement.find({
      $or: [
        { invoiceNumber: invoice.invoiceNumber },
        { invoiceNo: invoice.invoiceNumber },
        { invoiceId: invoice._id },
      ],
    }).lean();

    if (linkedSettlements && linkedSettlements.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete Invoice '${invoice.invoiceNumber}' because it is linked to ${linkedSettlements.length} settlement payment record(s). Reverse or remove settlements first in Settlement module.`,
      });
    }

    // Revert stock deductions if they were applied
    if (invoice.isStockUpdated && Array.isArray(invoice.lineItems)) {
      const itemsMap = aggregateItemsByCode(invoice.lineItems);
      for (const [code, { quantity: oldQty }] of itemsMap.entries()) {
        const itemDoc = await findItemMasterRecord(code);
        if (itemDoc) {
          await Item.updateOne(
            { _id: itemDoc._id },
            { $inc: { quantity: oldQty, stockInHand: oldQty } }
          );
        }
      }
      invoice.isStockUpdated = false;
    }

    const customerCode = invoice.customerCode || invoice.cuscode;

    // Follow cancellation/void rules rather than silently deleting financial history
    if (invoice.status === 'completed' || invoice.status === 'partial' || invoice.status === 'paid' || invoice.isCompleted || invoice.isSettled) {
      invoice.status = 'cancelled';
      invoice.dueAmount = 0;
      invoice.isSettled = false;
      await invoice.save();
    } else {
      await Invoice.findByIdAndDelete(invoice._id);
    }

    if (customerCode) {
      await syncCustomerOutstandingBalance(customerCode);
    }

    return res.status(200).json({
      success: true,
      message: `Invoice '${invoice.invoiceNumber}' ${invoice.status === 'cancelled' ? 'cancelled' : 'deleted'} and stock restored successfully`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get remaining balances for all invoices and customers
 * Accurately calculates invoice total, valid payments applied from settlements,
 * remaining balance, and payment status (UNPAID, PARTIALLY PAID, PAID).
 * Excludes fully paid invoices from default 'outstanding' filter.
 */
export const getRemainingBalances = async (req, res, next) => {
  try {
    const { search, filter = 'outstanding', limit = 300 } = req.query;

    const query = {
      isTemporary: { $ne: true },
      isHold: { $ne: true },
    };

    const invoices = await Invoice.find(query)
      .sort({ no: -1, date: -1, createdAt: -1 })
      .limit(Math.min(parseInt(limit, 10) || 300, 1000))
      .lean();

    // Fetch settlements to calculate payments applied per invoice
    const settlements = await Settlement.find({}).lean();

    // Group valid payments applied by invoiceNumber (excluding customer change)
    const settlementsByInvoice = {};
    settlements.forEach((st) => {
      const invNum = String(st.invoiceNumber || st.invoiceNo || '').trim().toLowerCase();
      if (invNum) {
        if (!settlementsByInvoice[invNum]) {
          settlementsByInvoice[invNum] = 0;
        }
        settlementsByInvoice[invNum] += Number(st.amount || 0);
      }
    });

    // Lookup customers map for phone numbers if missing on invoice
    const customers = await Customer.find({}).lean();
    const customerMap = {};
    customers.forEach((c) => {
      const code = String(c.code || c.customerCode || '').trim().toLowerCase();
      if (code) {
        customerMap[code] = c;
      }
    });

    const results = [];
    let totalOutstandingSum = 0;

    for (const inv of invoices) {
      const invNumStr = String(inv.invoiceNumber || inv.no || '').trim();
      const invNumKey = invNumStr.toLowerCase();

      // 1. Calculate actual invoice total
      let invoiceTotal = 0;
      if (inv.lineItems && inv.lineItems.length > 0) {
        const gross = inv.lineItems.reduce(
          (sum, li) => sum + (parseFloat(li.price || li.unitPrice || 0) * parseFloat(li.quantity || li.qty || 1)),
          0
        );
        const discounts = inv.lineItems.reduce((sum, li) => sum + parseFloat(li.discountAmount || 0), 0) + (parseFloat(inv.specialDiscount) || 0);
        invoiceTotal = Math.round(Math.max(0, gross - discounts) * 100) / 100;
      } else {
        invoiceTotal = Math.round(parseFloat(inv.amountToPay || inv.netTotal || inv.subTotal || inv.value || 0) * 100) / 100;
      }

      // Skip invalid zero or negative invoice totals
      if (invoiceTotal <= 0) {
        continue;
      }

      // 2. Calculate valid payments applied
      let totalPaid = 0;
      if (settlementsByInvoice[invNumKey] !== undefined) {
        totalPaid = Math.round(settlementsByInvoice[invNumKey] * 100) / 100;
      } else if (inv.paidAmount !== undefined && inv.paidAmount !== null && inv.paidAmount > 0) {
        totalPaid = Math.round(Number(inv.paidAmount) * 100) / 100;
      } else if (inv.amountReceived !== undefined && inv.amountReceived !== null && inv.amountReceived > 0) {
        totalPaid = Math.round(Number(inv.amountReceived) * 100) / 100;
      }

      // 3. Remaining balance (decimal safe)
      const remainingBalance = Math.round(Math.max(0, invoiceTotal - totalPaid) * 100) / 100;

      // 4. Payment Status
      let paymentStatus = 'UNPAID';
      if (remainingBalance <= 0 && invoiceTotal > 0) {
        paymentStatus = 'PAID';
      } else if (totalPaid > 0 && remainingBalance > 0) {
        paymentStatus = 'PARTIALLY PAID';
      } else {
        paymentStatus = 'UNPAID';
      }

      // 5. Customer information
      const cusCodeKey = String(inv.customerCode || inv.cuscode || '').trim().toLowerCase();
      const matchedCus = customerMap[cusCodeKey] || null;

      const customerName = inv.customerName || inv.cusname || (matchedCus ? matchedCus.name : 'Walk-in Customer');
      let customerTelephone = inv.customerTelephone || inv.telephone || '';
      if (!customerTelephone && matchedCus) {
        customerTelephone = matchedCus.telephone || matchedCus.telephone1 || matchedCus.telephone2 || '';
      }

      // 6. Filter check: 'outstanding' excludes fully paid invoices (remainingBalance > 0)
      if (filter === 'outstanding' && remainingBalance <= 0) {
        continue;
      } else if (filter === 'paid' && remainingBalance > 0) {
        continue;
      } else if (filter === 'unpaid' && paymentStatus !== 'UNPAID') {
        continue;
      } else if (filter === 'partial' && paymentStatus !== 'PARTIALLY PAID') {
        continue;
      }

      // 7. Search filter: customer name, telephone, or invoice number
      if (search && search.trim() !== '') {
        const q = search.trim().toLowerCase();
        const matchesName = customerName.toLowerCase().includes(q);
        const matchesTel = String(customerTelephone).toLowerCase().includes(q);
        const matchesInv = invNumStr.toLowerCase().includes(q);
        if (!matchesName && !matchesTel && !matchesInv) {
          continue;
        }
      }

      if (remainingBalance > 0) {
        totalOutstandingSum += remainingBalance;
      }

      results.push({
        _id: inv._id,
        no: inv.no,
        invoiceNumber: invNumStr,
        date: inv.date,
        customerCode: inv.customerCode || inv.cuscode || '',
        customerName,
        customerTelephone,
        customerAddress: inv.customerAddress || (matchedCus ? matchedCus.address : ''),
        invoiceTotal,
        totalPaid,
        remainingBalance,
        paymentStatus,
        isSettled: remainingBalance <= 0,
        rawInvoice: {
          ...inv,
          customerName,
          customerTelephone,
          customerAddress: inv.customerAddress || (matchedCus ? matchedCus.address : ''),
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: results,
      totalCount: results.length,
      totalOutstandingSum: Math.round(totalOutstandingSum * 100) / 100,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update invoice note without affecting stock, line items, or totals
 * PATCH /api/invoices/:id/note
 */
export const updateInvoiceNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note = '', remark = '' } = req.body;
    const finalNote = (note !== undefined ? note : remark) || '';

    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: `Invoice not found with id ${id}`,
      });
    }

    invoice.note = finalNote;
    invoice.remark = finalNote;
    await invoice.save();

    return res.status(200).json({
      success: true,
      message: 'Invoice note updated successfully',
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

