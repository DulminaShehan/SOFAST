import mongoose from 'mongoose';

/**
 * Alternative Product Relationship Schema
 * Links existing Item Master products that are similar, compatible, or replacements.
 * Does NOT duplicate item data.
 */
const alternativeProductSchema = new mongoose.Schema(
  {
    mainItemCode: {
      type: String,
      required: [true, 'Main item code is required'],
      trim: true,
      unique: true,
      index: true,
    },
    mainItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      index: true,
    },
    alternativeItemCodes: [
      {
        type: String,
        trim: true,
      },
    ],
    alternativeItemIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Item',
      },
    ],
    status: {
      type: String,
      trim: true,
      default: 'Active',
    },
    remark: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    collection: 'alternative_products',
  }
);

const AlternativeProduct =
  mongoose.models.AlternativeProduct ||
  mongoose.model('AlternativeProduct', alternativeProductSchema);

export default AlternativeProduct;
