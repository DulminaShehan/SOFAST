import { Router } from 'express';
import mongoose from 'mongoose';
import Supplier from '../models/Supplier.js';

const router = Router();

/**
 * @route   GET /api/health
 * @desc    API and Database Health Check endpoint
 * @access  Public
 */
router.get('/', async (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  let supplierCount = 0;
  
  if (isDbConnected) {
    try {
      supplierCount = await Supplier.countDocuments();
    } catch (e) {
      // ignore count error
    }
  }

  res.status(200).json({
    success: true,
    message: 'SOFAST API is running',
    database: {
      connected: isDbConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host || 'none',
      name: mongoose.connection.name || 'none',
      supplierCount,
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
