import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainMenu from '../../components/navigation/MainMenu';
import { useAuth, SYSTEM_MODULES } from '../../context/AuthContext';
import api from '../../services/api';
import windowIcon from '../../assets/window-icon.png';
import './NewUser.css';

/**
 * SOFAST MOTORS - User Administration & Page Permissions Management
 * Accessible ONLY by system administrators.
 */
function NewUser() {
  const { currentUser, isAdmin, switchUser } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [notification, setNotification] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editUserId, setEditUserId] = useState(null);

  // Form Fields
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    password: '',
    role: 'user',
    permissions: [],
    isActive: true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Categorize system permissions for the matrix
  const permissionCategories = [
    {
      name: 'Master Files',
      keys: ['item-master', 'supplier-master', 'customer-details', 'alternative-product', 'category-master', 'sub-category-master'],
    },
    {
      name: 'Stock Control System',
      keys: ['grn', 'good-return-note', 'damage'],
    },
    {
      name: 'Sales and Service',
      keys: ['invoice', 'settlement-invoice', 'remaining-balance'],
    },
    {
      name: 'Administration',
      keys: ['printer-setup'],
    },
    {
      name: 'Approvement System',
      keys: ['payment-voucher', 'petty-cash', 'leave-request'],
    },
    {
      name: 'General & Reports',
      keys: ['reports', 'accounting'],
    },
  ];

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Fetch users from API
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setUsers(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
      showToast('Error connecting to users service', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  // Open Add User Dialog
  const handleOpenAddModal = () => {
    setIsEditing(false);
    setEditUserId(null);
    setFormData({
      username: '',
      fullName: '',
      password: '',
      role: 'user',
      permissions: ['invoice', 'settlement-invoice', 'remaining-balance', 'customer-details'],
      isActive: true,
    });
    setIsModalOpen(true);
  };

  // Open Edit User Dialog
  const handleOpenEditModal = (user) => {
    setIsEditing(true);
    setEditUserId(user._id || user.id);
    setFormData({
      username: user.username,
      fullName: user.fullName || '',
      password: '', // Blank unless modifying
      role: user.role || 'user',
      permissions: user.permissions || [],
      isActive: user.isActive !== false,
    });
    setIsModalOpen(true);
  };

  // Delete User
  const handleDeleteUser = async (user) => {
    const userId = user._id || user.id;
    if (user.username === currentUser?.username) {
      showToast('You cannot delete your own logged-in account', 'error');
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to permanently delete user "${user.username}" (${user.fullName})?`
      )
    ) {
      return;
    }

    try {
      const res = await api.delete(`/users/${userId}`);
      if (res.data?.success) {
        showToast(`User '${user.username}' deleted successfully`);
        fetchUsers();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete user', 'error');
    }
  };

  // Toggle User Active Status
  const handleToggleStatus = async (user) => {
    const userId = user._id || user.id;
    if (user.username === currentUser?.username) {
      showToast('You cannot deactivate your own logged-in account', 'error');
      return;
    }

    try {
      const newStatus = !user.isActive;
      const res = await api.put(`/users/${userId}`, { isActive: newStatus });
      if (res.data?.success) {
        showToast(`User '${user.username}' is now ${newStatus ? 'Active' : 'Inactive'}`);
        fetchUsers();
      }
    } catch (err) {
      showToast('Failed to update user status', 'error');
    }
  };

  // Permission Checkbox Toggle
  const handlePermissionToggle = (permKey) => {
    setFormData((prev) => {
      const exists = prev.permissions.includes(permKey);
      return {
        ...prev,
        permissions: exists
          ? prev.permissions.filter((k) => k !== permKey)
          : [...prev.permissions, permKey],
      };
    });
  };

  // Presets
  const applyPreset = (presetName) => {
    if (presetName === 'all') {
      const allKeys = SYSTEM_MODULES.map((m) => m.id);
      setFormData((prev) => ({ ...prev, permissions: allKeys }));
    } else if (presetName === 'clear') {
      setFormData((prev) => ({ ...prev, permissions: [] }));
    } else if (presetName === 'cashier') {
      setFormData((prev) => ({
        ...prev,
        permissions: ['invoice', 'settlement-invoice', 'remaining-balance', 'customer-details'],
      }));
    } else if (presetName === 'stock') {
      setFormData((prev) => ({
        ...prev,
        permissions: ['grn', 'good-return-note', 'damage', 'item-master', 'supplier-master', 'alternative-product'],
      }));
    } else if (presetName === 'approver') {
      setFormData((prev) => ({
        ...prev,
        permissions: ['payment-voucher', 'petty-cash', 'leave-request', 'reports'],
      }));
    }
  };

  // Category Toggle
  const toggleCategory = (catKeys) => {
    const allSelected = catKeys.every((k) => formData.permissions.includes(k));
    setFormData((prev) => ({
      ...prev,
      permissions: allSelected
        ? prev.permissions.filter((k) => !catKeys.includes(k))
        : Array.from(new Set([...prev.permissions, ...catKeys])),
    }));
  };

  // Form Submit
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.fullName.trim()) {
      showToast('Please enter both username and full name', 'error');
      return;
    }

    if (!isEditing && (!formData.password || formData.password.length < 4)) {
      showToast('Password must be at least 4 characters long', 'error');
      return;
    }

    try {
      setFormSubmitting(true);
      if (isEditing) {
        const payload = {
          fullName: formData.fullName,
          role: formData.role,
          permissions: formData.role === 'admin' ? SYSTEM_MODULES.map((m) => m.id) : formData.permissions,
          isActive: formData.isActive,
        };
        if (formData.password && formData.password.trim()) {
          payload.password = formData.password.trim();
        }

        const res = await api.put(`/users/${editUserId}`, payload);
        if (res.data?.success) {
          showToast(`User '${formData.username}' updated successfully!`);
          setIsModalOpen(false);
          fetchUsers();
        }
      } else {
        const payload = {
          username: formData.username.trim(),
          fullName: formData.fullName.trim(),
          password: formData.password.trim(),
          role: formData.role,
          permissions: formData.role === 'admin' ? SYSTEM_MODULES.map((m) => m.id) : formData.permissions,
          isActive: formData.isActive,
        };

        const res = await api.post('/users', payload);
        if (res.data?.success) {
          showToast(`New user '${payload.username}' created successfully!`);
          setIsModalOpen(false);
          fetchUsers();
        }
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error saving user', 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Test Switch Account
  const handleQuickSwitch = (user) => {
    switchUser(user);
    showToast(`Switched active session to: ${user.username} (${user.role.toUpperCase()})`);
    if (user.role !== 'admin') {
      navigate('/management');
    }
  };

  // Render Access Denied for Non-Admin Users
  if (!isAdmin) {
    return (
      <div className="new-user-page-container">
        <header className="new-user-window-header">
          <div className="header-branding">
            <img src={windowIcon} alt="" className="header-icon" />
            <span className="header-title">SOFAST POS System - Access Control</span>
          </div>
        </header>
        <MainMenu />
        <div className="access-denied-container">
          <div className="access-denied-card">
            <div className="denied-icon">🔒</div>
            <h2>Access Denied</h2>
            <p>
              The <strong>New User & Permission Management</strong> console is strictly restricted to
              <strong> Administrators</strong>. Your current role does not have permission to view or manage
              user accounts.
            </p>
            <button
              type="button"
              className="primary-add-btn"
              onClick={() => navigate('/management')}
              style={{ margin: '0 auto' }}
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Filter users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.fullName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const adminCount = users.filter((u) => u.role === 'admin').length;
  const normalUserCount = users.filter((u) => u.role === 'user').length;

  return (
    <div className="new-user-page-container">
      {/* 1. Window Header Bar */}
      <header className="new-user-window-header">
        <div className="header-branding">
          <img src={windowIcon} alt="" className="header-icon" />
          <span className="header-title">SOFAST MOTORS - User Administration & Permission Control</span>
          <span className="header-admin-badge">Admin Console</span>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="header-back-btn"
            onClick={() => navigate('/management')}
          >
            &larr; Management System
          </button>
        </div>
      </header>

      {/* 2. Top Application Menu Bar */}
      <MainMenu />

      {/* 3. Main Workspace */}
      <main className="new-user-workspace">
        {/* Banner Overview Card */}
        <div className="user-mgmt-banner">
          <div className="banner-left">
            <div className="banner-icon-box">👥</div>
            <div className="banner-titles">
              <h1>System Users & Page Access Privileges</h1>
              <p>
                Create staff accounts and control exactly which system pages (Master Files, Stock Control,
                Sales, Administration) each user can access.
              </p>
            </div>
          </div>
          <div className="banner-stats">
            <div className="stat-chip">
              <span className="stat-value">{users.length}</span>
              <span className="stat-label">Total Users</span>
            </div>
            <div className="stat-chip">
              <span className="stat-value" style={{ color: '#2563eb' }}>{adminCount}</span>
              <span className="stat-label">Admins</span>
            </div>
            <div className="stat-chip">
              <span className="stat-value" style={{ color: '#059669' }}>{normalUserCount}</span>
              <span className="stat-label">Operators</span>
            </div>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="user-toolbar">
          <div className="toolbar-left">
            <button
              type="button"
              className="primary-add-btn"
              onClick={handleOpenAddModal}
            >
              <span>+</span>
              <span>New User</span>
            </button>

            <div className="search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="user-search-input"
                placeholder="Search username or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select
              className="filter-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles ({users.length})</option>
              <option value="admin">Administrators ({adminCount})</option>
              <option value="user">Normal Users ({normalUserCount})</option>
            </select>
          </div>

          <div className="toolbar-right">
            <button
              type="button"
              className="refresh-btn"
              onClick={fetchUsers}
              title="Refresh users list"
            >
              ⟳ Refresh
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="user-table-card">
          <div className="table-responsive">
            <table className="sofast-user-table">
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>User Profile</th>
                  <th style={{ width: '12%' }}>System Role</th>
                  <th style={{ width: '42%' }}>Granted Page Permissions</th>
                  <th style={{ width: '10%' }}>Status</th>
                  <th style={{ width: '14%', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                      Loading system user accounts...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                      No users found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const isUserAdmin = user.role === 'admin';
                    const initials = (user.fullName || user.username || 'U')
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2);

                    return (
                      <tr key={user._id || user.id}>
                        <td>
                          <div className="user-cell">
                            <div className={`user-avatar ${isUserAdmin ? 'admin-avatar' : ''}`}>
                              {initials}
                            </div>
                            <div>
                              <div className="user-name-text">{user.fullName || user.username}</div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>@{user.username}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`user-badge-role ${isUserAdmin ? 'role-admin' : 'role-user'}`}>
                            {isUserAdmin ? 'ADMIN' : 'NORMAL USER'}
                          </span>
                        </td>
                        <td>
                          {isUserAdmin ? (
                            <span className="all-access-badge">
                              Full Access (All System Modules & Administration)
                            </span>
                          ) : (user.permissions || []).length === 0 ? (
                            <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                              No pages permitted (Login only)
                            </span>
                          ) : (
                            <div className="perms-container">
                              {(user.permissions || []).map((permKey) => {
                                const mod = SYSTEM_MODULES.find((m) => m.id === permKey);
                                return (
                                  <span key={permKey} className="perm-pill">
                                    {mod ? mod.label : permKey}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </td>
                        <td>
                          <span
                            className={`status-badge ${user.isActive ? 'active' : 'inactive'}`}
                            onClick={() => handleToggleStatus(user)}
                            style={{ cursor: 'pointer' }}
                            title="Click to toggle active status"
                          >
                            {user.isActive ? '● Active' : '○ Inactive'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div className="action-buttons" style={{ justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="action-btn edit"
                              onClick={() => handleOpenEditModal(user)}
                              title="Edit user & page permissions"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="action-btn switch"
                              onClick={() => handleQuickSwitch(user)}
                              title="Switch active session to this user to test view"
                            >
                              Test Login
                            </button>
                            <button
                              type="button"
                              className="action-btn delete"
                              onClick={() => handleDeleteUser(user)}
                              title="Delete user"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* 4. Add / Edit User Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => !formSubmitting && setIsModalOpen(false)}>
          <div className="modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{isEditing ? `Edit User: ${formData.username}` : 'Add New User'}</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsModalOpen(false)}
                disabled={formSubmitting}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="modal-body">
              {/* Basic Information */}
              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="modal-username">Username *</label>
                  <input
                    id="modal-username"
                    type="text"
                    className="modal-input"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="e.g. kasun, cashier2"
                    disabled={isEditing}
                    required
                    autoFocus={!isEditing}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="modal-fullname">Full Name *</label>
                  <input
                    id="modal-fullname"
                    type="text"
                    className="modal-input"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="e.g. Kasun Silva"
                    required
                  />
                </div>
              </div>

              {/* Password & Active Status */}
              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="modal-password">
                    Password {isEditing ? '(Leave blank to keep existing)' : '*'}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="modal-password"
                      type={showPassword ? 'text' : 'password'}
                      className="modal-input"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder={isEditing ? '••••••••' : 'Min 4 characters'}
                      required={!isEditing}
                    />
                    <button
                      type="button"
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '11px',
                        color: '#64748b',
                      }}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Account Status</label>
                  <div style={{ marginTop: '6px' }}>
                    <label className="perm-check-label">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      />
                      <span>Active (User can log into the system)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Role Selection */}
              <div className="form-group">
                <label>System Role & Authority</label>
                <div className="role-options-box">
                  <div
                    className={`role-card-option ${formData.role === 'admin' ? 'selected' : ''}`}
                    onClick={() => setFormData({ ...formData, role: 'admin' })}
                  >
                    <input
                      type="radio"
                      name="userRole"
                      checked={formData.role === 'admin'}
                      onChange={() => setFormData({ ...formData, role: 'admin' })}
                    />
                    <div className="role-card-info">
                      <h4>Administrator</h4>
                      <p>Full unrestricted access to all pages, settings, and New User administration.</p>
                    </div>
                  </div>

                  <div
                    className={`role-card-option ${formData.role === 'user' ? 'selected' : ''}`}
                    onClick={() => setFormData({ ...formData, role: 'user' })}
                  >
                    <input
                      type="radio"
                      name="userRole"
                      checked={formData.role === 'user'}
                      onChange={() => setFormData({ ...formData, role: 'user' })}
                    />
                    <div className="role-card-info">
                      <h4>Normal User (Restricted)</h4>
                      <p>Access only to pages explicitly granted below. Administration / New User is hidden.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Permissions Checklist (shown for Normal Users) */}
              {formData.role === 'user' ? (
                <div className="permissions-section-box">
                  <div className="perms-header-row">
                    <div>
                      <h3>Allowed Page Permissions</h3>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        Check the pages this user is permitted to open:
                      </span>
                    </div>

                    <div className="presets-row">
                      <button
                        type="button"
                        className="preset-btn"
                        onClick={() => applyPreset('all')}
                      >
                        ✓ Select All
                      </button>
                      <button
                        type="button"
                        className="preset-btn"
                        onClick={() => applyPreset('cashier')}
                      >
                        💵 POS Cashier Preset
                      </button>
                      <button
                        type="button"
                        className="preset-btn"
                        onClick={() => applyPreset('stock')}
                      >
                        📦 Stock Manager Preset
                      </button>
                      <button
                        type="button"
                        className="preset-btn"
                        onClick={() => applyPreset('approver')}
                      >
                        ✍️ Approver Preset
                      </button>
                      <button
                        type="button"
                        className="preset-btn"
                        onClick={() => applyPreset('clear')}
                      >
                        ✕ Clear All
                      </button>
                    </div>
                  </div>

                  {permissionCategories.map((category) => {
                    const catItems = SYSTEM_MODULES.filter((m) => category.keys.includes(m.id));
                    const allSelected = category.keys.every((k) => formData.permissions.includes(k));

                    return (
                      <div key={category.name} className="perm-category-card">
                        <div className="category-title-bar">
                          <span className="category-title">{category.name}</span>
                          <button
                            type="button"
                            className="category-toggle-btn"
                            onClick={() => toggleCategory(category.keys)}
                          >
                            {allSelected ? 'Deselect Category' : 'Select All in Category'}
                          </button>
                        </div>

                        <div className="perm-checkboxes-grid">
                          {catItems.map((item) => {
                            const isChecked = formData.permissions.includes(item.id);
                            return (
                              <label key={item.id} className="perm-check-label">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handlePermissionToggle(item.id)}
                                />
                                <span>{item.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  style={{
                    padding: '12px 16px',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#1e3a8a',
                  }}
                >
                  ℹ️ <strong>Administrator Role Active:</strong> Administrators automatically receive full,
                  unrestricted access to all modules, master files, sales registers, and administration options.
                </div>
              )}

              <div className="modal-footer">
                <button
                  type="button"
                  className="modal-btn secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={formSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-btn primary"
                  disabled={formSubmitting}
                >
                  {formSubmitting
                    ? 'Saving User...'
                    : isEditing
                    ? 'Save Changes'
                    : 'Create New User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {notification && (
        <div className={`toast-notification ${notification.type}`}>
          {notification.message}
        </div>
      )}
    </div>
  );
}

export default NewUser;
