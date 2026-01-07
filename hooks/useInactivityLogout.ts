import { useState, useEffect, useCallback, useRef } from 'react';

interface UseInactivityLogoutOptions {
  onLogout: () => void;
  timeoutMs?: number; // default 15 menit (900000ms)
  warningMs?: number; // warning muncul berapa lama sebelum logout (default 60000ms = 1 menit)
  enabled?: boolean;  // hanya aktif jika user logged in
  onWarning?: () => void; // callback saat warning muncul
}

interface UseInactivityLogoutReturn {
  showWarning: boolean;
  remainingTime: number; // dalam detik
  resetTimer: () => void;
  dismissWarning: () => void;
}

const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
  'wheel'
];

export function useInactivityLogout({
  onLogout,
  timeoutMs = 15 * 60 * 1000, // 15 menit
  warningMs = 60 * 1000, // 1 menit sebelum logout
  enabled = true,
  onWarning
}: UseInactivityLogoutOptions): UseInactivityLogoutReturn {
  const [showWarning, setShowWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(Math.floor(warningMs / 1000));
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const startCountdown = useCallback(() => {
    setRemainingTime(Math.floor(warningMs / 1000));
    
    countdownRef.current = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [warningMs]);

  const resetTimer = useCallback(() => {
    if (!enabled) return;
    
    clearAllTimers();
    setShowWarning(false);
    setRemainingTime(Math.floor(warningMs / 1000));
    lastActivityRef.current = Date.now();

    // Set warning timeout (akan trigger beberapa saat sebelum logout)
    const warningDelay = timeoutMs - warningMs;
    warningTimeoutRef.current = setTimeout(() => {
      setShowWarning(true);
      onWarning?.();
      startCountdown();
    }, warningDelay);

    // Set logout timeout
    timeoutRef.current = setTimeout(() => {
      setShowWarning(false);
      onLogout();
    }, timeoutMs);
  }, [enabled, timeoutMs, warningMs, onLogout, onWarning, clearAllTimers, startCountdown]);

  const dismissWarning = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  const handleActivity = useCallback(() => {
    // Hanya reset jika belum ada warning yang muncul
    if (!showWarning) {
      const now = Date.now();
      // Throttle: hanya update jika sudah 1 detik berlalu
      if (now - lastActivityRef.current > 1000) {
        lastActivityRef.current = now;
        resetTimer();
      }
    }
  }, [showWarning, resetTimer]);

  useEffect(() => {
    if (!enabled) {
      clearAllTimers();
      setShowWarning(false);
      return;
    }

    // Start timer saat pertama kali
    resetTimer();

    // Add event listeners untuk aktivitas
    ACTIVITY_EVENTS.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      clearAllTimers();
      ACTIVITY_EVENTS.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [enabled, handleActivity, resetTimer, clearAllTimers]);

  return {
    showWarning,
    remainingTime,
    resetTimer,
    dismissWarning
  };
}
