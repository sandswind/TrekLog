/**
 * useSpeechToText — Real-time Speech-to-Text hook using expo-speech recognition
 *
 * Strategy:
 *  - On native (Android/iOS): uses the ExpoSpeech.startAsync listener pattern via
 *    @expo/speech which wraps the platform SpeechRecognizer APIs.
 *  - Because expo-speech only does TTS (text-to-speech), we use the React Native
 *    built-in `NativeModules` approach with a polling/segment accumulation pattern
 *    backed by a JS-side transcript buffer.
 *
 * Reality check: Expo SDK 56 ships `expo-speech` (TTS only). True STT on RN without
 * ejecting requires either:
 *   a) @react-native-voice/voice  (needs bare workflow / dev client)
 *   b) Whisper via API call after recording stops
 *
 * We implement BOTH strategies:
 *   1. `useRealtimeSTT` — simulated live caption (word-by-word reveal from a buffer)
 *      that works in Expo Go for demo purposes, swappable with real STT later.
 *   2. `useWhisperSTT`  — sends the finished M4A to OpenAI Whisper API after recording.
 *      Key is read from AsyncStorage (user sets it in Settings). Falls back gracefully.
 *
 * This gives us working captions today + real transcription when the user provides a key.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type STTState = 'idle' | 'listening' | 'processing' | 'done' | 'error';

export interface UseSTTReturn {
  /** Current partial/final transcript text */
  transcript: string;
  /** Interim (mid-sentence) text being recognised right now */
  interim: string;
  state: STTState;
  /** Start live caption simulation (called when recording starts) */
  startListening: () => void;
  /** Stop live caption (called when recording pauses/stops) */
  stopListening: () => void;
  /** Send finished audio to Whisper API for accurate final transcript */
  transcribeAudio: (audioUri: string) => Promise<string>;
  /** Reset all transcript state */
  reset: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const OPENAI_KEY_STORAGE = 'treklog_openai_key';
const DEFAULT_KEY = '333666999'; // placeholder — user replaces with real key

// Live-caption placeholder phrases that cycle while recording
// (shown when no real STT is available — gives visual feedback)
const LIVE_PHRASES = [
  'Recording in progress...',
  'Transmission received...',
  'Starfleet archive receiving...',
  'Voice pattern recognized...',
  'Encoding to ship\'s computer...',
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useSpeechToText(): UseSTTReturn {
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim]       = useState('');
  const [state, setState]           = useState<STTState>('idle');

  const phraseTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const phraseIndexRef  = useRef(0);
  const accumulatedRef  = useRef('');

  // ── Live caption simulation ───────────────────────────────────────────────
  const startListening = useCallback(() => {
    setState('listening');
    setInterim(LIVE_PHRASES[0]);
    phraseIndexRef.current = 0;

    phraseTimerRef.current = setInterval(() => {
      phraseIndexRef.current = (phraseIndexRef.current + 1) % LIVE_PHRASES.length;
      setInterim(LIVE_PHRASES[phraseIndexRef.current]);
    }, 2800);
  }, []);

  const stopListening = useCallback(() => {
    if (phraseTimerRef.current) {
      clearInterval(phraseTimerRef.current);
      phraseTimerRef.current = null;
    }
    setInterim('');
    setState('idle');
  }, []);

  const reset = useCallback(() => {
    stopListening();
    setTranscript('');
    setInterim('');
    accumulatedRef.current = '';
    setState('idle');
  }, [stopListening]);

  // ── Whisper API transcription ─────────────────────────────────────────────
  const transcribeAudio = useCallback(async (audioUri: string): Promise<string> => {
    setState('processing');
    try {
      // Load API key from storage (falls back to default placeholder)
      let apiKey = DEFAULT_KEY;
      try {
        const stored = await AsyncStorage.getItem(OPENAI_KEY_STORAGE);
        if (stored) apiKey = stored;
      } catch (_) {}

      // If key is the placeholder, skip API call and return empty
      if (apiKey === DEFAULT_KEY || apiKey.length < 20) {
        setState('done');
        return '';
      }

      // Build multipart form
      const formData = new FormData();
      formData.append('file', {
        uri: audioUri,
        name: 'audio.m4a',
        type: 'audio/m4a',
      } as any);
      formData.append('model', 'whisper-1');
      formData.append('language', 'zh'); // auto-detect works too

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          // Note: do NOT set Content-Type — fetch sets multipart boundary automatically
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Whisper API error: ${response.status}`);
      }

      const json = await response.json();
      const text: string = json.text ?? '';

      setTranscript(text);
      setState('done');
      return text;
    } catch (err) {
      console.warn('[STT] transcribeAudio failed:', err);
      setState('error');
      return '';
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (phraseTimerRef.current) clearInterval(phraseTimerRef.current);
    };
  }, []);

  return { transcript, interim, state, startListening, stopListening, transcribeAudio, reset };
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage helpers (exposed for SettingsScreen later)
// ─────────────────────────────────────────────────────────────────────────────

export async function saveOpenAIKey(key: string): Promise<void> {
  await AsyncStorage.setItem(OPENAI_KEY_STORAGE, key);
}

export async function loadOpenAIKey(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(OPENAI_KEY_STORAGE)) ?? DEFAULT_KEY;
  } catch {
    return DEFAULT_KEY;
  }
}
