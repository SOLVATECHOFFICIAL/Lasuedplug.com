import { memo, MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { Building2, MapPin, Share2 } from 'lucide-react';
import { Accommodation } from '../../types';
import {
  getAccommodationPublicLocation,
  getAccommodationRent,
  getAccommodationTypeLabel,
} from '../../lib/accommodationHelpers';
import { saveRecentlyViewed } from '../../lib/recentlyViewed';
import { shareListing } from '../../lib/shareUtils';
import { formatNaira } from '../../lib/utils';
import { Card } from '../ui/Card';
import { UserAvatar } from '../ui/UserAvatar';
import { VerifiedBadge } from '../ui/VerifiedBadge';
import { ProductImage } from './ProductImage';

interface AccommodationCardProps {
  accommodation: Accommodation;
  isVerifiedOwner?: boolean;
  className?: string;
}

export const AccommodationCard = memo(function AccommodationCard({
  accommodation,
  isVerifiedOwner,
  className = '',
}: AccommodationCardProps) {
  const typeLabel = getAccommodationTypeLabel(accommodation.type);
  const publicLocation = getAccommodationPublicLocation(accommodation);
  const rent = getAccommodationRent(accommodation);
  const verified = Boolean(
    isVerifiedOwner ?? accommodation.ownerSnapshot?.isVerified
  );
  const ownerName = accommodation.ownerSnapshot?.fullName;

  const handleTrackClick = () => {
    if (!accommodation.id) return;
    saveRecentlyViewed({
      id: accommodation.id,
      _type: 'accommodation',
      title: accommodation.title,
      subtitle: publicLocation,
      priceLabel: `${formatNaira(rent)} / year`,
      imageUrl: accommodation.images?.[0],
      href: `/accommodation/${accommodation.id}`,
      isVerified: verified,
    });
  };

  const shareUrl =
    typeof window !== 'undefined'
      ? accommodation.id
        ? `${window.location.origin}/accommodation/${accommodation.id}`
        : `${window.location.origin}/accommodation`
      : `/accommodation/${accommodation.id || ''}`;

  const handleShareClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    void shareListing(
      accommodation.title,
      `${formatNaira(rent)}/year`,
      'Accommodation',
      shareUrl
    );
  };

  return (
    <div className={`relative group h-full ${className}`.trim()}>
      <Link
        to={`/accommodation/${accommodation.id}`}
        onClick={handleTrackClick}
        className="block h-full focus:outline-none"
      >
        <Card
          padded={false}
          className="h-full overflow-hidden flex flex-col justify-between group-focus-visible:ring-2 group-focus-visible:ring-blue-500"
        >
        <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden shrink-0">
          <ProductImage
            src={accommodation.images?.[0]}
            alt={accommodation.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            iconClassName="w-10 h-10 text-slate-400"
          />
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-600/95 text-white border border-emerald-500 shadow-sm backdrop-blur-sm">
            <Building2 className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>Room</span>
          </span>
        </div>

        <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between gap-2.5">
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-medium text-slate-500 truncate">
              {typeLabel}
            </p>
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
              {accommodation.title}
            </h3>
            {(ownerName || verified || accommodation.ownerSnapshot?.profilePic) && (
              <p className="text-xs text-slate-600 flex items-center gap-1.5 min-w-0">
                <UserAvatar
                  uid={accommodation.ownerId}
                  src={accommodation.ownerSnapshot?.profilePic}
                  name={ownerName || 'Campus Host'}
                  size="2xs"
                />
                <span className="truncate">{ownerName || 'Campus Host'}</span>
                {verified && <VerifiedBadge size="xs" />}
              </p>
            )}
            <p className="text-xs text-slate-500 flex items-center gap-1.5 pt-0.5 min-w-0">
              <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" aria-hidden="true" />
              <span className="truncate">{publicLocation}</span>
            </p>
          </div>

          <p className="text-sm sm:text-base font-bold text-slate-900 tabular-nums truncate">
            {formatNaira(rent)}
            <span className="text-xs font-normal text-slate-500"> / year</span>
          </p>
        </div>
      </Card>
    </Link>

      <button
        type="button"
        onClick={handleShareClick}
        aria-label={`Share ${accommodation.title}`}
        title="Share accommodation"
        className="absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full bg-white/95 hover:bg-white text-slate-700 hover:text-blue-600 border border-slate-200/90 shadow-sm backdrop-blur-sm flex items-center justify-center transition-all duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  );
});
