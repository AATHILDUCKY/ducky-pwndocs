
import React, { useMemo, useState } from 'react';
import { Download, ImageIcon, Video, PlayCircle, Maximize2, Minus, Plus, X } from 'lucide-react';
import hljs from 'highlight.js';

type MarkdownBlock =
  | { type: 'text'; content: string }
  | { type: 'code'; content: string; language?: string };

const MEDIA_PATTERN = /(\[image:.*?\]|\[video:.*?\]|\[image\|.*?\]|\[video\|.*?\])/g;

const normalizeLanguage = (value?: string) => {
  if (!value) return 'text';
  const token = value.trim().split(/\s+/)[0].toLowerCase();
  if (!token) return 'text';
  if (token === 'golang') return 'go';
  if (token === 'c++') return 'cpp';
  if (token === 'sh') return 'bash';
  return token;
};

const highlightCode = (content: string, language?: string) => {
  const hasExplicit = Boolean(language && language.trim());
  const normalized = normalizeLanguage(language);

  if (!content) {
    return { html: '', language: hasExplicit ? normalized : 'text' };
  }

  if (hasExplicit && hljs.getLanguage(normalized)) {
    const highlighted = hljs.highlight(content, { language: normalized, ignoreIllegals: true });
    return { html: highlighted.value, language: normalized };
  }

  const auto = hljs.highlightAuto(content);
  return { html: auto.value, language: hasExplicit ? normalized : normalizeLanguage(auto.language) };
};

const parseCodeBlocks = (content: string): MarkdownBlock[] => {
  const normalized = content.replace(/\r\n/g, '\n');
  const blocks: MarkdownBlock[] = [];
  let cursor = 0;

  while (cursor < normalized.length) {
    const fenceStart = normalized.indexOf('```', cursor);
    if (fenceStart === -1) {
      const tail = normalized.slice(cursor);
      if (tail) blocks.push({ type: 'text', content: tail });
      break;
    }

    if (fenceStart > cursor) {
      blocks.push({ type: 'text', content: normalized.slice(cursor, fenceStart) });
    }

    const fenceEnd = normalized.indexOf('```', fenceStart + 3);
    const fenceBody = normalized.slice(fenceStart + 3, fenceEnd === -1 ? normalized.length : fenceEnd);
    const newlineIndex = fenceBody.indexOf('\n');
    const language = newlineIndex === -1 ? fenceBody.trim() : fenceBody.slice(0, newlineIndex).trim();
    const rawBody = newlineIndex === -1 ? '' : fenceBody.slice(newlineIndex + 1);
    const body = rawBody.replace(/\n$/, '');

    blocks.push({ type: 'code', content: body, language });
    cursor = fenceEnd === -1 ? normalized.length : fenceEnd + 3;
  }

  return blocks;
};

export const MediaArtifact: React.FC<{ type: 'image' | 'video'; url: string; alt?: string }> = ({ type, url, alt }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOrigin, setDragOrigin] = useState({ x: 0, y: 0 });

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    const link = document.createElement('a');
    link.href = url;
    link.download = alt || `vanguard-evidence-${Date.now()}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openViewer = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setIsOpen(true);
  };

  const closeViewer = () => setIsOpen(false);

  return (
    <div className="group relative my-8 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 transition-all hover:shadow-2xl">
      <div className="flex items-center justify-between px-5 py-3 bg-white/90 backdrop-blur-sm border-b border-slate-100 absolute top-0 left-0 right-0 z-10 opacity-0 group-hover:opacity-100 transition-all">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
          {type === 'image' ? <ImageIcon size={12} /> : <Video size={12} />}
          Secured Evidence
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={openViewer}
            className="p-2 bg-white text-slate-500 rounded-md hover:bg-slate-100 transition-all shadow-sm border border-slate-200"
            title="Open large view"
          >
            <Maximize2 size={12} />
          </button>
          <button onClick={handleDownload} className="p-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-all shadow-lg flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">
            <Download size={14} /> Download
          </button>
        </div>
      </div>
      
      {type === 'image' ? (
        <div className="w-full bg-white p-3 flex items-center justify-center">
          <img src={url} alt={alt} className="w-full h-auto object-contain max-h-[560px]" />
        </div>
      ) : (
        <div className="w-full bg-white p-3 flex items-center justify-center relative">
          <video src={url} controls className="w-full max-h-[560px] object-contain bg-black" />
          <PlayCircle size={48} className="text-white opacity-40 absolute pointer-events-none" />
        </div>
      )}
      
      {alt && <div className="px-6 py-4 bg-white border-t border-slate-50 text-[12px] font-semibold text-slate-500 italic leading-relaxed">{alt}</div>}

      {isOpen && (
        <div className="fixed inset-0 z-[600] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="absolute inset-0" onClick={closeViewer} />
          <div className="relative z-10 w-full max-w-6xl max-h-[90vh] bg-black/40 border border-white/10 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-black/70 text-white">
              <div className="text-[10px] font-black uppercase tracking-widest">
                {type === 'image' ? 'Image' : 'Video'} Viewer
              </div>
              <div className="flex items-center gap-2">
                {type === 'image' && (
                  <>
                    <button
                      onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                      className="p-1.5 rounded-md bg-white/10 hover:bg-white/20"
                      title="Zoom out"
                    >
                      <Minus size={12} />
                    </button>
                    <button
                      onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
                      className="p-1.5 rounded-md bg-white/10 hover:bg-white/20"
                      title="Zoom in"
                    >
                      <Plus size={12} />
                    </button>
                  </>
                )}
                <button
                  onClick={closeViewer}
                  className="p-1.5 rounded-md bg-white/10 hover:bg-white/20"
                  title="Close"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
            <div
              className="flex items-center justify-center bg-black max-h-[80vh] overflow-hidden"
              onMouseMove={(event) => {
                if (!isDragging || zoom <= 1) return;
                const deltaX = event.clientX - dragOrigin.x;
                const deltaY = event.clientY - dragOrigin.y;
                setOffset((prev) => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
                setDragOrigin({ x: event.clientX, y: event.clientY });
              }}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
            >
              {type === 'image' ? (
                <img
                  src={url}
                  alt={alt}
                  className={`max-h-[80vh] object-contain ${zoom > 1 ? 'cursor-grab active:cursor-grabbing select-none' : ''}`}
                  style={{
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                    transformOrigin: 'center center',
                  }}
                  onMouseDown={(event) => {
                    if (zoom <= 1) return;
                    setIsDragging(true);
                    setDragOrigin({ x: event.clientX, y: event.clientY });
                  }}
                />
              ) : (
                <video src={url} controls className="w-full max-h-[80vh] object-contain bg-black" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  if (!content) return null;
  const blocks = useMemo(() => parseCodeBlocks(content), [content]);

  const renderInline = (line: string) => {
    let processed = line.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>');
    processed = processed.replace(/__(.*?)__/g, '<strong class="font-bold text-slate-900">$1</strong>');
    processed = processed.replace(/\*(.*?)\*/g, '<em class="italic text-slate-700">$1</em>');
    processed = processed.replace(/_(.*?)_/g, '<em class="italic text-slate-700">$1</em>');
    processed = processed.replace(/~~(.*?)~~/g, '<del class="text-slate-400">$1</del>');
    processed = processed.replace(/`(.*?)`/g, '<code class="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-indigo-600 text-[0.9em] whitespace-pre-wrap">$1</code>');
    processed = processed.replace(
      /\[(.*?)\]\((.*?)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer" class="text-indigo-600 underline decoration-indigo-200 underline-offset-4 hover:text-indigo-700">$1</a>'
    );
    return processed;
  };

  const headingStyles: Record<number, string> = {
    1: 'text-3xl md:text-4xl font-black tracking-tight text-slate-900 mt-6 mb-3',
    2: 'text-2xl md:text-3xl font-black tracking-tight text-slate-900 mt-5 mb-3',
    3: 'text-xl md:text-2xl font-bold tracking-tight text-slate-900 mt-4 mb-2',
    4: 'text-lg font-bold text-slate-800 mt-3 mb-2',
    5: 'text-base font-semibold text-slate-800 mt-3 mb-2 uppercase tracking-wide',
    6: 'text-sm font-semibold text-slate-700 mt-3 mb-2 uppercase tracking-wider',
  };

  const renderTextLines = (text: string, keyPrefix: string) => {
    const lines = text.split('\n');
    const nodes: React.ReactNode[] = [];
    let lineIndex = 0;

    while (lineIndex < lines.length) {
      const line = lines[lineIndex];
      const trimmed = line.trim();

      if (!trimmed) {
        lineIndex += 1;
        continue;
      }

      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const HeadingTag = `h${level}` as React.ElementType;
        nodes.push(
          <HeadingTag
            key={`${keyPrefix}-heading-${lineIndex}`}
            className={headingStyles[level] || headingStyles[6]}
            dangerouslySetInnerHTML={{ __html: renderInline(headingMatch[2].trim()) }}
          />
        );
        lineIndex += 1;
        continue;
      }

      if (/^\s*(?:---|\*\*\*|___)\s*$/.test(line)) {
        nodes.push(<hr key={`${keyPrefix}-hr-${lineIndex}`} className="my-4 border-slate-200" />);
        lineIndex += 1;
        continue;
      }

      if (/^\s*>\s?/.test(line)) {
        const quoteLines: string[] = [];
        while (lineIndex < lines.length && /^\s*>\s?/.test(lines[lineIndex])) {
          quoteLines.push(lines[lineIndex].replace(/^\s*>\s?/, ''));
          lineIndex += 1;
        }
        nodes.push(
          <blockquote key={`${keyPrefix}-quote-${lineIndex}`} className="border-l-2 border-indigo-200 pl-4 my-3">
            {quoteLines.map((quoteLine, quoteIndex) =>
              quoteLine.trim() ? (
                <p
                  key={`${keyPrefix}-quote-line-${quoteIndex}`}
                  className="text-[15px] text-slate-700 italic leading-relaxed my-1"
                  dangerouslySetInnerHTML={{ __html: renderInline(quoteLine) }}
                />
              ) : null
            )}
          </blockquote>
        );
        continue;
      }

      const unorderedMatch = line.match(/^\s*[-+*]\s+(.*)$/);
      if (unorderedMatch) {
        const items: string[] = [];
        while (lineIndex < lines.length) {
          const match = lines[lineIndex].match(/^\s*[-+*]\s+(.*)$/);
          if (!match) break;
          items.push(match[1]);
          lineIndex += 1;
        }
        nodes.push(
          <ul key={`${keyPrefix}-ul-${lineIndex}`} className="list-disc pl-5 space-y-1 my-2">
            {items.map((item, itemIndex) => (
              <li
                key={`${keyPrefix}-ul-item-${itemIndex}`}
                className="text-[15px] text-slate-800 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderInline(item) }}
              />
            ))}
          </ul>
        );
        continue;
      }

      const orderedMatch = line.match(/^\s*\d+\.\s+(.*)$/);
      if (orderedMatch) {
        const items: string[] = [];
        while (lineIndex < lines.length) {
          const match = lines[lineIndex].match(/^\s*\d+\.\s+(.*)$/);
          if (!match) break;
          items.push(match[1]);
          lineIndex += 1;
        }
        nodes.push(
          <ol key={`${keyPrefix}-ol-${lineIndex}`} className="list-decimal pl-5 space-y-1 my-2">
            {items.map((item, itemIndex) => (
              <li
                key={`${keyPrefix}-ol-item-${itemIndex}`}
                className="text-[15px] text-slate-800 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderInline(item) }}
              />
            ))}
          </ol>
        );
        continue;
      }

      nodes.push(
        <p
          key={`${keyPrefix}-p-${lineIndex}`}
          className="text-[15px] text-slate-800 leading-relaxed my-2"
          dangerouslySetInnerHTML={{ __html: renderInline(line) }}
        />
      );
      lineIndex += 1;
    }

    return nodes;
  };

  const renderTextBlock = (text: string, blockIndex: number) => {
    const parts = text.split(MEDIA_PATTERN);
    return parts.flatMap((part, partIndex) => {
      const imagePipe = part.match(/\[image\|(.*?)\|(.*?)\]/);
      const videoPipe = part.match(/\[video\|(.*?)\|(.*?)\]/);
      const imageMatch = part.match(/\[image:(.*?):?(.*?)\]/);
      const videoMatch = part.match(/\[video:(.*?):?(.*?)\]/);

      if (imagePipe) return <MediaArtifact key={`media-${blockIndex}-${partIndex}`} type="image" url={imagePipe[1]} alt={imagePipe[2]} />;
      if (videoPipe) return <MediaArtifact key={`media-${blockIndex}-${partIndex}`} type="video" url={videoPipe[1]} alt={videoPipe[2]} />;
      if (imageMatch) return <MediaArtifact key={`media-${blockIndex}-${partIndex}`} type="image" url={imageMatch[1]} alt={imageMatch[2]} />;
      if (videoMatch) return <MediaArtifact key={`media-${blockIndex}-${partIndex}`} type="video" url={videoMatch[1]} alt={videoMatch[2]} />;

      return renderTextLines(part, `text-${blockIndex}-${partIndex}`);
    });
  };
  
  return (
    <div className="prose-report space-y-1">
      {blocks.map((block, index) => {
        if (block.type === 'code') {
          const { html, language } = highlightCode(block.content, block.language);
          return (
            <pre
              key={`code-${index}`}
              className="code-block relative bg-slate-950 text-slate-100 rounded-xl border border-slate-800/80 overflow-hidden my-4"
              data-language={language}
            >
              <div className="code-block-header flex items-center justify-between px-4 py-2 bg-slate-900/80 border-b border-slate-800/80 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                <span>{language}</span>
              </div>
              <code
                className="hljs block px-4 py-4 text-[13px] leading-relaxed overflow-x-auto font-mono whitespace-pre-wrap break-words"
                dangerouslySetInnerHTML={{ __html: html || '' }}
              />
            </pre>
          );
        }

        const nodes = renderTextBlock(block.content, index);
        return (
          <React.Fragment key={`text-${index}`}>
            {nodes}
          </React.Fragment>
        );
      })}
    </div>
  );
};
