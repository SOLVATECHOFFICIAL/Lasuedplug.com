import { Link, useLocation } from 'react-router-dom';
import { Home, ShoppingBag, Wrench, Building2, User } from 'lucide-react';

const TABS = [
  { name: 'Home', path: '/', icon: Home },
  { name: 'Marketplace', path: '/marketplace', icon: ShoppingBag },
  { name: 'Services', path: '/services', icon: Wrench },
  { name: 'Accommodation', path: '/accommodation', icon: Building2 },
  { name: 'Profile', path: '/dashboard/profile', icon: User },
];

export function MobileNav() {
  const location = useLocation();

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 w-full bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex justify-around items-center py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:hidden"
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive =
          tab.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(tab.path);
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={`flex flex-col items-center justify-center px-2.5 py-1 rounded-lg transition-colors duration-200 ${
              isActive
                ? 'text-blue-600 font-semibold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Icon className={`w-5 h-5 mb-1 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
            <span className="text-[11px] leading-none">{tab.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
