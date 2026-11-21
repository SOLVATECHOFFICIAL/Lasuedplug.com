import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Lock,
  MapPin,
  MessageCircle,
  Share2,
  ShieldCheck,
} from 'lucide-react';
import { getPublicAccommodationById } from '../../lib/accommodationService';
import {
  buildAccommodationWhatsAppUrl,
  getAccommodationPublicLocation,
  getAccommodationRent,
  getAccommodationTypeLabel,
} from '../../lib/accommodationHelpers';
import { getFastCache, setFastCache } from '../../lib/fastCache';
import { saveRecentlyViewed } from '../../lib/recentlyViewed';
import { shareListing } from '../../lib/shareUtils';
import { formatNaira } from '../../lib/utils';
import { Accommodation } from '../../types';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { VerifiedBadge } from '../../components/ui/VerifiedBadge';
import { Loading } from '../../components/feedback/Loading';
import { ErrorState } from '../../components/feedback/ErrorState';
import { ProductImage } from '../../components/marketplace/ProductImage';
import { SeoHead } from '../../components/seo/SeoHead';

export function AccommodationDetail() {
  const { id } = useParams<{ id: string }>();

  const initialCached = id
    ? getFastCache<Omit<Accommodation, 'exactAddress'>>(`accommodation:${id}`)
    : null;
  const [item, setItem] = useState<Omit<Accommodation, 'exactAddress'> | null>(
    initialCached
  );
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [loading, setLoading] = useState(() => Boolean(id) && !initialCached);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    if (!id) {
      setItem(null);
      setLoading(false);
      return;
    }
    const cached = getFastCache<Omit<Accommodation, 'exactAddress'>>(
      `accommodation:${id}`
    );
    if (cached) {
      setItem(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const record = await getPublicAccommodationById(id);
      setItem(record);
      setSelectedImageIndex(0);
      if (record) {
        setFastCache(`accommodation:${id}`, record);
      }
    } catch (err) {
      if (!cached) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Unable to load accommodation details. Please try again.';
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (!item?.id) return;
    const publicLoc = getAccommodationPublicLocation(item);
    const rent = getAccommodationRent(item);
    saveRecentlyViewed({
      id: item.id,
      _type: 'accommodation',
      title: item.title,
      subtitle: publicLoc,
      priceLabel: `${formatNaira(rent)} / year`,
      imageUrl: item.images?.[0],
      href: `/accommodation/${item.id}`,
      isVerified: Boolean(item.ownerSnapshot?.isVerified),
    });
  }, [item]);

  const images = useMemo(() => item?.images || [], [item]);
  const activeImage = images[selectedImageIndex] || images[0];

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Loading variant="skeleton" message="Loading accommodation details..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <ErrorState message={error} onRetry={() => void loadDetail()} />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="max-w-md mx-auto px-4 sm:px-6 py-12">
        <SeoHead
          title="Accommodation Not Found"
          ogTitle="Accommodation Not Found — LASUEDPLUG"
          description="This lodge listing may have been rented out or removed from LASUEDPLUG."
        />
        <Card
          hoverable={false}
          className="border-dashed text-center py-10 space-y-4"
        >
          <div className="w-12 h-12 mx-auto rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-slate-900">
              Accommodation not found
            </h1>
            <p className="text-sm text-slate-500">
              This lodge listing may have been rented out or removed.
            </p>
          </div>
          <div>
            <Link to="/accommodation">
              <Button variant="primary" size="sm">
                Back to Accommodation
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const typeLabel = getAccommodationTypeLabel(item.type);
  const publicLocation = getAccommodationPublicLocation(item);
  const rentPrice = getAccommodationRent(item);
  const ownerName = item.ownerSnapshot?.fullName || 'Campus Landlord / Agent';
  const ownerVerified = Boolean(item.ownerSnapshot?.isVerified);
  const amenities = Array.isArray(item.amenities) ? item.amenities : [];
  const whatsappHref = buildAccommodationWhatsAppUrl(
    item.whatsappNumber || '',
    item.title
  );

  const shareUrl =
    typeof window !== 'undefined'
      ? item.id
        ? `${window.location.origin}/accommodation/${item.id}`
        : window.location.href
      : `/accommodation/${item.id || ''}`;

  const handleShareClick = () => {
    void shareListing(
      item.title,
      `${formatNaira(rentPrice)}/year`,
      'Accommodation',
      shareUrl
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-36 md:pb-12 space-y-6">
      <SeoHead
        title={item.title}
        ogTitle={item.title}
        description={
          item.description?.trim() ||
          `${typeLabel} · ${publicLocation} (${formatNaira(rentPrice)} / year) on LASUEDPLUG.`
        }
      />
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/accommodation"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Accommodation</span>
        </Link>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleShareClick}
        >
          <Share2 className="w-4 h-4" />
          <span>Share</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Image Carousel / Gallery */}
        <div className="lg:col-span-7 space-y-3">
          <div className="aspect-[4/3] w-full rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shadow-sm">
            <ProductImage
              src={activeImage}
              alt={item.title}
              className="w-full h-full object-cover"
              iconClassName="w-12 h-12 text-slate-400"
            />
          </div>

          {images.length > 1 && (
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
              {images.map((imgUrl, idx) => (
                <button
                  key={`${imgUrl.slice(0, 24)}-${idx}`}
                  type="button"
                  onClick={() => setSelectedImageIndex(idx)}
                  aria-label={`View photo ${idx + 1}`}
                  className={`w-20 h-16 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                    idx === selectedImageIndex
                      ? 'border-blue-600 ring-2 ring-blue-100'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <ProductImage
                    src={imgUrl}
                    alt={`${item.title} photo ${idx + 1}`}
                    className="w-full h-full object-cover"
                    iconClassName="w-5 h-5 text-slate-400"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Accommodation Details & Privacy-Safe Contact */}
        <div className="lg:col-span-5 space-y-6">
          <Card hoverable={false} className="space-y-5">
            <div className="space-y-2.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                <Building2 className="w-3.5 h-3.5" />
                <span>{typeLabel}</span>
              </span>

              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-snug">
                {item.title}
              </h1>

              <p className="text-2xl font-extrabold text-primary-600 tabular-nums">
                {formatNaira(rentPrice)}
                <span className="text-sm font-medium text-slate-500">
                  {' '}
                  / year
                </span>
              </p>

              {/* Public General Location (NEVER renders exactAddress) */}
              <div className="pt-1 space-y-1.5">
                <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-primary-500 shrink-0" />
                  <span>{publicLocation}</span>
                </p>
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    Exact address is shared directly upon inspection request for safety.
                  </span>
                </p>
              </div>
            </div>

            {amenities.length > 0 && (
              <div className="pt-4 border-t border-slate-100 space-y-2.5">
                <h2 className="text-sm font-semibold text-slate-900">
                  Amenities Included
                </h2>
                <div className="flex flex-wrap gap-2">
                  {amenities.map((amenity) => (
                    <span
                      key={amenity}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{amenity}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 space-y-2">
              <h2 className="text-sm font-semibold text-slate-900">
                Description
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {item.description}
              </p>
            </div>

            {/* Owner Card */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Landlord / Agent Information
              </h2>
              <Link
                to={`/seller/${item.ownerId}`}
                className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-300 hover:bg-slate-100/70 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar
                    uid={item.ownerId}
                    src={item.ownerSnapshot?.profilePic}
                    name={ownerName}
                    size="md"
                    className="w-11 h-11"
                  />
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 flex items-center gap-1.5 min-w-0 transition-colors">
                      <span className="truncate">{ownerName}</span>
                      {ownerVerified && <VerifiedBadge size="sm" />}
                    </p>
                    <p className="text-xs text-slate-500">
                      View host profile &amp; reviews →
                    </p>
                  </div>
                </div>
                {ownerVerified && (
                  <Badge variant="verified" className="shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                    Verified
                  </Badge>
                )}
              </Link>
            </div>

            {/* Desktop WhatsApp & Share Actions */}
            <div className="hidden md:flex items-center gap-2.5 pt-2">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 min-h-[52px] inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 whitespace-nowrap"
              >
                <MessageCircle className="w-5 h-5 shrink-0" />
                <span>Message Landlord/Agent</span>
              </a>
              <Button
                type="button"
                variant="outline"
                onClick={handleShareClick}
                className="min-h-[52px] px-4 py-3.5 rounded-xl text-sm shrink-0 whitespace-nowrap"
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Mobile Fixed WhatsApp & Share CTA */}
      <div className="md:hidden fixed bottom-[calc(55px+env(safe-area-inset-bottom))] left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-slate-200 px-3.5 py-2.5 shadow-sm flex items-center gap-2.5">
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-w-0 min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition-all duration-200 active:scale-95"
        >
          <MessageCircle className="w-5 h-5 shrink-0" />
          <span className="truncate">Message Landlord/Agent</span>
        </a>
        <Button
          type="button"
          variant="outline"
          onClick={handleShareClick}
          className="min-h-[48px] px-4 py-3 rounded-xl shrink-0"
        >
          <Share2 className="w-4 h-4" />
          <span>Share</span>
        </Button>
      </div>
    </div>
  );
}
