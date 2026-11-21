import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Globe,
  Loader2,
  MapPin,
  PackageOpen,
  ShieldAlert,
  Truck,
} from 'lucide-react';
import { getProductById } from '../../lib/marketplaceService';
import { updateSellerListing } from '../../lib/sellerService';
import { parseOpeningHoursRange } from '../../lib/authHelpers';
import {
  getCategoriesForAdType,
  getCategoryName,
  getSubcategoriesForCategory,
} from '../../lib/categories';
import { getListingAdType } from '../../lib/marketplaceHelpers';
import { getFastCache, invalidateFastCache, invalidateFastCachePrefix } from '../../lib/fastCache';
import {
  formatOpeningHoursRange,
  MarketplaceCreateValidationErrors,
  validateMarketplaceCreateInput,
} from '../../lib/listingValidation';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { PriceType, Product, ServiceLocation } from '../../types';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Loading } from '../../components/feedback/Loading';
import { ErrorState } from '../../components/feedback/ErrorState';
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
}> = [
  { value: 'online', label: 'Online / Delivery' },
  { value: 'mobile', label: 'I come to you (Mobile)' },
];

export function MarketplaceEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [listing, setListing] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [priceType, setPriceType] = useState<PriceType>('fixed');
  const [priceAmount, setPriceAmount] = useState('');
  const [quantity, setQuantity] = useState('1');

  const [itemLocationType, setItemLocationType] = useState<'physical' | 'online'>(
    'physical'
  );
  const [hasPhysicalShop, setHasPhysicalShop] = useState(true);
  const [nonShopServiceMode, setNonShopServiceMode] =
    useState<ServiceLocation>('online');

  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [openingTimeStart, setOpeningTimeStart] = useState('08:00');
  const [openingTimeEnd, setOpeningTimeEnd] = useState('18:00');
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [hasDelivery, setHasDelivery] = useState(false);

  const [fieldErrors, setFieldErrors] =
    useState<MarketplaceCreateValidationErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submittingRef = useRef(false);

  const loadListing = useCallback(async () => {
    if (!id) {
      setListing(null);
      setLoading(false);
      return;
    }

    const cached = getFastCache<Product>(`product:${id}`);
    if (!cached) {
      setLoading(true);
    }
    setLoadError(null);
    try {
      const record = await getProductById(id);
      setListing(record);
      if (record && id) {
        invalidateFastCache(`product:${id}`);
        invalidateFastCachePrefix('home_');
        invalidateFastCachePrefix('mkt_');
      }
      if (record) {
        const recordAdType = getListingAdType(record);
        setTitle(record.title || '');
        setDescription(record.description || '');
        setCategoryId(record.categoryId || '');
        setSubcategory(record.subcategory || '');
        setImages(Array.isArray(record.images) ? record.images : []);
        setPriceType(record.priceType || (recordAdType === 'service' ? 'contact' : 'fixed'));
        setPriceAmount(
          typeof record.price === 'number' && Number.isFinite(record.price)
            ? String(record.price)
            : ''
        );
        setQuantity(
          typeof record.quantity === 'number' && Number.isFinite(record.quantity)
            ? String(Math.max(0, record.quantity))
            : '1'
        );

        const inferredLocationType: 'physical' | 'online' =
          record.locationType === 'online' ||
          (recordAdType === 'service' &&
            record.serviceLocation &&
            record.serviceLocation !== 'shop')
            ? 'online'
            : 'physical';
        setItemLocationType(inferredLocationType);

        if (recordAdType === 'service') {
          const isShop = (record.serviceLocation || 'shop') === 'shop';
          setHasPhysicalShop(isShop);
          if (!isShop && record.serviceLocation) {
            setNonShopServiceMode(record.serviceLocation);
          }
          const parsedTimes = parseOpeningHoursRange(record.openingHours);
          setOpeningTimeStart(
            record.openingTimeStart || parsedTimes.start || '08:00'
          );
          setOpeningTimeEnd(
            record.openingTimeEnd || parsedTimes.end || '18:00'
          );
        }

        setWhatsappNumber(record.whatsappNumber || '');
        const existingLocName =
          record.locationName || record.landmark || record.location || '';
        setLocationName(
          inferredLocationType === 'online' &&
            (existingLocName === 'Online / Delivery' ||
              existingLocName === 'We come to you')
            ? ''
            : existingLocName
        );
        setLatitude(
          typeof record.latitude === 'number' ? record.latitude : undefined
        );
        setLongitude(
          typeof record.longitude === 'number' ? record.longitude : undefined
        );
        setHasDelivery(Boolean(record.hasDelivery));
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to load listing for editing.';
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadListing();
  }, [loadListing]);

  const adType = useMemo(
    () => (listing ? getListingAdType(listing) : 'item'),
    [listing]
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

  const categoryOptions = useMemo(
    () =>
      getCategoriesForAdType(adType).map((cat) => ({
        value: cat.id,
        label: cat.name,
      })),
    [adType]
  );

  const subcategoryOptions = useMemo(
    () => getSubcategoriesForCategory(categoryId),
    [categoryId]
  );

  const clearFieldError = (key: keyof MarketplaceCreateValidationErrors) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleCategoryChange = (nextCategoryId: string) => {
    setCategoryId(nextCategoryId);
    const nextSubs = getSubcategoriesForCategory(nextCategoryId);
    setSubcategory(nextSubs[0] || '');
    clearFieldError('categoryId');
    clearFieldError('subcategory');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || !listing?.id || !user?.uid) return;
    setFormError(null);

    const errors = validateMarketplaceCreateInput({
      adType,
      title,
      description,
      categoryId,
      subcategory,
      imagesCount: images.length,
      quantity,
      requireStockQuantity: false,
      priceType,
      priceAmount,
      locationType: effectiveLocationType,
      serviceLocation:
        adType === 'service' ? effectiveServiceLocation : undefined,
      openingTimeStart:
        adType === 'service' && effectiveLocationType === 'physical'
          ? openingTimeStart
          : undefined,
      openingTimeEnd:
        adType === 'service' && effectiveLocationType === 'physical'
          ? openingTimeEnd
          : undefined,
      locationName,
      latitude,
      longitude,
      whatsappNumber,
    });

    let parsedQuantity: number | undefined;
    if (adType === 'item') {
      const numericQty = Number(quantity);
      if (!quantity.trim() || !Number.isFinite(numericQty) || numericQty < 0) {
        errors.quantity = 'Please enter a valid stock quantity (0 or more).';
      } else {
        parsedQuantity = Math.floor(numericQty);
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstError = Object.values(errors)[0];
      if (firstError) {
        setFormError(firstError);
        showToast(firstError, 'error');
      }
      return;
    }

    const parsedPrice =
      priceType === 'fixed' || priceType === 'negotiable'
        ? Number(priceAmount)
        : undefined;

    submittingRef.current = true;
    setSubmitting(true);

    try {
      await updateSellerListing(listing.id, {
        adType,
        title: title.trim(),
        description: description.trim(),
        categoryId,
        subcategory,
        categoryName: getCategoryName(categoryId) || listing.categoryName || categoryId,
        images,
        priceType,
        price: parsedPrice,
        priceUnit: listing.priceUnit || 'total',
        quantity: parsedQuantity,
        serviceLocation:
          adType === 'service' ? effectiveServiceLocation : undefined,
        openingHours:
          adType === 'service' && effectiveLocationType === 'physical'
            ? formatOpeningHoursRange(openingTimeStart, openingTimeEnd)
            : undefined,
        openingTimeStart:
          adType === 'service' && effectiveLocationType === 'physical'
            ? openingTimeStart.trim()
            : undefined,
        openingTimeEnd:
          adType === 'service' && effectiveLocationType === 'physical'
            ? openingTimeEnd.trim()
            : undefined,
        locationType: effectiveLocationType,
        latitude: effectiveLocationType === 'physical' ? latitude : undefined,
        longitude: effectiveLocationType === 'physical' ? longitude : undefined,
        whatsappNumber: whatsappNumber.trim(),
        locationName:
          effectiveLocationType === 'physical' ? locationName.trim() : undefined,
        hasDelivery:
          adType === 'item'
            ? effectiveLocationType === 'online' || hasDelivery
            : effectiveServiceLocation === 'online',
      });

      showToast(
        'Listing updated! It is now hidden pending Admin re-approval.',
        'success'
      );
      navigate('/dashboard/seller');
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to update listing. Please try again.';
      setFormError(msg);
      showToast(msg, 'error');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Loading variant="skeleton" message="Loading listing details..." />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <ErrorState message={loadError} onRetry={() => void loadListing()} />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="max-w-md mx-auto px-4 sm:px-6 py-12">
        <Card hoverable={false} className="border-dashed text-center py-10 space-y-4">
          <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
            <PackageOpen className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-slate-900">Listing not found</h1>
            <p className="text-sm text-slate-500">
              This listing may have been deleted or does not exist.
            </p>
          </div>
          <Link to="/dashboard/seller">
            <Button variant="primary" size="sm">
              Back to Seller Dashboard
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (user?.uid && listing.sellerId !== user.uid) {
    return (
      <div className="max-w-md mx-auto px-4 sm:px-6 py-12">
        <Card hoverable={false} className="border-red-200 text-center py-10 space-y-4">
          <div className="w-12 h-12 mx-auto rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-slate-900">Access Denied</h1>
            <p className="text-sm text-slate-600">
              You can only edit listings created by your account.
            </p>
          </div>
          <Link to="/dashboard/seller">
            <Button variant="primary" size="sm">
              Back to Seller Dashboard
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const showPriceField = priceType === 'fixed' || priceType === 'negotiable';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-24 md:pb-12 space-y-6">
      <div>
        <Link
          to="/dashboard/seller"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Seller Dashboard</span>
        </Link>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Edit Listing
        </h1>
        <p className="text-sm text-slate-600">
          Update details for &ldquo;{listing.title}&rdquo;.
        </p>
      </div>

      {/* Bold Red Security Warning Banner */}
      <div
        role="alert"
        className="p-4 rounded-xl bg-red-50 border-2 border-red-300 flex items-start gap-3 text-red-800 shadow-sm"
      >
        <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
        <p className="text-sm font-bold leading-relaxed">
          ⚠️ WARNING: Editing this listing will hide it from the public marketplace
          until an Admin re-approves it. Please ensure all details are correct before
          saving.
        </p>
      </div>

      <Card hoverable={false}>
        <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-6">
          {formError && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm font-medium text-red-700"
            >
              {formError}
            </div>
          )}

          <Input
            label="Title"
            required
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              clearFieldError('title');
            }}
            error={fieldErrors.title}
            placeholder="Listing title"
          />

          <div className="space-y-1.5">
            <label
              htmlFor="edit-description"
              className="block text-sm font-medium text-slate-700"
            >
              Description <span className="text-red-500 ml-0.5">*</span>
            </label>
            <textarea
              id="edit-description"
              required
              rows={4}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                clearFieldError('description');
              }}
              className={`block w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border rounded-lg shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                fieldErrors.description
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                  : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500'
              }`}
            />
            {fieldErrors.description && (
              <p className="text-xs font-medium text-red-600" role="alert">
                {fieldErrors.description}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Category"
              name="categoryId"
              options={categoryOptions}
              value={categoryId}
              onChange={(e) => handleCategoryChange(e.target.value)}
              error={fieldErrors.categoryId}
              required
            />
            <Select
              label="Subcategory"
              name="subcategory"
              options={subcategoryOptions}
              value={subcategory}
              disabled={!categoryId}
              onChange={(e) => {
                setSubcategory(e.target.value);
                clearFieldError('subcategory');
              }}
              error={fieldErrors.subcategory}
              required
            />
          </div>

          {/* Pricing & Mode */}
          <div
            className={`grid grid-cols-1 ${
              adType === 'item' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
            } gap-4`}
          >
            {adType === 'item' && (
              <Input
                label="Quantity in Stock"
                type="number"
                min={0}
                step={1}
                required
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  clearFieldError('quantity');
                }}
                error={fieldErrors.quantity}
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
                if (next === 'contact') clearFieldError('price');
              }}
              required
            />

            {showPriceField && (
              <Input
                label="Price Amount (₦)"
                type="number"
                min={1}
                step="any"
                required
                value={priceAmount}
                onChange={(e) => {
                  setPriceAmount(e.target.value);
                  clearFieldError('price');
                }}
                error={fieldErrors.price}
              />
            )}
          </div>

          {adType === 'service' && (
            <div className="space-y-3 pt-1">
              <p className="text-sm font-medium text-slate-700">
                Do you operate from a physical shop?{' '}
                <span className="text-red-500">*</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setHasPhysicalShop(true);
                    clearFieldError('locationName');
                    clearFieldError('gps');
                  }}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-semibold transition-colors ${
                    hasPhysicalShop
                      ? 'bg-blue-50 border-blue-600 text-blue-800 ring-1 ring-blue-500'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span>Yes, Physical Shop</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHasPhysicalShop(false);
                    setLatitude(undefined);
                    setLongitude(undefined);
                    clearFieldError('locationName');
                    clearFieldError('gps');
                  }}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-semibold transition-colors ${
                    !hasPhysicalShop
                      ? 'bg-blue-50 border-blue-600 text-blue-800 ring-1 ring-blue-500'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Globe className="w-4 h-4 shrink-0" />
                  <span>No (Online / I come to you)</span>
                </button>
              </div>

              {!hasPhysicalShop && (
                <div className="grid grid-cols-2 gap-2.5">
                  {NON_SHOP_SERVICE_MODES.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setNonShopServiceMode(opt.value)}
                      className={`px-3 py-2.5 rounded-lg text-xs font-semibold border transition-colors ${
                        nonShopServiceMode === opt.value
                          ? 'bg-primary-50 border-primary-400 text-primary-700'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Photos (1-4 compulsory with X delete buttons) */}
          <ImageUploadGrid
            images={images}
            onChange={(next) => {
              setImages(next);
              clearFieldError('images');
            }}
            label={adType === 'service' ? 'Portfolio / Work Photos' : 'Product Photos'}
            error={fieldErrors.images}
            inputId="edit-listing-images"
          />

          <Input
            label="WhatsApp Number"
            type="tel"
            required
            value={whatsappNumber}
            onChange={(e) => {
              setWhatsappNumber(e.target.value);
              clearFieldError('whatsappNumber');
            }}
            error={fieldErrors.whatsappNumber}
          />

          {adType === 'item' && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">
                Pickup / Fulfillment Location
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setItemLocationType('physical');
                    clearFieldError('locationName');
                    clearFieldError('gps');
                  }}
                  className={`p-3 rounded-xl border text-xs font-semibold transition-colors ${
                    itemLocationType === 'physical'
                      ? 'bg-blue-50 border-blue-600 text-blue-800'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  Physical Location
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setItemLocationType('online');
                    setLatitude(undefined);
                    setLongitude(undefined);
                    clearFieldError('locationName');
                    clearFieldError('gps');
                  }}
                  className={`p-3 rounded-xl border text-xs font-semibold transition-colors ${
                    itemLocationType === 'online'
                      ? 'bg-blue-50 border-blue-600 text-blue-800'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  Online / Delivery Only
                </button>
              </div>
            </div>
          )}

          {effectiveLocationType === 'physical' ? (
            <div className="space-y-4">
              {adType === 'service' && (
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span>
                      Shop Opening &amp; Closing Hours{' '}
                      <span className="text-red-500">*</span>
                    </span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label
                        htmlFor="edit-service-opening-time-start"
                        className="block text-xs font-medium text-slate-600"
                      >
                        Opening Time
                      </label>
                      <input
                        id="edit-service-opening-time-start"
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
                        htmlFor="edit-service-opening-time-end"
                        className="block text-xs font-medium text-slate-600"
                      >
                        Closing Time
                      </label>
                      <input
                        id="edit-service-opening-time-end"
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
                  {openingTimeStart &&
                    openingTimeEnd &&
                    !fieldErrors.openingHours && (
                      <p className="text-xs font-medium text-slate-600">
                        Displayed as:{' '}
                        <span className="text-slate-900">
                          {formatOpeningHoursRange(openingTimeStart, openingTimeEnd)}
                        </span>
                      </p>
                    )}
                  {fieldErrors.openingHours && (
                    <p className="text-xs font-medium text-red-600" role="alert">
                      {fieldErrors.openingHours}
                    </p>
                  )}
                </div>
              )}

              <Input
                label={
                  adType === 'service'
                    ? 'Shop Address / Landmark'
                    : 'Physical Address / Landmark'
                }
                value={locationName}
                onChange={(e) => {
                  setLocationName(e.target.value);
                  clearFieldError('locationName');
                }}
                error={fieldErrors.locationName}
                placeholder="e.g. Opposite LASUED Main Gate"
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
                <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
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
                Online / Delivery mode active — physical address and GPS pin are not required.
              </span>
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
            <Link to="/dashboard/seller">
              <Button type="button" variant="outline" fullWidth>
                Cancel
              </Button>
            </Link>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving &amp; Resetting Approval...</span>
                </>
              ) : (
                <span>Save Changes for Re-Approval</span>
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
