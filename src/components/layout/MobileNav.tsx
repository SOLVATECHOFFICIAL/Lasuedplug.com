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
      className="fixed bottom-0 left-0 right-0 z-40 w-full bg-white border-t border-gray-200 flex justify-around items-center py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:hidden"
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
            className={`flex flex-col items-center justify-center px-2 py-1 rounded-lg transition ${
              isActive
                ? 'text-blue-600 font-semibold'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Icon className="w-5 h-5 mb-0.5" />
            <span className="text-[11px] leading-none">{tab.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
