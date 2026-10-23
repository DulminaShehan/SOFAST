import mongoose from 'mongoose';

/**
 * Damage Line Item Sub-schema
 * Represents each damaged item row entered in the Data Entry of Damage form.
 */
const damageLineItemSchema = new mongoose.Schema({
  itemCode: {
    type: String,
    required: [true, 'Item code is required'],
    trim: true,
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
  reference: {
    type: String,
    trim: true,
    default: '',
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0.001, 'Quantity must be greater than zero'],
  },
  qty: {
    type: Number,
    default: 1,
  },
  cost: {
    type: Number,
    default: 0,
  },
  unitCost: {
    type: Number,
    default: 0,
  },
  totalCost: {
    type: Number,
    default: 0,
  },
});

/**
 * Damage Mongoose Schema
 * Directly maps to existing 'damages' collection in MongoDB Atlas sofast_pos database.
 * Preserves legacy records (e.g. DMGN-0001, DMGN-0002) and supports full audit & stock safety.
 */
const damageSchema = new mongoose.Schema(
  {
    no: {
      type: Number,
      index: true,
    },
    damageNumber: {
      type: String,
      required: [true, 'Damage number is required'],
      trim: true,
      unique: true,
      index: true,
    },
    damageNo: {
      type: String,
      trim: true,
      index: true,
    },
    date: {
      type: Date,
      default: Date.now,
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
    supplierTelephone: {
      type: String,
      trim: true,
      default: '',
    },
    supplierAddress: {
      type: String,
      trim: true,
      default: '',
    },
    lineItems: {
      type: [damageLineItemSchema],
      default: [],
    },
    items: {
      type: [damageLineItemSchema],
      default: [],
    },
    notes: {
      type: Array,
      default: [],
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'posted', 'saved', 'cancelled'],
      default: 'active',
      index: true,
    },
    stockDeducted: {
      type: Boolean,
      default: true,
    },
    totalValue: {
      type: Number,
      default: 0,
    },
    recordedBy: {
      type: String,
      trim: true,
      default: 'Admin',
    },
  },
  {
    timestamps: true,
    collection: 'damages',
    strict: false,
  }
);

const Damage = mongoose.models.Damage || mongoose.model('Damage', damageSchema);

export default Damage;
