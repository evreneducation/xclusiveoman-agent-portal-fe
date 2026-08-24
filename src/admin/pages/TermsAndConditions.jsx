import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle, Color, FontFamily, FontSize, LineHeight } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import {
  LuUndo2,
  LuRedo2,
  LuType,
  LuBold,
  LuItalic,
  LuUnderline,
  LuStrikethrough,
  LuSubscript,
  LuSuperscript,
  LuHeading1,
  LuHeading2,
  LuHeading3,
  LuAlignLeft,
  LuAlignCenter,
  LuAlignRight,
  LuAlignJustify,
  LuList,
  LuListOrdered,
  LuIndentIncrease,
  LuIndentDecrease,
  LuSmilePlus,
  LuImage,
  LuTable,
  LuQuote,
  LuMinus,
  LuEraser,
  LuLink,
} from 'react-icons/lu';
import { api } from '../api/client.js';
import { Button, ErrorText, Select } from '../components/ui.jsx';

// Admin "Terms & Conditions" tab (new top-level sidebar item) — a single
// rich-text policy document, singleton like ProductCatalog.jsx's own Visa
// tab (one flat rate, always just the one row, edited in place). Kept as
// its own page/route rather than a Product Catalog tab since it isn't a
// bookable product — see 0067_site_terms.sql / siteTerms.routes.js on the
// backend.
//
// Editor is TipTap (ProseMirror-based) rather than a hand-rolled
// contentEditable + execCommand implementation — execCommand is deprecated
// and inconsistent across browsers, whereas TipTap gives a real document
// model and a stable command API. The toolbar below covers every control in
// the reference design that maps onto a real TipTap command: undo/redo,
// font family/size, paragraph/heading format, line height, bold/italic/
// underline/strike, sub/superscript, text/highlight color, headings 1-3,
// alignment, lists, indent/outdent, emoji, image, table, link, blockquote,
// horizontal rule, clear formatting. The one control with no clean
// equivalent in TipTap's document model — a dedicated *paragraph* spacing
// (margin-between-blocks, distinct from the line-height control above) — is
// intentionally left out rather than faked.

const PRIMARY_BUTTON_CLASS =
  'border-transparent bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white shadow-[0_6px_16px_rgba(99,102,241,0.25)] hover:border-transparent hover:opacity-90';

const FONT_FAMILIES = [
  { label: 'Default font', value: '' },
  { label: 'Sans-serif', value: 'ui-sans-serif, system-ui, sans-serif' },
  { label: 'Serif', value: 'Georgia, Cambria, serif' },
  { label: 'Monospace', value: 'ui-monospace, monospace' },
];

const FONT_SIZES = [
  { label: 'Size', value: '' },
  { label: '12', value: '12px' },
  { label: '14', value: '14px' },
  { label: '16', value: '16px' },
  { label: '18', value: '18px' },
  { label: '24', value: '24px' },
  { label: '32', value: '32px' },
];

const LINE_HEIGHTS = [
  { label: 'Line spacing', value: '' },
  { label: '1', value: '1' },
  { label: '1.15', value: '1.15' },
  { label: '1.5', value: '1.5' },
  { label: '2', value: '2' },
];

// A small fixed palette rather than a full color picker for Highlight — the
// reference toolbar's own highlight control is a handful of preset swatches
// too, not an open-ended picker (that's what the separate text-color
// control below already is, via a native <input type="color">).
const HIGHLIGHT_COLORS = [
  { label: 'Yellow', value: '#FEF08A' },
  { label: 'Green', value: '#BBF7D0' },
  { label: 'Blue', value: '#BFDBFE' },
  { label: 'Pink', value: '#FBCFE8' },
];

const EMOJIS = ['🙂', '👍', '🎉', '✅', '⚠️', '❤️', '📌', '📅', '✈️', '🏨'];

// Toolbar buttons live inside the ProseMirror-owned contentEditable's
// nearest wrapper but are plain <button>s, not part of the document — a
// normal click would first steal focus/selection away from the editor
// (collapsing whatever text was selected) before onClick ever runs, which
// breaks every "act on the current selection" command below (toggleBold,
// setColor, …). onMouseDown's preventDefault stops that focus/selection
// change from happening at all, so the selection is still intact by the
// time onClick fires.
function ToolbarButton({ onClick, active, disabled, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex h-8 w-8 flex-none items-center justify-center rounded-md text-[15px] transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        active ? 'bg-[#E0E7FF] text-[#4F46E5]' : 'text-[#475569] hover:bg-[#F1F3F9]'
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <span className="mx-1 h-6 w-px flex-none self-center bg-[#E4E9FB]" />;
}

function EmojiPicker({ editor }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <ToolbarButton title="Insert emoji" onClick={() => setOpen((o) => !o)} active={open}>
        <LuSmilePlus size={16} />
      </ToolbarButton>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 grid grid-cols-5 gap-1 rounded-lg border border-[#E4E9FB] bg-white p-2 shadow-lg">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                editor.chain().focus().insertContent(emoji).run();
                setOpen(false);
              }}
              className="flex h-7 w-7 items-center justify-center rounded hover:bg-[#F1F3F9]"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HighlightPicker({ editor }) {
  const [open, setOpen] = useState(false);
  const active = editor.isActive('highlight');
  return (
    <div className="relative">
      <ToolbarButton title="Highlight color" onClick={() => setOpen((o) => !o)} active={open || active}>
        <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-[#FEF08A] text-[10px] font-bold text-[#713F12]">
          H
        </span>
      </ToolbarButton>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 flex gap-1.5 rounded-lg border border-[#E4E9FB] bg-white p-2 shadow-lg">
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={c.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                editor.chain().focus().toggleHighlight({ color: c.value }).run();
                setOpen(false);
              }}
              style={{ background: c.value }}
              className="h-6 w-6 rounded-full border border-black/10"
            />
          ))}
          <button
            type="button"
            title="Remove highlight"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.chain().focus().unsetHighlight().run();
              setOpen(false);
            }}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-[#E4E9FB] text-[10px] text-[#94A3B8]"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function EditorToolbar({ editor }) {
  // formatValue drives the Format <select> below — 'paragraph' or a
  // heading level string ('1'/'2'/'3'), read straight off the current
  // selection's active node each render (the editor re-renders on every
  // transaction by default, so this always reflects the live cursor
  // position/selection).
  const formatValue = editor.isActive('heading', { level: 1 })
    ? '1'
    : editor.isActive('heading', { level: 2 })
      ? '2'
      : editor.isActive('heading', { level: 3 })
        ? '3'
        : 'paragraph';

  // Font family/size both live on the 'textStyle' mark (TextStyle/FontFamily/
  // FontSize's default config), so the currently-active value can be read
  // straight off it and kept the <select>s below fully controlled — same
  // "reflect the live selection" treatment as formatValue above. Line
  // height is configured onto the heading/paragraph *node* instead (a
  // block-level "how far apart are these lines" concept fits a block
  // attribute better than a per-character mark), which node depends on
  // formatValue itself — reading it back would need the same branching
  // formatValue already does, so that <select> below stays a plain
  // "set on change" control instead.
  const textStyleAttrs = editor.getAttributes('textStyle');
  const fontValue = textStyleAttrs.fontFamily || '';
  const fontSizeValue = textStyleAttrs.fontSize || '';

  function handleFormatChange(e) {
    const value = e.target.value;
    if (value === 'paragraph') {
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().setHeading({ level: Number(value) }).run();
    }
  }

  function handleFontChange(e) {
    const value = e.target.value;
    if (value) {
      editor.chain().focus().setFontFamily(value).run();
    } else {
      editor.chain().focus().unsetFontFamily().run();
    }
  }

  function handleFontSizeChange(e) {
    const value = e.target.value;
    if (value) {
      editor.chain().focus().setFontSize(value).run();
    } else {
      editor.chain().focus().unsetFontSize().run();
    }
  }

  function handleLineHeightChange(e) {
    const value = e.target.value;
    if (value) {
      editor.chain().focus().setLineHeight(value).run();
    } else {
      editor.chain().focus().unsetLineHeight().run();
    }
  }

  function handleInsertLink() {
    const previousUrl = editor.getAttributes('link').href || '';
    const url = window.prompt('Link URL', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  function handleInsertImage() {
    const url = window.prompt('Image URL');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }

  return (
    <div className="rounded-t-lg border border-[#D7DDF0] bg-[#FAFBFF] p-2">
      <div className="mb-1.5 flex flex-wrap items-center gap-1 border-b border-[#E4E9FB] pb-1.5">
        <ToolbarButton title="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
          <LuUndo2 size={16} />
        </ToolbarButton>
        <ToolbarButton title="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
          <LuRedo2 size={16} />
        </ToolbarButton>
        <ToolbarDivider />
        <Select className="!w-auto !py-1.5 !text-xs" value={fontValue} onChange={handleFontChange}>
          {FONT_FAMILIES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
        <Select className="!w-auto !py-1.5 !text-xs" value={formatValue} onChange={handleFormatChange}>
          <option value="paragraph">Paragraph</option>
          <option value="1">Heading 1</option>
          <option value="2">Heading 2</option>
          <option value="3">Heading 3</option>
        </Select>
        <Select className="!w-auto !py-1.5 !text-xs" value={fontSizeValue} onChange={handleFontSizeChange}>
          {FONT_SIZES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
        <Select className="!w-auto !py-1.5 !text-xs" onChange={handleLineHeightChange} defaultValue="">
          {LINE_HEIGHTS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-0.5">
        <ToolbarButton title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <LuBold size={15} />
        </ToolbarButton>
        <ToolbarButton title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <LuItalic size={15} />
        </ToolbarButton>
        <ToolbarButton
          title="Underline"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <LuUnderline size={15} />
        </ToolbarButton>
        <ToolbarButton
          title="Strikethrough"
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <LuStrikethrough size={15} />
        </ToolbarButton>
        <ToolbarButton
          title="Subscript"
          active={editor.isActive('subscript')}
          onClick={() => editor.chain().focus().toggleSubscript().run()}
        >
          <LuSubscript size={15} />
        </ToolbarButton>
        <ToolbarButton
          title="Superscript"
          active={editor.isActive('superscript')}
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
        >
          <LuSuperscript size={15} />
        </ToolbarButton>

        <ToolbarDivider />

        <label
          title="Text color"
          className="relative flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-md text-[#475569] hover:bg-[#F1F3F9]"
        >
          <LuType size={15} />
          <input
            type="color"
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <HighlightPicker editor={editor} />

        <ToolbarDivider />

        <ToolbarButton
          title="Heading 1"
          active={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <LuHeading1 size={15} />
        </ToolbarButton>
        <ToolbarButton
          title="Heading 2"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <LuHeading2 size={15} />
        </ToolbarButton>
        <ToolbarButton
          title="Heading 3"
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <LuHeading3 size={15} />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          title="Align left"
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          <LuAlignLeft size={15} />
        </ToolbarButton>
        <ToolbarButton
          title="Align center"
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          <LuAlignCenter size={15} />
        </ToolbarButton>
        <ToolbarButton
          title="Align right"
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        >
          <LuAlignRight size={15} />
        </ToolbarButton>
        <ToolbarButton
          title="Justify"
          active={editor.isActive({ textAlign: 'justify' })}
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        >
          <LuAlignJustify size={15} />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          title="Bullet list"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <LuList size={15} />
        </ToolbarButton>
        <ToolbarButton
          title="Numbered list"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <LuListOrdered size={15} />
        </ToolbarButton>
        <ToolbarButton title="Decrease indent" onClick={() => editor.chain().focus().liftListItem('listItem').run()}>
          <LuIndentDecrease size={15} />
        </ToolbarButton>
        <ToolbarButton title="Increase indent" onClick={() => editor.chain().focus().sinkListItem('listItem').run()}>
          <LuIndentIncrease size={15} />
        </ToolbarButton>

        <ToolbarDivider />

        <EmojiPicker editor={editor} />
        <ToolbarButton title="Insert image" onClick={handleInsertImage}>
          <LuImage size={15} />
        </ToolbarButton>
        <ToolbarButton
          title="Insert table"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <LuTable size={15} />
        </ToolbarButton>
        <ToolbarButton title="Link" active={editor.isActive('link')} onClick={handleInsertLink}>
          <LuLink size={15} />
        </ToolbarButton>
        <ToolbarButton
          title="Quote"
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <LuQuote size={15} />
        </ToolbarButton>
        <ToolbarButton title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <LuMinus size={15} />
        </ToolbarButton>
        <ToolbarButton
          title="Clear formatting"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        >
          <LuEraser size={15} />
        </ToolbarButton>
      </div>
    </div>
  );
}

// Tailwind-only styling for the editor's own rendered content (headings,
// lists, blockquote, table, …) — per this app's own "no bespoke CSS files"
// convention (src/index.css stays Tailwind-directives-only), expressed here
// as Tailwind's `[&_selector]` arbitrary-descendant variants on the content
// wrapper rather than a new stylesheet.
const CONTENT_CLASS =
  'min-h-[280px] rounded-b-lg border border-t-0 border-[#D7DDF0] bg-white px-4 py-3 text-sm text-ink ' +
  '[&_.ProseMirror]:min-h-[260px] [&_.ProseMirror]:outline-none ' +
  '[&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-2xl [&_h1]:font-bold ' +
  '[&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-xl [&_h2]:font-bold ' +
  '[&_h3]:mb-1.5 [&_h3]:mt-2 [&_h3]:text-lg [&_h3]:font-bold ' +
  '[&_p]:mb-2 [&_p]:leading-relaxed ' +
  '[&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 ' +
  '[&_blockquote]:mb-2 [&_blockquote]:border-l-4 [&_blockquote]:border-[#C7D2FE] [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-[#475569] ' +
  '[&_hr]:my-4 [&_hr]:border-[#D7DDF0] ' +
  '[&_a]:text-[#4F46E5] [&_a]:underline ' +
  '[&_table]:mb-2 [&_table]:w-full [&_table]:border-collapse ' +
  '[&_td]:border [&_td]:border-[#D7DDF0] [&_td]:p-2 [&_th]:border [&_th]:border-[#D7DDF0] [&_th]:bg-[#F3F4FF] [&_th]:p-2 [&_th]:font-semibold ' +
  '[&_img]:max-w-full [&_img]:rounded-md';

function TermsEditorForm({ initialHtml }) {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  // The last-saved HTML, compared against the live document on every
  // keystroke to drive the Save button's disabled state — a ref (not
  // state) since updating it should never itself trigger a re-render.
  const savedHtmlRef = useRef(initialHtml || '');

  const editor = useEditor({
    extensions: [
      // openOnClick: false — a link click while editing should place the
      // cursor, not navigate away from this admin page.
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false } }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      LineHeight.configure({ types: ['heading', 'paragraph'] }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      Subscript,
      Superscript,
      Image,
      TableKit,
    ],
    content: initialHtml || '',
    onUpdate: ({ editor: e }) => {
      setDirty(e.getHTML() !== savedHtmlRef.current);
      setJustSaved(false);
    },
  });

  async function handleSave() {
    if (!editor) return;
    if (editor.isEmpty) {
      setError('Terms & Conditions content is required.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const html = editor.getHTML();
      await api.patch('/admin/site-terms', { bodyHtml: html });
      savedHtmlRef.current = html;
      setDirty(false);
      setJustSaved(true);
    } catch (err) {
      setError(err.message || 'Unable to save Terms & Conditions');
    } finally {
      setSubmitting(false);
    }
  }

  if (!editor) return null;

  return (
    <div>
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} className={CONTENT_CLASS} />

      <ErrorText>{error}</ErrorText>

      <div className="mt-3 flex items-center gap-3">
        <Button variant="accent" disabled={submitting || !dirty} onClick={handleSave} className={PRIMARY_BUTTON_CLASS}>
          {submitting ? 'Saving…' : 'Save changes'}
        </Button>
        {justSaved && !dirty && <span className="text-xs font-semibold text-[#227647]">✓ Saved</span>}
      </div>
    </div>
  );
}

export default function TermsAndConditions() {
  // null while loading, '' (or the saved HTML) once loaded — the editor
  // itself (TermsEditorForm) only mounts once this resolves, so TipTap's
  // `content` option is always initialized with the real saved value
  // instead of needing an extra effect to call editor.commands.setContent
  // after an async load.
  const [initialHtml, setInitialHtml] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    api
      .get('/site-terms')
      .then(({ terms }) => setInitialHtml(terms?.body_html || ''))
      .catch((err) => setLoadError(err.message || 'Unable to load Terms & Conditions'));
  }, []);

  return (
    <div
      style={{ background: 'linear-gradient(135deg, #F4F7FF 0%, #FAF7FF 50%, #FFF8F3 100%)' }}
      className="min-h-screen"
    >
      <div className="mx-auto max-w-4xl p-6 lg:p-10">
        <h2
          style={{
            backgroundImage: 'linear-gradient(90deg, #172554, #4F46E5, #7C3AED)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
          className="mb-2 text-3xl font-bold"
        >
          Policies &amp; terms
        </h2>
        <p className="mb-6 max-w-2xl text-sm text-muted">
          The Terms &amp; Conditions shown to agents and travelers across the portal — edit and save below.
        </p>

        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#4F46E5]">
          Terms &amp; Conditions <span className="text-[#EF4444]">*</span>
        </div>

        {loadError ? (
          <ErrorText>{loadError}</ErrorText>
        ) : initialHtml === null ? (
          <p className="text-xs text-muted">Loading…</p>
        ) : (
          <TermsEditorForm initialHtml={initialHtml} />
        )}
      </div>
    </div>
  );
}
