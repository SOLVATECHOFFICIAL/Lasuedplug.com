import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { collection, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ImagePlus,
  Loader2,
  MapPin,
  ShoppingBag,
  Sparkles,
  Store as StoreIcon,
  Tag,
  Truck,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { db } from '../../lib/firebase';
import {
  getCategoriesForAdType,
  getCategoryName,
  getSubcategoriesForCategory,
} from '../../lib/categories';
import { suggestCategory } from '../../lib/aiCategoryService';
import {
  compressImageToBase64,
  isImageFile,
} from '../../lib/imageUtils';
import { getUserStores } from '../../lib/storeService';
import { AdType, PriceType, ServiceLocation, Store } from '../../types';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';

const MAX_IMAGES = 4;

interface SelectedImageItem {
  id: string;
  file: File;
  previewUrl: string;
}

interface FormErrors {
  title?: string;
  description?: string;
  categoryId?: string;
  subcategory?: string;
  quantity?: string;
  price?: string;
  whatsappNumber?: string;
  locationName?: string;
}

const ITEM_PRICE_TYPE_OPTIONS = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'negotiable', label: 'Negotiable' },
  { value: 'contact', label: 'Contact for Price' },
] as const;

const SERVICE_LOCATION_OPTIONS: Array<{
  value: ServiceLocation;
  label: string;
  description: string;
}> = [
  {
    value: 'shop',
    label: 'Come to my shop',
    description: 'Students visit your campus shop, salon, or hostel spot.',
  },
  {
    value: 'mobile',
    label: 'I come to you (Mobile)',
    description: 'Home/hostel service around LASUED, LASU, and Epe.',
  },
  {
    value: 'online',
    label: 'Online / Delivery',
    description: 'Digital work, tutoring online, or pickup & delivery.',
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
  const [selectedImages, setSelectedImages] = useState<SelectedImageItem[]>([]);

  // Item specific
  const [quantity, setQuantity] = useState('1');
  const [priceType, setPriceType] = useState<PriceType>('fixed');
  const [priceAmount, setPriceAmount] = useState('');

  // Service specific
  const [serviceLocation, setServiceLocation] = useState<ServiceLocation>('shop');

  // Location & Contact
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [pinningLocation, setPinningLocation] = useState(false);
  const [locationPinnedMessage, setLocationPinnedMessage] = useState<string | null>(
    null
  );
  const [hasDelivery, setHasDelivery] = useState(false);

  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiSuggested, setAiSuggested] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatusText, setSubmitStatusText] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  // Cleanup image preview object URLs on unmount
  const previewUrlsRef = useRef<string[]>([]);
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

  const showItemPriceFields =
    adType === 'item' && (priceType === 'fixed' || priceType === 'negotiable');
  const isLandmarkRequired =
    adType === 'item' || serviceLocation === 'shop';

  const clearFieldError = (key: keyof FormErrors) => {
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
    clearFieldError('categoryId');
    clearFieldError('subcategory');
    clearFieldError('quantity');
    clearFieldError('price');
    clearFieldError('locationName');

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
      if (!locationName.trim() && matched.locationName) {
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

  const handleImageSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    const remainingSlots = MAX_IMAGES - selectedImages.length;
    if (remainingSlots <= 0) {
      showToast(`You can upload up to ${MAX_IMAGES} images.`, 'info');
      return;
    }

    const validImageFiles = files.filter((f) => isImageFile(f));
    if (validImageFiles.length < files.length) {
      showToast('Only image files are supported.', 'error');
    }

    const filesToAdd = validImageFiles.slice(0, remainingSlots);
    if (validImageFiles.length > remainingSlots) {
      showToast(`Maximum ${MAX_IMAGES} images allowed per listing.`, 'info');
    }

    const nextItems: SelectedImageItem[] = filesToAdd.map((file, idx) => ({
      id: `${Date.now()}-${idx}-${file.name}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setSelectedImages((prev) => [...prev, ...nextItems]);
  };

  const handleRemoveImage = (id: string) => {
    setSelectedImages((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
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

  const validateForm = (): FormErrors => {
    const errors: FormErrors = {};

    if (!title.trim() || title.trim().length < 3) {
      errors.title =
        adType === 'service'
          ? 'Please enter a descriptive service title (at least 3 characters).'
          : 'Please enter a descriptive item title (at least 3 characters).';
    }
    if (!description.trim() || description.trim().length < 10) {
      errors.description = 'Please enter a description (at least 10 characters).';
    }
    if (!categoryId) {
      errors.categoryId = 'Please select a category.';
    }
    if (!subcategory) {
      errors.subcategory = 'Please select a subcategory.';
    }

    if (adType === 'item') {
      const numericQuantity = Number(quantity);
      if (
        !quantity.trim() ||
        !Number.isFinite(numericQuantity) ||
        !Number.isInteger(numericQuantity) ||
        numericQuantity < 1
      ) {
        errors.quantity = 'Quantity in stock must be at least 1.';
      }

      if (showItemPriceFields) {
        const numericPrice = Number(priceAmount);
        if (!priceAmount.trim() || !Number.isFinite(numericPrice) || numericPrice <= 0) {
          errors.price = 'Please enter a valid price amount in Naira.';
        }
      }
    }

    const digits = whatsappNumber.replace(/[^\d]/g, '');
    if (!whatsappNumber.trim() || digits.length < 7) {
      errors.whatsappNumber = 'A valid WhatsApp number is required.';
    }

    if (isLandmarkRequired && !locationName.trim()) {
      errors.locationName =
        'Location landmark is required (e.g. Opposite LASUED Main Gate).';
    }

    return errors;
  };

  const persistListing = async (options?: {
    overrideCategoryId?: string;
    overrideSubcategory?: string;
    needsAiReview?: boolean;
    precompressedImages?: string[];
  }) => {
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
      let compressedImages = options?.precompressedImages;
      if (!compressedImages) {
        compressedImages = [];
        if (selectedImages.length > 0) {
          setSubmitStatusText(
            `Compressing ${selectedImages.length} ${
              selectedImages.length === 1 ? 'image' : 'images'
            }...`
          );
          compressedImages = await Promise.all(
            selectedImages.map((item) => compressImageToBase64(item.file))
          );
        }
      }

      setSubmitStatusText('Saving listing...');

      const finalCategoryId = options?.overrideCategoryId || categoryId;
      const finalSubcategory = options?.overrideSubcategory || subcategory;
      const trimmedLandmark = locationName.trim();
      const effectivePriceType: PriceType =
        adType === 'service' ? 'contact' : priceType;

      const payload: Record<string, unknown> = {
        sellerId: user.uid,
        adType,
        title: title.trim(),
        description: description.trim(),
        categoryId: finalCategoryId,
        subcategory: finalSubcategory,
        categoryName: getCategoryName(finalCategoryId),
        images: compressedImages,
        priceType: effectivePriceType,
        whatsappNumber: whatsappNumber.trim(),
        hasDelivery: adType === 'item' ? hasDelivery : serviceLocation === 'online',
        viewCount: 0,
        contactCount: 0,
        status: 'active',
        isApproved: false,
        isActive: true,
        needsAiReview: Boolean(options?.needsAiReview),
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

      if (adType === 'item') {
        payload.quantity = Math.max(1, Math.floor(Number(quantity)));
        if (showItemPriceFields) {
          payload.price = Number(priceAmount);
          payload.priceUnit = 'total';
        }
      } else {
        payload.serviceLocation = serviceLocation;
      }

      if (trimmedLandmark) {
        payload.locationName = trimmedLandmark;
        payload.landmark = trimmedLandmark;
      } else if (adType === 'service') {
        payload.locationName =
          serviceLocation === 'online' ? 'Online / Delivery' : 'We come to you';
      }

      if (typeof latitude === 'number' && typeof longitude === 'number') {
        payload.latitude = latitude;
        payload.longitude = longitude;
      }

      const totalImagesLength = compressedImages.reduce(
        (sum, img) => sum + img.length,
        0
      );
      if (totalImagesLength > 850_000) {
        throw new Error(
          'Selected photos are too large even after compression. Please select fewer or smaller photos.'
        );
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
            : err &&
                typeof err === 'object' &&
                'message' in err &&
                typeof (err as { message?: unknown }).message === 'string'
              ? String((err as { message: string }).message)
              : 'Failed to submit listing. Please try again.';

      if (code === 'permission-denied') {
        msg =
          'Permission denied while saving listing. Make sure you are signed in and Firestore rules are deployed.';
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
      setSubmitStatusText('');
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

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstError = Object.values(errors)[0];
      if (firstError) {
        showToast(firstError, 'error');
      }
      return;
    }

    await persistListing({
      needsAiReview: false,
    });
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
        {/* Step 1: Type Selector — Sell an Item (Product) vs Offer a Service */}
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

        {/* Section A: Details & Strict Split Categories */}
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
            {fieldErrors.description && (
              <p className="text-xs font-medium text-red-600" role="alert">
                {fieldErrors.description}
              </p>
            )}
          </div>

          {/* Category & Subcategory (strictly split by adType) */}
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

          {/* Photos */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="listing-images"
                className="block text-sm font-medium text-slate-700"
              >
                {adType === 'service' ? 'Portfolio / Work Photos' : 'Product Photos'}{' '}
                <span className="text-xs font-normal text-slate-500">
                  (Up to {MAX_IMAGES} images, auto-compressed)
                </span>
              </label>
              <span className="text-xs font-medium text-slate-500 tabular-nums">
                {selectedImages.length} / {MAX_IMAGES} selected
              </span>
            </div>

            <input
              ref={fileInputRef}
              id="listing-images"
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              className="hidden"
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {selectedImages.map((item, idx) => (
                <div
                  key={item.id}
                  className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 group"
                >
                  <img
                    src={item.previewUrl}
                    alt={`Selected preview ${idx + 1}`}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(item.id)}
                    aria-label={`Remove image ${idx + 1}`}
                    className="absolute top-1.5 right-1.5 p-1 rounded-full bg-slate-900/75 hover:bg-slate-900 text-white shadow-sm transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  {idx === 0 && (
                    <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded bg-slate-900/75 text-[10px] font-semibold text-white">
                      Cover
                    </span>
                  )}
                </div>
              ))}

              {selectedImages.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/40 flex flex-col items-center justify-center gap-1.5 text-slate-500 hover:text-blue-600 transition-colors p-3 text-center"
                >
                  <ImagePlus className="w-6 h-6" />
                  <span className="text-xs font-medium">Add Photo</span>
                </button>
              )}
            </div>
          </div>
        </Card>

        {/* Conditional Section: Item Pricing & Stock OR Service Pricing Info */}
        {adType === 'item' ? (
          <Card hoverable={false} className="space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                Pricing &amp; Stock
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

              <Select
                label="Price Type"
                name="priceType"
                options={[...ITEM_PRICE_TYPE_OPTIONS]}
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

              {showItemPriceFields && (
                <Input
                  label="Price Amount (₦)"
                  name="priceAmount"
                  type="number"
                  min={1}
                  step="any"
                  placeholder="e.g. 45000"
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
          </Card>
        ) : (
          <Card hoverable={false} className="space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                Service Pricing &amp; Mode
              </h2>
            </div>

            <div className="rounded-xl bg-blue-50/70 border border-blue-100 p-3.5 text-sm text-slate-700">
              <span className="font-semibold text-blue-800">
                Contact for Price:
              </span>{' '}
              Services automatically display &ldquo;Contact for Price&rdquo; so
              clients can discuss custom quotes directly on WhatsApp.
            </div>

            <fieldset className="space-y-2.5">
              <legend className="block text-sm font-medium text-slate-700">
                Where do you operate? <span className="text-red-500">*</span>
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {SERVICE_LOCATION_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start gap-2.5 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                      serviceLocation === option.value
                        ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="serviceLocation"
                      value={option.value}
                      checked={serviceLocation === option.value}
                      onChange={() => {
                        setServiceLocation(option.value);
                        clearFieldError('locationName');
                      }}
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
          </Card>
        )}

        {/* Location & Contact */}
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

          <Input
            label={
              isLandmarkRequired
                ? 'Location Landmark'
                : 'Base Area / Landmark (Optional)'
            }
            name="locationName"
            type="text"
            placeholder="e.g. Opposite LASUED Main Gate"
            value={locationName}
            onChange={(e) => {
              setLocationName(e.target.value);
              clearFieldError('locationName');
            }}
            error={fieldErrors.locationName}
            required={isLandmarkRequired}
          />

          {(adType === 'item' || serviceLocation !== 'online') && (
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
                    <span>📍 Pin My Current Location</span>
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
          )}

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
                I offer delivery
              </span>
            </label>
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
                <span>{submitStatusText || 'Submitting listing...'}</span>
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
