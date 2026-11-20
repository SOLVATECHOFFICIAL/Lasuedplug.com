import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ImagePlus,
  MapPin,
  MessageCircle,
  Plus,
  Search,
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
import { getInitials } from '../../lib/authHelpers';
import { compressImageToBase64, isImageFile } from '../../lib/imageUtils';
import { formatNigerianWhatsAppDigits } from '../../lib/marketplaceHelpers';
import { formatNaira } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { RoommateRequest, RoommateRequestType } from '../../types';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Loading } from '../../components/feedback/Loading';
import { ErrorState } from '../../components/feedback/ErrorState';
import { AccommodationSubNav } from '../../components/accommodation/AccommodationSubNav';

interface LocalImageItem {
  id: string;
  file: File;
  previewUrl: string;
}

const MAX_ROOMMATE_IMAGES = 3;

export function Roommates() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const [requests, setRequests] = useState<RoommateRequest[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [preferences, setPreferences] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [selectedImages, setSelectedImages] = useState<LocalImageItem[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlsRef = useRef<string[]>([]);
  const submittingRef = useRef(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchApprovedRoommateRequests();
      setRequests(items);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to load roommate requests right now.';
      setError(msg);
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

  useEffect(() => {
    previewUrlsRef.current = selectedImages.map((img) => img.previewUrl);
  }, [selectedImages]);

  useEffect(() => {
    return () => {
      for (const url of previewUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const filteredRequests = useMemo(
    () => filterRoommateRequests(requests, typeFilter, searchQuery),
    [requests, typeFilter, searchQuery]
  );

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
    for (const item of selectedImages) {
      URL.revokeObjectURL(item.previewUrl);
    }
    setReqType('need_roommate');
    setTitle('');
    setDescription('');
    setBudget('');
    setGeneralLocation('');
    setPreferences('');
    setSelectedImages([]);
    setFormError(null);
  };

  const handleImageSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    e.target.value = '';
    if (!files || files.length === 0) return;

    const remaining = MAX_ROOMMATE_IMAGES - selectedImages.length;
    if (remaining <= 0) {
      showToast(`You can upload up to ${MAX_ROOMMATE_IMAGES} photos.`, 'info');
      return;
    }

    const incoming: LocalImageItem[] = [];
    for (const file of Array.from(files)) {
      if (incoming.length >= remaining) {
        showToast(
          `Maximum of ${MAX_ROOMMATE_IMAGES} photos allowed per request.`,
          'info'
        );
        break;
      }
      if (!isImageFile(file)) {
        showToast(`"${file.name}" is not a valid image file.`, 'error');
        continue;
      }
      incoming.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    if (incoming.length > 0) {
      setSelectedImages((prev) => [...prev, ...incoming]);
    }
  };

  const handleRemoveImage = (imageId: string) => {
    setSelectedImages((prev) => {
      const target = prev.find((img) => img.id === imageId);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((img) => img.id !== imageId);
    });
  };

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setFormError(null);

    if (!user?.uid) {
      showToast('Please login to post a roommate request.', 'error');
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();
    const trimmedLoc = generalLocation.trim();
    const trimmedPrefs = preferences.trim();
    const formattedPhone = formatNigerianWhatsAppDigits(whatsappNumber);
    const parsedBudget = budget.trim() ? Number(budget) : undefined;

    if (!trimmedTitle) {
      setFormError('Please enter a short headline for your request.');
      return;
    }
    if (!trimmedDesc || trimmedDesc.length < 10) {
      setFormError('Please provide details (at least 10 characters).');
      return;
    }
    if (
      parsedBudget !== undefined &&
      (!Number.isFinite(parsedBudget) || parsedBudget <= 0)
    ) {
      setFormError('Please enter a valid positive budget or leave it blank.');
      return;
    }
    if (!trimmedLoc) {
      setFormError('Please enter your preferred area (e.g. Igbogbo, Epe).');
      return;
    }
    if (!trimmedPrefs) {
      setFormError('Please state your roommate preferences.');
      return;
    }
    if (formattedPhone.length < 11) {
      setFormError('Please enter a valid WhatsApp phone number.');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const compressedImages: string[] = [];
      for (const item of selectedImages) {
        compressedImages.push(await compressImageToBase64(item.file));
      }

      const estimatedBytes = new TextEncoder().encode(
        JSON.stringify(compressedImages)
      ).length;
      if (estimatedBytes > 850_000) {
        throw new Error(
          'Compressed photos exceed the 850KB document limit. Please use fewer or smaller photos.'
        );
      }

      await createRoommateRequest({
        userId: user.uid,
        type: reqType,
        title: trimmedTitle,
        description: trimmedDesc,
        budget: parsedBudget ? Math.round(parsedBudget) : undefined,
        generalLocation: trimmedLoc,
        preferences: trimmedPrefs,
        images: compressedImages,
        whatsappNumber: formattedPhone,
        userSnapshot: {
          fullName:
            profile?.fullName || user.displayName || 'LASUEDPLUG Student',
          isVerified: Boolean(profile?.isVerified),
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-24 md:pb-12 space-y-6">
      <AccommodationSubNav
        actionSlot={
          <Button variant="primary" size="sm" onClick={handleOpenCreateModal}>
            <Plus className="w-4 h-4" />
            <span>Post Roommate Request</span>
          </Button>
        }
      />

      {/* Page Heading */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Roommate Matching
        </h1>
        <p className="text-sm text-slate-600">
          Connect with compatible LASUED &amp; LASU peers to share rent safely around Epe.
        </p>
      </div>

      {/* Filter Bar */}
      <Card hoverable={false} className="p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label
              htmlFor="roommate-type-filter"
              className="block text-xs font-medium text-slate-600"
            >
              Request Type
            </label>
            <select
              id="roommate-type-filter"
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value as 'all' | RoommateRequestType)
              }
              className="block w-full px-3 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Requests</option>
              {ROOMMATE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="roommate-search"
              className="block text-xs font-medium text-slate-600"
            >
              Location or Preferences
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="roommate-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. Igbogbo, female, quiet..."
                className="block w-full pl-9 pr-3 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Requests Grid */}
      {loading ? (
        <Loading variant="skeleton" message="Loading roommate requests..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadRequests()} />
      ) : filteredRequests.length === 0 ? (
        <Card hoverable={false} className="border-dashed text-center py-12 space-y-4">
          <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="text-lg font-semibold text-slate-900">
              No roommate requests found
            </h2>
            <p className="text-sm text-slate-500">
              {typeFilter !== 'all' || searchQuery.trim()
                ? 'Try adjusting your search or filter to see more student requests.'
                : 'Be the first to post a roommate request or available room share.'}
            </p>
          </div>
          <div className="flex justify-center gap-2.5">
            {typeFilter !== 'all' || searchQuery.trim() ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTypeFilter('all');
                  setSearchQuery('');
                }}
              >
                Reset Filters
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenCreateModal}
              >
                Post Roommate Request
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRequests.map((req) => {
            const typeLabel = getRoommateTypeLabel(req.type);
            const posterName =
              req.userSnapshot?.fullName || 'LASUEDPLUG Student';
            const isVerified = Boolean(req.userSnapshot?.isVerified);

            return (
              <Card
                key={req.id || req.title}
                onClick={() => setSelectedRequest(req)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedRequest(req);
                  }
                }}
                className="cursor-pointer flex flex-col justify-between space-y-4 hover:border-primary-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
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
                      <img
                        src={req.images[0]}
                        alt={req.title}
                        className="w-full h-full object-cover"
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

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500 truncate">
                      By {posterName}
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
          onClick={() => setSelectedRequest(null)}
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
                onClick={() => setSelectedRequest(null)}
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
                    <img
                      src={imgSrc}
                      alt={`${selectedRequest.title} photo ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm">
              <div>
                <p className="text-xs font-medium text-slate-500">Location</p>
                <p className="font-semibold text-slate-900 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                  <span>{selectedRequest.generalLocation}</span>
                </p>
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

            <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {getInitials(
                    selectedRequest.userSnapshot?.fullName || 'Student',
                    null
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {selectedRequest.userSnapshot?.fullName ||
                      'LASUEDPLUG Student'}
                  </p>
                  <p className="text-xs text-slate-500">Posted by student</p>
                </div>
              </div>
              {selectedRequest.userSnapshot?.isVerified && (
                <Badge variant="verified">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                  Verified
                </Badge>
              )}
            </div>

            <div className="pt-1">
              <a
                href={buildRoommateWhatsAppUrl(
                  selectedRequest.whatsappNumber || '',
                  selectedRequest.title
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
                <span>Message on WhatsApp</span>
              </a>
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
                  Requests go live once reviewed by an admin.
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
                  Request Type
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
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="General Location"
                  required
                  value={generalLocation}
                  onChange={(e) => setGeneralLocation(e.target.value)}
                  placeholder="e.g. Igbogbo, Epe"
                />
                <Input
                  label="Annual Budget Share (₦)"
                  type="number"
                  min={1000}
                  step={500}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="Optional, e.g. 120000"
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
                  Description
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
              </div>

              <Input
                label="WhatsApp Number"
                type="tel"
                required
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="e.g. 08012345678"
              />

              {/* Room / Personal Photos (Up to 3) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-700">
                    Room or Flat Photos{' '}
                    <span className="text-xs font-normal text-slate-500">
                      (Optional, up to {MAX_ROOMMATE_IMAGES})
                    </span>
                  </label>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {selectedImages.length}/{MAX_ROOMMATE_IMAGES}
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <div className="grid grid-cols-3 gap-2.5">
                  {selectedImages.map((img, idx) => (
                    <div
                      key={img.id}
                      className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100"
                    >
                      <img
                        src={img.previewUrl}
                        alt={`Roommate photo ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(img.id)}
                        aria-label={`Remove photo ${idx + 1}`}
                        className="absolute top-1 right-1 p-1 rounded-full bg-slate-900/75 hover:bg-slate-900 text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {selectedImages.length < MAX_ROOMMATE_IMAGES && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/40 flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-blue-600 transition-colors p-2 text-center"
                    >
                      <ImagePlus className="w-5 h-5" />
                      <span className="text-[11px] font-medium">Add Photo</span>
                    </button>
                  )}
                </div>
              </div>

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
