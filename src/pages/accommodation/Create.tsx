import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Check,
  Lock,
} from 'lucide-react';
import {
  ACCOMMODATION_TYPE_OPTIONS,
  COMMON_AMENITIES,
} from '../../lib/accommodationHelpers';
import { createAccommodation } from '../../lib/accommodationService';
import {
  MAX_LISTING_IMAGES,
  validateAccommodationCreateInput,
} from '../../lib/listingValidation';
import { formatNigerianWhatsAppDigits } from '../../lib/marketplaceHelpers';
import {
  getUserAvatarUrl,
  resolveAccountType,
  shouldAutoApproveListing,
} from '../../lib/authHelpers';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { AccommodationType } from '../../types';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ImageUploadGrid } from '../../components/forms/ImageUploadGrid';
import { LocationPinField } from '../../components/forms/LocationPinField';

const MAX_DOCUMENT_IMAGE_BYTES = 850_000;

export function AccommodationCreate() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const [type, setType] = useState<AccommodationType>('self_contain');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rentPrice, setRentPrice] = useState('');
  const [generalLocation, setGeneralLocation] = useState('');
  const [exactAddress, setExactAddress] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([
    'Running Water',
  ]);
  const [customAmenities, setCustomAmenities] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submittingRef = useRef(false);

  useEffect(() => {
    if (profile?.phone && !whatsappNumber) {
      setWhatsappNumber(profile.phone);
    }
  }, [profile?.phone, whatsappNumber]);

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(amenity)
        ? prev.filter((item) => item !== amenity)
        : [...prev, amenity]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setFormError(null);

    if (!user?.uid) {
      showToast('Please sign in to list an accommodation.', 'error');
      navigate('/login');
      return;
    }

    const extraAmenities = customAmenities
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const mergedAmenities = Array.from(
      new Set([...selectedAmenities, ...extraAmenities])
    );

    const formattedPhone = formatNigerianWhatsAppDigits(whatsappNumber);

    const validationError = validateAccommodationCreateInput({
      type,
      title,
      description,
      rentPrice,
      amenitiesCount: mergedAmenities.length,
      generalLocation,
      exactAddress,
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
      const totalImagesChars = images.reduce((sum, img) => sum + img.length, 0);
      const ownerAvatar = getUserAvatarUrl(profile);

      const isAutoApproved = shouldAutoApproveListing(profile);

      await createAccommodation({
        ownerId: user.uid,
        type,
        title: title.trim(),
        description: description.trim(),
        rentPrice: Math.round(Number(rentPrice)),
        generalLocation: generalLocation.trim(),
        exactAddress: exactAddress.trim(),
        locationType: 'physical',
        latitude: latitude as number,
        longitude: longitude as number,
        amenities: mergedAmenities,
        images,
        whatsappNumber: formattedPhone,
        isApproved: isAutoApproved,
        ownerSnapshot: {
          fullName:
            profile?.fullName || user.displayName || 'LASUEDPLUG Host',
          isVerified: Boolean(profile?.isVerified),
          accountType: resolveAccountType(profile),
          ...(ownerAvatar &&
          totalImagesChars + ownerAvatar.length <= MAX_DOCUMENT_IMAGE_BYTES
            ? { profilePic: ownerAvatar }
            : {}),
        },
      });

      showToast(
        isAutoApproved
          ? 'Accommodation published and live immediately!'
          : 'Accommodation submitted for admin approval!',
        'success'
      );
      navigate('/accommodation');
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to submit accommodation listing. Please try again.';
      setFormError(msg);
      showToast(msg, 'error');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-24 md:pb-12 space-y-6">
      <div>
        <Link
          to="/accommodation"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Accommodation</span>
        </Link>
      </div>

      <div className="space-y-1">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary-600 dark:text-blue-400">
          <Building2 className="w-4 h-4" />
          <span>Campus Housing</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          List Accommodation
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Post a verified student room, self-contain, or shared flat around Epe. Physical location GPS pin and 1–{MAX_LISTING_IMAGES} photos are required.
        </p>
      </div>

      <Card hoverable={false}>
        <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-6">
          {formError && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-sm font-medium text-red-700 dark:text-red-300"
            >
              {formError}
            </div>
          )}

          {/* Type & Rent */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="accommodation-type"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Accommodation Type <span className="text-red-500">*</span>
              </label>
              <select
                id="accommodation-type"
                value={type}
                onChange={(e) => setType(e.target.value as AccommodationType)}
                className="block w-full px-3.5 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {ACCOMMODATION_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Annual Rent Price (₦ / year)"
              type="number"
              min={1000}
              step={500}
              required
              value={rentPrice}
              onChange={(e) => setRentPrice(e.target.value)}
              placeholder="e.g. 250000"
            />
          </div>

          <Input
            label="Listing Title"
            required
            maxLength={100}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Spacious Self Contain at Epe"
            helperText="Minimum 5 characters."
          />

          <div className="space-y-1.5">
            <label
              htmlFor="accommodation-description"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="accommodation-description"
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe room size, proximity to campus, compound environment, light/water situation, and inspection rules..."
              className="block w-full px-3.5 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">Minimum 5 characters.</p>
          </div>

          {/* Public General Location vs Private Exact Address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="General Location (Public)"
              required
              value={generalLocation}
              onChange={(e) => setGeneralLocation(e.target.value)}
              placeholder="e.g. Near LASUED Gate or Igbogbo, Epe"
              helperText="Shown publicly on the browse and detail pages."
            />

            <div className="space-y-1.5">
              <Input
                label="Exact Address (Private)"
                required
                value={exactAddress}
                onChange={(e) => setExactAddress(e.target.value)}
                placeholder="e.g. House 14, Odo-Egiri Street"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                <span>Private — only visible to you and admins, never public.</span>
              </p>
            </div>
          </div>

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
            label="Property GPS Location"
            helperText="Rooms cannot be online-only — pin the exact physical location of the house/hostel."
          />

          {/* Amenities */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Amenities <span className="text-red-500">*</span>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {COMMON_AMENITIES.map((amenity) => {
                const checked = selectedAmenities.includes(amenity);
                return (
                  <button
                    key={amenity}
                    type="button"
                    onClick={() => toggleAmenity(amenity)}
                    aria-pressed={checked}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border text-left transition-colors ${
                      checked
                        ? 'bg-primary-50 dark:bg-blue-950/60 border-primary-300 dark:border-blue-600 text-primary-700 dark:text-blue-300'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                        checked
                          ? 'bg-primary-600 border-primary-600 text-white'
                          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                      }`}
                    >
                      {checked && <Check className="w-3 h-3" />}
                    </span>
                    <span className="truncate">{amenity}</span>
                  </button>
                );
              })}
            </div>

            <Input
              label="Other Amenities (Optional)"
              value={customAmenities}
              onChange={(e) => setCustomAmenities(e.target.value)}
              placeholder="Comma-separated, e.g. Parking Space, Ceiling Fan"
            />
          </div>

          {/* Compulsory Photos (1-4, Base64 Compression) */}
          <ImageUploadGrid
            images={images}
            onChange={(next) => {
              setImages(next);
              setFormError(null);
            }}
            label="Room & Compound Photos"
            aspectClass="aspect-[4/3]"
            maxImages={MAX_LISTING_IMAGES}
            maxDocumentBytes={MAX_DOCUMENT_IMAGE_BYTES}
            inputId="accommodation-images"
          />

          <Input
            label="WhatsApp Number"
            type="tel"
            required
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            placeholder="e.g. 08012345678"
            helperText="Students will contact you on WhatsApp to book an inspection."
          />

          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
            <Link to="/accommodation" className="sm:w-auto">
              <Button type="button" variant="outline" fullWidth>
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
            >
              {submitting ? 'Submitting Listing...' : 'Submit Accommodation'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
