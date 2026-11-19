import { Link } from 'react-router-dom';
import { LOGO_URL, SITE_NAME, SITE_TAGLINE } from '../lib/constants';
import { ShoppingBag, Wrench, Home as HomeIcon, Users, MessageSquare, ShieldAlert, LogIn, UserPlus } from 'lucide-react';

export function Home() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-6 bg-white rounded-2xl p-8 sm:p-12 shadow-sm border border-slate-100">
        <div className="flex justify-center">
          <img src={LOGO_URL} alt={SITE_NAME} className="h-20 w-auto object-contain" />
        </div>
        <div className="space-y-2">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 tracking-wide uppercase">
            Foundation is live — Prompt 1A of 22
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
            {SITE_NAME}
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            {SITE_TAGLINE}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link
            to="/marketplace"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition shadow-sm"
          >
            <ShoppingBag className="w-5 h-5" /> Browse Marketplace
          </Link>
          <Link
            to="/accommodation"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition"
          >
            <HomeIcon className="w-5 h-5" /> Find Accommodation
          </Link>
        </div>
      </div>

      {/* Navigation Directory Grid */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-slate-900 border-b pb-2">
          Explore App Sections (Foundation Routes)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/marketplace"
            className="p-5 bg-white rounded-xl border border-slate-200 hover:border-blue-500 hover:shadow-md transition space-y-3 group"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-900">Marketplace</h3>
            <p className="text-sm text-slate-500">Campus products, gadgets, books & food items.</p>
          </Link>

          <Link
            to="/services"
            className="p-5 bg-white rounded-xl border border-slate-200 hover:border-blue-500 hover:shadow-md transition space-y-3 group"
          >
            <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center group-hover:bg-orange-600 group-hover:text-white transition">
              <Wrench className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-900">Services</h3>
            <p className="text-sm text-slate-500">Student tutorials, laundry, tech repairs & catering.</p>
          </Link>

          <Link
            to="/accommodation"
            className="p-5 bg-white rounded-xl border border-slate-200 hover:border-blue-500 hover:shadow-md transition space-y-3 group"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition">
              <HomeIcon className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-900">Lodges & Rooms</h3>
            <p className="text-sm text-slate-500">Off-campus lodges around Epe and roommate matching.</p>
          </Link>

          <Link
            to="/roommates"
            className="p-5 bg-white rounded-xl border border-slate-200 hover:border-blue-500 hover:shadow-md transition space-y-3 group"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-900">Roommate Finder</h3>
            <p className="text-sm text-slate-500">Connect with compatible students to share rent.</p>
          </Link>
        </div>
      </div>

      {/* Additional Quick Links */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-semibold text-slate-900">Account & Community Hub</h3>
          <p className="text-sm text-slate-500">Access seller dashboard, chats, notifications and admin tools.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/login" className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5">
            <LogIn className="w-4 h-4" /> Login
          </Link>
          <Link to="/signup" className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5">
            <UserPlus className="w-4 h-4" /> Signup
          </Link>
          <Link to="/messages" className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4" /> Messages
          </Link>
          <Link to="/admin" className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4" /> Admin
          </Link>
        </div>
      </div>
    </div>
  );
}
