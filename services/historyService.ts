import { EmailHistoryEntry, readStore } from './webStore';
import type { ChangeHistoryEntry } from '../types';

export type { EmailHistoryEntry };

export const fetchEmailHistory = async (payload: { limit?: number; offset?: number }): Promise<EmailHistoryEntry[]> => {
  const limit = payload.limit ?? 50;
  const offset = payload.offset ?? 0;
  const history = [...readStore().emailHistory].sort(
    (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
  );
  return history.slice(offset, offset + limit);
};

export const fetchChangeHistory = async (payload: { limit?: number; offset?: number }): Promise<ChangeHistoryEntry[]> => {
  const limit = payload.limit ?? 50;
  const offset = payload.offset ?? 0;
  const history = [...(readStore().changeHistory || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return history.slice(offset, offset + limit);
};
