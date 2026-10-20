import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDatabase } from './config/database.js';
import routes from './routes/index.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { errorHandler } from './middleware/errorHandler.js';

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

    app.listen(PORT, () => {
      console.log(`🚀 SOFAST Backend Server running on port ${PORT}`);
      console.log(`🔗 Health Check URL: http://localhost:${PORT}/api/health`);
    });
  };

  startServer();
}

export default app;
