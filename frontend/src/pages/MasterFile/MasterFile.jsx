import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainMenu from '../../components/navigation/MainMenu';
import './MasterFile.css';

/**
 * MasterFile Screen
 * Classic SOFAST Desktop Workspace with Horizontal System Menu Bar
 * Features: Supplier Master File, Stock Master File, and full Master Data modules.
 */
function MasterFile() {
  const [activeModule, setActiveModule] = useState(null);
  const navigate = useNavigate();

  const handleSelectMenuItem = (itemLabel) => {
    setActiveModule(itemLabel);
  };

  const handleCloseModule = () => {
    setActiveModule(null);
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
            {activeModule && (
              <button
                type="button"
                className="module-window-close-btn"
                onClick={handleCloseModule}
                title="Close Window"
                aria-label="Close"
              >
                &#x2715;
              </button>
            )}
          </div>
          <div className="module-window-body">
            {activeModule ? (
              <>
                <h1 className="module-placeholder-title">{activeModule} - Coming Soon</h1>
                <p className="module-placeholder-desc">
                  The <strong>{activeModule}</strong> interface and data operations will be available in an upcoming update.
                </p>
                <div className="module-placeholder-note">
                  Status: Placeholder Active &bull; Ready for module implementation
                </div>
              </>
            ) : (
              <>
                <h1 className="module-placeholder-title">SOFAST Master Files Workspace</h1>
                <p className="module-placeholder-desc">
                  Select a module from the <strong>Master Files</strong> dropdown menu above or launch directly:
                </p>

                {/* Quick Launch Buttons for Core Master Files */}
                <div className="quick-launch-grid">
                  <button
                    type="button"
                    className="quick-launch-btn highlight"
                    onClick={() => handleSelectMenuItem('Supplier Master File')}
                  >
                    🏢 Supplier Master File
                  </button>
                  <button
                    type="button"
                    className="quick-launch-btn highlight"
                    onClick={() => handleSelectMenuItem('Stock Master File')}
                  >
                    📦 Stock Master File
                  </button>
                  <button
                    type="button"
                    className="quick-launch-btn"
                    onClick={() => handleSelectMenuItem('Customer Master File')}
                  >
                    👥 Customer Master File
                  </button>
                  <button
                    type="button"
                    className="quick-launch-btn"
                    onClick={() => handleSelectMenuItem('Category Master File')}
                  >
                    🏷️ Category Master File
                  </button>
                </div>

                <div className="module-placeholder-note">
                  Menu Ready: Master Files (Supplier, Stock, Customer, Category, Sub Category)
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
