import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ImagePlus,
  Loader2,
  MapPin,
  Store as StoreIcon,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { ALL_MARKETPLACE_CATEGORIES } from '../../lib/categories';
import { compressImageToBase64, isImageFile } from '../../lib/imageUtils';
import { createStore } from '../../lib/storeService';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';

interface StoreFormErrors {
  name?: string;
  description?: string;
  category?: string;
  whatsappNumber?: string;
  locationName?: string;
}

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
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);

  const [pinningLocation, setPinningLocation] = useState(false);
  const [locationPinnedMessage, setLocationPinnedMessage] = useState<string | null>(
    null
  );
  const [fieldErrors, setFieldErrors] = useState<StoreFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const phonePrefilledRef = useRef(false);
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
    return () => {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl]);

  const clearFieldError = (key: keyof StoreFormErrors) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleLogoSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!isImageFile(file)) {
      showToast('Please select a valid image file for your store logo.', 'error');
      return;
    }

    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }

    setLogoFile(file);
    setLogoPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveLogo = () => {
    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }
    setLogoFile(null);
    setLogoPreviewUrl(null);
  };

  const handlePinLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      showToast('Geolocation is not supported by your browser.', 'error');
      return;
    }

    setPinningLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setLocationPinnedMessage('Location pinned successfully!');
        showToast('Location pinned successfully!', 'success');
        setPinningLocation(false);
      },
      (geoErr) => {
        const msg =
          geoErr.code === geoErr.PERMISSION_DENIED
            ? 'Location permission denied. Please allow location access or enter your landmark manually.'
            : 'Unable to get your current GPS location right now.';
        showToast(msg, 'error');
        setPinningLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  const validateForm = (): StoreFormErrors => {
    const errors: StoreFormErrors = {};
    if (!name.trim() || name.trim().length < 2) {
      errors.name = 'Store name must be at least 2 characters.';
    }
    if (!description.trim() || description.trim().length < 10) {
      errors.description = 'Please describe your store (at least 10 characters).';
    }
    if (!category.trim()) {
      errors.category = 'Please choose a primary store category.';
    }
    const digits = whatsappNumber.replace(/[^\d]/g, '');
    if (!whatsappNumber.trim() || digits.length < 7) {
      errors.whatsappNumber = 'A valid WhatsApp number is required.';
    }
    if (!locationName.trim()) {
      errors.locationName = 'Location landmark is required (e.g. LASUED Main Gate).';
    }
    return errors;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setSubmitError(null);

    if (!user || !isProfileComplete) {
      showToast('Please complete your profile to open a store.', 'info');
      navigate('/dashboard/profile');
      return;
    }

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstError = Object.values(errors)[0];
      if (firstError) showToast(firstError, 'error');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      let logoUrl: string | undefined;
      if (logoFile) {
        logoUrl = await compressImageToBase64(logoFile);
      }

      await createStore({
        ownerId: user.uid,
        name: name.trim(),
        description: description.trim(),
        category: category.trim(),
        ...(logoUrl ? { logoUrl } : {}),
        whatsappNumber: whatsappNumber.trim(),
        locationName: locationName.trim(),
        ...(typeof latitude === 'number' && typeof longitude === 'number'
          ? { latitude, longitude }
          : {}),
        ownerSnapshot: {
          fullName: profile?.fullName || user.displayName || 'LASUEDPLUG Seller',
          isVerified: Boolean(profile?.isVerified),
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
          Create a storefront profile so you can link your products and services under one brand on LASUEDPLUG. New stores appear publicly once approved by an Admin.
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
            required
          />

          <Select
            label="Store Category"
            name="category"
            options={STORE_CATEGORY_OPTIONS}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              clearFieldError('category');
            }}
            error={fieldErrors.category}
            required
          />

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
              placeholder="Tell students what your store offers, opening hours, and delivery options..."
              className={`block w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border rounded-lg shadow-sm placeholder:text-slate-400 transition-all duration-200 focus:outline-none focus:ring-2 ${
                fieldErrors.description
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                  : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500'
              }`}
              required
            />
            {fieldErrors.description && (
              <p className="text-xs font-medium text-red-600" role="alert">
                {fieldErrors.description}
              </p>
            )}
          </div>

          {/* Optional Store Logo */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Store Logo{' '}
              <span className="text-xs font-normal text-slate-500">
                (Optional, auto-compressed)
              </span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoSelect}
              className="hidden"
            />
            {logoPreviewUrl ? (
              <div className="relative w-28 h-28 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                <img
                  src={logoPreviewUrl}
                  alt="Store logo preview"
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  aria-label="Remove store logo"
                  className="absolute top-1.5 right-1.5 p-1 rounded-full bg-slate-900/75 hover:bg-slate-900 text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-28 h-28 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/40 flex flex-col items-center justify-center gap-1.5 text-slate-500 hover:text-blue-600 transition-colors p-3 text-center"
              >
                <ImagePlus className="w-6 h-6" />
                <span className="text-xs font-medium">Add Logo</span>
              </button>
            )}
          </div>
        </Card>

        <Card hoverable={false} className="space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <MapPin className="w-4 h-4 text-primary-600" />
            <h2 className="text-base font-bold text-slate-900">
              Contact &amp; Location
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
            label="Location Landmark"
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

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handlePinLocation}
                disabled={pinningLocation}
              >
                {pinningLocation ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Pinning GPS location...</span>
                  </>
                ) : (
                  <span>📍 Pin My Location</span>
                )}
              </Button>

              {typeof latitude === 'number' && typeof longitude === 'number' && (
                <span className="text-xs font-medium text-slate-600 tabular-nums">
                  GPS: {latitude.toFixed(5)}, {longitude.toFixed(5)}
                </span>
              )}
            </div>

            {locationPinnedMessage && (
              <p
                role="status"
                className="text-xs font-medium text-emerald-700 inline-flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{locationPinnedMessage}</span>
              </p>
            )}
          </div>
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
