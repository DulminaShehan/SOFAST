import { useState, useEffect } from 'react';
import './SplashScreen.css';
import splashLogo from '../assets/Logo_A_blue_background.png';

/**
 * SOFAST MOTORS Splash Screen Component
 *
 * Professional Animation Sequence:
 * 1. Background starts with solid SOFAST blue (#005bbb).
 * 2. Logo fades in from 90% scale to 100% (0.6s).
 * 3. Logo stays fully visible for ~1.5s.
 * 4. Splash screen smoothly fades out (0.6s).
 * 5. Navigates to Login page (total duration: ~2.7s).
 */
function SplashScreen({ onFinish }) {
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (prefersReducedMotion) {
      // Direct hold without animation transitions
      const quickTimer = setTimeout(() => {
        if (onFinish) onFinish();
      }, 2000);
      return () => clearTimeout(quickTimer);
    }

    // Step 4: Begin fade out after fade-in (0.6s) + hold (1.5s) = 2.1s
    const fadeOutTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 2100);

    // Step 5 & 6: Complete fade out (2.1s + 0.6s = 2.7s) and navigate to Login
    const finishTimer = setTimeout(() => {
      if (onFinish) {
        onFinish();
      }
    }, 2700);

    return () => {
      clearTimeout(fadeOutTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div className={`splash-container ${isFadingOut ? 'splash-fade-out' : ''}`}>
      <img
        src={splashLogo}
        alt="SOFAST MOTORS"
        className="splash-logo"
      />
    </div>
  );
}

export default SplashScreen;
