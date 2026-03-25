import React, { useMemo } from 'react';
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  tablePlugin,
  imagePlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  ListsToggle,
  CreateLink,
  InsertImage,
  InsertTable,
  InsertCodeBlock,
  InsertThematicBreak,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';

type NoteEditorProps = {
  editorKey: string;
  markdown: string;
  onChange: (value: string) => void;
  onUploadImage: () => Promise<string>;
};

const NoteEditor: React.FC<NoteEditorProps> = ({ editorKey, markdown, onChange, onUploadImage }) => {
  const plugins = useMemo(
    () => [
      headingsPlugin({ allowedHeadingLevels: [1, 2, 3, 4] }),
      listsPlugin(),
      quotePlugin(),
      thematicBreakPlugin(),
      markdownShortcutPlugin(),
      codeBlockPlugin({ defaultCodeBlockLanguage: 'text' }),
      linkPlugin(),
      tablePlugin(),
      imagePlugin({ imageUploadHandler: onUploadImage }),
      codeMirrorPlugin({
        codeBlockLanguages: {
          js: 'JavaScript',
          ts: 'TypeScript',
          py: 'Python',
          html: 'HTML',
          css: 'CSS',
          sql: 'SQL',
          bash: 'Bash',
          json: 'JSON',
          markdown: 'Markdown',
          text: 'Text',
        },
      }),
      toolbarPlugin({
        toolbarContents: () => (
          <>
            <UndoRedo />
            <BlockTypeSelect />
            <BoldItalicUnderlineToggles />
            <ListsToggle />
            <CreateLink />
            <InsertImage />
            <InsertTable />
            <InsertCodeBlock />
            <InsertThematicBreak />
          </>
        ),
      }),
    ],
    [onUploadImage]
  );

  return (
    <MDXEditor
      key={editorKey}
      markdown={markdown}
      onChange={onChange}
      className="prose-report max-w-none mdxeditor-root"
      contentEditableClassName="mdxeditor-content-editable"
      plugins={plugins}
    />
  );
};

export default NoteEditor;
