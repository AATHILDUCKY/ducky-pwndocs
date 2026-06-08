import React, { useMemo, useState } from 'react';
import { Download, ImageIcon, Maximize2, Minus, PlayCircle, Plus, Video, X } from 'lucide-react';

type MarkdownBlock =
  | { type: 'text'; content: string }
  | { type: 'code'; content: string; language?: string };

const MEDIA_PATTERN = /(\[image:.*?\]|\[video:.*?\]|\[image\|.*?\|.*?\]|\[video\|.*?\|.*?\])/g;

const parseCodeBlocks = (content: string): MarkdownBlock[] => {
  const normalized = content.replace(/\r\n/g, '\n');
  const blocks: MarkdownBlock[] = [];
  let cursor = 0;

  while (cursor < normalized.length) {
    const start = normalized.indexOf('```', cursor);
    if (start === -1) {
      const tail = normalized.slice(cursor);
      if (tail) blocks.push({ type: 'text', content: tail });
      break;
    }

    if (start > cursor) blocks.push({ type: 'text', content: normalized.slice(cursor, start) });

    const end = normalized.indexOf('```', start + 3);
    const body = normalized.slice(start + 3, end === -1 ? normalized.length : end);
    const newline = body.indexOf('\n');
    blocks.push({
      type: 'code',
      language: newline === -1 ? body.trim() : body.slice(0, newline).trim(),
      content: newline === -1 ? '' : body.slice(newline + 1).replace(/\n$/, ''),
    });
    cursor = end === -1 ? normalized.length : end + 3;
  }

  return blocks;
};

const renderInline = (value: string, keyPrefix: string): React.ReactNode[] => {
  const tokens = value.split(/(\*\*.*?\*\*|__.*?__|\*.*?\*|_.*?_|~~.*?~~|`.*?`|\[.*?\]\(.*?\))/g);

  return tokens.filter(Boolean).map((token, index) => {
    const key = `${keyPrefix}-${index}`;
    const link = token.match(/^\[(.*?)\]\((.*?)\)$/);
    if (link) {
      return (
        <a key={key} href={link[2]} target="_blank" rel="noreferrer" className="text-indigo-600 underline underline-offset-4">
          {link[1]}
        </a>
      );
    }
    if ((token.startsWith('**') && token.endsWith('**')) || (token.startsWith('__') && token.endsWith('__'))) {
      return <strong key={key} className="font-bold text-slate-900">{token.slice(2, -2)}</strong>;
    }
    if ((token.startsWith('*') && token.endsWith('*')) || (token.startsWith('_') && token.endsWith('_'))) {
      return <em key={key} className="text-slate-700">{token.slice(1, -1)}</em>;
    }
    if (token.startsWith('~~') && token.endsWith('~~')) {
      return <del key={key} className="text-slate-400">{token.slice(2, -2)}</del>;
    }
    if (token.startsWith('`') && token.endsWith('`')) {
      return <code key={key} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-indigo-700">{token.slice(1, -1)}</code>;
    }
    return <React.Fragment key={key}>{token}</React.Fragment>;
  });
};

export const MediaArtifact: React.FC<{ type: 'image' | 'video'; url: string; alt?: string }> = ({ type, url, alt }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  const download = (event: React.MouseEvent) => {
    event.preventDefault();
    const link = document.createElement('a');
    link.href = url;
    link.download = alt || `evidence-${Date.now()}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="my-5 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2">
        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {type === 'image' ? <ImageIcon size={12} /> : <Video size={12} />}
          Evidence
        </span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setIsOpen(true)} className="rounded-md p-1.5 text-slate-500 hover:bg-white" title="Open large view">
            <Maximize2 size={13} />
          </button>
          <button type="button" onClick={download} className="rounded-md p-1.5 text-slate-500 hover:bg-white" title="Download">
            <Download size={13} />
          </button>
        </div>
      </div>

      <div className="bg-white p-3">
        {type === 'image' ? (
          <img src={url} alt={alt || 'Evidence'} className="max-h-[460px] w-full object-contain" />
        ) : (
          <div className="relative">
            <video src={url} controls className="max-h-[460px] w-full bg-black object-contain" />
            <PlayCircle size={42} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/40" />
          </div>
        )}
      </div>
      {alt && <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">{alt}</p>}

      {isOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-slate-950/85 p-5">
          <button className="absolute inset-0 cursor-default" onClick={() => setIsOpen(false)} aria-label="Close viewer" />
          <div className="relative z-10 max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-lg bg-black">
            <div className="flex items-center justify-between bg-black px-3 py-2 text-white">
              <span className="text-xs font-bold uppercase tracking-widest">{type}</span>
              <div className="flex items-center gap-1">
                {type === 'image' && (
                  <>
                    <button type="button" onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))} className="rounded p-1.5 hover:bg-white/10" title="Zoom out">
                      <Minus size={13} />
                    </button>
                    <button type="button" onClick={() => setZoom((value) => Math.min(3, value + 0.25))} className="rounded p-1.5 hover:bg-white/10" title="Zoom in">
                      <Plus size={13} />
                    </button>
                  </>
                )}
                <button type="button" onClick={() => setIsOpen(false)} className="rounded p-1.5 hover:bg-white/10" title="Close">
                  <X size={13} />
                </button>
              </div>
            </div>
            <div className="flex max-h-[82vh] items-center justify-center overflow-auto bg-black">
              {type === 'image' ? (
                <img src={url} alt={alt || 'Evidence'} className="max-h-[82vh] object-contain" style={{ transform: `scale(${zoom})` }} />
              ) : (
                <video src={url} controls className="max-h-[82vh] w-full bg-black object-contain" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  const blocks = useMemo(() => parseCodeBlocks(content || ''), [content]);
  if (!content) return null;

  const renderTextLines = (text: string, keyPrefix: string) => {
    const lines = text.split('\n');
    const nodes: React.ReactNode[] = [];
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];
      const trimmed = line.trim();

      if (!trimmed) {
        index += 1;
        continue;
      }

      const heading = line.match(/^(#{1,4})\s+(.*)$/);
      if (heading) {
        const Tag = `h${heading[1].length}` as React.ElementType;
        nodes.push(
          <Tag key={`${keyPrefix}-h-${index}`} className="mb-2 mt-4 font-bold text-slate-900">
            {renderInline(heading[2], `${keyPrefix}-h-${index}`)}
          </Tag>
        );
        index += 1;
        continue;
      }

      const unordered = line.match(/^\s*[-+*]\s+(.*)$/);
      if (unordered) {
        const items: string[] = [];
        while (index < lines.length) {
          const match = lines[index].match(/^\s*[-+*]\s+(.*)$/);
          if (!match) break;
          items.push(match[1]);
          index += 1;
        }
        nodes.push(
          <ul key={`${keyPrefix}-ul-${index}`} className="my-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
            {items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item, `${keyPrefix}-ul-${index}-${itemIndex}`)}</li>)}
          </ul>
        );
        continue;
      }

      const ordered = line.match(/^\s*\d+\.\s+(.*)$/);
      if (ordered) {
        const items: string[] = [];
        while (index < lines.length) {
          const match = lines[index].match(/^\s*\d+\.\s+(.*)$/);
          if (!match) break;
          items.push(match[1]);
          index += 1;
        }
        nodes.push(
          <ol key={`${keyPrefix}-ol-${index}`} className="my-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-700">
            {items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item, `${keyPrefix}-ol-${index}-${itemIndex}`)}</li>)}
          </ol>
        );
        continue;
      }

      if (trimmed.startsWith('>')) {
        nodes.push(
          <blockquote key={`${keyPrefix}-q-${index}`} className="my-2 border-l-2 border-slate-300 pl-3 text-sm italic text-slate-600">
            {renderInline(trimmed.replace(/^>\s?/, ''), `${keyPrefix}-q-${index}`)}
          </blockquote>
        );
        index += 1;
        continue;
      }

      nodes.push(
        <p key={`${keyPrefix}-p-${index}`} className="my-2 text-sm leading-6 text-slate-700">
          {renderInline(line, `${keyPrefix}-p-${index}`)}
        </p>
      );
      index += 1;
    }

    return nodes;
  };

  const renderTextBlock = (text: string, blockIndex: number) =>
    text.split(MEDIA_PATTERN).flatMap((part, partIndex) => {
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

  return (
    <div className="space-y-2">
      {blocks.map((block, index) =>
        block.type === 'code' ? (
          <pre key={`code-${index}`} className="my-4 overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-4 text-xs leading-6 text-slate-100">
            {block.language && <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{block.language}</div>}
            <code>{block.content}</code>
          </pre>
        ) : (
          <React.Fragment key={`text-${index}`}>{renderTextBlock(block.content, index)}</React.Fragment>
        )
      )}
    </div>
  );
};
