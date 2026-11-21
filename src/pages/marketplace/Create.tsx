import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { collection, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  AlertCircle,
  ArrowLeft,
  Globe,
  Loader2,
  MapPin,
  ShoppingBag,
  Sparkles,
  Store as StoreIcon,
  Tag,
  Truck,
  Wrench,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getUserAvatarUrl } from '../../lib/authHelpers';
import { db } from '../../lib/firebase';
import {
  getCategoriesForAdType,
  getCategoryName,
  getSubcategoriesForCategory,
} from '../../lib/categories';
import { suggestCategory } from '../../lib/aiCategoryService';
import {
  MarketplaceCreateValidationErrors,
  validateMarketplaceCreateInput,
} from '../../lib/listingValidation';
import { getUserStores } from '../../lib/storeService';
import { AdType, PriceType, ServiceLocation, Store } from '../../types';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { ImageUploadGrid } from '../../components/forms/ImageUploadGrid';
import { LocationPinField } from '../../components/forms/LocationPinField';

const PRICE_TYPE_OPTIONS = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'negotiable', label: 'Negotiable' },
  { value: 'contact', label: 'Contact for Price' },
] as const;

const NON_SHOP_SERVICE_MODES: Array<{
  value: ServiceLocation;
  label: string;
  description: string;
}> = [
  {
    value: 'online',
    label: 'Online / Delivery',
    description: 'Digital work, tutoring online, or remote delivery.',
  },
  {
    value: 'mobile',
    label: 'I come to you (Mobile)',
    description: 'Home or hostel service around LASUED, LASU, and Epe.',
  },
];

export function MarketplaceCreate() {
  const { user, profile, loading, isProfileComplete } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [adType, setAdType] = useState<AdType>(() =>
    searchParams.get('type') === 'service' ? 'service' : 'item'
  );
  const [userStores, setUserStores] = useState<Store[]>([]);
  const [storesLoaded, setStoresLoaded] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [images, setImages] = useState<string[]>([]);

  // Pricing & Stock
  const [quantity, setQuantity] = useState('1');
  const [priceType, setPriceType] = useState<PriceType>(() =>
    searchParams.get('type') === 'service' ? 'contact' : 'fixed'
  );
  const [priceAmount, setPriceAmount] = useState('');

  // Location & Service Shop Rule
  const [itemLocationType, setItemLocationType] = useState<'physical' | 'online'>(
    'physical'
  );
  const [hasPhysicalShop, setHasPhysicalShop] = useState(true);
  const [nonShopServiceMode, setNonShopServiceMode] =
    useState<ServiceLocation>('online');

  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [hasDelivery, setHasDelivery] = useState(false);

  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiSuggested, setAiSuggested] = useState(false);

  const [fieldErrors, setFieldErrors] =
    useState<MarketplaceCreateValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const lastAiQueryRef = useRef<string>('');
  const phonePrefilledRef = useRef(false);
  const redirectedRef = useRef(false);
  const submittingRef = useRef(false);

  // Defense-in-depth profile completeness guard
  useEffect(() => {
    if (!loading && (!user || !isProfileComplete) && !redirectedRef.current) {
      redirectedRef.current = true;
      showToast('Please complete your profile to post a listing.', 'info');
      navigate('/dashboard/profile', { replace: true });
    }
  }, [loading, user, isProfileComplete, navigate, showToast]);

  // Pre-fill WhatsApp number from profile phone once available
  useEffect(() => {
    if (!phonePrefilledRef.current && profile?.phone) {
      setWhatsappNumber(profile.phone);
      phonePrefilledRef.current = true;
    }
  }, [profile?.phone]);

  // Fetch user's stores to allow optional store linking
  useEffect(() => {
    let active = true;
    if (!user?.uid) {
      setUserStores([]);
      setStoresLoaded(true);
      return;
    }

    getUserStores(user.uid)
      .then((stores) => {
        if (active) {
          setUserStores(stores);
        }
      })
      .catch(() => {
        if (active) {
          setUserStores([]);
        }
      })
      .finally(() => {
        if (active) {
          setStoresLoaded(true);
        }
      });

    return () => {
      active = false;
    };
  }, [user?.uid]);

  const activeCategoryList = useMemo(
    () => getCategoriesForAdType(adType),
    [adType]
  );

  const categoryOptions = useMemo(
    () => activeCategoryList.map((cat) => ({ value: cat.id, label: cat.name })),
    [activeCategoryList]
  );

  const subcategoryOptions = useMemo(
    () => getSubcategoriesForCategory(categoryId),
    [categoryId]
  );

  const storeOptions = useMemo(
    () => [
      { value: '', label: 'Personal Listing (No Store)' },
      ...userStores
        .filter((s) => Boolean(s.id))
        .map((s) => ({
          value: s.id as string,
          label: s.name,
        })),
    ],
    [userStores]
  );

  const selectedStore = useMemo(
    () => userStores.find((s) => s.id === selectedStoreId),
    [userStores, selectedStoreId]
  );

  const effectiveLocationType: 'physical' | 'online' =
    adType === 'item'
      ? itemLocationType
      : hasPhysicalShop
        ? 'physical'
        : 'online';

  const effectiveServiceLocation: ServiceLocation = hasPhysicalShop
    ? 'shop'
    : nonShopServiceMode;

  const showPriceAmountField =
    priceType === 'fixed' || priceType === 'negotiable';

  const clearFieldError = (key: keyof MarketplaceCreateValidationErrors) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleAdTypeChange = (nextType: AdType) => {
    if (nextType === adType) return;
    setAdType(nextType);
    setCategoryId('');
    setSubcategory('');
    setAiSuggested(false);
    lastAiQueryRef.current = '';
    setFieldErrors({});

    if (nextType === 'service') {
      setPriceType('contact');
      setPriceAmount('');
    } else {
      setPriceType('fixed');
    }
  };

  const handleStoreChange = (nextStoreId: string) => {
    setSelectedStoreId(nextStoreId);
    const matched = userStores.find((s) => s.id === nextStoreId);
    if (matched) {
      if (effectiveLocationType === 'physical' && !locationName.trim() && matched.locationName) {
        setLocationName(matched.locationName);
        clearFieldError('locationName');
      }
      if (!whatsappNumber.trim() && matched.whatsappNumber) {
        setWhatsappNumber(matched.whatsappNumber);
        clearFieldError('whatsappNumber');
      }
    }
  };

  const handleCategoryChange = (nextCategoryId: string) => {
    setCategoryId(nextCategoryId);
    const nextSubs = getSubcategoriesForCategory(nextCategoryId);
    setSubcategory(nextSubs[0] || '');
    setAiSuggested(false);
    clearFieldError('categoryId');
    clearFieldError('subcategory');
  };

  const handleSwitchItemLocation = (nextType: 'physical' | 'online') => {
    setItemLocationType(nextType);
    clearFieldError('locationName');
    clearFieldError('gps');
    if (nextType === 'online') {
      setLatitude(undefined);
      setLongitude(undefined);
    }
  };

  const handleTogglePhysicalShop = (usesShop: boolean) => {
    setHasPhysicalShop(usesShop);
    clearFieldError('locationName');
    clearFieldError('gps');
    if (!usesShop) {
      setLatitude(undefined);
      setLongitude(undefined);
    }
  };

  const runAiCategorization = async () => {
    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();

    if (!trimmedTitle && !trimmedDesc) {
      return;
    }
    if (trimmedTitle.length < 2 && !trimmedDesc) {
      return;
    }

    const querySignature = `${adType}::${trimmedTitle}::${trimmedDesc}`;
    if (querySignature === lastAiQueryRef.current) {
      return;
    }
    lastAiQueryRef.current = querySignature;

    setAiSuggesting(true);

    try {
      const result = await suggestCategory(trimmedTitle, trimmedDesc, adType);
      if (result.suggestion && !result.isFallback) {
        setCategoryId(result.suggestion.categoryId);
        setSubcategory(result.suggestion.subcategory);
        setAiSuggested(true);
        clearFieldError('categoryId');
        clearFieldError('subcategory');
      } else if (result.suggestion && !categoryId) {
        setCategoryId(result.suggestion.categoryId);
        setSubcategory(result.suggestion.subcategory);
        setAiSuggested(false);
      }
    } finally {
      setAiSuggesting(false);
    }
  };

  const persistListing = async () => {
    if (submittingRef.current) {
      return;
    }
    if (!user || !isProfileComplete) {
      showToast('Please complete your profile to post a listing.', 'info');
      navigate('/dashboard/profile');
      return;
    }
    if (!db) {
      const msg = 'Firebase is not configured. Check .env.local.';
      setSubmitError(msg);
      showToast(msg, 'error');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const trimmedLandmark = locationName.trim();
      const totalImagesLength = images.reduce((sum, img) => sum + img.length, 0);
      if (totalImagesLength > 850_000) {
        throw new Error(
          'Selected photos are too large even after compression. Please select fewer or smaller photos.'
        );
      }

      const payload: Record<string, unknown> = {
        sellerId: user.uid,
        adType,
        title: title.trim(),
        description: description.trim(),
        categoryId,
        subcategory,
        categoryName: getCategoryName(categoryId),
        images,
        priceType,
        locationType: effectiveLocationType,
        whatsappNumber: whatsappNumber.trim(),
        hasDelivery:
          adType === 'item'
            ? effectiveLocationType === 'online' || hasDelivery
            : effectiveServiceLocation === 'online',
        viewCount: 0,
        contactCount: 0,
        status: 'active',
        isApproved: false,
        isActive: true,
        needsAiReview: false,
        createdAt: serverTimestamp(),
        sellerSnapshot: {
          fullName: profile?.fullName || user.displayName || 'LASUEDPLUG Seller',
          isVerified: Boolean(profile?.isVerified),
        },
      };

      if (selectedStore?.id && selectedStore.name) {
        payload.storeId = selectedStore.id;
        payload.storeName = selectedStore.name;
      }

      if (showPriceAmountField) {
        payload.price = Number(priceAmount);
        payload.priceUnit = 'total';
      }

      if (adType === 'item') {
        payload.quantity = Math.max(1, Math.floor(Number(quantity)));
      } else {
        payload.serviceLocation = effectiveServiceLocation;
      }

      if (effectiveLocationType === 'physical') {
        payload.locationName = trimmedLandmark;
        payload.landmark = trimmedLandmark;
        payload.latitude = latitude;
        payload.longitude = longitude;
      } else if (adType === 'service') {
        payload.locationName =
          effectiveServiceLocation === 'mobile'
            ? 'We come to you'
            : 'Online / Delivery';
      } else {
        payload.locationName = 'Online / Delivery';
      }

      const sellerAvatar = getUserAvatarUrl(profile);
      if (
        sellerAvatar &&
        totalImagesLength + sellerAvatar.length <= 850_000
      ) {
        payload.sellerSnapshot = {
          ...(payload.sellerSnapshot as Record<string, unknown>),
          profilePic: sellerAvatar,
        };
      }

      const productsCol = collection(db, 'products');
      const docRef = doc(productsCol);

      try {
        await setDoc(docRef, payload);
      } catch (writeErr) {
        const writeCode =
          writeErr && typeof writeErr === 'object' && 'code' in writeErr
            ? String((writeErr as { code?: unknown }).code || '')
            : '';

        if (writeCode === 'already-exists') {
          let alreadySavedByUs = false;
          try {
            const existingSnap = await getDoc(docRef);
            if (
              existingSnap.exists() &&
              existingSnap.data()?.sellerId === user.uid
            ) {
              alreadySavedByUs = true;
            }
          } catch {
            // Ignore lookup failure and fall back to a fresh document ID
          }

          if (!alreadySavedByUs) {
            const freshRef = doc(productsCol);
            await setDoc(freshRef, payload);
          }
        } else {
          throw writeErr;
        }
      }

      showToast(
        'Listing submitted! It will be visible once approved by an admin.',
        'success'
      );
      navigate('/dashboard/seller');
    } catch (err) {
      console.error('Create listing submission error:', err);
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: unknown }).code || '')
          : '';
      let msg =
        err instanceof Error
          ? err.message
          : typeof err === 'string' && err.trim()
            ? err
            : 'Failed to submit listing. Please try again.';

      if (code === 'permission-denied') {
        msg =
          'Permission denied while saving listing. Make sure all required fields, photos, and GPS pin rules are satisfied.';
      } else if (code === 'unauthenticated') {
        msg = 'Your session expired. Please sign in again to post a listing.';
      } else if (code === 'already-exists') {
        msg =
          'This listing appears to have already been submitted. Check your Seller Dashboard to confirm.';
      } else if (code === 'resource-exhausted' || code === 'invalid-argument') {
        msg =
          'Listing data or photos exceed Firestore limits. Try fewer or smaller photos.';
      }

      setSubmitError(msg);
      showToast(msg, 'error');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) {
      return;
    }
    setSubmitError(null);

    if (!user || !isProfileComplete) {
      showToast('Please complete your profile to post a listing.', 'info');
      navigate('/dashboard/profile');
      return;
    }

    if (!db) {
      const msg = 'Firebase is not configured. Check .env.local.';
      setSubmitError(msg);
      showToast(msg, 'error');
      return;
    }

    const errors = validateMarketplaceCreateInput({
      adType,
      title,
      description,
      categoryId,
      subcategory,
      imagesCount: images.length,
      quantity,
      priceType,
      priceAmount,
      locationType: effectiveLocationType,
      serviceLocation:
        adType === 'service' ? effectiveServiceLocation : undefined,
      locationName,
      latitude,
      longitude,
      whatsappNumber,
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstError = Object.values(errors)[0];
      if (firstError) {
        showToast(firstError, 'error');
      }
      return;
    }

    await persistListing();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 pb-24 md:pb-12 space-y-6">
      <div className="space-y-2">
        <Link
          to="/marketplace"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Marketplace</span>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Post a Listing
        </h1>
        <p className="text-sm text-slate-600">
          List an item for sale or offer a campus service to LASUED, LASU, and Epe
          students. New listings are reviewed quickly before going live.
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
        {/* Step 1: Type Selector */}
        <Card hoverable={false} className="space-y-3">
          <p className="text-sm font-semibold text-slate-900">
            What are you posting?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleAdTypeChange('item')}
              aria-pressed={adType === 'item'}
              className={`flex items-center gap-3.5 p-4 rounded-xl border text-left transition-all ${
                adType === 'item'
                  ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/30 shadow-sm'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                  adType === 'item'
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <span className="block text-base font-bold text-slate-900">
                  Sell an Item (Product)
                </span>
                <span className="block text-xs text-slate-500">
                  Electronics, fashion, books, hostel essentials, or food.
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleAdTypeChange('service')}
              aria-pressed={adType === 'service'}
              className={`flex items-center gap-3.5 p-4 rounded-xl border text-left transition-all ${
                adType === 'service'
                  ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/30 shadow-sm'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                  adType === 'service'
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Wrench className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <span className="block text-base font-bold text-slate-900">
                  Offer a Service
                </span>
                <span className="block text-xs text-slate-500">
                  Repairs, beauty &amp; grooming, cyber, tutoring, or laundry.
                </span>
              </div>
            </button>
          </div>
        </Card>

        {/* Optional Store Link */}
        {storesLoaded && (
          <Card hoverable={false} className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <StoreIcon className="w-4 h-4 text-primary-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  Store Connection (Optional)
                </h2>
              </div>
              <Link
                to="/store/create"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
              >
                {userStores.length > 0 ? '+ Open Another Store' : '+ Open a Store'}
              </Link>
            </div>

            {userStores.length > 0 ? (
              <Select
                label="Attach this listing to my Store (Optional)"
                name="storeId"
                options={storeOptions}
                value={selectedStoreId}
                onChange={(e) => handleStoreChange(e.target.value)}
                helperText="Linking a store displays your storefront name on this listing."
              />
            ) : (
              <p className="text-xs text-slate-500">
                Selling regularly on campus?{' '}
                <Link
                  to="/store/create"
                  className="font-semibold text-blue-600 hover:underline"
                >
                  Create a Store profile
                </Link>{' '}
                to group your items and services under one brand.
              </p>
            )}
          </Card>
        )}

        {/* Section A: Details, Categories, and Compulsory Images */}
        <Card hoverable={false} className="space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Tag className="w-4 h-4 text-primary-600" />
            <h2 className="text-base font-bold text-slate-900">
              {adType === 'service' ? 'Service Details' : 'Item Details'}
            </h2>
          </div>

          <Input
            label="Title"
            name="title"
            type="text"
            placeholder={
              adType === 'service'
                ? 'e.g. Fast Hair Braiding, Phone Screen Repair, MTH 101 Tutoring'
                : 'e.g. HP Laptop Core i5, Nike Sneakers, Calculus Textbook'
            }
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              clearFieldError('title');
            }}
            onBlur={() => void runAiCategorization()}
            error={fieldErrors.title}
            helperText="Minimum 5 characters."
            required
          />

          <div className="w-full space-y-1.5">
            <label
              htmlFor="listing-description"
              className="block text-sm font-medium text-slate-700"
            >
              Description
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            <textarea
              id="listing-description"
              name="description"
              rows={4}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                clearFieldError('description');
              }}
              onBlur={() => void runAiCategorization()}
              placeholder={
                adType === 'service'
                  ? 'Describe your service experience, turnaround time, availability, and what is included...'
                  : 'Describe condition, specs, size, defects, or what is included...'
              }
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

          {/* Category & Subcategory */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Category"
                name="categoryId"
                placeholder={
                  adType === 'service'
                    ? 'Select a service category'
                    : 'Select an item category'
                }
                options={categoryOptions}
                value={categoryId}
                onChange={(e) => handleCategoryChange(e.target.value)}
                error={fieldErrors.categoryId}
                required
              />

              <Select
                label="Subcategory"
                name="subcategory"
                placeholder={
                  categoryId ? 'Select a subcategory' : 'Choose category first'
                }
                options={subcategoryOptions}
                value={subcategory}
                disabled={!categoryId}
                onChange={(e) => {
                  setSubcategory(e.target.value);
                  setAiSuggested(false);
                  clearFieldError('subcategory');
                }}
                error={fieldErrors.subcategory}
                required
              />
            </div>

            {aiSuggesting && (
              <p
                role="status"
                className="text-xs font-medium text-primary-600 inline-flex items-center gap-1.5"
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>
                  Matching best {adType === 'service' ? 'service' : 'product'}{' '}
                  category...
                </span>
              </p>
            )}

            {!aiSuggesting && aiSuggested && (
              <p
                role="status"
                className="text-xs font-medium text-primary-600 inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>Suggested category based on your title.</span>
              </p>
            )}
          </div>

          {/* Compulsory Photos (1-4, Base64 compressed) */}
          <ImageUploadGrid
            images={images}
            onChange={(next) => {
              setImages(next);
              clearFieldError('images');
            }}
            label={adType === 'service' ? 'Portfolio / Work Photos' : 'Product Photos'}
            error={fieldErrors.images}
            inputId="listing-images"
          />
        </Card>

        {/* Section B: Pricing & Stock (or Service Pricing & Shop Rule) */}
        <Card hoverable={false} className="space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">
              {adType === 'item'
                ? 'Pricing & Stock'
                : 'Service Pricing & Operation Mode'}
            </h2>
          </div>

          <div
            className={`grid grid-cols-1 ${
              adType === 'item' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
            } gap-4`}
          >
            {adType === 'item' && (
              <Input
                label="Quantity in Stock"
                name="quantity"
                type="number"
                min={1}
                step={1}
                placeholder="1"
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  clearFieldError('quantity');
                }}
                error={fieldErrors.quantity}
                required
              />
            )}

            <Select
              label="Price Type"
              name="priceType"
              options={[...PRICE_TYPE_OPTIONS]}
              value={priceType}
              onChange={(e) => {
                const next = e.target.value as PriceType;
                setPriceType(next);
                if (next === 'contact') {
                  clearFieldError('price');
                }
              }}
              required
            />

            {showPriceAmountField && (
              <Input
                label="Price Amount (₦)"
                name="priceAmount"
                type="number"
                min={1}
                step="any"
                placeholder={adType === 'service' ? 'e.g. 5000' : 'e.g. 45000'}
                value={priceAmount}
                onChange={(e) => {
                  setPriceAmount(e.target.value);
                  clearFieldError('price');
                }}
                error={fieldErrors.price}
                required
              />
            )}
          </div>

          {adType === 'service' && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">
                  Do you operate from a physical shop?{' '}
                  <span className="text-red-500">*</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    aria-pressed={hasPhysicalShop}
                    onClick={() => handleTogglePhysicalShop(true)}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-semibold transition-all ${
                      hasPhysicalShop
                        ? 'border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-500'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <MapPin className="w-4 h-4 shrink-0" />
                    <span>Yes, Physical Shop</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={!hasPhysicalShop}
                    onClick={() => handleTogglePhysicalShop(false)}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-semibold transition-all ${
                      !hasPhysicalShop
                        ? 'border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-500'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Globe className="w-4 h-4 shrink-0" />
                    <span>No (Online / I come to you)</span>
                  </button>
                </div>
              </div>

              {!hasPhysicalShop && (
                <fieldset className="space-y-2">
                  <legend className="block text-xs font-medium text-slate-600">
                    How do you deliver your service?
                  </legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {NON_SHOP_SERVICE_MODES.map((option) => (
                      <label
                        key={option.value}
                        className={`flex items-start gap-2.5 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                          nonShopServiceMode === option.value
                            ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="nonShopServiceMode"
                          value={option.value}
                          checked={nonShopServiceMode === option.value}
                          onChange={() => setNonShopServiceMode(option.value)}
                          className="mt-0.5 w-4 h-4 text-primary-600 border-slate-300 focus:ring-blue-500"
                        />
                        <div className="space-y-0.5">
                          <span className="block text-sm font-semibold text-slate-900">
                            {option.label}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {option.description}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
            </div>
          )}
        </Card>

        {/* Section C: Location & Contact */}
        <Card hoverable={false} className="space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <MapPin className="w-4 h-4 text-primary-600" />
            <h2 className="text-base font-bold text-slate-900">
              Location &amp; Contact
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
            helperText="Buyers will message this number directly on WhatsApp."
            required
          />

          {adType === 'item' && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">
                Item Pickup / Fulfillment Location{' '}
                <span className="text-red-500">*</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  aria-pressed={itemLocationType === 'physical'}
                  onClick={() => handleSwitchItemLocation('physical')}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                    itemLocationType === 'physical'
                      ? 'border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-500'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <MapPin className="w-4 h-4 shrink-0" />
                  <div>
                    <span className="block text-sm font-semibold">
                      Physical Location
                    </span>
                    <span className="block text-xs opacity-80">
                      Address &amp; exact GPS pin required.
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  aria-pressed={itemLocationType === 'online'}
                  onClick={() => handleSwitchItemLocation('online')}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                    itemLocationType === 'online'
                      ? 'border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-500'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Truck className="w-4 h-4 shrink-0" />
                  <div>
                    <span className="block text-sm font-semibold">
                      Online / Delivery Only
                    </span>
                    <span className="block text-xs opacity-80">
                      No physical address or GPS required.
                    </span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {effectiveLocationType === 'physical' ? (
            <div className="space-y-4 pt-1">
              <Input
                label={
                  adType === 'service'
                    ? 'Shop Address / Landmark'
                    : 'Physical Address / Landmark'
                }
                name="locationName"
                type="text"
                placeholder={
                  adType === 'service'
                    ? 'e.g. Shop 3, Opp. LASUED Main Gate'
                    : 'e.g. Faculty of Science Block or Epe Gate'
                }
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
                error={fieldErrors.gps}
              />

              {adType === 'item' && (
                <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 cursor-pointer hover:bg-slate-100/70 transition-colors">
                  <input
                    type="checkbox"
                    checked={hasDelivery}
                    onChange={(e) => setHasDelivery(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-blue-500"
                  />
                  <Truck className="w-4 h-4 text-slate-600 shrink-0" />
                  <span className="text-sm font-medium text-slate-800">
                    I also offer delivery
                  </span>
                </label>
              )}
            </div>
          ) : (
            <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-3.5 text-xs text-emerald-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                {adType === 'item'
                  ? 'Listed as Online / Delivery Only — physical address and GPS pin are not required.'
                  : effectiveServiceLocation === 'mobile'
                    ? 'Listed as Mobile Service (I come to you) — shop address and GPS pin are hidden.'
                    : 'Listed as Online / Delivery Service — shop address and GPS pin are hidden.'}
              </span>
            </div>
          )}
        </Card>

        {/* Submit */}
        <div className="pt-1">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Saving listing...</span>
              </>
            ) : (
              <span>
                {adType === 'service' ? 'Submit Service' : 'Submit Item'}
              </span>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
