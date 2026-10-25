import mongoose from 'mongoose';
import { PaymentVoucher, PettyCash, PettyCashLimit, LeaveRequest } from '../models/Approvement.js';
import { backendSampleAttachments } from './approvementSampleBills.js';

const isDbConnected = () => mongoose.connection.readyState === 1;

// Seed sample matching user's PDF exact structure
const initialPaymentVouchers = [
  {
    voucherNo: 'PV-2026-001',
    date: new Date('2026-05-04'),
    dateFormatted: '04/05/2026',
    payeeName: 'P.H.A. Prashan',
    payeeNote: '(Monthly Ex - Oct 26)',
    bank: 'PEB',
    branch: 'Horana',
    chequeNo: 'TFR.',
    items: [
      { particulars: 'Electricity Bill OCT-26', account: '4413433203', amountRs: 14200, amountCts: 0, totalLineAmount: 14200.00 },
      { particulars: 'Telephone Bill 0342210696', account: 'SLT-0342210680', amountRs: 5460, amountCts: 0, totalLineAmount: 5460.00 },
      { particulars: '0766064946', account: 'Mobile Data', amountRs: 5000, amountCts: 0, totalLineAmount: 5000.00 },
      { particulars: '074-0895088', account: 'Dialog Mobile Bill', amountRs: 930, amountCts: 0, totalLineAmount: 930.00 },
    ],
    totalAmount: 25590.00,
    amountInWords: 'Twenty Five Thousand Five Hundred & Ninety Only.',
    preparedBy: 'cashier',
    preparedDate: new Date('2026-05-04'),
    checkedBy: 'Accountant',
    approvedBy: null,
    approvedAt: null,
    receivedByName: 'P.H.A. Prashan',
    receivedByIdNumber: '1602',
    receivedByDate: new Date('2026-05-04'),
    status: 'Pending',
    adminRemarks: '',
    attachments: backendSampleAttachments,
  },
];

const initialPettyCash = [
  {
    voucherNo: 'ERF-2026-001',
    name: 'Sunil Shantha',
    date: new Date('2026-10-22'),
    dateFormatted: '22/10/2026',
    subject: 'POS Counter Thermal Paper Rolls & Stationery Supplies',
    reimbursementDate: '22/10/2026',
    items: [
      { description: 'Thermal Paper Rolls (80mm x 50 rolls)', amount: 3500 },
      { description: 'Gel Ink Pens & Invoice Filing Folders', amount: 1000 },
    ],
    amount: 4500,
    notes: 'Urgent thermal roll refills for busy weekend service cashier counters.',
    requestedBy: 'Sunil Shantha',
    checkedBy: 'Accountant',
    department: 'POS Cashier Counter',
    category: 'Office Supplies',
    purpose: 'Thermal receipt rolls & pens',
    status: 'Approved',
    approvedBy: 'admin',
    approvedAt: new Date('2026-10-22'),
    remarks: 'Approved & deducted from monthly spendable fund.',
    attachments: [],
  },
  {
    voucherNo: 'ERF-2026-002',
    name: 'Nimal Bandara',
    date: new Date('2026-10-24'),
    dateFormatted: '24/10/2026',
    subject: 'Workshop Staff Overtime Refreshments (Saturday Shift)',
    reimbursementDate: '24/10/2026',
    items: [
      { description: 'Technicians Tea & Evening Refreshments', amount: 2200 },
      { description: 'Mineral Water (5L x 2 bottles)', amount: 1000 },
    ],
    amount: 3200,
    notes: 'Saturday overtime brake-disk servicing shift staff refreshments.',
    requestedBy: 'Nimal Bandara',
    checkedBy: 'Accountant',
    department: 'Workshop',
    category: 'Workshop Refreshments',
    purpose: 'Staff tea & overtime refreshments',
    status: 'Pending',
    approvedBy: null,
    approvedAt: null,
    remarks: '',
    attachments: [],
  },
];

const initialPettyCashLimit = {
  totalLimit: 50000,
  period: 'Monthly (October 2026)',
  setBy: 'Admin',
  lastUpdated: new Date(),
};

const initialLeaveRequests = [
  {
    requestNo: 'LR-2026-001',
    date: new Date('2026-10-18'),
    employeeName: 'Kasun Silva',
    leaveType: 'Annual',
    startDate: new Date('2026-11-01'),
    endDate: new Date('2026-11-03'),
    numberOfDays: 3,
    reason: 'Family event and personal travels to Kandy',
    status: 'Approved',
    approvedBy: 'admin',
    approvedAt: new Date('2026-10-19'),
    remarks: 'Approved. Standby cashier assigned.',
  },
];

let memPaymentVouchers = [...initialPaymentVouchers];
let memPettyCash = [...initialPettyCash];
let memPettyCashLimit = { ...initialPettyCashLimit };
let memLeaveRequests = [...initialLeaveRequests];

// Helper to seed Mongo if empty or upgrade
const seedIfEmpty = async () => {
  if (!isDbConnected()) return;
  try {
    const pvCount = await PaymentVoucher.countDocuments();
    if (pvCount === 0) {
      await PaymentVoucher.insertMany(initialPaymentVouchers);
    } else {
      // Ensure the exact PDF sample voucher is always present
      const sampleExists = await PaymentVoucher.findOne({ payeeName: 'P.H.A. Prashan' });
      if (!sampleExists) {
        const count = await PaymentVoucher.countDocuments();
        const nextNo = `PV-2026-${String(count + 1).padStart(3, '0')}`;
        await PaymentVoucher.create({
          ...initialPaymentVouchers[0],
          voucherNo: nextNo,
        });
      } else if (!sampleExists.attachments || sampleExists.attachments.length === 0) {
        sampleExists.attachments = backendSampleAttachments;
        await sampleExists.save();
      }
    }
    const pcCount = await PettyCash.countDocuments();
    if (pcCount === 0) {
      await PettyCash.insertMany(initialPettyCash);
    }
    const limitCount = await PettyCashLimit.countDocuments();
    if (limitCount === 0) {
      await PettyCashLimit.create(initialPettyCashLimit);
    }
    const lrCount = await LeaveRequest.countDocuments();
    if (lrCount === 0) {
      await LeaveRequest.insertMany(initialLeaveRequests);
    }
  } catch (e) {
    console.error('Error seeding approvement data:', e.message);
  }
};

// ---------------- Payment Voucher Handlers ----------------

export const getPaymentVouchers = async (req, res, next) => {
  try {
    const { user, status } = req.query;

    if (isDbConnected()) {
      await seedIfEmpty();
      let filter = {};
      if (user && user !== 'admin') {
        filter.preparedBy = user;
      }
      if (status && status !== 'All') {
        filter.status = status;
      }
      const vouchers = await PaymentVoucher.find(filter).sort({ createdAt: -1 });
      return res.status(200).json({ success: true, count: vouchers.length, data: vouchers });
    }

    let result = [...memPaymentVouchers];
    if (user && user !== 'admin') {
      result = result.filter((v) => v.preparedBy === user);
    }
    if (status && status !== 'All') {
      result = result.filter((v) => v.status === status);
    }
    return res.status(200).json({ success: true, count: result.length, data: result });
  } catch (error) {
    next(error);
  }
};

export const createPaymentVoucher = async (req, res, next) => {
  try {
    const {
      payeeName,
      payeeNote,
      dateFormatted,
      bank,
      branch,
      chequeNo,
      items,
      totalAmount,
      amountInWords,
      preparedBy,
      receivedByName,
      receivedByIdNumber,
      attachments = [],
    } = req.body;

    if (!payeeName) {
      return res.status(400).json({ success: false, message: 'Payee name is required' });
    }

    const count = isDbConnected() ? await PaymentVoucher.countDocuments() : memPaymentVouchers.length;
    const voucherNo = `PV-2026-${String(count + 1).padStart(3, '0')}`;

    // Normalize line items
    const parsedItems = Array.isArray(items) && items.length > 0
      ? items.map((i) => ({
          particulars: i.particulars || 'Expense Item',
          account: i.account || '',
          amountRs: Number(i.amountRs) || 0,
          amountCts: Number(i.amountCts) || 0,
          totalLineAmount: Number(i.totalLineAmount) || Number(i.amountRs) || 0,
        }))
      : [
          {
            particulars: 'General Expense',
            account: '',
            amountRs: Number(totalAmount) || 0,
            amountCts: 0,
            totalLineAmount: Number(totalAmount) || 0,
          },
        ];

    const calculatedTotal =
      parsedItems.reduce((sum, item) => sum + (Number(item.totalLineAmount) || 0), 0) || Number(totalAmount) || 0;

    const newVoucherData = {
      voucherNo,
      date: new Date(),
      dateFormatted: dateFormatted || new Date().toLocaleDateString('en-GB'),
      payeeName: payeeName.trim(),
      payeeNote: payeeNote || '',
      bank: bank || 'PEB',
      branch: branch || 'Horana',
      chequeNo: chequeNo || 'TFR',
      items: parsedItems,
      totalAmount: calculatedTotal,
      amountInWords: amountInWords || '',
      preparedBy: preparedBy || 'User',
      preparedDate: new Date(),
      checkedBy: 'Accountant',
      receivedByName: receivedByName || payeeName.trim(),
      receivedByIdNumber: receivedByIdNumber || '',
      receivedByDate: new Date(),
      status: 'Pending',
      adminRemarks: '',
      attachments: Array.isArray(attachments) ? attachments : [],
    };

    if (isDbConnected()) {
      const voucher = new PaymentVoucher(newVoucherData);
      await voucher.save();
      return res.status(201).json({ success: true, message: 'Voucher submitted successfully for approval', data: voucher });
    }

    const newMem = {
      _id: 'pv_' + Date.now(),
      ...newVoucherData,
    };
    memPaymentVouchers.unshift(newMem);
    return res.status(201).json({ success: true, message: 'Voucher submitted successfully for approval', data: newMem });
  } catch (error) {
    next(error);
  }
};

export const updatePaymentVoucherStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, approvedBy = 'admin', adminRemarks = '' } = req.body;

    if (isDbConnected()) {
      const voucher = await PaymentVoucher.findById(id);
      if (!voucher) return res.status(404).json({ success: false, message: 'Payment voucher not found' });

      voucher.status = status;
      voucher.adminRemarks = adminRemarks;
      if (status === 'Approved') {
        voucher.approvedBy = approvedBy;
        voucher.approvedAt = new Date();
      } else if (status === 'Rejected') {
        voucher.approvedBy = approvedBy;
        voucher.approvedAt = new Date();
      }
      await voucher.save();
      return res.status(200).json({ success: true, message: `Voucher ${voucher.voucherNo} marked as ${status}!`, data: voucher });
    }

    const v = memPaymentVouchers.find((item) => item._id === id || item.voucherNo === id);
    if (!v) return res.status(404).json({ success: false, message: 'Payment voucher not found' });
    v.status = status;
    v.adminRemarks = adminRemarks;
    if (status === 'Approved' || status === 'Rejected') {
      v.approvedBy = approvedBy;
      v.approvedAt = new Date();
    }
    return res.status(200).json({ success: true, message: `Voucher ${v.voucherNo} marked as ${status}!`, data: v });
  } catch (error) {
    next(error);
  }
};

// ---------------- Petty Cash / Expenses Reimbursement Handlers ----------------

export const getPettyCash = async (req, res, next) => {
  try {
    if (isDbConnected()) {
      await seedIfEmpty();
      const records = await PettyCash.find().sort({ createdAt: -1 });
      return res.status(200).json({ success: true, data: records });
    }
    return res.status(200).json({ success: true, data: memPettyCash });
  } catch (error) {
    next(error);
  }
};

export const createPettyCash = async (req, res, next) => {
  try {
    const {
      name,
      dateFormatted,
      subject,
      reimbursementDate,
      items = [],
      amount,
      notes,
      requestedBy,
      checkedBy,
      department,
      category,
      purpose,
      remarks,
      attachments = [],
    } = req.body;

    const requesterName = (name || requestedBy || '').trim();
    if (!requesterName) {
      return res.status(400).json({ success: false, message: 'Requester / Employee Name is required' });
    }

    let parsedItems = [];
    if (Array.isArray(items) && items.length > 0) {
      parsedItems = items
        .filter((it) => it && it.description && String(it.description).trim() !== '')
        .map((it) => ({
          description: String(it.description).trim(),
          amount: Number(it.amount) || 0,
        }));
    }

    const calculatedTotal =
      parsedItems.length > 0
        ? parsedItems.reduce((sum, it) => sum + it.amount, 0)
        : Number(amount) || 0;

    if (calculatedTotal <= 0) {
      return res.status(400).json({ success: false, message: 'Total reimbursement amount must be greater than 0' });
    }

    const count = isDbConnected() ? await PettyCash.countDocuments() : memPettyCash.length;
    const voucherNo = `ERF-2026-${String(count + 1).padStart(3, '0')}`;

    const data = {
      voucherNo,
      name: requesterName,
      date: new Date(),
      dateFormatted: dateFormatted || new Date().toLocaleDateString('en-GB'),
      subject: (subject || purpose || 'Petty Cash Expense Reimbursement').trim(),
      reimbursementDate: reimbursementDate || new Date().toLocaleDateString('en-GB'),
      items: parsedItems.length > 0 ? parsedItems : [{ description: purpose || subject || 'Petty Cash Expense', amount: calculatedTotal }],
      amount: calculatedTotal,
      notes: notes || remarks || '',
      requestedBy: requesterName,
      checkedBy: checkedBy || 'Accountant',
      department: department || 'General',
      category: category || 'Office Supplies',
      purpose: (purpose || subject || 'Petty Cash Reimbursement').trim(),
      remarks: remarks || '',
      attachments: Array.isArray(attachments) ? attachments : [],
      status: 'Pending',
      approvedBy: null,
      approvedAt: null,
    };

    if (isDbConnected()) {
      const newPc = new PettyCash(data);
      await newPc.save();
      return res.status(201).json({ success: true, message: 'Expenses reimbursement form submitted successfully!', data: newPc });
    }

    const newMem = {
      _id: 'erf_' + Date.now(),
      ...data,
    };
    memPettyCash.unshift(newMem);
    return res.status(201).json({ success: true, message: 'Expenses reimbursement form submitted successfully!', data: newMem });
  } catch (error) {
    next(error);
  }
};

export const updatePettyCashStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, approvedBy = 'admin', remarks = '' } = req.body;

    if (isDbConnected()) {
      const pc = await PettyCash.findById(id);
      if (!pc) return res.status(404).json({ success: false, message: 'Reimbursement voucher not found' });
      pc.status = status;
      if (status === 'Approved') {
        pc.approvedBy = approvedBy;
        pc.approvedAt = new Date();
      } else if (status === 'Rejected') {
        pc.approvedBy = approvedBy;
        pc.approvedAt = new Date();
      }
      if (remarks) pc.remarks = remarks;
      await pc.save();
      return res.status(200).json({ success: true, message: `Reimbursement ${pc.voucherNo} marked as ${status}!`, data: pc });
    }

    const pc = memPettyCash.find((item) => item._id === id || item.voucherNo === id);
    if (!pc) return res.status(404).json({ success: false, message: 'Reimbursement voucher not found' });
    pc.status = status;
    if (status === 'Approved' || status === 'Rejected') {
      pc.approvedBy = approvedBy;
      pc.approvedAt = new Date();
    }
    if (remarks) pc.remarks = remarks;
    return res.status(200).json({ success: true, message: `Reimbursement ${pc.voucherNo} marked as ${status}!`, data: pc });
  } catch (error) {
    next(error);
  }
};

// ---------------- Spendable Limit Handlers ----------------

export const getPettyCashLimit = async (req, res, next) => {
  try {
    let limitDoc;
    let approvedPettyCashList = [];
    let pendingPettyCashList = [];

    if (isDbConnected()) {
      await seedIfEmpty();
      limitDoc = await PettyCashLimit.findOne().sort({ createdAt: -1 });
      if (!limitDoc) {
        limitDoc = await PettyCashLimit.create(initialPettyCashLimit);
      }
      approvedPettyCashList = await PettyCash.find({ status: 'Approved' });
      pendingPettyCashList = await PettyCash.find({ status: 'Pending' });
    } else {
      limitDoc = memPettyCashLimit;
      approvedPettyCashList = memPettyCash.filter((item) => item.status === 'Approved');
      pendingPettyCashList = memPettyCash.filter((item) => item.status === 'Pending');
    }

    const totalLimit = Number(limitDoc.totalLimit) || 50000;
    const totalSpent = approvedPettyCashList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const pendingAmount = pendingPettyCashList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const remainingLimit = Math.max(0, totalLimit - totalSpent);

    return res.status(200).json({
      success: true,
      data: {
        totalLimit,
        totalSpent,
        remainingLimit,
        pendingAmount,
        approvedCount: approvedPettyCashList.length,
        pendingCount: pendingPettyCashList.length,
        period: limitDoc.period || 'Monthly (October 2026)',
        setBy: limitDoc.setBy || 'Admin',
        lastUpdated: limitDoc.lastUpdated || limitDoc.updatedAt || new Date(),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updatePettyCashLimit = async (req, res, next) => {
  try {
    const { totalLimit, period, setBy = 'Admin' } = req.body;
    if (totalLimit === undefined || totalLimit === null || isNaN(Number(totalLimit))) {
      return res.status(400).json({ success: false, message: 'Valid totalLimit amount is required' });
    }

    const newLimitVal = Math.max(0, Number(totalLimit));
    let limitDoc;

    if (isDbConnected()) {
      limitDoc = await PettyCashLimit.findOne().sort({ createdAt: -1 });
      if (!limitDoc) {
        limitDoc = new PettyCashLimit({
          totalLimit: newLimitVal,
          period: period || 'Monthly',
          setBy,
          lastUpdated: new Date(),
        });
      } else {
        limitDoc.totalLimit = newLimitVal;
        if (period) limitDoc.period = period;
        limitDoc.setBy = setBy;
        limitDoc.lastUpdated = new Date();
      }
      await limitDoc.save();
    } else {
      memPettyCashLimit = {
        ...memPettyCashLimit,
        totalLimit: newLimitVal,
        period: period || memPettyCashLimit.period,
        setBy,
        lastUpdated: new Date(),
      };
      limitDoc = memPettyCashLimit;
    }

    return getPettyCashLimit(req, res, next);
  } catch (error) {
    next(error);
  }
};

// ---------------- Leave Request Handlers ----------------

export const getLeaveRequests = async (req, res, next) => {
  try {
    if (isDbConnected()) {
      await seedIfEmpty();
      const leaves = await LeaveRequest.find().sort({ createdAt: -1 });
      return res.status(200).json({ success: true, data: leaves });
    }
    return res.status(200).json({ success: true, data: memLeaveRequests });
  } catch (error) {
    next(error);
  }
};

export const createLeaveRequest = async (req, res, next) => {
  try {
    const { employeeName, leaveType, startDate, endDate, numberOfDays, reason, remarks } = req.body;
    if (!employeeName || !startDate || !endDate || !reason) {
      return res.status(400).json({ success: false, message: 'Employee, dates, and reason are required' });
    }

    const count = isDbConnected() ? await LeaveRequest.countDocuments() : memLeaveRequests.length;
    const requestNo = `LR-2026-${String(count + 1).padStart(3, '0')}`;

    const data = {
      requestNo,
      date: new Date(),
      employeeName: employeeName.trim(),
      leaveType: leaveType || 'Annual',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      numberOfDays: Number(numberOfDays) || 1,
      reason: reason.trim(),
      remarks: remarks || '',
      status: 'Pending',
    };

    if (isDbConnected()) {
      const newLeave = new LeaveRequest(data);
      await newLeave.save();
      return res.status(201).json({ success: true, data: newLeave });
    }

    const newMem = {
      _id: 'lr_' + Date.now(),
      ...data,
      approvedBy: null,
      approvedAt: null,
    };
    memLeaveRequests.unshift(newMem);
    return res.status(201).json({ success: true, data: newMem });
  } catch (error) {
    next(error);
  }
};

export const updateLeaveRequestStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, approvedBy = 'admin', remarks = '' } = req.body;

    if (isDbConnected()) {
      const lr = await LeaveRequest.findById(id);
      if (!lr) return res.status(404).json({ success: false, message: 'Leave request not found' });
      lr.status = status;
      if (status === 'Approved') {
        lr.approvedBy = approvedBy;
        lr.approvedAt = new Date();
      }
      if (remarks) lr.remarks = remarks;
      await lr.save();
      return res.status(200).json({ success: true, data: lr });
    }

    const lr = memLeaveRequests.find((item) => item._id === id);
    if (!lr) return res.status(404).json({ success: false, message: 'Leave request not found' });
    lr.status = status;
    if (status === 'Approved') {
      lr.approvedBy = approvedBy;
      lr.approvedAt = new Date();
    }
    if (remarks) lr.remarks = remarks;
    return res.status(200).json({ success: true, data: lr });
  } catch (error) {
    next(error);
  }
};
