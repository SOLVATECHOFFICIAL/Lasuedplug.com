import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Clock,
  Loader2,
  MapPin,
  Store as StoreIcon,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  ALL_MARKETPLACE_CATEGORIES,
  getStoreSubcategoriesForCategory,
} from '../../lib/categories';
import { getUserAvatarUrl, resolveAccountType } from '../../lib/authHelpers';
import {
  formatOpeningHoursRange,
  StoreCreateValidationErrors,
  validateStoreCreateInput,
} from '../../lib/listingValidation';
import { createStore } from '../../lib/storeService';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { ImageUploadGrid } from '../../components/forms/ImageUploadGrid';
import { LocationPinField } from '../../components/forms/LocationPinField';

const STORE_CATEGORY_OPTIONS = [
  { value: 'General Campus Store', label: 'General Campus Store' },
  ...ALL_MARKETPLACE_CATEGORIES.map((cat) => ({
    value: cat.name,
    label: cat.name,
  })),
];

export function CreateStore() {
  const { user, profile, loading, isProfileComplete } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General Campus Store');
  const [subcategory, setSubcategory] = useState('');
  const [openingTimeStart, setOpeningTimeStart] = useState('08:00');
  const [openingTimeEnd, setOpeningTimeEnd] = useState('18:00');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [images, setImages] = useState<string[]>([]);

  const [fieldErrors, setFieldErrors] = useState<StoreCreateValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const phonePrefilledRef = useRef(false);
  const profileLocationPrefilledRef = useRef(false);
  const redirectedRef = useRef(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!loading && (!user || !isProfileComplete) && !redirectedRef.current) {
      redirectedRef.current = true;
      showToast('Please complete your profile to open a store.', 'info');
      navigate('/dashboard/profile', { replace: true });
    }
  }, [loading, user, isProfileComplete, navigate, showToast]);

  useEffect(() => {
    if (!phonePrefilledRef.current && profile?.phone) {
      setWhatsappNumber(profile.phone);
      phonePrefilledRef.current = true;
    }
  }, [profile?.phone]);

  useEffect(() => {
    if (
      !profileLocationPrefilledRef.current &&
      profile?.accountType === 'business' &&
      !profile.isOnlineOnly
    ) {
      profileLocationPrefilledRef.current = true;
      if (profile.shopAddress?.trim() && !locationName.trim()) {
        setLocationName(profile.shopAddress.trim());
      }
      if (
        typeof profile.latitude === 'number' &&
        typeof profile.longitude === 'number' &&
        latitude === undefined &&
        longitude === undefined
      ) {
        setLatitude(profile.latitude);
        setLongitude(profile.longitude);
      }
      if (profile.openingTimeStart?.trim()) {
        setOpeningTimeStart(profile.openingTimeStart.trim());
      }
      if (profile.openingTimeEnd?.trim()) {
        setOpeningTimeEnd(profile.openingTimeEnd.trim());
      }
    }
  }, [profile, locationName, latitude, longitude]);

  const subcategoryOptions = getStoreSubcategoriesForCategory(category);

  const clearFieldError = (key: keyof StoreCreateValidationErrors) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const formattedHoursPreview = formatOpeningHoursRange(
    openingTimeStart,
    openingTimeEnd
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setSubmitError(null);

    if (!user || !isProfileComplete) {
      showToast('Please complete your profile to open a store.', 'info');
      navigate('/dashboard/profile');
      return;
    }

    const errors = validateStoreCreateInput({
      name,
      description,
      category,
      subcategory,
      openingTimeStart,
      openingTimeEnd,
      imagesCount: images.length,
      whatsappNumber,
      locationName,
      latitude,
      longitude,
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstError = Object.values(errors)[0];
      if (firstError) showToast(firstError, 'error');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const totalImagesLength = images.reduce((sum, img) => sum + img.length, 0);
      if (totalImagesLength > 850_000) {
        throw new Error(
          'Selected photos exceed Firestore document limits. Please use fewer or smaller photos.'
        );
      }

      const ownerAvatar = getUserAvatarUrl(profile);
      await createStore({
        ownerId: user.uid,
        name: name.trim(),
        description: description.trim(),
        category: category.trim(),
        subcategory: subcategory.trim(),
        openingHours: formattedHoursPreview,
        openingTimeStart: openingTimeStart.trim(),
        openingTimeEnd: openingTimeEnd.trim(),
        images,
        logoUrl: images[0],
        locationType: 'physical',
        whatsappNumber: whatsappNumber.trim(),
        locationName: locationName.trim(),
        latitude: latitude as number,
        longitude: longitude as number,
        ownerSnapshot: {
          fullName: profile?.fullName || user.displayName || 'LASUEDPLUG Seller',
          isVerified: Boolean(profile?.isVerified),
          accountType: resolveAccountType(profile),
          ...(ownerAvatar &&
          totalImagesLength + ownerAvatar.length <= 850_000
            ? { profilePic: ownerAvatar }
            : {}),
        },
      });

      showToast(
        'Store submitted for admin approval! You can track it in your Seller Dashboard.',
        'success'
      );
      navigate('/dashboard/seller');
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Failed to create store. Please try again.';
      setSubmitError(msg);
      showToast(msg, 'error');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 pb-24 md:pb-12 space-y-6">
      <div className="space-y-2">
        <Link
          to="/dashboard/seller"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Seller Dashboard</span>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Open a Campus Store
        </h1>
        <p className="text-sm text-slate-600">
          Create a verified physical storefront profile on LASUEDPLUG. Stores require 1–4 photos, opening hours, and an exact GPS pin.
        </p>
      </div>

      {submitError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700"
        >
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{submitError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <Card hoverable={false} className="space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <StoreIcon className="w-4 h-4 text-primary-600" />
            <h2 className="text-base font-bold text-slate-900">
              Store Details
            </h2>
          </div>

          <Input
            label="Store Name"
            name="storeName"
            type="text"
            placeholder="e.g. TechHub Campus Store, Mama Kelechi Kitchen"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearFieldError('name');
            }}
            error={fieldErrors.name}
            helperText="Minimum 5 characters."
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Store Category"
              name="category"
              options={STORE_CATEGORY_OPTIONS}
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setSubcategory('');
                clearFieldError('category');
                clearFieldError('subcategory');
              }}
              error={fieldErrors.category}
              required
            />

            <Select
              label="Store Subcategory"
              name="subcategory"
              placeholder="Select subcategory"
              options={subcategoryOptions}
              value={subcategory}
              onChange={(e) => {
                setSubcategory(e.target.value);
                clearFieldError('subcategory');
              }}
              error={fieldErrors.subcategory}
              required
            />
          </div>

          {/* Opening Hours: Start & End Time Pickers */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <Clock className="w-4 h-4 text-slate-500" />
              <span>
                Opening Hours <span className="text-red-500">*</span>
              </span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="opening-time-start"
                  className="block text-xs font-medium text-slate-600"
                >
                  Opening Time
                </label>
                <input
                  id="opening-time-start"
                  type="time"
                  required
                  value={openingTimeStart}
                  onChange={(e) => {
                    setOpeningTimeStart(e.target.value);
                    clearFieldError('openingHours');
                  }}
                  className="block w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="opening-time-end"
                  className="block text-xs font-medium text-slate-600"
                >
                  Closing Time
                </label>
                <input
                  id="opening-time-end"
                  type="time"
                  required
                  value={openingTimeEnd}
                  onChange={(e) => {
                    setOpeningTimeEnd(e.target.value);
                    clearFieldError('openingHours');
                  }}
                  className="block w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            {formattedHoursPreview && !fieldErrors.openingHours && (
              <p className="text-xs font-medium text-slate-600">
                Displayed as: <span className="text-slate-900">{formattedHoursPreview}</span>
              </p>
            )}
            {fieldErrors.openingHours && (
              <p className="text-xs font-medium text-red-600" role="alert">
                {fieldErrors.openingHours}
              </p>
            )}
          </div>

          <div className="w-full space-y-1.5">
            <label
              htmlFor="store-description"
              className="block text-sm font-medium text-slate-700"
            >
              Description <span className="text-red-500 ml-0.5">*</span>
            </label>
            <textarea
              id="store-description"
              name="description"
              rows={4}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                clearFieldError('description');
              }}
              placeholder="Tell students what your store offers and what makes your shop unique..."
              className={`block w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border rounded-lg shadow-sm placeholder:text-slate-400 transition-all duration-200 focus:outline-none focus:ring-2 ${
                fieldErrors.description
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                  : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500'
              }`}
              required
            />
            {fieldErrors.description ? (
              <p className="text-xs font-medium text-red-600" role="alert">
                {fieldErrors.description}
              </p>
            ) : (
              <p className="text-xs text-slate-500">Minimum 5 characters.</p>
            )}
          </div>

          {/* Compulsory 1-4 Store Images */}
          <ImageUploadGrid
            images={images}
            onChange={(next) => {
              setImages(next);
              clearFieldError('images');
            }}
            label="Storefront / Brand Photos"
            helperText="First photo is used as your store logo cover."
            error={fieldErrors.images}
            inputId="store-images"
          />
        </Card>

        <Card hoverable={false} className="space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <MapPin className="w-4 h-4 text-primary-600" />
            <h2 className="text-base font-bold text-slate-900">
              Contact &amp; Physical Location
            </h2>
          </div>

          <Input
            label="WhatsApp Number"
            name="whatsappNumber"
            type="tel"
            placeholder="e.g. 08012345678"
            value={whatsappNumber}
            onChange={(e) => {
              setWhatsappNumber(e.target.value);
              clearFieldError('whatsappNumber');
            }}
            error={fieldErrors.whatsappNumber}
            required
          />

          <Input
            label="Physical Store Address"
            name="locationName"
            type="text"
            placeholder="e.g. Shop 4, Opposite LASUED Main Gate"
            value={locationName}
            onChange={(e) => {
              setLocationName(e.target.value);
              clearFieldError('locationName');
            }}
            error={fieldErrors.locationName}
            required
          />

          <LocationPinField
            latitude={latitude}
            longitude={longitude}
            onPin={({ latitude: lat, longitude: lng }) => {
              setLatitude(lat);
              setLongitude(lng);
              clearFieldError('gps');
            }}
            onClear={() => {
              setLatitude(undefined);
              setLongitude(undefined);
            }}
            helperText="All Campus Stores must have a pinned physical GPS location."
            error={fieldErrors.gps}
          />
        </Card>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
          <Link to="/dashboard/seller" className="sm:w-auto">
            <Button type="button" variant="outline" size="lg" fullWidth>
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={submitting}
            className="sm:min-w-[200px]"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Store...</span>
              </>
            ) : (
              <span>Create Store</span>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
