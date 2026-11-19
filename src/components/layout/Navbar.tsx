import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, Menu, X } from 'lucide-react';
import { LOGO_URL, SITE_NAME } from '../../lib/constants';
import { isFirebaseConfigured } from '../../lib/firebase';
import { Button } from '../ui/Button';

const NAV_LINKS = [
  { name: 'Marketplace', path: '/marketplace' },
  { name: 'Services', path: '/services' },
  { name: 'Accommodation', path: '/accommodation' },
  { name: 'Roommates', path: '/roommates' },
];

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const configOk = isFirebaseConfigured();

  const handleMobileNav = (path: string) => {
    setMobileMenuOpen(false);
    navigate(path);
  };

  return (
    <header className="sticky top-0 z-50 bg-white">
      {!configOk && (
        <div
          role="status"
          className="bg-amber-100 border-b border-amber-300 px-4 py-2 text-center text-xs sm:text-sm font-medium text-amber-900 flex items-center justify-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
          <span>Firebase not configured — check .env.local</span>
        </div>
      )}

      <div className="border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-4 sm:px-6 py-3">
          {/* Left: Logo + Wordmark */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <img
              src={LOGO_URL}
              alt={SITE_NAME}
              className="h-10 w-auto object-contain"
            />
            <span className="font-extrabold text-lg text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors duration-200">
              {SITE_NAME}
            </span>
          </Link>

          {/* Desktop Center Links */}
          <nav aria-label="Primary Navigation" className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => {
              const isActive =
                link.path === '/roommates'
                  ? location.pathname === '/roommates' ||
                    location.pathname === '/accommodation/roommates'
                  : location.pathname.startsWith(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`text-sm font-medium transition-colors duration-200 py-1 border-b-2 ${
                    isActive
                      ? 'text-blue-600 border-blue-600'
                      : 'text-slate-600 border-transparent hover:text-blue-600'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>

          {/* Desktop Right Auth Buttons */}
          <div className="hidden md:flex items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/login')}
            >
              Login
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/signup')}
            >
              Signup
            </Button>
          </div>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors duration-200"
            aria-label="Open menu"
            aria-expanded={mobileMenuOpen}
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Full-Screen Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation Menu"
          className="md:hidden fixed inset-0 z-50 bg-white flex flex-col justify-between p-6 overflow-y-auto"
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5"
              >
                <img
                  src={LOGO_URL}
                  alt={SITE_NAME}
                  className="h-10 w-auto object-contain"
                />
                <span className="font-extrabold text-lg text-slate-900 tracking-tight">
                  {SITE_NAME}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors duration-200"
                aria-label="Close menu"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <nav aria-label="Mobile Fullscreen Navigation" className="flex flex-col gap-2">
              {NAV_LINKS.map((link) => {
                const isActive = location.pathname.startsWith(link.path);
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-4 py-3.5 rounded-xl text-base font-medium transition-colors duration-200 ${
                      isActive
                        ? 'text-blue-600 bg-primary-50 font-semibold'
                        : 'text-slate-700 hover:text-blue-600 hover:bg-slate-50'
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="pt-6 border-t border-slate-200 flex flex-col gap-3">
            <Button
              variant="outline"
              size="lg"
              fullWidth
              onClick={() => handleMobileNav('/login')}
            >
              Login
            </Button>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => handleMobileNav('/signup')}
            >
              Signup
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
