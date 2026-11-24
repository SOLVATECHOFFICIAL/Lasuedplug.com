import {
  FormEvent,
  memo,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useLocation, useNavigate, useNavigationType, useSearchParams } from 'react-router-dom';
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
  fetchApprovedRoommateRequestsDelta,
} from '../../lib/accommodationService';
import {
  getUserAvatarUrl,
  resolveAccountType,
  shouldAutoApproveListing,
} from '../../lib/authHelpers';
import { compactListingsForCache } from '../../lib/firestoreQueryCache';
import { getTimestampMillis } from '../../lib/homeHelpers';
import { warmImages } from '../../lib/imageCache';
import { reconcileRoommatesSlice } from '../../lib/backgroundSync';
import {
  CACHE_HYDRATED_EVENT,
  getFastCache,
  getFastCacheEnvelope,
  setFastCache,
  touchFastCache,
} from '../../lib/fastCache';
import {
  getEntityContentSignature,
  getNewestCreatedAtMs,
  haveListsDiverged,
  mergeDeltaEntities,
  resolveSyncStrategy,
} from '../../lib/syncCache';
import { useBackgroundSync } from '../../lib/useBackgroundSync';
import {
  buildRouteKey,
  getSavedRouteViewState,
  saveRouteViewState,
} from '../../lib/feedScrollState';
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
import { SeoHead } from '../../components/seo/SeoHead';

interface RoommatesViewState {
  typeFilter: 'all' | RoommateRequestType;
  searchQuery: string;
}

interface RoommateRequestCardProps {
  request: RoommateRequest;
  priority: boolean;
  onOpen: (req: RoommateRequest) => void;
  onShare: (req: RoommateRequest, e: MouseEvent<HTMLButtonElement>) => void;
}

const RoommateRequestCard = memo(function RoommateRequestCard({
  request: req,
  priority,
  onOpen,
  onShare,
}: RoommateRequestCardProps) {
  const typeLabel = getRoommateTypeLabel(req.type);
  const posterName = req.userSnapshot?.fullName || 'LASUEDPLUG Student';
  const isVerified = Boolean(req.userSnapshot?.isVerified);

  return (
    <Card
      padded={false}
      className="relative flex flex-col justify-between overflow-hidden hover:border-primary-200 dark:hover:border-blue-600 transition-colors"
    >
      <button
        type="button"
        onClick={() => onOpen(req)}
        className="w-full h-full text-left p-5 flex flex-col justify-between gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl"
      >
        <div className="space-y-3 w-full">
          <div className="flex items-center justify-between gap-2 pr-10">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${
                req.type === 'room_available'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
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
            <div className="w-full h-36 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <ProductImage
                src={req.images[0]}
                alt={req.title}
                priority={priority}
                className="w-full h-full object-cover"
                iconClassName="w-8 h-8 text-slate-400 dark:text-slate-500"
              />
            </div>
          )}

          <h2 className="text-base font-bold text-slate-900 dark:text-white line-clamp-2">
            {req.title}
          </h2>

          <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            <p className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
              <span className="truncate">{req.generalLocation}</span>
            </p>
            <p className="text-slate-500 dark:text-slate-400 line-clamp-2">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Preferences:
              </span>{' '}
              {req.preferences}
            </p>
          </div>
        </div>

        <div className="w-full pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 min-w-0">
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
            <p className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
              {typeof req.budget === 'number' && req.budget > 0
                ? `${formatNaira(req.budget)} / yr`
                : 'Flexible Budget'}
            </p>
          </div>
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0">
            View &amp; Connect →
          </span>
        </div>
      </button>

      <button
        type="button"
        onClick={(e) => onShare(req, e)}
        aria-label={`Share ${req.title}`}
        title="Share roommate request"
        className="absolute top-3.5 right-3.5 z-10 w-8 h-8 rounded-full bg-white/95 dark:bg-slate-800/95 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200/90 dark:border-slate-700 shadow-sm backdrop-blur-sm flex items-center justify-center transition-all duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </Card>
  );
});

export function Roommates() {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const [searchParams, setSearchParams] = useSearchParams();
  const routeKey = buildRouteKey(location.pathname, location.search);
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const restoredView = useMemo(
    () =>
      navigationType === 'POP'
        ? getSavedRouteViewState<RoommatesViewState>(location.key, routeKey)
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location.key]
  );

  const [requests, setRequests] = useState<RoommateRequest[]>(
    () => getFastCache<RoommateRequest[]>('roommates_feed') || []
  );
  const [loading, setLoading] = useState(
    () => (getFastCache<RoommateRequest[]>('roommates_feed') || []).length === 0
  );
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<'all' | RoommateRequestType>(
    () => restoredView?.typeFilter ?? 'all'
  );
  const [searchQuery, setSearchQuery] = useState(
    () => restoredView?.searchQuery ?? ''
  );
  const [selectedRequest, setSelectedRequest] =
    useState<RoommateRequest | null>(null);

  useEffect(() => {
    saveRouteViewState<RoommatesViewState>(location.key, routeKey, {
      typeFilter,
      searchQuery,
    });
  }, [location.key, routeKey, typeFilter, searchQuery]);

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

  useEffect(() => {
    const handleHydrated = () => {
      const hydrated = getFastCacheEnvelope<RoommateRequest[]>('roommates_feed');
      if (hydrated && hydrated.data.length > 0) {
        setRequests((prev) =>
          hydrated.isFull !== false || prev.length === 0
            ? hydrated.data
            : prev
        );
        setLoading(false);
        warmImages(
          hydrated.data.map((r) => r.images?.[0]),
          12
        );
      }
    };

    window.addEventListener(CACHE_HYDRATED_EVENT, handleHydrated);
    return () => {
      window.removeEventListener(CACHE_HYDRATED_EVENT, handleHydrated);
    };
  }, []);

  const loadRequests = useCallback(async (forceRefresh = false) => {
    const env = getFastCacheEnvelope<RoommateRequest[]>('roommates_feed');
    const cached = env?.data || [];
    const hasCached = cached.length > 0;

    if (hasCached) {
      warmImages(
        cached.map((r) => r.images?.[0]),
        12
      );
      setLoading(false);
    } else {
      setLoading(true);
    }

    const strategy = resolveSyncStrategy({
      hasCached,
      lastSyncedAt: env?.syncedAt,
      lastFullSyncAt: env?.fullSyncAt,
      forceRefresh,
    });

    if (strategy === 'fresh-skip') {
      setLoading(false);
      setError(null);
      return;
    }

    setError(null);
    try {
      if (strategy === 'delta-sync' && hasCached) {
        const newestMs = getNewestCreatedAtMs(cached);
        const delta = await fetchApprovedRoommateRequestsDelta(newestMs);
        if (delta.length === 0) {
          touchFastCache('roommates_feed');
        } else {
          const merged = mergeDeltaEntities(
            cached,
            delta,
            (item) => item.id,
            (item) => getTimestampMillis(item.createdAt),
            60
          );
          setRequests(merged);
          setFastCache('roommates_feed', merged, {
            localData: compactListingsForCache(merged, 24),
            isFull: true,
          });
        }
      } else {
        const items = await fetchApprovedRoommateRequests();
        setRequests(items);
        setFastCache('roommates_feed', items, {
          localData: compactListingsForCache(items, 24),
          isFull: true,
        });
      }
    } catch (err) {
      if (!hasCached) {
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

  const requestsRef = useRef(requests);
  requestsRef.current = requests;
  const selectedRequestRef = useRef(selectedRequest);
  selectedRequestRef.current = selectedRequest;

  useBackgroundSync({
    enabled: true,
    onTick: useCallback(async ({ tickIndex, reason }) => {
      const res = await reconcileRoommatesSlice({
        cachedItems: requestsRef.current,
        tickIndex,
        forceHeadCheck: reason === 'resume',
      });
      if (!res.changed) return;

      if (
        haveListsDiverged(
          requestsRef.current,
          res.items,
          getEntityContentSignature
        )
      ) {
        setRequests(res.items);
        setFastCache('roommates_feed', res.items, {
          localData: compactListingsForCache(res.items, 24),
          isFull: true,
        });
      }

      if (selectedRequestRef.current?.id) {
        const updatedMatch = res.items.find(
          (item) => item.id === selectedRequestRef.current?.id
        );
        if (!updatedMatch) {
          setSelectedRequest(null);
        } else if (
          getEntityContentSignature(updatedMatch) !==
          getEntityContentSignature(selectedRequestRef.current)
        ) {
          setSelectedRequest(updatedMatch);
        }
      }
    }, []),
  });

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

      const isAutoApproved = shouldAutoApproveListing(profile);
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
        isApproved: isAutoApproved,
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

      if (isAutoApproved) {
        showToast('Roommate request published and live!', 'success');
        void loadRequests(true);
      } else {
        showToast('Roommate request submitted for admin approval!', 'success');
      }
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
      <SeoHead
        title={selectedRequest ? selectedRequest.title : 'Roommate Matching'}
        ogTitle={
          selectedRequest
            ? selectedRequest.title
            : 'Roommate Matching | LASUEDPLUG'
        }
        description={
          selectedRequest
            ? selectedRequest.description?.trim() ||
              `${getRoommateTypeLabel(selectedRequest.type)} in ${selectedRequest.generalLocation} on LASUEDPLUG.`
            : 'Connect with compatible LASUED & LASU peers to share rent safely around Epe.'
        }
      />
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
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Roommate Matching
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Connect with compatible LASUED &amp; LASU peers to share rent safely around Epe.
        </p>
      </div>

      {/* Sticky Filter Bar */}
      <section
        aria-label="Filter roommate requests"
        className="sticky top-14 md:top-16 z-30 -mx-3.5 sm:mx-0 px-3.5 sm:px-0 py-2 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-sm"
      >
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-2.5 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            <div className="space-y-1 min-w-0">
              <label
                htmlFor="roommate-type-filter"
                className="hidden sm:block text-xs font-medium text-slate-600 dark:text-slate-300"
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
                className="block w-full min-w-0 px-3 py-2 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
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
                className="hidden sm:block text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                Location or Preferences
              </label>
              <div className="relative min-w-0">
                <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="roommate-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Location or preference (Igbogbo, female, quiet)..."
                  aria-label="Location or Preferences"
                  className="block w-full min-w-0 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
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
          {filteredRequests.map((req, index) => (
            <RoommateRequestCard
              key={req.id || req.title}
              request={req}
              priority={index < 3}
              onOpen={handleOpenRoommateDetail}
              onShare={handleShareRoommate}
            />
          ))}
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
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${
                    selectedRequest.type === 'room_available'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                  }`}
                >
                  {getRoommateTypeLabel(selectedRequest.type)}
                </span>
                <h2
                  id="roommate-detail-title"
                  className="text-xl font-bold text-slate-900 dark:text-white leading-snug"
                >
                  {selectedRequest.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCloseRoommateDetail}
                aria-label="Close details"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedRequest.images && selectedRequest.images.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {selectedRequest.images.map((imgSrc, idx) => (
                  <div
                    key={`${selectedRequest.id || 'req'}-img-${idx}`}
                    className="aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    <ProductImage
                      src={imgSrc}
                      alt={`${selectedRequest.title} photo ${idx + 1}`}
                      className="w-full h-full object-cover"
                      iconClassName="w-6 h-6 text-slate-400 dark:text-slate-500"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Location</p>
                <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-primary-500 dark:text-blue-400 shrink-0" />
                  <span>{selectedRequest.generalLocation}</span>
                </p>
                {typeof selectedRequest.latitude === 'number' &&
                  typeof selectedRequest.longitude === 'number' && (
                    <a
                      href={`https://www.google.com/maps?q=${selectedRequest.latitude},${selectedRequest.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span>View on Map</span>
                    </a>
                  )}
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Annual Budget Share
                </p>
                <p className="font-bold text-primary-600 dark:text-blue-400 mt-0.5 tabular-nums">
                  {typeof selectedRequest.budget === 'number' &&
                  selectedRequest.budget > 0
                    ? `${formatNaira(selectedRequest.budget)} / year`
                    : 'Flexible / Negotiable'}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Roommate Preferences
              </h3>
              <p className="text-sm text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                {selectedRequest.preferences}
              </p>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Details
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {selectedRequest.description}
              </p>
            </div>

            <Link
              to={`/seller/${selectedRequest.userId}`}
              className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-slate-100/70 dark:hover:bg-slate-800 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <UserAvatar
                  uid={selectedRequest.userId}
                  src={selectedRequest.userSnapshot?.profilePic}
                  name={selectedRequest.userSnapshot?.fullName || 'Student'}
                  size="md"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 flex items-center gap-1.5 min-w-0 transition-colors">
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
                  <p className="text-xs text-slate-500 dark:text-slate-400">
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
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2
                  id="create-roommate-title"
                  className="text-lg font-bold text-slate-900 dark:text-white"
                >
                  Post Roommate Request
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Requests require 1–{MAX_LISTING_IMAGES} photos, budget, and a pinned physical location.
                </p>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setCreateOpen(false)}
                aria-label="Close modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
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
                  className="p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-xs font-medium text-red-700 dark:text-red-300"
                >
                  {formError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
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
                          ? 'bg-primary-50 dark:bg-blue-950/60 border-primary-400 dark:border-blue-500 text-primary-700 dark:text-blue-300'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
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
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300"
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
                  className="block w-full px-3.5 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">Minimum 5 characters.</p>
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
