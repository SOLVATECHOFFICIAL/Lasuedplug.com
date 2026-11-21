import { Link } from 'react-router-dom';
import { FileText, MessageCircle, Scale, ShieldAlert } from 'lucide-react';
import { SUPPORT_LINK } from '../../lib/constants';
import { Card } from '../../components/ui/Card';
import { SeoHead } from '../../components/seo/SeoHead';

export function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
      <SeoHead
        title="Terms of Service"
        description="Read the LASUEDPLUG Terms of Service, user responsibilities, and limitation of liability."
      />
      <header className="space-y-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400">
          <Scale className="w-4 h-4" />
          Legal Terms &amp; Liability Shield
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Terms of Service
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          By creating an account or using LASUEDPLUG, you agree to these Terms of Service.
        </p>
      </header>

      <div className="rounded-2xl border-2 border-slate-900 dark:border-slate-700 bg-slate-900 dark:bg-slate-900/90 text-white p-6 sm:p-7 space-y-3 shadow-sm">
        <div className="flex items-center gap-2 text-amber-300 font-bold text-sm uppercase tracking-wider">
          <ShieldAlert className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span>Limitation of Liability & No Intermediary Role</span>
        </div>
        <p className="text-sm sm:text-base leading-relaxed font-medium text-slate-100">
          LASUEDPLUG is a connection platform only. We do not process payments, handle
          deliveries, or guarantee the quality of items. All transactions are strictly
          between the buyer and seller. LASUEDPLUG and its Support team are not liable for any
          financial loss, scam, or dispute that occurs off-platform (e.g., on WhatsApp).
        </p>
      </div>

      <Card hoverable={false} className="space-y-6 text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary-600 dark:text-primary-400" aria-hidden="true" />
            1. Independent Campus Platform
          </h2>
          <p>
            LASUEDPLUG is an independent student discovery service. It is NOT affiliated
            with, endorsed by, or operated by LASUED (Lagos State University of Education)
            or LASU (Lagos State University). School names are referenced solely to describe
            the surrounding student community.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            2. User Responsibilities &amp; Truthful Listings
          </h2>
          <p>
            You are solely responsible for the accuracy, legality, and safety of any
            product, service, accommodation, roommate post, or store you publish. Prohibited
            items—including stolen goods, weapons, illegal substances, counterfeit
            documents, and fraudulent offers—are strictly forbidden.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            3. Verification Badges Do Not Equal Financial Guarantees
          </h2>
          <p>
            A &ldquo;Verified Student&rdquo; badge indicates only that an account submitted
            a student ID or school document reviewed by Support at the time of approval.
            It is not a financial guarantee, insurance policy, or endorsement of any
            off-platform transaction. Always follow our{' '}
            <Link to="/safety" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
              Safety Rules
            </Link>
            .
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            4. Moderation &amp; Account Termination
          </h2>
          <p>
            LASUEDPLUG Support reserves the right to approve, reject, edit, or delete any
            listing and to suspend or permanently ban any user account that violates these
            terms, receives credible abuse reports, or threatens community safety, without
            prior notice.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            5. Assumption of Risk
          </h2>
          <p>
            Every user assumes full personal responsibility when meeting other users,
            inspecting rooms or goods, and exchanging money or property. To the maximum
            extent permitted by law, LASUEDPLUG and its Support team disclaim all warranties,
            express or implied, and shall not be held responsible for direct, indirect, or
            incidental damages arising out of user interactions.
          </p>
        </section>
      </Card>

      <Card hoverable={false} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Questions or Account Appeals?
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Need help with a listing, verification, or account review? Reach our team directly.
          </p>
        </div>
        <a
          href={SUPPORT_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition-colors whitespace-nowrap shrink-0"
        >
          <MessageCircle className="w-4 h-4" aria-hidden="true" />
          <span>Contact Support</span>
        </a>
      </Card>
    </div>
  );
}
