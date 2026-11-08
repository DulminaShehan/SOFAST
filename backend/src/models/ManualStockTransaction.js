import mongoose from 'mongoose';

/**
 * ManualStockTransaction Mongoose Schema
 * Audit trail for every transaction involving a manual item:
 * - MANUAL_SALE: Quantity sold via a Manual Invoice
 * - STOCK_ADDITION: Controlled stock received with purchase cost & reference number
 * - CONVERSION_TRANSFER: Stock transferred to Item Master upon conversion
 */
const manualStockTransactionSchema = new mongoose.Schema(
  {
    manualItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ManualItem',
      required: true,
      index: true,
    },
    manualCode: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    transactionType: {
      type: String,
      enum: ['MANUAL_SALE', 'STOCK_ADDITION', 'CONVERSION_TRANSFER'],
      required: true,
      index: true,
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    referenceNumber: {
      type: String,
      trim: true,
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    unitPrice: {
      type: Number,
      default: 0,
    },
    costPrice: {
      type: Number,
      default: 0,
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
    location: {
      type: String,
      trim: true,
      default: 'Main Store',
    },
    balanceAfter: {
      type: Number,
      default: 0,
    },
    performedBy: {
      type: String,
      trim: true,
      default: 'Cashier',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    collection: 'manual_stock_transactions',
  }
);

const ManualStockTransaction =
  mongoose.models.ManualStockTransaction ||
  mongoose.model('ManualStockTransaction', manualStockTransactionSchema);

export default ManualStockTransaction;

