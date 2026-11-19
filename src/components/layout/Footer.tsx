import { Link } from 'react-router-dom';
import { LOGO_URL, SITE_NAME } from '../../lib/constants';

const FOOTER_LINKS = [
  { name: 'Marketplace', path: '/marketplace' },
  { name: 'Services', path: '/services' },
  { name: 'Accommodation', path: '/accommodation' },
  { name: 'Roommates', path: '/roommates' },
];

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-50 border-t border-slate-200 py-10 pb-24 md:pb-10 text-sm text-slate-600 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src={LOGO_URL}
              alt={SITE_NAME}
              className="h-8 w-auto object-contain"
            />
            <span className="font-bold text-base text-slate-900 tracking-tight">
              {SITE_NAME}
            </span>
          </Link>

          <nav aria-label="Footer Navigation" className="flex flex-wrap items-center justify-center gap-6">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors duration-200"
              >
                {link.name}
              </Link>
            ))}
          </nav>
        </div>

        <div className="border-t border-slate-200 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 text-center md:text-left">
          <p className="max-w-2xl leading-relaxed">
            LASUEDPLUG is an independent community marketplace. Not affiliated with, endorsed by, or operated by LASUED or LASU.
          </p>
          <p className="text-slate-500 shrink-0">
            © {currentYear} {SITE_NAME}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
