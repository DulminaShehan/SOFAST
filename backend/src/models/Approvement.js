import mongoose from 'mongoose';

// Item Schema within Payment Voucher
const voucherItemSchema = new mongoose.Schema({
  particulars: { type: String, required: true },
  account: { type: String, default: '' },
  amountRs: { type: Number, default: 0 },
  amountCts: { type: Number, default: 0 },
  totalLineAmount: { type: Number, required: true },
});

// Attachment Schema for bills/receipts (CEB, SLT, SMS photo, etc.)
const attachmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, default: 'image/jpeg' },
  dataUrl: { type: String, required: true }, // Base64 data URL for instant viewing
  size: { type: Number, default: 0 },
  uploadedAt: { type: Date, default: Date.now },
});

// Payment Voucher Schema matching PDF structure
const paymentVoucherSchema = new mongoose.Schema(
  {
    voucherNo: { type: String, required: true, unique: true },
    date: { type: Date, default: Date.now },
    dateFormatted: { type: String, default: '' }, // e.g. 04/05/2026
    payeeName: { type: String, required: true },
    payeeNote: { type: String, default: '' }, // e.g. (Monthly Ex - Oct 26)
    bank: { type: String, default: 'PEB' },
    branch: { type: String, default: 'Horana' },
    chequeNo: { type: String, default: 'TFR' },
    items: [voucherItemSchema],
    totalAmount: { type: Number, required: true, default: 0 },
    amountInWords: { type: String, default: '' },
    preparedBy: { type: String, required: true }, // Username or Staff Name
    preparedDate: { type: Date, default: Date.now },
    checkedBy: { type: String, default: '' },
    approvedBy: { type: String, default: null },
    approvedAt: { type: Date, default: null },
    receivedByName: { type: String, default: '' },
    receivedByIdNumber: { type: String, default: '' },
    receivedByDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
    },
    adminRemarks: { type: String, default: '' },
    attachments: [attachmentSchema],
  },
  { timestamps: true }
);

// Petty Cash Line Item Schema
const pettyCashItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  amount: { type: Number, required: true, default: 0 },
});

// Petty Cash / Expenses Reimbursement Form Schema matching PDF
const pettyCashSchema = new mongoose.Schema(
  {
    voucherNo: { type: String, required: true, unique: true },
    name: { type: String, required: true }, // Name on form
    date: { type: Date, default: Date.now },
    dateFormatted: { type: String, default: '' },
    subject: { type: String, default: '' },
    reimbursementDate: { type: String, default: '' },
    items: [pettyCashItemSchema],
    amount: { type: Number, required: true, default: 0 }, // Total Amount
    notes: { type: String, default: '' }, // 3 dotted lines below table
    requestedBy: { type: String, required: true },
    checkedBy: { type: String, default: 'Accountant' },
    department: { type: String, default: 'General' },
    category: { type: String, default: 'Office Supplies' },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    approvedBy: { type: String, default: null },
    approvedAt: { type: Date, default: null },
    remarks: { type: String, default: '' },
    attachments: [attachmentSchema],
  },
  { timestamps: true }
);

// Spendable Limit Schema for Petty Cash Fund Allocation
const pettyCashLimitSchema = new mongoose.Schema(
  {
    totalLimit: { type: Number, default: 50000 },
    period: { type: String, default: 'Monthly' },
    setBy: { type: String, default: 'admin' },
    lastUpdated: { type: Date, default: Date.now },
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

export const PettyCashLimit =
  mongoose.models.PettyCashLimit || mongoose.model('PettyCashLimit', pettyCashLimitSchema);

export const LeaveRequest =
  mongoose.models.LeaveRequest || mongoose.model('LeaveRequest', leaveRequestSchema);

