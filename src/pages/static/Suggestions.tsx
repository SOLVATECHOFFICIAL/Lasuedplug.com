import { FormEvent, useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Lightbulb,
  Loader2,
  MessageCircle,
  Send,
  Users,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { UPDATES_WHATSAPP_GROUP_LINK } from '../../lib/constants';
import {
  AppSuggestion,
  buildSuggestionWhatsAppUrl,
  getSuggestionCategoryLabel,
  loadLocalSuggestions,
  SUGGESTION_CATEGORIES,
  SuggestionCategory,
  validateSuggestionInput,
} from '../../lib/suggestionHelpers';
import { submitAppSuggestion } from '../../lib/suggestionService';
import { useSafeGoBack } from '../../lib/useSafeGoBack';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { SeoHead } from '../../components/seo/SeoHead';

export function SuggestionsPage() {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const { canGoBack, handleGoBack } = useSafeGoBack('/');

  const [category, setCategory] = useState<SuggestionCategory>('new_feature');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [authorName, setAuthorName] = useState(
    () => profile?.businessName?.trim() || profile?.fullName?.trim() || ''
  );

  const [errors, setErrors] = useState<{ title?: string; details?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [lastSubmitted, setLastSubmitted] = useState<AppSuggestion | null>(null);
  const [submittedList, setSubmittedList] = useState<AppSuggestion[]>(() =>
    loadLocalSuggestions()
  );

  useEffect(() => {
    if (!authorName && (profile?.businessName?.trim() || profile?.fullName?.trim())) {
      setAuthorName(profile.businessName?.trim() || profile.fullName?.trim() || '');
    }
  }, [authorName, profile?.businessName, profile?.fullName]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const validation = validateSuggestionInput({
      category,
      title,
      details,
      authorName,
    });

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      const saved = await submitAppSuggestion({
        userId: user?.uid,
        category,
        title,
        details,
        authorName,
      });
      setLastSubmitted(saved);
      setSubmittedList(loadLocalSuggestions());
      setTitle('');
      setDetails('');
      showToast(
        'Thank you! Your suggestion has been saved for the LASUEDPLUG team.',
        'success'
      );
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'Unable to submit suggestion right now. Please try again.',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-24 md:pb-12 space-y-8">
      <SeoHead
        title="Suggestions & Updates"
        ogTitle="Suggest New Features — LASUEDPLUG"
        description="Suggest what we should add next to LASUEDPLUG and join the WhatsApp updates group."
      />

      <div>
        <button
          type="button"
          onClick={handleGoBack}
          className="inline-flex items-center gap-1.5 py-2 pr-3 -ml-1 rounded-lg text-sm font-medium text-slate-600 hover:text-blue-600 hover:bg-slate-100 active:scale-95 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{canGoBack ? 'Go Back' : 'Back to Home'}</span>
        </button>
      </div>

      {/* Hero Header */}
      <header className="space-y-2.5 max-w-2xl">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary-600">
          <Lightbulb className="w-4 h-4" aria-hidden="true" />
          <span>Community Suggestions &amp; Updates</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Suggest What We Should Add Next
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          Have an idea to make LASUEDPLUG better for students, marketers, or hostel hunters?
          Drop your suggestion below and join our WhatsApp updates group to get notified as
          soon as new features roll out.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Suggestion Form */}
        <Card hoverable={false} className="lg:col-span-7 p-5 sm:p-7 space-y-5">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900">
              Send a Feature Idea or Feedback
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Every idea is reviewed as we plan upcoming app and website updates.
            </p>
          </div>

          {lastSubmitted && (
            <div
              role="status"
              data-testid="suggestion-success-banner"
              className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3"
            >
              <div className="flex items-start gap-2.5">
                <CheckCircle2
                  className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-emerald-950">
                    Suggestion received: &ldquo;{lastSubmitted.title}&rdquo;
                  </p>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    {lastSubmitted.deliveryChannel === 'firestore'
                      ? 'Your suggestion has been saved for the LASUEDPLUG team. Want faster updates when it goes live? Join the WhatsApp Updates Group.'
                      : 'Your suggestion is saved on this device. You can also send it directly on WhatsApp or join our Updates Group below.'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 pl-7">
                <a
                  href={buildSuggestionWhatsAppUrl(lastSubmitted)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Send Copy on WhatsApp</span>
                </a>
                <a
                  href={UPDATES_WHATSAPP_GROUP_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100/70 text-xs font-semibold transition-colors"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Join Updates Group</span>
                </a>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Select
              label="Suggestion Category"
              value={category}
              onChange={(e) =>
                setCategory((e.target.value as SuggestionCategory) || 'new_feature')
              }
              options={SUGGESTION_CATEGORIES.map((item) => ({
                value: item.id,
                label: item.label,
              }))}
            />

            <Input
              label="Suggestion Title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
              }}
              placeholder="e.g. Add campus shuttle timetable or hostel price alert"
              maxLength={120}
              error={errors.title}
              required
            />

            <div className="w-full space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="suggestion-details"
                  className="block text-sm font-medium text-slate-700"
                >
                  What should we add or improve?
                </label>
                <span className="text-[11px] text-slate-400 tabular-nums">
                  {details.length}/1500
                </span>
              </div>
              <textarea
                id="suggestion-details"
                rows={4}
                value={details}
                onChange={(e) => {
                  setDetails(e.target.value);
                  if (errors.details) {
                    setErrors((prev) => ({ ...prev, details: undefined }));
                  }
                }}
                placeholder="Tell us what problem it solves or how you want it to work on LASUEDPLUG..."
                maxLength={1500}
                aria-invalid={errors.details ? true : undefined}
                className={`block w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border rounded-lg shadow-sm placeholder:text-slate-400 transition-all duration-200 focus:outline-none focus:ring-2 ${
                  errors.details
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                    : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500'
                }`}
              />
              {errors.details && (
                <p role="alert" className="text-xs font-medium text-red-600">
                  {errors.details}
                </p>
              )}
            </div>

            <Input
              label="Your Name or Department (Optional)"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="e.g. Zainab · 200L Computer Science"
              maxLength={80}
            />

            <div className="pt-1 flex flex-col sm:flex-row sm:items-center gap-3">
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={submitting}
                className="w-full sm:w-auto"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit Suggestion</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>

        {/* Right Column: Official Updates WhatsApp Group */}
        <div className="lg:col-span-5 space-y-5">
          <Card
            hoverable={false}
            className="p-5 sm:p-6 bg-gradient-to-br from-emerald-50 via-white to-teal-50/70 border-emerald-200 space-y-4"
          >
            <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <MessageCircle className="w-5 h-5" aria-hidden="true" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-extrabold text-slate-900">
                Join the LASUEDPLUG Updates Group
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Get instant announcements whenever new features launch, campus categories
                expand, or community updates drop on LASUEDPLUG.
              </p>
            </div>

            <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>First to know about new app &amp; website features</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Vote and discuss what gets added next</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Important campus safety &amp; seller notices</span>
              </li>
            </ul>

            <a
              href={UPDATES_WHATSAPP_GROUP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="join-updates-whatsapp-group"
              className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition-all active:scale-95"
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>Join Updates Group on WhatsApp</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>
          </Card>

          <Card hoverable={false} className="p-5 space-y-2 bg-slate-50 border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">What happens next?</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              We review student and marketer suggestions weekly and prioritize the most
              requested features for the next release.
            </p>
          </Card>
        </div>
      </div>

      {/* Recently Submitted Suggestions on this Device */}
      {submittedList.length > 0 && (
        <section aria-label="Your submitted suggestions" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Your Submitted Suggestions ({submittedList.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {submittedList.map((item) => (
              <Card key={item.id} hoverable={false} className="p-4 sm:p-5 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Badge variant="role">
                    {getSuggestionCategoryLabel(item.category)}
                  </Badge>
                  <span className="text-[11px] font-medium text-slate-400">
                    {new Date(item.createdAtMs).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  {item.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                  {item.details}
                </p>
                <div className="pt-1 flex items-center justify-between gap-2 border-t border-slate-100 text-xs text-slate-500">
                  <span>By {item.authorName}</span>
                  <a
                    href={buildSuggestionWhatsAppUrl(item)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Send via WhatsApp</span>
                  </a>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
