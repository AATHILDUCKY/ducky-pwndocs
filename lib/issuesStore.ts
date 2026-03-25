import fs from 'node:fs';
import path from 'node:path';
import type { Issue } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'issues.json');

type IssuesStore = {
  issues: Record<string, Issue[]>;
};

const ensureStoreFile = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, JSON.stringify({ issues: {} }, null, 2), 'utf-8');
  }
};

const readStore = (): IssuesStore => {
  ensureStoreFile();
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as { issues?: Record<string, Issue[]> };
    return {
      issues: parsed.issues && typeof parsed.issues === 'object' ? parsed.issues : {},
    };
  } catch {
    return { issues: {} };
  }
};

const writeStore = (payload: IssuesStore) => {
  ensureStoreFile();
  fs.writeFileSync(STORE_FILE, JSON.stringify(payload, null, 2), 'utf-8');
};

const sortByUpdatedDesc = (items: Issue[]) =>
  [...items].sort((a, b) => {
    const aTime = new Date(a.updatedAt || '').getTime();
    const bTime = new Date(b.updatedAt || '').getTime();
    return bTime - aTime;
  });

export const listProjectIssues = (projectId: string): Issue[] => {
  if (!projectId?.trim()) return [];
  const store = readStore();
  return sortByUpdatedDesc(store.issues[projectId] || []);
};

export const upsertProjectIssue = (projectId: string, issue: Issue): Issue[] => {
  const store = readStore();
  const existing = store.issues[projectId] || [];
  const nextIssue: Issue = {
    ...issue,
    updatedAt: issue.updatedAt || new Date().toISOString(),
  };

  const issues = sortByUpdatedDesc([
    nextIssue,
    ...existing.filter((entry) => entry.id !== nextIssue.id),
  ]);

  writeStore({
    issues: {
      ...store.issues,
      [projectId]: issues,
    },
  });

  return issues;
};

export const deleteProjectIssue = (projectId: string, issueId: string): Issue[] => {
  const store = readStore();
  const existing = store.issues[projectId] || [];
  const issues = existing.filter((issue) => issue.id !== issueId);

  writeStore({
    issues: {
      ...store.issues,
      [projectId]: issues,
    },
  });

  return sortByUpdatedDesc(issues);
};

export const removeIssuesForProjects = (projectIds: string[]) => {
  if (!projectIds.length) return;

  const store = readStore();
  const nextIssues = { ...store.issues };
  projectIds.forEach((id) => {
    delete nextIssues[id];
  });
  writeStore({ issues: nextIssues });
};
