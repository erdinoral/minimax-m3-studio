import { useEffect, useState } from 'react';

export interface PromptIssue {
  code: 'words_on_tag_line' | 'vocal_gender_missing' | 'prompt_too_long';
  severity: 'error' | 'warning';
  line?: number;
  text?: string;
}

export interface PromptCheck {
  tokens: number;
  /** False when the engine was not running and `tokens` is the service's estimate. */
  exact: boolean;
  limit: number;
  issues: PromptIssue[];
}

/** What the engine would lose or refuse in a caption and lyrics, asked once typing pauses. */
export function usePromptCheck(caption: string, lyrics: string, instrumental: boolean) {
  const [data, setData] = useState<PromptCheck | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    let current = true;
    const timer = window.setTimeout(() => {
      fetch('/v1/music/prompt-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption, lyrics, instrumental }),
      })
        .then(async response => {
          if (!response.ok) throw new Error(`/v1/music/prompt-check answered ${response.status}`);
          return (await response.json()) as PromptCheck;
        })
        .then(found => { if (current) { setData(found); setError(null); } })
        .catch(reason => { if (current) setError(reason instanceof Error ? reason : new Error(String(reason))); });
    }, 400);
    return () => { current = false; window.clearTimeout(timer); };
  }, [caption, lyrics, instrumental]);
  return { data, error };
}
