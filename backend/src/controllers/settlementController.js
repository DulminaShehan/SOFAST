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
      invoiceNumber: { $regex: new RegExp(`^${invNumTrimmed}$`, 'i') },
    })
      .sort({ createdAt: -1 })
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
      query.invoiceNumber = String(invoiceNumber).trim();
    }

    if (customerCode) {
      query.customerCode = String(customerCode).trim();
    }

    if (search && search.trim() !== '') {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { receiptNo: regex },
        { invoiceNumber: regex },
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

    const payAmount = parseFloat(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Settlement amount must be greater than 0',
      });
    }

    // Find the original invoice
    const invoice = await Invoice.findOne({
      $or: [{ invoiceNumber: invNum }, { no: Number(invNum) ? Number(invNum) : null }],
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: `Invoice '${invNum}' not found in the database`,
      });
    }

    // Determine current invoice balance
    let currentBalance = 0;
    if (invoice.dueAmount !== undefined && invoice.dueAmount !== null) {
      currentBalance = Number(invoice.dueAmount);
    } else {
      const invTotal = Number(invoice.amountToPay || invoice.subTotal || invoice.netTotal || 0);
      const prevSettlements = await Settlement.find({ invoiceNumber: invoice.invoiceNumber }).lean();
      const settledSum = prevSettlements.reduce((sum, s) => sum + (Number(s.amount) || 0) + (Number(s.specialDiscountAmount) || 0), 0);
      const initReceived = Number(invoice.amountReceived || 0);
      currentBalance = Math.max(0, invTotal - settledSum - initReceived);
    }

    const specDiscAmt = Math.max(0, parseFloat(specialDiscountAmount) || 0);

    // Validate payment method specifics
    if ((method === 'Cheque' || method === 'Credit Note') && !chequeNo?.trim()) {
      return res.status(400).json({
        success: false,
        message: `Please enter the ${method === 'Cheque' ? 'Cheque' : 'Credit Note'} number`,
      });
    }

    if (method === 'Cheque' && !bank?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please enter or select the Bank for the cheque',
      });
    }

    // Generate or use Receipt Number
    let finalReceiptNo = providedReceiptNo;
    let nextNo = 1001;

    if (!finalReceiptNo || finalReceiptNo.trim() === '') {
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

    const balanceBefore = Math.round(currentBalance * 100) / 100;
    const balanceAfter = Math.max(0, Math.round((currentBalance - payAmount - specDiscAmt) * 100) / 100);

    // Create Settlement record
    const settlement = new Settlement({
      receiptNo: String(finalReceiptNo).trim(),
      no: nextNo,
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      customerCode: invoice.customerCode || invoice.cuscode || '',
      customerName: invoice.customerName || invoice.cusname || '',
      date: date ? new Date(date) : new Date(),
      amount: Math.round(payAmount * 100) / 100,
      method,
      received: received !== '' && !isNaN(parseFloat(received)) ? parseFloat(received) : payAmount,
      chequeNo: chequeNo ? chequeNo.trim() : '',
      bank: bank ? bank.trim() : '',
      dateRealized: dateRealized ? String(dateRealized).trim() : '',
      specialDiscountType: specialDiscountType || '',
      specialDiscountAmount: Math.round(specDiscAmt * 100) / 100,
      specialDiscountBasis,
      specialAmount: parseFloat(specialAmount) || 0,
      balanceBefore,
      balanceAfter,
      remark: remark || '',
      createdBy: req.user?.username || 'Admin',
    });

    await settlement.save();

    // Update Docnumbers for receipt
    await db.collection('docnumbers').updateOne(
      { docType: 'REC' },
      { $set: { currentNumber: nextNo, prefix: 'REC', padding: 4 } },
      { upsert: true }
    );

    // Update original Invoice due amount and amount received
    invoice.dueAmount = balanceAfter;
    invoice.amountReceived = Math.round(((invoice.amountReceived || 0) + payAmount) * 100) / 100;
    if (balanceAfter <= 0) {
      invoice.isSettled = true;
      invoice.paymentStatus = 'paid';
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
        value: invoice.amountToPay || invoice.subTotal,
        balanceBefore,
        remainingBalance: balanceAfter,
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

    // Find and update original invoice
    const invoice = await Invoice.findOne({ invoiceNumber: settlement.invoiceNumber });
    let restoredBalance = 0;

    if (invoice) {
      const refundAmt = Number(settlement.amount || 0);
      const refundDisc = Number(settlement.specialDiscountAmount || 0);
      invoice.dueAmount = Math.round(((invoice.dueAmount || 0) + refundAmt + refundDisc) * 100) / 100;
      invoice.amountReceived = Math.max(0, Math.round(((invoice.amountReceived || 0) - refundAmt) * 100) / 100);
      if (invoice.dueAmount > 0) {
        invoice.isSettled = false;
        invoice.paymentStatus = 'partial';
      }
      await invoice.save();
      restoredBalance = invoice.dueAmount;
    }

    await Settlement.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: `Settlement '${settlement.receiptNo}' deleted and Rs. ${settlement.amount.toFixed(2)} restored to Invoice '${settlement.invoiceNumber}'`,
      data: {
        deletedId: id,
        invoiceNumber: settlement.invoiceNumber,
        restoredBalance,
      },
    });
  } catch (error) {
    next(error);
  }
};
