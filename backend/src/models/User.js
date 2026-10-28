import mongoose from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Username must be at least 3 characters'],
    },
    fullName: {
      type: String,
      trim: true,
      default: '',
    },
    // Supporting both pbkdf2 and bcrypt/legacy passwords
    passwordHash: {
      type: String,
      required: false,
    },
    salt: {
      type: String,
      required: false,
    },
    password: {
      type: String,
      required: false,
    },
    role: {
      type: String,
      default: 'user',
    },
    type: {
      type: String,
      default: 'user',
    },
    permissions: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      default: 'active',
    },
  },
  {
    timestamps: true,
    strict: false,
  }
);

// Method to hash and set user password
userSchema.methods.setPassword = function (password) {
  this.salt = crypto.randomBytes(16).toString('hex');
  this.passwordHash = crypto
    .pbkdf2Sync(password, this.salt, 1000, 64, 'sha512')
    .toString('hex');
};

// Method to validate user password (supports pbkdf2, bcrypt, and plaintext fallbacks safely)
userSchema.methods.validatePassword = function (password) {
  if (!password) return false;

  // 1. pbkdf2 validation if salt and passwordHash exist
  if (this.salt && this.passwordHash) {
    try {
      const hash = crypto
        .pbkdf2Sync(password, this.salt, 1000, 64, 'sha512')
        .toString('hex');
      if (this.passwordHash === hash) {
        return true;
      }
    } catch (err) {
      console.warn('pbkdf2Sync validation error:', err.message);
    }
  }

  // 2. bcrypt validation (if password or passwordHash starts with $2a$, $2b$, or $2y$)
  const candidateHash = (this.password || this.passwordHash || '').trim();
  if (
    candidateHash.startsWith('$2a$') ||
    candidateHash.startsWith('$2b$') ||
    candidateHash.startsWith('$2y$')
  ) {
    try {
      if (bcrypt.compareSync(password, candidateHash)) {
        // Upgrade user document to have pbkdf2 salt and hash
        this.setPassword(password);
        this.save().catch(() => {});
        return true;
      }
    } catch (err) {
      console.warn('bcrypt compare error:', err.message);
    }
  }

  // 3. Plaintext fallback (if legacy plaintext stored)
  if (this.password && this.password === password) {
    this.setPassword(password);
    this.save().catch(() => {});
    return true;
  }

  return false;
};

// Transform to JSON (strip sensitive fields and normalize legacy structure)
userSchema.methods.toSafeJSON = function () {
  const resolvedRole = (this.role || this.type || 'user').toLowerCase();
  const resolvedActive =
    this.isActive !== undefined
      ? Boolean(this.isActive)
      : this.status
      ? this.status.toLowerCase() === 'active'
      : true;

  let normalizedPermissions = [];
  if (Array.isArray(this.permissions)) {
    normalizedPermissions = this.permissions;
  } else if (this.permissions && Array.isArray(this.permissions.pages)) {
    normalizedPermissions = this.permissions.pages;
  }

  return {
    id: this._id,
    _id: this._id,
    username: this.username,
    fullName:
      this.fullName ||
      (this.username ? this.username.charAt(0).toUpperCase() + this.username.slice(1) : 'User'),
    role: resolvedRole,
    type: resolvedRole,
    permissions: normalizedPermissions,
    isActive: resolvedActive,
    status: resolvedActive ? 'active' : 'inactive',
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;
