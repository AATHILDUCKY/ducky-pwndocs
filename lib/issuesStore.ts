import fs from 'node:fs';
import path from 'node:path';
import type { Issue } from '@/types';
import { getAppDb, DATA_DIRECTORY } from '@/lib/db';

const LEGACY_JSON_FILE = path.join(DATA_DIRECTORY, 'issues.json');

type IssueRow = {
  data: string;
};

let initialized = false;

const db = () => {
  const database = getAppDb();
  if (!initialized) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS issues (
        projectId TEXT NOT NULL,
        id        TEXT NOT NULL,
        updatedAt TEXT,
        data      TEXT NOT NULL,
        PRIMARY KEY (projectId, id)
      );
      CREATE INDEX IF NOT EXISTS idx_issues_project ON issues(projectId);
    `);
    migrateFromJsonIfNeeded(database);
    initialized = true;
  }
  return database;
};

const sortByUpdatedDesc = (items: Issue[]) =>
  [...items].sort((a, b) => {
    const aTime = new Date(a.updatedAt || '').getTime();
    const bTime = new Date(b.updatedAt || '').getTime();
    return bTime - aTime;
  });

const insertStmt = (database = getAppDb()) =>
  database.prepare(`
    INSERT OR REPLACE INTO issues (projectId, id, updatedAt, data)
    VALUES (@projectId, @id, @updatedAt, @data)
  `);

const migrateFromJsonIfNeeded = (database: ReturnType<typeof getAppDb>) => {
  const count = (database.prepare('SELECT COUNT(*) AS n FROM issues').get() as { n: number }).n;
  if (count > 0) return;
  if (!fs.existsSync(LEGACY_JSON_FILE)) return;

  try {
    const raw = fs.readFileSync(LEGACY_JSON_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as { issues?: Record<string, Issue[]> };
    const grouped = parsed.issues && typeof parsed.issues === 'object' ? parsed.issues : {};

    const insert = insertStmt(database);
    const importAll = database.transaction((map: Record<string, Issue[]>) => {
      for (const [projectId, issues] of Object.entries(map)) {
        for (const issue of issues || []) {
          insert.run({
            projectId: projectId.trim(),
            id: issue.id,
            updatedAt: issue.updatedAt || '',
            data: JSON.stringify(issue),
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

const readProjectIssues = (projectId: string): Issue[] => {
  const rows = db()
    .prepare('SELECT data FROM issues WHERE projectId = ?')
    .all(projectId) as IssueRow[];
  return rows.map((row) => JSON.parse(row.data) as Issue);
};

export const listProjectIssues = (projectId: string): Issue[] => {
  if (!projectId?.trim()) return [];
  return sortByUpdatedDesc(readProjectIssues(projectId.trim()));
};

export const upsertProjectIssue = (projectId: string, issue: Issue): Issue[] => {
  const normalized = projectId.trim();
  const nextIssue: Issue = {
    ...issue,
    updatedAt: issue.updatedAt || new Date().toISOString(),
  };

  insertStmt(db()).run({
    projectId: normalized,
    id: nextIssue.id,
    updatedAt: nextIssue.updatedAt || '',
    data: JSON.stringify(nextIssue),
  });

  return listProjectIssues(normalized);
};

export const deleteProjectIssue = (projectId: string, issueId: string): Issue[] => {
  const normalized = projectId.trim();
  db().prepare('DELETE FROM issues WHERE projectId = ? AND id = ?').run(normalized, issueId);
  return listProjectIssues(normalized);
};

export const removeIssuesForProjects = (projectIds: string[]) => {
  const ids = projectIds.map((entry) => entry.trim()).filter(Boolean);
  if (!ids.length) return;

  const remove = db().prepare('DELETE FROM issues WHERE projectId = ?');
  const removeAll = db().transaction((list: string[]) => {
    list.forEach((id) => remove.run(id));
  });
  removeAll(ids);
};
