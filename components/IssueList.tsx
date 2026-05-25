
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { readStore } from '../services/webStore';
import { ChevronLeft, Save, X, Edit2, Search, ShieldAlert, Upload, Trash2, Link2, Mail, Download, FileCheck2, Clock3, ShieldCheck } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Issue, Project, ReportComment, ReportCommentAttachment } from '../types';
import { Badge, Button, SeverityBadge, Modal } from './ui/Elements';
import { FindingReport } from './findings/FindingReport';
import { FindingEditor } from './findings/FindingEditor';
import { fetchIssues, persistIssue, deleteIssue } from '../services/issueService';
import { selectMediaFile } from '../services/mediaService';
import { notify } from '../utils/notify';
import { getIsoEvidenceScore, getProcedureGaps, getSlaStatus, ISO_CONTROL_REFERENCE } from '../utils/vulnerabilityProcedure';

interface IssueListProps {
  activeProjectId: string;
  activeProject: Project;
  refreshProjects: () => Promise<void>;
  currentUsername?: string;
  currentUserRole?: string;
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
  currentUsername = 'Team Member',
  currentUserRole = 'Viewer',
  reportPermissions = { canView: true, canCreate: true, canEdit: true },
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const requestedFindingId = useMemo(
    () => new URLSearchParams(location.search).get('finding')?.trim() || '',
    [location.search]
  );
  const [issues, setIssues] = useState<Issue[]>(() =>
    activeProjectId ? (readStore().issues[activeProjectId] || []) : []
  );
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'view' | 'edit'>('list');
  const [workingCopy, setWorkingCopy] = useState<Issue | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'severity' | 'date' | 'status'>('severity');
  const [showUploadModal, setShowUploadModal] = useState<{ type: 'image' | 'video'; targetField: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Issue | null>(null);
  const [deleteStep, setDeleteStep] = useState<'confirm' | 'final'>('confirm');
  const [downloadPending, setDownloadPending] = useState(false);
  const canChangeFindingStatus = currentUserRole === 'Admin' || currentUserRole === 'Analyst';
  // Seed from local store instantly on project switch, then refresh from network silently
  useEffect(() => {
    // Always reset to the new project's local cache immediately — prevents stale data flash
    setIssues(activeProjectId ? (readStore().issues[activeProjectId] || []) : []);
    if (!activeProjectId) return;

    let active = true;
    fetchIssues(activeProjectId)
      .then((data) => { if (active) setIssues(data || []); })
      .catch((err) => { console.error('Failed to load issues', err); notify('Failed to load issues.'); });
    return () => { active = false; };
  }, [activeProjectId]);

  const loadIssues = useCallback(async () => {
    if (!activeProjectId) return;
    try {
      const data = await fetchIssues(activeProjectId);
      setIssues(data || []);
    } catch (error) {
      console.error('Failed to load issues', error);
      notify('Failed to load issues.');
    }
  }, [activeProjectId]);

  const SEVERITY_RANK: Record<string, number> = { Critical: 5, High: 4, Medium: 3, Low: 2, Info: 1 };

  const currentIssues = useMemo(() => issues, [issues]);
  const filteredIssues = useMemo(() => {
    let result = currentIssues.filter(i => {
      const matchesSearch = i.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (i.affected || '').toLowerCase().includes(searchFilter.toLowerCase());
      const matchesSeverity = severityFilter === 'All' || i.severity === severityFilter;
      const matchesStatus = statusFilter === 'All' || i.state === statusFilter;
      return matchesSearch && matchesSeverity && matchesStatus;
    });
    if (sortBy === 'severity') {
      result = [...result].sort((a, b) => (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0));
    } else if (sortBy === 'date') {
      result = [...result].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } else if (sortBy === 'status') {
      const order: Record<string, number> = { Open: 0, 'In Progress': 1, Draft: 2, QA: 3, Published: 4, Fixed: 5, Closed: 6 };
      result = [...result].sort((a, b) => (order[a.state] ?? 9) - (order[b.state] ?? 9));
    }
    return result;
  }, [currentIssues, searchFilter, severityFilter, statusFilter, sortBy]);
  const isoMetrics = useMemo(() => {
    const open = currentIssues.filter((issue) => issue.state !== 'Closed' && issue.state !== 'Fixed');
    const overdue = currentIssues.filter((issue) => getSlaStatus(issue).tone === 'danger').length;
    const exceptions = currentIssues.filter((issue) => issue.exceptionRequired).length;
    const evidenceAverage = currentIssues.length
      ? Math.round(currentIssues.reduce((sum, issue) => sum + getIsoEvidenceScore(issue), 0) / currentIssues.length)
      : 100;

    return { open: open.length, overdue, exceptions, evidenceAverage };
  }, [currentIssues]);

  useEffect(() => {
    setSelectedIssueId(null);
    setViewMode('list');
  }, [activeProjectId]);

  useEffect(() => {
    if (selectedIssueId) {
      const issue = currentIssues.find(i => i.id === selectedIssueId);
      if (issue) setWorkingCopy(JSON.parse(JSON.stringify(issue)));
    } else {
      setWorkingCopy(null);
      setViewMode('list');
    }
  }, [selectedIssueId, currentIssues]);

  useEffect(() => {
    if (!requestedFindingId) return;
    // Only open if the finding actually belongs to the current project's issues
    const target = currentIssues.find((issue) => issue.id === requestedFindingId);
    if (!target) return;
    setSelectedIssueId(target.id);
    setViewMode('view');
  }, [requestedFindingId, activeProjectId, currentIssues]);

  const saveFinding = async () => {
    if (!reportPermissions.canEdit && !reportPermissions.canCreate) {
      notify('You do not have permission to save vulnerability records.');
      return;
    }
    if (!workingCopy) {
      notify('No pending vulnerability changes to save.');
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
      notify('Vulnerability record saved.', 'success');
    } catch (error) {
      console.error('Unable to persist finding', error);
      notify('Unable to save vulnerability record.');
    }
  };

  const shareFindingLink = useCallback(async () => {
    if (!activeProjectId || !workingCopy) return;
    const url = `${window.location.origin}/issues?project=${encodeURIComponent(activeProjectId)}&finding=${encodeURIComponent(workingCopy.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      notify('Vulnerability link copied.', 'success');
    } catch {
      notify('Unable to copy vulnerability link.');
    }
  }, [activeProjectId, workingCopy]);

  const shareFindingByEmail = useCallback(() => {
    if (!activeProjectId || !workingCopy) return;
    const url = `${window.location.origin}/issues?project=${encodeURIComponent(activeProjectId)}&finding=${encodeURIComponent(workingCopy.id)}`;
    const subject = encodeURIComponent(
      `[Welford VM] Vulnerability Review Required - ${workingCopy.title || 'Untitled Vulnerability'}`
    );
    const body = encodeURIComponent(
`Hello Team,

Please review the following vulnerability record in Welford VM.

Finding Details
- Title: ${workingCopy.title || 'Untitled Finding'}
- Severity: ${workingCopy.severity || 'Info'}
- Status: ${workingCopy.state || 'Open'}
- Affected: ${workingCopy.affected || 'General Scope'}
- CVSS: ${workingCopy.cvssScore || '0'}

Direct Link
${url}

Action Requested
Please validate the record details, add comments, and update status as needed.

Regards,
Welford VM`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }, [activeProjectId, workingCopy]);

  const downloadFindingPdf = useCallback(async () => {
    if (!workingCopy || !activeProjectId) return;
    try {
      setDownloadPending(true);
      const reportNode = document.querySelector('.print-report-only');
      if (!reportNode) {
        notify('Unable to prepare report for PDF.');
        return;
      }
      const reportClone = reportNode.cloneNode(true) as HTMLElement;
      reportClone.querySelectorAll('[data-report-comments="true"]').forEach((node) => node.remove());

      const popup = window.open('', '_blank');
      if (!popup) {
        notify('Popup blocked. Please allow popups to export PDF.');
        return;
      }

      const styleNodes = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'));
      const copiedStyles = styleNodes.map((node) => node.outerHTML).join('\n');

      popup.document.open();
      popup.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${workingCopy.title || 'Finding Report'}</title>
  ${copiedStyles}
  <style>
    body { background: #fff; margin: 0; color: #0f172a; }
    .print-report-only {
      padding: 18px;
      font-family: Georgia, "Times New Roman", serif;
      line-height: 1.6;
    }
    .print-report-only img {
      max-width: 100% !important;
      height: auto !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      object-fit: contain;
      border-radius: 8px;
    }
    .print-report-only video { display: none !important; }
    .print-report-only .group > .absolute { display: none !important; }
    .print-report-only h1, .print-report-only h2, .print-report-only h3, .print-report-only h4 {
      page-break-after: avoid;
      break-after: avoid;
      color: #0c1e3a;
    }
    .print-report-only p, .print-report-only li { color: #1e3357; }
    .print-report-only .code-block {
      border: 1px solid #1f335f !important;
      background: #071126 !important;
      box-shadow: none !important;
    }
    .print-report-only .code-block-header {
      background: #0d1b3a !important;
      border-bottom: 1px solid #243b70 !important;
      color: #c7d5f1 !important;
    }
    .print-report-only .hljs {
      color: #e7eefc !important;
      white-space: pre-wrap !important;
      word-break: break-word !important;
    }
    .print-report-only .my-8 { margin-top: 18px !important; margin-bottom: 18px !important; }
    @page { size: A4; margin: 14mm; }
  </style>
</head>
<body>
  <div class="print-report-only">${reportClone.innerHTML}</div>
  <script>
    (function () {
      const allImages = Array.from(document.images || []);
      const done = () => {
        setTimeout(() => {
          window.focus();
          window.print();
        }, 200);
      };

      if (!allImages.length) {
        done();
        return;
      }

      let loaded = 0;
      const mark = () => {
        loaded += 1;
        if (loaded >= allImages.length) done();
      };

      allImages.forEach((img) => {
        if (img.complete) {
          mark();
          return;
        }
        img.addEventListener('load', mark, { once: true });
        img.addEventListener('error', mark, { once: true });
      });

      setTimeout(done, 4000);
    })();
  </script>
</body>
</html>`);
      popup.document.close();
      notify('PDF export opened.', 'success');
    } catch (error) {
      console.error('Failed to export PDF', error);
      notify('Failed to export PDF.');
    } finally {
      setDownloadPending(false);
    }
  }, [activeProjectId, workingCopy]);

  const openFinding = useCallback((issue: Issue, mode: 'view' | 'edit' = 'view') => {
    setSelectedIssueId(issue.id);
    setViewMode(mode);
    // Read URL imperatively — avoids location.search as a reactive dep (prevents stale closure + extra re-renders)
    const currentSearch = window.location.search;
    const params = new URLSearchParams(currentSearch);
    if (params.get('finding') !== issue.id) {
      params.set('finding', issue.id);
      navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: true });
    }
  }, [location.pathname, navigate]);

  const handleStatusChange = async (issue: Issue, newState: Issue['state']) => {
    if (!canChangeFindingStatus) {
      notify('Only Admin and Analyst can change vulnerability status.');
      return;
    }
    if (!activeProjectId) return;

    const previous = issue;
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const updated = {
      ...issue,
      state: newState,
      isFixed: newState === 'Fixed' || newState === 'Closed',
      remediationCompletedDate: (newState === 'Fixed' || newState === 'Closed') ? (issue.remediationCompletedDate || today) : issue.remediationCompletedDate,
      verificationDate: (newState === 'Fixed' || newState === 'Closed') ? (issue.verificationDate || today) : issue.verificationDate,
      verificationResult: (newState === 'Fixed' || newState === 'Closed') ? (issue.verificationResult === 'Not Verified' ? 'Passed' : issue.verificationResult || 'Passed') : issue.verificationResult,
      updatedAt: now,
    };

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
      console.error('Unable to update vulnerability status', error);
      notify('Unable to update vulnerability status.');
    }
  };

  const confirmDelete = async () => {
    if (!reportPermissions.canEdit) {
      notify('You do not have permission to delete vulnerability records.');
      return;
    }
    if (!deleteTarget || !activeProjectId) return;
    await deleteIssue(activeProjectId, deleteTarget.id);
    setDeleteTarget(null);
    setDeleteStep('confirm');
    await loadIssues();
  };

  const addSectionComment = useCallback(
    async (
      sectionId: string,
      text: string,
      parentId: string | null = null,
      attachments: ReportCommentAttachment[] = []
    ) => {
      if (!workingCopy || !activeProjectId) return;
      const comment: ReportComment = {
        id: `rc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sectionId,
        parentId,
        user: currentUsername,
        text: text.trim(),
        timestamp: new Date().toISOString(),
        attachments,
      };
      if (!comment.text && !attachments.length) return;

      const updated: Issue = {
        ...workingCopy,
        reportSectionComments: [...(workingCopy.reportSectionComments || []), comment],
        updatedAt: new Date().toISOString(),
      };

      setWorkingCopy(updated);
      setIssues((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
      await persistIssue(activeProjectId, updated);
      await refreshProjects();
    },
    [workingCopy, activeProjectId, currentUsername, refreshProjects]
  );

  const deleteSectionComment = useCallback(
    async (commentId: string) => {
      if (!workingCopy || !activeProjectId) return;
      const updated: Issue = {
        ...workingCopy,
        reportSectionComments: (workingCopy.reportSectionComments || []).filter((c) => c.id !== commentId),
        updatedAt: new Date().toISOString(),
      };
      setWorkingCopy(updated);
      setIssues((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
      await persistIssue(activeProjectId, updated);
    },
    [workingCopy, activeProjectId]
  );

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
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.14em]">{activeProject.client} / {activeProject.name}</span>
            </div>
            <h2 className="text-4xl font-bold text-slate-800 tracking-tight leading-none">Vulnerability Register</h2>
            <p className="text-slate-500 text-sm font-medium mt-1">Track each vulnerability from discovery through remediation, verification, and audit evidence.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search vulnerabilities..."
                value={searchFilter} 
                onChange={(e) => setSearchFilter(e.target.value)} 
                className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-sm" 
              />
            </div>
            <Button
              onClick={() => {
                if (!reportPermissions.canCreate) {
                  notify('You do not have permission to create vulnerability records.');
                  return;
                }
              const now = new Date().toISOString();
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
                vulnerabilitySource: 'Internal Scan',
                dateIdentified: now.slice(0, 10),
                assetClassification: 'Internal',
                exposure: 'Internal',
                businessImpact: '',
                remediationOwner: currentUsername,
                remediationAction: '',
                remediationDueDate: '',
                verificationResult: 'Not Verified',
                exceptionRequired: false,
                exceptionJustification: '',
                compensatingControls: '',
                riskAcceptanceApprover: '',
                updatedAt: now
              }; 
              setWorkingCopy(i); 
              setSelectedIssueId(i.id); 
              setViewMode('edit');
              }}
              disabled={!reportPermissions.canCreate}
            >
              New Vulnerability
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <FileCheck2 size={16} />
              <span className="text-[10px] font-black uppercase tracking-[0.12em]">Audit Ready</span>
            </div>
            <p className="text-2xl font-black text-slate-900">{isoMetrics.evidenceAverage}%</p>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">{ISO_CONTROL_REFERENCE}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 mb-3">
              <ShieldAlert size={16} />
              <span className="text-[10px] font-black uppercase tracking-[0.12em]">Open Items</span>
            </div>
            <p className="text-2xl font-black text-slate-900">{isoMetrics.open}</p>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">Waiting for remediation or verification</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 text-rose-600 mb-3">
              <Clock3 size={16} />
              <span className="text-[10px] font-black uppercase tracking-[0.12em]">Overdue</span>
            </div>
            <p className="text-2xl font-black text-slate-900">{isoMetrics.overdue}</p>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">Critical, high, or medium past SLA</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 text-amber-600 mb-3">
              <ShieldCheck size={16} />
              <span className="text-[10px] font-black uppercase tracking-[0.12em]">Exceptions</span>
            </div>
            <p className="text-2xl font-black text-slate-900">{isoMetrics.exceptions}</p>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">Risk acceptances under management</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-left min-w-[1100px]">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr className="text-[10px] uppercase font-black tracking-[0.12em] text-slate-500">
                <th className="px-8 py-5">Vulnerability</th>
                <th className="px-5 py-5">Severity</th>
                <th className="px-5 py-5">Owner</th>
                <th className="px-5 py-5">Due</th>
                <th className="px-5 py-5">Status</th>
                <th className="px-5 py-5">Evidence</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredIssues.map((issue) => {
                  const sla = getSlaStatus(issue);
                  const evidenceScore = getIsoEvidenceScore(issue);
                  const gaps = getProcedureGaps(issue);
                  return (
                    <tr
                      key={issue.id}
                      onClick={() => openFinding(issue, 'view')}
                      className="group cursor-pointer hover:bg-indigo-50/20 transition-all"
                    >
                      <td className="px-8 py-5">
                        <div className="flex flex-col">
                          <span className="text-[14px] font-black text-slate-800 group-hover:text-indigo-600 transition-colors leading-tight">{issue.title}</span>
                          <span className="text-[11px] text-slate-500 font-semibold mt-1.5">{issue.affected || 'General Infrastructure'}</span>
                          <span className="text-[10px] text-slate-400 font-semibold mt-1">{issue.vulnerabilitySource || 'Source not recorded'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-5">
                        <SeverityBadge severity={issue.severity} />
                      </td>
                      <td className="px-5 py-5">
                        <span className="text-xs font-bold text-slate-700">{issue.remediationOwner || 'Unassigned'}</span>
                      </td>
                      <td className="px-5 py-5">
                        <Badge variant={sla.tone}>{sla.label}</Badge>
                      </td>
                      <td className="px-5 py-5">
                        <select
                          value={issue.state}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleStatusChange(issue, e.target.value as Issue['state'])}
                          disabled={!canChangeFindingStatus}
                          className="text-[10px] font-black uppercase tracking-[0.1em] bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-600"
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
                      <td className="px-5 py-5">
                        <div className="min-w-[130px]">
                          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 mb-1.5">
                            <span>{evidenceScore}%</span>
                            <span>{gaps.length ? `${gaps.length} gaps` : 'ready'}</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-full ${evidenceScore >= 85 ? 'bg-emerald-500' : evidenceScore >= 60 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${evidenceScore}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!reportPermissions.canEdit) {
                                notify('You do not have permission to edit vulnerability records.');
                                return;
                              }
                              openFinding(issue, 'edit');
                            }}
                            className="p-2.5 text-slate-500 hover:text-indigo-600 bg-white rounded-lg border border-slate-200 shadow-sm"
                            title="Edit vulnerability"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!reportPermissions.canEdit) {
                                notify('You do not have permission to delete vulnerability records.');
                                return;
                              }
                              setDeleteTarget(issue);
                              setDeleteStep('confirm');
                            }}
                            className="p-2.5 text-slate-500 hover:text-rose-500 bg-white rounded-lg border border-slate-200 shadow-sm"
                            title="Delete vulnerability"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
              })}
              {!filteredIssues.length && (
                <tr>
                  <td colSpan={7} className="px-8 py-12 text-center">
                    <p className="text-sm font-black text-slate-700">No vulnerabilities found</p>
                    <p className="text-xs font-semibold text-slate-500 mt-1">Create a vulnerability record to start the ISO register for this project.</p>
                  </td>
                </tr>
              )}
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
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.16em] leading-none">Vulnerability Record</span>
            <span className="text-sm font-bold text-slate-900 mt-1 truncate max-w-[400px]">{workingCopy?.title}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {viewMode === 'view' ? (
            <>
              <Button variant="secondary" onClick={shareFindingLink}><Link2 size={14} /> Copy Link</Button>
              <Button variant="secondary" onClick={shareFindingByEmail}><Mail size={14} /> Share Mail</Button>
              <Button variant="secondary" onClick={downloadFindingPdf} disabled={downloadPending}>
                <Download size={14} /> {downloadPending ? 'Preparing PDF...' : 'Download PDF'}
              </Button>
              {reportPermissions.canEdit && (
                <Button onClick={() => setViewMode('edit')}><Edit2 size={14} /> Edit Report</Button>
              )}
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setViewMode('view')}>Cancel</Button>
              <Button onClick={saveFinding}><Save size={14} /> Save Record</Button>
            </>
          )}
          <button
            onClick={() => {
              setViewMode('list');
              setSelectedIssueId(null);
              // Only navigate if finding param is present — avoids unnecessary URL change
              const params = new URLSearchParams(window.location.search);
              if (params.has('finding')) {
                params.delete('finding');
                navigate({ pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : '' }, { replace: true });
              }
            }}
            className="p-2.5 text-slate-400 hover:text-rose-500 transition-colors ml-2"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex bg-white">
        {viewMode === 'view' ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30 p-8 lg:p-16">
            <div className="print-report-only">
              {workingCopy && (
                <FindingReport
                  finding={workingCopy}
                  currentUser={currentUsername}
                  isAdmin={currentUserRole === 'Admin'}
                  onAddSectionComment={addSectionComment}
                  onDeleteSectionComment={deleteSectionComment}
                  onPickCommentMedia={selectMediaFile}
                />
              )}
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
        title={`Attach ${showUploadModal?.type === 'image' ? 'Image' : 'Video'}`}
      >
        <button
          type="button"
          onClick={handleInsertMedia}
          className="w-full border-2 border-dashed border-slate-200 rounded-[2rem] p-12 flex flex-col items-center group hover:bg-slate-50 cursor-pointer transition-all"
        >
          <Upload size={32} className="text-indigo-600 mb-5 transition-transform group-hover:scale-110" />
          <p className="text-sm font-black text-slate-800 uppercase tracking-widest">Select Evidence File</p>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Maximum file size: 50MB</p>
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
    </div>
  );
};

export default IssueList;
