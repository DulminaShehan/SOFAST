import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Item from '../models/Item.js';
import Customer from '../models/Customer.js';

/**
 * Get next sequential invoice number from MongoDB docnumbers and invoices
 */
export const getNextInvoiceNumber = async (req, res, next) => {
  try {
    const db = mongoose.connection.db;

    let nextNo = 1;
    const docNum = await db.collection('docnumbers').findOne({ docType: 'INV' });
    const latestInv = await Invoice.findOne({ no: { $exists: true, $ne: null } })
      .sort({ no: -1, createdAt: -1 })
      .lean();

    const docCurrent = docNum && Number(docNum.currentNumber) ? Number(docNum.currentNumber) : 0;
    const invCurrent = latestInv && Number(latestInv.no) ? Number(latestInv.no) : 0;

    nextNo = Math.max(docCurrent, invCurrent) + 1;
    if (nextNo < 1) nextNo = 1;

    const invoiceNumber = String(nextNo);

    return res.status(200).json({
      success: true,
      data: {
        no: nextNo,
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
      Invoice.find(query).sort({ no: -1, createdAt: -1 }).skip(skip).limit(parsedLimit).lean(),
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
      invoice = await Invoice.findOne({ invoiceNumber: id.trim() }).lean();
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
 * Create and Save a new Invoice, updating stock if completed
 */
export const createInvoice = async (req, res, next) => {
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
      lineItems = [],
      specialDiscount = 0,
      amountReceived = 0,
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

    // Determine sequential invoice number
    let finalNo = providedNo;
    let finalInvoiceNumber = providedInvoiceNumber;

    if (!finalNo || !finalInvoiceNumber) {
      const docNum = await db.collection('docnumbers').findOne({ docType: 'INV' });
      const latestInv = await Invoice.findOne({ no: { $exists: true, $ne: null } })
        .sort({ no: -1, createdAt: -1 })
        .lean();

      const docCurrent = docNum && Number(docNum.currentNumber) ? Number(docNum.currentNumber) : 0;
      const invCurrent = latestInv && Number(latestInv.no) ? Number(latestInv.no) : 0;

      finalNo = Math.max(docCurrent, invCurrent) + 1;
      finalInvoiceNumber = String(finalNo);
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
    const processedLineItems = lineItems.map((item) => {
      const code = (item.code || item.itemCode || '').trim();
      const qty = Math.max(0.01, parseFloat(item.quantity || item.qty) || 1);
      const price = parseFloat(item.price || item.unitPrice) || 0;
      const rate = parseFloat(item.rate || price) || price;
      let discPct = parseFloat(item.discountPercentage) || 0;
      let discAmt = parseFloat(item.discountAmount) || 0;

      if (discPct > 0 && (!discAmt || discAmt === 0)) {
        discAmt = (price * discPct) / 100 * qty;
      } else if (discAmt > 0 && (!discPct || discPct === 0) && price > 0) {
        discPct = (discAmt / (price * qty)) * 100;
      }

      const gross = price * qty;
      const lineVal = Math.max(0, gross - discAmt);
      calculatedSubTotal += lineVal;

      return {
        code,
        itemCode: code,
        description: item.description || '',
        location: item.location || 'Main Store',
        quantity: qty,
        qty: qty,
        masterPack: String(item.masterPack || '1'),
        rateType: item.rateType || 'Retail',
        rate,
        price,
        unitPrice: price,
        itemCost: parseFloat(item.itemCost) || 0,
        mpCost: parseFloat(item.mpCost) || 0,
        discountPercentage: Math.round(discPct * 100) / 100,
        discountAmount: Math.round(discAmt * 100) / 100,
        value: Math.round(lineVal * 100) / 100,
        total: Math.round(lineVal * 100) / 100,
        balance: parseFloat(item.balance) || 0,
      };
    });

    const specDisc = Math.max(0, parseFloat(specialDiscount) || 0);
    const amountToPay = Math.max(0, calculatedSubTotal - specDisc);
    const amtReceived = parseFloat(amountReceived) || 0;
    const dueAmount = Math.max(0, amountToPay - amtReceived);

    const holdStatus = Boolean(isHold);
    const invStatus = holdStatus ? 'hold' : (reqStatus || 'completed');
    const isCompleted = !holdStatus;
    const isStockUpdated = isCompleted;

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
      status: invStatus,
      remark,
      lineItems: processedLineItems,
      subTotal: Math.round(calculatedSubTotal * 100) / 100,
      specialDiscount: specDisc,
      amountToPay: Math.round(amountToPay * 100) / 100,
      netTotal: Math.round(amountToPay * 100) / 100,
      value: Math.round(amountToPay * 100) / 100,
      amountReceived: amtReceived,
      cashReceived: amtReceived,
      chequeNo,
      bank,
      dateRealized,
      dueAmount: Math.round(dueAmount * 100) / 100,
      isStockUpdated,
      isCompleted,
    });

    await newInvoice.save();

    // Update docnumbers sequence
    await db.collection('docnumbers').updateOne(
      { docType: 'INV' },
      { $set: { currentNumber: Number(finalNo) } },
      { upsert: true }
    );

    // Stock deduction ONLY if invoice is completed (not on hold)
    if (isStockUpdated) {
      for (const line of processedLineItems) {
        if (!line.code) continue;
        const item = await Item.findOne({ code: line.code.trim() });
        if (item) {
          const curQty = Number(item.quantity || item.stockInHand || 0);
          const newQty = Math.max(0, curQty - line.quantity);
          item.quantity = newQty;
          item.stockInHand = newQty;
          await item.save();
        }
      }
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
 * Update an existing Invoice and manage stock differences safely
 */
export const updateInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    let invoice = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      invoice = await Invoice.findById(id);
    }
    if (!invoice) {
      invoice = await Invoice.findOne({ invoiceNumber: id.trim() });
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
      lineItems = [],
      specialDiscount = 0,
      amountReceived = 0,
      chequeNo,
      bank,
      dateRealized,
    } = req.body;

    // If previous invoice was completed and had deducted stock, revert previous stock deductions
    if (invoice.isStockUpdated && Array.isArray(invoice.lineItems)) {
      for (const oldLine of invoice.lineItems) {
        if (!oldLine.code) continue;
        const item = await Item.findOne({ code: oldLine.code.trim() });
        if (item) {
          const curQty = Number(item.quantity || item.stockInHand || 0);
          const restoredQty = curQty + (oldLine.quantity || 0);
          item.quantity = restoredQty;
          item.stockInHand = restoredQty;
          await item.save();
        }
      }
    }

    // Process updated line items
    let calculatedSubTotal = 0;
    const processedLineItems = lineItems.map((item) => {
      const code = (item.code || item.itemCode || '').trim();
      const qty = Math.max(0.01, parseFloat(item.quantity || item.qty) || 1);
      const price = parseFloat(item.price || item.unitPrice) || 0;
      const rate = parseFloat(item.rate || price) || price;
      let discPct = parseFloat(item.discountPercentage) || 0;
      let discAmt = parseFloat(item.discountAmount) || 0;

      if (discPct > 0 && (!discAmt || discAmt === 0)) {
        discAmt = (price * discPct) / 100 * qty;
      } else if (discAmt > 0 && (!discPct || discPct === 0) && price > 0) {
        discPct = (discAmt / (price * qty)) * 100;
      }

      const gross = price * qty;
      const lineVal = Math.max(0, gross - discAmt);
      calculatedSubTotal += lineVal;

      return {
        code,
        itemCode: code,
        description: item.description || '',
        location: item.location || 'Main Store',
        quantity: qty,
        qty: qty,
        masterPack: String(item.masterPack || '1'),
        rateType: item.rateType || 'Retail',
        rate,
        price,
        unitPrice: price,
        itemCost: parseFloat(item.itemCost) || 0,
        mpCost: parseFloat(item.mpCost) || 0,
        discountPercentage: Math.round(discPct * 100) / 100,
        discountAmount: Math.round(discAmt * 100) / 100,
        value: Math.round(lineVal * 100) / 100,
        total: Math.round(lineVal * 100) / 100,
        balance: parseFloat(item.balance) || 0,
      };
    });

    const specDisc = Math.max(0, parseFloat(specialDiscount) || 0);
    const amountToPay = Math.max(0, calculatedSubTotal - specDisc);
    const amtReceived = parseFloat(amountReceived) || 0;
    const dueAmount = Math.max(0, amountToPay - amtReceived);

    const holdStatus = isHold !== undefined ? Boolean(isHold) : invoice.isHold;
    const invStatus = holdStatus ? 'hold' : (reqStatus || 'completed');
    const isCompleted = !holdStatus;
    const isStockUpdated = isCompleted;

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
    invoice.status = invStatus;
    if (remark !== undefined) invoice.remark = remark;
    invoice.lineItems = processedLineItems;
    invoice.subTotal = Math.round(calculatedSubTotal * 100) / 100;
    invoice.specialDiscount = specDisc;
    invoice.amountToPay = Math.round(amountToPay * 100) / 100;
    invoice.netTotal = Math.round(amountToPay * 100) / 100;
    invoice.value = Math.round(amountToPay * 100) / 100;
    invoice.amountReceived = amtReceived;
    invoice.cashReceived = amtReceived;
    if (chequeNo !== undefined) invoice.chequeNo = chequeNo;
    if (bank !== undefined) invoice.bank = bank;
    if (dateRealized !== undefined) invoice.dateRealized = dateRealized;
    invoice.dueAmount = Math.round(dueAmount * 100) / 100;
    invoice.isStockUpdated = isStockUpdated;
    invoice.isCompleted = isCompleted;

    await invoice.save();

    // Apply new stock deductions if completed
    if (isStockUpdated) {
      for (const line of processedLineItems) {
        if (!line.code) continue;
        const item = await Item.findOne({ code: line.code.trim() });
        if (item) {
          const curQty = Number(item.quantity || item.stockInHand || 0);
          const newQty = Math.max(0, curQty - line.quantity);
          item.quantity = newQty;
          item.stockInHand = newQty;
          await item.save();
        }
      }
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
      invoice = await Invoice.findOne({ invoiceNumber: id.trim() });
    }

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: `Invoice '${id}' not found`,
      });
    }

    // Revert stock deductions if they were applied
    if (invoice.isStockUpdated && Array.isArray(invoice.lineItems)) {
      for (const line of invoice.lineItems) {
        if (!line.code) continue;
        const item = await Item.findOne({ code: line.code.trim() });
        if (item) {
          const curQty = Number(item.quantity || item.stockInHand || 0);
          const restoredQty = curQty + (line.quantity || 0);
          item.quantity = restoredQty;
          item.stockInHand = restoredQty;
          await item.save();
        }
      }
    }

    await Invoice.findByIdAndDelete(invoice._id);

    return res.status(200).json({
      success: true,
      message: `Invoice '${invoice.invoiceNumber}' deleted and stock restored successfully`,
    });
  } catch (error) {
    next(error);
  }
};
