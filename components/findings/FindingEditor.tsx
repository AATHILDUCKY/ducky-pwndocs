
import React, { useMemo, useRef, useState } from 'react';
import {
  Bold, Italic, Code, Code2, Link, Table as TableIcon,
  ImageIcon, Video, PlusCircle, ArrowUp, ArrowDown, Trash2,
  Heading2, Heading3, List, ListOrdered, Quote, Strikethrough,
  ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Clock,
  Tag, User, Calendar, FileText, Wrench, ClipboardCheck,
  ChevronRight, Info,
} from 'lucide-react';
import { Issue } from '../../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import {
  getDefaultDueDate, getIsoEvidenceScore, getProcedureGaps,
  getSlaDays, getSlaStatus, ISO_CONTROL_REFERENCE,
} from '../../utils/vulnerabilityProcedure';

// ── Types ──────────────────────────────────────────────────────────────────
type ToolbarAction = 'bold' | 'italic' | 'strike' | 'inlineCode' | 'codeBlock'
  | 'link' | 'table' | 'h2' | 'h3' | 'ul' | 'ol' | 'quote';
type Tab = 'overview' | 'technical' | 'remediation' | 'audit';

// ── Severity config ────────────────────────────────────────────────────────
const SEV_CFG = {
  Critical: { bg: 'bg-red-500',    ring: 'ring-red-300',    text: 'text-white',       light: 'bg-red-50 text-red-700 border-red-200' },
  High:     { bg: 'bg-orange-500', ring: 'ring-orange-300', text: 'text-white',       light: 'bg-orange-50 text-orange-700 border-orange-200' },
  Medium:   { bg: 'bg-yellow-400', ring: 'ring-yellow-300', text: 'text-slate-900',   light: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  Low:      { bg: 'bg-blue-500',   ring: 'ring-blue-300',   text: 'text-white',       light: 'bg-blue-50 text-blue-700 border-blue-200' },
  Info:     { bg: 'bg-indigo-500', ring: 'ring-indigo-300', text: 'text-white',       light: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
} as const;

const STATUS_CFG = {
  'Open':        { dot: 'bg-slate-400',   label: 'Open',        hint: 'Not yet actioned' },
  'In Progress': { dot: 'bg-amber-400',   label: 'In Progress', hint: 'Remediation underway' },
  'Fixed':       { dot: 'bg-indigo-500',  label: 'Fixed',       hint: 'Fix applied, pending verification' },
  'Closed':      { dot: 'bg-emerald-500', label: 'Closed',      hint: 'Verified and closed' },
} as const;

// ── Small shared UI ────────────────────────────────────────────────────────
const Label: React.FC<{ children: React.ReactNode; required?: boolean }> = ({ children, required }) => (
  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
    {children}{required && <span className="text-red-400 ml-0.5">*</span>}
  </label>
);

const inputCls = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 focus:bg-white transition-all';
const textareaCls = `${inputCls} resize-none leading-relaxed`;

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode; hint?: string }> = ({ label, required, children, hint }) => (
  <div>
    <Label required={required}>{label}</Label>
    {children}
    {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
  </div>
);

// ── Toolbar ────────────────────────────────────────────────────────────────
const TBtn: React.FC<{ title: string; onClick: () => void; children: React.ReactNode }> = ({ title, onClick, children }) => (
  <button
    type="button" title={title}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
  >
    {children}
  </button>
);

const Toolbar: React.FC<{ onAction: (a: ToolbarAction) => void; onUpload: (t: 'image' | 'video') => void }> = ({ onAction, onUpload }) => (
  <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 bg-white border border-slate-200 rounded-xl shadow-sm">
    <TBtn title="Bold (Ctrl+B)" onClick={() => onAction('bold')}><Bold size={13} /></TBtn>
    <TBtn title="Italic (Ctrl+I)" onClick={() => onAction('italic')}><Italic size={13} /></TBtn>
    <TBtn title="Strikethrough" onClick={() => onAction('strike')}><Strikethrough size={13} /></TBtn>
    <TBtn title="Inline code" onClick={() => onAction('inlineCode')}><Code size={13} /></TBtn>
    <TBtn title="Code block" onClick={() => onAction('codeBlock')}><Code2 size={13} /></TBtn>
    <div className="w-px h-4 bg-slate-200 mx-1" />
    <TBtn title="Heading 2" onClick={() => onAction('h2')}><Heading2 size={13} /></TBtn>
    <TBtn title="Heading 3" onClick={() => onAction('h3')}><Heading3 size={13} /></TBtn>
    <TBtn title="Bullet list" onClick={() => onAction('ul')}><List size={13} /></TBtn>
    <TBtn title="Numbered list" onClick={() => onAction('ol')}><ListOrdered size={13} /></TBtn>
    <TBtn title="Blockquote" onClick={() => onAction('quote')}><Quote size={13} /></TBtn>
    <div className="w-px h-4 bg-slate-200 mx-1" />
    <TBtn title="Hyperlink" onClick={() => onAction('link')}><Link size={13} /></TBtn>
    <TBtn title="Table" onClick={() => onAction('table')}><TableIcon size={13} /></TBtn>
    <div className="w-px h-4 bg-slate-200 mx-1" />
    <TBtn title="Insert image" onClick={() => onUpload('image')}><ImageIcon size={13} className="text-indigo-500" /></TBtn>
    <TBtn title="Insert video / screen recording" onClick={() => onUpload('video')}><Video size={13} className="text-indigo-500" /></TBtn>
  </div>
);

// ── Markdown paste helper ──────────────────────────────────────────────────
const normalizeMarkdown = (v: string) =>
  v.replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');

const htmlToMarkdown = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const inline = (n: Node): string => {
    if (n.nodeType === Node.TEXT_NODE) return (n.textContent || '').replace(/ /g, ' ').replace(/\s+/g, ' ');
    if (n.nodeType !== Node.ELEMENT_NODE) return '';
    const el = n as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const ch = () => Array.from(el.childNodes).map(inline).join('');
    if (tag === 'strong' || tag === 'b') return `**${ch()}**`;
    if (tag === 'em' || tag === 'i') return `*${ch()}*`;
    if (tag === 's' || tag === 'del') return `~~${ch()}~~`;
    if (tag === 'code' && el.parentElement?.tagName.toLowerCase() !== 'pre') return `\`${(el.textContent || '').replace(/`/g, '\\`')}\``;
    if (tag === 'a') { const href = el.getAttribute('href') || ''; return href ? `[${ch().trim() || href}](${href})` : ch(); }
    if (tag === 'br') return '\n';
    return ch();
  };

  const block = (n: Node, depth = 0): string => {
    if (n.nodeType === Node.TEXT_NODE) return (n.textContent || '').replace(/ /g, ' ');
    if (n.nodeType !== Node.ELEMENT_NODE) return '';
    const el = n as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const ch = (d = depth) => Array.from(el.childNodes).map(x => block(x, d)).join('');
    if (['p','div','section','figure','figcaption'].includes(tag)) { const c = Array.from(el.childNodes).map(inline).join('').trim(); return c ? `\n\n${c}\n\n` : ''; }
    if (/^h[1-6]$/.test(tag)) { const l = Number(tag[1]); const c = Array.from(el.childNodes).map(inline).join('').trim(); return c ? `\n\n${'#'.repeat(l)} ${c}\n\n` : ''; }
    if (tag === 'pre') { const code = el.querySelector('code'); const lang = (code?.getAttribute('class') || '').match(/language-([a-z0-9_-]+)/i)?.[1] || ''; return `\n\n\`\`\`${lang}\n${(code?.textContent || el.textContent || '').replace(/\n+$/, '')}\n\`\`\`\n\n`; }
    if (tag === 'blockquote') { const c = ch().trim(); return c ? `\n\n${c.split('\n').map(l => `> ${l}`).join('\n')}\n\n` : ''; }
    if (tag === 'ul' || tag === 'ol') { const items = Array.from(el.children).filter(c => c.tagName.toLowerCase() === 'li'); const indent = '  '.repeat(depth); const rows = items.map((li, i) => { const marker = tag === 'ol' ? `${i + 1}.` : '-'; const text = Array.from((li as HTMLElement).childNodes).filter(c => !['ul','ol'].includes((c as HTMLElement).tagName?.toLowerCase())).map(inline).join('').trim(); return `${indent}${marker} ${text}`; }); return `\n\n${rows.join('\n')}\n\n`; }
    if (tag === 'hr') return '\n\n---\n\n';
    return ch();
  };

  return normalizeMarkdown(Array.from(doc.body.childNodes).map(n => block(n)).join('')).trim();
};

// ── Main component ─────────────────────────────────────────────────────────
export const FindingEditor: React.FC<{
  workingCopy: Issue;
  onUpdate: (data: Issue) => void;
  onOpenUpload: (type: 'image' | 'video', targetField: string) => void;
}> = ({ workingCopy, onUpdate, onOpenUpload }) => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const fieldRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const sla = getSlaStatus(workingCopy);
  const evidenceScore = getIsoEvidenceScore(workingCopy);
  const procedureGaps = getProcedureGaps(workingCopy);

  const up = (key: keyof Issue, value: any) => onUpdate({ ...workingCopy, [key]: value });

  // ── Toolbar logic ────────────────────────────────────────────────────────
  const getVal = (id: string) => id === 'description' ? (workingCopy.description || '') : id === 'solution' ? (workingCopy.solution || '') : (workingCopy.customFields.find(f => f.id === id)?.value || '');
  const setVal = (id: string, v: string) => {
    if (id === 'description') { up('description', v); return; }
    if (id === 'solution') { up('solution', v); return; }
    onUpdate({ ...workingCopy, customFields: workingCopy.customFields.map(f => f.id === id ? { ...f, value: v } : f) });
  };

  const applySelection = (id: string, fn: (v: string, s: number, e: number) => { value: string; selectionStart: number; selectionEnd: number }) => {
    const v = getVal(id);
    const ta = fieldRefs.current[id];
    const s = ta?.selectionStart ?? v.length;
    const e = ta?.selectionEnd ?? v.length;
    const next = fn(v, s, e);
    setVal(id, next.value);
    requestAnimationFrame(() => {
      const t = fieldRefs.current[id];
      if (!t) return;
      t.focus();
      t.setSelectionRange(next.selectionStart, next.selectionEnd);
    });
  };

  const inline_ = (id: string, pre: string, suf = pre, ph = 'text') => applySelection(id, (v, s, e) => {
    const sel = v.slice(s, e) || ph;
    return { value: `${v.slice(0, s)}${pre}${sel}${suf}${v.slice(e)}`, selectionStart: s + pre.length, selectionEnd: s + pre.length + sel.length };
  });

  const block_ = (id: string, wrapper: string, ph = 'code') => applySelection(id, (v, s, e) => {
    const body = v.slice(s, e) || ph;
    return { value: `${v.slice(0, s)}${wrapper}\n${body}\n${wrapper}${v.slice(e)}`, selectionStart: s + wrapper.length + 1, selectionEnd: s + wrapper.length + 1 + body.length };
  });

  const linePrefix = (id: string, fn: (line: string, i: number) => string) => applySelection(id, (v, s, e) => {
    const ls = v.lastIndexOf('\n', Math.max(0, s - 1)) + 1;
    const le = v.indexOf('\n', e);
    const end = le === -1 ? v.length : le;
    const chunk = v.slice(ls, end).split('\n').map((l, i) => l.trim() ? fn(l, i) : l).join('\n');
    return { value: `${v.slice(0, ls)}${chunk}${v.slice(end)}`, selectionStart: ls, selectionEnd: ls + chunk.length };
  });

  const tableTemplate = useMemo(() => '| Column | Column |\n| --- | --- |\n| Cell | Cell |', []);

  const handleAction = (action: ToolbarAction) => {
    const id = focusedField;
    if (!id) return;
    switch (action) {
      case 'bold':       inline_(id, '**', '**', 'bold text'); break;
      case 'italic':     inline_(id, '*', '*', 'italic text'); break;
      case 'strike':     inline_(id, '~~', '~~', 'text'); break;
      case 'inlineCode': inline_(id, '`', '`', 'code'); break;
      case 'codeBlock':  block_(id, '```', 'code'); break;
      case 'link':       inline_(id, '[', '](https://)', 'link text'); break;
      case 'table':      applySelection(id, (v, s, e) => { const next = `${v.slice(0, s)}${tableTemplate}${v.slice(e)}`; return { value: next, selectionStart: s + 2, selectionEnd: s + 8 }; }); break;
      case 'h2':         linePrefix(id, l => `## ${l.replace(/^\s*#{1,6}\s+/, '')}`); break;
      case 'h3':         linePrefix(id, l => `### ${l.replace(/^\s*#{1,6}\s+/, '')}`); break;
      case 'ul':         linePrefix(id, l => `- ${l.replace(/^\s*(?:[-+*]|\d+\.)\s+/, '')}`); break;
      case 'ol':         linePrefix(id, (l, i) => `${i + 1}. ${l.replace(/^\s*(?:[-+*]|\d+\.)\s+/, '')}`); break;
      case 'quote':      linePrefix(id, l => `> ${l.replace(/^\s*>\s+/, '')}`); break;
    }
  };

  const handlePaste = (id: string, e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData.getData('text/html');
    if (!html || !/<[a-z][\s\S]*>/i.test(html)) return;
    const md = htmlToMarkdown(html);
    if (!md.trim()) return;
    e.preventDefault();
    applySelection(id, (v, s, e2) => {
      const next = `${v.slice(0, s)}${md}${v.slice(e2)}`;
      return { value: next, selectionStart: s + md.length, selectionEnd: s + md.length };
    });
  };

  const taRef = (id: string) => (el: HTMLTextAreaElement | null) => { fieldRefs.current[id] = el; };

  // ── Tags helpers ─────────────────────────────────────────────────────────
  const [tagInput, setTagInput] = useState('');
  const addTag = () => {
    const t = tagInput.trim();
    if (!t || workingCopy.tags.includes(t)) { setTagInput(''); return; }
    up('tags', [...workingCopy.tags, t]);
    setTagInput('');
  };
  const removeTag = (t: string) => up('tags', workingCopy.tags.filter(x => x !== t));

  // ── Tab config ────────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; icon: React.ElementType; alert?: boolean }[] = [
    { id: 'overview',    label: 'Overview',     icon: FileText },
    { id: 'technical',   label: 'Description',  icon: Code2 },
    { id: 'remediation', label: 'Remediation',  icon: Wrench },
    { id: 'audit',       label: 'ISO / Audit',  icon: ClipboardCheck, alert: procedureGaps.length > 0 },
  ];

  // ── ISO gap checklist items ───────────────────────────────────────────────
  const auditChecks = [
    { label: 'Date Identified',      ok: Boolean(workingCopy.dateIdentified) },
    { label: 'Vulnerability Source', ok: Boolean(workingCopy.vulnerabilitySource) },
    { label: 'Affected Asset',       ok: Boolean(workingCopy.affected) },
    { label: 'CVSS Score',           ok: Boolean(workingCopy.cvssScore) },
    { label: 'Asset Classification', ok: Boolean(workingCopy.assetClassification) },
    { label: 'Exposure Level',       ok: Boolean(workingCopy.exposure) },
    { label: 'Business Impact',      ok: Boolean(workingCopy.businessImpact) },
    { label: 'Remediation Owner',    ok: Boolean(workingCopy.remediationOwner) },
    { label: 'Remediation Action',   ok: Boolean(workingCopy.remediationAction || workingCopy.solution) },
    { label: 'SLA Due Date',         ok: Boolean(workingCopy.remediationDueDate || !getSlaDays(workingCopy.severity)) },
    { label: 'Verification Evidence', ok: Boolean(!workingCopy.isFixed && workingCopy.state !== 'Fixed' && workingCopy.state !== 'Closed') || Boolean(workingCopy.verificationDate && workingCopy.verificationResult) },
    { label: 'Exception Approved',   ok: Boolean(!workingCopy.exceptionRequired || (workingCopy.exceptionJustification && workingCopy.riskAcceptanceApprover)) },
  ];

  const sevCfg = SEV_CFG[workingCopy.severity] || SEV_CFG.Info;

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* ── Authoring panel ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ISO health bar + SLA */}
        <div className="shrink-0 flex items-center gap-4 px-6 py-3 bg-white border-b border-slate-100">
          <div className="flex-1 flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">ISO Evidence</span>
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden max-w-48">
              <div
                className={`h-full rounded-full transition-all duration-500 ${evidenceScore >= 80 ? 'bg-emerald-500' : evidenceScore >= 50 ? 'bg-amber-400' : 'bg-red-500'}`}
                style={{ width: `${evidenceScore}%` }}
              />
            </div>
            <span className={`text-xs font-bold tabular-nums ${evidenceScore >= 80 ? 'text-emerald-600' : evidenceScore >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
              {evidenceScore}%
            </span>
          </div>
          <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${
            sla.tone === 'danger'  ? 'bg-red-50 border-red-200 text-red-600' :
            sla.tone === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-600' :
            sla.tone === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' :
            'bg-slate-50 border-slate-200 text-slate-500'
          }`}>
            <Clock size={11} />
            {sla.label}
          </div>
          <div className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${sevCfg.light}`}>
            {workingCopy.severity}
          </div>
        </div>

        {/* Tabs */}
        <div className="shrink-0 flex items-center gap-0.5 px-4 bg-white border-b border-slate-100">
          {tabs.map(t => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`relative flex items-center gap-1.5 px-4 py-3 text-xs font-semibold transition-all ${
                  active ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon size={13} />
                {t.label}
                {t.alert && !active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 absolute top-2 right-1.5" />
                )}
                {active && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-indigo-600 rounded-t-full" />}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">

            {/* Title (always visible above tabs) */}
            <input
              type="text"
              value={workingCopy.title}
              onChange={e => up('title', e.target.value)}
              placeholder="Vulnerability title..."
              className="w-full text-2xl font-bold text-slate-900 bg-transparent border-none outline-none focus:ring-0 placeholder:text-slate-300"
            />

            {/* ── TAB: Overview ─────────────────────────────────────────── */}
            {activeTab === 'overview' && (
              <div className="space-y-6">

                {/* Severity picker */}
                <Field label="Severity" required>
                  <div className="flex flex-wrap gap-2">
                    {(['Critical', 'High', 'Medium', 'Low', 'Info'] as const).map(s => {
                      const cfg = SEV_CFG[s];
                      const active = workingCopy.severity === s;
                      return (
                        <button
                          key={s} type="button"
                          onClick={() => up('severity', s)}
                          className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                            active ? `${cfg.bg} ${cfg.text} border-transparent ring-2 ${cfg.ring}` : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </Field>

                {/* Status */}
                <Field label="Status" required>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {(Object.entries(STATUS_CFG) as [keyof typeof STATUS_CFG, typeof STATUS_CFG[keyof typeof STATUS_CFG]][]).map(([key, cfg]) => {
                      const active = workingCopy.state === key;
                      return (
                        <button
                          key={key} type="button"
                          onClick={() => up('state', key)}
                          className={`flex flex-col items-start px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                            active ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                            <span className={`text-xs font-semibold ${active ? 'text-indigo-700' : 'text-slate-700'}`}>{cfg.label}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">{cfg.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* CVSS Score */}
                  <Field label="CVSS Score" hint="e.g. 9.8 (use NVD calculator)">
                    <input
                      type="text"
                      value={workingCopy.cvssScore}
                      onChange={e => up('cvssScore', e.target.value)}
                      placeholder="0.0 – 10.0"
                      className={inputCls}
                    />
                  </Field>

                  {/* CVSS Vector */}
                  <Field label="CVSS Vector" hint="e.g. AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H">
                    <input
                      type="text"
                      value={workingCopy.cvssVector}
                      onChange={e => up('cvssVector', e.target.value)}
                      placeholder="CVSS:3.1/AV:..."
                      className={inputCls}
                    />
                  </Field>

                  {/* Source type */}
                  <Field label="Source Type">
                    <select value={workingCopy.type} onChange={e => up('type', e.target.value)} className={inputCls}>
                      <option value="Internal">Internal</option>
                      <option value="External">External</option>
                    </select>
                  </Field>

                  {/* Affected Asset */}
                  <Field label="Affected Asset / System" required hint="Hostname, IP, service, or component">
                    <input
                      type="text"
                      value={workingCopy.affected}
                      onChange={e => up('affected', e.target.value)}
                      placeholder="e.g. web-api-prod-01, 10.0.1.42"
                      className={inputCls}
                    />
                  </Field>
                </div>

                {/* Tags */}
                <Field label="Tags" hint="Press Enter or comma to add a tag">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {workingCopy.tags.map(t => (
                      <span key={t} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-medium px-2.5 py-1 rounded-full">
                        <Tag size={10} />{t}
                        <button type="button" onClick={() => removeTag(t)} className="ml-0.5 text-indigo-400 hover:text-indigo-700"><XCircle size={12} /></button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
                    placeholder="Add tag..."
                    className={inputCls}
                  />
                </Field>
              </div>
            )}

            {/* ── TAB: Technical ──────────────────────────────────────────── */}
            {activeTab === 'technical' && (
              <div className="space-y-8">

                {/* Description */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label required>Description</Label>
                    <span className="text-[11px] text-slate-400">Markdown supported</span>
                  </div>
                  <Toolbar
                    onAction={handleAction}
                    onUpload={t => onOpenUpload(t, 'description')}
                  />
                  <textarea
                    value={workingCopy.description}
                    onFocus={() => setFocusedField('description')}
                    onBlur={() => setFocusedField(null)}
                    onChange={e => up('description', e.target.value)}
                    onPaste={e => handlePaste('description', e)}
                    ref={taRef('description')}
                    placeholder="Describe the vulnerability in detail — what it is, how it was discovered, and its technical root cause..."
                    className={`${textareaCls} mt-2 min-h-[220px]`}
                  />
                </div>

                {/* Solution / Recommendation */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Recommended Fix / Solution</Label>
                    <span className="text-[11px] text-slate-400">Markdown supported</span>
                  </div>
                  <Toolbar
                    onAction={handleAction}
                    onUpload={t => onOpenUpload(t, 'solution')}
                  />
                  <textarea
                    value={workingCopy.solution || ''}
                    onFocus={() => setFocusedField('solution')}
                    onBlur={() => setFocusedField(null)}
                    onChange={e => up('solution', e.target.value)}
                    onPaste={e => handlePaste('solution', e)}
                    ref={taRef('solution')}
                    placeholder="Step-by-step remediation instructions, patch references, configuration changes..."
                    className={`${textareaCls} mt-2 min-h-[160px]`}
                  />
                </div>

                {/* Custom evidence sections */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Supporting Evidence Sections</p>
                      <p className="text-xs text-slate-400 mt-0.5">Attach scan output, PoC steps, screenshots or change-ticket references.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onUpdate({ ...workingCopy, customFields: [...workingCopy.customFields, { id: `cf-${Date.now()}`, label: 'Evidence', value: '' }] })}
                      className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-xl transition-all"
                    >
                      <PlusCircle size={13} /> Add Section
                    </button>
                  </div>

                  <div className="space-y-4">
                    {workingCopy.customFields.map((cf, idx) => (
                      <div key={cf.id} className="border border-slate-200 rounded-2xl bg-slate-50/40 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col gap-0.5">
                              <button type="button" onClick={() => { const f = [...workingCopy.customFields]; if (idx > 0) { [f[idx], f[idx-1]] = [f[idx-1], f[idx]]; onUpdate({ ...workingCopy, customFields: f }); } }} className="p-0.5 text-slate-300 hover:text-indigo-400"><ArrowUp size={11} /></button>
                              <button type="button" onClick={() => { const f = [...workingCopy.customFields]; if (idx < f.length - 1) { [f[idx], f[idx+1]] = [f[idx+1], f[idx]]; onUpdate({ ...workingCopy, customFields: f }); } }} className="p-0.5 text-slate-300 hover:text-indigo-400"><ArrowDown size={11} /></button>
                            </div>
                            <input
                              type="text"
                              value={cf.label}
                              onChange={e => onUpdate({ ...workingCopy, customFields: workingCopy.customFields.map(f => f.id === cf.id ? { ...f, label: e.target.value } : f) })}
                              placeholder="Section title..."
                              className="text-sm font-semibold text-slate-700 bg-transparent border-none outline-none focus:text-indigo-700 placeholder:text-slate-300"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => onUpdate({ ...workingCopy, customFields: workingCopy.customFields.filter(f => f.id !== cf.id) })}
                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <div className="p-4 space-y-2">
                          {focusedField === cf.id && (
                            <Toolbar onAction={handleAction} onUpload={t => onOpenUpload(t, cf.id)} />
                          )}
                          <textarea
                            value={cf.value}
                            onFocus={() => setFocusedField(cf.id)}
                            onBlur={() => setFocusedField(null)}
                            onChange={e => onUpdate({ ...workingCopy, customFields: workingCopy.customFields.map(f => f.id === cf.id ? { ...f, value: e.target.value } : f) })}
                            onPaste={e => handlePaste(cf.id, e)}
                            ref={taRef(cf.id)}
                            placeholder="Enter evidence, notes, or scan output..."
                            className={`${textareaCls} min-h-[100px] bg-transparent border-slate-100`}
                          />
                        </div>
                      </div>
                    ))}
                    {workingCopy.customFields.length === 0 && (
                      <div className="flex flex-col items-center gap-2 py-10 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
                        <FileText size={22} />
                        <p className="text-sm font-medium">No evidence sections yet</p>
                        <p className="text-xs">Click "Add Section" to attach scan output, PoC steps or screenshots.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB: Remediation ──────────────────────────────────────────── */}
            {activeTab === 'remediation' && (
              <div className="space-y-6">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label="Date Identified" required>
                    <input type="date" value={workingCopy.dateIdentified || ''} onChange={e => up('dateIdentified', e.target.value)} className={inputCls} />
                  </Field>

                  <Field label="Vulnerability Source" required>
                    <select value={workingCopy.vulnerabilitySource || ''} onChange={e => up('vulnerabilitySource', e.target.value)} className={inputCls}>
                      <option value="">Select source…</option>
                      <option value="Internal Scan">Internal Scan</option>
                      <option value="External Scan">External Scan</option>
                      <option value="Manual Report">Manual Report</option>
                      <option value="NCSC Advisory">NCSC Advisory</option>
                      <option value="CISA Advisory">CISA Advisory</option>
                      <option value="Vendor Advisory">Vendor Advisory</option>
                      <option value="Azure Defender for Cloud">Azure Defender for Cloud</option>
                      <option value="Other">Other</option>
                    </select>
                  </Field>

                  <Field label="Asset Classification" required>
                    <select value={workingCopy.assetClassification || ''} onChange={e => up('assetClassification', e.target.value)} className={inputCls}>
                      <option value="">Select classification…</option>
                      <option value="Confidential">Confidential</option>
                      <option value="Internal">Internal</option>
                      <option value="Public">Public</option>
                    </select>
                  </Field>

                  <Field label="Exposure" required>
                    <select value={workingCopy.exposure || ''} onChange={e => up('exposure', e.target.value)} className={inputCls}>
                      <option value="">Select exposure…</option>
                      <option value="Internet-facing">Internet-facing</option>
                      <option value="Internal">Internal</option>
                      <option value="Restricted">Restricted</option>
                      <option value="Third-party managed">Third-party managed</option>
                    </select>
                  </Field>

                  <Field label="Remediation Owner" required hint="Person or team responsible for the fix">
                    <div className="relative">
                      <User size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="text" value={workingCopy.remediationOwner || ''} onChange={e => up('remediationOwner', e.target.value)} placeholder="e.g. IT Infrastructure Team" className={`${inputCls} pl-9`} />
                    </div>
                  </Field>

                  <Field label="SLA Due Date">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Calendar size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="date" value={workingCopy.remediationDueDate || ''} onChange={e => up('remediationDueDate', e.target.value)} className={`${inputCls} pl-9`} />
                      </div>
                      {getSlaDays(workingCopy.severity) && (
                        <button
                          type="button"
                          onClick={() => up('remediationDueDate', getDefaultDueDate(workingCopy))}
                          className="shrink-0 px-3 py-2.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-100 transition-all"
                          title={`Auto-set to ${getSlaDays(workingCopy.severity)} days from identification`}
                        >
                          Auto ({getSlaDays(workingCopy.severity)}d)
                        </button>
                      )}
                    </div>
                  </Field>
                </div>

                <Field label="Business Impact" required hint="Asset criticality, data sensitivity, regulatory obligations or operational risk">
                  <textarea value={workingCopy.businessImpact || ''} onChange={e => up('businessImpact', e.target.value)} className={`${textareaCls} min-h-[100px]`} placeholder="Describe the potential impact to the organisation if this vulnerability is exploited..." />
                </Field>

                <Field label="Remediation Action" hint="Patch, config change, or change-ticket reference. Can also use the 'Solution' field in Description tab.">
                  <textarea value={workingCopy.remediationAction || ''} onChange={e => up('remediationAction', e.target.value)} className={`${textareaCls} min-h-[100px]`} placeholder="e.g. Apply vendor patch KB12345, upgrade OpenSSL to 3.1.2, change ticket CHG-0042..." />
                </Field>

                {/* Closure */}
                <div className="border-t border-slate-100 pt-6 space-y-5">
                  <p className="text-sm font-semibold text-slate-700 flex items-center gap-2"><CheckCircle2 size={15} className="text-indigo-500" /> Closure &amp; Verification</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field label="Remediation Completed">
                      <input type="date" value={workingCopy.remediationCompletedDate || ''} onChange={e => up('remediationCompletedDate', e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Verification Date">
                      <input type="date" value={workingCopy.verificationDate || ''} onChange={e => up('verificationDate', e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Verification Result">
                      <select value={workingCopy.verificationResult || 'Not Verified'} onChange={e => up('verificationResult', e.target.value)} className={inputCls}>
                        <option value="Not Verified">Not Verified</option>
                        <option value="Passed">Passed</option>
                        <option value="Failed">Failed</option>
                        <option value="Compensating Control">Compensating Control</option>
                      </select>
                    </Field>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB: Audit / ISO ──────────────────────────────────────────── */}
            {activeTab === 'audit' && (
              <div className="space-y-6">

                {/* Evidence score */}
                <div className={`rounded-2xl border p-5 ${evidenceScore >= 80 ? 'bg-emerald-50 border-emerald-100' : evidenceScore >= 50 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={16} className={evidenceScore >= 80 ? 'text-emerald-600' : evidenceScore >= 50 ? 'text-amber-600' : 'text-red-500'} />
                      <span className="text-sm font-bold text-slate-700">ISO 27001 Audit Readiness</span>
                    </div>
                    <span className={`text-lg font-bold tabular-nums ${evidenceScore >= 80 ? 'text-emerald-700' : evidenceScore >= 50 ? 'text-amber-700' : 'text-red-600'}`}>{evidenceScore}%</span>
                  </div>
                  <div className="h-2.5 bg-white/60 rounded-full overflow-hidden mb-3">
                    <div className={`h-full rounded-full transition-all duration-500 ${evidenceScore >= 80 ? 'bg-emerald-500' : evidenceScore >= 50 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${evidenceScore}%` }} />
                  </div>
                  <p className="text-xs text-slate-600 flex items-center gap-1.5">
                    <Info size={11} />
                    {ISO_CONTROL_REFERENCE} — {procedureGaps.length === 0 ? 'All required fields complete. This record is audit-ready.' : `${procedureGaps.length} field${procedureGaps.length > 1 ? 's' : ''} missing for full compliance.`}
                  </p>
                </div>

                {/* Checklist */}
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-3">Register Completeness Checklist</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {auditChecks.map(c => (
                      <div key={c.label} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${c.ok ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                        {c.ok
                          ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                          : <XCircle size={14} className="text-red-400 shrink-0" />
                        }
                        <span className={`text-xs font-medium ${c.ok ? 'text-emerald-700' : 'text-red-700'}`}>{c.label}</span>
                        {!c.ok && (
                          <button
                            type="button"
                            onClick={() => {
                              const map: Partial<Record<string, Tab>> = {
                                'Date Identified': 'remediation', 'Vulnerability Source': 'remediation',
                                'Asset Classification': 'remediation', 'Exposure Level': 'remediation',
                                'Business Impact': 'remediation', 'Remediation Owner': 'remediation',
                                'Remediation Action': 'remediation', 'SLA Due Date': 'remediation',
                                'Affected Asset': 'overview', 'CVSS Score': 'overview',
                                'Verification Evidence': 'remediation', 'Exception Approved': 'audit',
                              };
                              const t = map[c.label];
                              if (t) setActiveTab(t);
                            }}
                            className="ml-auto text-[10px] font-semibold text-red-500 hover:text-red-700 flex items-center gap-0.5 shrink-0"
                          >
                            Fix <ChevronRight size={10} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Exception / Risk Acceptance */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <label className="flex items-center gap-3 px-5 py-4 bg-white cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={Boolean(workingCopy.exceptionRequired)}
                      onChange={e => up('exceptionRequired', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Exception / Risk Acceptance Required</p>
                      <p className="text-xs text-slate-400 mt-0.5">Vulnerability cannot be fully remediated within SLA. Requires formal risk acceptance from ISM.</p>
                    </div>
                    {workingCopy.exceptionRequired && <AlertTriangle size={14} className="text-amber-500 ml-auto shrink-0" />}
                  </label>

                  {workingCopy.exceptionRequired && (
                    <div className="px-5 py-5 bg-amber-50/50 border-t border-amber-100 space-y-4">
                      <Field label="Exception Justification" required hint="Why this vulnerability cannot be remediated within SLA">
                        <textarea value={workingCopy.exceptionJustification || ''} onChange={e => up('exceptionJustification', e.target.value)} className={`${textareaCls} min-h-[80px]`} placeholder="Describe the business or technical reason for the exception..." />
                      </Field>
                      <Field label="Compensating Controls" hint="Mitigating controls that reduce the risk while the exception is active">
                        <textarea value={workingCopy.compensatingControls || ''} onChange={e => up('compensatingControls', e.target.value)} className={`${textareaCls} min-h-[80px]`} placeholder="WAF rule, network segmentation, increased monitoring..." />
                      </Field>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="Risk Acceptance Approver" required>
                          <div className="relative">
                            <User size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input type="text" value={workingCopy.riskAcceptanceApprover || ''} onChange={e => up('riskAcceptanceApprover', e.target.value)} placeholder="ISM / Senior Manager name" className={`${inputCls} pl-9`} />
                          </div>
                        </Field>
                        <Field label="Approval Date">
                          <input type="date" value={workingCopy.riskAcceptanceDate || ''} onChange={e => up('riskAcceptanceDate', e.target.value)} className={inputCls} />
                        </Field>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── Live Preview ─────────────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col w-[680px] shrink-0 bg-slate-50/50 border-l border-slate-100 overflow-y-auto custom-scrollbar">
        <div className="sticky top-0 z-10 px-6 py-4 bg-white/90 backdrop-blur-sm border-b border-slate-100">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Live Preview</p>
          <p className="text-base font-bold text-slate-800 mt-1 leading-tight">{workingCopy.title || 'Draft Vulnerability'}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${sevCfg.light}`}>{workingCopy.severity}</span>
            <span className="text-xs text-slate-400 font-medium">{workingCopy.state}</span>
            {workingCopy.cvssScore && <span className="text-xs font-semibold text-slate-500">CVSS {workingCopy.cvssScore}</span>}
          </div>
        </div>

        <div className="flex-1 px-6 py-6 space-y-8">
          {/* ISO summary */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{ISO_CONTROL_REFERENCE}</p>
            <div className="space-y-1.5 text-xs">
              {[
                ['Asset', workingCopy.affected],
                ['Source', workingCopy.vulnerabilitySource],
                ['Classification', workingCopy.assetClassification],
                ['Exposure', workingCopy.exposure],
                ['Owner', workingCopy.remediationOwner],
                ['SLA Due', workingCopy.remediationDueDate],
                ['Verified', workingCopy.verificationResult !== 'Not Verified' ? workingCopy.verificationResult : null],
              ].map(([k, v]) => v ? (
                <div key={k} className="flex items-center justify-between">
                  <span className="text-slate-400">{k}</span>
                  <span className="font-medium text-slate-700 text-right max-w-[380px] truncate">{v}</span>
                </div>
              ) : null)}
            </div>
          </div>

          {/* Description preview */}
          {workingCopy.description && (
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Description</p>
              <div className="prose prose-sm max-w-none text-slate-700">
                <MarkdownRenderer content={workingCopy.description} />
              </div>
            </div>
          )}

          {/* Solution preview */}
          {workingCopy.solution && (
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Recommended Fix</p>
              <div className="prose prose-sm max-w-none text-slate-700">
                <MarkdownRenderer content={workingCopy.solution} />
              </div>
            </div>
          )}

          {/* Custom sections */}
          {workingCopy.customFields.map(cf => cf.value ? (
            <div key={cf.id}>
              <p className="text-[11px] font-semibold text-indigo-500 uppercase tracking-wider mb-2">{cf.label || 'Evidence'}</p>
              <div className="prose prose-sm max-w-none text-slate-700">
                <MarkdownRenderer content={cf.value} />
              </div>
            </div>
          ) : null)}
        </div>
      </div>
    </div>
  );
};
