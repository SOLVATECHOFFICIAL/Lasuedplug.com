import { memo, useEffect, useState } from 'react';
import { Camera } from 'lucide-react';
import { resolveListingImageUrl } from '../../lib/seedAssets';

interface ProductImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  iconClassName?: string;
}

export const ProductImage = memo(function ProductImage({
  src,
  alt,
  className = 'w-full h-full object-cover',
  iconClassName = 'w-10 h-10 text-slate-400',
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
        className="w-full h-full bg-slate-100 flex flex-col items-center justify-center gap-1.5 text-slate-400"
      >
        <Camera className={iconClassName} />
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
});

