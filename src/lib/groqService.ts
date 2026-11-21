export const GROQ_MODEL = 'qwen/qwen3.8-27b';
export const GROQ_FALLBACK_MODEL = 'openai/gpt-oss-20b';

export function getFrontendGroqApiKey(): string {
  return '';
}

export function getFrontendGroqClient(): null {
  return null;
}

export interface GroqChatOptions {
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
}

export async function createGroqChatCompletion(
  prompt: string,
  options?: GroqChatOptions
): Promise<string | null> {
  if (options?.signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) {
    return null;
  }

  try {
    const response = await fetch('/api/groq', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: trimmedPrompt,
        temperature: options?.temperature ?? 0.2,
        maxTokens: options?.maxTokens ?? 160,
      }),
      signal: options?.signal,
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() || '';
    if (!contentType.includes('application/json')) {
      return null;
    }

    const payload = (await response.json()) as { content?: unknown };
    return typeof payload?.content === 'string' && payload.content.trim()
      ? payload.content.trim()
      : null;
  } catch (error) {
    if (
      options?.signal?.aborted ||
      (error instanceof DOMException && error.name === 'AbortError') ||
      (error instanceof Error && error.name === 'AbortError')
    ) {
      throw new DOMException('Aborted', 'AbortError');
    }
    return null;
  }
}
