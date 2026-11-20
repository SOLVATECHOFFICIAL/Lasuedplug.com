import { createGroqChatCompletion } from './groqService';
import {
  ALL_MARKETPLACE_CATEGORIES,
  getCategoriesForAdType,
  MasterCategory,
  PRODUCT_CATEGORIES,
} from './categories';
import { AdType } from '../types';

export interface CategorySuggestion {
  categoryId: string;
  subcategory: string;
}

export interface CategorySuggestionResult {
  suggestion: CategorySuggestion | null;
  isFallback?: boolean;
}

export const MARKETPLACE_CATEGORIES: readonly MasterCategory[] =
  ALL_MARKETPLACE_CATEGORIES;

export const DEFAULT_CATEGORY_SUGGESTION: CategorySuggestion = {
  categoryId: PRODUCT_CATEGORIES[0].id,
  subcategory: PRODUCT_CATEGORIES[0].subs[0],
};

const AI_CATEGORY_STORAGE_PREFIX = 'ai_cat_';

export function getDefaultCategorySuggestion(
  adType: AdType = 'item'
): CategorySuggestion {
  const list = getCategoriesForAdType(adType);
  return {
    categoryId: list[0].id,
    subcategory: list[0].subs[0],
  };
}

export function getCategoryCacheKey(title: string, description = ''): string {
  const keyBase = title.trim() || description.trim().slice(0, 80);
  return `${AI_CATEGORY_STORAGE_PREFIX}${keyBase}`;
}

export function readCachedCategorySuggestion(
  title: string,
  description: string,
  categories: readonly MasterCategory[],
  storage?: Pick<Storage, 'getItem'> | null
): CategorySuggestion | null {
  const trimmedKeyBase = title.trim() || description.trim();
  if (!trimmedKeyBase) return null;

  const targetStorage =
    storage !== undefined
      ? storage
      : typeof globalThis !== 'undefined' && 'localStorage' in globalThis
        ? globalThis.localStorage
        : null;

  if (!targetStorage) return null;

  try {
    const raw = targetStorage.getItem(getCategoryCacheKey(title, description));
    if (!raw) return null;

    let candidateCategoryId = '';
    let candidateSubcategory = '';

    try {
      const parsed = JSON.parse(raw) as {
        categoryId?: unknown;
        subcategory?: unknown;
      };
      if (
        typeof parsed?.categoryId === 'string' &&
        typeof parsed?.subcategory === 'string'
      ) {
        candidateCategoryId = parsed.categoryId;
        candidateSubcategory = parsed.subcategory;
      }
    } catch {
      const fromLine = parseCategorySuggestion(raw, categories);
      if (fromLine) return fromLine;
      return null;
    }

    if (!candidateCategoryId) return null;

    const matchedCategory = categories.find(
      (cat) => cat.id.toLowerCase() === candidateCategoryId.toLowerCase()
    );
    if (!matchedCategory) return null;

    const matchedSubcategory =
      matchedCategory.subs.find(
        (sub) => sub.toLowerCase() === candidateSubcategory.toLowerCase()
      ) || matchedCategory.subs[0];

    return {
      categoryId: matchedCategory.id,
      subcategory: matchedSubcategory,
    };
  } catch {
    return null;
  }
}

export function writeCachedCategorySuggestion(
  title: string,
  description: string,
  suggestion: CategorySuggestion,
  storage?: Pick<Storage, 'setItem'> | null
): void {
  const trimmedKeyBase = title.trim() || description.trim();
  if (!trimmedKeyBase) return;

  const targetStorage =
    storage !== undefined
      ? storage
      : typeof globalThis !== 'undefined' && 'localStorage' in globalThis
        ? globalThis.localStorage
        : null;

  if (!targetStorage) return;

  try {
    targetStorage.setItem(
      getCategoryCacheKey(title, description),
      JSON.stringify(suggestion)
    );
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

export function parseCategorySuggestion(
  rawText: string,
  categories: readonly MasterCategory[] = PRODUCT_CATEGORIES
): CategorySuggestion | null {
  if (!rawText) return null;

  const firstLine = rawText
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/```/g, '')
    .trim()
    .split(/\r?\n/)[0]
    .trim();

  const parts = firstLine.split('|');
  if (parts.length < 2) return null;

  const rawCategory = parts[0].trim().toLowerCase();
  const rawSubcategory = parts.slice(1).join('|').trim();

  const matchedCategory =
    categories.find((cat) => cat.id.toLowerCase() === rawCategory) ||
    categories.find((cat) => cat.name.toLowerCase() === rawCategory);

  if (!matchedCategory) return null;

  const matchedSubcategory =
    matchedCategory.subs.find(
      (sub) => sub.toLowerCase() === rawSubcategory.toLowerCase()
    ) ||
    matchedCategory.subs.find(
      (sub) =>
        sub.toLowerCase().includes(rawSubcategory.toLowerCase()) ||
        rawSubcategory.toLowerCase().includes(sub.toLowerCase())
    ) ||
    matchedCategory.subs[0];

  return {
    categoryId: matchedCategory.id,
    subcategory: matchedSubcategory,
  };
}

export async function suggestCategory(
  title: string,
  description: string,
  adType: AdType = 'item'
): Promise<CategorySuggestionResult> {
  const trimmedTitle = title.trim();
  const trimmedDesc = description.trim();
  const fallbackSuggestion = getDefaultCategorySuggestion(adType);

  if (!trimmedTitle && !trimmedDesc) {
    return { suggestion: null };
  }

  const targetCategories = getCategoriesForAdType(adType);

  const cachedSuggestion = readCachedCategorySuggestion(
    trimmedTitle,
    trimmedDesc,
    targetCategories
  );
  if (cachedSuggestion) {
    return {
      suggestion: cachedSuggestion,
      isFallback: false,
    };
  }

  try {
    const listingLabel = adType === 'service' ? 'service' : 'item';
    const prompt = `Read this ${listingLabel} title and description. Based on this exact list of categories: ${JSON.stringify(targetCategories)}. Return ONLY the categoryId and subcategory in this exact format: categoryId|subcategory. Do not return any other text.

Title: ${trimmedTitle || '(not provided)'}
Description: ${trimmedDesc || '(not provided)'}`;

    const rawText = await createGroqChatCompletion(prompt, {
      temperature: 0.1,
      maxTokens: 40,
    });

    if (!rawText) {
      return {
        suggestion: fallbackSuggestion,
        isFallback: true,
      };
    }

    const parsed = parseCategorySuggestion(rawText, targetCategories);
    if (!parsed) {
      return {
        suggestion: fallbackSuggestion,
        isFallback: true,
      };
    }

    writeCachedCategorySuggestion(trimmedTitle, trimmedDesc, parsed);

    return {
      suggestion: parsed,
      isFallback: false,
    };
  } catch (error) {
    console.error('Groq Error:', error);
    return {
      suggestion: fallbackSuggestion,
      isFallback: true,
    };
  }
}
