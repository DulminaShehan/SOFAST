import mongoose from 'mongoose';

/**
 * Customer Damage Return Mongoose Schema
 * Tracks damaged/defective items returned by customers from sales invoices,
 * with supplier traceability, replacement tracking, and quarantine stock segregation.
 */
const customerDamageReturnSchema = new mongoose.Schema(
  {
    returnNumber: {
      type: String,
      required: [true, 'Return number is required'],
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
    // Original Sales Invoice Reference
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
    },
    invoiceNumber: {
      type: String,
      required: [true, 'Invoice number is required'],
      trim: true,
      index: true,
    },
    invoiceDate: {
      type: Date,
    },
    // Customer Details
    customerCode: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    customerName: {
      type: String,
      trim: true,
      default: 'Walk-in Customer',
    },
    customerTelephone: {
      type: String,
      trim: true,
      default: '',
    },
    customerAddress: {
      type: String,
      trim: true,
      default: '',
    },
    // Returned Item Details
    returnedItem: {
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
      purchasedQuantity: {
        type: Number,
        required: [true, 'Purchased quantity is required'],
        min: 0.01,
      },
      unitPrice: {
        type: Number,
        default: 0,
      },
      returnedQuantity: {
        type: Number,
        required: [true, 'Returned quantity is required'],
        min: [0.01, 'Returned quantity must be greater than zero'],
      },
      returnReason: {
        type: String,
        required: [true, 'Return reason is required'],
        trim: true,
      },
      damageReason: {
        type: String,
        trim: true,
        default: '',
      },
      itemCondition: {
        type: String,
        enum: ['GOOD', 'DAMAGED', 'DEFECTIVE', 'WRONG_ITEM', 'OTHER'],
        default: 'DAMAGED',
        index: true,
      },
      damageNotes: {
        type: String,
        trim: true,
        default: '',
      },
    },
    // Workflow classification
    workflowType: {
      type: String,
      enum: ['EXCHANGE', 'DAMAGE_RETURN'],
      default: 'DAMAGE_RETURN',
      index: true,
    },
    itemCondition: {
      type: String,
      enum: ['GOOD', 'DAMAGED', 'DEFECTIVE', 'WRONG_ITEM', 'OTHER'],
      default: 'DAMAGED',
      index: true,
    },
    // Disposition / Action Taken
    disposition: {
      type: String,
      enum: ['REPLACEMENT', 'QUARANTINE', 'SUPPLIER_CLAIM', 'REFUND'],
      required: true,
      default: 'QUARANTINE',
      index: true,
    },
    // Damage lifecycle status
    damageStatus: {
      type: String,
      enum: [
        'RECEIVED',
        'UNDER INSPECTION',
        'CLAIM PENDING',
        'REPLACEMENT APPROVED',
        'RESOLVED',
        'COMPLETED_EXCHANGE',
      ],
      default: 'RECEIVED',
      index: true,
    },
    // Inspection Details
    inspection: {
      inspected: {
        type: Boolean,
        default: false,
      },
      inspectedBy: {
        type: String,
        trim: true,
        default: '',
      },
      inspectionDate: {
        type: Date,
      },
      conditionResult: {
        type: String,
        enum: ['SELLABLE_STOCK', 'DAMAGED_QUARANTINE', 'REJECTED_RETURN', 'PENDING'],
        default: 'PENDING',
      },
      inspectionNotes: {
        type: String,
        trim: true,
        default: '',
      },
    },
    // Replacement Details (if replacement/exchange is issued)
    replacement: {
      issued: {
        type: Boolean,
        default: false,
      },
      itemCode: {
        type: String,
        trim: true,
        default: '',
      },
      description: {
        type: String,
        trim: true,
        default: '',
      },
      quantity: {
        type: Number,
        default: 0,
      },
      unitPrice: {
        type: Number,
        default: 0,
      },
      valueDifference: {
        type: Number,
        default: 0,
      },
      additionalPaymentRequired: {
        type: Number,
        default: 0,
      },
      refundAmount: {
        type: Number,
        default: 0,
      },
      settlementType: {
        type: String,
        enum: ['EVEN', 'CUSTOMER_PAYS_DIFFERENCE', 'REFUND_TO_CUSTOMER', 'STORE_CREDIT', 'NONE'],
        default: 'NONE',
      },
      notes: {
        type: String,
        trim: true,
        default: '',
      },
    },
    // Supplier Traceability
    supplierTraceability: {
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
      purchaseDate: {
        type: Date,
      },
      batchInfo: {
        type: String,
        trim: true,
        default: '',
      },
      verificationStatus: {
        type: String,
        enum: ['VERIFIED', 'SELECTED_FROM_HISTORY', 'MANUAL_OVERRIDE', 'UNVERIFIED'],
        default: 'UNVERIFIED',
      },
      purchaseHistorySnapshot: {
        type: Array,
        default: [],
      },
    },
    // Supplier Claim Reference (if created/linked)
    supplierClaimId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SupplierDamageClaim',
    },
    supplierClaimNumber: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['COMPLETED', 'PENDING_CLAIM', 'CANCELLED'],
      default: 'COMPLETED',
      index: true,
    },
    stockUpdated: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: String,
      trim: true,
      default: 'Admin',
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    collection: 'customerdamagereturns',
    strict: false,
  }
);

const CustomerDamageReturn =
  mongoose.models.CustomerDamageReturn ||
  mongoose.model('CustomerDamageReturn', customerDamageReturnSchema);

export default CustomerDamageReturn;
