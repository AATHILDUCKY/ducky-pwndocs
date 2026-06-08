import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'app.db');

let dbInstance: Database.Database | null = null;

/**
 * Shared SQLite connection for the application data stores
 * (projects, notes, issues). Auth users live in their own database file.
 */
export const getAppDb = (): Database.Database => {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL');
  dbInstance = db;
  return db;
};

export const DATA_DIRECTORY = DATA_DIR;
