import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle, Menu, X } from 'lucide-react';
import { LOGO_URL, SITE_NAME } from '../../lib/constants';
import { isFirebaseConfigured } from '../../lib/firebase';

const NAV_LINKS = [
  { name: 'Marketplace', path: '/marketplace' },
  { name: 'Services', path: '/services' },
  { name: 'Accommodation', path: '/accommodation' },
  { name: 'Roommates', path: '/roommates' },
];

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const configOk = isFirebaseConfigured();

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

      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-4 py-3">
          {/* Left: Logo + Wordmark */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <img
              src={LOGO_URL}
              alt={SITE_NAME}
              className="h-10 w-auto object-contain"
            />
            <span className="font-extrabold text-lg text-gray-900 tracking-tight">
              {SITE_NAME}
            </span>
          </Link>

          {/* Desktop Center Links */}
          <nav aria-label="Primary Navigation" className="hidden md:flex items-center gap-4">
            {NAV_LINKS.map((link) => {
              const isActive = location.pathname.startsWith(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-2 py-1.5 rounded-md text-sm font-medium transition ${
                    isActive
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>

          {/* Desktop Right Auth Buttons */}
          <div className="hidden md:flex items-center gap-2.5 shrink-0">
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition"
            >
              Login
            </Link>
            <Link
              to="/signup"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition"
            >
              Signup
            </Link>
          </div>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition"
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
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
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
                <span className="font-extrabold text-lg text-gray-900 tracking-tight">
                  {SITE_NAME}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition"
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
                    className={`px-4 py-3.5 rounded-xl text-base font-medium transition ${
                      isActive
                        ? 'text-blue-600 bg-blue-50 font-semibold'
                        : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="pt-6 border-t border-gray-200 flex flex-col gap-3">
            <Link
              to="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-3 rounded-xl border border-gray-300 bg-white font-medium text-gray-800 hover:bg-gray-50 transition"
            >
              Login
            </Link>
            <Link
              to="/signup"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 shadow-sm transition"
            >
              Signup
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
