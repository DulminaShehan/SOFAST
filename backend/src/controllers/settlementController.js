import mongoose from 'mongoose';
import Settlement from '../models/Settlement.js';
import Invoice from '../models/Invoice.js';

/**
 * Get next receipt number for settlement
 */
export const getNextReceiptNumber = async (req, res, next) => {
  try {
    const db = mongoose.connection.db;

    let nextNo = 1001;
    const docNum = await db.collection('docnumbers').findOne({ docType: 'REC' });
    const latestSettlement = await Settlement.findOne({ no: { $exists: true, $ne: null } })
      .sort({ no: -1, createdAt: -1 })
      .lean();

    const docCurrent = docNum && Number(docNum.currentNumber) ? Number(docNum.currentNumber) : 0;
    const settCurrent = latestSettlement && Number(latestSettlement.no) ? Number(latestSettlement.no) : 0;

    nextNo = Math.max(docCurrent, settCurrent, 1000) + 1;

    const receiptNo = `REC-${String(nextNo).padStart(4, '0')}`;

    return res.status(200).json({
      success: true,
      data: {
        no: nextNo,
        receiptNo,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get list of banks from database
 */
export const getBanks = async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    const banks = await db.collection('banks').find({}).sort({ description: 1 }).toArray();

    if (banks && banks.length > 0) {
      return res.status(200).json({
        success: true,
        data: banks,
      });
    }

    // Default fallback bank list if empty
    const defaultBanks = [
      { code: 'BOC', description: 'Bank of Ceylon' },
      { code: 'PB', description: 'People\'s Bank' },
      { code: 'COM', description: 'Commercial Bank' },
      { code: 'HNB', description: 'Hatton National Bank' },
      { code: 'SAM', description: 'Sampath Bank' },
      { code: 'NDB', description: 'NDB Bank' },
      { code: 'NTB', description: 'Nations Trust Bank' },
      { code: 'SEY', description: 'Seylan Bank' },
      { code: 'DFCC', description: 'DFCC Bank' },
      { code: 'HSBC', description: 'HSBC' },
      { code: 'SCB', description: 'Standard Chartered Bank' },
      { code: 'PABC', description: 'Pan Asia Bank' },
      { code: 'CDB', description: 'Citizens Development Business' },
    ];

    return res.status(200).json({
      success: true,
      data: defaultBanks,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get settlements by Invoice Number
 */
export const getSettlementsByInvoice = async (req, res, next) => {
  try {
    const { invoiceNumber } = req.params;
    const invNumTrimmed = String(invoiceNumber || '').trim();

    if (!invNumTrimmed) {
      return res.status(400).json({
        success: false,
        message: 'Invoice number is required',
      });
    }

    const settlements = await Settlement.find({
      $or: [
        { invoiceNumber: { $regex: new RegExp(`^${invNumTrimmed}$`, 'i') } },
        { invoiceNo: { $regex: new RegExp(`^${invNumTrimmed}$`, 'i') } },
        { invoiceNo: Number(invNumTrimmed) ? Number(invNumTrimmed) : null },
      ],
    })
      .sort({ createdAt: 1, _id: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: settlements,
      count: settlements.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all settlements with pagination and search
 */
export const getSettlements = async (req, res, next) => {
  try {
    const { search, invoiceNumber, customerCode, page = 1, limit = 50 } = req.query;
    const query = {};

    if (invoiceNumber) {
      query.$or = [
        { invoiceNumber: String(invoiceNumber).trim() },
        { invoiceNo: String(invoiceNumber).trim() },
      ];
    }

    if (customerCode) {
      query.customerCode = String(customerCode).trim();
    }

    if (search && search.trim() !== '') {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { receiptNo: regex },
        { invoiceNumber: regex },
        { invoiceNo: regex },
        { customerCode: regex },
        { customerName: regex },
        { chequeNo: regex },
        { bank: regex },
      ];
    }

    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const skip = (parsedPage - 1) * parsedLimit;

    const [settlements, total] = await Promise.all([
      Settlement.find(query).sort({ createdAt: -1 }).skip(skip).limit(parsedLimit).lean(),
      Settlement.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: settlements,
      total,
      page: parsedPage,
      totalPages: Math.ceil(total / parsedLimit),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create and save a new Settlement payment against an existing Invoice
 */
export const createSettlement = async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    const {
      invoiceNumber,
      amount,
      method = 'Cash',
      received = 0,
      chequeNo = '',
      bank = '',
      dateRealized = '',
      date,
      receiptNo: providedReceiptNo,
      specialDiscountType = '',
      specialDiscountAmount = 0,
      specialDiscountBasis = 'balance',
      specialAmount = 0,
      remark = '',
    } = req.body;

    const invNum = String(invoiceNumber || '').trim();
    if (!invNum) {
      return res.status(400).json({
        success: false,
        message: 'Please select an invoice to settle',
      });
    }

    // Determine actual customer payment received
    const payReceived = Math.round((parseFloat(received !== undefined && received !== null && received !== '' ? received : amount) || 0) * 100) / 100;
    if (isNaN(payReceived) || payReceived <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount must be greater than 0',
      });
    }

    // Find the original invoice
    const invoice = await Invoice.findOne({
      $or: [
        { invoiceNumber: invNum },
        { invoiceNumber: { $regex: new RegExp(`^${invNum}$`, 'i') } },
        { no: Number(invNum) ? Number(invNum) : null },
      ],
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: `Invoice '${invNum}' not found in the database`,
      });
    }

    // Calculate actual invoice total after line discounts and special discount
    const invGross = invoice.lineItems && invoice.lineItems.length > 0
      ? invoice.lineItems.reduce((sum, li) => sum + (parseFloat(li.price || li.unitPrice || 0) * parseFloat(li.quantity || li.qty || 1)), 0)
      : parseFloat(invoice.subTotal || invoice.amountToPay || invoice.netTotal || 0);

    const invDiscounts = (invoice.lineItems && invoice.lineItems.length > 0
      ? invoice.lineItems.reduce((sum, li) => sum + parseFloat(li.discountAmount || 0), 0)
      : 0) + (parseFloat(invoice.specialDiscount) || 0);

    const invoiceTotal = Math.round(Math.max(0, invGross - invDiscounts) * 100) / 100;

    // Find all previously saved settlements for this invoice
    const prevSettlements = await Settlement.find({
      $or: [
        { invoiceNumber: invoice.invoiceNumber },
        { invoiceNo: invoice.invoiceNumber },
        { invoiceNumber: String(invoice.no) },
        { invoiceNo: String(invoice.no) },
        { invoiceNo: Number(invoice.no) ? Number(invoice.no) : null },
      ],
    }).lean();

    const prevSettledSum = Math.round(prevSettlements.reduce((sum, s) => sum + (Number(s.amount) || 0), 0) * 100) / 100;

    // Determine outstanding balance before this payment
    let currentBalance = Math.round(Math.max(0, invoiceTotal - prevSettledSum) * 100) / 100;

    // If invoice is already fully paid, prevent adding payment
    if (currentBalance <= 0) {
      return res.status(400).json({
        success: false,
        message: `Invoice '${invoice.invoiceNumber}' is already fully paid and settled. No additional payment can be applied.`,
      });
    }

    // Calculate Amount Applied, Change, and Balance After
    const amountApplied = Math.round(Math.min(payReceived, currentBalance) * 100) / 100;
    if (amountApplied <= 0) {
      return res.status(400).json({
        success: false,
        message: 'No settlement amount can be applied to this invoice',
      });
    }

    const changeAmount = Math.round(Math.max(0, payReceived - amountApplied) * 100) / 100;
    const balanceAfter = Math.round(Math.max(0, currentBalance - amountApplied) * 100) / 100;
    const totalPaidTowardInvoice = Math.round((prevSettledSum + amountApplied) * 100) / 100;

    // Validate payment method specifics
    const payMethod = method || 'Cash';
    if ((payMethod === 'Cheque' || payMethod === 'Credit Note') && !chequeNo?.trim()) {
      return res.status(400).json({
        success: false,
        message: `Please enter the ${payMethod === 'Cheque' ? 'Cheque' : 'Credit Note'} number`,
      });
    }

    if (payMethod === 'Cheque' && !bank?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please enter or select the Bank for the cheque',
      });
    }

    // Generate or use Receipt Number (with collision protection)
    let finalReceiptNo = providedReceiptNo ? String(providedReceiptNo).trim() : '';
    let nextNo = 1001;

    if (finalReceiptNo) {
      const existingReceipt = await Settlement.findOne({ receiptNo: finalReceiptNo });
      if (existingReceipt) {
        finalReceiptNo = ''; // Generate fresh unique receipt
      }
    }

    if (!finalReceiptNo) {
      const docNum = await db.collection('docnumbers').findOne({ docType: 'REC' });
      const latestSettlement = await Settlement.findOne({ no: { $exists: true, $ne: null } })
        .sort({ no: -1, createdAt: -1 })
        .lean();

      const docCurrent = docNum && Number(docNum.currentNumber) ? Number(docNum.currentNumber) : 0;
      const settCurrent = latestSettlement && Number(latestSettlement.no) ? Number(latestSettlement.no) : 0;
      nextNo = Math.max(docCurrent, settCurrent, 1000) + 1;
      finalReceiptNo = `REC-${String(nextNo).padStart(4, '0')}`;
    } else {
      const matchNum = finalReceiptNo.match(/\d+/);
      nextNo = matchNum ? parseInt(matchNum[0], 10) : 1001;
    }

    // Create Settlement record with separate received, applied, and change amounts
    const settlement = new Settlement({
      receiptNo: finalReceiptNo,
      no: nextNo,
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceNo: invoice.invoiceNumber,
      customerCode: invoice.customerCode || invoice.cuscode || '',
      customerName: invoice.customerName || invoice.cusname || '',
      date: date ? new Date(date) : new Date(),
      amount: amountApplied, // Amount applied toward invoice
      received: payReceived, // Actual customer payment received
      change: changeAmount, // Change / cash return amount
      method: payMethod,
      chequeNo: chequeNo ? chequeNo.trim() : '',
      bank: bank ? bank.trim() : '',
      dateRealized: dateRealized ? String(dateRealized).trim() : '',
      specialDiscountType: specialDiscountType || '',
      specialDiscountAmount: Math.round((parseFloat(specialDiscountAmount) || 0) * 100) / 100,
      specialDiscountBasis,
      specialAmount: parseFloat(specialAmount) || 0,
      balanceBefore: currentBalance,
      balanceAfter,
      remark: remark || '',
      createdBy: req.user?.username || req.user?.userCode || 'Admin',
    });

    await settlement.save();

    // Update Docnumbers for receipt sequence
    await db.collection('docnumbers').updateOne(
      { docType: 'REC' },
      { $set: { currentNumber: nextNo, prefix: 'REC', padding: 4 } },
      { upsert: true }
    );

    // Update original Invoice due amount, paid amount, and payment status
    invoice.dueAmount = balanceAfter;
    invoice.paidAmount = totalPaidTowardInvoice;
    invoice.amountReceived = totalPaidTowardInvoice;
    invoice.isSettled = balanceAfter <= 0;
    invoice.paymentStatus = balanceAfter <= 0 ? 'paid' : 'partial';
    if (balanceAfter <= 0) {
      invoice.status = 'completed';
    }
    await invoice.save();

    return res.status(201).json({
      success: true,
      message: `Settlement '${settlement.receiptNo}' of Rs. ${settlement.amount.toFixed(2)} recorded successfully for Invoice '${invoice.invoiceNumber}'`,
      data: settlement,
      invoice: {
        invoiceNumber: invoice.invoiceNumber,
        customerCode: invoice.customerCode,
        customerName: invoice.customerName,
        value: invoiceTotal,
        balanceBefore: currentBalance,
        remainingBalance: balanceAfter,
        amountApplied,
        received: payReceived,
        change: changeAmount,
        totalPaid: totalPaidTowardInvoice,
        paymentStatus: invoice.paymentStatus,
        isSettled: invoice.isSettled,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a settlement and restore original invoice balance
 */
export const deleteSettlement = async (req, res, next) => {
  try {
    const { id } = req.params;
    const settlement = await Settlement.findById(id);

    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: 'Settlement record not found',
      });
    }

    const invNum = settlement.invoiceNumber || settlement.invoiceNo;
    await Settlement.findByIdAndDelete(id);

    // Find and recalculate original invoice from remaining settlements
    const invoice = await Invoice.findOne({
      $or: [
        { invoiceNumber: invNum },
        { invoiceNumber: { $regex: new RegExp(`^${invNum}$`, 'i') } },
        { no: Number(invNum) ? Number(invNum) : null },
      ],
    });

    let restoredBalance = 0;

    if (invoice) {
      const remainingSettlements = await Settlement.find({
        $or: [
          { invoiceNumber: invoice.invoiceNumber },
          { invoiceNo: invoice.invoiceNumber },
          { invoiceNumber: String(invoice.no) },
          { invoiceNo: String(invoice.no) },
          { invoiceNo: Number(invoice.no) ? Number(invoice.no) : null },
        ],
      }).lean();

      const remainingPaid = Math.round(remainingSettlements.reduce((sum, s) => sum + (Number(s.amount) || 0), 0) * 100) / 100;

      const invGross = invoice.lineItems && invoice.lineItems.length > 0
        ? invoice.lineItems.reduce((sum, li) => sum + (parseFloat(li.price || li.unitPrice || 0) * parseFloat(li.quantity || li.qty || 1)), 0)
        : parseFloat(invoice.subTotal || invoice.amountToPay || invoice.netTotal || 0);

      const invDiscounts = (invoice.lineItems && invoice.lineItems.length > 0
        ? invoice.lineItems.reduce((sum, li) => sum + parseFloat(li.discountAmount || 0), 0)
        : 0) + (parseFloat(invoice.specialDiscount) || 0);

      const invoiceTotal = Math.round(Math.max(0, invGross - invDiscounts) * 100) / 100;
      restoredBalance = Math.round(Math.max(0, invoiceTotal - remainingPaid) * 100) / 100;

      invoice.dueAmount = restoredBalance;
      invoice.paidAmount = remainingPaid;
      invoice.amountReceived = remainingPaid;
      invoice.isSettled = restoredBalance <= 0 && invoiceTotal > 0;
      invoice.paymentStatus = restoredBalance <= 0 ? 'paid' : (remainingPaid > 0 ? 'partial' : 'unpaid');
      await invoice.save();
    }

    return res.status(200).json({
      success: true,
      message: `Settlement '${settlement.receiptNo}' deleted and balance updated for Invoice '${invNum}'`,
      data: {
        deletedId: id,
        invoiceNumber: invNum,
        restoredBalance,
      },
    });
  } catch (error) {
    next(error);
  }
};
