import { useEffect, useState } from 'react';
import { LuFileText, LuStar } from 'react-icons/lu';
import { api } from '../api/client.js';
import { Card, ErrorText, Tag } from '../components/ui.jsx';

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

// Every catalog table's price lives on a differently-named column (hotels:
// price_per_night, activities: price_per_pax, tours/transfers: a flat
// price) — coalescing both the camelCase (already-transformed) and
// snake_case (raw SELECT *) spellings of each, since which one a given
// endpoint returns isn't consistent across this codebase's own pages.
function priceLabel(tab, item) {
  if (tab === 'hotels') {
    const price = item.pricePerNight ?? item.price_per_night;
    return price != null ? `₹${Number(price).toLocaleString('en-IN')} / night` : 'On request';
  }
  if (tab === 'activities') {
    const price = item.pricePerPax ?? item.price_per_pax;
    return price != null ? `₹${Number(price).toLocaleString('en-IN')} / pax` : 'On request';
  }
  // tours + transfers — a flat price, same field name either way.
  return item.price != null ? `₹${Number(item.price).toLocaleString('en-IN')}` : 'On request';
}

// City + a second, tab-specific descriptor line — duration for tours/
// activities, vehicle type for transfers, star category for hotels.
function subtitle(tab, item) {
  const parts = [item.city];
  if (tab === 'hotels' && item.category) parts.push(`${item.category}★`);
  if ((tab === 'tours' || tab === 'activities') && item.duration) parts.push(item.duration);
  if (tab === 'transfers' && item.type) parts.push(item.type.replace(/_/g, ' '));
  return parts.filter(Boolean).join(' · ');
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

// Same grid-card shell as CatalogCard below (image block + name + a
// footer action), not a distinct layout — a document card in place of a
// photographed catalog item just swaps the placeholder for a PDF icon and
// the price/rating footer for a "Download PDF" button, and drops back into
// the exact same grid. Labeled "Download", not "View" — Cloudinary's own
// PDF/ZIP delivery restriction on this account (401 on resource_type:
// 'image') means this link can only be served as a forced-download raw
// file, not an inline in-browser preview; see this repo's own notes from
// diagnosing that for what it'd take to switch this to a real preview.
function OmanOverviewCard({ item }) {
  const pdfUrl = item.pdfUrl ?? item.pdf_url;
  return (
    <div className="group overflow-hidden rounded-2xl border border-agent-line-light bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative flex aspect-[4/3] flex-none items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#0B1130_0%,#181f45_100%)]">
        <LuFileText size={40} className="text-white/40" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
      </div>
      <div className="p-4">
        <div className="truncate text-sm font-bold text-agent-ink">{item.name}</div>
        <div className="mt-0.5 line-clamp-2 text-xs text-agent-muted">{stripHtmlSnippet(item.description)}</div>
        <div className="mt-3 border-t border-agent-line-light pt-2">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-agent-accent px-4 py-2 text-xs font-semibold text-agent-ink-dark shadow-sm shadow-agent-accent/30 transition hover:opacity-90"
          >
            <LuFileText size={13} />
            Download PDF
          </a>
        </div>
      </div>
    </div>
  );
}

function CatalogCard({ tab, item }) {
  const rating = item.rating ? Number(item.rating) : null;
  const reviewCount = item.reviewCount ?? item.review_count;
  return (
    <div className="group overflow-hidden rounded-2xl border border-agent-line-light bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[4/3] flex-none overflow-hidden bg-[linear-gradient(135deg,#0B1130_0%,#181f45_100%)]">
        <CatalogImage url={item.images?.[0]} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
      </div>
      <div className="p-4">
        <div className="truncate text-sm font-bold text-agent-ink">{item.name}</div>
        <div className="mt-0.5 truncate text-xs text-agent-muted">{subtitle(tab, item) || '—'}</div>
        {rating != null && (
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-agent-muted">
            <LuStar size={13} className="flex-none text-agent-accent-dark" />
            {rating.toFixed(1)} Rating{reviewCount != null && ` (${reviewCount})`}
          </div>
        )}
        <div className="mt-3 border-t border-agent-line-light pt-2">
          <div className="text-[10px] font-medium text-agent-muted">Starting at</div>
          <div className="text-base font-extrabold text-agent-ink-dark">{priceLabel(tab, item)}</div>
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
  const isOmanOverview = tab === 'oman-overviews';

  useEffect(() => {
    const meta = TABS.find((t) => t.key === tab);
    setLoading(true);
    setError('');
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
              <OmanOverviewCard key={item.id} item={item} />
            ) : (
              <CatalogCard key={item.id} tab={tab} item={item} />
            )
          )}
        </div>
      )}
    </div>
  );
}
