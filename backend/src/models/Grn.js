import mongoose from 'mongoose';

/**
 * Good Receive Note (GRN) Schema
 * Maps to existing 'grns' collection in MongoDB Atlas 'sofast_pos' database.
 */
const lineItemSchema = new mongoose.Schema({
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
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0, 'Quantity must be non-negative'],
    default: 1,
  },
  qty: {
    type: Number,
    default: 1,
  },
  unitPrice: {
    type: Number,
    required: [true, 'Unit price is required'],
    default: 0,
  },
  rate: {
    type: Number,
    default: 0,
  },
  sellingPrice: {
    type: Number,
    default: 0,
  },
  discount: {
    type: Number,
    default: 0,
  },
  totalValue: {
    type: Number,
    default: 0,
  },
  value: {
    type: Number,
    default: 0,
  },
  locationCode: {
    type: String,
    trim: true,
    default: 'MAIN',
  },
});

const grnSchema = new mongoose.Schema(
  {
    no: {
      type: Number,
      index: true,
    },
    grnNumber: {
      type: String,
      trim: true,
      unique: true,
      index: true,
    },
    supplierCode: {
      type: String,
      trim: true,
      required: [true, 'Supplier code is required'],
      index: true,
    },
    supplier: {
      type: String,
      trim: true,
      default: '',
    },
    supplierName: {
      type: String,
      trim: true,
      default: '',
    },
    supplierInvoiceNo: {
      type: String,
      trim: true,
      default: '',
    },
    invoice: {
      type: String,
      trim: true,
      default: '',
    },
    paidBy: {
      type: String,
      trim: true,
      default: 'Cash',
    },
    masterPo: {
      type: String,
      trim: true,
      default: '',
    },
    useBarcode: {
      type: Boolean,
      default: false,
    },
    lineItems: {
      type: [lineItemSchema],
      default: [],
    },
    grnValue: {
      type: Number,
      default: 0,
    },
    totalValue: {
      type: Number,
      default: 0,
    },
    setValue: {
      type: Number,
      default: 0,
    },
    returnValue: {
      type: Number,
      default: 0,
    },
    isPosted: {
      type: Boolean,
      default: true,
    },
    paymentStatus: {
      type: String,
      trim: true,
      default: 'pending',
    },
    date: {
      type: Date,
      default: Date.now,
    },
    remark: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    collection: 'grns',
    strict: false,
  }
);

const Grn = mongoose.models.Grn || mongoose.model('Grn', grnSchema);

export default Grn;
