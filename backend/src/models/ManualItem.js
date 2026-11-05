import mongoose from 'mongoose';

/**
 * ManualItem Mongoose Schema
 * Tracks non-inventory items entered through Manual Invoices that are not yet in Item Master.
 * Tracks manual sales, stock received, available stock, and conversion status.
 */
const manualItemSchema = new mongoose.Schema(
  {
    manualCode: {
      type: String,
      required: [true, 'Manual item code is required'],
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Manual item description is required'],
      trim: true,
      index: true,
    },
    normalizedDescription: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },
    unit: {
      type: String,
      trim: true,
      default: 'PCS',
    },
    sellingPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    costPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalSalesQty: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalStockAdded: {
      type: Number,
      default: 0,
      min: 0,
    },
    availableStock: {
      type: Number,
      default: 0,
    },
    firstTransactionDate: {
      type: Date,
      default: Date.now,
    },
    lastTransactionDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['Active', 'Converted'],
      default: 'Active',
      index: true,
    },
    convertedAt: {
      type: Date,
      default: null,
    },
    convertedBy: {
      type: String,
      trim: true,
      default: '',
    },
    convertedItemCode: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    convertedItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      default: null,
    },
    category: {
      type: String,
      trim: true,
      default: 'Manual Items',
    },
    location: {
      type: String,
      trim: true,
      default: 'Main Store',
    },
    supplier: {
      type: String,
      trim: true,
      default: '',
    },
    supplierCode: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    collection: 'manual_items',
  }
);

// Pre-save hook to ensure normalizedDescription and availableStock
manualItemSchema.pre('save', function (next) {
  if (this.description) {
    this.normalizedDescription = this.description.trim().toLowerCase();
  }
  // Available stock calculation: total stock added minus total manual sales
  this.availableStock = Math.round(((this.totalStockAdded || 0) - (this.totalSalesQty || 0)) * 100) / 100;
  next();
});

const ManualItem = mongoose.models.ManualItem || mongoose.model('ManualItem', manualItemSchema);

export default ManualItem;

