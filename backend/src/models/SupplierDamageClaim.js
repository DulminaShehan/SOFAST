import mongoose from 'mongoose';

/**
 * Supplier Damage Claim Mongoose Schema
 * Tracks damaged/defective items claimed against suppliers,
 * claim status tracking, and physical replacement receipts.
 * Sellable stock is ONLY increased when replacements are physically received & accepted.
 */
const supplierDamageClaimSchema = new mongoose.Schema(
  {
    claimNumber: {
      type: String,
      required: [true, 'Claim number is required'],
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
    // Optional Link to Customer Damage Return
    customerReturnId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CustomerDamageReturn',
    },
    customerReturnNumber: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    // Supplier Details
    supplierCode: {
      type: String,
      required: [true, 'Supplier code is required'],
      trim: true,
      index: true,
    },
    supplierName: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true,
    },
    supplierTelephone: {
      type: String,
      trim: true,
      default: '',
    },
    supplierInvoiceNo: {
      type: String,
      trim: true,
      default: '',
    },
    grnNumber: {
      type: String,
      trim: true,
      default: '',
    },
    // Damaged Item Details
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
    quantity: {
      type: Number,
      required: [true, 'Claim quantity is required'],
      min: [0.01, 'Claim quantity must be greater than zero'],
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
      required: [true, 'Damage reason is required'],
      trim: true,
    },
    // Claim Status Lifecycle
    claimStatus: {
      type: String,
      enum: ['PENDING', 'SENT_TO_SUPPLIER', 'REPLACEMENT_RECEIVED', 'REFUNDED', 'REJECTED', 'CLOSED'],
      default: 'PENDING',
      index: true,
    },
    sentDate: {
      type: Date,
    },
    sentReference: {
      type: String,
      trim: true,
      default: '',
    },
    resolutionDate: {
      type: Date,
    },
    // Physical Replacement Receipt Tracking
    replacementReceipt: {
      received: {
        type: Boolean,
        default: false,
      },
      receivedDate: {
        type: Date,
      },
      quantityReceived: {
        type: Number,
        default: 0,
      },
      replacementItemCode: {
        type: String,
        trim: true,
        default: '',
      },
      replacementDescription: {
        type: String,
        trim: true,
        default: '',
      },
      deliveryNoteNo: {
        type: String,
        trim: true,
        default: '',
      },
      acceptedBy: {
        type: String,
        trim: true,
        default: '',
      },
      remarks: {
        type: String,
        trim: true,
        default: '',
      },
      stockIncremented: {
        type: Boolean,
        default: false,
      },
    },
    notes: {
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
    collection: 'supplierdamageclaims',
    strict: false,
  }
);

const SupplierDamageClaim =
  mongoose.models.SupplierDamageClaim ||
  mongoose.model('SupplierDamageClaim', supplierDamageClaimSchema);

export default SupplierDamageClaim;
