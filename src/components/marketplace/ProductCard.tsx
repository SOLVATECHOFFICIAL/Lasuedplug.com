import { Link } from 'react-router-dom';
import { MapPin, Truck } from 'lucide-react';
import { Product } from '../../types';
import { getCategoryName } from '../../lib/categories';
import {
  getProductLocationLabel,
  getProductPriceDisplay,
} from '../../lib/marketplaceHelpers';
import { Card } from '../ui/Card';
import { ProductImage } from './ProductImage';

interface ProductCardProps {
  product: Product;
  className?: string;
}

export function ProductCard({ product, className = '' }: ProductCardProps) {
  const priceInfo = getProductPriceDisplay(product);
  const locationLabel = getProductLocationLabel(product);
  const categoryLabel =
    product.subcategory || getCategoryName(product.categoryId) || product.categoryName;

  return (
    <Link
      to={`/marketplace/${product.id}`}
      className={`group block h-full focus:outline-none ${className}`.trim()}
    >
      <Card
        padded={false}
        className="h-full overflow-hidden flex flex-col group-focus-visible:ring-2 group-focus-visible:ring-blue-500"
      >
        <div className="aspect-[4/3] w-full bg-slate-100 overflow-hidden shrink-0">
          <ProductImage
            src={product.images?.[0]}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>

        <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between gap-2.5">
          <div className="space-y-1">
            {categoryLabel && (
              <p className="text-xs font-medium text-slate-500 truncate">
                {categoryLabel}
              </p>
            )}
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
              {product.title}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-0.5 min-w-0">
              <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              <span className="truncate">{locationLabel}</span>
              {product.hasDelivery && (
                <>
                  <span aria-hidden="true" className="text-slate-300 shrink-0">
                    ·
                  </span>
                  <span
                    className="inline-flex items-center gap-1 text-emerald-700 font-medium shrink-0"
                    title="Delivery available"
                    aria-label="Delivery available"
                  >
                    <Truck className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span className="hidden sm:inline">Delivery</span>
                  </span>
                </>
              )}
            </div>
          </div>

          <p
            className={`text-sm sm:text-base tabular-nums truncate ${
              priceInfo.isContact
                ? 'font-semibold text-blue-600'
                : 'font-bold text-slate-900'
            }`}
          >
            {priceInfo.isContact && priceInfo.unitSuffix
              ? `${priceInfo.text} ${priceInfo.unitSuffix}`
              : priceInfo.text}
          </p>
        </div>
      </Card>
    </Link>
  );
}
