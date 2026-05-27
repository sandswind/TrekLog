import { create } from 'zustand';
import { LogEntry, LogType } from '../db/schema';
import { getLogsByType, insertLog, deleteLog, searchLogs, groupByDate } from '../db/database';
import * as FileSystem from 'expo-file-system';

interface LogStore {
  entries: LogEntry[];
  grouped: { date: string; items: LogEntry[] }[];
  selectedType: LogType;
  searchQuery: string;
  isLoading: boolean;
  setSelectedType: (t: LogType) => void;
  loadLogs: () => Promise<void>;
  addLog: (params: { logType: LogType; audioUri: string; durationSecs: number; tags?: string[]; transcript?: string; }) => Promise<LogEntry>;
  removeLog: (id: string, audioUri: string) => Promise<void>;
  setSearchQuery: (q: string) => Promise<void>;
}

export const useLogStore = create<LogStore>((set, get) => ({
  entries: [], grouped: [], selectedType: 'captain', searchQuery: '', isLoading: false,

  setSelectedType: async (t: LogType) => {
    set({ selectedType: t, isLoading: true });
    const entries = await getLogsByType(t);
    set({ entries, grouped: groupByDate(entries), isLoading: false });
  },

  loadLogs: async () => {
    set({ isLoading: true });
    const { selectedType, searchQuery } = get();
    const entries = searchQuery.trim() ? await searchLogs(searchQuery) : await getLogsByType(selectedType);
    set({ entries, grouped: groupByDate(entries), isLoading: false });
  },

  addLog: async (params) => {
    const entry = await insertLog(params);
    await get().loadLogs();
    return entry;
  },

  removeLog: async (id: string, audioUri: string) => {
    await deleteLog(id);
    try { await FileSystem.deleteAsync(audioUri, { idempotent: true }); } catch(_){}
    await get().loadLogs();
  },

  setSearchQuery: async (q: string) => {
    set({ searchQuery: q });
    await get().loadLogs();
  },
}));
