import { useState } from 'react';
import './Login.css';
import usersIcon from '../assets/users-icon.png';
import windowIcon from '../assets/window-icon.png';
import { useAuth } from '../context/AuthContext';

/**
 * SOFAST Desktop Legacy-Style Login Component
 * Connects to role-based authentication service
 */
function Login({ onLoginSuccess }) {
  const [userName, setUserName] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const result = await login(userName, password);
      if (result.success) {
        if (onLoginSuccess) {
          onLoginSuccess();
        }
      } else {
        setErrorMessage(result.message || 'Invalid username or password');
      }
    } catch (err) {
      setErrorMessage('Login failed. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickLogin = (user, pass) => {
    setUserName(user);
    setPassword(pass);
    setErrorMessage('');
    // Auto-login
    setIsSubmitting(true);
    login(user, pass).then((result) => {
      setIsSubmitting(false);
      if (result.success && onLoginSuccess) {
        onLoginSuccess();
      } else {
        setErrorMessage(result.message || 'Login failed');
      }
    });
  };

  return (
    <div className="login-page-container">
      <div className="login-window">
        {/* Title Bar */}
        <div className="login-titlebar">
          <div className="titlebar-left">
            <img src={windowIcon} alt="" className="window-icon" />
            <span className="window-title">Log In</span>
          </div>
          <button
            type="button"
            className="titlebar-close-btn"
            aria-label="Close"
            tabIndex={-1}
          >
            &#x2715;
          </button>
        </div>

        {/* Main Inner Panel */}
        <div className="login-frame">
          {/* Left Side: Users Icon */}
          <div className="login-icon-section">
            <img
              src={usersIcon}
              alt="Users Icon"
              className="user-group-icon"
            />
          </div>

          {/* Right Side: Form Inputs */}
          <div className="login-form-section">
            <form onSubmit={handleSubmit} className="login-form" autoComplete="off">
              <div className="login-field-row">
                <label htmlFor="userName" className="login-label">
                  User Name
                </label>
                <input
                  id="userName"
                  type="text"
                  className="login-input"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="login-field-row">
                <label htmlFor="password" className="login-label">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className="login-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {errorMessage && (
                <div style={{ color: '#b91c1c', fontSize: '11px', marginTop: '2px' }}>
                  {errorMessage}
                </div>
              )}

              <div className="login-button-row">
                <button
                  type="submit"
                  className="login-submit-btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? '...' : 'Log In'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Quick Testing Accounts Helper */}
        <div
          style={{
            margin: '0 10px 10px 10px',
            padding: '8px 10px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '3px',
            fontSize: '11px',
            color: '#475569',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#1e293b' }}>
            Quick Demo Logins:
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => handleQuickLogin('admin', 'admin123')}
              style={{
                flex: 1,
                padding: '4px',
                fontSize: '10.5px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1d4ed8',
                borderRadius: '2px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
              title="Full Admin access: sees Administration > New User"
            >
              👑 Admin (admin)
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('cashier', 'cashier123')}
              style={{
                flex: 1,
                padding: '4px',
                fontSize: '10.5px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#15803d',
                borderRadius: '2px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
              title="Normal user: New User is HIDDEN in Administration"
            >
              👤 Normal User (cashier)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
