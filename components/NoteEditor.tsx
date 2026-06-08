import React from 'react';

type NoteEditorProps = {
  editorKey: string;
  markdown: string;
  onChange: (value: string) => void;
  onUploadImage: () => Promise<string>;
};

const insertAtCursor = async (
  textarea: HTMLTextAreaElement | null,
  value: string,
  onChange: (next: string) => void,
  getUploadUrl?: () => Promise<string>
) => {
  if (!textarea) return;

  const uploadUrl = getUploadUrl ? await getUploadUrl() : '';
  const snippet = value.replace('{url}', uploadUrl);
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const next = `${textarea.value.slice(0, start)}${snippet}${textarea.value.slice(end)}`;
  onChange(next);

  requestAnimationFrame(() => {
    textarea.focus();
    const cursor = start + snippet.length;
    textarea.setSelectionRange(cursor, cursor);
  });
};

const NoteEditor: React.FC<NoteEditorProps> = ({ editorKey, markdown, onChange, onUploadImage }) => {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  return (
    <div key={editorKey} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 bg-slate-50 px-3 py-2">
        {[
          { label: 'B', title: 'Bold', value: '**bold text**' },
          { label: 'I', title: 'Italic', value: '*italic text*' },
          { label: 'H', title: 'Heading', value: '## Heading\n' },
          { label: '-', title: 'List', value: '- item\n' },
          { label: '`', title: 'Code', value: '```\ncode\n```\n' },
        ].map((item) => (
          <button
            key={item.title}
            type="button"
            title={item.title}
            onClick={() => insertAtCursor(textareaRef.current, item.value, onChange)}
            className="h-8 min-w-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          title="Insert image"
          onClick={() => insertAtCursor(textareaRef.current, '\n[image|{url}|Evidence]\n', onChange, onUploadImage)}
          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
        >
          Image
        </button>
      </div>
      <textarea
        ref={textareaRef}
        value={markdown}
        onChange={(event) => onChange(event.target.value)}
        spellCheck
        className="min-h-[420px] w-full resize-y border-0 bg-white p-4 text-sm leading-7 text-slate-800 outline-none placeholder:text-slate-400"
        placeholder="Write notes in simple markdown..."
      />
    </div>
  );
};

export default NoteEditor;
