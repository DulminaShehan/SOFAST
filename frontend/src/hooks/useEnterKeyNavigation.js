import { useRef, useCallback } from 'react';

const CANDIDATE_SELECTOR = [
  'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]):not([disabled]):not([readonly])',
  'select:not([disabled])',
  'textarea:not([disabled]):not([readonly])',
].join(', ');

/**
 * Checks whether an element is an editable, enabled, visible form input field
 */
function isNavigableField(el) {
  if (!el) return false;
  if (el.disabled || el.readOnly) return false;
  if (el.tabIndex < 0 || el.getAttribute('data-enter-ignore') === 'true') return false;

  const tag = el.tagName.toUpperCase();
  if (tag === 'BUTTON') return false;

  const type = (el.type || '').toLowerCase();
  if (['button', 'submit', 'reset', 'image', 'hidden'].includes(type)) return false;

  // Check visibility (skip elements hidden by CSS or without dimensions)
  if (el.offsetParent === null && el.offsetWidth === 0 && el.offsetHeight === 0) {
    return false;
  }
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }

  return true;
}

/**
 * Standalone handler for Enter key navigation in forms or containers.
 * Prevents accidental form submission and shifts focus to the next visual field.
 *
 * @param {KeyboardEvent} e
 * @param {object} options - { container, onFinalField, saveButtonSelector, finalAction }
 */
export function handleEnterNavigation(e, options = {}) {
  if (e.key !== 'Enter') return false;

  // 1. Textarea exception: allow typing multiple lines with Enter
  if (e.target?.tagName === 'TEXTAREA') {
    return false;
  }

  // 2. Buttons: allow Enter to trigger normal button click
  const tag = e.target?.tagName?.toUpperCase();
  if (tag === 'BUTTON' || e.target?.type === 'button' || e.target?.type === 'submit') {
    return false;
  }

  // 3. Stop unwanted form submissions during field-to-field navigation
  e.preventDefault();

  const container = options.container || e.currentTarget || document;
  const allElements = Array.from(container.querySelectorAll(CANDIDATE_SELECTOR));
  const navigableElements = allElements.filter(isNavigableField);

  const currentIndex = navigableElements.indexOf(e.target);

  if (currentIndex >= 0 && currentIndex < navigableElements.length - 1) {
    // Move to next field
    const nextEl = navigableElements[currentIndex + 1];
    nextEl.focus();
    if (typeof nextEl.select === 'function' && nextEl.tagName !== 'SELECT') {
      nextEl.select();
    }
    return true;
  }

  // Reached the final field in the form
  if (options.finalAction && typeof options.finalAction === 'function') {
    options.finalAction();
    return true;
  }

  if (options.onFinalField && typeof options.onFinalField === 'function') {
    options.onFinalField();
    return true;
  }

  if (options.saveButtonSelector) {
    const saveBtn = container.querySelector(options.saveButtonSelector) || document.querySelector(options.saveButtonSelector);
    if (saveBtn && !saveBtn.disabled) {
      saveBtn.focus();
      return true;
    }
  }

  return false;
}

/**
 * React hook to enable Enter key navigation on a form or container ref
 */
export function useEnterKeyNavigation(containerRef, options = {}) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const handleKeyDown = useCallback(
    (e) => {
      handleEnterNavigation(e, {
        container: containerRef?.current,
        ...optionsRef.current,
      });
    },
    [containerRef]
  );

  return { onKeyDown: handleKeyDown };
}

export default useEnterKeyNavigation;
