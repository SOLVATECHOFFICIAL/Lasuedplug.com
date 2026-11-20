import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [showBackOnline, setShowBackOnline] = useState(false);
  const wasOfflineRef = useRef<boolean>(isOffline);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const clearHideTimer = () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    const handleOffline = () => {
      clearHideTimer();
      wasOfflineRef.current = true;
      setShowBackOnline(false);
      setIsOffline(true);
    };

    const handleOnline = () => {
      setIsOffline(false);
      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        setShowBackOnline(true);
        clearHideTimer();
        hideTimerRef.current = window.setTimeout(() => {
          setShowBackOnline(false);
          hideTimerRef.current = null;
        }, 3000);
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      clearHideTimer();
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline && !showBackOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="connectivity-banner"
      className={`w-full px-4 py-2 text-xs sm:text-sm font-semibold text-white transition-all duration-200 ${
        isOffline
          ? 'bg-gradient-to-r from-red-600 to-orange-600'
          : 'bg-emerald-600'
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-center">
        {isOffline ? (
          <>
            <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>You are offline. Showing cached data.</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Back online. Syncing...</span>
          </>
        )}
      </div>
    </div>
  );
}
