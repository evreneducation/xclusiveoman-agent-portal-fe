import { useRef, useState } from 'react';
import { ErrorText, FieldLabel } from './ui.jsx';

// Single source of truth for every admin image picker (FD package hero +
// carousel, Activity/Tour/Hotel/Transfer galleries) — format/size rules and
// the drag-drop / click / clipboard-paste / "add from a link" UX used to be
// copy-pasted per entity and had already drifted (only some accepted GIF/SVG,
// none supported paste or link entry). This is the one picker; each caller
// only supplies how a file gets uploaded for its own endpoint.
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const ACCEPTED_IMAGE_EXT_HINT = 'JPG, PNG, WebP, GIF, SVG';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPT_ATTR = ACCEPTED_IMAGE_TYPES.join(',');

function isLikelyImageUrl(text) {
  return /^https?:\/\/\S+$/i.test(text.trim());
}

// Checked client-side before every upload so a bad file never round-trips to
// the server just to be rejected — the backend enforces the same rules.
function describeInvalidFile(file) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return `${file.name}: unsupported format. Use ${ACCEPTED_IMAGE_EXT_HINT}.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `${file.name}: file is larger than 5MB.`;
  }
  return null;
}

/**
 * Drag & drop / click-to-browse / paste (image data or a link) image picker.
 *
 * - `multiple: false` (default) — single "cover image" picker. `value` is a
 *   URL string or empty; `onUpload(file)` resolves to the uploaded URL.
 * - `multiple: true` — gallery picker. `value` is an array of URLs;
 *   `onUpload(files)` resolves to the *next full array* of URLs (so each
 *   caller decides whether its endpoint returns the whole list or just the
 *   newly-added ones and merges accordingly).
 *
 * Adding an image "from a link" or by pasting a URL never calls `onUpload`
 * — the link is already a hosted URL, so it's added straight to `value`.
 */
export function ImageUpload({
  label,
  required = false,
  multiple = false,
  value,
  onChange,
  onUpload,
  onRemove,
  disabled = false,
  disabledHint,
  hint,
}) {
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [removingUrl, setRemovingUrl] = useState('');
  const inputRef = useRef(null);

  const images = multiple ? value || [] : [];
  const hasValue = multiple ? images.length > 0 : !!value;
  const busy = disabled || uploading;

  async function uploadFiles(files) {
    if (!files.length) return;
    const invalid = files.map(describeInvalidFile).find(Boolean);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError('');
    setUploading(true);
    try {
      if (multiple) {
        onChange(await onUpload(files));
      } else {
        onChange(await onUpload(files[0]));
      }
    } catch (err) {
      setError(err.message || 'Unable to upload image');
    } finally {
      setUploading(false);
    }
  }

  function handleInputChange(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // allow re-selecting the same file later
    uploadFiles(files);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    if (busy) return;
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) uploadFiles(multiple ? files : files.slice(0, 1));
  }

  function handlePaste(e) {
    if (busy) return;
    const files = Array.from(e.clipboardData?.files || []);
    if (files.length) {
      e.preventDefault();
      uploadFiles(multiple ? files : files.slice(0, 1));
      return;
    }
    const text = e.clipboardData?.getData('text');
    if (text && isLikelyImageUrl(text)) {
      e.preventDefault();
      addLink(text);
    }
  }

  function addLink(url) {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (!isLikelyImageUrl(trimmed)) {
      setError('Enter a valid image link (starting with http:// or https://).');
      return;
    }
    setError('');
    onChange(multiple ? [...images, trimmed] : trimmed);
    setLinkValue('');
    setLinkOpen(false);
  }

  async function removeImage(url) {
    if (!onRemove) {
      onChange(images.filter((u) => u !== url));
      return;
    }
    setError('');
    setRemovingUrl(url);
    try {
      await onRemove(url);
    } catch (err) {
      setError(err.message || 'Unable to remove image');
    } finally {
      setRemovingUrl('');
    }
  }

  return (
    <div className={multiple ? 'sm:col-span-2' : ''}>
      <FieldLabel>
        {label}
        {required ? ' *' : ''}
      </FieldLabel>

      {multiple && images.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {images.map((url) => (
            <div key={url} className="group relative h-20 w-20 flex-none">
              <img src={url} alt="" className="h-20 w-20 rounded-md border border-line-light object-cover" />
              <button
                type="button"
                onClick={() => removeImage(url)}
                disabled={removingUrl === url}
                title="Remove image"
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-ink bg-white text-[10px] font-bold text-ink shadow-sm hover:bg-panel disabled:opacity-50"
              >
                {removingUrl === url ? '…' : '×'}
              </button>
              {url === images[0] && (
                <span className="absolute bottom-0 left-0 right-0 rounded-b-md bg-ink/80 py-0.5 text-center text-[8px] font-semibold uppercase text-white">
                  Primary
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {!multiple && hasValue ? (
        <div className="flex items-center gap-3">
          <img src={value} alt="" className="h-16 w-16 flex-none rounded-md border border-line-light object-cover" />
          <label
            className={`inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-xs font-semibold shadow-sm ${
              busy ? 'cursor-not-allowed border-line-light bg-panel text-muted' : 'border-line-light bg-white text-ink hover:border-ink hover:bg-panel'
            }`}
          >
            {uploading ? 'Uploading…' : 'Change image'}
            <input ref={inputRef} type="file" accept={ACCEPT_ATTR} className="hidden" disabled={busy} onChange={handleInputChange} />
          </label>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onPaste={handlePaste}
          onClick={() => !busy && inputRef.current?.click()}
          role="button"
          tabIndex={busy ? -1 : 0}
          className={`flex flex-col items-center justify-center gap-1 rounded-md border border-dashed px-4 py-8 text-center transition ${
            busy ? 'cursor-not-allowed border-line-light bg-panel/40' : `cursor-pointer ${dragging ? 'border-accent bg-accent/5' : 'border-line-light hover:border-ink'}`
          }`}
        >
          <span aria-hidden className="text-2xl text-muted">
            ⬆️
          </span>
          <p className="text-xs font-semibold text-ink sm:text-sm">
            {uploading
              ? 'Uploading…'
              : multiple
                ? 'Add multiple images — drag & drop, browse, or paste links'
                : `Drag & drop ${label ? label.toLowerCase() : 'an image'}, click to browse, or paste a link`}
          </p>
          <p className="text-[10px] text-muted sm:text-[11px]">
            Images: {ACCEPTED_IMAGE_EXT_HINT} · max 5MB · 📋 paste works too
          </p>
          <input ref={inputRef} type="file" accept={ACCEPT_ATTR} multiple={multiple} className="hidden" disabled={busy} onChange={handleInputChange} />
        </div>
      )}

      <div className="mt-1.5">
        {linkOpen ? (
          <div className="flex gap-1.5">
            <input
              autoFocus
              type="text"
              value={linkValue}
              onChange={(e) => setLinkValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addLink(linkValue);
                }
                if (e.key === 'Escape') setLinkOpen(false);
              }}
              placeholder="https://…"
              className="flex-1 rounded-md border border-line-light bg-white px-2.5 py-1.5 text-xs text-ink shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
            />
            <button
              type="button"
              onClick={() => addLink(linkValue)}
              className="flex-none rounded-md border border-line-light bg-white px-2.5 py-1.5 text-xs font-semibold text-ink shadow-sm hover:border-ink"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setLinkOpen(false);
                setLinkValue('');
              }}
              className="flex-none text-xs text-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setLinkOpen(true)}
            disabled={disabled}
            className="text-[11px] font-semibold text-accent hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
          >
            🔗 Add image from a link
          </button>
        )}
      </div>

      {disabled && disabledHint && <p className="mt-1 text-[10px] text-muted">{disabledHint}</p>}
      {hint && <p className="mt-1 text-[10px] text-muted">{hint}</p>}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
