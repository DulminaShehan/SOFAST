import React from 'react';

/**
 * Reusable SOFAST Error Boundary
 * Catches JavaScript errors in child component trees, logs them,
 * and renders a classic SOFAST-styled fallback instead of blanking out the whole screen.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback({ error: this.state.error, reset: this.handleReset })
          : this.props.fallback;
      }

      return (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            fontFamily: 'Tahoma, Segoe UI, Arial, sans-serif',
          }}
        >
          <div
            style={{
              background: '#d4d0c8',
              border: '2px solid #b22222',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              width: '460px',
              maxWidth: '92vw',
              borderRadius: '3px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                background: 'linear-gradient(90deg, #b22222 0%, #d32f2f 100%)',
                color: '#fff',
                padding: '6px 10px',
                fontWeight: 'bold',
                fontSize: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>SOFAST POS — Dialog Exception</span>
              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  background: '#c00',
                  color: '#fff',
                  border: '1px solid #fff',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  padding: '0 6px',
                  lineHeight: '16px',
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '16px', fontSize: '12px', color: '#000' }}>
              <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', color: '#b22222' }}>
                {this.props.title || 'An error occurred while loading this view.'}
              </p>
              <div
                style={{
                  background: '#fff',
                  border: '1px inset #999',
                  padding: '8px',
                  fontSize: '11px',
                  fontFamily: 'Consolas, monospace',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  marginBottom: '14px',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {this.state.error?.message || String(this.state.error)}
              </div>
              <div style={{ textAlign: 'right' }}>
                <button
                  type="button"
                  onClick={this.handleReset}
                  style={{
                    padding: '4px 18px',
                    backgroundColor: '#d4d0c8',
                    border: '2px outset #ffffff',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Close & Return
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

