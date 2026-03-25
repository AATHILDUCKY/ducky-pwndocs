import type { Methodology, Task } from '../types';
import { readStore, writeStore } from './webStore';
import { recordChange } from './auditService';

const normalizeProjectId = (projectId: string) => projectId.trim();

export const fetchMethodologies = async (projectId: string): Promise<Methodology[]> => {
  const normalizedProjectId = normalizeProjectId(projectId);
  if (!normalizedProjectId) return [];

  return (readStore().methodologies || []).filter((methodology) => methodology.projectId === normalizedProjectId);
};

export const createMethodology = async (projectId: string, name: string): Promise<Methodology | null> => {
  const normalizedProjectId = normalizeProjectId(projectId);
  if (!normalizedProjectId) return null;

  const methodology: Methodology = {
    id: `m-${Date.now()}`,
    projectId: normalizedProjectId,
    name,
    tasks: [],
  };

  writeStore((store) => ({
    ...store,
    methodologies: [methodology, ...store.methodologies],
  }));

  recordChange({
    action: 'Created methodology',
    targetType: 'methodology',
    targetId: methodology.id,
    targetName: methodology.name,
  });

  return methodology;
};

export const createMethodologyTask = async (
  projectId: string,
  methodologyId: string,
  title: string,
  status: Task['status'] = 'todo'
): Promise<Task | null> => {
  const normalizedProjectId = normalizeProjectId(projectId);
  if (!normalizedProjectId) return null;

  const task: Task = {
    id: `t-${Date.now()}`,
    title,
    status,
  };

  writeStore((store) => ({
    ...store,
    methodologies: store.methodologies.map((methodology) =>
      methodology.projectId === normalizedProjectId && methodology.id === methodologyId
        ? { ...methodology, tasks: [...methodology.tasks, { id: task.id, title: task.title, status: task.status }] }
        : methodology
    ),
  }));

  recordChange({
    action: 'Created methodology task',
    targetType: 'methodology',
    targetId: methodologyId,
    targetName: title,
  });

  return { id: task.id, title: task.title, status: task.status };
};

export const updateMethodologyTask = async (
  projectId: string,
  id: string,
  payload: { status?: Task['status']; title?: string }
): Promise<void> => {
  const normalizedProjectId = normalizeProjectId(projectId);
  if (!normalizedProjectId) return;

  writeStore((store) => ({
    ...store,
    methodologies: store.methodologies.map((methodology) => ({
      ...methodology,
      tasks: methodology.projectId !== normalizedProjectId
        ? methodology.tasks
        : methodology.tasks.map((task) =>
        task.id === id
          ? {
              ...task,
              ...(payload.status ? { status: payload.status } : {}),
              ...(payload.title ? { title: payload.title } : {}),
            }
          : task
      ),
    })),
  }));

  recordChange({
    action: 'Updated methodology task',
    targetType: 'methodology',
    targetId: id,
  });
};

export const updateMethodology = async (projectId: string, id: string, name: string): Promise<void> => {
  const normalizedProjectId = normalizeProjectId(projectId);
  if (!normalizedProjectId) return;

  writeStore((store) => ({
    ...store,
    methodologies: store.methodologies.map((methodology) =>
      methodology.projectId === normalizedProjectId && methodology.id === id ? { ...methodology, name } : methodology
    ),
  }));

  recordChange({
    action: 'Updated methodology',
    targetType: 'methodology',
    targetId: id,
    targetName: name,
  });
};

export const deleteMethodology = async (projectId: string, id: string): Promise<void> => {
  const normalizedProjectId = normalizeProjectId(projectId);
  if (!normalizedProjectId) return;

  const removed = readStore().methodologies.find(
    (methodology) => methodology.projectId === normalizedProjectId && methodology.id === id
  );
  writeStore((store) => ({
    ...store,
    methodologies: store.methodologies.filter(
      (methodology) => !(methodology.projectId === normalizedProjectId && methodology.id === id)
    ),
  }));

  recordChange({
    action: 'Deleted methodology',
    targetType: 'methodology',
    targetId: id,
    targetName: removed?.name,
  });
};

export const deleteMethodologyTask = async (projectId: string, id: string): Promise<void> => {
  const normalizedProjectId = normalizeProjectId(projectId);
  if (!normalizedProjectId) return;

  writeStore((store) => ({
    ...store,
    methodologies: store.methodologies.map((methodology) => ({
      ...methodology,
      tasks: methodology.projectId !== normalizedProjectId
        ? methodology.tasks
        : methodology.tasks.filter((task) => task.id !== id),
    })),
  }));

  recordChange({
    action: 'Deleted methodology task',
    targetType: 'methodology',
    targetId: id,
  });
};

export const migrateLegacyMethodologiesToProject = async (projectId: string): Promise<void> => {
  const normalizedProjectId = normalizeProjectId(projectId);
  if (!normalizedProjectId) return;

  writeStore((store) => ({
    ...store,
    methodologies: store.methodologies.map((methodology) =>
      methodology.projectId ? methodology : { ...methodology, projectId: normalizedProjectId }
    ),
  }));
};
