import fs from 'node:fs';
import path from 'node:path';
import type { Note } from '@/types';

type NotesStore = {
  notes: Record<string, Note[]>;
};

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'notes.json');

const ensureStoreFile = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, JSON.stringify({ notes: {} }, null, 2), 'utf-8');
  }
};

const readStore = (): NotesStore => {
  ensureStoreFile();
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as { notes?: Record<string, Note[]> };
    return {
      notes: parsed.notes && typeof parsed.notes === 'object' ? parsed.notes : {},
    };
  } catch {
    return { notes: {} };
  }
};

const writeStore = (payload: NotesStore) => {
  ensureStoreFile();
  fs.writeFileSync(STORE_FILE, JSON.stringify(payload, null, 2), 'utf-8');
};

const sortByUpdatedDesc = (notes: Note[]): Note[] => {
  return [...notes].sort((a, b) => {
    const aTime = new Date(a.updatedAt || '').getTime();
    const bTime = new Date(b.updatedAt || '').getTime();
    return bTime - aTime;
  });
};

export const listProjectNotes = (projectId: string): Note[] => {
  const normalized = projectId.trim();
  if (!normalized) return [];
  const store = readStore();
  return sortByUpdatedDesc(store.notes[normalized] || []);
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

  const store = readStore();
  const existing = store.notes[normalized] || [];
  const notes = sortByUpdatedDesc([safeNote, ...existing.filter((entry) => entry.id !== safeNote.id)]);

  writeStore({
    notes: {
      ...store.notes,
      [normalized]: notes,
    },
  });

  return notes;
};

export const deleteProjectNote = (projectId: string, noteId: string): Note[] => {
  const normalized = projectId.trim();
  const targetId = noteId.trim();
  if (!normalized || !targetId) return [];

  const store = readStore();
  const existing = store.notes[normalized] || [];
  const notes = sortByUpdatedDesc(existing.filter((note) => note.id !== targetId));

  writeStore({
    notes: {
      ...store.notes,
      [normalized]: notes,
    },
  });

  return notes;
};

export const removeNotesForProjects = (projectIds: string[]) => {
  if (!projectIds.length) return;
  const ids = new Set(projectIds.map((entry) => entry.trim()).filter(Boolean));
  if (!ids.size) return;

  const store = readStore();
  const notes = { ...store.notes };
  ids.forEach((id) => {
    delete notes[id];
  });

  writeStore({ notes });
};
