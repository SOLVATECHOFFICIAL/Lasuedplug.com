import { memo, useEffect, useState } from 'react';
import { Camera } from 'lucide-react';
import { markImageWarmed } from '../../lib/imageCache';
import { resolveListingImageUrl } from '../../lib/seedAssets';

interface ProductImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  iconClassName?: string;
  priority?: boolean;
}

export const ProductImage = memo(function ProductImage({
  src,
  alt,
  className = 'w-full h-full object-cover',
  iconClassName = 'w-10 h-10 text-slate-400',
  priority = false,
}: ProductImageProps) {
  const resolvedSrc = resolveListingImageUrl(src);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [resolvedSrc]);

  if (!resolvedSrc || failed) {
    return (
      <div
        aria-label={alt}
        className="w-full h-full bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center gap-1.5 text-slate-400 dark:text-slate-500"
      >
        <Camera className={iconClassName} />
      </div>
    );
  }

  const priorityProps = priority
    ? ({ fetchpriority: 'high' } as Record<string, string>)
    : undefined;

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={() => markImageWarmed(resolvedSrc)}
      onError={() => setFailed(true)}
      className={className}
      {...priorityProps}
    />
  );
});
