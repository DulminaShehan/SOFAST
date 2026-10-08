import { Router } from 'express';

const router = Router();

/**
 * @route   GET /api/health
 * @desc    API Health Check endpoint
 * @access  Public
 */
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'SOFAST API is running',
  });
});

export default router;
