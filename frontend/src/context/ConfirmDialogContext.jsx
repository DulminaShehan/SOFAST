import { createContext, useContext, useState, useCallback, useRef } from 'react';
import ClassicConfirmDialog from '../components/ClassicConfirmDialog';

const ConfirmDialogContext = createContext(null);

export function ConfirmDialogProvider({ children }) {
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: 'SOFAST POS - Confirmation',
    message: 'Do you want to save this record?',
    details: '',
    type: 'save',
    buttons: null,
  });

  const resolverRef = useRef(null);

  /**
   * Core confirmation promise trigger
   */
  const showConfirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialogState({
        isOpen: true,
        title: options.title || 'SOFAST POS - Confirmation',
        message: options.message || 'Do you want to save this record?',
        details: options.details || '',
        type: options.type || 'save',
        buttons: options.buttons || null,
      });
    });
  }, []);

  const handleAction = useCallback((actionKey) => {
    setDialogState((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(actionKey);
      resolverRef.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    setDialogState((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(null);
      resolverRef.current = null;
    }
  }, []);

  /**
   * Helper: Global Save Confirmation (Yes / No)
   * Resolves: true if 'yes', false otherwise
   */
  const confirmSave = useCallback(
    async (message = 'Do you want to save this record?', title = 'Save Confirmation', details = '') => {
      const result = await showConfirm({
        title,
        message,
        details,
        type: 'save',
        buttons: [
          { key: 'yes', label: 'Yes', isPrimary: true, isDefault: true, title: 'Continue saving record' },
          { key: 'no', label: 'No', isDefault: false, title: 'Cancel the operation' },
        ],
      });
      return result === 'yes';
    },
    [showConfirm]
  );

  /**
   * Helper: Global Delete Confirmation (Yes / No)
   * Resolves: true if 'yes', false otherwise
   */
  const confirmDelete = useCallback(
    async (message = 'Are you sure you want to delete this record?', title = 'Delete Confirmation', details = '') => {
      const result = await showConfirm({
        title,
        message,
        details,
        type: 'delete',
        buttons: [
          { key: 'yes', label: 'Yes', isDanger: true, isDefault: false, title: 'Permanently delete this record' },
          { key: 'no', label: 'No', isDefault: true, title: 'Cancel deletion' },
        ],
      });
      return result === 'yes';
    },
    [showConfirm]
  );

  /**
   * Helper: Sales Invoice Save & Print Confirmation (Yes / No)
   * Resolves: 'yes' (Save & Print Bill) | 'no' (Do not save and do not print)
   */
  const confirmInvoicePrint = useCallback(
    async (message = 'Do you wish to print this invoice?', title = 'SOFAST POS - Print Invoice') => {
      const result = await showConfirm({
        title,
        message,
        type: 'print',
        buttons: [
          { key: 'yes', label: 'Yes', isPrimary: true, isDefault: true, title: 'Save invoice and print bill' },
          { key: 'no', label: 'No', isDefault: false, title: 'Do not save and do not print' },
        ],
      });
      return result || 'no';
    },
    [showConfirm]
  );

  return (
    <ConfirmDialogContext.Provider
      value={{
        showConfirm,
        confirmSave,
        confirmDelete,
        confirmInvoicePrint,
      }}
    >
      {children}
      <ClassicConfirmDialog
        isOpen={dialogState.isOpen}
        title={dialogState.title}
        message={dialogState.message}
        details={dialogState.details}
        type={dialogState.type}
        buttons={dialogState.buttons}
        onAction={handleAction}
        onClose={handleClose}
      />
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error('useConfirmDialog must be used within a ConfirmDialogProvider');
  }
  return context;
}

