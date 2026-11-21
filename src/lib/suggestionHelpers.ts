import { SUPPORT_WHATSAPP } from './constants';

export type SuggestionCategory =
  | 'new_feature'
  | 'ui_speed'
  | 'marketplace'
  | 'bug_fix'
  | 'other';

export interface AppSuggestion {
  id: string;
  userId?: string;
  authorName: string;
  category: SuggestionCategory;
  title: string;
  details: string;
  status: 'new' | 'reviewed';
  deliveryChannel: 'firestore' | 'whatsapp_fallback';
  createdAtMs: number;
}

export const SUGGESTION_CATEGORIES: Array<{
  id: SuggestionCategory;
  label: string;
  hint: string;
}> = [
  {
    id: 'new_feature',
    label: 'New Feature',
    hint: 'Tools or pages you want us to build next.',
  },
  {
    id: 'marketplace',
    label: 'Marketplace, Services & Hostels',
    hint: 'Improvements to buying, selling, stores, or lodges.',
  },
  {
    id: 'ui_speed',
    label: 'Design & Speed',
    hint: 'Navigation, layout, or mobile experience ideas.',
  },
  {
    id: 'bug_fix',
    label: 'Report a Bug / Issue',
    hint: 'Something not working as expected on the site.',
  },
  {
    id: 'other',
    label: 'Other Suggestion',
    hint: 'General feedback or campus community ideas.',
  },
];

export interface SuggestionInput {
  category: SuggestionCategory;
  title: string;
  details: string;
  authorName?: string;
}

export interface SuggestionValidationResult {
  valid: boolean;
  errors: {
    title?: string;
    details?: string;
  };
}

export function getSuggestionCategoryLabel(category: SuggestionCategory): string {
  const found = SUGGESTION_CATEGORIES.find((item) => item.id === category);
  return found ? found.label : 'New Feature';
}

export function validateSuggestionInput(
  input: SuggestionInput
): SuggestionValidationResult {
  const errors: SuggestionValidationResult['errors'] = {};
  const title = (input.title || '').trim();
  const details = (input.details || '').trim();

  if (title.length < 4) {
    errors.title = 'Please enter a clear short title (at least 4 characters).';
  } else if (title.length > 120) {
    errors.title = 'Suggestion title must be 120 characters or fewer.';
  }

  if (details.length < 10) {
    errors.details =
      'Please describe your idea or feedback in at least 10 characters.';
  } else if (details.length > 1500) {
    errors.details = 'Details must be 1,500 characters or fewer.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function buildSuggestionWhatsAppUrl(params: {
  category: SuggestionCategory;
  title: string;
  details: string;
  authorName?: string;
}): string {
  const categoryLabel = getSuggestionCategoryLabel(params.category);
  const author = (params.authorName || '').trim() || 'LASUEDPLUG User';
  const message = [
    'Hello LASUEDPLUG Team, here is my suggestion for the app/site:',
    '',
    `Category: ${categoryLabel}`,
    `Title: ${params.title.trim()}`,
    `Details: ${params.details.trim()}`,
    `From: ${author}`,
  ].join('\n');

  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`;
}

const LOCAL_SUGGESTIONS_STORAGE_KEY = 'lasuedplug_my_suggestions_v1';

export function parseStoredSuggestions(raw: string | null): AppSuggestion[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is AppSuggestion =>
          Boolean(item) &&
          typeof item === 'object' &&
          typeof item.id === 'string' &&
          typeof item.title === 'string' &&
          typeof item.details === 'string'
      )
      .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))
      .slice(0, 20);
  } catch {
    return [];
  }
}

export function loadLocalSuggestions(): AppSuggestion[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [];
    }
    return parseStoredSuggestions(
      window.localStorage.getItem(LOCAL_SUGGESTIONS_STORAGE_KEY)
    );
  } catch {
    return [];
  }
}

export function saveLocalSuggestion(item: AppSuggestion): AppSuggestion[] {
  const existing = loadLocalSuggestions().filter((s) => s.id !== item.id);
  const updated = [item, ...existing].slice(0, 20);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        LOCAL_SUGGESTIONS_STORAGE_KEY,
        JSON.stringify(updated)
      );
    }
  } catch {
    // Ignore storage quota errors
  }
  return updated;
}
