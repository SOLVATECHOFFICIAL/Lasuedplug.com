import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  buildRouteKey,
  getPreviousInAppRoute,
  hasInAppBackHistory,
} from './feedScrollState';

export function useSafeGoBack(fallbackPath: string) {
  const navigate = useNavigate();
  const location = useLocation();
  const fallbackTimerRef = useRef<number | null>(null);

  const currentRouteKey = buildRouteKey(location.pathname, location.search);
  const previousRoute = getPreviousInAppRoute(currentRouteKey);
  const historyIdx =
    typeof window !== 'undefined' &&
    window.history.state &&
    typeof (window.history.state as { idx?: unknown }).idx === 'number'
      ? (window.history.state as { idx: number }).idx
      : null;

  const canGoBack = hasInAppBackHistory(
    typeof window !== 'undefined' ? window.history.state : null,
    location.key,
    currentRouteKey
  );

  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [location.pathname, location.search]);

  const handleGoBack = useCallback(() => {
    if (typeof window !== 'undefined' && fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }

    const canPopNativeHistory =
      historyIdx !== null ? historyIdx > 0 : canGoBack && window.history.length > 1;

    if (canPopNativeHistory) {
      const beforeRoute =
        typeof window !== 'undefined'
          ? `${window.location.pathname}${window.location.search}`
          : currentRouteKey;

      navigate(-1);

      if (typeof window !== 'undefined') {
        fallbackTimerRef.current = window.setTimeout(() => {
          fallbackTimerRef.current = null;
          const afterRoute = `${window.location.pathname}${window.location.search}`;
          if (afterRoute === beforeRoute) {
            navigate(previousRoute || fallbackPath, { replace: true });
          }
        }, 160);
      }
      return;
    }

    navigate(previousRoute || fallbackPath);
  }, [canGoBack, currentRouteKey, fallbackPath, historyIdx, navigate, previousRoute]);

  return {
    canGoBack,
    handleGoBack,
  };
}
