import fs from 'node:fs';
import path from 'node:path';
import { getAppDb, DATA_DIRECTORY } from '@/lib/db';

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

const LEGACY_JSON_FILE = path.join(DATA_DIRECTORY, 'projects.json');

type ProjectRow = {
  id: string;
  name: string;
  client: string;
  ownerUsername: string | null;
  collaboratorUsernames: string | null;
  issueCritical: number;
  issueHigh: number;
  issueMedium: number;
  issueLow: number;
  lastUpdate: string;
  status: string;
  parentId: string | null;
};

let initialized = false;

const db = () => {
  const database = getAppDb();
  if (!initialized) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id                     TEXT PRIMARY KEY,
        name                   TEXT NOT NULL DEFAULT '',
        client                 TEXT NOT NULL DEFAULT '',
        ownerUsername          TEXT,
        collaboratorUsernames  TEXT,
        issueCritical          INTEGER NOT NULL DEFAULT 0,
        issueHigh              INTEGER NOT NULL DEFAULT 0,
        issueMedium            INTEGER NOT NULL DEFAULT 0,
        issueLow               INTEGER NOT NULL DEFAULT 0,
        lastUpdate             TEXT NOT NULL,
        status                 TEXT NOT NULL DEFAULT 'active',
        parentId               TEXT,
        sortOrder              INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(ownerUsername);
    `);
    migrateFromJsonIfNeeded(database);
    initialized = true;
  }
  return database;
};

const rowToProject = (row: ProjectRow): StoredProject => ({
  id: row.id,
  name: row.name,
  client: row.client,
  ownerUsername: row.ownerUsername ?? undefined,
  collaboratorUsernames: row.collaboratorUsernames ? (JSON.parse(row.collaboratorUsernames) as string[]) : [],
  issueCount: {
    critical: row.issueCritical,
    high: row.issueHigh,
    medium: row.issueMedium,
    low: row.issueLow,
  },
  lastUpdate: row.lastUpdate,
  status: (row.status as StoredProject['status']) || 'active',
  parentId: row.parentId ?? null,
});

const insertStmt = (database = getAppDb()) =>
  database.prepare(`
    INSERT OR REPLACE INTO projects
      (id, name, client, ownerUsername, collaboratorUsernames,
       issueCritical, issueHigh, issueMedium, issueLow,
       lastUpdate, status, parentId, sortOrder)
    VALUES
      (@id, @name, @client, @ownerUsername, @collaboratorUsernames,
       @issueCritical, @issueHigh, @issueMedium, @issueLow,
       @lastUpdate, @status, @parentId, @sortOrder)
  `);

const projectToParams = (project: StoredProject, sortOrder: number) => ({
  id: project.id,
  name: project.name,
  client: project.client,
  ownerUsername: project.ownerUsername ?? null,
  collaboratorUsernames: JSON.stringify(project.collaboratorUsernames || []),
  issueCritical: project.issueCount.critical,
  issueHigh: project.issueCount.high,
  issueMedium: project.issueCount.medium,
  issueLow: project.issueCount.low,
  lastUpdate: project.lastUpdate,
  status: project.status,
  parentId: project.parentId ?? null,
  sortOrder,
});

// Preserve original ordering (newest-first prepend) via an explicit sortOrder column.
const nextSortOrder = (database: ReturnType<typeof getAppDb>): number => {
  const row = database.prepare('SELECT MIN(sortOrder) AS min FROM projects').get() as { min: number | null };
  return (row.min ?? 0) - 1;
};

const migrateFromJsonIfNeeded = (database: ReturnType<typeof getAppDb>) => {
  const count = (database.prepare('SELECT COUNT(*) AS n FROM projects').get() as { n: number }).n;
  if (count > 0) return;
  if (!fs.existsSync(LEGACY_JSON_FILE)) return;

  try {
    const raw = fs.readFileSync(LEGACY_JSON_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as { projects?: StoredProject[] };
    const projects = Array.isArray(parsed.projects) ? parsed.projects : [];
    if (!projects.length) return;

    const insert = insertStmt(database);
    const importAll = database.transaction((records: StoredProject[]) => {
      // Keep the JSON file order: first item gets the highest sortOrder.
      records.forEach((project, index) => {
        insert.run(projectToParams(project, records.length - index));
      });
    });
    importAll(projects);

    fs.renameSync(LEGACY_JSON_FILE, `${LEGACY_JSON_FILE}.bak`);
  } catch {
    // Start empty if the legacy file is unreadable.
  }
};

export const listProjects = (): StoredProject[] => {
  const rows = db()
    .prepare('SELECT * FROM projects ORDER BY sortOrder DESC')
    .all() as ProjectRow[];
  return rows.map(rowToProject);
};

export const listProjectsForOwner = (ownerUsername: string): StoredProject[] => {
  const normalized = ownerUsername.trim().toLowerCase();
  if (!normalized) return [];
  return listProjects().filter((project) => (project.ownerUsername || '').trim().toLowerCase() === normalized);
};

export const listProjectsForUser = (username: string): StoredProject[] => {
  const normalized = username.trim().toLowerCase();
  if (!normalized) return [];

  return listProjects().filter((project) => {
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
  const row = db().prepare('SELECT * FROM projects WHERE id = ? LIMIT 1').get(normalized) as ProjectRow | undefined;
  return row ? rowToProject(row) : null;
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

  db()
    .prepare(
      `UPDATE projects SET
         issueCritical = @critical, issueHigh = @high,
         issueMedium = @medium, issueLow = @low, lastUpdate = @lastUpdate
       WHERE id = @id`
    )
    .run({ ...counts, lastUpdate: new Date().toISOString(), id: projectId });
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
  const database = db();
  const now = new Date().toISOString();
  const id = payload.id?.trim() || `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const parentId = typeof payload.parentId === 'string' ? payload.parentId.trim() : '';

  const existing = findProjectById(id);
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

  insertStmt(database).run(projectToParams(project, nextSortOrder(database)));
  return project;
};

export const deleteProjectRecord = (id: string): { deletedIds: string[] } => {
  const database = db();
  const all = listProjects();
  const idsToRemove = new Set<string>([id]);
  let changed = true;

  while (changed) {
    changed = false;
    all.forEach((project) => {
      if (project.parentId && idsToRemove.has(project.parentId) && !idsToRemove.has(project.id)) {
        idsToRemove.add(project.id);
        changed = true;
      }
    });
  }

  const remove = database.prepare('DELETE FROM projects WHERE id = ?');
  const removeAll = database.transaction((ids: string[]) => {
    ids.forEach((entry) => remove.run(entry));
  });
  removeAll(Array.from(idsToRemove));

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

  const existing = findProjectById(normalizedId);
  if (!existing) return null;

  db()
    .prepare('UPDATE projects SET collaboratorUsernames = ? WHERE id = ?')
    .run(JSON.stringify(deduped), normalizedId);

  return { ...existing, collaboratorUsernames: deduped };
};
