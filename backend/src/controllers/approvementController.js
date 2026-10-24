import mongoose from 'mongoose';
import { PaymentVoucher, PettyCash, LeaveRequest } from '../models/Approvement.js';
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
    voucherNo: 'PC-2026-001',
    date: new Date('2026-10-22'),
    requestedBy: 'Sunil Shantha',
    department: 'POS Cashier Counter',
    amount: 4500,
    category: 'Office Supplies',
    purpose: 'Thermal receipt rolls (80mm x 20 rolls) & ink pens',
    status: 'Approved',
    approvedBy: 'admin',
    approvedAt: new Date('2026-10-22'),
    remarks: 'Cash handed over',
  },
  {
    voucherNo: 'PC-2026-002',
    date: new Date('2026-10-24'),
    requestedBy: 'Nimal Bandara',
    department: 'Workshop',
    amount: 3200,
    category: 'Workshop Refreshments',
    purpose: 'Staff tea & overtime refreshments for Saturday shift',
    status: 'Pending',
    approvedBy: null,
    approvedAt: null,
    remarks: '',
  },
];

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

// ---------------- Petty Cash Handlers ----------------

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
    const { requestedBy, department, amount, category, purpose, remarks, attachments = [] } = req.body;
    if (!requestedBy || !amount || !purpose) {
      return res.status(400).json({ success: false, message: 'Requester, amount, and purpose are required' });
    }

    const count = isDbConnected() ? await PettyCash.countDocuments() : memPettyCash.length;
    const voucherNo = `PC-2026-${String(count + 1).padStart(3, '0')}`;

    const data = {
      voucherNo,
      date: new Date(),
      requestedBy: requestedBy.trim(),
      department: department || 'General',
      amount: Number(amount),
      category: category || 'Office Supplies',
      purpose: purpose.trim(),
      remarks: remarks || '',
      attachments,
      status: 'Pending',
    };

    if (isDbConnected()) {
      const newPc = new PettyCash(data);
      await newPc.save();
      return res.status(201).json({ success: true, data: newPc });
    }

    const newMem = {
      _id: 'pc_' + Date.now(),
      ...data,
      approvedBy: null,
      approvedAt: null,
    };
    memPettyCash.unshift(newMem);
    return res.status(201).json({ success: true, data: newMem });
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
      if (!pc) return res.status(404).json({ success: false, message: 'Petty cash voucher not found' });
      pc.status = status;
      if (status === 'Approved') {
        pc.approvedBy = approvedBy;
        pc.approvedAt = new Date();
      }
      if (remarks) pc.remarks = remarks;
      await pc.save();
      return res.status(200).json({ success: true, data: pc });
    }

    const pc = memPettyCash.find((item) => item._id === id);
    if (!pc) return res.status(404).json({ success: false, message: 'Petty cash voucher not found' });
    pc.status = status;
    if (status === 'Approved') {
      pc.approvedBy = approvedBy;
      pc.approvedAt = new Date();
    }
    if (remarks) pc.remarks = remarks;
    return res.status(200).json({ success: true, data: pc });
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
