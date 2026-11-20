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
        className="inline-flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start"
      >
        <Link
          to="/accommodation"
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 ${
            !isRoommates
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Accommodation</span>
        </Link>
        <Link
          to="/roommates"
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 ${
            isRoommates
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Roommates</span>
        </Link>
      </nav>

      {actionSlot && <div className="flex items-center">{actionSlot}</div>}
    </div>
  );
}
