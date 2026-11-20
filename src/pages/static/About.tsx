import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Building2, ShieldCheck, ShoppingBag, Users } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
      <header className="space-y-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary-600">
          <Users className="w-4 h-4" />
          About LASUEDPLUG
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Built by Students, for the Campus Community
        </h1>
        <p className="text-base text-slate-600 leading-relaxed">
          LASUEDPLUG is a student-run discovery platform designed to help LASUED students,
          LASU students, and residents around the Epe campus community discover textbooks,
          everyday essentials, trusted student services, off-campus accommodation, and
          roommate opportunities in one organized hub.
        </p>
      </header>

      <div
        role="note"
        className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-6 flex items-start gap-4"
      >
        <AlertTriangle className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1.5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-amber-900">
            Independence Disclaimer
          </h2>
          <p className="text-sm sm:text-base font-bold text-slate-900 leading-relaxed">
            LASUEDPLUG is an independent platform. It is NOT affiliated with, endorsed by,
            or operated by LASUED or LASU.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card hoverable={false} className="space-y-2.5">
          <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Discovery Only</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            We help campus buyers and sellers find each other quickly. Listings are moderated
            before publishing, while all negotiations and handoffs happen directly between peers.
          </p>
        </Card>

        <Card hoverable={false} className="space-y-2.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Student Verification</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Sellers and hosts can submit student identification for manual admin review so
            community members can recognize verified campus accounts.
          </p>
        </Card>

        <Card hoverable={false} className="space-y-2.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Campus Ecosystem</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            From hostel hunting around Epe to finding study materials or campus freelancers,
            everything is tailored around real student life.
          </p>
        </Card>
      </div>

      <Card hoverable={false} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 text-white border-slate-800">
        <div className="space-y-1">
          <h2 className="text-lg font-bold">Explore safely on LASUEDPLUG</h2>
          <p className="text-sm text-slate-300">
            Read our campus safety guidelines and legal terms before trading.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/safety">
            <Button variant="outline" size="md">
              Safety Rules
            </Button>
          </Link>
          <Link to="/marketplace">
            <Button variant="primary" size="md">
              <span>Browse Marketplace</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
