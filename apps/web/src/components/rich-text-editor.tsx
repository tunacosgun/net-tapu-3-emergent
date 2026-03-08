'use client';

import { useRef, useCallback } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const toolbarButtons = [
  { cmd: 'bold', icon: 'B', title: 'Kalın', style: 'font-bold' },
  { cmd: 'italic', icon: 'I', title: 'İtalik', style: 'italic' },
  { cmd: 'underline', icon: 'U', title: 'Altı Çizili', style: 'underline' },
  { cmd: 'strikeThrough', icon: 'S', title: 'Üstü Çizili', style: 'line-through' },
  { cmd: 'divider' },
  { cmd: 'formatBlock:h2', icon: 'H2', title: 'Başlık 2' },
  { cmd: 'formatBlock:h3', icon: 'H3', title: 'Başlık 3' },
  { cmd: 'formatBlock:h4', icon: 'H4', title: 'Başlık 4' },
  { cmd: 'formatBlock:p', icon: 'P', title: 'Paragraf' },
  { cmd: 'divider' },
  { cmd: 'insertUnorderedList', icon: '•', title: 'Madde İşareti' },
  { cmd: 'insertOrderedList', icon: '1.', title: 'Numaralı Liste' },
  { cmd: 'divider' },
  { cmd: 'justifyLeft', icon: '⬏', title: 'Sola Hizala' },
  { cmd: 'justifyCenter', icon: '⬍', title: 'Ortala' },
  { cmd: 'divider' },
  { cmd: 'createLink', icon: '🔗', title: 'Link Ekle' },
  { cmd: 'removeFormat', icon: '✕', title: 'Biçimlendirmeyi Kaldır' },
];

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  const execCommand = useCallback((cmd: string) => {
    if (cmd === 'divider') return;

    if (cmd.startsWith('formatBlock:')) {
      const tag = cmd.split(':')[1];
      document.execCommand('formatBlock', false, `<${tag}>`);
    } else if (cmd === 'createLink') {
      const url = prompt('Link URL:');
      if (url) {
        document.execCommand('createLink', false, url);
      }
    } else {
      document.execCommand(cmd, false);
    }

    // Sync content
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/html') || e.clipboardData.getData('text/plain');
    document.execCommand('insertHTML', false, text);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  return (
    <div className="rounded-lg border border-[var(--input)] overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--border)] bg-[var(--muted)] px-2 py-1.5">
        {toolbarButtons.map((btn, i) => {
          if (btn.cmd === 'divider') {
            return <div key={i} className="mx-1 h-5 w-px bg-[var(--border)]" />;
          }
          return (
            <button
              key={btn.cmd}
              type="button"
              onClick={() => execCommand(btn.cmd)}
              title={btn.title}
              className={`flex h-7 min-w-[28px] items-center justify-center rounded px-1.5 text-xs hover:bg-[var(--background)] transition-colors ${btn.style || ''}`}
            >
              {btn.icon}
            </button>
          );
        })}

        {/* Source toggle */}
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => {
              if (editorRef.current) {
                const isSource = editorRef.current.getAttribute('data-source') === 'true';
                if (isSource) {
                  editorRef.current.innerHTML = editorRef.current.innerText;
                  editorRef.current.setAttribute('data-source', 'false');
                } else {
                  editorRef.current.innerText = editorRef.current.innerHTML;
                  editorRef.current.setAttribute('data-source', 'true');
                }
              }
            }}
            className="flex h-7 items-center gap-1 rounded px-2 text-xs text-[var(--muted-foreground)] hover:bg-[var(--background)]"
          >
            {'</>'}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onPaste={handlePaste}
        dangerouslySetInnerHTML={{ __html: value }}
        className="min-h-[300px] max-h-[600px] overflow-y-auto p-4 text-sm leading-relaxed focus:outline-none prose prose-sm max-w-none
          [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2
          [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-2
          [&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-2 [&_h4]:mb-1
          [&_p]:mb-2
          [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2
          [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2
          [&_li]:mb-1
          [&_a]:text-brand-500 [&_a]:underline
          [&_strong]:font-bold
          [&_em]:italic"
        data-placeholder={placeholder || 'Sayfa içeriğini buraya yazın...'}
      />
    </div>
  );
}
