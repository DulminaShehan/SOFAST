import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function checkCollections() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sofast_pos';
    await mongoose.connect(mongoUri);
    const db = mongoose.connection.db;

    const sampleInvs = await db.collection('invoices').find({}).limit(5).toArray();
    console.log('Invoices count:', await db.collection('invoices').countDocuments());
    console.log('Sample Invoice:', JSON.stringify(sampleInvs[0], null, 2));

    const sampleSettlements = await db.collection('invoicesettlements').find({}).limit(5).toArray();
    console.log('InvoiceSettlements count:', await db.collection('invoicesettlements').countDocuments());
    console.log('Sample Settlement:', JSON.stringify(sampleSettlements[0], null, 2));

    const banks = await db.collection('banks').find({}).toArray();
    console.log('Banks count:', banks.length);
    console.log('Sample Banks:', banks.slice(0, 5));

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkCollections();
