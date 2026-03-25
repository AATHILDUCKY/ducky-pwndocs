import type { Note } from '../types';
import { readStore, sortByUpdateDesc, writeStore } from './webStore';
import { recordChange } from './auditService';

const syncLocalNotes = (projectId: string, notes: Note[]) => {
  writeStore((store) => ({
    ...store,
    notes: {
      ...store.notes,
      [projectId]: sortByUpdateDesc(notes),
    },
  }));
};

const seedServerNotesFromLocal = async (projectId: string, localNotes: Note[]): Promise<Note[]> => {
  for (const note of localNotes) {
    await fetch(`/api/notes/${encodeURIComponent(projectId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    });
  }

  const response = await fetch(`/api/notes/${encodeURIComponent(projectId)}`, { cache: 'no-store' });
  if (!response.ok) return sortByUpdateDesc(localNotes);
  const body = (await response.json()) as { notes?: Note[] };
  const notes = sortByUpdateDesc(Array.isArray(body.notes) ? body.notes : localNotes);
  syncLocalNotes(projectId, notes);
  return notes;
};

export const fetchNotes = async (projectId: string): Promise<Note[]> => {
  if (!projectId) return [];
  if (typeof window !== 'undefined') {
    try {
      const response = await fetch(`/api/notes/${encodeURIComponent(projectId)}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to fetch notes.');
      }

      const body = (await response.json()) as { notes?: Note[] };
      const notes = sortByUpdateDesc(Array.isArray(body.notes) ? body.notes : []);
      const localNotes = sortByUpdateDesc(readStore().notes[projectId] || []);
      if (!notes.length && localNotes.length) {
        return await seedServerNotesFromLocal(projectId, localNotes);
      }
      syncLocalNotes(projectId, notes);
      return notes;
    } catch {
      // fallback to local cache
    }
  }

  const store = readStore();
  return sortByUpdateDesc(store.notes[projectId] || []);
};

export const saveNote = async (projectId: string, note: Note): Promise<Note | null> => {
  if (!projectId || !note) return null;
  const exists = (readStore().notes[projectId] || []).some((entry) => entry.id === note.id);

  const saved: Note = {
    ...note,
    projectId,
    updatedAt: new Date().toISOString(),
    createdAt: note.createdAt || new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    const response = await fetch(`/api/notes/${encodeURIComponent(projectId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: saved }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || 'Unable to save note.');
    }

    const body = (await response.json()) as { notes?: Note[] };
    const notes = sortByUpdateDesc(Array.isArray(body.notes) ? body.notes : []);
    syncLocalNotes(projectId, notes);
  } else {
    writeStore((store) => {
      const existing = store.notes[projectId] || [];
      return {
        ...store,
        notes: {
          ...store.notes,
          [projectId]: sortByUpdateDesc([
            saved,
            ...existing.filter((entry) => entry.id !== saved.id),
          ]),
        },
      };
    });
  }

  recordChange({
    action: exists ? 'Updated note' : 'Created note',
    targetType: 'note',
    targetId: saved.id,
    targetName: saved.title || 'Untitled note',
    projectId,
  });

  return saved;
};

export const deleteNote = async (projectId: string, noteId: string): Promise<void> => {
  if (!projectId || !noteId) return;
  const deleted = (readStore().notes[projectId] || []).find((note) => note.id === noteId);

  if (typeof window !== 'undefined') {
    const response = await fetch(`/api/notes/${encodeURIComponent(projectId)}/${encodeURIComponent(noteId)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || 'Unable to delete note.');
    }

    const body = (await response.json()) as { notes?: Note[] };
    const notes = sortByUpdateDesc(Array.isArray(body.notes) ? body.notes : []);
    syncLocalNotes(projectId, notes);
  } else {
    writeStore((store) => ({
      ...store,
      notes: {
        ...store.notes,
        [projectId]: (store.notes[projectId] || []).filter((note) => note.id !== noteId),
      },
    }));
  }

  recordChange({
    action: 'Deleted note',
    targetType: 'note',
    targetId: noteId,
    targetName: deleted?.title || 'Note',
    projectId,
  });
};
