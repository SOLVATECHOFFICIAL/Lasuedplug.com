import { parseSafeJsonResponse } from './aiSearchService';
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

export function getDefaultCategorySuggestion(
  adType: AdType = 'item'
): CategorySuggestion {
  const list = getCategoriesForAdType(adType);
  return {
    categoryId: list[0].id,
    subcategory: list[0].subs[0],
  };
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
  image?: { mimeType: string; data: string },
  adType: AdType = 'item'
): Promise<CategorySuggestionResult> {
  const trimmedTitle = title.trim();
  const trimmedDesc = description.trim();
  const fallbackSuggestion = getDefaultCategorySuggestion(adType);

  if (!trimmedTitle && !trimmedDesc && !image) {
    return { suggestion: null };
  }

  try {
    const response = await fetch('/api/ai/suggest-category', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: trimmedTitle,
        description: trimmedDesc,
        image,
        adType,
      }),
    });

    const data = await parseSafeJsonResponse<CategorySuggestionResult>(response);
    if (!data?.suggestion || data.isFallback) {
      return {
        suggestion: fallbackSuggestion,
        isFallback: true,
      };
    }

    return {
      suggestion: data.suggestion,
      isFallback: false,
    };
  } catch (error) {
    console.warn('AI Category Suggestion unavailable, using default category:', error);
    return {
      suggestion: fallbackSuggestion,
      isFallback: true,
    };
  }
}
