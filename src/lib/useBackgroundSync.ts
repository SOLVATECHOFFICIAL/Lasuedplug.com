import { useEffect, useRef } from 'react';

export const BACKGROUND_SYNC_INTERVAL_MS = 5_000;
export const BACKGROUND_IDLE_PAUSE_MS = 5 * 60_000;

export type BackgroundSyncReason = 'interval' | 'resume';

export interface BackgroundSyncTickContext {
  tickIndex: number;
  reason: BackgroundSyncReason;
}

export interface UseBackgroundSyncOptions {
  enabled?: boolean;
  intervalMs?: number;
  idlePauseMs?: number;
  onTick: (context: BackgroundSyncTickContext) => Promise<void> | void;
}

let lastActivityAtMs = Date.now();
let activityListenersInstalled = false;

function markUserActivity(): void {
  lastActivityAtMs = Date.now();
}

function ensureGlobalActivityTracker(): void {
  if (activityListenersInstalled || typeof window === 'undefined') {
    return;
  }
  activityListenersInstalled = true;
  const opts: AddEventListenerOptions = { passive: true, capture: true };
  window.addEventListener('pointerdown', markUserActivity, opts);
  window.addEventListener('keydown', markUserActivity, opts);
  window.addEventListener('scroll', markUserActivity, opts);
  window.addEventListener('touchstart', markUserActivity, opts);
  window.addEventListener('focus', markUserActivity, { passive: true });
}

export function isPageVisibleAndOnline(): boolean {
  if (
    typeof document !== 'undefined' &&
    document.visibilityState === 'hidden'
  ) {
    return false;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }
  return true;
}

/**
 * Runs a quota-safe background synchronization callback every 5 seconds while
 * the browser tab is visible, online, and recently active. Automatically pauses
 * when hidden/offline/idle and immediately runs a verification check on resume.
 */
export function useBackgroundSync({
  enabled = true,
  intervalMs = BACKGROUND_SYNC_INTERVAL_MS,
  idlePauseMs = BACKGROUND_IDLE_PAUSE_MS,
  onTick,
}: UseBackgroundSyncOptions): void {
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }

    ensureGlobalActivityTracker();
    markUserActivity();

    let cancelled = false;
    let inFlight = false;
    let tickIndex = 0;
    let wasIdle = false;
    let lastRunAt = 0;

    const executeTick = async (reason: BackgroundSyncReason) => {
      if (cancelled || inFlight) return;
      if (!isPageVisibleAndOnline()) return;

      const now = Date.now();
      if (reason === 'interval' && now - lastActivityAtMs > idlePauseMs) {
        wasIdle = true;
        return;
      }

      if (reason === 'resume' && now - lastRunAt < 800) {
        return;
      }

      inFlight = true;
      lastRunAt = now;
      const currentIndex = tickIndex;
      tickIndex += 1;

      try {
        await onTickRef.current({ tickIndex: currentIndex, reason });
      } catch {
        // Non-blocking background sync: never break UI on transient errors
      } finally {
        inFlight = false;
      }
    };

    const timer = window.setInterval(() => {
      void executeTick('interval');
    }, intervalMs);

    const handleResume = () => {
      markUserActivity();
      if (!isPageVisibleAndOnline()) return;
      wasIdle = false;
      void executeTick('resume');
    };

    const handleActivityWake = () => {
      if (wasIdle) {
        wasIdle = false;
        void executeTick('resume');
      }
    };

    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('focus', handleResume);
    window.addEventListener('online', handleResume);
    window.addEventListener('pointerdown', handleActivityWake, { passive: true });
    window.addEventListener('keydown', handleActivityWake, { passive: true });

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('focus', handleResume);
      window.removeEventListener('online', handleResume);
      window.removeEventListener('pointerdown', handleActivityWake);
      window.removeEventListener('keydown', handleActivityWake);
    };
  }, [enabled, intervalMs, idlePauseMs]);
}
