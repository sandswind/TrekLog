/**
 * TrekLog Global State — Zustand store (V2)
 * Added: allEntries (cross-type), tag list, searchByTags, fullTextSearch
 */
import { create } from 'zustand';
import { LogEntry, LogType } from '../db/schema';
import {
  getAllLogs,
  getLogsByType,
  insertLog,
  deleteLog,
  searchLogs,
  groupByDate,
  getAllTags,
  searchByTags,
  fullTextSearch,
} from '../db/database';
import * as FileSystem from 'expo-file-system';

interface LogStore {
  // ── list state ──────────────────────────────────────────────────────────────
  entries:      LogEntry[];
  allEntries:   LogEntry[];   // V2: unfiltered, used by Timeline
  grouped:      { date: string; items: LogEntry[] }[];
  allGrouped:   { date: string; items: LogEntry[] }[];  // V2: timeline
  selectedType: LogType;
  searchQuery:  string;
  isLoading:    boolean;

  // ── tag search state (V2) ──────────────────────────────────────────────────
  allTags:        string[];
  activeTags:     string[];
  tagResults:     LogEntry[];
  isTagSearching: boolean;

  // ── actions ─────────────────────────────────────────────────────────────────
  setSelectedType:  (t: LogType) => void;
  loadLogs:         () => Promise<void>;
  loadAllLogs:      () => Promise<void>;   // V2: load across all types
  addLog: (params: {
    logType: LogType; audioUri: string; durationSecs: number;
    tags?: string[]; transcript?: string;
  }) => Promise<LogEntry>;
  removeLog:        (id: string, audioUri: string) => Promise<void>;
  setSearchQuery:   (q: string) => Promise<void>;

  // V2 tag search
  loadTags:         () => Promise<void>;
  toggleTag:        (tag: string) => Promise<void>;
  clearTags:        () => Promise<void>;
  runFullSearch:    (query: string) => Promise<void>;
}

export const useLogStore = create<LogStore>((set, get) => ({
  entries:      [],
  allEntries:   [],
  grouped:      [],
  allGrouped:   [],
  selectedType: 'captain',
  searchQuery:  '',
  isLoading:    false,

  allTags:        [],
  activeTags:     [],
  tagResults:     [],
  isTagSearching: false,

  // ── standard list ──────────────────────────────────────────────────────────
  setSelectedType: async (t: LogType) => {
    set({ selectedType: t, isLoading: true });
    const entries = await getLogsByType(t);
    set({ entries, grouped: groupByDate(entries), isLoading: false });
  },

  loadLogs: async () => {
    set({ isLoading: true });
    const { selectedType, searchQuery } = get();
    const entries = searchQuery.trim()
      ? await searchLogs(searchQuery)
      : await getLogsByType(selectedType);
    set({ entries, grouped: groupByDate(entries), isLoading: false });
  },

  // V2: load ALL logs irrespective of type (for timeline)
  loadAllLogs: async () => {
    set({ isLoading: true });
    const all = await getAllLogs();
    set({ allEntries: all, allGrouped: groupByDate(all), isLoading: false });
  },

  addLog: async (params) => {
    const entry = await insertLog(params);
    // Refresh both filtered and all-logs lists
    await get().loadLogs();
    await get().loadAllLogs();
    await get().loadTags();
    return entry;
  },

  removeLog: async (id: string, audioUri: string) => {
    await deleteLog(id);
    try { await FileSystem.deleteAsync(audioUri, { idempotent: true }); } catch (_) {}
    await get().loadLogs();
    await get().loadAllLogs();
    await get().loadTags();
  },

  setSearchQuery: async (q: string) => {
    set({ searchQuery: q });
    await get().loadLogs();
  },

  // ── tag search (V2) ────────────────────────────────────────────────────────
  loadTags: async () => {
    const allTags = await getAllTags();
    set({ allTags });
  },

  toggleTag: async (tag: string) => {
    const { activeTags } = get();
    const next = activeTags.includes(tag)
      ? activeTags.filter(t => t !== tag)
      : [...activeTags, tag];
    set({ activeTags: next, isTagSearching: true });
    const results = await searchByTags(next);
    set({ tagResults: results, isTagSearching: false });
  },

  clearTags: async () => {
    set({ activeTags: [], isTagSearching: true });
    const results = await getAllLogs();
    set({ tagResults: results, isTagSearching: false });
  },

  runFullSearch: async (query: string) => {
    set({ isTagSearching: true, searchQuery: query });
    const results = await fullTextSearch(query);
    set({ tagResults: results, isTagSearching: false });
  },
}));
