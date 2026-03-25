import type { SmtpSettings } from '../types';
import { readStore, writeStore } from './webStore';
import { recordChange } from './auditService';

const addEmailHistory = (payload: {
  projectId: string;
  issueId?: string;
  to: string;
  subject?: string;
  format?: 'pdf' | 'html' | 'docx';
}) => {
  writeStore((store) => {
    const project = store.projects.find((entry) => entry.id === payload.projectId);
    const issue = payload.issueId
      ? (store.issues[payload.projectId] || []).find((entry) => entry.id === payload.issueId)
      : null;

    return {
      ...store,
      emailHistory: [
        {
          id: `eh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          project_id: payload.projectId,
          project_name: project?.name || null,
          issue_id: payload.issueId || null,
          issue_title: issue?.title || null,
          recipient: payload.to,
          subject: payload.subject || null,
          format: payload.format || 'pdf',
          status: 'sent',
          sent_at: new Date().toISOString(),
        },
        ...store.emailHistory,
      ],
    };
  });
};

export const fetchSmtpSettings = async (): Promise<SmtpSettings | null> => {
  return readStore().smtpSettings;
};

export const saveSmtpSettings = async (payload: SmtpSettings): Promise<SmtpSettings | null> => {
  writeStore((store) => ({
    ...store,
    smtpSettings: payload,
  }));
  recordChange({
    action: 'Updated SMTP settings',
    targetType: 'settings',
    targetName: payload.host || 'SMTP',
  });
  return payload;
};

export const sendIssueReportEmail = async (payload: {
  projectId: string;
  issueId: string;
  to: string;
  subject?: string;
  message?: string;
  format?: 'pdf' | 'html' | 'docx';
}): Promise<{ ok?: boolean; error?: string }> => {
  if (!payload.to.trim()) return { error: 'Recipient email is required.' };

  const params = new URLSearchParams();
  if (payload.subject?.trim()) params.set('subject', payload.subject.trim());
  if (payload.message?.trim()) params.set('body', payload.message.trim());

  if (typeof window !== 'undefined') {
    window.open(`mailto:${payload.to.trim()}?${params.toString()}`, '_blank');
  }

  addEmailHistory(payload);
  recordChange({
    action: 'Sent finding report email',
    targetType: 'report',
    targetId: payload.issueId,
    projectId: payload.projectId,
    details: `Recipient: ${payload.to}`,
  });
  return { ok: true };
};

export const sendProjectReportEmail = async (payload: {
  projectId: string;
  to: string;
  subject?: string;
  message?: string;
  format?: 'pdf' | 'html' | 'docx';
}): Promise<{ ok?: boolean; error?: string }> => {
  if (!payload.to.trim()) return { error: 'Recipient email is required.' };

  const params = new URLSearchParams();
  if (payload.subject?.trim()) params.set('subject', payload.subject.trim());
  if (payload.message?.trim()) params.set('body', payload.message.trim());

  if (typeof window !== 'undefined') {
    window.open(`mailto:${payload.to.trim()}?${params.toString()}`, '_blank');
  }

  addEmailHistory(payload);
  recordChange({
    action: 'Sent project report email',
    targetType: 'report',
    targetId: payload.projectId,
    projectId: payload.projectId,
    details: `Recipient: ${payload.to}`,
  });
  return { ok: true };
};
