/**
 * Migration Script: Add `is_round_off` field to Item Master collection in MongoDB
 *
 * Requirements:
 * - Adds boolean configuration field `is_round_off` (default: false)
 * - Identifies items configured with 'Round Up' or truthy roundOff and sets `is_round_off = true`
 * - Ensures index on `is_round_off` for high-performance lookup
 *
 * Run with:
 *   node backend/scripts/migrate_round_off.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sofast_pos';

async function runMigration() {
  console.log('--- Starting Migration: Add is_round_off to Item Master ---');
  console.log(`Connecting to MongoDB...`);

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
    });
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const itemsCollection = db.collection('items');

    const totalCount = await itemsCollection.countDocuments();
    console.log(`Total Item Master records: ${totalCount}`);

    // 1. Update items with existing 'Round Up' or truthy roundOff to is_round_off = true
    const roundUpResult = await itemsCollection.updateMany(
      {
        $or: [
          { roundOffOption: { $in: ['Round Up', 'Up'] } },
          { roundOff: true },
          { roundOff: 1 },
        ],
      },
      {
        $set: {
          is_round_off: true,
          roundOffOption: 'Round Up',
          roundOffStep: 10,
        },
      }
    );
    console.log(`✅ Set is_round_off = true for ${roundUpResult.modifiedCount} items`);

    // 2. Set is_round_off = false for all other items where is_round_off is missing or null
    const defaultResult = await itemsCollection.updateMany(
      {
        is_round_off: { $exists: false },
      },
      {
        $set: {
          is_round_off: false,
        },
      }
    );
    console.log(`✅ Set is_round_off = false (default) for ${defaultResult.modifiedCount} items`);

    // 3. Ensure index exists for is_round_off
    await itemsCollection.createIndex({ is_round_off: 1 });
    console.log('✅ Created index on { is_round_off: 1 }');

    // 4. Verification summary
    const trueCount = await itemsCollection.countDocuments({ is_round_off: true });
    const falseCount = await itemsCollection.countDocuments({ is_round_off: false });

    console.log('\n--- Migration Summary ---');
    console.log(`Total Items: ${totalCount}`);
    console.log(`Items with Round Off (is_round_off: true):  ${trueCount}`);
    console.log(`Items without Round Off (is_round_off: false): ${falseCount}`);
    console.log('Migration completed successfully!\n');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB connection closed.');
  }
}

runMigration();

