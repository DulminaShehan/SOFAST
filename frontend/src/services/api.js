import axios from 'axios';

/**
 * Centralized Axios instance for SOFAST API communication.
 * Base URL is configured dynamically via the VITE_API_URL environment variable.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor (for future auth tokens, logging, etc.)
api.interceptors.request.use(
  (config) => {
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
