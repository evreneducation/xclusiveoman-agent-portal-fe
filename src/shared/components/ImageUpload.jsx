import { useRef, useState } from 'react';
import { FiFileText, FiLink, FiUploadCloud, FiX } from 'react-icons/fi';

// Portal-agnostic file/image picker — moved here from
// admin/components/ImageUpload.jsx (its original home, when it only served
// the admin Catalog image pickers: FD package hero + carousel, Activity/
// Tour/Hotel/Transfer galleries). Colors are literal hex here rather than
// the admin-only `ink`/`accent`/`panel`/`line-light`/`muted` Tailwind tokens
// (unchanged values, just spelled out) so the same widget renders
// consistently no matter which portal's palette is active around it —
// e.g. src/agent/pages/Register.jsx's IATA/GST/Company Registration
// document picker.
//
// - `multiple: false` (default) — single file picker. `value` is a URL
//   string or empty; `onUpload(file)` resolves to the uploaded URL.
// - `multiple: true` — gallery picker. `value` is an array of URLs;
//   `onUpload(files)` resolves to the *next full array* of URLs (so each
//   caller decides whether its endpoint returns the whole list or just the
//   newly-added ones and merges accordingly). Gallery mode stays
//   images-only regardless of `acceptedTypes` — its thumbnails assume `<img>`.
// - `acceptedTypes` / `acceptHint` / `maxBytes` widen the single-file picker
//   past the image-only default — e.g. Register.jsx also allows PDF. When
//   the accepted types aren't image-only, wording switches from
//   "image" to "file" and a non-image value renders as a document chip
//   instead of a broken `<img>`.
//
// Adding a file "from a link" or by pasting a URL never calls `onUpload` —
// the link is already a hosted URL, so it's added straight to `value`.
const DEFAULT_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const DEFAULT_ACCEPT_HINT = 'JPG, PNG, WebP, GIF, SVG';
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|svg)(\?|#|$)/i;

function isLikelyUrl(text) {
  return /^https?:\/\/\S+$/i.test(text.trim());
}

function isImageUrl(url) {
  return IMAGE_EXT_RE.test(url || '');
}

function FieldLabel({ children }) {
  return <div className="mb-1.5 text-[11px] font-semibold uppercase text-[#64748B]">{children}</div>;
}

function ErrorText({ children }) {
  if (!children) return null;
  return <p className="rounded-md border border-[#f2bdc6] bg-[#fff7f8] px-3 py-2 text-xs text-[#a5162d]">{children}</p>;
}

// Checked client-side before every upload so a bad file never round-trips to
// the server just to be rejected — the backend enforces its own rules too.
function describeInvalidFile(file, acceptedTypes, acceptHint, maxBytes) {
  if (!acceptedTypes.includes(file.type)) {
    return `${file.name}: unsupported format. Use ${acceptHint}.`;
  }
  if (file.size > maxBytes) {
    return `${file.name}: file is larger than ${Math.round((maxBytes / (1024 * 1024)) * 10) / 10}MB.`;
  }
  return null;
}

/**
 * Drag & drop / click-to-browse / paste (file data or a link) file picker.
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
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  acceptHint = DEFAULT_ACCEPT_HINT,
  maxBytes = DEFAULT_MAX_BYTES,
}) {
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [removingUrl, setRemovingUrl] = useState('');
  const inputRef = useRef(null);

  const acceptAttr = acceptedTypes.join(',');
  const maxMb = Math.round((maxBytes / (1024 * 1024)) * 10) / 10;
  // Gallery mode is always images; single-file mode is "images" only when
  // the caller kept the image-only default — used purely for copy below
  // ("image" vs "file") so existing admin image pickers read exactly as
  // they did before this widget could also take PDFs.
  const isImageOnly = multiple || acceptedTypes.every((t) => t.startsWith('image/'));

  const images = multiple ? value || [] : [];
  const hasValue = multiple ? images.length > 0 : !!value;
  const busy = disabled || uploading;

  async function uploadFiles(files) {
    if (!files.length) return;
    const invalid = files.map((f) => describeInvalidFile(f, acceptedTypes, acceptHint, maxBytes)).find(Boolean);
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
      setError(err.message || `Unable to upload ${isImageOnly ? 'image' : 'file'}`);
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
    if (text && isLikelyUrl(text)) {
      e.preventDefault();
      addLink(text);
    }
  }

  function addLink(url) {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (!isLikelyUrl(trimmed)) {
      setError('Enter a valid link (starting with http:// or https://).');
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
              <img src={url} alt="" className="h-20 w-20 rounded-md border border-[#E4E9FB] object-cover" />
              <button
                type="button"
                onClick={() => removeImage(url)}
                disabled={removingUrl === url}
                title="Remove image"
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-[#172554] bg-white text-[#172554] shadow-sm hover:bg-[#F3F4FF] disabled:opacity-50"
              >
                {removingUrl === url ? '…' : <FiX size={11} />}
              </button>
              {url === images[0] && (
                <span className="absolute bottom-0 left-0 right-0 rounded-b-md bg-[#172554]/80 py-0.5 text-center text-[8px] font-semibold uppercase text-white">
                  Primary
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {!multiple && hasValue ? (
        <div className="flex items-center gap-3">
          {isImageUrl(value) ? (
            <img src={value} alt="" className="h-16 w-16 flex-none rounded-md border border-[#E4E9FB] object-cover" />
          ) : (
            <div className="flex h-16 w-16 flex-none items-center justify-center rounded-md border border-[#E4E9FB] bg-[#F3F4FF]">
              <FiFileText size={24} className="text-[#64748B]" />
            </div>
          )}
          <label
            className={`inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-xs font-semibold shadow-sm ${
              busy
                ? 'cursor-not-allowed border-[#E4E9FB] bg-[#F3F4FF] text-[#64748B]'
                : 'border-[#E4E9FB] bg-white text-[#172554] hover:border-[#172554] hover:bg-[#F3F4FF]'
            }`}
          >
            {uploading ? 'Uploading…' : isImageOnly ? 'Change image' : 'Change file'}
            <input ref={inputRef} type="file" accept={acceptAttr} className="hidden" disabled={busy} onChange={handleInputChange} />
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
            busy
              ? 'cursor-not-allowed border-[#E4E9FB] bg-[#F3F4FF]/40'
              : `cursor-pointer ${dragging ? 'border-[#4F46E5] bg-[#4F46E5]/5' : 'border-[#E4E9FB] hover:border-[#172554]'}`
          }`}
        >
          <FiUploadCloud aria-hidden size={26} className="text-[#64748B]" />
          <p className="text-xs font-semibold text-[#172554] sm:text-sm">
            {uploading
              ? 'Uploading…'
              : multiple
                ? 'Add multiple images — drag & drop, browse, or paste links'
                : `Drag & drop ${label ? label.toLowerCase() : isImageOnly ? 'an image' : 'a file'}, click to browse, or paste a link`}
          </p>
          <p className="text-[10px] text-[#64748B] sm:text-[11px]">
            Accepted: {acceptHint} · max {maxMb}MB
          </p>
          <input ref={inputRef} type="file" accept={acceptAttr} multiple={multiple} className="hidden" disabled={busy} onChange={handleInputChange} />
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
              className="flex-1 rounded-md border border-[#E4E9FB] bg-white px-2.5 py-1.5 text-xs text-[#172554] shadow-sm focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/15"
            />
            <button
              type="button"
              onClick={() => addLink(linkValue)}
              className="flex-none rounded-md border border-[#E4E9FB] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#172554] shadow-sm hover:border-[#172554]"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setLinkOpen(false);
                setLinkValue('');
              }}
              className="flex-none text-xs text-[#64748B] hover:text-[#172554]"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setLinkOpen(true)}
            disabled={disabled}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4F46E5] hover:underline disabled:cursor-not-allowed disabled:text-[#64748B] disabled:no-underline"
          >
            <FiLink size={12} />
            Add {isImageOnly ? 'image' : 'file'} from a link
          </button>
        )}
      </div>

      {disabled && disabledHint && <p className="mt-1 text-[10px] text-[#64748B]">{disabledHint}</p>}
      {hint && <p className="mt-1 text-[10px] text-[#64748B]">{hint}</p>}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
