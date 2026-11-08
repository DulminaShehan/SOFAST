/**
 * Authentication & Role-Based Access Control (RBAC) Middleware
 * SOFAST POS System
 */

/**
 * Middleware to extract current user credentials from custom request headers
 */
export const extractUser = (req, res, next) => {
  const role = (req.headers['x-user-role'] || '').toLowerCase();
  const username = req.headers['x-username'] || '';
  const userId = req.headers['x-user-id'] || '';

  req.user = {
    role: role === 'admin' ? 'admin' : 'user',
    username: username.trim(),
    userId: userId.trim(),
    isAdmin: role === 'admin',
  };
  next();
};

/**
 * Middleware to enforce Administrator-only access
 * Strictly blocks standard/normal users from administrative controllers
 */
export const requireAdmin = (req, res, next) => {
  const role = (req.headers['x-user-role'] || req.user?.role || '').toLowerCase();

  if (role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Administrator privileges required to access this resource.',
    });
  }

  next();
};

