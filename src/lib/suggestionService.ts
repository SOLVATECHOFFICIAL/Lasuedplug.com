import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import {
  AppSuggestion,
  saveLocalSuggestion,
  SuggestionInput,
  validateSuggestionInput,
} from './suggestionHelpers';

export async function submitAppSuggestion(
  input: SuggestionInput & { userId?: string }
): Promise<AppSuggestion> {
  const validation = validateSuggestionInput(input);
  if (!validation.valid) {
    throw new Error(
      validation.errors.title ||
        validation.errors.details ||
        'Please complete your suggestion before submitting.'
    );
  }

  const trimmedTitle = input.title.trim();
  const trimmedDetails = input.details.trim();
  const trimmedAuthor = (input.authorName || '').trim() || 'Campus Member';
  const nowMs = Date.now();

  let generatedId = `sug_${nowMs}_${Math.random().toString(36).slice(2, 8)}`;
  let channel: AppSuggestion['deliveryChannel'] = 'whatsapp_fallback';

  if (isFirebaseConfigured() && db) {
    try {
      const suggestionRef = doc(collection(db, 'suggestions'));
      generatedId = suggestionRef.id;
      await setDoc(suggestionRef, {
        ...(input.userId ? { userId: input.userId } : {}),
        authorName: trimmedAuthor,
        category: input.category,
        title: trimmedTitle,
        details: trimmedDetails,
        status: 'new',
        createdAt: serverTimestamp(),
      });
      channel = 'firestore';
    } catch {
      // Gracefully keep local + WhatsApp channel when offline or rules are pending deployment
      channel = 'whatsapp_fallback';
    }
  }

  const record: AppSuggestion = {
    id: generatedId,
    ...(input.userId ? { userId: input.userId } : {}),
    authorName: trimmedAuthor,
    category: input.category,
    title: trimmedTitle,
    details: trimmedDetails,
    status: 'new',
    deliveryChannel: channel,
    createdAtMs: nowMs,
  };

  saveLocalSuggestion(record);
  return record;
}
