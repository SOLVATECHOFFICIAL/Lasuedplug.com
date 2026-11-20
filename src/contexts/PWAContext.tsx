import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Share, X } from 'lucide-react';
import {
  canShowInstallControls,
  isIosSafariUserAgent,
  isStandaloneDisplayMode,
} from '../lib/pwaHelpers';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_STORAGE_KEY = 'lasuedplug_pwa_install_dismissed';

// Capture early beforeinstallprompt events even if fired before React mounts
let earlyDeferredPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event: Event) => {
    event.preventDefault();
    earlyDeferredPrompt = event as BeforeInstallPromptEvent;
  });
}

function checkIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return isStandaloneDisplayMode(
    window.matchMedia('(display-mode: standalone)').matches,
    (window.navigator as Navigator & { standalone?: boolean }).standalone
  );
}

function checkIsIosSafari(): boolean {
  if (typeof window === 'undefined') return false;
  return isIosSafariUserAgent(window.navigator.userAgent);
}

export interface PWAContextValue {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  canInstall: boolean;
  installing: boolean;
  dismissedBanner: boolean;
  showIosGuide: boolean;
  setShowIosGuide: (open: boolean) => void;
  dismissBanner: () => void;
  install: () => Promise<boolean>;
}

const PWAContext = createContext<PWAContextValue | undefined>(undefined);

export function PWAProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(() => earlyDeferredPrompt);
  const [isInstalled, setIsInstalled] = useState<boolean>(() =>
    checkIsStandalone()
  );
  const [isIOS, setIsIOS] = useState<boolean>(() => checkIsIosSafari());
  const [installing, setInstalling] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [dismissedBanner, setDismissedBanner] = useState<boolean>(() => {
    try {
      return window.sessionStorage.getItem(DISMISS_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    setIsInstalled(checkIsStandalone());
    setIsIOS(checkIsIosSafari());
    if (earlyDeferredPrompt) {
      setDeferredPrompt(earlyDeferredPrompt);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      earlyDeferredPrompt = e as BeforeInstallPromptEvent;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      earlyDeferredPrompt = null;
      setDeferredPrompt(null);
      setIsInstalled(true);
      setShowIosGuide(false);
    };

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        earlyDeferredPrompt = null;
        setDeferredPrompt(null);
        setIsInstalled(true);
        setShowIosGuide(false);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    mediaQuery.addEventListener?.('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery.removeEventListener?.('change', handleDisplayModeChange);
    };
  }, []);

  const dismissBanner = useCallback(() => {
    setDismissedBanner(true);
    try {
      window.sessionStorage.setItem(DISMISS_STORAGE_KEY, '1');
    } catch {
      // ignore storage errors
    }
  }, []);

  const install = useCallback(async () => {
    if (deferredPrompt && !installing) {
      setInstalling(true);
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          earlyDeferredPrompt = null;
          setDeferredPrompt(null);
          setIsInstalled(true);
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        setInstalling(false);
      }
    }

    if (isIOS && !isInstalled) {
      setShowIosGuide(true);
    }
    return false;
  }, [deferredPrompt, installing, isIOS, isInstalled]);

  const canInstall = useMemo(
    () =>
      canShowInstallControls({
        isInstalled,
        hasDeferredPrompt: Boolean(deferredPrompt),
        isIosSafari: isIOS,
      }),
    [isInstalled, deferredPrompt, isIOS]
  );

  const value = useMemo<PWAContextValue>(
    () => ({
      isInstallable: Boolean(deferredPrompt),
      isInstalled,
      isIOS,
      canInstall,
      installing,
      dismissedBanner,
      showIosGuide,
      setShowIosGuide,
      dismissBanner,
      install,
    }),
    [
      deferredPrompt,
      isInstalled,
      isIOS,
      canInstall,
      installing,
      dismissedBanner,
      showIosGuide,
      dismissBanner,
      install,
    ]
  );

  return (
    <PWAContext.Provider value={value}>
      {children}

      {showIosGuide && !isInstalled && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-install-guide-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-sm"
          onClick={() => setShowIosGuide(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                  <Share className="w-5 h-5" />
                </div>
                <h2
                  id="ios-install-guide-title"
                  className="text-base font-bold text-slate-900"
                >
                  Install LASUEDPLUG on iOS
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                aria-label="Close iOS install instructions"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <ol className="space-y-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3.5 list-decimal list-inside">
              <li>
                Tap the <strong>Share</strong> icon in Safari&apos;s toolbar.
              </li>
              <li>
                Scroll down and tap <strong>Add to Home Screen</strong>.
              </li>
              <li>
                Tap <strong>Add</strong> in the top-right corner.
              </li>
            </ol>

            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="w-full min-h-[44px] rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </PWAContext.Provider>
  );
}

export function usePWAInstall(): PWAContextValue {
  const ctx = useContext(PWAContext);
  if (!ctx) {
    throw new Error('usePWAInstall must be used within a PWAProvider');
  }
  return ctx;
}
