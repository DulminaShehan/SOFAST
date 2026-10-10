import mongoose from 'mongoose';

/**
 * Settlement / Invoice Payment Schema
 * Stores payment transactions recorded against existing Sales Invoices.
 * Maps to 'invoicesettlements' collection in MongoDB Atlas.
 */
const settlementSchema = new mongoose.Schema(
  {
    receiptNo: {
      type: String,
      trim: true,
      unique: true,
      index: true,
      required: [true, 'Receipt number is required'],
    },
    no: {
      type: Number,
      index: true,
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      index: true,
    },
    invoiceNumber: {
      type: String,
      trim: true,
      required: [true, 'Invoice number is required'],
      index: true,
    },
    customerCode: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    customerName: {
      type: String,
      trim: true,
      default: '',
    },
    date: {
      type: Date,
      default: Date.now,
    },
    amount: {
      type: Number,
      required: [true, 'Settlement amount is required'],
      min: [0.01, 'Settlement amount must be greater than 0'],
    },
    method: {
      type: String,
      trim: true,
      enum: ['Cash', 'Cheque', 'Credit Note', 'Bank', 'Other'],
      default: 'Cash',
    },
    received: {
      type: Number,
      default: 0,
    },
    chequeNo: {
      type: String,
      trim: true,
      default: '',
    },
    bank: {
      type: String,
      trim: true,
      default: '',
    },
    dateRealized: {
      type: String,
      trim: true,
      default: '',
    },
    specialDiscountType: {
      type: String,
      trim: true,
      default: '',
    },
    specialDiscountAmount: {
      type: Number,
      default: 0,
    },
    specialDiscountBasis: {
      type: String,
      trim: true,
      enum: ['balance', 'special_amount', 'none'],
      default: 'balance',
    },
    specialAmount: {
      type: Number,
      default: 0,
    },
    balanceBefore: {
      type: Number,
      default: 0,
    },
    balanceAfter: {
      type: Number,
      default: 0,
    },
    remark: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: String,
      trim: true,
      default: 'Admin',
    },
  },
  {
    timestamps: true,
    collection: 'invoicesettlements',
    strict: false,
  }
);

const Settlement = mongoose.models.Settlement || mongoose.model('Settlement', settlementSchema);

export default Settlement;
