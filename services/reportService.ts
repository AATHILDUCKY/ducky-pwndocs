import type { Issue, Project } from '../types';
import { fetchIssues } from './issueService';
import { fetchProjects } from './projectService';
import { recordChange } from './auditService';
import { getIsoEvidenceScore, getIssueDueDate, getSlaStatus, ISO_CONTROL_REFERENCE } from '../utils/vulnerabilityProcedure';

type ReportFormat = 'pdf' | 'html' | 'docx';

const esc = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const emptyText = 'Not added yet';

const issuesTable = (issues: Issue[]) => {
  if (!issues.length) {
    return '<p>No vulnerabilities have been added to this project yet.</p>';
  }

  const rows = issues
    .map(
      (issue) => {
        const sla = getSlaStatus(issue);
        return `<tr><td>${esc(issue.title || 'Untitled')}</td><td>${esc(issue.severity || 'Info')}</td><td>${esc(issue.state || 'Open')}</td><td>${esc(issue.cvssScore || '0')}</td><td>${esc(issue.vulnerabilitySource || emptyText)}</td><td>${esc(getIssueDueDate(issue) || 'Routine')}</td><td>${esc(sla.label)}</td><td>${getIsoEvidenceScore(issue)}%</td></tr>`;
      }
    )
    .join('');

  return `<table><thead><tr><th>Vulnerability</th><th>Severity</th><th>Status</th><th>CVSS</th><th>How Found</th><th>Due Date</th><th>SLA Status</th><th>Audit Info</th></tr></thead><tbody>${rows}</tbody></table>`;
};

let logoDataUrlCache: string | null = null;

const getReportLogoSrc = async (): Promise<string> => {
  if (logoDataUrlCache) return logoDataUrlCache;
  if (typeof window === 'undefined') return '/assets/app-logo.png';

  try {
    const response = await fetch('/assets/app-logo.png');
    if (!response.ok) throw new Error('Logo image unavailable');
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read logo image'));
      reader.readAsDataURL(blob);
    });
    logoDataUrlCache = dataUrl || '/assets/app-logo.png';
    return logoDataUrlCache;
  } catch {
    return '/assets/app-logo.png';
  }
};

const reportBrandHeader = (title: string, subtitle: string, logoSrc: string) => `
  <header class="report-head">
    <div class="brand">
      <img src="${esc(logoSrc)}" alt="Welford logo" class="brand-logo" />
      <div>
        <p class="brand-kicker">Welford Systems</p>
        <h1>${esc(title)}</h1>
        <p class="brand-subtitle">${esc(subtitle)}</p>
      </div>
    </div>
  </header>
`;

const htmlShell = (title: string, body: string) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 2rem; color: #0f172a; }
    h1, h2, h3 { margin: 0 0 0.75rem; }
    h1 { font-size: 1.55rem; }
    p { color: #334155; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { border: 1px solid #cbd5e1; text-align: left; padding: 0.5rem 0.6rem; font-size: 0.85rem; }
    th { background: #f8fafc; }
    .meta { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 0.5rem; margin: 1rem 0; }
    .meta div { padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; background: #f8fafc; }
    .caption { color: #64748b; font-size: 0.8rem; margin-top: 1rem; }
    .report-head { border-bottom: 1px solid #e2e8f0; padding-bottom: 1rem; margin-bottom: 1rem; }
    .brand { display: flex; align-items: center; gap: 1rem; }
    .brand-logo { width: 72px; height: 72px; object-fit: contain; }
    .brand-kicker { margin: 0; color: #0369a1; font-size: 0.7rem; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 800; }
    .brand-subtitle { margin-top: 0.15rem; font-size: 0.85rem; color: #475569; }
  </style>
</head>
<body>
${body}
</body>
</html>`;

const makeProjectHtml = (project: Project, issues: Issue[], logoSrc: string) => {
  const total = issues.length;
  const critical = issues.filter((issue) => issue.severity === 'Critical').length;
  const high = issues.filter((issue) => issue.severity === 'High').length;
  const medium = issues.filter((issue) => issue.severity === 'Medium').length;
  const low = issues.filter((issue) => issue.severity === 'Low').length;
  const averageEvidence = issues.length
    ? Math.round(issues.reduce((sum, issue) => sum + getIsoEvidenceScore(issue), 0) / issues.length)
    : 100;
  const overdue = issues.filter((issue) => getSlaStatus(issue).tone === 'danger').length;

  return htmlShell(
    `Project Report - ${project.name}`,
    `${reportBrandHeader(`${project.name} - Security Report`, `Client: ${project.client}`, logoSrc)}
    <div class="meta">
      <div><strong>Total Vulnerabilities</strong><br/>${total}</div>
      <div><strong>Last Updated</strong><br/>${esc(project.lastUpdate || new Date().toISOString())}</div>
      <div><strong>Critical / High</strong><br/>${critical} / ${high}</div>
      <div><strong>Medium / Low</strong><br/>${medium} / ${low}</div>
      <div><strong>${esc(ISO_CONTROL_REFERENCE)}</strong><br/>${averageEvidence}% information complete</div>
      <div><strong>Overdue Items</strong><br/>${overdue}</div>
    </div>
    <h2>Vulnerability Register</h2>
    ${issuesTable(issues)}
    <p class="caption">This report was generated by Welford Systems VM.</p>`
  );
};

const makeIssueHtml = (project: Project, issue: Issue, logoSrc: string) =>
  htmlShell(
    `Vulnerability Report - ${issue.title || 'Untitled Vulnerability'}`,
    `${reportBrandHeader(issue.title || 'Untitled Vulnerability', `Project: ${project.name} (${project.client})`, logoSrc)}
    <div class="meta">
      <div><strong>Severity</strong><br/>${esc(issue.severity || 'Info')}</div>
      <div><strong>Status</strong><br/>${esc(issue.state || 'Open')}</div>
      <div><strong>CVSS</strong><br/>${esc(issue.cvssScore || '0')}</div>
      <div><strong>Updated</strong><br/>${esc(issue.updatedAt || new Date().toISOString())}</div>
      <div><strong>How Found</strong><br/>${esc(issue.vulnerabilitySource || emptyText)}</div>
      <div><strong>Due Date</strong><br/>${esc(getIssueDueDate(issue) || 'Routine maintenance')}</div>
      <div><strong>SLA Status</strong><br/>${esc(getSlaStatus(issue).label)}</div>
      <div><strong>Audit Info Complete</strong><br/>${getIsoEvidenceScore(issue)}%</div>
      <div><strong>Data Classification</strong><br/>${esc(issue.assetClassification || emptyText)}</div>
      <div><strong>Exposure</strong><br/>${esc(issue.exposure || emptyText)}</div>
      <div><strong>Owner</strong><br/>${esc(issue.remediationOwner || 'Not assigned')}</div>
      <div><strong>Verification</strong><br/>${esc(issue.verificationResult || 'Not Verified')}</div>
    </div>
    <h2>Audit Information</h2>
    <p><strong>Date found:</strong> ${esc(issue.dateIdentified || emptyText)}</p>
    <p><strong>Business impact:</strong> ${esc(issue.businessImpact || emptyText)}</p>
    <p><strong>Fix plan:</strong> ${esc(issue.remediationAction || issue.solution || emptyText)}</p>
    <p><strong>Exception:</strong> ${esc(issue.exceptionRequired ? `Reason: ${issue.exceptionJustification || 'Reason not added yet'}. Temporary controls: ${issue.compensatingControls || emptyText}. Approved by: ${issue.riskAcceptanceApprover || 'Pending'}.` : 'No exception is currently needed.')}</p>
    <h2>Description</h2>
    <p>${esc(issue.description || 'No description provided.')}</p>
    <h2>Recommended Fix</h2>
    <p>${esc(issue.solution || issue.remediationAction || 'No fix has been added yet.')}</p>
    <p class="caption">This report was generated by Welford Systems VM.</p>`
  );

const downloadText = (filename: string, content: string, mimeType: string) => {
  if (typeof window === 'undefined') return;

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const printHtml = (html: string) => {
  if (typeof window === 'undefined') return;
  const preview = window.open('', '_blank');
  if (!preview) {
    throw new Error('Popup blocked. Please allow popups to print PDF.');
  }
  preview.document.write(html);
  preview.document.close();
  preview.focus();
  preview.print();
};

export const generateReport = async (
  projectId: string,
  format: ReportFormat
): Promise<{ path: string } | { error: string } | null> => {
  const projects = await fetchProjects();
  const project = projects.find((entry) => entry.id === projectId);
  if (!project) return { error: 'Project not found.' };
  const issues = await fetchIssues(projectId);
  const logoSrc = await getReportLogoSrc();

  const html = makeProjectHtml(project, issues, logoSrc);

  if (format === 'html' || format === 'docx') {
    const ext = format === 'docx' ? 'html' : 'html';
    const filename = `${project.name.replaceAll(/\s+/g, '-').toLowerCase()}-report.${ext}`;
    downloadText(filename, html, 'text/html;charset=utf-8');
    recordChange({
      action: 'Generated project report',
      targetType: 'report',
      targetId: project.id,
      targetName: project.name,
      projectId: project.id,
      details: `Format: ${format}`,
    });
    return { path: filename };
  }

  if (format === 'pdf') {
    printHtml(html);
    recordChange({
      action: 'Generated project report',
      targetType: 'report',
      targetId: project.id,
      targetName: project.name,
      projectId: project.id,
      details: 'Format: pdf',
    });
    return { path: 'browser-print-dialog' };
  }

  return { error: 'Unsupported format.' };
};

export const generateIssueReport = async (
  projectId: string,
  issueId: string,
  format: ReportFormat
): Promise<{ path: string } | { error: string } | null> => {
  const projects = await fetchProjects();
  const project = projects.find((entry) => entry.id === projectId);
  if (!project) return { error: 'Project not found.' };

  const issues = await fetchIssues(projectId);
  const issue = issues.find((entry) => entry.id === issueId);
  if (!issue) return { error: 'Vulnerability record not found.' };
  const logoSrc = await getReportLogoSrc();

  const html = makeIssueHtml(project, issue, logoSrc);

  if (format === 'html' || format === 'docx') {
    const ext = format === 'docx' ? 'html' : 'html';
    const filename = `${(issue.title || 'finding').replaceAll(/\s+/g, '-').toLowerCase()}-report.${ext}`;
    downloadText(filename, html, 'text/html;charset=utf-8');
    recordChange({
      action: 'Generated finding report',
      targetType: 'report',
      targetId: issue.id,
      targetName: issue.title,
      projectId: project.id,
      details: `Format: ${format}`,
    });
    return { path: filename };
  }

  if (format === 'pdf') {
    printHtml(html);
    recordChange({
      action: 'Generated finding report',
      targetType: 'report',
      targetId: issue.id,
      targetName: issue.title,
      projectId: project.id,
      details: 'Format: pdf',
    });
    return { path: 'browser-print-dialog' };
  }

  return { error: 'Unsupported format.' };
};

export const getReportPreview = async (
  projectId: string
): Promise<{ html?: string; error?: string }> => {
  const projects = await fetchProjects();
  const project = projects.find((entry) => entry.id === projectId);
  if (!project) return { error: 'Project not found.' };
  const issues = await fetchIssues(projectId);
  const logoSrc = await getReportLogoSrc();

  recordChange({
    action: 'Viewed project report preview',
    targetType: 'report',
    targetId: project.id,
    targetName: project.name,
    projectId: project.id,
    details: 'Action: preview',
  });

  return {
    html: makeProjectHtml(project, issues, logoSrc),
  };
};
