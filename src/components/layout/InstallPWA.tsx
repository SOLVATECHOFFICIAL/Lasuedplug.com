import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../../contexts/PWAContext';
import { shouldShowInstallBanner } from '../../lib/pwaHelpers';

export function InstallPWA() {
  const {
    isInstallable,
    isInstalled,
    isIOS,
    installing,
    dismissedBanner,
    dismissBanner,
    install,
  } = usePWAInstall();

  const visible = shouldShowInstallBanner({
    isInstalled,
    dismissed: dismissedBanner,
    hasDeferredPrompt: isInstallable,
    isIosSafari: isIOS,
  });

  if (!visible) {
    return null;
  }

  return (
    <aside
      aria-label="Install LASUEDPLUG App"
      data-testid="install-pwa-banner"
      className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-5 left-3 right-3 md:left-auto md:right-5 md:w-[360px] z-40 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl p-3.5 transition-all duration-200"
    >
      <div className="flex items-start gap-3">
        <img
          src="/pwa-192x192.png"
          alt="LASUEDPLUG"
          loading="lazy"
          decoding="async"
          className="w-11 h-11 rounded-xl border border-slate-100 object-contain bg-white shrink-0"
        />

        <div className="flex-1 min-w-0 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">
                Install LASUEDPLUG App
              </p>
              <p className="text-xs text-slate-600 leading-snug">
                {isInstallable
                  ? 'Add to your home screen for faster campus shopping & offline access.'
                  : 'Install LASUEDPLUG on your iPhone or iPad for one-tap access.'}
              </p>
            </div>

            <button
              type="button"
              onClick={dismissBanner}
              aria-label="Dismiss install banner"
              className="p-1.5 -mt-1 -mr-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all duration-200 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            disabled={installing}
            onClick={() => void install()}
            className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all duration-200 active:scale-95 disabled:opacity-60"
          >
            {isInstallable ? (
              <Download className="w-4 h-4 shrink-0" />
            ) : (
              <Share className="w-4 h-4 shrink-0" />
            )}
            <span>
              {installing
                ? 'Opening prompt...'
                : isInstallable
                  ? 'Install App'
                  : 'Add to Home Screen'}
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
