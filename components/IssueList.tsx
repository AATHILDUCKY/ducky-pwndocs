
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronLeft, Save, X, Edit2, Search, ShieldAlert, Eye, Download, Upload, Trash2, Send } from 'lucide-react';
import { Issue, Project } from '../types';
import { Button, SeverityBadge, Modal } from './ui/Elements';
import { FindingReport } from './findings/FindingReport';
import { FindingEditor } from './findings/FindingEditor';
import { fetchIssues, persistIssue, deleteIssue } from '../services/issueService';
import { sendIssueReportEmail } from '../services/emailService';
import { generateIssueReport } from '../services/reportService';
import { selectMediaFile } from '../services/mediaService';
import { notify } from '../utils/notify';

interface IssueListProps {
  activeProjectId: string;
  activeProject: Project;
  refreshProjects: () => Promise<void>;
  reportPermissions?: {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
  };
}

const IssueList: React.FC<IssueListProps> = ({
  activeProjectId,
  activeProject,
  refreshProjects,
  reportPermissions = { canView: true, canCreate: true, canEdit: true },
}) => {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'view' | 'edit'>('list');
  const [workingCopy, setWorkingCopy] = useState<Issue | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [showUploadModal, setShowUploadModal] = useState<{ type: 'image' | 'video'; targetField: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Issue | null>(null);
  const [deleteStep, setDeleteStep] = useState<'confirm' | 'final'>('confirm');
  const [showPreview, setShowPreview] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<'pdf' | 'html' | 'docx'>('pdf');
  const [downloadPending, setDownloadPending] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailFormat, setEmailFormat] = useState<'pdf' | 'html' | 'docx'>('pdf');
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [recentEmails, setRecentEmails] = useState<string[]>([]);

  const loadIssues = useCallback(async () => {
    if (!activeProjectId) return;
    try {
      const issues = await fetchIssues(activeProjectId);
      setIssues(issues || []);
    } catch (error) {
      console.error('Failed to load issues', error);
      notify('Failed to load issues.');
      setIssues([]);
    }
  }, [activeProjectId]);

  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  const currentIssues = useMemo(() => issues, [issues]);
  const filteredIssues = useMemo(() => currentIssues.filter(i => i.title.toLowerCase().includes(searchFilter.toLowerCase())), [currentIssues, searchFilter]);

  useEffect(() => {
    setSelectedIssueId(null);
    setViewMode('list');
  }, [activeProjectId]);

  useEffect(() => {
    const stored = localStorage.getItem('vanguardRecentEmails');
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) setRecentEmails(parsed.filter((email) => typeof email === 'string'));
    } catch {
      // ignore malformed storage
    }
  }, []);

  useEffect(() => {
    if (selectedIssueId) {
      const issue = currentIssues.find(i => i.id === selectedIssueId);
      if (issue) setWorkingCopy(JSON.parse(JSON.stringify(issue)));
    } else {
      setWorkingCopy(null);
      setViewMode('list');
    }
  }, [selectedIssueId, currentIssues]);

  const saveFinding = async () => {
    if (!reportPermissions.canEdit && !reportPermissions.canCreate) {
      notify('You do not have permission to save findings.');
      return;
    }
    if (!workingCopy) {
      notify('No pending finding changes to save.');
      return;
    }
    if (!activeProjectId) {
      notify('No active project selected.');
      return;
    }
    try {
      await persistIssue(activeProjectId, workingCopy);
      await loadIssues();
      await refreshProjects();
      setSelectedIssueId(workingCopy.id);
      setViewMode('view');
      notify('Finding saved.', 'success');
    } catch (error) {
      console.error('Unable to persist finding', error);
      notify('Unable to save finding.');
    }
  };

  const handleStatusChange = async (issue: Issue, newState: Issue['state']) => {
    if (!reportPermissions.canEdit) {
      notify('You do not have permission to edit findings.');
      return;
    }
    if (!activeProjectId) return;

    const previous = issue;
    const updated = { ...issue, state: newState, isFixed: newState === 'Fixed', updatedAt: new Date().toISOString() };

    // Optimistic UI update for instant status feedback.
    setIssues((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
    if (selectedIssueId === updated.id) {
      setWorkingCopy((current) => (current && current.id === updated.id ? updated : current));
    }

    try {
      await persistIssue(activeProjectId, updated);
      await refreshProjects();
    } catch (error) {
      // Roll back on failure so UI remains consistent with persisted state.
      setIssues((prev) => prev.map((entry) => (entry.id === previous.id ? previous : entry)));
      if (selectedIssueId === previous.id) {
        setWorkingCopy((current) => (current && current.id === previous.id ? previous : current));
      }
      console.error('Unable to update finding status', error);
      notify('Unable to update finding status.');
    }
  };

  const confirmDelete = async () => {
    if (!reportPermissions.canEdit) {
      notify('You do not have permission to delete findings.');
      return;
    }
    if (!deleteTarget || !activeProjectId) return;
    await deleteIssue(activeProjectId, deleteTarget.id);
    setDeleteTarget(null);
    setDeleteStep('confirm');
    await loadIssues();
  };

  const handleInsertMedia = async () => {
    if (!showUploadModal) return;
    if (!workingCopy) return;
    const { type, targetField } = showUploadModal;
    const media = await selectMediaFile(type);
    if (!media) {
      setShowUploadModal(null);
      return;
    }
    const tag = `\n\n[${type}|${media.url}|${media.name}]`;
    const evidenceEntry = {
      id: `ev-${Date.now()}`,
      type,
      content: media.url,
      caption: media.name,
    };
    if (targetField === 'description') {
      setWorkingCopy({
        ...workingCopy,
        description: `${workingCopy.description || ''}${tag}`,
        evidence: [...(workingCopy.evidence || []), evidenceEntry],
        updatedAt: new Date().toISOString(),
      });
    } else {
      const updatedFields = (workingCopy.customFields || []).map((field) =>
        field.id === targetField ? { ...field, value: `${field.value || ''}${tag}` } : field
      );
      setWorkingCopy({
        ...workingCopy,
        customFields: updatedFields,
        evidence: [...(workingCopy.evidence || []), evidenceEntry],
        updatedAt: new Date().toISOString(),
      });
    }
    setShowUploadModal(null);
  };

  if (!reportPermissions.canView) {
    return (
      <div className="min-h-[420px] flex flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm font-black text-slate-700 uppercase tracking-widest">View Access Required</p>
        <p className="text-[11px] text-slate-500 font-semibold">Your account cannot view vulnerability reports.</p>
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <div className="space-y-10 animate-in fade-in duration-500 pb-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert size={14} className="text-indigo-600" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{activeProject.client} / {activeProject.name}</span>
            </div>
            <h2 className="text-4xl font-bold text-slate-800 tracking-tighter leading-none">Findings Hub</h2>
            <p className="text-slate-500 text-sm font-medium mt-1">Managed audit vault for discovered intelligence and risks.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchFilter} 
                onChange={(e) => setSearchFilter(e.target.value)} 
                className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-sm" 
              />
            </div>
            <Button
              onClick={() => {
                if (!reportPermissions.canCreate) {
                  notify('You do not have permission to create findings.');
                  return;
                }
              const i: any = { 
                id: `f-${Date.now()}`, 
                title: 'Draft Finding', 
                severity: 'Info', 
                description: '', 
                customFields: [], 
                cvssScore: '0.0', 
                cvssVector: 'CVSS:4.0/...', 
                type: 'Internal',
                state: 'Open',
                affected: '',
                isFixed: false,
                tags: [],
                solution: '',
                evidence: [],
                comments: [],
                updatedAt: new Date().toISOString()
              }; 
              setWorkingCopy(i); 
              setSelectedIssueId(i.id); 
              setViewMode('edit');
              }}
              disabled={!reportPermissions.canCreate}
            >
              New Finding
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-400">
                <th className="px-10 py-6">Intelligence Identity</th>
                <th className="px-6 py-6 text-center">Status</th>
                <th className="px-6 py-6">Severity</th>
                <th className="px-10 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredIssues.map(issue => (
                <tr 
                  key={issue.id} 
                  onClick={() => { setSelectedIssueId(issue.id); setViewMode('view'); }} 
                  className="group cursor-pointer hover:bg-indigo-50/20 transition-all"
                >
                  <td className="px-10 py-6">
                    <div className="flex flex-col">
                      <span className="text-[14px] font-black text-slate-800 group-hover:text-indigo-600 transition-colors leading-tight">{issue.title}</span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1.5">{issue.affected || 'General Infrastructure'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <select
                      value={issue.state}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleStatusChange(issue, e.target.value as Issue['state'])}
                      disabled={!reportPermissions.canEdit}
                      className="text-[9px] font-black uppercase tracking-widest bg-white border border-slate-200 rounded-full px-3 py-1.5 text-slate-500"
                    >
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Fixed">Fixed</option>
                      <option value="Draft">Draft</option>
                      <option value="Published">Published</option>
                      <option value="QA">QA</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </td>
                  <td className="px-6 py-6">
                    <SeverityBadge severity={issue.severity} />
                  </td>
                  <td className="px-10 py-6 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!reportPermissions.canEdit) {
                            notify('You do not have permission to edit findings.');
                            return;
                          }
                          setSelectedIssueId(issue.id);
                          setViewMode('edit');
                        }}
                        className="p-2.5 text-slate-400 hover:text-indigo-600 bg-white rounded-xl border border-slate-100 shadow-sm"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!reportPermissions.canEdit) {
                            notify('You do not have permission to delete findings.');
                            return;
                          }
                          setDeleteTarget(issue);
                          setDeleteStep('confirm');
                        }}
                        className="p-2.5 text-slate-400 hover:text-rose-500 bg-white rounded-xl border border-slate-100 shadow-sm"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white z-[200] flex flex-col animate-in slide-in-from-right-4 duration-500 overflow-hidden">
      <header className="h-16 border-b border-slate-200 px-8 flex items-center justify-between bg-white/95 backdrop-blur-md shrink-0 z-[110]">
        <div className="flex items-center gap-4">
          <button onClick={() => setViewMode('list')} className="p-2 text-slate-500 hover:text-indigo-600 bg-slate-50 rounded-xl transition-all"><ChevronLeft size={20} /></button>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] leading-none">Ducky Docs Dossier</span>
            <span className="text-sm font-bold text-slate-900 mt-1 truncate max-w-[400px]">{workingCopy?.title}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {viewMode === 'view' ? (
            <>
              <Button variant="secondary" onClick={() => setShowPreview(true)}><Eye size={16} /> Preview Report</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setDownloadFormat('pdf');
                  setDownloadError(null);
                  setShowDownloadModal(true);
                }}
              >
                <Download size={14} /> Download Report
              </Button>
              <Button variant="secondary" onClick={() => {
                if (!workingCopy) return;
                setEmailSubject(`Finding Report: ${workingCopy.title || 'Untitled Finding'}`);
                setEmailFormat('pdf');
                setShowEmailModal(true);
              }}>
                <Send size={14} /> Send Mail
              </Button>
              {reportPermissions.canEdit && (
                <Button onClick={() => setViewMode('edit')}><Edit2 size={14} /> edi report</Button>
              )}
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setViewMode('view')}>Discard Draft</Button>
              <Button onClick={saveFinding}><Save size={14} /> Commit Changes</Button>
            </>
          )}
          <button onClick={() => setViewMode('list')} className="p-2.5 text-slate-400 hover:text-rose-500 transition-colors ml-2"><X size={20} /></button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex bg-white">
        {viewMode === 'view' ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30 p-8 lg:p-16">
            <div className="print-report-only">
              {workingCopy && <FindingReport finding={workingCopy} />}
            </div>
          </div>
        ) : (
          workingCopy && (
            <FindingEditor
              workingCopy={workingCopy}
              onUpdate={setWorkingCopy}
              onOpenUpload={(type, targetField) => setShowUploadModal({ type, targetField })}
            />
          )
        )}
      </div>

      <Modal 
        isOpen={!!showUploadModal} 
        onClose={() => setShowUploadModal(null)} 
        title={`Ingest ${showUploadModal?.type === 'image' ? 'Image' : 'Video'}`}
      >
        <button
          type="button"
          onClick={handleInsertMedia}
          className="w-full border-2 border-dashed border-slate-200 rounded-[2rem] p-12 flex flex-col items-center group hover:bg-slate-50 cursor-pointer transition-all"
        >
          <Upload size={32} className="text-indigo-600 mb-5 transition-transform group-hover:scale-110" />
          <p className="text-sm font-black text-slate-800 uppercase tracking-widest">Select Tactical Evidence</p>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Maximum file weight: 50MB</p>
        </button>
        <div className="flex gap-4 pt-4">
          <Button variant="secondary" onClick={() => setShowUploadModal(null)} className="flex-1">Cancel</Button>
          <Button onClick={handleInsertMedia} className="flex-[2]">Sync Asset & Sync</Button>
        </div>
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => { setDeleteTarget(null); setDeleteStep('confirm'); }}
        title={deleteStep === 'confirm' ? 'Confirm Deletion' : 'Final Confirmation'}
      >
        <p className="text-sm text-slate-600 font-semibold">
          {deleteStep === 'confirm'
            ? `Delete "${deleteTarget?.title}" from this project?`
            : 'This action is permanent. Proceed with deletion?'}
        </p>
        <div className="flex gap-4 pt-6">
          <Button variant="secondary" onClick={() => { setDeleteTarget(null); setDeleteStep('confirm'); }} className="flex-1">Cancel</Button>
          {deleteStep === 'confirm' ? (
            <Button variant="danger" onClick={() => setDeleteStep('final')} className="flex-[2]">Yes, Continue</Button>
          ) : (
            <Button variant="danger" onClick={confirmDelete} className="flex-[2]">Delete Permanently</Button>
          )}
        </div>
      </Modal>

      {showPreview && workingCopy && (
        <div className="fixed inset-0 z-[300] flex flex-col animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowPreview(false)} />
          <div className="relative m-6 lg:m-10 bg-white rounded-[2rem] border border-slate-200 shadow-2xl overflow-hidden flex flex-col min-h-[70vh]">
            <div className="h-14 px-6 flex items-center justify-between border-b border-slate-100 bg-white/95 backdrop-blur-md shrink-0">
              <div className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em]">Report Preview</div>
              <button onClick={() => setShowPreview(false)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30 p-6 lg:p-10">
              <FindingReport finding={workingCopy} />
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={showDownloadModal}
        onClose={() => { setShowDownloadModal(false); setDownloadError(null); }}
        title="Download Finding Report"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-1">Format</label>
            <select
              value={downloadFormat}
              onChange={(e) => setDownloadFormat(e.target.value as 'pdf' | 'html' | 'docx')}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 outline-none"
            >
              <option value="pdf">PDF</option>
              <option value="html">HTML</option>
            </select>
          </div>
          {downloadError && (
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">
              {downloadError}
            </p>
          )}
          <div className="flex gap-4 pt-2">
            <Button
              variant="secondary"
              onClick={() => { setShowDownloadModal(false); setDownloadError(null); }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!workingCopy || !activeProjectId) return;
                try {
                  setDownloadPending(true);
                  setDownloadError(null);
                  const result = await generateIssueReport(activeProjectId, workingCopy.id, downloadFormat);
                  if (result && 'error' in result) {
                    setDownloadError(result.error);
                    notify(result.error);
                    return;
                  }
                  if (result && 'path' in result && result.path) {
                    notify('Finding report saved.', 'success');
                  }
                  setShowDownloadModal(false);
                } catch (error) {
                  console.error('Failed to download report', error);
                  const message = 'Failed to download report.';
                  setDownloadError(message);
                  notify(message);
                } finally {
                  setDownloadPending(false);
                }
              }}
              className="flex-[2]"
              disabled={downloadPending}
            >
              {downloadPending ? 'Preparing...' : 'Download'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showEmailModal}
        onClose={() => { setShowEmailModal(false); setEmailError(null); }}
        title="Send Finding Report"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-1">Recipient Email</label>
            <input
              type="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              list="recent-issue-emails"
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all shadow-sm"
            />
            <datalist id="recent-issue-emails">
              {recentEmails.map((email) => (
                <option key={email} value={email} />
              ))}
            </datalist>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-1">Subject</label>
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all shadow-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-1">Format</label>
            <select
              value={emailFormat}
              onChange={(e) => setEmailFormat(e.target.value as 'pdf' | 'html' | 'docx')}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 outline-none"
            >
              <option value="pdf">PDF Attachment</option>
              <option value="html">HTML Email</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-1">Message (optional)</label>
            <textarea
              value={emailMessage}
              onChange={(e) => setEmailMessage(e.target.value)}
              className="w-full min-h-[120px] bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all shadow-sm"
            />
          </div>
          {emailError && (
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">
              {emailError}
            </p>
          )}
          <div className="flex gap-4 pt-2">
            <Button variant="secondary" onClick={() => { setShowEmailModal(false); setEmailError(null); }} className="flex-1">Cancel</Button>
            <Button
              onClick={async () => {
                if (!workingCopy || !activeProjectId) return;
                if (!emailTo.trim()) {
                  setEmailError('Recipient email is required.');
                  return;
                }
                try {
                  setEmailSending(true);
                  setEmailError(null);
                  const result = await sendIssueReportEmail({
                    projectId: activeProjectId,
                    issueId: workingCopy.id,
                    to: emailTo.trim(),
                    subject: emailSubject.trim(),
                    message: emailMessage.trim(),
                    format: emailFormat,
                  });
                  if (result?.error) {
                    setEmailError(result.error);
                    notify(result.error);
                    return;
                  }
                  notify('Finding report sent.', 'success');
                  const next = Array.from(new Set([emailTo.trim(), ...recentEmails]))
                    .filter(Boolean)
                    .slice(0, 8);
                  setRecentEmails(next);
                  localStorage.setItem('vanguardRecentEmails', JSON.stringify(next));
                  setShowEmailModal(false);
                  setEmailTo('');
                  setEmailMessage('');
                } catch (error) {
                  console.error('Failed to send report email', error);
                  setEmailError('Failed to send email. Check SMTP settings.');
                  notify('Failed to send email.');
                } finally {
                  setEmailSending(false);
                }
              }}
              className="flex-[2]"
              disabled={emailSending}
            >
              {emailSending ? 'Sending...' : 'Send Report'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default IssueList;
