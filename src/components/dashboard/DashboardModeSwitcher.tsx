import { ShoppingBag, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DashboardMode, saveDashboardMode } from '../../lib/dashboardMode';

interface DashboardModeSwitcherProps {
  activeMode: DashboardMode;
}

export function DashboardModeSwitcher({
  activeMode,
}: DashboardModeSwitcherProps) {
  const navigate = useNavigate();

  const handleSwitch = (mode: DashboardMode) => {
    saveDashboardMode(mode);
    if (mode === activeMode) return;
    navigate(mode === 'seller' ? '/dashboard/seller' : '/dashboard/buyer');
  };

  return (
    <div
      aria-label="Dashboard mode switcher"
      className="sticky top-14 md:top-16 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200/80"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Select dashboard mode"
          className="inline-flex items-center p-1 bg-slate-200/80 rounded-xl w-full sm:w-auto"
        >
          <button
            type="button"
            aria-pressed={activeMode === 'buyer'}
            onClick={() => handleSwitch('buyer')}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-1.5 min-h-[38px] rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-all duration-200 ${
              activeMode === 'buyer'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
            <span>Buyer Mode</span>
          </button>

          <button
            type="button"
            aria-pressed={activeMode === 'seller'}
            onClick={() => handleSwitch('seller')}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-1.5 min-h-[38px] rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-all duration-200 ${
              activeMode === 'seller'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Store className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
            <span>Seller Mode</span>
          </button>
        </div>

        <p className="hidden md:block text-xs text-slate-500">
          Your last selected mode is remembered automatically.
        </p>
      </div>
    </div>
  );
}
