import { Link } from 'react-router-dom';
import {
  AlertOctagon,
  Ban,
  Eye,
  Flag,
  MapPin,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';
import { SUPPORT_LINK } from '../../lib/constants';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SeoHead } from '../../components/seo/SeoHead';

const SAFETY_RULES = [
  {
    title: 'Always meet in public places (e.g., school gate)',
    description:
      'Arrange every exchange during daylight hours in busy, open campus areas such as the school main gate, faculty walkways, or populated student lounges. Avoid secluded rooms or late-night meetups with strangers.',
    icon: MapPin,
    accent: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400',
  },
  {
    title: 'Inspect items before paying',
    description:
      'Test electronics, verify textbook editions, check expiry dates, and physically inspect rooms or hostels in person before making any payment or commitment.',
    icon: Eye,
    accent: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400',
  },
  {
    title: 'Never transfer money in advance to strangers',
    description:
      'Do not send deposits, booking fees, delivery money, or advance transfers to anyone you have not met in person and verified on the spot. Scammers often create urgency to push advance transfers.',
    icon: Ban,
    accent: 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400',
  },
  {
    title: 'Use the Report button',
    description:
      'If a listing looks suspicious, uses misleading photos, asks for upfront payment, or behaves abusively, click the Report button immediately so our Support team can investigate and suspend bad actors.',
    icon: Flag,
    accent: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400',
  },
];

export function SafetyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
      <SeoHead
        title="Safety Rules"
        description="Follow LASUEDPLUG campus safety rules for buyers, sellers, and hostel seekers."
      />
      <header className="space-y-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
          <ShieldCheck className="w-4 h-4" />
          Campus Trading Safety
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Safety Rules for Buyers & Sellers
        </h1>
        <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed">
          Your personal safety and financial security come first. Follow these mandatory
          community guidelines every time you connect with someone from LASUEDPLUG.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {SAFETY_RULES.map((rule, index) => {
          const Icon = rule.icon;
          return (
            <Card key={rule.title} hoverable={false} className="space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${rule.accent}`}
                >
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Rule 0{index + 1}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
                {rule.title}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {rule.description}
              </p>
            </Card>
          );
        })}
      </div>

      <Card hoverable={false} className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/70 space-y-3">
        <div className="flex items-center gap-2 text-red-800 dark:text-red-300 font-bold text-base">
          <AlertOctagon className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span>Zero Tolerance for Fraud</span>
        </div>
        <p className="text-sm text-red-900 dark:text-red-200 leading-relaxed">
          LASUEDPLUG does not process payments, hold escrow funds, or verify off-platform
          WhatsApp chats. Any user attempting advance-fee scams or impersonation will be
          permanently banned upon report verification.
        </p>
        <div className="pt-1 flex flex-wrap gap-3">
          <a
            href={SUPPORT_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors"
          >
            <MessageCircle className="w-4 h-4" aria-hidden="true" />
            <span>Contact Support</span>
          </a>
          <Link to="/terms">
            <Button variant="outline" size="sm">
              Read Terms of Service
            </Button>
          </Link>
          <Link to="/marketplace">
            <Button variant="primary" size="sm">
              Back to Marketplace
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
