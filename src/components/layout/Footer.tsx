import { LOGO_URL, SITE_NAME } from '../../lib/constants';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-50 border-t border-gray-200 py-8 pb-24 md:pb-8 text-center text-sm text-gray-500 mt-auto">
      <div className="max-w-7xl mx-auto px-4 space-y-4">
        <div className="flex flex-col items-center justify-center gap-2">
          <img
            src={LOGO_URL}
            alt={SITE_NAME}
            className="h-10 w-auto object-contain"
          />
          <span className="font-bold text-base text-gray-900 tracking-tight">
            {SITE_NAME}
          </span>
        </div>

        <p className="text-xs text-gray-500 max-w-xl mx-auto leading-relaxed">
          LASUEDPLUG is an independent community marketplace. Not affiliated with, endorsed by, or operated by LASUED or LASU.
        </p>

        <p className="text-xs text-gray-400">
          © {currentYear} {SITE_NAME}.
        </p>
      </div>
    </footer>
  );
}
