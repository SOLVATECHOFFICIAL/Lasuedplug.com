import { Link } from 'react-router-dom';
import { Home, MapPinOff, ShoppingBag, Store, Building2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { SeoHead } from '../components/seo/SeoHead';

export function NotFound() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24 flex flex-col items-center text-center">
      <SeoHead
        title="Page Not Found"
        description="This page could not be found on LASUEDPLUG."
      />
      <div className="w-20 h-20 rounded-3xl bg-primary-50 dark:bg-primary-900/40 border border-primary-100 dark:border-primary-800 text-primary-600 dark:text-primary-400 flex items-center justify-center shadow-sm mb-6">
        <MapPinOff className="w-10 h-10" aria-hidden="true" />
      </div>

      <span className="inline-block text-xs font-extrabold uppercase tracking-widest text-primary-600 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/40 border border-primary-100 dark:border-primary-800 px-3 py-1 rounded-full mb-4">
        Error 404
      </span>

      <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-3">
        Oops! Page Not Found
      </h1>

      <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-md leading-relaxed mb-8">
        This page went to the market and didn&apos;t come back.
      </p>

      <Link to="/" className="w-full sm:w-auto mb-10">
        <Button variant="primary" size="lg" className="w-full sm:w-auto px-8 py-3.5 text-base shadow-sm">
          <Home className="w-5 h-5" aria-hidden="true" />
          <span>Return to Home</span>
        </Button>
      </Link>

      <div className="w-full pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-center gap-3 text-sm">
        <Link
          to="/marketplace"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium hover:border-blue-300 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <ShoppingBag className="w-4 h-4 text-primary-600 dark:text-primary-400" aria-hidden="true" />
          <span>Marketplace</span>
        </Link>
        <Link
          to="/services"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium hover:border-blue-300 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <Store className="w-4 h-4 text-accent-500" aria-hidden="true" />
          <span>Campus Services</span>
        </Link>
        <Link
          to="/accommodation"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium hover:border-blue-300 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <span>Accommodation</span>
        </Link>
      </div>
    </div>
  );
}
