export type DashboardMode = 'buyer' | 'seller';

export const DASHBOARD_MODE_STORAGE_KEY = 'dashboard_mode';
export const DASHBOARD_MODE_EVENT = 'lasuedplug:dashboard-mode';

export function getSavedDashboardMode(): DashboardMode {
  if (typeof window === 'undefined' || !window.localStorage) {
    return 'buyer';
  }
  try {
    const raw = window.localStorage.getItem(DASHBOARD_MODE_STORAGE_KEY);
    return raw === 'seller' ? 'seller' : 'buyer';
  } catch {
    return 'buyer';
  }
}

export function saveDashboardMode(mode: DashboardMode): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(DASHBOARD_MODE_STORAGE_KEY, mode);
    window.dispatchEvent(
      new CustomEvent(DASHBOARD_MODE_EVENT, { detail: mode })
    );
  } catch {
    // Ignore storage access errors
  }
}

export function getPreferredDashboardPath():
  | '/dashboard/buyer'
  | '/dashboard/seller' {
  return getSavedDashboardMode() === 'seller'
    ? '/dashboard/seller'
    : '/dashboard/buyer';
}
