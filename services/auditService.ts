import type { ChangeHistoryEntry, ManagedUser } from '../types';
import { readStore, writeStore } from './webStore';

const getActor = (): ManagedUser | null => {
  const store = readStore();
  if (!store.users.length) return null;
  const active = store.activeUserId
    ? store.users.find((user) => user.id === store.activeUserId)
    : null;
  return active || store.users[0] || null;
};

type RecordPayload = {
  action: string;
  targetType: ChangeHistoryEntry['targetType'];
  targetId?: string;
  targetName?: string;
  projectId?: string | null;
  details?: string;
};

export const recordChange = (payload: RecordPayload): void => {
  const actor = getActor();
  if (!actor) return;

  // Keep admin actions out of this stream to focus on collaborator changes.
  if (actor.role === 'Admin') return;

  const entry: ChangeHistoryEntry = {
    id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    actorId: actor.id,
    actorName: actor.fullName?.trim() || actor.username,
    actorRole: actor.role,
    action: payload.action,
    targetType: payload.targetType,
    targetId: payload.targetId,
    targetName: payload.targetName,
    projectId: payload.projectId || null,
    details: payload.details,
    createdAt: new Date().toISOString(),
  };

  writeStore((store) => ({
    ...store,
    changeHistory: [entry, ...(store.changeHistory || [])].slice(0, 1000),
  }));
};
