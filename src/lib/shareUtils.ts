export interface ShareOptions {
  title: string;
  text?: string;
  url?: string;
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

export async function shareListingLink(
  options: ShareOptions
): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
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

  const copied = await copyTextToClipboard(shareUrl);
  return copied ? 'copied' : 'failed';
}
