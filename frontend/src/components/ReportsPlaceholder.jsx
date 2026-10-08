import { useNavigate } from 'react-router-dom';

function ReportsPlaceholder() {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconCircle}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="13" width="4.5" height="8" rx="2" fill="#6736e2" />
            <rect x="9.75" y="8" width="4.5" height="13" rx="2" fill="#6736e2" />
            <rect x="16.5" y="3" width="4.5" height="18" rx="2" fill="#6736e2" />
          </svg>
        </div>
        <h1 style={styles.title}>Reports Module</h1>
        <p style={styles.subtitle}>Coming soon...</p>
        <button
          type="button"
          style={styles.backButton}
          onClick={() => navigate('/selection')}
        >
          &larr; Back to Selection
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    width: '100vw',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafcfd',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    padding: '24px',
    boxSizing: 'border-box',
  },
  card: {
    backgroundColor: '#ffffff',
    padding: '48px 40px',
    borderRadius: '24px',
    boxShadow: '0 20px 40px -12px rgba(15, 23, 42, 0.08)',
    textAlign: 'center',
    maxWidth: '400px',
    width: '100%',
  },
  iconCircle: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    backgroundColor: '#ede2fb',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    margin: '0 auto 20px auto',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '15px',
    color: '#64748b',
    marginBottom: '28px',
  },
  backButton: {
    padding: '10px 20px',
    backgroundColor: '#6736e2',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
};

export default ReportsPlaceholder;
