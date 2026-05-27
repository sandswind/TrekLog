export type LogType = 'captain' | 'personal' | 'medical';

export interface LogEntry {
  id: string;
  logType: LogType;
  title: string;
  audioUri: string;
  durationSecs: number;
  stardate: string;
  createdAt: string;
  tags: string;
  transcript?: string;
  mood?: string;
  isFirstOfDay: boolean;
}

export const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS log_entries (
    id           TEXT PRIMARY KEY NOT NULL,
    logType      TEXT NOT NULL DEFAULT 'captain',
    title        TEXT NOT NULL DEFAULT '',
    audioUri     TEXT NOT NULL,
    durationSecs REAL NOT NULL DEFAULT 0,
    stardate     TEXT NOT NULL,
    createdAt    TEXT NOT NULL,
    tags         TEXT NOT NULL DEFAULT '[]',
    transcript   TEXT,
    mood         TEXT,
    isFirstOfDay INTEGER NOT NULL DEFAULT 0
  );
`;

export const CREATE_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_log_createdAt ON log_entries(createdAt DESC);
`;
