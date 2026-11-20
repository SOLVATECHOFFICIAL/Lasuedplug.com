import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Check,
  ImagePlus,
  Loader2,
  Lock,
  Trash2,
} from 'lucide-react';
import {
  ACCOMMODATION_TYPE_OPTIONS,
  COMMON_AMENITIES,
} from '../../lib/accommodationHelpers';
import { createAccommodation } from '../../lib/accommodationService';
import { compressImageToBase64, isImageFile } from '../../lib/imageUtils';
import { formatNigerianWhatsAppDigits } from '../../lib/marketplaceHelpers';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { AccommodationType } from '../../types';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

const MAX_IMAGES = 4;
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
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([
    'Running Water',
  ]);
  const [customAmenities, setCustomAmenities] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [compressing, setCompressing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submittingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    const remainingSlots = MAX_IMAGES - images.length;
    if (remainingSlots <= 0) {
      showToast(`Maximum of ${MAX_IMAGES} images allowed.`, 'info');
      return;
    }

    const toProcess = files.slice(0, remainingSlots);
    setCompressing(true);
    setFormError(null);

    try {
      const nextImages: string[] = [];
      for (const file of toProcess) {
        if (!isImageFile(file)) {
          throw new Error(`"${file.name}" is not a valid image file.`);
        }
        const base64 = await compressImageToBase64(file);
        nextImages.push(base64);
      }

      const combined = [...images, ...nextImages];
      const totalChars = combined.reduce((sum, img) => sum + img.length, 0);
      if (totalChars > MAX_DOCUMENT_IMAGE_BYTES) {
        throw new Error(
          'Selected photos exceed Firestore document size limit. Please remove a photo or use smaller images.'
        );
      }
      setImages(combined);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to process image.';
      setFormError(msg);
      showToast(msg, 'error');
    } finally {
      setCompressing(false);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== index));
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

    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();
    const parsedRent = Number(rentPrice);
    const trimmedGeneralLoc = generalLocation.trim();
    const trimmedExactAddress = exactAddress.trim();
    const formattedPhone = formatNigerianWhatsAppDigits(whatsappNumber);

    if (!trimmedTitle) {
      setFormError('Please enter a clear listing title.');
      return;
    }
    if (!trimmedDesc || trimmedDesc.length < 10) {
      setFormError('Please provide a description (at least 10 characters).');
      return;
    }
    if (!Number.isFinite(parsedRent) || parsedRent <= 0) {
      setFormError('Please enter a valid annual rent price in Naira.');
      return;
    }
    if (!trimmedGeneralLoc) {
      setFormError('Please enter a public general area (e.g., Near LASUED Gate).');
      return;
    }
    if (!trimmedExactAddress) {
      setFormError('Please enter the exact address for admin verification.');
      return;
    }
    if (images.length === 0) {
      setFormError('Please upload at least 1 photo of the accommodation.');
      return;
    }
    if (formattedPhone.length < 11) {
      setFormError('Please enter a valid WhatsApp phone number.');
      return;
    }

    const extraAmenities = customAmenities
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const mergedAmenities = Array.from(
      new Set([...selectedAmenities, ...extraAmenities])
    );

    submittingRef.current = true;
    setSubmitting(true);

    try {
      await createAccommodation({
        ownerId: user.uid,
        type,
        title: trimmedTitle,
        description: trimmedDesc,
        rentPrice: Math.round(parsedRent),
        generalLocation: trimmedGeneralLoc,
        exactAddress: trimmedExactAddress,
        amenities: mergedAmenities,
        images,
        whatsappNumber: formattedPhone,
        ownerSnapshot: {
          fullName:
            profile?.fullName || user.displayName || 'LASUEDPLUG Landlord',
          isVerified: Boolean(profile?.isVerified),
        },
      });

      showToast('Accommodation submitted for admin approval!', 'success');
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
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Accommodation</span>
        </Link>
      </div>

      <div className="space-y-1">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary-600">
          <Building2 className="w-4 h-4" />
          <span>Campus Housing</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          List Accommodation
        </h1>
        <p className="text-sm text-slate-600">
          Post a verified student room, self-contain, or shared flat around Epe.
        </p>
      </div>

      <Card hoverable={false}>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
          {formError && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm font-medium text-red-700"
            >
              {formError}
            </div>
          )}

          {/* Type & Rent */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="accommodation-type"
                className="block text-sm font-medium text-slate-700"
              >
                Accommodation Type
              </label>
              <select
                id="accommodation-type"
                value={type}
                onChange={(e) => setType(e.target.value as AccommodationType)}
                className="block w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
          />

          <div className="space-y-1.5">
            <label
              htmlFor="accommodation-description"
              className="block text-sm font-medium text-slate-700"
            >
              Description
            </label>
            <textarea
              id="accommodation-description"
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe room size, proximity to campus, compound environment, light/water situation, and inspection rules..."
              className="block w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
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
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Private — only visible to you and admins, never public.</span>
              </p>
            </div>
          </div>

          {/* Amenities */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">Amenities</p>
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
                        ? 'bg-primary-50 border-primary-300 text-primary-700'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                        checked
                          ? 'bg-primary-600 border-primary-600 text-white'
                          : 'border-slate-300 bg-white'
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

          {/* Images (Base64 Compression) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700">
                Photos (Up to {MAX_IMAGES})
              </label>
              <span className="text-xs text-slate-500">
                {images.length}/{MAX_IMAGES} added
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {images.map((imgUrl, idx) => (
                <div
                  key={`${imgUrl.slice(0, 20)}-${idx}`}
                  className="relative aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-100"
                >
                  <img
                    src={imgUrl}
                    alt={`Room preview ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    aria-label={`Remove photo ${idx + 1}`}
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-slate-900/75 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {images.length < MAX_IMAGES && (
                <button
                  type="button"
                  disabled={compressing}
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-[4/3] rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-primary-50/40 flex flex-col items-center justify-center gap-1.5 text-slate-500 hover:text-blue-600 transition-colors disabled:opacity-60"
                >
                  {compressing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <ImagePlus className="w-5 h-5" />
                  )}
                  <span className="text-xs font-medium">
                    {compressing ? 'Compressing...' : 'Add Photo'}
                  </span>
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => void handleImageSelect(e)}
              className="sr-only"
            />
          </div>

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
              disabled={submitting || compressing}
            >
              {submitting ? 'Submitting Listing...' : 'Submit Accommodation'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
