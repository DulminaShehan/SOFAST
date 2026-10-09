import { useNavigate } from 'react-router-dom';
import MainMenu from '../components/navigation/MainMenu';
import windowIcon from '../assets/window-icon.png';
import './DesktopLayout.css';

/**
 * DesktopLayout Component
 * Standard layout providing the classic SOFAST window header, horizontal MainMenu, and desktop canvas.
 */
function DesktopLayout({ moduleTitle, children }) {
  const navigate = useNavigate();

  return (
    <div className="desktop-layout-container">
      {/* Top Application Title Bar */}
      <header className="desktop-window-header">
        <div className="desktop-header-left">
          <img src={windowIcon} alt="" className="desktop-header-icon" />
          <span className="desktop-header-title">SOFAST POS System</span>
        </div>
        <button
          type="button"
          className="desktop-back-btn"
          onClick={() => navigate('/selection')}
          title="Return to Selection Dashboard"
        >
          &larr; Selection Screen
        </button>
      </header>

      {/* Classic Horizontal SOFAST Menu Bar */}
      <MainMenu />

      {/* Main Workspace Canvas */}
      <main className="desktop-workspace-canvas">
        {children ? (
          children
        ) : (
          <div className="desktop-module-window">
            <div className="desktop-module-titlebar">
              <span>{moduleTitle ? `${moduleTitle} - Window` : 'SOFAST POS System'}</span>
            </div>
            <div className="desktop-module-body">
              <h1 className="desktop-module-title">
                {moduleTitle ? `${moduleTitle} - Coming Soon` : 'Module Placeholder'}
              </h1>
              <p className="desktop-module-desc">
                The {moduleTitle || 'requested'} module interface and operations are being prepared for the next step.
              </p>
              <div className="desktop-module-tag">
                Status: Ready for module implementation
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Classic Desktop Status Bar */}
      <footer className="desktop-statusbar">
        <span>Ready &bull; {moduleTitle ? `Current Module: ${moduleTitle}` : 'SOFAST Desktop Shell'}</span>
      </footer>
    </div>
  );
}

export default DesktopLayout;
