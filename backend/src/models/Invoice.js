import mongoose from 'mongoose';

/**
 * Invoice Line Item Schema
 */
const invoiceLineItemSchema = new mongoose.Schema({
  code: {
    type: String,
    trim: true,
    required: [true, 'Item code is required'],
  },
  itemCode: {
    type: String,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
  location: {
    type: String,
    trim: true,
    default: 'Main Store',
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0.01, 'Quantity must be greater than 0'],
    default: 1,
  },
  qty: {
    type: Number,
    default: 1,
  },
  masterPack: {
    type: String,
    default: '1',
  },
  rateType: {
    type: String,
    default: 'Retail',
  },
  rate: {
    type: Number,
    default: 0,
  },
  price: {
    type: Number,
    default: 0,
  },
  unitPrice: {
    type: Number,
    default: 0,
  },
  itemCost: {
    type: Number,
    default: 0,
  },
  mpCost: {
    type: Number,
    default: 0,
  },
  discountPercentage: {
    type: Number,
    default: 0,
  },
  discountAmount: {
    type: Number,
    default: 0,
  },
  value: {
    type: Number,
    default: 0,
  },
  total: {
    type: Number,
    default: 0,
  },
  balance: {
    type: Number,
    default: 0,
  },
});

/**
 * Invoice Schema
 * Maps to existing 'invoices' collection in MongoDB Atlas 'sofast_pos' database.
 */
const invoiceSchema = new mongoose.Schema(
  {
    no: {
      type: Number,
      index: true,
    },
    invoiceNumber: {
      type: String,
      trim: true,
      unique: true,
      index: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    customerCode: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    cuscode: {
      type: String,
      trim: true,
      default: '',
    },
    customerName: {
      type: String,
      trim: true,
      default: '',
    },
    cusname: {
      type: String,
      trim: true,
      default: '',
    },
    customerAddress: {
      type: String,
      trim: true,
      default: '',
    },
    customerTelephone: {
      type: String,
      trim: true,
      default: '',
    },
    telephone: {
      type: String,
      trim: true,
      default: '',
    },
    jobType: {
      type: String,
      trim: true,
      default: 'Material',
    },
    jd: {
      type: String,
      trim: true,
      default: 'Invoice',
    },
    isHold: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      trim: true,
      default: 'completed',
    },
    remark: {
      type: String,
      trim: true,
      default: '',
    },
    lineItems: {
      type: [invoiceLineItemSchema],
      default: [],
    },
    subTotal: {
      type: Number,
      default: 0,
    },
    specialDiscount: {
      type: Number,
      default: 0,
    },
    amountToPay: {
      type: Number,
      default: 0,
    },
    netTotal: {
      type: Number,
      default: 0,
    },
    value: {
      type: Number,
      default: 0,
    },
    amountReceived: {
      type: Number,
      default: 0,
    },
    cashReceived: {
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
    dueAmount: {
      type: Number,
      default: 0,
    },
    isStockUpdated: {
      type: Boolean,
      default: false,
    },
    isCompleted: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'invoices',
    strict: false,
  }
);

const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);

export default Invoice;
