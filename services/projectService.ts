import type { Project } from '../types';
import { readStore, writeStore } from './webStore';
import { recordChange } from './auditService';

type CreatePayload = {
  name: string;
  client: string;
  parentId?: string | null;
};

const generateProjectId = () => `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const syncLocalProjects = (projects: Project[]) => {
  writeStore((store) => ({
    ...store,
    projects,
  }));
};

const seedServerProjectsFromLocal = async (localProjects: Project[]): Promise<Project[]> => {
  for (const project of localProjects) {
    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: project.id,
        name: project.name,
        client: project.client,
        ownerUsername: project.ownerUsername,
        collaboratorUsernames: project.collaboratorUsernames || [],
        parentId: project.parentId || null,
        issueCount: project.issueCount,
        lastUpdate: project.lastUpdate,
        status: project.status,
      }),
    });
  }

  const response = await fetch('/api/projects', { cache: 'no-store' });
  if (!response.ok) return localProjects;
  const body = (await response.json()) as { projects?: Project[] };
  const projects = Array.isArray(body.projects) ? body.projects : localProjects;
  syncLocalProjects(projects);
  return projects;
};

export const fetchProjects = async (): Promise<Project[]> => {
  if (typeof window === 'undefined') {
    return readStore().projects;
  }

  const localStore = readStore();
  const sessionRole = localStore.userProfile?.role;
  const sessionUsername = (localStore.userProfile?.username || '').trim().toLowerCase();
  const fallbackProjects = sessionRole === 'Admin'
    ? localStore.projects
    : localStore.projects.filter((project) => {
        const owner = (project.ownerUsername || '').trim().toLowerCase();
        if (owner === sessionUsername) return true;
        return (project.collaboratorUsernames || []).some((entry) => entry.trim().toLowerCase() === sessionUsername);
      });

  try {
    const response = await fetch('/api/projects', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Failed to fetch projects.');
    }
    const body = (await response.json()) as { projects?: Project[] };
    const projects = Array.isArray(body.projects) ? body.projects : [];
    const localProjects = fallbackProjects;
    if (!projects.length && localProjects.length) {
      return await seedServerProjectsFromLocal(localProjects);
    }
    syncLocalProjects(projects);
    return projects;
  } catch {
    return fallbackProjects;
  }
};

export const createProject = async (payload: CreatePayload): Promise<Project> => {
  if (typeof window !== 'undefined') {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || 'Unable to create project.');
    }

    const body = (await response.json()) as { project?: Project };
    if (!body.project) {
      throw new Error('Project was not returned by server.');
    }

    writeStore((store) => ({
      ...store,
      projects: [body.project as Project, ...store.projects.filter((project) => project.id !== body.project?.id)],
    }));

    recordChange({
      action: 'Created project',
      targetType: 'project',
      targetId: body.project.id,
      targetName: body.project.name,
      details: `Client: ${body.project.client}`,
    });

    return body.project;
  }

  const id = generateProjectId();
  const parentId = typeof payload.parentId === 'string' ? payload.parentId.trim() : '';
  const now = new Date().toISOString();

  const project: Project = {
    id,
    name: payload.name,
    client: payload.client,
    ownerUsername: readStore().userProfile?.username || undefined,
    collaboratorUsernames: [],
    parentId: parentId || null,
    issueCount: { critical: 0, high: 0, medium: 0, low: 0 },
    lastUpdate: now,
    status: 'active',
  };

  writeStore((store) => ({
    ...store,
    projects: [project, ...store.projects],
  }));

  recordChange({
    action: 'Created project',
    targetType: 'project',
    targetId: project.id,
    targetName: project.name,
    details: `Client: ${project.client}`,
  });

  return project;
};

export const updateProjectCollaborators = async (
  projectId: string,
  collaboratorUsernames: string[]
): Promise<Project> => {
  if (!projectId?.trim()) {
    throw new Error('Project id is required.');
  }

  const response = await fetch(`/api/projects/${encodeURIComponent(projectId.trim())}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collaboratorUsernames }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || 'Unable to update project access.');
  }

  const body = (await response.json()) as { project?: Project };
  if (!body.project) {
    throw new Error('Updated project was not returned by server.');
  }

  writeStore((store) => ({
    ...store,
    projects: [body.project as Project, ...store.projects.filter((project) => project.id !== body.project?.id)],
  }));

  return body.project;
};

export const deleteProject = async (id: string): Promise<void> => {
  if (typeof window !== 'undefined') {
    const deletedProject = readStore().projects.find((project) => project.id === id);
    const response = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || 'Unable to delete project.');
    }

    const body = (await response.json()) as { deletedIds?: string[] };
    const idsToRemove = new Set((body.deletedIds || []).filter(Boolean));
    if (!idsToRemove.size) idsToRemove.add(id);

    writeStore((store) => {
      const projects = store.projects.filter((project) => !idsToRemove.has(project.id));
      const issues = Object.fromEntries(Object.entries(store.issues).filter(([projectId]) => !idsToRemove.has(projectId)));
      const notes = Object.fromEntries(Object.entries(store.notes).filter(([projectId]) => !idsToRemove.has(projectId)));

      return {
        ...store,
        projects,
        issues,
        notes,
      };
    });

    recordChange({
      action: 'Deleted project',
      targetType: 'project',
      targetId: id,
      targetName: deletedProject?.name || 'Project',
    });

    return;
  }

  const deletedProject = readStore().projects.find((project) => project.id === id);
  writeStore((store) => {
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

    const projects = store.projects.filter((project) => !idsToRemove.has(project.id));
    const issues = Object.fromEntries(Object.entries(store.issues).filter(([projectId]) => !idsToRemove.has(projectId)));
    const notes = Object.fromEntries(Object.entries(store.notes).filter(([projectId]) => !idsToRemove.has(projectId)));

    return {
      ...store,
      projects,
      issues,
      notes,
    };
  });

  recordChange({
    action: 'Deleted project',
    targetType: 'project',
    targetId: id,
    targetName: deletedProject?.name || 'Project',
  });
};
