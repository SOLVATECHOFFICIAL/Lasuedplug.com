import { AdType, PriceType } from '../types';
import { formatNaira } from './utils';

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';
export type ShareToastType = 'success' | 'error' | 'info';
export type ShareToastHandler = (message: string, type?: ShareToastType) => void;

export interface ShareOptions {
  title: string;
  text?: string;
  url?: string;
}

export interface ShareListingExtraOptions {
  onToast?: ShareToastHandler;
  navigatorShare?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
  copyToClipboard?: (text: string) => Promise<boolean>;
}

let globalToastHandler: ShareToastHandler | null = null;

export function registerShareToastHandler(
  handler: ShareToastHandler | null
): void {
  globalToastHandler = handler;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall back to execCommand below
    }
  }

  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  }

  return false;
}

export function formatSharePriceText(params: {
  priceType?: PriceType | string;
  price?: number;
  adType?: AdType | string;
}): string {
  const { priceType, price, adType } = params;

  if (
    adType === 'service' ||
    priceType === 'contact' ||
    typeof price !== 'number' ||
    !Number.isFinite(price)
  ) {
    return 'Contact for Price';
  }

  const formatted = formatNaira(price);
  if (priceType === 'negotiable') {
    return `${formatted} (Negotiable)`;
  }
  return formatted;
}

export function buildListingShareMessage(
  title: string,
  priceText: string,
  type: string,
  url: string
): string {
  const safeType = type.trim() || 'Listing';
  const safeTitle = title.trim() || 'Campus Listing';
  const safePrice = priceText.trim() || 'Contact for Price';
  return `Check out this ${safeType} on LASUEDPLUG: ${safeTitle} for ${safePrice}. View details here: ${url}`;
}

export async function shareListing(
  title: string,
  priceText: string,
  type: string,
  url: string,
  extraOptions?: ShareListingExtraOptions
): Promise<ShareOutcome> {
  const shareUrl =
    url || (typeof window !== 'undefined' ? window.location.href : '');
  const message = buildListingShareMessage(title, priceText, type, shareUrl);
  const toast = extraOptions?.onToast ?? globalToastHandler;
  const shareFn =
    extraOptions?.navigatorShare ??
    (typeof navigator !== 'undefined' && typeof navigator.share === 'function'
      ? (data: { title?: string; text?: string; url?: string }) =>
          navigator.share(data)
      : null);

  if (shareFn) {
    try {
      await shareFn({
        title,
        text: message,
        url: shareUrl,
      });
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'cancelled';
      }
      // Fall through to clipboard copy if navigator.share is unsupported in context
    }
  }

  const copyFn = extraOptions?.copyToClipboard ?? copyTextToClipboard;
  const copied = await copyFn(message);
  if (copied) {
    toast?.('Link copied to clipboard!', 'success');
    return 'copied';
  }

  toast?.('Could not copy link. Please copy the URL from your browser.', 'error');
  return 'failed';
}

export async function shareListingLink(
  options: ShareOptions
): Promise<ShareOutcome> {
  const shareUrl =
    options.url ||
    (typeof window !== 'undefined' ? window.location.href : '');

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function'
  ) {
    try {
      await navigator.share({
        title: options.title,
        text: options.text || options.title,
        url: shareUrl,
      });
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'cancelled';
      }
      // Fall through to clipboard copy if navigator.share is unsupported in context
    }
  }

  const copied = await copyTextToClipboard(options.text ? `${options.text} ${shareUrl}` : shareUrl);
  if (copied) {
    globalToastHandler?.('Link copied to clipboard!', 'success');
    return 'copied';
  }
  return 'failed';
}
