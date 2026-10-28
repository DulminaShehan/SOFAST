import crypto from 'crypto';
import mongoose from 'mongoose';
import User from '../models/User.js';

// Standard system permission keys and metadata
export const SYSTEM_PERMISSIONS = [
  // Master Files
  { id: 'item-master', label: 'Item Master', category: 'Master Files', path: '/item-master' },
  { id: 'supplier-master', label: 'Supplier Master', category: 'Master Files', path: '/supplier-master' },
  { id: 'customer-details', label: 'Customer Details', category: 'Master Files', path: '/customer-details' },
  { id: 'alternative-product', label: 'Alternative Product', category: 'Master Files', path: '/alternative-product' },
  { id: 'category-master', label: 'Category Master', category: 'Master Files', path: '/category-master' },
  { id: 'sub-category-master', label: 'Sub Category Master', category: 'Master Files', path: '/sub-category-master' },

  // Stock Control System
  { id: 'grn', label: 'Good Receive Note (GRN)', category: 'Stock Control', path: '/grn' },
  { id: 'good-return-note', label: 'Good Return Note (GREN)', category: 'Stock Control', path: '/good-return-note' },
  { id: 'damage', label: 'Damage & Claims', category: 'Stock Control', path: '/damage' },

  // Sales and Service
  { id: 'invoice', label: 'Create Invoice', category: 'Sales & Service', path: '/invoice' },
  { id: 'settlement-invoice', label: 'Settlement Invoice', category: 'Sales & Service', path: '/settlement-invoice' },
  { id: 'remaining-balance', label: 'Remaining Balance', category: 'Sales & Service', path: '/remaining-balance' },

  // Administration
  { id: 'printer-setup', label: 'Printer Setup', category: 'Administration', path: '/printer-setup' },

  // Approvement
  { id: 'payment-voucher', label: 'Payment Voucher', category: 'Approvement', path: '/payment-voucher' },
  { id: 'petty-cash', label: 'Petty Cash', category: 'Approvement', path: '/petty-cash' },
  { id: 'leave-request', label: 'Leave Request', category: 'Approvement', path: '/leave-request' },

  // Other modules
  { id: 'reports', label: 'Reports', category: 'Other Modules', path: '/reports' },
  { id: 'accounting', label: 'Accounting', category: 'Other Modules', path: '/accounting' },
];

// Helper to hash password for in-memory or mongo
const hashPasswordHelper = (password, salt = crypto.randomBytes(16).toString('hex')) => {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt };
};

// In-memory fallback if MongoDB is temporarily offline
let memoryUsers = [
  {
    _id: 'mem_admin_01',
    id: 'mem_admin_01',
    username: 'admin',
    fullName: 'System Administrator',
    ...hashPasswordHelper('admin123', 'fixed_admin_salt_123'),
    passwordHash: hashPasswordHelper('admin123', 'fixed_admin_salt_123').hash,
    role: 'admin',
    permissions: SYSTEM_PERMISSIONS.map((p) => p.id),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: 'mem_user_02',
    id: 'mem_user_02',
    username: 'cashier',
    fullName: 'POS Cashier Staff',
    ...hashPasswordHelper('cashier123', 'fixed_cashier_salt_123'),
    passwordHash: hashPasswordHelper('cashier123', 'fixed_cashier_salt_123').hash,
    role: 'user',
    permissions: ['invoice', 'settlement-invoice', 'remaining-balance', 'customer-details'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * Seed default admin if user collection is empty
 */
export const ensureDefaultUsers = async () => {
  if (!isDbConnected()) return;

  try {
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
      const admin = new User({
        username: 'admin',
        fullName: 'System Administrator',
        role: 'admin',
        permissions: SYSTEM_PERMISSIONS.map((p) => p.id),
        isActive: true,
      });
      admin.setPassword('admin123');
      await admin.save();
      console.log('✅ Default admin user created (admin / admin123)');
    }

    const cashierExists = await User.findOne({ username: 'cashier' });
    if (!cashierExists) {
      const cashier = new User({
        username: 'cashier',
        fullName: 'POS Cashier Staff',
        role: 'user',
        permissions: ['invoice', 'settlement-invoice', 'remaining-balance', 'customer-details'],
        isActive: true,
      });
      cashier.setPassword('cashier123');
      await cashier.save();
      console.log('✅ Default cashier user created (cashier / cashier123)');
    }
  } catch (err) {
    console.error('Error seeding default users:', err.message);
  }
};

/**
 * @route   GET /api/users/permissions-list
 * @desc    Get master list of system permissions
 */
export const getPermissionsList = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: SYSTEM_PERMISSIONS,
  });
};

/**
 * @route   POST /api/users/login
 * @desc    Authenticate user & return profile with permissions
 */
export const loginUser = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required',
      });
    }

    const cleanUsername = username.trim().toLowerCase();

    // Check DB if connected
    if (isDbConnected()) {
      await ensureDefaultUsers();
      const user = await User.findOne({ username: cleanUsername });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid username or password',
        });
      }

      // Check isActive or legacy status
      const isUserActive =
        user.isActive !== undefined
          ? Boolean(user.isActive)
          : user.status
          ? user.status.toLowerCase() === 'active'
          : true;

      if (!isUserActive) {
        return res.status(403).json({
          success: false,
          message: 'This user account is inactive. Please contact the administrator.',
        });
      }

      let isValidPassword = false;
      try {
        isValidPassword = user.validatePassword(password);
      } catch (authErr) {
        console.warn('Password check error:', authErr.message);
        isValidPassword = false;
      }

      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Invalid username or password',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: user.toSafeJSON(),
      });
    }

    // In-Memory Fallback
    const memUser = memoryUsers.find((u) => u.username === cleanUsername);
    if (!memUser) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      });
    }

    const isMemActive =
      memUser.isActive !== undefined
        ? Boolean(memUser.isActive)
        : memUser.status
        ? memUser.status.toLowerCase() === 'active'
        : true;

    if (!isMemActive) {
      return res.status(403).json({
        success: false,
        message: 'This user account is inactive. Please contact the administrator.',
      });
    }

    let isValidMemPass = false;
    if (memUser.salt && memUser.passwordHash) {
      try {
        const testHash = crypto
          .pbkdf2Sync(password, memUser.salt, 1000, 64, 'sha512')
          .toString('hex');
        isValidMemPass = testHash === memUser.passwordHash;
      } catch (e) {
        isValidMemPass = false;
      }
    }

    if (!isValidMemPass) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Login successful (Offline mode)',
      data: {
        id: memUser._id,
        _id: memUser._id,
        username: memUser.username,
        fullName: memUser.fullName,
        role: memUser.role,
        permissions: memUser.permissions,
        isActive: memUser.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/users
 * @desc    Get all users (for Admin User Management)
 */
export const getUsers = async (req, res, next) => {
  try {
    if (isDbConnected()) {
      await ensureDefaultUsers();
      const users = await User.find().sort({ createdAt: -1 });
      return res.status(200).json({
        success: true,
        count: users.length,
        data: users.map((u) => u.toSafeJSON()),
      });
    }

    return res.status(200).json({
      success: true,
      count: memoryUsers.length,
      data: memoryUsers.map((u) => ({
        id: u._id,
        _id: u._id,
        username: u.username,
        fullName: u.fullName,
        role: u.role,
        permissions: u.permissions || [],
        isActive: u.isActive,
        createdAt: u.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/users
 * @desc    Admin adds a new user with page permissions
 */
export const createUser = async (req, res, next) => {
  try {
    const { username, fullName, password, role = 'user', permissions = [], isActive = true } = req.body;

    if (!username || !fullName || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, full name, and password are required',
      });
    }

    if (password.length < 4) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 4 characters long',
      });
    }

    const cleanUsername = username.trim().toLowerCase();

    if (isDbConnected()) {
      const existingUser = await User.findOne({ username: cleanUsername });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: `Username '${cleanUsername}' is already taken`,
        });
      }

      const newUser = new User({
        username: cleanUsername,
        fullName: fullName.trim(),
        role: role === 'admin' ? 'admin' : 'user',
        permissions: Array.isArray(permissions) ? permissions : [],
        isActive: isActive !== false,
      });

      newUser.setPassword(password);
      await newUser.save();

      return res.status(201).json({
        success: true,
        message: `User '${newUser.username}' created successfully`,
        data: newUser.toSafeJSON(),
      });
    }

    // In-memory fallback
    const memExists = memoryUsers.find((u) => u.username === cleanUsername);
    if (memExists) {
      return res.status(409).json({
        success: false,
        message: `Username '${cleanUsername}' is already taken`,
      });
    }

    const { hash, salt } = hashPasswordHelper(password);
    const newMemUser = {
      _id: 'mem_user_' + Date.now(),
      id: 'mem_user_' + Date.now(),
      username: cleanUsername,
      fullName: fullName.trim(),
      passwordHash: hash,
      salt,
      role: role === 'admin' ? 'admin' : 'user',
      permissions: Array.isArray(permissions) ? permissions : [],
      isActive: isActive !== false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    memoryUsers.unshift(newMemUser);

    return res.status(201).json({
      success: true,
      message: `User '${newMemUser.username}' created successfully`,
      data: {
        id: newMemUser._id,
        _id: newMemUser._id,
        username: newMemUser.username,
        fullName: newMemUser.fullName,
        role: newMemUser.role,
        permissions: newMemUser.permissions,
        isActive: newMemUser.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/users/:id
 * @desc    Admin updates a user's role, permissions, status or password
 */
export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fullName, role, permissions, isActive, password } = req.body;

    if (isDbConnected()) {
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      if (fullName) user.fullName = fullName.trim();
      if (role && ['admin', 'user'].includes(role)) user.role = role;
      if (Array.isArray(permissions)) user.permissions = permissions;
      if (typeof isActive === 'boolean') user.isActive = isActive;
      if (password && password.trim().length >= 4) {
        user.setPassword(password.trim());
      }

      await user.save();

      return res.status(200).json({
        success: true,
        message: `User '${user.username}' updated successfully`,
        data: user.toSafeJSON(),
      });
    }

    // In-memory fallback
    const memUser = memoryUsers.find((u) => u._id === id || u.id === id);
    if (!memUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (fullName) memUser.fullName = fullName.trim();
    if (role && ['admin', 'user'].includes(role)) memUser.role = role;
    if (Array.isArray(permissions)) memUser.permissions = permissions;
    if (typeof isActive === 'boolean') memUser.isActive = isActive;
    if (password && password.trim().length >= 4) {
      const { hash, salt } = hashPasswordHelper(password.trim());
      memUser.passwordHash = hash;
      memUser.salt = salt;
    }
    memUser.updatedAt = new Date();

    return res.status(200).json({
      success: true,
      message: `User '${memUser.username}' updated successfully`,
      data: {
        id: memUser._id,
        _id: memUser._id,
        username: memUser.username,
        fullName: memUser.fullName,
        role: memUser.role,
        permissions: memUser.permissions,
        isActive: memUser.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete a user (prevent deleting the only admin)
 */
export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (isDbConnected()) {
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Prevent deleting last active admin
      if (user.role === 'admin') {
        const adminCount = await User.countDocuments({ role: 'admin' });
        if (adminCount <= 1) {
          return res.status(400).json({
            success: false,
            message: 'Cannot delete the only remaining administrator account',
          });
        }
      }

      await User.findByIdAndDelete(id);

      return res.status(200).json({
        success: true,
        message: `User '${user.username}' deleted successfully`,
      });
    }

    const index = memoryUsers.findIndex((u) => u._id === id || u.id === id);
    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const toDelete = memoryUsers[index];
    if (toDelete.role === 'admin') {
      const adminCount = memoryUsers.filter((u) => u.role === 'admin').length;
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete the only remaining administrator account',
        });
      }
    }

    memoryUsers.splice(index, 1);

    return res.status(200).json({
      success: true,
      message: `User '${toDelete.username}' deleted successfully`,
    });
  } catch (error) {
    next(error);
  }
};
