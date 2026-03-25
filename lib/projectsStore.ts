import fs from 'node:fs';
import path from 'node:path';

export type StoredProject = {
  id: string;
  name: string;
  client: string;
  ownerUsername?: string;
  collaboratorUsernames?: string[];
  issueCount: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  lastUpdate: string;
  status: 'active' | 'archived';
  parentId?: string | null;
};

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'projects.json');

const ensureStoreFile = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, JSON.stringify({ projects: [] }, null, 2), 'utf-8');
  }
};

const readStore = (): { projects: StoredProject[] } => {
  ensureStoreFile();
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as { projects?: StoredProject[] };
    return {
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    };
  } catch {
    return { projects: [] };
  }
};

const writeStore = (payload: { projects: StoredProject[] }) => {
  ensureStoreFile();
  fs.writeFileSync(STORE_FILE, JSON.stringify(payload, null, 2), 'utf-8');
};

export const listProjects = (): StoredProject[] => {
  return readStore().projects;
};

export const listProjectsForOwner = (ownerUsername: string): StoredProject[] => {
  const normalized = ownerUsername.trim().toLowerCase();
  if (!normalized) return [];
  return readStore().projects.filter((project) => (project.ownerUsername || '').trim().toLowerCase() === normalized);
};

export const listProjectsForUser = (username: string): StoredProject[] => {
  const normalized = username.trim().toLowerCase();
  if (!normalized) return [];

  return readStore().projects.filter((project) => {
    const owner = (project.ownerUsername || '').trim().toLowerCase();
    if (owner === normalized) return true;
    return (project.collaboratorUsernames || []).some((collaborator) => collaborator.trim().toLowerCase() === normalized);
  });
};

export const canUserAccessProject = (project: StoredProject, username: string, isAdmin = false): boolean => {
  if (isAdmin) return true;
  const normalized = username.trim().toLowerCase();
  if (!normalized) return false;
  const owner = (project.ownerUsername || '').trim().toLowerCase();
  if (owner === normalized) return true;
  return (project.collaboratorUsernames || []).some((collaborator) => collaborator.trim().toLowerCase() === normalized);
};

export const findProjectById = (id: string): StoredProject | null => {
  const normalized = id.trim();
  if (!normalized) return null;
  return readStore().projects.find((project) => project.id === normalized) || null;
};

export const updateProjectIssueCounts = (
  projectId: string,
  issues: Array<{ severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Info' }>
) => {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  issues.forEach((issue) => {
    if (issue.severity === 'Critical') counts.critical += 1;
    if (issue.severity === 'High') counts.high += 1;
    if (issue.severity === 'Medium') counts.medium += 1;
    if (issue.severity === 'Low') counts.low += 1;
  });

  const now = new Date().toISOString();
  const store = readStore();
  writeStore({
    projects: store.projects.map((project) =>
      project.id === projectId
        ? {
            ...project,
            issueCount: counts,
            lastUpdate: now,
          }
        : project
    ),
  });
};

export const createProjectRecord = (payload: {
  name: string;
  client: string;
  ownerUsername?: string;
  collaboratorUsernames?: string[];
  parentId?: string | null;
  id?: string;
  issueCount?: StoredProject['issueCount'];
  lastUpdate?: string;
  status?: StoredProject['status'];
}): StoredProject => {
  const now = new Date().toISOString();
  const id = payload.id?.trim() || `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const parentId = typeof payload.parentId === 'string' ? payload.parentId.trim() : '';
  const store = readStore();
  const existing = store.projects.find((entry) => entry.id === id);
  if (existing) return existing;

  const project: StoredProject = {
    id,
    name: payload.name.trim(),
    client: payload.client.trim(),
    ownerUsername: payload.ownerUsername?.trim() || undefined,
    collaboratorUsernames: (payload.collaboratorUsernames || []).map((entry) => entry.trim()).filter(Boolean),
    parentId: parentId || null,
    issueCount: payload.issueCount || { critical: 0, high: 0, medium: 0, low: 0 },
    lastUpdate: payload.lastUpdate || now,
    status: payload.status || 'active',
  };

  writeStore({ projects: [project, ...store.projects] });
  return project;
};

export const deleteProjectRecord = (id: string): { deletedIds: string[] } => {
  const store = readStore();
  const idsToRemove = new Set<string>([id]);
  let changed = true;

  while (changed) {
    changed = false;
    store.projects.forEach((project) => {
      if (project.parentId && idsToRemove.has(project.parentId) && !idsToRemove.has(project.id)) {
        idsToRemove.add(project.id);
        changed = true;
      }
    });
  }

  const nextProjects = store.projects.filter((project) => !idsToRemove.has(project.id));
  writeStore({ projects: nextProjects });

  return { deletedIds: Array.from(idsToRemove) };
};

export const updateProjectCollaborators = (id: string, collaboratorUsernames: string[]): StoredProject | null => {
  const normalizedId = id.trim();
  if (!normalizedId) return null;

  const deduped = Array.from(
    collaboratorUsernames.reduce((map, username) => {
      const trimmed = username.trim();
      if (!trimmed) return map;
      const key = trimmed.toLowerCase();
      if (!map.has(key)) map.set(key, trimmed);
      return map;
    }, new Map<string, string>()).values()
  );

  const store = readStore();
  let updated: StoredProject | null = null;
  const projects = store.projects.map((project) => {
    if (project.id !== normalizedId) return project;
    updated = { ...project, collaboratorUsernames: deduped };
    return updated;
  });

  if (!updated) return null;
  writeStore({ projects });
  return updated;
};
