import { useNavigate } from 'react-router-dom';
import './SelectionScreen.css';

/**
 * Invoice, Reports & Master File Selection Screen
 * Minimal Dashboard with 3 Cards: Master File, Invoice, and Reports.
 */
function SelectionScreen() {
  const navigate = useNavigate();

  const handleMasterFileClick = () => {
    navigate('/master-file');
  };

  const handleInvoiceClick = () => {
    navigate('/invoice');
  };

  const handleReportsClick = () => {
    navigate('/reports');
  };

  return (
    <div className="selection-screen-container">
      {/* Top-Left Decorative Organic Blob */}
      <svg
        className="bg-blob-top-left"
        viewBox="0 0 500 450"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M-50 -50 C180 -50 360 20 380 140 C400 260 280 340 180 360 C80 380 -50 300 -50 180 Z"
          fill="url(#blue-gradient)"
        />
        <defs>
          <linearGradient id="blue-gradient" x1="0" y1="0" x2="400" y2="400" gradientUnits="userSpaceOnUse">
            <stop stopColor="#c5dcff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#e3eeff" stopOpacity="0.15" />
          </linearGradient>
        </defs>
      </svg>

      {/* Bottom-Right Decorative Organic Blob */}
      <svg
        className="bg-blob-bottom-right"
        viewBox="0 0 500 450"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M550 500 C320 500 140 430 120 310 C100 190 220 110 320 90 C420 70 550 150 550 270 Z"
          fill="url(#purple-gradient)"
        />
        <defs>
          <linearGradient id="purple-gradient" x1="500" y1="500" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop stopColor="#dcceff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#f0eaff" stopOpacity="0.15" />
          </linearGradient>
        </defs>
      </svg>

      {/* Top-Right Decorative Dot Pattern */}
      <svg
        className="bg-dots-top-right"
        width="100"
        height="56"
        viewBox="0 0 100 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g fill="#93b3f8" opacity="0.6">
          <circle cx="6" cy="6" r="3.5" />
          <circle cx="28" cy="6" r="3.5" />
          <circle cx="50" cy="6" r="3.5" />
          <circle cx="72" cy="6" r="3.5" />
          <circle cx="94" cy="6" r="3.5" />

          <circle cx="6" cy="28" r="3.5" />
          <circle cx="28" cy="28" r="3.5" />
          <circle cx="50" cy="28" r="3.5" />
          <circle cx="72" cy="28" r="3.5" />
          <circle cx="94" cy="28" r="3.5" />

          <circle cx="6" cy="50" r="3.5" />
          <circle cx="28" cy="50" r="3.5" />
          <circle cx="50" cy="50" r="3.5" />
          <circle cx="72" cy="50" r="3.5" />
          <circle cx="94" cy="50" r="3.5" />
        </g>
      </svg>

      {/* Bottom-Left Decorative Dot Pattern */}
      <svg
        className="bg-dots-bottom-left"
        width="100"
        height="56"
        viewBox="0 0 100 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g fill="#93b3f8" opacity="0.6">
          <circle cx="6" cy="6" r="3.5" />
          <circle cx="28" cy="6" r="3.5" />
          <circle cx="50" cy="6" r="3.5" />
          <circle cx="72" cy="6" r="3.5" />
          <circle cx="94" cy="6" r="3.5" />

          <circle cx="6" cy="28" r="3.5" />
          <circle cx="28" cy="28" r="3.5" />
          <circle cx="50" cy="28" r="3.5" />
          <circle cx="72" cy="28" r="3.5" />
          <circle cx="94" cy="28" r="3.5" />

          <circle cx="6" cy="50" r="3.5" />
          <circle cx="28" cy="50" r="3.5" />
          <circle cx="50" cy="50" r="3.5" />
          <circle cx="72" cy="50" r="3.5" />
          <circle cx="94" cy="50" r="3.5" />
        </g>
      </svg>

      {/* Main Center Selection Cards: Master File, Invoice, Reports */}
      <main className="selection-cards-wrapper">
        {/* Card 1: Master File */}
        <div
          className="selection-card master-card"
          onClick={handleMasterFileClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleMasterFileClick()}
          aria-label="Master File - Manage items, suppliers and master records"
        >
          {/* Master File Icon */}
          <div className="card-icon-wrapper">
            <svg
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M4 4C2.89543 4 2 4.89543 2 6V18C2 19.1046 2.89543 20 4 20H20C21.1046 20 22 19.1046 22 18V8C22 6.89543 21.1046 6 20 6H12L10 4H4Z" />
              <path
                d="M8 12H16M8 15H13"
                stroke="#ccfbf1"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <h2 className="card-title">Master File</h2>
          <p className="card-description">Manage items, suppliers & master data</p>

          {/* Bottom Wave and Circular Button */}
          <div className="card-bottom-section">
            <svg
              className="card-wave-svg"
              viewBox="0 0 330 110"
              preserveAspectRatio="none"
              fill="none"
            >
              <path
                d="M0 40 C70 20 130 50 200 35 C260 20 295 45 330 50 L330 110 L0 110 Z"
                fill="#f0fdfa"
              />
            </svg>
            <button
              type="button"
              className="card-action-btn"
              aria-label="Navigate to Master File"
              tabIndex={-1}
            >
              <svg className="btn-arrow-icon" viewBox="0 0 24 24">
                <path d="M5 12H19M19 12L12 5M19 12L12 19" />
              </svg>
            </button>
          </div>
        </div>

        {/* Card 2: Invoice */}
        <div
          className="selection-card invoice-card"
          onClick={handleInvoiceClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleInvoiceClick()}
          aria-label="Invoice - Create and manage invoices"
        >
          {/* Document / Invoice Icon */}
          <div className="card-icon-wrapper">
            <svg
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" />
              <path
                d="M8 12H16M8 15H16M8 18H13"
                stroke="#dceaff"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <h2 className="card-title">Invoice</h2>
          <p className="card-description">Create and manage invoices</p>

          {/* Bottom Wave and Circular Button */}
          <div className="card-bottom-section">
            <svg
              className="card-wave-svg"
              viewBox="0 0 330 110"
              preserveAspectRatio="none"
              fill="none"
            >
              <path
                d="M0 35 C70 15 130 55 200 40 C260 25 295 48 330 55 L330 110 L0 110 Z"
                fill="#eaf2ff"
              />
            </svg>
            <button
              type="button"
              className="card-action-btn"
              aria-label="Navigate to Invoice"
              tabIndex={-1}
            >
              <svg className="btn-arrow-icon" viewBox="0 0 24 24">
                <path d="M5 12H19M19 12L12 5M19 12L12 19" />
              </svg>
            </button>
          </div>
        </div>

        {/* Card 3: Reports */}
        <div
          className="selection-card reports-card"
          onClick={handleReportsClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleReportsClick()}
          aria-label="Reports - View and analyze reports"
        >
          {/* Bar Chart / Reports Icon */}
          <div className="card-icon-wrapper">
            <svg
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="3" y="13" width="4.5" height="8" rx="2" fill="currentColor" />
              <rect x="9.75" y="8" width="4.5" height="13" rx="2" fill="currentColor" />
              <rect x="16.5" y="3" width="4.5" height="18" rx="2" fill="currentColor" />
            </svg>
          </div>

          <h2 className="card-title">Reports</h2>
          <p className="card-description">View and analyze reports</p>

          {/* Bottom Wave and Circular Button */}
          <div className="card-bottom-section">
            <svg
              className="card-wave-svg"
              viewBox="0 0 330 110"
              preserveAspectRatio="none"
              fill="none"
            >
              <path
                d="M0 45 C60 25 120 40 180 50 C240 60 285 30 330 40 L330 110 L0 110 Z"
                fill="#f5eefa"
              />
            </svg>
            <button
              type="button"
              className="card-action-btn"
              aria-label="Navigate to Reports"
              tabIndex={-1}
            >
              <svg className="btn-arrow-icon" viewBox="0 0 24 24">
                <path d="M5 12H19M19 12L12 5M19 12L12 19" />
              </svg>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default SelectionScreen;
