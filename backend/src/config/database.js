import mongoose from 'mongoose';

let isConnecting = null;

/**
 * Connect to MongoDB database instance with serverless connection pooling & reuse
 */
export const connectDatabase = async () => {
  // If already connected, reuse existing connection
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // If connection is in progress, await the ongoing promise
  if (isConnecting) {
    return isConnecting;
  }

  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.warn('⚠️  MONGODB_URI is not defined in environment variables. Database connection skipped.');
    return null;
  }

  try {
    isConnecting = mongoose.connect(mongoUri);
    const conn = await isConnecting;
    console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    // Do not crash server in dev so health endpoint remains reachable during initial setup
    return null;
  } finally {
    isConnecting = null;
  }
};
