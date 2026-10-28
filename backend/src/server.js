import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import dns from 'dns';
import { connectDatabase } from './config/database.js';
import routes from './routes/index.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { errorHandler } from './middleware/errorHandler.js';

// Resolve MongoDB SRV records reliably using Google & Cloudflare DNS (fixes querySrv ETIMEOUT on Windows)
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
  }
} catch (e) {
  // fallback to system default if custom DNS cannot be set
}

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable Cross-Origin Resource Sharing
app.use(cors());

// Enable JSON and URL-encoded request body parsing (supporting image payloads up to 10MB)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure database connection for incoming requests (serverless & local)
app.use(async (req, res, next) => {
  try {
    await connectDatabase();
    next();
  } catch (err) {
    next(err);
  }
});

// Root friendly check
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'SOFAST POS Backend API is running',
    healthCheck: '/api/health',
  });
});

// API root friendly check
app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'SOFAST POS Backend API',
    healthCheck: '/api/health',
  });
});

// Mount central API router
app.use('/api', routes);

// Handle unknown routes (404)
app.use(notFoundHandler);

// Handle application errors
app.use(errorHandler);

// Start server locally when not running in a serverless environment (e.g., Vercel)
if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  const startServer = async () => {
    await connectDatabase();

    const server = app.listen(PORT, () => {
      console.log(`🚀 SOFAST Backend Server running on port ${PORT}`);
      console.log(`🔗 Health Check URL: http://localhost:${PORT}/api/health`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ Error: Port ${PORT} is already in use by another process.`);
        console.error(`💡 To free port ${PORT} on Windows:`);
        console.error(`   Run in PowerShell: Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force`);
        console.error(`   Or in CMD: netstat -ano | findstr :${PORT}  then  taskkill /PID <PID> /F\n`);
        process.exit(1);
      } else {
        console.error('Server error:', err);
      }
    });

    // Graceful shutdown handlers for process managers (PM2 / Docker / Systemd)
    const gracefulShutdown = async (signal) => {
      console.log(`\n🛑 [${signal}] Received. Shutting down SOFAST HTTP server gracefully...`);
      server.close(async () => {
        console.log('HTTP server closed.');
        try {
          const mongoose = (await import('mongoose')).default;
          if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close(false);
            console.log('MongoDB connection closed.');
          }
        } catch (closeErr) {
          console.warn('Error during database disconnect:', closeErr.message);
        }
        process.exit(0);
      });
      // Force exit after 10 seconds if graceful close hangs
      setTimeout(() => {
        console.error('Forcing shutdown after timeout.');
        process.exit(1);
      }, 10000).unref();
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  };

  startServer();
}

export default app;
