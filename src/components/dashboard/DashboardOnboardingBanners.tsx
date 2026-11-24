import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Sparkles, UserCheck } from 'lucide-react';
import { calculateProfileCompletion } from '../../lib/authHelpers';
import { UserProfile } from '../../types';

interface DashboardOnboardingBannersProps {
  profile: UserProfile | null;
}

export function DashboardOnboardingBanners({
  profile,
}: DashboardOnboardingBannersProps) {
  if (!profile) {
    return null;
  }

  const showVerificationBanner = profile.isVerified !== true;
  const completion = calculateProfileCompletion(profile);
  const showProgressBar = !completion.isComplete;

  if (!showVerificationBanner && !showProgressBar) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Task 5: "Get Verified" Glowing Incentive Banner */}
      {showVerificationBanner && (
        <section
          aria-label="Get verified incentive"
          data-testid="get-verified-banner"
          className="relative overflow-hidden rounded-2xl border border-amber-300/80 dark:border-amber-500/40 bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/60 dark:via-orange-950/50 dark:to-slate-900 p-4 sm:p-5 shadow-[0_0_24px_-6px_rgba(245,158,11,0.45)] dark:shadow-[0_0_24px_-6px_rgba(245,158,11,0.28)]"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-10 w-36 h-36 rounded-full bg-amber-300/30 dark:bg-amber-400/10 blur-2xl"
          />
          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <BadgeCheck className="w-5 h-5" aria-hidden="true" />
              </div>
              <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-amber-50 leading-snug">
                ⚡ Tired of waiting for approval? Get Verified today to post
                items instantly!
              </p>
            </div>

            <Link
              to="/dashboard/profile"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[42px] rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-bold shadow-sm hover:shadow-md transition-all duration-200 active:scale-95 whitespace-nowrap shrink-0 self-start sm:self-auto"
            >
              <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Get Verified Now</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </Link>
          </div>
        </section>
      )}

      {/* Task 6: Profile Completion Progress Bar (Hidden when 100%) */}
      {showProgressBar && (
        <section
          aria-label="Profile completion progress"
          data-testid="profile-completion-bar"
          className="rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <UserCheck className="w-4 h-4" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                Your profile is {completion.percentage}% complete. Complete it
                to build trust!
              </p>
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
              <span className="text-xs font-bold text-blue-700 dark:text-blue-400 tabular-nums">
                {completion.percentage}%
              </span>
              <Link
                to="/dashboard/profile"
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline whitespace-nowrap"
              >
                Complete Profile →
              </Link>
            </div>
          </div>

          <div
            role="progressbar"
            aria-label="Profile completion"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={completion.percentage}
            className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 via-primary-500 to-emerald-500 transition-all duration-300"
              style={{ width: `${completion.percentage}%` }}
            />
          </div>

          {completion.missingFields.length > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Missing: {completion.missingFields.join(', ')}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
