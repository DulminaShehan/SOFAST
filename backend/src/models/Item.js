import mongoose from 'mongoose';

/**
 * Item Mongoose Schema
 * Matches SOFAST MOTORS Item Master File fields and compatible with existing Atlas items collection
 */
const itemSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Item code is required'],
      trim: true,
      unique: true,
      index: true,
    },
    suppCode: {
      type: String,
      trim: true,
      default: '',
    },
    type: {
      type: String,
      trim: true,
      default: 'Item',
    },
    description: {
      type: String,
      required: [true, 'Item description is required'],
      trim: true,
      index: true,
    },
    category: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    subCategory: {
      type: String,
      trim: true,
      default: '',
    },
    location: {
      type: String,
      trim: true,
      default: 'Main Store',
    },
    masterPack: {
      type: String,
      trim: true,
      default: '',
    },
    reorderLevel: {
      type: Number,
      default: 0,
    },
    reorderQty: {
      type: Number,
      default: 0,
    },
    maxStockLevel: {
      type: Number,
      default: 0,
    },
    isBulkItem: {
      type: Boolean,
      default: false,
    },
    quantity: {
      type: Number,
      default: 0,
    },
    stockInHand: {
      type: Number,
      default: 0,
    },
    roundOff: {
      type: Number,
      default: 0,
    },
    roundOffOption: {
      type: String,
      trim: true,
      default: 'No Round Off',
    },
    roundOffStep: {
      type: Number,
      default: 5,
    },
    discountPercentage: {
      type: Number,
      default: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    discountedPrice: {
      type: Number,
      default: 0,
    },
    costChange: {
      type: Boolean,
      default: false,
    },
    lastGrnPrice: {
      type: Number,
      default: 0,
    },
    lastGrn: {
      type: String,
      trim: true,
      default: '',
    },
    remark: {
      type: String,
      trim: true,
      default: '',
    },
    color: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      trim: true,
      default: 'A',
    },
    averageCost: {
      type: Number,
      default: 0,
    },
    sellingPrice: {
      type: Number,
      default: 0,
    },
    finalSellingPrice: {
      type: Number,
      default: 0,
    },
    value: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: 'items',
    strict: false,
  }
);

const Item = mongoose.models.Item || mongoose.model('Item', itemSchema);

export default Item;
