export function isStandaloneDisplayMode(
  matchMediaStandalone: boolean,
  navigatorStandalone?: boolean
): boolean {
  return Boolean(matchMediaStandalone || navigatorStandalone === true);
}

export function isIosSafariUserAgent(userAgent: string): boolean {
  const ua = (userAgent || '').toLowerCase();
  if (!ua) return false;
  const isIos = /iphone|ipad|ipod/.test(ua);
  const isOtherIosBrowser = /crios|fxios|edgios|opios/.test(ua);
  return isIos && !isOtherIosBrowser;
}

export function canShowInstallControls(params: {
  isInstalled: boolean;
  hasDeferredPrompt: boolean;
  isIosSafari: boolean;
}): boolean {
  if (params.isInstalled) {
    return false;
  }
  return Boolean(params.hasDeferredPrompt || params.isIosSafari);
}

export function shouldShowInstallBanner(params: {
  isInstalled: boolean;
  dismissed: boolean;
  hasDeferredPrompt: boolean;
  isIosSafari: boolean;
}): boolean {
  if (params.dismissed) {
    return false;
  }
  return canShowInstallControls(params);
}
