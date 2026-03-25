import type { ChangeHistoryEntry, Issue, ManagedUser, Methodology, Note, Project, SmtpSettings, UserProfile } from '../types';

export type EmailHistoryEntry = {
  id: string;
  project_id: string | null;
  project_name: string | null;
  issue_id: string | null;
  issue_title: string | null;
  recipient: string;
  subject: string | null;
  format: string | null;
  status: string | null;
  sent_at: string;
};

type Store = {
  projects: Project[];
  issues: Record<string, Issue[]>;
  notes: Record<string, Note[]>;
  methodologies: Methodology[];
  userProfile: UserProfile | null;
  users: ManagedUser[];
  activeUserId: string | null;
  smtpSettings: SmtpSettings | null;
  emailHistory: EmailHistoryEntry[];
  changeHistory: ChangeHistoryEntry[];
};

const STORAGE_KEY = 'ducky-pwn-docs:web-store:v1';

const emptyStore = (): Store => ({
  projects: [],
  issues: {},
  notes: {},
  methodologies: [],
  userProfile: null,
  users: [],
  activeUserId: null,
  smtpSettings: null,
  emailHistory: [],
  changeHistory: [],
});

const isBrowser = () => typeof window !== 'undefined';

const ensureProjectShape = (project: Partial<Project>): Project => ({
  id: project.id || `p-${Date.now()}`,
  name: project.name || 'Untitled Project',
  client: project.client || 'Unknown Client',
  ownerUsername: project.ownerUsername || undefined,
  collaboratorUsernames: Array.isArray(project.collaboratorUsernames) ? project.collaboratorUsernames : [],
  issueCount: {
    critical: project.issueCount?.critical || 0,
    high: project.issueCount?.high || 0,
    medium: project.issueCount?.medium || 0,
    low: project.issueCount?.low || 0,
  },
  lastUpdate: project.lastUpdate || new Date().toISOString(),
  status: project.status || 'active',
  parentId: project.parentId || null,
});

const normalizeStore = (raw: Partial<Store>): Store => ({
  projects: Array.isArray(raw.projects) ? raw.projects.map(ensureProjectShape) : [],
  issues: raw.issues && typeof raw.issues === 'object' ? raw.issues : {},
  notes: raw.notes && typeof raw.notes === 'object' ? raw.notes : {},
  methodologies: Array.isArray(raw.methodologies) ? raw.methodologies : [],
  userProfile: raw.userProfile || null,
  users: Array.isArray(raw.users) ? raw.users : [],
  activeUserId: typeof raw.activeUserId === 'string' ? raw.activeUserId : null,
  smtpSettings: raw.smtpSettings || null,
  emailHistory: Array.isArray(raw.emailHistory) ? raw.emailHistory : [],
  changeHistory: Array.isArray(raw.changeHistory) ? raw.changeHistory : [],
});

export const readStore = (): Store => {
  if (!isBrowser()) return emptyStore();

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyStore();

  try {
    return normalizeStore(JSON.parse(raw));
  } catch {
    return emptyStore();
  }
};

export const writeStore = (updater: (store: Store) => Store): Store => {
  const current = readStore();
  const next = normalizeStore(updater(current));

  if (isBrowser()) {
    const persistCandidates: Store[] = [
      next,
      // Drop volatile heavy caches first (server remains source of truth for these).
      { ...next, issues: {}, notes: {} },
      // Drop histories if quota is still tight.
      { ...next, issues: {}, notes: {}, emailHistory: [], changeHistory: [] },
      // Minimal state fallback to avoid hard failure.
      {
        ...emptyStore(),
        userProfile: next.userProfile,
        users: next.users,
        activeUserId: next.activeUserId,
        smtpSettings: next.smtpSettings,
        methodologies: next.methodologies,
      },
    ];

    let persisted = false;
    for (const candidate of persistCandidates) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(candidate));
        persisted = true;
        break;
      } catch (error) {
        if (!(error instanceof DOMException) || error.name !== 'QuotaExceededError') {
          throw error;
        }
      }
    }

    if (!persisted) {
      // Final guard: clear and persist minimal data to keep app functional.
      try {
        window.localStorage.removeItem(STORAGE_KEY);
        const minimal: Store = {
          ...emptyStore(),
          userProfile: next.userProfile,
          users: next.users,
          activeUserId: next.activeUserId,
          smtpSettings: next.smtpSettings,
          methodologies: next.methodologies,
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal));
      } catch {
        // If storage remains unavailable, fail soft and return in-memory result.
      }
    }
  }

  return next;
};

export const countIssues = (issues: Issue[]) => {
  const summary = { critical: 0, high: 0, medium: 0, low: 0 };
  issues.forEach((issue) => {
    if (issue.severity === 'Critical') summary.critical += 1;
    if (issue.severity === 'High') summary.high += 1;
    if (issue.severity === 'Medium') summary.medium += 1;
    if (issue.severity === 'Low') summary.low += 1;
  });
  return summary;
};

export const updateProjectCounts = (store: Store, projectId: string): Store => {
  const projectIssues = store.issues[projectId] || [];
  const counts = countIssues(projectIssues);
  return {
    ...store,
    projects: store.projects.map((project) =>
      project.id === projectId
        ? {
            ...project,
            issueCount: counts,
            lastUpdate: new Date().toISOString(),
          }
        : project
    ),
  };
};

export const sortByUpdateDesc = <T extends { updatedAt?: string; sent_at?: string }>(items: T[], key: 'updatedAt' | 'sent_at' = 'updatedAt') => {
  return [...items].sort((a, b) => {
    const aTime = new Date((a[key] as string) || '').getTime();
    const bTime = new Date((b[key] as string) || '').getTime();
    return bTime - aTime;
  });
};
