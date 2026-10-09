import mongoose from 'mongoose';

/**
 * Supplier Mongoose Schema
 * Compatible with both legacy and new MongoDB Atlas pos collections
 */
const supplierSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Supplier code is required'],
      trim: true,
      unique: true,
    },
    name: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true,
    },
    address: {
      type: String,
      trim: true,
      default: '',
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
    dueAmount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      default: 'A',
    },
  },
  {
    timestamps: true,
    strict: false,
  }
);

const Supplier = mongoose.models.Supplier || mongoose.model('Supplier', supplierSchema);

export default Supplier;

