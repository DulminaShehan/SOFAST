import { useEffect, useRef } from 'react';
import './ClassicConfirmDialog.css';

/**
 * Classic SOFAST Desktop Confirmation Dialog
 * Adheres strictly to the classic desktop visual aesthetic.
 * Fully keyboard accessible (Enter = confirm, Escape = cancel, Arrow keys = switch buttons).
 */
export default function ClassicConfirmDialog({
  isOpen,
  title = 'SOFAST POS - Confirmation',
  message = 'Do you want to save this record?',
  details = '',
  type = 'save', // 'save' | 'print' | 'delete' | 'question' | 'warning'
  buttons = null, // array of { key: 'yes'|'no'|'cancel', label: string, isDefault?: boolean, isDanger?: boolean, isPrimary?: boolean }
  onAction, // (actionKey) => void
  onClose,
}) {
  const dialogRef = useRef(null);
  const buttonRefs = useRef([]);

  // Default button configurations if none provided
  const resolvedButtons = buttons || (
    type === 'print'
      ? [
          { key: 'yes', label: 'Yes', isPrimary: true, isDefault: true, title: 'Save the invoice and print it' },
          { key: 'no', label: 'No', isDefault: false, title: 'Save the invoice without printing' },
          { key: 'cancel', label: 'Cancel', isDefault: false, title: 'Return to invoice without saving' },
        ]
      : [
          { key: 'yes', label: 'Yes', isPrimary: type === 'save', isDanger: type === 'delete', isDefault: type !== 'delete' },
          { key: 'no', label: 'No', isDefault: type === 'delete' },
        ]
  );

  // Focus the default button on open
  useEffect(() => {
    if (!isOpen) return;

    const defaultIndex = resolvedButtons.findIndex((b) => b.isDefault);
    const targetIndex = defaultIndex >= 0 ? defaultIndex : 0;

    const timer = setTimeout(() => {
      if (buttonRefs.current[targetIndex]) {
        buttonRefs.current[targetIndex].focus();
      }
    }, 30);

    return () => clearTimeout(timer);
  }, [isOpen, resolvedButtons]);

  // Keyboard navigation inside the dialog
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      // Escape -> trigger cancel or no
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        const cancelBtn = resolvedButtons.find((b) => b.key === 'cancel') || resolvedButtons.find((b) => b.key === 'no');
        if (cancelBtn) {
          onAction?.(cancelBtn.key);
        } else {
          onClose?.();
        }
        return;
      }

      // Enter on dialog window when no button specifically focused
      if (e.key === 'Enter') {
        const activeEl = document.activeElement;
        const isButtonFocused = buttonRefs.current.some((b) => b === activeEl);
        if (!isButtonFocused) {
          e.preventDefault();
          e.stopPropagation();
          const defaultBtn = resolvedButtons.find((b) => b.isDefault) || resolvedButtons[0];
          if (defaultBtn) onAction?.(defaultBtn.key);
        }
        return;
      }

      // ArrowLeft / ArrowRight navigation between dialog buttons
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const currentIndex = buttonRefs.current.findIndex((b) => b === document.activeElement);
        if (currentIndex >= 0) {
          e.preventDefault();
          let nextIndex = e.key === 'ArrowLeft' ? currentIndex - 1 : currentIndex + 1;
          if (nextIndex < 0) nextIndex = buttonRefs.current.length - 1;
          if (nextIndex >= buttonRefs.current.length) nextIndex = 0;
          buttonRefs.current[nextIndex]?.focus();
        }
        return;
      }

      // Tab trap
      if (e.key === 'Tab') {
        const firstBtn = buttonRefs.current[0];
        const lastBtn = buttonRefs.current[buttonRefs.current.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === firstBtn) {
            e.preventDefault();
            lastBtn?.focus();
          }
        } else {
          if (document.activeElement === lastBtn) {
            e.preventDefault();
            firstBtn?.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, resolvedButtons, onAction, onClose]);

  if (!isOpen) return null;

  // Render icon based on dialog type
  const renderIcon = () => {
    switch (type) {
      case 'save':
        // Classic 3.5" Blue Floppy Disk
        return (
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="2" fill="#005bb7" stroke="#003d7a" strokeWidth="1.5" />
            <rect x="7" y="3" width="10" height="7" rx="1" fill="#ffffff" />
            <rect x="13" y="4" width="2.5" height="5" fill="#003d7a" />
            <rect x="6" y="13" width="12" height="7" rx="1" fill="#d4d0c8" stroke="#716f64" strokeWidth="1" />
            <line x1="8" y1="16" x2="16" y2="16" stroke="#444" strokeWidth="1" />
            <line x1="8" y1="18" x2="14" y2="18" stroke="#444" strokeWidth="1" />
          </svg>
        );
      case 'print':
        // Classic Desktop Printer
        return (
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
            <rect x="5" y="3" width="14" height="6" rx="1" fill="#ffffff" stroke="#003d7a" strokeWidth="1.2" />
            <line x1="8" y1="5" x2="16" y2="5" stroke="#005bb7" strokeWidth="1" />
            <line x1="8" y1="7" x2="14" y2="7" stroke="#005bb7" strokeWidth="1" />
            <rect x="3" y="8" width="18" height="10" rx="2" fill="#005bb7" stroke="#003d7a" strokeWidth="1.5" />
            <circle cx="17.5" cy="11.5" r="1" fill="#00ff66" />
            <rect x="6" y="13" width="12" height="8" rx="1" fill="#ffffff" stroke="#716f64" strokeWidth="1.2" />
            <line x1="8" y1="16" x2="16" y2="16" stroke="#444" strokeWidth="1" />
            <line x1="8" y1="18" x2="16" y2="18" stroke="#444" strokeWidth="1" />
          </svg>
        );
      case 'delete':
        // Classic Red Warning Stop/Alert
        return (
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L2 22h20L12 2z"
              fill="#d92525"
              stroke="#990000"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <line x1="12" y1="9" x2="12" y2="15" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="12" cy="18.5" r="1.3" fill="#ffffff" />
          </svg>
        );
      case 'warning':
        // Yellow Caution Triangle
        return (
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L2 22h20L12 2z"
              fill="#eab308"
              stroke="#ca8a04"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <line x1="12" y1="9" x2="12" y2="15" stroke="#000000" strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="12" cy="18.5" r="1.3" fill="#000000" />
          </svg>
        );
      case 'question':
      default:
        // Classic Blue Question Bubble
        return (
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="#005bb7" stroke="#003d7a" strokeWidth="1.5" />
            <path
              d="M9.5 9a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 2-2 3.5"
              stroke="#ffffff"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <circle cx="12" cy="17.5" r="1.3" fill="#ffffff" />
          </svg>
        );
    }
  };

  const handleClose = () => {
    const cancelBtn = resolvedButtons.find((b) => b.key === 'cancel') || resolvedButtons.find((b) => b.key === 'no');
    if (cancelBtn) {
      onAction?.(cancelBtn.key);
    } else {
      onClose?.();
    }
  };

  return (
    <div className="sofast-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="sofast-dialog-title">
      <div className="sofast-dialog-window" ref={dialogRef}>
        <div className="sofast-dialog-titlebar">
          <div className="sofast-dialog-title-text" id="sofast-dialog-title">
            <span>⚙️</span>
            <span>{title}</span>
          </div>
          <button
            type="button"
            className="sofast-dialog-close-btn"
            onClick={handleClose}
            title="Close (Esc)"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="sofast-dialog-body">
          <div className="sofast-dialog-icon">{renderIcon()}</div>
          <div className="sofast-dialog-content">
            <div className="sofast-dialog-message">{message}</div>
            {details && <div className="sofast-dialog-details">{details}</div>}
          </div>
        </div>

        <div className="sofast-dialog-footer">
          {resolvedButtons.map((btn, idx) => (
            <button
              key={btn.key}
              ref={(el) => (buttonRefs.current[idx] = el)}
              type="button"
              className={`sofast-dialog-btn ${btn.isPrimary ? 'sofast-dialog-btn-primary' : ''} ${
                btn.isDanger ? 'sofast-dialog-btn-danger' : ''
              } ${btn.isDefault ? 'is-default' : ''}`}
              title={btn.title || btn.label}
              onClick={() => onAction?.(btn.key)}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

