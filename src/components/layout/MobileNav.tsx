import { Link, useLocation } from 'react-router-dom';
import { Home, ShoppingBag, Wrench, Building2, LayoutDashboard } from 'lucide-react';

const TABS = [
  { name: 'Home', path: '/', icon: Home },
  { name: 'Marketplace', path: '/marketplace', icon: ShoppingBag },
  { name: 'Services', path: '/services', icon: Wrench },
  { name: 'Accommodation', path: '/accommodation', icon: Building2 },
  { name: 'Dashboard', path: '/dashboard/buyer', icon: LayoutDashboard },
];

export function MobileNav() {
  const location = useLocation();

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 w-full bg-white/95 backdrop-blur-sm border-t border-slate-200 shadow-[0_-4px_12px_-2px_rgba(15,23,42,0.06)] flex items-stretch px-1 pt-1.5 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive =
          tab.path === '/'
            ? location.pathname === '/'
            : tab.path === '/dashboard/buyer'
              ? location.pathname === '/dashboard/buyer' ||
                location.pathname === '/dashboard/seller'
              : tab.path === '/accommodation'
                ? location.pathname.startsWith('/accommodation') ||
                  location.pathname.startsWith('/roommates')
                : location.pathname.startsWith(tab.path);
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={`flex-1 min-w-0 min-h-[48px] flex flex-col items-center justify-center px-1 py-1 rounded-xl transition-all duration-200 active:scale-95 ${
              isActive
                ? 'text-blue-600 font-semibold bg-blue-50/60'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Icon className={`w-5 h-5 mb-0.5 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
            <span className="text-[10px] sm:text-[11px] leading-tight truncate max-w-full">
              {tab.name === 'Accommodation' ? 'Hostels' : tab.name}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
