import mongoose from 'mongoose';
import { PaymentVoucher, PettyCash, LeaveRequest } from '../models/Approvement.js';

const isDbConnected = () => mongoose.connection.readyState === 1;

// Seed initial demo data for immediate rich display
const initialPaymentVouchers = [
  {
    _id: 'pv_001',
    voucherNo: 'PV-2026-001',
    date: new Date('2026-10-20'),
    payeeName: 'Toyota Lanka (Pvt) Ltd',
    amount: 145000,
    paymentMethod: 'Bank Transfer',
    description: 'Bulk Brake Pad & Oil Filter Supplier Payment (GRN-8821)',
    status: 'Approved',
    approvedBy: 'admin',
    approvedAt: new Date('2026-10-21'),
    remarks: 'Verified against invoice and store GRN',
  },
  {
    _id: 'pv_002',
    voucherNo: 'PV-2026-002',
    date: new Date('2026-10-23'),
    payeeName: 'Micro Cars Limited',
    amount: 87500,
    paymentMethod: 'Cheque',
    description: 'Quarterly Shock Absorber Batch Settled',
    status: 'Pending',
    approvedBy: null,
    approvedAt: null,
    remarks: '',
  },
];

const initialPettyCash = [
  {
    _id: 'pc_001',
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
    _id: 'pc_002',
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
    _id: 'lr_001',
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
  {
    _id: 'lr_002',
    requestNo: 'LR-2026-002',
    date: new Date('2026-10-24'),
    employeeName: 'Chaminda Fernando',
    leaveType: 'Medical',
    startDate: new Date('2026-10-27'),
    endDate: new Date('2026-10-28'),
    numberOfDays: 2,
    reason: 'Medical appointment & specialist consultation',
    status: 'Pending',
    approvedBy: null,
    approvedAt: null,
    remarks: '',
  },
];

let memPaymentVouchers = [...initialPaymentVouchers];
let memPettyCash = [...initialPettyCash];
let memLeaveRequests = [...initialLeaveRequests];

// Helper to seed Mongo if empty
const seedIfEmpty = async () => {
  if (!isDbConnected()) return;
  try {
    const pvCount = await PaymentVoucher.countDocuments();
    if (pvCount === 0) {
      await PaymentVoucher.insertMany(
        initialPaymentVouchers.map(({ _id, ...rest }) => rest)
      );
    }
    const pcCount = await PettyCash.countDocuments();
    if (pcCount === 0) {
      await PettyCash.insertMany(
        initialPettyCash.map(({ _id, ...rest }) => rest)
      );
    }
    const lrCount = await LeaveRequest.countDocuments();
    if (lrCount === 0) {
      await LeaveRequest.insertMany(
        initialLeaveRequests.map(({ _id, ...rest }) => rest)
      );
    }
  } catch (e) {
    console.error('Error seeding approvement data:', e.message);
  }
};

// ---------------- Payment Voucher Handlers ----------------

export const getPaymentVouchers = async (req, res, next) => {
  try {
    if (isDbConnected()) {
      await seedIfEmpty();
      const vouchers = await PaymentVoucher.find().sort({ createdAt: -1 });
      return res.status(200).json({ success: true, data: vouchers });
    }
    return res.status(200).json({ success: true, data: memPaymentVouchers });
  } catch (error) {
    next(error);
  }
};

export const createPaymentVoucher = async (req, res, next) => {
  try {
    const { payeeName, amount, paymentMethod, description, remarks } = req.body;
    if (!payeeName || !amount) {
      return res.status(400).json({ success: false, message: 'Payee and amount are required' });
    }

    const count = isDbConnected() ? await PaymentVoucher.countDocuments() : memPaymentVouchers.length;
    const voucherNo = `PV-2026-${String(count + 1).padStart(3, '0')}`;

    if (isDbConnected()) {
      const newVoucher = new PaymentVoucher({
        voucherNo,
        payeeName: payeeName.trim(),
        amount: Number(amount),
        paymentMethod: paymentMethod || 'Bank Transfer',
        description: description || '',
        remarks: remarks || '',
      });
      await newVoucher.save();
      return res.status(201).json({ success: true, data: newVoucher });
    }

    const newMem = {
      _id: 'pv_' + Date.now(),
      voucherNo,
      date: new Date(),
      payeeName: payeeName.trim(),
      amount: Number(amount),
      paymentMethod: paymentMethod || 'Bank Transfer',
      description: description || '',
      status: 'Pending',
      approvedBy: null,
      approvedAt: null,
      remarks: remarks || '',
    };
    memPaymentVouchers.unshift(newMem);
    return res.status(201).json({ success: true, data: newMem });
  } catch (error) {
    next(error);
  }
};

export const updatePaymentVoucherStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, approvedBy, remarks } = req.body;

    if (isDbConnected()) {
      const voucher = await PaymentVoucher.findById(id);
      if (!voucher) return res.status(404).json({ success: false, message: 'Voucher not found' });
      voucher.status = status;
      if (status === 'Approved') {
        voucher.approvedBy = approvedBy || 'admin';
        voucher.approvedAt = new Date();
      }
      if (remarks) voucher.remarks = remarks;
      await voucher.save();
      return res.status(200).json({ success: true, data: voucher });
    }

    const v = memPaymentVouchers.find((item) => item._id === id);
    if (!v) return res.status(404).json({ success: false, message: 'Voucher not found' });
    v.status = status;
    if (status === 'Approved') {
      v.approvedBy = approvedBy || 'admin';
      v.approvedAt = new Date();
    }
    if (remarks) v.remarks = remarks;
    return res.status(200).json({ success: true, data: v });
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
    const { requestedBy, department, amount, category, purpose, remarks } = req.body;
    if (!requestedBy || !amount || !purpose) {
      return res.status(400).json({ success: false, message: 'Requester, amount, and purpose are required' });
    }

    const count = isDbConnected() ? await PettyCash.countDocuments() : memPettyCash.length;
    const voucherNo = `PC-2026-${String(count + 1).padStart(3, '0')}`;

    if (isDbConnected()) {
      const newPc = new PettyCash({
        voucherNo,
        requestedBy: requestedBy.trim(),
        department: department || 'General',
        amount: Number(amount),
        category: category || 'Office Supplies',
        purpose: purpose.trim(),
        remarks: remarks || '',
      });
      await newPc.save();
      return res.status(201).json({ success: true, data: newPc });
    }

    const newMem = {
      _id: 'pc_' + Date.now(),
      voucherNo,
      date: new Date(),
      requestedBy: requestedBy.trim(),
      department: department || 'General',
      amount: Number(amount),
      category: category || 'Office Supplies',
      purpose: purpose.trim(),
      status: 'Pending',
      approvedBy: null,
      approvedAt: null,
      remarks: remarks || '',
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
    const { status, approvedBy, remarks } = req.body;

    if (isDbConnected()) {
      const pc = await PettyCash.findById(id);
      if (!pc) return res.status(404).json({ success: false, message: 'Petty cash voucher not found' });
      pc.status = status;
      if (status === 'Approved') {
        pc.approvedBy = approvedBy || 'admin';
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
      pc.approvedBy = approvedBy || 'admin';
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

    if (isDbConnected()) {
      const newLeave = new LeaveRequest({
        requestNo,
        employeeName: employeeName.trim(),
        leaveType: leaveType || 'Annual',
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        numberOfDays: Number(numberOfDays) || 1,
        reason: reason.trim(),
        remarks: remarks || '',
      });
      await newLeave.save();
      return res.status(201).json({ success: true, data: newLeave });
    }

    const newMem = {
      _id: 'lr_' + Date.now(),
      requestNo,
      date: new Date(),
      employeeName: employeeName.trim(),
      leaveType: leaveType || 'Annual',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      numberOfDays: Number(numberOfDays) || 1,
      reason: reason.trim(),
      status: 'Pending',
      approvedBy: null,
      approvedAt: null,
      remarks: remarks || '',
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
    const { status, approvedBy, remarks } = req.body;

    if (isDbConnected()) {
      const lr = await LeaveRequest.findById(id);
      if (!lr) return res.status(404).json({ success: false, message: 'Leave request not found' });
      lr.status = status;
      if (status === 'Approved') {
        lr.approvedBy = approvedBy || 'admin';
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
      lr.approvedBy = approvedBy || 'admin';
      lr.approvedAt = new Date();
    }
    if (remarks) lr.remarks = remarks;
    return res.status(200).json({ success: true, data: lr });
  } catch (error) {
    next(error);
  }
};
