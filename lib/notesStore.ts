import fs from 'node:fs';
import path from 'node:path';
import type { Note } from '@/types';
import { getAppDb, DATA_DIRECTORY } from '@/lib/db';

const LEGACY_JSON_FILE = path.join(DATA_DIRECTORY, 'notes.json');

type NoteRow = {
  data: string;
};

let initialized = false;

const db = () => {
  const database = getAppDb();
  if (!initialized) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        projectId TEXT NOT NULL,
        id        TEXT NOT NULL,
        updatedAt TEXT,
        data      TEXT NOT NULL,
        PRIMARY KEY (projectId, id)
      );
      CREATE INDEX IF NOT EXISTS idx_notes_project ON notes(projectId);
    `);
    migrateFromJsonIfNeeded(database);
    initialized = true;
  }
  return database;
};

const sortByUpdatedDesc = (notes: Note[]): Note[] => {
  return [...notes].sort((a, b) => {
    const aTime = new Date(a.updatedAt || '').getTime();
    const bTime = new Date(b.updatedAt || '').getTime();
    return bTime - aTime;
  });
};

const insertStmt = (database = getAppDb()) =>
  database.prepare(`
    INSERT OR REPLACE INTO notes (projectId, id, updatedAt, data)
    VALUES (@projectId, @id, @updatedAt, @data)
  `);

const migrateFromJsonIfNeeded = (database: ReturnType<typeof getAppDb>) => {
  const count = (database.prepare('SELECT COUNT(*) AS n FROM notes').get() as { n: number }).n;
  if (count > 0) return;
  if (!fs.existsSync(LEGACY_JSON_FILE)) return;

  try {
    const raw = fs.readFileSync(LEGACY_JSON_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as { notes?: Record<string, Note[]> };
    const grouped = parsed.notes && typeof parsed.notes === 'object' ? parsed.notes : {};

    const insert = insertStmt(database);
    const importAll = database.transaction((map: Record<string, Note[]>) => {
      for (const [projectId, notes] of Object.entries(map)) {
        for (const note of notes || []) {
          insert.run({
            projectId: projectId.trim(),
            id: note.id,
            updatedAt: note.updatedAt || '',
            data: JSON.stringify(note),
          });
        }
      }
    });
    importAll(grouped);

    fs.renameSync(LEGACY_JSON_FILE, `${LEGACY_JSON_FILE}.bak`);
  } catch {
    // Start empty if the legacy file is unreadable.
  }
};

const readProjectNotes = (projectId: string): Note[] => {
  const rows = db()
    .prepare('SELECT data FROM notes WHERE projectId = ?')
    .all(projectId) as NoteRow[];
  return rows.map((row) => JSON.parse(row.data) as Note);
};

export const listProjectNotes = (projectId: string): Note[] => {
  const normalized = projectId.trim();
  if (!normalized) return [];
  return sortByUpdatedDesc(readProjectNotes(normalized));
};

export const upsertProjectNote = (projectId: string, note: Note): Note[] => {
  const normalized = projectId.trim();
  if (!normalized) return [];

  const now = new Date().toISOString();
  const safeNote: Note = {
    ...note,
    projectId: normalized,
    createdAt: note.createdAt || now,
    updatedAt: note.updatedAt || now,
  };

  insertStmt(db()).run({
    projectId: normalized,
    id: safeNote.id,
    updatedAt: safeNote.updatedAt || '',
    data: JSON.stringify(safeNote),
  });

  return listProjectNotes(normalized);
};

export const deleteProjectNote = (projectId: string, noteId: string): Note[] => {
  const normalized = projectId.trim();
  const targetId = noteId.trim();
  if (!normalized || !targetId) return [];

  db().prepare('DELETE FROM notes WHERE projectId = ? AND id = ?').run(normalized, targetId);
  return listProjectNotes(normalized);
};

export const removeNotesForProjects = (projectIds: string[]) => {
  const ids = projectIds.map((entry) => entry.trim()).filter(Boolean);
  if (!ids.length) return;

  const remove = db().prepare('DELETE FROM notes WHERE projectId = ?');
  const removeAll = db().transaction((list: string[]) => {
    list.forEach((id) => remove.run(id));
  });
  removeAll(ids);
};
