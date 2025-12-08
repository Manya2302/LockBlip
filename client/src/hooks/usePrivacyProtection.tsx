import React, { useEffect, useCallback, useState, useRef } from 'react';

interface UsePrivacyProtectionOptions {
  onScreenshotDetected?: () => void;
  onVisibilityChange?: (isVisible: boolean) => void;
  enableBlurOnSwitch?: boolean;
}

export function usePrivacyProtection(options: UsePrivacyProtectionOptions = {}) {
  const [isBlurred, setIsBlurred] = useState(false);
  const [screenshotCount, setScreenshotCount] = useState(0);
  const lastKeyPressRef = useRef<number>(0);

  const handleVisibilityChange = useCallback(() => {
    const isVisible = document.visibilityState === 'visible';
    
    if (options.enableBlurOnSwitch) {
      setIsBlurred(!isVisible);
    }
    
    options.onVisibilityChange?.(isVisible);
  }, [options]);

  const detectScreenshotKeyCombo = useCallback((e: KeyboardEvent) => {
    const now = Date.now();
    const isPrintScreen = e.key === 'PrintScreen';
    const isScreenshotCombo = 
      (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5')) ||
      (e.ctrlKey && e.key === 'PrintScreen') ||
      isPrintScreen;
    
    if (isScreenshotCombo) {
      if (now - lastKeyPressRef.current > 1000) {
        lastKeyPressRef.current = now;
        setScreenshotCount(prev => prev + 1);
        options.onScreenshotDetected?.();
        console.log('Screenshot attempt detected');
      }
    }
  }, [options]);

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('keydown', detectScreenshotKeyCombo);
    window.addEventListener('keyup', detectScreenshotKeyCombo);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('keydown', detectScreenshotKeyCombo);
      window.removeEventListener('keyup', detectScreenshotKeyCombo);
    };
  }, [handleVisibilityChange, detectScreenshotKeyCombo]);

  const enableBlur = useCallback(() => {
    setIsBlurred(true);
  }, []);

  const disableBlur = useCallback(() => {
    setIsBlurred(false);
  }, []);

  return {
    isBlurred,
    screenshotCount,
    enableBlur,
    disableBlur,
  };
}

interface PrivacyBlurOverlayProps {
  isBlurred: boolean;
}

export function PrivacyBlurOverlay({ isBlurred }: PrivacyBlurOverlayProps) {
  if (!isBlurred) return null;
  
  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        backdropFilter: 'blur(20px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#00ffff',
        fontSize: '1.5rem',
        fontFamily: 'monospace',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
        <div>Content Hidden</div>
        <div style={{ fontSize: '0.875rem', opacity: 0.7, marginTop: '0.5rem' }}>
          Return to app to view
        </div>
      </div>
    </div>
  );
}

export default usePrivacyProtection;
