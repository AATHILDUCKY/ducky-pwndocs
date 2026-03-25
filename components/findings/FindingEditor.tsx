
import React, { useMemo, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Code,
  Code2,
  Link,
  Table as TableIcon,
  ImageIcon,
  Video,
  PlusCircle,
  ArrowUp,
  ArrowDown,
  Trash2,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Strikethrough
} from 'lucide-react';
import { Issue } from '../../types';
import { MarkdownRenderer } from './MarkdownRenderer';

type ToolbarAction =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'inlineCode'
  | 'codeBlock'
  | 'link'
  | 'table'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'ul'
  | 'ol'
  | 'quote';

const ToolbarButton: React.FC<{
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ title, onClick, children }) => (
  <button
    type="button"
    title={title}
    onMouseDown={(event) => event.preventDefault()}
    onClick={onClick}
    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
  >
    {children}
  </button>
);

const EditorToolbar: React.FC<{
  onUpload: (type: 'image' | 'video') => void;
  onAction: (action: ToolbarAction) => void;
}> = ({ onUpload, onAction }) => (
  <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl p-1 shadow-2xl shadow-slate-200/50 z-[50] animate-in fade-in slide-in-from-bottom-1 duration-200">
    <ToolbarButton title="Bold (**text**)" onClick={() => onAction('bold')}>
      <Bold size={13} />
    </ToolbarButton>
    <ToolbarButton title="Italic (*text*)" onClick={() => onAction('italic')}>
      <Italic size={13} />
    </ToolbarButton>
    <ToolbarButton title="Strikethrough (~~text~~)" onClick={() => onAction('strike')}>
      <Strikethrough size={13} />
    </ToolbarButton>
    <ToolbarButton title="Inline code (`code`)" onClick={() => onAction('inlineCode')}>
      <Code size={13} />
    </ToolbarButton>
    <ToolbarButton title="Code block (```)" onClick={() => onAction('codeBlock')}>
      <Code2 size={13} />
    </ToolbarButton>
    <div className="w-px h-4 bg-slate-200 mx-1.5"></div>
    <ToolbarButton title="Heading 1 (#)" onClick={() => onAction('h1')}>
      <Heading1 size={13} />
    </ToolbarButton>
    <ToolbarButton title="Heading 2 (##)" onClick={() => onAction('h2')}>
      <Heading2 size={13} />
    </ToolbarButton>
    <ToolbarButton title="Heading 3 (###)" onClick={() => onAction('h3')}>
      <Heading3 size={13} />
    </ToolbarButton>
    <ToolbarButton title="Bullet list (-)" onClick={() => onAction('ul')}>
      <List size={13} />
    </ToolbarButton>
    <ToolbarButton title="Numbered list (1.)" onClick={() => onAction('ol')}>
      <ListOrdered size={13} />
    </ToolbarButton>
    <ToolbarButton title="Quote (> )" onClick={() => onAction('quote')}>
      <Quote size={13} />
    </ToolbarButton>
    <div className="w-px h-4 bg-slate-200 mx-1.5"></div>
    <ToolbarButton title="Link ([text](url))" onClick={() => onAction('link')}>
      <Link size={13} />
    </ToolbarButton>
    <ToolbarButton title="Table" onClick={() => onAction('table')}>
      <TableIcon size={13} />
    </ToolbarButton>
    <div className="w-px h-4 bg-slate-200 mx-1.5"></div>
    <button
      type="button"
      title="Insert image"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onUpload('image')}
      className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-600 transition-colors"
    >
      <ImageIcon size={13} />
    </button>
    <button
      type="button"
      title="Insert video"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onUpload('video')}
      className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-600 transition-colors"
    >
      <Video size={13} />
    </button>
  </div>
);

const normalizeMarkdown = (value: string) =>
  value
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');

const extractCodeLanguage = (codeEl: Element | null) => {
  if (!codeEl) return '';
  const className = codeEl.getAttribute('class') || '';
  const match = className.match(/language-([a-z0-9_-]+)/i);
  return match ? match[1] : '';
};

const htmlToMarkdown = (html: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const serializeInline = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
      return text;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    switch (tag) {
      case 'strong':
      case 'b':
        return `**${serializeChildrenInline(el)}**`;
      case 'em':
      case 'i':
        return `*${serializeChildrenInline(el)}*`;
      case 's':
      case 'del':
      case 'strike':
        return `~~${serializeChildrenInline(el)}~~`;
      case 'code': {
        if (el.parentElement?.tagName.toLowerCase() === 'pre') return '';
        const text = (el.textContent || '').replace(/`/g, '\\`');
        return `\`${text}\``;
      }
      case 'a': {
        const href = el.getAttribute('href') || '';
        const text = serializeChildrenInline(el).trim() || href;
        return href ? `[${text}](${href})` : text;
      }
      case 'img': {
        const alt = el.getAttribute('alt') || '';
        const src = el.getAttribute('src') || '';
        return src ? `![${alt}](${src})` : '';
      }
      case 'br':
        return '\n';
      case 'input': {
        const type = (el.getAttribute('type') || '').toLowerCase();
        if (type === 'checkbox') {
          return el.hasAttribute('checked') ? '[x]' : '[ ]';
        }
        return '';
      }
      default:
        return serializeChildrenInline(el);
    }
  };

  const serializeChildrenInline = (el: HTMLElement) =>
    Array.from(el.childNodes)
      .map(serializeInline)
      .join('');

  const serializeBlock = (node: Node, listDepth = 0): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || '').replace(/\u00a0/g, ' ');
      return text;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    switch (tag) {
      case 'p':
      case 'div':
      case 'section':
      case 'article':
      case 'header':
      case 'footer':
      case 'main':
      case 'aside':
      case 'figure':
      case 'figcaption': {
        const content = serializeChildrenInline(el).trim();
        return content ? `\n\n${content}\n\n` : '';
      }
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6': {
        const level = Number(tag.replace('h', ''));
        const content = serializeChildrenInline(el).trim();
        return content ? `\n\n${'#'.repeat(level)} ${content}\n\n` : '';
      }
      case 'pre': {
        const codeEl = el.querySelector('code');
        const language = extractCodeLanguage(codeEl);
        const codeText = (codeEl?.textContent || el.textContent || '').replace(/\n+$/, '');
        const fence = `\`\`\`${language ? language : ''}`;
        return `\n\n${fence}\n${codeText}\n\`\`\`\n\n`;
      }
      case 'blockquote': {
        const content = serializeChildrenBlock(el, listDepth).trim();
        if (!content) return '';
        const lines = content.split('\n').map((line) => `> ${line}`.trimEnd());
        return `\n\n${lines.join('\n')}\n\n`;
      }
      case 'ul':
        return `\n\n${serializeList(el, 'ul', listDepth)}\n\n`;
      case 'ol':
        return `\n\n${serializeList(el, 'ol', listDepth)}\n\n`;
      case 'table':
        return tableToMarkdown(el);
      case 'hr':
        return '\n\n---\n\n';
      case 'br':
        return '\n';
      default:
        return serializeChildrenBlock(el, listDepth);
    }
  };

  const serializeChildrenBlock = (el: HTMLElement, listDepth = 0) =>
    Array.from(el.childNodes)
      .map((child) => serializeBlock(child, listDepth))
      .join('');

  const serializeList = (listEl: HTMLElement, type: 'ul' | 'ol', depth: number) => {
    const items = Array.from(listEl.children).filter((child) => child.tagName.toLowerCase() === 'li');
    const indent = '  '.repeat(depth);

    return items
      .map((item, index) => {
        const li = item as HTMLElement;
        const marker = type === 'ol' ? `${index + 1}.` : '-';
        const inlineParts: string[] = [];
        const nestedParts: string[] = [];

        Array.from(li.childNodes).forEach((child) => {
          if (child.nodeType === Node.ELEMENT_NODE) {
            const childTag = (child as HTMLElement).tagName.toLowerCase();
            if (childTag === 'ul' || childTag === 'ol') {
              nestedParts.push(serializeList(child as HTMLElement, childTag as 'ul' | 'ol', depth + 1));
              return;
            }
          }
          inlineParts.push(serializeInline(child));
        });

        const content = inlineParts.join('').trim();
        const line = `${indent}${marker} ${content}`.trimEnd();
        if (!nestedParts.length) return line;
        const nested = nestedParts.map((part) => `\n${part}`).join('');
        return `${line}${nested}`;
      })
      .join('\n');
  };

  const tableToMarkdown = (tableEl: HTMLElement) => {
    const rows = Array.from(tableEl.querySelectorAll('tr'));
    if (!rows.length) return '';
    const cellRows = rows.map((row) =>
      Array.from(row.querySelectorAll('th,td')).map((cell) =>
        serializeChildrenInline(cell as HTMLElement).trim().replace(/\|/g, '\\|')
      )
    );
    const columnCount = Math.max(...cellRows.map((row) => row.length));
    const normalized = cellRows.map((row) => row.concat(Array(columnCount - row.length).fill('')));
    const header = normalized[0];
    const divider = Array(columnCount).fill('---');
    const renderRow = (cells: string[]) => `| ${cells.join(' | ')} |`;
    const body = normalized.slice(1).map(renderRow);
    const table = [renderRow(header), renderRow(divider), ...body].join('\n');
    return `\n\n${table}\n\n`;
  };

  const raw = serializeChildrenBlock(doc.body);
  return normalizeMarkdown(raw).trim();
};

export const FindingEditor: React.FC<{ 
  workingCopy: Issue; 
  onUpdate: (data: Issue) => void;
  onOpenUpload: (type: 'image' | 'video', targetField: string) => void;
}> = ({ workingCopy, onUpdate, onOpenUpload }) => {
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const fieldRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const updateMainField = (key: keyof Issue, value: any) => onUpdate({ ...workingCopy, [key]: value });
  
  const updateCustomField = (id: string, key: 'label' | 'value', val: string) => {
    const fields = workingCopy.customFields.map((f) => (f.id === id ? { ...f, [key]: val } : f));
    onUpdate({ ...workingCopy, customFields: fields });
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const fields = [...workingCopy.customFields];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= fields.length) return;
    [fields[index], fields[target]] = [fields[target], fields[index]];
    onUpdate({ ...workingCopy, customFields: fields });
  };

  const getFieldValue = (fieldId: string) => {
    if (fieldId === 'description') return workingCopy.description || '';
    const target = workingCopy.customFields.find((field) => field.id === fieldId);
    return target?.value || '';
  };

  const setFieldValue = (fieldId: string, value: string) => {
    if (fieldId === 'description') {
      updateMainField('description', value);
      return;
    }
    updateCustomField(fieldId, 'value', value);
  };

  const applySelection = (
    fieldId: string,
    transformer: (value: string, start: number, end: number) => {
      value: string;
      selectionStart: number;
      selectionEnd: number;
    }
  ) => {
    const currentValue = getFieldValue(fieldId);
    const textarea = fieldRefs.current[fieldId];
    const start = textarea?.selectionStart ?? currentValue.length;
    const end = textarea?.selectionEnd ?? currentValue.length;
    const next = transformer(currentValue, start, end);
    setFieldValue(fieldId, next.value);
    requestAnimationFrame(() => {
      const target = fieldRefs.current[fieldId];
      if (!target) return;
      target.focus();
      target.setSelectionRange(next.selectionStart, next.selectionEnd);
    });
  };

  const insertTextAtSelection = (fieldId: string, text: string) => {
    applySelection(fieldId, (value, start, end) => {
      const nextValue = `${value.slice(0, start)}${text}${value.slice(end)}`;
      const caret = start + text.length;
      return { value: nextValue, selectionStart: caret, selectionEnd: caret };
    });
  };

  const handleMarkdownPaste = (
    fieldId: string,
    event: React.ClipboardEvent<HTMLTextAreaElement>
  ) => {
    const html = event.clipboardData.getData('text/html');
    if (!html || !/<[a-z][\s\S]*>/i.test(html)) return;
    const markdown = htmlToMarkdown(html);
    if (!markdown.trim()) return;
    event.preventDefault();
    insertTextAtSelection(fieldId, markdown);
  };

  const applyInline = (fieldId: string, prefix: string, suffix = prefix, placeholder = 'text') => {
    applySelection(fieldId, (value, start, end) => {
      const selected = value.slice(start, end);
      const nextText = selected || placeholder;
      const nextValue = `${value.slice(0, start)}${prefix}${nextText}${suffix}${value.slice(end)}`;
      const selectionStart = start + prefix.length;
      const selectionEnd = selectionStart + nextText.length;
      return { value: nextValue, selectionStart, selectionEnd };
    });
  };

  const applyBlock = (fieldId: string, wrapper: string, placeholder = 'code') => {
    applySelection(fieldId, (value, start, end) => {
      const selected = value.slice(start, end);
      const body = selected || placeholder;
      const before = value.slice(0, start);
      const after = value.slice(end);
      const nextValue = `${before}${wrapper}\n${body}\n${wrapper}${after}`;
      const selectionStart = start + wrapper.length + 1;
      const selectionEnd = selectionStart + body.length;
      return { value: nextValue, selectionStart, selectionEnd };
    });
  };

  const applyLinePrefix = (fieldId: string, prefixBuilder: (line: string, index: number) => string) => {
    applySelection(fieldId, (value, start, end) => {
      const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
      const lineEndIndex = value.indexOf('\n', end);
      const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
      const chunk = value.slice(lineStart, lineEnd);
      const lines = chunk.split('\n');
      const updated = lines.map((line, index) => {
        if (!line.trim()) return line;
        return prefixBuilder(line, index);
      });
      const nextChunk = updated.join('\n');
      const nextValue = `${value.slice(0, lineStart)}${nextChunk}${value.slice(lineEnd)}`;
      const selectionStart = lineStart;
      const selectionEnd = lineStart + nextChunk.length;
      return { value: nextValue, selectionStart, selectionEnd };
    });
  };

  const tableTemplate = useMemo(
    () => ['| Column | Column |', '| --- | --- |', '| Cell | Cell |'].join('\n'),
    []
  );

  const handleToolbarAction = (action: ToolbarAction) => {
    if (!focusedField) return;
    switch (action) {
      case 'bold':
        applyInline(focusedField, '**', '**', 'bold text');
        break;
      case 'italic':
        applyInline(focusedField, '*', '*', 'italic text');
        break;
      case 'strike':
        applyInline(focusedField, '~~', '~~', 'strikethrough');
        break;
      case 'inlineCode':
        applyInline(focusedField, '`', '`', 'code');
        break;
      case 'codeBlock':
        applyBlock(focusedField, '```', 'code');
        break;
      case 'link':
        applyInline(focusedField, '[', '](https://)', 'link text');
        break;
      case 'table':
        applySelection(focusedField, (value, start, end) => {
          const before = value.slice(0, start);
          const after = value.slice(end);
          const nextValue = `${before}${tableTemplate}${after}`;
          const selectionStart = start + 2;
          const selectionEnd = selectionStart + 6;
          return { value: nextValue, selectionStart, selectionEnd };
        });
        break;
      case 'h1':
        applyLinePrefix(focusedField, (line) => `# ${line.replace(/^\s*#{1,6}\s+/, '')}`);
        break;
      case 'h2':
        applyLinePrefix(focusedField, (line) => `## ${line.replace(/^\s*#{1,6}\s+/, '')}`);
        break;
      case 'h3':
        applyLinePrefix(focusedField, (line) => `### ${line.replace(/^\s*#{1,6}\s+/, '')}`);
        break;
      case 'ul':
        applyLinePrefix(focusedField, (line) => `- ${line.replace(/^\s*(?:[-+*]|\d+\.)\s+/, '')}`);
        break;
      case 'ol':
        applyLinePrefix(focusedField, (line, index) => `${index + 1}. ${line.replace(/^\s*(?:[-+*]|\d+\.)\s+/, '')}`);
        break;
      case 'quote':
        applyLinePrefix(focusedField, (line) => `> ${line.replace(/^\s*>\s+/, '')}`);
        break;
      default:
        break;
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Authoring Zone */}
      <div className="flex-1 overflow-y-auto bg-white border-r border-slate-100 p-8 lg:p-14 relative custom-scrollbar">
        <div className="max-w-3xl mx-auto space-y-14">
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] px-1">Finding Identity</label>
            <input 
              type="text" 
              value={workingCopy.title} 
              onChange={(e) => updateMainField('title', e.target.value)} 
              className="w-full text-3xl font-black text-slate-900 tracking-tighter p-1 border-none outline-none focus:ring-0 placeholder:text-slate-100 bg-transparent"
              placeholder="Finding Title..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 border-y border-slate-50 py-12">
            {[
              { id: 'severity', label: 'Severity' },
              { id: 'state', label: 'Status' },
              { id: 'cvssScore', label: 'CVSS Score' },
              { id: 'cvssVector', label: 'CVSS Vector' },
              { id: 'type', label: 'Domain' },
              { id: 'affected', label: 'Affected Asset' }
            ].map((f) => (
              <div key={f.id} className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{f.label}</label>
                {f.id === 'type' ? (
                  <select 
                    value={workingCopy.type} 
                    onChange={(e) => updateMainField('type', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 outline-none"
                  >
                    <option value="Internal">Internal</option>
                    <option value="External">External</option>
                  </select>
                ) : f.id === 'severity' ? (
                  <select
                    value={workingCopy.severity}
                    onChange={(e) => updateMainField('severity', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 outline-none"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                    <option value="Info">Info</option>
                  </select>
                ) : f.id === 'state' ? (
                  <select
                    value={workingCopy.state}
                    onChange={(e) => updateMainField('state', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 outline-none"
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Fixed">Fixed</option>
                    <option value="Draft">Draft</option>
                    <option value="Published">Published</option>
                    <option value="QA">QA</option>
                    <option value="Closed">Closed</option>
                  </select>
                ) : (
                  <input 
                    type="text" 
                    value={(workingCopy as any)[f.id]} 
                    onChange={(e) => updateMainField(f.id as any, e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-black text-slate-900 focus:bg-white transition-all shadow-sm outline-none"
                    placeholder={`Enter ${f.label}...`}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-50 pb-2.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</label>
              {focusedField === 'description' && (
                <EditorToolbar
                  onUpload={(type) => onOpenUpload(type, 'description')}
                  onAction={handleToolbarAction}
                />
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenUpload('image', 'description')}
                className="px-3 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
              >
                Insert Image
              </button>
              <button
                type="button"
                onClick={() => onOpenUpload('video', 'description')}
                className="px-3 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
              >
                Insert Video
              </button>
            </div>
            <textarea 
              value={workingCopy.description}
              onFocus={() => setFocusedField('description')}
              onChange={(e) => updateMainField('description', e.target.value)}
              onPaste={(e) => handleMarkdownPaste('description', e)}
              ref={(el) => {
                fieldRefs.current.description = el;
              }}
              className="w-full min-h-[400px] text-[16px] text-slate-800 leading-relaxed p-1 border-none outline-none focus:ring-0 placeholder:text-slate-100 bg-transparent resize-none font-medium"
              placeholder="Detail the vulnerability analysis..."
            />
          </div>

          <div className="space-y-10 pt-12 border-t border-slate-50 pb-32">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Tactical Intelligence Fields</label>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-2">These will appear at the bottom of the final report</p>
              </div>
              <button 
                onClick={() => onUpdate({ ...workingCopy, customFields: [...workingCopy.customFields, { id: `cf-${Date.now()}`, label: 'New Attribute', value: '' }] })} 
                className="flex items-center gap-1.5 text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest transition-colors bg-indigo-50/50 px-4 py-2 rounded-xl"
              >
                <PlusCircle size={14} /> Add Tactical Field
              </button>
            </div>
            
            <div className="space-y-6">
              {workingCopy.customFields.map((cf, idx) => (
                <div key={cf.id} className="group bg-slate-50/50 border border-slate-100 rounded-3xl p-8 hover:border-indigo-100 hover:bg-white transition-all shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => moveField(idx, 'up')} className="p-1 text-slate-300 hover:text-indigo-500"><ArrowUp size={12} /></button>
                        <button onClick={() => moveField(idx, 'down')} className="p-1 text-slate-300 hover:text-indigo-500"><ArrowDown size={12} /></button>
                      </div>
                      <div className="w-1.5 h-6 bg-slate-200 rounded-full mx-1"></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Attribute Segment {idx + 1}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {focusedField === cf.id && (
                        <EditorToolbar
                          onUpload={(type) => onOpenUpload(type, cf.id)}
                          onAction={handleToolbarAction}
                        />
                      )}
                      <button onClick={() => onUpdate({...workingCopy, customFields: workingCopy.customFields.filter(f => f.id !== cf.id)})} className="p-2 text-slate-300 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100 ml-2"><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <div className="space-y-8">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Field Heading</label>
                      <input 
                        type="text" value={cf.label} 
                        onChange={(e) => updateCustomField(cf.id, 'label', e.target.value)}
                        className="w-full bg-transparent border-none text-sm font-black text-slate-800 uppercase tracking-[0.2em] outline-none focus:text-indigo-700 placeholder:text-slate-200"
                        placeholder="Segment Heading..."
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Field Value (Markdown)</label>
                      <textarea 
                        value={cf.value} 
                        onFocus={() => setFocusedField(cf.id)}
                        onChange={(e) => updateCustomField(cf.id, 'value', e.target.value)}
                        onPaste={(e) => handleMarkdownPaste(cf.id, e)}
                        ref={(el) => {
                          fieldRefs.current[cf.id] = el;
                        }}
                        className="w-full bg-transparent border-none text-[15px] font-medium text-slate-800 outline-none resize-none min-h-[120px] leading-relaxed"
                        placeholder="Enter data or instructions..."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Live Preview Console */}
      <div className="flex-1 bg-slate-50/50 overflow-y-auto custom-scrollbar p-12 border-l border-slate-100 hidden lg:block">
        <div className="max-w-xl mx-auto space-y-12">
          <div className="space-y-3">
            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.4em]">Live Intelligence Preview</span>
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter leading-tight">{workingCopy.title || 'Draft Findings'}</h2>
          </div>
          <div className="space-y-16">
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-indigo-50 pb-2">Description</h4>
              <MarkdownRenderer content={workingCopy.description} />
            </div>
            {workingCopy.customFields.map(cf => (
              <div key={cf.id} className="space-y-3">
                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">{cf.label || 'Attribute Segment'}</h4>
                <div className="text-[14px] text-slate-800"><MarkdownRenderer content={cf.value} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
