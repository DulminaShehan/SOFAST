import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import './ConfirmDialog.css';

const ConfirmContext = createContext(null);

/**
 * Global Confirm Provider for SOFAST POS
 * Standardizes all system confirmation message dialogs to Windows Desktop Yes/No Only:
 * - Eliminates Cancel button
 * - Centers/evenly spaces Yes and No buttons
 * - Focuses Yes by default
 * - Enter activates focused button, Esc/close acts as No
 */
export function ConfirmProvider({ children }) {
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: 'SOFAST POS - Confirmation',
    message: 'Are you sure you wish to proceed?',
    icon: 'question', // 'print' | 'question' | 'warning' | 'info' | 'save' | 'delete'
    defaultFocus: 'yes', // 'yes' | 'no'
    yesLabel: 'Yes',
    noLabel: 'No',
    resolve: null,
  });

  const [activeFocus, setActiveFocus] = useState('yes');
  const yesBtnRef = useRef(null);
  const noBtnRef = useRef(null);
  const dialogRef = useRef(null);

  /**
   * Main confirmation function
   * Returns a Promise resolving to true (Yes) or false (No)
   * Usage:
   *   const confirmed = await confirm({
   *     title: 'SOFAST POS - Print Invoice',
   *     message: 'Do you wish to print this invoice?',
   *     icon: 'print'
   *   });
   */
  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      const title = options.title || 'SOFAST POS - Confirmation';
      const message = options.message || (typeof options === 'string' ? options : 'Are you sure you wish to proceed?');
      const icon = options.icon || (
        message.toLowerCase().includes('print') ? 'print' :
        message.toLowerCase().includes('delete') || message.toLowerCase().includes('discard') ? 'warning' :
        'question'
      );
      const defaultFocus = options.defaultFocus || 'yes';
      const yesLabel = options.yesLabel || 'Yes';
      const noLabel = options.noLabel || 'No';

      setActiveFocus(defaultFocus);
      setDialogState({
        isOpen: true,
        title,
        message,
        icon,
        defaultFocus,
        yesLabel,
        noLabel,
        resolve,
      });
    });
  }, []);

  const handleYes = useCallback(() => {
    if (dialogState.resolve) {
      dialogState.resolve(true);
    }
    setDialogState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  }, [dialogState]);

  const handleNo = useCallback(() => {
    if (dialogState.resolve) {
      dialogState.resolve(false);
    }
    setDialogState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  }, [dialogState]);

  // Focus management when dialog opens
  useEffect(() => {
    if (dialogState.isOpen) {
      const timer = setTimeout(() => {
        if (dialogState.defaultFocus === 'no' && noBtnRef.current) {
          noBtnRef.current.focus();
          setActiveFocus('no');
        } else if (yesBtnRef.current) {
          yesBtnRef.current.focus();
          setActiveFocus('yes');
        }
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [dialogState.isOpen, dialogState.defaultFocus]);

  // Keyboard navigation: Enter, Esc, Left, Right, Tab
  useEffect(() => {
    if (!dialogState.isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleNo();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Tab') {
        e.preventDefault();
        setActiveFocus((prev) => {
          const next = prev === 'yes' ? 'no' : 'yes';
          if (next === 'yes' && yesBtnRef.current) yesBtnRef.current.focus();
          if (next === 'no' && noBtnRef.current) noBtnRef.current.focus();
          return next;
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (activeFocus === 'no') {
          handleNo();
        } else {
          handleYes();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [dialogState.isOpen, activeFocus, handleYes, handleNo]);

  // Expose global window helper for easy programmatic access anywhere
  useEffect(() => {
    window.confirmYesNo = confirm;
    return () => {
      delete window.confirmYesNo;
    };
  }, [confirm]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {dialogState.isOpen && (
        <div className="sofast-msgbox-overlay" role="dialog" aria-modal="true" aria-labelledby="sofast-msgbox-title">
          <div className="sofast-msgbox-window" ref={dialogRef}>
            {/* Classic Windows Titlebar */}
            <div className="sofast-msgbox-titlebar">
              <div className="sofast-msgbox-title-left">
                <span className="sofast-msgbox-app-icon" aria-hidden="true">⚙️</span>
                <span id="sofast-msgbox-title" className="sofast-msgbox-title-text">{dialogState.title}</span>
              </div>
              <button
                type="button"
                className="sofast-msgbox-close-btn"
                onClick={handleNo}
                title="Close (No)"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Dialog Body with Icon & Message */}
            <div className="sofast-msgbox-body">
              <div className="sofast-msgbox-icon-container" aria-hidden="true">
                {dialogState.icon === 'print' ? (
                  /* Classic Windows Blue Desktop Printer Icon matching reference image */
                  <svg className="sofast-msgbox-icon-img" viewBox="0 0 48 48" width="40" height="40">
                    <rect x="12" y="4" width="24" height="12" fill="#f8fafc" stroke="#475569" strokeWidth="2" rx="1" />
                    <line x1="16" y1="8" x2="32" y2="8" stroke="#94a3b8" strokeWidth="2" />
                    <line x1="16" y1="12" x2="28" y2="12" stroke="#94a3b8" strokeWidth="2" />
                    <rect x="6" y="14" width="36" height="20" fill="#0284c7" stroke="#0369a1" strokeWidth="2" rx="3" />
                    <circle cx="11" cy="20" r="2" fill="#22c55e" />
                    <circle cx="17" cy="20" r="1.5" fill="#f59e0b" />
                    <rect x="12" y="24" width="24" height="18" fill="#ffffff" stroke="#475569" strokeWidth="2" rx="1" />
                    <line x1="16" y1="30" x2="32" y2="30" stroke="#0284c7" strokeWidth="2" />
                    <line x1="16" y1="34" x2="28" y2="34" stroke="#64748b" strokeWidth="1.5" />
                    <line x1="16" y1="38" x2="24" y2="38" stroke="#64748b" strokeWidth="1.5" />
                  </svg>
                ) : dialogState.icon === 'warning' ? (
                  /* Classic Windows Warning Icon */
                  <svg className="sofast-msgbox-icon-img" viewBox="0 0 48 48" width="40" height="40">
                    <polygon points="24,4 46,42 2,42" fill="#fbbf24" stroke="#d97706" strokeWidth="2" />
                    <rect x="22" y="17" width="4" height="13" fill="#1e293b" rx="2" />
                    <circle cx="24" cy="35" r="2.5" fill="#1e293b" />
                  </svg>
                ) : (
                  /* Classic Windows Question / Confirm Icon */
                  <svg className="sofast-msgbox-icon-img" viewBox="0 0 48 48" width="40" height="40">
                    <circle cx="24" cy="24" r="20" fill="#0284c7" stroke="#0369a1" strokeWidth="2" />
                    <path
                      d="M20 18 C20 14, 28 14, 28 18 C28 22, 24 23, 24 27"
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                    <circle cx="24" cy="34" r="2.5" fill="#ffffff" />
                  </svg>
                )}
              </div>

              <div className="sofast-msgbox-text-container">
                <span className="sofast-msgbox-message">{dialogState.message}</span>
              </div>
            </div>

            {/* Button Actions: STRICTLY YES AND NO ONLY (Cancel completely eliminated) */}
            <div className="sofast-msgbox-actions">
              <button
                type="button"
                ref={yesBtnRef}
                className={`sofast-msgbox-btn ${activeFocus === 'yes' ? 'has-focus' : ''}`}
                onClick={handleYes}
                onFocus={() => setActiveFocus('yes')}
              >
                {dialogState.yesLabel}
              </button>

              <button
                type="button"
                ref={noBtnRef}
                className={`sofast-msgbox-btn ${activeFocus === 'no' ? 'has-focus' : ''}`}
                onClick={handleNo}
                onFocus={() => setActiveFocus('no')}
              >
                {dialogState.noLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

/**
 * Hook to trigger the standardized Yes/No confirmation dialog from any component
 */
export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    // Fallback if rendered outside provider: use window.confirmYesNo if available
    return {
      confirm: (options) => {
        if (typeof window !== 'undefined' && window.confirmYesNo) {
          return window.confirmYesNo(options);
        }
        const msg = typeof options === 'string' ? options : (options?.message || 'Proceed?');
        return Promise.resolve(window.confirm(msg));
      },
    };
  }
  return context;
}

export default ConfirmContext;

