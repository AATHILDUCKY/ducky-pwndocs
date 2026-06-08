import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export type ReportPermissions = {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
};

export type AuthUserRecord = {
  username: string;
  role: 'Admin' | 'Analyst' | 'Viewer' | 'User';
  email?: string;
  fullName?: string;
  permissions?: ReportPermissions;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'auth-users.db');
const LEGACY_JSON_FILE = path.join(DATA_DIR, 'auth-users.json');

type UserRow = {
  username: string;
  role: string;
  email: string | null;
  fullName: string | null;
  canView: number;
  canCreate: number;
  canEdit: number;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

let dbInstance: Database.Database | null = null;

const getDb = (): Database.Database => {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_users (
      username     TEXT PRIMARY KEY,
      role         TEXT NOT NULL DEFAULT 'User',
      email        TEXT,
      fullName     TEXT,
      canView      INTEGER NOT NULL DEFAULT 1,
      canCreate    INTEGER NOT NULL DEFAULT 1,
      canEdit      INTEGER NOT NULL DEFAULT 1,
      passwordHash TEXT NOT NULL DEFAULT '',
      createdAt    TEXT NOT NULL,
      updatedAt    TEXT NOT NULL
    );
  `);

  dbInstance = db;
  migrateFromJsonIfNeeded(db);
  return db;
};

const rowToRecord = (row: UserRow): AuthUserRecord => ({
  username: row.username,
  role: row.role as AuthUserRecord['role'],
  email: row.email ?? undefined,
  fullName: row.fullName ?? undefined,
  permissions: {
    canView: !!row.canView,
    canCreate: !!row.canCreate,
    canEdit: !!row.canEdit,
  },
  passwordHash: row.passwordHash,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

// One-time import of any pre-existing JSON store into SQLite so we don't lose
// accounts created before the database migration.
const migrateFromJsonIfNeeded = (db: Database.Database) => {
  const count = (db.prepare('SELECT COUNT(*) AS n FROM auth_users').get() as { n: number }).n;
  if (count > 0) return;
  if (!fs.existsSync(LEGACY_JSON_FILE)) return;

  try {
    const raw = fs.readFileSync(LEGACY_JSON_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as { users?: AuthUserRecord[] };
    const users = Array.isArray(parsed.users) ? parsed.users : [];
    if (!users.length) return;

    const insert = db.prepare(`
      INSERT OR IGNORE INTO auth_users
        (username, role, email, fullName, canView, canCreate, canEdit, passwordHash, createdAt, updatedAt)
      VALUES
        (@username, @role, @email, @fullName, @canView, @canCreate, @canEdit, @passwordHash, @createdAt, @updatedAt)
    `);

    const importAll = db.transaction((records: AuthUserRecord[]) => {
      for (const user of records) {
        const permissions = normalizePermissions(user.role, user.permissions);
        insert.run({
          username: user.username.trim(),
          role: user.role || 'User',
          email: user.email ?? null,
          fullName: user.fullName ?? null,
          canView: permissions.canView ? 1 : 0,
          canCreate: permissions.canCreate ? 1 : 0,
          canEdit: permissions.canEdit ? 1 : 0,
          passwordHash: user.passwordHash || '',
          createdAt: user.createdAt || new Date().toISOString(),
          updatedAt: user.updatedAt || new Date().toISOString(),
        });
      }
    });

    importAll(users);

    // Preserve the original file as a backup so the migration is reversible.
    fs.renameSync(LEGACY_JSON_FILE, `${LEGACY_JSON_FILE}.bak`);
  } catch {
    // If the legacy file is unreadable we simply start with an empty database.
  }
};

export const defaultPermissionsForRole = (role?: AuthUserRecord['role']): ReportPermissions => {
  if (role === 'Viewer') {
    return { canView: true, canCreate: false, canEdit: false };
  }
  return { canView: true, canCreate: true, canEdit: true };
};

const normalizePermissions = (
  role?: AuthUserRecord['role'],
  permissions?: Partial<ReportPermissions> | null
): ReportPermissions => {
  const base = defaultPermissionsForRole(role);
  return {
    canView: permissions?.canView ?? base.canView,
    canCreate: permissions?.canCreate ?? base.canCreate,
    canEdit: permissions?.canEdit ?? base.canEdit,
  };
};

export const findAuthUser = (username: string): AuthUserRecord | null => {
  const normalized = username.trim().toLowerCase();
  if (!normalized) return null;

  const row = getDb()
    .prepare('SELECT * FROM auth_users WHERE LOWER(TRIM(username)) = ? LIMIT 1')
    .get(normalized) as UserRow | undefined;

  return row ? rowToRecord(row) : null;
};

export const findAuthUserByIdentifier = (identifier: string): AuthUserRecord | null => {
  const normalized = identifier.trim().toLowerCase();
  if (!normalized) return null;

  const row = getDb()
    .prepare(
      `SELECT * FROM auth_users
       WHERE LOWER(TRIM(username)) = ? OR LOWER(TRIM(COALESCE(email, ''))) = ?
       ORDER BY CASE WHEN LOWER(TRIM(username)) = ? THEN 0 ELSE 1 END
       LIMIT 1`
    )
    .get(normalized, normalized, normalized) as UserRow | undefined;

  return row ? rowToRecord(row) : null;
};

export const upsertAuthUser = (payload: {
  username: string;
  role?: AuthUserRecord['role'];
  email?: string;
  fullName?: string;
  permissions?: Partial<ReportPermissions>;
  passwordHash?: string;
}): AuthUserRecord => {
  const db = getDb();
  const username = payload.username.trim();
  const now = new Date().toISOString();

  const existingRow = db
    .prepare('SELECT * FROM auth_users WHERE LOWER(username) = ? LIMIT 1')
    .get(username.toLowerCase()) as UserRow | undefined;

  if (existingRow) {
    const existing = rowToRecord(existingRow);
    const nextRole = payload.role || existing.role;
    const permissions = normalizePermissions(nextRole, payload.permissions ?? existing.permissions);

    db.prepare(
      `UPDATE auth_users SET
         role = @role, email = @email, fullName = @fullName,
         canView = @canView, canCreate = @canCreate, canEdit = @canEdit,
         passwordHash = @passwordHash, updatedAt = @updatedAt
       WHERE username = @username`
    ).run({
      username: existing.username,
      role: nextRole,
      email: payload.email ?? existing.email ?? null,
      fullName: payload.fullName ?? existing.fullName ?? null,
      canView: permissions.canView ? 1 : 0,
      canCreate: permissions.canCreate ? 1 : 0,
      canEdit: permissions.canEdit ? 1 : 0,
      passwordHash: payload.passwordHash || existing.passwordHash,
      updatedAt: now,
    });

    return findAuthUser(existing.username) as AuthUserRecord;
  }

  const role = payload.role || 'User';
  const permissions = normalizePermissions(role, payload.permissions);

  db.prepare(
    `INSERT INTO auth_users
       (username, role, email, fullName, canView, canCreate, canEdit, passwordHash, createdAt, updatedAt)
     VALUES
       (@username, @role, @email, @fullName, @canView, @canCreate, @canEdit, @passwordHash, @createdAt, @updatedAt)`
  ).run({
    username,
    role,
    email: payload.email ?? null,
    fullName: payload.fullName || username,
    canView: permissions.canView ? 1 : 0,
    canCreate: permissions.canCreate ? 1 : 0,
    canEdit: permissions.canEdit ? 1 : 0,
    passwordHash: payload.passwordHash || '',
    createdAt: now,
    updatedAt: now,
  });

  return findAuthUser(username) as AuthUserRecord;
};

export const removeAuthUser = (username: string): boolean => {
  const normalized = username.trim().toLowerCase();
  if (!normalized) return false;

  const result = getDb()
    .prepare('DELETE FROM auth_users WHERE LOWER(TRIM(username)) = ?')
    .run(normalized);

  return result.changes > 0;
};

export const listAuthUsers = (): AuthUserRecord[] => {
  const rows = getDb()
    .prepare('SELECT * FROM auth_users ORDER BY createdAt DESC')
    .all() as UserRow[];

  return rows.map(rowToRecord);
};
