import { Link } from 'react-router-dom';
import { Facebook, Instagram, MessageCircle, Twitter } from 'lucide-react';
import { LOGO_URL, SITE_NAME, SUPPORT_LINK } from '../../lib/constants';

const FOOTER_LINKS = [
  { name: 'Marketplace', path: '/marketplace' },
  { name: 'Services', path: '/services' },
  { name: 'Accommodation', path: '/accommodation' },
  { name: 'Roommates', path: '/roommates' },
];

const LEGAL_LINKS = [
  { name: 'About', path: '/about' },
  { name: 'Suggestions', path: '/suggestions' },
  { name: 'Safety Rules', path: '/safety' },
  { name: 'Terms of Service', path: '/terms' },
  { name: 'Privacy Policy', path: '/privacy' },
];

const SOCIAL_LINKS = [
  {
    name: 'Facebook',
    href: 'https://facebook.com/lasuedplug',
    icon: Facebook,
    hoverClass: 'hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/60',
  },
  {
    name: 'Twitter',
    href: 'https://twitter.com/lasuedplug',
    icon: Twitter,
    hoverClass: 'hover:text-sky-600 dark:hover:text-sky-400 hover:border-sky-200 dark:hover:border-sky-800 hover:bg-sky-50 dark:hover:bg-sky-950/60',
  },
  {
    name: 'Instagram',
    href: 'https://instagram.com/lasuedplug',
    icon: Instagram,
    hoverClass: 'hover:text-pink-600 dark:hover:text-pink-400 hover:border-pink-200 dark:hover:border-pink-800 hover:bg-pink-50 dark:hover:bg-pink-950/60',
  },
  {
    name: 'WhatsApp',
    href: SUPPORT_LINK,
    icon: MessageCircle,
    hoverClass: 'hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-200 dark:hover:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60',
  },
];

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-10 pb-24 md:pb-10 text-sm text-slate-600 dark:text-slate-400 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src={LOGO_URL}
              alt={SITE_NAME}
              loading="lazy"
              decoding="async"
              className="h-8 w-auto object-contain"
            />
            <span className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
              {SITE_NAME}
            </span>
          </Link>

          <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-4 sm:gap-8">
            <nav aria-label="Marketplace Navigation" className="flex flex-wrap items-center justify-center gap-5">
              {FOOTER_LINKS.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
                >
                  {link.name}
                </Link>
              ))}
            </nav>

            <nav aria-label="Legal and Trust Navigation" className="flex flex-wrap items-center justify-center gap-5">
              {LEGAL_LINKS.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
                >
                  {link.name}
                </Link>
              ))}
              <a
                href={SUPPORT_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
              >
                Contact Support
              </a>
            </nav>
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400 text-center md:text-left">
          <p className="max-w-2xl leading-relaxed">
            LASUEDPLUG is an independent community marketplace. Not affiliated with, endorsed by, or operated by LASUED or LASU.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0">
            <nav aria-label="Social Media" className="flex items-center gap-2">
              {SOCIAL_LINKS.map(({ name, href, icon: Icon, hoverClass }) => (
                <a
                  key={name}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={name}
                  title={name}
                  className={`inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors duration-200 ${hoverClass}`}
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </nav>

            <p className="text-slate-500 dark:text-slate-400">
              Designed &amp; Built by{' '}
              <a
                href={SUPPORT_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 underline underline-offset-2 transition-colors"
              >
                Oyeyemi Solomon
              </a>
              . © {currentYear} {SITE_NAME}.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
