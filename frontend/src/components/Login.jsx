import { useState } from 'react';
import './Login.css';
import usersIcon from '../assets/users-icon.png';
import windowIcon from '../assets/window-icon.png';

/**
 * SOFAST Desktop Legacy-Style Login Component
 */
function Login({ onLoginSuccess }) {
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Transition to the post-login Selection Screen
    if (onLoginSuccess) {
      onLoginSuccess();
    }
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
                />
              </div>

              <div className="login-button-row">
                <button type="submit" className="login-submit-btn">
                  Log In
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
