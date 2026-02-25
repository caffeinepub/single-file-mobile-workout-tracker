import { useEffect, useRef, useState, useCallback } from 'react';

type WakeLockStatus = 'unsupported' | 'idle' | 'active' | 'released' | 'error';

interface UseWakeLockReturn {
  isLocked: boolean;
  status: WakeLockStatus;
  requestLock: () => Promise<boolean>;
  releaseLock: () => Promise<void>;
}

/**
 * Robust Screen Wake Lock hook that prevents screen dimming during active use.
 * 
 * Features:
 * - Automatic re-acquisition on visibility change
 * - Proper event listener cleanup
 * - Comprehensive error handling
 * - Browser support detection
 */
export function useWakeLock(): UseWakeLockReturn {
  const [status, setStatus] = useState<WakeLockStatus>('idle');
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const shouldBeActiveRef = useRef<boolean>(false);

  // Check browser support on mount
  useEffect(() => {
    if (!('wakeLock' in navigator)) {
      console.warn('Wake Lock API not supported in this browser');
      setStatus('unsupported');
    }
  }, []);

  const requestLock = useCallback(async (): Promise<boolean> => {
    if (!('wakeLock' in navigator)) {
      console.warn('Wake Lock API not supported');
      setStatus('unsupported');
      return false;
    }

    // If already active, don't request again
    if (wakeLockRef.current && status === 'active') {
      return true;
    }

    try {
      // Release existing lock if any
      if (wakeLockRef.current) {
        try {
          await wakeLockRef.current.release();
        } catch (err) {
          console.warn('Failed to release existing wake lock:', err);
        }
        wakeLockRef.current = null;
      }

      // Request new wake lock
      const wakeLock = await navigator.wakeLock.request('screen');
      wakeLockRef.current = wakeLock;
      shouldBeActiveRef.current = true;
      setStatus('active');

      // Register release event listener
      const handleRelease = () => {
        console.log('Wake lock released by system');
        setStatus('released');
        wakeLockRef.current = null;
        
        // Auto re-acquire if we should still be active and page is visible
        if (shouldBeActiveRef.current && document.visibilityState === 'visible') {
          console.log('Attempting to re-acquire wake lock...');
          setTimeout(() => {
            if (shouldBeActiveRef.current) {
              requestLock();
            }
          }, 100);
        }
      };

      wakeLock.addEventListener('release', handleRelease);

      console.log('Wake lock acquired successfully');
      return true;
    } catch (error: any) {
      console.error('Failed to acquire wake lock:', error);
      
      // Provide descriptive error messages
      if (error.name === 'NotAllowedError') {
        console.error('Wake lock permission denied. User may need to grant permission.');
      } else if (error.name === 'NotSupportedError') {
        console.error('Wake lock not supported on this device/browser.');
        setStatus('unsupported');
      } else {
        console.error('Unknown wake lock error:', error.message);
      }
      
      setStatus('error');
      shouldBeActiveRef.current = false;
      return false;
    }
  }, [status]);

  const releaseLock = useCallback(async (): Promise<void> => {
    shouldBeActiveRef.current = false;

    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setStatus('idle');
        console.log('Wake lock released successfully');
      } catch (error) {
        console.error('Failed to release wake lock:', error);
        setStatus('error');
      }
    }
  }, []);

  // Handle visibility change - re-acquire lock when page becomes visible
  useEffect(() => {
    if (status === 'unsupported') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Page became visible - re-acquire if we should be active but lock is lost
        if (shouldBeActiveRef.current && !wakeLockRef.current) {
          console.log('Page visible again, re-acquiring wake lock...');
          requestLock();
        }
      } else {
        // Page hidden - system will likely release the lock
        console.log('Page hidden, wake lock may be released by system');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [status, requestLock]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldBeActiveRef.current = false;
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch((err) => {
          console.error('Failed to release wake lock on unmount:', err);
        });
      }
    };
  }, []);

  const isLocked = status === 'active' && wakeLockRef.current !== null;

  return {
    isLocked,
    status,
    requestLock,
    releaseLock,
  };
}
