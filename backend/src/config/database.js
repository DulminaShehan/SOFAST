import mongoose from 'mongoose';
import dns from 'dns';

try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
  }
} catch (e) {
  // fallback if environment does not allow setting custom DNS
}

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

  const directFallbackUri = 'mongodb://pramuditha:pramuditha@ac-firyk5f-shard-00-00.ecu9tpg.mongodb.net:27017,ac-firyk5f-shard-00-01.ecu9tpg.mongodb.net:27017,ac-firyk5f-shard-00-02.ecu9tpg.mongodb.net:27017/sofast_pos?ssl=true&replicaSet=atlas-p6vt1h-shard-0&authSource=admin&retryWrites=true&w=majority';

  try {
    isConnecting = mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
    const conn = await isConnecting;
    console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    if (error.message.includes('querySrv') || error.message.includes('ETIMEOUT')) {
      console.warn(`⚠️  SRV DNS lookup timed out. Retrying with direct cluster nodes...`);
      try {
        isConnecting = mongoose.connect(directFallbackUri, { serverSelectionTimeoutMS: 8000 });
        const conn = await isConnecting;
        console.log(`✅ MongoDB Connected (Direct fallback): ${conn.connection.host}/${conn.connection.name}`);
        return conn;
      } catch (fallbackErr) {
        console.error(`❌ MongoDB Direct Connection Error: ${fallbackErr.message}`);
        return null;
      }
    }
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    // Do not crash server in dev so health endpoint remains reachable during initial setup
    return null;
  } finally {
    isConnecting = null;
  }
};
