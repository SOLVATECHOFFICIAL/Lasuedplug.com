import { useEffect, useState } from 'react';
import { User as UserIcon } from 'lucide-react';
import { getInitials } from '../../lib/authHelpers';
import { useUserProfilePic } from '../../lib/userAvatarCache';

type AvatarSize = '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASSES: Record<AvatarSize, string> = {
  '2xs': 'w-4 h-4 text-[9px]',
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-xs',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-20 h-20 sm:w-24 sm:h-24 text-xl sm:text-2xl',
};

const ICON_SIZE_CLASSES: Record<AvatarSize, string> = {
  '2xs': 'w-2.5 h-2.5',
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-7 h-7',
  xl: 'w-9 h-9',
};

interface UserAvatarProps {
  src?: string | null;
  uid?: string | null;
  name?: string | null;
  email?: string | null;
  size?: AvatarSize;
  fallbackMode?: 'initials' | 'icon';
  className?: string;
  alt?: string;
}

export function UserAvatar({
  src,
  uid,
  name,
  email,
  size = 'md',
  fallbackMode = 'initials',
  className = '',
  alt,
}: UserAvatarProps) {
  const liveOrSnapshotSrc = useUserProfilePic(uid, src);
  const effectiveSrc = liveOrSnapshotSrc || (src || '').trim();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [effectiveSrc]);

  const sizeClass = SIZE_CLASSES[size];
  const displayLabel = (name || '').trim() || (email || '').trim() || 'User';
  const initials = getInitials(name, email);

  if (effectiveSrc && !failed) {
    return (
      <img
        src={effectiveSrc}
        alt={alt || displayLabel}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={`${sizeClass} rounded-full object-cover border border-slate-200 shrink-0 bg-slate-100 ${className}`.trim()}
      />
    );
  }

  return (
    <span
      aria-hidden={alt ? undefined : true}
      className={`${sizeClass} rounded-full bg-primary-500 text-white font-bold inline-flex items-center justify-center shrink-0 select-none ${className}`.trim()}
    >
      {fallbackMode === 'icon' || (!(name || '').trim() && !(email || '').trim()) ? (
        <UserIcon className={ICON_SIZE_CLASSES[size]} aria-hidden="true" />
      ) : (
        initials
      )}
    </span>
  );
}
