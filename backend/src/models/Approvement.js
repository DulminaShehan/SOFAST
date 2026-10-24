import mongoose from 'mongoose';

// Payment Voucher Schema
const paymentVoucherSchema = new mongoose.Schema(
  {
    voucherNo: { type: String, required: true, unique: true },
    date: { type: Date, default: Date.now },
    payeeName: { type: String, required: true },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, default: 'Bank Transfer' },
    description: { type: String, default: '' },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    approvedBy: { type: String, default: null },
    approvedAt: { type: Date, default: null },
    remarks: { type: String, default: '' },
  },
  { timestamps: true }
);

// Petty Cash Schema
const pettyCashSchema = new mongoose.Schema(
  {
    voucherNo: { type: String, required: true, unique: true },
    date: { type: Date, default: Date.now },
    requestedBy: { type: String, required: true },
    department: { type: String, default: 'General' },
    amount: { type: Number, required: true },
    category: { type: String, default: 'Office Supplies' },
    purpose: { type: String, required: true },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    approvedBy: { type: String, default: null },
    approvedAt: { type: Date, default: null },
    remarks: { type: String, default: '' },
  },
  { timestamps: true }
);

// Leave Request Schema
const leaveRequestSchema = new mongoose.Schema(
  {
    requestNo: { type: String, required: true, unique: true },
    date: { type: Date, default: Date.now },
    employeeName: { type: String, required: true },
    leaveType: { type: String, enum: ['Annual', 'Casual', 'Medical', 'Half-Day'], default: 'Annual' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    numberOfDays: { type: Number, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    approvedBy: { type: String, default: null },
    approvedAt: { type: Date, default: null },
    remarks: { type: String, default: '' },
  },
  { timestamps: true }
);

export const PaymentVoucher =
  mongoose.models.PaymentVoucher || mongoose.model('PaymentVoucher', paymentVoucherSchema);

export const PettyCash =
  mongoose.models.PettyCash || mongoose.model('PettyCash', pettyCashSchema);

export const LeaveRequest =
  mongoose.models.LeaveRequest || mongoose.model('LeaveRequest', leaveRequestSchema);
