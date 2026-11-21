import { useEffect, useRef } from 'react';

export const MAX_PAGE_LOAD_MS = 2800;

export function withLoadTimeout<T>(
  promise: Promise<T>,
  maxMs: number = MAX_PAGE_LOAD_MS,
  fallbackValue?: T
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      if (fallbackValue !== undefined) {
        resolve(fallbackValue);
      } else {
        reject(
          new Error(
            'Connection is taking longer than expected. Please check your network and try again.'
          )
        );
      }
    }, maxMs);

    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (fallbackValue !== undefined) {
          resolve(fallbackValue);
        } else {
          reject(err);
        }
      }
    );
  });
}

/**
 * Guarantees a loading state never remains stuck for longer than maxMs (default 2.8s).
 */
export function useLoadCap(
  loading: boolean,
  onCapReached: () => void,
  maxMs: number = MAX_PAGE_LOAD_MS
): void {
  const callbackRef = useRef(onCapReached);
  callbackRef.current = onCapReached;

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => {
      callbackRef.current();
    }, maxMs);
    return () => clearTimeout(timer);
  }, [loading, maxMs]);
}
