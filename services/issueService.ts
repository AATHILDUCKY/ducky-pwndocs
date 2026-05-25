import type { Issue } from '../types';
import { readStore, sortByUpdateDesc, updateProjectCounts, writeStore } from './webStore';
import { recordChange } from './auditService';

// In-memory cache so switching back to a visited project is instant
const memCache = new Map<string, { data: Issue[]; ts: number }>();
const CACHE_TTL_MS = 45_000; // 45 s — fresh enough, avoids constant re-fetches

export const invalidateIssueCache = (projectId: string) => memCache.delete(projectId);

const syncLocalIssues = (projectId: string, issues: Issue[]) => {
  writeStore((store) => {
    const nextStore = {
      ...store,
      issues: {
        ...store.issues,
        [projectId]: issues,
      },
    };
    return updateProjectCounts(nextStore, projectId);
  });
};

const seedServerIssuesFromLocal = async (projectId: string, localIssues: Issue[]): Promise<Issue[]> => {
  for (const issue of localIssues) {
    await fetch(`/api/issues/${encodeURIComponent(projectId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue }),
    });
  }

  const response = await fetch(`/api/issues/${encodeURIComponent(projectId)}`, { cache: 'no-store' });
  if (!response.ok) return sortByUpdateDesc(localIssues);
  const body = (await response.json()) as { issues?: Issue[] };
  const issues = sortByUpdateDesc(Array.isArray(body.issues) ? body.issues : localIssues);
  syncLocalIssues(projectId, issues);
  return issues;
};

export const fetchIssues = async (projectId: string): Promise<Issue[]> => {
  if (!projectId) return [];

  // Return in-memory cache if still fresh
  const hit = memCache.get(projectId);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;

  if (typeof window !== 'undefined') {
    try {
      const response = await fetch(`/api/issues/${encodeURIComponent(projectId)}`);
      if (!response.ok) throw new Error('Failed to fetch issues.');

      const body = (await response.json()) as { issues?: Issue[] };
      const issues = sortByUpdateDesc(Array.isArray(body.issues) ? body.issues : []);
      const localIssues = sortByUpdateDesc(readStore().issues[projectId] || []);
      const result = !issues.length && localIssues.length
        ? await seedServerIssuesFromLocal(projectId, localIssues)
        : issues;
      syncLocalIssues(projectId, result);
      memCache.set(projectId, { data: result, ts: Date.now() });
      return result;
    } catch {
      // fall through to local store
    }
  }

  const local = sortByUpdateDesc(readStore().issues[projectId] || []);
  memCache.set(projectId, { data: local, ts: Date.now() });
  return local;
};

export const persistIssue = async (projectId: string, issue: Issue): Promise<void> => {
  if (!projectId || !issue) return;
  const exists = (readStore().issues[projectId] || []).some((entry) => entry.id === issue.id);

  if (typeof window !== 'undefined') {
    const response = await fetch(`/api/issues/${encodeURIComponent(projectId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || 'Unable to persist finding.');
    }

    const body = (await response.json()) as { issues?: Issue[] };
    const issues = sortByUpdateDesc(Array.isArray(body.issues) ? body.issues : []);
    syncLocalIssues(projectId, issues);
    invalidateIssueCache(projectId);

    recordChange({
      action: exists ? 'Updated finding' : 'Created finding',
      targetType: 'finding',
      targetId: issue.id,
      targetName: issue.title || 'Untitled finding',
      projectId,
      details: `Severity: ${issue.severity}`,
    });
    return;
  }

  writeStore((store) => {
    const existing = store.issues[projectId] || [];
    const nextIssue: Issue = {
      ...issue,
      updatedAt: issue.updatedAt || new Date().toISOString(),
    };
    const issues = sortByUpdateDesc([
      nextIssue,
      ...existing.filter((entry) => entry.id !== nextIssue.id),
    ]);

    const nextStore = {
      ...store,
      issues: {
        ...store.issues,
        [projectId]: issues,
      },
    };

    return updateProjectCounts(nextStore, projectId);
  });

  recordChange({
    action: exists ? 'Updated finding' : 'Created finding',
    targetType: 'finding',
    targetId: issue.id,
    targetName: issue.title || 'Untitled finding',
    projectId,
    details: `Severity: ${issue.severity}`,
  });
};

export const deleteIssue = async (projectId: string, issueId: string): Promise<void> => {
  if (!projectId || !issueId) return;
  const deletedIssue = (readStore().issues[projectId] || []).find((issue) => issue.id === issueId);

  if (typeof window !== 'undefined') {
    const response = await fetch(`/api/issues/${encodeURIComponent(projectId)}/${encodeURIComponent(issueId)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || 'Unable to delete finding.');
    }

    const body = (await response.json()) as { issues?: Issue[] };
    const issues = sortByUpdateDesc(Array.isArray(body.issues) ? body.issues : []);
    syncLocalIssues(projectId, issues);
    invalidateIssueCache(projectId);

    recordChange({
      action: 'Deleted finding',
      targetType: 'finding',
      targetId: issueId,
      targetName: deletedIssue?.title || 'Finding',
      projectId,
    });
    return;
  }

  writeStore((store) => {
    const existing = store.issues[projectId] || [];
    const nextStore = {
      ...store,
      issues: {
        ...store.issues,
        [projectId]: existing.filter((issue) => issue.id !== issueId),
      },
    };

    return updateProjectCounts(nextStore, projectId);
  });

  recordChange({
    action: 'Deleted finding',
    targetType: 'finding',
    targetId: issueId,
    targetName: deletedIssue?.title || 'Finding',
    projectId,
  });
};
