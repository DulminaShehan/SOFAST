import axios from 'axios';

/**
 * Centralized Axios instance for SOFAST API communication.
 * Base URL is configured dynamically via the VITE_API_URL environment variable.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://168.144.117.2.sslip.io/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor: attach current session authentication headers
api.interceptors.request.use(
  (config) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const userStr = localStorage.getItem('sofast_auth_user');
        if (userStr) {
          const user = JSON.parse(userStr);
          if (user) {
            config.headers['x-user-role'] = user.role || 'user';
            config.headers['x-username'] = user.username || '';
            config.headers['x-user-id'] = user.id || user._id || '';
          }
        }
      }
    } catch {
      // Fallback if localStorage is inaccessible
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor (notifies app of database changes, centralized error handling)
api.interceptors.response.use(
  (response) => {
    const method = String(response.config?.method || '').toLowerCase();
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      try {
        const timestamp = Date.now().toString();
        window.dispatchEvent(
          new CustomEvent('sofast:database-updated', {
            detail: { method, url: response.config?.url, timestamp },
          })
        );
        localStorage.setItem('sofast_db_last_update', timestamp);
      } catch {
        // Ignore environments where window/localStorage are unavailable
      }
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
