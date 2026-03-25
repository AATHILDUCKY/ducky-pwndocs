
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
    link.download = alt || `artifact-${Date.now()}`;
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
    <div className="group relative my-6 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 transition-all hover:shadow-lg">
      <div className="flex items-center justify-between px-4 py-2 bg-white/90 backdrop-blur-sm border-b border-slate-100 absolute top-0 left-0 right-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          {type === 'image' ? <ImageIcon size={10} /> : <Video size={10} />}
          Evidence Artifact
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={openViewer}
            className="p-1.5 bg-white text-slate-500 rounded-md hover:bg-slate-100 transition-all shadow-sm border border-slate-200"
            title="Open large view"
          >
            <Maximize2 size={12} />
          </button>
          <button 
            onClick={handleDownload}
            className="p-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-all shadow-md"
            title="Download"
          >
            <Download size={12} />
          </button>
        </div>
      </div>
      
      {type === 'image' ? (
        <div className="w-full bg-white p-3 flex items-center justify-center">
          <img src={url} alt={alt} className="w-full h-auto object-contain max-h-[460px]" />
        </div>
      ) : (
        <div className="w-full bg-white p-3 flex items-center justify-center relative">
          <video src={url} controls className="w-full max-h-[460px] object-contain bg-black" />
          <PlayCircle size={48} className="text-white opacity-40 absolute pointer-events-none" />
        </div>
      )}
      
      {alt && <div className="px-5 py-3 bg-white border-t border-slate-50 text-[11px] font-medium text-slate-500 italic">{alt}</div>}

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

      return part.split('\n').map((line, lineIndex) => {
        let processed = line.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>');
        processed = processed.replace(/`(.*?)`/g, '<code class="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-indigo-600 text-[0.9em] whitespace-pre-wrap">$1</code>');

        if (line.trim().startsWith('- ')) {
          return (
            <li
              key={`line-${blockIndex}-${partIndex}-${lineIndex}`}
              className="text-[15px] text-slate-800 leading-relaxed ml-4 my-1"
              dangerouslySetInnerHTML={{ __html: processed.trim().substring(2) }}
            />
          );
        }
        return processed.trim() ? (
          <p
            key={`line-${blockIndex}-${partIndex}-${lineIndex}`}
            className="text-[15px] text-slate-800 leading-relaxed my-2"
            dangerouslySetInnerHTML={{ __html: processed }}
          />
        ) : null;
      });
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
