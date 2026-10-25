import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const SYSTEM_MODULES = [
  // Master Files
  { id: 'item-master', label: 'Item Master', category: 'Master Files', path: '/item-master' },
  { id: 'supplier-master', label: 'Supplier Master', category: 'Master Files', path: '/supplier-master' },
  { id: 'customer-details', label: 'Customer Details', category: 'Master Files', path: '/customer-details' },
  { id: 'alternative-product', label: 'Alternative Product', category: 'Master Files', path: '/alternative-product' },

  // Stock Control System
  { id: 'grn', label: 'Good Receive Note (GRN)', category: 'Stock Control', path: '/grn' },
  { id: 'good-return-note', label: 'Good Return Note (GREN)', category: 'Stock Control', path: '/good-return-note' },
  { id: 'damage', label: 'Damage', category: 'Stock Control', path: '/damage' },

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
  { id: 'accounting', label: 'Accounting', category: 'Other Modules', path: '/management' },
];

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('sofast_auth_user');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to parse saved user:', e);
    }
    // Default fallback to admin for immediate convenience if not logged out
    return {
      username: 'admin',
      fullName: 'System Administrator',
      role: 'admin',
      permissions: SYSTEM_MODULES.map((m) => m.id),
      isActive: true,
    };
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return Boolean(localStorage.getItem('sofast_is_auth') !== 'false');
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('sofast_auth_user', JSON.stringify(currentUser));
      localStorage.setItem('sofast_is_auth', 'true');
    } else {
      localStorage.removeItem('sofast_auth_user');
      localStorage.setItem('sofast_is_auth', 'false');
    }
  }, [currentUser]);

  const isAdmin = currentUser?.role === 'admin';

  /**
   * Check if the currently logged-in user has permission for a specific page/module ID
   * @param {string} permissionId - ID of module or 'new-user'
   * @returns {boolean}
   */
  const hasPermission = (permissionId) => {
    if (!currentUser) return false;

    // "New User" is strictly for Admin only
    if (permissionId === 'new-user' || permissionId === 'administration/new-user') {
      return isAdmin;
    }

    // Administrators have full access to all pages
    if (isAdmin) return true;

    // Normal users check their granted permissions array
    const userPerms = currentUser.permissions || [];
    return userPerms.includes(permissionId);
  };

  /**
   * Login with username and password
   */
  const login = async (username, password) => {
    try {
      const res = await api.post('/users/login', { username, password });
      if (res.data?.success && res.data?.data) {
        const userData = res.data.data;
        setCurrentUser(userData);
        setIsAuthenticated(true);
        return { success: true, user: userData };
      }
      return { success: false, message: res.data?.message || 'Login failed' };
    } catch (err) {
      const errorMsg =
        err.response?.data?.message || err.message || 'Connection error. Please try again.';
      return { success: false, message: errorMsg };
    }
  };

  /**
   * Log out current user
   */
  const logout = () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('sofast_auth_user');
    localStorage.setItem('sofast_is_auth', 'false');
  };

  /**
   * Quick Switch User (e.g. for testing between Admin and Normal User)
   */
  const switchUser = (userObj) => {
    setCurrentUser(userObj);
    setIsAuthenticated(true);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        isAdmin,
        hasPermission,
        login,
        logout,
        switchUser,
        setCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
