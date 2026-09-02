import { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { LuCar, LuChevronLeft, LuChevronRight, LuClock, LuDownload, LuFileText, LuMapPin, LuX } from 'react-icons/lu';
import { api } from '../api/client.js';
import { Card, ErrorText, Tag } from '../components/ui.jsx';

// Same "untrusted admin-authored HTML through DOMPurify before
// dangerouslySetInnerHTML" convention DepartureDetail.jsx's own
// sanitizeHtml/CmsPage.jsx's own sanitize already use — description here
// comes from the exact same RichTextEditor every catalog admin form uses.
function sanitizeHtml(html) {
  return DOMPurify.sanitize(html || '', { USE_PROFILES: { html: true } });
}

// "MICE Content Hub / Curation Screen" — a wireframe step long documented
// in AgentLayout.jsx's own NAV_ITEMS comment but never actually built until
// now. Lets an agent browse whichever Hotels/Tours/Activities/Transfers the
// admin has curated into the MICE catalog (catalog.routes.js's `mice=true`
// filter — the exact same flag MiceBuilder.jsx's own item pickers already
// use), so they've got real content to reference/share when pitching a
// corporate client — this page is read-only, not a picker feeding into any
// builder. `status=published` alongside it excludes admin drafts, same
// convention MiceBuilder.jsx's own catalog fetches already follow.
//
// "Oman Overview" — admin-uploaded PDFs (MiceCatalog.jsx's own first tab,
// same order as here) — sits first since it's the one tab that isn't a
// filtered catalog browse at all (no mice/status columns on that table, see
// its own endpoint handling in the effect below).
const TABS = [
  { key: 'oman-overviews', label: 'Oman Overview', endpoint: '/oman-overviews' },
  { key: 'hotels', label: 'Hotels', endpoint: '/hotels' },
  { key: 'tours', label: 'Tours', endpoint: '/tours' },
  { key: 'activities', label: 'Activities', endpoint: '/activities' },
  { key: 'transfers', label: 'Transfers', endpoint: '/transfers' },
];

// City + a second, tab-specific descriptor line — duration for tours/
// activities, vehicle type for transfers. No star category for hotels (or
// anywhere else in Content Hub) — no rating-shaped indicator at all, per
// explicit instruction.
function subtitle(tab, item) {
  const parts = [item.city];
  if ((tab === 'tours' || tab === 'activities') && item.duration) parts.push(item.duration);
  if (tab === 'transfers' && item.type) parts.push(item.type.replace(/_/g, ' '));
  return parts.filter(Boolean).join(' · ');
}

// Same fields subtitle() above joins into one compact line for the card —
// split back out into individually-labeled/iconed chips here since the
// detail modal has the room to give each its own visual weight.
function detailChips(tab, item) {
  const chips = [];
  if (item.city) chips.push({ Icon: LuMapPin, label: item.city });
  if ((tab === 'tours' || tab === 'activities') && item.duration) chips.push({ Icon: LuClock, label: item.duration });
  if (tab === 'transfers' && item.type) chips.push({ Icon: LuCar, label: item.type.replace(/_/g, ' ') });
  return chips;
}

// No image uploaded yet for most rows (the admin-side upload flow for these
// four catalog types is landing separately, right after this page) — same
// dark-gradient placeholder Departures.jsx's own DepartureCard already uses
// for a missing heroImageUrl, so an empty catalog doesn't look broken, just
// not-yet-photographed.
function CatalogImage({ url }) {
  return url ? (
    <img src={url} alt="" className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110" />
  ) : (
    <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-white/40">
      No image yet
    </div>
  );
}

// Plain-text preview of the admin-authored rich-text description (which
// runs 500+ words per omanOverviewSchema — see MiceCatalog.jsx) — the full
// write-up lives in the PDF itself, so this card only needs a taste of it
// alongside the actual download/view action.
function stripHtmlSnippet(html, maxLen = 220) {
  const text = String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLen ? `${text.slice(0, maxLen).trim()}…` : text;
}

// "View Details" popup shell — medium-sized (not full-screen), centered,
// dismissible via backdrop click or Escape, body scroll suspended while
// open (same convention DepartureDetail.jsx's own Lightbox already uses).
function ModalShell({ onClose, children }) {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {children}
      </div>
    </div>
  );
}

// Hero image + prev/next + a thumbnail strip once there's more than one —
// used for every catalog type's own `images` array; Oman Overview passes
// just its single cover image (see DetailModal below), so the arrows/strip
// never render there.
function ModalGallery({ images }) {
  const [active, setActive] = useState(0);
  const hasImages = images.length > 0;

  return (
    <div className="relative flex-none">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[linear-gradient(135deg,#0B1130_0%,#181f45_100%)]">
        {hasImages ? (
          <img src={images[active]} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <LuFileText size={44} className="text-white/30" />
          </div>
        )}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setActive((i) => (i - 1 + images.length) % images.length)}
              aria-label="Previous image"
              className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60"
            >
              <LuChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setActive((i) => (i + 1) % images.length)}
              aria-label="Next image"
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60"
            >
              <LuChevronRight size={16} />
            </button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto bg-agent-panel p-2.5">
          {images.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              className={`h-12 w-16 flex-none overflow-hidden rounded-md border-2 transition ${
                i === active ? 'border-agent-accent' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// The "View Details" popup body — same content for every tab, just fed
// different pieces: catalog items show their full images array + detail
// chips, Oman Overview shows its one cover image + a "View PDF" action
// instead of chips (there's nothing to chip — no city/duration/type on that
// table). `description` is rich text everywhere (the same RichTextEditor
// every admin catalog form already uses), rendered in full here — the
// card's own stripHtmlSnippet is just a preview, this is the real thing.
function DetailModal({ tab, item, onClose }) {
  const isOmanOverview = tab === 'oman-overviews';
  const coverImageUrl = item.coverImageUrl ?? item.cover_image_url;
  const pdfUrl = item.pdfUrl ?? item.pdf_url;
  const images = isOmanOverview ? [coverImageUrl].filter(Boolean) : item.images || [];
  const chips = isOmanOverview ? [] : detailChips(tab, item);

  return (
    <ModalShell onClose={onClose}>
      <div className="overflow-y-auto">
        <div className="relative">
          <ModalGallery images={images} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
          >
            <LuX size={16} />
          </button>
        </div>

        <div className="p-5">
          <h3 className="text-xl font-bold text-agent-ink">{item.name}</h3>

          {chips.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {chips.map(({ Icon, label }, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-full bg-agent-panel px-2.5 py-1 text-[11px] font-semibold capitalize text-agent-ink"
                >
                  <Icon size={12} className="flex-none text-agent-accent-dark" />
                  {label}
                </span>
              ))}
            </div>
          )}

          <div
            className="mt-4 border-t border-agent-line-light pt-4 text-sm leading-relaxed text-agent-muted [&_a]:text-agent-accent-dark [&_a]:underline [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-agent-ink [&_h3]:mt-3 [&_h3]:font-bold [&_h3]:text-agent-ink [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mb-2 [&_strong]:font-semibold [&_strong]:text-agent-ink [&_ul]:list-disc"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.description) || '<p>No description provided.</p>' }}
          />

          {isOmanOverview && pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-agent-accent px-4 py-2.5 text-sm font-semibold text-agent-ink-dark shadow-sm shadow-agent-accent/30 transition hover:opacity-90"
            >
              <LuDownload size={14} />
              View PDF
            </a>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

// Same grid-card shell as CatalogCard below (image block + name + a
// footer action), not a distinct layout — a document card in place of a
// photographed catalog item just swaps CatalogImage's photo for the admin's
// own cover_image_url (0083_oman_overview_cover_image.sql — falls back to a
// plain PDF icon for any legacy row saved before that field existed) and the
// price/rating footer for a "Download PDF" button, and drops back into the
// exact same grid. Labeled "Download", not "View" — Cloudinary's own
// PDF/ZIP delivery restriction on this account (401 on resource_type:
// 'image') means this link can only be served as a forced-download raw
// file, not an inline in-browser preview; see this repo's own notes from
// diagnosing that for what it'd take to switch this to a real preview.
function OmanOverviewCard({ item, onViewDetails }) {
  const pdfUrl = item.pdfUrl ?? item.pdf_url;
  const coverImageUrl = item.coverImageUrl ?? item.cover_image_url;
  return (
    <div className="group overflow-hidden rounded-2xl border border-agent-line-light bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative flex aspect-[4/3] flex-none items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#0B1130_0%,#181f45_100%)]">
        {coverImageUrl ? (
          <img
            src={coverImageUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
          />
        ) : (
          <LuFileText size={40} className="text-white/40" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
      </div>
      <div className="p-4">
        <div className="truncate text-sm font-bold text-agent-ink">{item.name}</div>
        <div className="mt-0.5 line-clamp-2 text-xs text-agent-muted">{stripHtmlSnippet(item.description)}</div>
        <div className="mt-3 flex gap-2 border-t border-agent-line-light pt-2">
          <button
            type="button"
            onClick={() => onViewDetails(item)}
            className="flex-1 rounded-full border border-agent-line-light px-3 py-2 text-xs font-semibold text-agent-ink transition hover:border-agent-accent hover:bg-agent-panel"
          >
            View Details
          </button>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-agent-accent px-3 py-2 text-xs font-semibold text-agent-ink-dark shadow-sm shadow-agent-accent/30 transition hover:opacity-90"
          >
            <LuFileText size={13} />
            View PDF
          </a>
        </div>
      </div>
    </div>
  );
}

function CatalogCard({ tab, item, onViewDetails }) {
  return (
    <div className="group overflow-hidden rounded-2xl border border-agent-line-light bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[4/3] flex-none overflow-hidden bg-[linear-gradient(135deg,#0B1130_0%,#181f45_100%)]">
        <CatalogImage url={item.images?.[0]} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
      </div>
      <div className="p-4">
        <div className="truncate text-sm font-bold text-agent-ink">{item.name}</div>
        <div className="mt-0.5 truncate text-xs text-agent-muted">{subtitle(tab, item) || '—'}</div>
        <div className="mt-3 border-t border-agent-line-light pt-2">
          <button
            type="button"
            onClick={() => onViewDetails(item)}
            className="w-full rounded-full border border-agent-line-light px-3 py-2 text-xs font-semibold text-agent-ink transition hover:border-agent-accent hover:bg-agent-panel"
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ContentHub() {
  const [tab, setTab] = useState('oman-overviews');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detailItem, setDetailItem] = useState(null);
  const isOmanOverview = tab === 'oman-overviews';

  useEffect(() => {
    const meta = TABS.find((t) => t.key === tab);
    setLoading(true);
    setError('');
    setDetailItem(null); // the previous tab's item can't stay open across a tab switch
    // Oman Overview has no mice/status columns to filter by (it isn't a
    // per-item-curated catalog table at all — see TABS' own comment above).
    const query = tab === 'oman-overviews' ? '' : '?mice=true&status=published';
    api
      .get(`${meta.endpoint}${query}`)
      .then((res) => setItems(res[meta.key] || []))
      .catch((err) => setError(err.message || `Unable to load ${meta.label.toLowerCase()}`))
      .finally(() => setLoading(false));
  }, [tab]);

  const activeLabel = TABS.find((t) => t.key === tab).label;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-5 lg:p-8">
      <div>
        <h2 className="mb-1 text-2xl font-bold text-agent-ink">Content Hub</h2>
        <p className="text-sm text-agent-muted">
          Oman Overview documents, plus the MICE-curated Hotels, Tours, Activities, and Transfers your admin team has
          published — handy reference content when pitching a corporate client.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}>
            <Tag active={tab === t.key}>{t.label}</Tag>
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-agent-muted">Loading…</p>}
      <ErrorText>{error}</ErrorText>

      {!loading && !error && items.length === 0 && (
        <Card className="border-white text-center">
          <p className="text-sm text-agent-muted">
            {isOmanOverview ? 'No Oman Overview documents published yet.' : `No MICE-curated ${activeLabel.toLowerCase()} published yet.`}
          </p>
        </Card>
      )}

      {!loading && items.length > 0 && (
        <div className="grid items-start gap-5 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
          {items.map((item) =>
            isOmanOverview ? (
              <OmanOverviewCard key={item.id} item={item} onViewDetails={setDetailItem} />
            ) : (
              <CatalogCard key={item.id} tab={tab} item={item} onViewDetails={setDetailItem} />
            )
          )}
        </div>
      )}

      {detailItem && <DetailModal tab={tab} item={detailItem} onClose={() => setDetailItem(null)} />}
    </div>
  );
}
