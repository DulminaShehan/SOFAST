import mongoose from 'mongoose';

/**
 * Customer Mongoose Schema
 * Maps to existing 'customers' collection in MongoDB Atlas 'sofast_pos' database.
 * Reuses existing customer fields while supporting Customer Master attributes.
 */
const customerSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      trim: true,
      index: true,
    },
    customerCode: {
      type: String,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      index: true,
    },
    telephone: {
      type: String,
      trim: true,
      default: '',
    },
    telephone1: {
      type: String,
      trim: true,
      default: '',
    },
    telephone2: {
      type: String,
      trim: true,
      default: '',
    },
    telephoneNumbers: [
      {
        type: String,
        trim: true,
      },
    ],
    address: {
      type: String,
      trim: true,
      default: '',
    },
    route: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      trim: true,
      default: '',
    },
    accNo: {
      type: String,
      trim: true,
      default: '',
    },
    target: {
      type: Number,
      default: 0,
    },
    targetAmount: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    remark: {
      type: String,
      trim: true,
      default: '',
    },
    gtnAllowed: {
      type: String,
      trim: true,
      default: 'Yes',
    },
    cusGtn: {
      type: Number,
      default: 1,
    },
    discount: {
      type: Number,
      default: 0,
    },
    discountRate: {
      type: Number,
      default: 0,
    },
    creditLimit: {
      type: Number,
      default: 0,
    },
    dueAmount: {
      type: Number,
      default: 0,
    },
    outstandingBalance: {
      type: Number,
      default: 0,
    },
    creditPeriod: {
      type: Number,
      default: 0,
    },
    use2ndPrice: {
      type: String,
      trim: true,
      default: 'No',
    },
    use2Price: {
      type: Number,
      default: 0,
    },
    vatNo: {
      type: String,
      trim: true,
      default: '',
    },
    vatNumber: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      trim: true,
      default: 'A',
    },
    // Vehicle & legacy fields preserved in database
    vehicleNo: {
      type: String,
      trim: true,
      default: '',
    },
    brand: {
      type: String,
      trim: true,
      default: '',
    },
    model: {
      type: String,
      trim: true,
      default: '',
    },
    chassisNo: {
      type: String,
      trim: true,
      default: '',
    },
    engineNo: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    collection: 'customers',
    strict: false,
  }
);

const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);

export default Customer;
