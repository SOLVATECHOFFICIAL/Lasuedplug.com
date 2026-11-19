import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBag,
  Wrench,
  Building2,
  Users,
  Search,
  ShieldCheck,
  Handshake,
  MapPin,
  ArrowRight,
} from 'lucide-react';
import { SITE_TAGLINE } from '../lib/constants';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const CATEGORIES = [
  {
    title: 'Marketplace',
    description: 'Textbooks, electronics, dorm essentials, and everyday items from students near you.',
    path: '/marketplace',
    icon: ShoppingBag,
    iconBg: 'bg-primary-50 text-primary-500',
  },
  {
    title: 'Services',
    description: 'Tutoring, graphic design, laundry, catering, hairstyling, and device repairs on campus.',
    path: '/services',
    icon: Wrench,
    iconBg: 'bg-orange-50 text-accent-500',
  },
  {
    title: 'Accommodation',
    description: 'Browse verified off-campus lodges, self-contained rooms, and hostels around Epe.',
    path: '/accommodation',
    icon: Building2,
    iconBg: 'bg-emerald-50 text-emerald-600',
  },
  {
    title: 'Roommates',
    description: 'Connect with compatible LASUED and LASU students looking to share accommodation.',
    path: '/roommates',
    icon: Users,
    iconBg: 'bg-indigo-50 text-indigo-600',
  },
];

const TRUST_PILLARS = [
  {
    title: 'Verified Profiles',
    description:
      'Student and seller verification badges help you identify trusted members of the campus community before you connect.',
    icon: ShieldCheck,
  },
  {
    title: 'Safe Transactions',
    description:
      'Moderation review on listings and transparent direct discovery keep meetups clear, local, and straightforward.',
    icon: Handshake,
  },
  {
    title: 'Campus Focused',
    description:
      'Purpose-built for LASUED students, LASU students, and the surrounding Epe community — no distant clutter.',
    icon: MapPin,
  },
];

export function Home() {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
  };

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-primary-50/80 via-white to-slate-50 border-b border-slate-200/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center space-y-6">
          <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Discover Your Campus Marketplace
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            {SITE_TAGLINE} — built for LASUED students, LASU students, and the Epe community.
          </p>

          {/* Visual Search Bar */}
          <form
            onSubmit={handleSearchSubmit}
            role="search"
            aria-label="Search campus marketplace"
            className="max-w-2xl mx-auto pt-2"
          >
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all duration-200">
              <div className="flex items-center gap-2.5 flex-1 px-2.5">
                <Search className="w-5 h-5 text-slate-400 shrink-0" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search textbooks, phones, services, or lodges..."
                  aria-label="Search products, services, or accommodation"
                  className="w-full py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none"
                />
              </div>
              <Button type="submit" variant="primary" size="md" className="sm:px-6">
                Search
              </Button>
            </div>
          </form>
        </div>
      </section>

      {/* Category Grid */}
      <section className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Browse by Category
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Everything students need across campus life in one place.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {CATEGORIES.map((category) => {
            const Icon = category.icon;
            return (
              <Link key={category.path} to={category.path} className="group block h-full">
                <Card className="h-full flex flex-col justify-between space-y-4 group-hover:border-primary-100">
                  <div className="space-y-4">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center ${category.iconBg}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors duration-200 flex items-center justify-between">
                        <span>{category.title}</span>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all duration-200" />
                      </h3>
                      <p className="text-sm text-slate-500 leading-relaxed">
                        {category.description}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Why Trust Us Section */}
      <section className="bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Why Trust LASUEDPLUG
            </h2>
            <p className="text-sm text-slate-600">
              Designed around accountability, clarity, and real campus proximity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {TRUST_PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.title}
                  className="flex flex-col items-center text-center space-y-3 p-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-500 flex items-center justify-center">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {pillar.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed max-w-sm">
                    {pillar.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
