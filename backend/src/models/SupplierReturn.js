import mongoose from 'mongoose';

/**
 * Supplier Return / Good Return Note (GREN) Mongoose Schema
 * Maps to existing 'supplierreturns' collection in MongoDB Atlas 'sofast_pos' database.
 */
const returnLineItemSchema = new mongoose.Schema({
  no: {
    type: Number,
    default: 1,
  },
  itemCode: {
    type: String,
    trim: true,
    required: [true, 'Item code is required'],
  },
  code: {
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
    required: true,
    min: [0, 'Quantity must be non-negative'],
    default: 0,
  },
  qty: {
    type: Number,
    default: 0,
  },
  unitPrice: {
    type: Number,
    required: true,
    default: 0,
  },
  rate: {
    type: Number,
    default: 0,
  },
  discount: {
    type: Number,
    default: 0,
  },
  qtyReturn: {
    type: Number,
    required: true,
    min: [0.001, 'Return quantity must be greater than zero'],
    default: 0,
  },
  returnQuantity: {
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
  returnValue: {
    type: Number,
    default: 0,
  },
  locationCode: {
    type: String,
    trim: true,
    default: 'MAIN',
  },
});

const supplierReturnSchema = new mongoose.Schema(
  {
    no: {
      type: Number,
      required: true,
      index: true,
    },
    returnNumber: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    grenNumber: {
      type: String,
      trim: true,
      index: true,
    },
    grnReference: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    grnNumber: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    supplierCode: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    supplierName: {
      type: String,
      trim: true,
      default: '',
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    time: {
      type: String,
      trim: true,
      default: () => new Date().toLocaleTimeString(),
    },
    userCode: {
      type: String,
      trim: true,
      default: 'PC004',
    },
    lineItems: {
      type: [returnLineItemSchema],
      default: [],
    },
    returnTotal: {
      type: Number,
      default: 0,
    },
    totalReturnValue: {
      type: Number,
      default: 0,
    },
    isPosted: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      trim: true,
      enum: ['active', 'deleted'],
      default: 'active',
      index: true,
    },
    stockDeducted: {
      type: Boolean,
      default: true,
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    collection: 'supplierreturns',
    strict: false,
  }
);

// Virtual alias: grenNumber maps to returnNumber
supplierReturnSchema.virtual('grenNo').get(function () {
  return this.returnNumber || String(this.no);
});

const SupplierReturn =
  mongoose.models.SupplierReturn || mongoose.model('SupplierReturn', supplierReturnSchema);

export default SupplierReturn;
