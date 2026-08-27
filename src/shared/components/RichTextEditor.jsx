import { useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
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
  LuHighlighter,
  LuX,
} from 'react-icons/lu';

// Portal-agnostic rich text field, built on TipTap (ProseMirror-based) —
// originally admin/pages/TermsAndConditions.jsx's own editor, moved here so
// every "description"-shaped field across the app (catalog editors, support
// tickets, quote notes, …) can use the same real document model + toolbar
// instead of a plain <textarea>, rather than each field keeping its own
// copy. Every field gets the full toolbar — `toolbar="full"` is the default.
//
// `toolbar="full"` (default, used everywhere) — the complete control set:
// undo/redo, font family/size, paragraph/heading format, line height, bold/
// italic/underline/strike, sub/superscript, text/highlight color, headings
// 1-3, alignment, lists, indent/outdent, emoji, image, table, link,
// blockquote, horizontal rule, clear formatting.
// `toolbar="basic"` — a trimmed toolbar (bold/italic/underline/strike,
// bullet/numbered list, link, blockquote, clear formatting, undo/redo),
// backed by StarterKit alone. Kept as an opt-in for any future compact
// field; no call site passes it today.
//
// `size="sm"|"md"|"lg"` sets the editable area's min-height — "how much
// text this particular field is expected to hold" is a per-field call the
// caller makes, not something this component can infer.
const SIZE_MIN_HEIGHT = { sm: 80, md: 150, lg: 260 };

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

const HIGHLIGHT_COLORS = [
  { label: 'Yellow', value: '#FEF08A' },
  { label: 'Green', value: '#BBF7D0' },
  { label: 'Blue', value: '#BFDBFE' },
  { label: 'Pink', value: '#FBCFE8' },
];

const EMOJIS = ['🙂', '👍', '🎉', '✅', '⚠️', '❤️', '📌', '📅', '✈️', '🏨'];

// onMouseDown's preventDefault stops the toolbar button's click from
// stealing focus/selection away from the editor first — without it, every
// "act on the current selection" command (toggleBold, setColor, …) would
// fire against an already-collapsed selection.
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
        <LuHighlighter size={15} />
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
            className="flex h-6 w-6 items-center justify-center rounded-full border border-[#E4E9FB] text-[#94A3B8]"
          >
            <LuX size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

function handleInsertLink(editor) {
  const previousUrl = editor.getAttributes('link').href || '';
  const url = window.prompt('Link URL', previousUrl);
  if (url === null) return;
  if (url === '') {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    return;
  }
  editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
}

function BasicToolbar({ editor }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-t-lg border border-[#D7DDF0] bg-[#FAFBFF] p-1.5">
      <ToolbarButton title="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
        <LuUndo2 size={15} />
      </ToolbarButton>
      <ToolbarButton title="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
        <LuRedo2 size={15} />
      </ToolbarButton>
      <ToolbarDivider />
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
      <ToolbarDivider />
      <ToolbarButton title="Link" active={editor.isActive('link')} onClick={() => handleInsertLink(editor)}>
        <LuLink size={15} />
      </ToolbarButton>
      <ToolbarButton
        title="Quote"
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <LuQuote size={15} />
      </ToolbarButton>
      <ToolbarButton title="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
        <LuEraser size={15} />
      </ToolbarButton>
    </div>
  );
}

function FullToolbar({ editor }) {
  const formatValue = editor.isActive('heading', { level: 1 })
    ? '1'
    : editor.isActive('heading', { level: 2 })
      ? '2'
      : editor.isActive('heading', { level: 3 })
        ? '3'
        : 'paragraph';

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
    if (value) editor.chain().focus().setFontFamily(value).run();
    else editor.chain().focus().unsetFontFamily().run();
  }

  function handleFontSizeChange(e) {
    const value = e.target.value;
    if (value) editor.chain().focus().setFontSize(value).run();
    else editor.chain().focus().unsetFontSize().run();
  }

  function handleLineHeightChange(e) {
    const value = e.target.value;
    if (value) editor.chain().focus().setLineHeight(value).run();
    else editor.chain().focus().unsetLineHeight().run();
  }

  function handleInsertImage() {
    const url = window.prompt('Image URL');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  }

  const selectClass =
    'h-8 rounded-md border border-[#D7DDF0] bg-white px-1.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20';

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
        <select className={selectClass} value={fontValue} onChange={handleFontChange}>
          {FONT_FAMILIES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <select className={selectClass} value={formatValue} onChange={handleFormatChange}>
          <option value="paragraph">Paragraph</option>
          <option value="1">Heading 1</option>
          <option value="2">Heading 2</option>
          <option value="3">Heading 3</option>
        </select>
        <select className={selectClass} value={fontSizeValue} onChange={handleFontSizeChange}>
          {FONT_SIZES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select className={selectClass} onChange={handleLineHeightChange} defaultValue="">
          {LINE_HEIGHTS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
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
        <ToolbarButton title="Link" active={editor.isActive('link')} onClick={() => handleInsertLink(editor)}>
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
        <ToolbarButton title="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
          <LuEraser size={15} />
        </ToolbarButton>
      </div>
    </div>
  );
}

// Tailwind-only styling for the editor's own rendered content (headings,
// lists, blockquote, table, …) — per this app's own "no bespoke CSS files"
// convention. `--rte-min-h` (set inline below, from the `size` prop) drives
// the editable area's min-height via an arbitrary-value selector, since that
// one property has to vary per instance while the rest of this class stays
// fixed.
// Shared by both the editable box below (appended to RTE_TYPOGRAPHY_CLASS)
// and every place elsewhere in the app that renders one of these fields'
// saved HTML back out read-only (RICH_TEXT_DISPLAY_CLASS, exported below) —
// one definition of "how a heading/list/table/etc. inside this content
// looks" instead of every display site keeping its own copy. No base text
// color on purpose — admin and agent portals use different "ink" tokens
// (text-ink vs text-agent-ink), so that's the caller's own className to set,
// same as it already had to for any other text on the page.
const RTE_TYPOGRAPHY_CLASS =
  'text-sm ' +
  '[&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-2xl [&_h1]:font-bold ' +
  '[&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-xl [&_h2]:font-bold ' +
  '[&_h3]:mb-1.5 [&_h3]:mt-2 [&_h3]:text-lg [&_h3]:font-bold ' +
  '[&_p]:mb-2 [&_p]:leading-relaxed [&_p:last-child]:mb-0 ' +
  '[&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 ' +
  '[&_blockquote]:mb-2 [&_blockquote]:border-l-4 [&_blockquote]:border-[#C7D2FE] [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-[#475569] ' +
  '[&_hr]:my-4 [&_hr]:border-[#D7DDF0] ' +
  '[&_a]:text-[#4F46E5] [&_a]:underline ' +
  '[&_table]:mb-2 [&_table]:w-full [&_table]:border-collapse ' +
  '[&_td]:border [&_td]:border-[#D7DDF0] [&_td]:p-2 [&_th]:border [&_th]:border-[#D7DDF0] [&_th]:bg-[#F3F4FF] [&_th]:p-2 [&_th]:font-semibold ' +
  '[&_img]:max-w-full [&_img]:rounded-md';

// For a plain `<div dangerouslySetInnerHTML>` rendering a saved value
// read-only — e.g. ProductCatalog.jsx's preview modals, or any agent-facing
// page showing an admin-authored description. Deliberately has no border/
// background/editable-box chrome of its own, unlike CONTENT_CLASS below.
export const RICH_TEXT_DISPLAY_CLASS = RTE_TYPOGRAPHY_CLASS;

// Ink color isn't baked in here — RichTextEditor's `inkClassName` prop
// (default 'text-ink') supplies it, since admin/agent/team portals each use
// a different "ink" token.
const CONTENT_CLASS_BASE =
  `rounded-b-lg border border-t-0 border-[#D7DDF0] bg-white px-3.5 py-2.5 ${RTE_TYPOGRAPHY_CLASS} ` +
  '[&_.ProseMirror]:min-h-[var(--rte-min-h)] [&_.ProseMirror]:outline-none';

const FULL_EXTENSIONS = [
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
];

const BASIC_EXTENSIONS = [StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false } })];

// A "required" rich text field's empty state is `<p></p>` (or similar),
// never `''` — every place that used to check `description === ''` for a
// plain <TextInput>/<textarea> needs this instead now that the field is
// HTML. Good enough for a required-field gate without a real HTML parser:
// strip every tag, then check whether any real text is left.
export function isEmptyHtml(html) {
  if (!html) return true;
  return !html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Controlled rich text field — `value` is an HTML string, `onChange(html)`
 * fires on every edit. Renders nothing until TipTap has mounted (one tick
 * after first render), same as every other TipTap-based editor in this app.
 */
export function RichTextEditor({ value, onChange, toolbar = 'full', size = 'md', disabled = false, inkClassName = 'text-ink' }) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor(
    {
      extensions: toolbar === 'full' ? FULL_EXTENSIONS : BASIC_EXTENSIONS,
      content: value || '',
      editable: !disabled,
      onUpdate: ({ editor: e }) => onChangeRef.current?.(e.getHTML()),
    },
    []
  );

  // Keeps the editor in sync when `value` changes from *outside* an edit in
  // progress — e.g. the parent form finishes an async load after this
  // mounted (the common case: an Editor page's GET resolves and calls
  // setForm with the loaded description). Guarded against the editor's own
  // onUpdate-driven change looping back into itself.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || '';
    if (next !== current) editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    if (editor) editor.setEditable(!disabled);
  }, [editor, disabled]);

  if (!editor) return null;

  return (
    <div style={{ '--rte-min-h': `${SIZE_MIN_HEIGHT[size] || SIZE_MIN_HEIGHT.md}px` }}>
      {toolbar === 'full' ? <FullToolbar editor={editor} /> : <BasicToolbar editor={editor} />}
      <EditorContent editor={editor} className={`${CONTENT_CLASS_BASE} ${inkClassName}`} />
    </div>
  );
}

/**
 * Read-only counterpart to RichTextEditor — renders a saved HTML value with
 * the same typography, for every display site that used to just interpolate
 * a plain-text description (preview modals, agent-facing pages, …). Renders
 * nothing for an empty value rather than an empty wrapper element.
 */
export function RichTextDisplay({ html, className = '' }) {
  if (isEmptyHtml(html)) return null;
  // Admin-authored HTML still passes through an untrusted-input boundary
  // before ever reaching dangerouslySetInnerHTML — same DOMPurify
  // sanitize-before-render convention CmsPage.jsx/DepartureDetail.jsx
  // already use for their own admin-authored body_html.
  const safeHtml = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  return <div className={`${RICH_TEXT_DISPLAY_CLASS} ${className}`} dangerouslySetInnerHTML={{ __html: safeHtml }} />;
}
