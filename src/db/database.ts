import * as SQLite from 'expo-sqlite';
import { LogEntry, LogType, CREATE_TABLE_SQL, CREATE_INDEX_SQL } from './schema';
import { toStardate, generateLogHeader, toDateKey } from '../utils/stardate';

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('treklog.db');
  await _db.execAsync(CREATE_TABLE_SQL);
  await _db.execAsync(CREATE_INDEX_SQL);
  return _db;
}

export async function insertLog(params: {
  logType: LogType; audioUri: string; durationSecs: number;
  tags?: string[]; transcript?: string;
}): Promise<LogEntry> {
  const db = await getDb();
  const now = new Date();
  const dateKey = toDateKey(now);
  const existing = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM log_entries WHERE createdAt LIKE ?`, [`${dateKey}%`]
  );
  const isFirstOfDay = (existing?.count ?? 0) === 0;
  const LOG_LABELS: Record<LogType, string> = { captain:"Captain's Log", personal:'Personal Log', medical:'Medical Log' };
  const entry: LogEntry = {
    id: uuidv4(), logType: params.logType,
    title: isFirstOfDay ? generateLogHeader(now, LOG_LABELS[params.logType])
                        : `${LOG_LABELS[params.logType]} — ${now.toLocaleTimeString()}`,
    audioUri: params.audioUri, durationSecs: params.durationSecs,
    stardate: toStardate(now), createdAt: now.toISOString(),
    tags: JSON.stringify(params.tags ?? []), transcript: params.transcript,
    mood: undefined, isFirstOfDay,
  };
  await db.runAsync(
    `INSERT INTO log_entries (id,logType,title,audioUri,durationSecs,stardate,createdAt,tags,transcript,mood,isFirstOfDay) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [entry.id,entry.logType,entry.title,entry.audioUri,entry.durationSecs,entry.stardate,entry.createdAt,entry.tags,entry.transcript??null,entry.mood??null,entry.isFirstOfDay?1:0]
  );
  return entry;
}

export async function getAllLogs(): Promise<LogEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(`SELECT * FROM log_entries ORDER BY createdAt DESC`);
  return rows.map(normalizeRow);
}

export async function getLogsByType(logType: LogType): Promise<LogEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(`SELECT * FROM log_entries WHERE logType=? ORDER BY createdAt DESC`,[logType]);
  return rows.map(normalizeRow);
}

export async function searchLogs(query: string): Promise<LogEntry[]> {
  const db = await getDb();
  const q = `%${query}%`;
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM log_entries WHERE title LIKE ? OR transcript LIKE ? OR tags LIKE ? ORDER BY createdAt DESC`,[q,q,q]
  );
  return rows.map(normalizeRow);
}

export async function deleteLog(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM log_entries WHERE id=?`,[id]);
}

export async function updateLogTitle(id: string, title: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE log_entries SET title=? WHERE id=?`,[title,id]);
}

function normalizeRow(row: any): LogEntry {
  return { ...row, isFirstOfDay: row.isFirstOfDay === 1, tags: row.tags ?? '[]' };
}

export function groupByDate(entries: LogEntry[]): { date: string; items: LogEntry[] }[] {
  const map = new Map<string, LogEntry[]>();
  for (const e of entries) {
    const key = e.createdAt.split('T')[0];
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
}

// ── V2: tag helpers ───────────────────────────────────────────────────────────

/** Return all unique tags across every log entry (sorted alphabetically) */
export async function getAllTags(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ tags: string }>(`SELECT tags FROM log_entries`);
  const set = new Set<string>();
  for (const row of rows) {
    try {
      const arr: string[] = JSON.parse(row.tags || '[]');
      arr.forEach(t => t.trim() && set.add(t.trim()));
    } catch (_) {}
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** Search logs that contain ALL of the given tags */
export async function searchByTags(tags: string[]): Promise<LogEntry[]> {
  if (tags.length === 0) return getAllLogs();
  const db = await getDb();
  // SQLite LIKE-based tag filter — works for JSON-serialised arrays
  const conditions = tags.map(() => `tags LIKE ?`).join(' AND ');
  const params = tags.map(t => `%"${t}"%`);
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM log_entries WHERE ${conditions} ORDER BY createdAt DESC`,
    params
  );
  return rows.map(normalizeRow);
}

/** Full-text search across title + transcript + tags */
export async function fullTextSearch(query: string): Promise<LogEntry[]> {
  if (!query.trim()) return getAllLogs();
  const db = await getDb();
  const q = `%${query.trim()}%`;
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM log_entries
     WHERE title LIKE ? OR transcript LIKE ? OR tags LIKE ? OR stardate LIKE ?
     ORDER BY createdAt DESC`,
    [q, q, q, q]
  );
  return rows.map(normalizeRow);
}
