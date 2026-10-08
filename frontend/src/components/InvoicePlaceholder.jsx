import { useNavigate } from 'react-router-dom';

function InvoicePlaceholder() {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconCircle}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="#196eff">
            <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" />
            <path d="M8 12H16M8 15H16M8 18H13" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <h1 style={styles.title}>Invoice Module</h1>
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
    backgroundColor: '#dceaff',
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
    backgroundColor: '#196eff',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
};

export default InvoicePlaceholder;
