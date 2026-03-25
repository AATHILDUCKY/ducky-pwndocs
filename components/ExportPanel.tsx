
import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Eye, 
  Check,
  Briefcase,
  Search,
  Calendar,
  Loader2,
  ShieldCheck,
  SearchX,
  X,
  Send
} from 'lucide-react';
import { Project } from '../types';
import { generateReport, getReportPreview } from '../services/reportService';
import { sendProjectReportEmail } from '../services/emailService';
import { Modal, Button } from './ui/Elements';
import { notify } from '../utils/notify';

interface ExportPanelProps {
  externalProjects: Project[];
  externalActiveId: string;
  onProjectSelect: (id: string) => void;
}

const ExportPanel = ({ externalProjects, externalActiveId, onProjectSelect }: ExportPanelProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [exportFormat, setExportFormat] = useState<'pdf' | 'html'>('pdf');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailFormat, setEmailFormat] = useState<'pdf' | 'html'>('pdf');
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [recentEmails, setRecentEmails] = useState<string[]>([]);

  const selectedProject = useMemo(() => 
    externalProjects.find(p => p.id === externalActiveId) || externalProjects[0],
    [externalActiveId, externalProjects]
  );

  const filteredProjects = useMemo(() => {
    return externalProjects.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.client.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [externalProjects, searchQuery]);

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

  const projectTree = useMemo(() => {
    const byParent = new Map<string | null, Project[]>();
    filteredProjects.forEach((project) => {
      const parent = project.parentId || null;
      if (!byParent.has(parent)) byParent.set(parent, []);
      byParent.get(parent)?.push(project);
    });
    return byParent;
  }, [filteredProjects]);

  const renderProjectCards = (parentId: string | null, depth = 0): React.ReactNode[] => {
    const nodes = projectTree.get(parentId) || [];
    return nodes.flatMap((project) => {
      const node = (
        <button
          key={project.id}
          onClick={() => onProjectSelect(project.id)}
          className={`p-3.5 rounded-[1.25rem] border text-left transition-all group relative overflow-hidden ${
            externalActiveId === project.id 
              ? 'border-indigo-600 bg-white ring-1 ring-indigo-600 shadow-lg shadow-indigo-100' 
              : 'border-slate-100 bg-slate-50/50 hover:border-slate-300 hover:bg-white hover:shadow-md'
          }`}
          style={{ marginLeft: depth ? depth * 12 : 0 }}
        >
          <div className="flex justify-between items-start mb-2.5">
            <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-lg border ${
              project.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-200 text-slate-600 border-slate-300'
            }`}>
              {project.status}
            </span>
            {externalActiveId === project.id && (
              <div className="bg-indigo-600 p-1.5 rounded-full shadow-lg shadow-indigo-200">
                <Check size={12} className="text-white" strokeWidth={4} />
              </div>
            )}
          </div>
          <h4 className={`font-black text-base leading-tight mb-1 ${externalActiveId === project.id ? 'text-indigo-700' : 'text-slate-800'}`}>
            {project.name}
          </h4>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{project.client}</p>
          
          <div className="mt-3.5 pt-2.5 border-t border-slate-100/50 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] text-slate-600 font-black uppercase tracking-widest">
              <ShieldCheck size={14} className="text-rose-500" />
              <span className="tabular-nums">{project.issueCount.critical + project.issueCount.high}</span> Findings
            </div>
            <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase tracking-widest">
              <Calendar size={12} />
              {project.lastUpdate}
            </div>
          </div>
        </button>
      );
      const children = renderProjectCards(project.id, depth + 1);
      return [node, ...children];
    });
  };

  const handleExport = async (format: 'pdf' | 'html') => {
    if (!selectedProject) {
      notify('Please select a project first.', 'info');
      return;
    }
    setIsExporting(true);
    try {
      const result = await generateReport(selectedProject.id, format);
      if (!result) {
        notify('Report generation canceled.', 'info');
        setIsExporting(false);
        return;
      }
      if ('error' in result) {
        throw new Error(result.error);
      }
      notify(`Report for ${selectedProject.name} generated.`, 'success');
    } catch (error) {
      console.error('Failed to generate report', error);
      notify(error instanceof Error ? error.message : 'Failed to generate report.');
    } finally {
      setIsExporting(false);
    }
  };

  const totalIssues = selectedProject ? (
    selectedProject.issueCount.critical + 
    selectedProject.issueCount.high + 
    selectedProject.issueCount.medium + 
    selectedProject.issueCount.low
  ) : 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-4xl font-bold text-slate-800 tracking-tight">Deliverable Architect</h2>
          <p className="text-slate-500 font-medium text-sm">Compile and export security intelligence for strategic stakeholders.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          
          {/* Project Selection Section */}
          <section className="bg-white p-6 rounded-[1.75rem] border border-slate-200 shadow-sm transition-all hover:shadow-xl hover:shadow-indigo-100/5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
                  <Briefcase size={20} />
                </div>
                <h3 className="font-black text-sm text-slate-800 uppercase tracking-widest">
                  1. Target Context Vault
                </h3>
              </div>
              <div className="relative group min-w-[240px]">
                <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${searchQuery ? 'text-indigo-500' : 'text-slate-300'}`} size={16} />
                <input 
                  type="text" 
                  placeholder="Filter active engagements..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all shadow-sm"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-rose-500">
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {filteredProjects.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 max-h-[320px] overflow-y-auto pr-3 custom-scrollbar p-1">
                {renderProjectCards(null)}
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 bg-slate-50/50 rounded-[1.75rem] border border-dashed border-slate-200">
                <div className="w-16 h-16 rounded-[1.5rem] bg-white shadow-xl flex items-center justify-center text-slate-200">
                  <SearchX size={40} />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-black text-slate-800">No matching vaults found</p>
                  <p className="text-sm text-slate-400 font-medium">Verify your search term or initialize a new project from the sidebar.</p>
                </div>
                <button onClick={() => setSearchQuery('')} className="text-[11px] font-black uppercase tracking-widest text-indigo-600 hover:underline">Clear Search</button>
              </div>
            )}
          </section>

        </div>

        {/* Action Sidebar */}
        <div className="lg:col-span-4 space-y-8">
          {selectedProject ? (
            <div className="bg-white rounded-[2.25rem] border border-slate-200 p-8 shadow-2xl shadow-indigo-100/30 overflow-hidden relative sticky top-28">
              <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-3 tracking-tighter">
                <Download size={24} className="text-indigo-600" />
                Export Manifest
              </h3>

              <div className="space-y-8">
                <div className="space-y-3">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.4em]">Target Scope</p>
                  <div className="p-1">
                    <p className="font-black text-xl text-slate-800 leading-tight tracking-tight">{selectedProject.name}</p>
                    <p className="text-sm text-indigo-600 font-black uppercase tracking-widest mt-1">{selectedProject.client}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-[1.5rem] border border-slate-100">
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Issue Set</p>
                    <p className="text-2xl font-black text-slate-800 tabular-nums">{totalIssues}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-[1.5rem] border border-slate-100">
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Artifacts</p>
                    <p className="text-lg font-black text-slate-800 uppercase tracking-tight">PDF/HTML</p>
                  </div>
                </div>

                <div className="bg-slate-900 p-5 rounded-[1.75rem] border border-slate-800 shadow-inner">
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-5">Vulnerability Pulse</p>
                  <div className="flex h-3 gap-1 rounded-full overflow-hidden bg-white/5 mb-6">
                    <div style={{ width: `${totalIssues > 0 ? (selectedProject.issueCount.critical / totalIssues) * 100 : 0}%` }} className="bg-rose-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                    <div style={{ width: `${totalIssues > 0 ? (selectedProject.issueCount.high / totalIssues) * 100 : 0}%` }} className="bg-orange-500" />
                    <div style={{ width: `${totalIssues > 0 ? (selectedProject.issueCount.medium / totalIssues) * 100 : 0}%` }} className="bg-amber-500" />
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-black text-slate-400 tracking-widest">
                    <div className="flex items-center gap-1.5">
                       <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                       {selectedProject.issueCount.critical} CRIT
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                       <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                       {selectedProject.issueCount.high} HIGH
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 space-y-3">
                <div className="bg-white border border-slate-200 rounded-[1.75rem] p-4">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-3">Export Format</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(['pdf', 'html'] as const).map((format) => (
                      <button
                        key={format}
                        onClick={() => setExportFormat(format)}
                        className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                          exportFormat === format
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200'
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-white'
                        }`}
                      >
                        {format}
                      </button>
                    ))}
                  </div>
                </div>
                <button 
                  disabled={isExporting}
                  onClick={() => handleExport(exportFormat)}
                  className={`w-full py-5 rounded-[1.75rem] font-black text-xs uppercase tracking-[0.2em] transition-all shadow-2xl flex items-center justify-center gap-3 ${
                    isExporting 
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 active:scale-95'
                  }`}
                >
                  {isExporting ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
                  {isExporting ? 'Generating...' : `Generate ${exportFormat.toUpperCase()} Report`}
                </button>
                <button
                  onClick={() => {
                    if (!selectedProject) return;
                    setEmailSubject(`Project Report: ${selectedProject.name}`);
                    setEmailFormat('pdf');
                    setShowEmailModal(true);
                  }}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white py-5 rounded-[1.75rem] font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3"
                >
                  <Send size={20} />
                  Send Report Email
                </button>
                <button
                  onClick={async () => {
                    if (!selectedProject) {
                      notify('Please select a project first.', 'info');
                      return;
                    }
                    try {
                      const result = await getReportPreview(selectedProject.id);
                      if (result.error) {
                        notify(result.error);
                        return;
                      }
                      if (!result.html) {
                        notify('Preview is empty.', 'info');
                        return;
                      }
                      const previewWindow = window.open('', '_blank');
                      if (!previewWindow) {
                        notify('Popup blocked. Please allow popups for preview.', 'info');
                        return;
                      }
                      previewWindow.document.write(result.html);
                      previewWindow.document.close();
                    } catch (error) {
                      console.error('Preview failed', error);
                      notify('Failed to generate preview.');
                    }
                  }}
                  className="w-full bg-white hover:bg-slate-50 text-slate-700 py-5 rounded-[1.75rem] font-black text-xs uppercase tracking-[0.2em] transition-all border border-slate-200 flex items-center justify-center gap-3"
                >
                  <Eye size={20} />
                  Live Preview
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] p-10 text-center text-slate-400 font-black text-sm uppercase tracking-widest flex flex-col items-center gap-6">
              <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-sm">
                <Briefcase size={32} />
              </div>
              Select a project from the vault to configure manifest.
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={showEmailModal}
        onClose={() => { setShowEmailModal(false); setEmailError(null); }}
        title="Send Project Report"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-1">Recipient Email</label>
            <input
              type="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              list="recent-project-emails"
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all shadow-sm"
            />
            <datalist id="recent-project-emails">
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
              onChange={(e) => setEmailFormat(e.target.value as 'pdf' | 'html')}
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
                if (!selectedProject) return;
                if (!emailTo.trim()) {
                  setEmailError('Recipient email is required.');
                  return;
                }
                try {
                  setEmailSending(true);
                  setEmailError(null);
                  const result = await sendProjectReportEmail({
                    projectId: selectedProject.id,
                    to: emailTo.trim(),
                    subject: emailSubject.trim(),
                    message: emailMessage.trim(),
                    format: emailFormat,
                  });
                  if (result?.error) {
                    setEmailError(result.error);
                    return;
                  }
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

export default ExportPanel;
