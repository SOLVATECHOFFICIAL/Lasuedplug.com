import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Building2, Users } from 'lucide-react';

interface AccommodationSubNavProps {
  actionSlot?: ReactNode;
}

export function AccommodationSubNav({ actionSlot }: AccommodationSubNavProps) {
  const location = useLocation();
  const isRoommates =
    location.pathname.startsWith('/roommates') ||
    location.pathname.startsWith('/accommodation/roommates');

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
      <nav
        aria-label="Accommodation and Roommates Sections"
        className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto"
      >
        <Link
          to="/accommodation"
          className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 min-h-[48px] md:min-h-[40px] rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 active:scale-95 ${
            !isRoommates
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4 shrink-0" />
          <span>Accommodation</span>
        </Link>
        <Link
          to="/roommates"
          className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 min-h-[48px] md:min-h-[40px] rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 active:scale-95 ${
            isRoommates
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          <span>Roommates</span>
        </Link>
      </nav>

      {actionSlot && <div className="flex items-center w-full sm:w-auto">{actionSlot}</div>}
    </div>
  );
}
