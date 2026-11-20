import { Link } from 'react-router-dom';
import { Database, Lock, ShieldCheck } from 'lucide-react';
import { Card } from '../../components/ui/Card';

export function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
      <header className="space-y-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary-600">
          <Lock className="w-4 h-4" />
          Data Protection & Privacy
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Privacy Policy
        </h1>
        <p className="text-sm text-slate-500">
          How LASUEDPLUG collects, uses, and protects your personal information.
        </p>
      </header>

      <Card hoverable={false} className="bg-emerald-50 border-emerald-200 space-y-2">
        <div className="flex items-center gap-2 text-emerald-900 font-bold text-base">
          <ShieldCheck className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span>Your Data Is Never Sold</span>
        </div>
        <p className="text-sm text-emerald-900 leading-relaxed">
          We respect student privacy. LASUEDPLUG never sells, rents, or trades your email
          address, phone number, or verification documents to third-party advertisers,
          data brokers, or marketers.
        </p>
      </Card>

      <Card hoverable={false} className="space-y-6 text-sm sm:text-base text-slate-700 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-4 h-4 text-primary-600" aria-hidden="true" />
            1. Information We Collect
          </h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong>Account & Academic Details:</strong> Your full name, email address,
              campus, department, and academic level used to create your campus profile.
            </li>
            <li>
              <strong>Contact Phone / WhatsApp Number:</strong> Used so interested buyers,
              service clients, or prospective roommates can contact you directly from your
              approved listings.
            </li>
            <li>
              <strong>Verification Documents (ID Cards / Fee Receipts):</strong> Collected
              exclusively when you request a Verified Student badge so the Admin can
              confirm your student status.
            </li>
            <li>
              <strong>Listings & Moderation Records:</strong> Listing descriptions,
              images, location hints, favorites, and abuse reports needed to operate and
              moderate the marketplace.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900">
            2. How We Use Your Data
          </h2>
          <p>
            Your information is used strictly to authenticate your account, display approved
            listings to fellow community members, facilitate direct WhatsApp or in-app
            enquiries, prevent fraud, and enforce our{' '}
            <Link to="/terms" className="font-semibold text-blue-600 hover:underline">
              Terms of Service
            </Link>
            .
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900">
            3. Verification Document Access
          </h2>
          <p>
            Student ID uploads and verification requests are restricted by strict
            database security rules so they can only be viewed by the submitting user and
            the authorized LASUEDPLUG Admin during verification review. They are never
            published publicly on listings.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900">
            4. Local Caching & Offline Storage
          </h2>
          <p>
            LASUEDPLUG uses progressive web app caching and local Firestore persistence on
            your device so you can browse previously loaded listings quickly even with poor
            campus network coverage.
          </p>
        </section>
      </Card>
    </div>
  );
}
