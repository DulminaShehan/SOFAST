import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainMenu from '../../components/navigation/MainMenu';
import './MasterFile.css';

/**
 * MasterFile Screen
 * Classic SOFAST Desktop Workspace with Horizontal System Menu Bar
 */
function MasterFile() {
  const [activeModule, setActiveModule] = useState(null);
  const navigate = useNavigate();

  const handleSelectMenuItem = (itemLabel) => {
    setActiveModule(itemLabel);
  };

  return (
    <div className="masterfile-page-container">
      {/* Top Application Title Bar & Navigation Bar */}
      <header className="masterfile-system-header">
        <div className="system-title-section">
          <span>SOFAST POS System &mdash; Master Files</span>
        </div>
        <button
          type="button"
          className="system-back-btn"
          onClick={() => navigate('/selection')}
          title="Return to Main Selection Screen"
        >
          &larr; Back to Selection
        </button>
      </header>

      {/* Classic Horizontal Menu Bar */}
      <MainMenu onSelectMenuItem={handleSelectMenuItem} />

      {/* Desktop Workspace Area */}
      <main className="masterfile-workspace">
        <div className="module-placeholder-window">
          <div className="module-window-titlebar">
            <span>
              {activeModule ? `${activeModule} - Window` : 'SOFAST Master Files System'}
            </span>
          </div>
          <div className="module-window-body">
            {activeModule ? (
              <>
                <h1 className="module-placeholder-title">{activeModule} - Coming Soon</h1>
                <p className="module-placeholder-desc">
                  The {activeModule} module interface and functionality will be available in an upcoming update.
                </p>
                <div className="module-placeholder-note">
                  Status: Placeholder Active &bull; Ready for module implementation
                </div>
              </>
            ) : (
              <>
                <h1 className="module-placeholder-title">SOFAST Master Files Workspace</h1>
                <p className="module-placeholder-desc">
                  Please click on <strong>Master Files</strong> or any top-level menu item above to open a module.
                </p>
                <div className="module-placeholder-note">
                  Menu Ready: Master Files, Stock Control, Sales &amp; Service, Production, Reports, Accounting, Administration
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Classic Desktop Status Bar */}
      <footer className="masterfile-statusbar">
        <span>Ready &bull; {activeModule ? `Selected: ${activeModule}` : 'SOFAST System v1.0'}</span>
      </footer>
    </div>
  );
}

export default MasterFile;
