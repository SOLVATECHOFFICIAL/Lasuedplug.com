import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_STORAGE_KEY = 'lasuedplug_pwa_install_dismissed';

function checkIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

function checkIsIosSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  const isOtherIosBrowser = /crios|fxios|edgios|opios/.test(ua);
  return isIos && !isOtherIosBrowser;
}

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() =>
    checkIsStandalone()
  );
  const [isIosSafari, setIsIosSafari] = useState<boolean>(false);
  const [showIosSteps, setShowIosSteps] = useState(false);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return window.sessionStorage.getItem(DISMISS_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    setIsInstalled(checkIsStandalone());
    setIsIosSafari(checkIsIosSafari());

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsInstalled(true);
        setDeferredPrompt(null);
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

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISS_STORAGE_KEY, '1');
    } catch {
      // ignore storage errors
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt || installing) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    } catch {
      // user cancelled or browser dismissed prompt
    } finally {
      setInstalling(false);
    }
  };

  if (isInstalled || dismissed) {
    return null;
  }

  if (!deferredPrompt && !isIosSafari) {
    return null;
  }

  return (
    <aside
      aria-label="Install LASUEDPLUG App"
      data-testid="install-pwa-banner"
      className="fixed bottom-[calc(64px+env(safe-area-inset-bottom))] md:bottom-5 left-3 right-3 md:left-auto md:right-5 md:w-[360px] z-40 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl p-3.5 transition-all duration-200"
    >
      <div className="flex items-start gap-3">
        <img
          src="/lasued.png"
          alt="LASUEDPLUG"
          loading="lazy"
          className="w-11 h-11 rounded-xl border border-slate-100 object-contain bg-white shrink-0"
        />

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">
                LASUEDPLUG App
              </p>
              <p className="text-xs text-slate-600 leading-snug">
                {deferredPrompt
                  ? 'Browse campus listings faster & offline from your home screen.'
                  : 'Add LASUEDPLUG to your iPhone or iPad home screen.'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss install banner"
              className="p-1.5 -mt-1 -mr-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all duration-200 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {deferredPrompt ? (
            <button
              type="button"
              disabled={installing}
              onClick={() => void handleInstallClick()}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all duration-200 active:scale-95 disabled:opacity-60"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>
                {installing ? 'Opening prompt...' : 'Install LASUEDPLUG App'}
              </span>
            </button>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowIosSteps((prev) => !prev)}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all duration-200 active:scale-95"
              >
                <Share className="w-4 h-4 shrink-0" />
                <span>
                  {showIosSteps ? 'Hide Instructions' : 'Add to Home Screen'}
                </span>
              </button>

              {showIosSteps && (
                <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 leading-relaxed">
                  1. Tap the <strong>Share</strong> icon in Safari&apos;s toolbar.
                  <br />
                  2. Scroll down and tap <strong>Add to Home Screen</strong>.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
