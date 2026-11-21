import {
  FormEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ExternalLink,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  SearchX,
  Share2,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import {
  buildRoommateWhatsAppUrl,
  filterRoommateRequests,
  getRoommateTypeLabel,
  ROOMMATE_TYPE_OPTIONS,
} from '../../lib/accommodationHelpers';
import {
  createRoommateRequest,
  fetchApprovedRoommateRequests,
} from '../../lib/accommodationService';
import { getUserAvatarUrl, resolveAccountType } from '../../lib/authHelpers';
import { compactListingsForCache } from '../../lib/firestoreQueryCache';
import { getFastCache, setFastCache } from '../../lib/fastCache';
import {
  MAX_LISTING_IMAGES,
  validateRoommateCreateInput,
} from '../../lib/listingValidation';
import { formatNigerianWhatsAppDigits } from '../../lib/marketplaceHelpers';
import { shareListing } from '../../lib/shareUtils';
import { formatNaira } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { RoommateRequest, RoommateRequestType } from '../../types';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { VerifiedBadge } from '../../components/ui/VerifiedBadge';
import { CardSkeletonGrid } from '../../components/feedback/Loading';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ErrorState } from '../../components/feedback/ErrorState';
import { AccommodationSubNav } from '../../components/accommodation/AccommodationSubNav';
import { ProductImage } from '../../components/marketplace/ProductImage';
import { ImageUploadGrid } from '../../components/forms/ImageUploadGrid';
import { LocationPinField } from '../../components/forms/LocationPinField';

export function Roommates() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const [requests, setRequests] = useState<RoommateRequest[]>(
    () => getFastCache<RoommateRequest[]>('roommates_feed') || []
  );
  const [loading, setLoading] = useState(
    () => (getFastCache<RoommateRequest[]>('roommates_feed') || []).length === 0
  );
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<'all' | RoommateRequestType>(
    'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] =
    useState<RoommateRequest | null>(null);

  // Create request modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [reqType, setReqType] = useState<RoommateRequestType>('need_roommate');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [generalLocation, setGeneralLocation] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [preferences, setPreferences] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const loadRequests = useCallback(async () => {
    const cached = getFastCache<RoommateRequest[]>('roommates_feed');
    if (!cached || cached.length === 0) {
      setLoading(true);
    }
    setError(null);
    try {
      const items = await fetchApprovedRoommateRequests();
      setRequests(items);
      setFastCache('roommates_feed', compactListingsForCache(items, 24));
    } catch (err) {
      if (!cached || cached.length === 0) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Unable to load roommate requests right now.';
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (profile?.phone && !whatsappNumber) {
      setWhatsappNumber(profile.phone);
    }
  }, [profile?.phone, whatsappNumber]);

  const filteredRequests = useMemo(
    () => filterRoommateRequests(requests, typeFilter, searchQuery),
    [requests, typeFilter, searchQuery]
  );

  const requestedId = searchParams.get('request');
  useEffect(() => {
    if (!requestedId || requests.length === 0) return;
    const match = requests.find((item) => item.id === requestedId);
    if (match) {
      setSelectedRequest(match);
    }
  }, [requestedId, requests]);

  const buildRoommateShareUrl = (reqId?: string) => {
    const base =
      typeof window !== 'undefined'
        ? `${window.location.origin}/roommates`
        : '/roommates';
    return reqId ? `${base}?request=${encodeURIComponent(reqId)}` : base;
  };

  const handleOpenRoommateDetail = (req: RoommateRequest) => {
    setSelectedRequest(req);
    if (req.id) {
      const next = new URLSearchParams(searchParams);
      next.set('request', req.id);
      setSearchParams(next, { replace: true });
    }
  };

  const handleCloseRoommateDetail = () => {
    setSelectedRequest(null);
    if (searchParams.has('request')) {
      const next = new URLSearchParams(searchParams);
      next.delete('request');
      setSearchParams(next, { replace: true });
    }
  };

  const handleShareRoommate = (
    req: RoommateRequest,
    e?: MouseEvent<HTMLButtonElement>
  ) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    void shareListing(
      req.title,
      'Roommate Request',
      'Roommate',
      buildRoommateShareUrl(req.id)
    );
  };

  const handleOpenCreateModal = () => {
    if (!user) {
      showToast('Please login to post a roommate request.', 'info');
      navigate('/login', { state: { from: location } });
      return;
    }
    setFormError(null);
    if (profile?.phone && !whatsappNumber) {
      setWhatsappNumber(profile.phone);
    }
    setCreateOpen(true);
  };

  const resetCreateForm = () => {
    setReqType('need_roommate');
    setTitle('');
    setDescription('');
    setBudget('');
    setGeneralLocation('');
    setLatitude(undefined);
    setLongitude(undefined);
    setPreferences('');
    setImages([]);
    setFormError(null);
  };

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setFormError(null);

    if (!user?.uid) {
      showToast('Please login to post a roommate request.', 'error');
      return;
    }

    const formattedPhone = formatNigerianWhatsAppDigits(whatsappNumber);

    const validationError = validateRoommateCreateInput({
      type: reqType,
      title,
      description,
      budget,
      generalLocation,
      preferences,
      imagesCount: images.length,
      whatsappDigits: formattedPhone,
      latitude,
      longitude,
    });

    if (validationError) {
      setFormError(validationError);
      showToast(validationError, 'error');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const estimatedBytes = new TextEncoder().encode(
        JSON.stringify(images)
      ).length;
      if (estimatedBytes > 850_000) {
        throw new Error(
          'Compressed photos exceed the 850KB document limit. Please use fewer or smaller photos.'
        );
      }

      const profileAvatar = getUserAvatarUrl(profile);
      await createRoommateRequest({
        userId: user.uid,
        type: reqType,
        title: title.trim(),
        description: description.trim(),
        budget: Math.round(Number(budget)),
        generalLocation: generalLocation.trim(),
        locationType: 'physical',
        latitude: latitude as number,
        longitude: longitude as number,
        preferences: preferences.trim(),
        images,
        whatsappNumber: formattedPhone,
        userSnapshot: {
          fullName:
            profile?.fullName || user.displayName || 'LASUEDPLUG Student',
          isVerified: Boolean(profile?.isVerified),
          accountType: resolveAccountType(profile),
          ...(profileAvatar &&
          estimatedBytes + profileAvatar.length <= 850_000
            ? { profilePic: profileAvatar }
            : {}),
        },
      });

      showToast('Roommate request submitted for admin approval!', 'success');
      resetCreateForm();
      setCreateOpen(false);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to submit roommate request. Please try again.';
      setFormError(msg);
      showToast(msg, 'error');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl w-full mx-auto px-3.5 sm:px-6 py-6 sm:py-8 pb-24 md:pb-12 space-y-5 sm:space-y-6">
      <AccommodationSubNav
        actionSlot={
          <Button
            variant="primary"
            size="sm"
            fullWidth
            className="sm:w-auto"
            onClick={handleOpenCreateModal}
          >
            <Plus className="w-4 h-4" />
            <span>Post Roommate Request</span>
          </Button>
        }
      />

      {/* Page Heading */}
      <div className="space-y-1 min-w-0">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Roommate Matching
        </h1>
        <p className="text-sm text-slate-600">
          Connect with compatible LASUED &amp; LASU peers to share rent safely around Epe.
        </p>
      </div>

      {/* Sticky Filter Bar */}
      <section
        aria-label="Filter roommate requests"
        className="sticky top-14 md:top-16 z-30 -mx-3.5 sm:mx-0 px-3.5 sm:px-0 py-2 bg-slate-50/95 backdrop-blur-sm"
      >
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-2.5 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            <div className="space-y-1 min-w-0">
              <label
                htmlFor="roommate-type-filter"
                className="hidden sm:block text-xs font-medium text-slate-600"
              >
                Request Type
              </label>
              <select
                id="roommate-type-filter"
                aria-label="Request Type"
                value={typeFilter}
                onChange={(e) =>
                  setTypeFilter(e.target.value as 'all' | RoommateRequestType)
                }
                className="block w-full min-w-0 px-3 py-2 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              >
                <option value="all">All Requests</option>
                {ROOMMATE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 min-w-0">
              <label
                htmlFor="roommate-search"
                className="hidden sm:block text-xs font-medium text-slate-600"
              >
                Location or Preferences
              </label>
              <div className="relative min-w-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="roommate-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Location or preference (Igbogbo, female, quiet)..."
                  aria-label="Location or Preferences"
                  className="block w-full min-w-0 pl-9 pr-3 py-2 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Requests Grid */}
      {loading ? (
        <CardSkeletonGrid
          count={6}
          columns={3}
          label="Loading roommate requests..."
        />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadRequests()} />
      ) : filteredRequests.length === 0 ? (
        <EmptyState
          icon={typeFilter !== 'all' || searchQuery.trim() ? SearchX : Users}
          title={
            typeFilter !== 'all' || searchQuery.trim()
              ? 'No roommate requests found'
              : 'Nothing here yet'
          }
          description={
            typeFilter !== 'all' || searchQuery.trim()
              ? 'Try adjusting your search or filter to see more student requests.'
              : 'Be the first to post a roommate request or available room share.'
          }
          actionLabel={
            typeFilter !== 'all' || searchQuery.trim()
              ? 'Reset Filters'
              : 'Post Roommate Request'
          }
          onAction={
            typeFilter !== 'all' || searchQuery.trim()
              ? () => {
                  setTypeFilter('all');
                  setSearchQuery('');
                }
              : handleOpenCreateModal
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {filteredRequests.map((req, index) => {
            const typeLabel = getRoommateTypeLabel(req.type);
            const posterName =
              req.userSnapshot?.fullName || 'LASUEDPLUG Student';
            const isVerified = Boolean(req.userSnapshot?.isVerified);

            return (
              <Card
                key={req.id || req.title}
                padded={false}
                className="relative flex flex-col justify-between overflow-hidden hover:border-primary-200 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => handleOpenRoommateDetail(req)}
                  className="w-full h-full text-left p-5 flex flex-col justify-between gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl"
                >
                  <div className="space-y-3 w-full">
                    <div className="flex items-center justify-between gap-2 pr-10">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${
                          req.type === 'room_available'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        {typeLabel}
                      </span>

                      {isVerified && (
                        <Badge variant="verified">
                          <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </div>

                    {req.images && req.images.length > 0 && (
                      <div className="w-full h-36 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                        <ProductImage
                          src={req.images[0]}
                          alt={req.title}
                          priority={index < 3}
                          className="w-full h-full object-cover"
                          iconClassName="w-8 h-8 text-slate-400"
                        />
                      </div>
                    )}

                    <h2 className="text-base font-bold text-slate-900 line-clamp-2">
                      {req.title}
                    </h2>

                    <div className="space-y-1.5 text-xs text-slate-600">
                      <p className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{req.generalLocation}</span>
                      </p>
                      <p className="text-slate-500 line-clamp-2">
                        <span className="font-semibold text-slate-700">
                          Preferences:
                        </span>{' '}
                        {req.preferences}
                      </p>
                    </div>
                  </div>

                  <div className="w-full pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 flex items-center gap-1.5 min-w-0">
                        <UserAvatar
                          uid={req.userId}
                          src={req.userSnapshot?.profilePic}
                          name={posterName}
                          size="2xs"
                        />
                        <span className="truncate">By {posterName}</span>
                        {isVerified && (
                          <VerifiedBadge
                            size="xs"
                            accountType={req.userSnapshot?.accountType}
                          />
                        )}
                      </p>
                      <p className="text-sm font-bold text-slate-900 tabular-nums">
                        {typeof req.budget === 'number' && req.budget > 0
                          ? `${formatNaira(req.budget)} / yr`
                          : 'Flexible Budget'}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-blue-600 shrink-0">
                      View &amp; Connect →
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={(e) => handleShareRoommate(req, e)}
                  aria-label={`Share ${req.title}`}
                  title="Share roommate request"
                  className="absolute top-3.5 right-3.5 z-10 w-8 h-8 rounded-full bg-white/95 hover:bg-white text-slate-700 hover:text-blue-600 border border-slate-200/90 shadow-sm backdrop-blur-sm flex items-center justify-center transition-all duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selectedRequest && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="roommate-detail-title"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={handleCloseRoommateDetail}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${
                    selectedRequest.type === 'room_available'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}
                >
                  {getRoommateTypeLabel(selectedRequest.type)}
                </span>
                <h2
                  id="roommate-detail-title"
                  className="text-xl font-bold text-slate-900 leading-snug"
                >
                  {selectedRequest.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCloseRoommateDetail}
                aria-label="Close details"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedRequest.images && selectedRequest.images.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {selectedRequest.images.map((imgSrc, idx) => (
                  <div
                    key={`${selectedRequest.id || 'req'}-img-${idx}`}
                    className="aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200"
                  >
                    <ProductImage
                      src={imgSrc}
                      alt={`${selectedRequest.title} photo ${idx + 1}`}
                      className="w-full h-full object-cover"
                      iconClassName="w-6 h-6 text-slate-400"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500">Location</p>
                <p className="font-semibold text-slate-900 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                  <span>{selectedRequest.generalLocation}</span>
                </p>
                {typeof selectedRequest.latitude === 'number' &&
                  typeof selectedRequest.longitude === 'number' && (
                    <a
                      href={`https://www.google.com/maps?q=${selectedRequest.latitude},${selectedRequest.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span>View on Map</span>
                    </a>
                  )}
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Annual Budget Share
                </p>
                <p className="font-bold text-primary-600 mt-0.5 tabular-nums">
                  {typeof selectedRequest.budget === 'number' &&
                  selectedRequest.budget > 0
                    ? `${formatNaira(selectedRequest.budget)} / year`
                    : 'Flexible / Negotiable'}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Roommate Preferences
              </h3>
              <p className="text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-3">
                {selectedRequest.preferences}
              </p>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Details
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {selectedRequest.description}
              </p>
            </div>

            <Link
              to={`/seller/${selectedRequest.userId}`}
              className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-300 hover:bg-slate-100/70 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <UserAvatar
                  uid={selectedRequest.userId}
                  src={selectedRequest.userSnapshot?.profilePic}
                  name={selectedRequest.userSnapshot?.fullName || 'Student'}
                  size="md"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 flex items-center gap-1.5 min-w-0 transition-colors">
                    <span className="truncate">
                      {selectedRequest.userSnapshot?.fullName ||
                        'LASUEDPLUG Student'}
                    </span>
                    {selectedRequest.userSnapshot?.isVerified && (
                      <VerifiedBadge
                        size="sm"
                        accountType={selectedRequest.userSnapshot?.accountType}
                      />
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    View student profile &amp; reviews →
                  </p>
                </div>
              </div>
              {selectedRequest.userSnapshot?.isVerified && (
                <Badge variant="verified">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                  Verified
                </Badge>
              )}
            </Link>

            <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <a
                href={buildRoommateWhatsAppUrl(
                  selectedRequest.whatsappNumber || '',
                  selectedRequest.title
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition-all duration-200 active:scale-95"
              >
                <MessageCircle className="w-5 h-5" />
                <span>Message on WhatsApp</span>
              </a>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleShareRoommate(selectedRequest)}
                className="min-h-[48px] px-5 py-3.5 rounded-xl shrink-0"
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Post Roommate Request Modal */}
      {createOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-roommate-title"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !submitting && setCreateOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
              <div>
                <h2
                  id="create-roommate-title"
                  className="text-lg font-bold text-slate-900"
                >
                  Post Roommate Request
                </h2>
                <p className="text-xs text-slate-500">
                  Requests require 1–{MAX_LISTING_IMAGES} photos, budget, and a pinned physical location.
                </p>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setCreateOpen(false)}
                aria-label="Close modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleCreateSubmit(e)}
              noValidate
              className="space-y-4"
            >
              {formError && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700"
                >
                  {formError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  Request Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {ROOMMATE_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setReqType(opt.value)}
                      className={`px-3 py-2.5 rounded-lg text-xs font-semibold border transition-colors ${
                        reqType === opt.value
                          ? 'bg-primary-50 border-primary-400 text-primary-700'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <Input
                label="Headline"
                required
                maxLength={110}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Looking for a female roommate at Igbogbo"
                helperText="Minimum 5 characters."
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Physical Area / Location"
                  required
                  value={generalLocation}
                  onChange={(e) => setGeneralLocation(e.target.value)}
                  placeholder="e.g. Igbogbo, Epe"
                />
                <Input
                  label="Annual Budget Share (₦)"
                  type="number"
                  required
                  min={1000}
                  step={500}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g. 120000"
                />
              </div>

              <Input
                label="Preferences"
                required
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                placeholder="e.g. Female only, clean, no smoking"
              />

              <div className="space-y-1.5">
                <label
                  htmlFor="roommate-description"
                  className="block text-sm font-medium text-slate-700"
                >
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="roommate-description"
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the apartment/room arrangement, move-in timeline, and expectations..."
                  className="block w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-slate-500">Minimum 5 characters.</p>
              </div>

              <Input
                label="WhatsApp Number"
                type="tel"
                required
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="e.g. 08012345678"
              />

              {/* Mandatory Physical GPS Pin */}
              <LocationPinField
                latitude={latitude}
                longitude={longitude}
                onPin={({ latitude: lat, longitude: lng }) => {
                  setLatitude(lat);
                  setLongitude(lng);
                  setFormError(null);
                }}
                onClear={() => {
                  setLatitude(undefined);
                  setLongitude(undefined);
                }}
                label="Room / Area GPS Location"
                helperText="Roommate requests cannot be online-only — pin the exact physical location."
              />

              {/* Compulsory 1-4 Photos */}
              <ImageUploadGrid
                images={images}
                onChange={(next) => {
                  setImages(next);
                  setFormError(null);
                }}
                label="Room or Flat Photos"
                maxImages={MAX_LISTING_IMAGES}
                inputId="roommate-images"
              />

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
