import { useEffect, useRef } from 'react';

/**
 * Reusable React Hook to handle scoped keyboard shortcuts reliably.
 * Cleans up listeners automatically on unmount to prevent duplicate event listeners.
 *
 * @param {string|string[]} key - Key or array of keys (e.g. 'F6', 'Escape', 'Enter')
 * @param {function} callback - Function to execute when key is pressed
 * @param {object} options - Configuration options
 */
export function useKeyboardShortcut(key, callback, options = {}) {
  const {
    enabled = true,
    preventDefault = true,
    stopPropagation = true,
    target = window,
    allowInInputs = true, // Default to true for function keys like F6
  } = options;

  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const targetKeys = Array.isArray(key) ? key.map((k) => k.toLowerCase()) : [key.toLowerCase()];

    const handleKeyDown = (e) => {
      const pressedKey = (e.key || '').toLowerCase();
      if (!targetKeys.includes(pressedKey)) return;

      // Check if user is typing in input/textarea and allowInInputs is false
      if (!allowInInputs) {
        const tag = e.target?.tagName?.toUpperCase();
        const isEditable = e.target?.isContentEditable;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || isEditable) {
          return;
        }
      }

      if (preventDefault) e.preventDefault();
      if (stopPropagation) e.stopPropagation();

      callbackRef.current?.(e);
    };

    const targetElement = typeof target === 'function' ? target() : (target?.current || target);
    if (!targetElement?.addEventListener) return;

    targetElement.addEventListener('keydown', handleKeyDown);
    return () => {
      targetElement.removeEventListener('keydown', handleKeyDown);
    };
  }, [key, enabled, preventDefault, stopPropagation, target, allowInInputs]);
}

