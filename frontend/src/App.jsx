import { useState, useEffect } from 'react';
import api from './services/api';

function App() {
  const [healthStatus, setHealthStatus] = useState({
    loading: true,
    success: false,
    message: 'Checking backend connection...',
  });

  useEffect(() => {
    const checkApiHealth = async () => {
      try {
        const response = await api.get('/health');
        if (response.data && response.data.success) {
          setHealthStatus({
            loading: false,
            success: true,
            message: response.data.message,
          });
        } else {
          setHealthStatus({
            loading: false,
            success: false,
            message: 'Unexpected health response received',
          });
        }
      } catch (error) {
        setHealthStatus({
          loading: false,
          success: false,
          message: error.message || 'Unable to connect to backend API',
        });
      }
    };

    checkApiHealth();
  }, []);

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <div style={styles.badge}>Architecture Initialized</div>
        <h1 style={styles.title}>SOFAST Web System</h1>
        <p style={styles.subtitle}>Frontend is ready.</p>

        <div style={styles.healthContainer}>
          <div style={styles.healthHeader}>
            <span
              style={{
                ...styles.statusDot,
                backgroundColor: healthStatus.loading
                  ? '#f59e0b'
                  : healthStatus.success
                  ? '#10b981'
                  : '#ef4444',
              }}
            />
            <span style={styles.healthLabel}>Backend API Health:</span>
          </div>
          <p style={styles.healthMessage}>
            {healthStatus.loading ? 'Connecting...' : healthStatus.message}
          </p>
        </div>
      </div>
    </main>
  );
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    padding: '24px',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
  },
  card: {
    width: '100%',
    maxWidth: '520px',
    backgroundColor: '#1e293b',
    borderRadius: '16px',
    padding: '40px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
    border: '1px solid #334155',
    textAlign: 'center',
  },
  badge: {
    display: 'inline-block',
    padding: '6px 14px',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: '600',
    borderRadius: '9999px',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    marginBottom: '20px',
  },
  title: {
    fontSize: '30px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '8px',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: '16px',
    color: '#94a3b8',
    marginBottom: '28px',
  },
  healthContainer: {
    backgroundColor: '#0f172a',
    borderRadius: '10px',
    padding: '16px',
    border: '1px solid #334155',
    textAlign: 'left',
  },
  healthHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
  },
  statusDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  healthLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#cbd5e1',
  },
  healthMessage: {
    fontSize: '14px',
    color: '#94a3b8',
    paddingLeft: '18px',
  },
};

export default App;
