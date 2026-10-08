import mongoose from 'mongoose';

/**
 * Connect to MongoDB database instance
 */
export const connectDatabase = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.warn('⚠️  MONGODB_URI is not defined in environment variables. Database connection skipped.');
    return;
  }

  try {
    const conn = await mongoose.connect(mongoUri);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    // Do not crash server in dev so health endpoint remains reachable during initial setup
  }
};
