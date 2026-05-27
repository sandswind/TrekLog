/**
 * useAITitle — V3
 * Calls OpenAI GPT-4o-mini to generate a Star Trek–flavoured log title.
 *
 * Input:  transcript text + log type + stardate
 * Output: a short, evocative title in the style of a Starfleet log entry
 *
 * Falls back gracefully when:
 *   - No API key is configured (returns empty string)
 *   - Network is unavailable
 *   - API returns an error
 *
 * Key storage: AsyncStorage key "treklog_openai_key"
 * AI toggle:   AsyncStorage key "treklog_ai_enabled" ("true" / "false")
 */

import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LogType } from '../db/schema';

// ── Storage keys (shared with useSpeechToText) ────────────────────────────────
export const STORAGE_KEY_OPENAI  = 'treklog_openai_key';
export const STORAGE_KEY_AI_ON   = 'treklog_ai_enabled';
export const DEFAULT_KEY_PLACEHOLDER = '333666999';

// ── Types ─────────────────────────────────────────────────────────────────────
export type AITitleState = 'idle' | 'generating' | 'done' | 'error' | 'no_key';

export interface UseAITitleReturn {
  state:        AITitleState;
  lastTitle:    string;
  errorMessage: string;
  generate: (params: {
    transcript: string;
    logType:    LogType;
    stardate:   string;
    tags?:      string[];
  }) => Promise<string>;
  reset: () => void;
}

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the computer of a Starfleet vessel, acting as a log-title generator.
Given a voice log transcript, return ONLY a short title (5–10 words) that:
- Sounds like an official Starfleet log entry subject line
- Captures the core theme or event of the transcript
- Uses formal, concise Starfleet language
- May reference stardates, missions, anomalies, or personal reflections
- Does NOT include "Captain's Log" or "Stardate" in the title itself

Respond with ONLY the title text. No quotes, no explanation, no punctuation at the end.`;

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAITitle(): UseAITitleReturn {
  const [state, setState]           = useState<AITitleState>('idle');
  const [lastTitle, setLastTitle]   = useState('');
  const [errorMessage, setError]    = useState('');

  const generate = useCallback(async (params: {
    transcript: string;
    logType:    LogType;
    stardate:   string;
    tags?:      string[];
  }): Promise<string> => {
    setState('generating');
    setError('');

    try {
      // ── Load settings ──────────────────────────────────────────────────────
      const [rawKey, aiEnabled] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_OPENAI),
        AsyncStorage.getItem(STORAGE_KEY_AI_ON),
      ]);

      // Respect the AI toggle (default ON if never set)
      if (aiEnabled === 'false') {
        setState('idle');
        return '';
      }

      const apiKey = rawKey ?? DEFAULT_KEY_PLACEHOLDER;

      // If key is the placeholder or too short, bail silently
      if (!apiKey || apiKey === DEFAULT_KEY_PLACEHOLDER || apiKey.trim().length < 20) {
        setState('no_key');
        return '';
      }

      // ── Build user prompt ──────────────────────────────────────────────────
      const LOG_TYPE_NAMES: Record<LogType, string> = {
        captain:  "Captain's Log",
        personal: 'Personal Log',
        medical:  'Medical Log',
      };

      const tagContext = params.tags && params.tags.length > 0
        ? `\nTags: ${params.tags.join(', ')}`
        : '';

      const userPrompt =
        `Log type: ${LOG_TYPE_NAMES[params.logType]}\n` +
        `Stardate: ${params.stardate}\n` +
        `Transcript:\n"${params.transcript.slice(0, 1500)}"` +
        tagContext;

      // ── Call GPT-4o-mini ───────────────────────────────────────────────────
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model:       'gpt-4o-mini',
          max_tokens:  40,
          temperature: 0.75,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user',   content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw new Error(`OpenAI ${response.status}: ${errBody.slice(0, 120)}`);
      }

      const json = await response.json();
      const title: string = (json.choices?.[0]?.message?.content ?? '').trim();

      if (!title) throw new Error('Empty response from API');

      setLastTitle(title);
      setState('done');
      return title;

    } catch (err: any) {
      const msg = err?.message ?? 'Unknown error';
      console.warn('[useAITitle]', msg);
      setError(msg);
      setState('error');
      return '';
    }
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setLastTitle('');
    setError('');
  }, []);

  return { state, lastTitle, errorMessage, generate, reset };
}

// ── Standalone helpers (used by SettingsScreen) ───────────────────────────────

export async function getOpenAIKey(): Promise<string> {
  return (await AsyncStorage.getItem(STORAGE_KEY_OPENAI)) ?? '';
}

export async function setOpenAIKey(key: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY_OPENAI, key.trim());
}

export async function getAIEnabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem(STORAGE_KEY_AI_ON);
  return v !== 'false'; // default ON
}

export async function setAIEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY_AI_ON, enabled ? 'true' : 'false');
}

/** Quick smoke-test: send a one-word prompt and verify we get a response */
export async function testOpenAIKey(key: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${key.trim()}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'Say "ok"' }],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 80)}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Network error' };
  }
}
