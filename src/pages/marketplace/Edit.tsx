import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ImagePlus,
  Loader2,
  PackageOpen,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { getProductById } from '../../lib/marketplaceService';
import { updateSellerListing } from '../../lib/sellerService';
import {
  getCategoriesForAdType,
  getCategoryName,
  getSubcategoriesForCategory,
} from '../../lib/categories';
import { getListingAdType } from '../../lib/marketplaceHelpers';
import { getFastCache, invalidateFastCache, invalidateFastCachePrefix } from '../../lib/fastCache';
import { compressImageToBase64, isImageFile } from '../../lib/imageUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { PriceType, Product, ServiceLocation } from '../../types';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Loading } from '../../components/feedback/Loading';
import { ErrorState } from '../../components/feedback/ErrorState';
import { ProductImage } from '../../components/marketplace/ProductImage';

const MAX_IMAGES = 4;
const MAX_DOCUMENT_IMAGE_BYTES = 850_000;

const ITEM_PRICE_TYPE_OPTIONS = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'negotiable', label: 'Negotiable' },
  { value: 'contact', label: 'Contact for Price' },
] as const;

const SERVICE_LOCATION_OPTIONS: Array<{
  value: ServiceLocation;
  label: string;
}> = [
  { value: 'shop', label: 'Come to my shop' },
  { value: 'mobile', label: 'I come to you (Mobile)' },
  { value: 'online', label: 'Online / Delivery' },
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
  const [serviceLocation, setServiceLocation] = useState<ServiceLocation>('shop');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [locationName, setLocationName] = useState('');
  const [hasDelivery, setHasDelivery] = useState(false);

  const [compressing, setCompressing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submittingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
        const adType = getListingAdType(record);
        setTitle(record.title || '');
        setDescription(record.description || '');
        setCategoryId(record.categoryId || '');
        setSubcategory(record.subcategory || '');
        setImages(Array.isArray(record.images) ? record.images : []);
        setPriceType(adType === 'service' ? 'contact' : record.priceType || 'fixed');
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
        setServiceLocation(record.serviceLocation || 'shop');
        setWhatsappNumber(record.whatsappNumber || '');
        setLocationName(
          record.locationName || record.landmark || record.location || ''
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

  const handleCategoryChange = (nextCategoryId: string) => {
    setCategoryId(nextCategoryId);
    const nextSubs = getSubcategoriesForCategory(nextCategoryId);
    setSubcategory(nextSubs[0] || '');
  };

  const handleImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      showToast(`Maximum of ${MAX_IMAGES} images allowed.`, 'info');
      return;
    }

    const toProcess = files.slice(0, remaining);
    setCompressing(true);
    setFormError(null);

    try {
      const compressed: string[] = [];
      for (const file of toProcess) {
        if (!isImageFile(file)) {
          throw new Error(`"${file.name}" is not a valid image file.`);
        }
        const base64 = await compressImageToBase64(file);
        compressed.push(base64);
      }

      const combined = [...images, ...compressed];
      const totalChars = combined.reduce((sum, img) => sum + img.length, 0);
      if (totalChars > MAX_DOCUMENT_IMAGE_BYTES) {
        throw new Error(
          'Combined images exceed Firestore size limits. Please remove an image or upload smaller photos.'
        );
      }
      setImages(combined);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to process image.';
      setFormError(msg);
      showToast(msg, 'error');
    } finally {
      setCompressing(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || !listing?.id || !user?.uid) return;
    setFormError(null);

    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();
    const trimmedPhone = whatsappNumber.trim();
    const trimmedLoc = locationName.trim();

    if (trimmedTitle.length < 3) {
      setFormError('Please enter a title (at least 3 characters).');
      return;
    }
    if (trimmedDesc.length < 10) {
      setFormError('Please enter a description (at least 10 characters).');
      return;
    }
    if (!categoryId || !subcategory) {
      setFormError('Please select both a category and subcategory.');
      return;
    }

    let parsedQuantity: number | undefined;
    let parsedPrice: number | undefined;

    if (adType === 'item') {
      const numericQty = Number(quantity);
      if (!Number.isFinite(numericQty) || numericQty < 0) {
        setFormError('Please enter a valid stock quantity (0 or more).');
        return;
      }
      parsedQuantity = Math.floor(numericQty);

      if (priceType === 'fixed' || priceType === 'negotiable') {
        const numericPrice = Number(priceAmount);
        if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
          setFormError('Please enter a valid price amount in Naira.');
          return;
        }
        parsedPrice = numericPrice;
      }
    }

    if (trimmedPhone.replace(/[^\d]/g, '').length < 7) {
      setFormError('Please enter a valid WhatsApp number.');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      await updateSellerListing(listing.id, {
        adType,
        title: trimmedTitle,
        description: trimmedDesc,
        categoryId,
        subcategory,
        categoryName: getCategoryName(categoryId) || listing.categoryName || categoryId,
        images,
        priceType: adType === 'service' ? 'contact' : priceType,
        price: parsedPrice,
        priceUnit: listing.priceUnit || 'total',
        quantity: parsedQuantity,
        serviceLocation: adType === 'service' ? serviceLocation : undefined,
        whatsappNumber: trimmedPhone,
        locationName: trimmedLoc,
        hasDelivery: adType === 'item' ? hasDelivery : serviceLocation === 'online',
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

  const showItemPriceField =
    adType === 'item' && (priceType === 'fixed' || priceType === 'negotiable');

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
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
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
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Listing title"
          />

          <div className="space-y-1.5">
            <label
              htmlFor="edit-description"
              className="block text-sm font-medium text-slate-700"
            >
              Description
            </label>
            <textarea
              id="edit-description"
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="block w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Category"
              name="categoryId"
              options={categoryOptions}
              value={categoryId}
              onChange={(e) => handleCategoryChange(e.target.value)}
              required
            />
            <Select
              label="Subcategory"
              name="subcategory"
              options={subcategoryOptions}
              value={subcategory}
              disabled={!categoryId}
              onChange={(e) => setSubcategory(e.target.value)}
              required
            />
          </div>

          {adType === 'item' ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Quantity in Stock"
                type="number"
                min={0}
                step={1}
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />

              <Select
                label="Price Type"
                name="priceType"
                options={[...ITEM_PRICE_TYPE_OPTIONS]}
                value={priceType}
                onChange={(e) => setPriceType(e.target.value as PriceType)}
                required
              />

              {showItemPriceField && (
                <Input
                  label="Price Amount (₦)"
                  type="number"
                  min={1}
                  step="any"
                  required
                  value={priceAmount}
                  onChange={(e) => setPriceAmount(e.target.value)}
                />
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Service Location Mode
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {SERVICE_LOCATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setServiceLocation(opt.value)}
                    className={`px-3 py-2.5 rounded-lg text-xs font-semibold border transition-colors ${
                      serviceLocation === opt.value
                        ? 'bg-primary-50 border-primary-400 text-primary-700'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Photos */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700">
                Photos (Up to {MAX_IMAGES})
              </label>
              <span className="text-xs text-slate-500 tabular-nums">
                {images.length}/{MAX_IMAGES}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {images.map((imgUrl, idx) => (
                <div
                  key={`${imgUrl.slice(0, 20)}-${idx}`}
                  className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100"
                >
                  <ProductImage
                    src={imgUrl}
                    alt={`Listing photo ${idx + 1}`}
                    className="w-full h-full object-cover"
                    iconClassName="w-6 h-6 text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
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
                  className="aspect-square rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/40 flex flex-col items-center justify-center gap-1.5 text-slate-500 hover:text-blue-600 transition-colors disabled:opacity-60"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="WhatsApp Number"
              type="tel"
              required
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
            />
            <Input
              label="Location Landmark"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="e.g. Opposite LASUED Main Gate"
            />
          </div>

          {adType === 'item' && (
            <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={hasDelivery}
                onChange={(e) => setHasDelivery(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-800">
                I offer delivery
              </span>
            </label>
          )}

          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
            <Link to="/dashboard/seller">
              <Button type="button" variant="outline" fullWidth>
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting || compressing}
            >
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
