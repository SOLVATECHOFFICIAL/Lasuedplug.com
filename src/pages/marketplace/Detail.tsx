import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  Flag,
  MapPin,
  MessageCircle,
  PackageOpen,
  ShieldCheck,
  Store,
  Truck,
} from 'lucide-react';
import {
  getProductById,
  incrementProductContactCount,
  incrementProductViewCount,
} from '../../lib/marketplaceService';
import { getCategoryName } from '../../lib/categories';
import {
  buildProductWhatsAppUrl,
  getPriceUnitLabel,
  getProductLocationLabel,
  getProductPriceDisplay,
} from '../../lib/marketplaceHelpers';
import { getInitials } from '../../lib/authHelpers';
import { useToast } from '../../contexts/ToastContext';
import { Product } from '../../types';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Loading } from '../../components/feedback/Loading';
import { ErrorState } from '../../components/feedback/ErrorState';
import { ProductImage } from '../../components/marketplace/ProductImage';

export function MarketplaceDetail() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportNotice, setReportNotice] = useState<string | null>(null);

  const trackedViewForIdRef = useRef<string | null>(null);

  const loadProduct = useCallback(async () => {
    if (!id) {
      setProduct(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const row = await getProductById(id);
      setProduct(row);
      setSelectedImageIndex(0);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to load product details. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  // Increment viewCount by 1 once when the product detail loads
  useEffect(() => {
    const productId = product?.id;
    if (!productId || trackedViewForIdRef.current === productId) {
      return;
    }
    trackedViewForIdRef.current = productId;
    setProduct((prev) =>
      prev && prev.id === productId
        ? { ...prev, viewCount: (prev.viewCount || 0) + 1 }
        : prev
    );
    void incrementProductViewCount(productId);
  }, [product?.id]);

  const images = useMemo(() => product?.images || [], [product]);
  const activeImage = images[selectedImageIndex] || images[0];

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Loading variant="skeleton" message="Loading product details..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <ErrorState message={error} onRetry={() => void loadProduct()} />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-md mx-auto px-4 sm:px-6 py-12">
        <Card
          hoverable={false}
          className="border-dashed text-center py-10 space-y-4"
        >
          <div className="w-12 h-12 mx-auto rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
            <PackageOpen className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-slate-900">
              Product not found
            </h1>
            <p className="text-sm text-slate-500">
              This listing may have been removed or is no longer available.
            </p>
          </div>
          <div>
            <Link to="/marketplace">
              <Button variant="primary" size="sm">
                Back to Marketplace
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const priceInfo = getProductPriceDisplay(product);
  const locationLabel = getProductLocationLabel(product);
  const categoryLabel =
    getCategoryName(product.categoryId) || product.categoryName;
  const sellerName = product.sellerSnapshot?.fullName || 'Campus Seller';
  const sellerVerified = Boolean(product.sellerSnapshot?.isVerified);
  const sellerInitials = getInitials(sellerName, null);
  const whatsappHref = buildProductWhatsAppUrl(
    product.whatsappNumber || '',
    product.title
  );

  const handleWhatsAppClick = () => {
    if (!product.id) return;
    const productId = product.id;
    setProduct((prev) =>
      prev && prev.id === productId
        ? { ...prev, contactCount: (prev.contactCount || 0) + 1 }
        : prev
    );
    void incrementProductContactCount(productId);
  };

  const handleReportClick = () => {
    const msg = 'Report feature coming in Prompt 13';
    setReportNotice(msg);
    showToast(msg, 'info');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-36 md:pb-12 space-y-6">
      {/* Back link */}
      <div>
        <Link
          to="/marketplace"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Marketplace</span>
        </Link>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Product Image + Thumbnails */}
        <div className="lg:col-span-7 space-y-3">
          <div className="aspect-[4/3] w-full rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shadow-sm">
            <ProductImage
              src={activeImage}
              alt={product.title}
              className="w-full h-full object-cover"
              iconClassName="w-12 h-12 text-slate-400"
            />
          </div>

          {images.length > 1 && (
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
              {images.map((imgUrl, idx) => (
                <button
                  key={`${imgUrl}-${idx}`}
                  type="button"
                  onClick={() => setSelectedImageIndex(idx)}
                  aria-label={`View image ${idx + 1}`}
                  className={`w-20 h-16 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                    idx === selectedImageIndex
                      ? 'border-blue-600 ring-2 ring-blue-100'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <ProductImage
                    src={imgUrl}
                    alt={`${product.title} thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover"
                    iconClassName="w-5 h-5 text-slate-400"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Contiguous Purchase / Contact Module */}
        <div className="lg:col-span-5 space-y-6">
          <Card hoverable={false} className="space-y-5">
            <div className="space-y-2.5">
              {(categoryLabel || product.subcategory) && (
                <p className="text-xs font-medium text-slate-500">
                  {[categoryLabel, product.subcategory].filter(Boolean).join(' · ')}
                </p>
              )}

              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-snug">
                {product.title}
              </h1>

              <div className="flex flex-wrap items-baseline gap-2">
                <p
                  className={`text-2xl tabular-nums ${
                    priceInfo.isContact
                      ? 'font-bold text-blue-600'
                      : 'font-extrabold text-slate-900'
                  }`}
                >
                  {priceInfo.isContact && priceInfo.unitSuffix
                    ? `${priceInfo.text} (${getPriceUnitLabel(product.priceUnit)})`
                    : priceInfo.text}
                </p>
              </div>

              {/* Location, Shop Name, Google Maps, Delivery */}
              <div className="pt-1 space-y-2">
                <p className="text-sm text-slate-600 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{locationLabel}</span>
                </p>

                {product.shopName && (
                  <p className="text-sm text-slate-600 flex items-center gap-1.5">
                    <Store className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{product.shopName}</span>
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
                  {product.hasDelivery && (
                    <Badge variant="verified">
                      <Truck className="w-3.5 h-3.5 mr-1" />
                      Delivery Available
                    </Badge>
                  )}

                  {product.googleMapLink && (
                    <a
                      href={product.googleMapLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 underline underline-offset-2"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Open in Google Maps</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-2">
              <h2 className="text-sm font-semibold text-slate-900">
                Description
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </div>

            {/* Seller Info Card */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Seller Information
              </h2>
              <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-primary-500 text-white text-sm font-bold flex items-center justify-center shrink-0">
                    {sellerInitials}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {sellerName}
                    </p>
                    <p className="text-xs text-slate-500">
                      LASUEDPLUG Seller
                    </p>
                  </div>
                </div>
                {sellerVerified && (
                  <Badge variant="verified" className="shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                    Verified
                  </Badge>
                )}
              </div>
            </div>

            {/* Desktop WhatsApp Primary Action */}
            <div className="hidden md:block pt-2">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleWhatsAppClick}
                className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-semibold shadow-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                <MessageCircle className="w-5 h-5" />
                <span>Message Seller on WhatsApp</span>
              </a>
            </div>
          </Card>

          {/* Report Listing Action */}
          <div className="flex flex-col items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleReportClick}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 py-1.5 px-3 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Flag className="w-3.5 h-3.5" />
              <span>Report Listing</span>
            </button>
            {reportNotice && (
              <p
                role="status"
                className="text-xs font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg"
              >
                {reportNotice}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Fixed Mobile WhatsApp CTA Bar (sits cleanly above MobileNav) */}
      <div className="md:hidden fixed bottom-[56px] left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-slate-200 px-4 py-2.5 shadow-sm">
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleWhatsAppClick}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition-colors duration-200"
        >
          <MessageCircle className="w-5 h-5" />
          <span>Message Seller on WhatsApp</span>
        </a>
      </div>
    </div>
  );
}
