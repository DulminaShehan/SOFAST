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

// Enable JSON and URL-encoded request body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount central API router
app.use('/api', routes);

// Handle unknown routes (404)
app.use(notFoundHandler);

// Handle application errors
app.use(errorHandler);

// Start server and initialize database connection
const startServer = async () => {
  await connectDatabase();

  app.listen(PORT, () => {
    console.log(`🚀 SOFAST Backend Server running on port ${PORT}`);
    console.log(`🔗 Health Check URL: http://localhost:${PORT}/api/health`);
  });
};

startServer();

export default app;
