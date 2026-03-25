import React, { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { Plus, Search, Trash2, FileText, Save, AlertTriangle, Loader2 } from 'lucide-react';
import type { Note, Project } from '../types';
import { fetchNotes, saveNote, deleteNote } from '../services/noteService';
import { selectMediaFile, uploadMediaFile } from '../services/mediaService';
import { notify } from '../utils/notify';
const NoteEditor = lazy(() => import('./NoteEditor'));

/**
 * Small utilities
 */
const cx = (...c: Array<string | false | undefined | null>) => c.filter(Boolean).join(' ');

const formatRelativeTime = (input: string) => {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return 'Just now';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} mins ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hours ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} days ago`;
};

const createNoteId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `note-${crypto.randomUUID()}`;
  }
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

function useDebouncedCallback<T extends (...args: any[]) => void>(fn: T, delayMs: number) {
  const fnRef = useRef(fn);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const run = useCallback(
    (...args: Parameters<T>) => {
      cancel();
      timerRef.current = window.setTimeout(() => fnRef.current(...args), delayMs);
    },
    [cancel, delayMs]
  );

  useEffect(() => cancel, [cancel]);

  return { run, cancel };
}

function useHotkeys(map: Record<string, (e: KeyboardEvent) => void>, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const key = [
        e.ctrlKey || e.metaKey ? 'mod' : '',
        e.shiftKey ? 'shift' : '',
        e.altKey ? 'alt' : '',
        e.key.toLowerCase(),
      ]
        .filter(Boolean)
        .join('+');

      const fn = map[key];
      if (fn) fn(e);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [map, enabled]);
}

/**
 * Component
 */
const NotesPanel: React.FC<{
  activeProjectId: string;
  activeProject?: Project | null;
  reportPermissions?: {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
  };
}> = ({
  activeProjectId,
  activeProject,
  reportPermissions = { canView: true, canCreate: true, canEdit: true },
}) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Note | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);

  // UX: show explicit saving state + dirty tracking
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const canModifyNotes = reportPermissions.canEdit || reportPermissions.canCreate;

  // Prevent autosave firing on programmatic draft loads
  const skipAutosaveRef = useRef(false);

  // Prevent stale save responses overwriting newer edits
  const saveSeqRef = useRef(0);

  // Key for editor reset when switching note/project
  const editorKey = useMemo(
    () => `${activeProjectId || 'none'}-${activeNoteId || 'none'}`,
    [activeProjectId, activeNoteId]
  );

  const sortedNotes = useMemo(() => {
    // Always keep latest updated on top (even if backend returns different order)
    return [...notes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedNotes;
    return sortedNotes.filter((n) => (n.title || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q));
  }, [sortedNotes, search]);

  const setDraftSafely = useCallback((next: Note | null, markDirty = false) => {
    setNoteDraft(next);
    setIsDirty(markDirty);
  }, []);

  const selectNote = useCallback(
    (note: Note) => {
      setActiveNoteId(note.id);
      skipAutosaveRef.current = true;
      setDraftSafely(note, false);
      setUiError(null);
    },
    [setDraftSafely]
  );

  const refreshNotes = useCallback(async () => {
    if (!activeProjectId) return;
    setIsLoading(true);
    setUiError(null);

    try {
      const data = await fetchNotes(activeProjectId);
      setNotes(data);

      // Keep current note if it still exists
      const stillExists = activeNoteId ? data.find((n) => n.id === activeNoteId) : null;
      const nextActive = stillExists || data[0] || null;

      if (nextActive) {
        setActiveNoteId(nextActive.id);
        skipAutosaveRef.current = true;
        setDraftSafely(nextActive, false);
      } else {
        setActiveNoteId(null);
        setDraftSafely(null, false);
      }
    } catch (err: any) {
      setUiError(err?.message || 'Unable to load notes.');
      notify(err?.message || 'Unable to load notes.');
    } finally {
      setIsLoading(false);
    }
  }, [activeProjectId, activeNoteId, setDraftSafely]);

  useEffect(() => {
    refreshNotes();
  }, [activeProjectId, refreshNotes]);

  useEffect(() => {
    setNotes([]);
    setActiveNoteId(null);
    setDraftSafely(null, false);
    if (!activeProjectId) setIsLoading(false);
  }, [activeProjectId, setDraftSafely]);

  const createNote = useCallback(async () => {
    if (!canModifyNotes) {
      notify('You do not have permission to create notes.');
      return;
    }
    if (!activeProjectId) return;
    const now = new Date().toISOString();
    const existingTitles = new Set(notes.map((entry) => entry.title.trim().toLowerCase()).filter(Boolean));
    let title = 'New Note';
    let index = 2;
    while (existingTitles.has(title.toLowerCase())) {
      title = `New Note ${index}`;
      index += 1;
    }

    const local: Note = {
      id: createNoteId(),
      projectId: activeProjectId,
      title,
      content: '',
      createdAt: now,
      updatedAt: now,
    };

    // Optimistic UI
    setNotes((prev) => [local, ...prev]);
    setActiveNoteId(local.id);
    skipAutosaveRef.current = true;
    setDraftSafely(local, true);
    setUiError(null);

    try {
      const created = await saveNote(activeProjectId, local);
      if (created) {
        setNotes((prev) => [created, ...prev.filter((x) => x.id !== local.id && x.id !== created.id)]);
        setActiveNoteId(created.id);
        skipAutosaveRef.current = true;
        setDraftSafely(created, false);
      }
    } catch (err: any) {
      setUiError(err?.message || 'Unable to create note.');
      notify(err?.message || 'Unable to create note.');
    }
  }, [activeProjectId, canModifyNotes, notes, setDraftSafely]);

  const removeNote = useCallback(
    async (noteId: string) => {
      if (!canModifyNotes) {
        notify('You do not have permission to delete notes.');
        return;
      }
      const target = notes.find((n) => n.id === noteId);
      if (!target) return;

      const confirmed = window.confirm(`Delete "${target.title}"?`);
      if (!confirmed) return;

      setUiError(null);

      // Optimistic remove
      setNotes((prev) => prev.filter((n) => n.id !== noteId));

      // If we deleted the active note, switch immediately
      if (activeNoteId === noteId) {
        const next = notes.filter((n) => n.id !== noteId)[0] || null;
        setActiveNoteId(next?.id || null);
        skipAutosaveRef.current = true;
        setDraftSafely(next, false);
      }

      try {
        await deleteNote(activeProjectId, noteId);
      } catch (err: any) {
        setUiError(err?.message || 'Unable to delete note.');
        notify(err?.message || 'Unable to delete note.');
        // restore list best-effort
        refreshNotes();
      }
    },
    [activeNoteId, activeProjectId, canModifyNotes, notes, refreshNotes, setDraftSafely]
  );

  const uploadImage = useCallback(async () => {
    if (!canModifyNotes) {
      throw new Error('You do not have permission to edit notes.');
    }
    const result = await selectMediaFile('image');
    if (!result?.url) throw new Error('No file selected.');
    if (result.file) {
      try {
        const uploaded = await uploadMediaFile(result.file, 'image');
        return uploaded.url;
      } catch {
        // Fallback to local URL if upload endpoint is unavailable.
      }
    }
    return result.url as string;
  }, [canModifyNotes]);

  const flushSave = useCallback(
    async (draft: Note) => {
      if (!canModifyNotes) return;
      if (!activeProjectId) return;
      const seq = ++saveSeqRef.current;

      setIsSaving(true);
      setUiError(null);

      try {
        const updated = await saveNote(activeProjectId, {
          ...draft,
          projectId: activeProjectId,
          updatedAt: new Date().toISOString(),
        });

        // Ignore stale responses
        if (seq !== saveSeqRef.current) return;

        if (updated) {
          setNotes((prev) => {
            const next = prev.filter((n) => n.id !== updated.id);
            return [updated, ...next];
          });
          setDraftSafely(updated, false);
        } else {
          setIsDirty(false);
        }
      } catch (err: any) {
        if (seq !== saveSeqRef.current) return;
        setUiError(err?.message || 'Unable to save note.');
        notify(err?.message || 'Unable to save note.');
      } finally {
        if (seq === saveSeqRef.current) setIsSaving(false);
      }
    },
    [activeProjectId, canModifyNotes, setDraftSafely]
  );

  const debouncedAutosave = useDebouncedCallback((draft: Note) => flushSave(draft), 700);

  // Autosave
  useEffect(() => {
    if (!canModifyNotes) return;
    if (!noteDraft || !activeProjectId) return;

    if (skipAutosaveRef.current) {
      skipAutosaveRef.current = false;
      return;
    }

    if (!isDirty) return;
    debouncedAutosave.run(noteDraft);

    return () => {
      // when switching notes quickly, cancel pending save
      // (we still flush on Cmd/Ctrl+S)
      debouncedAutosave.cancel();
    };
  }, [canModifyNotes, noteDraft, activeProjectId, isDirty, debouncedAutosave]);

  // Inject copy buttons for code blocks
  useEffect(() => {
    if (!editorContainerRef.current) return;
    const container = editorContainerRef.current;

    const attachCopyButtons = () => {
      const editors = container.querySelectorAll('.cm-editor');
      editors.forEach((editor) => {
        if (editor.querySelector('.code-copy-button')) return;
        const button = document.createElement('button');
        button.className = 'code-copy-button';
        button.type = 'button';
        button.textContent = 'Copy';
        button.addEventListener('click', async () => {
          const content = editor.querySelector('.cm-content');
          const text = content?.textContent || '';
          try {
            await navigator.clipboard.writeText(text);
            button.textContent = 'Copied';
            window.setTimeout(() => {
              button.textContent = 'Copy';
            }, 1200);
          } catch {
            button.textContent = 'Failed';
            window.setTimeout(() => {
              button.textContent = 'Copy';
            }, 1200);
          }
        });
        editor.appendChild(button);
      });
    };

    attachCopyButtons();
    const observer = new MutationObserver(attachCopyButtons);
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [noteDraft?.id]);

  // Hotkeys
  useHotkeys(
    {
      'mod+s': (e) => {
        e.preventDefault();
        if (!canModifyNotes) return;
        if (noteDraft && isDirty) flushSave(noteDraft);
      },
      'mod+n': (e) => {
        e.preventDefault();
        if (!canModifyNotes) return;
        createNote();
      },
      'mod+f': (e) => {
        e.preventDefault();
        searchInputRef.current?.focus();
      },
      delete: (e) => {
        // Only if not typing in inputs
        const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        if (!canModifyNotes) return;
        if (noteDraft) removeNote(noteDraft.id);
      },
      escape: () => {
        setUiError(null);
      },
    },
    true
  );

  const canUseNotes = Boolean(activeProjectId);

  const updateDraftTitle = useCallback(
    (title: string) => {
      if (!canModifyNotes) return;
      if (!noteDraft) return;
      setDraftSafely({ ...noteDraft, title }, true);
    },
    [canModifyNotes, noteDraft, setDraftSafely]
  );

  const updateDraftContent = useCallback(
    (content: string) => {
      if (!canModifyNotes) return;
      if (!noteDraft) return;
      setDraftSafely({ ...noteDraft, content }, true);
    },
    [canModifyNotes, noteDraft, setDraftSafely]
  );

  const rightStatus = useMemo(() => {
    if (!canUseNotes) return { label: 'Offline', icon: <AlertTriangle size={14} className="text-slate-400" /> };
    if (isSaving) return { label: 'Saving…', icon: <Loader2 size={14} className="animate-spin text-indigo-600" /> };
    if (isDirty) return { label: 'Unsaved', icon: <Save size={14} className="text-slate-400" /> };
    return { label: 'Saved', icon: <Save size={14} className="text-emerald-500" /> };
  }, [canUseNotes, isDirty, isSaving]);

  return (
    <div className="flex h-[calc(100vh-220px)] bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
      {/* LEFT: list */}
      <aside className="w-80 border-r border-slate-100 bg-white/80 p-6 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">Project Notes</p>
            <h3 className="text-lg font-black text-slate-800 tracking-tight">{activeProject?.name || 'Notes'}</h3>
          </div>

          <button
            onClick={createNote}
            className={cx(
              'w-9 h-9 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100 transition-all',
              canUseNotes && canModifyNotes ? 'bg-indigo-600 text-white hover:scale-105 active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            )}
            title="New note (Ctrl/Cmd+N)"
            disabled={!canUseNotes || !canModifyNotes}
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="relative mb-4">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search notes... (Ctrl/Cmd+F)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-100 outline-none uppercase tracking-widest placeholder:text-slate-300"
          />
        </div>

        <div className="flex items-center justify-between mb-3">
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
            {isLoading ? 'Loading…' : `${filteredNotes.length} notes`}
          </p>
          <button
            onClick={refreshNotes}
            className={cx(
              'text-[9px] font-black uppercase tracking-[0.3em] px-3 py-1.5 rounded-xl border transition-all',
              canUseNotes ? 'border-slate-200 text-slate-500 hover:bg-slate-50' : 'border-slate-100 text-slate-300 cursor-not-allowed'
            )}
            disabled={!canUseNotes}
            title="Refresh"
          >
            Refresh
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
          {isLoading ? (
            <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Loading notes...</div>
          ) : filteredNotes.length ? (
            filteredNotes.map((note) => (
              <button
                key={note.id}
                onClick={() => selectNote(note)}
                className={cx(
                  'w-full text-left p-4 rounded-2xl border transition-all group',
                  activeNoteId === note.id
                    ? 'border-indigo-200 bg-indigo-50/60'
                    : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black text-slate-800 truncate">{note.title}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                      {formatRelativeTime(note.updatedAt)}
                    </p>
                  </div>
                  <FileText size={14} className="text-slate-300 group-hover:text-slate-400 transition-colors" />
                </div>
              </button>
            ))
          ) : (
            <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">No notes yet</div>
          )}
        </div>
      </aside>

      {/* RIGHT: editor */}
      <section className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100">
          <div>
            <p className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.4em]">Markdown Workspace</p>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">{noteDraft?.title || 'Select a note'}</h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-slate-100 bg-white shadow-sm">
              {rightStatus.icon}
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">{rightStatus.label}</span>
            </div>

            {noteDraft && canModifyNotes && (
              <>
                <button
                  onClick={() => noteDraft && isDirty && flushSave(noteDraft)}
                  disabled={!canUseNotes || !isDirty || isSaving}
                  className={cx(
                    'px-3 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl border transition-all',
                    !canUseNotes || !isDirty || isSaving
                      ? 'border-slate-100 text-slate-300 bg-slate-50 cursor-not-allowed'
                      : 'border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100'
                  )}
                  title="Save now (Ctrl/Cmd+S)"
                >
                  <Save size={12} className="inline mr-1" />
                  Save
                </button>

                <button
                  onClick={() => removeNote(noteDraft.id)}
                  className="px-3 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 transition-all"
                  title="Delete (Del)"
                  disabled={!canUseNotes}
                >
                  <Trash2 size={12} className="inline mr-1" /> Delete
                </button>
              </>
            )}
          </div>
        </div>

        {uiError && (
          <div className="mx-8 mt-4 bg-rose-50/80 border border-rose-100 text-rose-600 text-[10px] font-black uppercase tracking-[0.25em] px-6 py-3 rounded-2xl flex items-center gap-2">
            <AlertTriangle size={14} />
            <span>{uiError}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/40 custom-scrollbar">
          {!noteDraft ? (
            <div className="h-full flex items-center justify-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
              Select or create a note
            </div>
          ) : (
            <div className="w-full max-w-none space-y-6">
              <input
                type="text"
                value={noteDraft.title}
                onChange={(e) => updateDraftTitle(e.target.value)}
                disabled={!canModifyNotes}
                className="w-full text-3xl font-black text-slate-900 tracking-tight p-3 rounded-2xl border border-slate-100 bg-white shadow-sm outline-none focus:ring-4 focus:ring-indigo-500/10"
                placeholder="Note title..."
              />

              <div ref={editorContainerRef} className="bg-white rounded-2xl border border-slate-100 shadow-sm">
                <Suspense
                  fallback={
                    <div className="p-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Loading editor...
                    </div>
                  }
                >
                  <NoteEditor
                    editorKey={editorKey}
                    markdown={noteDraft.content || ''}
                    onChange={(value) => updateDraftContent(value)}
                    onUploadImage={uploadImage}
                  />
                </Suspense>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
                <span className="px-3 py-2 rounded-2xl border border-slate-100 bg-white">Ctrl/Cmd+S save</span>
                <span className="px-3 py-2 rounded-2xl border border-slate-100 bg-white">Ctrl/Cmd+N new</span>
                <span className="px-3 py-2 rounded-2xl border border-slate-100 bg-white">Ctrl/Cmd+F search</span>
                <span className="px-3 py-2 rounded-2xl border border-slate-100 bg-white">Del delete</span>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default NotesPanel;
