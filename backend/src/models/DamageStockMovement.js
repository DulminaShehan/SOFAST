import mongoose from 'mongoose';

/**
 * DamageStockMovement Mongoose Schema
 * Audit trail and ledger for all damaged and quarantined stock movements.
 * Tracks origins: CUSTOMER RETURN, SHOP DAMAGE, SUPPLIER DAMAGE, or STOCK ADJUSTMENT.
 */
const damageStockMovementSchema = new mongoose.Schema(
  {
    movementNumber: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    no: {
      type: Number,
      index: true,
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    itemCode: {
      type: String,
      required: [true, 'Item code is required'],
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      trim: true,
      default: '',
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0.01, 'Quantity must be greater than zero'],
    },
    movementType: {
      type: String,
      enum: [
        'IN_CUSTOMER_RETURN',
        'IN_SHOP_DAMAGE',
        'IN_SUPPLIER_DAMAGE',
        'OUT_SUPPLIER_CLAIM',
        'OUT_SCRAP_WRITEOFF',
        'OUT_REPLACED_BY_SUPPLIER',
        'OUT_RESTORED_TO_SELLABLE',
      ],
      required: true,
      index: true,
    },
    origin: {
      type: String,
      enum: ['CUSTOMER RETURN', 'SHOP DAMAGE', 'SUPPLIER DAMAGE', 'STOCK ADJUSTMENT'],
      required: true,
      index: true,
    },
    referenceNumber: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    invoiceNumber: {
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
    supplierCode: {
      type: String,
      trim: true,
      default: '',
    },
    supplierName: {
      type: String,
      trim: true,
      default: '',
    },
    unitCost: {
      type: Number,
      default: 0,
    },
    totalValue: {
      type: Number,
      default: 0,
    },
    damageReason: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    recordedBy: {
      type: String,
      trim: true,
      default: 'Admin',
    },
  },
  {
    timestamps: true,
    collection: 'damagestockmovements',
  }
);

const DamageStockMovement =
  mongoose.models.DamageStockMovement ||
  mongoose.model('DamageStockMovement', damageStockMovementSchema);

export default DamageStockMovement;
